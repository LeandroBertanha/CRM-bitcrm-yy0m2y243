import { describe, it, expect, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'

describe('Fluxo de Primeiro Acesso e Troca de Senha', () => {
  const testEmail = 'vendedor.teste.acesso@lbertanha.com'
  const tempPass = '1234mudar'
  const newPass = '123456mudei'

  it('deve autenticar o usuário de primeiro acesso com a senha temporária', async () => {
    pb.authStore.clear()
    const authRes = await pb.collection('users').authWithPassword(testEmail, tempPass)
    expect(authRes.token).toBeTruthy()
    expect(authRes.record.email).toBe(testEmail)
    expect(authRes.record.mustChangePassword).toBe(true)
  })

  it('deve salvar a nova senha com sucesso através do endpoint customizado POST /backend/v1/auth/set-first-password', async () => {
    // Autentica
    const authRes = await pb.collection('users').authWithPassword(testEmail, tempPass)
    const userId = authRes.record.id

    // Chama o endpoint customizado
    const res = await pb.send<{
      success: boolean
      message: string
      user: { id: string; mustChangePassword: boolean }
    }>('/backend/v1/auth/set-first-password', {
      method: 'POST',
      body: {
        userId: userId,
        email: testEmail,
        oldPassword: tempPass,
        password: newPass,
        passwordConfirm: newPass,
      },
    })

    expect(res.success).toBe(true)
    expect(res.user.mustChangePassword).toBe(false)

    // Verifica que agora consegue logar com a nova senha
    pb.authStore.clear()
    const newAuth = await pb.collection('users').authWithPassword(testEmail, newPass)
    expect(newAuth.token).toBeTruthy()
    expect(newAuth.record.mustChangePassword).toBe(false)
  })

  it('deve rejeitar troca se a senha atual informada estiver incorreta', async () => {
    await pb.collection('users').authWithPassword(testEmail, newPass)

    try {
      await pb.send('/backend/v1/auth/set-first-password', {
        method: 'POST',
        body: {
          email: testEmail,
          oldPassword: 'senhaErrada123',
          password: 'outraNovaSenha123',
          passwordConfirm: 'outraNovaSenha123',
        },
      })
      expect.fail('Deveria ter falhado com senha atual incorreta')
    } catch (err: unknown) {
      const errData =
        err && typeof err === 'object' && 'data' in err
          ? (err as { data: { error?: string } }).data
          : null
      expect(errData?.error).toMatch(/incorreta/)
    }
  })

  it('fallback: deve permitir atualização de senha via SDK padrão do PocketBase', async () => {
    const authRes = await pb.collection('users').authWithPassword(testEmail, newPass)
    const userId = authRes.record.id

    // Fallback standard PocketBase SDK update
    const updated = await pb.collection('users').update(userId, {
      oldPassword: newPass,
      password: tempPass,
      passwordConfirm: tempPass,
      mustChangePassword: false,
    })

    expect(updated.id).toBe(userId)
    expect(updated.mustChangePassword).toBe(false)

    // Valida que voltou a logar com tempPass
    pb.authStore.clear()
    const verifyAuth = await pb.collection('users').authWithPassword(testEmail, tempPass)
    expect(verifyAuth.token).toBeTruthy()
  })
})
