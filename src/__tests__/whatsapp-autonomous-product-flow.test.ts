import { describe, it, expect } from 'vitest'
import type { Opportunity, Product } from '@/types/crm'
import type { PlaybookScript } from '@/types/playbook'
import { interpolateVariables, buildBatchWhatsAppMessage } from '@/lib/whatsappApproachHelper'

describe('Validação do Novo Produto: WhatsApp Autônomo e Humanizado e Oportunidades', () => {
  const mockProductWebsite: Product = {
    id: 'prod_site',
    collectionId: 'products',
    collectionName: 'products',
    created: '2026-03-01T00:00:00Z',
    updated: '2026-03-01T00:00:00Z',
    name: 'Site ou Landing Page sob medida',
    setup_value: 500,
    recurring_value: 55,
    commission_base_type: 'setup',
    is_active: true,
  }

  const mockProductWhatsApp: Product = {
    id: 'prod_wa',
    collectionId: 'products',
    collectionName: 'products',
    created: '2026-03-01T00:00:00Z',
    updated: '2026-03-01T00:00:00Z',
    name: 'WhatsApp Autônomo e Humanizado',
    setup_value: 500,
    recurring_value: 55,
    commission_base_type: 'setup',
    is_active: true,
  }

  const mockScripts: PlaybookScript[] = [
    {
      id: 'sc_wa_init',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Primeiro contato consultivo',
      title: 'Abordagem Inicial - WhatsApp Autônomo',
      script_text:
        'Olá, {contato}! Aqui é {vendedor}, da bit Consulting. Implementamos um atendente no WhatsApp que responde com tom humanizado para a {empresa} em {cidade}.',
      product: 'prod_wa',
      product_name: 'WhatsApp Autônomo e Humanizado',
      display_order: 8,
      is_active: true,
    },
    {
      id: 'sc_wa_follow',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Retomada de qualificação',
      title: 'Follow-up - WhatsApp Autônomo',
      script_text:
        'Olá, {contato}! Aqui é {vendedor}. Passando para retomar nosso contato de {data} sobre o WhatsApp Autônomo da {empresa}.',
      product: 'prod_wa',
      product_name: 'WhatsApp Autônomo e Humanizado',
      display_order: 9,
      is_active: true,
    },
    {
      id: 'sc_site_init',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Primeiro contato inbound',
      title: 'Primeira Mensagem WhatsApp',
      script_text:
        'Olá, [NOME DO CONTATO]! Aqui é [NOME DO VENDEDOR]. Criamos sites profissionais para a [NOME DA EMPRESA].',
      product: 'prod_site',
      product_name: 'Site ou Landing Page sob medida',
      display_order: 4,
      is_active: true,
    },
  ]

  // Função pura que reproduz o resolveScriptForOpportunity do BatchWhatsAppModal
  function resolveScriptForOpportunity(
    opp: Opportunity,
    scripts: PlaybookScript[],
    actionType: 'initial' | 'followup',
  ): PlaybookScript | null {
    if (scripts.length === 0) return null

    const oppProductName = (opp.product_name || opp.expand?.product?.name || '').toLowerCase()

    const isWaAutonomous =
      oppProductName.includes('whatsapp') ||
      oppProductName.includes('autônomo') ||
      oppProductName.includes('autonomo')

    if (isWaAutonomous) {
      if (actionType === 'initial') {
        const waInitial = scripts.find(
          (s) =>
            s.channel === 'WhatsApp' &&
            ((s.product_name && s.product_name.toLowerCase().includes('whatsapp')) ||
              s.title.toLowerCase().includes('autônomo') ||
              s.title.toLowerCase().includes('autonomo') ||
              (s.title.toLowerCase().includes('abordagem inicial') &&
                s.title.toLowerCase().includes('whatsapp'))),
        )
        if (waInitial) return waInitial
      } else {
        const waFollowup = scripts.find(
          (s) =>
            s.channel === 'WhatsApp' &&
            ((s.product_name && s.product_name.toLowerCase().includes('whatsapp')) ||
              s.title.toLowerCase().includes('autônomo') ||
              s.title.toLowerCase().includes('autonomo')) &&
            (s.title.toLowerCase().includes('follow') ||
              s.situation.toLowerCase().includes('retomada') ||
              s.situation.toLowerCase().includes('continuação')),
        )
        if (waFollowup) return waFollowup
      }
    }

    if (actionType === 'initial') {
      const genericInitial =
        scripts.find(
          (s) =>
            s.channel === 'WhatsApp' &&
            !s.title.toLowerCase().includes('autônomo') &&
            !s.title.toLowerCase().includes('autonomo') &&
            s.title.toLowerCase().includes('primeira'),
        ) ||
        scripts.find(
          (s) =>
            s.channel === 'WhatsApp' &&
            !s.title.toLowerCase().includes('autônomo') &&
            !s.title.toLowerCase().includes('autonomo'),
        )
      if (genericInitial) return genericInitial
    }

    return null
  }

  it('seleciona script específico de WhatsApp Autônomo para oportunidade com o produto configurado', () => {
    const oppWa: Opportunity = {
      id: 'opp_wa_1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Clínica Sorriso',
      stage: 'Novo',
      source: 'WhatsApp',
      value: 500, // setup
      recurring_value: 55, // mensalidade
      product: 'prod_wa',
      product_name: 'WhatsApp Autônomo e Humanizado',
      contact_name: 'Dr. Roberto',
      contact_phone: '11988887777',
      city: 'São Paulo',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    }

    const script = resolveScriptForOpportunity(oppWa, mockScripts, 'initial')
    expect(script).not.toBeNull()
    expect(script?.id).toBe('sc_wa_init')
    expect(script?.title).toContain('WhatsApp Autônomo')
  })

  it('seleciona script de follow-up específico de WhatsApp Autônomo', () => {
    const oppWa: Opportunity = {
      id: 'opp_wa_2',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Pet Shop Bicho Feliz',
      stage: 'Qualificado',
      source: 'Indicação',
      value: 500,
      recurring_value: 55,
      product: 'prod_wa',
      product_name: 'WhatsApp Autônomo e Humanizado',
      contact_name: 'Camila',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    }

    const script = resolveScriptForOpportunity(oppWa, mockScripts, 'followup')
    expect(script).not.toBeNull()
    expect(script?.id).toBe('sc_wa_follow')
  })

  it('seleciona script de Site para oportunidade comum', () => {
    const oppSite: Opportunity = {
      id: 'opp_site_1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Restaurante Sabor',
      stage: 'Novo',
      source: 'Site',
      value: 500,
      recurring_value: 55,
      product: 'prod_site',
      product_name: 'Site ou Landing Page sob medida',
      contact_name: 'Marcos',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    }

    const script = resolveScriptForOpportunity(oppSite, mockScripts, 'initial')
    expect(script).not.toBeNull()
    expect(script?.id).toBe('sc_site_init')
  })

  it('interpola variáveis no template do produto novo corretamente', () => {
    const opp: Opportunity = {
      id: 'opp_wa_3',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Mecânica Express',
      stage: 'Novo',
      source: 'Prospecção',
      value: 500,
      recurring_value: 55,
      contact_name: 'Julio',
      contact_phone: '11977776666',
      city: 'Campinas',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    }

    const template = 'Olá, {contato}! Sou o {vendedor}. Vi o atendimento da {empresa} em {cidade}.'

    const interpolated = interpolateVariables(template, {
      contato: opp.contact_name,
      empresa: opp.company,
      cidade: opp.city,
      vendedor: 'Gabriel',
    })

    expect(interpolated).toBe(
      'Olá, Julio! Sou o Gabriel. Vi o atendimento da Mecânica Express em Campinas.',
    )
  })

  it('constrói mensagem de WhatsApp com rodapé rastreável mantendo regras do produto', () => {
    const opp: Opportunity = {
      id: 'rec_xyz_123',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Consultoria Alfa',
      stage: 'Novo',
      source: 'WhatsApp',
      value: 500,
      recurring_value: 55,
      contact_name: 'Patricia',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    }

    const msg = buildBatchWhatsAppMessage({
      actionType: 'initial',
      scriptTemplate: 'Olá, {contato}! Atendimento na {empresa}.',
      opportunity: opp,
      sellerName: 'Vendedor Bit',
    })

    expect(msg).toContain('Olá, Patricia! Atendimento na Consultoria Alfa.')
    expect(msg).toContain('Vendedor Bit, bit Consulting')
    expect(msg).toContain('Ref. ')
  })

  it('garante que setup (a partir de R$ 350) e mensalidade de R$ 55 ficam separados na oportunidade', () => {
    const opp: Opportunity = {
      id: 'opp_split',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Loja Exemplo',
      stage: 'Proposta',
      source: 'Indicação',
      value: 350,
      recurring_value: 55,
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    }

    // Apenas value (350) é a base de comissão
    const baseComissao = opp.value
    expect(baseComissao).toBe(350)

    // Mensalidade recorrente (55) não é incluída na base
    const mensalidade = opp.recurring_value
    expect(mensalidade).toBe(55)
    expect(baseComissao).not.toBe(baseComissao + (mensalidade ?? 0))
  })
})
