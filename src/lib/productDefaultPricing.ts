import {
  DEFAULT_WHATSAPP_RECURRING_VALUE,
  DEFAULT_WHATSAPP_SETUP_VALUE,
  isWhatsAppAutonomousProductName,
} from '@/lib/whatsappPricing'

export const DEFAULT_SITE_SETUP_VALUE = '500'
export const DEFAULT_SITE_RECURRING_VALUE = '55'

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
