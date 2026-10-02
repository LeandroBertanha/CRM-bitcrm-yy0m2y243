import { describe, it, expect } from 'vitest'
import { formatBRL, formatCompactBRL, STAGES, STAGE_CONFIG } from '@/types/crm'

describe('Formatação de Moeda no Cabeçalho do Kanban', () => {
  it('formata valores zero ou vazios corretamente', () => {
    expect(formatCompactBRL(0)).toBe('R$ 0')
    expect(formatCompactBRL(null)).toBe('R$ 0')
    expect(formatCompactBRL(undefined)).toBe('R$ 0')
    expect(formatBRL(0)).toBe('R$ 0,00')
  })

  it('formata valores abaixo de 1.000 sem estourar', () => {
    expect(formatCompactBRL(500)).toBe('R$ 500')
    expect(formatCompactBRL(950)).toBe('R$ 950')
    expect(formatCompactBRL(50.5)).toBe('R$ 50,50')
  })

  it('formata valores de milhar de forma compacta (mil)', () => {
    // 1500 -> R$ 1,5 mil (conforme solicitado na descrição da tarefa)
    expect(formatCompactBRL(1500)).toBe('R$ 1,5 mil')
    expect(formatCompactBRL(1000)).toBe('R$ 1 mil')
    expect(formatCompactBRL(45000)).toBe('R$ 45 mil')
    expect(formatCompactBRL(250000)).toBe('R$ 250 mil')
  })

  it('formata valores de milhões de forma compacta (mi)', () => {
    // Ex: 1.250.000,00 citado na tarefa
    expect(formatCompactBRL(1250000)).toBe('R$ 1,25 mi')
    expect(formatCompactBRL(1000000)).toBe('R$ 1 mi')
    expect(formatCompactBRL(12000000)).toBe('R$ 12 mi')
  })

  it('formata valores de bilhões de forma compacta (bi)', () => {
    expect(formatCompactBRL(1000000000)).toBe('R$ 1 bi')
    expect(formatCompactBRL(2500000000)).toBe('R$ 2,5 bi')
  })

  it('garante que todos os 6 estágios do kanban possuem configuração e rótulos válidos', () => {
    expect(STAGES).toEqual(['Novo', 'Qualificado', 'Agendado', 'Proposta', 'Ganho', 'Perdido'])
    STAGES.forEach((stage) => {
      const config = STAGE_CONFIG[stage]
      expect(config).toBeDefined()
      expect(config.label).toBe(stage)
      expect(config.color).toBeTruthy()
      expect(config.dot).toBeTruthy()
      expect(config.bg).toBeTruthy()
    })
  })
})
