import React, { useMemo } from 'react'
import {
  centsToBRL,
  SAAS_STATUS_BADGE_CLASS,
  SAAS_STATUS_LABELS,
  type SaasCommissionStatus,
} from '@/types/commissionSaas'
import type {
  SaasCommissionRecord,
  SaasReleaseRecord,
  SaasReceivableRecord,
} from '@/services/commissionSaas'
import {
  TrendingUp,
  Layers,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

// ============================================================
// Visão Geral SaaS — cards de comissões acumuladas, previstas,
// liberadas e pagas + lista resumida das comissões recentes.
// ============================================================

export interface SaasOverviewProps {
  commissions: SaasCommissionRecord[]
  releases: SaasReleaseRecord[]
  receivables: SaasReceivableRecord[]
  loading: boolean
}

export default function SaasOverview({ commissions, releases, receivables, loading }: SaasOverviewProps) {
  // Exclui canceladas/estornadas dos acumulados financeiros
  const active = useMemo(
    () => commissions.filter((c) => c.status !== 'cancelada' && c.status !== 'estornada'),
    [commissions],
  )

  const totals = useMemo(() => {
    const devAccum = active.reduce((a, c) => a + Math.floor(c.development_commission_cents || 0), 0)
    const recAccum = active.reduce(
      (a, c) => a + Math.floor(c.recurring_commission_potential_cents || 0),
      0,
    )
    const released = releases.reduce((a, r) => a + Math.floor(r.amount_cents || 0), 0)
    const paid = active
      .filter((c) => c.status === 'paga')
      .reduce(
        (a, c) =>
          a +
          Math.floor(c.development_commission_cents || 0) +
          Math.floor(c.recurring_commission_potential_cents || 0),
        0,
      )
    return {
      accumulated: devAccum + recAccum,
      projected: recAccum,
      released,
      paid,
    }
  }, [active, releases])

  const pendingApproval = useMemo(
    () => active.filter((c) => c.status === 'pendente_aprovacao'),
    [active],
  )

  const cards = [
    {
      label: 'Comissões Acumuladas',
      value: centsToBRL(totals.accumulated),
      hint: 'Dev + recorrência potencial (ativas)',
      icon: Layers,
      color: 'indigo',
    },
    {
      label: 'Comissões Previstas',
      value: centsToBRL(totals.projected),
      hint: 'Recorrência das 3 primeiras mensalidades',
      icon: TrendingUp,
      color: 'blue',
    },
    {
      label: 'Comissões Liberadas',
      value: centsToBRL(totals.released),
      hint: 'Proporcionais aos recebimentos confirmados',
      icon: DollarSign,
      color: 'emerald',
    },
    {
      label: 'Comissões Pagas',
      value: centsToBRL(totals.paid),
      hint: 'Comissões com pagamento concluído',
      icon: CheckCircle2,
      color: 'teal',
    },
  ]

  const colorMap: Record<string, { border: string; icon: string; iconBg: string }> = {
    indigo: { border: 'border-indigo-500/30', icon: 'text-indigo-400', iconBg: 'bg-indigo-500/10 border-indigo-500/20' },
    blue: { border: 'border-blue-500/30', icon: 'text-blue-400', iconBg: 'bg-blue-500/10 border-blue-500/20' },
    emerald: { border: 'border-emerald-500/30', icon: 'text-emerald-400', iconBg: 'bg-emerald-500/10 border-emerald-500/20' },
    teal: { border: 'border-teal-500/30', icon: 'text-teal-400', iconBg: 'bg-teal-500/10 border-teal-500/20' },
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map((card) => {
          const c = colorMap[card.color]
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={`p-4 rounded-2xl bg-[#12141A] border ${c.border} shadow-xl relative overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  {card.label}
                </span>
                <div className={`p-1.5 rounded-lg bg-[#171A24] border border-[#262A33] ${c.icon}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-xl font-bold text-white tracking-tight tabular-nums">
                {loading ? <div className="h-6 w-20 bg-gray-800 rounded animate-pulse" /> : card.value}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{card.hint}</p>
            </div>
          )
        })}
      </div>

      {pendingApproval.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-700/40 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-200 leading-relaxed">
            <strong>{pendingApproval.length}</strong> comiss&atilde;o(ões) aguardando aprovação
            administrativa (margem abaixo da política). A liberação fica bloqueada até a autorização.
          </p>
        </div>
      )}

      {/* Comissões SaaS recentes */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center gap-2.5 pb-2 border-b border-[#262A33]">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">Comissões SaaS Recentes</h3>
        </div>
        {loading ? (
          <div className="py-6 flex justify-center">
            <RefreshSpinner />
          </div>
        ) : commissions.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            Nenhuma comissão SaaS registrada ainda. Use o Simulador SaaS para registrar a primeira.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262A33] text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-2.5">Sistema / Cliente</th>
                  <th className="py-2.5 px-2.5">Vendedor</th>
                  <th className="py-2.5 px-2.5 text-center">Status</th>
                  <th className="py-2.5 px-2.5 text-right">Comissão Dev.</th>
                  <th className="py-2.5 px-2.5 text-right">Recorrência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A33]/60">
                {commissions.slice(0, 8).map((c) => (
                  <tr key={c.id} className="hover:bg-[#181B26] transition-colors">
                    <td className="py-2.5 px-2.5">
                      <div className="font-semibold text-white">{c.system_name}</div>
                      <div className="text-[10px] text-gray-500">{c.client_name}</div>
                    </td>
                    <td className="py-2.5 px-2.5 text-gray-300">
                      {c.expand?.seller?.name || '—'}
                    </td>
                    <td className="py-2.5 px-2.5 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-bold text-emerald-400 tabular-nums">
                      {centsToBRL(c.development_commission_cents)}
                    </td>
                    <td className="py-2.5 px-2.5 text-right text-gray-300 tabular-nums">
                      {centsToBRL(c.recurring_commission_potential_cents || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: SaasCommissionStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SAAS_STATUS_BADGE_CLASS[status]}`}
    >
      {SAAS_STATUS_LABELS[status]}
    </span>
  )
}

function RefreshSpinner() {
  return (
    <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
  )
}