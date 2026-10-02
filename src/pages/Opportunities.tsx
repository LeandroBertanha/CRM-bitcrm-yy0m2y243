import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import {
  Opportunity,
  STAGES,
  SOURCES,
  STAGE_CONFIG,
  formatBRL,
  formatCompactBRL,
  formatDateBR,
  getReturnAlertInfo,
} from '@/types/crm'
import { OpportunityTimeline } from '@/components/OpportunityTimeline'
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
  UploadCloud,
  MapPin,
  Clock,
  Calendar,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { ImportOpportunitiesModal } from '@/components/ImportOpportunitiesModal'

export default function Opportunities() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [sellersList, setSellersList] = useState<{ id: string; name?: string; email: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [sellerFilter, setSellerFilter] = useState<string>('all')

  // Modais
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)

  // Formulário Estado
  // Drag and drop de cards de oportunidades
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<Opportunity['stage'] | null>(null)

  const [formData, setFormData] = useState<{
    company: string
    stage: Opportunity['stage']
    source: Opportunity['source']
    value: string
    seller: string
    contact_name: string
    contact_email: string
    contact_phone: string
    payment_type: string
    payment_installments: string
    message: string
    return_date: string
    return_time: string
  }>({
    company: '',
    stage: 'Novo',
    source: 'Formulário Público',
    value: '',
    seller: user?.id || '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    payment_type: '',
    payment_installments: '1',
    message: '',
    return_date: '',
    return_time: '',
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

  // Prevenir comportamento padrão do navegador de abrir/fazer download ao soltar arquivos acidentalmente na janela
  // Mas sem qualquer overlay ou abertura automática do importador
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/bitcrm-card-id')) {
        return
      }
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        e.preventDefault()
      }
    }

    const handleWindowDrop = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/bitcrm-card-id')) {
        return
      }
      if (e.dataTransfer && e.dataTransfer.types.includes('Files')) {
        e.preventDefault()
      }
    }

    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [])

  // Inscrição em tempo real
  useRealtime<Opportunity>('opportunities', () => {
    fetchOpportunities()
  })

  // Converte string ISO ou DB para partes de date (YYYY-MM-DD) e time (HH:mm) locais
  const parseDateTimeParts = (isoString?: string | null) => {
    if (!isoString) return { date: '', time: '' }
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return { date: '', time: '' }
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hours = String(d.getHours()).padStart(2, '0')
      const mins = String(d.getMinutes()).padStart(2, '0')
      return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${mins}`,
      }
    } catch {
      return { date: '', time: '' }
    }
  }

  // Combina data e hora selecionadas no formulário em ISO string (ou null se vazio)
  const buildIsoDateTime = (dateStr: string, timeStr: string): string | null => {
    if (!dateStr.trim()) return null
    try {
      const time = timeStr.trim() || '09:00'
      const [year, month, day] = dateStr.split('-').map(Number)
      const [hours, minutes] = time.split(':').map(Number)
      const d = new Date(year, month - 1, day, hours || 0, minutes || 0, 0, 0)
      if (isNaN(d.getTime())) return null
      return d.toISOString()
    } catch {
      return null
    }
  }

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
      payment_type: '',
      payment_installments: '1',
      message: '',
      return_date: '',
      return_time: '',
    })
    setFormErrors({})
    setCreateModalOpen(true)
  }

  // Abrir Modal de Edição
  const handleOpenEdit = (opp: Opportunity) => {
    setSelectedOpp(opp)
    const { date, time } = parseDateTimeParts(opp.return_at)
    setFormData({
      company: opp.company,
      stage: opp.stage,
      source: opp.source,
      value: opp.value ? String(opp.value) : '',
      seller: opp.seller || user?.id || '',
      contact_name: opp.contact_name || '',
      contact_email: opp.contact_email || '',
      contact_phone: opp.contact_phone || '',
      payment_type: opp.payment_type || '',
      payment_installments: opp.payment_installments ? String(opp.payment_installments) : '1',
      message: opp.message || '',
      return_date: date,
      return_time: time,
    })
    setFormErrors({})
    setEditModalOpen(true)
  }

  // Abrir Modal de Detalhes
  const handleOpenDetail = (opp: Opportunity) => {
    setSelectedOpp(opp)
    setDetailModalOpen(true)
  }

  // Alterar estágio (com atualização otimista + rollback em erro)
  const handleStageChange = async (oppId: string, newStage: Opportunity['stage']) => {
    const previousOpps = [...opportunities]
    const targetOpp = opportunities.find((o) => o.id === oppId)
    if (!targetOpp || targetOpp.stage === newStage) return

    // 1. Atualização otimista imediata no estado local
    setOpportunities((prev) => prev.map((o) => (o.id === oppId ? { ...o, stage: newStage } : o)))

    // 2. Persistência no PocketBase
    try {
      await pb.collection('opportunities').update(oppId, { stage: newStage })
      toast({
        title: 'Estágio atualizado!',
        description: `"${targetOpp.company}" movida para ${newStage}.`,
      })
    } catch (err) {
      // 3. Rollback em caso de erro
      setOpportunities(previousOpps)
      console.error('Erro ao atualizar estágio:', err)
      toast({
        title: 'Erro ao mover oportunidade',
        description: 'Não foi possível salvar a alteração. O card retornou ao estágio anterior.',
        variant: 'destructive',
      })
    }
  }

  // Drag and drop de cards de oportunidades (desktop HTML5 drag & drop)
  const handleCardDragStart = (e: React.DragEvent, oppId: string) => {
    e.stopPropagation()
    // Definir formato exclusivo para card de oportunidade
    e.dataTransfer.setData('application/bitcrm-card-id', oppId)
    e.dataTransfer.setData('text/plain', oppId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingCardId(oppId)
  }

  const handleCardDragEnd = () => {
    setDraggingCardId(null)
    setDragOverStage(null)
  }

  // Suporte a Touch Drag & Drop para dispositivos móveis
  const touchStateRef = React.useRef<{
    cardId: string | null
    startX: number
    startY: number
    cloneEl: HTMLElement | null
    isDragging: boolean
  }>({
    cardId: null,
    startX: 0,
    startY: 0,
    cloneEl: null,
    isDragging: false,
  })

  const handleCardTouchStart = (e: React.TouchEvent, oppId: string) => {
    const touch = e.touches[0]
    if (!touch) return
    touchStateRef.current = {
      cardId: oppId,
      startX: touch.clientX,
      startY: touch.clientY,
      cloneEl: null,
      isDragging: false,
    }
  }

  const handleCardTouchMove = (e: React.TouchEvent) => {
    const state = touchStateRef.current
    if (!state.cardId) return
    const touch = e.touches[0]
    if (!touch) return

    const deltaX = Math.abs(touch.clientX - state.startX)
    const deltaY = Math.abs(touch.clientY - state.startY)

    // Se moveu mais de 10px, iniciar drag de card touch
    if (!state.isDragging && (deltaX > 10 || deltaY > 10)) {
      state.isDragging = true
      setDraggingCardId(state.cardId)

      // Criar elemento visual flutuante (preview)
      const targetCard = document.querySelector(`[data-opp-id="${state.cardId}"]`) as HTMLElement
      if (targetCard) {
        const clone = targetCard.cloneNode(true) as HTMLElement
        clone.style.position = 'fixed'
        clone.style.pointerEvents = 'none'
        clone.style.zIndex = '9999'
        clone.style.opacity = '0.85'
        clone.style.width = `${targetCard.offsetWidth}px`
        clone.style.transform = 'scale(0.95)'
        clone.style.boxShadow = '0 10px 25px -5px rgba(99, 102, 241, 0.4)'
        clone.style.left = `${touch.clientX - targetCard.offsetWidth / 2}px`
        clone.style.top = `${touch.clientY - 20}px`
        document.body.appendChild(clone)
        state.cloneEl = clone
      }
    }

    if (state.isDragging) {
      e.preventDefault()
      if (state.cloneEl) {
        state.cloneEl.style.left = `${touch.clientX - state.cloneEl.offsetWidth / 2}px`
        state.cloneEl.style.top = `${touch.clientY - 20}px`
      }

      // Identificar coluna sob o ponto de toque
      const elem = document.elementFromPoint(touch.clientX, touch.clientY)
      const col = elem?.closest('[data-stage]') as HTMLElement | null
      const hoveredStage = col?.getAttribute('data-stage') as Opportunity['stage'] | null
      setDragOverStage(hoveredStage || null)
    }
  }

  const handleCardTouchEnd = async (e: React.TouchEvent) => {
    const state = touchStateRef.current
    if (state.cloneEl) {
      state.cloneEl.remove()
      state.cloneEl = null
    }

    if (state.isDragging && state.cardId) {
      const touch = e.changedTouches[0]
      if (touch) {
        const elem = document.elementFromPoint(touch.clientX, touch.clientY)
        const col = elem?.closest('[data-stage]') as HTMLElement | null
        const targetStage = col?.getAttribute('data-stage') as Opportunity['stage'] | null
        if (targetStage) {
          await handleStageChange(state.cardId, targetStage)
        }
      }
    }

    touchStateRef.current = {
      cardId: null,
      startX: 0,
      startY: 0,
      cloneEl: null,
      isDragging: false,
    }
    setDraggingCardId(null)
    setDragOverStage(null)
  }

  const handleColumnDragOver = (e: React.DragEvent, stage: Opportunity['stage']) => {
    // Só aceita se for drag de card (e não arquivo solto do sistema operacional)
    if (e.dataTransfer.types.includes('application/bitcrm-card-id')) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
      if (dragOverStage !== stage) {
        setDragOverStage(stage)
      }
    }
  }

  const handleColumnDragLeave = (e: React.DragEvent, stage: Opportunity['stage']) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    if (dragOverStage === stage) {
      setDragOverStage(null)
    }
  }

  const handleColumnDrop = async (e: React.DragEvent, targetStage: Opportunity['stage']) => {
    const cardId = e.dataTransfer.getData('application/bitcrm-card-id')
    setDragOverStage(null)
    setDraggingCardId(null)

    if (!cardId) return
    e.preventDefault()
    e.stopPropagation()

    await handleStageChange(cardId, targetStage)
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
        payment_type: formData.payment_type || null,
        payment_installments:
          formData.payment_type === 'Parcelado' && formData.payment_installments
            ? Math.min(10, Math.max(1, parseInt(formData.payment_installments, 10)))
            : null,
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
      const returnAtIso = buildIsoDateTime(formData.return_date, formData.return_time)

      await pb.collection('opportunities').update(selectedOpp.id, {
        company: formData.company.trim(),
        stage: formData.stage,
        source: formData.source,
        value: formData.value ? parseFloat(formData.value.replace(',', '.')) : 0,
        seller: formData.seller || user?.id,
        contact_name: formData.contact_name.trim(),
        contact_email: formData.contact_email.trim(),
        contact_phone: formData.contact_phone.trim(),
        payment_type: formData.payment_type || null,
        payment_installments:
          formData.payment_type === 'Parcelado' && formData.payment_installments
            ? Math.min(10, Math.max(1, parseInt(formData.payment_installments, 10)))
            : null,
        message: formData.message.trim(),
        return_at: returnAtIso,
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

  // Mapeamento de vendedores para lookup rápido por ID no filtro de busca
  const sellersMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of sellersList) {
      if (s.id) {
        map.set(s.id, [s.name, s.email].filter(Boolean).join(' '))
      }
    }
    return map
  }, [sellersList])

  // Filtragem dos cards (busca global substring case-insensitive sem acento + normalização de telefone)
  const filteredOpps = useMemo(() => {
    const rawQuery = searchQuery.trim()

    // Normalização padrão para busca textual: minúsculas e sem acentos diacríticos
    const normalizeText = (val: string | null | undefined): string => {
      if (!val) return ''
      return val
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    }

    // Normalização de telefone: remove qualquer caractere que não seja dígito
    // e retira o prefixo internacional '55' caso seja DDI Brasil (12 ou 13 dígitos)
    const normalizePhoneDigits = (val: string | null | undefined): string => {
      if (!val) return ''
      let digits = val.toString().replace(/\D/g, '')
      digits = digits.replace(/^0+/, '')
      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2)
      }
      return digits
    }

    const queryNorm = normalizeText(rawQuery)
    const queryDigits = rawQuery.replace(/\D/g, '')
    // Se a busca tiver dígitos com prefixo 55 internacional, também normaliza
    const queryPhoneDigits = normalizePhoneDigits(rawQuery)

    return opportunities.filter((opp) => {
      // Regra de perfil:
      // Se for admin: vê tudo de todos, com filtro opcional por vendedor
      // Se não for admin: vê somente suas oportunidades
      if (!isAdmin) {
        const isMyOpp =
          !opp.seller || opp.seller === user?.id || opp.expand?.seller?.id === user?.id
        if (!isMyOpp) return false
      } else if (sellerFilter !== 'all') {
        const matchesSeller = opp.seller === sellerFilter || opp.expand?.seller?.id === sellerFilter
        if (!matchesSeller) return false
      }

      // Filtro de estágio
      if (stageFilter !== 'all' && opp.stage !== stageFilter) {
        return false
      }

      // Filtro de origem
      if (sourceFilter !== 'all' && opp.source !== sourceFilter) {
        return false
      }

      // Se não houver texto digitado na busca, aceita
      if (!queryNorm) {
        return true
      }

      // 1. Verificação por Telefone / WhatsApp:
      // Permite buscar por partes do telefone (ex: "4567", "9912", "11991234567", "(11) 99123-4567")
      if (opp.contact_phone) {
        const rawPhone = opp.contact_phone
        // Busca textual direta no telefone com sua formatação original
        if (normalizeText(rawPhone).includes(queryNorm)) {
          return true
        }

        // Busca numérica desformatada (apenas dígitos)
        const digitsOnly = rawPhone.replace(/\D/g, '')
        const normalizedDigits = normalizePhoneDigits(rawPhone)

        if (queryDigits && digitsOnly.includes(queryDigits)) {
          return true
        }
        if (queryPhoneDigits && normalizedDigits.includes(queryPhoneDigits)) {
          return true
        }
        if (queryDigits && normalizedDigits.includes(queryDigits)) {
          return true
        }
      }

      // 2. Busca Global em todos os demais campos da oportunidade:
      // - Empresa / título
      // - Nome do contato
      // - E-mail
      // - Cidade
      // - Estágio
      // - Origem
      // - Forma de pagamento e parcelamento
      // - Mensagem, observações, escopo e links/fontes
      // - Vendedor responsável (nome e e-mail)
      // - Valores (numérico bruto, formato moeda BRL "R$ 500,00", centavos etc.)
      const sellerInfo =
        opp.expand?.seller?.name ||
        opp.expand?.seller?.email ||
        (opp.seller ? sellersMap.get(opp.seller) : '') ||
        ''

      const numericVal = opp.value !== undefined && opp.value !== null ? String(opp.value) : ''
      const brlFormatted = formatBRL(opp.value)

      const installmentsText =
        opp.payment_installments !== null && opp.payment_installments !== undefined
          ? `${opp.payment_installments}x ${opp.payment_installments} parcelas`
          : ''

      // Campos textuais para verificação
      const searchableFields = [
        opp.company,
        opp.contact_name,
        opp.contact_email,
        opp.city,
        opp.stage,
        opp.source,
        opp.payment_type,
        installmentsText,
        opp.message,
        sellerInfo,
        numericVal,
        brlFormatted,
      ]

      for (const field of searchableFields) {
        if (field && normalizeText(field).includes(queryNorm)) {
          return true
        }
      }

      return false
    })
  }, [
    opportunities,
    searchQuery,
    stageFilter,
    sourceFilter,
    sellerFilter,
    isAdmin,
    user?.id,
    sellersMap,
  ])

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

          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="border-indigo-500/40 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 hover:text-white rounded-xl h-9"
            >
              <UploadCloud className="w-4 h-4 mr-1.5 text-indigo-400" />
              Importar
            </Button>
          )}

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

        <div className="flex flex-wrap items-center gap-2">
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

          <div className="w-36">
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

          {isAdmin && sellersList.length > 0 && (
            <div className="w-44">
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-9 rounded-xl">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                  <SelectItem value="all">Toda a Equipe</SelectItem>
                  {sellersList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Kanban (6 Colunas visíveis simultaneamente em telas desktop >= 1024px e rolagem suave apenas em telas estreitas) */}
      <div className="overflow-x-auto pb-6">
        <div className="grid grid-cols-6 gap-2.5 lg:gap-3 w-full min-w-[1020px] lg:min-w-0">
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
                data-stage={stage}
                onDragOver={(e) => handleColumnDragOver(e, stage)}
                onDragLeave={(e) => handleColumnDragLeave(e, stage)}
                onDrop={(e) => handleColumnDrop(e, stage)}
                className={`min-w-0 bg-[#0E1017] border rounded-2xl flex flex-col max-h-[calc(100vh-230px)] transition-all duration-200 ${
                  dragOverStage === stage
                    ? 'border-indigo-500 bg-[#121424] shadow-xl shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                    : 'border-[#262A33]'
                }`}
              >
                {/* Cabeçalho da Coluna */}
                <div
                  className={`p-2.5 border-b border-[#262A33] flex items-center justify-between gap-1.5 rounded-t-2xl min-w-0 ${stageStyle.bg}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${stageStyle.dot}`} />
                    <span
                      title={stage}
                      className={`text-[11px] xl:text-xs font-bold uppercase tracking-wider truncate ${stageStyle.color}`}
                    >
                      {stage}
                    </span>
                    <span
                      title={`${stageOpps.length} ${stageOpps.length === 1 ? 'oportunidade' : 'oportunidades'}`}
                      className="text-[10px] font-semibold text-gray-400 bg-[#12141A] px-1.5 py-0.5 rounded-full border border-[#262A33] shrink-0 min-w-[18px] text-center"
                    >
                      {stageOpps.length}
                    </span>
                  </div>
                  <div
                    title={`Total do estágio: ${formatBRL(stageTotalValue)}`}
                    className="text-right shrink-0"
                  >
                    <span className="text-[10px] xl:text-[11px] font-medium text-gray-400 tabular-nums whitespace-nowrap">
                      {stageTotalValue >= 1000
                        ? formatCompactBRL(stageTotalValue)
                        : formatBRL(stageTotalValue)}
                    </span>
                  </div>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="p-2 space-y-2 overflow-y-auto flex-1 custom-scrollbar min-w-0">
                  {stageOpps.length === 0 ? (
                    <div
                      className={`py-8 text-center border border-dashed rounded-xl my-2 px-1 transition-colors ${
                        dragOverStage === stage
                          ? 'border-indigo-400 bg-indigo-500/10 text-indigo-300'
                          : 'border-[#262A33]/70 text-gray-500'
                      }`}
                    >
                      <span className="text-[11px] leading-snug block">
                        {dragOverStage === stage ? 'Solte aqui para mover' : 'Nenhum negócio aqui'}
                      </span>
                    </div>
                  ) : (
                    stageOpps.map((opp) => (
                      <div
                        key={opp.id}
                        data-opp-id={opp.id}
                        draggable
                        onDragStart={(e) => handleCardDragStart(e, opp.id)}
                        onDragEnd={handleCardDragEnd}
                        onTouchStart={(e) => handleCardTouchStart(e, opp.id)}
                        onTouchMove={handleCardTouchMove}
                        onTouchEnd={handleCardTouchEnd}
                        className={`p-2.5 rounded-xl bg-[#12141A] border transition-all duration-150 space-y-2 group relative cursor-grab active:cursor-grabbing touch-manipulation min-w-0 ${
                          draggingCardId === opp.id
                            ? 'opacity-40 scale-95 border-indigo-500 shadow-md'
                            : 'border-[#262A33] hover:border-indigo-500/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/5'
                        }`}
                      >
                        {/* Topo do Card: Empresa e Ações */}
                        <div className="flex items-start justify-between gap-1.5 min-w-0">
                          <h4
                            onClick={() => handleOpenDetail(opp)}
                            title={opp.company}
                            className="font-bold text-xs sm:text-[13px] text-white group-hover:text-indigo-300 transition-colors cursor-pointer leading-tight line-clamp-2 min-w-0 flex-1 break-words"
                          >
                            {opp.company}
                          </h4>
                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
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
                        {(opp.contact_name || opp.contact_phone || opp.city) && (
                          <div className="text-[11px] text-gray-400 space-y-0.5 min-w-0">
                            {opp.contact_name && (
                              <div
                                className="flex items-center gap-1.5 min-w-0"
                                title={opp.contact_name}
                              >
                                <UserCheck className="w-3 h-3 text-gray-500 shrink-0" />
                                <span className="truncate">{opp.contact_name}</span>
                              </div>
                            )}
                            {opp.contact_phone && (
                              <div
                                className="flex items-center gap-1.5 min-w-0"
                                title={opp.contact_phone}
                              >
                                <Phone className="w-3 h-3 text-gray-500 shrink-0" />
                                <span className="font-mono text-[10px] truncate">
                                  {opp.contact_phone}
                                </span>
                              </div>
                            )}
                            {opp.city && (
                              <div
                                className="flex items-center gap-1.5 text-gray-500 min-w-0"
                                title={opp.city}
                              >
                                <MapPin className="w-3 h-3 text-gray-500 shrink-0" />
                                <span className="text-[10px] truncate">{opp.city}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Badge do Alerta de Retorno se houver */}
                        {opp.return_at &&
                          (() => {
                            const alert = getReturnAlertInfo(opp.return_at, opp.stage)
                            if (alert.status === 'none') return null
                            return (
                              <div
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border min-w-0 ${alert.badgeClass}`}
                                title={`Alerta agendado: ${alert.formattedDate} (${alert.label})`}
                              >
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate font-medium">{alert.label}</span>
                              </div>
                            )
                          })()}

                        {/* Valor, Pagamento e Badge de Origem */}
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#262A33]/80 min-w-0">
                          <div className="flex flex-col min-w-0">
                            <span
                              title={formatBRL(opp.value)}
                              className="text-xs font-bold text-indigo-400 tabular-nums truncate"
                            >
                              {formatBRL(opp.value)}
                            </span>
                            {opp.payment_type && (
                              <span className="text-[9px] text-emerald-400 font-medium truncate">
                                {opp.payment_type}
                                {opp.payment_type === 'Parcelado' && opp.payment_installments
                                  ? ` (${opp.payment_installments}x)`
                                  : ''}
                              </span>
                            )}
                          </div>
                          <span
                            title={opp.source}
                            className="text-[9px] text-gray-400 bg-[#171A24] px-1 py-0.5 rounded border border-[#262A33] shrink-0 truncate max-w-[80px]"
                          >
                            {opp.source}
                          </span>
                        </div>

                        {/* Seletor Rápido de Mudança de Estágio */}
                        <div className="pt-0.5">
                          <Select
                            value={opp.stage}
                            onValueChange={(val) =>
                              handleStageChange(opp.id, val as Opportunity['stage'])
                            }
                          >
                            <SelectTrigger className="w-full h-6 text-[10px] bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white rounded-lg px-2">
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

            {/* Pagamento e Parcelas */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Tipo de Pagamento</Label>
                <Select
                  value={formData.payment_type || 'none'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, payment_type: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    <SelectItem value="none">Não definido</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Débito">Débito</SelectItem>
                    <SelectItem value="Parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payment_type === 'Parcelado' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-indigo-300">Parcelas (até 10x)</Label>
                  <Select
                    value={formData.payment_installments || '1'}
                    onValueChange={(val) => setFormData({ ...formData, payment_installments: val })}
                  >
                    <SelectTrigger className="bg-[#12141A] border-indigo-500/40 text-white text-xs h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x {n === 1 ? '(à vista)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center text-xs text-gray-500 pt-6">
                  {formData.payment_type ? 'Pagamento à vista' : 'Opcional'}
                </div>
              )}
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
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar">
          <DialogHeader className="pr-10">
            <DialogTitle className="text-lg font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-indigo-400" />
                Editar Oportunidade
              </span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulário para editar informações da oportunidade comercial
            </DialogDescription>
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

            {/* Pagamento e Parcelas no Edit */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-300">Tipo de Pagamento</Label>
                <Select
                  value={formData.payment_type || 'none'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, payment_type: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-10 rounded-xl">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    <SelectItem value="none">Não definido</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="Débito">Débito</SelectItem>
                    <SelectItem value="Parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.payment_type === 'Parcelado' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-indigo-300">Parcelas (até 10x)</Label>
                  <Select
                    value={formData.payment_installments || '1'}
                    onValueChange={(val) => setFormData({ ...formData, payment_installments: val })}
                  >
                    <SelectTrigger className="bg-[#12141A] border-indigo-500/40 text-white text-xs h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x {n === 1 ? '(à vista)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="flex items-center text-xs text-gray-500 pt-6">
                  {formData.payment_type ? 'Pagamento à vista' : 'Opcional'}
                </div>
              )}
            </div>

            {/* Alerta de Retorno (Follow-up agendado com data e hora) */}
            <div className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <Label className="text-xs font-semibold text-gray-200">Alerta de Retorno</Label>
                </div>
                {Boolean(formData.return_date) && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, return_date: '', return_time: '' })}
                    className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-400 transition-colors"
                    title="Remover alerta de retorno"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Limpar alerta
                  </button>
                )}
              </div>

              <p className="text-[11px] text-gray-400">
                Data e hora para retornar o contato com o cliente.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-400 block">Data do Retorno</span>
                  <Input
                    type="date"
                    value={formData.return_date}
                    onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                    className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-400 block">Horário</span>
                  <Input
                    type="time"
                    value={formData.return_time}
                    onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
                    disabled={!formData.return_date}
                    className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Pré-visualização do estado do alerta configurado */}
              {formData.return_date &&
                (() => {
                  const previewIso = buildIsoDateTime(formData.return_date, formData.return_time)
                  if (!previewIso) return null
                  const alert = getReturnAlertInfo(previewIso, formData.stage)
                  return (
                    <div
                      className={`mt-2 p-2 rounded-lg text-xs flex items-center gap-2 border ${alert.badgeClass}`}
                    >
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {alert.status === 'overdue' && 'Atenção: Horário de retorno já expirado! '}
                        {alert.status === 'today' && 'Agendado para hoje: '}
                        {alert.status === 'upcoming' && 'Retorno futuro agendado: '}
                        <strong>{alert.formattedDate}</strong>
                      </span>
                    </div>
                  )
                })()}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Mensagem / Observações</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[70px]"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#262A33] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div>
                {selectedOpp && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selectedOpp.id)}
                    className="border-red-500/30 bg-red-950/20 text-red-400 hover:text-red-300 hover:bg-red-950/40 hover:border-red-500/50 text-xs h-9 px-3 w-full sm:w-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Excluir Oportunidade
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditModalOpen(false)}
                  className="border-[#262A33] text-gray-300 text-xs h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9"
                >
                  {submitting ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </DialogFooter>
          </form>

          {/* Timeline de Conversas / Interações na Edição (fora da tag <form> da oportunidade para evitar colisão e fechamento de modal) */}
          {selectedOpp && (
            <div className="border-t border-[#262A33] pt-4">
              <OpportunityTimeline
                opportunityId={selectedOpp.id}
                currentUserId={user?.id}
                currentUserRole={user?.role}
                currentUserEmail={user?.email}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Importação de Oportunidades */}
      <ImportOpportunitiesModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => {
          fetchOpportunities()
        }}
        currentUserEmail={user?.email}
        currentUserId={user?.id}
        existingOpportunities={opportunities}
        sellersList={sellersList}
      />

      {/* Modal: Detalhes da Oportunidade */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar">
          {selectedOpp && (
            <>
              <DialogHeader className="pr-10">
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
                <DialogDescription className="sr-only">
                  Detalhes completos da oportunidade comercial
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Valor, Origem e Condições de Pagamento */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
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
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-gray-500 block text-[11px]">Forma de Pagamento</span>
                    <span className="text-sm font-semibold text-emerald-400">
                      {selectedOpp.payment_type ? (
                        <>
                          {selectedOpp.payment_type}
                          {selectedOpp.payment_type === 'Parcelado' &&
                          selectedOpp.payment_installments
                            ? ` (${selectedOpp.payment_installments}x)`
                            : ''}
                        </>
                      ) : (
                        <span className="text-gray-500 font-normal">A combinar</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Alerta de Retorno no Detalhe se houver */}
                {selectedOpp.return_at &&
                  (() => {
                    const alert = getReturnAlertInfo(selectedOpp.return_at, selectedOpp.stage)
                    if (alert.status === 'none') return null
                    return (
                      <div
                        className={`p-3 rounded-xl border flex items-center justify-between ${alert.badgeClass}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Clock className="w-4 h-4 shrink-0" />
                          <div>
                            <span className="text-[11px] uppercase tracking-wider font-bold block opacity-80">
                              Alerta de Retorno
                            </span>
                            <span className="text-xs font-semibold">{alert.label}</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDetailModalOpen(false)
                            handleOpenEdit(selectedOpp)
                          }}
                          className="text-[11px] h-7 px-2 hover:bg-white/10 text-inherit"
                        >
                          Reagendar
                        </Button>
                      </div>
                    )
                  })()}

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

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                  <span>Criado em: {formatDateBR(selectedOpp.created)}</span>
                  <span>Última alteração: {formatDateBR(selectedOpp.updated)}</span>
                </div>

                {/* Timeline de Conversas / Interações no Detalhe */}
                <div className="border-t border-[#262A33] pt-3">
                  <OpportunityTimeline
                    opportunityId={selectedOpp.id}
                    currentUserId={user?.id}
                    currentUserRole={user?.role}
                    currentUserEmail={user?.email}
                  />
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-[#262A33] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(selectedOpp.id)}
                    className="border-red-500/30 bg-red-950/20 text-red-400 hover:text-red-300 hover:bg-red-950/40 hover:border-red-500/50 text-xs h-9 px-3 w-full sm:w-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Excluir Oportunidade
                  </Button>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailModalOpen(false)}
                    className="border-[#262A33] text-gray-300 text-xs h-9"
                  >
                    Fechar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setDetailModalOpen(false)
                      handleOpenEdit(selectedOpp)
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9"
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
