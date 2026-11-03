import { isValidCnpj, normalizeCnpj } from '@/lib/clientConversion'
import type { ClientDocumentField } from '@/types/client'

export type RecognizedClientData = Partial<{
  name: string
  legal_name: string
  cnpj: string
  state_registration: string
  contact_name: string
  contact_email: string
  contact_phone: string
  zip_code: string
  street: string
  address_number: string
  complement: string
  district: string
  city: string
  state: string
}>

export type DocumentRecognitionProgress = {
  message: string
  progress?: number
}

export type DocumentRecognitionResult = {
  data: RecognizedClientData
  warnings: string[]
  textLength: number
}

type ProgressCallback = (progress: DocumentRecognitionProgress) => void

const MAX_PDF_PAGES = 6
const MAX_OCR_PAGES = 3
const MIN_USEFUL_TEXT_LENGTH = 80

let activeOcrProgress: ProgressCallback | undefined
let ocrWorkerPromise: ReturnType<typeof createOcrWorker> | null = null

const cleanValue = (value: string): string =>
  value
    .replace(/^[\s:;|\-–—]+/, '')
    .replace(/[\s|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

const normalizeText = (text: string): string =>
  text
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const labeledValue = (text: string, labels: string[], maxLength = 160): string => {
  for (const label of labels) {
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${escaped(label)}\\s*(?::|-)??\\s*([^\\n]{1,${maxLength}})`,
      'imu',
    )
    const match = text.match(pattern)
    if (match?.[1]) return cleanValue(match[1])

    const nextLinePattern = new RegExp(
      `(?:^|\\n)\\s*${escaped(label)}\\s*(?:\\n)+\\s*([^\\n]{1,${maxLength}})`,
      'imu',
    )
    const nextLineMatch = text.match(nextLinePattern)
    if (nextLineMatch?.[1]) return cleanValue(nextLineMatch[1])
  }
  return ''
}

const firstMatch = (text: string, pattern: RegExp): string =>
  cleanValue(text.match(pattern)?.[1] || '')

const validCnpjFromText = (text: string): string => {
  const candidates = text.match(/\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}\b/g) || []
  return candidates.map(normalizeCnpj).find(isValidCnpj) || ''
}

const sanitizeUf = (value: string): string => {
  const match = value
    .toUpperCase()
    .match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/)
  return match?.[1] || ''
}

const splitAddress = (
  value: string,
): Pick<RecognizedClientData, 'street' | 'address_number' | 'complement'> => {
  if (!value) return {}
  const parts = value.split(',').map(cleanValue).filter(Boolean)
  if (parts.length < 2) return { street: value }

  const numberMatch = parts[1].match(/^(\d+[A-Za-z/-]*)\b\s*(.*)$/)
  return {
    street: parts[0],
    address_number: numberMatch?.[1] || '',
    complement: cleanValue(numberMatch?.[2] || parts.slice(2).join(', ')),
  }
}

export const parseClientDocumentText = (
  rawText: string,
  documentField?: ClientDocumentField,
): RecognizedClientData => {
  const text = normalizeText(rawText)
  if (!text) return {}

  const cnpj = validCnpjFromText(text)
  const email = firstMatch(text, /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i).toLowerCase()
  const labeledPhone = labeledValue(text, ['TELEFONE', 'TEL.', 'CELULAR', 'WHATSAPP', 'FONE'], 40)
  const phone =
    firstMatch(labeledPhone, /((?:\+?55\s*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4})/i) ||
    firstMatch(text, /((?:\+?55\s*)?\(\d{2}\)\s*9?\d{4}[-\s]?\d{4})/i)
  const zipCode = firstMatch(text, /\b(\d{5}[-.\s]?\d{3})\b/).replace(/\D/g, '')

  const legalName = labeledValue(text, [
    'NOME EMPRESARIAL',
    'RAZÃO SOCIAL',
    'RAZAO SOCIAL',
    'CONTRATANTE',
    'CLIENTE',
  ])
  const fantasyName = labeledValue(text, [
    'TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA)',
    'TITULO DO ESTABELECIMENTO (NOME DE FANTASIA)',
    'NOME DE FANTASIA',
    'NOME FANTASIA',
  ])
  const stateRegistration = labeledValue(text, [
    'INSCRIÇÃO ESTADUAL',
    'INSCRICAO ESTADUAL',
    'I.E.',
    'IE',
  ])
  const contactName = labeledValue(text, [
    'REPRESENTANTE LEGAL',
    'RESPONSÁVEL LEGAL',
    'RESPONSAVEL LEGAL',
    'NOME DO CONTATO',
  ])

  const fullAddress = labeledValue(text, [
    'ENDEREÇO COMPLETO',
    'ENDERECO COMPLETO',
    'ENDEREÇO',
    'ENDERECO',
  ])
  const splitFullAddress = splitAddress(fullAddress)
  const street =
    labeledValue(text, ['LOGRADOURO', 'RUA', 'AVENIDA']) || splitFullAddress.street || ''
  const labeledAddressNumber =
    text
      .split('\n')
      .map((line) =>
        cleanValue(line.match(/^\s*(?:NÚMERO|NUMERO|Nº|N°)\s*(?::|-)?\s*(.{1,30})$/iu)?.[1] || ''),
      )
      .find((value) => value && !/^DE\s+INSCRI(?:ÇÃO|CAO)/iu.test(value)) || ''
  const addressNumber = labeledAddressNumber || splitFullAddress.address_number || ''
  const complement = labeledValue(text, ['COMPLEMENTO'], 80) || splitFullAddress.complement || ''
  const district = labeledValue(text, ['BAIRRO / DISTRITO', 'BAIRRO/DISTRITO', 'BAIRRO'], 80)
  const city = labeledValue(text, ['MUNICÍPIO', 'MUNICIPIO', 'CIDADE'], 80)
  const state = sanitizeUf(labeledValue(text, ['UF', 'ESTADO'], 30))

  const data: RecognizedClientData = {
    name: fantasyName,
    legal_name: legalName,
    cnpj,
    state_registration: stateRegistration,
    contact_name: contactName,
    contact_email: email,
    contact_phone: phone,
    zip_code: zipCode,
    street,
    address_number: addressNumber,
    complement,
    district,
    city,
    state,
  }

  // O cartão CNPJ é a fonte fiscal mais confiável. Em contratos e propostas,
  // nomes sem rótulo explícito não devem substituir o cadastro existente.
  if (documentField !== 'cnpj_card_files' && !fantasyName) delete data.name

  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => String(value || '').trim()),
  ) as RecognizedClientData
}

async function createOcrWorker() {
  const { createWorker, OEM } = await import('tesseract.js')
  return createWorker('por', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/tesseract-core-lstm.wasm.js',
    langPath: '/ocr',
    gzip: true,
    logger: (message) => {
      activeOcrProgress?.({
        message:
          message.status === 'recognizing text'
            ? 'Reconhecendo texto da imagem...'
            : 'Preparando OCR local...',
        progress: message.progress,
      })
    },
  })
}

const getOcrWorker = async (onProgress?: ProgressCallback) => {
  activeOcrProgress = onProgress
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createOcrWorker().catch((error) => {
      ocrWorkerPromise = null
      throw error
    })
  }
  return ocrWorkerPromise
}

const recognizeImage = async (image: File | HTMLCanvasElement, onProgress?: ProgressCallback) => {
  const worker = await getOcrWorker(onProgress)
  const result = await worker.recognize(image)
  return result.data.text || ''
}

const extractPdfText = async (file: File, onProgress?: ProgressCallback): Promise<string> => {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default

  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
    .promise
  const pageCount = Math.min(document.numPages, MAX_PDF_PAGES)
  const textParts: string[] = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    onProgress?.({
      message: `Lendo página ${pageNumber} de ${pageCount}...`,
      progress: pageNumber / pageCount,
    })
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    const pageText = (content.items as Array<{ str?: string }>)
      .map((item) => item.str || '')
      .join(' ')
    textParts.push(pageText)
  }

  const extractedText = normalizeText(textParts.join('\n'))
  if (extractedText.length >= MIN_USEFUL_TEXT_LENGTH) return extractedText

  const ocrParts: string[] = []
  const ocrPageCount = Math.min(document.numPages, MAX_OCR_PAGES)
  for (let pageNumber = 1; pageNumber <= ocrPageCount; pageNumber += 1) {
    onProgress?.({ message: `Aplicando OCR na página ${pageNumber} de ${ocrPageCount}...` })
    const page = await document.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1.75 })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) continue
    await page.render({ canvas, canvasContext: context, viewport }).promise
    ocrParts.push(await recognizeImage(canvas, onProgress))
  }

  return normalizeText(`${extractedText}\n${ocrParts.join('\n')}`)
}

const extractDocxText = async (file: File): Promise<string> => {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return normalizeText(result.value)
}

export const recognizeClientDocument = async (
  file: File,
  documentField: ClientDocumentField,
  onProgress?: ProgressCallback,
): Promise<DocumentRecognitionResult> => {
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const warnings: string[] = []
  let text = ''

  onProgress?.({ message: `Analisando ${file.name}...`, progress: 0 })

  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    text = await recognizeImage(file, onProgress)
  } else if (file.type === 'application/pdf' || extension === 'pdf') {
    text = await extractPdfText(file, onProgress)
  } else if (extension === 'docx') {
    text = await extractDocxText(file)
  } else if (extension === 'doc') {
    warnings.push(
      'O arquivo .doc será anexado, mas o reconhecimento automático exige o formato .docx.',
    )
  } else {
    warnings.push('Formato sem reconhecimento automático. O arquivo será anexado normalmente.')
  }

  if (text && text.length < MIN_USEFUL_TEXT_LENGTH) {
    warnings.push('Foi encontrado pouco texto no documento; revise os campos preenchidos.')
  }

  return {
    data: parseClientDocumentText(text, documentField),
    warnings,
    textLength: text.length,
  }
}
