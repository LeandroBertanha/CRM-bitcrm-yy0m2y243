import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isSystemOwner, SYSTEM_OWNER_EMAIL } from '@/lib/ownerAccess'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('acesso proprietário ao comissionamento e produtos', () => {
  it('reconhece somente o login mestre', () => {
    expect(isSystemOwner(SYSTEM_OWNER_EMAIL)).toBe(true)
    expect(isSystemOwner(' LEANDRO.BERTANHA@LBERTANHA.COM ')).toBe(true)
    expect(isSystemOwner('leandro.bertanha@gmail.com')).toBe(false)
    expect(isSystemOwner('outro.admin@lbertanha.com')).toBe(false)
    expect(isSystemOwner(null)).toBe(false)
  })

  it('exibe a política SaaS para todos e reserva produtos ao proprietário', () => {
    const page = source('src/pages/Commission.tsx')
    expect(page).toContain('Comissões WP/SiteLP')
    expect(page).toContain('Política SaaS')
    expect(page).toContain("activeTab === 'politicas'")
    expect(page).toContain('canManage={isCommissionOwner}')
    expect(page).toContain("activeTab === 'produtos' && isCommissionOwner")
  })

  it('oculta nova versão e exceções quando o usuário não é o proprietário', () => {
    const policies = source('src/components/commission/SaasPolicies.tsx')
    expect(policies).toContain('{canManage && (')
    expect(policies).toContain('{canManage && showForm && (')
    expect(policies).toContain('if (!canManage) return')
    expect(policies).toContain('Exceções por vendedor: informação e gestão exclusivas')
  })

  it('protege política, exceções e catálogo também no backend', () => {
    const hook = source('pocketbase/hooks/commission_saas_operations.js')
    const migration = source(
      'pocketbase/migrations/0041_restrict_commission_and_products_to_owner.js',
    )
    expect(hook).toContain('function commissionSaasIsOwner')
    expect(hook).toContain("'OWNER_REQUIRED'")
    expect(migration).toContain("@request.auth.email = 'leandro.bertanha@lbertanha.com'")
    expect(migration).toContain('products.createRule = owner')
    expect(migration).toContain('products.updateRule = owner')
    expect(migration).toContain('exceptions.listRule = owner')
    expect(migration).toContain('exceptions.viewRule = owner')
  })

  it('mantém os produtos ativos disponíveis nos seletores globais', () => {
    const service = source('src/services/productService.ts')
    const publicForm = source('src/pages/PublicForm.tsx')
    expect(service).toContain("filter: 'is_active = true'")
    expect(service).toContain("sort: 'display_order,name'")
    expect(publicForm).toContain("filter: 'is_active = true'")
  })
})
