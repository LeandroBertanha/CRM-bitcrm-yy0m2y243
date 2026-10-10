import { describe, it, expect } from 'vitest'
import { inferSegmentFromOpportunity } from '../pages/approach/ApproachFlow'

describe('inferSegmentFromOpportunity (ApproachFlow)', () => {
  it('deve priorizar segment já preenchido diretamente', () => {
    const result = inferSegmentFromOpportunity({
      segment: 'Clínica',
      company: 'Pizzaria do Zé',
    })
    expect(result).toBe('Clínica')
  })

  it('deve inferir "Restaurante" por palavras-chave gastronômicas (restaurante, pizzaria, hamburgueria, lanchonete, bar, churrascaria)', () => {
    expect(inferSegmentFromOpportunity({ company: 'Restaurante Sabor & Arte' })).toBe('Restaurante')
    expect(inferSegmentFromOpportunity({ company: 'Pizzaria Bella Napoli' })).toBe('Restaurante')
    expect(inferSegmentFromOpportunity({ company: 'Prime Hamburgueria Artesanal' })).toBe(
      'Restaurante',
    )
    expect(inferSegmentFromOpportunity({ company: 'Lanchonete Central' })).toBe('Restaurante')
    expect(inferSegmentFromOpportunity({ company: 'Bar & Choperia do Porto' })).toBe('Restaurante')
    expect(inferSegmentFromOpportunity({ company: 'Churrascaria Gaúcha' })).toBe('Restaurante')
    expect(
      inferSegmentFromOpportunity({
        company: 'Espaço Gourmet',
        message: 'Lead de restaurante italiano interessado em cardápio',
      }),
    ).toBe('Restaurante')
  })

  it('deve inferir "Estética Automotiva" por termos de polimento e detailing', () => {
    expect(inferSegmentFromOpportunity({ company: 'Mendes Estética Automotiva' })).toBe(
      'Estética Automotiva',
    )
    expect(inferSegmentFromOpportunity({ company: 'Studio Polimento Master' })).toBe(
      'Estética Automotiva',
    )
    expect(inferSegmentFromOpportunity({ company: 'Detailing Car Care' })).toBe(
      'Estética Automotiva',
    )
  })

  it('deve inferir "Lava-Rápido" por lava rápido e lava jato', () => {
    expect(inferSegmentFromOpportunity({ company: 'Lava Rápido Alemão' })).toBe('Lava-Rápido')
    expect(inferSegmentFromOpportunity({ company: 'Lava Jato 24h' })).toBe('Lava-Rápido')
  })

  it('deve inferir "Clínica" por termos de saúde e odontologia', () => {
    expect(inferSegmentFromOpportunity({ company: 'Clínica Sorriso Odonto' })).toBe('Clínica')
    expect(inferSegmentFromOpportunity({ company: 'Centro Médico Integrado' })).toBe('Clínica')
    expect(inferSegmentFromOpportunity({ company: 'Espaço Saúde & Bem Estar' })).toBe('Clínica')
  })

  it('deve inferir "Salão de Beleza" por termos de cabelo e beleza', () => {
    expect(inferSegmentFromOpportunity({ company: 'Salão Balbina Fernandes' })).toBe(
      'Salão de Beleza',
    )
    expect(inferSegmentFromOpportunity({ company: 'Studio Hair & Beauty' })).toBe('Salão de Beleza')
    expect(inferSegmentFromOpportunity({ company: 'Espaço Manicure & Unhas' })).toBe(
      'Salão de Beleza',
    )
  })

  it('deve inferir "Barbearia" por termos de barber', () => {
    expect(inferSegmentFromOpportunity({ company: 'Barbearia Vintage' })).toBe('Barbearia')
    expect(inferSegmentFromOpportunity({ company: 'Vip Barber Shop' })).toBe('Barbearia')
  })

  it('deve retornar string vazia para nomes sem padrão claro (para motor tratar como genérico)', () => {
    expect(inferSegmentFromOpportunity({ company: 'Tech Soluções de TI' })).toBe('')
    expect(inferSegmentFromOpportunity({ company: 'Consultoria Alpha' })).toBe('')
    expect(inferSegmentFromOpportunity({ company: '', message: '' })).toBe('')
    expect(inferSegmentFromOpportunity({})).toBe('')
  })
})
