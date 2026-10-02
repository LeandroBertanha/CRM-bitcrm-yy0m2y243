import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { TermsModal } from '@/components/TermsModal'
import { CURRENT_TERMS_VERSION } from '@/lib/terms-content'
import { useToast } from '@/hooks/use-toast'
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  KeyRound,
  LogOut,
  ShieldCheck,
} from 'lucide-react'

const STORAGE_KEY_ACCEPTED_VERSION = 'bitcrm_terms_accepted_version'

export default function SetPassword() {
  const { user, setFirstPassword, signOut, tempLoginPassword, recordTermsConsent } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [currentPassword, setCurrentPassword] = useState(tempLoginPassword || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(
    user?.terms_accepted_version === CURRENT_TERMS_VERSION,
  )
  const [termsModalOpen, setTermsModalOpen] = useState(false)
  const [termsModalTab, setTermsModalTab] = useState<'termos' | 'privacidade'>('termos')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Validações de senha forte
  const hasMinLength = password.length >= 8
  const hasLetter = /[a-zA-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const passwordsMatch = password.length > 0 && password === confirmPassword

  const isPasswordValid = hasMinLength && hasLetter && hasNumber

  // Pontuação da força da senha
  const strengthScore = [
    hasMinLength,
    hasLetter,
    hasNumber,
    /[!@#$%^&*(),.?":{}|<>]/.test(password),
  ].filter(Boolean).length

  const getStrengthLabel = () => {
    if (!password) return { text: '', color: 'bg-gray-700' }
    if (strengthScore <= 1) return { text: 'Fraca', color: 'bg-red-500' }
    if (strengthScore === 2) return { text: 'Média', color: 'bg-amber-500' }
    if (strengthScore === 3) return { text: 'Boa', color: 'bg-blue-500' }
    return { text: 'Forte', color: 'bg-emerald-500' }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!isPasswordValid) {
      setErrorMessage('A senha deve conter pelo menos 8 caracteres, incluindo letras e números.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('As senhas não coincidem.')
      return
    }

    if (currentPassword && currentPassword === password) {
      setErrorMessage('A nova senha deve ser diferente da senha temporária atual.')
      return
    }

    if (!acceptedTerms) {
      setErrorMessage(
        'Você deve ler e aceitar o Termo de Serviço e a Política de Privacidade para concluir seu primeiro acesso.',
      )
      return
    }

    setLoading(true)
    try {
      const { error } = await setFirstPassword(
        password.trim(),
        confirmPassword.trim(),
        currentPassword.trim() || undefined,
      )
      if (error) {
        setErrorMessage(error.message || 'Erro ao definir nova senha. Tente novamente.')
      } else {
        // Registra consentimento no localStorage e banco
        try {
          localStorage.setItem(STORAGE_KEY_ACCEPTED_VERSION, CURRENT_TERMS_VERSION)
          localStorage.setItem('bitcrm_terms_accepted_at', new Date().toISOString())
        } catch {
          /* ignore */
        }

        try {
          await recordTermsConsent(CURRENT_TERMS_VERSION)
        } catch {
          /* ignore */
        }

        toast({
          title: 'Senha definida com sucesso!',
          description: 'Seu primeiro acesso foi concluído com sucesso. Bem-vindo ao bitCRM!',
        })
        navigate('/painel', { replace: true })
      }
    } catch {
      setErrorMessage('Erro ao conectar ao servidor. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelAndLogout = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0A0B0E]">
      {/* Glows de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        {/* Cabeçalho */}
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo variant="full" size="xl" showCrmBadge={false} className="mb-3" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" />
            Primeiro Acesso Obrigatório
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Defina sua Nova Senha</h1>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Por segurança, você deve definir uma senha definitiva e pessoal para continuar no
            bitCRM.
          </p>
        </div>

        {/* Card do Formulário */}
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-7 shadow-2xl backdrop-blur-sm relative">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Identificação do Usuário */}
          <div className="mb-5 p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-center justify-between text-xs">
            <div>
              <span className="text-gray-400 block text-[11px]">Usuário autenticado:</span>
              <span className="font-semibold text-white">{user?.name || user?.email}</span>
            </div>
            <button
              type="button"
              onClick={handleCancelAndLogout}
              className="text-gray-400 hover:text-red-400 flex items-center gap-1 text-[11px] transition-colors"
              title="Trocar de conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>

          {errorMessage && (
            <div className="mb-5 flex items-start gap-2 p-3 text-xs text-red-300 bg-red-950/40 border border-red-800/60 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Senha Atual / Temporária */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-300">
                  Senha Atual / Temporária
                </Label>
                {tempLoginPassword && (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Capturada do login
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Senha usada para entrar"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  {showCurrentPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                A senha provisória que você recebeu por e-mail ou convite.
              </p>
            </div>

            {/* Nova Senha */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-300">Nova Senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Medidor de Força */}
              {password && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Força da senha:</span>
                    <span className="font-semibold text-gray-300">{getStrengthLabel().text}</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#1F2430] rounded-full overflow-hidden flex gap-1">
                    <div
                      className={`h-full flex-1 transition-colors ${
                        strengthScore >= 1 ? getStrengthLabel().color : 'bg-transparent'
                      }`}
                    />
                    <div
                      className={`h-full flex-1 transition-colors ${
                        strengthScore >= 2 ? getStrengthLabel().color : 'bg-transparent'
                      }`}
                    />
                    <div
                      className={`h-full flex-1 transition-colors ${
                        strengthScore >= 3 ? getStrengthLabel().color : 'bg-transparent'
                      }`}
                    />
                    <div
                      className={`h-full flex-1 transition-colors ${
                        strengthScore >= 4 ? getStrengthLabel().color : 'bg-transparent'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-300">Confirmar Nova Senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white placeholder:text-gray-600 focus-visible:ring-indigo-500 rounded-xl h-11 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Requisitos visuais */}
            <div className="p-3 bg-[#0E1017] border border-[#262A33] rounded-xl space-y-1.5 text-[11px]">
              <div
                className={`flex items-center gap-1.5 ${
                  hasMinLength ? 'text-emerald-400' : 'text-gray-400'
                }`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-400' : 'text-gray-600'}`}
                />
                <span>Mínimo de 8 caracteres</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  hasLetter ? 'text-emerald-400' : 'text-gray-400'
                }`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasLetter ? 'text-emerald-400' : 'text-gray-600'}`}
                />
                <span>Pelo menos uma letra</span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  hasNumber ? 'text-emerald-400' : 'text-gray-400'
                }`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${hasNumber ? 'text-emerald-400' : 'text-gray-600'}`}
                />
                <span>Pelo menos um número</span>
              </div>
              {confirmPassword && (
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordsMatch ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      passwordsMatch ? 'text-emerald-400' : 'text-red-500'
                    }`}
                  />
                  <span>{passwordsMatch ? 'Senhas conferem' : 'As senhas não coincidem'}</span>
                </div>
              )}
            </div>

            {/* Aceite dos Termos no Primeiro Acesso */}
            <div className="pt-1">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#0E1017] border border-[#262A33] hover:border-indigo-500/40 transition-colors">
                <Checkbox
                  id="accept-terms-first-access"
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(Boolean(checked))}
                  className="mt-0.5 border-gray-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                />
                <div className="text-xs leading-relaxed text-gray-300">
                  <label
                    htmlFor="accept-terms-first-access"
                    className="cursor-pointer select-none text-gray-300 font-normal"
                  >
                    Li e concordo com o{' '}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTermsModalTab('termos')
                      setTermsModalOpen(true)
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium focus:outline-none"
                  >
                    Termo de Serviço
                  </button>{' '}
                  e a{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setTermsModalTab('privacidade')
                      setTermsModalOpen(true)
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline font-medium focus:outline-none"
                  >
                    Política de Privacidade
                  </button>
                  <span className="text-[11px] text-gray-500 block mt-0.5 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400 inline" />
                    Regras operacionais e LGPD da bit Consulting
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading || !isPasswordValid || !passwordsMatch || !acceptedTerms}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all mt-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando nova senha...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Salvar e Continuar
                </>
              )}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#262A33]/80 text-center">
            <button
              type="button"
              onClick={handleCancelAndLogout}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancelar e sair da conta
            </button>
          </div>
        </div>
      </div>

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
