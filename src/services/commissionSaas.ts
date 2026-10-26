import pb from '@/lib/pocketbase/client'
import {
  calculateSaasCommission,
  findActiveException,
  parsePolicyTiers,
  type SaasCommissionPolicy,
  type SaasPolicyTier,
  type SaasCommissionException,
  type SaasCommissionStatus,
  type SaasHostingModel,
  type SaasCalcResult,
} from '@/types/commissionSaas'

const SAAS_OPERATIONS_ENDPOINT = '/backend/v1/commissions/saas'

interface SaasApiErrorPayload {
  code?: string
  error?: string
}

function normalizeSaasApiError(error: unknown, fallback: string): string {
  const response =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error.response as SaasApiErrorPayload)
      : null
  return response?.error || (error instanceof Error ? error.message : fallback)
}

async function sendSaasOperation<T>(action: string, body: Record<string, unknown>): Promise<T> {
  return pb.send<T>(`${SAAS_OPERATIONS_ENDPOINT}/${action}`, {
    method: 'POST',
    body,
  })
}

// ============================================================
// Serviço de Comissionamento SaaS — bitCRM
// Estados: Simulada → Pendente de aprovação → Aprovada →
// Aguardando recebimento → Parcialmente liberada →
// Disponível para pagamento → Paga (ou Cancelada/Estornada).
// Liberação proporcional e idempotente por recebimento.
// ============================================================

export interface SaasCommissionRecord {
  id: string
  client_name: string
  opportunity?: string
  seller: string
  system_name: string
  system_description?: string
  hosting_model: SaasHostingModel
  list_value_cents?: number
  discount_cents?: number
  contract_value_cents: number
  installments_count: number
  recurring_monthly_cents?: number
  recurring_percentage?: number
  recurring_commissionable_months?: number
  development_commission_cents: number
  recurring_commission_potential_cents?: number
  commission_type: 'percentage' | 'fixed_value'
  dev_policy_version: number
  dev_policy_snapshot?: unknown
  exception?: string
  direct_costs_cents?: number
  recurring_costs_cents?: number
  taxes_cents?: number
  margin_percentage?: number
  requires_approval?: boolean
  status: SaasCommissionStatus
  approved_by?: string
  approved_at?: string
  approval_note?: string
  commercial_notes?: string
  created?: string
  updated?: string
  expand?: {
    seller?: { id: string; name?: string; email?: string }
    opportunity?: { id: string; company?: string }
  }
}

export interface SaasReceivableRecord {
  id: string
  commission: string
  seller: string
  kind: 'development' | 'recurring'
  installment_number: number
  amount_cents: number
  expected_date?: string
  received_at?: string
  received?: boolean
  received_amount_cents?: number
  notes?: string
  expand?: Record<string, unknown>
}

export interface SaasReleaseRecord {
  id: string
  commission: string
  receivable?: string
  seller: string
  kind: 'development' | 'recurring'
  amount_cents: number
  idempotency_key: string
  released_at?: string
  notes?: string
}

export interface SaasEventRecord {
  id: string
  commission: string
  seller?: string
  actor?: string
  event_type: string
  amount_cents?: number
  receivable?: string
  description?: string
  metadata?: unknown
  created?: string
}

// ------------------------------------------------------------
// Leitura
// ------------------------------------------------------------

export async function getActiveSaasPolicy(): Promise<SaasCommissionPolicy | null> {
  try {
    return await pb
      .collection('saas_commission_policies')
      .getFirstListItem<SaasCommissionPolicy>('is_active = true', { sort: '-policy_version' })
  } catch (err) {
    console.error('Erro ao buscar política SaaS ativa:', err)
    return null
  }
}

export async function getAllSaasPolicies(): Promise<SaasCommissionPolicy[]> {
  try {
    return await pb.collection('saas_commission_policies').getFullList<SaasCommissionPolicy>({
      sort: '-policy_version',
    })
  } catch (err) {
    console.error('Erro ao listar políticas SaaS:', err)
    return []
  }
}

/** Cria uma nova versão da política (versionamento: nunca edita a versão usada por comissões). */
export async function createSaasPolicyVersion(params: {
  name: string
  tiers: SaasPolicyTier[]
  recurring_percentage: number
  recurring_eligible_months: number
  min_margin_percentage: number
  notes?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendSaasOperation('policy-version', params)
    return { ok: true }
  } catch (err: unknown) {
    return {
      ok: false,
      error: normalizeSaasApiError(err, 'Erro ao criar nova versão da política.'),
    }
  }
}

