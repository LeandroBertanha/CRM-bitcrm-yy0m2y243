import { describe, expect, it } from 'vitest'
import { prepareSdrCampaign } from '@/services/sdrCampaignPreparation'
import { buildSdrOpportunityCreationPlans } from '@/services/sdrOpportunityCreationPlan'
import type { SdrOpportunityConflictResult } from '@/types/sdr'

function preparedContact() {
  return prepareSdrCampaign({
    name: 'Campanha segura',
    channel: 'whatsapp',
    contacts: [
      {
        companyName: 'Empresa Livre',
        contactName: 'Contato Teste',
        phone: '+55 11 99999-0000',
        email: 'contato@empresa.test',
        authorizedForTest: true,
      },
    ],
  }).accepted[0]
}

function conflict(
  correlationId: string,
  level: SdrOpportunityConflictResult['level'],
): SdrOpportunityConflictResult {
  return {
    correlationId,
    companyName: 'Empresa Livre',
    level,
    reason: 'Resultado de teste.',
    candidates: [],
  }
}

describe('SDR opportunity creation plan', () => {
  it('prepares a non-executable creation proposal only for a clear contact', () => {
    const contact = preparedContact()
    const plans = buildSdrOpportunityCreationPlans(
      [contact],
      [conflict(contact.correlationId, 'clear')],
    )

    expect(plans[0]).toMatchObject({
      status: 'ready_for_confirmation',
      executionAllowed: false,
      payload: {
        company: 'Empresa Livre',
        stage: 'Novo',
        source: 'Prospecção',
        value: 0,
      },
      guards: {
        featureFlagRequired: true,
        backendDeduplicationRequired: true,
        auditRequired: true,
        humanConfirmationRequired: true,
      },
    })
  })

  it.each(['review', 'blocking'] as const)('blocks creation when conflict level is %s', (level) => {
    const contact = preparedContact()
    const plans = buildSdrOpportunityCreationPlans(
      [contact],
      [conflict(contact.correlationId, level)],
    )

    expect(plans[0]).toMatchObject({ status: 'blocked', executionAllowed: false })
  })

  it('blocks creation when duplicate verification has not run', () => {
    const contact = preparedContact()
    const plans = buildSdrOpportunityCreationPlans([contact], [])

    expect(plans[0]).toMatchObject({ status: 'blocked', executionAllowed: false })
    expect(plans[0].reason).toContain('verificacao de duplicidade')
  })

  it('creates a stable idempotency key without exposing the phone', () => {
    const contact = preparedContact()
    const inputConflict = conflict(contact.correlationId, 'clear')
    const first = buildSdrOpportunityCreationPlans([contact], [inputConflict])
    const second = buildSdrOpportunityCreationPlans([contact], [inputConflict])

    expect(first[0].idempotencyKey).toBe(second[0].idempotencyKey)
    expect(first[0].idempotencyKey).not.toContain(contact.normalizedPhone)
  })

  it('does not mutate contacts or conflict results', () => {
    const contact = preparedContact()
    const inputConflict = conflict(contact.correlationId, 'clear')
    const beforeContact = structuredClone(contact)
    const beforeConflict = structuredClone(inputConflict)

    buildSdrOpportunityCreationPlans([contact], [inputConflict])

    expect(contact).toEqual(beforeContact)
    expect(inputConflict).toEqual(beforeConflict)
  })
})
