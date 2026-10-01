import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setLoading(true)

    try {
      const { error } = await signIn(email.trim(), password)
      if (error) {
        setErrorMessage('Credenciais inválidas. Verifique seu e-mail e senha de convite.')
      } else {
        navigate('/painel')
      }
    } catch {
      setErrorMessage('Erro ao tentar conectar ao servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0A0B0E]">
      {/* Glows de fundo no estilo lbertanha.com */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        {/* Cabeçalho do Card */}
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo size="lg" className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Acessar o CRM</h1>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">
            Entre com as credenciais da sua conta comercial ou convite de acesso
          </p>
        </div>

        {/* Card de Formulário */}
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-7 shadow-2xl backdrop-blur-sm relative">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {errorMessage && (
            <div className="mb-5 flex items-center gap-2 p-3 text-sm text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-gray-300">
                E-mail corporativo
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-medium text-gray-300">
                  Senha
                </Label>
                <Link
                  to="/esqueci-senha"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Entrar no Painel'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#262A33]/80 text-center">
            <p className="text-xs text-gray-500">
              Acesso exclusivo por convite da equipe comercial.
              <br />
              Dúvidas? Fale com a liderança ou administrador.
            </p>
          </div>
        </div>

        {/* Rodapé sutil com dados de acesso do administrador */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-600">
            Acesso administrador:{' '}
            <span className="text-gray-400 font-mono">leandro.bertanha@lbertanha.com</span> /{' '}
            <span className="text-gray-400 font-mono">Skip@Pass</span>
          </p>
        </div>
      </div>
    </div>
  )
}