/** Cria uma exceção/campanha de comissão para um vendedor (admin). */
export async function createSaasException(params: {
  sellerId: string
  exceptionType: 'percentage' | 'fixed_value'
  percentage?: number
  fixedValueCents?: number
  appliesTo: 'development' | 'recurring'
  validUntil?: string
  reason: string
  approvedBy?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendSaasOperation('exception-create', params)
    return { ok: true }
  } catch (err: unknown) {
    return {
      ok: false,
      error: normalizeSaasApiError(err, 'Erro ao criar exceção de comissão.'),
    }
  }
}

export async function getSaasExceptions(sellerId?: string): Promise<SaasCommissionException[]> {
  try {
    const filter = sellerId ? `seller = "${sellerId}"` : ''
    return await pb
      .collection('saas_commission_exceptions')
      .getFullList<SaasCommissionException>({ filter, sort: '-created' })
  } catch (err) {
    console.error('Erro ao listar exceções SaaS:', err)
    return []
  }
}

export async function getSaasCommissions(params?: {
  sellerId?: string
  status?: string
}): Promise<SaasCommissionRecord[]> {
  try {
    const filters: string[] = []
    if (params?.sellerId) filters.push(`seller = "${params.sellerId}"`)
    if (params?.status) filters.push(`status = "${params.status}"`)
    const filter = filters.join(' && ')
    return await pb.collection('saas_commissions').getFullList<SaasCommissionRecord>({
      filter: filter || undefined,
      sort: '-created',
      expand: 'seller,opportunity',
    })
  } catch (err) {
    console.error('Erro ao listar comissões SaaS:', err)
    return []
  }
}

export async function getSaasReceivables(commissionId?: string): Promise<SaasReceivableRecord[]> {
  try {
    const filter = commissionId ? `commission = "${commissionId}"` : ''
    return await pb.collection('saas_commission_receivables').getFullList<SaasReceivableRecord>({
      filter: filter || undefined,
      sort: 'kind,installment_number',
    })
  } catch (err) {
    console.error('Erro ao listar recebíveis SaaS:', err)
    return []
  }
}

export async function getSaasReleases(commissionId?: string): Promise<SaasReleaseRecord[]> {
  try {
    const filter = commissionId ? `commission = "${commissionId}"` : ''
    return await pb.collection('saas_commission_releases').getFullList<SaasReleaseRecord>({
      filter: filter || undefined,
      sort: '-created',
    })
  } catch (err) {
    console.error('Erro ao listar liberações SaaS:', err)
    return []
  }
}

export async function getSaasEvents(commissionId?: string): Promise<SaasEventRecord[]> {
  try {
    const filter = commissionId ? `commission = "${commissionId}"` : ''
    return await pb.collection('saas_commission_events').getFullList<SaasEventRecord>({
      filter: filter || undefined,
      sort: '-created',
    })
  } catch (err) {
    console.error('Erro ao listar eventos SaaS:', err)
    return []
  }
}

// ------------------------------------------------------------
// Criação (a partir do simulador ou de oportunidade Ganha)
// ------------------------------------------------------------

export interface CreateSaasCommissionInput {
  clientName: string
  opportunityId?: string
  sellerId: string
  systemName: string
  systemDescription?: string
  hostingModel: SaasHostingModel
  listValueCents: number
  discountCents: number
  contractValueCents: number
  installmentsCount: number
  recurringMonthlyCents: number
  directCostsCents: number
  recurringCostsCents?: number
  taxesCents: number
  commercialNotes?: string
  firstDueDate?: Date
}

export interface CreateSaasCommissionResult {
  ok: boolean
  commissionId?: string
  status?: SaasCommissionStatus
  error?: string
  calc?: SaasCalcResult
}

/**
 * Calcula, grava a comissão com snapshot da política vigente, gera o plano
 * de recebíveis e registra o evento de criação.
 * Status inicial: pendente_aprovacao quando a margem exigir; aprovada caso contrário
 * (a comissão aprovada entra em aguardando_recebimento no primeiro recebimento).
 */
