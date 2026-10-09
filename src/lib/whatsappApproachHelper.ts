import pb from '@/lib/pocketbase/client'
import { interpolateText, type InterpolationContext } from '@/services/approach-engine'
import type { Opportunity } from '@/types/crm'

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

export const DEFAULT_WHATSAPP_FOLLOWUP_TEMPLATE =
  'Olá, [NOME DO CONTATO]! Tudo bem? Aqui é o [NOME DO VENDEDOR], da Bit Consulting. Passando para saber se pude tirar dúvidas sobre o que conversamos a respeito do site da [NOME DA EMPRESA] em [CIDADE]. Conseguiu avaliar?'

/**
 * Gera um código rastreável curto para a oportunidade.
 * Formato: "{iniciais da empresa}-{últimos 4 dígitos do id}"
 * Ex: "Empresa do João S.A." com id "odvb8l05aoxjywg" -> "EJ-ywg" (ou 4 chars: "jywg")
 */
export function generateOpportunityShortRef(
  companyName?: string | null,
  opportunityId?: string | null,
): string {
  const comp = (companyName || '').trim()
  const oppId = (opportunityId || '').trim()

  // Iniciais da empresa (até 3 letras alfanuméricas maiúsculas)
  const words = comp
    .replace(/[^a-zA-Z0-9À-ÿ\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)

  let initials = ''
  if (words.length === 0) {
    initials = 'BIT'
  } else if (words.length === 1) {
    initials = words[0].slice(0, 3).toUpperCase()
  } else {
    initials = words
      .slice(0, 3)
      .map((w) => w[0].toUpperCase())
      .join('')
  }

  // Últimos 4 caracteres do ID da oportunidade
  const idSuffix = oppId ? oppId.slice(-4) : '0000'

  return `${initials}-${idSuffix}`
}

/**
 * Gera o rodapé de rastreabilidade para identificação futura da mensagem quando o cliente responder.
 * Exemplo: "— Carlos Silva, bit Consulting · Ref. EJ-jywg"
 */
export function generateMessageFooter(options: {
  sellerName?: string | null
  companyName?: string | null
  opportunityId?: string | null
}): string {
  const seller = (options.sellerName || '').trim() || 'Consultor Comercial'
  const ref = generateOpportunityShortRef(options.companyName, options.opportunityId)
  return `— ${seller}, bit Consulting · Ref. ${ref}`
}

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
 * Suporte a interpolação flexível com {contato}, {empresa}, {cidade}, {vendedor}, {data}
 * além dos marcadores legados [NOME DO CONTATO], [NOME DA EMPRESA], etc.
 */
export function interpolateVariables(
  template: string,
  variables: {
    contato?: string | null
    empresa?: string | null
    cidade?: string | null
    vendedor?: string | null
    data?: string | null
    segmento?: string | null
    telefone?: string | null
  },
): string {
  if (!template) return ''

  const contato = (variables.contato || '').trim() || 'Responsável'
  const empresa = (variables.empresa || '').trim() || 'sua empresa'
  const cidade = (variables.cidade || '').trim() || 'sua região'
  const vendedor = (variables.vendedor || '').trim() || 'Consultor Comercial'
  const data = (variables.data || '').trim()
  const segmento = (variables.segmento || '').trim() || 'seu segmento'
  const telefone = (variables.telefone || '').trim()

  let result = template
    // Suporte às chaves {variavel} solicitadas no prompt
    .replace(/\{contato\}/gi, contato)
    .replace(/\{empresa\}/gi, empresa)
    .replace(/\{cidade\}/gi, cidade)
    .replace(/\{vendedor\}/gi, vendedor)
    .replace(/\{data\}/gi, data || 'nosso último contato')
    .replace(/\{segmento\}/gi, segmento)
    .replace(/\{telefone\}/gi, telefone)
    // Suporte aos colchetes legados do playbook [NOME DO ...]
    .replace(/\[NOME DO CONTATO\]/gi, contato)
    .replace(/\[NOME DA EMPRESA\]/gi, empresa)
    .replace(/\[EMPRESA\]/gi, empresa)
    .replace(/\[CIDADE\]/gi, cidade)
    .replace(/\[NOME DO VENDEDOR\]/gi, vendedor)
    .replace(/\[DATA\]/gi, data || 'nosso último contato')
    .replace(/\[SEGMENTO\]/gi, segmento)
    .replace(/\[TELEFONE\]/gi, telefone)

  return result
}

export type WhatsAppActionType = 'initial' | 'followup'

/**
 * Constrói a mensagem completa de abordagem em lote (Inicial ou Follow-up) com rodapé rastreável.
 */
export function buildBatchWhatsAppMessage(options: {
  actionType: WhatsAppActionType
  scriptTemplate?: string | null
  opportunity: Opportunity
  sellerName?: string | null
  lastInteractionDate?: string | null
}): string {
  const { actionType, scriptTemplate, opportunity, sellerName, lastInteractionDate } = options

  const defaultTemplate =
    actionType === 'initial'
      ? DEFAULT_WHATSAPP_OPENING_TEMPLATE
      : lastInteractionDate
        ? 'Olá, [NOME DO CONTATO]! Tudo bem? Aqui é o [NOME DO VENDEDOR], da Bit Consulting. Passando para retomar nosso contato de {data} sobre o site da [NOME DA EMPRESA] em [CIDADE]. Conseguiu avaliar o que conversamos?'
        : DEFAULT_WHATSAPP_FOLLOWUP_TEMPLATE

  const rawTemplate = (scriptTemplate && scriptTemplate.trim()) || defaultTemplate

  let body = interpolateVariables(rawTemplate, {
    contato: opportunity.contact_name,
    empresa: opportunity.company,
    cidade: opportunity.city,
    vendedor: sellerName,
    data: lastInteractionDate,
    telefone: opportunity.contact_phone,
  })

  // Se houver menção opcional de data de retorno / última interação em follow-up e o template não a incluiu
  if (
    actionType === 'followup' &&
    lastInteractionDate &&
    !rawTemplate.includes('{data}') &&
    !rawTemplate.includes('[DATA]')
  ) {
    // Se o template não possui {data}, opcionalmente insere no primeiro parágrafo caso faça sentido ou mantém íntegro
  }

  // Rodapé rastreável obrigatório com vendedor e código curto da oportunidade
  const footer = generateMessageFooter({
    sellerName,
    companyName: opportunity.company,
    opportunityId: opportunity.id,
  })

  // Junta o corpo ao rodapé
  body = `${body.trim()}\n\n${footer}`
  return body
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
 * Formata data BR amigável para interpolação: "02/10" ou "02/10/2026"
 */
export function formatInteractionDateShort(isoDate?: string | null): string {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    if (isNaN(d.getTime())) return ''
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${day}/${month}`
  } catch {
    return ''
  }
}

/**
 * Registra a interação do tipo 'whatsapp' na timeline da oportunidade (opportunity_notes)
 */
export async function logWhatsAppInteractionToOpportunity(params: {
  opportunityId: string
  authorId: string
  message: string
  phone?: string
  actionType?: WhatsAppActionType
  autoQualify?: boolean
  opportunityDetails?: {
    company?: string
    contact_name?: string
    contact_phone?: string
    city?: string
    stage?: string
  }
}): Promise<boolean> {
  const {
    opportunityId,
    authorId,
    message,
    phone,
    actionType = 'initial',
    autoQualify = true,
    opportunityDetails,
  } = params
  if (!opportunityId || !authorId) return false

  try {
    const actionLabel = actionType === 'initial' ? '[WhatsApp inicial]' : '[WhatsApp follow-up]'

    const titlePrefix =
      actionType === 'initial' ? 'Mensagem inicial via WhatsApp' : 'Follow-up via WhatsApp'

    const summary = phone
      ? `${actionLabel} ${titlePrefix} enviada para ${phone}:\n\n"${message}"`
      : `${actionLabel} ${titlePrefix} aberta para envio:\n\n"${message}"`

    // 1. Registra a nota da mensagem enviada na timeline
    await pb.collection('opportunity_notes').create({
      opportunity: opportunityId,
      author: authorId,
      type: 'whatsapp',
      text: summary,
      date: new Date().toISOString(),
    })

    // 2. Registra sessão no Histórico de Abordagens (approach_sessions)
    try {
      let company = opportunityDetails?.company || ''
      let contactName = opportunityDetails?.contact_name || ''
      let contactPhone = phone || opportunityDetails?.contact_phone || ''
      let city = opportunityDetails?.city || ''
      let currentStage = opportunityDetails?.stage

      if (!company) {
        try {
          const oppRecord = await pb.collection('opportunities').getOne(opportunityId)
          company = oppRecord.company || ''
          contactName = oppRecord.contact_name || ''
          contactPhone = contactPhone || oppRecord.contact_phone || ''
          city = oppRecord.city || ''
          if (!currentStage) currentStage = oppRecord.stage
        } catch (fetchErr) {
          console.warn('Não foi possível obter dados complementares da oportunidade:', fetchErr)
        }
      }

      await pb.collection('approach_sessions').create({
        seller: authorId,
        opportunity: opportunityId,
        company_name: company,
        contact_name: contactName,
        contact_phone: contactPhone,
        city: city,
        channel: 'WhatsApp',
        status: actionType === 'initial' ? 'Contato realizado' : 'Contato realizado',
        temperature: 'morno',
        temperature_reason:
          actionType === 'initial'
            ? 'Abordagem inicial enviada via WhatsApp'
            : 'Follow-up enviado via WhatsApp',
        notes: `[Disparo WhatsApp - ${actionType === 'initial' ? 'Abordagem Inicial' : 'Follow-up'}]\n\nMensagem enviada:\n${message}`,
        questions_asked: [],
        answers: [],
        objections: [],
        quick_tags: [actionType === 'initial' ? 'WhatsApp inicial' : 'WhatsApp follow-up'],
      })
    } catch (sessionErr) {
      console.warn('Erro ao criar sessão em approach_sessions:', sessionErr)
    }

    // 3. Regra de negócio: Após envio de Abordagem Inicial via WhatsApp, mover a oportunidade
    // automaticamente para QUALIFICADO e registrar a mudança de estágio na timeline da oportunidade.
    if (actionType === 'initial' && autoQualify) {
      try {
        let shouldUpdate = true
        let oldStage = opportunityDetails?.stage
        if (!oldStage) {
          try {
            const oppRecord = await pb.collection('opportunities').getOne(opportunityId)
            oldStage = oppRecord.stage
          } catch {
            // assume Novo se falhar
          }
        }

        // Se já está Qualificado ou em estágios mais avançados (Agendado, Proposta, Ganho),
        // não faz downgrade nem duplica se já for Qualificado
        if (oldStage && oldStage !== 'Novo') {
          shouldUpdate = false
        }

        if (shouldUpdate) {
          await pb.collection('opportunities').update(opportunityId, {
            stage: 'Qualificado',
          })

          // Registrar a mudança de estágio na timeline (opportunity_notes)
          await pb.collection('opportunity_notes').create({
            opportunity: opportunityId,
            author: authorId,
            type: 'status_change',
            text: `[Mudança de estágio] Estágio alterado automaticamente de "${oldStage || 'Novo'}" para "Qualificado" após o envio da Abordagem Inicial via WhatsApp.`,
            date: new Date().toISOString(),
          })
        }
      } catch (stageErr) {
        console.warn('Erro ao mover oportunidade para Qualificado pós-envio inicial:', stageErr)
      }
    }

    return true
  } catch (err) {
    console.warn('Erro ao registrar interação de WhatsApp na timeline:', err)
    return false
  }
}
