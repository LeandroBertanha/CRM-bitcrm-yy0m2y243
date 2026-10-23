import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationSource = readFileSync(
  new URL('../../pocketbase/migrations/0033_create_sdr_foundation.js', import.meta.url),
  'utf8',
)
const serviceSource = readFileSync(
  new URL('../services/sdrSettingsService.ts', import.meta.url),
  'utf8',
)
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
const layoutSource = readFileSync(new URL('../components/Layout.tsx', import.meta.url), 'utf8')
const campaignPreparationSource = readFileSync(
  new URL('../services/sdrCampaignPreparation.ts', import.meta.url),
  'utf8',
)
const campaignSimulatorSource = readFileSync(
  new URL('../components/sdr/SdrCampaignSimulator.tsx', import.meta.url),
  'utf8',
)
const opportunityReadSource = readFileSync(
  new URL('../services/sdrOpportunityReadService.ts', import.meta.url),
  'utf8',
)
const opportunityGuardSource = readFileSync(
  new URL('../services/sdrOpportunityGuard.ts', import.meta.url),
  'utf8',
)
const opportunityAssociationSource = readFileSync(
  new URL('../services/sdrOpportunityAssociation.ts', import.meta.url),
  'utf8',
)
const opportunityCreationPlanSource = readFileSync(
  new URL('../services/sdrOpportunityCreationPlan.ts', import.meta.url),
  'utf8',
)

describe('SDR foundation safety contract', () => {
  it('creates only the isolated SDR collections required by phase 1', () => {
    const collections = [
      'sdr_settings',
      'sdr_campaigns',
      'sdr_campaign_contacts',
      'sdr_messages',
      'sdr_scores',
      'sdr_tasks',
      'sdr_audit_logs',
    ]

    for (const collection of collections) {
      expect(migrationSource).toContain(`'${collection}'`)
      expect(serviceSource).toContain(`'${collection}'`)
    }
  })

  it('starts disabled and blocks automatic opportunity writes', () => {
    expect(migrationSource).toContain("settings.set('enabled', false)")
    expect(migrationSource).toContain("settings.set('allow_existing_opportunity_update', false)")
    expect(migrationSource).toContain("settings.set('allow_opportunity_creation', false)")
    expect(migrationSource).toContain("settings.set('require_human_confirmation', true)")
    expect(serviceSource).toContain('enabled: false')
    expect(serviceSource).toContain('allow_existing_opportunity_update: false')
    expect(serviceSource).toContain('allow_opportunity_creation: false')
    expect(migrationSource).not.toContain('createRule: adminRule')
    expect(migrationSource).not.toContain('updateRule: adminRule')
    expect(migrationSource).not.toContain('deleteRule: adminRule')
  })

  it('has a non-destructive rollback and does not truncate data', () => {
    expect(migrationSource).not.toContain('truncateCollection')
    expect(migrationSource).not.toContain('app.delete(')
  })

  it('exposes the SDR center only through the admin route and menu', () => {
    expect(appSource).toContain('path="/sdr"')
    expect(appSource).toContain('<SdrCenter />')
    expect(layoutSource).toContain("{ label: 'SDR Inteligente', to: '/sdr', icon: Bot }")
  })

  it('keeps the phase 2 dashboard read-only', () => {
    expect(serviceSource).toContain('getSdrDashboardSnapshot')
    expect(serviceSource).toContain('.getList(1, 1, {')
    expect(serviceSource).not.toContain('.create(')
    expect(serviceSource).not.toContain('.update(')
    expect(serviceSource).not.toContain('.delete(')
  })

  it('keeps campaign preparation isolated from database and network mutations', () => {
    expect(campaignPreparationSource).not.toContain('@/lib/pocketbase')
    expect(campaignPreparationSource).not.toContain('fetch(')
    expect(campaignPreparationSource).not.toContain('.create(')
    expect(campaignPreparationSource).not.toContain('.update(')
    expect(campaignPreparationSource).not.toContain('.delete(')
  })

  it('offers a local-only simulator without persistence or sending actions', () => {
    expect(campaignSimulatorSource).toContain('Sem escrita no CRM')
    expect(campaignSimulatorSource).toContain('Validar simulacao')
    expect(campaignSimulatorSource).toContain('prepareSdrMessageQueue')
    expect(campaignSimulatorSource).not.toContain('@/lib/pocketbase')
    expect(campaignSimulatorSource).not.toContain('fetch(')
  })

  it('checks existing opportunities through a read-only service', () => {
    expect(opportunityReadSource).toContain("collection('opportunities').getFullList")
    expect(opportunityReadSource).toContain('fields:')
    expect(opportunityReadSource).not.toContain('.create(')
    expect(opportunityReadSource).not.toContain('.update(')
    expect(opportunityReadSource).not.toContain('.delete(')
    expect(campaignSimulatorSource).toContain('Verificar duplicidades no CRM')
  })

  it('keeps duplicate classification pure and isolated from network access', () => {
    expect(opportunityGuardSource).toContain('findSdrOpportunityConflicts')
    expect(opportunityGuardSource).not.toContain('@/lib/pocketbase')
    expect(opportunityGuardSource).not.toContain('fetch(')
    expect(opportunityGuardSource).not.toContain('.create(')
    expect(opportunityGuardSource).not.toContain('.update(')
    expect(opportunityGuardSource).not.toContain('.delete(')
  })

  it('keeps association suggestions local, read-only and human-reviewed', () => {
    expect(opportunityAssociationSource).toContain('buildSdrOpportunityAssociationSuggestions')
    expect(opportunityAssociationSource).toContain('requiresHumanConfirmation: true')
    expect(opportunityAssociationSource).toContain('readOnly: true')
    expect(opportunityAssociationSource).not.toContain('@/lib/pocketbase')
    expect(opportunityAssociationSource).not.toContain('fetch(')
    expect(opportunityAssociationSource).not.toContain('.create(')
    expect(opportunityAssociationSource).not.toContain('.update(')
    expect(opportunityAssociationSource).not.toContain('.delete(')
    expect(campaignSimulatorSource).toContain('Esta marcacao e apenas local')
  })

  it('prepares opportunity creation without allowing execution', () => {
    expect(opportunityCreationPlanSource).toContain('buildSdrOpportunityCreationPlans')
    expect(opportunityCreationPlanSource).toContain('executionAllowed: false')
    expect(opportunityCreationPlanSource).toContain('featureFlagRequired: true')
    expect(opportunityCreationPlanSource).toContain('backendDeduplicationRequired: true')
    expect(opportunityCreationPlanSource).toContain('auditRequired: true')
    expect(opportunityCreationPlanSource).not.toContain('@/lib/pocketbase')
    expect(opportunityCreationPlanSource).not.toContain('fetch(')
    expect(opportunityCreationPlanSource).not.toContain('.create(')
    expect(opportunityCreationPlanSource).not.toContain('.update(')
    expect(opportunityCreationPlanSource).not.toContain('.delete(')
    expect(campaignSimulatorSource).toContain('nao cria oportunidade no CRM')
  })
})
