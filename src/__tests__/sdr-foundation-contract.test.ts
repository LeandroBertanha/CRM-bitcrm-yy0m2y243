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
const opportunityCreateServiceSource = readFileSync(
  new URL('../services/sdrOpportunityCreateService.ts', import.meta.url),
  'utf8',
)
const opportunityCreateHookSource = readFileSync(
  new URL('../../pocketbase/hooks/sdr_opportunity_create.js', import.meta.url),
  'utf8',
)
const operationsHookSource = readFileSync(
  new URL('../../pocketbase/hooks/sdr_operations.js', import.meta.url),
  'utf8',
)
const operationsServiceSource = readFileSync(
  new URL('../services/sdrOperationsService.ts', import.meta.url),
  'utf8',
)
const activationPanelSource = readFileSync(
  new URL('../components/sdr/SdrActivationPanel.tsx', import.meta.url),
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

  it('exposes the SDR center only through the owner route and restricted menu', () => {
    expect(appSource).toContain('path="/sdr"')
    expect(appSource).toContain('<SdrCenter />')
    expect(appSource).toContain('<SdrOwnerRoute>')
    expect(layoutSource).toContain('canAccessSdr(user?.email)')
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

  it('offers an automatic opportunity queue without direct database mutations', () => {
    expect(campaignSimulatorSource).toContain('Fila automatica de oportunidades')
    expect(campaignSimulatorSource).toContain('getSdrOpportunityReadModel')
    expect(campaignSimulatorSource).toContain('prepareSdrMessageQueue')
    expect(campaignSimulatorSource).toContain('Criar fila do SDR')
    expect(campaignSimulatorSource).not.toContain('Adicionar contato')
    expect(campaignSimulatorSource).not.toContain('@/lib/pocketbase')
    expect(campaignSimulatorSource).not.toContain('fetch(')
  })

  it('checks existing opportunities through a read-only service', () => {
    expect(opportunityReadSource).toContain("collection('opportunities').getFullList")
    expect(opportunityReadSource).toContain('fields:')
    expect(opportunityReadSource).not.toContain('.create(')
    expect(opportunityReadSource).not.toContain('.update(')
    expect(opportunityReadSource).not.toContain('.delete(')
    expect(campaignSimulatorSource).toContain('Atualizar oportunidades')
  })

  it('keeps duplicate classification pure and isolated from network access', () => {
    expect(opportunityGuardSource).toContain('findSdrOpportunityConflicts')
    expect(opportunityGuardSource).not.toContain('@/lib/pocketbase')
    expect(opportunityGuardSource).not.toContain('fetch(')
    expect(opportunityGuardSource).not.toContain('.create(')
    expect(opportunityGuardSource).not.toContain('.update(')
    expect(opportunityGuardSource).not.toContain('.delete(')
  })

  it('keeps the legacy association helper pure and makes direct opportunity ids available', () => {
    expect(opportunityAssociationSource).toContain('buildSdrOpportunityAssociationSuggestions')
    expect(opportunityAssociationSource).toContain('requiresHumanConfirmation: true')
    expect(opportunityAssociationSource).toContain('readOnly: true')
    expect(opportunityAssociationSource).not.toContain('@/lib/pocketbase')
    expect(opportunityAssociationSource).not.toContain('fetch(')
    expect(opportunityAssociationSource).not.toContain('.create(')
    expect(opportunityAssociationSource).not.toContain('.update(')
    expect(opportunityAssociationSource).not.toContain('.delete(')
    expect(campaignSimulatorSource).toContain('opportunityId: opportunity.id')
    expect(operationsServiceSource).toContain('opportunityId: contact.opportunityId')
  })

  it('keeps the legacy creation plan isolated but removes manual creation from the SDR screen', () => {
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
    expect(campaignSimulatorSource).not.toContain('createSdrOpportunity')
    expect(campaignSimulatorSource).not.toContain('Adicionar contato')
  })

  it('creates opportunities only through the guarded server endpoint', () => {
    expect(opportunityCreateServiceSource).toContain('/backend/v1/sdr/opportunities/create')
    expect(opportunityCreateServiceSource).not.toContain("collection('opportunities').create")
    expect(opportunityCreateHookSource).toContain('$apis.requireAuth()')
    expect(opportunityCreateHookSource).toContain("role !== 'admin' && !isMasterAdmin")
    expect(opportunityCreateHookSource).toContain("settings.getBool('enabled')")
    expect(opportunityCreateHookSource).toContain("settings.getBool('allow_opportunity_creation')")
    expect(opportunityCreateHookSource).toContain("settings.getBool('require_human_confirmation')")
    expect(opportunityCreateHookSource).toContain("sdrEnvironment !== 'homologacao'")
    expect(opportunityCreateHookSource).toContain("sdrEnvironment !== 'producao'")
    expect(opportunityCreateHookSource).toContain('body.humanConfirmed !== true')
  })

  it('rechecks duplicate state and saves opportunity plus audit atomically', () => {
    expect(opportunityCreateHookSource).toContain('sdrFindOpenConflict($app, payload)')
    expect(opportunityCreateHookSource).toContain('sdrFindOpenConflict(txApp, payload)')
    expect(opportunityCreateHookSource).toContain('$app.runInTransaction((txApp) => {')
    expect(opportunityCreateHookSource).toContain("txApp.findCollectionByNameOrId('opportunities')")
    expect(opportunityCreateHookSource).toContain('sdrWriteAudit(txApp')
    expect(opportunityCreateHookSource).toContain("correlation_id = '")
    expect(opportunityCreateHookSource).not.toContain('app.delete(')
  })

  it('allows only an administrator to activate production with an explicit phrase', () => {
    expect(operationsHookSource).toContain('/backend/v1/sdr/{resource}/{action}')
    expect(operationsHookSource).toContain("resource === 'settings' && action === 'update'")
    expect(operationsHookSource).toContain('isAdmin(authRecord)')
    expect(operationsHookSource).toContain("email === 'leandro.bertanha@lbertanha.com'")
    expect(operationsHookSource).toContain("confirmationPhrase !== 'ATIVAR SDR EM PRODUCAO'")
    expect(operationsHookSource).toContain(
      "txSettings.set('allow_existing_opportunity_update', false)",
    )
    expect(operationsHookSource).toContain("txSettings.set('require_human_confirmation', true)")
    expect(operationsHookSource).toContain('$app.runInTransaction((txApp) => {')
    expect(activationPanelSource).toContain('ATIVAR SDR EM PRODUCAO')
    expect(operationsServiceSource).toContain('/backend/v1/sdr/settings/update')
  })

  it('persists a campaign and its queue only through an audited transaction', () => {
    expect(operationsHookSource).toContain('/backend/v1/sdr/{resource}/{action}')
    expect(operationsHookSource).toContain("resource !== 'campaigns' || action !== 'create'")
    expect(operationsHookSource).toContain("findCollectionByNameOrId('sdr_campaigns')")
    expect(operationsHookSource).toContain("findCollectionByNameOrId('sdr_campaign_contacts')")
    expect(operationsHookSource).toContain("findCollectionByNameOrId('sdr_messages')")
    expect(operationsHookSource).toContain("message.set('status', 'aguardando_confirmacao')")
    expect(operationsHookSource).toContain("operation: 'sdr_campaign_create_from_opportunities'")
    expect(operationsHookSource).toContain("contact.set('opportunity', item.opportunityId)")
    expect(operationsHookSource).toContain("message.set('opportunity', item.opportunityId)")
    expect(operationsHookSource).toContain("source: 'opportunities'")
    expect(operationsHookSource).toContain('SDR_ACTIVE_CONTACT_CONFLICT')
    expect(operationsHookSource).not.toContain("collection('opportunities').update")
    expect(operationsServiceSource).toContain('/backend/v1/sdr/campaigns/create')
    expect(campaignSimulatorSource).toContain('Criar fila do SDR')
  })
})
