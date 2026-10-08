import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface AuthUser extends RecordModel {
  email: string
  name?: string
  avatar?: string
  role?: 'admin' | 'seller' | string
  mustChangePassword?: boolean
  disabled?: boolean
  terms_accepted_version?: string
  terms_accepted_at?: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAdmin: boolean
  mustChangePassword: boolean
  isSessionExpired: boolean
  signIn: (email: string, pass: string) => Promise<{ error: Error | null; user?: AuthUser }>
  signOut: (message?: string) => void
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>
  confirmPasswordReset: (token: string, password: string) => Promise<{ error: Error | null }>
  requestEmailChange: (newEmail: string) => Promise<{ error: Error | null }>
  confirmEmailChange: (token: string, password: string) => Promise<{ error: Error | null }>
  updateProfile: (data: { name?: string }) => Promise<{ error: Error | null; record?: AuthUser }>
  changePassword: (
    oldPassword: string,
    newPassword: string,
    passwordConfirm: string,
  ) => Promise<{ error: Error | null; record?: AuthUser; sessionTerminated?: boolean }>
  setFirstPassword: (
    newPassword: string,
    passwordConfirm: string,
    oldPassword?: string,
  ) => Promise<{ error: Error | null; record?: AuthUser; sessionTerminated?: boolean }>
  recordTermsConsent: (version: string) => Promise<{ error: Error | null; record?: AuthUser }>
  tempLoginPassword: string | null
  setTempLoginPassword: (pass: string | null) => void
  refreshAuth: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(
    (pb.authStore.record as unknown as AuthUser) || null,
  )
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [tempLoginPassword, setTempLoginPassword] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('bitcrm_temp_login_pass') || null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false)

  // Guard contra chamadas concorrentes de refresh
  const activeRefreshPromiseRef = React.useRef<Promise<boolean> | null>(null)

  // Executa refresh resiliente com retry em caso de 401 e tolerância a erros de rede/5xx
  const executeResilientRefresh = React.useCallback(async (): Promise<boolean> => {
    if (!pb.authStore.isValid || !pb.authStore.token) {
      return false
    }

    // Se já houver um refresh em andamento, retorna a promessa ativa para evitar corrida
    if (activeRefreshPromiseRef.current) {
      return activeRefreshPromiseRef.current
    }

    const refreshTask = (async (): Promise<boolean> => {
      const attemptRefresh = async (): Promise<{ success: boolean; isPermanent401: boolean }> => {
        try {
          const refreshed = await pb.collection('users').authRefresh()
          const authUser = refreshed.record as unknown as AuthUser

          if (authUser?.disabled) {
            console.warn('[bitCRM Auth] Conta desativada detectada no authRefresh')
            pb.authStore.clear()
            setUser(null)
            setToken(null)
            updateTempLoginPassword(null)
            setIsSessionExpired(true)
            return { success: false, isPermanent401: true }
          }

          setUser(authUser)
          setToken(refreshed.token)
          setIsSessionExpired(false)
          return { success: true, isPermanent401: false }
        } catch (err: unknown) {
          const status =
            err && typeof err === 'object' && 'status' in err
              ? Number((err as { status?: number }).status)
              : 0
          const msg =
            err && typeof err === 'object' && 'message' in err
              ? String((err as { message?: string }).message)
              : ''
          const is401 =
            status === 401 ||
            msg.toLowerCase().includes('requires valid record authorization token') ||
            msg.toLowerCase().includes('failed to authenticate')

          // Erros de rede (status 0, timeout, fetch failed, 5xx): NUNCA deslogam
          if (!is401) {
            console.warn(
              '[bitCRM Auth] Falha temporária de rede/servidor no authRefresh (sessão preservada):',
              err,
            )
            return { success: false, isPermanent401: false }
          }

          return { success: false, isPermanent401: true }
        }
      }

      // Tentativa 1
      const firstTry = await attemptRefresh()
      if (firstTry.success) return true

      // Se falhou por motivo de rede/5xx (não 401), preservamos a sessão local intacta
      if (!firstTry.isPermanent401) {
        return false
      }

      // Se deu 401: aguarda pequeno delay (350ms) e tenta mais 1 vez
      await new Promise((resolve) => setTimeout(resolve, 350))
      const secondTry = await attemptRefresh()
      if (secondTry.success) return true

      if (!secondTry.isPermanent401) {
        // O retry falhou por rede, mantemos a sessão
        return false
      }

      // Se o retry também deu 401, fazemos checagem confirmatória contra uma query real de dados
      // para garantir que o token foi definitivamente revogado pelo servidor
      try {
        await pb.collection('opportunities').getList(1, 1, {
          fields: 'id',
          requestKey: null,
        })
        // Se a query de dados passou, o token ainda tem validade no banco! Não deslogamos.
        console.info('[bitCRM Auth] Query de dados confirmou token válido após falha de refresh')
        return false
      } catch (dataErr: unknown) {
        const dataStatus =
          dataErr && typeof dataErr === 'object' && 'status' in dataErr
            ? Number((dataErr as { status?: number }).status)
            : 0

        if (dataStatus === 401 || dataStatus === 403) {
          console.warn(
            '[bitCRM Auth] Token definitivamente revogado no backend (confirmado por query de dados). Limpando sessão.',
          )
          pb.authStore.clear()
          setUser(null)
          setToken(null)
          updateTempLoginPassword(null)
          setIsSessionExpired(true)
          return false
        }

        // Erro de rede na checagem: preserva sessão
        return false
      }
    })().finally(() => {
      activeRefreshPromiseRef.current = null
    })

    activeRefreshPromiseRef.current = refreshTask
    return refreshTask
  }, [])

  useEffect(() => {
    let isMounted = true

    // Sincroniza estado inicial do store
    setUser((pb.authStore.record as unknown as AuthUser) || null)
    setToken(pb.authStore.token || null)

    const validateSession = async () => {
      if (pb.authStore.isValid && pb.authStore.token) {
        try {
          await executeResilientRefresh()
        } catch {
          /* erro suprimido na inicialização */
        }
      }
      if (isMounted) {
        setIsLoading(false)
      }
    }

    validateSession()

    const unsubscribe = pb.authStore.onChange((newToken, record) => {
      if (!isMounted) return
      setToken(newToken)
      setUser((record as unknown as AuthUser) || null)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [executeResilientRefresh])

  const signIn = async (email: string, pass: string) => {
    try {
      const res = await pb.collection('users').authWithPassword(email, pass)
      const authUser = res.record as unknown as AuthUser

      // Bloqueio imediato de contas desativadas
      if (authUser?.disabled) {
        pb.authStore.clear()
        setUser(null)
        setToken(null)
        updateTempLoginPassword(null)
        return {
          error: new Error('Esta conta foi desativada. Fale com o administrador.'),
        }
      }

      setUser(authUser)
      setToken(res.token)
      if (authUser?.mustChangePassword) {
        updateTempLoginPassword(pass)
      } else {
        updateTempLoginPassword(null)
      }
      return { error: null, user: authUser }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  const updateTempLoginPassword = (pass: string | null) => {
    setTempLoginPassword(pass)
    try {
      if (pass) {
        sessionStorage.setItem('bitcrm_temp_login_pass', pass)
      } else {
        sessionStorage.removeItem('bitcrm_temp_login_pass')
      }
    } catch {
      /* intentionally ignored */
    }
  }

  const signOut = (message?: string) => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
    updateTempLoginPassword(null)
    if (message) {
      try {
        sessionStorage.setItem('bitcrm_logout_notice', message)
      } catch {
        /* ignore */
      }
    }
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  const confirmPasswordReset = async (resetToken: string, password: string) => {
    try {
      await pb.collection('users').confirmPasswordReset(resetToken, password, password)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  const requestEmailChange = async (newEmail: string) => {
    try {
      await pb.collection('users').requestEmailChange(newEmail)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  const confirmEmailChange = async (changeToken: string, password: string) => {
    try {
      await pb.collection('users').confirmEmailChange(changeToken, password)
      pb.authStore.clear()
      setUser(null)
      setToken(null)
      return { error: null }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  const refreshAuth = async (): Promise<boolean> => {
    try {
      return await executeResilientRefresh()
    } catch (err) {
      console.warn('[bitCRM Auth] Erro ao atualizar sessão:', err)
      return false
    }
  }

  const updateProfile = async (data: { name?: string }) => {
    if (!pb.authStore.record?.id) {
      return { error: new Error('Não autenticado') }
    }
    try {
      const updated = await pb.collection('users').update(pb.authStore.record.id, data)
      const authUser = updated as unknown as AuthUser
      setUser(authUser)
      return { error: null, record: authUser }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  // Registra o consentimento dos Termos e Política de Privacidade no banco para auditoria
  const recordTermsConsent = async (version: string) => {
    const activeUserId = pb.authStore.record?.id || user?.id
    if (!activeUserId) {
      return { error: new Error('Não autenticado') }
    }

    try {
      const nowIso = new Date().toISOString()
      const updated = await pb.collection('users').update(activeUserId, {
        terms_accepted_version: version,
        terms_accepted_at: nowIso,
      })
      const authUser = updated as unknown as AuthUser
      setUser(authUser)
      return { error: null, record: authUser }
    } catch (err) {
      console.warn('Não foi possível persistir aceite no usuário PocketBase:', err)
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  // Alteração de senha quando o usuário já sabe a senha atual (menu Perfil)
  const changePassword = async (
    oldPassword: string,
    newPassword: string,
    passwordConfirm: string,
  ): Promise<{ error: Error | null; record?: AuthUser; sessionTerminated?: boolean }> => {
    const activeUserId = pb.authStore.record?.id || user?.id
    const activeEmail = (pb.authStore.record as unknown as AuthUser)?.email || user?.email

    if (!activeUserId) {
      return { error: new Error('Sessão expirada. Faça login novamente.') }
    }

    // 1. Tentar primeiro via hook customizado
    let endpointSuccess = false
    let returnedToken: string | undefined
    let returnedUser: AuthUser | undefined

    try {
      const res = await pb.send<{
        success: boolean
        token?: string
        user?: AuthUser
        error?: string
      }>('/backend/v1/auth/set-first-password', {
        method: 'POST',
        body: {
          userId: activeUserId,
          email: activeEmail,
          password: newPassword,
          passwordConfirm,
          oldPassword,
        },
      })
      if (res && res.success) {
        endpointSuccess = true
        returnedToken = res.token
        returnedUser = res.user
      }
    } catch (hookErr: unknown) {
      const hookMsg =
        hookErr && typeof hookErr === 'object' && 'data' in hookErr
          ? String((hookErr as { data?: { error?: string } }).data?.error || '')
          : ''
      if (
        hookMsg.includes('incorreta') ||
        hookMsg.includes('caracteres') ||
        hookMsg.includes('coincidem') ||
        hookMsg.includes('diferente')
      ) {
        return { error: new Error(hookMsg) }
      }
    }

    // 2. Se o hook falhou, tenta fallback via SDK padrão do PocketBase
    if (!endpointSuccess) {
      try {
        const updated = await pb.collection('users').update(activeUserId, {
          oldPassword,
          password: newPassword,
          passwordConfirm,
          mustChangePassword: false,
        })
        returnedUser = updated as unknown as AuthUser
        endpointSuccess = true
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'data' in err
            ? String((err as { data?: { message?: string } }).data?.message || '')
            : err instanceof Error
              ? err.message
              : String(err)
        return { error: new Error(msg || 'Erro ao alterar a senha.') }
      }
    }

    // 3. Sucesso na alteração da senha:
    // Se o backend devolveu token novo válido, salva e atualiza a sessão imediatamente
    if (returnedToken) {
      pb.authStore.save(returnedToken, returnedUser || pb.authStore.record)
      setToken(returnedToken)
      if (returnedUser) setUser(returnedUser)
      return { error: null, record: returnedUser || (pb.authStore.record as unknown as AuthUser) }
    }

    // Se o backend NÃO devolve token novo (comportamento padrão do PB: trocar senha invalida os tokens antigos)
    // Encerra a sessão de forma LIMPA e EXPLÍCITA com mensagem amigável, nunca deixando em tela vazia
    signOut('Senha alterada com sucesso. Entre com sua nova senha.')
    return { error: null, sessionTerminated: true }
  }

  // Definição de nova senha no primeiro acesso (quando mustChangePassword == true)
  const setFirstPassword = async (
    newPassword: string,
    passwordConfirm: string,
    oldPassword?: string,
  ): Promise<{ error: Error | null; record?: AuthUser; sessionTerminated?: boolean }> => {
    const activeUserId = pb.authStore.record?.id || user?.id
    const activeEmail = (pb.authStore.record as unknown as AuthUser)?.email || user?.email

    if (!activeUserId) {
      return {
        error: new Error('Sessão expirada. Por favor, faça login novamente para continuar.'),
      }
    }

    const effectiveOldPassword = oldPassword || tempLoginPassword || undefined

    // 1. Tentar primeiro via hook customizado seguro que aceita e valida a senha
    let endpointSuccess = false
    let returnedToken: string | undefined
    let returnedUser: AuthUser | undefined

    try {
      const res = await pb.send<{
        success: boolean
        token?: string
        user?: AuthUser
        error?: string
      }>('/backend/v1/auth/set-first-password', {
        method: 'POST',
        body: {
          userId: activeUserId,
          email: activeEmail,
          password: newPassword,
          passwordConfirm,
          oldPassword: effectiveOldPassword,
        },
      })

      if (res && res.success) {
        endpointSuccess = true
        returnedToken = res.token
        returnedUser = res.user
      }
    } catch (hookErr: unknown) {
      const hookMsg =
        hookErr && typeof hookErr === 'object' && 'data' in hookErr
          ? String((hookErr as { data?: { error?: string } }).data?.error || '')
          : ''
      if (
        hookMsg.includes('incorreta') ||
        hookMsg.includes('caracteres') ||
        hookMsg.includes('coincidem') ||
        hookMsg.includes('diferente')
      ) {
        return { error: new Error(hookMsg) }
      }
    }

    // 2. Fallback via SDK padrão do PocketBase
    if (!endpointSuccess) {
      try {
        const payload: Record<string, unknown> = {
          password: newPassword,
          passwordConfirm,
          mustChangePassword: false,
        }
        if (effectiveOldPassword) {
          payload.oldPassword = effectiveOldPassword
        }

        const updated = await pb.collection('users').update(activeUserId, payload)
        returnedUser = updated as unknown as AuthUser
        endpointSuccess = true
      } catch (err: unknown) {
        const dataObj =
          err && typeof err === 'object' && 'data' in err
            ? (err as { data?: Record<string, unknown> }).data
            : null
        const dataMsg = dataObj?.message ? String(dataObj.message) : ''
        const msg = dataMsg || (err instanceof Error ? err.message : String(err))

        if (msg.includes("wasn't found") || msg.includes('404')) {
          return {
            error: new Error(
              'Não foi possível atualizar o usuário. Sua sessão pode ter sido alterada. Por favor, saia e entre novamente com seu e-mail.',
            ),
          }
        }

        return { error: new Error(msg || 'Erro ao definir nova senha.') }
      }
    }

    updateTempLoginPassword(null)

    // 3. Se tiver token novo retornado pelo servidor, absorve
    if (returnedToken) {
      pb.authStore.save(returnedToken, returnedUser || pb.authStore.record)
      setToken(returnedToken)
      if (returnedUser) setUser(returnedUser)
      return { error: null, record: returnedUser || (pb.authStore.record as unknown as AuthUser) }
    }

    // Se o backend não devolve novo token, encerra sessão de forma LIMPA e EXPLÍCITA
    signOut('Senha definida com sucesso! Entre com sua nova senha.')
    return { error: null, sessionTerminated: true }
  }

  const isAdmin = Boolean(
    user?.role === 'admin' || user?.email?.toLowerCase() === 'leandro.bertanha@lbertanha.com',
  )

  const mustChangePassword = Boolean(
    user?.mustChangePassword && user?.email?.toLowerCase() !== 'leandro.bertanha@lbertanha.com',
  )

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAdmin,
        mustChangePassword,
        isSessionExpired,
        signIn,
        signOut,
        requestPasswordReset,
        confirmPasswordReset,
        requestEmailChange,
        confirmEmailChange,
        updateProfile,
        changePassword,
        setFirstPassword,
        recordTermsConsent,
        tempLoginPassword,
        setTempLoginPassword: updateTempLoginPassword,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
