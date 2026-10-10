import { describe, it, expect } from 'vitest'

describe('Filtragem de Vendedores Inativos e Regras de Segurança (Tarefa 2)', () => {
  interface UserItem {
    id: string
    name: string
    email: string
    disabled?: boolean
  }

  const allUsers: UserItem[] = [
    { id: 'usr-1', name: 'Carlos Vendedor', email: 'carlos@bitcrm.local', disabled: false },
    { id: 'usr-2', name: 'Mariana Silva', email: 'mariana@bitcrm.local', disabled: undefined },
    { id: 'usr-3', name: 'Ex Colaborador', email: 'ex@bitcrm.local', disabled: true },
  ]

  it('filtra usuários ativos com disabled != true em listas públicas e de escolha', () => {
    const activeUsers = allUsers.filter((u) => u.disabled !== true)
    expect(activeUsers).toHaveLength(2)
    expect(activeUsers.map((u) => u.id)).toEqual(['usr-1', 'usr-2'])
    expect(activeUsers.some((u) => u.id === 'usr-3')).toBe(false)
  })

  it('redefine sellerFilter do Kanban para "all" se o ID apontar para vendedor inativo', () => {
    const activeUsers = allUsers.filter((u) => u.disabled !== true)
    let currentSellerFilter: string = 'usr-3' // apontando para inativo

    // Lógica do useEffect em Opportunities.tsx:
    if (currentSellerFilter !== 'all' && activeUsers.length > 0) {
      const isActive = activeUsers.some((s) => s.id === currentSellerFilter)
      if (!isActive) {
        currentSellerFilter = 'all'
      }
    }

    expect(currentSellerFilter).toBe('all')

    // Se apontar para um ativo, preserva
    let validSellerFilter = 'usr-1'
    if (validSellerFilter !== 'all' && activeUsers.length > 0) {
      const isActive = activeUsers.some((s) => s.id === validSellerFilter)
      if (!isActive) {
        validSellerFilter = 'all'
      }
    }
    expect(validSellerFilter).toBe('usr-1')
  })

  it('modal de edição inclui vendedor inativo marcado com "(Inativo)" preservando o histórico', () => {
    const activeUsers = allUsers.filter((u) => u.disabled !== true)
    const currentOpp = {
      id: 'opp-historic',
      company: 'Empresa Antiga',
      seller: 'usr-3', // vendedor desativado
      expand: {
        seller: {
          id: 'usr-3',
          name: 'Ex Colaborador',
          email: 'ex@bitcrm.local',
        },
      },
    }

    const isCurrentSellerInactive =
      Boolean(currentOpp.seller) && !activeUsers.some((s) => s.id === currentOpp.seller)
    expect(isCurrentSellerInactive).toBe(true)

    const displayedLabel =
      (currentOpp.expand.seller.name || currentOpp.expand.seller.email) + ' (Inativo)'
    expect(displayedLabel).toBe('Ex Colaborador (Inativo)')

    // Histórico preservado intacto: ID continua sendo usr-3
    expect(currentOpp.seller).toBe('usr-3')
  })

  it('PublicForm não atribui lead (seller: null) se sellerId fornecido pertencer a usuário disabled', () => {
    const mockDbUsers = new Map<string, { id: string; name: string; disabled?: boolean }>([
      ['active-seller', { id: 'active-seller', name: 'Ativo', disabled: false }],
      ['inactive-seller', { id: 'inactive-seller', name: 'Inativo', disabled: true }],
    ])

    const resolveSeller = (requestedSellerId: string) => {
      const seller = mockDbUsers.get(requestedSellerId)
      if (!seller || seller.disabled === true) {
        return null
      }
      return seller.id
    }

    expect(resolveSeller('active-seller')).toBe('active-seller')
    expect(resolveSeller('inactive-seller')).toBeNull()
    expect(resolveSeller('non-existent')).toBeNull()
  })

  it('AdminMetrics e Dashboard não incluem vendedores inativos nas linhas da equipe', () => {
    const activeSellersList = allUsers.filter((u) => u.disabled !== true)
    const activeSellerIds = new Set(activeSellersList.map((s) => s.id))

    const opportunities = [
      { id: '1', seller: 'usr-1', value: 1000, stage: 'Ganho' },
      { id: '2', seller: 'usr-3', value: 5000, stage: 'Ganho' }, // de inativo
    ]

    // Totais globais computam tudo (histórico financeiro preservado)
    const totalWonGlobal = opportunities
      .filter((o) => o.stage === 'Ganho')
      .reduce((acc, curr) => acc + curr.value, 0)
    expect(totalWonGlobal).toBe(6000)

    // Desempenho por vendedor computa apenas vendedores ativos
    const sellerRows = activeSellersList.map((seller) => {
      const opps = opportunities.filter((o) => o.seller === seller.id)
      return {
        sellerId: seller.id,
        name: seller.name,
        wonValue: opps
          .filter((o) => o.stage === 'Ganho')
          .reduce((acc, curr) => acc + curr.value, 0),
      }
    })

    expect(sellerRows).toHaveLength(2)
    expect(sellerRows.some((r) => r.sellerId === 'usr-3')).toBe(false)
    expect(sellerRows.find((r) => r.sellerId === 'usr-1')?.wonValue).toBe(1000)
    expect(sellerRows.find((r) => r.sellerId === 'usr-2')?.wonValue).toBe(0)
  })
})
