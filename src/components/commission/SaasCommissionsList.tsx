import React, { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  centsToBRL,
  SAAS_HOSTING_MODEL_LABELS,
  type SaasCommissionStatus,
} from '@/types/commissionSaas'
import {
  approveSaasCommission,
  cancelSaasCommission,
  confirmSaasReceivable,
  markSaasCommissionPaid,
  reverseSaasCommission,
  type SaasCommissionRecord,
  type SaasReceivableRecord,
  type SaasReleaseRecord,
} from '@/services/commissionSaas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from './SaasOverview'
import {
  ListChecks,
  RefreshCw,
  CheckCircle2,
  Ban,
  Undo2,
  BadgeDollarSign,
  Receipt,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ============================================================
// Lista de Comissões SaaS — vendedor vê as suas; admin gerencia
// (aprovar, confirmar recebimento, pagar, cancelar, estornar).
// ============================================================

export interface SaasCommissionsListProps {
  commissions: SaasCommissionRecord[]
  receivables: SaasReceivableRecord[]
  releases: SaasReleaseRecord[]
  loading: boolean
  onRefresh: () => void
  onMutated: () => void
}

export default function SaasCommissionsList({
  commissions,
  receivables,
  releases,
  loading,
  onRefresh,
  onMutated,
}: SaasCommissionsListProps) {
  const { user, isAdmin } = useAuth()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const receivablesByCommission = useMemo(() => {
    const map = new Map<string, SaasReceivableRecord[]>()
    for (const r of receivables) {
      const list = map.get(r.commission) || []
      list.push(r)
      map.set(r.commission, list)
    }
    return map
  }, [receivables])

  const releasedByCommission = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of releases) {
      map.set(r.commission, (map.get(r.commission) || 0) + Math.floor(r.amount_cents || 0))
    }
    return map
  }, [releases])

  const runAction = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id)
    setActionError(null)
    const res = await fn()
    setBusyId(null)
    if (!res.ok) setActionError(res.error || 'Erro na operação.')
    else onMutated()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <ListChecks className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Desenvolvimento SaaS</h2>
            <p className="text-xs text-gray-400">
              Comissões por projeto SaaS — {commissions.length} registro(s)
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="border-[#262A33] bg-[#12141A] text-gray-300 hover:text-white hover:bg-[#181B24] rounded-xl h-9"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/40 text-xs text-rose-200">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : commissions.length === 0 ? (
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">
            Nenhuma comissão SaaS registrada. Use o <strong>Simulador SaaS</strong> para registrar a
            primeira.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {commissions.map((c) => {
            const receivables = receivablesByCommission.get(c.id) || []
            const released = releasedByCommission.get(c.id) || 0
            const totalCommission =
              Math.floor(c.development_commission_cents || 0) +
              Math.floor(c.recurring_commission_potential_cents || 0)
            const isExpanded = expandedId === c.id
            const isBusy = busyId === c.id
            const canConfirmReceivables =
              c.status !== 'cancelada' &&
              c.status !== 'estornada' &&
              c.status !== 'paga' &&
              !(c.requires_approval && c.status === 'pendente_aprovacao')

            return (
              <div
                key={c.id}
                className="bg-[#12141A] border border-[#262A33] rounded-2xl shadow-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full text-left p-4 sm:p-5 hover:bg-[#181B24] transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-sm">{c.system_name}</span>
                        <StatusBadge status={c.status} />
                        {c.requires_approval && c.status === 'pendente_aprovacao' && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-700/40">
                            Margem &lt; política
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {c.client_name} · {SAAS_HOSTING_MODEL_LABELS[c.hosting_model]} ·{' '}
                        {c.expand?.seller?.name || 'Vendedor'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Comissão
                        </div>
                        <div className="text-sm font-bold text-emerald-400 tabular-nums">
                          {centsToBRL(totalCommission)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Liberado
                        </div>
                        <div className="text-sm font-bold text-indigo-300 tabular-nums">
                          {centsToBRL(released)}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-[#262A33]/60 pt-4">
                    {/* Detalhes */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <DetailBox
                        label="Valor contratado"
                        value={centsToBRL(c.contract_value_cents)}
                      />
                      <DetailBox
                        label="Valor de tabela"
                        value={c.list_value_cents ? centsToBRL(c.list_value_cents) : '—'}
                      />
                      <DetailBox label="Desconto" value={centsToBRL(c.discount_cents || 0)} />
                      <DetailBox
                        label="Mensalidade"
                        value={
                          c.recurring_monthly_cents ? centsToBRL(c.recurring_monthly_cents) : '—'
                        }
                      />
                      <DetailBox
                        label="Custos diretos"
                        value={centsToBRL(c.direct_costs_cents || 0)}
                      />
                      <DetailBox label="Tributos" value={centsToBRL(c.taxes_cents || 0)} />
                      <DetailBox
                        label="Margem estimada"
                        value={
                          c.margin_percentage !== undefined && c.margin_percentage !== null
                            ? formatPercentageSafe(c.margin_percentage)
                            : '—'
                        }
                      />
                      <DetailBox label="Política (versão)" value={`v${c.dev_policy_version}`} />
                    </div>

                    {c.system_description && (
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {c.system_description}
                      </p>
                    )}
                    {c.commercial_notes && (
                      <p className="text-[11px] text-gray-500 italic">Obs.: {c.commercial_notes}</p>
                    )}

                    {/* Recebíveis */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                          Recebimentos
                        </span>
                      </div>
                      {receivables.length === 0 ? (
                        <p className="text-xs text-gray-500">Nenhum recebível gerado.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-[#262A33] text-gray-500 uppercase text-[10px] tracking-wider">
                                <th className="py-2 px-2">Tipo</th>
                                <th className="py-2 px-2 text-center">#</th>
                                <th className="py-2 px-2 text-right">Valor</th>
                                <th className="py-2 px-2">Vencimento</th>
                                <th className="py-2 px-2 text-center">Status</th>
                                <th className="py-2 px-2 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#262A33]/60">
                              {receivables.map((r) => (
                                <tr key={r.id}>
                                  <td className="py-2 px-2 text-gray-300">
                                    {r.kind === 'development' ? 'Desenvolvimento' : 'Mensalidade'}
                                  </td>
                                  <td className="py-2 px-2 text-center text-gray-400">
                                    {r.installment_number}
                                  </td>
                                  <td className="py-2 px-2 text-right font-semibold text-white tabular-nums">
                                    {centsToBRL(r.amount_cents)}
                                  </td>
                                  <td className="py-2 px-2 text-gray-400">
                                    {r.expected_date
                                      ? new Date(r.expected_date).toLocaleDateString('pt-BR')
                                      : '—'}
                                  </td>
                                  <td className="py-2 px-2 text-center">
                                    {r.received ? (
                                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-700/40">
                                        Recebido
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold text-gray-400 bg-[#171A24] px-2 py-0.5 rounded-full border border-[#262A33]">
                                        Previsto
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-2 text-right">
                                    {!r.received && canConfirmReceivables && (
                                      <Button
                                        size="sm"
                                        disabled={isBusy}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          runAction(c.id, () =>
                                            confirmSaasReceivable({
                                              receivableId: r.id,
                                              actorId: user?.id || '',
                                            }),
                                          )
                                        }}
                                        className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
                                      >
                                        {isBusy ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          'Confirmar'
                                        )}
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Ações admin */}
                    {isAdmin && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#262A33]/60">
                        {c.status === 'pendente_aprovacao' && (
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              runAction(c.id, () =>
                                approveSaasCommission({
                                  commissionId: c.id,
                                  approverId: user?.id || '',
                                }),
                              )
                            }}
                            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Aprovar
                          </Button>
                        )}
                        {c.status === 'disponivel_pagamento' && (
                          <Button
                            size="sm"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              runAction(c.id, () =>
                                markSaasCommissionPaid({
                                  commissionId: c.id,
                                  actorId: user?.id || '',
                                  amountCents: totalCommission,
                                }),
                              )
                            }}
                            className="h-8 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs"
                          >
                            <BadgeDollarSign className="w-3.5 h-3.5 mr-1.5" /> Registrar pagamento
                          </Button>
                        )}
                        {c.status !== 'cancelada' &&
                          c.status !== 'estornada' &&
                          c.status !== 'paga' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={(e) => {
                                e.stopPropagation()
                                const reason =
                                  window.prompt(
                                    'Motivo do cancelamento (registrado no histórico):',
                                  ) || ''
                                if (!reason) return
                                runAction(c.id, () =>
                                  cancelSaasCommission({
                                    commissionId: c.id,
                                    actorId: user?.id || '',
                                    reason,
                                  }),
                                )
                              }}
                              className="h-8 border-amber-700/50 text-amber-300 hover:bg-amber-950/40 rounded-lg text-xs"
                            >
                              <Ban className="w-3.5 h-3.5 mr-1.5" /> Cancelar
                            </Button>
                          )}
                        {c.status !== 'estornada' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              const reason =
                                window.prompt('Motivo do estorno (registrado no histórico):') || ''
                              if (!reason) reason = 'Estorno solicitado'
                              runAction(c.id, () =>
                                reverseSaasCommission({
                                  commissionId: c.id,
                                  actorId: user?.id || '',
                                  reason,
                                }),
                              )
                            }}
                            className="h-8 border-rose-700/50 text-rose-300 hover:bg-rose-950/40 rounded-lg text-xs"
                          >
                            <Undo2 className="w-3.5 h-3.5 mr-1.5" /> Estornar
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-[#171A24]/60 border border-[#262A33]">
      <span className="text-[10px] text-gray-500 block">{label}</span>
      <span className="text-xs font-semibold text-white block mt-0.5 tabular-nums">{value}</span>
    </div>
  )
}

function formatPercentageSafe(fraction: number): string {
  const pct = fraction * 100
  const decimals = Number.isInteger(pct) ? 0 : 1
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`
}
