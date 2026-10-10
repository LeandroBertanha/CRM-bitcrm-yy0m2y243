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

export interface OpportunityCommissionItem {
  id?: string
  company?: string
  value: number
  unitCommission: number
  isProportional: boolean
  ratio: number
}

export interface CommissionCalculationResult {
  salesCount: number
  tier: CommissionTier | null
  tierName: string
  percentage: number
  commissionPerSale: number
  totalCommission: number
  isQualifying: boolean
  baseSaleValue?: number
  isProportional?: boolean
  opportunityDetails?: OpportunityCommissionItem[]
}

export interface SellerMonthlyCommission {
  sellerId: string
  name: string
  email: string
  role?: string
  wonCountMonth: number
  totalWonValue?: number
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

/**
 * Determina a faixa correspondente no array de faixas com base na contagem de vendas válidas.
 */
export function matchCommissionTier(
  salesCount: number,
  tiers: CommissionTier[],
): CommissionTier | null {
  const count = Math.max(0, Math.floor(salesCount || 0))
  if (count === 0 || !tiers || tiers.length === 0) return null

  const sorted = [...tiers].sort((a, b) => a.min_sales - b.min_sales)
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

  return matchedTier
}

/**
 * Calcula a comissão unitária de uma venda considerando o valor base da venda (padrão R$ 350,00 lido do banco).
 *
 * REGRA PROPORCIONAL ACIMA DE R$ 350,00:
 * - Para valores até o valor base (ex: <= R$ 350,00):
 *   Aplica a comissão fixa da faixa (ex: R$ 70, R$ 87,50 ou R$ 105) ou base * percentual.
 * - Para valores maiores que o valor base (ex: > R$ 350,00):
 *   A comissão é proporcional ao valor da venda:
 *   comissão = comissão_base_da_faixa * (valor / base_sale_value) = valor * percentual_da_faixa.
 *   Exemplo na Faixa 1 (20%, base R$ 350 com comissão R$ 70):
 *   - Venda de R$ 350,00 -> comissão = R$ 70,00
 *   - Venda de R$ 500,00 -> razão 500/350 = 1,4285... -> comissão = R$ 100,00 (500 * 20%)
 *   - Venda de R$ 1.000,00 -> comissão = R$ 200,00 (1000 * 20%)
 *   - Venda de R$ 2.500,00 -> comissão = R$ 500,00 (2500 * 20%)
 */
export function calculateSaleCommission(params: {
  saleValue: number
  tier: CommissionTier | null
  baseSaleValue?: number
}): {
  unitCommission: number
  isProportional: boolean
  ratio: number
  percentage: number
} {
  const { saleValue, tier, baseSaleValue = 350 } = params
  const baseValue = baseSaleValue > 0 ? baseSaleValue : 350

  if (!tier) {
    return {
      unitCommission: 0,
      isProportional: false,
      ratio: 1,
      percentage: 0,
    }
  }

  const rawPct = tier.percentage
  const normalizedPct = rawPct > 1 ? rawPct / 100 : rawPct
  const baseCommPerSale =
    tier.commission_per_sale > 0 ? tier.commission_per_sale : baseValue * normalizedPct

  const val = Math.max(0, Number(saleValue) || 0)

  if (val > baseValue) {
    const ratio = val / baseValue
    // Proporcional ao valor acima do base: comissão da faixa * ratio = val * percentual
    const unitCommission = baseCommPerSale * ratio
    return {
      unitCommission,
      isProportional: true,
      ratio,
      percentage: normalizedPct,
    }
  }

  return {
    unitCommission: baseCommPerSale,
    isProportional: false,
    ratio: 1,
    percentage: normalizedPct,
  }
}

/**
 * Calcula a comissão total considerando:
 * - Quantidade de vendas para definir a faixa no banco.
 * - Se fornecida uma lista de oportunidades ou valores individuais, aplica a regra proporcional
 *   acima de R$ 350,00 por oportunidade.
 * - Se fornecido apenas salesCount (ou na simulação simples), utiliza o valor unitário padrão
 *   ou o valor de venda informado em saleValueForSingle.
 */
export function calculateCommission(
  salesCount: number,
  tiers: CommissionTier[],
  baseSaleValue?: number,
  salesOrOpps?: Array<{ value?: number; id?: string; company?: string }> | number,
): CommissionCalculationResult {
  const count = Math.max(0, Math.floor(salesCount || 0))
  const baseValue = typeof baseSaleValue === 'number' && baseSaleValue > 0 ? baseSaleValue : 350

  if (count === 0 || !tiers || tiers.length === 0) {
    return {
      salesCount: count,
      tier: null,
      tierName: 'Nenhuma faixa atingida (0 vendas)',
      percentage: 0,
      commissionPerSale: 0,
      totalCommission: 0,
      isQualifying: false,
      baseSaleValue: baseValue,
      isProportional: false,
      opportunityDetails: [],
    }
  }

  const matchedTier = matchCommissionTier(count, tiers)

  if (!matchedTier) {
    return {
      salesCount: count,
      tier: null,
      tierName: 'Abaixo da faixa mínima',
      percentage: 0,
      commissionPerSale: 0,
      totalCommission: 0,
      isQualifying: false,
      baseSaleValue: baseValue,
      isProportional: false,
      opportunityDetails: [],
    }
  }

  const rawPct = matchedTier.percentage
  const normalizedPct = rawPct > 1 ? rawPct / 100 : rawPct
  const baseCommPerSale =
    matchedTier.commission_per_sale > 0
      ? matchedTier.commission_per_sale
      : baseValue * normalizedPct

  // Caso 1: foi passado um array de oportunidades com valores reais
  if (Array.isArray(salesOrOpps) && salesOrOpps.length > 0) {
    let total = 0
    let hasAnyProportional = false
    const details: OpportunityCommissionItem[] = []

    for (const opp of salesOrOpps) {
      const oppVal = typeof opp.value === 'number' ? opp.value : parseFloat(String(opp.value || 0))
      const safeVal = isNaN(oppVal) || oppVal <= 0 ? baseValue : oppVal
      const saleCalc = calculateSaleCommission({
        saleValue: safeVal,
        tier: matchedTier,
        baseSaleValue: baseValue,
      })

      if (saleCalc.isProportional) {
        hasAnyProportional = true
      }
      total += saleCalc.unitCommission
      details.push({
        id: opp.id,
        company: opp.company,
        value: safeVal,
        unitCommission: saleCalc.unitCommission,
        isProportional: saleCalc.isProportional,
        ratio: saleCalc.ratio,
      })
    }

    return {
      salesCount: count,
      tier: matchedTier,
      tierName: matchedTier.name,
      percentage: normalizedPct,
      commissionPerSale: details.length > 0 ? total / details.length : baseCommPerSale,
      totalCommission: total,
      isQualifying: true,
      baseSaleValue: baseValue,
      isProportional: hasAnyProportional,
      opportunityDetails: details,
    }
  }

  // Caso 2: foi passado um valor numérico único de simulação (ex: simulador com valor editado)
  if (typeof salesOrOpps === 'number' && salesOrOpps > 0) {
    const saleVal = salesOrOpps
    const saleCalc = calculateSaleCommission({
      saleValue: saleVal,
      tier: matchedTier,
      baseSaleValue: baseValue,
    })
    const total = count * saleCalc.unitCommission

    return {
      salesCount: count,
      tier: matchedTier,
      tierName: matchedTier.name,
      percentage: normalizedPct,
      commissionPerSale: saleCalc.unitCommission,
      totalCommission: total,
      isQualifying: true,
      baseSaleValue: baseValue,
      isProportional: saleCalc.isProportional,
      opportunityDetails: [
        {
          value: saleVal,
          unitCommission: saleCalc.unitCommission,
          isProportional: saleCalc.isProportional,
          ratio: saleCalc.ratio,
        },
      ],
    }
  }

  // Caso 3: cálculo padrão baseado na quantidade (vendas no valor base R$ 350)
  const total = count * baseCommPerSale

  return {
    salesCount: count,
    tier: matchedTier,
    tierName: matchedTier.name,
    percentage: normalizedPct,
    commissionPerSale: baseCommPerSale,
    totalCommission: total,
    isQualifying: true,
    baseSaleValue: baseValue,
    isProportional: false,
    opportunityDetails: [],
  }
}
