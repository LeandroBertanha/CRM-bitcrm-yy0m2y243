import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { confirmPasswordReset } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (password.length < 8) {
      setErrorMessage('A senha precisa ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.')
      return
    }

    if (!token) {
      setErrorMessage('Token de redefinição não encontrado ou expirado.')
      return
    }

    setLoading(true)

    try {
      const { error } = await confirmPasswordReset(token, password)
      if (error) {
        setErrorMessage('O token é inválido ou já expirou. Solicite um novo link.')
      } else {
        setSuccess(true)
        setTimeout(() => {
          navigate('/login')
        }, 3000)
      }
    } catch {
      setErrorMessage('Erro ao tentar redefinir senha.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0A0B0E]">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo variant="full" size="xl" showCrmBadge={false} className="mb-3" />
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Nova Senha</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            Defina sua nova senha de acesso ao CRM
          </p>
        </div>

        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-7 shadow-2xl backdrop-blur-sm relative">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {success ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">Senha redefinida com sucesso!</h2>
              <p className="text-sm text-gray-400">
                Sua credencial foi atualizada. Você será redirecionado para a tela de login em
                instantes.
              </p>
              <div className="pt-4">
                <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Link to="/login">Ir para Login agora</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {(!token || errorMessage) && (
                <div className="mb-5 flex items-center gap-2 p-3 text-sm text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>
                    {!token
                      ? 'Nenhum token fornecido no link. Acesse a partir do e-mail recebido.'
                      : errorMessage}
                  </span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium text-gray-300">
                    Nova Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-gray-300">
                    Confirmar Nova Senha
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Repita a senha"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 bg-[#0E1017] border-[#262A33] text-white placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando nova senha...
                    </>
                  ) : (
                    'Definir nova senha'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#262A33]/80 text-center">
                <Link
                  to="/login"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  Voltar para a tela de login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
