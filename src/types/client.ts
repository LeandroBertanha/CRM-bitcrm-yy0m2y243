import type { RecordModel } from 'pocketbase'
import type { Opportunity, Product } from '@/types/crm'

export type ClientStatus = 'Ativo' | 'Implantacao' | 'Inativo'

export interface ClientRecord extends RecordModel {
  name: string
  legal_name?: string
  cnpj?: string
  state_registration?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  zip_code?: string
  street?: string
  address_number?: string
  complement?: string
  district?: string
  city?: string
  state?: string
  seller?: string
  source_opportunity: string
  product?: string
  product_name?: string
  setup_value?: number
  recurring_value?: number
  status: ClientStatus
  notes?: string
  won_at?: string
  contract_files?: string[]
  proposal_files?: string[]
  cnpj_card_files?: string[]
  other_files?: string[]
  expand?: {
    seller?: { id: string; name?: string; email?: string }
    source_opportunity?: Opportunity
    product?: Product
  }
}

export type ClientDocumentField =
  | 'contract_files'
  | 'proposal_files'
  | 'cnpj_card_files'
  | 'other_files'
