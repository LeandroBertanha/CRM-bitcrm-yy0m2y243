import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { Opportunity, STAGES, SOURCES, STAGE_CONFIG, formatBRL, formatDateBR } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Plus,
  Search,
  Filter,
  Building,
  UserCheck,
  Phone,
  Mail,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

export default function Opportunities() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [sellersList, setSellersList] = useState<{ id: string; name?: string; email: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  // Modais
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)

  // Formulário Estado
  const [formData, setFormData] = useState<{
    company: string
    stage: Opportunity['stage']
    source: Opportunity['source']
    value: string
    seller: string
    contact_name: string
    contact_email: string
    contact_phone: string
    message: string
  }>({
    company: '',
    stage: 'Novo',
    source: 'Formulário Público',
    value: '',
    seller: user?.id || '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    message: '',
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const fetchOpportunities = useCallback(async () => {
    try {
      const records = await pb.collection('opportunities').getFullList<Opportunity>({
        sort: '-created',
        expand: 'seller',
      })
      setOpportunities(records)
    } catch (err) {
      console.error('Erro ao carregar oportunidades:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  const fetchSellers = useCallback(async () => {
    try {
      const users = await pb
        .collection('users')
        .getFullList<{ id: string; name?: string; email: string }>({
          fields: 'id,name,email',
        })
      setSellersList(users)
    } catch {
      // Falha silenciosa se usuário não puder listar todos
    }
  }, [])

  useEffect(() => {
    fetchOpportunities()
    fetchSellers()
  }, [fetchOpportunities, fetchSellers])

  // Inscrição em tempo real
  useRealtime<Opportunity>('opportunities', () => {
    fetchOpportunities()
  })

  // Abrir Modal de Criação
  const handleOpenCreate = () => {
    setFormData({
      company: '',
      stage: 'Novo',
      source: 'Indicação',
      value: '',
      seller: user?.id || '',
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      message: '',
    })
    setFormErrors({})
    setCreateModalOpen(true)
  }

  // Abrir Modal de Edição
  const handleOpenEdit = (opp: Opportunity) => {
    setSelectedOpp(opp)
    setFormData({
      company: opp.company,
      stage: opp.stage,
      source: opp.source,
      value: opp.value ? String(opp.value) : '',
      seller: opp.seller || user?.id || '',
      contact_name: opp.contact_name || '',
      contact_email: opp.contact_email || '',
      contact_phone: opp.contact_phone || '',
      message: opp.message || '',
    })
    setFormErrors({})
    setEditModalOpen(true)
  }

  // Abrir Modal de Detalhes
  const handleOpenDetail = (opp: Opportunity) => {
    setSelectedOpp(opp)
    setDetailModalOpen(true)
  }

  // Alterar estágio direto pelo dropdown do card
  const handleStageChange = async (oppId: string, newStage: Opportunity['stage']) => {
    try {
      await pb.collection('opportunities').update(oppId, { stage: newStage })
      toast({
        title: 'Estágio atualizado',
        description: `Oportunidade movida para ${newStage}.`,
      })
      fetchOpportunities()
    } catch (err) {
      toast({
        title: 'Erro ao alterar estágio',
        description: 'Não foi possível salvar a alteração.',
        variant: 'destructive',
      })
    }
  }

  // Salvar Criação
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!formData.company.trim()) errors.company = 'Nome da empresa é obrigatório.'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await pb.collection('opportunities').create({
        company: formData.company.trim(),
        stage: formData.stage,
        source: formData.source,
        value: formData.value ? parseFloat(formData.value.replace(',', '.')) : 0,
        seller: formData.seller || user?.id,
        contact_name: formData.contact_name.trim(),
        contact_email: formData.contact_email.trim(),
        contact_phone: formData.contact_phone.trim(),
        message: formData.message.trim(),
      })

      toast({
        title: 'Oportunidade criada!',
        description: `${formData.company} foi adicionada ao pipeline.`,
      })
      setCreateModalOpen(false)
      fetchOpportunities()
    } catch {
      toast({
        title: 'Erro ao criar',
        description: 'Ocorreu um erro ao salvar a oportunidade.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Salvar Edição
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOpp) return

    const errors: Record<string, string> = {}
    if (!formData.company.trim()) errors.company = 'Nome da empresa é obrigatório.'

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await pb.collection('opportunities').update(selectedOpp.id, {
        company: formData.company.trim(),
        stage: formData.stage,
        source: formData.source,
        value: formData.value ? parseFloat(formData.value.replace(',', '.')) : 0,
        seller: formData.seller || user?.id,
        contact_name: formData.contact_name.trim(),
        contact_email: formData.contact_email.trim(),
        contact_phone: formData.contact_phone.trim(),
        message: formData.message.trim(),
      })

      toast({
        title: 'Oportunidade atualizada',
        description: 'As alterações foram salvas com sucesso.',
      })
      setEditModalOpen(false)
      fetchOpportunities()
    } catch {
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  // Excluir Oportunidade
  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta oportunidade? Esta ação não pode ser desfeita.')) {
      return
    }
    try {
      await pb.collection('opportunities').delete(id)
      toast({
        title: 'Oportunidade excluída',
        description: 'O registro foi removido com sucesso.',
      })
      setEditModalOpen(false)
      setDetailModalOpen(false)
      fetchOpportunities()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o registro.',
        variant: 'destructive',
      })
    }
  }

  // Filtragem dos cards
  const filteredOpps = useMemo(() => {
    return opportunities.filter((opp) => {
      // Busca por texto
      const matchesSearch =
        searchQuery === '' ||
        opp.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (opp.contact_name && opp.contact_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (opp.contact_email && opp.contact_email.toLowerCase().includes(searchQuery.toLowerCase()))

      // Filtro de estágio
      const matchesStage = stageFilter === 'all' || opp.stage === stageFilter

      // Filtro de origem
      const matchesSource = sourceFilter === 'all' || opp.source === sourceFilter

      return matchesSearch && matchesStage && matchesSource
    })
  }, [opportunities, searchQuery, stageFilter, sourceFilter])

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#262A33]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Pipeline de Oportunidades
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gerencie cada estágio do funil comercial e impulsione o fechamento de contratos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true)
              fetchOpportunities()
            }}
            disabled={isRefreshing}
            className="border-[#262A33] bg-[#12141A] text-gray-300 hover:text-white hover:bg-[#181B24] rounded-xl h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl h-9 shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#12141A] border border-[#262A33] p-3 rounded-2xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Buscar por empresa ou contato..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[#0E1017] border-[#262A33] text-white text-xs placeholder:text-gray-500 rounded-xl h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="w-36">
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-9 rounded-xl">
                <SelectValue placeholder="Estágio" />
              </SelectTrigger>
              <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                <SelectItem value="all">Todos Estágios</SelectItem>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-9 rounded-xl">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                <SelectItem value="all">Todas Origens</SelectItem>
                {SOURCES.map((src) => (
                  <SelectItem key={src} value={src}>
                    {src}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Pipeline Kanban (5 Colunas com Scroll Horizontal Suave) */}
      <div className="overflow-x-auto pb-6">
        <div className="flex gap-4 min-w-[1080px]">
          {STAGES.map((stage) => {
            const stageStyle = STAGE_CONFIG[stage]
            const stageOpps = filteredOpps.filter((opp) => opp.stage === stage)
            const stageTotalValue = stageOpps.reduce(
              (acc, curr) => acc + (Number(curr.value) || 0),
              0,
            )

            return (
              <div
                key={stage}
                className="flex-1 min-w-[210px] bg-[#0E1017] border border-[#262A33] rounded-2xl flex flex-col max-h-[calc(100vh-250px)]"
              >
                {/* Cabeçalho da Coluna */}
                <div
                  className={`p-3.5 border-b border-[#262A33] flex items-center justify-between rounded-t-2xl ${stageStyle.bg}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${stageStyle.dot}`} />
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${stageStyle.color}`}
                    >
                      {stage}
                    </span>
                    <span className="text-[11px] font-semibold text-gray-400 bg-[#12141A] px-2 py-0.5 rounded-full border border-[#262A33]">
                      {stageOpps.length}
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-gray-400 tabular-nums">
                    {formatBRL(stageTotalValue)}
                  </span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
                  {stageOpps.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-[#262A33]/70 rounded-xl my-2">
                      <span className="text-[11px] text-gray-500">Nenhum negócio aqui</span>
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <div
                        key={opp.id}
                        className="p-3.5 rounded-xl bg-[#12141A] border border-[#262A33] hover:border-indigo-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-150 space-y-2.5 group relative"
                      >
                        {/* Topo do Card: Empresa e Ações */}
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            onClick={() => handleOpenDetail(opp)}
                            className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors cursor-pointer leading-tight"
                          >
                            {opp.company}
                          </h4>
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleOpenDetail(opp)}
                              title="Visualizar detalhes"
                              className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1A1D27]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(opp)}
                              title="Editar oportunidade"
                              className="p-1 rounded text-gray-400 hover:text-indigo-300 hover:bg-[#1A1D27]"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Contato & Detalhes */}
                        {(opp.contact_name || opp.contact_phone) && (
                          <div className="text-xs text-gray-400 space-y-1">
                            {opp.contact_name && (
                              <div className="flex items-center gap-1.5 truncate">
                                <UserCheck className="w-3 h-3 text-gray-500 shrink-0" />
                                <span className="truncate">{opp.contact_name}</span>
                              </div>
                            )}
                            {opp.contact_phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3 h-3 text-gray-500 shrink-0" />
                                <span className="font-mono text-[11px]">{opp.contact_phone}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Valor e Badge de Origem */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#262A33]/80">
                          <span className="text-xs font-bold text-indigo-400 tabular-nums">
                            {formatBRL(opp.value)}
                          </span>
                          <span className="text-[10px] text-gray-400 bg-[#171A24] px-1.5 py-0.5 rounded border border-[#262A33]">
                            {opp.source}
                          </span>
                        </div>

                        {/* Seletor Rápido de Mudança de Estágio */}
                        <div className="pt-1">
                          <Select
                            value={opp.stage}
                            onValueChange={(val) =>
                              handleStageChange(opp.id, val as Opportunity['stage'])
                            }
                          >
                            <SelectTrigger className="w-full h-6 text-[10px] bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white rounded-lg">
                              <span className="truncate">Mover: {opp.stage}</span>
                            </SelectTrigger>
                            <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                              {STAGES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal: Nova Oportunidade */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-lg rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Criar Nova Oportunidade
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-400">
              Preencha os dados do cliente e da proposta para incluir no pipeline.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Empresa / Cliente *</Label>
              <Input
                placeholder="Ex: Grupo Romero S.A."
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
              />
              {formErrors.company && (
                <span className="text-[11px] text-red-400">{formErrors.company}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Estágio Inicial</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(val) =>
                    setFormData({ ...formData, stage: val as Opportunity['stage'] })
                  }
                >
                  <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Origem do Lead</Label>
                <Select
                  value={formData.source}
                  onValueChange={(val) =>
                    setFormData({ ...formData, source: val as Opportunity['source'] })
                  }
                >
                  <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Valor Estimado (R$)</Label>
                <Input
                  placeholder="Ex: 45000"
                  type="number"
                  step="any"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Vendedor Responsável</Label>
                <Select
                  value={formData.seller}
                  onValueChange={(val) => setFormData({ ...formData, seller: val })}
                >
                  <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    {sellersList.length > 0 ? (
                      sellersList.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name || s.email}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value={user?.id || 'me'}>
                        {user?.name || user?.email || 'Eu mesmo'}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Nome do Contato</Label>
                <Input
                  placeholder="Nome do cliente"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">E-mail</Label>
                <Input
                  placeholder="contato@cliente.com"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Telefone / WhatsApp</Label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Mensagem / Observações</Label>
              <Textarea
                placeholder="Detalhes da demanda, necessidades ou escopo..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[70px]"
              />
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
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {submitting ? 'Salvando...' : 'Criar Oportunidade'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Oportunidade */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-lg rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                Editar Oportunidade
              </span>
              {selectedOpp && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(selectedOpp.id)}
                  className="text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs h-8 px-2"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Excluir
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Empresa / Cliente *</Label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
              />
              {formErrors.company && (
                <span className="text-[11px] text-red-400">{formErrors.company}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Estágio</Label>
                <Select
                  value={formData.stage}
                  onValueChange={(val) =>
                    setFormData({ ...formData, stage: val as Opportunity['stage'] })
                  }
                >
                  <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Origem</Label>
                <Select
                  value={formData.source}
                  onValueChange={(val) =>
                    setFormData({ ...formData, source: val as Opportunity['source'] })
                  }
                >
                  <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Valor (R$)</Label>
                <Input
                  type="number"
                  step="any"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Vendedor</Label>
                <Select
                  value={formData.seller}
                  onValueChange={(val) => setFormData({ ...formData, seller: val })}
                >
                  <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    {sellersList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name || s.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Contato</Label>
                <Input
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">E-mail</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Telefone</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Mensagem / Observações</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[70px]"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#262A33] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="border-[#262A33] text-gray-300 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                {submitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes da Oportunidade */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-lg rounded-2xl shadow-2xl">
          {selectedOpp && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pb-2 border-b border-[#262A33]">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">
                      Oportunidade
                    </span>
                    <DialogTitle className="text-xl font-bold text-white mt-0.5">
                      {selectedOpp.company}
                    </DialogTitle>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${STAGE_CONFIG[selectedOpp.stage].bg} ${STAGE_CONFIG[selectedOpp.stage].color} ${STAGE_CONFIG[selectedOpp.stage].border}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${STAGE_CONFIG[selectedOpp.stage].dot}`}
                    />
                    {selectedOpp.stage}
                  </span>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Valor & Origem */}
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Valor Previsto</span>
                    <span className="text-lg font-bold text-white tabular-nums">
                      {formatBRL(selectedOpp.value)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Canal de Origem</span>
                    <span className="text-sm font-semibold text-gray-200">
                      {selectedOpp.source}
                    </span>
                  </div>
                </div>

                {/* Dados de Contato */}
                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] space-y-2">
                  <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
                    Informações do Contato
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-300">
                    <div>
                      <span className="text-gray-500 block">Nome</span>
                      <span>{selectedOpp.contact_name || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Telefone / WhatsApp</span>
                      <span>{selectedOpp.contact_phone || 'Não informado'}</span>
                    </div>
                    <div className="col-span-full">
                      <span className="text-gray-500 block">E-mail</span>
                      <span>{selectedOpp.contact_email || 'Não informado'}</span>
                    </div>
                  </div>
                </div>

                {/* Mensagem / Demanda */}
                {selectedOpp.message && (
                  <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] space-y-1">
                    <span className="text-[11px] font-semibold text-gray-400 block uppercase tracking-wider">
                      Mensagem / Escopo da Demanda
                    </span>
                    <p className="text-gray-300 italic whitespace-pre-wrap">
                      &quot;{selectedOpp.message}&quot;
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2">
                  <span>Criado em: {formatDateBR(selectedOpp.created)}</span>
                  <span>Última alteração: {formatDateBR(selectedOpp.updated)}</span>
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-[#262A33] flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailModalOpen(false)}
                  className="border-[#262A33] text-gray-300 text-xs"
                >
                  Fechar
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDetailModalOpen(false)
                      handleOpenEdit(selectedOpp)
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    Editar
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
