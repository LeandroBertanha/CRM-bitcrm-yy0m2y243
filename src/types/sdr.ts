import type { RecordModel } from 'pocketbase'
import type { Opportunity } from '@/types/crm'

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

export interface SdrCampaignContactInput {
  companyName: string
  contactName?: string
  phone: string
  email?: string
  authorizedForTest: boolean
}

export interface SdrCampaignPreparationInput {
  name: string
  channel: 'whatsapp'
  contacts: SdrCampaignContactInput[]
}

export type SdrPreparationRejectionCode =
  | 'CAMPAIGN_NAME_REQUIRED'
  | 'CONTACT_NOT_AUTHORIZED'
  | 'COMPANY_NAME_REQUIRED'
  | 'INVALID_PHONE'
  | 'INVALID_EMAIL'
  | 'DUPLICATE_CONTACT'

export interface SdrPreparationRejection {
  index: number
  code: SdrPreparationRejectionCode
  reason: string
}

export interface SdrPreparedContact extends SdrCampaignContactInput {
  companyName: string
  contactName: string
  normalizedPhone: string
  normalizedEmail: string
  deduplicationKey: string
  correlationId: string
  requiresHumanReview: true
}

export interface SdrCampaignPreparationResult {
  valid: boolean
  campaignName: string
  accepted: SdrPreparedContact[]
  rejected: SdrPreparationRejection[]
  totals: {
    received: number
    accepted: number
    rejected: number
  }
}

export interface SdrPreparedMessage {
  correlationId: string
  deduplicationKey: string
  phone: string
  body: string
  status: 'aguardando_confirmacao'
  attemptCount: 0
  requiresHumanConfirmation: true
}

export interface SdrOpportunityReadModel {
  id: string
  company: string
  stage: Opportunity['stage']
  seller?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  updated?: string
}

export type SdrOpportunityMatchField = 'phone' | 'email' | 'company'
export type SdrOpportunityConflictLevel = 'clear' | 'review' | 'blocking'

export interface SdrOpportunityConflictCandidate {
  opportunityId: string
  company: string
  stage: Opportunity['stage']
  isOpen: boolean
  matchedBy: SdrOpportunityMatchField[]
}

export interface SdrOpportunityConflictResult {
  correlationId: string
  companyName: string
  level: SdrOpportunityConflictLevel
  reason: string
  candidates: SdrOpportunityConflictCandidate[]
}

export type SdrAssociationSuggestionStatus = 'suggested' | 'ambiguous' | 'none'
export type SdrAssociationConfidence = 'high' | 'medium' | 'none'

export interface SdrOpportunityAssociationSuggestion {
  correlationId: string
  companyName: string
  status: SdrAssociationSuggestionStatus
  confidence: SdrAssociationConfidence
  reason: string
  recommendedCandidate?: SdrOpportunityConflictCandidate
  alternatives: SdrOpportunityConflictCandidate[]
  requiresHumanConfirmation: true
  readOnly: true
}

export interface SdrOpportunityCreationPayload {
  company: string
  stage: 'Novo'
  source: 'Prospecção'
  value: 0
  contact_name: string
  contact_phone: string
  contact_email: string
}

export interface SdrOpportunityCreationPlan {
  correlationId: string
  status: 'ready_for_confirmation' | 'blocked'
  reason: string
  idempotencyKey: string
  payload: SdrOpportunityCreationPayload
  guards: {
    featureFlagRequired: true
    backendDeduplicationRequired: true
    auditRequired: true
    humanConfirmationRequired: true
  }
  executionAllowed: false
}
