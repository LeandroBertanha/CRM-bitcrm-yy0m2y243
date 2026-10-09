import pb from '@/lib/pocketbase/client'

export interface WhatsAppCloudSettings {
  id?: string
  initialTemplateName: string
  initialTemplateLanguage: string
  followupTemplateName: string
  followupTemplateLanguage: string
  throttleMs: number
  maxBatchSize: number
}

export interface WhatsAppCloudStatusResponse {
  configured: boolean
  phoneNumberIdMasked: string | null
  graphApiVersion: string
  settings: WhatsAppCloudSettings
}

export interface WhatsAppBatchSendItemResult {
  opportunityId: string
  company: string
  status: 'sent' | 'failed'
  reason?: string
  messageId?: string
  warning?: string
}

export interface WhatsAppBatchSendResponse {
  total: number
  sentCount: number
  failedCount: number
  results: WhatsAppBatchSendItemResult[]
}

/**
 * Consulta se a integração oficial com WhatsApp Cloud API está configurada no backend
 * (leitura de segredos no servidor via $os.getenv).
 */
export async function getWhatsAppCloudStatus(): Promise<WhatsAppCloudStatusResponse> {
  try {
    const res = await pb.send<WhatsAppCloudStatusResponse>('/backend/v1/whatsapp/status', {
      method: 'GET',
    })
    return res
  } catch (err: unknown) {
    console.warn('Erro ao consultar status do WhatsApp Cloud API:', err)
    return {
      configured: false,
      phoneNumberIdMasked: null,
      graphApiVersion: 'v26.0',
      settings: {
        initialTemplateName: 'bit_abordagem_inicial',
        initialTemplateLanguage: 'pt_BR',
        followupTemplateName: 'bit_followup_comercial',
        followupTemplateLanguage: 'pt_BR',
        throttleMs: 1000,
        maxBatchSize: 50,
      },
    }
  }
}

/**
 * Dispara lote automático oficial via WhatsApp Cloud API no backend.
 */
export async function sendWhatsAppBatchAuto(params: {
  actionType: 'initial' | 'followup'
  opportunityIds: string[]
  templateName?: string
  templateLanguage?: string
}): Promise<WhatsAppBatchSendResponse> {
  const res = await pb.send<WhatsAppBatchSendResponse>('/backend/v1/whatsapp/batch-send', {
    method: 'POST',
    body: params,
  })
  return res
}
