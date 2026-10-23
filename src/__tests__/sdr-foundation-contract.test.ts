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
})
