import { describe, it, expect } from 'vitest'
import { formatBRL } from '@/types/crm'
import type { Opportunity } from '@/types/crm'

describe('Regras de Métricas do Administrador e Pipe Aberto', () => {
  const mockOpportunities: Partial<Opportunity>[] = [
    {
      id: 'opp-1',
      company: 'Lead Novo 1',
      stage: 'Novo',
      value: 10000,
      seller: 'seller-1',
    },
    {
      id: 'opp-2',
      company: 'Lead Qualificado',
      stage: 'Qualificado',
      value: 20000,
      seller: 'seller-1',
    },
    {
      id: 'opp-3',
      company: 'Lead Agendado',
      stage: 'Agendado',
      value: 30000,
      seller: 'seller-2',
    },
    {
      id: 'opp-4',
      company: 'Lead Proposta',
      stage: 'Proposta',
      value: 40000,
      seller: 'seller-2',
    },
    {
      id: 'opp-5',
      company: 'Lead Ganho',
      stage: 'Ganho',
      value: 50000,
      seller: 'seller-1',
    },
    {
      id: 'opp-6',
      company: 'Lead Perdido 1',
      stage: 'Perdido',
      value: 15000,
      seller: 'seller-1',
    },
    {
      id: 'opp-7',
      company: 'Lead Perdido 2',
      stage: 'Perdido',
      value: 25000,
      seller: 'seller-2',
    },
  ]

  it('Pipe Aberto NÃO deve somar oportunidades no estágio Perdido nem Ganho', () => {
    // Estágios abertos: Novo, Qualificado, Agendado, Proposta
    const inProgressOpps = mockOpportunities.filter(
      (opp) =>
        opp.stage === 'Novo' ||
        opp.stage === 'Qualificado' ||
        opp.stage === 'Agendado' ||
        opp.stage === 'Proposta',
    )

    const totalPipelineValue = inProgressOpps.reduce((acc, curr) => {
      const v = typeof curr.value === 'number' ? curr.value : parseFloat(String(curr.value || 0))
      return acc + (isNaN(v) ? 0 : v)
    }, 0)

    // 10000 + 20000 + 30000 + 40000 = 100000
    // Oportunidades Ganho (50000) e Perdido (15000 + 25000 = 40000) NÃO entram no Pipe Aberto!
    expect(inProgressOpps).toHaveLength(4)
    expect(totalPipelineValue).toBe(100000)
    expect(formatBRL(totalPipelineValue)).toBe('R$ 100.000,00')
  })

  it('Calcula corretamente o indicador global de Valor Perdido', () => {
    const lostOpps = mockOpportunities.filter((opp) => opp.stage === 'Perdido')
    const totalLostValue = lostOpps.reduce((acc, curr) => {
      const v = typeof curr.value === 'number' ? curr.value : parseFloat(String(curr.value || 0))
      return acc + (isNaN(v) ? 0 : v)
    }, 0)

    // 15000 + 25000 = 40000
    expect(lostOpps).toHaveLength(2)
    expect(totalLostValue).toBe(40000)
    expect(formatBRL(totalLostValue)).toBe('R$ 40.000,00')
  })

  it('Calcula contagem e valor perdido por vendedor na tabela de desempenho', () => {
    const sellers = [
      { id: 'seller-1', name: 'Carlos' },
      { id: 'seller-2', name: 'Mariana' },
    ]

    const stats = sellers.map((s) => {
      const opps = mockOpportunities.filter((o) => o.seller === s.id)
      const lost = opps.filter((o) => o.stage === 'Perdido')
      const lostCount = lost.length
      const lostValue = lost.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
      const won = opps.filter((o) => o.stage === 'Ganho')
      const wonCount = won.length
      const wonValue = won.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
      const inProgress = opps.filter(
        (o) =>
          o.stage === 'Novo' ||
          o.stage === 'Qualificado' ||
          o.stage === 'Agendado' ||
          o.stage === 'Proposta',
      )
      const pipelineValue = inProgress.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)

      return {
        id: s.id,
        name: s.name,
        lostCount,
        lostValue,
        wonCount,
        wonValue,
        pipelineValue,
      }
    })

    const seller1 = stats.find((s) => s.id === 'seller-1')!
    expect(seller1.lostCount).toBe(1)
    expect(seller1.lostValue).toBe(15000)
    expect(seller1.pipelineValue).toBe(30000) // 10000 + 20000
    expect(seller1.wonValue).toBe(50000)

    const seller2 = stats.find((s) => s.id === 'seller-2')!
    expect(seller2.lostCount).toBe(1)
    expect(seller2.lostValue).toBe(25000)
    expect(seller2.pipelineValue).toBe(70000) // 30000 + 40000
    expect(seller2.wonValue).toBe(0)
  })
})
