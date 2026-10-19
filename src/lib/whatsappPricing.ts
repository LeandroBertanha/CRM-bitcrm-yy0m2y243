export type WhatsAppRecurringOption = {
  id: string
  label: string
  monthlyValue: number
  annualValue?: number
}

export type WhatsAppSetupOption = {
  id: string
  label: string
  value: number
}

export const WHATSAPP_SETUP_OPTIONS: WhatsAppSetupOption[] = [
  {
    id: 'setup-497',
    label: 'R$ 497,00',
    value: 497,
  },
  {
    id: 'setup-997',
    label: 'R$ 997,00',
    value: 997,
  },
  {
    id: 'setup-1997',
    label: 'R$ 1.997,00',
    value: 1997,
  },
  {
    id: 'setup-adesao-2026',
    label: 'R$ 350,00 (Adesão até 31/10/2026)',
    value: 350,
  },
]

export const DEFAULT_WHATSAPP_SETUP_VALUE = '350'

// Planos anuais gravam a parcela mensal equivalente para manter MRR e recorrência consistentes.
export const WHATSAPP_RECURRING_OPTIONS: WhatsAppRecurringOption[] = [
  {
    id: 'adesao-2026',
    label: 'Adesão até 31/10/2026 - R$ 69,90/mês',
    monthlyValue: 69.9,
  },
  {
    id: 'essencial-mensal',
    label: 'Essencial mensal - R$ 397,00/mês',
    monthlyValue: 397,
  },
  {
    id: 'essencial-anual',
    label: 'Essencial anual - R$ 3.334,80 (12x de R$ 277,90)',
    monthlyValue: 277.9,
    annualValue: 3334.8,
  },
  {
    id: 'profissional-mensal',
    label: 'Profissional mensal - R$ 797,00/mês',
    monthlyValue: 797,
  },
  {
    id: 'profissional-anual',
    label: 'Profissional anual - R$ 6.694,80 (12x de R$ 557,90)',
    monthlyValue: 557.9,
    annualValue: 6694.8,
  },
  {
    id: 'premium-mensal',
    label: 'Premium mensal - R$ 1.497,00/mês',
    monthlyValue: 1497,
  },
  {
    id: 'premium-anual',
    label: 'Premium anual - R$ 12.574,80 (12x de R$ 1.047,90)',
    monthlyValue: 1047.9,
    annualValue: 12574.8,
  },
]

export const DEFAULT_WHATSAPP_RECURRING_VALUE = String(WHATSAPP_RECURRING_OPTIONS[0].monthlyValue)

export function isWhatsAppAutonomousProductName(name?: string | null): boolean {
  if (!name) return false

  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return normalized.includes('whatsapp') && normalized.includes('autonomo')
}

export function isWhatsAppRecurringOptionValue(value?: string | number | null): boolean {
  if (value === null || value === undefined || value === '') return false
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return false

  return WHATSAPP_RECURRING_OPTIONS.some(
    (option) => Math.abs(option.monthlyValue - numericValue) < 0.001,
  )
}

export function isWhatsAppSetupOptionValue(value?: string | number | null): boolean {
  if (value === null || value === undefined || value === '') return false
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return false

  return WHATSAPP_SETUP_OPTIONS.some((option) => Math.abs(option.value - numericValue) < 0.001)
}

export function getMaxPaymentInstallments(productName?: string | null): number {
  return isWhatsAppAutonomousProductName(productName) ? 12 : 10
}
