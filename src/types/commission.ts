import type { RecordModel } from 'pocketbase'

export interface CommissionTier extends RecordModel {
  name: string
  min_sales: number
  max_sales: number | null
  percentage: number // ex: 0.2, 0.25, 0.3
  commission_per_sale: number // ex: 100, 125, 150
  display_order: number
  is_active?: boolean
}

export interface DetailedRuleItem {
  rule: string
  description: string
}

export interface CommissionSettings extends RecordModel {
  product_name: string
  base_sale_value: number
  monthly_hosting_value: number
  hosting_note?: string
  essential_rules?: string[]
  detailed_rules?: DetailedRuleItem[]
  is_active?: boolean
}

export interface CommissionCalculationResult {
  salesCount: number
  tier: CommissionTier | null
  tierName: string
  percentage: number
  commissionPerSale: number
  totalCommission: number
  isQualifying: boolean
}

export interface SellerMonthlyCommission {
  sellerId: string
  name: string
  email: string
  role?: string
  wonCountMonth: number
  tier: CommissionTier | null
  tierName: string
  percentage: number
  commissionPerSale: number
  totalCommission: number
  isQualifying: boolean
}

export interface CommissionClosingSummary {
  periodMonth: number // 0-11
  periodYear: number
  periodMonthName: string // ex: "outubro"
  periodMonthCapitalized: string // ex: "Outubro"
  paymentDay: number // sempre 5
  paymentMonthName: string // ex: "novembro"
  paymentYear: number
  paymentDateFormatted: string // ex: "05/11/2026"
  sellers: SellerMonthlyCommission[]
  totalSalesCount: number
  totalAmountToPay: number
  qualifyingSellersCount: number
  hasTiersConfigured: boolean
}

/**
 * Determina a faixa de comissão com base no número total de vendas válidas no mês.
 * Conforme regras do negócio:
 * - A faixa é determinada pelo TOTAL de vendas válidas do mês.
 * - O percentual da faixa aplica-se a TODAS as vendas do mês (não é progressivo).
 * - Se as faixas estiverem ordenadas pelo banco (display_order ou min_sales decrescente),
 *   encontra a faixa cujo min_sales <= totalVendas e (max_sales é null ou totalVendas <= max_sales).
 */
/**
 * Verifica se uma oportunidade pertence ao mês/ano de referência especificado
 * usando created ou updated (mesma regra do Comissionamento).
 */
export function isOpportunityInMonth(
  opp: { created?: string; updated?: string },
  year: number,
  monthIndex: number,
): boolean {
  const dateStr = opp.created || opp.updated
  if (!dateStr) return false
  try {
    const d = new Date(dateStr)
    return d.getFullYear() === year && d.getMonth() === monthIndex
  } catch {
    return false
  }
}

export function calculateCommission(
  salesCount: number,
  tiers: CommissionTier[],
  baseSaleValue?: number,
): CommissionCalculationResult {
  const count = Math.max(0, Math.floor(salesCount || 0))

  if (count === 0 || !tiers || tiers.length === 0) {
    return {
      salesCount: count,
      tier: null,
      tierName: 'Nenhuma faixa atingida (0 vendas)',
      percentage: 0,
      commissionPerSale: 0,
      totalCommission: 0,
      isQualifying: false,
    }
  }

  // Ordena por min_sales ascendente para busca precisa de faixa
  const sorted = [...tiers].sort((a, b) => a.min_sales - b.min_sales)

  // Encontra a faixa correspondente
  let matchedTier: CommissionTier | null = null

  for (const tier of sorted) {
    const min = tier.min_sales
    const max = tier.max_sales && tier.max_sales > 0 ? tier.max_sales : Infinity
    if (count >= min && count <= max) {
      matchedTier = tier
      break
    }
  }

  // Se passou do máximo de todas as faixas definidas, assume a maior faixa ativa
  if (!matchedTier && count > 0) {
    const highestTier = sorted[sorted.length - 1]
    if (highestTier && count >= highestTier.min_sales) {
      matchedTier = highestTier
    }
  }

  if (!matchedTier) {
    return {
      salesCount: count,
      tier: null,
      tierName: 'Abaixo da faixa mínima',
      percentage: 0,
      commissionPerSale: 0,
      totalCommission: 0,
      isQualifying: false,
    }
  }

  // Percentual
  const rawPct = matchedTier.percentage
  // Trata caso venha salvo como fração (0.2) ou inteiro (20)
  const normalizedPct = rawPct > 1 ? rawPct / 100 : rawPct

  // Comissão por venda: usa o valor configurado na faixa ou calcula sobre baseSaleValue se aplicável
  const commPerSale =
    matchedTier.commission_per_sale > 0
      ? matchedTier.commission_per_sale
      : (baseSaleValue || 0) * normalizedPct

  const total = count * commPerSale

  return {
    salesCount: count,
    tier: matchedTier,
    tierName: matchedTier.name,
    percentage: normalizedPct,
    commissionPerSale: commPerSale,
    totalCommission: total,
    isQualifying: true,
  }
}
