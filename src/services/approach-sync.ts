import pb from '@/lib/pocketbase/client'
import type { Opportunity } from '@/types/crm'
import type { ApproachStatus } from '@/types/playbook'

/**
 * Mapeamento centralizado de status de abordagem para estágio de oportunidade.
 * Retorna o estágio da oportunidade correspondente ou null caso o status
 * não implique alteração automática de estágio (ex: Contato realizado, Não abordado).
 *
 * Regras:
 * - 'Sem interesse' / 'Perdido' => 'Perdido'
 * - 'Fechado' => 'Ganho'
 * - 'Proposta solicitada' / 'Proposta enviada' / 'Negociação' => 'Proposta'
 * - 'Reunião agendada' / 'Retorno agendado' => 'Agendado'
 * - 'Diagnóstico realizado' / 'Interessado' / 'Exemplos enviados' => 'Qualificado'
 */
export function mapApproachStatusToOpportunityStage(
  status: ApproachStatus,
): Opportunity['stage'] | null {
  switch (status) {
    case 'Sem interesse':
    case 'Perdido':
      return 'Perdido'

    case 'Fechado':
      return 'Ganho'

    case 'Proposta solicitada':
    case 'Proposta enviada':
    case 'Negociação':
      return 'Proposta'

    case 'Reunião agendada':
    case 'Retorno agendado':
      return 'Agendado'

    case 'Diagnóstico realizado':
    case 'Interessado':
    case 'Exemplos enviados':
      return 'Qualificado'

    case 'Contato realizado':
    case 'Tentativa de contato':
    case 'Não abordado':
    default:
      return null
  }
}

export interface SyncOpportunityResult {
  updated: boolean
  opportunityId: string
  previousStage?: Opportunity['stage']
  newStage?: Opportunity['stage']
  message?: string
}

/**
 * Sincroniza a oportunidade vinculada com base no status da sessão de abordagem.
 * Se a oportunidade já estiver no estágio correto, não dispara requisição redundante.
 * Também sincroniza a data de retorno (return_at) se fornecida.
 */
export async function syncApproachSessionWithOpportunity(params: {
  opportunityId?: string | null
  status: ApproachStatus
  nextContactAt?: string | null
  notes?: string
  authorId?: string
  manualStage?: Opportunity['stage']
}): Promise<SyncOpportunityResult> {
  const { opportunityId, status, nextContactAt, notes, authorId, manualStage } = params

  if (!opportunityId) {
    return { updated: false, opportunityId: '' }
  }

  // Regra de prevalência: manualStage informado prevalece sobre o cálculo automático via status
  const targetStage: Opportunity['stage'] | null =
    manualStage !== undefined ? manualStage : mapApproachStatusToOpportunityStage(status)

  try {
    const opp = await pb.collection('opportunities').getOne<Opportunity>(opportunityId)

    const updatePayload: Partial<Opportunity> = {}
    let shouldUpdate = false
    const stageChanged = Boolean(targetStage && opp.stage !== targetStage)

    if (stageChanged && targetStage) {
      updatePayload.stage = targetStage
      shouldUpdate = true
    }

    if (nextContactAt !== undefined && nextContactAt !== opp.return_at) {
      updatePayload.return_at = nextContactAt
      shouldUpdate = true
    }

    if (shouldUpdate) {
      await pb.collection('opportunities').update(opportunityId, updatePayload)

      // Ao atualizar o estágio da oportunidade, gravar nota em opportunity_notes
      if (authorId && stageChanged && targetStage) {
        try {
          let noteText = ''
          if (manualStage !== undefined) {
            noteText = `Estágio alterado via Histórico de Abordagens: ${opp.stage} → ${targetStage}`
            if (notes) {
              noteText += ` (Obs: ${notes})`
            }
          } else {
            noteText = `Estágio atualizado para ${targetStage} via Abordagem Comercial (${status})`
            if (notes) {
              noteText += ` (Obs: ${notes})`
            }
          }

          if (noteText) {
            await pb.collection('opportunity_notes').create({
              opportunity: opportunityId,
              author: authorId,
              type: 'outro',
              text: noteText.trim(),
              date: new Date().toISOString(),
            })
          }
        } catch (noteErr) {
          console.warn('Não foi possível gravar nota na timeline da oportunidade:', noteErr)
        }
      }

      return {
        updated: true,
        opportunityId,
        previousStage: opp.stage,
        newStage: targetStage || opp.stage,
      }
    }

    return {
      updated: false,
      opportunityId,
      previousStage: opp.stage,
      newStage: opp.stage,
    }
  } catch (err) {
    console.error(`Erro ao sincronizar oportunidade ${opportunityId}:`, err)
    throw err
  }
}
