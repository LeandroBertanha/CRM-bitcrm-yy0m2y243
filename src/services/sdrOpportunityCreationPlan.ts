import type {
  SdrOpportunityConflictResult,
  SdrOpportunityCreationPlan,
  SdrPreparedContact,
} from '@/types/sdr'

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function buildSdrOpportunityCreationPlans(
  contacts: SdrPreparedContact[],
  conflicts: SdrOpportunityConflictResult[],
): SdrOpportunityCreationPlan[] {
  const conflictsByCorrelation = new Map(conflicts.map((item) => [item.correlationId, item]))

  return contacts.map((contact) => {
    const conflict = conflictsByCorrelation.get(contact.correlationId)
    const isClear = conflict?.level === 'clear'

    return {
      correlationId: contact.correlationId,
      status: isClear ? 'ready_for_confirmation' : 'blocked',
      reason: isClear
        ? 'Contato livre para revisao da proposta de nova oportunidade.'
        : conflict
          ? 'A criacao permanece bloqueada enquanto houver correspondencia para revisar.'
          : 'A verificacao de duplicidade e obrigatoria antes de preparar a criacao.',
      idempotencyKey: `sdr-create-${stableHash(
        `${contact.correlationId}|${contact.deduplicationKey}`,
      )}`,
      payload: {
        company: contact.companyName,
        stage: 'Novo',
        source: 'Prospecção',
        value: 0,
        contact_name: contact.contactName,
        contact_phone: contact.normalizedPhone,
        contact_email: contact.normalizedEmail,
      },
      guards: {
        featureFlagRequired: true,
        backendDeduplicationRequired: true,
        auditRequired: true,
        humanConfirmationRequired: true,
      },
      executionAllowed: false,
    }
  })
}
