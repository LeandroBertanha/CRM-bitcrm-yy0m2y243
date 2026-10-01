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
  ) => Promise<{ error: Error | null; record?: AuthUser }>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(
    (pb.authStore.record as unknown as AuthUser) || null,
  )
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
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
      return { error: null, user: authUser }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  const signOut = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
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
    if (!pb.authStore.record?.id) {
      return { error: new Error('Não autenticado') }
    }
    try {
      const updated = await pb.collection('users').update(pb.authStore.record.id, {
        oldPassword,
        password: newPassword,
        passwordConfirm,
        mustChangePassword: false,
      })
      const authUser = updated as unknown as AuthUser
      setUser(authUser)
      return { error: null, record: authUser }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }

  // Definição de nova senha no primeiro acesso (quando mustChangePassword == true)
  const setFirstPassword = async (newPassword: string, passwordConfirm: string) => {
    if (!pb.authStore.record?.id) {
      return { error: new Error('Não autenticado') }
    }
    try {
      const updated = await pb.collection('users').update(pb.authStore.record.id, {
        password: newPassword,
        passwordConfirm,
        mustChangePassword: false,
      })
      const authUser = updated as unknown as AuthUser
      setUser(authUser)
      return { error: null, record: authUser }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
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
