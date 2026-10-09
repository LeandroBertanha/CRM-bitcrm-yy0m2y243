import pb from '@/lib/pocketbase/client'
import { calculateCommission, calculateCommissionPaymentDate } from '@/types/commission'
import type {
  CommissionTier,
  CommissionSettings,
  CommissionClosingSummary,
  SellerMonthlyCommission,
} from '@/types/commission'

/**
 * Serviço para carregar dados de comissionamento direto do PocketBase/Skip Cloud.
 * NUNCA utiliza valores hardcoded no código.
 */
export async function getCommissionTiers(): Promise<CommissionTier[]> {
  try {
    const records = await pb.collection('commission_tiers').getFullList<CommissionTier>({
      filter: 'is_active = true',
      sort: 'display_order',
    })
    return records
  } catch (err) {
    console.error('Erro ao buscar faixas de comissão do banco:', err)
    return []
  }
}

export async function getCommissionSettings(): Promise<CommissionSettings | null> {
  try {
    const record = await pb
      .collection('commission_settings')
      .getFirstListItem<CommissionSettings>('is_active = true', {
        sort: '-updated',
      })
    return record
  } catch (err) {
    console.error('Erro ao buscar configurações de comissionamento do banco:', err)
    return null
  }
}

/**
 * Monta o fechamento de comissão mensal do dia 5 para todos os vendedores.
 * Reutiliza os tiers cadastrados no banco e a função oficial calculateCommission.
 */
export function buildCommissionClosingSummary(params: {
  referenceDate?: Date
  sellers: Array<{ id: string; name?: string; email: string; role?: string }>
  opportunities: Array<{
    id?: string
    company?: string
    value?: number
    stage?: string
    seller?: string
    created?: string
    updated?: string
    expand?: { seller?: { id: string; name?: string; email?: string } }
  }>
  tiers: CommissionTier[]
  baseSaleValue?: number
}): CommissionClosingSummary {
  const { referenceDate = new Date(), sellers, opportunities, tiers, baseSaleValue = 500 } = params

  const periodYear = referenceDate.getFullYear()
  const periodMonth = referenceDate.getMonth() // 0-11

  const rawMonthName = referenceDate.toLocaleString('pt-BR', { month: 'long' })
  const periodMonthCapitalized = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1)

  // Mês seguinte (onde o pagamento cai dia 5, ajustado para próximo dia útil se cair em fim de semana ou feriado)
  const paymentDateInfo = calculateCommissionPaymentDate(periodYear, periodMonth)
  const paymentYear = paymentDateInfo.effectiveDate.getFullYear()
  const paymentMonthName = paymentDateInfo.effectiveDate.toLocaleString('pt-BR', { month: 'long' })
  const paymentMonthCapitalized =
    paymentMonthName.charAt(0).toUpperCase() + paymentMonthName.slice(1)
  const paymentDateFormatted = paymentDateInfo.effectiveDateFormatted

  // Mapear vendedores
  const map = new Map<
    string,
    {
      sellerId: string
      name: string
      email: string
      role?: string
      wonCountMonth: number
      wonOpportunities: Array<{ id?: string; value?: number; company?: string }>
    }
  >()

  sellers.forEach((s) => {
    map.set(s.id, {
      sellerId: s.id,
      name: s.name || s.email.split('@')[0],
      email: s.email,
      role: s.role,
      wonCountMonth: 0,
      wonOpportunities: [],
    })
  })

  // Contabilizar oportunidades Ganhas do mês de apuração
  opportunities.forEach((opp) => {
    if (opp.stage === 'Ganho') {
      const dateStr = opp.created || opp.updated
      if (dateStr) {
        try {
          const d = new Date(dateStr)
          if (d.getFullYear() === periodYear && d.getMonth() === periodMonth) {
            const sellerId = opp.seller || opp.expand?.seller?.id
            if (sellerId && map.has(sellerId)) {
              const row = map.get(sellerId)!
              row.wonCountMonth += 1
              row.wonOpportunities.push({
                id: opp.id,
                value: (opp as any).value,
                company: (opp as any).company,
              })
            }
          }
        } catch {
          // data inválida ignorada
        }
      }
    }
  })

  // Calcular comissões aplicando a regra proporcional com base nas oportunidades reais do vendedor
  const calculatedSellers: SellerMonthlyCommission[] = Array.from(map.values()).map((seller) => {
    const calc = calculateCommission(
      seller.wonCountMonth,
      tiers,
      baseSaleValue,
      seller.wonOpportunities,
    )
    const totalWonValue = seller.wonOpportunities.reduce((acc, o) => {
      const val = typeof o.value === 'number' ? o.value : parseFloat(String(o.value || 0))
      return acc + (isNaN(val) ? 0 : val)
    }, 0)

    return {
      sellerId: seller.sellerId,
      name: seller.name,
      email: seller.email,
      role: seller.role,
      wonCountMonth: seller.wonCountMonth,
      totalWonValue,
      tier: calc.tier,
      tierName: calc.isQualifying ? calc.tierName : 'Sem faixa atingida',
      percentage: calc.percentage,
      commissionPerSale: calc.commissionPerSale,
      totalCommission: calc.totalCommission,
      isQualifying: calc.isQualifying,
    }
  })

  // Ordenar por valor decrescente, depois por vendas ganhas decrescente, depois por nome
  calculatedSellers.sort((a, b) => {
    if (b.totalCommission !== a.totalCommission) {
      return b.totalCommission - a.totalCommission
    }
    if (b.wonCountMonth !== a.wonCountMonth) {
      return b.wonCountMonth - a.wonCountMonth
    }
    return a.name.localeCompare(b.name)
  })

  const totalSalesCount = calculatedSellers.reduce((acc, s) => acc + s.wonCountMonth, 0)
  const totalAmountToPay = calculatedSellers.reduce((acc, s) => acc + s.totalCommission, 0)
  const qualifyingSellersCount = calculatedSellers.filter((s) => s.isQualifying).length

  return {
    periodMonth,
    periodYear,
    periodMonthName: rawMonthName,
    periodMonthCapitalized,
    paymentDay: 5,
    paymentMonthName: paymentMonthCapitalized,
    paymentYear,
    paymentDateFormatted,
    paymentDateInfo,
    sellers: calculatedSellers,
    totalSalesCount,
    totalAmountToPay,
    qualifyingSellersCount,
    hasTiersConfigured: tiers.length > 0,
  }
}
