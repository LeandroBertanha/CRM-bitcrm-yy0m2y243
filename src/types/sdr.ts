import type { RecordModel } from 'pocketbase'

export type SdrEnvironment = 'homologacao' | 'producao'

export interface SdrSettings extends RecordModel {
  enabled: boolean
  allow_existing_opportunity_update: boolean
  allow_opportunity_creation: boolean
  require_human_confirmation: boolean
  environment: SdrEnvironment
  created_by?: string
  notes?: string
}

export interface SdrFoundationStatus {
  available: boolean
  settings: SdrSettings
  reason?: string
}
