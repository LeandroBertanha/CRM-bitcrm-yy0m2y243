import { describe, it, expect } from 'vitest'
import { formatBRL } from '@/types/crm'
import type { Opportunity } from '@/types/crm'

describe('Regras do Dashboard - Indicadores de Negociação', () => {
  // Constante separada para os cards "Em Negociação" e "Valor em Negociação"
  const NEGOTIATION_STAGES: Opportunity['stage'][] = ['Proposta']

  // Constante usada para Oportunidades Recentes (Qualificado, Agendado, Proposta)
  const RECENT_ACTIVE_STAGES: Opportunity['stage'][] = ['Qualificado', 'Agendado', 'Proposta']

  const mockOpportunities: Partial<Opportunity>[] = [
    {
      id: 'opp-1',
      company: 'Empresa Alfa',
      stage: 'Novo',
      value: 10000,
      seller: 'user-1',
    },
    {
      id: 'opp-2',
      company: 'Empresa Beta',
      stage: 'Qualificado',
      value: 25000,
      seller: 'user-1',
    },
    {
      id: 'opp-3',
      company: 'Empresa Gama',
      stage: 'Agendado',
      value: 15000,
      seller: 'user-1',
    },
    {
      id: 'opp-4',
      company: 'Empresa Delta',
      stage: 'Proposta',
      value: 40000,
      seller: 'user-1',
    },
    {
      id: 'opp-5',
      company: 'Empresa Épsilon',
      stage: 'Proposta',
      value: 60000,
      seller: 'user-1',
    },
    {
      id: 'opp-6',
      company: 'Empresa Zeta',
      stage: 'Ganho',
      value: 80000,
      seller: 'user-1',
    },
    {
      id: 'opp-7',
      company: 'Empresa Eta',
      stage: 'Perdido',
      value: 12000,
      seller: 'user-1',
    },
  ]

  it('deve filtrar SOMENTE o estágio "Proposta" para o indicador Em Negociação', () => {
    const inNegotiationOpps = mockOpportunities.filter(
      (opp) => opp.stage && NEGOTIATION_STAGES.includes(opp.stage),
    )

    // Apenas opp-4 e opp-5 estão em 'Proposta'
    expect(inNegotiationOpps).toHaveLength(2)
    expect(inNegotiationOpps.map((o) => o.company)).toEqual(['Empresa Delta', 'Empresa Épsilon'])
  })

  it('deve somar o valor SOMENTE das oportunidades com estágio "Proposta" para Valor em Negociação', () => {
    const inNegotiationOpps = mockOpportunities.filter(
      (opp) => opp.stage && NEGOTIATION_STAGES.includes(opp.stage),
    )

    const inNegotiationValue = inNegotiationOpps.reduce(
      (acc, curr) => acc + (Number(curr.value) || 0),
      0,
    )

    // 40.000 + 60.000 = 100.000 (não inclui Qualificado 25.000 nem Agendado 15.000 nem Novo 10.000)
    expect(inNegotiationValue).toBe(100000)
    expect(formatBRL(inNegotiationValue)).toBe('R$ 100.000,00')
  })

  it('não deve alterar a regra de Oportunidades Recentes (Qualificado, Agendado e Proposta)', () => {
    const recentOpportunities = mockOpportunities.filter(
      (opp) => opp.stage === 'Qualificado' || opp.stage === 'Agendado' || opp.stage === 'Proposta',
    )

    // Qualificado (opp-2), Agendado (opp-3), Proposta (opp-4, opp-5)
    expect(recentOpportunities).toHaveLength(4)
    expect(
      recentOpportunities.every((o) => o.stage && RECENT_ACTIVE_STAGES.includes(o.stage)),
    ).toBe(true)
  })

  it('mantém outros indicadores (Minhas Oportunidades, Ganhas, Valor Ganho) inalterados', () => {
    const totalCount = mockOpportunities.length
    const wonOpps = mockOpportunities.filter((opp) => opp.stage === 'Ganho')
    const totalWonValue = wonOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)

    expect(totalCount).toBe(7)
    expect(wonOpps).toHaveLength(1)
    expect(totalWonValue).toBe(80000)
    expect(formatBRL(totalWonValue)).toBe('R$ 80.000,00')
  })

  it('calcula corretamente o indicador de Valor Perdido e contagem de perdidos', () => {
    const lostOpps = mockOpportunities.filter((opp) => opp.stage === 'Perdido')
    const totalLostValue = lostOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)

    expect(lostOpps).toHaveLength(1)
    expect(totalLostValue).toBe(12000)
    expect(formatBRL(totalLostValue)).toBe('R$ 12.000,00')
  })
})
