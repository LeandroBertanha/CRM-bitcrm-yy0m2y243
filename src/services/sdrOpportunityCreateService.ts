import pb from '@/lib/pocketbase/client'
import type { SdrOpportunityCreationPayload } from '@/types/sdr'

export interface CreateSdrOpportunityInput extends SdrOpportunityCreationPayload {
  correlationId: string
  idempotencyKey: string
  humanConfirmed: true
}

export interface CreateSdrOpportunityResponse {
  success: true
  idempotent: boolean
  opportunityId: string
  message: string
}

interface SdrApiErrorPayload {
  code?: string
  error?: string
}

export class SdrOpportunityCreateError extends Error {
  code: string

  constructor(message: string, code = 'SDR_CREATE_FAILED') {
    super(message)
    this.name = 'SdrOpportunityCreateError'
    this.code = code
  }
}

export async function createSdrOpportunity(
  input: CreateSdrOpportunityInput,
): Promise<CreateSdrOpportunityResponse> {
  try {
    return await pb.send<CreateSdrOpportunityResponse>('/backend/v1/sdr/opportunities/create', {
      method: 'POST',
      body: {
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
        humanConfirmed: input.humanConfirmed,
        company: input.company,
        contactName: input.contact_name,
        contactPhone: input.contact_phone,
        contactEmail: input.contact_email,
      },
      requestKey: `sdr-create-opportunity-${input.idempotencyKey}`,
    })
  } catch (error: unknown) {
    const response =
      typeof error === 'object' && error !== null && 'response' in error
        ? (error.response as SdrApiErrorPayload)
        : null
    throw new SdrOpportunityCreateError(
      response?.error || (error instanceof Error ? error.message : 'Falha ao criar oportunidade.'),
      response?.code,
    )
  }
}
