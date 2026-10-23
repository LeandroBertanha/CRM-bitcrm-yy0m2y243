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

export interface SdrDashboardCounts {
  campaigns: number
  contacts: number
  messages: number
  scores: number
  tasks: number
  auditLogs: number
}

export interface SdrDashboardSnapshot {
  counts: SdrDashboardCounts
  unavailableCollections: string[]
}
