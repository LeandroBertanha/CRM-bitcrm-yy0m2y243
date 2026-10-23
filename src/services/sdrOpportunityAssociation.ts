import type {
  SdrOpportunityAssociationSuggestion,
  SdrOpportunityConflictCandidate,
  SdrOpportunityConflictResult,
} from '@/types/sdr'

function scoreCandidate(candidate: SdrOpportunityConflictCandidate): number {
  if (!candidate.isOpen) return 0

  return candidate.matchedBy.reduce((score, field) => {
    if (field === 'phone' || field === 'email') return score + 100
    if (field === 'company') return score + 20
    return score
  }, 0)
}

export function buildSdrOpportunityAssociationSuggestions(
  conflicts: SdrOpportunityConflictResult[],
): SdrOpportunityAssociationSuggestion[] {
  return conflicts.map((conflict) => {
    const openCandidates = conflict.candidates
      .filter((candidate) => candidate.isOpen)
      .map((candidate) => ({ candidate, score: scoreCandidate(candidate) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)

    if (openCandidates.length === 0) {
      return {
        correlationId: conflict.correlationId,
        companyName: conflict.companyName,
        status: 'none',
        confidence: 'none',
        reason: 'Nao existe oportunidade aberta elegivel para sugestao de associacao.',
        alternatives: [],
        requiresHumanConfirmation: true,
        readOnly: true,
      }
    }

    const [bestCandidate, secondCandidate] = openCandidates
    if (secondCandidate && bestCandidate.score === secondCandidate.score) {
      return {
        correlationId: conflict.correlationId,
        companyName: conflict.companyName,
        status: 'ambiguous',
        confidence: 'none',
        reason: 'Ha mais de uma oportunidade com a mesma relevancia. A escolha deve ser manual.',
        alternatives: openCandidates.map((item) => item.candidate),
        requiresHumanConfirmation: true,
        readOnly: true,
      }
    }

    const hasStrongMatch = bestCandidate.candidate.matchedBy.some(
      (field) => field === 'phone' || field === 'email',
    )

    return {
      correlationId: conflict.correlationId,
      companyName: conflict.companyName,
      status: 'suggested',
      confidence: hasStrongMatch ? 'high' : 'medium',
      reason: hasStrongMatch
        ? 'Sugestao baseada em telefone ou e-mail coincidente, sujeita a confirmacao humana.'
        : 'Sugestao baseada somente no nome da empresa, sujeita a revisao cuidadosa.',
      recommendedCandidate: bestCandidate.candidate,
      alternatives: openCandidates.slice(1).map((item) => item.candidate),
      requiresHumanConfirmation: true,
      readOnly: true,
    }
  })
}
