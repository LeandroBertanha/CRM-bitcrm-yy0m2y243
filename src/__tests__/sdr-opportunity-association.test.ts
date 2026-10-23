import { describe, expect, it } from 'vitest'
import { buildSdrOpportunityAssociationSuggestions } from '@/services/sdrOpportunityAssociation'
import type { SdrOpportunityConflictCandidate, SdrOpportunityConflictResult } from '@/types/sdr'

function candidate(
  id: string,
  overrides: Partial<SdrOpportunityConflictCandidate> = {},
): SdrOpportunityConflictCandidate {
  return {
    opportunityId: id,
    company: `Empresa ${id}`,
    stage: 'Novo',
    isOpen: true,
    matchedBy: ['company'],
    ...overrides,
  }
}

function conflict(candidates: SdrOpportunityConflictCandidate[]): SdrOpportunityConflictResult {
  return {
    correlationId: 'sdr-test',
    companyName: 'Empresa Teste',
    level: candidates.length > 0 ? 'review' : 'clear',
    reason: 'Resultado de teste.',
    candidates,
  }
}

describe('SDR opportunity association suggestion', () => {
  it('suggests a unique open opportunity with a strong match', () => {
    const suggestions = buildSdrOpportunityAssociationSuggestions([
      conflict([candidate('strong', { matchedBy: ['phone', 'company'] })]),
    ])

    expect(suggestions[0]).toMatchObject({
      status: 'suggested',
      confidence: 'high',
      recommendedCandidate: { opportunityId: 'strong' },
      requiresHumanConfirmation: true,
      readOnly: true,
    })
  })

  it('uses medium confidence for a unique company-only match', () => {
    const suggestions = buildSdrOpportunityAssociationSuggestions([
      conflict([candidate('company-only')]),
    ])

    expect(suggestions[0]).toMatchObject({ status: 'suggested', confidence: 'medium' })
  })

  it('does not preselect a candidate when the best scores are tied', () => {
    const suggestions = buildSdrOpportunityAssociationSuggestions([
      conflict([
        candidate('phone', { matchedBy: ['phone'] }),
        candidate('email', { matchedBy: ['email'] }),
      ]),
    ])

    expect(suggestions[0]).toMatchObject({ status: 'ambiguous', confidence: 'none' })
    expect(suggestions[0].recommendedCandidate).toBeUndefined()
    expect(suggestions[0].alternatives).toHaveLength(2)
  })

  it('does not suggest a closed opportunity', () => {
    const suggestions = buildSdrOpportunityAssociationSuggestions([
      conflict([candidate('closed', { stage: 'Ganho', isOpen: false, matchedBy: ['phone'] })]),
    ])

    expect(suggestions[0]).toMatchObject({ status: 'none', confidence: 'none' })
    expect(suggestions[0].recommendedCandidate).toBeUndefined()
  })

  it('does not mutate conflict candidates while scoring', () => {
    const input = [
      conflict([
        candidate('company', { matchedBy: ['company'] }),
        candidate('strong', { matchedBy: ['phone', 'company'] }),
      ]),
    ]
    const before = structuredClone(input)

    buildSdrOpportunityAssociationSuggestions(input)

    expect(input).toEqual(before)
  })
})
