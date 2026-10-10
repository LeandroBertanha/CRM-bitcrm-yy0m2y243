import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CommissionPage from '@/pages/Commission'

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'usr_test',
      name: 'Leandro Bertanha',
      email: 'leandro.bertanha@lbertanha.com',
      role: 'admin',
    },
    isAdmin: true,
    signOut: vi.fn(),
    isLoading: false,
  }),
}))

// Mock useRealtime
vi.mock('@/hooks/use-realtime', () => ({
  __esModule: true,
  default: vi.fn(),
  useRealtime: vi.fn(),
}))

const mockTiers = [
  {
    id: 't1',
    name: 'Faixa 1 (1 a 4 vendas)',
    min_sales: 1,
    max_sales: 4,
    percentage: 0.2, // 20%
    commission_per_sale: 100,
    display_order: 1,
    is_active: true,
    collectionId: 'commission_tiers',
    collectionName: 'commission_tiers',
    created: '2026-10-01',
    updated: '2026-10-01',
  },
  {
    id: 't2',
    name: 'Faixa 2 (5 a 9 vendas)',
    min_sales: 5,
    max_sales: 9,
    percentage: 0.25, // 25%
    commission_per_sale: 125,
    display_order: 2,
    is_active: true,
    collectionId: 'commission_tiers',
    collectionName: 'commission_tiers',
    created: '2026-10-01',
    updated: '2026-10-01',
  },
  {
    id: 't3',
    name: 'Faixa 3 (10 ou mais vendas)',
    min_sales: 10,
    max_sales: null,
    percentage: 0.3, // 30%
    commission_per_sale: 150,
    display_order: 3,
    is_active: true,
    collectionId: 'commission_tiers',
    collectionName: 'commission_tiers',
    created: '2026-10-01',
    updated: '2026-10-01',
  },
]

const mockSettings = {
  id: 'set1',
  product_name: 'Site ou Landing Page sob medida',
  base_sale_value: 350,
  monthly_hosting_value: 55,
  hosting_note: 'A mensalidade de R$ 55,00 não integra a base de comissão.',
  essential_rules: ['A comissão incide sobre o setup inicial negociado (a partir de R$ 350,00).'],
  detailed_rules: [],
  is_active: true,
  collectionId: 'commission_settings',
  collectionName: 'commission_settings',
  created: '2026-10-01',
  updated: '2026-10-01',
}

// Mock services/commission
vi.mock('@/services/commission', async () => {
  const actual = await vi.importActual<any>('@/services/commission')
  return {
    ...actual,
    getCommissionTiers: vi.fn().mockResolvedValue(mockTiers),
    getCommissionSettings: vi.fn().mockResolvedValue(mockSettings),
  }
})

// Mock PocketBase
vi.mock('@/lib/pocketbase/client', () => ({
  __esModule: true,
  default: {
    collection: (name: string) => ({
      getFullList: vi.fn().mockImplementation(() => {
        if (name === 'commission_tiers') return Promise.resolve(mockTiers)
        if (name === 'commission_settings') return Promise.resolve([mockSettings])
        if (name === 'opportunities') return Promise.resolve([])
        if (name === 'users') {
          return Promise.resolve([
            {
              id: 'usr_test',
              name: 'Leandro Bertanha',
              email: 'leandro.bertanha@lbertanha.com',
              role: 'admin',
            },
          ])
        }
        return Promise.resolve([])
      }),
      getFirstListItem: vi.fn().mockResolvedValue(mockSettings),
    }),
  },
  pb: {
    collection: (name: string) => ({
      getFullList: vi.fn().mockResolvedValue([]),
    }),
  },
}))

describe('Simulador Editável na Tela de Comissionamento (Commission.tsx)', () => {
  it('permite digitar e editar o valor unitário da venda e recalcula instantaneamente', async () => {
    render(
      <MemoryRouter initialEntries={['/comissionamento']}>
        <CommissionPage />
      </MemoryRouter>,
    )

    // Aguarda carregar dados
    const heading = await screen.findByText('Simulador de Comissão em Tempo Real')
    expect(heading).toBeDefined()

    // Encontra os inputs do simulador
    const salesInput = screen.getByLabelText(
      'Quantidade de vendas para simulação',
    ) as HTMLInputElement
    const valueInput = screen.getByLabelText(
      'Valor unitário da venda para simulação',
    ) as HTMLInputElement

    expect(salesInput).toBeDefined()
    expect(valueInput).toBeDefined()
    expect(salesInput.value).toBe('10')
    expect(valueInput.value).toBe('350')

    // Altera o valor da venda para R$ 1.500 (acima de 350)
    // 10 vendas na Faixa 3 (30%) com valor unitário R$ 1.500 -> comissão por venda = 1500 * 30% = R$ 450,00
    // Total de comissão: 10 * 450 = R$ 4.500,00
    fireEvent.change(valueInput, { target: { value: '1500' } })

    expect(screen.getByText(/Regra Proporcional Ativa/)).toBeDefined()
    expect(screen.getByText(/4\.500,00/)).toBeDefined()

    // Altera a quantidade de vendas para 2 (Faixa 1 = 20%)
    // 2 vendas a R$ 1.000 -> comissão unitária: 1000 * 20% = R$ 200,00
    // Total: R$ 400,00
    fireEvent.change(salesInput, { target: { value: '2' } })
    fireEvent.change(valueInput, { target: { value: '1000' } })

    expect(screen.getByText('Faixa 1 (1 a 4 vendas)')).toBeDefined()
    expect(screen.getByText(/400,00/)).toBeDefined()
  })

  it('exibe botões de atalho de valores sugeridos acima de R$ 350', async () => {
    render(
      <MemoryRouter initialEntries={['/comissionamento']}>
        <CommissionPage />
      </MemoryRouter>,
    )

    await screen.findByText('Simulador de Comissão em Tempo Real')

    // Botões de valores sugeridos
    const btn1000 = screen.getByRole('button', { name: /1\.000,00/ })
    expect(btn1000).toBeDefined()

    fireEvent.click(btn1000)
    const valueInput = screen.getByLabelText(
      'Valor unitário da venda para simulação',
    ) as HTMLInputElement
    expect(valueInput.value).toBe('1000')
  })
})
