import type { RecordModel } from 'pocketbase'
import { formatBRL } from '@/types/crm'

// ============================================================
// COMISSIONAMENTO SaaS — tipos e cálculos puros
// TODOS os valores monetários são CENTAVOS inteiros (evita erro
// de arredondamento de ponto flutuante). Percentuais são frações
// (0.1 = 10%). Nenhuma função aqui acessa rede ou banco.
// ============================================================

export type SaasHostingModel = 'bit_cloud' | 'client_cloud' | 'client_cloud_support' | 'hybrid'

export type SaasCommissionStatus =
  | 'simulada'
  | 'pendente_aprovacao'
  | 'aprovada'
  | 'aguardando_recebimento'
  | 'parcialmente_liberada'
  | 'disponivel_pagamento'
  | 'paga'
  | 'cancelada'
  | 'estornada'

export type SaasCommissionType = 'percentage' | 'fixed_value'

export type SaasExceptionType = 'percentage' | 'fixed_value'

export type SaasExceptionScope = 'development' | 'recurring'

export const SAAS_STATUS_LABELS: Record<SaasCommissionStatus, string> = {
  simulada: 'Simulada',
  pendente_aprovacao: 'Pendente de aprovação',
  aprovada: 'Aprovada',
  aguardando_recebimento: 'Aguardando recebimento',
  parcialmente_liberada: 'Parcialmente liberada',
  disponivel_pagamento: 'Disponível para pagamento',
  paga: 'Paga',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
}

export const SAAS_STATUS_BADGE_CLASS: Record<SaasCommissionStatus, string> = {
  simulada: 'bg-slate-800/60 text-slate-300 border-slate-700/60',
  pendente_aprovacao: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
  aprovada: 'bg-emerald-950/50 text-emerald-300 border-emerald-700/50',
  aguardando_recebimento: 'bg-blue-950/50 text-blue-300 border-blue-700/50',
  parcialmente_liberada: 'bg-indigo-950/50 text-indigo-300 border-indigo-700/50',
  disponivel_pagamento: 'bg-teal-950/50 text-teal-300 border-teal-700/50',
  paga: 'bg-emerald-900/60 text-emerald-200 border-emerald-600/60',
  cancelada: 'bg-rose-950/60 text-rose-300 border-rose-700/50',
  estornada: 'bg-orange-950/60 text-orange-300 border-orange-700/50',
}

export const SAAS_HOSTING_MODEL_LABELS: Record<SaasHostingModel, string> = {
  bit_cloud: 'Nuvem Bit Consulting',
  client_cloud: 'Nuvem do Cliente',
  client_cloud_support: 'Nuvem do Cliente + Suporte Bit',
  hybrid: 'Híbrido',
}

export const SAAS_HOSTING_MODEL_DESCRIPTIONS: Record<SaasHostingModel, string> = {
  bit_cloud:
    'Sistema hospedado na infraestrutura da Bit Consulting. Comissão de desenvolvimento pela faixa + 10% sobre as 3 primeiras mensalidades elegíveis recebidas.',
  client_cloud:
    'Infraestrutura contratada e mantida pelo cliente. Comissão de desenvolvimento pela faixa. Sem comissão de recorrência quando não há serviço recorrente contratado.',
  client_cloud_support:
    'Infraestrutura do cliente com contrato recorrente de suporte/manutenção Bit. Comissão de desenvolvimento pela faixa + 10% sobre as 3 primeiras mensalidades de suporte recebidas.',
  hybrid:
    'Infraestrutura compartilhada/distribuída. Mesmas regras: comissão de desenvolvimento pela faixa + 10% sobre as 3 primeiras mensalidades recorrentes recebidas.',
}

/** Modelos que comissionam recorrência quando há mensalidade contratada (A, C e D). */
export function hostingModelAllowsRecurring(model: SaasHostingModel): boolean {
  return model !== 'client_cloud'
}

// ------------------------------------------------------------
// Política
// ------------------------------------------------------------

export interface SaasPolicyTier {
  min_value: number // centavos, inclusivo
  max_value: number | null // centavos, inclusivo; null = sem limite
  percentage: number // fração (0.1 = 10%)
  label: string
}

export interface SaasCommissionPolicy extends RecordModel {
  name: string
  policy_version: number
  tiers: SaasPolicyTier[] | string
  recurring_percentage: number
  recurring_eligible_months: number
  min_margin_percentage: number
  notes?: string
  is_active?: boolean
}

