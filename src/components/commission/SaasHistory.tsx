import React, { useMemo } from 'react'
import { centsToBRL } from '@/types/commissionSaas'
import type { SaasEventRecord } from '@/services/commissionSaas'
import { History, ShieldCheck } from 'lucide-react'

// ============================================================
// Histórico SaaS — trilha de auditoria (append-only):
// criação, aprovação, recebimentos, liberações, pagamentos,
// cancelamentos e estornos, em ordem cronológica reversa.
// ============================================================

export interface SaasHistoryProps {
  events: SaasEventRecord[]
  loading: boolean
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Comissão criada',
  approved: 'Aprovada',
  approval_rejected: 'Aprovação negada',
  receivable_confirmed: 'Recebimento confirmado',
  released: 'Comissão liberada',
  paid: 'Pagamento registrado',
  cancelled: 'Cancelada',
  reversed: 'Estornada',
  adjusted: 'Ajuste manual',
}

const EVENT_COLORS: Record<string, string> = {
  created: 'text-indigo-300 bg-indigo-950/40 border-indigo-700/40',
  approved: 'text-emerald-300 bg-emerald-950/40 border-emerald-700/40',
  approval_rejected: 'text-rose-300 bg-rose-950/40 border-rose-700/40',
  receivable_confirmed: 'text-blue-300 bg-blue-950/40 border-blue-700/40',
  released: 'text-teal-300 bg-teal-950/40 border-teal-700/40',
  paid: 'text-emerald-200 bg-emerald-900/40 border-emerald-600/50',
  cancelled: 'text-amber-300 bg-amber-950/40 border-amber-700/40',
  reversed: 'text-orange-300 bg-orange-950/40 border-orange-700/40',
  adjusted: 'text-gray-300 bg-gray-800/40 border-gray-700/40',
}

export default function SaasHistory({ events, loading }: SaasHistoryProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, SaasEventRecord[]>()
    for (const ev of events) {
      const list = map.get(ev.commission) || []
      list.push(ev)
      map.set(ev.commission, list)
    }
    // Comissões com mais eventos primeiro
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length)
  }, [events])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <History className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Histórico e Auditoria</h2>
          <p className="text-xs text-gray-400">
            Registro append-only de todas as alterações financeiras — nunca excluído
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">Nenhum evento registrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map(([commissionId, evs]) => (
            <div
              key={commissionId}
              className="bg-[#12141A] border border-[#262A33] rounded-2xl p-4 sm:p-5 shadow-xl space-y-3"
            >
              <div className="flex items-center gap-2 pb-2 border-b border-[#262A33]/60">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-gray-300">
                  Comissão{' '}
                  <span className="font-mono text-[10px] text-gray-500">
                    {commissionId.slice(0, 8)}…
                  </span>
                </span>
                <span className="ml-auto text-[10px] text-gray-500">{evs.length} evento(s)</span>
              </div>
              <div className="space-y-2">
                {evs.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${EVENT_COLORS[ev.event_type] || EVENT_COLORS.adjusted}`}
                    >
                      {EVENT_LABELS[ev.event_type] || ev.event_type}
                    </span>
                    <div className="min-w-0">
                      <p className="text-gray-300 leading-relaxed">{ev.description || '—'}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {ev.created ? new Date(ev.created).toLocaleString('pt-BR') : ''}
                        {ev.amount_cents ? ` · ${centsToBRL(ev.amount_cents)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
