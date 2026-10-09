import { describe, it, expect, vi } from 'vitest'
import {
  normalizePhoneForWhatsApp,
  buildWhatsAppMessage,
  buildBatchWhatsAppMessage,
  generateOpportunityShortRef,
  generateMessageFooter,
  interpolateVariables,
  buildWhatsAppWebUrl,
  logWhatsAppInteractionToOpportunity,
} from '@/lib/whatsappApproachHelper'
import type { Opportunity } from '@/types/crm'
import pb from '@/lib/pocketbase/client'

describe('WhatsApp Approach Helper & Batch Messaging', () => {
  describe('normalizePhoneForWhatsApp', () => {
    it('retorna vazio quando telefone é nulo ou indefinido', () => {
      expect(normalizePhoneForWhatsApp(null)).toBe('')
      expect(normalizePhoneForWhatsApp(undefined)).toBe('')
      expect(normalizePhoneForWhatsApp('')).toBe('')
    })

    it('adiciona DDI 55 para números de celular com DDD (11 dígitos)', () => {
      expect(normalizePhoneForWhatsApp('(11) 99999-8888')).toBe('5511999998888')
    })

    it('adiciona DDI 55 para telefones fixos com DDD (10 dígitos)', () => {
      expect(normalizePhoneForWhatsApp('(11) 3333-4444')).toBe('551133334444')
    })

    it('não duplica DDI se o telefone já tiver 55 no início com 12 ou 13 dígitos', () => {
      expect(normalizePhoneForWhatsApp('+55 11 99999-8888')).toBe('5511999998888')
      expect(normalizePhoneForWhatsApp('5511999998888')).toBe('5511999998888')
      expect(normalizePhoneForWhatsApp('551133334444')).toBe('551133334444')
    })

    it('remove zeros à esquerda de discagem', () => {
      expect(normalizePhoneForWhatsApp('011999998888')).toBe('5511999998888')
      expect(normalizePhoneForWhatsApp('005511999998888')).toBe('5511999998888')
    })
  })

  describe('generateOpportunityShortRef & generateMessageFooter', () => {
    it('gera código curto no formato {iniciais}-{ultimos 4 do id}', () => {
      const ref = generateOpportunityShortRef('Clinica Odontologica Sorriso', 'rec_12345678abcd')
      expect(ref).toBe('COS-abcd')
    })

    it('usa fallback sensato quando empresa não tem iniciais ou tem apenas uma palavra', () => {
      expect(generateOpportunityShortRef('Padaria', 'rec_12345678wxyz')).toBe('PAD-wxyz')
      expect(generateOpportunityShortRef('', 'rec_12345678wxyz')).toBe('BIT-wxyz')
    })

    it('gera rodapé rastreável consistente com vendedor e referência', () => {
      const footer = generateMessageFooter({
        sellerName: 'Carlos Silva',
        companyName: 'Padaria Estrela',
        opportunityId: 'opp_99991234',
      })
      expect(footer).toBe('— Carlos Silva, bit Consulting · Ref. PE-1234')
    })

    it('usa fallback de vendedor se não informado', () => {
      const footer = generateMessageFooter({
        companyName: 'Padaria Estrela',
        opportunityId: 'opp_99991234',
      })
      expect(footer).toContain('Consultor Comercial, bit Consulting')
    })
  })

  describe('interpolateVariables', () => {
    it('substitui variáveis {contato}, {empresa}, {cidade}, {vendedor}, {data}', () => {
      const template =
        'Olá, {contato}! Sou {vendedor} da Bit Consulting. Como estão os negócios na {empresa} em {cidade}? Retomando nosso contato de {data}.'

      const result = interpolateVariables(template, {
        contato: 'Roberto',
        empresa: 'Romero Logística',
        cidade: 'Campinas',
        vendedor: 'Mariana Lima',
        data: '15/03',
      })

      expect(result).toBe(
        'Olá, Roberto! Sou Mariana Lima da Bit Consulting. Como estão os negócios na Romero Logística em Campinas? Retomando nosso contato de 15/03.',
      )
    })

    it('mantém suporte retrocompatível aos marcadores com colchetes [NOME DO CONTATO]', () => {
      const template =
        'Olá, [NOME DO CONTATO]! Aqui é [NOME DO VENDEDOR]. Vi o trabalho da [NOME DA EMPRESA] em [CIDADE].'

      const result = interpolateVariables(template, {
        contato: 'Dr. Fábio',
        empresa: 'Clínica Vida',
        cidade: 'Santos',
        vendedor: 'Lucas',
      })

      expect(result).toBe('Olá, Dr. Fábio! Aqui é Lucas. Vi o trabalho da Clínica Vida em Santos.')
    })
  })

  describe('buildBatchWhatsAppMessage', () => {
    const mockOpp: Opportunity = {
      id: 'opp_test_abcd',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Bella Pizzaria',
      stage: 'Novo',
      source: 'Site',
      value: 2500,
      seller: 'user_1',
      contact_name: 'Giuseppe',
      contact_phone: '(11) 98888-7777',
      city: 'São Paulo',
      created: '2026-03-01T10:00:00Z',
      updated: '2026-03-01T10:00:00Z',
    }

    it('constrói mensagem inicial com template do banco e rodapé rastreável', () => {
      const scriptFromPlaybook =
        'Olá, {contato}! Aqui é {vendedor} da bit Consulting. Vi que a {empresa} em {cidade} ainda não tem um site moderno. Podemos bater um papo?'

      const message = buildBatchWhatsAppMessage({
        actionType: 'initial',
        scriptTemplate: scriptFromPlaybook,
        opportunity: mockOpp,
        sellerName: 'Amanda Costa',
      })

      expect(message).toContain('Olá, Giuseppe!')
      expect(message).toContain('Amanda Costa')
      expect(message).toContain('Bella Pizzaria em São Paulo')
      expect(message).toContain('— Amanda Costa, bit Consulting · Ref. BP-abcd')
    })

    it('constrói mensagem de follow-up mencionando retomada e última interação opcional', () => {
      const qualOpp: Opportunity = {
        ...mockOpp,
        stage: 'Qualificado',
      }

      const scriptFollowup =
        'Olá, {contato}! Tudo bem? Passando para saber se pude tirar dúvidas sobre a proposta da {empresa}. Retomando nosso papo de {data}.'

      const message = buildBatchWhatsAppMessage({
        actionType: 'followup',
        scriptTemplate: scriptFollowup,
        opportunity: qualOpp,
        sellerName: 'Amanda Costa',
        lastInteractionDate: '10/03',
      })

      expect(message).toContain('Olá, Giuseppe!')
      expect(message).toContain('Retomando nosso papo de 10/03.')
      expect(message).toContain('— Amanda Costa, bit Consulting · Ref. BP-abcd')
    })
  })

  describe('buildWhatsAppWebUrl', () => {
    it('gera link wa.me correto com telefone e mensagem codificada', () => {
      const url = buildWhatsAppWebUrl('5511999998888', 'Olá mundo!')
      expect(url).toBe('https://wa.me/5511999998888?text=Ol%C3%A1%20mundo!')
    })
  })

  describe('logWhatsAppInteractionToOpportunity', () => {
    it('registra mensagem inicial com tag [WhatsApp inicial] na timeline', async () => {
      const createSpy = vi
        .spyOn(pb.collection('opportunity_notes'), 'create')
        .mockResolvedValueOnce({
          id: 'note_123',
        } as any)

      const success = await logWhatsAppInteractionToOpportunity({
        opportunityId: 'opp_123',
        authorId: 'user_456',
        message: 'Olá contato',
        phone: '(11) 99999-8888',
        actionType: 'initial',
      })

      expect(success).toBe(true)
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_123',
          author: 'user_456',
          type: 'whatsapp',
          text: expect.stringContaining('[WhatsApp inicial] Mensagem inicial via WhatsApp'),
        }),
      )
      createSpy.mockRestore()
    })

    it('registra follow-up com tag [WhatsApp follow-up] na timeline', async () => {
      const createSpy = vi
        .spyOn(pb.collection('opportunity_notes'), 'create')
        .mockResolvedValueOnce({
          id: 'note_456',
        } as any)

      const success = await logWhatsAppInteractionToOpportunity({
        opportunityId: 'opp_789',
        authorId: 'user_456',
        message: 'Passando para retomar contato',
        phone: '(11) 99999-8888',
        actionType: 'followup',
      })

      expect(success).toBe(true)
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_789',
          author: 'user_456',
          type: 'whatsapp',
          text: expect.stringContaining('[WhatsApp follow-up] Follow-up via WhatsApp'),
        }),
      )

      createSpy.mockRestore()
    })
  })
})
