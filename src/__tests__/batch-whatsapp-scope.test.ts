import { describe, it, expect } from 'vitest'
import type { Opportunity } from '@/types/crm'

describe('Batch WhatsApp Column Scope and Filtering', () => {
  const mockOpportunities: Opportunity[] = [
    {
      id: 'opp_novo_seller1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Mercado A',
      stage: 'Novo',
      source: 'Formulário Público',
      value: 1000,
      seller: 'seller_1',
      contact_name: 'Ana',
      contact_phone: '11999991111',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    },
    {
      id: 'opp_novo_seller2',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Mercado B',
      stage: 'Novo',
      source: 'Site',
      value: 1500,
      seller: 'seller_2',
      contact_name: 'Bruno',
      contact_phone: '11999992222',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    },
    {
      id: 'opp_qual_seller1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Farmácia C',
      stage: 'Qualificado',
      source: 'Indicação',
      value: 3000,
      seller: 'seller_1',
      contact_name: 'Carlos',
      contact_phone: '11999993333',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    },
    {
      id: 'opp_qual_sem_telefone',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Farmácia D',
      stage: 'Qualificado',
      source: 'Indicação',
      value: 2000,
      seller: 'seller_1',
      contact_name: 'Daniela',
      contact_phone: '',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    },
    {
      id: 'opp_agendado_seller1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Consultoria E',
      stage: 'Agendado',
      source: 'Indicação',
      value: 5000,
      seller: 'seller_1',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    },
  ]

  // Função pura que reproduz a lógica de escopo de oportunidades para a coluna e usuário
  function getBatchColumnOpportunities(
    opps: Opportunity[],
    stage: 'Novo' | 'Qualificado',
    currentUser: { id: string; isAdmin: boolean },
    sellerFilter: string = 'all',
  ): Opportunity[] {
    return opps.filter((opp) => {
      if (opp.stage !== stage) return false
      if (!currentUser.isAdmin) {
        return !opp.seller || opp.seller === currentUser.id
      } else if (sellerFilter !== 'all') {
        return opp.seller === sellerFilter
      } else {
        // Admin sem filtro específico: escopo da sua própria carteira
        return !opp.seller || opp.seller === currentUser.id
      }
    })
  }

  it('vendedor comum vê apenas suas próprias oportunidades na coluna Novo', () => {
    const list = getBatchColumnOpportunities(mockOpportunities, 'Novo', {
      id: 'seller_1',
      isAdmin: false,
    })

    expect(list.length).toBe(1)
    expect(list[0].id).toBe('opp_novo_seller1')
    expect(list[0].company).toBe('Mercado A')
  })

  it('admin sem filtro de vendedor específico opera na sua própria carteira', () => {
    const list = getBatchColumnOpportunities(mockOpportunities, 'Novo', {
      id: 'seller_2',
      isAdmin: true,
    })

    expect(list.length).toBe(1)
    expect(list[0].id).toBe('opp_novo_seller2')
  })

  it('admin com filtro de vendedor selecionado opera na carteira do vendedor escolhido', () => {
    const list = getBatchColumnOpportunities(
      mockOpportunities,
      'Novo',
      { id: 'admin_id', isAdmin: true },
      'seller_1',
    )

    expect(list.length).toBe(1)
    expect(list[0].id).toBe('opp_novo_seller1')
  })

  it('filtra corretamente oportunidades na coluna Qualificado incluindo detecção de sem telefone', () => {
    const list = getBatchColumnOpportunities(mockOpportunities, 'Qualificado', {
      id: 'seller_1',
      isAdmin: false,
    })

    expect(list.length).toBe(2)
    const comTelefone = list.filter((o) => Boolean(o.contact_phone && o.contact_phone.trim()))
    const semTelefone = list.filter((o) => !o.contact_phone || !o.contact_phone.trim())

    expect(comTelefone.length).toBe(1)
    expect(comTelefone[0].company).toBe('Farmácia C')
    expect(semTelefone.length).toBe(1)
    expect(semTelefone[0].company).toBe('Farmácia D')
  })
})
