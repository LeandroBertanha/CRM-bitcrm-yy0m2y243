import React, { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  User,
  Mail,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  UserPlus,
  Send,
  AlertCircle,
  Copy,
  KeyRound,
} from 'lucide-react'

export default function Profile() {
  const { user, updateProfile, requestEmailChange } = useAuth()
  const { toast } = useToast()

  // Nome
  const [name, setName] = useState(user?.name || '')
  const [savingName, setSavingName] = useState(false)

  // Alteração de E-mail
  const [newEmail, setNewEmail] = useState('')
  const [requestingEmailChange, setRequestingEmailChange] = useState(false)
  const [emailChangeSuccess, setEmailChangeSuccess] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

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
        {/* Formulário: Alterar Nome */}
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

        {/* Formulário: Alterar E-mail */}
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
                Enviamos um link de validação para o novo endereço. Acesse a mensagem para confirmar
                a troca com sua senha.
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

      {/* Seção de Convite de Vendedores (Gestão de Equipe) */}
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
          Adicione novos vendedores à sua equipe comercial. Uma senha temporária segura será gerada
          e enviada por e-mail ou disponibilizada imediatamente para compartilhamento.
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
    </div>
  )
}
