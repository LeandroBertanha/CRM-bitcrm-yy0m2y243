import pb from '@/lib/pocketbase/client'
import type { PlaybookScript } from '@/types/playbook'
import { interpolateText, type InterpolationContext } from '@/services/approach-engine'

/**
 * Normaliza o número de telefone para o padrão do link wa.me:
 * - Apenas dígitos
 * - Remove zeros à esquerda (ex: 011999998888 -> 11999998888)
 * - Se já tiver DDI 55 (12 ou 13 dígitos começando com 55), preserva sem duplicar
 * - Se tiver 10 ou 11 dígitos (DDD + número brasileiro), adiciona o DDI 55
 * - Retorna apenas os dígitos válidos ou string vazia se inválido
 */
export function normalizePhoneForWhatsApp(phoneStr: string | null | undefined): string {
  if (!phoneStr) return ''
  let digits = phoneStr.replace(/\D/g, '')
  // Remove zeros iniciais de discagem local/DDD
  digits = digits.replace(/^0+/, '')

  if (!digits) return ''

  // Se já tiver DDI 55 e tiver 12 ou 13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits
  }

  // Se tiver DDD + telefone (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  // Outros formatos numéricos (ex: número internacional já com DDI ou tamanho personalizado)
  return digits
}

/**
 * Fallback padrão caso o playbook não tenha script cadastrado ou ocorra falha de rede.
 * Focado no canal WhatsApp e no tom dos scripts da Bit Consulting.
 */
export const DEFAULT_WHATSAPP_OPENING_TEMPLATE =
  'Olá, [NOME DO CONTATO]! Aqui é [NOME DO VENDEDOR] da Bit Consulting. Vi o trabalho da [NOME DA EMPRESA] em [CIDADE] e gostaria de apresentar como um site profissional pode ajudar a captar mais clientes pelo WhatsApp. Podemos conversar?'

export const DEFAULT_WHATSAPP_GENERIC_TEMPLATE =
  'Olá! Aqui é [NOME DO VENDEDOR] da Bit Consulting. Ajudamos empresas a terem um site profissional para atrair mais clientes e gerar mais contatos no WhatsApp. Podemos conversar?'

/**
 * Constrói a mensagem inicial de WhatsApp usando o script do banco (se houver) ou o fallback,
 * interpolando os dados da oportunidade e vendedor.
 */
export function buildWhatsAppMessage(options: {
  scriptTemplate?: string | null
  context: InterpolationContext
  hasOpportunity?: boolean
}): string {
  const { scriptTemplate, context, hasOpportunity } = options

  // Se há script vindo do banco/playbook
  if (scriptTemplate && scriptTemplate.trim()) {
    return interpolateText(scriptTemplate.trim(), context)
  }

  // Fallback: se tem oportunidade vinculada (ou dados personalizados preenchidos)
  const hasCustomData = Boolean(
    hasOpportunity ||
    (context.companyName && context.companyName !== 'sua empresa') ||
    (context.contactName && context.contactName !== 'Responsável'),
  )

  const template = hasCustomData
    ? DEFAULT_WHATSAPP_OPENING_TEMPLATE
    : DEFAULT_WHATSAPP_GENERIC_TEMPLATE

  return interpolateText(template, context)
}

/**
 * Gera a URL do WhatsApp Web / wa.me com mensagem URL-encodada
 */
export function buildWhatsAppWebUrl(phoneDigits: string, message: string): string {
  const encodedText = encodeURIComponent(message)
  if (!phoneDigits) {
    return `https://wa.me/?text=${encodedText}`
  }
  return `https://wa.me/${phoneDigits}?text=${encodedText}`
}

/**
 * Registra a interação do tipo 'whatsapp' na timeline da oportunidade (opportunity_notes)
 */
export async function logWhatsAppInteractionToOpportunity(params: {
  opportunityId: string
  authorId: string
  message: string
  phone?: string
}): Promise<boolean> {
  const { opportunityId, authorId, message, phone } = params
  if (!opportunityId || !authorId) return false

  try {
    const summary = phone
      ? `Mensagem de abertura enviada via WhatsApp para ${phone}:\n\n"${message}"`
      : `Mensagem de abertura aberta para envio no WhatsApp:\n\n"${message}"`

    await pb.collection('opportunity_notes').create({
      opportunity: opportunityId,
      author: authorId,
      type: 'whatsapp',
      text: summary,
      date: new Date().toISOString(),
    })
    return true
  } catch (err) {
    console.warn('Erro ao registrar interação de WhatsApp na timeline:', err)
    return false
  }
}
