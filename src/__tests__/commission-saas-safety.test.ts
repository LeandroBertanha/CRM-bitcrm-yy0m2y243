import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildReceivablePlan,
  calculateReleaseForReceivable,
  calculateSaasCommission,
  deriveCommissionStatus,
  matchSaasTier,
  type SaasPolicyTier,
} from '@/types/commissionSaas'

const tiers: SaasPolicyTier[] = [
  { min_value: 0, max_value: 300_000, percentage: 0.1, label: 'Até R$ 3.000' },
  { min_value: 300_001, max_value: 500_000, percentage: 0.08, label: 'Até R$ 5.000' },
  { min_value: 500_001, max_value: 1_000_000, percentage: 0.07, label: 'Até R$ 10.000' },
  { min_value: 1_000_001, max_value: 2_000_000, percentage: 0.06, label: 'Até R$ 20.000' },
  { min_value: 2_000_001, max_value: 5_000_000, percentage: 0.05, label: 'Até R$ 50.000' },
  { min_value: 5_000_001, max_value: null, percentage: 0.04, label: 'Acima de R$ 50.000' },
]

const policy = {
  tiers,
  recurring_percentage: 0.1,
  recurring_eligible_months: 3,
  min_margin_percentage: 0.3,
}

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('comissionamento SaaS - regras financeiras', () => {
  it.each([
    [300_000, 0.1],
    [300_001, 0.08],
    [500_001, 0.07],
    [1_000_001, 0.06],
    [2_000_001, 0.05],
    [5_000_001, 0.04],
  ])('aplica uma única faixa ao valor integral de %i centavos', (value, expected) => {
    expect(matchSaasTier(value, tiers)?.percentage).toBe(expected)
  })

  it('limita a recorrência aos três meses elegíveis e não altera a comissão de desenvolvimento', () => {
    const bitCloud = calculateSaasCommission({
      contractValueCents: 1_200_000,
      recurringMonthlyCents: 100_000,
      directCostsCents: 0,
      recurringCostsCents: 0,
      taxesCents: 0,
      hostingModel: 'bit_cloud',
      policy,
    })
    const clientCloud = calculateSaasCommission({
      contractValueCents: 1_200_000,
      recurringMonthlyCents: 100_000,
      directCostsCents: 0,
      recurringCostsCents: 0,
      taxesCents: 0,
      hostingModel: 'client_cloud',
      policy,
    })

    expect(bitCloud.devCommissionCents).toBe(72_000)
    expect(clientCloud.devCommissionCents).toBe(72_000)
    expect(bitCloud.recurringEligibleMonths).toBe(3)
    expect(bitCloud.recurringCommissionPotentialCents).toBe(30_000)
    expect(clientCloud.recurringCommissionPotentialCents).toBe(0)
  })

  it('considera os custos recorrentes no mesmo horizonte da margem', () => {
    const withoutRecurringCosts = calculateSaasCommission({
      contractValueCents: 300_000,
      recurringMonthlyCents: 100_000,
      directCostsCents: 50_000,
      recurringCostsCents: 0,
      taxesCents: 0,
      hostingModel: 'bit_cloud',
      policy,
    })
    const withRecurringCosts = calculateSaasCommission({
      contractValueCents: 300_000,
      recurringMonthlyCents: 100_000,
      directCostsCents: 50_000,
      recurringCostsCents: 50_000,
      taxesCents: 0,
      hostingModel: 'bit_cloud',
      policy,
    })

    expect(withRecurringCosts.marginPercentage).toBeLessThan(withoutRecurringCosts.marginPercentage)
    expect(withRecurringCosts.marginPercentage).toBeCloseTo(340_000 / 600_000)
  })

  it('gera parcelas com soma exata e libera comissão proporcional sem ultrapassar o teto', () => {
    const plan = buildReceivablePlan({
      contractValueCents: 1_200_001,
      installmentsCount: 3,
      recurringMonthlyCents: 0,
      recurringEligibleMonths: 3,
      hostingModel: 'client_cloud',
      firstDueDate: new Date('2026-01-10T12:00:00Z'),
    })
    expect(plan.reduce((total, item) => total + item.amount_cents, 0)).toBe(1_200_001)
    expect(
      calculateReleaseForReceivable({
        receivableAmountCents: 400_000,
        lineTotalCents: 1_200_000,
        lineCommissionCents: 72_000,
        alreadyReleasedCents: 0,
      }),
    ).toBe(24_000)
    expect(
      calculateReleaseForReceivable({
        receivableAmountCents: 400_000,
        lineTotalCents: 1_200_000,
        lineCommissionCents: 72_000,
        alreadyReleasedCents: 60_000,
      }),
    ).toBe(12_000)
  })

  it('bloqueia a liberação enquanto houver aprovação pendente', () => {
    expect(
      deriveCommissionStatus({
        currentStatus: 'pendente_aprovacao',
        requiresApproval: true,
        isApproved: false,
        totalCommissionCents: 72_000,
        releasedCents: 24_000,
      }),
    ).toBe('pendente_aprovacao')
  })
})

describe('comissionamento SaaS - contrato de segurança e integração', () => {
  it('bloqueia escritas financeiras diretas nas coleções', () => {
    const migration = source('pocketbase/migrations/0038_harden_saas_commission_writes.js')
    expect(migration).toContain("'saas_commissions'")
    expect(migration).toContain("'saas_commission_receivables'")
    expect(migration).toContain("'saas_commission_releases'")
    expect(migration).toContain('collection.createRule = null')
    expect(migration).toContain('collection.updateRule = null')
    expect(migration).toContain('events.createRule = null')
  })

  it('centraliza mutações em rota autenticada, transacional e idempotente', () => {
    const hook = source('pocketbase/hooks/commission_saas_operations.js')
    expect(hook).toContain("'/backend/v1/commissions/saas/{action}'")
    expect(hook).toContain('$apis.requireAuth()')
    expect(hook).toContain('$app.runInTransaction')
    expect(hook).toContain("'DUPLICATE_COMMISSION'")
    expect(hook).toContain("'idempotency_key'")
    expect(hook).toContain("'ADMIN_REQUIRED'")
  })

  it('mantém auxiliares dentro do callback para compatibilidade com a JSVM do PocketBase', () => {
    const hook = source('pocketbase/hooks/commission_saas_operations.js')
    const routeStart = hook.indexOf('routerAdd(')
    expect(routeStart).toBeGreaterThanOrEqual(0)
    expect(hook.slice(0, routeStart)).not.toMatch(/function commissionSaas/)
    expect(hook.slice(routeStart)).toContain('function commissionSaasIsAdmin')
  })

  it('frontend não grava diretamente nas coleções financeiras', () => {
    const service = source('src/services/commissionSaas.ts')
    expect(service).toContain("'/backend/v1/commissions/saas'")
    expect(service).not.toMatch(/collection\('saas_[^']+'\)\.create\(/)
    expect(service).not.toMatch(/collection\('saas_[^']+'\)\.update\(/)
    expect(service).not.toMatch(/collection\('saas_[^']+'\)\.delete\(/)
  })

  it('mantém o módulo atual e renderiza todas as áreas SaaS de forma incremental', () => {
    const page = source('src/pages/Commission.tsx')
    expect(page).toContain("activeTab === 'atuais'")
    expect(page).toContain('<SaasOverview')
    expect(page).toContain('<SaasCommissionsList')
    expect(page).toContain('<SaasSimulator')
    expect(page).toContain('<SaasPolicies')
    expect(page).toContain('<SaasHistory')
  })
})