/** Normaliza o campo JSON do PocketBase (pode vir string ou array). */
export function parsePolicyTiers(raw: unknown): SaasPolicyTier[] {
  if (!raw) return []
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((t) => {
      const tier = t as Partial<SaasPolicyTier>
      return {
        min_value: Number(tier.min_value) || 0,
        max_value:
          tier.max_value === null || tier.max_value === undefined
            ? null
            : Number(tier.max_value),
        percentage: Number(tier.percentage) || 0,
        label: String(tier.label || ''),
      }
    })
    .filter((t) => t.percentage > 0)
}

/** Encontra a faixa cujo intervalo contém o valor integral do desenvolvimento. */
export function matchSaasTier(
  contractValueCents: number,
  tiers: SaasPolicyTier[],
): SaasPolicyTier | null {
  const value = Math.max(0, Math.floor(contractValueCents || 0))
  if (!tiers || tiers.length === 0) return null
  const sorted = [...tiers].sort((a, b) => a.min_value - b.min_value)
  for (const tier of sorted) {
    const min = tier.min_value
    const max = tier.max_value === null || tier.max_value === undefined ? Infinity : tier.max_value
    if (value >= min && value <= max) return tier
  }
  // Valor acima de todas as faixas: usa a última (sem limite)
  if (value > 0) {
    const last = sorted[sorted.length - 1]
    if (last && last.max_value === null) return last
  }
  return null
}

// ------------------------------------------------------------
// Exceção por vendedor / campanha
// ------------------------------------------------------------

export interface SaasCommissionException extends RecordModel {
  seller: string
  exception_type: SaasExceptionType
  percentage?: number
  fixed_value_cents?: number
  applies_to: SaasExceptionScope
  valid_from?: string
  valid_until?: string
  reason: string
  approved_by?: string
  approved_at?: string
  is_active?: boolean
}

/** Exceção vigente hoje para o vendedor e escopo informados. */
export function findActiveException(
  exceptions: SaasCommissionException[],
  sellerId: string,
  scope: SaasExceptionScope,
  now: Date = new Date(),
): SaasCommissionException | null {
  const todayIso = now.toISOString()
  return (
    exceptions.find((exc) => {
      if (!exc.is_active) return false
      if (exc.seller !== sellerId) return false
      if (exc.applies_to !== scope) return false
      if (exc.valid_from && new Date(exc.valid_from).toISOString() > todayIso) return false
      if (exc.valid_until && new Date(exc.valid_until).toISOString() < todayIso) return false
      return true
    }) || null
  )
}

// ------------------------------------------------------------
// Cálculo da comissão SaaS
// ------------------------------------------------------------

export interface SaasCalcPolicyInput {
  tiers: SaasPolicyTier[]
  recurring_percentage: number
  recurring_eligible_months: number
  min_margin_percentage: number
}

export interface SaasCalcInput {
  contractValueCents: number
  recurringMonthlyCents: number
  directCostsCents: number
  taxesCents: number
  hostingModel: SaasHostingModel
  policy: SaasCalcPolicyInput
  exception?: SaasCommissionException | null
}

export interface SaasCalcResult {
  tier: SaasPolicyTier | null
  tierLabel: string
  devPercentage: number
  devCommissionCents: number
  commissionType: SaasCommissionType
  exceptionApplied: boolean
  recurringEligibleMonths: number
  recurringCommissionPerMonthCents: number
  recurringCommissionPotentialCents: number
  totalPotentialCents: number
  netRevenueCents: number
  marginPercentage: number
  marginStatus: 'ok' | 'needs_approval' | 'critical'
  requiresApproval: boolean
  minMarginPercentage: number
}

/**
 * Calcula comissão de desenvolvimento + potencial de recorrência + margem.
 * - Um único percentual (da faixa) sobre o valor INTEGRAL do desenvolvimento.
 * - O modelo de hospedagem NUNCA altera o percentual de desenvolvimento.
 * - Tributos contam uma única vez (dentro da receita líquida).
 * - Margem = (receita líquida − custos diretos − comissões) / receita líquida.
 */
