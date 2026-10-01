import * as XLSX from 'xlsx'
import { Opportunity, STAGES, SOURCES } from '@/types/crm'

export type OppTargetField =
  | 'company'
  | 'contact_name'
  | 'contact_phone'
  | 'contact_email'
  | 'city'
  | 'stage'
  | 'value'
  | 'message'
  | 'website'
  | 'source_ref'
  | 'last_contact'
  | 'next_contact'
  | 'ignore'

export interface FieldOption {
  key: OppTargetField
  label: string
  description?: string
  required?: boolean
}

export const TARGET_FIELDS: FieldOption[] = [
  { key: 'company', label: 'Empresa / Título da Oportunidade *', required: true },
  { key: 'contact_name', label: 'Nome do Contato' },
  { key: 'contact_phone', label: 'Telefone / Celular / WhatsApp' },
  { key: 'contact_email', label: 'E-mail do Contato' },
  { key: 'city', label: 'Cidade / Região' },
  { key: 'stage', label: 'Estágio / Status' },
  { key: 'value', label: 'Valor da Proposta (R$)' },
  { key: 'message', label: 'Mensagem / Observações / Pitch' },
  { key: 'website', label: 'Site Próprio (irá nas observações)' },
  { key: 'source_ref', label: 'Fonte / Origem (irá nas observações)' },
  { key: 'last_contact', label: 'Último Contato (irá nas observações)' },
  { key: 'next_contact', label: 'Próximo Retorno (irá nas observações)' },
  { key: 'ignore', label: '— Ignorar Coluna —' },
]

export interface ParsedSheetData {
  fileName: string
  sheetName: string
  headers: string[]
  rows: Record<string, string>[]
  hasDetectedHeader: boolean
}

export interface ProcessedLeadItem {
  company: string
  contact_name: string
  contact_phone: string
  contact_email: string
  city: string
  stage?: Opportunity['stage']
  value?: number
  source?: Opportunity['source']
  notesList: string[]
  fullMessage: string
  isDuplicate: boolean
  duplicateReason?: string
  sourceFile: string
}

// ---------------------------------------------------------------------------
// 1. Normalização de Dados (Telefone e Empresa)
// ---------------------------------------------------------------------------

/**
 * Normaliza número de telefone para chave de comparação única:
 * - Apenas dígitos
 * - Remove zeros à esquerda (ex: 011988887777 -> 11988887777)
 * - Remove DDI +55 do Brasil se tiver 12 ou 13 dígitos
 */
export function normalizePhoneKey(phoneStr: string): string {
  if (!phoneStr) return ''
  let digits = phoneStr.replace(/\D/g, '')
  // Remove zero(s) iniciais de discagem local/DDD
  digits = digits.replace(/^0+/, '')
  // Se começar com 55 e tiver comprimento de DDI + DDD + número (12 ou 13 dígitos)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2)
  }
  return digits
}

/**
 * Normaliza nome de empresa para comparação e deduplicação:
 * - Lowercase e sem acentos
 * - Remove sufixos jurídicos (LTDA, ME, EPP, EIRELI, S/A, S.A., SA, MEI, etc.)
 * - Remove pontuação e caracteres especiais
 */
export function normalizeCompanyKey(nameStr: string): string {
  if (!nameStr) return ''
  let norm = nameStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  // Remove sufixos jurídicos comuns no Brasil e no exterior
  norm = norm.replace(
    /\b(ltda|eireli|me|epp|s[./\s]?a|mei|s[./\s]?s|cia|inc|llc|corp|limitada|sociedade anonima)\b/gi,
    ' ',
  )
  // Remove caracteres que não sejam letras e números
  norm = norm.replace(/[^a-z0-9]/g, ' ')
  // Colapsa espaços múltiplos e remove espaços ao redor
  norm = norm.trim().replace(/\s+/g, '')
  return norm
}

/**
 * Formata telefone para exibição amigável
 */
