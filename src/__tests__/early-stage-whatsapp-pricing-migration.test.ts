import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  new URL(
    '../../pocketbase/migrations/0044_update_early_stage_whatsapp_pricing.js',
    import.meta.url,
  ),
  'utf8',
)

describe('migração de preço das oportunidades WhatsApp', () => {
  it('aplica 497/397 somente em Novo e Qualificado', () => {
    expect(migration).toContain("stage IN ('Novo', 'Qualificado')")
    expect(migration).toContain('SET value = 497')
    expect(migration).toContain('recurring_value = 397')
  })

  it('restringe a atualização ao produto WhatsApp', () => {
    expect(migration).toContain("LOWER(COALESCE(product_name, '')) LIKE '%whatsapp%'")
    expect(migration).toContain("LOWER(COALESCE(name, '')) LIKE '%whatsapp%'")
  })

  it('é idempotente e mantém rollback não destrutivo', () => {
    expect(migration).toContain('COALESCE(value, 0) != 497')
    expect(migration).toContain('COALESCE(recurring_value, 0) != 397')
    expect(migration).toContain('Rollback intencionalmente não destrutivo')
  })
})
