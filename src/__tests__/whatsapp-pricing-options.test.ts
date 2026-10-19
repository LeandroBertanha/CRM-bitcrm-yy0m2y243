import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WHATSAPP_RECURRING_VALUE,
  DEFAULT_WHATSAPP_SETUP_VALUE,
  getMaxPaymentInstallments,
  isWhatsAppAutonomousProductName,
  isWhatsAppRecurringOptionValue,
  isWhatsAppSetupOptionValue,
  WHATSAPP_RECURRING_OPTIONS,
  WHATSAPP_SETUP_OPTIONS,
} from '@/lib/whatsappPricing'

describe('tabela comercial do WhatsApp', () => {
  it('oferece as sete opcoes solicitadas em quatro faixas comerciais', () => {
    expect(WHATSAPP_RECURRING_OPTIONS).toHaveLength(7)
    expect(WHATSAPP_RECURRING_OPTIONS.map((option) => option.monthlyValue)).toEqual([
      69.9, 397, 277.9, 797, 557.9, 1497, 1047.9,
    ])
    expect(DEFAULT_WHATSAPP_RECURRING_VALUE).toBe('69.9')
  })

  it('oferece os quatro valores de setup e usa a adesao como padrao', () => {
    expect(WHATSAPP_SETUP_OPTIONS).toHaveLength(4)
    expect(WHATSAPP_SETUP_OPTIONS.map((option) => option.value)).toEqual([497, 997, 1997, 350])
    expect(DEFAULT_WHATSAPP_SETUP_VALUE).toBe('350')
    expect(WHATSAPP_SETUP_OPTIONS.at(-1)?.label).toContain('Adesão até 31/10/2026')
  })

  it('mantem o total anual igual a doze parcelas mensais', () => {
    const annualOptions = WHATSAPP_RECURRING_OPTIONS.filter(
      (option) => option.annualValue !== undefined,
    )

    expect(annualOptions).toHaveLength(3)
    annualOptions.forEach((option) => {
      expect(option.monthlyValue * 12).toBeCloseTo(option.annualValue!, 2)
      expect(option.label).toContain('12x')
    })
  })

  it('reconhece o produto com e sem acento e libera ate 12 parcelas', () => {
    expect(isWhatsAppAutonomousProductName('WhatsApp Autônomo e Humanizado')).toBe(true)
    expect(isWhatsAppAutonomousProductName('WHATSAPP AUTONOMO E HUMANIZADO')).toBe(true)
    expect(getMaxPaymentInstallments('WhatsApp Autônomo e Humanizado')).toBe(12)
    expect(getMaxPaymentInstallments('Site Institucional')).toBe(10)
  })

  it('preserva valores legados sem confundi-los com a tabela atual', () => {
    expect(isWhatsAppRecurringOptionValue('69.90')).toBe(true)
    expect(isWhatsAppRecurringOptionValue('55')).toBe(false)
    expect(isWhatsAppSetupOptionValue('350.00')).toBe(true)
    expect(isWhatsAppSetupOptionValue('500')).toBe(false)
  })
})