export function formatPhoneDisplay(phoneStr: string): string {
  const norm = normalizePhoneKey(phoneStr)
  if (!norm) return phoneStr.trim()
  if (norm.length === 11) {
    return `(${norm.slice(0, 2)}) ${norm.slice(2, 7)}-${norm.slice(7)}`
  }
  if (norm.length === 10) {
    return `(${norm.slice(0, 2)}) ${norm.slice(2, 6)}-${norm.slice(6)}`
  }
  return phoneStr.trim()
}

/**
 * Converte valor textual de moeda (R$ 1.500,00 ou 1500.00) para número
 */
export function parseCurrencyValue(valStr: string): number | null {
  if (!valStr) return null
  let cleaned = valStr.replace(/[R$\s]/g, '').trim()
  if (!cleaned) return null

  // Tratar formatos brasileiro e internacional
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.indexOf('.') < cleaned.indexOf(',')) {
      // 1.500,00 -> 1500.00
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,500.00 -> 1500.00
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    // 1500,00 -> 1500.00
    cleaned = cleaned.replace(',', '.')
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Mapeia valor textual de status para os estágios suportados do CRM
 */
export function normalizeStageValue(stageStr: string): Opportunity['stage'] | null {
  if (!stageStr) return null
  const norm = stageStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (
    norm.includes('novo') ||
    norm.includes('new') ||
    norm.includes('lead') ||
    norm.includes('aberto') ||
    norm.includes('sem contato')
  ) {
    return 'Novo'
  }
  if (
    norm.includes('qualific') ||
    norm.includes('contat') ||
    norm.includes('atend') ||
    norm.includes('quente') ||
    norm.includes('morno')
  ) {
    return 'Qualificado'
  }
  if (
    norm.includes('propost') ||
    norm.includes('orcament') ||
    norm.includes('negocia') ||
    norm.includes('apresenta')
  ) {
    return 'Proposta'
  }
  if (
    norm.includes('ganho') ||
    norm.includes('fechad') ||
    norm.includes('venda') ||
    norm.includes('sucesso') ||
    norm.includes('contrato')
  ) {
    return 'Ganho'
  }
  if (
    norm.includes('perdid') ||
    norm.includes('recus') ||
    norm.includes('cancel') ||
    norm.includes('desist') ||
    norm.includes('descart') ||
    norm.includes('sem interesse')
  ) {
    return 'Perdido'
  }

  return null
}

/**
 * Mapeia valor textual de fonte para as origens suportadas do CRM
 */
export function normalizeSourceValue(sourceStr: string): Opportunity['source'] | null {
  if (!sourceStr) return null
  const norm = sourceStr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (norm.includes('whats') || norm.includes('zap') || norm.includes('wpp')) return 'WhatsApp'
  if (norm.includes('form') || norm.includes('public')) return 'Formulário Público'
  if (norm.includes('indica') || norm.includes('referral')) return 'Indicação'
  if (norm.includes('site') || norm.includes('web') || norm.includes('portal')) return 'Site'
  if (norm.includes('evento') || norm.includes('feira') || norm.includes('congresso'))
    return 'Evento'
  if (
    norm.includes('prospec') ||
    norm.includes('outbound') ||
    norm.includes('frio') ||
    norm.includes('ativa')
  ) {
    return 'Prospecção'
  }
  if (norm.includes('outro') || norm.includes('other')) return 'Outro'

  return null
}

// ---------------------------------------------------------------------------
// 2. Heurísticas de Conteúdo (Detecção por Regex nos Valores)
// ---------------------------------------------------------------------------

export function isPhoneContent(val: string): boolean {
  if (!val) return false
  const trimmed = val.trim()
  const cleaned = normalizePhoneKey(trimmed)
  // Números brasileiros válidos têm entre 8 e 11 dígitos
  if (cleaned.length >= 8 && cleaned.length <= 11) {
    // Se tiver formatação explícita de telefone ex: (11) ou hífen ou +55
    if (/[()\-+]/.test(trimmed) || /^(1\d|2\d|3\d|4\d|5\d|6\d|7\d|8\d|9\d)9?\d{8}$/.test(cleaned)) {
      return true
    }
  }
  return false
}

export function isEmailContent(val: string): boolean {
  if (!val) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
}

export function isUrlContent(val: string): boolean {
  if (!val) return false
  const t = val.trim().toLowerCase()
  return (
    t.startsWith('http://') ||
    t.startsWith('https://') ||
    t.startsWith('www.') ||
    t.startsWith('@') ||
    /\.(com|br|org|net|io|site|app|com\.br)\b/.test(t)
  )
}

export function isDateContent(val: string): boolean {
  if (!val) return false
  const t = val.trim()
  return (
    /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/.test(t) ||
    /^\d{4}[/\-.]\d{1,2}[/\-.]\d{1,2}(?:T|\s+)\d{1,2}:\d{1,2}/.test(t)
  )
}

export function isNumericOrCurrency(val: string): boolean {
  if (!val) return false
  const t = val.trim()
  if (/R\$|\$|BRL|€/.test(t)) return true
  // Padrão numérico monetário ex: 150,00 ou 1.500,00 ou 500
  if (/^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/.test(t)) return true
  if (/^\d+(?:\.\d{1,2})?$/.test(t)) return true
  return false
}

export function isCityOrStateContent(val: string): boolean {
  if (!val) return false
  const t = val
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  // Siglas de estados brasileiros
  const states = [
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ]
  if (states.includes(t)) return true
  // Cidades comuns ou formatos "Cidade - UF"
  if (
    /\b-\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i.test(
      val,
    )
  ) {
    return true
  }
  return false
}

/**
 * Infere o campo CRM de acordo com a amostra de valores presentes na coluna
 */
export function inferTargetFieldFromContent(values: string[]): OppTargetField | null {
  const nonEmpty = values.map((v) => String(v || '').trim()).filter((v) => v.length > 0)
  if (nonEmpty.length === 0) return null

  const total = nonEmpty.length
  let phoneCount = 0
  let emailCount = 0
  let urlCount = 0
  let dateCount = 0
  let currencyCount = 0
  let cityCount = 0
  let stageCount = 0
  let textLengthSum = 0

  for (const val of nonEmpty) {
    textLengthSum += val.length
    if (isPhoneContent(val)) phoneCount++
    if (isEmailContent(val)) emailCount++
    if (isUrlContent(val)) urlCount++
    if (isDateContent(val)) dateCount++
    if (isNumericOrCurrency(val)) currencyCount++
    if (isCityOrStateContent(val)) cityCount++
    if (normalizeStageValue(val)) stageCount++
  }

  // Se mais de 35% bater com formato de telefone
  if (phoneCount / total >= 0.35) return 'contact_phone'
  // Se mais de 40% for e-mail
  if (emailCount / total >= 0.4) return 'contact_email'
  // Se for URL ou Instagram
  if (urlCount / total >= 0.35) return 'website'
  // Se for valor numérico ou moeda
  if (currencyCount / total >= 0.5) return 'value'
  // Se for data
  if (dateCount / total >= 0.4) return 'last_contact'
  // Se for cidade / estado
  if (cityCount / total >= 0.35) return 'city'
  // Se for status de estágio
  if (stageCount / total >= 0.4) return 'stage'

  const avgLength = textLengthSum / total
  // Mensagens longas / observações
  if (avgLength > 60) return 'message'

  return null
}

// ---------------------------------------------------------------------------
// 3. Mapeamento Adaptativo por Cabeçalho (Fuzzy Matching com Sinônimos)
// ---------------------------------------------------------------------------

/**
 * Normaliza o texto do cabeçalho removendo acentos, pontuação e espaços
 */
export function normalizeHeaderString(header: string): string {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Casa o nome da coluna com o dicionário amplo de sinônimos (pt-BR e en)
 */
export function matchHeaderByKeyword(header: string): OppTargetField | null {
  const norm = normalizeHeaderString(header)

  // Ignorar IDs e numerações técnicas
  if (
    norm === '#' ||
    norm === 'id' ||
    norm === 'num' ||
    norm === 'numero' ||
    norm === 'codigo' ||
    norm === 'cod' ||
    norm === 'item' ||
    norm === 'index'
  ) {
    return 'ignore'
  }
  if (norm.includes('abrir whatsapp') || norm === 'link whatsapp') return 'ignore'

  // E-mail
  if (
    norm === 'email' ||
    norm === 'e mail' ||
    norm.includes('email') ||
    norm.includes('e mail') ||
    norm.includes('correio') ||
    norm === 'mail'
  ) {
    return 'contact_email'
  }

  // Telefone / Celular / WhatsApp
  if (
    norm.includes('celular') ||
    norm.includes('telefone') ||
    norm.includes('whats') ||
    norm.includes('zap') ||
    norm.includes('wpp') ||
    norm.includes('fone') ||
    norm.includes('phone') ||
    norm.includes('mobile') ||
    norm.includes('cel') ||
    norm === 'tel' ||
    norm.includes('tel fixo') ||
    norm.includes('tel celular')
  ) {
    return 'contact_phone'
  }

  // Cidade / Município / Região
  if (
    norm.includes('cidade') ||
    norm.includes('municipio') ||
    norm.includes('bairro') ||
    norm.includes('regiao') ||
    norm.includes('uf') ||
    norm.includes('estado') ||
    norm.includes('city') ||
    norm.includes('region') ||
    norm.includes('localidade') ||
    norm.includes('endereco') ||
    norm.includes('address')
  ) {
    return 'city'
  }

  // Site / Website / Redes
  if (
    norm.includes('site proprio') ||
    norm.includes('website') ||
    norm === 'site' ||
    norm.includes('url') ||
    norm === 'web' ||
    norm.includes('instagram') ||
    norm.includes('insta') ||
    norm === '@' ||
    norm.includes('dominio') ||
    norm.includes('link do site')
  ) {
    return 'website'
  }

  // Fonte / Origem
  if (
    norm.includes('fonte') ||
    norm.includes('origem') ||
    norm.includes('canal') ||
    norm.includes('source') ||
    norm.includes('onde achou') ||
    norm.includes('validacao') ||
    norm.includes('como conheceu') ||
    norm.includes('captacao')
  ) {
    return 'source_ref'
  }

  // Mensagem / Pitch / Anotações
  if (
    norm.includes('pitch') ||
    norm.includes('mensagem personalizada') ||
    norm.includes('mensagem') ||
    norm.includes('mensagens') ||
    norm.includes('observacao') ||
    norm.includes('observacoes') ||
    norm.includes('obs') ||
    norm.includes('anotacao') ||
    norm.includes('anotacoes') ||
    norm.includes('notes') ||
    norm.includes('detalhe') ||
    norm.includes('detalhes') ||
    norm.includes('comentario') ||
    norm.includes('historico') ||
    norm.includes('descricao') ||
    norm.includes('description')
  ) {
    return 'message'
  }

  // Status / Etapa
  if (
    norm.includes('status da ligacao') ||
    norm.includes('status do lead') ||
    norm.includes('status') ||
    norm.includes('situacao') ||
    norm.includes('etapa') ||
    norm.includes('stage') ||
    norm.includes('fase') ||
    norm.includes('funil')
  ) {
    return 'stage'
  }

  // Valor / Preço
  if (
    norm.includes('valor') ||
    norm.includes('preco') ||
    norm.includes('price') ||
    norm.includes('value') ||
    norm.includes('orcamento') ||
    norm.includes('montante') ||
    norm.includes('ticket') ||
    norm.includes('proposta')
  ) {
    return 'value'
  }

  // Último contato
  if (
    norm.includes('ultimo contato') ||
    norm.includes('ult contato') ||
    norm.includes('ultima conversa') ||
    norm.includes('last contact')
  ) {
    return 'last_contact'
  }

  // Próximo retorno
  if (
    norm.includes('proximo retorno') ||
    norm.includes('prox retorno') ||
    norm.includes('retorno') ||
    norm.includes('data retorno') ||
    norm.includes('next contact') ||
    norm.includes('follow up')
  ) {
    return 'next_contact'
  }

  // Nome do contato (pessoa)
  if (
    norm.includes('nome do contato') ||
    norm.includes('contato nome') ||
    norm.includes('pessoa de contato') ||
    norm.includes('responsavel') ||
    norm.includes('socio') ||
    norm.includes('contact person') ||
    norm.includes('interlocutor')
  ) {
    return 'contact_name'
  }

  // Empresa / Título da oportunidade
  if (
    norm.includes('empresa') ||
    norm.includes('estabelecimento') ||
    norm.includes('negocio') ||
    norm.includes('fantasia') ||
    norm.includes('razao social') ||
    norm.includes('nome da empresa') ||
    norm.includes('business') ||
    norm.includes('company') ||
    norm.includes('lead') ||
    norm.includes('cliente') ||
    norm.includes('contact') ||
    norm.includes('customer') ||
    norm === 'nome' ||
    norm === 'name' ||
    norm.includes('salao') ||
    norm.includes('estetica') ||
    norm.includes('loja') ||
    norm.includes('clinica')
  ) {
    return 'company'
  }

  // Coluna chamada genericamente "contato"
  if (norm === 'contato') {
    return 'contact_phone'
  }

  return null
}

/**
 * Constrói o mapeamento inicial inteligente para todas as colunas de uma planilha,
 * combinando casamento por palavras-chave com análise preditiva do conteúdo das linhas.
 */
export function guessInitialFileMappings(
  headers: string[],
  rows: Record<string, string>[],
): Record<string, OppTargetField> {
  const mapping: Record<string, OppTargetField> = {}
  const assignedFields = new Set<OppTargetField>()

  // 1ª Passagem: Palavras-chave nos cabeçalhos
  headers.forEach((header) => {
    const keywordMatch = matchHeaderByKeyword(header)
    if (keywordMatch && keywordMatch !== 'ignore') {
      // Se for company e já existir uma mapeada, pode ser contact_name
      if (keywordMatch === 'company' && assignedFields.has('company')) {
        mapping[header] = 'contact_name'
        assignedFields.add('contact_name')
      } else {
        mapping[header] = keywordMatch
        assignedFields.add(keywordMatch)
      }
    } else if (keywordMatch === 'ignore') {
      mapping[header] = 'ignore'
    }
  })

  // 2ª Passagem: Para as colunas não identificadas, inspecionar os valores
  headers.forEach((header) => {
    if (!mapping[header] || mapping[header] === 'ignore') {
      const sampleValues = rows.slice(0, 20).map((r) => r[header] || '')
      const contentGuess = inferTargetFieldFromContent(sampleValues)

      if (contentGuess) {
        // Se o campo inferido ainda não foi atribuído ou se for compatível
        if (!assignedFields.has(contentGuess) || contentGuess === 'message') {
          mapping[header] = contentGuess
          assignedFields.add(contentGuess)
        } else if (contentGuess === 'contact_phone' && !assignedFields.has('contact_phone')) {
          mapping[header] = 'contact_phone'
          assignedFields.add('contact_phone')
        }
      }
    }
  })

  // 3ª Passagem: Garantir que ao menos uma coluna seja 'company' (Título da Oportunidade)
  if (!assignedFields.has('company')) {
    // Procura a primeira coluna de texto livre preenchida
    let fallbackHeader: string | null = null
    for (const header of headers) {
      if (!mapping[header] || mapping[header] === 'ignore' || mapping[header] === 'contact_name') {
        fallbackHeader = header
        break
      }
    }
    if (fallbackHeader) {
      mapping[fallbackHeader] = 'company'
      assignedFields.add('company')
    } else if (headers.length > 0) {
      mapping[headers[0]] = 'company'
      assignedFields.add('company')
    }
  }

  // Preencher qualquer coluna restante como 'ignore'
  headers.forEach((header) => {
    if (!mapping[header]) {
      mapping[header] = 'ignore'
    }
  })

  return mapping
}

// ---------------------------------------------------------------------------
// 4. Detecção e Parsing de Separadores (CSV, TSV, TXT com Delimitador Automático)
// ---------------------------------------------------------------------------

/**
 * Auto-detecta o delimitador (; , \t ou |) com base na consistência entre as linhas
 */
export function detectDelimiter(text: string): string {
  const cleanText = text.replace(/^\uFEFF/, '')
  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 20)

  if (lines.length === 0) return ','

  const delimiters = [';', '\t', ',', '|']
  let bestDelim = ','
  let maxScore = -1

  for (const delim of delimiters) {
    const counts = lines.map((line) => {
      let count = 0
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') inQuotes = !inQuotes
        else if (line[i] === delim && !inQuotes) count++
      }
      return count
    })

    const nonZeroCounts = counts.filter((c) => c > 0)
    if (nonZeroCounts.length === 0) continue

    // Achar contagem mais frequente (moda)
    const freqMap: Record<number, number> = {}
    for (const c of nonZeroCounts) {
      freqMap[c] = (freqMap[c] || 0) + 1
    }

    let modeCount = 0
    let modeFreq = 0
    for (const [cStr, freq] of Object.entries(freqMap)) {
      const c = Number(cStr)
      if (freq > modeFreq || (freq === modeFreq && c > modeCount)) {
        modeFreq = freq
        modeCount = c
      }
    }

    const consistencyRatio = modeFreq / lines.length
    if (consistencyRatio >= 0.4 && modeCount >= 1) {
      let score = consistencyRatio * 100 + modeCount * 5
      // Priorizar ';' e '\t' no Brasil porque ',' é frequentemente usada como separador decimal
      if (delim === ';' || delim === '\t') score += 15
      if (score > maxScore) {
        maxScore = score
        bestDelim = delim
      }
    }
  }

  return bestDelim
}

