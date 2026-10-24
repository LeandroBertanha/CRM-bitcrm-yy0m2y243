import pb from '@/lib/pocketbase/client'
import {
  calculateSaasCommission,
  buildReceivablePlan,
  calculateReleaseForReceivable,
  deriveCommissionStatus,
  findActiveException,
  parsePolicyTiers,
  type SaasCommissionPolicy,
  type SaasPolicyTier,
  type SaasCommissionException,
  type SaasCommissionStatus,
  type SaasHostingModel,
  type SaasCalcResult,
} from '@/types/commissionSaas'

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
    const current = await getActiveSaasPolicy()
    const nextVersion = (current?.policy_version || 0) + 1
    // Desativa a versão anterior
    if (current) {
      await pb.collection('saas_commission_policies').update(current.id, { is_active: false })
    }
    await pb.collection('saas_commission_policies').create({
      name: params.name || `Política SaaS — v${nextVersion}`,
      policy_version: nextVersion,
      tiers: JSON.stringify(params.tiers),
      recurring_percentage: params.recurring_percentage,
      recurring_eligible_months: params.recurring_eligible_months,
      min_margin_percentage: params.min_margin_percentage,
      notes: params.notes || '',
      is_active: true,
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao criar nova versão da política.' }
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
    await pb.collection('saas_commission_exceptions').create({
      seller: params.sellerId,
      exception_type: params.exceptionType,
      percentage: params.exceptionType === 'percentage' ? params.percentage || 0 : 0,
      fixed_value_cents:
        params.exceptionType === 'fixed_value' ? Math.max(0, Math.floor(params.fixedValueCents || 0)) : 0,
      applies_to: params.appliesTo,
      valid_until: params.validUntil || '',
      reason: params.reason,
      approved_by: params.approvedBy || '',
      approved_at: params.approvedBy ? new Date().toISOString() : '',
      is_active: true,
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao criar exceção de comissão.' }
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

    const calc = calculateSaasCommission({
      contractValueCents: input.contractValueCents,
      recurringMonthlyCents: input.recurringMonthlyCents,
      directCostsCents: input.directCostsCents,
      taxesCents: input.taxesCents,
      hostingModel: input.hostingModel,
      policy: {
        tiers,
        recurring_percentage: Number(policy.recurring_percentage) || 0,
        recurring_eligible_months: Number(policy.recurring_eligible_months) || 0,
        min_margin_percentage: Number(policy.min_margin_percentage) || 0,
      },
      exception,
    })

    if (!persist) {
      return { ok: true, status: calc.requiresApproval ? 'pendente_aprovacao' : 'aprovada', calc }
    }

    const initialStatus: SaasCommissionStatus = calc.requiresApproval
      ? 'pendente_aprovacao'
      : 'aprovada'

    const record = await pb.collection('saas_commissions').create({
      client_name: input.clientName,
      opportunity: input.opportunityId || '',
      seller: input.sellerId,
      system_name: input.systemName,
      system_description: input.systemDescription || '',
      hosting_model: input.hostingModel,
      list_value_cents: Math.max(0, Math.floor(input.listValueCents || 0)),
      discount_cents: Math.max(0, Math.floor(input.discountCents || 0)),
      contract_value_cents: Math.max(0, Math.floor(input.contractValueCents || 0)),
      installments_count: Math.max(1, Math.floor(input.installmentsCount || 1)),
      recurring_monthly_cents: Math.max(0, Math.floor(input.recurringMonthlyCents || 0)),
      recurring_percentage: Number(policy.recurring_percentage) || 0,
      recurring_commissionable_months: calc.recurringEligibleMonths,
      development_commission_cents: calc.devCommissionCents,
      recurring_commission_potential_cents: calc.recurringCommissionPotentialCents,
      commission_type: calc.commissionType,
      dev_policy_version: Number(policy.policy_version) || 1,
      dev_policy_snapshot: JSON.stringify({ tiers }),
      exception: exception?.id || '',
      direct_costs_cents: Math.max(0, Math.floor(input.directCostsCents || 0)),
      taxes_cents: Math.max(0, Math.floor(input.taxesCents || 0)),
      margin_percentage: calc.marginPercentage,
      requires_approval: calc.requiresApproval,
      status: initialStatus,
      commercial_notes: input.commercialNotes || '',
    })

    // Plano de recebíveis (parcelas + mensalidades elegíveis)
    const plan = buildReceivablePlan({
      contractValueCents: input.contractValueCents,
      installmentsCount: input.installmentsCount,
      recurringMonthlyCents: input.recurringMonthlyCents,
      recurringEligibleMonths: calc.recurringEligibleMonths,
      hostingModel: input.hostingModel,
      firstDueDate: input.firstDueDate,
    })
    for (const item of plan) {
      await pb.collection('saas_commission_receivables').create({
        commission: record.id,
        seller: input.sellerId,
        kind: item.kind,
        installment_number: item.installment_number,
        amount_cents: item.amount_cents,
        expected_date: item.expected_date,
        received: false,
      })
    }

    await pb.collection('saas_commission_events').create({
      commission: record.id,
      seller: input.sellerId,
      event_type: 'created',
      amount_cents: calc.devCommissionCents,
      description: `Comissão SaaS criada (${calc.commissionType === 'fixed_value' ? 'valor fixo' : 'faixa: ' + calc.tierLabel}). Status inicial: ${initialStatus}.`,
      metadata: JSON.stringify({ policy_version: policy.policy_version, margin: calc.marginPercentage }),
    })

    return { ok: true, commissionId: record.id, status: initialStatus, calc }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao registrar comissão SaaS.' }
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
  try {
    const existing = await pb.collection('saas_commissions').getList(1, 1, {
      filter: `opportunity = "${params.opportunityId}"`,
    })
    if (existing.items.length > 0) {
      return { ok: false, duplicate: true, error: 'Esta oportunidade já possui comissão SaaS registrada.' }
    }
    return await createSaasCommission({
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
      taxesCents: 0,
    })
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao gerar comissão a partir da oportunidade.' }
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
    const rec = await pb.collection('saas_commissions').getOne(params.commissionId)
    if (rec.status !== 'pendente_aprovacao' && rec.status !== 'simulada') {
      return { ok: false, error: `Comissão não está pendente de aprovação (status: ${rec.status}).` }
    }
    await pb.collection('saas_commissions').update(params.commissionId, {
      status: 'aprovada',
      approved_by: params.approverId,
      approved_at: new Date().toISOString(),
      approval_note: params.note || '',
    })
    await pb.collection('saas_commission_events').create({
      commission: params.commissionId,
      actor: params.approverId,
      event_type: 'approved',
      description: params.note || 'Aprovação administrativa (margem abaixo da política).',
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao aprovar comissão.' }
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
    const receivable = await pb
      .collection('saas_commission_receivables')
      .getOne<SaasReceivableRecord>(params.receivableId)

    if (receivable.received) {
      return { ok: true, releasedCents: 0, newStatus: undefined, error: undefined }
    }

    const commission = await pb
      .collection('saas_commissions')
      .getOne<SaasCommissionRecord>(receivable.commission)

    if (commission.status === 'cancelada' || commission.status === 'estornada') {
      return { ok: false, error: 'Comissão cancelada/estornada — não é possível confirmar recebimento.' }
    }
    if (commission.requires_approval && commission.status === 'pendente_aprovacao') {
      return {
        ok: false,
        error: 'Comissão aguarda aprovação administrativa — liberação bloqueada até a autorização.',
      }
    }

    const receivedAmount = Math.max(
      0,
      Math.floor(params.receivedAmountCents ?? receivable.amount_cents ?? 0),
    )

    // 1. Confirma o recebível
    await pb.collection('saas_commission_receivables').update(receivable.id, {
      received: true,
      received_at: new Date().toISOString(),
      received_amount_cents: receivedAmount,
    })

    // 2. Calcula a liberação proporcional da linha (desenvolvimento ou recorrência)
    const isDevelopment = receivable.kind === 'development'
    const lineTotalCents = isDevelopment
      ? Math.max(0, Math.floor(commission.contract_value_cents || 0))
      : Math.max(0, Math.floor(commission.recurring_monthly_cents || 0)) *
        Math.max(1, Math.floor(commission.recurring_commissionable_months || 0))
    const lineCommissionCents = isDevelopment
      ? Math.max(0, Math.floor(commission.development_commission_cents || 0))
      : Math.max(0, Math.floor(commission.recurring_commission_potential_cents || 0))

    const alreadyReleased = await getSaasReleases(commission.id)
    const lineAlreadyReleased = alreadyReleased
      .filter((r) => r.kind === receivable.kind)
      .reduce((acc, r) => acc + Math.floor(r.amount_cents || 0), 0)

    const releaseCents = calculateReleaseForReceivable({
      receivableAmountCents: receivedAmount,
      lineTotalCents,
      lineCommissionCents,
      alreadyReleasedCents: lineAlreadyReleased,
    })

    // 3. Grava a liberação com chave determinística (idempotência garantida pelo índice único)
    if (releaseCents > 0) {
      const idempotencyKey = `${commission.id}:${receivable.id}:${receivable.kind}`
      try {
        await pb.collection('saas_commission_releases').create({
          commission: commission.id,
          receivable: receivable.id,
          seller: commission.seller,
          kind: receivable.kind,
          amount_cents: releaseCents,
          idempotency_key: idempotencyKey,
          released_at: new Date().toISOString(),
        })
      } catch (createErr: unknown) {
        // Violação do índice único = liberação já existente (corrida idempotente) — segue
        const errStr = String(createErr)
        if (!errStr.includes('UNIQUE') && !errStr.includes('unique')) {
          throw createErr
        }
      }
      await pb.collection('saas_commission_events').create({
        commission: commission.id,
        actor: params.actorId,
        event_type: 'released',
        amount_cents: releaseCents,
        receivable: receivable.id,
        description: `Liberação proporcional (${receivable.kind === 'development' ? 'desenvolvimento' : 'recorrência'}): ${Math.floor(receivedAmount / 100)} BRL recebidos.`,
      })
    }

    await pb.collection('saas_commission_events').create({
      commission: commission.id,
      actor: params.actorId,
      event_type: 'receivable_confirmed',
      amount_cents: receivedAmount,
      receivable: receivable.id,
      description: `Recebimento confirmado (${receivable.kind === 'development' ? `parcela ${receivable.installment_number}` : `mensalidade ${receivable.installment_number}`}).`,
    })

    // 4. Reavalia o status agregando liberações
    const allReceivables = await getSaasReceivables(commission.id)
    const allReleases = await getSaasReleases(commission.id)
    const totalReleased = allReleases.reduce((acc, r) => acc + Math.floor(r.amount_cents || 0), 0)
    const totalCommission =
      Math.floor(commission.development_commission_cents || 0) +
      Math.floor(commission.recurring_commission_potential_cents || 0)
    const receivedCount = allReceivables.filter((r) => r.received).length

    let newStatus = deriveCommissionStatus({
      currentStatus: commission.status,
      requiresApproval: Boolean(commission.requires_approval),
      isApproved: Boolean(commission.approved_at),
      totalCommissionCents: totalCommission,
      releasedCents: totalReleased,
    })
    // Aprovada sem nenhum recebimento confirmado: segue aguardando recebimento
    if (receivedCount === 0 && newStatus === 'aguardando_recebimento') {
      newStatus = 'aguardando_recebimento'
    }

    await pb.collection('saas_commissions').update(commission.id, { status: newStatus })

    return { ok: true, releasedCents: releaseCents, newStatus }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao confirmar recebimento.' }
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
    const rec = await pb.collection('saas_commissions').getOne<SaasCommissionRecord>(params.commissionId)
    if (rec.status !== 'disponivel_pagamento') {
      return {
        ok: false,
        error: `Só é possível pagar comissão "Disponível para pagamento" (status atual: ${rec.status}).`,
      }
    }
    await pb.collection('saas_commissions').update(params.commissionId, { status: 'paga' })
    await pb.collection('saas_commission_events').create({
      commission: params.commissionId,
      actor: params.actorId,
      event_type: 'paid',
      amount_cents: Math.max(0, Math.floor(params.amountCents || 0)),
      description: params.note || 'Pagamento de comissão registrado.',
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao registrar pagamento.' }
  }
}

export async function cancelSaasCommission(params: {
  commissionId: string
  actorId: string
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const rec = await pb.collection('saas_commissions').getOne<SaasCommissionRecord>(params.commissionId)
    if (rec.status === 'paga') {
      return { ok: false, error: 'Comissão paga não pode ser cancelada — utilize estorno.' }
    }
    await pb.collection('saas_commissions').update(params.commissionId, { status: 'cancelada' })
    await pb.collection('saas_commission_events').create({
      commission: params.commissionId,
      actor: params.actorId,
      event_type: 'cancelled',
      description: params.reason || 'Cancelamento registrado.',
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao cancelar comissão.' }
  }
}

export async function reverseSaasCommission(params: {
  commissionId: string
  actorId: string
  reason: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await pb.collection('saas_commissions').update(params.commissionId, { status: 'estornada' })
    await pb.collection('saas_commission_events').create({
      commission: params.commissionId,
      actor: params.actorId,
      event_type: 'reversed',
      description: params.reason || 'Estorno registrado.',
    })
    return { ok: true }
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'message' in err ? String((err as Error).message) : ''
    return { ok: false, error: msg || 'Erro ao estornar comissão.' }
  }
}