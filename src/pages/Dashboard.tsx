import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import {
  Opportunity,
  STAGE_CONFIG,
  STAGES,
  formatBRL,
  formatDateBR,
  getReturnAlertInfo,
} from '@/types/crm'
import {
  ReturnPeriodPreset,
  ReturnPeriodFilterState,
  formatDateToLocalYMD,
  getPresetDateRange,
  filterScheduledReturns,
  groupReturnsByDay,
} from '@/lib/returnPeriodFilter'
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
import { OpportunityTimeline } from '@/components/OpportunityTimeline'
import {
  Briefcase,
  TrendingUp,
  Award,
  DollarSign,
  ArrowRight,
  Sparkles,
  QrCode,
  Inbox,
  UserCheck,
  Building,
  Phone,
  Mail,
  RefreshCw,
  Clock,
  AlertTriangle,
  CalendarCheck,
  Bell,
  Edit2,
  Trash2,
  XCircle,
  Calendar,
  Filter,
} from 'lucide-react'

export default function Dashboard() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Estado para abrir modal de edição direta pelo clique no alerta de retorno
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [sellersList, setSellersList] = useState<{ id: string; name?: string; email: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
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
      // Ignora erro caso não possa listar todos
    }
  }, [])

  useEffect(() => {
    fetchOpportunities()
    fetchSellers()
  }, [fetchOpportunities, fetchSellers])

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
      fetchOpportunities()
    } catch {
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o registro.',
        variant: 'destructive',
      })
    }
  }

  // Inscrição em tempo real na coleção opportunities
  useRealtime<Opportunity>('opportunities', () => {
    fetchOpportunities()
  })

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    fetchOpportunities()
  }

  // Filtragem e Métricas
  const myOpps = useMemo(() => {
    if (!user) return []
    return opportunities.filter(
      (opp) => !opp.seller || opp.seller === user.id || opp.expand?.seller?.id === user.id,
    )
  }, [opportunities, user])

  // Separar retornos:
  // "vendedor vê só o dele; admin vê de todos (mas o Painel de retornos deve focar nas oportunidades do usuário logado, com o admin podendo ver as de todos — se for mais simples, admin vê todas)."
  // No painel do usuário, priorizamos a carteira relevante (se admin, consideramos todas as oportunidades para não deixar nenhum retorno perdido passar, ou o usuário atual).
  const oppsForAlerts = useMemo(() => {
    if (isAdmin) {
      return opportunities
    }
    return myOpps
  }, [isAdmin, opportunities, myOpps])

  // Estado do filtro de período para Retornos Agendados (Padrão: Hoje)
  const [returnPeriodFilter, setReturnPeriodFilter] = useState<ReturnPeriodFilterState>(() => {
    const todayStr = formatDateToLocalYMD(new Date())
    return {
      preset: 'today',
      startDate: todayStr,
      endDate: todayStr,
    }
  })

  // Manipulador de troca de presets de período
  const handleSelectPeriodPreset = (preset: ReturnPeriodPreset) => {
    if (preset === 'custom') {
      setReturnPeriodFilter((prev) => ({
        ...prev,
        preset: 'custom',
      }))
      return
    }

    const { startDate, endDate } = getPresetDateRange(preset)
    setReturnPeriodFilter({
      preset,
      startDate,
      endDate,
    })
  }

  // Filtragem dos retornos agendados (Atrasados + Retornos do Período)
  const { overdue: overdueReturns, periodReturns } = useMemo(() => {
    return filterScheduledReturns(oppsForAlerts, returnPeriodFilter)
  }, [oppsForAlerts, returnPeriodFilter])

  // Agrupamento dos retornos do período por dia
  const groupedPeriodReturns = useMemo(() => {
    return groupReturnsByDay(periodReturns)
  }, [periodReturns])

  // Retornos estritamente de hoje (para manter o badge de topo e aviso do painel inalterados)
  const todayReturns = useMemo(() => {
    return oppsForAlerts
      .filter((opp) => {
        if (!opp.return_at) return false
        const info = getReturnAlertInfo(opp.return_at, opp.stage)
        return info.status === 'today'
      })
      .sort((a, b) => new Date(a.return_at!).getTime() - new Date(b.return_at!).getTime())
  }, [oppsForAlerts])

  const totalActionableAlerts = overdueReturns.length + todayReturns.length

  const totalOppsCount = myOpps.length

  // Estágios para os indicadores "Em Negociação" e "Valor em Negociação": apenas 'Proposta'
  const NEGOTIATION_STAGES: Opportunity['stage'][] = ['Proposta']

  const inNegotiationOpps = useMemo(() => {
    return myOpps.filter((opp) => NEGOTIATION_STAGES.includes(opp.stage))
  }, [myOpps])

  const inNegotiationCount = inNegotiationOpps.length

  const inNegotiationValue = useMemo(() => {
    return inNegotiationOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
  }, [inNegotiationOpps])

  const wonOpps = useMemo(() => {
    return myOpps.filter((opp) => opp.stage === 'Ganho')
  }, [myOpps])

  const wonCount = wonOpps.length

  const totalWonValue = useMemo(() => {
    return wonOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
  }, [wonOpps])

  const lostOpps = useMemo(() => {
    return myOpps.filter((opp) => opp.stage === 'Perdido')
  }, [myOpps])

  const lostCount = lostOpps.length

  const totalLostValue = useMemo(() => {
    return lostOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
  }, [lostOpps])

  // Para administradores: visão rápida dos perdidos por vendedor (para controle da equipe)
  const lostStatsBySeller = useMemo(() => {
    if (!isAdmin) return []
    const map = new Map<string, { id: string; name: string; count: number; value: number }>()

    // Popula vendedores cadastrados
    sellersList.forEach((s) => {
      map.set(s.id, {
        id: s.id,
        name: s.name || s.email.split('@')[0],
        count: 0,
        value: 0,
      })
    })

    const unassignedKey = 'unassigned'
    map.set(unassignedKey, {
      id: unassignedKey,
      name: 'Sem Vendedor',
      count: 0,
      value: 0,
    })

    opportunities.forEach((opp) => {
      if (opp.stage === 'Perdido') {
        const sellerId = opp.seller || opp.expand?.seller?.id || unassignedKey
        let stat = map.get(sellerId)
        if (!stat) {
          stat = {
            id: sellerId,
            name: opp.expand?.seller?.name || opp.expand?.seller?.email || 'Outro Vendedor',
            count: 0,
            value: 0,
          }
          map.set(sellerId, stat)
        }
        stat.count += 1
        const v = typeof opp.value === 'number' ? opp.value : parseFloat(String(opp.value || 0))
        stat.value += isNaN(v) ? 0 : v
      }
    })

    return Array.from(map.values())
      .filter((s) => s.count > 0)
      .sort((a, b) => b.value - a.value || b.count - a.count)
  }, [isAdmin, sellersList, opportunities])

  // 5 Oportunidades mais recentes (apenas estágios em negociação: Qualificado, Agendado e Proposta)
  const recentOpportunities = useMemo(() => {
    return myOpps
      .filter(
        (opp) =>
          opp.stage === 'Qualificado' || opp.stage === 'Agendado' || opp.stage === 'Proposta',
      )
      .slice(0, 5)
  }, [myOpps])

  // Leads recentes vindos do formulário público (source === 'Formulário Público')
  const formLeads = useMemo(() => {
    return opportunities.filter((opp) => opp.source === 'Formulário Público').slice(0, 5)
  }, [opportunities])

  const cardsData = [
    {
      title: 'Minhas Oportunidades',
      value: totalOppsCount.toString(),
      description: 'Total em carteira',
      icon: Briefcase,
      color: 'from-blue-500/20 to-indigo-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Em Negociação',
      value: inNegotiationCount.toString(),
      description: 'Apenas Proposta',
      icon: TrendingUp,
      color: 'from-amber-500/20 to-orange-500/10',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      title: 'Valor em Negociação',
      value: formatBRL(inNegotiationValue),
      description: 'Apenas Proposta',
      icon: DollarSign,
      color: 'from-indigo-500/20 to-cyan-500/10',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
    },
    {
      title: 'Ganhas',
      value: wonCount.toString(),
      description: 'Negócios fechados',
      icon: Award,
      color: 'from-emerald-500/20 to-teal-500/10',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Valor Total Fechado',
      value: formatBRL(totalWonValue),
      description: 'Faturamento acumulado',
      icon: DollarSign,
      color: 'from-violet-500/20 to-purple-500/10',
      borderColor: 'border-violet-500/30',
      iconColor: 'text-violet-400',
    },
    {
      title: 'Valor Perdido',
      value: formatBRL(totalLostValue),
      description: `${lostCount} oportunidade${lostCount === 1 ? '' : 's'} perdida${lostCount === 1 ? '' : 's'}`,
      icon: DollarSign,
      color: 'from-rose-500/20 to-red-500/10',
      borderColor: 'border-rose-500/30',
      iconColor: 'text-rose-400',
    },
  ]

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#262A33]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Painel Comercial
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Tempo Real
            </span>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Administrador
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Olá, <span className="text-white font-medium">{user?.name || user?.email}</span>.
            Acompanhe seus números e novos leads capturados da sua carteira comercial.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="border-[#262A33] bg-[#12141A] text-gray-300 hover:text-white hover:bg-[#181B24] rounded-xl h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            asChild
            size="sm"
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl h-9 shadow-lg shadow-indigo-600/20"
          >
            <Link to="/formulario">
              <QrCode className="w-3.5 h-3.5 mr-1.5" />
              Compartilhar Formulário
            </Link>
          </Button>
        </div>
      </div>

      {/* Aviso / Notificação no Topo do Painel sobre Retornos */}
      {totalActionableAlerts > 0 && (
        <div
          className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg transition-all animate-fadeIn ${
            overdueReturns.length > 0
              ? 'bg-rose-950/30 border-rose-600/40 text-rose-200 shadow-rose-950/20'
              : 'bg-amber-950/30 border-amber-600/40 text-amber-200 shadow-amber-950/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                overdueReturns.length > 0
                  ? 'bg-rose-900/40 border-rose-500/50 text-rose-400'
                  : 'bg-amber-900/40 border-amber-500/50 text-amber-400'
              }`}
            >
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Alertas de Retorno Pendentes</span>
                {overdueReturns.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-extrabold uppercase tracking-wider">
                    {overdueReturns.length} atrasado{overdueReturns.length > 1 ? 's' : ''}
                  </span>
                )}
              </h3>
              <p className="text-xs opacity-90 mt-0.5">
                {overdueReturns.length > 0 && todayReturns.length > 0 ? (
                  <>
                    Você tem <strong className="text-white font-bold">{todayReturns.length}</strong>{' '}
                    retorno{todayReturns.length > 1 ? 's' : ''} agendado
                    {todayReturns.length > 1 ? 's' : ''} para hoje e{' '}
                    <strong className="text-rose-300 font-bold">{overdueReturns.length}</strong>{' '}
                    atrasado{overdueReturns.length > 1 ? 's' : ''}.
                  </>
                ) : overdueReturns.length > 0 ? (
                  <>
                    Você tem{' '}
                    <strong className="text-rose-300 font-bold">{overdueReturns.length}</strong>{' '}
                    retorno{overdueReturns.length > 1 ? 's' : ''} com prazo vencido necessitando de
                    contato imediato.
                  </>
                ) : (
                  <>
                    Você tem <strong className="text-white font-bold">{todayReturns.length}</strong>{' '}
                    retorno{todayReturns.length > 1 ? 's' : ''} programado
                    {todayReturns.length > 1 ? 's' : ''} para hoje.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              asChild
              size="sm"
              variant="outline"
              className={`text-xs h-8 border ${
                overdueReturns.length > 0
                  ? 'border-rose-500/50 hover:bg-rose-500/20 text-white'
                  : 'border-amber-500/50 hover:bg-amber-500/20 text-white'
              }`}
            >
              <Link to="/oportunidades">
                Ir ao Pipeline
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Grid de Cartões de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cardsData.map((card, idx) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className={`p-5 rounded-2xl bg-[#12141A] border ${card.borderColor} shadow-xl relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-200`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              <div
                className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${card.color} rounded-bl-full pointer-events-none opacity-50 group-hover:opacity-80 transition-opacity`}
              />
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-400 tracking-wider uppercase">
                    {card.title}
                  </span>
                  <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2 tabular-nums">
                    {loading ? (
                      <div className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{card.description}</p>
                </div>
                <div
                  className={`p-3 rounded-xl bg-[#171A24] border border-[#262A33] ${card.iconColor} shadow-inner`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Seção Exclusiva: Alerta de Retornos (Retornos de Hoje & Atrasados + Consulta por Período) */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-5 shadow-xl space-y-4">
        {/* Cabeçalho da Seção */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#262A33]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Retornos Agendados (Follow-ups & Abordagens)</span>
                {totalActionableAlerts > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                    {totalActionableAlerts} hoje/atrasado{totalActionableAlerts > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-400">
                {isAdmin
                  ? 'Acompanhamento de retornos da equipe (Pipeline + Guia de Abordagem)'
                  : 'Seus contatos programados com data e hora com o cliente (Pipeline + Guia de Abordagem)'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/abordagem"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 group"
            >
              Guia de Abordagem
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              to="/oportunidades"
              className="text-xs text-gray-400 hover:text-white font-medium inline-flex items-center gap-1 group"
            >
              Pipeline
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Barra de Controle de Período */}
        <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5 text-indigo-400" />
              Período:
            </span>

            <button
              type="button"
              onClick={() => handleSelectPeriodPreset('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                returnPeriodFilter.preset === 'today'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                  : 'bg-[#171A24] text-gray-300 hover:text-white hover:bg-[#202533] border border-[#262A33]'
              }`}
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriodPreset('this_week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                returnPeriodFilter.preset === 'this_week'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                  : 'bg-[#171A24] text-gray-300 hover:text-white hover:bg-[#202533] border border-[#262A33]'
              }`}
            >
              Esta semana
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriodPreset('next_7_days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                returnPeriodFilter.preset === 'next_7_days'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                  : 'bg-[#171A24] text-gray-300 hover:text-white hover:bg-[#202533] border border-[#262A33]'
              }`}
            >
              Próximos 7 dias
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriodPreset('next_30_days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                returnPeriodFilter.preset === 'next_30_days'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                  : 'bg-[#171A24] text-gray-300 hover:text-white hover:bg-[#202533] border border-[#262A33]'
              }`}
            >
              Próximos 30 dias
            </button>

            <button
              type="button"
              onClick={() => handleSelectPeriodPreset('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                returnPeriodFilter.preset === 'custom'
                  ? 'bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/30'
                  : 'bg-[#171A24] text-gray-300 hover:text-white hover:bg-[#202533] border border-[#262A33]'
              }`}
            >
              Personalizado
            </button>
          </div>

          {/* Seletores de Data (De / Até) */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">De:</span>
              <Input
                type="date"
                value={returnPeriodFilter.startDate}
                onChange={(e) =>
                  setReturnPeriodFilter((prev) => ({
                    ...prev,
                    preset: 'custom',
                    startDate: e.target.value,
                  }))
                }
                className="bg-[#171A24] border-[#262A33] text-white text-xs rounded-lg h-8 w-32 px-2"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">Até:</span>
              <Input
                type="date"
                value={returnPeriodFilter.endDate}
                onChange={(e) =>
                  setReturnPeriodFilter((prev) => ({
                    ...prev,
                    preset: 'custom',
                    endDate: e.target.value,
                  }))
                }
                className="bg-[#171A24] border-[#262A33] text-white text-xs rounded-lg h-8 w-32 px-2"
              />
            </div>
            {returnPeriodFilter.preset !== 'today' && (
              <button
                type="button"
                onClick={() => handleSelectPeriodPreset('today')}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium ml-1"
                title="Voltar para a visão padrão de hoje"
              >
                Voltar p/ Hoje
              </button>
            )}
          </div>
        </div>

        {/* Conteúdo das Colunas de Retornos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Bloco 1: Retornos Atrasados (sempre visível independente do período selecionado) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#262A33]/60">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  Retornos Atrasados
                </span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-950/70 text-rose-300 border border-rose-800/50">
                {overdueReturns.length}
              </span>
            </div>

            {overdueReturns.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-[#0E1017] border border-[#262A33]/60 text-xs text-gray-500">
                Nenhum retorno atrasado. Parabéns!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {overdueReturns.map((opp) => {
                  const alert = getReturnAlertInfo(opp.return_at, opp.stage)
                  const stageStyle = STAGE_CONFIG[opp.stage]
                  return (
                    <div
                      key={opp.id}
                      onClick={() => handleOpenEdit(opp)}
                      className="p-3 rounded-xl bg-[#0E1017] border border-rose-800/40 hover:border-rose-500/80 hover:bg-[#191015] transition-all cursor-pointer group flex flex-col justify-between gap-2 shadow-sm"
                      title="Clique para editar e reagendar este retorno"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-white group-hover:text-rose-200 transition-colors block truncate">
                            {opp.company}
                          </span>
                          {opp.contact_name && (
                            <span className="text-xs text-gray-400 block truncate">
                              Contato: {opp.contact_name}{' '}
                              {opp.contact_phone ? `(${opp.contact_phone})` : ''}
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${stageStyle.bg} ${stageStyle.color} ${stageStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                          {stageStyle.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#262A33]/60">
                        <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>Atrasado desde {alert.formattedDate}</span>
                        </div>
                        <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors underline flex items-center gap-1">
                          <Edit2 className="w-3 h-3" />
                          Editar
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bloco 2: Retornos de Hoje OU Retornos do Período */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#262A33]/60">
              <div className="flex items-center gap-2">
                {returnPeriodFilter.preset === 'today' ? (
                  <>
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Retornos de Hoje
                    </span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                      Retornos do Período
                      {returnPeriodFilter.startDate && returnPeriodFilter.endDate && (
                        <span className="normal-case font-normal text-gray-400 text-[11px] ml-1.5">
                          ({formatDateBR(returnPeriodFilter.startDate)} a{' '}
                          {formatDateBR(returnPeriodFilter.endDate)})
                        </span>
                      )}
                    </span>
                  </>
                )}
              </div>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  returnPeriodFilter.preset === 'today'
                    ? 'bg-amber-950/70 text-amber-300 border-amber-800/50'
                    : 'bg-indigo-950/70 text-indigo-300 border-indigo-800/50'
                }`}
              >
                {periodReturns.length}
              </span>
            </div>

            {periodReturns.length === 0 ? (
              <div className="p-4 text-center rounded-xl bg-[#0E1017] border border-[#262A33]/60 text-xs text-gray-500">
                {returnPeriodFilter.preset === 'today'
                  ? 'Nenhum outro retorno agendado para hoje.'
                  : 'Nenhum retorno agendado para o período selecionado.'}
              </div>
            ) : returnPeriodFilter.preset === 'today' ? (
              /* Visual original idêntico quando preset === 'today' */
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {periodReturns.map((opp) => {
                  const alert = getReturnAlertInfo(opp.return_at, opp.stage)
                  const stageStyle = STAGE_CONFIG[opp.stage]
                  return (
                    <div
                      key={opp.id}
                      onClick={() => handleOpenEdit(opp)}
                      className="p-3 rounded-xl bg-[#0E1017] border border-amber-800/40 hover:border-amber-500/80 hover:bg-[#1a1610] transition-all cursor-pointer group flex flex-col justify-between gap-2 shadow-sm"
                      title="Clique para editar e registrar o retorno"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-bold text-sm text-white group-hover:text-amber-200 transition-colors block truncate">
                            {opp.company}
                          </span>
                          {opp.contact_name && (
                            <span className="text-xs text-gray-400 block truncate">
                              Contato: {opp.contact_name}{' '}
                              {opp.contact_phone ? `(${opp.contact_phone})` : ''}
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${stageStyle.bg} ${stageStyle.color} ${stageStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                          {stageStyle.label}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-[#262A33]/60">
                        <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            Hoje às {alert.formattedDate.split(' ')[1] || alert.formattedDate}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors underline flex items-center gap-1">
                          <Edit2 className="w-3 h-3" />
                          Abrir
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Visual agrupado por dia para períodos mais amplos */
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {groupedPeriodReturns.map((group) => (
                  <div key={group.dateKey} className="space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        {group.displayTitle}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
                        {group.items.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((opp) => {
                        const alert = getReturnAlertInfo(opp.return_at, opp.stage)
                        const stageStyle = STAGE_CONFIG[opp.stage]
                        const isOppToday = alert.status === 'today'
                        return (
                          <div
                            key={opp.id}
                            onClick={() => handleOpenEdit(opp)}
                            className={`p-3 rounded-xl bg-[#0E1017] border ${
                              isOppToday
                                ? 'border-amber-800/40 hover:border-amber-500/80 hover:bg-[#1a1610]'
                                : 'border-indigo-800/40 hover:border-indigo-500/80 hover:bg-[#131622]'
                            } transition-all cursor-pointer group flex flex-col justify-between gap-2 shadow-sm`}
                            title="Clique para editar e registrar o retorno"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <span
                                  className={`font-bold text-sm text-white ${
                                    isOppToday
                                      ? 'group-hover:text-amber-200'
                                      : 'group-hover:text-indigo-200'
                                  } transition-colors block truncate`}
                                >
                                  {opp.company}
                                </span>
                                {opp.contact_name && (
                                  <span className="text-xs text-gray-400 block truncate">
                                    Contato: {opp.contact_name}{' '}
                                    {opp.contact_phone ? `(${opp.contact_phone})` : ''}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${stageStyle.bg} ${stageStyle.color} ${stageStyle.border}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                                {stageStyle.label}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#262A33]/60">
                              <div
                                className={`flex items-center gap-1.5 font-semibold ${
                                  isOppToday ? 'text-amber-300' : 'text-indigo-300'
                                }`}
                              >
                                <Clock
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isOppToday ? 'text-amber-400' : 'text-indigo-400'
                                  }`}
                                />
                                <span>{alert.formattedDate}</span>
                              </div>
                              <span className="text-[11px] text-gray-400 group-hover:text-white transition-colors underline flex items-center gap-1">
                                <Edit2 className="w-3 h-3" />
                                Abrir
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Seções em Duas Colunas: Oportunidades Recentes e Leads do Formulário */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Minhas Oportunidades Recentes (7 Colunas) */}
        <div className="lg:col-span-7 bg-[#12141A] border border-[#262A33] rounded-2xl p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#262A33]">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Oportunidades Recentes
              </h2>
            </div>
            <Link
              to="/oportunidades"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 group"
            >
              Ver todas no pipeline
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {recentOpportunities.length === 0 && !loading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center flex-1">
              <div className="w-12 h-12 rounded-full bg-[#181B24] border border-[#262A33] flex items-center justify-center text-gray-500 mb-3">
                <Inbox className="w-5 h-5" />
              </div>
              <p className="text-sm text-gray-300 font-medium">Nenhuma oportunidade ativa</p>
              <p className="text-xs text-gray-500 max-w-xs mt-1">
                Compartilhe seu link de formulário ou crie uma nova oportunidade no pipeline.
              </p>
              <Button asChild size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-xs">
                <Link to="/oportunidades">Ir para o Pipeline</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {recentOpportunities.map((opp) => {
                const stageStyle = STAGE_CONFIG[opp.stage] || STAGE_CONFIG['Novo']
                return (
                  <div
                    key={opp.id}
                    className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] hover:border-indigo-500/40 hover:bg-[#131622] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#181B24] border border-[#262A33] flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                        <Building className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white group-hover:text-indigo-300 transition-colors">
                            {opp.company}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stageStyle.bg} ${stageStyle.color} ${stageStyle.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${stageStyle.dot}`} />
                            {stageStyle.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          {opp.contact_name && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-gray-500" />
                              {opp.contact_name}
                            </span>
                          )}
                          <span className="text-[11px] text-gray-500">Origem: {opp.source}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-[#262A33]">
                      <span className="text-sm font-bold text-white tabular-nums">
                        {formatBRL(opp.value)}
                      </span>
                      <span className="text-[10px] text-gray-500">{formatDateBR(opp.created)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Leads do Formulário Público (5 Colunas) */}
        <div className="lg:col-span-5 bg-[#12141A] border border-[#262A33] rounded-2xl p-5 shadow-xl flex flex-col">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#262A33]">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Leads do Formulário Público
              </h2>
            </div>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {formLeads.length} recentes
            </span>
          </div>

          {formLeads.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center justify-center flex-1">
              <div className="w-12 h-12 rounded-full bg-[#181B24] border border-[#262A33] flex items-center justify-center text-gray-500 mb-3">
                <QrCode className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-300 font-medium">Nenhum envio recebido ainda</p>
              <p className="text-xs text-gray-500 max-w-xs mt-1">
                Envie seu link personalizado para clientes ou parceiros para que os dados caiam
                aqui.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4 border-[#262A33] text-xs">
                <Link to="/formulario">Ver Meu Link & QR Code</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {formLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] hover:border-emerald-500/40 hover:bg-[#11191a] transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-sm font-semibold text-white block">
                        {lead.contact_name || lead.company}
                      </span>
                      <span className="text-xs text-gray-400 block">
                        Empresa: <strong className="text-gray-200">{lead.company}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      Novo Lead
                    </span>
                  </div>

                  {(lead.contact_phone || lead.contact_email) && (
                    <div className="mt-2.5 pt-2 border-t border-[#262A33]/70 flex flex-wrap gap-3 text-xs text-gray-400">
                      {lead.contact_phone && (
                        <a
                          href={`tel:${lead.contact_phone}`}
                          className="flex items-center gap-1 hover:text-emerald-400 transition-colors"
                        >
                          <Phone className="w-3 h-3 text-gray-500" />
                          {lead.contact_phone}
                        </a>
                      )}
                      {lead.contact_email && (
                        <a
                          href={`mailto:${lead.contact_email}`}
                          className="flex items-center gap-1 hover:text-indigo-400 transition-colors"
                        >
                          <Mail className="w-3 h-3 text-gray-500" />
                          {lead.contact_email}
                        </a>
                      )}
                    </div>
                  )}

                  {lead.message && (
                    <p className="mt-2 text-xs text-gray-500 italic bg-[#151922] p-2 rounded-lg line-clamp-2">
                      &quot;{lead.message}&quot;
                    </p>
                  )}

                  <div className="mt-2 text-right">
                    <span className="text-[10px] text-gray-500">{formatDateBR(lead.created)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Painel Executivo do Admin: Oportunidades Perdidas por Vendedor */}
      {isAdmin && (
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>Controle de Perdidos por Vendedor</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                    Visão Admin
                  </span>
                </h2>
                <p className="text-xs text-gray-400">
                  Resumo rápido de volume e valor em BRL de oportunidades perdidas por membro da
                  equipe
                </p>
              </div>
            </div>
            <Link
              to="/metricas"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 group self-start sm:self-auto"
            >
              Ver Tabela Completa de Métricas
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {lostStatsBySeller.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-[#0E1017] border border-[#262A33]/60 text-xs text-gray-500">
              Nenhuma oportunidade marcada como Perdida até o momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {lostStatsBySeller.map((seller) => (
                <div
                  key={seller.id}
                  className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] hover:border-rose-500/40 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-sm text-white block truncate">
                      {seller.name}
                    </span>
                    <span className="text-xs text-rose-300 font-medium">
                      {seller.count} {seller.count === 1 ? 'perdida' : 'perdidas'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-rose-400 tabular-nums block">
                      {formatBRL(seller.value)}
                    </span>
                    <span className="text-[10px] text-gray-500 block">Total perdido</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Editar Oportunidade pelo Painel */}
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
              Edite as informações da oportunidade e seu alerta de retorno
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
                    {[
                      'Formulário Público',
                      'Indicação',
                      'Site',
                      'WhatsApp',
                      'Evento',
                      'Prospecção',
                      'Outro',
                    ].map((s) => (
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

            {/* Alerta de Retorno com Data e Hora */}
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

          {/* Timeline de Conversas / Interações na Edição */}
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
    </div>
  )
}