/**
 * Parser RFC-4180 completo para texto delimitado (respeita aspas, quebras de linha e escapes)
 */
export function parseDelimitedText(text: string, delimiter: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentCell.trim())
      currentCell = ''
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow)
      }
      currentRow = []
    } else {
      currentCell += char
    }
  }

  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow)
    }
  }

  return rows
}

// ---------------------------------------------------------------------------
// 5. Detecção Inteligente da Linha de Cabeçalho (Smart Header Detection)
// ---------------------------------------------------------------------------

/**
 * Avalia as primeiras linhas para descobrir onde está o cabeçalho.
 * Se o arquivo for apenas de dados sem cabeçalho, retorna headerRowIdx = -1.
 */
export function detectHeaderRow(rawRows: string[][]): {
  headerRowIdx: number
  headers: string[]
  dataRows: Record<string, string>[]
} {
  if (!rawRows || rawRows.length === 0) {
    return { headerRowIdx: -1, headers: [], dataRows: [] }
  }

  // Determinar número máximo de colunas nas primeiras 20 linhas
  let maxCols = 0
  for (let r = 0; r < Math.min(20, rawRows.length); r++) {
    if (rawRows[r].length > maxCols) {
      maxCols = rawRows[r].length
    }
  }

  if (maxCols === 0) {
    return { headerRowIdx: -1, headers: [], dataRows: [] }
  }

  let bestHeaderIdx = -1
  let bestScore = -999

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = rawRows[r]
    const filledCells = row.filter((c) => String(c || '').trim() !== '')
    if (filledCells.length === 0) continue

    let rowScore = 0
    let keywordMatches = 0
    let dataPatternMatches = 0

    filledCells.forEach((cell) => {
      const trimmed = String(cell || '').trim()
      const kw = matchHeaderByKeyword(trimmed)

      if (kw && kw !== 'ignore') {
        rowScore += 35
        keywordMatches++
      }

      // Penalidades pesadas para formatos típicos de dados
      if (isPhoneContent(trimmed)) {
        rowScore -= 30
        dataPatternMatches++
      }
      if (isEmailContent(trimmed)) {
        rowScore -= 30
        dataPatternMatches++
      }
      if (isDateContent(trimmed)) {
        rowScore -= 25
        dataPatternMatches++
      }
      if (isNumericOrCurrency(trimmed)) {
        rowScore -= 20
        dataPatternMatches++
      }
      if (isUrlContent(trimmed)) {
        rowScore -= 20
        dataPatternMatches++
      }

      // Pontuação para textos de tamanho típico de título de coluna
      if (trimmed.length >= 2 && trimmed.length <= 40) {
        rowScore += 3
      }
    })

    // Se mais da metade das células da linha já baterem com padrões de dados, NÃO é cabeçalho
    if (dataPatternMatches >= Math.max(1, Math.floor(filledCells.length * 0.4))) {
      rowScore -= 100
    }

    // Se houver coincidência de palavras-chave, priorizar bastante
    if (keywordMatches >= 1) {
      rowScore += 50
    }

    if (rowScore > bestScore) {
      bestScore = rowScore
      bestHeaderIdx = r
    }
  }

  // Se a melhor pontuação for muito baixa ou negativa, significa que NÃO há cabeçalho (apenas dados)
  const hasDetectedHeader = bestScore > 10 && bestHeaderIdx >= 0

  let headers: string[] = []
  let startIndex = 0

  if (hasDetectedHeader) {
    const headerRow = rawRows[bestHeaderIdx] || []
    for (let c = 0; c < maxCols; c++) {
      const val = String(headerRow[c] || '').trim()
      headers.push(val || `Coluna ${c + 1}`)
    }
    startIndex = bestHeaderIdx + 1
  } else {
    // Sem cabeçalho: nomear as colunas como "Coluna 1", "Coluna 2", etc.
    for (let c = 0; c < maxCols; c++) {
      headers.push(`Coluna ${c + 1}`)
    }
    startIndex = 0
  }

  // Montar as linhas de dados
  const dataRows: Record<string, string>[] = []
  for (let r = startIndex; r < rawRows.length; r++) {
    const rowArr = rawRows[r] || []
    const hasData = rowArr.some((c) => String(c ?? '').trim() !== '')
    if (!hasData) continue

    const rowObj: Record<string, string> = {}
    let nonBlankCount = 0
    headers.forEach((h, colIdx) => {
      const cellVal = String(rowArr[colIdx] ?? '').trim()
      if (cellVal) nonBlankCount++
      rowObj[h] = cellVal
    })

    if (nonBlankCount > 0) {
      dataRows.push(rowObj)
    }
  }

  return {
    headerRowIdx: hasDetectedHeader ? bestHeaderIdx : -1,
    headers,
    dataRows,
  }
}

