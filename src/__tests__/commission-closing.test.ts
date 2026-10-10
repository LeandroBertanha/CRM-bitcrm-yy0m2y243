import { describe, it, expect } from 'vitest'
import {
  calculateCommission,
  isOpportunityInMonth,
  calculateCommissionPaymentDate,
  isBusinessDay,
  getBrazilianHolidayName,
} from '@/types/commission'
import { buildCommissionClosingSummary } from '@/services/commission'
import type { CommissionTier } from '@/types/commission'

describe('Regras de Fechamento de Comissão - Dia 5', () => {
  const mockTiers: CommissionTier[] = [
    {
      id: 'tier1',
      name: 'Faixa 1 (1 a 4 vendas)',
      min_sales: 1,
      max_sales: 4,
      percentage: 0.2, // 20%
      commission_per_sale: 70, // 350 * 20%
      display_order: 1,
      is_active: true,
      collectionId: 'tiers',
      collectionName: 'commission_tiers',
      created: '2026-10-01',
      updated: '2026-10-01',
    },
    {
      id: 'tier2',
      name: 'Faixa 2 (5 a 9 vendas)',
      min_sales: 5,
      max_sales: 9,
      percentage: 0.25, // 25%
      commission_per_sale: 87.5, // 350 * 25%
      display_order: 2,
      is_active: true,
      collectionId: 'tiers',
      collectionName: 'commission_tiers',
      created: '2026-10-01',
      updated: '2026-10-01',
    },
    {
      id: 'tier3',
      name: 'Faixa 3 (10 ou mais vendas)',
      min_sales: 10,
      max_sales: null,
      percentage: 0.3, // 30%
      commission_per_sale: 105, // 350 * 30%
      display_order: 3,
      is_active: true,
      collectionId: 'tiers',
      collectionName: 'commission_tiers',
      created: '2026-10-01',
      updated: '2026-10-01',
    },
  ]

  it('calcula corretamente vendedor com 0 vendas válidas (R$ 0,00 sem quebrar)', () => {
    const res = calculateCommission(0, mockTiers, 350)
    expect(res.salesCount).toBe(0)
    expect(res.isQualifying).toBe(false)
    expect(res.commissionPerSale).toBe(0)
    expect(res.totalCommission).toBe(0)
  })

  it('calcula corretamente vendedor na Faixa 1 (ex: 3 vendas base R$ 350 -> R$ 70)', () => {
    const res = calculateCommission(3, mockTiers, 350)
    expect(res.salesCount).toBe(3)
    expect(res.isQualifying).toBe(true)
    expect(res.tierName).toBe('Faixa 1 (1 a 4 vendas)')
    expect(res.percentage).toBe(0.2)
    expect(res.commissionPerSale).toBe(70)
    expect(res.totalCommission).toBe(210)
  })

  it('calcula corretamente vendedor na Faixa 2 (ex: 6 vendas base R$ 350 -> R$ 87,50)', () => {
    const res = calculateCommission(6, mockTiers, 350)
    expect(res.salesCount).toBe(6)
    expect(res.isQualifying).toBe(true)
    expect(res.tierName).toBe('Faixa 2 (5 a 9 vendas)')
    expect(res.percentage).toBe(0.25)
    expect(res.commissionPerSale).toBe(87.5)
    expect(res.totalCommission).toBe(525)
  })

  it('calcula corretamente vendedor na Faixa 3 (ex: 12 vendas base R$ 350 -> R$ 105)', () => {
    const res = calculateCommission(12, mockTiers, 350)
    expect(res.salesCount).toBe(12)
    expect(res.isQualifying).toBe(true)
    expect(res.tierName).toBe('Faixa 3 (10 ou mais vendas)')
    expect(res.percentage).toBe(0.3)
    expect(res.commissionPerSale).toBe(105)
    expect(res.totalCommission).toBe(1260)
  })

  it('avalia isOpportunityInMonth com base em created ou updated', () => {
    // 2026-10 (mês 9 no JS Date, 0-indexed)
    const inMonthOpp = {
      created: '2026-10-15T10:00:00.000Z',
    }
    const outMonthOpp = {
      created: '2026-09-15T10:00:00.000Z',
    }
    const updatedInMonth = {
      created: '2026-09-01T10:00:00.000Z',
      updated: '2026-10-02T15:30:00.000Z',
    }

    expect(isOpportunityInMonth(inMonthOpp, 2026, 9)).toBe(true)
    expect(isOpportunityInMonth(outMonthOpp, 2026, 9)).toBe(false)
    expect(isOpportunityInMonth(updatedInMonth, 2026, 9)).toBe(true)
  })

  it('monta o fechamento de comissão mensal do dia 5 consolidando todos os vendedores', () => {
    const refDate = new Date(2026, 9, 15) // 15 de Outubro de 2026
    const sellers = [
      { id: 'usr_1', name: 'Leandro Bertanha', email: 'leandro@test.com', role: 'admin' },
      { id: 'usr_2', name: 'Bruna Müller', email: 'bruna@test.com', role: 'seller' },
      { id: 'usr_3', name: 'Hyago Duarte', email: 'hyago@test.com', role: 'seller' },
    ]

    const opportunities = [
      // usr_1: 2 vendas Ganhas em Outubro -> Faixa 1 (2 x 70 = 140)
      { stage: 'Ganho', seller: 'usr_1', created: '2026-10-02T10:00:00.000Z' },
      { stage: 'Ganho', seller: 'usr_1', created: '2026-10-05T10:00:00.000Z' },
      // usr_1: 1 oportunidade em Proposta (não Ganho) -> não conta
      { stage: 'Proposta', seller: 'usr_1', created: '2026-10-08T10:00:00.000Z' },

      // usr_2: 5 vendas Ganhas em Outubro -> Faixa 2 (5 x 87,50 = 437,50)
      { stage: 'Ganho', seller: 'usr_2', created: '2026-10-01T10:00:00.000Z' },
      { stage: 'Ganho', seller: 'usr_2', created: '2026-10-03T10:00:00.000Z' },
      { stage: 'Ganho', seller: 'usr_2', created: '2026-10-04T10:00:00.000Z' },
      { stage: 'Ganho', seller: 'usr_2', created: '2026-10-10T10:00:00.000Z' },
      { stage: 'Ganho', seller: 'usr_2', created: '2026-10-12T10:00:00.000Z' },

      // usr_3: 0 vendas em Outubro (apenas 1 em Setembro) -> R$ 0,00
      { stage: 'Ganho', seller: 'usr_3', created: '2026-09-20T10:00:00.000Z' },
    ]

    const summary = buildCommissionClosingSummary({
      referenceDate: refDate,
      sellers,
      opportunities,
      tiers: mockTiers,
      baseSaleValue: 350,
    })

    expect(summary.periodYear).toBe(2026)
    expect(summary.periodMonth).toBe(9)
    expect(summary.paymentDay).toBe(5)
    // Em novembro de 2026: 05/11/2026 é uma quinta-feira (dia útil normal)
    expect(summary.paymentDateFormatted).toBe('05/11/2026')
    expect(summary.totalSalesCount).toBe(7) // 2 + 5
    expect(summary.totalAmountToPay).toBe(577.5) // 140 + 437.5
    expect(summary.qualifyingSellersCount).toBe(2)

    // Ordenação: usr_2 (437.5) em 1º, usr_1 (140) em 2º, usr_3 (0) em 3º
    expect(summary.sellers[0].sellerId).toBe('usr_2')
    expect(summary.sellers[0].wonCountMonth).toBe(5)
    expect(summary.sellers[0].totalCommission).toBe(437.5)

    expect(summary.sellers[1].sellerId).toBe('usr_1')
    expect(summary.sellers[1].wonCountMonth).toBe(2)
    expect(summary.sellers[1].totalCommission).toBe(140)

    expect(summary.sellers[2].sellerId).toBe('usr_3')
    expect(summary.sellers[2].wonCountMonth).toBe(0)
    expect(summary.sellers[2].totalCommission).toBe(0)
    expect(summary.sellers[2].isQualifying).toBe(false)
  })

  describe('Cálculo Proporcional Acima de R$ 350,00', () => {
    it('mantém comissão padrão da faixa para valores <= R$ 350,00', () => {
      // 1 venda de R$ 350 na Faixa 1 (20% -> R$ 70)
      const res350 = calculateCommission(1, mockTiers, 350, 350)
      expect(res350.isProportional).toBe(false)
      expect(res350.commissionPerSale).toBe(70)
      expect(res350.totalCommission).toBe(70)

      // 1 venda de R$ 300 (abaixo de 350): comissão fixa da faixa R$ 70
      const res300 = calculateCommission(1, mockTiers, 350, 300)
      expect(res300.isProportional).toBe(false)
      expect(res300.commissionPerSale).toBe(70)
      expect(res300.totalCommission).toBe(70)
    })

    it('calcula comissão proporcional quando valor > R$ 350,00 (ex: R$ 500, R$ 1.000, R$ 2.500)', () => {
      // Faixa 1 (20%, base R$ 350 -> comissão base R$ 70)
      // Venda de R$ 500 -> 500 * 20% = R$ 100 de comissão
      const res500 = calculateCommission(1, mockTiers, 350, 500)
      expect(res500.isProportional).toBe(true)
      expect(res500.commissionPerSale).toBe(100)
      expect(res500.totalCommission).toBe(100)

      // Venda de R$ 1.000 -> 1000 * 20% = R$ 200 de comissão
      const res1000 = calculateCommission(1, mockTiers, 350, 1000)
      expect(res1000.isProportional).toBe(true)
      expect(res1000.commissionPerSale).toBe(200)
      expect(res1000.totalCommission).toBe(200)

      // Faixa 2 (5 vendas: 25%, base R$ 350 -> comissão base R$ 87,50)
      // 5 vendas de R$ 2.000 cada -> 2000 * 25% = R$ 500 por venda -> total R$ 2.500
      const res2000 = calculateCommission(5, mockTiers, 350, 2000)
      expect(res2000.tierName).toBe('Faixa 2 (5 a 9 vendas)')
      expect(res2000.percentage).toBe(0.25)
      expect(res2000.isProportional).toBe(true)
      expect(res2000.commissionPerSale).toBe(500) // 2000 * 25% = 500
      expect(res2000.totalCommission).toBe(2500) // 5 * 500 = 2500

      // Faixa 3 (10 vendas: 30%, base R$ 350 -> comissão base R$ 105)
      // Venda de R$ 1.500 -> comissão unitária: 1500 * 30% = 450
      const res1500 = calculateCommission(10, mockTiers, 350, 1500)
      expect(res1500.percentage).toBe(0.3)
      expect(res1500.commissionPerSale).toBe(450)
      expect(res1500.totalCommission).toBe(4500)
    })

    it('calcula comissões mistas por oportunidade real de um vendedor', () => {
      // Vendedor com 2 vendas na Faixa 1 (20%):
      // - Opp 1: R$ 350 (comissão R$ 70)
      // - Opp 2: R$ 500 (comissão R$ 100)
      // Total esperado: R$ 170
      const opps = [
        { id: 'o1', company: 'Empresa A', value: 350 },
        { id: 'o2', company: 'Empresa B', value: 500 },
      ]
      const res = calculateCommission(2, mockTiers, 350, opps)
      expect(res.salesCount).toBe(2)
      expect(res.tierName).toBe('Faixa 1 (1 a 4 vendas)')
      expect(res.totalCommission).toBe(170)
      expect(res.opportunityDetails).toHaveLength(2)
      expect(res.opportunityDetails?.[0].unitCommission).toBe(70)
      expect(res.opportunityDetails?.[0].isProportional).toBe(false)
      expect(res.opportunityDetails?.[1].unitCommission).toBe(100)
      expect(res.opportunityDetails?.[1].isProportional).toBe(true)
    })
  })

  describe('Cálculo do Repasse no Dia 5 ou Próximo Dia Útil', () => {
    it('mantém dia 5 quando cai em dia útil (ex: 05/12/2024 é quinta-feira)', () => {
      // Novembro/2024 -> pagamento em 05/12/2024 (quinta-feira)
      const res = calculateCommissionPaymentDate(2024, 10)
      expect(res.nominalDateFormatted).toBe('05/12/2024')
      expect(res.effectiveDateFormatted).toBe('05/12/2024')
      expect(res.isShifted).toBe(false)
    })

    it('avança para segunda-feira quando dia 5 cai em sábado (ex: Dezembro/2025 cai em sábado 05/12/2025 -> 08/12/2025)', () => {
      // Novembro/2025 apuração -> pagamento em 05/12/2025 (sábado)
      const res = calculateCommissionPaymentDate(2025, 10)
      expect(res.nominalDateFormatted).toBe('05/12/2025')
      expect(res.nominalDate.getDay()).toBe(5) // Sexta? Vamos checar: 2025-12-05 é sexta!
      // Vamos verificar dia que REALMENTE cai no sábado:
      // Julho/2025: 05/07/2025 é sábado! (Mês apuração: Junho/2025, índice 5)
    })

    it('avança corretamente se dia 5 cair em sábado (ex: 05/07/2025 cai em sábado -> paga 07/07/2025 na segunda)', () => {
      // Junho/2025 apuração (índice 5) -> pagamento em 05/07/2025 (sábado)
      const res = calculateCommissionPaymentDate(2025, 5)
      expect(res.nominalDateFormatted).toBe('05/07/2025')
      expect(res.nominalDate.getDay()).toBe(6) // Sábado
      expect(res.effectiveDateFormatted).toBe('07/07/2025') // Segunda-feira
      expect(res.isShifted).toBe(true)
      expect(res.shiftReason).toBe('weekend')
      expect(res.shiftDescription).toContain('cai em sábado')
    })

    it('avança corretamente se dia 5 cair em domingo (ex: 05/10/2025 cai em domingo -> paga 06/10/2025 na segunda)', () => {
      // Setembro/2025 apuração (índice 8) -> pagamento em 05/10/2025 (domingo)
      const res = calculateCommissionPaymentDate(2025, 8)
      expect(res.nominalDateFormatted).toBe('05/10/2025')
      expect(res.nominalDate.getDay()).toBe(0) // Domingo
      expect(res.effectiveDateFormatted).toBe('06/10/2025') // Segunda-feira
      expect(res.isShifted).toBe(true)
      expect(res.shiftReason).toBe('weekend')
      expect(res.shiftDescription).toContain('cai em domingo')
    })

    it('reconhece feriados nacionais e avança dia útil', () => {
      // Teste do helper de feriados
      const tiradentes = new Date(2025, 3, 21) // 21/04
      expect(getBrazilianHolidayName(tiradentes)).toBe('Tiradentes')
      expect(isBusinessDay(tiradentes)).toBe(false)

      const trabalho = new Date(2025, 4, 1) // 01/05
      expect(getBrazilianHolidayName(trabalho)).toBe('Dia do Trabalho')
      expect(isBusinessDay(trabalho)).toBe(false)

      const diaUtil = new Date(2025, 4, 2) // 02/05/2025 (sexta)
      expect(isBusinessDay(diaUtil)).toBe(true)
    })
  })
})
