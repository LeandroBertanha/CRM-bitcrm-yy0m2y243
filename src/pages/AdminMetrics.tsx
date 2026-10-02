import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { Opportunity, STAGES, STAGE_CONFIG, SOURCES, formatBRL, formatDateBR } from '@/types/crm'
import type { CommissionTier, CommissionSettings } from '@/types/commission'
import { getCommissionTiers, getCommissionSettings } from '@/services/commission'
import { CommissionClosingSection } from '@/components/CommissionClosingSection'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  TrendingUp,
  Award,
  DollarSign,
  Users,
  Briefcase,
  AlertOctagon,
  ArrowRight,
  RefreshCw,
  Sparkles,
  PieChart,
  Layers,
  Building,
  UserCheck,
  ShieldCheck,
  Percent,
} from 'lucide-react'

interface SellerStat {
  id: string
  name: string
  email: string
  totalOpps: number
  inProgressCount: number
  wonCount: number
  lostCount: number
  totalPipelineValue: number
  wonValue: number
  conversionRate: number
}

export default function AdminMetrics() {
  const { user, isAdmin } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [sellers, setSellers] = useState<
    { id: string; name?: string; email: string; role?: string }[]
  >([])
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all')

  const fetchData = useCallback(async () => {
    try {
      const [oppsRecords, usersRecords, tiersRecords, settingsRecord] = await Promise.all([
        pb.collection('opportunities').getFullList<Opportunity>({
          sort: '-created',
          expand: 'seller',
        }),
        pb
          .collection('users')
          .getFullList<{ id: string; name?: string; email: string; role?: string }>({
            sort: 'name',
            fields: 'id,name,email,role',
          }),
        getCommissionTiers(),
        getCommissionSettings(),
      ])
      setOpportunities(oppsRecords)
      setSellers(usersRecords)
      setTiers(tiersRecords)
      setSettings(settingsRecord)
    } catch (err) {
      console.error('Erro ao carregar dados de métricas:', err)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Tempo real para manter sincronizado com a equipe e comissões
  useRealtime<Opportunity>('opportunities', () => {
    fetchData()
  })
  useRealtime<CommissionTier>('commission_tiers', () => {
    fetchData()
  })
  useRealtime<CommissionSettings>('commission_settings', () => {
    fetchData()
  })

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    fetchData()
  }

  // Filtragem de oportunidades por vendedor se selecionado
  const activeOpps = useMemo(() => {
    if (selectedSellerId === 'all') return opportunities
    return opportunities.filter(
      (opp) => opp.seller === selectedSellerId || opp.expand?.seller?.id === selectedSellerId,
    )
  }, [opportunities, selectedSellerId])

  // KPIs Globais
  const totalOppsCount = activeOpps.length

  // Estágios abertos (pipeline ativo, não concluído nem descartado): Novo, Qualificado, Agendado e Proposta
  // Conforme requisito: "cálculo do 'Pipe Aberto' (deve incluir Novo, Qualificado e Agendado como estágios abertos)"
  const inProgressOpps = useMemo(() => {
    return activeOpps.filter(
      (opp) =>
        opp.stage === 'Novo' ||
        opp.stage === 'Qualificado' ||
        opp.stage === 'Agendado' ||
        opp.stage === 'Proposta',
    )
  }, [activeOpps])

  const wonOpps = useMemo(() => {
    return activeOpps.filter((opp) => opp.stage === 'Ganho')
  }, [activeOpps])

  const lostOpps = useMemo(() => {
    return activeOpps.filter((opp) => opp.stage === 'Perdido')
  }, [activeOpps])

  // Pipe Aberto: soma o valor das oportunidades em estágios abertos (não ganhas nem perdidas)
  // Valores nulos ou vazios são tratados como 0 com precisão numérica
  const totalPipelineValue = useMemo(() => {
    return inProgressOpps.reduce((acc, curr) => {
      const v = typeof curr.value === 'number' ? curr.value : parseFloat(String(curr.value || 0))
      return acc + (isNaN(v) ? 0 : v)
    }, 0)
  }, [inProgressOpps])

  const totalWonValue = useMemo(() => {
    return wonOpps.reduce((acc, curr) => {
      const v = typeof curr.value === 'number' ? curr.value : parseFloat(String(curr.value || 0))
      return acc + (isNaN(v) ? 0 : v)
    }, 0)
  }, [wonOpps])

  const totalAllValue = useMemo(() => {
    return activeOpps.reduce((acc, curr) => {
      const v = typeof curr.value === 'number' ? curr.value : parseFloat(String(curr.value || 0))
      return acc + (isNaN(v) ? 0 : v)
    }, 0)
  }, [activeOpps])

  const winRate = useMemo(() => {
    const closed = wonOpps.length + lostOpps.length
    if (closed === 0) return 0
    return Math.round((wonOpps.length / closed) * 100)
  }, [wonOpps.length, lostOpps.length])

  // Distribuição por Estágio (Funil)
  const funnelByStage = useMemo(() => {
    return STAGES.map((st) => {
      const opps = activeOpps.filter((o) => o.stage === st)
      const count = opps.length
      const value = opps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
      const pct = totalOppsCount > 0 ? Math.round((count / totalOppsCount) * 100) : 0
      return {
        stage: st,
        count,
        value,
        pct,
        config: STAGE_CONFIG[st],
      }
    })
  }, [activeOpps, totalOppsCount])

  // Distribuição por Origem (Sources)
  const sourceDistribution = useMemo(() => {
    return SOURCES.map((src) => {
      const opps = activeOpps.filter((o) => o.source === src)
      const count = opps.length
      const value = opps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
      const pct = totalOppsCount > 0 ? Math.round((count / totalOppsCount) * 100) : 0
      return {
        source: src,
        count,
        value,
        pct,
      }
    }).sort((a, b) => b.count - a.count)
  }, [activeOpps, totalOppsCount])

  // Métricas por Vendedor (Performance da Equipe)
  const sellerStats = useMemo<SellerStat[]>(() => {
    // Mapear cada seller conhecido + um placeholder para sem vendedor atribuído se houver
    const sellerMap = new Map<string, SellerStat>()

    sellers.forEach((s) => {
      sellerMap.set(s.id, {
        id: s.id,
        name: s.name || s.email.split('@')[0],
        email: s.email,
        totalOpps: 0,
        inProgressCount: 0,
        wonCount: 0,
        lostCount: 0,
        totalPipelineValue: 0,
        wonValue: 0,
        conversionRate: 0,
      })
    })

    // Adiciona "Não Atribuído" caso haja oportunidade sem seller
    const unassignedId = 'unassigned'
    sellerMap.set(unassignedId, {
      id: unassignedId,
      name: 'Sem Vendedor Atribuído',
      email: 'captacao-geral@bitcrm.local',
      totalOpps: 0,
      inProgressCount: 0,
      wonCount: 0,
      lostCount: 0,
      totalPipelineValue: 0,
      wonValue: 0,
      conversionRate: 0,
    })

    opportunities.forEach((opp) => {
      const sellerId = opp.seller || opp.expand?.seller?.id || unassignedId
      let stat = sellerMap.get(sellerId)

      if (!stat) {
        // Vendedor desconhecido ainda nos registros
        stat = {
          id: sellerId,
          name: opp.expand?.seller?.name || opp.expand?.seller?.email || 'Outro Vendedor',
          email: opp.expand?.seller?.email || '',
          totalOpps: 0,
          inProgressCount: 0,
          wonCount: 0,
          lostCount: 0,
          totalPipelineValue: 0,
          wonValue: 0,
          conversionRate: 0,
        }
        sellerMap.set(sellerId, stat)
      }

      stat.totalOpps += 1
      const rawVal = typeof opp.value === 'number' ? opp.value : parseFloat(String(opp.value || 0))
      const val = isNaN(rawVal) ? 0 : rawVal

      if (opp.stage === 'Ganho') {
        stat.wonCount += 1
        stat.wonValue += val
      } else if (opp.stage === 'Perdido') {
        stat.lostCount += 1
      } else {
        stat.inProgressCount += 1
        stat.totalPipelineValue += val
      }
    })

    const list = Array.from(sellerMap.values())
      .filter((s) => s.totalOpps > 0 || s.id !== unassignedId)
      .map((s) => {
        const closed = s.wonCount + s.lostCount
        const rate = closed > 0 ? Math.round((s.wonCount / closed) * 100) : 0
        return {
          ...s,
          conversionRate: rate,
        }
      })
      // Ordena por valor ganho e depois total de oportunidades
      .sort((a, b) => b.wonValue - a.wonValue || b.totalOpps - a.totalOpps)

    return list
  }, [sellers, opportunities])

  // Cartões Resumo
  const summaryCards = [
    {
      title: 'Total de Oportunidades',
      value: totalOppsCount.toString(),
      description: 'Carteira consolidada',
      icon: Briefcase,
      color: 'from-blue-500/20 to-indigo-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400',
    },
    {
      title: 'Em Andamento',
      value: inProgressOpps.length.toString(),
      description: 'Estágios abertos (Novo, Qualificado, Agendado, Proposta)',
      icon: TrendingUp,
      color: 'from-amber-500/20 to-orange-500/10',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
    },
    {
      title: 'Negócios Ganhos',
      value: wonOpps.length.toString(),
      description: `${winRate}% de taxa de conversão`,
      icon: Award,
      color: 'from-emerald-500/20 to-teal-500/10',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
    {
      title: 'Perdidos',
      value: lostOpps.length.toString(),
      description: 'Encerrados sem conversão',
      icon: AlertOctagon,
      color: 'from-rose-500/20 to-pink-500/10',
      borderColor: 'border-rose-500/30',
      iconColor: 'text-rose-400',
    },
    {
      title: 'Pipe Aberto',
      value: formatBRL(totalPipelineValue),
      description: 'Soma dos estágios abertos no Kanban',
      icon: Layers,
      color: 'from-indigo-500/20 to-purple-500/10',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
    },
    {
      title: 'Valor Total Ganho',
      value: formatBRL(totalWonValue),
      description: 'Receita confirmada pela equipe',
      icon: DollarSign,
      color: 'from-emerald-500/20 to-lime-500/10',
      borderColor: 'border-emerald-500/30',
      iconColor: 'text-emerald-400',
    },
  ]

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* Cabeçalho da Página do Administrador */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#262A33]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Painel de Métricas do Administrador
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              Visão Executiva &bull; Toda a Equipe
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Conectado como <strong className="text-white">{user?.name || user?.email}</strong>.
            Acompanhe os indicadores consolidados, compare desempenho dos vendedores e analise o
            funil de vendas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor rápido de filtro de vendedor para análise direcionada */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Filtrar por:</label>
            <select
              value={selectedSellerId}
              onChange={(e) => setSelectedSellerId(e.target.value)}
              className="bg-[#12141A] border border-[#262A33] text-white text-xs rounded-xl h-9 px-3 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">Toda a Equipe (Geral)</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || s.email}
                </option>
              ))}
            </select>
          </div>

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
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-9 text-xs"
          >
            <Link to="/oportunidades">
              <Briefcase className="w-3.5 h-3.5 mr-1.5" />
              Ver Pipeline Geral
            </Link>
          </Button>
        </div>
      </div>

      {/* SEÇÃO FECHAMENTO DE COMISSÃO — PAGAMENTO DIA 5 */}
      <CommissionClosingSection
        sellers={sellers}
        opportunities={opportunities}
        tiers={tiers}
        settings={settings}
        loading={loading}
        currentUserId={user?.id}
      />

      {/* Grid de 6 Cartões Resumo (pt-BR, tabular-nums) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {summaryCards.map((card, idx) => {
          const Icon = card.icon
          return (
            <div
              key={card.title}
              className={`p-4 rounded-2xl bg-[#12141A] border ${card.borderColor} shadow-xl relative overflow-hidden group hover:-translate-y-0.5 transition-all duration-200`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              <div
                className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${card.color} rounded-bl-full pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity`}
              />
              <div className="relative z-10 flex flex-col justify-between h-full space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider line-clamp-1">
                    {card.title}
                  </span>
                  <div
                    className={`p-1.5 rounded-lg bg-[#171A24] border border-[#262A33] ${card.iconColor}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <div className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
                    {loading ? (
                      <div className="h-7 w-20 bg-gray-800 rounded animate-pulse" />
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                    {card.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Performance por Vendedor (Métricas Comparativas da Equipe) */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262A33]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Desempenho por Vendedor (Equipe Comercial)
              </h2>
              <p className="text-xs text-gray-400">
                Comparativo de volume, taxa de fechamento e receita gerada por membro da equipe
              </p>
            </div>
          </div>

          <span className="text-xs text-gray-400 bg-[#0E1017] px-3 py-1 rounded-full border border-[#262A33]">
            {sellerStats.length} vendedores listados
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : sellerStats.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm">
            Nenhum vendedor encontrado com oportunidades cadastradas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A33] text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Vendedor</th>
                  <th className="py-3 px-3 text-center">Total Negócios</th>
                  <th className="py-3 px-3 text-center">Em Andamento</th>
                  <th className="py-3 px-3 text-center">Ganhos</th>
                  <th className="py-3 px-3 text-center">Perdidos</th>
                  <th className="py-3 px-3 text-center">Conversão</th>
                  <th className="py-3 px-3 text-right">Pipeline Aberto</th>
                  <th className="py-3 px-3 text-right">Total Ganho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A33]/60">
                {sellerStats.map((s) => {
                  const isCurrentLogged = s.id === user?.id
                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-[#181B26] transition-colors ${
                        isCurrentLogged ? 'bg-indigo-950/15' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {s.name}
                              {isCurrentLogged && (
                                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                                  Você
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500 font-mono">{s.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-white tabular-nums">
                        {s.totalOpps}
                      </td>
                      <td className="py-3.5 px-3 text-center text-amber-300 font-semibold tabular-nums">
                        {s.inProgressCount}
                      </td>
                      <td className="py-3.5 px-3 text-center text-emerald-400 font-bold tabular-nums">
                        {s.wonCount}
                      </td>
                      <td className="py-3.5 px-3 text-center text-rose-400 tabular-nums">
                        {s.lostCount}
                      </td>
                      <td className="py-3.5 px-3 text-center tabular-nums">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            s.conversionRate >= 50
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : s.conversionRate >= 25
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-gray-800/40 text-gray-400 border-gray-700/50'
                          }`}
                        >
                          <Percent className="w-2.5 h-2.5" />
                          {s.conversionRate}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-medium text-gray-300 tabular-nums">
                        {formatBRL(s.totalPipelineValue)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-400 tabular-nums">
                        {formatBRL(s.wonValue)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Duas Colunas: Funil de Vendas por Estágio + Origem dos Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Funil por Estágio (7 Colunas) */}
        <div className="lg:col-span-7 bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Funil por Estágio Comercial
                </h3>
                <p className="text-xs text-gray-400">
                  Distribuição das oportunidades e valores nos 6 estágios
                </p>
              </div>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              Total: {formatBRL(totalAllValue)}
            </span>
          </div>

          <div className="space-y-4">
            {funnelByStage.map((item) => (
              <div
                key={item.stage}
                className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] hover:border-indigo-500/40 transition-colors space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.config.dot}`} />
                    <span className="font-bold text-white">{item.stage}</span>
                    <span className="text-[11px] text-gray-400 bg-[#12141A] px-2 py-0.5 rounded-full border border-[#262A33]">
                      {item.count} negócios ({item.pct}%)
                    </span>
                  </div>
                  <span className="font-bold text-white tabular-nums">{formatBRL(item.value)}</span>
                </div>

                {/* Barra de Progresso Visual */}
                <div className="w-full bg-[#171A24] rounded-full h-2 overflow-hidden border border-[#262A33]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.stage === 'Ganho'
                        ? 'bg-emerald-500'
                        : item.stage === 'Perdido'
                          ? 'bg-rose-500'
                          : item.stage === 'Proposta'
                            ? 'bg-amber-500'
                            : item.stage === 'Agendado'
                              ? 'bg-cyan-500'
                              : item.stage === 'Qualificado'
                                ? 'bg-blue-500'
                                : 'bg-slate-500'
                    }`}
                    style={{ width: `${Math.max(item.pct, item.count > 0 ? 4 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Origem dos Leads (5 Colunas) */}
        <div className="lg:col-span-5 bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Origem dos Leads</h3>
                <p className="text-xs text-gray-400">Canais de atração com maior conversão</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {sourceDistribution.map((item) => (
              <div
                key={item.source}
                className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-center justify-between gap-3 text-xs hover:border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-indigo-400" />
                  <div>
                    <span className="font-semibold text-white block">{item.source}</span>
                    <span className="text-[11px] text-gray-500">
                      {item.count} oportunidade{item.count === 1 ? '' : 's'} ({item.pct}%)
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-bold text-gray-200 tabular-nums block">
                    {formatBRL(item.value)}
                  </span>
                  <div className="w-16 bg-[#171A24] rounded-full h-1.5 overflow-hidden border border-[#262A33] ml-auto mt-1">
                    <div
                      className="bg-indigo-500 h-full rounded-full"
                      style={{ width: `${Math.max(item.pct, item.count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dica Estratégica Executiva */}
          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200 leading-relaxed">
              <strong>Estratégia de Captação:</strong> Leads vindos do formulário público e
              indicação apresentam os maiores ciclos de fechamento. Divulgue o link público para
              potencializar os resultados da equipe.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