// ---------------------------------------------------------------------------
// 6. Suporte a JSON (.json - Lista de Objetos)
// ---------------------------------------------------------------------------

export function parseJsonFileContent(text: string): {
  headers: string[]
  rows: Record<string, string>[]
} {
  const data = JSON.parse(text)
  let items: unknown[] = []

  if (Array.isArray(data)) {
    items = data
  } else if (data && typeof data === 'object') {
    // Procurar por chaves de lista comuns como "data", "leads", "items", "results"
    const obj = data as Record<string, unknown>
    const arrayKey = Object.keys(obj).find((k) => Array.isArray(obj[k]))
    if (arrayKey && Array.isArray(obj[arrayKey])) {
      items = obj[arrayKey] as unknown[]
    } else {
      items = [data]
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Nenhum registro encontrado no arquivo JSON.')
  }

  // Caso seja array de arrays (grid)
  if (Array.isArray(items[0])) {
    const rawGrid = items.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []))
    const detected = detectHeaderRow(rawGrid)
    return {
      headers: detected.headers,
      rows: detected.dataRows,
    }
  }

  // Lista de objetos
  const headerSet = new Set<string>()
  const validObjects = items.filter(
    (it) => it && typeof it === 'object' && !Array.isArray(it),
  ) as Record<string, unknown>[]

  if (validObjects.length === 0) {
    throw new Error('O arquivo JSON não possui objetos de dados válidos.')
  }

  validObjects.forEach((it) => {
    Object.keys(it).forEach((k) => headerSet.add(k))
  })

  const headers = Array.from(headerSet)
  const rows: Record<string, string>[] = []

  validObjects.forEach((it) => {
    const rowObj: Record<string, string> = {}
    let nonBlank = 0
    headers.forEach((h) => {
      const v = it[h]
      const strVal =
        v === null || v === undefined
          ? ''
          : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v).trim()
      rowObj[h] = strVal
      if (strVal) nonBlank++
    })
    if (nonBlank > 0) {
      rows.push(rowObj)
    }
  })

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// 7. Leitor Universal de Arquivos (Universal Spreadsheet / Contact Importer)
// ---------------------------------------------------------------------------