export function calculateSaasCommission(input: SaasCalcInput): SaasCalcResult {
  const {
    contractValueCents,
    recurringMonthlyCents,
    directCostsCents,
    taxesCents,
    hostingModel,
    policy,
    exception = null,
  } = input

  const contract = Math.max(0, Math.floor(contractValueCents || 0))
  const monthly = Math.max(0, Math.floor(recurringMonthlyCents || 0))
  const costs = Math.max(0, Math.floor(directCostsCents || 0))
  const taxes = Math.max(0, Math.floor(taxesCents || 0))

  // ---- Comissão de desenvolvimento ----
  const tier = matchSaasTier(contract, policy.tiers)
  let devPercentage = tier ? tier.percentage : 0
  let commissionType: SaasCommissionType = 'percentage'
  let exceptionApplied = false

  const devException = exception && exception.applies_to === 'development' ? exception : null
  if (devException && devException.exception_type === 'fixed_value') {
    // Valor fixo por projeto sobrepõe a faixa
    commissionType = 'fixed_value'
    devPercentage = 0
    exceptionApplied = true
  } else if (devException && devException.exception_type === 'percentage') {
    devPercentage = Number(devException.percentage) || 0
    exceptionApplied = true
  }

  let devCommissionCents = 0
  if (commissionType === 'fixed_value') {
    devCommissionCents = Math.max(0, Math.floor(Number(devException?.fixed_value_cents) || 0))
  } else if (contract > 0 && devPercentage > 0) {
    devCommissionCents = Math.round(contract * devPercentage)
  }

  // ---- Comissão potencial de recorrência ----
  const recurringAllowed = hostingModelAllowsRecurring(hostingModel)
  const eligibleMonths = recurringAllowed
    ? Math.max(0, Math.floor(Number(policy.recurring_eligible_months) || 0))
    : 0

  const recException = exception && exception.applies_to === 'recurring' ? exception : null
  let recPerMonthCents = 0
  if (monthly > 0 && eligibleMonths > 0) {
    if (recException && recException.exception_type === 'fixed_value') {
      // Valor fixo de comissão por mês de recorrência
      recPerMonthCents = Math.max(0, Math.floor(Number(recException.fixed_value_cents) || 0))
      exceptionApplied = true
    } else {
      const recPct =
        recException && recException.exception_type === 'percentage'
          ? Number(recException.percentage) || 0
          : Number(policy.recurring_percentage) || 0
      recPerMonthCents = Math.round(monthly * recPct)
      if (recException) exceptionApplied = true
    }
  }
  const recurringPotentialCents = recPerMonthCents * eligibleMonths

  // ---- Receita líquida e margem (mesmo horizonte: desenvolvimento + recorrência elegível) ----
  const grossRevenue = contract + monthly * eligibleMonths
  const netRevenue = Math.max(0, grossRevenue - taxes)
  const totalCommissions = devCommissionCents + recurringPotentialCents
  const marginPercentage =
    netRevenue > 0 ? (netRevenue - costs - totalCommissions) / netRevenue : 0

  const minMargin = Number(policy.min_margin_percentage) || 0
  let marginStatus: SaasCalcResult['marginStatus'] = 'ok'
  if (netRevenue <= 0 && (costs > 0 || totalCommissions > 0)) {
    marginStatus = 'critical'
  } else if (marginPercentage < 0) {
    marginStatus = 'critical'
  } else if (marginPercentage < minMargin) {
    marginStatus = 'needs_approval'
  }

  return {
    tier,
    tierLabel: tier ? tier.label : 'Sem faixa',
    devPercentage,
    devCommissionCents,
    commissionType,
    exceptionApplied,
    recurringEligibleMonths: eligibleMonths,
    recurringCommissionPerMonthCents: recPerMonthCents,
    recurringCommissionPotentialCents: recurringPotentialCents,
    totalPotentialCents: totalCommissions,
    netRevenueCents: netRevenue,
    marginPercentage,
    marginStatus,
    requiresApproval: marginStatus !== 'ok',
    minMarginPercentage: minMargin,
  }
}

// ------------------------------------------------------------
// Recebíveis (parcelas + mensalidades)
// ------------------------------------------------------------

export interface SaasReceivablePlanItem {
  kind: 'development' | 'recurring'
  installment_number: number
  amount_cents: number
  expected_date: string // ISO
}

/**
 * Gera o plano de recebíveis: parcelas do desenvolvimento (distribuição
 * largest-remainder, soma exata) + mensalidades elegíveis mensais.
 */
export function buildReceivablePlan(params: {
  contractValueCents: number
  installmentsCount: number
  recurringMonthlyCents: number
  recurringEligibleMonths: number
  hostingModel: SaasHostingModel
  firstDueDate?: Date
}): SaasReceivablePlanItem[] {
  const {
    contractValueCents,
    installmentsCount,
    recurringMonthlyCents,
    recurringEligibleMonths,
    hostingModel,
    firstDueDate = new Date(),
  } = params

  const items: SaasReceivablePlanItem[] = []
  const baseDate = new Date(firstDueDate.getTime())
  if (isNaN(baseDate.getTime())) baseDate.setTime(Date.now())

  // Parcelas do desenvolvimento — soma exata via maior resto
  const contract = Math.max(0, Math.floor(contractValueCents || 0))
  const n = Math.max(1, Math.floor(installmentsCount || 1))
  if (contract > 0) {
    const base = Math.floor(contract / n)
    const remainder = contract - base * n
    for (let i = 1; i <= n; i++) {
      const due = new Date(baseDate.getTime())
      due.setMonth(due.getMonth() + (i - 1))
      items.push({
        kind: 'development',
        installment_number: i,
        amount_cents: base + (i <= remainder ? 1 : 0),
        expected_date: due.toISOString(),
      })
    }
  }

  // Mensalidades elegíveis (modelos A, C e D)
  const monthly = Math.max(0, Math.floor(recurringMonthlyCents || 0))
  const months = hostingModelAllowsRecurring(hostingModel)
    ? Math.max(0, Math.floor(recurringEligibleMonths || 0))
    : 0
  for (let m = 1; m <= months; m++) {
    const due = new Date(baseDate.getTime())
    due.setMonth(due.getMonth() + m)
    items.push({
      kind: 'recurring',
      installment_number: m,
      amount_cents: monthly,
      expected_date: due.toISOString(),
    })
  }

  return items
}

