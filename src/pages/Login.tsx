import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { TermsModal } from '@/components/TermsModal'
import { CURRENT_TERMS_VERSION } from '@/lib/terms-content'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'

const STORAGE_KEY_ACCEPTED_VERSION = 'bitcrm_terms_accepted_version'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [termsModalTab, setTermsModalTab] = useState<'termos' | 'privacidade'>('termos')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const { signIn, recordTermsConsent } = useAuth()
  const navigate = useNavigate()

  // Verifica se o usuário já aceitou a versão vigente dos termos neste navegador
  useEffect(() => {
    try {
      const storedVersion = localStorage.getItem(STORAGE_KEY_ACCEPTED_VERSION)
      if (storedVersion === CURRENT_TERMS_VERSION) {
        setAcceptedTerms(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  const openTerms = (tab: 'termos' | 'privacidade') => {
    setTermsModalTab(tab)
    setTermsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    // Validação estrita do aceite antes de qualquer tentativa de acesso
    if (!acceptedTerms) {
      setErrorMessage(
        'Você deve ler e aceitar o Termo de Serviço e a Política de Privacidade para acessar o bitCRM.',
      )
      return
    }

    setLoading(true)

    try {
      const { error, user: loggedUser } = await signIn(email.trim(), password)
      if (error) {
        const errorText = error.message || ''
        if (
          errorText.toLowerCase().includes('autenticar') ||
          errorText.toLowerCase().includes('failed to authenticate')
        ) {
          setErrorMessage('Credenciais inválidas. Verifique seu e-mail e senha de convite.')
        } else {
          setErrorMessage(
            errorText || 'Credenciais inválidas. Verifique seu e-mail e senha de convite.',
          )
        }
      } else {
        // Salva consentimento no localStorage
        try {
          localStorage.setItem(STORAGE_KEY_ACCEPTED_VERSION, CURRENT_TERMS_VERSION)
          localStorage.setItem('bitcrm_terms_accepted_at', new Date().toISOString())
        } catch {
          /* ignore */
        }

        // Se o usuário autenticado ainda não tem essa versão registrada no banco, salva
        if (loggedUser?.terms_accepted_version !== CURRENT_TERMS_VERSION) {
          try {
            await recordTermsConsent(CURRENT_TERMS_VERSION)
          } catch (consentErr) {
            console.warn('Erro não bloqueante ao registrar consentimento no banco:', consentErr)
          }
        }

        if (
          loggedUser?.mustChangePassword &&
          loggedUser?.email?.toLowerCase() !== 'leandro.bertanha@lbertanha.com'
        ) {
          navigate('/definir-senha', { replace: true })
        } else {
          navigate('/painel', { replace: true })
        }
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Erro ao tentar conectar ao servidor. Tente novamente.'
      setErrorMessage(msg)
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
        {/* Cabeçalho do Card com Logo Oficial Completo */}
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo variant="full" size="xl" showCrmBadge={false} className="mb-3" />
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

            {/* Checkbox obrigatório de Aceite dos Termos e Política de Privacidade */}
            <div className="pt-2 pb-1">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0E1017] border border-[#262A33] hover:border-indigo-500/40 transition-colors">
                <Checkbox
                  id="accept-terms"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(Boolean(checked))}
                  className="mt-0.5 border-gray-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <div className="text-xs leading-relaxed text-gray-300">
                  <label
                    htmlFor="accept-terms"
                    className="cursor-pointer select-none text-gray-300 font-normal"
                  >
                    Li e aceito o{' '}
                  </label>
                  <button
                    type="button"
                    onClick={() => openTerms('termos')}
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium focus:outline-none"
                  >
                    Termo de Serviço
                  </button>{' '}
                  e a{' '}
                  <button
                    type="button"
                    onClick={() => openTerms('privacidade')}
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium focus:outline-none"
                  >
                    Política de Privacidade
                  </button>
                  <span className="text-[11px] text-gray-500 block mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
                    Regras comerciais e proteção LGPD (Lei 13.709/2018)
                  </span>
                </div>
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
      </div>

      {/* Modal de Leitura Completa dos Termos */}
      <TermsModal
        open={termsModalOpen}
        onOpenChange={setTermsModalOpen}
        initialTab={termsModalTab}
        showAcceptButton={!acceptedTerms}
        onAccept={() => setAcceptedTerms(true)}
      />
    </div>
  )
}
