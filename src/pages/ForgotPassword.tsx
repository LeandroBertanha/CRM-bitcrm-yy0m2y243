import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { requestPasswordReset } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setLoading(true)

    try {
      const { error } = await requestPasswordReset(email.trim())
      if (error) {
        setErrorMessage('Não foi possível enviar o link. Verifique o e-mail digitado.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setErrorMessage('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0A0B0E]">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo size="lg" className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Recuperar Senha</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            Digite seu e-mail para receber as instruções de redefinição
          </p>
        </div>

        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-7 shadow-2xl backdrop-blur-sm relative">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {submitted ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">Link de recuperação enviado</h2>
              <p className="text-sm text-gray-400">
                Se o e-mail <span className="text-white font-medium">{email}</span> estiver
                cadastrado, você receberá um link seguro para cadastrar uma nova senha.
              </p>
              <div className="pt-4">
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-[#262A33] hover:bg-[#1A1D27] text-gray-200"
                >
                  <Link to="/login">Voltar para o Login</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="mb-5 flex items-center gap-2 p-3 text-sm text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-gray-300">
                    Seu e-mail cadastrado
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      required
                      placeholder="vendedor@empresa.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 bg-[#0E1017] border-[#262A33] text-white placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando instruções...
                    </>
                  ) : (
                    'Enviar link de recuperação'
                  )}
                </Button>
              </form>

              <div className="mt-6 pt-5 border-t border-[#262A33]/80 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                  Voltar para o login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
