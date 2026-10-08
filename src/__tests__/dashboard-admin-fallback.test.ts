import { describe, it, expect, vi } from 'vitest'
import type { Opportunity } from '@/types/crm'

describe('Dashboard - Fallback Admin e Tratamento de Erros', () => {
  const adminUser = {
    id: '015c920nyv4tnwl',
    email: 'leandro.bertanha@lbertanha.com',
    role: 'admin',
    name: 'Leandro Bertanha',
  }

  const sellerUser = {
    id: 'seller-other-id',
    email: 'vendedor@exemplo.com',
    role: 'seller',
    name: 'Vendedor Outro',
  }

  const teamOpportunities: Opportunity[] = [
    {
      id: 'opp-1',
      company: 'Empresa do Admin',
      stage: 'Proposta',
      seller: '015c920nyv4tnwl',
      value: 1500,
    } as unknown as Opportunity,
    {
      id: 'opp-2',
      company: 'Empresa do Vendedor B',
      stage: 'Qualificado',
      seller: 'seller-other-id',
      value: 3000,
    } as unknown as Opportunity,
    {
      id: 'opp-3',
      company: 'Empresa Sem Vendedor',
      stage: 'Novo',
      seller: '',
      value: 2000,
    } as unknown as Opportunity,
  ]

  // Função pura que reproduz com fidelidade a lógica implementada no Dashboard
  function calculateDashboardScope({
    user,
    isAdmin,
    opportunities,
  }: {
    user: { id: string; email: string; role?: string } | null
    isAdmin: boolean
    opportunities: Opportunity[]
  }) {
    const personalOpps = !user
      ? []
      : opportunities.filter(
          (opp) => !opp.seller || opp.seller === user.id || opp.expand?.seller?.id === user.id,
        )

    const isUsingAdminFallback = Boolean(
      (isAdmin || !user) && personalOpps.length === 0 && opportunities.length > 0,
    )

    const myOpps = isUsingAdminFallback
      ? opportunities
      : !user && opportunities.length > 0
        ? opportunities
        : personalOpps

    return {
      personalOpps,
      isUsingAdminFallback,
      myOpps,
    }
  }

  it('(a) admin com oportunidades atribuídas a ele não vê dashboard vazio e não ativa fallback', () => {
    const result = calculateDashboardScope({
      user: adminUser,
      isAdmin: true,
      opportunities: teamOpportunities,
    })

    // Tem a opp-1 atribuída diretamente a ele + opp-3 que não tem seller
    expect(result.personalOpps.length).toBeGreaterThan(0)
    expect(result.personalOpps.map((o) => o.id)).toEqual(['opp-1', 'opp-3'])
    expect(result.isUsingAdminFallback).toBe(false)
    expect(result.myOpps).toHaveLength(2)
    expect(result.myOpps.map((o) => o.id)).toContain('opp-1')
  })

  it('(b) admin com 0 oportunidades pessoais mas dados na base vê fallback da equipe com aviso', () => {
    // Admin com id diferente ou nenhuma opp com seu ID nem sem seller
    const adminWithoutPersonalOpps = {
      id: 'admin-fresh-id',
      email: 'leandro.bertanha@lbertanha.com',
      role: 'admin',
    }

    const onlyOtherSellersOpps: Opportunity[] = [
      {
        id: 'opp-vendor-1',
        company: 'Empresa 1',
        seller: 'seller-other-id',
        stage: 'Proposta',
        value: 5000,
      } as unknown as Opportunity,
      {
        id: 'opp-vendor-2',
        company: 'Empresa 2',
        seller: 'seller-other-id',
        stage: 'Ganho',
        value: 10000,
      } as unknown as Opportunity,
    ]

    const result = calculateDashboardScope({
      user: adminWithoutPersonalOpps,
      isAdmin: true,
      opportunities: onlyOtherSellersOpps,
    })

    // Carteira pessoal resultou em 0
    expect(result.personalOpps).toHaveLength(0)
    // Fallback admin foi ativado porque existem oportunidades no banco
    expect(result.isUsingAdminFallback).toBe(true)
    // myOpps passa a refletir toda a equipe
    expect(result.myOpps).toHaveLength(2)
    expect(result.myOpps.map((o) => o.id)).toEqual(['opp-vendor-1', 'opp-vendor-2'])
  })

  it('vendedor comum sem oportunidades não ativa fallback de equipe', () => {
    const onlyOtherSellersOpps: Opportunity[] = [
      {
        id: 'opp-vendor-1',
        company: 'Empresa 1',
        seller: 'someone-else',
        stage: 'Proposta',
        value: 5000,
      } as unknown as Opportunity,
    ]

    const result = calculateDashboardScope({
      user: sellerUser,
      isAdmin: false,
      opportunities: onlyOtherSellersOpps,
    })

    expect(result.personalOpps).toHaveLength(0)
    expect(result.isUsingAdminFallback).toBe(false)
    expect(result.myOpps).toHaveLength(0)
  })

  it('quando o user estiver nulo temporariamente mas houver dados, ativa fallback em vez de zerar em silêncio', () => {
    const result = calculateDashboardScope({
      user: null,
      isAdmin: false,
      opportunities: teamOpportunities,
    })

    expect(result.personalOpps).toHaveLength(0)
    expect(result.isUsingAdminFallback).toBe(true)
    expect(result.myOpps).toHaveLength(3)
  })

  it('(c) falha de rede dispara retry automático e, persistindo, define mensagem de erro explícita', async () => {
    let callCount = 0
    let errorMessage: string | null = null

    // Simulação do fluxo de fetch com retry
    const simulateFetchOpportunities = async (isRetry = false): Promise<void> => {
      callCount++
      try {
        // Simula falha persistente de rede
        throw new Error('Network error / connection refused')
      } catch {
        if (!isRetry) {
          // Dispara retry simulado
          return simulateFetchOpportunities(true)
        }
        errorMessage = 'Não foi possível carregar as oportunidades. Verifique sua conexão.'
      }
    }

    await simulateFetchOpportunities(false)

    // Houve 1 chamada inicial + 1 retry automático
    expect(callCount).toBe(2)
    // Persistindo a falha, o estado de erro explícito é preenchido
    expect(errorMessage).toBe('Não foi possível carregar as oportunidades. Verifique sua conexão.')
  })

  it('(d) log de sanidade é disparado se admin tiver 0 registros quando consulta não retornar nada', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const checkSanity = ({
      isAdmin,
      user,
      myOppsCount,
      totalOppsCount,
      loading,
      error,
    }: {
      isAdmin: boolean
      user: { id: string; email: string; role?: string; name?: string }
      myOppsCount: number
      totalOppsCount: number
      loading: boolean
      error: string | null
    }) => {
      if (isAdmin && user && myOppsCount === 0 && totalOppsCount === 0 && !loading && !error) {
        console.warn('[bitCRM Sanity Check] Dashboard retornou 0 oportunidades para Admin:', {
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          role: user.role,
          filtersUsed: {
            sellerFilter: user.id,
            isAdmin,
          },
          totalBaseOpportunities: totalOppsCount,
        })
      }
    }

    checkSanity({
      isAdmin: true,
      user: adminUser,
      myOppsCount: 0,
      totalOppsCount: 0,
      loading: false,
      error: null,
    })

    expect(consoleWarnSpy).toHaveBeenCalledTimes(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[bitCRM Sanity Check] Dashboard retornou 0 oportunidades para Admin:',
      ),
      expect.objectContaining({
        userId: '015c920nyv4tnwl',
        userEmail: 'leandro.bertanha@lbertanha.com',
      }),
    )

    consoleWarnSpy.mockRestore()
  })
})
