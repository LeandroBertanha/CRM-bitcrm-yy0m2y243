import pb from '@/lib/pocketbase/client'
import type {
  PlaybookSegment,
  PlaybookScript,
  PlaybookQuestion,
  PlaybookAnswer,
  PlaybookObjection,
  PlaybookArgument,
  PlaybookValues,
  PlaybookNextStep,
  ApproachSession,
  ApproachChannel,
} from '@/types/playbook'

import type { PlaybookBundle } from '@/types/playbook'
export type { PlaybookBundle }

/**
 * Carrega todos os elementos do playbook do banco de uma só vez (com fallback seguro)
 */
export async function getPlaybookBundle(): Promise<PlaybookBundle> {
  const [
    segmentsRes,
    scriptsRes,
    questionsRes,
    answersRes,
    objectionsRes,
    argsRes,
    valuesRes,
    nextStepsRes,
  ] = await Promise.allSettled([
    pb.collection('playbook_segments').getFullList<PlaybookSegment>({
      filter: 'is_active = true',
      sort: 'display_order',
    }),
    pb.collection('playbook_scripts').getFullList<PlaybookScript>({
      filter: 'is_active = true',
      sort: 'display_order',
    }),
    pb.collection('playbook_questions').getFullList<PlaybookQuestion>({
      filter: 'is_active = true',
      sort: 'display_order',
    }),
    pb.collection('playbook_answers').getFullList<PlaybookAnswer>({
      sort: 'display_order',
    }),
    pb.collection('playbook_objections').getFullList<PlaybookObjection>({
      filter: 'is_active = true',
      sort: 'display_order',
    }),
    pb.collection('playbook_arguments').getFullList<PlaybookArgument>({
      filter: 'is_active = true',
      sort: 'display_order',
    }),
    pb.collection('playbook_values').getFullList<PlaybookValues>({
      filter: 'is_active = true',
      limit: 1,
    }),
    pb.collection('playbook_next_steps').getFullList<PlaybookNextStep>({
      filter: 'is_active = true',
      sort: 'display_order',
    }),
  ])

  return {
    segments: segmentsRes.status === 'fulfilled' ? segmentsRes.value : [],
    scripts: scriptsRes.status === 'fulfilled' ? scriptsRes.value : [],
    questions: questionsRes.status === 'fulfilled' ? questionsRes.value : [],
    answers: answersRes.status === 'fulfilled' ? answersRes.value : [],
    objections: objectionsRes.status === 'fulfilled' ? objectionsRes.value : [],
    argumentsList: argsRes.status === 'fulfilled' ? argsRes.value : [],
    valuesConfig:
      valuesRes.status === 'fulfilled' && valuesRes.value.length > 0 ? valuesRes.value[0] : null,
    nextSteps: nextStepsRes.status === 'fulfilled' ? nextStepsRes.value : [],
  }
}

/**
 * Busca sessões de abordagem com filtros por vendedor ou oportunidade
 */
export async function getApproachSessions(options?: {
  sellerId?: string
  isAdmin?: boolean
  opportunityId?: string
}): Promise<ApproachSession[]> {
  let filter = ''
  if (options?.opportunityId) {
    filter = `opportunity = "${options.opportunityId}"`
  } else if (!options?.isAdmin && options?.sellerId) {
    filter = `seller = "${options.sellerId}"`
  }

  return pb.collection('approach_sessions').getFullList<ApproachSession>({
    filter: filter || undefined,
    sort: '-created',
    expand: 'seller,opportunity',
  })
}

/**
 * Cria ou atualiza uma sessão de abordagem
 */
export async function saveApproachSession(
  sessionData: Partial<ApproachSession> & { seller: string; channel: ApproachChannel },
  sessionId?: string,
): Promise<ApproachSession> {
  if (sessionId) {
    return pb.collection('approach_sessions').update<ApproachSession>(sessionId, sessionData)
  }
  return pb.collection('approach_sessions').create<ApproachSession>(sessionData)
}

/**
 * Carrega uma sessão específica pelo id
 */
export async function getApproachSessionById(id: string): Promise<ApproachSession> {
  return pb.collection('approach_sessions').getOne<ApproachSession>(id, {
    expand: 'seller,opportunity',
  })
}
