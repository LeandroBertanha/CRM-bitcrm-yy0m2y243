import pb from '@/lib/pocketbase/client'
import type {
  SdrEnvironment,
  SdrPreparedContact,
  SdrPreparedMessage,
  SdrSettings,
} from '@/types/sdr'

interface SdrApiErrorPayload {
  code?: string
  error?: string
}

export class SdrOperationsError extends Error {
  code: string

  constructor(message: string, code = 'SDR_OPERATION_FAILED') {
    super(message)
    this.name = 'SdrOperationsError'
    this.code = code
  }
}

function normalizeError(error: unknown, fallback: string): SdrOperationsError {
  const response =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error.response as SdrApiErrorPayload)
      : null
  return new SdrOperationsError(
    response?.error || (error instanceof Error ? error.message : fallback),
    response?.code,
  )
}

export async function updateSdrSettings(input: {
  enabled: boolean
  environment: SdrEnvironment
  allowOpportunityCreation: boolean
  confirmationPhrase: string
}): Promise<SdrSettings> {
  try {
    const response = await pb.send<{ success: true; settings: SdrSettings }>(
      '/backend/v1/sdr/settings/update',
      { method: 'POST', body: input },
    )
    return response.settings
  } catch (error) {
    throw normalizeError(error, 'Nao foi possivel atualizar a configuracao do SDR.')
  }
}

export async function createSdrCampaign(input: {
  name: string
  template: string
  contacts: SdrPreparedContact[]
  messages: SdrPreparedMessage[]
}): Promise<{
  campaignId: string
  status: string
  contactsCreated: number
  messagesCreated: number
  message: string
}> {
  const messageByCorrelation = new Map(
    input.messages.map((message) => [message.correlationId, message]),
  )

  try {
    return await pb.send('/backend/v1/sdr/campaigns/create', {
      method: 'POST',
      body: {
        name: input.name,
        template: input.template,
        humanConfirmed: true,
        contacts: input.contacts.map((contact) => ({
          companyName: contact.companyName,
          opportunityId: contact.opportunityId,
          contactName: contact.contactName,
          phone: contact.normalizedPhone,
          email: contact.normalizedEmail,
          correlationId: contact.correlationId,
          deduplicationKey: contact.deduplicationKey,
          authorizedForContact: contact.authorizedForTest,
          messageBody: messageByCorrelation.get(contact.correlationId)?.body || '',
        })),
      },
    })
  } catch (error) {
    throw normalizeError(error, 'Nao foi possivel registrar a campanha SDR.')
  }
}