export async function createSaasCommission(
  input: CreateSaasCommissionInput,
  options?: { persist?: boolean },
): Promise<CreateSaasCommissionResult> {
  const persist = options?.persist !== false
  try {
    const policy = await getActiveSaasPolicy()
    if (!policy) {
      return { ok: false, error: 'Nenhuma política SaaS ativa encontrada no banco.' }
    }

    const tiers = parsePolicyTiers(policy.tiers)
    const exceptions = await getSaasExceptions(input.sellerId)
    const exception = findActiveException(exceptions, input.sellerId, 'development')
    const recurringException = findActiveException(exceptions, input.sellerId, 'recurring')

    const calc = calculateSaasCommission({
      contractValueCents: input.contractValueCents,
      recurringMonthlyCents: input.recurringMonthlyCents,
      directCostsCents: input.directCostsCents,
      recurringCostsCents: input.recurringCostsCents || 0,
      taxesCents: input.taxesCents,
      hostingModel: input.hostingModel,
      policy: {
        tiers,
        recurring_percentage: Number(policy.recurring_percentage) || 0,
        recurring_eligible_months: Number(policy.recurring_eligible_months) || 0,
        min_margin_percentage: Number(policy.min_margin_percentage) || 0,
      },
      exception,
      recurringException,
    })

    if (!persist) {
      return { ok: true, status: calc.requiresApproval ? 'pendente_aprovacao' : 'aprovada', calc }
    }

    const response = await sendSaasOperation<{
      ok: true
      commissionId: string
      status: SaasCommissionStatus
      calc: SaasCalcResult
    }>('commission-create', {
      ...input,
      firstDueDate: input.firstDueDate?.toISOString(),
    })
    return response
  } catch (err: unknown) {
    return { ok: false, error: normalizeSaasApiError(err, 'Erro ao registrar comissão SaaS.') }
  }
}

/** Gera comissão SaaS a partir de uma oportunidade Ganha (com verificação de duplicidade). */
export async function createSaasCommissionFromOpportunity(params: {
  opportunityId: string
  company: string
  sellerId: string
  valueCents: number
  recurringMonthlyCents?: number
  hostingModel?: SaasHostingModel
}): Promise<CreateSaasCommissionResult & { duplicate?: boolean }> {
  const result = await createSaasCommission({
    clientName: params.company,
    opportunityId: params.opportunityId,
    sellerId: params.sellerId,
    systemName: params.company ? `Sistema SaaS — ${params.company}` : 'Sistema SaaS',
    hostingModel: params.hostingModel || 'bit_cloud',
    listValueCents: params.valueCents,
    discountCents: 0,
    contractValueCents: params.valueCents,
    installmentsCount: 1,
    recurringMonthlyCents: params.recurringMonthlyCents || 0,
    directCostsCents: 0,
    recurringCostsCents: 0,
    taxesCents: 0,
  })
  return {
    ...result,
    duplicate: !result.ok && result.error?.includes('já possui uma comissão SaaS'),
  }
}

// ------------------------------------------------------------
// Aprovação (admin)
// ------------------------------------------------------------

export async function approveSaasCommission(params: {
  commissionId: string
  approverId: string
  note?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendSaasOperation('commission-approve', params)
    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: normalizeSaasApiError(err, 'Erro ao aprovar comissão.') }
  }
}

// ------------------------------------------------------------
// Recebimento + liberação proporcional idempotente
// ------------------------------------------------------------

export interface ConfirmReceivableResult {
  ok: boolean
  releasedCents?: number
  newStatus?: SaasCommissionStatus
  error?: string
}

/**
 * Confirma o recebimento de uma parcela/mensalidade e libera a comissão
 * proporcional ao valor recebido. Idempotente: reconfirmar a mesma parcela
 * não gera nova liberação (chave determinística + índice único no banco).
 */
export async function confirmSaasReceivable(params: {
  receivableId: string
  actorId: string
  receivedAmountCents?: number // padrão: valor total da parcela
}): Promise<ConfirmReceivableResult> {
  try {
    return await sendSaasOperation<ConfirmReceivableResult>('receivable-confirm', params)
  } catch (err: unknown) {
    return { ok: false, error: normalizeSaasApiError(err, 'Erro ao confirmar recebimento.') }
  }
}

// ------------------------------------------------------------
// Pagamento, cancelamento e estorno (admin)
// ------------------------------------------------------------

export async function markSaasCommissionPaid(params: {
  commissionId: string
  actorId: string
  amountCents: number
  note?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendSaasOperation('commission-pay', params)
    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: normalizeSaasApiError(err, 'Erro ao registrar pagamento.') }
  }
}

export async function cancelSaasCommission(params: {
  commissionId: string
  actorId: string
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendSaasOperation('commission-cancel', params)
    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: normalizeSaasApiError(err, 'Erro ao cancelar comissão.') }
  }
}

export async function reverseSaasCommission(params: {
  commissionId: string
  actorId: string
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendSaasOperation('commission-reverse', params)
    return { ok: true }
  } catch (err: unknown) {
    return { ok: false, error: normalizeSaasApiError(err, 'Erro ao estornar comissão.') }
  }
}