/**
 * Lê QUALQUER arquivo de planilha ou lista de contatos (.xlsx, .xls, .ods, .csv, .tsv, .txt, .json)
 * e o adapta automaticamente para os dados estruturados do CRM.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSheetData[]> {
  const fileName = file.name || 'arquivo'
  const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()

  // 1. JSON (.json)
  if (ext === '.json') {
    try {
      const text = await file.text()
      const { headers, rows } = parseJsonFileContent(text)
      if (rows.length === 0) {
        throw new Error('Arquivo vazio ou sem dados interpretáveis')
      }
      return [
        {
          fileName,
          sheetName: 'JSON',
          headers,
          rows,
          hasDetectedHeader: true,
        },
      ]
    } catch (err) {
      console.error('Erro ao ler JSON:', err)
      throw new Error('Não conseguimos ler este arquivo. Tente XLSX, CSV ou TXT.')
    }
  }

  // 2. Arquivos de texto delimitado (.csv, .tsv, .txt)
  if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
    try {
      const text = await file.text()
      const delimiter = ext === '.tsv' ? '\t' : detectDelimiter(text)
      const rawRows = parseDelimitedText(text, delimiter)

      if (!rawRows || rawRows.length === 0) {
        throw new Error('Arquivo sem registros.')
      }

      const { headers, dataRows, headerRowIdx } = detectHeaderRow(rawRows)
      if (dataRows.length === 0) {
        throw new Error('Nenhuma linha de dados encontrada no arquivo de texto.')
      }

      return [
        {
          fileName,
          sheetName: 'Planilha 1',
          headers,
          rows: dataRows,
          hasDetectedHeader: headerRowIdx >= 0,
        },
      ]
    } catch (err) {
      console.error('Erro ao ler texto delimitado:', err)
      throw new Error('Não conseguimos ler este arquivo. Tente XLSX, CSV ou TXT.')
    }
  }

  // 3. Planilhas Excel e OpenDocument (.xlsx, .xls, .ods) ou fallback geral
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Planilha sem abas.')
    }

    // Se houver aba chamada "Leads", "Prospecção", etc. priorizar
    let sheetName = workbook.SheetNames[0]
    const preferred = workbook.SheetNames.find((name) => {
      const low = name.toLowerCase()
      return (
        low.includes('lead') ||
        low.includes('prospec') ||
        low.includes('dado') ||
        low.includes('contato') ||
        low.includes('cliente')
      )
    })
    if (preferred) {
      sheetName = preferred
    }

    const sheet = workbook.Sheets[sheetName]
    if (!sheet) {
      throw new Error('Aba não encontrada.')
    }

    // Converter para array de arrays
    const rawRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: '',
      blankrows: false,
    })

    if (!rawRows || rawRows.length === 0) {
      throw new Error('A planilha está vazia.')
    }

    const { headers, dataRows, headerRowIdx } = detectHeaderRow(rawRows)

    if (dataRows.length === 0) {
      throw new Error('Nenhuma linha com dados encontrada na planilha.')
    }

    return [
      {
        fileName,
        sheetName,
        headers,
        rows: dataRows,
        hasDetectedHeader: headerRowIdx >= 0,
      },
    ]
  } catch (err) {
    console.error('Erro no parser XLSX/ODS:', err)

    // Última tentativa: tentar ler como texto delimitado caso a extensão estivesse errada
    try {
      const text = await file.text()
      const delimiter = detectDelimiter(text)
      const rawRows = parseDelimitedText(text, delimiter)
      if (rawRows.length > 0) {
        const { headers, dataRows, headerRowIdx } = detectHeaderRow(rawRows)
        if (dataRows.length > 0) {
          return [
            {
              fileName,
              sheetName: 'Planilha 1',
              headers,
              rows: dataRows,
              hasDetectedHeader: headerRowIdx >= 0,
            },
          ]
        }
      }
    } catch {
      // Ignorar fallback
    }

    throw new Error('Não conseguimos ler este arquivo. Tente XLSX, CSV ou TXT.')
  }
}
