import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PublicForm from '@/pages/PublicForm'
import { calculateCommission, calculateSaleCommission } from '@/types/commission'
import type { CommissionTier } from '@/types/commission'

// 1. Mock do PocketBase para testar o carregamento dos produtos no formulário público
const mockProducts = [
  {
    id: 'prod_site',
    name: 'Site ou Landing Page sob medida',
    setup_value: 350,
    setup_price: 350,
    recurring_value: 55,
    monthly_price: 55,
    is_active: true,
    display_order: 1,
  },
  {
    id: 'prod_wa',
    name: 'WhatsApp Autônomo e Humanizado',
    setup_value: 350,
    setup_price: 350,
    recurring_value: 55,
    monthly_price: 55,
    is_active: true,
    display_order: 2,
  },
]

vi.mock('@/lib/pocketbase/client', () => ({
  __esModule: true,
  default: {
    collection: (col: string) => ({
      getFullList: vi.fn().mockImplementation(() => {
        if (col === 'products') {
          return Promise.resolve(mockProducts)
        }
        return Promise.resolve([])
      }),
      create: vi.fn().mockResolvedValue({ id: 'new_opp_id' }),
    }),
  },
  pb: {
    collection: (col: string) => ({
      getFullList: vi.fn().mockImplementation(() => {
        if (col === 'products') {
          return Promise.resolve(mockProducts)
        }
        return Promise.resolve([])
      }),
      create: vi.fn().mockResolvedValue({ id: 'new_opp_id' }),
    }),
  },
}))

describe('Novas Faixas de Comissionamento e Formulário Público (Base R$ 350,00)', () => {
  const newTiers: CommissionTier[] = [
    {
      id: 'tier_1',
      name: 'Faixa 1 (1 a 4 vendas)',
      min_sales: 1,
      max_sales: 4,
      percentage: 0.2, // 20%
      commission_per_sale: 70, // 350 * 20%
      display_order: 1,
      is_active: true,
      collectionId: 'commission_tiers',
      collectionName: 'commission_tiers',
      created: '2026-03-01',
      updated: '2026-03-01',
    },
    {
      id: 'tier_2',
      name: 'Faixa 2 (5 a 9 vendas)',
      min_sales: 5,
      max_sales: 9,
      percentage: 0.25, // 25%
      commission_per_sale: 87.5, // 350 * 25%
      display_order: 2,
      is_active: true,
      collectionId: 'commission_tiers',
      collectionName: 'commission_tiers',
      created: '2026-03-01',
      updated: '2026-03-01',
    },
    {
      id: 'tier_3',
      name: 'Faixa 3 (10 ou mais vendas)',
      min_sales: 10,
      max_sales: null,
      percentage: 0.3, // 30%
      commission_per_sale: 105, // 350 * 30%
      display_order: 3,
      is_active: true,
      collectionId: 'commission_tiers',
      collectionName: 'commission_tiers',
      created: '2026-03-01',
      updated: '2026-03-01',
    },
  ]

  it('calcula rigorosamente as novas faixas na base mínima R$ 350,00: 70 / 87,50 / 105', () => {
    // Faixa 1 (ex: 2 vendas): 20% -> R$ 70,00 cada
    const resFaixa1 = calculateCommission(2, newTiers, 350)
    expect(resFaixa1.tierName).toBe('Faixa 1 (1 a 4 vendas)')
    expect(resFaixa1.percentage).toBe(0.2)
    expect(resFaixa1.commissionPerSale).toBe(70)
    expect(resFaixa1.totalCommission).toBe(140)

    // Faixa 2 (ex: 5 vendas): 25% -> R$ 87,50 cada
    const resFaixa2 = calculateCommission(5, newTiers, 350)
    expect(resFaixa2.tierName).toBe('Faixa 2 (5 a 9 vendas)')
    expect(resFaixa2.percentage).toBe(0.25)
    expect(resFaixa2.commissionPerSale).toBe(87.5)
    expect(resFaixa2.totalCommission).toBe(437.5)

    // Faixa 3 (ex: 10 vendas): 30% -> R$ 105,00 cada
    const resFaixa3 = calculateCommission(10, newTiers, 350)
    expect(resFaixa3.tierName).toBe('Faixa 3 (10 ou mais vendas)')
    expect(resFaixa3.percentage).toBe(0.3)
    expect(resFaixa3.commissionPerSale).toBe(105)
    expect(resFaixa3.totalCommission).toBe(1050)
  })

  it('calcula proporcionalidade quando setup fechado acima de R$ 350,00 (ex: R$ 500 na Faixa 1 = R$ 100)', () => {
    // Venda de R$ 500,00 na Faixa 1 (20%): 500 * 20% = R$ 100,00
    const calc500 = calculateSaleCommission({
      saleValue: 500,
      tier: newTiers[0],
      baseSaleValue: 350,
    })
    expect(calc500.isProportional).toBe(true)
    expect(calc500.unitCommission).toBe(100)

    // Venda de R$ 1.000,00 na Faixa 1 (20%): 1000 * 20% = R$ 200,00
    const calc1000 = calculateSaleCommission({
      saleValue: 1000,
      tier: newTiers[0],
      baseSaleValue: 350,
    })
    expect(calc1000.isProportional).toBe(true)
    expect(calc1000.unitCommission).toBe(200)

    // Venda de R$ 2.500,00 na Faixa 2 (25%): 2500 * 25% = R$ 625,00
    const calc2500F2 = calculateSaleCommission({
      saleValue: 2500,
      tier: newTiers[1],
      baseSaleValue: 350,
    })
    expect(calc2500F2.isProportional).toBe(true)
    expect(calc2500F2.unitCommission).toBe(625)

    // Venda no piso exato R$ 350,00 não é proporcional: paga o piso fixo da faixa
    const calcPiso = calculateSaleCommission({
      saleValue: 350,
      tier: newTiers[0],
      baseSaleValue: 350,
    })
    expect(calcPiso.isProportional).toBe(false)
    expect(calcPiso.unitCommission).toBe(70)
  })

  it('garante que mensalidade de R$ 55,00 NUNCA entra na base de cálculo de comissão', () => {
    const opp = {
      value: 350, // setup
      recurring_value: 55, // mensalidade
    }

    // A comissão deve incidir estritamente sobre 350 (R$ 70 na Faixa 1)
    const res = calculateCommission(1, newTiers, 350, [opp])
    expect(res.totalCommission).toBe(70)

    // Caso alguém somasse indevidamente a mensalidade (350 + 55 = 405): 405 * 20% = 81
    expect(res.totalCommission).not.toBe(81)
  })

  it('PublicForm renderiza com piso R$ 350,00 carregado do banco de dados e opções derivadas', async () => {
    render(
      <MemoryRouter initialEntries={['/formulario']}>
        <PublicForm />
      </MemoryRouter>,
    )

    // Aguarda carregar produtos do banco
    await waitFor(() => {
      expect(screen.getByText('Cadastro de Oportunidade Comercial')).toBeDefined()
    })

    // Seletor de valor do serviço deve ter "R$ 350,00"
    expect(screen.getByText(/R\$ 350,00/)).toBeDefined()
  })
})
