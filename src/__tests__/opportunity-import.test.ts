import { describe, it, expect } from 'vitest'
import {
  normalizeStageValue,
  parseCurrencyValue,
  normalizePhoneKey,
  normalizeCompanyKey,
  formatPhoneDisplay,
  matchSellerByName,
  normalizeSourceValue,
  matchHeaderByKeyword,
  detectDelimiter,
  parseDelimitedText,
  detectHeaderRow,
} from '@/lib/opportunityImportHelper'

describe('Normalizador de Importação de Oportunidades (opportunityImportHelper)', () => {
  describe('Normalização de Estágio (normalizeStageValue)', () => {
    it('mapeia variações de "Novo" corretamente', () => {
      expect(normalizeStageValue('Novo')).toBe('Novo')
      expect(normalizeStageValue('novo lead')).toBe('Novo')
      expect(normalizeStageValue('NÃO CONTATADO')).toBe('Novo')
      expect(normalizeStageValue('sem contato')).toBe('Novo')
      expect(normalizeStageValue('Aberto')).toBe('Novo')
      expect(normalizeStageValue('Pendente')).toBe('Novo')
      expect(normalizeStageValue('Lead')).toBe('Novo')
    })

    it('mapeia variações de "Qualificado" corretamente', () => {
      expect(normalizeStageValue('Qualificado')).toBe('Qualificado')
      expect(normalizeStageValue('qualificacao')).toBe('Qualificado')
      expect(normalizeStageValue('CONTATADO')).toBe('Qualificado')
      expect(normalizeStageValue('Atendido')).toBe('Qualificado')
      expect(normalizeStageValue('Lead Quente')).toBe('Qualificado')
    })

    it('mapeia variações de "Agendado" corretamente', () => {
      expect(normalizeStageValue('Agendado')).toBe('Agendado')
      expect(normalizeStageValue('reunião agendada')).toBe('Agendado')
      expect(normalizeStageValue('reuniao')).toBe('Agendado')
      expect(normalizeStageValue('Visita marcada')).toBe('Agendado')
      expect(normalizeStageValue('Scheduled')).toBe('Agendado')
    })

    it('mapeia variações de "Proposta" corretamente', () => {
      expect(normalizeStageValue('Proposta')).toBe('Proposta')
      expect(normalizeStageValue('proposta enviada')).toBe('Proposta')
      expect(normalizeStageValue('Orçamento')).toBe('Proposta')
      expect(normalizeStageValue('Negociação')).toBe('Proposta')
      expect(normalizeStageValue('Apresentação')).toBe('Proposta')
    })

    it('mapeia variações de "Ganho" corretamente', () => {
      expect(normalizeStageValue('Ganho')).toBe('Ganho')
      expect(normalizeStageValue('fechado')).toBe('Ganho')
      expect(normalizeStageValue('Venda Realizada')).toBe('Ganho')
      expect(normalizeStageValue('Contrato assinado')).toBe('Ganho')
    })

    it('mapeia variações de "Perdido" corretamente', () => {
      expect(normalizeStageValue('Perdido')).toBe('Perdido')
      expect(normalizeStageValue('Recusado')).toBe('Perdido')
      expect(normalizeStageValue('cancelado')).toBe('Perdido')
      expect(normalizeStageValue('Sem interesse')).toBe('Perdido')
      expect(normalizeStageValue('Descartado')).toBe('Perdido')
    })

    it('retorna null para estágios desconhecidos ou vazios (para cair no padrão "Novo")', () => {
      expect(normalizeStageValue('')).toBeNull()
      expect(normalizeStageValue('Status X Desconhecido')).toBeNull()
    })
  })

  describe('Normalização de Valores Monetários BRL (parseCurrencyValue)', () => {
    it('converte formato brasileiro R$ 1.500,00', () => {
      expect(parseCurrencyValue('R$ 1.500,00')).toBe(1500)
      expect(parseCurrencyValue('R$ 2.450,50')).toBe(2450.5)
      expect(parseCurrencyValue('1.500,00')).toBe(1500)
      expect(parseCurrencyValue('500,00')).toBe(500)
    })

    it('converte formato decimal americano ou sem formatação', () => {
      expect(parseCurrencyValue('1500.00')).toBe(1500)
      expect(parseCurrencyValue('1,500.00')).toBe(1500)
      expect(parseCurrencyValue('500')).toBe(500)
      expect(parseCurrencyValue(' 750 ')).toBe(750)
    })

    it('retorna null para valores inválidos ou vazios', () => {
      expect(parseCurrencyValue('')).toBeNull()
      expect(parseCurrencyValue('abc')).toBeNull()
      expect(parseCurrencyValue('R$ ')).toBeNull()
    })
  })

  describe('Normalização de Telefone (normalizePhoneKey e formatPhoneDisplay)', () => {
    it('remove caracteres não numéricos', () => {
      expect(normalizePhoneKey('(11) 98765-4321')).toBe('11987654321')
      expect(normalizePhoneKey('+55 11 98765-4321')).toBe('11987654321')
      expect(normalizePhoneKey('5511987654321')).toBe('11987654321')
    })

    it('remove zeros à esquerda de operadora / discagem', () => {
      expect(normalizePhoneKey('011987654321')).toBe('11987654321')
    })

    it('formata para exibição amigável', () => {
      expect(formatPhoneDisplay('11987654321')).toBe('(11) 98765-4321')
      expect(formatPhoneDisplay('1133334444')).toBe('(11) 3333-4444')
    })
  })

  describe('Deduplicação de Empresa (normalizeCompanyKey)', () => {
    it('remove sufixos societários comuns no Brasil e ignora caixa/acentos', () => {
      expect(normalizeCompanyKey('Padaria do João LTDA')).toBe('padariadojoao')
      expect(normalizeCompanyKey('PADARIA DO JOÃO ME')).toBe('padariadojoao')
      expect(normalizeCompanyKey('Padaria do Joao S/A')).toBe('padariadojoao')
      expect(normalizeCompanyKey('Padaria do João - EPP')).toBe('padariadojoao')
      expect(normalizeCompanyKey('Padaria do João MEI')).toBe('padariadojoao')
    })

    it('remove pontuações e caracteres especiais', () => {
      expect(normalizeCompanyKey('Tech & Co. Brasil!')).toBe('techcobrasil')
    })
  })

  describe('Correspondência de Vendedor (matchSellerByName)', () => {
    const sellersList = [
      { id: 'usr_leandro', name: 'Leandro Bertanha', email: 'leandro.bertanha@lbertanha.com' },
      { id: 'usr_maria', name: 'Maria Silva', email: 'maria.vendas@bitconsulting.com.br' },
      { id: 'usr_carlos', name: 'Carlos Eduardo', email: 'carlos@bitcrm.app' },
    ]

    it('mapeia por e-mail exato ou prefixo', () => {
      expect(matchSellerByName('leandro.bertanha@lbertanha.com', sellersList)).toBe('usr_leandro')
      expect(matchSellerByName('leandro.bertanha', sellersList)).toBe('usr_leandro')
      expect(matchSellerByName('carlos', sellersList)).toBe('usr_carlos')
    })

    it('mapeia por nome completo ou primeiro nome sem acento', () => {
      expect(matchSellerByName('Leandro Bertanha', sellersList)).toBe('usr_leandro')
      expect(matchSellerByName('leandro bertanha', sellersList)).toBe('usr_leandro')
      expect(matchSellerByName('Maria', sellersList)).toBe('usr_maria')
      expect(matchSellerByName('Carlos Eduardo', sellersList)).toBe('usr_carlos')
    })

    it('retorna null quando o vendedor não for encontrado na equipe', () => {
      expect(matchSellerByName('Vendedor Fantasma', sellersList)).toBeNull()
      expect(matchSellerByName('', sellersList)).toBeNull()
    })
  })

  describe('Normalização de Origem (normalizeSourceValue)', () => {
    it('identifica origens válidas do CRM', () => {
      expect(normalizeSourceValue('WhatsApp')).toBe('WhatsApp')
      expect(normalizeSourceValue('Zap')).toBe('WhatsApp')
      expect(normalizeSourceValue('Indicação de amigo')).toBe('Indicação')
      expect(normalizeSourceValue('Landing Page')).toBe('Site')
      expect(normalizeSourceValue('Site Oficial')).toBe('Site')
      expect(normalizeSourceValue('Feira de Negócios')).toBe('Evento')
      expect(normalizeSourceValue('Outbound frio')).toBe('Prospecção')
    })
  })

  describe('Mapeamento Heurístico de Cabeçalhos (matchHeaderByKeyword)', () => {
    it('identifica colunas comerciais essenciais por termos comuns', () => {
      expect(matchHeaderByKeyword('Nome da Empresa')).toBe('company')
      expect(matchHeaderByKeyword('Razão Social')).toBe('company')
      expect(matchHeaderByKeyword('Telefone / WhatsApp')).toBe('contact_phone')
      expect(matchHeaderByKeyword('Celular')).toBe('contact_phone')
      expect(matchHeaderByKeyword('E-mail')).toBe('contact_email')
      expect(matchHeaderByKeyword('Cidade')).toBe('city')
      expect(matchHeaderByKeyword('Valor da Proposta')).toBe('value')
      expect(matchHeaderByKeyword('Status do Lead')).toBe('stage')
      expect(matchHeaderByKeyword('Vendedor Responsável')).toBe('seller')
      expect(matchHeaderByKeyword('Origem')).toBe('source')
      expect(matchHeaderByKeyword('Mensagem')).toBe('message')
    })

    it('marca colunas de controle interno como ignore', () => {
      expect(matchHeaderByKeyword('#')).toBe('ignore')
      expect(matchHeaderByKeyword('ID')).toBe('ignore')
      expect(matchHeaderByKeyword('Link WhatsApp')).toBe('ignore')
    })
  })

  describe('Parsing de Arquivos Delimitados (CSV)', () => {
    it('detecta delimitador ponto-e-vírgula comum no Excel em pt-BR', () => {
      const csvContent =
        'Empresa;Telefone;Valor\nPadaria Alfa;11999998888;1500\nClinica Beta;11988887777;2000'
      const delim = detectDelimiter(csvContent)
      expect(delim).toBe(';')
      const rows = parseDelimitedText(csvContent, delim)
      expect(rows.length).toBe(3)
      const headerInfo = detectHeaderRow(rows)
      expect(headerInfo.headers).toEqual(['Empresa', 'Telefone', 'Valor'])
      expect(headerInfo.dataRows.length).toBe(2)
      expect(headerInfo.dataRows[0]['Empresa']).toBe('Padaria Alfa')
    })

    it('detecta delimitador vírgula e respeita aspas', () => {
      const csvContent =
        'Empresa,Contato,Cidade\n"Empresa, X",João,São Paulo\n"Empresa Y",Maria,Santos'
      const delim = detectDelimiter(csvContent)
      expect(delim).toBe(',')
      const rows = parseDelimitedText(csvContent, delim)
      expect(rows[1][0]).toBe('Empresa, X')
      expect(rows[1][1]).toBe('João')
      expect(rows[1][2]).toBe('São Paulo')
    })
  })
})
