import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'pocketbase/migrations/0044_update_whatsapp_standard_pricing.js'),
  'utf8',
)

describe('migration da tabela comercial vigente do WhatsApp', () => {
  it('atualiza somente o produto WhatsApp Autônomo para 497 e 397', () => {
    expect(migration).toContain("normalizedName.includes('whatsapp')")
    expect(migration).toContain("normalizedName.includes('autonomo')")
    expect(migration).toContain("product.set('setup_value', 497)")
    expect(migration).toContain("product.set('recurring_value', 397)")
  })

  it('não altera oportunidades existentes', () => {
    expect(migration).not.toContain("findRecordsByFilter('opportunities'")
    expect(migration).not.toContain("findCollectionByNameOrId('opportunities'")
  })
})
