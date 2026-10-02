import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { formatBRL } from '@/types/crm'
import type {
  CommissionTier,
  CommissionSettings,
  CommissionClosingSummary,
} from '@/types/commission'
import { buildCommissionClosingSummary } from '@/services/commission'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  DollarSign,
  AlertCircle,
  Award,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Users,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react'

export interface CommissionClosingSectionProps {
  sellers: Array<{ id: string; name?: string; email: string; role?: string }>
  opportunities: Array<{
    id?: string
    stage?: string
    seller?: string
    created?: string
    updated?: string
    expand?: { seller?: { id: string; name?: string; email?: string } }
  }>
  tiers: CommissionTier[]
  settings: CommissionSettings | null
  loading?: boolean
  currentUserId?: string
}

export function CommissionClosingSection({
  sellers,
  opportunities,
  tiers,
  settings,
  loading = false,
  currentUserId,
}: CommissionClosingSectionProps) {
  // Monta o fechamento consolidado reutilizando o helper compartilhado
  const summary: CommissionClosingSummary = useMemo(() => {
    return buildCommissionClosingSummary({
      referenceDate: new Date(),
      sellers,
      opportunities,
      tiers,
      baseSaleValue: settings?.base_sale_value || 500,
    })
  }, [sellers, opportunities, tiers, settings?.base_sale_value])

  // Se não houver faixas de comissão ativas configuradas no banco, exibe aviso amigável com link
  if (!loading && tiers.length === 0) {
    return (
      <div className="bg-[#12141A] border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#262A33]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Fechamento de Comissão — Dia 5
              </h2>
              <p className="text-xs text-gray-400">
                Apuração mensal de comissão por vendedor para pagamento todo dia 5
              </p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl h-9 text-xs"
          >
            <Link to="/comissionamento">
              Configurar Faixas no Comissionamento
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>

        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200 leading-relaxed flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-100">
              Nenhuma faixa de comissão cadastrada no banco de dados.
            </p>
            <p className="mt-1 text-amber-300/90">
              Para calcular o valor a pagar a cada vendedor no dia 5, configure as faixas oficiais
              (vendas mínimas/máximas, percentual e valor unitário) na tela de{' '}
              <Link to="/comissionamento" className="underline font-semibold hover:text-white">
                Comissionamento
              </Link>
              . O sistema nunca utiliza faixas fictícias fixas no código.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-4 sm:p-6 shadow-xl space-y-6">
      {/* Cabeçalho do Bloco */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 text-emerald-400 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Fechamento de Comissão — Pagamento dia 5
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Calendar className="w-3 h-3 text-emerald-400" />
                Vencimento: {summary.paymentDateFormatted}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Valores apurados com base nas vendas válidas (estágio{' '}
              <strong className="text-gray-200">Ganho</strong>) em{' '}
              <strong className="text-white">
                {summary.periodMonthCapitalized}/{summary.periodYear}
              </strong>{' '}
              a serem pagos impreterivelmente no dia{' '}
              <strong className="text-emerald-300">
                5 de {summary.paymentMonthName} de {summary.paymentYear}
              </strong>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0E1017] border border-[#262A33] text-xs text-gray-300">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Vendedores: <strong className="text-white">{summary.sellers.length}</strong>
            </span>
          </div>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-[#262A33] bg-[#0E1017] text-gray-300 hover:text-white hover:bg-[#181B24] rounded-xl h-8 text-xs"
          >
            <Link to="/comissionamento">
              Ver Tabela de Faixas
              <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Mini-Cards de Resumo do Fechamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Geral a Pagar */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#131b26] to-[#0E1017] border border-emerald-500/40 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
              Total a Pagar no Dia 5
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums tracking-tight">
              {loading ? (
                <div className="h-8 w-28 bg-gray-800 rounded animate-pulse" />
              ) : (
                formatBRL(summary.totalAmountToPay)
              )}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Soma total das comissões devidas à equipe
            </p>
          </div>
        </div>

        {/* Card 2: Vendas Válidas Apuradas */}
        <div className="p-4 rounded-xl bg-[#0E1017] border border-[#262A33] shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Vendas Válidas no Mês
            </span>
            <div className="p-1.5 rounded-lg bg-[#171A24] text-blue-400 border border-[#262A33]">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-white tabular-nums tracking-tight">
              {loading ? (
                <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
              ) : (
                `${summary.totalSalesCount} ${summary.totalSalesCount === 1 ? 'venda' : 'vendas'}`
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Estágio Ganho em {summary.periodMonthCapitalized}
            </p>
          </div>
        </div>

        {/* Card 3: Vendedores com Comissão */}
        <div className="p-4 rounded-xl bg-[#0E1017] border border-[#262A33] shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Vendedores Qualificados
            </span>
            <div className="p-1.5 rounded-lg bg-[#171A24] text-indigo-400 border border-[#262A33]">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-indigo-300 tabular-nums tracking-tight">
              {loading ? (
                <div className="h-8 w-16 bg-gray-800 rounded animate-pulse" />
              ) : (
                `${summary.qualifyingSellersCount} de ${summary.sellers.length}`
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              Atingiram pelo menos a 1ª faixa de vendas
            </p>
          </div>
        </div>

        {/* Card 4: Data de Pagamento */}
        <div className="p-4 rounded-xl bg-[#0E1017] border border-[#262A33] shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Data de Repasse
            </span>
            <div className="p-1.5 rounded-lg bg-[#171A24] text-amber-400 border border-[#262A33]">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-bold text-amber-300 tabular-nums tracking-tight">
              {summary.paymentDateFormatted}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Dia 5 do mês seguinte ao fechamento</p>
          </div>
        </div>
      </div>

      {/* Regra de Negócio / Dica em Destaque */}
      <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/40 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <p className="text-xs text-indigo-200 leading-relaxed">
          <strong>Regra de Cálculo Oficial:</strong> A faixa é calculada pelo total de vendas
          válidas do mês corrente ({summary.periodMonthCapitalized}) e o percentual correspondente
          aplica-se a <em>todas as vendas</em> do vendedor no mês. Se o vendedor não atingir a faixa
          mínima de vendas (1 venda), o valor devido é exibido como <strong>R$ 0,00</strong>.
        </p>
      </div>

      {/* Tabela de Fechamento por Vendedor */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Carregando apuração de comissões...</span>
        </div>
      ) : summary.sellers.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">
          Nenhum vendedor cadastrado no sistema.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tabela (Desktop/Tablet) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A33] text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Vendedor</th>
                  <th className="py-3 px-3 text-center">Vendas Válidas (Ganho)</th>
                  <th className="py-3 px-3 text-center">Faixa Atingida</th>
                  <th className="py-3 px-3 text-center">Percentual da Faixa</th>
                  <th className="py-3 px-3 text-right">Comissão / Venda</th>
                  <th className="py-3 px-3 text-right">Total a Pagar dia 5</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A33]/60">
                {summary.sellers.map((s) => {
                  const isLogged = currentUserId && s.sellerId === currentUserId
                  return (
                    <tr
                      key={s.sellerId}
                      className={`hover:bg-[#181B26] transition-colors ${
                        isLogged ? 'bg-indigo-950/20' : ''
                      } ${s.totalCommission > 0 ? '' : 'opacity-85'}`}
                    >
                      {/* Vendedor */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                            {s.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {s.name}
                              {isLogged && (
                                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                                  Você
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-gray-500 font-mono">{s.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Vendas Válidas */}
                      <td className="py-3 px-3 text-center font-bold tabular-nums">
                        {s.wonCountMonth > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                            <CheckCircle2 className="w-3 h-3 text-blue-400" />
                            {s.wonCountMonth} {s.wonCountMonth === 1 ? 'venda' : 'vendas'}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">0 vendas</span>
                        )}
                      </td>

                      {/* Faixa Atingida */}
                      <td className="py-3 px-3 text-center">
                        {s.isQualifying ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            <Award className="w-3 h-3 text-indigo-400" />
                            {s.tierName}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">
                            {s.wonCountMonth === 0 ? 'Sem vendas no mês' : 'Abaixo da faixa'}
                          </span>
                        )}
                      </td>

                      {/* Percentual */}
                      <td className="py-3 px-3 text-center tabular-nums">
                        {s.percentage > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-[#171A24] border border-[#262A33] text-indigo-300 font-bold">
                            {Math.round(s.percentage * 100)}%
                          </span>
                        ) : (
                          <span className="text-gray-600 font-mono">—</span>
                        )}
                      </td>

                      {/* Comissão por Venda */}
                      <td className="py-3 px-3 text-right tabular-nums font-medium text-gray-300">
                        {s.commissionPerSale > 0 ? (
                          formatBRL(s.commissionPerSale)
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Total a Pagar */}
                      <td className="py-3 px-3 text-right tabular-nums">
                        {s.totalCommission > 0 ? (
                          <span className="text-sm font-black text-emerald-400 bg-emerald-950/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                            {formatBRL(s.totalCommission)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-gray-500">R$ 0,00</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Rodapé com Total Geral */}
              <tfoot>
                <tr className="border-t-2 border-[#262A33] bg-[#0E1017]">
                  <td className="py-3.5 px-3 font-bold text-white uppercase text-[11px] tracking-wider">
                    Total Geral a Pagar no Dia 5
                  </td>
                  <td className="py-3.5 px-3 text-center font-bold text-white tabular-nums">
                    {summary.totalSalesCount} vendas
                  </td>
                  <td colSpan={3} className="py-3.5 px-3 text-right text-gray-400 text-xs">
                    Soma devida a {summary.qualifyingSellersCount} vendedor(es) qualificado(s):
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums">
                    <div className="text-base font-black text-emerald-400 bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-500/50 inline-block">
                      {formatBRL(summary.totalAmountToPay)}
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Versão Mobile (Cards Responsivos) */}
          <div className="space-y-3 md:hidden">
            {summary.sellers.map((s) => {
              const isLogged = currentUserId && s.sellerId === currentUserId
              return (
                <div
                  key={s.sellerId}
                  className={`p-3.5 rounded-xl border ${
                    s.totalCommission > 0
                      ? 'bg-[#0E1017] border-emerald-500/30'
                      : 'bg-[#0E1017] border-[#262A33]'
                  } ${isLogged ? 'ring-1 ring-indigo-500' : ''} space-y-3`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-xs flex items-center gap-1">
                          {s.name}
                          {isLogged && (
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1 rounded">
                              Você
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500 font-mono block">{s.email}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">
                        Pagar dia 5
                      </span>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          s.totalCommission > 0 ? 'text-emerald-400 font-black' : 'text-gray-500'
                        }`}
                      >
                        {formatBRL(s.totalCommission)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#262A33]/80">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Vendas Ganhas:</span>
                      <span className="font-bold text-white tabular-nums">
                        {s.wonCountMonth} {s.wonCountMonth === 1 ? 'venda' : 'vendas'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Faixa:</span>
                      <span className="font-medium text-indigo-300 truncate block">
                        {s.isQualifying ? s.tierName : 'Sem faixa'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Percentual:</span>
                      <span className="font-medium text-gray-200">
                        {s.percentage > 0 ? `${Math.round(s.percentage * 100)}%` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px]">Comissão/Venda:</span>
                      <span className="font-medium text-gray-200 tabular-nums">
                        {s.commissionPerSale > 0 ? formatBRL(s.commissionPerSale) : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Totalizador Mobile */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/30 to-[#0E1017] border border-emerald-500/40 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Total Geral a Pagar
                </span>
                <span className="text-gray-400">{summary.totalSalesCount} vendas no mês</span>
              </div>
              <div className="text-2xl font-black text-emerald-400 tabular-nums">
                {formatBRL(summary.totalAmountToPay)}
              </div>
              <p className="text-[10px] text-gray-400">
                Data do repasse: <strong>{summary.paymentDateFormatted}</strong> (todo dia 5)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé informativo */}
      <div className="pt-3 border-t border-[#262A33]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>
            Faixas de comissão sincronizadas em tempo real do banco de dados (Skip Cloud).
          </span>
        </div>
        <div>
          Produto base:{' '}
          <strong className="text-gray-300">{settings?.product_name || 'Site ou LP'}</strong> (
          {formatBRL(settings?.base_sale_value || 500)})
        </div>
      </div>
    </div>
  )
}
export default CommissionClosingSection
