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

export interface CommissionPaymentDateInfo {
  nominalDate: Date // Dia 5 do mês seguinte
  nominalDateFormatted: string // ex: "05/12/2025"
  effectiveDate: Date // Dia 5 ou próximo dia útil após fins de semana/feriados
  effectiveDateFormatted: string // ex: "08/12/2025"
  isShifted: boolean // true se o dia 5 caiu em fim de semana ou feriado
  shiftReason?: 'weekend' | 'holiday' | 'weekend_and_holiday' | null
  shiftDescription?: string // ex: "05/12/2025 cai em sábado — pagamento em 08/12/2025"
  weekdayName: string // ex: "sexta-feira", "sábado", "segunda-feira"
  effectiveWeekdayName: string // ex: "segunda-feira"
}

export interface CommissionClosingSummary {
  periodMonth: number // 0-11
  periodYear: number
  periodMonthName: string // ex: "outubro"
  periodMonthCapitalized: string // ex: "Outubro"
  paymentDay: number // sempre 5
  paymentMonthName: string // ex: "novembro"
  paymentYear: number
  paymentDateFormatted: string // ex: "05/11/2026" ou data efetiva
  paymentDateInfo?: CommissionPaymentDateInfo
  sellers: SellerMonthlyCommission[]
  totalSalesCount: number
  totalAmountToPay: number
  qualifyingSellersCount: number
  hasTiersConfigured: boolean
}

/**
 * Feriados nacionais fixos do Brasil (formato MM-DD, 1-indexed)
 * 01/01 - Confraternização Universal
 * 21/04 - Tiradentes
 * 01/05 - Dia do Trabalho
 * 07/09 - Independência do Brasil
 * 12/10 - Nossa Senhora Aparecida
 * 02/11 - Finados
 * 15/11 - Proclamação da República
 * 25/12 - Natal
 */
export const BRAZIL_FIXED_HOLIDAYS: Record<string, string> = {
  '01-01': 'Confraternização Universal',
  '04-21': 'Tiradentes',
  '05-01': 'Dia do Trabalho',
  '09-07': 'Independência do Brasil',
  '10-12': 'Nossa Senhora Aparecida',
  '11-02': 'Finados',
  '11-15': 'Proclamação da República',
  '12-25': 'Natal',
}

/**
 * Formata data no formato DD/MM/AAAA usando ano, mês (0-11) e dia
 */
export function formatBRDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

/**
 * Retorna o nome do feriado nacional se a data for feriado fixo brasileiro, ou null.
 */
export function getBrazilianHolidayName(date: Date): string | null {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const key = `${mm}-${dd}`
  return BRAZIL_FIXED_HOLIDAYS[key] || null
}

/**
 * Verifica se a data é dia útil bancário/comercial (não é sábado, domingo ou feriado nacional fixo).
 */
export function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay() // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false
  }
  if (getBrazilianHolidayName(date)) {
    return false
  }
  return true
}

/**
 * Calcula a data de pagamento da comissão referente a um determinado mês de apuração
 * (ou a partir de uma data de referência).
 * Regra oficial de negócio:
 * - A comissão é apurada no mês e paga todo DIA 5 do mês seguinte.
 * - Se o dia 5 cair em sábado, domingo ou feriado nacional brasileiro, o pagamento
 *   acontece no PRÓXIMO DIA ÚTIL após o dia 5.
 */
export function calculateCommissionPaymentDate(
  referenceDateOrYear: Date | number = new Date(),
  referenceMonth?: number,
): CommissionPaymentDateInfo {
  let periodYear: number
  let periodMonth: number

  if (typeof referenceDateOrYear === 'number') {
    periodYear = referenceDateOrYear
    periodMonth = typeof referenceMonth === 'number' ? referenceMonth : 0
  } else {
    periodYear = referenceDateOrYear.getFullYear()
    periodMonth = referenceDateOrYear.getMonth()
  }

  // Dia 5 do mês seguinte ao período apurado
  const nominalDate = new Date(periodYear, periodMonth + 1, 5, 12, 0, 0, 0)
  const nominalDateFormatted = formatBRDate(nominalDate)

  const weekdayNames = [
    'domingo',
    'segunda-feira',
    'terça-feira',
    'quarta-feira',
    'quinta-feira',
    'sexta-feira',
    'sábado',
  ]
  const nominalWeekday = weekdayNames[nominalDate.getDay()]

  const nominalHoliday = getBrazilianHolidayName(nominalDate)
  const nominalIsWeekend = nominalDate.getDay() === 0 || nominalDate.getDay() === 6

  // Avança até o próximo dia útil se não for dia útil
  const effectiveDate = new Date(nominalDate.getTime())
  let isShifted = false

  while (!isBusinessDay(effectiveDate)) {
    isShifted = true
    effectiveDate.setDate(effectiveDate.getDate() + 1)
  }

  const effectiveDateFormatted = formatBRDate(effectiveDate)
  const effectiveWeekday = weekdayNames[effectiveDate.getDay()]

  let shiftReason: CommissionPaymentDateInfo['shiftReason'] = null
  let shiftDescription: string | undefined

  if (isShifted) {
    if (nominalIsWeekend && nominalHoliday) {
      shiftReason = 'weekend_and_holiday'
      shiftDescription = `${nominalDateFormatted} cai em ${nominalWeekday} (${nominalHoliday}) — pagamento transferido para o próximo dia útil, ${effectiveDateFormatted} (${effectiveWeekday})`
    } else if (nominalIsWeekend) {
      shiftReason = 'weekend'
      shiftDescription = `${nominalDateFormatted} cai em ${nominalWeekday} — pagamento no próximo dia útil: ${effectiveDateFormatted} (${effectiveWeekday})`
    } else if (nominalHoliday) {
      shiftReason = 'holiday'
      shiftDescription = `${nominalDateFormatted} é feriado nacional (${nominalHoliday}) — pagamento no próximo dia útil: ${effectiveDateFormatted} (${effectiveWeekday})`
    } else {
      shiftDescription = `Pagamento transferido para o próximo dia útil: ${effectiveDateFormatted} (${effectiveWeekday})`
    }
  }

  return {
    nominalDate,
    nominalDateFormatted,
    effectiveDate,
    effectiveDateFormatted,
    isShifted,
    shiftReason,
    shiftDescription,
    weekdayName: nominalWeekday,
    effectiveWeekdayName: effectiveWeekday,
  }
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
