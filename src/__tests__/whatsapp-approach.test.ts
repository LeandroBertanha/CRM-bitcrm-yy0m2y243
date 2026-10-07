import { describe, it, expect } from 'vitest'
import {
  normalizePhoneForWhatsApp,
  buildWhatsAppMessage,
  buildWhatsAppWebUrl,
  DEFAULT_WHATSAPP_OPENING_TEMPLATE,
  DEFAULT_WHATSAPP_GENERIC_TEMPLATE,
} from '@/lib/whatsappApproachHelper'

describe('normalizePhoneForWhatsApp', () => {
  it('adiciona 55 quando telefone tem 10 dígitos (fixo com DDD)', () => {
    expect(normalizePhoneForWhatsApp('1133334444')).toBe('551133334444')
    expect(normalizePhoneForWhatsApp('(11) 3333-4444')).toBe('551133334444')
  })

  it('adiciona 55 quando telefone tem 11 dígitos (celular com DDD)', () => {
    expect(normalizePhoneForWhatsApp('11987654321')).toBe('5511987654321')
    expect(normalizePhoneForWhatsApp('(11) 98765-4321')).toBe('5511987654321')
  })

  it('remove zeros à esquerda antes de adicionar 55', () => {
    expect(normalizePhoneForWhatsApp('011987654321')).toBe('5511987654321')
    expect(normalizePhoneForWhatsApp('0011987654321')).toBe('5511987654321')
  })

  it('não duplica o DDI 55 quando já presente em número de 12 ou 13 dígitos', () => {
    expect(normalizePhoneForWhatsApp('5511987654321')).toBe('5511987654321')
    expect(normalizePhoneForWhatsApp('+55 (11) 98765-4321')).toBe('5511987654321')
    expect(normalizePhoneForWhatsApp('+55 11 3333-4444')).toBe('551133334444')
  })

  it('retorna vazio para valores nulos, indefinidos ou sem dígitos', () => {
    expect(normalizePhoneForWhatsApp('')).toBe('')
    expect(normalizePhoneForWhatsApp(null)).toBe('')
    expect(normalizePhoneForWhatsApp(undefined)).toBe('')
    expect(normalizePhoneForWhatsApp('   ')).toBe('')
    expect(normalizePhoneForWhatsApp('abc-def')).toBe('')
  })
})

describe('buildWhatsAppMessage', () => {
  const context = {
    sellerName: 'Carlos Silva',
    companyName: 'Oficina Central',
    contactName: 'Marcos',
    city: 'Campinas',
    segment: 'Estética Automotiva',
  }

  it('interpola dados na mensagem a partir do script fornecido pelo banco', () => {
    const customScript =
      'Olá, [NOME DO CONTATO]! Aqui é o [NOME DO VENDEDOR], da Bit Consulting. Vi a [NOME DA EMPRESA] em [CIDADE].'
    const msg = buildWhatsAppMessage({
      scriptTemplate: customScript,
      context,
      hasOpportunity: true,
    })
    expect(msg).toBe(
      'Olá, Marcos! Aqui é o Carlos Silva, da Bit Consulting. Vi a Oficina Central em Campinas.',
    )
  })

  it('usa o fallback personalizado quando não há script mas tem oportunidade/dados', () => {
    const msg = buildWhatsAppMessage({
      scriptTemplate: null,
      context,
      hasOpportunity: true,
    })
    expect(msg).toContain('Olá, Marcos!')
    expect(msg).toContain('Carlos Silva')
    expect(msg).toContain('Oficina Central')
    expect(msg).toContain('Campinas')
  })

  it('usa o fallback genérico quando não há oportunidade nem dados customizados', () => {
    const msg = buildWhatsAppMessage({
      scriptTemplate: null,
      context: { sellerName: 'Carlos Silva' },
      hasOpportunity: false,
    })
    expect(msg).toContain('Carlos Silva da Bit Consulting')
    expect(msg).not.toContain('[NOME DO CONTATO]')
  })
})

describe('buildWhatsAppWebUrl', () => {
  it('gera URL wa.me com telefone e mensagem encodada', () => {
    const url = buildWhatsAppWebUrl('5511987654321', 'Olá, tudo bem?')
    expect(url).toBe('https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F')
  })

  it('gera URL wa.me sem telefone se telefone for vazio', () => {
    const url = buildWhatsAppWebUrl('', 'Olá')
    expect(url).toBe('https://wa.me/?text=Ol%C3%A1')
  })
})
