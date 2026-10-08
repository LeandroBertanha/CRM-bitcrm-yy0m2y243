import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  User,
  Mail,
  Save,
  Loader2,
  CheckCircle2,
  UserPlus,
  Send,
  AlertCircle,
  Copy,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  RefreshCw,
  Bell,
  Smartphone,
  ExternalLink,
} from 'lucide-react'
import { convertToWebcalUrl } from '@/lib/calendarHelper'

export default function Profile() {
  const { user, updateProfile, requestEmailChange, changePassword } = useAuth()
  const { toast } = useToast()
  const location = useLocation()

  // Nome
  const [name, setName] = useState(user?.name || '')
  const [savingName, setSavingName] = useState(false)

  // Alteração de Senha
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  // Alteração de E-mail
  const [newEmail, setNewEmail] = useState('')
  const [requestingEmailChange, setRequestingEmailChange] = useState(false)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  // Agenda e Alertas
  const [calendarToken, setCalendarToken] = useState(user?.calendar_token || '')
  const [alertEmailInput, setAlertEmailInput] = useState(user?.alert_email || user?.email || '')
  const [savingAlertEmail, setSavingAlertEmail] = useState(false)
  const [regeneratingToken, setRegeneratingToken] = useState(false)
  const [hasCopiedIcs, setHasCopiedIcs] = useState(false)

  // Scroll automático para #alterar-senha caso venha do link do Header
  useEffect(() => {
    if (location.hash === '#alterar-senha') {
      const el = document.getElementById('alterar-senha')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [location.hash])

  // Convite de novos vendedores (disponível para administradores/líderes)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{
    tempPassword?: string
    message?: string
    email?: string
  } | null>(null)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Validações de senha forte
  const hasMinLength = newPassword.length >= 8
  const hasLetter = /[a-zA-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const isPasswordValid = hasMinLength && hasLetter && hasNumber

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)

    if (!currentPassword) {
      setPasswordError('Informe sua senha atual.')
      return
    }

    if (!isPasswordValid) {
      setPasswordError('A nova senha deve ter no mínimo 8 caracteres, contendo letras e números.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação da nova senha não confere.')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setChangingPassword(true)
    try {
      const { error, sessionTerminated } = await changePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      )
      if (error) {
        const msg = error.message || ''
        if (
          msg.toLowerCase().includes('oldpassword') ||
          msg.toLowerCase().includes('invalid') ||
          msg.toLowerCase().includes('failed to authenticate')
        ) {
          setPasswordError('Senha atual incorreta. Verifique e tente novamente.')
        } else {
          setPasswordError(msg || 'Erro ao atualizar a senha. Tente novamente.')
        }
      } else {
        toast({
          title: 'Senha atualizada com sucesso!',
          description: sessionTerminated
            ? 'Sua sessão foi encerrada. Entre com sua nova senha.'
            : 'Sua senha foi redefinida com segurança.',
        })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')

        if (sessionTerminated) {
          // O próprio signOut já redirecionará pela rota protegida ou podemos forçar
          window.location.href = '/login'
        }
      }
    } catch {
      setPasswordError('Erro ao conectar ao servidor. Tente novamente.')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingName(true)
    try {
      const { error } = await updateProfile({ name: name.trim() })
      if (error) {
        toast({
          title: 'Erro ao atualizar',
          description: 'Não foi possível salvar o novo nome.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Perfil atualizado',
          description: 'Seu nome foi alterado com sucesso.',
        })
      }
    } finally {
      setSavingName(false)
    }
  }

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError(null)
    setEmailChangeSuccess(false)

    if (!newEmail.trim() || !newEmail.includes('@')) {
      setEmailError('Informe um e-mail válido.')
      return
    }

    setRequestingEmailChange(true)
    try {
      const { error } = await requestEmailChange(newEmail.trim())
      if (error) {
        setEmailError('Não foi possível solicitar a alteração. O e-mail pode já estar em uso.')
      } else {
        setEmailChangeSuccess(true)
        toast({
          title: 'Link enviado!',
          description: `Enviamos a confirmação para ${newEmail.trim()}.`,
        })
      }
    } finally {
      setRequestingEmailChange(false)
    }
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteError(null)
    setInviteResult(null)

    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError('Informe um e-mail válido para o convite.')
      return
    }

    setInviting(true)
    try {
      // Chama o endpoint de convite do backend
      const res = await pb.send<{
        success: boolean
        tempPassword?: string
        message?: string
        user?: { email: string }
      }>('/backend/v1/invitations/send', {
        method: 'POST',
        body: {
          email: inviteEmail.trim(),
          name: inviteName.trim(),
        },
      })

      setInviteResult({
        tempPassword: res.tempPassword,
        message: res.message,
        email: inviteEmail.trim(),
      })
      toast({
        title: 'Convite criado com sucesso!',
        description: `Vendedor adicionado: ${inviteEmail.trim()}`,
      })
      setInviteEmail('')
      setInviteName('')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'data' in err
          ? String((err as { data: { error?: string } }).data?.error || '')
          : ''
      setInviteError(msg || 'Erro ao enviar convite. Verifique se o e-mail já existe.')
    } finally {
      setInviting(false)
    }
  }

  const copyTempPassword = (pass: string) => {
    navigator.clipboard.writeText(pass)
    toast({
      title: 'Senha temporária copiada!',
      description: 'Você pode enviar ao vendedor por mensagem segura.',
    })
  }

  // Atualiza dados locais quando o user é carregado ou alterado
  useEffect(() => {
    if (user?.calendar_token && !calendarToken) {
      setCalendarToken(user.calendar_token)
    }
    if (user?.alert_email && !alertEmailInput) {
      setAlertEmailInput(user.alert_email)
    } else if (user?.email && !alertEmailInput) {
      setAlertEmailInput(user.email)
    }
  }, [user, calendarToken, alertEmailInput])

  // Montagem da URL completa do Feed ICS
  const rawBackendUrl = (import.meta.env.VITE_POCKETBASE_URL || window.location.origin).replace(
    /\/$/,
    '',
  )
  const icsFeedUrl = calendarToken
    ? `${rawBackendUrl}/backend/v1/calendar/feed/${calendarToken}`
    : ''
  const webcalFeedUrl = convertToWebcalUrl(icsFeedUrl)

  const handleCopyCalendarLink = () => {
    if (!icsFeedUrl) return
    navigator.clipboard.writeText(icsFeedUrl)
    setHasCopiedIcs(true)
    setTimeout(() => setHasCopiedIcs(false), 3000)
    toast({
      title: 'Link da agenda copiado!',
      description: 'Cole no Google Agenda, Outlook ou no calendário do seu celular.',
    })
  }

  const handleRegenerateCalendarToken = async () => {
    if (
      !confirm(
        'Deseja realmente gerar um novo link de agenda? O link anterior deixará de funcionar nas agendas já sincronizadas.',
      )
    ) {
      return
    }

    setRegeneratingToken(true)
    try {
      const res = await pb.send<{ success: boolean; calendar_token: string }>(
        '/backend/v1/calendar/regenerate-token',
        { method: 'POST' },
      )
      if (res && res.calendar_token) {
        setCalendarToken(res.calendar_token)
        toast({
          title: 'Novo link gerado com sucesso!',
          description: 'Lembre-se de atualizar a inscrição nos seus calendários.',
        })
      }
    } catch {
      toast({
        title: 'Erro ao regenerar link',
        description: 'Não foi possível gerar novo token no momento.',
        variant: 'destructive',
      })
    } finally {
      setRegeneratingToken(false)
    }
  }

  const handleSaveAlertEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!alertEmailInput.trim() || !alertEmailInput.includes('@')) {
      toast({
        title: 'E-mail inválido',
        description: 'Por favor, informe um endereço de e-mail válido para alertas.',
        variant: 'destructive',
      })
      return
    }

    setSavingAlertEmail(true)
    try {
      const { error } = await updateProfile({ alert_email: alertEmailInput.trim().toLowerCase() })
      if (error) {
        toast({
          title: 'Erro ao salvar',
          description: 'Não foi possível salvar o e-mail de alertas.',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'E-mail de alertas salvo!',
          description: 'O resumo matinal diário de retornos será enviado para este endereço.',
        })
      }
    } finally {
      setSavingAlertEmail(false)
    }
  }

  // Gera iniciais
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : user?.email.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-8 animate-fadeInUp max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="pb-2 border-b border-[#262A33]">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Meu Perfil & Equipe
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Gerencie seus dados de acesso comercial e convide novos membros para o bitCRM.
        </p>
      </div>
      {/* Cartão de Identificação do Usuário */}
      <div className="p-6 rounded-2xl bg-[#12141A] border border-[#262A33] shadow-xl flex flex-col sm:flex-row items-center sm:items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-600/30 shrink-0">
          {initials}
        </div>

        <div className="flex-1 text-center sm:text-left space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h2 className="text-xl font-bold text-white">
              {user?.name || user?.email.split('@')[0]}
            </h2>
            <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full w-fit mx-auto sm:mx-0">
              {user?.role === 'admin' || user?.email?.includes('lbertanha.com')
                ? 'Administrador'
                : 'Vendedor Comercial'}
            </span>
          </div>
          <p className="text-xs text-gray-400 font-mono">{user?.email}</p>
          <p className="text-[11px] text-gray-500 pt-1">
            Membro desde {user?.created ? new Date(user.created).toLocaleDateString('pt-BR') : ''}{' '}
            &bull; ID: <span className="font-mono text-gray-400">{user?.id}</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formulário: Alterar Senha (Requisito Principal do Usuário) */}
        <div
          id="alterar-senha"
          className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5 transition-all"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h3 className="text-base font-bold text-white">Alterar Senha</h3>
            </div>
            <span className="text-[11px] text-gray-400 bg-[#0E1017] px-2 py-0.5 rounded-full border border-[#262A33]">
              Segurança
            </span>
          </div>

          {passwordError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Senha Atual */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Senha Atual *</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Sua senha atual"
                  className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl"
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
            </div>

            {/* Nova Senha */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Nova Senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres (letras e números)"
                  className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Confirmar Nova Senha *</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="pl-10 pr-10 bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl"
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

            {/* Requisitos rápidos da senha */}
            {newPassword && (
              <div className="p-2.5 bg-[#0E1017] border border-[#262A33] rounded-xl space-y-1 text-[11px]">
                <div
                  className={`flex items-center gap-1.5 ${
                    hasMinLength ? 'text-emerald-400' : 'text-gray-400'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3 h-3 ${hasMinLength ? 'text-emerald-400' : 'text-gray-600'}`}
                  />
                  <span>Mínimo 8 caracteres</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasLetter ? 'text-emerald-400' : 'text-gray-400'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3 h-3 ${hasLetter ? 'text-emerald-400' : 'text-gray-600'}`}
                  />
                  <span>Ao menos uma letra</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasNumber ? 'text-emerald-400' : 'text-gray-400'
                  }`}
                >
                  <CheckCircle2
                    className={`w-3 h-3 ${hasNumber ? 'text-emerald-400' : 'text-gray-600'}`}
                  />
                  <span>Ao menos um número</span>
                </div>
                {confirmPassword && (
                  <div
                    className={`flex items-center gap-1.5 ${
                      passwordsMatch ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-3 h-3 ${passwordsMatch ? 'text-emerald-400' : 'text-red-500'}`}
                    />
                    <span>{passwordsMatch ? 'Senhas conferem' : 'Senhas não coincidem'}</span>
                  </div>
                )}
              </div>
            )}

            <Button
              type="submit"
              disabled={changingPassword || !isPasswordValid || !passwordsMatch || !currentPassword}
              className="bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white text-xs rounded-xl h-10 px-4 font-semibold disabled:opacity-50"
            >
              {changingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Atualizando senha...
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5 mr-2" />
                  Atualizar Senha
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Formulário: Alterar Nome & E-mail agrupados na outra coluna */}
        <div className="space-y-6">
          <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#262A33]">
              <User className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-bold text-white">Dados Pessoais</h3>
            </div>

            <form onSubmit={handleUpdateName} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Nome de Exibição</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl"
                />
                <p className="text-[11px] text-gray-500">
                  Este nome é exibido aos clientes no formulário e no topo das oportunidades.
                </p>
              </div>

              <Button
                type="submit"
                disabled={savingName}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl h-10 px-4 font-semibold"
              >
                {savingName ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-2" />
                    Salvar Nome
                  </>
                )}
              </Button>
            </form>
          </div>

          <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#262A33]">
              <Mail className="w-4 h-4 text-blue-400" />
              <h3 className="text-base font-bold text-white">Alteração de E-mail</h3>
            </div>

            {emailChangeSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmação enviada</span>
                </div>
                <p className="text-xs text-gray-300">
                  Enviamos um link de validação para o novo endereço. Acesse a mensagem para
                  confirmar a troca com sua senha.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailChangeSuccess(false)}
                  className="border-[#262A33] text-gray-300 text-xs mt-2"
                >
                  Tentar outro e-mail
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRequestEmailChange} className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">E-mail atual</Label>
                  <p className="text-xs font-mono text-gray-300 bg-[#0E1017] p-2.5 rounded-xl border border-[#262A33]">
                    {user?.email}
                  </p>
                </div>

                {emailError && (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{emailError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">Novo E-mail</Label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="novo-email@empresa.com"
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={requestingEmailChange}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-xl h-10 px-4 font-semibold"
                >
                  {requestingEmailChange ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Enviando link...
                    </>
                  ) : (
                    'Enviar link de confirmação'
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
      {/* Seção Nova: Agenda e Alertas (Requisito bitCRM) */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#262A33] gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Agenda e Alertas de Retorno</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                  Feed ICS & E-mail Diário
                </span>
              </h3>
            </div>
          </div>
          <span className="text-xs text-gray-400">
            Fuso horário padrão:{' '}
            <strong className="text-gray-300">America/Sao_Paulo (UTC-3)</strong>
          </span>
        </div>

        <p className="text-xs text-gray-300">
          Sincronize automaticamente os follow-ups e retornos agendados com o calendário do seu
          e-mail ou celular (Google Calendar, Outlook, Apple Calendar) e receba o resumo matinal de
          contatos prioritários.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Coluna 1: Link do Feed ICS */}
          <div className="space-y-4 bg-[#0E1017] border border-[#262A33] p-4 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-400" />
                Seu Feed de Agenda (webcal / ICS)
              </span>
              <button
                type="button"
                onClick={handleRegenerateCalendarToken}
                disabled={regeneratingToken}
                className="text-[11px] text-gray-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                title="Gera um novo token caso queira revogar acessos antigos"
              >
                <RefreshCw className={`w-3 h-3 ${regeneratingToken ? 'animate-spin' : ''}`} />
                Regenerar link
              </button>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Feed dinâmico que atualiza automaticamente seus retornos na sua agenda. Lembretes
              (alarmes) são configurados 30 minutos antes de cada compromisso.
            </p>

            <div className="space-y-2">
              <div className="p-2.5 rounded-lg bg-[#12141A] border border-[#262A33] flex items-center justify-between gap-2 overflow-hidden">
                <code className="text-xs font-mono text-indigo-300 truncate select-all flex-1">
                  {icsFeedUrl || 'Gerando token de agenda...'}
                </code>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCopyCalendarLink}
                  disabled={!icsFeedUrl}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl h-9 font-semibold flex-1"
                >
                  {hasCopiedIcs ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                      Link Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Copiar link da agenda
                    </>
                  )}
                </Button>

                {webcalFeedUrl && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="border-[#262A33] text-gray-300 hover:text-white bg-[#171A24] text-xs rounded-xl h-9"
                  >
                    <a href={webcalFeedUrl} title="Abrir inscrição nativa do sistema">
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Assinar direto
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Instruções curtas de como assinar */}
            <div className="pt-2 border-t border-[#262A33]/80 space-y-2 text-[11px] text-gray-400">
              <div className="font-semibold text-gray-300">Como assinar na sua agenda:</div>
              <ul className="space-y-1 list-disc pl-4 text-gray-400">
                <li>
                  <strong className="text-gray-300">Agenda Google:</strong> No PC, clique em "Outras
                  agendas (+)" &gt; "Do URL" e cole o link copiado.
                </li>
                <li>
                  <strong className="text-gray-300">Outlook (Web ou App):</strong> Vá em Calendário
                  &gt; "Adicionar calendário" &gt; "Inscrever-se na Web".
                </li>
                <li>
                  <strong className="text-gray-300">iPhone / Mac:</strong> Toque no botão "Assinar
                  direto" ou vá em Ajustes &gt; Calendário &gt; Contas &gt; Adicionar Conta &gt;
                  Outra &gt; "Adicionar Calendário Assinado".
                </li>
              </ul>
            </div>
          </div>

          {/* Coluna 2: E-mail Diário de Retornos */}
          <div className="space-y-4 bg-[#0E1017] border border-[#262A33] p-4 rounded-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  E-mail Diário de Retornos (07:30 BRT)
                </span>
              </div>

              <p className="text-[11px] text-gray-400 leading-relaxed">
                Todas as manhãs às 07:30 (horário de Brasília), você recebe um e-mail com a lista
                dos seus retornos atrasados e agendados para o dia, incluindo link direto para
                contato no WhatsApp (wa.me).
              </p>

              <form onSubmit={handleSaveAlertEmail} className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">E-mail para Receber os Alertas</Label>
                  <Input
                    type="email"
                    required
                    value={alertEmailInput}
                    onChange={(e) => setAlertEmailInput(e.target.value)}
                    placeholder="seu-email@lbertanha.com"
                    className="bg-[#12141A] border-[#262A33] text-white text-xs h-10 rounded-xl"
                  />
                  <p className="text-[11px] text-gray-500">
                    Pré-preenchido com o e-mail da sua conta comercial. Pode ser ajustado conforme
                    sua preferência.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={savingAlertEmail}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs rounded-xl h-9 px-4 font-semibold"
                >
                  {savingAlertEmail ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5 mr-2" />
                      Salvar E-mail de Alertas
                    </>
                  )}
                </Button>
              </form>
            </div>

            <div className="p-3 rounded-lg bg-[#12141A] border border-[#262A33] text-[11px] text-gray-400 flex items-start gap-2 mt-3">
              <Smartphone className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                <strong>Dica:</strong> Se não houver retornos agendados para a sua carteira no dia
                nem atrasados, o sistema não enviará e-mail para não poluir sua caixa de entrada.
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Seção de Convite de Vendedores (Gestão de Equipe — disponível para admin) */}
      {user?.role === 'admin' || user?.email?.toLowerCase() === 'leandro.bertanha@lbertanha.com' ? (
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#262A33] gap-2">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Convidar Vendedor para a Equipe</h3>
            </div>
            <span className="text-[11px] text-gray-400 bg-[#0E1017] px-2.5 py-1 rounded-full border border-[#262A33]">
              Acesso Restrito por Convite
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Adicione novos vendedores à sua equipe comercial. Uma senha temporária segura será
            gerada e enviada por e-mail ou disponibilizada imediatamente para compartilhamento.
          </p>

          {inviteResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/60 space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Vendedor cadastrado com sucesso!</span>
              </div>
              <p className="text-xs text-gray-300">
                Conta criada para <strong>{inviteResult.email}</strong>.
              </p>
              {inviteResult.tempPassword && (
                <div className="p-3 bg-[#0A0B0E] border border-emerald-900 rounded-lg flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 block">
                      Senha temporária de acesso:
                    </span>
                    <code className="text-sm font-bold text-emerald-400 font-mono">
                      {inviteResult.tempPassword}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => copyTempPassword(inviteResult.tempPassword!)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copiar Senha
                  </Button>
                </div>
              )}
            </div>
          )}

          {inviteError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{inviteError}</span>
            </div>
          )}

          <form onSubmit={handleSendInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-300">Nome do Vendedor</Label>
              <Input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex: Carlos Oliveira"
                className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-300">E-mail Comercial *</Label>
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="carlos@empresa.com"
                className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                disabled={inviting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl h-10 font-semibold"
              >
                {inviting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    Gerando convite...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-2" />
                    Enviar Convite
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : null}{' '}
    </div>
  )
}
