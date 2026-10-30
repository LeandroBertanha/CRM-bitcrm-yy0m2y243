import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('contrato backend do cadastro de clientes', () => {
  it('mantém a migração aditiva, os documentos protegidos e a unicidade por oportunidade', () => {
    const migration = readSource('pocketbase/migrations/0042_create_clients.js')

    expect(migration).toContain("name: 'clients'")
    expect(migration).toContain("name: 'contract_files'")
    expect(migration).toContain("name: 'proposal_files'")
    expect(migration).toContain("name: 'cnpj_card_files'")
    expect(migration.match(/protected: true/g)?.length).toBe(4)
    expect(migration).toContain('CREATE UNIQUE INDEX idx_clients_source_opportunity')
    expect(migration).toContain('Rollback intencionalmente não destrutivo')
  })

  it('mantém a mudança de estágio e a conversão dentro da mesma transação', () => {
    const hook = readSource('pocketbase/hooks/client_conversion.js')

    expect(hook).toContain("'/backend/v1/opportunities/{id}/stage'")
    expect(hook).toContain('$app.runInTransaction')
    expect(hook).toContain("if (stage === 'Ganho')")
    expect(hook).toContain("findFirstRecordByData('clients', 'source_opportunity'")
    expect(hook).toContain('clientCreated')
  })

  it('impede exclusão de cliente e restringe a carteira no esquema versionado', () => {
    const schema = JSON.parse(readSource('src/lib/pocketbase/schema.json'))
    const clients = schema.collections.find(
      (collection: { name: string }) => collection.name === 'clients',
    )

    expect(clients).toBeTruthy()
    expect(clients.apiRules.delete).toBeNull()
    expect(clients.apiRules.list).toContain('seller = @request.auth.id')
    expect(
      clients.fields.some((field: { name: string }) => field.name === 'source_opportunity'),
    ).toBe(true)
  })

  it('retroalimenta oportunidades que já estavam ganhas sem duplicar clientes', () => {
    const migration = readSource('pocketbase/migrations/0043_backfill_won_clients.js')

    expect(migration).toContain("stage = 'Ganho'")
    expect(migration).toContain("findFirstRecordByData('clients', 'source_opportunity'")
    expect(migration).toContain("client.set('source_opportunity', opportunity.id)")
    expect(migration).toContain('Rollback intencionalmente não destrutivo')
  })
})
