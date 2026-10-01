import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export interface AuthUser extends RecordModel {
  email: string
  name?: string
  avatar?: string
  role?: 'admin' | 'seller' | string
  mustChangePassword?: boolean
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  isAdmin: boolean
  mustChangePassword: boolean
  signIn: (email: string, pass: string) => Promise<{ error: Error | null; user?: AuthUser }>
  signOut: () => void
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>
  confirmPasswordReset: (token: string, password: string) => Promise<{ error: Error | null }>
  requestEmailChange: (newEmail: string) => Promise<{ error: Error | null }>
  confirmEmailChange: (token: string, password: string) => Promise<{ error: Error | null }>
  updateProfile: (data: { name?: string }) => Promise<{ error: Error | null; record?: AuthUser }>
  changePassword: (
    oldPassword: string,
    newPassword: string,
    passwordConfirm: string,
  ) => Promise<{ error: Error | null; record?: AuthUser }>
  setFirstPassword: (
    newPassword: string,
    passwordConfirm: string,
    oldPassword?: string,
  ) => Promise<{ error: Error | null; record?: AuthUser }>
  tempLoginPassword: string | null
  setTempLoginPassword: (pass: string | null) => void
  refreshAuth: () => Promise<void>
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

  useEffect(() => {
    setUser((pb.authStore.record as unknown as AuthUser) || null)
    setToken(pb.authStore.token || null)
    setIsLoading(false)

    const unsubscribe = pb.authStore.onChange((newToken, record) => {
      setToken(newToken)
      setUser((record as unknown as AuthUser) || null)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const signIn = async (email: string, pass: string) => {
    try {
      const res = await pb.collection('users').authWithPassword(email, pass)
      const authUser = res.record as unknown as AuthUser
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

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
    updateTempLoginPassword(null)
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

  const refreshAuth = async () => {
    try {
      if (pb.authStore.isValid) {
        const refreshed = await pb.collection('users').authRefresh()
        const authUser = refreshed.record as unknown as AuthUser
        setUser(authUser)
        setToken(refreshed.token)
      }
    } catch (err) {
      console.warn('Erro ao atualizar sessão:', err)
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

  // Alteração de senha quando o usuário já sabe a senha atual (menu Perfil)
  const changePassword = async (
    oldPassword: string,
    newPassword: string,
    passwordConfirm: string,
  ) => {
    const activeUserId = pb.authStore.record?.id || user?.id
    const activeEmail = (pb.authStore.record as unknown as AuthUser)?.email || user?.email

    if (!activeUserId) {
      return { error: new Error('Sessão expirada. Faça login novamente.') }
    }

    // 1. Tentar primeiro via hook customizado
    try {
      const res = await pb.send<{
        success: boolean
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
        try {
          await refreshAuth()
        } catch {
          /* intentionally ignored */
        }
        return { error: null, record: (pb.authStore.record as unknown as AuthUser) || undefined }
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
    try {
      const updated = await pb.collection('users').update(activeUserId, {
        oldPassword,
        password: newPassword,
        passwordConfirm,
        mustChangePassword: false,
      })
      const authUser = updated as unknown as AuthUser
      setUser(authUser)
      return { error: null, record: authUser }
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

  // Definição de nova senha no primeiro acesso (quando mustChangePassword == true)
  const setFirstPassword = async (
    newPassword: string,
    passwordConfirm: string,
    oldPassword?: string,
  ) => {
    const activeUserId = pb.authStore.record?.id || user?.id
    const activeEmail = (pb.authStore.record as unknown as AuthUser)?.email || user?.email

    if (!activeUserId) {
      return {
        error: new Error('Sessão expirada. Por favor, faça login novamente para continuar.'),
      }
    }

    const effectiveOldPassword = oldPassword || tempLoginPassword || undefined

    // 1. Tentar primeiro via hook customizado seguro que aceita e valida a senha
    try {
      const res = await pb.send<{
        success: boolean
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
        // Atualiza a sessão local
        updateTempLoginPassword(null)
        try {
          await refreshAuth()
        } catch {
          /* intentionally ignored */
        }

        // Se o record em authStore ainda tiver mustChangePassword=true, força atualização local
        if (pb.authStore.record) {
          try {
            const currentRec = pb.authStore.record
            currentRec.mustChangePassword = false
            setUser({ ...(currentRec as unknown as AuthUser), mustChangePassword: false })
          } catch {
            /* intentionally ignored */
          }
        }

        return { error: null, record: (pb.authStore.record as unknown as AuthUser) || undefined }
      }
    } catch (hookErr: unknown) {
      // Se o erro do hook for uma validação explícita de senha incorreta ou formato, repassa imediatamente
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
      const authUser = updated as unknown as AuthUser
      setUser(authUser)
      updateTempLoginPassword(null)
      return { error: null, record: authUser }
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
        signIn,
        signOut,
        requestPasswordReset,
        confirmPasswordReset,
        requestEmailChange,
        confirmEmailChange,
        updateProfile,
        changePassword,
        setFirstPassword,
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
