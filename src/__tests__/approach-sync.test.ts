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
})
