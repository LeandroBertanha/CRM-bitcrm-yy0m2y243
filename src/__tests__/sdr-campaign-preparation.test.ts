import { describe, expect, it } from 'vitest'
import {
  normalizeSdrEmail,
  normalizeSdrPhone,
  prepareSdrCampaign,
  prepareSdrMessageQueue,
} from '@/services/sdrCampaignPreparation'
import type { SdrCampaignPreparationInput } from '@/types/sdr'

const validInput: SdrCampaignPreparationInput = {
  name: 'Campanha de homologacao',
  channel: 'whatsapp',
  contacts: [
    {
      companyName: 'Empresa Teste',
      contactName: 'Maria Teste',
      phone: '+55 (11) 99999-0000',
      email: 'MARIA@EXAMPLE.COM',
      authorizedForTest: true,
    },
  ],
}

describe('SDR campaign preparation', () => {
  it('normalizes phone and email without changing the source object', () => {
    const snapshot = structuredClone(validInput)
    const result = prepareSdrCampaign(validInput)

    expect(normalizeSdrPhone('+55 (11) 99999-0000')).toBe('5511999990000')
    expect(normalizeSdrEmail(' MARIA@EXAMPLE.COM ')).toBe('maria@example.com')
    expect(result.accepted[0].normalizedPhone).toBe('5511999990000')
    expect(result.accepted[0].normalizedEmail).toBe('maria@example.com')
    expect(validInput).toEqual(snapshot)
  })

  it('rejects contacts without explicit test authorization', () => {
    const input = structuredClone(validInput)
    input.contacts[0].authorizedForTest = false

    const result = prepareSdrCampaign(input)

    expect(result.valid).toBe(false)
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected).toContainEqual(
      expect.objectContaining({ code: 'CONTACT_NOT_AUTHORIZED' }),
    )
  })

  it('rejects invalid contacts and duplicates after normalization', () => {
    const input = structuredClone(validInput)
    input.contacts.push({
      ...input.contacts[0],
      contactName: 'Outro contato',
      phone: '55 11 99999 0000',
    })
    input.contacts.push({
      companyName: 'Sem telefone',
      phone: '123',
      authorizedForTest: true,
    })

    const result = prepareSdrCampaign(input)

    expect(result.accepted).toHaveLength(1)
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DUPLICATE_CONTACT' }),
        expect.objectContaining({ code: 'INVALID_PHONE' }),
      ]),
    )
  })

  it('creates only messages awaiting human confirmation', () => {
    const preparation = prepareSdrCampaign(validInput)
    const queue = prepareSdrMessageQueue(
      preparation,
      'Ola, {contato}. Esta mensagem e para a {empresa}.',
    )

    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({
      body: 'Ola, Maria Teste. Esta mensagem e para a Empresa Teste.',
      status: 'aguardando_confirmacao',
      attemptCount: 0,
      requiresHumanConfirmation: true,
    })
    expect(queue[0].correlationId).toMatch(/^sdr-[a-f0-9]{8}$/)
  })

  it('does not create a queue for an invalid campaign or empty template', () => {
    const invalid = prepareSdrCampaign({ ...validInput, name: 'x' })

    expect(prepareSdrMessageQueue(invalid, 'Ola')).toEqual([])
    expect(prepareSdrMessageQueue(prepareSdrCampaign(validInput), '  ')).toEqual([])
  })
})
