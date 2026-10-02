import { describe, it, expect } from 'vitest'
import {
  normalizeSearchTerm,
  filterOpportunities,
} from '../components/approach/OpportunitySelectorSection'
import type { Opportunity } from '../types/crm'

describe('Filtro de Oportunidades na Abordagem (OpportunitySelectorSection)', () => {
  const mockOpportunities: Opportunity[] = [
    {
      id: 'opp-1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      created: '2026-03-01T10:00:00.000Z',
      updated: '2026-03-01T10:00:00.000Z',
      company: 'Mendes Estética Automotiva',
      stage: 'Qualificado',
      source: 'Prospecção',
      value: 500,
      contact_name: 'Carlos Mendes',
      contact_phone: '(11) 98765-4321',
      city: 'Carapicuíba',
      seller: 'user-1',
      expand: {
        seller: {
          id: 'user-1',
          name: 'Leandro Vendedor',
          email: 'leandro@bitconsulting.com.br',
        },
      },
    },
    {
      id: 'opp-2',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      created: '2026-03-02T10:00:00.000Z',
      updated: '2026-03-02T10:00:00.000Z',
      company: 'Salão Balbina Fernandes',
      stage: 'Novo',
      source: 'Prospecção',
      value: 500,
      contact_name: 'Balbina',
      contact_phone: '(11) 95161-7948',
      city: 'Osasco',
      seller: 'user-2',
      expand: {
        seller: {
          id: 'user-2',
          name: 'Mariana Consultora',
          email: 'mariana@bitconsulting.com.br',
        },
      },
    },
    {
      id: 'opp-3',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      created: '2026-03-03T10:00:00.000Z',
      updated: '2026-03-03T10:00:00.000Z',
      company: "D' Marco Hair & Estética",
      stage: 'Proposta',
      source: 'Indicação',
      value: 500,
      contact_name: 'Marcos Vinicius',
      contact_phone: '(11) 98274-5602',
      city: 'São Paulo',
      seller: 'user-1',
      expand: {
        seller: {
          id: 'user-1',
          name: 'Leandro Vendedor',
          email: 'leandro@bitconsulting.com.br',
        },
      },
    },
    {
      id: 'opp-4',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      created: '2026-03-04T10:00:00.000Z',
      updated: '2026-03-04T10:00:00.000Z',
      company: 'Clínica Odonto & Saúde',
      stage: 'Agendado',
      source: 'WhatsApp',
      value: 1200,
      contact_name: 'Dra. Camila Ribeiro',
      contact_phone: '(21) 99887-1122',
      city: 'Niterói',
    },
  ]

  describe('normalizeSearchTerm', () => {
    it('deve remover acentos e converter para minúsculas', () => {
      expect(normalizeSearchTerm('Estética')).toBe('estetica')
      expect(normalizeSearchTerm('São Paulo')).toBe('sao paulo')
      expect(normalizeSearchTerm('Niterói')).toBe('niteroi')
      expect(normalizeSearchTerm('SALÃO & CABELEIREIROS')).toBe('salao & cabeleireiros')
    })

    it('deve lidar com valores nulos ou vazios', () => {
      expect(normalizeSearchTerm(null)).toBe('')
      expect(normalizeSearchTerm(undefined)).toBe('')
      expect(normalizeSearchTerm('')).toBe('')
      expect(normalizeSearchTerm('   ')).toBe('')
    })
  })

  describe('filterOpportunities', () => {
    it('deve retornar todas as oportunidades quando a busca estiver vazia', () => {
      const results = filterOpportunities(mockOpportunities, '')
      expect(results.length).toBe(mockOpportunities.length)
    })

    it('deve filtrar por nome da empresa sem diferenciar maiúsculas/minúsculas nem acentos', () => {
      const results1 = filterOpportunities(mockOpportunities, 'estetica')
      expect(results1.map((o) => o.id)).toContain('opp-1')
      expect(results1.map((o) => o.id)).toContain('opp-3')

      const results2 = filterOpportunities(mockOpportunities, 'BALBINA')
      expect(results2.length).toBe(1)
      expect(results2[0].id).toBe('opp-2')

      const results3 = filterOpportunities(mockOpportunities, 'clinica')
      expect(results3.length).toBe(1)
      expect(results3[0].id).toBe('opp-4')
    })

    it('deve filtrar por nome do contato', () => {
      const results = filterOpportunities(mockOpportunities, 'carlos')
      expect(results.length).toBe(1)
      expect(results[0].company).toBe('Mendes Estética Automotiva')

      const resultsCamila = filterOpportunities(mockOpportunities, 'camila')
      expect(resultsCamila.length).toBe(1)
      expect(resultsCamila[0].id).toBe('opp-4')
    })

    it('deve filtrar por cidade', () => {
      const resultsCarapicuiba = filterOpportunities(mockOpportunities, 'carapicuiba')
      expect(resultsCarapicuiba.length).toBe(1)
      expect(resultsCarapicuiba[0].id).toBe('opp-1')

      const resultsNiteroi = filterOpportunities(mockOpportunities, 'niteroi')
      expect(resultsNiteroi.length).toBe(1)
      expect(resultsNiteroi[0].id).toBe('opp-4')

      const resultsSP = filterOpportunities(mockOpportunities, 'sao paulo')
      expect(resultsSP.length).toBe(1)
      expect(resultsSP[0].id).toBe('opp-3')
    })

    it('deve filtrar por vendedor responsável (expand.seller)', () => {
      const resultsLeandro = filterOpportunities(mockOpportunities, 'leandro')
      expect(resultsLeandro.length).toBe(2)
      expect(resultsLeandro.map((o) => o.id)).toEqual(['opp-1', 'opp-3'])

      const resultsMariana = filterOpportunities(mockOpportunities, 'mariana')
      expect(resultsMariana.length).toBe(1)
      expect(resultsMariana[0].id).toBe('opp-2')
    })

    it('deve permitir busca por dígitos de telefone', () => {
      const results = filterOpportunities(mockOpportunities, '98765')
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('opp-1')

      const resultsDdd = filterOpportunities(mockOpportunities, '95161-7948')
      expect(resultsDdd.length).toBe(1)
      expect(resultsDdd[0].id).toBe('opp-2')
    })

    it('deve retornar lista vazia se nenhum termo coincidir', () => {
      const results = filterOpportunities(mockOpportunities, 'termo-inexistente-xyz')
      expect(results.length).toBe(0)
    })
  })
})
