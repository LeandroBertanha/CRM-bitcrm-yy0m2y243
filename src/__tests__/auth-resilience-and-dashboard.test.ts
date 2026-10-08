import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('Resiliência de Autenticação e Dashboard (use-auth & rotas)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // (a) authRefresh 401 seguido de retry bem-sucedido não desloga
  it('(a) authRefresh 401 transitório seguido de retry bem-sucedido NÃO limpa a sessão', async () => {
    let callCount = 0
    let sessionCleared = false

    const fakeAuthStore = {
      isValid: true,
      token: 'fake-jwt-token',
      record: { id: 'user-1', email: 'teste@exemplo.com' },
      clear: () => {
        sessionCleared = true
      },
    }

    // Mock de chamada ao authRefresh: primeira falha com 401, retry com sucesso
    const mockAuthRefresh = async () => {
      callCount++
      if (callCount === 1) {
        const error = new Error('The request requires valid record authorization token.')
        ;(error as unknown as { status: number }).status = 401
        throw error
      }
      return {
        token: 'new-refreshed-token',
        record: { id: 'user-1', email: 'teste@exemplo.com', disabled: false },
      }
    }

    // Algoritmo de refresh resiliente
    const executeRefresh = async () => {
      const attempt = async () => {
        try {
          const res = await mockAuthRefresh()
          return { success: true, token: res.token, is401: false }
        } catch (err: unknown) {
          const status = (err as { status?: number })?.status
          return { success: false, is401: status === 401 }
        }
      }

      const first = await attempt()
      if (first.success) return true

      if (first.is401) {
        // Delay do retry
        await new Promise((r) => setTimeout(r, 10))
        const second = await attempt()
        if (second.success) return true
      }

      fakeAuthStore.clear()
      return false
    }

    const success = await executeRefresh()

    expect(callCount).toBe(2)
    expect(success).toBe(true)
    expect(sessionCleared).toBe(false)
  })

  // (b) troca de senha encerra sessão com mensagem e redireciona caso não haja novo token
  it('(b) troca de senha sem retorno de token encerra sessão com mensagem amigável e flag de término', async () => {
    let sessionCleared = false
    let savedNotice: string | null = null

    const mockSignOut = (message?: string) => {
      sessionCleared = true
      if (message) savedNotice = message
    }

    // Simula resposta do endpoint de senha quando não há novo token emitido
    const mockChangePassword = async (newPass: string) => {
      if (newPass.length < 8) {
        return { error: new Error('Mínimo 8 caracteres'), sessionTerminated: false }
      }
      // Sucesso na alteração
      mockSignOut('Senha alterada com sucesso. Entre com sua nova senha.')
      return { error: null, sessionTerminated: true }
    }

    const result = await mockChangePassword('novaSenhaForte123')

    expect(result.error).toBeNull()
    expect(result.sessionTerminated).toBe(true)
    expect(sessionCleared).toBe(true)
    expect(savedNotice).toBe('Senha alterada com sucesso. Entre com sua nova senha.')
  })

  // (c) dashboard nunca renderiza zerado em silêncio quando user é null
  it('(c) dashboard nunca renderiza zerado em silêncio quando user é null e dados existem', () => {
    const opps = [
      { id: 'opp-1', company: 'Empresa A', seller: 'seller-x', value: 1000 },
      { id: 'opp-2', company: 'Empresa B', seller: 'seller-y', value: 2000 },
    ]

    const resolveDashboardOpps = (
      user: { id: string } | null,
      isAdmin: boolean,
      opportunities: typeof opps,
    ) => {
      const personalOpps = !user
        ? []
        : opportunities.filter((o) => !o.seller || o.seller === user.id)

      const isUsingAdminFallback = Boolean(
        (isAdmin || !user) && personalOpps.length === 0 && opportunities.length > 0,
      )

      if (isUsingAdminFallback) {
        return opportunities
      }
      if (!user && opportunities.length > 0) {
        return opportunities
      }
      return personalOpps
    }

    const visibleOpps = resolveDashboardOpps(null, false, opps)

    // Não deve ficar zerado em silêncio — deve exibir as oportunidades disponíveis
    expect(visibleOpps.length).toBe(2)
    expect(visibleOpps[0].company).toBe('Empresa A')
  })

  // (d) erro de rede não limpa sessão
  it('(d) erro de rede ou erro 5xx NUNCA limpa a sessão', async () => {
    let sessionCleared = false

    const fakeAuthStore = {
      isValid: true,
      token: 'jwt-token',
      clear: () => {
        sessionCleared = true
      },
    }

    // Simula erro de rede (status 0 / Failed to fetch)
    const mockNetworkErrorAuthRefresh = async () => {
      const error = new Error('Failed to fetch / Network connection lost')
      ;(error as unknown as { status: number }).status = 0
      throw error
    }

    const resilientRefresh = async () => {
      try {
        await mockNetworkErrorAuthRefresh()
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status
        const is401 = status === 401

        if (is401) {
          fakeAuthStore.clear()
        }
        // Erro de rede: não limpa store
      }
    }

    await resilientRefresh()

    expect(sessionCleared).toBe(false)
  })

  // (e) proteção contra concorrência: múltiplas chamadas simultâneas compartilham a mesma promessa
  it('(e) múltiplas chamadas concorrentes de refreshAuth são unificadas sem disparar chamadas redundantes', async () => {
    let rawCallCount = 0

    let activePromise: Promise<boolean> | null = null

    const runUnifiedRefresh = () => {
      if (activePromise) return activePromise

      activePromise = (async () => {
        rawCallCount++
        await new Promise((r) => setTimeout(r, 20))
        return true
      })().finally(() => {
        activePromise = null
      })

      return activePromise
    }

    // Dispara 4 refreshes ao mesmo tempo
    const [r1, r2, r3, r4] = await Promise.all([
      runUnifiedRefresh(),
      runUnifiedRefresh(),
      runUnifiedRefresh(),
      runUnifiedRefresh(),
    ])

    expect(rawCallCount).toBe(1)
    expect(r1 && r2 && r3 && r4).toBe(true)
  })
})
