import type {
  SdrCampaignContactInput,
  SdrCampaignPreparationInput,
  SdrCampaignPreparationResult,
  SdrPreparationRejection,
  SdrPreparationRejectionCode,
  SdrPreparedContact,
  SdrPreparedMessage,
} from '@/types/sdr'

const PHONE_MIN_DIGITS = 10
const PHONE_MAX_DIGITS = 15
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeSdrPhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function normalizeSdrEmail(value?: string): string {
  return (value || '').trim().toLowerCase()
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function reject(
  rejected: SdrPreparationRejection[],
  index: number,
  code: SdrPreparationRejectionCode,
  reason: string,
) {
  rejected.push({ index, code, reason })
}

function validateContact(
  contact: SdrCampaignContactInput,
  index: number,
  rejected: SdrPreparationRejection[],
) {
  const companyName = contact.companyName.trim()
  const normalizedPhone = normalizeSdrPhone(contact.phone)
  const normalizedEmail = normalizeSdrEmail(contact.email)

  if (!contact.authorizedForTest) {
    reject(
      rejected,
      index,
      'CONTACT_NOT_AUTHORIZED',
      'O contato nao possui autorizacao explicita para esta abordagem.',
    )
  }
  if (!companyName) {
    reject(rejected, index, 'COMPANY_NAME_REQUIRED', 'A empresa do contato e obrigatoria.')
  }
  if (normalizedPhone.length < PHONE_MIN_DIGITS || normalizedPhone.length > PHONE_MAX_DIGITS) {
    reject(
      rejected,
      index,
      'INVALID_PHONE',
      `O telefone deve conter entre ${PHONE_MIN_DIGITS} e ${PHONE_MAX_DIGITS} digitos.`,
    )
  }
  if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) {
    reject(rejected, index, 'INVALID_EMAIL', 'O e-mail informado e invalido.')
  }

  return { companyName, normalizedPhone, normalizedEmail }
}

export function prepareSdrCampaign(
  input: SdrCampaignPreparationInput,
): SdrCampaignPreparationResult {
  const campaignName = input.name.trim()
  const accepted: SdrPreparedContact[] = []
  const rejected: SdrPreparationRejection[] = []
  const seenPhoneKeys = new Set<string>()
  const seenEmailKeys = new Set<string>()

  if (campaignName.length < 3) {
    reject(
      rejected,
      -1,
      'CAMPAIGN_NAME_REQUIRED',
      'O nome da campanha deve conter pelo menos 3 caracteres.',
    )
  }

  input.contacts.forEach((contact, index) => {
    const rejectionCountBeforeValidation = rejected.length
    const { companyName, normalizedPhone, normalizedEmail } = validateContact(
      contact,
      index,
      rejected,
    )

    if (rejected.length > rejectionCountBeforeValidation) return

    const deduplicationKey = `phone:${normalizedPhone}`
    const emailKey = normalizedEmail ? `email:${normalizedEmail}` : ''
    if (seenPhoneKeys.has(deduplicationKey) || (emailKey && seenEmailKeys.has(emailKey))) {
      reject(
        rejected,
        index,
        'DUPLICATE_CONTACT',
        'O mesmo telefone ou e-mail ja esta presente nesta preparacao.',
      )
      return
    }
    seenPhoneKeys.add(deduplicationKey)
    if (emailKey) seenEmailKeys.add(emailKey)

    const correlationSeed = [campaignName, deduplicationKey, index].join('|')
    accepted.push({
      ...contact,
      companyName,
      contactName: contact.contactName?.trim() || 'Contato',
      email: normalizedEmail,
      normalizedPhone,
      normalizedEmail,
      deduplicationKey,
      correlationId: `sdr-${stableHash(correlationSeed)}`,
      requiresHumanReview: true,
    })
  })

  const hasCampaignError = rejected.some((item) => item.index === -1)
  return {
    valid: !hasCampaignError && accepted.length > 0,
    campaignName,
    accepted,
    rejected,
    totals: {
      received: input.contacts.length,
      accepted: accepted.length,
      rejected: new Set(rejected.filter((item) => item.index >= 0).map((item) => item.index)).size,
    },
  }
}

export function prepareSdrMessageQueue(
  preparation: SdrCampaignPreparationResult,
  template: string,
): SdrPreparedMessage[] {
  const safeTemplate = template.trim()
  if (!preparation.valid || !safeTemplate) return []

  return preparation.accepted.map((contact) => ({
    correlationId: contact.correlationId,
    deduplicationKey: contact.deduplicationKey,
    phone: contact.normalizedPhone,
    body: safeTemplate
      .replaceAll('{contato}', contact.contactName)
      .replaceAll('{empresa}', contact.companyName),
    status: 'aguardando_confirmacao',
    attemptCount: 0,
    requiresHumanConfirmation: true,
  }))
}
