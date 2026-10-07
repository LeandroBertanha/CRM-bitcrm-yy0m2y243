import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  mapApproachStatusToOpportunityStage,
  syncApproachSessionWithOpportunity,
} from '../services/approach-sync'
import type { ApproachStatus } from '../types/playbook'

describe('Sincronização de Abordagem com Oportunidades (approach-sync)', () => {
  it('deve mapear corretamente "Sem interesse" e "Perdido" para "Perdido"', () => {
    expect(mapApproachStatusToOpportunityStage('Perdido')).toBe('Perdido')
    expect(mapApproachStatusToOpportunityStage('Sem interesse')).toBe('Perdido')
  })

  it('deve mapear "Fechado" para "Ganho"', () => {
    expect(mapApproachStatusToOpportunityStage('Fechado')).toBe('Ganho')
  })

  it('deve mapear status de proposta para o estágio "Proposta"', () => {
    expect(mapApproachStatusToOpportunityStage('Proposta solicitada')).toBe('Proposta')
    expect(mapApproachStatusToOpportunityStage('Proposta enviada')).toBe('Proposta')
    expect(mapApproachStatusToOpportunityStage('Negociação')).toBe('Proposta')
  })

  it('deve mapear reuniões e retornos para o estágio "Agendado"', () => {
    expect(mapApproachStatusToOpportunityStage('Reunião agendada')).toBe('Agendado')
    expect(mapApproachStatusToOpportunityStage('Retorno agendado')).toBe('Agendado')
  })

  it('deve mapear diagnósticos e exemplos para o estágio "Qualificado"', () => {
    expect(mapApproachStatusToOpportunityStage('Diagnóstico realizado')).toBe('Qualificado')
    expect(mapApproachStatusToOpportunityStage('Interessado')).toBe('Qualificado')
    expect(mapApproachStatusToOpportunityStage('Exemplos enviados')).toBe('Qualificado')
  })

  it('deve retornar null para contatos em andamento sem desfecho estruturado', () => {
    expect(mapApproachStatusToOpportunityStage('Contato realizado')).toBeNull()
    expect(mapApproachStatusToOpportunityStage('Tentativa de contato')).toBeNull()
    expect(mapApproachStatusToOpportunityStage('Não abordado')).toBeNull()
  })

  it('deve retornar updated: false se não houver oportunidade informada', async () => {
    const res = await syncApproachSessionWithOpportunity({
      opportunityId: null,
      status: 'Perdido',
    })
    expect(res.updated).toBe(false)
  })

  it('deve priorizar manualStage sobre o mapeamento automático de status quando fornecido', async () => {
    const getOneMock = vi.fn().mockResolvedValue({
      id: 'opp-123',
      stage: 'Novo',
      return_at: null,
    })
    const updateMock = vi.fn().mockResolvedValue({
      id: 'opp-123',
      stage: 'Ganho',
    })
    const createNoteMock = vi.fn().mockResolvedValue({ id: 'note-1' })

    const { default: pb } = await import('../lib/pocketbase/client')
    const originalCollection = pb.collection
    pb.collection = vi.fn((colName: string) => {
      if (colName === 'opportunities') {
        return {
          getOne: getOneMock,
          update: updateMock,
        } as any
      }
      if (colName === 'opportunity_notes') {
        return {
          create: createNoteMock,
        } as any
      }
      return originalCollection.call(pb, colName)
    }) as any

    try {
      const res = await syncApproachSessionWithOpportunity({
        opportunityId: 'opp-123',
        status: 'Perdido', // Mapearia para 'Perdido' normalmente
        manualStage: 'Ganho', // Mas manualStage deve prevalecer
        authorId: 'user-abc',
      })

      expect(res.updated).toBe(true)
      expect(res.previousStage).toBe('Novo')
      expect(res.newStage).toBe('Ganho')
      expect(updateMock).toHaveBeenCalledWith('opp-123', { stage: 'Ganho' })
      expect(createNoteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp-123',
          author: 'user-abc',
          type: 'outro',
          text: 'Estágio alterado via Histórico de Abordagens: Novo → Ganho',
        }),
      )
    } finally {
      pb.collection = originalCollection
    }
  })

  it('deve usar o texto automático quando manualStage não for informado', async () => {
    const getOneMock = vi.fn().mockResolvedValue({
      id: 'opp-456',
      stage: 'Novo',
      return_at: null,
    })
    const updateMock = vi.fn().mockResolvedValue({
      id: 'opp-456',
      stage: 'Qualificado',
    })
    const createNoteMock = vi.fn().mockResolvedValue({ id: 'note-2' })

    const { default: pb } = await import('../lib/pocketbase/client')
    const originalCollection = pb.collection
    pb.collection = vi.fn((colName: string) => {
      if (colName === 'opportunities') {
        return {
          getOne: getOneMock,
          update: updateMock,
        } as any
      }
      if (colName === 'opportunity_notes') {
        return {
          create: createNoteMock,
        } as any
      }
      return originalCollection.call(pb, colName)
    }) as any

    try {
      const res = await syncApproachSessionWithOpportunity({
        opportunityId: 'opp-456',
        status: 'Diagnóstico realizado',
        authorId: 'user-abc',
      })

      expect(res.updated).toBe(true)
      expect(res.newStage).toBe('Qualificado')
      expect(createNoteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Estágio atualizado para Qualificado via Abordagem Comercial (Diagnóstico realizado)',
        }),
      )
    } finally {
      pb.collection = originalCollection
    }
  })
})
