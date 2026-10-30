import type { Opportunity } from '@/types/crm'
import type { ClientRecord } from '@/types/client'

export const normalizeCnpj = (value: string): string => value.replace(/\D/g, '').slice(0, 14)

export const formatCnpj = (value: string): string => {
  const digits = normalizeCnpj(value)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

export const isValidCnpj = (value: string): boolean => {
  const digits = normalizeCnpj(value)
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false

  const calculateDigit = (base: string, weights: number[]) => {
    const total = base
      .split('')
      .reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0)
    const remainder = total % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  const first = calculateDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const second = calculateDigit(
    digits.slice(0, 12) + first,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  )

  return digits.endsWith(`${first}${second}`)
}

export const buildClientSnapshot = (
  opportunity: Opportunity,
): Pick<
  ClientRecord,
  | 'name'
  | 'contact_name'
  | 'contact_email'
  | 'contact_phone'
  | 'city'
  | 'seller'
  | 'source_opportunity'
  | 'product'
  | 'product_name'
  | 'setup_value'
  | 'recurring_value'
  | 'status'
> => ({
  name: opportunity.company.trim(),
  contact_name: opportunity.contact_name?.trim() || '',
  contact_email: opportunity.contact_email?.trim().toLowerCase() || '',
  contact_phone: opportunity.contact_phone?.trim() || '',
  city: opportunity.city?.trim() || '',
  seller: opportunity.seller || '',
  source_opportunity: opportunity.id,
  product: opportunity.product || '',
  product_name: opportunity.product_name?.trim() || opportunity.expand?.product?.name || '',
  setup_value: Number(opportunity.value) || 0,
  recurring_value: Number(opportunity.recurring_value) || 0,
  status: 'Implantacao',
})

export const getClientCompletion = (client: ClientRecord): number => {
  const checks = [
    client.name,
    client.cnpj,
    client.contact_name,
    client.contact_email || client.contact_phone,
    client.zip_code,
    client.street,
    client.address_number,
    client.city,
    client.state,
    client.contract_files?.length,
    client.proposal_files?.length,
    client.cnpj_card_files?.length,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}
