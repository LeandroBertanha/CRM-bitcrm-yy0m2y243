import { normalizeSdrEmail, normalizeSdrPhone } from '@/services/sdrCampaignPreparation'
import type {
  SdrOpportunityConflictCandidate,
  SdrOpportunityConflictResult,
  SdrOpportunityMatchField,
  SdrOpportunityReadModel,
  SdrPreparedContact,
} from '@/types/sdr'

const CLOSED_STAGES = new Set<SdrOpportunityReadModel['stage']>(['Ganho', 'Perdido'])

function normalizeComparableText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeComparablePhone(value?: string): string {
  const digits = normalizeSdrPhone(value || '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2)
  }
  return digits
}

function getMatchedFields(
  contact: SdrPreparedContact,
  opportunity: SdrOpportunityReadModel,
): SdrOpportunityMatchField[] {
  const matchedBy: SdrOpportunityMatchField[] = []
  const contactPhone = normalizeComparablePhone(contact.normalizedPhone)
  const opportunityPhone = normalizeComparablePhone(opportunity.contactPhone)
  const contactEmail = normalizeSdrEmail(contact.normalizedEmail)
  const opportunityEmail = normalizeSdrEmail(opportunity.contactEmail)
  const contactCompany = normalizeComparableText(contact.companyName)
  const opportunityCompany = normalizeComparableText(opportunity.company)

  if (contactPhone && opportunityPhone && contactPhone === opportunityPhone) {
    matchedBy.push('phone')
  }
  if (contactEmail && opportunityEmail && contactEmail === opportunityEmail) {
    matchedBy.push('email')
  }
  if (contactCompany && opportunityCompany && contactCompany === opportunityCompany) {
    matchedBy.push('company')
  }

  return matchedBy
}

function toCandidate(
  opportunity: SdrOpportunityReadModel,
  matchedBy: SdrOpportunityMatchField[],
): SdrOpportunityConflictCandidate {
  return {
    opportunityId: opportunity.id,
    company: opportunity.company,
    stage: opportunity.stage,
    isOpen: !CLOSED_STAGES.has(opportunity.stage),
    matchedBy,
  }
}

export function findSdrOpportunityConflicts(
  contacts: SdrPreparedContact[],
  opportunities: SdrOpportunityReadModel[],
): SdrOpportunityConflictResult[] {
  return contacts.map((contact) => {
    const candidates = opportunities
      .map((opportunity) => {
        const matchedBy = getMatchedFields(contact, opportunity)
        return matchedBy.length > 0 ? toCandidate(opportunity, matchedBy) : null
      })
      .filter((candidate): candidate is SdrOpportunityConflictCandidate => candidate !== null)
      .sort((left, right) => {
        if (left.isOpen !== right.isOpen) return left.isOpen ? -1 : 1
        return right.matchedBy.length - left.matchedBy.length
      })

    const hasBlockingCandidate = candidates.some(
      (candidate) =>
        candidate.isOpen &&
        (candidate.matchedBy.includes('phone') || candidate.matchedBy.includes('email')),
    )

    if (hasBlockingCandidate) {
      return {
        correlationId: contact.correlationId,
        companyName: contact.companyName,
        level: 'blocking',
        reason: 'Existe oportunidade aberta com o mesmo telefone ou e-mail.',
        candidates,
      }
    }

    if (candidates.length > 0) {
      return {
        correlationId: contact.correlationId,
        companyName: contact.companyName,
        level: 'review',
        reason: 'Existe registro relacionado que exige revisao humana antes de qualquer acao.',
        candidates,
      }
    }

    return {
      correlationId: contact.correlationId,
      companyName: contact.companyName,
      level: 'clear',
      reason: 'Nenhuma oportunidade relacionada foi encontrada na leitura atual.',
      candidates: [],
    }
  })
}
