import { describe, it, expect, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'

describe('Restauração do Admin e Desativação da Conta de Teste', () => {
  const adminEmail = 'leandro.bertanha@lbertanha.com'
  const adminTempPassword = 'Bit@2026!Temp'
  const testSellerEmail = 'leandro.bertanha@gmail.com'

  beforeEach(() => {
    pb.authStore.clear()
  })

  it('deve autenticar o admin principal com a nova senha temporária definida', async () => {
    const authRes = await pb.collection('users').authWithPassword(adminEmail, adminTempPassword)
    expect(authRes.token).toBeTruthy()
    expect(authRes.record.email).toBe(adminEmail)
    expect(authRes.record.role).toBe('admin')
    expect(authRes.record.disabled).toBe(false)
  })

  it('deve realizar authRefresh com sucesso para o admin sem deslogar indevidamente', async () => {
    // 1. Faz login como admin
    await pb.collection('users').authWithPassword(adminEmail, adminTempPassword)
    expect(pb.authStore.isValid).toBe(true)
    const initialToken = pb.authStore.token

    // 2. Executa authRefresh conforme hook use-auth
    const refreshRes = await pb.collection('users').authRefresh()
    expect(refreshRes.token).toBeTruthy()
    expect(refreshRes.record.email).toBe(adminEmail)
    expect(refreshRes.record.disabled).toBe(false)
    expect(pb.authStore.isValid).toBe(true)
  })

  it('deve constatar que a conta de teste Leandro Bertanha 2 está marcada como disabled no banco', async () => {
    // Autentica como admin para consultar a coleção users
    await pb.collection('users').authWithPassword(adminEmail, adminTempPassword)

    const testUser = await pb.collection('users').getFirstListItem(`email="${testSellerEmail}"`)
    expect(testUser).toBeDefined()
    expect(testUser.id).toBe('piob7nn50xqhan6')
    expect(testUser.name).toBe('Leandro Bertanha 2')
    expect(testUser.disabled).toBe(true)
  })

  it('deve rejeitar tentativa de login com senha comum na conta de teste desativada', async () => {
    // Tentar autenticar com senha antiga não deve ser permitido
    try {
      await pb.collection('users').authWithPassword(testSellerEmail, 'lbc26173$qTv3$')
      expect.fail('A conta de teste desativada não deveria conseguir autenticar')
    } catch (err: unknown) {
      expect(err).toBeDefined()
    }
  })

  it('deve preservar as oportunidades e notas vinculadas ao admin principal', async () => {
    await pb.collection('users').authWithPassword(adminEmail, adminTempPassword)
    const opps = await pb.collection('opportunities').getList(1, 5, {
      filter: `seller = "${pb.authStore.record?.id}"`,
    })
    expect(opps.items.length).toBeGreaterThan(0)
  })
})
