import { describe, expect, it } from 'vitest'
import { prepareSdrCampaign } from '@/services/sdrCampaignPreparation'
import { findSdrOpportunityConflicts } from '@/services/sdrOpportunityGuard'
import type { SdrOpportunityReadModel } from '@/types/sdr'

function prepareContact(
  overrides: Partial<{ companyName: string; phone: string; email: string }> = {},
) {
  const result = prepareSdrCampaign({
    name: 'Campanha segura',
    channel: 'whatsapp',
    contacts: [
      {
        companyName: overrides.companyName || 'Empresa Alpha',
        contactName: 'Contato Teste',
        phone: overrides.phone || '+55 11 99999-0000',
        email: overrides.email || 'contato@alpha.test',
        authorizedForTest: true,
      },
    ],
  })

  return result.accepted[0]
}

function opportunity(overrides: Partial<SdrOpportunityReadModel> = {}): SdrOpportunityReadModel {
  return {
    id: 'opportunity-1',
    company: 'Outra Empresa',
    stage: 'Novo',
    contactPhone: '+55 11 98888-0000',
    contactEmail: 'outro@empresa.test',
    ...overrides,
  }
}

describe('SDR opportunity conflict guard', () => {
  it('blocks an open opportunity with the same phone', () => {
    const contact = prepareContact()
    const result = findSdrOpportunityConflicts(
      [contact],
      [opportunity({ contactPhone: '(11) 99999-0000' })],
    )

    expect(result[0].level).toBe('blocking')
    expect(result[0].candidates[0].matchedBy).toContain('phone')
  })

  it('blocks an open opportunity with the same normalized email', () => {
    const contact = prepareContact()
    const result = findSdrOpportunityConflicts(
      [contact],
      [opportunity({ contactEmail: ' CONTATO@ALPHA.TEST ' })],
    )

    expect(result[0].level).toBe('blocking')
    expect(result[0].candidates[0].matchedBy).toContain('email')
  })

  it('requires review when only the normalized company matches', () => {
    const contact = prepareContact({ companyName: 'Clínica São José' })
    const result = findSdrOpportunityConflicts(
      [contact],
      [opportunity({ company: 'clinica sao jose' })],
    )

    expect(result[0].level).toBe('review')
    expect(result[0].candidates[0].matchedBy).toEqual(['company'])
  })

  it('requires review instead of blocking when the matching opportunity is closed', () => {
    const contact = prepareContact()
    const result = findSdrOpportunityConflicts(
      [contact],
      [opportunity({ stage: 'Ganho', contactPhone: '(11) 99999-0000' })],
    )

    expect(result[0].level).toBe('review')
    expect(result[0].candidates[0].isOpen).toBe(false)
  })

  it('returns clear when there are no related opportunities', () => {
    const contact = prepareContact()
    const result = findSdrOpportunityConflicts([contact], [opportunity()])

    expect(result[0]).toMatchObject({ level: 'clear', candidates: [] })
  })

  it('does not mutate prepared contacts or opportunity snapshots', () => {
    const contact = prepareContact()
    const existingOpportunity = opportunity({ contactPhone: '(11) 99999-0000' })
    const contactsBefore = structuredClone([contact])
    const opportunitiesBefore = structuredClone([existingOpportunity])

    findSdrOpportunityConflicts([contact], [existingOpportunity])

    expect([contact]).toEqual(contactsBefore)
    expect([existingOpportunity]).toEqual(opportunitiesBefore)
  })
})
