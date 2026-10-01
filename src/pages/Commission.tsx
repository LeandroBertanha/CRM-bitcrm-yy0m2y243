import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { Opportunity, formatBRL } from '@/types/crm'
import { CommissionTier, CommissionSettings, calculateCommission } from '@/types/commission'
import { getCommissionTiers, getCommissionSettings } from '@/services/commission'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DollarSign,
  TrendingUp,
  Award,
  Layers,
  Sparkles,
  Calculator,
  RefreshCw,
  FileText,
  AlertCircle,
  Users,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  Info,
  Calendar,
} from 'lucide-react'

interface SellerCommissionRow {
  sellerId: string
  name: string
  email: string
  wonCountMonth: number
  tierName: string
  percentage: number
  commissionPerSale: number
  estimatedTotal: number
}

export default function CommissionPage() {
  const { user, isAdmin } = useAuth()

  // Estados dos dados lidos do banco
  const [tiers, setTiers] = useState<CommissionTier[]>([])
  const [settings, setSettings] = useState<CommissionSettings | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [sellers, setSellers] = useState<
    { id: string; name?: string; email: string; role?: string }[]
  >([])

  // Estados de carregamento e refresh
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Estado do simulador interativo (quantidade de vendas a testar)
  const [simSalesInput, setSimSalesInput] = useState<string>('10')

  // Carregar dados de comissionamento e oportunidades
  const loadData = useCallback(async () => {
    try {
      const [tiersData, settingsData, oppsData, usersData] = await Promise.all([
        getCommissionTiers(),
        getCommissionSettings(),
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
      ])

      setTiers(tiersData)
      setSettings(settingsData)
      setOpportunities(oppsData)
      setSellers(usersData)
    } catch (err) {
      console.error('Erro ao carregar dados de comissionamento:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Inscrição em tempo real para sincronizar mudanças nas oportunidades e tabelas de comissão
  useRealtime<Opportunity>('opportunities', () => {
    loadData()
  })

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  // Identificação do mês atual para apuração
  const now = new Date()
  const currentMonthName = now.toLocaleString('pt-BR', { month: 'long' })
  const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1)
  const currentYear = now.getFullYear()
  const currentMonthIndex = now.getMonth() // 0-11

  // Filtra oportunidades do mês atual com estágio "Ganho"
  const isOppInCurrentMonth = useCallback(
    (opp: Opportunity) => {
      // Usa created ou updated como data de apuração da oportunidade
      const dateStr = opp.created || opp.updated
      if (!dateStr) return false
      try {
        const d = new Date(dateStr)
        return d.getFullYear() === currentYear && d.getMonth() === currentMonthIndex
      } catch {
        return false
      }
    },
    [currentYear, currentMonthIndex],
  )

  // Oportunidades Ganhas no Mês Atual pertencentes ao usuário logado
  const myWonOppsMonth = useMemo(() => {
    if (!user) return []
    return opportunities.filter((opp) => {
      const sellerId = opp.seller || opp.expand?.seller?.id
      const isMyOpp = sellerId === user.id
      const isWon = opp.stage === 'Ganho'
      const inMonth = isOppInCurrentMonth(opp)
      return isMyOpp && isWon && inMonth
    })
  }, [opportunities, user, isOppInCurrentMonth])

  // Cálculo da comissão do usuário logado para o mês atual
  const mySalesCount = myWonOppsMonth.length
  const myCommissionCalc = useMemo(() => {
    return calculateCommission(mySalesCount, tiers, settings?.base_sale_value || 500)
  }, [mySalesCount, tiers, settings?.base_sale_value])

  // Tabela de resumo por vendedor para o perfil Admin
  const adminSellerRows = useMemo<SellerCommissionRow[]>(() => {
    if (!isAdmin) return []

    // Mapear vendedores
    const map = new Map<string, SellerCommissionRow>()

    sellers.forEach((s) => {
      map.set(s.id, {
        sellerId: s.id,
        name: s.name || s.email.split('@')[0],
        email: s.email,
        wonCountMonth: 0,
        tierName: '—',
        percentage: 0,
        commissionPerSale: 0,
        estimatedTotal: 0,
      })
    })

    // Contabilizar oportunidades Ganhas do mês por vendedor
    opportunities.forEach((opp) => {
      if (opp.stage === 'Ganho' && isOppInCurrentMonth(opp)) {
        const sellerId = opp.seller || opp.expand?.seller?.id
        if (sellerId && map.has(sellerId)) {
          const row = map.get(sellerId)!
          row.wonCountMonth += 1
        }
      }
    })

    // Calcular comissões para cada vendedor com base nas faixas do banco
    const list = Array.from(map.values()).map((row) => {
      const calc = calculateCommission(row.wonCountMonth, tiers, settings?.base_sale_value || 500)
      return {
        ...row,
        tierName: calc.isQualifying ? calc.tierName : 'Abaixo da faixa',
        percentage: calc.percentage,
        commissionPerSale: calc.commissionPerSale,
        estimatedTotal: calc.totalCommission,
      }
    })

    // Ordena por total estimado decrescente
    return list.sort(
      (a, b) => b.estimatedTotal - a.estimatedTotal || b.wonCountMonth - a.wonCountMonth,
    )
  }, [isAdmin, sellers, opportunities, isOppInCurrentMonth, tiers, settings?.base_sale_value])

  // Cálculo da simulação interativa com o input do usuário
  const parsedSimSales = Math.max(0, parseInt(simSalesInput, 10) || 0)
  const simulationResult = useMemo(() => {
    return calculateCommission(parsedSimSales, tiers, settings?.base_sale_value || 500)
  }, [parsedSimSales, tiers, settings?.base_sale_value])

  // Exemplos rápidos para a mini tabela de simulação em tempo real (1, 4, 5, 9, 10, 15 vendas)
  const exampleCounts = [1, 4, 5, 9, 10, 15]
  const simulationExamples = useMemo(() => {
    return exampleCounts.map((count) => {
      const res = calculateCommission(count, tiers, settings?.base_sale_value || 500)
      return {
        count,
        percentageDisplay: `${Math.round(res.percentage * 100)}%`,
        commissionPerSale: res.commissionPerSale,
        total: res.totalCommission,
        tierName: res.tier?.name || 'Faixa Inicial',
      }
    })
  }, [tiers, settings?.base_sale_value])

  // Formatação amigável das faixas
  const formatTierSalesRange = (tier: CommissionTier) => {
    if (tier.max_sales && tier.max_sales > 0) {
      if (tier.min_sales === tier.max_sales) {
        return `${tier.min_sales} venda${tier.min_sales === 1 ? '' : 's'}`
      }
      return `${tier.min_sales} a ${tier.max_sales} vendas`
    }
    return `${tier.min_sales} ou mais vendas`
  }

  // Verifica se a faixa analisada corresponde à faixa atual do vendedor
  const isMyCurrentTier = (tier: CommissionTier) => {
    if (!myCommissionCalc.tier) return false
    return myCommissionCalc.tier.id === tier.id
  }

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#262A33]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Comissionamento
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              <Award className="w-3.5 h-3.5 text-indigo-400" />
              Apoio ao Vendedor
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Acompanhe seus indicadores de comissão no mês corrente ({capitalizedMonth} de{' '}
            {currentYear}), consulte a tabela de faixas e utilize o simulador em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#12141A] border border-[#262A33] text-xs text-gray-300">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Mês:{' '}
              <strong className="text-white">
                {capitalizedMonth}/{currentYear}
              </strong>
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-[#262A33] bg-[#12141A] text-gray-300 hover:text-white hover:bg-[#181B24] rounded-xl h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* AVISO / PROXY DE VENDA VÁLIDA: Explicação sobre estágio "Ganho" e recebimento */}
      <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 flex items-start gap-3">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-200 leading-relaxed">
          <strong>Atenção aos critérios de comissão:</strong> A comissão é devida somente após o
          efetivo recebimento do valor pela Bit Consulting. No sistema, as oportunidades marcadas
          com o estágio <strong>&ldquo;Ganho&rdquo;</strong> no mês são utilizadas como proxy de
          venda válida para apuração dos valores estimados.
        </p>
      </div>

      {/* 1. INDICADORES DO MÊS ATUAL DO VENDEDOR LOGADO (CARDS) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Sua Situação no Mês Atual ({capitalizedMonth})
            </h2>
          </div>
          <span className="text-xs text-gray-400">
            Vendedor: <strong className="text-white">{user?.name || user?.email}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Vendas Válidas no Mês */}
          <div className="p-4 rounded-2xl bg-[#12141A] border border-blue-500/30 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-500/20 to-indigo-500/10 rounded-bl-full pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity" />
            <div className="relative z-10 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Vendas no Mês
                </span>
                <div className="p-1.5 rounded-lg bg-[#171A24] border border-[#262A33] text-blue-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white tracking-tight tabular-nums">
                  {loading ? (
                    <div className="h-7 w-16 bg-gray-800 rounded animate-pulse" />
                  ) : (
                    `${mySalesCount} ${mySalesCount === 1 ? 'venda' : 'vendas'}`
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                  Oportunidades em Ganho ({capitalizedMonth})
                </p>
              </div>
            </div>
          </div>

          {/* Card 2: Faixa Atual Atingida */}
          <div className="p-4 rounded-2xl bg-[#12141A] border border-indigo-500/30 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-indigo-500/20 to-purple-500/10 rounded-bl-full pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity" />
            <div className="relative z-10 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Faixa Atingida
                </span>
                <div className="p-1.5 rounded-lg bg-[#171A24] border border-[#262A33] text-indigo-400">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-lg font-bold text-white tracking-tight truncate">
                  {loading ? (
                    <div className="h-7 w-24 bg-gray-800 rounded animate-pulse" />
                  ) : myCommissionCalc.isQualifying ? (
                    myCommissionCalc.tierName
                  ) : (
                    'Sem faixa (0 vendas)'
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                  {myCommissionCalc.isQualifying
                    ? 'Faixa de comissão confirmada'
                    : 'Realize vendas para ativar a faixa'}
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Percentual da Faixa */}
          <div className="p-4 rounded-2xl bg-[#12141A] border border-amber-500/30 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/20 to-orange-500/10 rounded-bl-full pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity" />
            <div className="relative z-10 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Percentual da Faixa
                </span>
                <div className="p-1.5 rounded-lg bg-[#171A24] border border-[#262A33] text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white tracking-tight tabular-nums">
                  {loading ? (
                    <div className="h-7 w-16 bg-gray-800 rounded animate-pulse" />
                  ) : myCommissionCalc.isQualifying ? (
                    `${Math.round(myCommissionCalc.percentage * 100)}%`
                  ) : (
                    '0%'
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                  Aplica-se a todo o mês
                </p>
              </div>
            </div>
          </div>

          {/* Card 4: Comissão por Venda */}
          <div className="p-4 rounded-2xl bg-[#12141A] border border-emerald-500/30 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-500/20 to-teal-500/10 rounded-bl-full pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity" />
            <div className="relative z-10 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Comissão / Venda
                </span>
                <div className="p-1.5 rounded-lg bg-[#171A24] border border-[#262A33] text-emerald-400">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white tracking-tight tabular-nums">
                  {loading ? (
                    <div className="h-7 w-20 bg-gray-800 rounded animate-pulse" />
                  ) : (
                    formatBRL(myCommissionCalc.commissionPerSale)
                  )}
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                  Valor unitário na faixa atual
                </p>
              </div>
            </div>
          </div>

          {/* Card 5: Comissão Total Estimada */}
          <div className="p-4 rounded-2xl bg-[#12141A] border border-indigo-400/50 shadow-xl relative overflow-hidden group bg-gradient-to-b from-[#151928] to-[#12141A]">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-indigo-500/30 to-blue-500/20 rounded-bl-full pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10 flex flex-col justify-between h-full space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider">
                  Total Estimado Mês
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/50 text-indigo-300">
                  <Award className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <div className="text-2xl font-black text-indigo-300 tracking-tight tabular-nums">
                  {loading ? (
                    <div className="h-7 w-24 bg-gray-800 rounded animate-pulse" />
                  ) : (
                    formatBRL(myCommissionCalc.totalCommission)
                  )}
                </div>
                <p className="text-[10px] text-indigo-400/90 mt-0.5 line-clamp-1">
                  Estimativa sobre vendas Ganhas
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TABELA DAS FAIXAS DE COMISSÃO (LIDA DO BANCO) */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262A33]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Tabela Oficial de Faixas de Comissão
              </h2>
              <p className="text-xs text-gray-400">
                Lida dinamicamente do banco de dados (Skip Cloud). O percentual da faixa atingida
                aplica-se a todas as vendas do mês.
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-400 bg-[#0E1017] px-3 py-1.5 rounded-xl border border-[#262A33]">
            Produto:{' '}
            <strong className="text-white">{settings?.product_name || 'Site ou LP'}</strong> &bull;
            Valor base:{' '}
            <strong className="text-white">{formatBRL(settings?.base_sale_value || 500)}</strong>
          </div>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : tiers.length === 0 ? (
          <div className="py-6 text-center text-gray-500 text-sm">
            Nenhuma faixa de comissão cadastrada no banco de dados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A33] text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Faixa / Critério</th>
                  <th className="py-3 px-3 text-center">Vendas Válidas no Mês</th>
                  <th className="py-3 px-3 text-center">Percentual de Comissão</th>
                  <th className="py-3 px-3 text-right">Comissão por Venda</th>
                  <th className="py-3 px-3 text-center">Sua Situação Atual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A33]/60">
                {tiers.map((tier) => {
                  const isCurrent = isMyCurrentTier(tier)
                  const normalizedPct =
                    tier.percentage > 1 ? tier.percentage / 100 : tier.percentage

                  return (
                    <tr
                      key={tier.id}
                      className={`hover:bg-[#181B26] transition-colors ${
                        isCurrent ? 'bg-indigo-950/30 border-l-4 border-l-indigo-500' : ''
                      }`}
                    >
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isCurrent ? 'bg-indigo-400 animate-pulse' : 'bg-gray-600'
                            }`}
                          />
                          {tier.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium text-gray-300">
                        {formatTierSalesRange(tier)}
                      </td>
                      <td className="py-3.5 px-3 text-center tabular-nums font-bold text-white">
                        <span className="px-2 py-0.5 rounded-full bg-[#171A24] border border-[#262A33] text-indigo-300">
                          {Math.round(normalizedPct * 100)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-400 tabular-nums">
                        {formatBRL(tier.commission_per_sale)}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {isCurrent ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            Faixa Atual Atingida
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* NOTA OBRIGATÓRIA DA HOSPEDAGEM (VINDA DO BANCO) */}
        <div className="pt-2 border-t border-[#262A33]/60 flex items-start gap-2.5 text-xs text-amber-300/90 bg-amber-950/20 p-3 rounded-xl border border-amber-900/40">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>Observação Importante:</strong>{' '}
            {settings?.hosting_note ||
              'A mensalidade de R$ 55,00 referente à hospedagem não integra a base de comissão.'}
          </p>
        </div>
      </div>

      {/* 3. SIMULADOR INTERATIVO + MINI TABELA DE EXEMPLOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Simulador Interativo (7 colunas) */}
        <div className="lg:col-span-7 bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Simulador de Comissão em Tempo Real
                </h2>
                <p className="text-xs text-gray-400">
                  Informe uma quantidade de vendas válidas para calcular o retorno mensal estimado
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Campo de Entrada */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Quantidade de Vendas Válidas no Mês
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  value={simSalesInput}
                  onChange={(e) => setSimSalesInput(e.target.value)}
                  placeholder="Ex: 10"
                  className="bg-[#0E1017] border-[#262A33] text-white text-base font-bold h-11 w-36 focus:border-indigo-500 text-center"
                />
                <div className="flex flex-wrap gap-1.5">
                  {[1, 4, 5, 9, 10, 15, 20].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setSimSalesInput(quick.toString())}
                      className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                        parsedSimSales === quick
                          ? 'bg-indigo-600 text-white border-indigo-500 font-semibold shadow-sm shadow-indigo-500/20'
                          : 'bg-[#171A24] border-[#262A33] text-gray-400 hover:text-white hover:bg-[#1f2330]'
                      }`}
                    >
                      {quick} vendas
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Informações Complementares Lidas do Banco */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-[#0E1017] p-3 rounded-xl border border-[#262A33]">
              <div>
                <span className="text-gray-400 block">Valor por Site/LP (Base):</span>
                <strong className="text-white">
                  {formatBRL(settings?.base_sale_value || 500)}
                </strong>
              </div>
              <div>
                <span className="text-gray-400 block">Hospedagem Mensal:</span>
                <span className="text-amber-400 font-medium">
                  {formatBRL(settings?.monthly_hosting_value || 55)} (fora da comissão)
                </span>
              </div>
            </div>

            {/* Resultado da Simulação */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[#131622] to-[#0E1017] border border-indigo-500/30 space-y-3">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider block">
                Resultado da Simulação
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3 rounded-lg bg-[#171A24]/60 border border-[#262A33]">
                  <span className="text-[11px] text-gray-400 block">Faixa Atingida:</span>
                  <span className="text-sm font-bold text-white block mt-0.5">
                    {simulationResult.tier ? simulationResult.tier.name : 'Nenhuma faixa'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#171A24]/60 border border-[#262A33]">
                  <span className="text-[11px] text-gray-400 block">Percentual de Comissão:</span>
                  <span className="text-sm font-bold text-indigo-400 block mt-0.5">
                    {Math.round(simulationResult.percentage * 100)}%
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#171A24]/60 border border-[#262A33]">
                  <span className="text-[11px] text-gray-400 block">Comissão por Venda:</span>
                  <span className="text-sm font-bold text-emerald-400 block mt-0.5 tabular-nums">
                    {formatBRL(simulationResult.commissionPerSale)}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/40">
                  <span className="text-[11px] text-indigo-300 block font-semibold">
                    Total de Comissão no Mês:
                  </span>
                  <span className="text-xl font-black text-white block mt-0.5 tabular-nums">
                    {formatBRL(simulationResult.totalCommission)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mini Tabela de Exemplos de Comissão (5 colunas) */}
        <div className="lg:col-span-5 bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Cenários &amp; Exemplos
                </h3>
                <p className="text-xs text-gray-400">Calculado em runtime com as faixas do banco</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A33] text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-2.5">Vendas</th>
                  <th className="py-2.5 px-2.5 text-center">Percentual</th>
                  <th className="py-2.5 px-2.5 text-right">Comissão/Venda</th>
                  <th className="py-2.5 px-2.5 text-right">Comissão Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A33]/60">
                {simulationExamples.map((ex) => {
                  const isSimSelected = parsedSimSales === ex.count
                  return (
                    <tr
                      key={ex.count}
                      onClick={() => setSimSalesInput(ex.count.toString())}
                      className={`hover:bg-[#181B26] transition-colors cursor-pointer ${
                        isSimSelected ? 'bg-indigo-950/30 font-semibold' : ''
                      }`}
                    >
                      <td className="py-2.5 px-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white tabular-nums">{ex.count}</span>
                          <span className="text-[10px] text-gray-500">vendas</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5 text-center tabular-nums">
                        <span className="px-1.5 py-0.5 rounded bg-[#171A24] border border-[#262A33] text-indigo-300 text-[11px]">
                          {ex.percentageDisplay}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-emerald-400 font-medium tabular-nums">
                        {formatBRL(ex.commissionPerSale)}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-bold text-white tabular-nums">
                        {formatBRL(ex.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] text-[11px] text-gray-400 flex items-center gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>
              Clique em qualquer linha da tabela de cenários para carregá-la no simulador.
            </span>
          </div>
        </div>
      </div>

      {/* 4. BLOCO DE REGRAS ESSENCIAIS (RENDERIZADO DO BANCO) */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#262A33]">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Regras Essenciais de Comissionamento
            </h2>
            <p className="text-xs text-gray-400">
              Diretrizes oficiais registradas e mantidas nas configurações do banco de dados
            </p>
          </div>
        </div>

        {/* Lista de regras essenciais lidas do banco */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {settings?.essential_rules && settings.essential_rules.length > 0 ? (
            settings.essential_rules.map((ruleText, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-start gap-3 hover:border-indigo-500/40 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{ruleText}</p>
              </div>
            ))
          ) : (
            <div className="col-span-2 text-center py-4 text-xs text-gray-500">
              Nenhuma regra essencial registrada na configuração.
            </div>
          )}
        </div>

        {/* Detalhamento complementar caso exista nas configurações */}
        {settings?.detailed_rules && settings.detailed_rules.length > 0 && (
          <div className="pt-4 border-t border-[#262A33]/80 space-y-3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
              Detalhamento dos Termos Comerciais
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {settings.detailed_rules.map((det, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#171A24]/50 border border-[#262A33] space-y-1"
                >
                  <strong className="text-xs text-indigo-300 font-semibold block">
                    {det.rule}
                  </strong>
                  <p className="text-[11px] text-gray-400 leading-normal">{det.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. RESUMO POR VENDEDOR PARA ADMIN (VISÍVEL APENAS PARA ADMINISTRADORES) */}
      {isAdmin && (
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262A33]">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Resumo de Comissionamento da Equipe ({capitalizedMonth})
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    <ShieldCheck className="w-3 h-3 text-indigo-400" />
                    Exclusivo Administrador
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  Acompanhamento consolidado de vendas e estimativas de comissão de todos os
                  vendedores no mês corrente
                </p>
              </div>
            </div>

            <span className="text-xs text-gray-400 bg-[#0E1017] px-3 py-1 rounded-full border border-[#262A33]">
              {adminSellerRows.length} vendedores cadastrados
            </span>
          </div>

          {loading ? (
            <div className="py-8 flex justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : adminSellerRows.length === 0 ? (
            <div className="py-6 text-center text-gray-500 text-sm">
              Nenhum vendedor encontrado no sistema.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#262A33] text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3">Vendedor</th>
                    <th className="py-3 px-3 text-center">Vendas no Mês</th>
                    <th className="py-3 px-3 text-center">Faixa Atingida</th>
                    <th className="py-3 px-3 text-center">Percentual</th>
                    <th className="py-3 px-3 text-right">Comissão / Venda</th>
                    <th className="py-3 px-3 text-right">Comissão Estimada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262A33]/60">
                  {adminSellerRows.map((row) => {
                    const isCurrentLogged = row.sellerId === user?.id
                    return (
                      <tr
                        key={row.sellerId}
                        className={`hover:bg-[#181B26] transition-colors ${
                          isCurrentLogged ? 'bg-indigo-950/20' : ''
                        }`}
                      >
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                              {row.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                {row.name}
                                {isCurrentLogged && (
                                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                                    Você
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-gray-500 font-mono">
                                {row.email}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-bold text-white tabular-nums">
                          {row.wonCountMonth}
                        </td>
                        <td className="py-3.5 px-3 text-center font-medium text-gray-300">
                          {row.tierName}
                        </td>
                        <td className="py-3.5 px-3 text-center tabular-nums">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                              row.percentage > 0
                                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                                : 'bg-gray-800/40 text-gray-500 border-gray-700/50'
                            }`}
                          >
                            {Math.round(row.percentage * 100)}%
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-gray-300 tabular-nums">
                          {formatBRL(row.commissionPerSale)}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-emerald-400 tabular-nums text-sm">
                          {formatBRL(row.estimatedTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
