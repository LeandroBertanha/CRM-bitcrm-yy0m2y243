import {
  DEFAULT_WHATSAPP_RECURRING_VALUE,
  DEFAULT_WHATSAPP_SETUP_VALUE,
  isWhatsAppAutonomousProductName,
} from '@/lib/whatsappPricing'

export const DEFAULT_SITE_SETUP_VALUE = '500'
export const DEFAULT_SITE_RECURRING_VALUE = '55'

export type SitePricingOption = {
  id: string
  label: string
  value: number
}

export const SITE_SETUP_OPTIONS: SitePricingOption[] = [
  {
    id: 'site-setup-500',
    label: 'R$ 500,00',
    value: 500,
  },
]

export const SITE_RECURRING_OPTIONS: SitePricingOption[] = [
  {
    id: 'site-suporte-55',
    label: 'R$ 55,00/mês',
    value: 55,
  },
]

function normalizeProductName(name?: string | null): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function isCustomSiteProductName(name?: string | null): boolean {
  const normalized = normalizeProductName(name)
  return normalized.includes('site') && normalized.includes('landing page')
}

function isPricingOptionValue(
  options: SitePricingOption[],
  value?: string | number | null,
): boolean {
  if (value === null || value === undefined || value === '') return false
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return false

  return options.some((option) => Math.abs(option.value - numericValue) < 0.001)
}

export function isSiteSetupOptionValue(value?: string | number | null): boolean {
  return isPricingOptionValue(SITE_SETUP_OPTIONS, value)
}

export function isSiteRecurringOptionValue(value?: string | number | null): boolean {
  return isPricingOptionValue(SITE_RECURRING_OPTIONS, value)
}

export function getProductDefaultPricing(
  productName: string | null | undefined,
  catalogSetupValue: string | number | null | undefined,
  catalogRecurringValue: string | number | null | undefined,
): { setupValue: string; recurringValue: string } {
  if (isWhatsAppAutonomousProductName(productName)) {
    return {
      setupValue: DEFAULT_WHATSAPP_SETUP_VALUE,
      recurringValue: DEFAULT_WHATSAPP_RECURRING_VALUE,
    }
  }

  if (isCustomSiteProductName(productName)) {
    return {
      setupValue: DEFAULT_SITE_SETUP_VALUE,
      recurringValue: DEFAULT_SITE_RECURRING_VALUE,
    }
  }

  return {
    setupValue: String(catalogSetupValue ?? 350),
    recurringValue: String(catalogRecurringValue ?? 55),
  }
}
