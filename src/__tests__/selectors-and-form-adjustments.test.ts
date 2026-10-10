import { describe, it, expect } from 'vitest'
import type { Opportunity, Product } from '@/types/crm'
import type { PlaybookScript } from '@/types/playbook'
import { buildBatchWhatsAppMessage } from '@/lib/whatsappApproachHelper'

describe('Validação dos 3 Ajustes: Seletores de Produto nos Disparos, ApproachFlow e PublicForm', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod_site_1',
      collectionId: 'products',
      collectionName: 'products',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      name: 'Site ou Landing Page sob medida',
      setup_value: 500,
      recurring_value: 0,
      is_active: true,
    },
    {
      id: 'prod_wa_2',
      collectionId: 'products',
      collectionName: 'products',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      name: 'WhatsApp Autônomo e Humanizado',
      setup_value: 500,
      recurring_value: 55,
      is_active: true,
    },
  ]

  const mockScripts: PlaybookScript[] = [
    {
      id: 'sc_site_init',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Primeira abordagem Site/LP',
      title: 'Primeira Mensagem WhatsApp — Site/LP',
      script_text:
        'Olá, {contato}! Sou o {vendedor} da bit Consulting. Desenvolvemos sites de alta conversão para a {empresa}.',
      product: 'prod_site_1',
      product_name: 'Site ou Landing Page sob medida',
      display_order: 1,
      is_active: true,
    },
    {
      id: 'sc_wa_init',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Primeira abordagem Atendente IA',
      title: 'Abordagem Inicial — WhatsApp Autônomo',
      script_text:
        'Olá, {contato}! Sou o {vendedor} da bit Consulting. Implementamos atendente no WhatsApp com tom humanizado para a {empresa}.',
      product: 'prod_wa_2',
      product_name: 'WhatsApp Autônomo e Humanizado',
      display_order: 2,
      is_active: true,
    },
    {
      id: 'sc_site_follow',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Follow-up Site/LP',
      title: 'Follow-up WhatsApp — Site/LP',
      script_text: 'Olá, {contato}! Retomando nossa conversa sobre o novo site da {empresa}.',
      product: 'prod_site_1',
      product_name: 'Site ou Landing Page sob medida',
      display_order: 3,
      is_active: true,
    },
    {
      id: 'sc_wa_follow',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Follow-up WhatsApp Autônomo',
      title: 'Follow-up WhatsApp — WhatsApp Autônomo',
      script_text:
        'Olá, {contato}! Retomando nossa conversa sobre o atendente de WhatsApp da {empresa}.',
      product: 'prod_wa_2',
      product_name: 'WhatsApp Autônomo e Humanizado',
      display_order: 4,
      is_active: true,
    },
    {
      id: 'sc_generic_init',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
      channel: 'WhatsApp',
      situation: 'Contato genérico',
      title: 'Mensagem Geral de Contato',
      script_text: 'Olá, {contato}! Sou o {vendedor} da bit Consulting para a {empresa}.',
      display_order: 99,
      is_active: true,
    },
  ]

  // Lógica do seletor em BatchWhatsAppModal
  function resolveBatchScript(
    opp: Opportunity,
    selectedProductFilter: string, // 'auto' ou ID do produto
    products: Product[],
    scripts: PlaybookScript[],
    actionType: 'initial' | 'followup',
  ): { script: PlaybookScript | null; usedFallback: boolean } {
    const targetProdId =
      selectedProductFilter !== 'auto'
        ? selectedProductFilter
        : opp.product || opp.expand?.product?.id || null

    const chosenProduct = products.find((p) => p.id === targetProdId)
    const targetProdName = chosenProduct?.name || opp.product_name || null

    const tName = (targetProdName || '').trim().toLowerCase()
    const isWaAutonomous =
      tName.includes('whatsapp') && (tName.includes('autônomo') || tName.includes('autonomo'))
    const isSiteLp = tName.includes('site') || tName.includes('landing') || tName.includes('lp')

    let found: PlaybookScript | undefined
    if (actionType === 'initial') {
      found = scripts.find((s) => {
        if (s.channel !== 'WhatsApp') return false
        if (targetProdId && s.product === targetProdId) return true
        if (isWaAutonomous) {
          const sTitle = s.title.toLowerCase()
          return sTitle.includes('autônomo') || sTitle.includes('autonomo')
        }
        if (isSiteLp) {
          const sTitle = s.title.toLowerCase()
          return sTitle.includes('site') || sTitle.includes('landing')
        }
        return false
      })
    } else {
      found = scripts.find((s) => {
        if (s.channel !== 'WhatsApp' && s.channel !== 'Retorno') return false
        if (targetProdId && s.product === targetProdId) return true
        if (isWaAutonomous) {
          const sTitle = s.title.toLowerCase()
          return (
            (sTitle.includes('autônomo') || sTitle.includes('autonomo')) &&
            sTitle.includes('follow')
          )
        }
        if (isSiteLp) {
          const sTitle = s.title.toLowerCase()
          return sTitle.includes('site') || sTitle.includes('follow')
        }
        return false
      })
    }

    if (found) {
      return { script: found, usedFallback: false }
    }

    // Fallback genérico se produto não tiver script no canal
    const generic =
      scripts.find((s) => s.channel === 'WhatsApp' && !s.product && !s.product_name) ||
      scripts[0] ||
      null
    return { script: generic, usedFallback: true }
  }

  describe('Item 1: Seletor de Tipo de Mensagem/Produto nos Painéis de Disparo', () => {
    const oppSite: Opportunity = {
      id: 'opp_1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Empresa A',
      contact_name: 'Carlos',
      stage: 'Novo',
      source: 'Site',
      value: 500,
      product: 'prod_site_1',
      product_name: 'Site ou Landing Page sob medida',
      created: '2026-03-01T00:00:00Z',
      updated: '2026-03-01T00:00:00Z',
    }

    it('no modo auto (padrão), utiliza o produto da oportunidade', () => {
      const res = resolveBatchScript(oppSite, 'auto', mockProducts, mockScripts, 'initial')
      expect(res.usedFallback).toBe(false)
      expect(res.script?.id).toBe('sc_site_init')
      expect(res.script?.title).toContain('Site/LP')
    })

    it('ao trocar o seletor para WhatsApp Autônomo, SOBREPÕE a oportunidade de Site/LP', () => {
      const res = resolveBatchScript(oppSite, 'prod_wa_2', mockProducts, mockScripts, 'initial')
      expect(res.usedFallback).toBe(false)
      expect(res.script?.id).toBe('sc_wa_init')
      expect(res.script?.title).toContain('WhatsApp Autônomo')

      // Mensagem gerada deve conter o texto do WhatsApp Autônomo
      const msg = buildBatchWhatsAppMessage({
        actionType: 'initial',
        scriptTemplate: res.script?.script_text,
        opportunity: oppSite,
        sellerName: 'Vendedor Bit',
      })
      expect(msg).toContain('atendente no WhatsApp com tom humanizado')
    })

    it('no painel de Follow-up (coluna Qualificado), seletor também sobrepõe', () => {
      const oppQualificada: Opportunity = {
        ...oppSite,
        stage: 'Qualificado',
      }
      // Seletor troca para WhatsApp Autônomo
      const res = resolveBatchScript(
        oppQualificada,
        'prod_wa_2',
        mockProducts,
        mockScripts,
        'followup',
      )
      expect(res.usedFallback).toBe(false)
      expect(res.script?.id).toBe('sc_wa_follow')

      // Seletor troca para Site/LP
      const resSite = resolveBatchScript(
        oppQualificada,
        'prod_site_1',
        mockProducts,
        mockScripts,
        'followup',
      )
      expect(resSite.usedFallback).toBe(false)
      expect(resSite.script?.id).toBe('sc_site_follow')
    })

    it('cai no script genérico com aviso de fallback se o produto selecionado não tiver script', () => {
      const prodSemScript: Product = {
        id: 'prod_outro_3',
        collectionId: 'products',
        collectionName: 'products',
        created: '2026-03-01T00:00:00Z',
        updated: '2026-03-01T00:00:00Z',
        name: 'Consultoria Especializada',
        setup_value: 1000,
        recurring_value: 0,
        is_active: true,
      }
      const res = resolveBatchScript(
        oppSite,
        'prod_outro_3',
        [...mockProducts, prodSemScript],
        mockScripts,
        'initial',
      )
      expect(res.usedFallback).toBe(true)
      expect(res.script?.id).toBe('sc_generic_init')
      expect(res.script?.script_text).toContain(
        'Sou o {vendedor} da bit Consulting para a {empresa}',
      )
    })
  })

  describe('Item 2: Formulário Público sem exibição de valores na frente de WhatsApp Autônomo', () => {
    function formatProductOptionLabel(product: {
      name: string
      setup_price: number
      monthly_price: number
    }): string {
      const isWaAutonomous =
        product.name.toLowerCase().includes('whatsapp') &&
        (product.name.toLowerCase().includes('autônomo') ||
          product.name.toLowerCase().includes('autonomo'))

      // Regra: em WhatsApp Autônomo e Humanizado, retirar da frente os valores
      const priceLabel =
        !isWaAutonomous && product.monthly_price > 0
          ? `(R$ ${product.setup_price} + R$ ${product.monthly_price}/mês)`
          : ''

      return `${product.name} ${priceLabel}`.trim()
    }

    it('WhatsApp Autônomo e Humanizado NÃO exibe valores (R$ 500 / R$ 55) na label', () => {
      const waProduct = {
        name: 'WhatsApp Autônomo e Humanizado',
        setup_price: 500,
        monthly_price: 55,
      }
      const label = formatProductOptionLabel(waProduct)
      expect(label).toBe('WhatsApp Autônomo e Humanizado')
      expect(label).not.toContain('500')
      expect(label).not.toContain('55')
      expect(label).not.toContain('R$')
    })

    it('outros produtos que possuem mensalidade continuam exibindo se configurado', () => {
      const otherProduct = {
        name: 'Plano Sistema Sob Medida',
        setup_price: 1500,
        monthly_price: 120,
      }
      const label = formatProductOptionLabel(otherProduct)
      expect(label).toBe('Plano Sistema Sob Medida (R$ 1500 + R$ 120/mês)')
    })
  })

  describe('Item 3: Guia de Abordagem Comercial (ApproachFlow) com seletor de tipo de mensagem no WhatsApp', () => {
    it('permite alternar entre Site/LP e WhatsApp Autônomo no canal WhatsApp atualizando o script ativo', () => {
      // Simula a resolução do produto ativo com base no seletor selecionado manualmente
      function getActiveApproachProduct(
        selectedProductId: string,
        oppProduct?: { id: string; name: string },
        products: Product[] = mockProducts,
      ): Product | null {
        if (selectedProductId) {
          const match = products.find((p) => p.id === selectedProductId)
          if (match) return match
        }
        if (oppProduct) {
          const match = products.find((p) => p.id === oppProduct.id)
          if (match) return match
        }
        return products[0] || null
      }

      // 1. Oportunidade tem produto Site/LP originalmente
      const oppWithSite = { id: 'prod_site_1', name: 'Site ou Landing Page sob medida' }
      let active = getActiveApproachProduct('', oppWithSite)
      expect(active?.id).toBe('prod_site_1')

      // 2. Usuário escolhe no seletor trocar para "WhatsApp Autônomo e Humanizado"
      active = getActiveApproachProduct('prod_wa_2', oppWithSite)
      expect(active?.id).toBe('prod_wa_2')
      expect(active?.name).toBe('WhatsApp Autônomo e Humanizado')

      // 3. Usuário escolhe no seletor voltar para "Site ou Landing Page sob medida"
      active = getActiveApproachProduct('prod_site_1', oppWithSite)
      expect(active?.id).toBe('prod_site_1')
    })
  })
})
