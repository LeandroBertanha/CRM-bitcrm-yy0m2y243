import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SITE_RECURRING_VALUE,
  DEFAULT_SITE_SETUP_VALUE,
  getProductDefaultPricing,
  isCustomSiteProductName,
  isSiteRecurringOptionValue,
  isSiteSetupOptionValue,
  SITE_RECURRING_OPTIONS,
  SITE_SETUP_OPTIONS,
} from '@/lib/productDefaultPricing'

describe('precos padrao por produto', () => {
  it('preenche o WhatsApp com setup 350 e mensalidade 69,90', () => {
    expect(getProductDefaultPricing('WhatsApp Autônomo e Humanizado', 997, 397)).toEqual({
      setupValue: '350',
      recurringValue: '69.9',
    })
  })

  it('preenche Site ou Landing Page com setup 500 e mensalidade 55', () => {
    expect(isCustomSiteProductName('Site ou Landing Page sob medida')).toBe(true)
    expect(isCustomSiteProductName('SITE LANDING PAGE SOB MEDIDA')).toBe(true)
    expect(getProductDefaultPricing('Site ou Landing Page sob medida', 350, 69.9)).toEqual({
      setupValue: DEFAULT_SITE_SETUP_VALUE,
      recurringValue: DEFAULT_SITE_RECURRING_VALUE,
    })
    expect(SITE_SETUP_OPTIONS.map((option) => option.value)).toEqual([500])
    expect(SITE_RECURRING_OPTIONS.map((option) => option.value)).toEqual([55])
    expect(isSiteSetupOptionValue('500.00')).toBe(true)
    expect(isSiteRecurringOptionValue('55.00')).toBe(true)
  })

  it('mantem os valores do catalogo para os demais produtos', () => {
    expect(getProductDefaultPricing('Consultoria personalizada', 1200, 180)).toEqual({
      setupValue: '1200',
      recurringValue: '180',
    })
  })
})