// ------------------------------------------------------------
// Liberação proporcional
// ------------------------------------------------------------

/**
 * Comissão liberada por um recebimento confirmado (proporcional ao valor
 * recebido sobre o total da linha). Exemplo do requisito:
 * R$ 12.000 × 6% = R$ 720 em 3 × R$ 4.000 → R$ 240 por parcela.
 * `alreadyReleasedCents` limita o teto para nunca liberar além do total.
 */
export function calculateReleaseForReceivable(params: {
  receivableAmountCents: number // valor recebido confirmado (parcial conta proporcional)
  lineTotalCents: number // total da linha (soma das parcelas ou mensalidades)
  lineCommissionCents: number // comissão total da linha
  alreadyReleasedCents: number
}): number {
  const { receivableAmountCents, lineTotalCents, lineCommissionCents, alreadyReleasedCents } =
    params
  const received = Math.max(0, Math.floor(receivableAmountCents || 0))
  const total = Math.max(0, Math.floor(lineTotalCents || 0))
  const commission = Math.max(0, Math.floor(lineCommissionCents || 0))
  const released = Math.max(0, Math.floor(alreadyReleasedCents || 0))

  if (total <= 0 || commission <= 0 || received <= 0) return 0
  const proportional = Math.round((received / total) * commission)
  const remaining = Math.max(0, commission - released)
  return Math.min(proportional, remaining)
}

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

/**
 * Deriva o status da comissão a partir das liberações.
 * Regras: aprovação pendente bloqueia; liberado 0 → aguardando;
 * parcial → parcialmente_liberada; completo → disponivel_pagamento.
 * Estados terminais (paga, cancelada, estornada) não são alterados aqui.
 */
export function deriveCommissionStatus(params: {
  currentStatus: SaasCommissionStatus
  requiresApproval: boolean
  isApproved: boolean
  totalCommissionCents: number
  releasedCents: number
}): SaasCommissionStatus {
  const { currentStatus, requiresApproval, isApproved, totalCommissionCents, releasedCents } =
    params

  if (
    currentStatus === 'paga' ||
    currentStatus === 'cancelada' ||
    currentStatus === 'estornada' ||
    currentStatus === 'simulada'
  ) {
    return currentStatus
  }

  if (requiresApproval && !isApproved) return 'pendente_aprovacao'

  const total = Math.max(0, Math.floor(totalCommissionCents || 0))
  const released = Math.max(0, Math.floor(releasedCents || 0))

  if (released <= 0) return 'aguardando_recebimento'
  if (released < total) return 'parcialmente_liberada'
  return 'disponivel_pagamento'
}

// ------------------------------------------------------------
// Conversões monetárias
// ------------------------------------------------------------

export const centsToBRL = (cents: number | null | undefined): string => {
  const value = Number(cents)
  if (cents === undefined || cents === null || isNaN(value)) return 'R$ 0,00'
  return formatBRL(value / 100)
}

/** Converte entrada do usuário ("1.234,56", "1234.56", "1234") em centavos inteiros. */
export const brlToCents = (input: string): number => {
  if (!input) return 0
  let s = String(input).trim()
  // Remove símbolos e espaços
  s = s.replace(/[R$\s]/g, '')
  if (!s) return 0
  // Formato BR: 1.234,56 — pontos são milhares, vírgula é decimal
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const value = parseFloat(s)
  if (isNaN(value) || value < 0) return 0
  return Math.round(value * 100)
}

/** Formata percentual como fração (0.086) em texto PT-BR ("8,6%"). */
export const formatPercentage = (fraction: number | null | undefined): string => {
  const value = Number(fraction)
  if (fraction === undefined || fraction === null || isNaN(value)) return '0%'
  const pct = value * 100
  const decimals = Number.isInteger(pct) ? 0 : 1
  return `${pct.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}