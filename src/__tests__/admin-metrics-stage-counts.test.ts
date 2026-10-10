import { describe, it, expect } from 'vitest'
import { STAGE_BADGE_CONFIG } from '@/pages/AdminMetrics'
import type { SellerStat, SellerStatStageCounts } from '@/pages/AdminMetrics'
import type { Opportunity } from '@/types/crm'

describe('Métricas de Vendedores e Contagem por Estágio (Tarefa 1)', () => {
  const activeSellers = [
    { id: 'seller-1', name: 'Leandro Bertanha', email: 'leandro@empresa.com' },
    { id: 'seller-2', name: 'Vendedora Ativa', email: 'ativa@empresa.com' },
  ]

  const mockOpportunities: Partial<Opportunity>[] = [
    // seller-1: 1 Novo, 2 Qualificados, 1 Agendado, 1 Proposta, 2 Ganhos, 1 Perdido
    { id: 'opp-1', stage: 'Novo', value: 1000, seller: 'seller-1' },
    { id: 'opp-2', stage: 'Qualificado', value: 2000, seller: 'seller-1' },
    { id: 'opp-3', stage: 'Qualificado', value: 3000, seller: 'seller-1' },
    { id: 'opp-4', stage: 'Agendado', value: 4000, seller: 'seller-1' },
    { id: 'opp-5', stage: 'Proposta', value: 5000, seller: 'seller-1' },
    { id: 'opp-6', stage: 'Ganho', value: 6000, seller: 'seller-1' },
    { id: 'opp-7', stage: 'Ganho', value: 7000, seller: 'seller-1' },
    { id: 'opp-8', stage: 'Perdido', value: 1500, seller: 'seller-1' },

    // seller-2: 0 Novo, 0 Qualificado, 1 Agendado, 0 Proposta, 1 Ganho, 0 Perdido
    { id: 'opp-9', stage: 'Agendado', value: 500, seller: 'seller-2' },
    { id: 'opp-10', stage: 'Ganho', value: 800, seller: 'seller-2' },

    // Vendedor inativo (seller-inactive): histórico preservado nas oportunidades
    {
      id: 'opp-11',
      stage: 'Ganho',
      value: 10000,
      seller: 'seller-inactive',
      expand: {
        seller: { id: 'seller-inactive', name: 'Ex Colaborador', email: 'ex@empresa.com' },
      } as any,
    },
    { id: 'opp-12', stage: 'Novo', value: 5000, seller: 'seller-inactive' },
  ]

  it('calcula corretamente stageCounts para cada vendedor ativo', () => {
    const activeSellerIds = new Set(activeSellers.map((s) => s.id))
    const sellerMap = new Map<string, SellerStat>()

    const createEmptyStageCounts = (): SellerStatStageCounts => ({
      Novo: 0,
      Qualificado: 0,
      Agendado: 0,
      Proposta: 0,
      Ganho: 0,
      Perdido: 0,
    })

    activeSellers.forEach((s) => {
      sellerMap.set(s.id, {
        id: s.id,
        name: s.name,
        email: s.email,
        totalOpps: 0,
        inProgressCount: 0,
        wonCount: 0,
        lostCount: 0,
        totalPipelineValue: 0,
        wonValue: 0,
        lostValue: 0,
        conversionRate: 0,
        stageCounts: createEmptyStageCounts(),
      })
    })

    mockOpportunities.forEach((opp) => {
      const sellerId = opp.seller || opp.expand?.seller?.id
      // Oportunidades de inativos não criam linha
      if (!sellerId || !activeSellerIds.has(sellerId)) return

      const stat = sellerMap.get(sellerId)
      if (!stat) return

      stat.totalOpps += 1
      const val = Number(opp.value) || 0

      if (opp.stage && opp.stage in stat.stageCounts) {
        stat.stageCounts[opp.stage as keyof SellerStatStageCounts] += 1
      }

      if (opp.stage === 'Ganho') {
        stat.wonCount += 1
        stat.wonValue += val
      } else if (opp.stage === 'Perdido') {
        stat.lostCount += 1
        stat.lostValue += val
      } else {
        stat.inProgressCount += 1
        stat.totalPipelineValue += val
      }
    })

    const s1 = sellerMap.get('seller-1')!
    expect(s1.stageCounts).toEqual({
      Novo: 1,
      Qualificado: 2,
      Agendado: 1,
      Proposta: 1,
      Ganho: 2,
      Perdido: 1,
    })
    expect(s1.totalOpps).toBe(8)
    expect(s1.wonCount).toBe(2)
    expect(s1.lostCount).toBe(1)
    expect(s1.inProgressCount).toBe(5) // 1 Novo + 2 Qualificados + 1 Agendado + 1 Proposta

    const s2 = sellerMap.get('seller-2')!
    expect(s2.stageCounts).toEqual({
      Novo: 0,
      Qualificado: 0,
      Agendado: 1,
      Proposta: 0,
      Ganho: 1,
      Perdido: 0,
    })
    expect(s2.totalOpps).toBe(2)

    // Inativo não deve estar nas linhas de vendedores
    expect(sellerMap.has('seller-inactive')).toBe(false)
  })

  it('possui a configuração de cores oficiais para todos os estágios', () => {
    const stages: (keyof SellerStatStageCounts)[] = [
      'Novo',
      'Qualificado',
      'Agendado',
      'Proposta',
      'Ganho',
      'Perdido',
    ]

    stages.forEach((stg) => {
      const cfg = STAGE_BADGE_CONFIG[stg]
      expect(cfg).toBeDefined()
      expect(cfg.label).toBe(stg)
    })

    expect(STAGE_BADGE_CONFIG.Novo.textClass).toContain('sky')
    expect(STAGE_BADGE_CONFIG.Qualificado.textClass).toContain('indigo')
    expect(STAGE_BADGE_CONFIG.Agendado.textClass).toContain('amber')
    expect(STAGE_BADGE_CONFIG.Proposta.textClass).toContain('purple')
    expect(STAGE_BADGE_CONFIG.Ganho.textClass).toContain('emerald')
    expect(STAGE_BADGE_CONFIG.Perdido.textClass).toContain('rose')
  })
})
