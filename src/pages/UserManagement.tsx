import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Mail,
  User,
  Trash2,
  Lock,
  Copy,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
} from 'lucide-react'

interface UserRecord {
  id: string
  name?: string
  email: string
  role?: 'admin' | 'seller'
  created: string
  updated: string
  verified: boolean
}

export default function UserManagement() {
  const { user: currentUser, isAdmin } = useAuth()
  const { toast } = useToast()

  const [usersList, setUsersList] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal de Criação de Usuário
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<'seller' | 'admin'>('seller')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Resultado da criação para exibir senha temporária gerada
  const [createdResult, setCreatedResult] = useState<{
    email: string
    name: string
    role: string
    password?: string
    message?: string
  } | null>(null)

  // Exclusão / Desativação
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const records = await pb.collection('users').getFullList<UserRecord>({
        sort: '-created',
      })
      setUsersList(records)
    } catch (err) {
      console.error('Erro ao buscar lista de usuários:', err)
      toast({
        title: 'Erro ao carregar usuários',
        description: 'Não foi possível carregar os dados da equipe.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleOpenCreate = () => {
    setNewName('')
    setNewEmail('')
    setNewRole('seller')
    setNewPassword('')
    setCreateError(null)
    setCreatedResult(null)
    setCreateModalOpen(true)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)

    if (!newEmail.trim() || !newEmail.includes('@')) {
      setCreateError('Por favor informe um e-mail válido.')
      return
    }

    setCreating(true)
    try {
      // Dispara criação com convite seguro via hook autenticado
      const res = await pb.send<{
        success: boolean
        tempPassword?: string
        message?: string
        user?: { id: string; email: string; name: string; role: string }
      }>('/backend/v1/invitations/send', {
        method: 'POST',
        body: {
          email: newEmail.trim().toLowerCase(),
          name: newName.trim(),
          role: newRole,
          password: newPassword.trim() || undefined,
        },
      })

      setCreatedResult({
        email: newEmail.trim().toLowerCase(),
        name: newName.trim() || newEmail.split('@')[0],
        role: newRole,
        password: res.tempPassword || newPassword || 'Definida',
        message: res.message,
      })

      toast({
        title: 'Usuário cadastrado com sucesso!',
        description: `${newEmail.trim()} foi adicionado com o perfil de ${
          newRole === 'admin' ? 'Administrador' : 'Vendedor'
        }.`,
      })

      fetchUsers()
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'data' in err
          ? String((err as { data: { error?: string } }).data?.error || '')
          : ''
      setCreateError(msg || 'Erro ao criar usuário. Verifique se o e-mail já está cadastrado.')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteUser = async (userId: string, email: string) => {
    if (userId === currentUser?.id || email.toLowerCase() === 'leandro.bertanha@lbertanha.com') {
      alert('Não é permitido excluir a si próprio ou a conta do Administrador Principal.')
      return
    }

    if (!confirm(`Deseja realmente remover o usuário ${email}? O acesso ao CRM será revogado.`)) {
      return
    }

    setDeletingId(userId)
    try {
      await pb.collection('users').delete(userId)
      toast({
        title: 'Usuário removido',
        description: `O acesso de ${email} foi revogado com sucesso.`,
      })
      fetchUsers()
    } catch (err) {
      console.error('Erro ao deletar usuário:', err)
      toast({
        title: 'Erro ao excluir usuário',
        description: 'Você não tem permissão para excluir este usuário.',
        variant: 'destructive',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copiado para a área de transferência',
      description: text,
    })
  }

  const filteredUsers = usersList.filter((u) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      u.email.toLowerCase().includes(q) ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    )
  })

  // Se não for admin, exibe tela de bloqueio elegante
  if (!isAdmin) {
    return (
      <div className="p-8 text-center bg-[#12141A] border border-[#262A33] rounded-2xl max-w-lg mx-auto my-12 space-y-4">
        <Shield className="w-12 h-12 text-red-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Acesso Restrito ao Administrador</h2>
        <p className="text-sm text-gray-400">
          Apenas o administrador principal (leandro.bertanha@lbertanha.com) possui permissão para
          cadastrar e gerenciar usuários no bitCRM.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeInUp max-w-[1240px] mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#262A33]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Gestão Administrativa Exclusiva
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gerenciamento de Usuários
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Cadastre vendedores e líderes, gerencie permissões e visualize toda a equipe comercial
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true)
              fetchUsers()
            }}
            disabled={isRefreshing}
            className="border-[#262A33] bg-[#12141A] text-gray-300 hover:text-white rounded-xl h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl h-9 shadow-lg shadow-indigo-600/20 font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Cadastrar Novo Usuário
          </Button>
        </div>
      </div>

      {/* Barra de Busca e Métricas rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Buscar por nome, e-mail ou cargo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#12141A] border-[#262A33] text-white text-xs placeholder:text-gray-500 rounded-xl h-11"
          />
        </div>

        <div className="p-3 bg-[#12141A] border border-[#262A33] rounded-xl flex items-center justify-between">
          <span className="text-xs text-gray-400">Total de Usuários</span>
          <span className="text-lg font-bold text-white tabular-nums">{usersList.length}</span>
        </div>

        <div className="p-3 bg-[#12141A] border border-[#262A33] rounded-xl flex items-center justify-between">
          <span className="text-xs text-gray-400">Administradores</span>
          <span className="text-lg font-bold text-indigo-400 tabular-nums">
            {
              usersList.filter((u) => u.role === 'admin' || u.email.includes('lbertanha.com'))
                .length
            }
          </span>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0E1017] border-b border-[#262A33] text-gray-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">Usuário / Nome</th>
                <th className="py-3 px-4 font-semibold">E-mail</th>
                <th className="py-3 px-4 font-semibold">Papel (Role)</th>
                <th className="py-3 px-4 font-semibold">Situação</th>
                <th className="py-3 px-4 font-semibold">Cadastrado em</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262A33]/70">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                    Carregando membros da equipe...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    Nenhum usuário encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isMainAdmin = u.email.toLowerCase() === 'leandro.bertanha@lbertanha.com'
                  const isCurrent = u.id === currentUser?.id
                  const isRowAdmin = u.role === 'admin' || isMainAdmin

                  return (
                    <tr key={u.id} className="hover:bg-[#161922] transition-colors group">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-inner">
                          {u.name
                            ? u.name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()
                            : u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {u.name || u.email.split('@')[0]}
                            {isCurrent && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 rounded">
                                Você
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">ID: {u.id}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-gray-300">{u.email}</td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] border ${
                            isRowAdmin
                              ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isRowAdmin ? (
                            <>
                              <ShieldCheck className="w-3 h-3" />
                              Administrador
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3" />
                              Vendedor
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ativo
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-gray-400">
                        {u.created ? new Date(u.created).toLocaleDateString('pt-BR') : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {!isMainAdmin && !isCurrent ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(u.id, u.email)}
                            disabled={deletingId === u.id}
                            className="text-red-400 hover:text-red-300 hover:bg-red-950/40 h-8 px-2.5 rounded-lg text-xs"
                            title="Excluir usuário da equipe"
                          >
                            {deletingId === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                Excluir
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-[11px] text-gray-600 italic">Protegido</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Cadastrar Usuário */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-md rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
              Cadastrar Novo Usuário
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Cadastre um novo vendedor ou administrador para a plataforma comercial bitCRM.
            </DialogDescription>
          </DialogHeader>

          {createdResult ? (
            <div className="py-4 space-y-4 animate-fadeInUp">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/60 space-y-3">
                <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Usuário criado com sucesso!</span>
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>
                    <strong>Nome:</strong> {createdResult.name}
                  </p>
                  <p>
                    <strong>E-mail:</strong> {createdResult.email}
                  </p>
                  <p>
                    <strong>Papel:</strong>{' '}
                    {createdResult.role === 'admin' ? 'Administrador' : 'Vendedor'}
                  </p>
                </div>

                {createdResult.password && (
                  <div className="p-3 bg-[#0A0B0E] border border-emerald-900 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-gray-400 block">Senha de Acesso:</span>
                      <code className="text-sm font-bold text-emerald-400 font-mono">
                        {createdResult.password}
                      </code>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => copyToClipboard(createdResult.password!)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copiar
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  onClick={() => setCreateModalOpen(false)}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Concluir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateUser} className="space-y-4 py-2">
              {createError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    placeholder="Ex: Carlos Oliveira"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="pl-10 bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">E-mail Corporativo *</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type="email"
                    required
                    placeholder="carlos@empresa.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="pl-10 bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Papel / Função *</Label>
                <Select
                  value={newRole}
                  onValueChange={(val) => setNewRole(val as 'seller' | 'admin')}
                >
                  <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    <SelectItem value="seller">Vendedor (Acessa suas oportunidades)</SelectItem>
                    <SelectItem value="admin">Administrador (Acesso total)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">
                  Senha Inicial (opcional — se vazia, geramos uma senha forte)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <Input
                    type="text"
                    placeholder="Deixe em branco para gerar aleatória"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-[#262A33] flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                  className="border-[#262A33] text-gray-300 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creating}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    'Cadastrar Usuário'
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
