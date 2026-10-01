import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { Opportunity, STAGE_CONFIG, formatBRL, formatDateBR } from '@/types/crm'
import { Button } from '@/components/ui/button'
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
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

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

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

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
    // O usuário seed pode ver tudo se for admin ou filtra por seller
    return opportunities.filter(
      (opp) => !opp.seller || opp.seller === user.id || opp.expand?.seller?.id === user.id,
    )
  }, [opportunities, user])

  const totalOppsCount = myOpps.length

  const inNegotiationCount = useMemo(() => {
    return myOpps.filter((opp) => opp.stage === 'Proposta' || opp.stage === 'Qualificado').length
  }, [myOpps])

  const wonOpps = useMemo(() => {
    return myOpps.filter((opp) => opp.stage === 'Ganho')
  }, [myOpps])

  const wonCount = wonOpps.length

  const totalWonValue = useMemo(() => {
    return wonOpps.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
  }, [wonOpps])

  // 5 Oportunidades mais recentes
  const recentOpportunities = useMemo(() => {
    return myOpps.slice(0, 5)
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
      description: 'Qualificado + Proposta',
      icon: TrendingUp,
      color: 'from-amber-500/20 to-orange-500/10',
      borderColor: 'border-amber-500/30',
      iconColor: 'text-amber-400',
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
      color: 'from-indigo-500/20 to-violet-500/10',
      borderColor: 'border-indigo-500/30',
      iconColor: 'text-indigo-400',
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
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Olá, <span className="text-white font-medium">{user?.name || user?.email}</span>.
            Acompanhe seus números e novos leads capturados.
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

      {/* Grid de 4 Cartões de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </div>
  )
}
