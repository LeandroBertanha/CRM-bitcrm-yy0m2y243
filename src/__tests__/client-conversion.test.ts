import { describe, expect, it } from 'vitest'
import {
  buildClientSnapshot,
  formatCnpj,
  getClientCompletion,
  isValidCnpj,
  normalizeCnpj,
} from '@/lib/clientConversion'
import type { Opportunity } from '@/types/crm'
import type { ClientRecord } from '@/types/client'

describe('conversão de oportunidade ganha em cliente', () => {
  const opportunity = {
    id: 'opp-001',
    company: '  Cliente Exemplo Ltda  ',
    stage: 'Ganho',
    source: 'Prospecção',
    value: 997,
    recurring_value: 397,
    seller: 'seller-1',
    product: 'product-1',
    product_name: 'WhatsApp Autônomo e Humanizado',
    contact_name: 'Maria Silva',
    contact_email: 'MARIA@EXEMPLO.COM',
    contact_phone: '(11) 99999-0000',
    city: 'São Paulo',
  } as Opportunity

  it('preserva o vínculo com oportunidade, vendedor, produto e valores', () => {
    expect(buildClientSnapshot(opportunity)).toEqual({
      name: 'Cliente Exemplo Ltda',
      contact_name: 'Maria Silva',
      contact_email: 'maria@exemplo.com',
      contact_phone: '(11) 99999-0000',
      city: 'São Paulo',
      seller: 'seller-1',
      source_opportunity: 'opp-001',
      product: 'product-1',
      product_name: 'WhatsApp Autônomo e Humanizado',
      setup_value: 997,
      recurring_value: 397,
      status: 'Implantacao',
    })
  })

  it('normaliza, formata e valida CNPJ', () => {
    expect(normalizeCnpj('11.222.333/0001-81')).toBe('11222333000181')
    expect(formatCnpj('11222333000181')).toBe('11.222.333/0001-81')
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
    expect(isValidCnpj('11.111.111/1111-11')).toBe(false)
  })

  it('calcula a completude considerando cadastro e documentos obrigatórios', () => {
    const client = {
      ...buildClientSnapshot(opportunity),
      id: 'client-1',
      cnpj: '11222333000181',
      zip_code: '01001000',
      street: 'Praça da Sé',
      address_number: '100',
      state: 'SP',
      contract_files: ['contrato.pdf'],
      proposal_files: ['proposta.pdf'],
      cnpj_card_files: ['cartao-cnpj.pdf'],
    } as ClientRecord

    expect(getClientCompletion(client)).toBe(100)
  })
})
