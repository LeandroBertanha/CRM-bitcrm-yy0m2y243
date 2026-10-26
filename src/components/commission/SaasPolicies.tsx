import React, { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { formatBRL } from '@/types/crm'
import {
  brlToCents,
  centsToBRL,
  formatPercentage,
  parsePolicyTiers,
  type SaasPolicyTier,
} from '@/types/commissionSaas'
import {
  createSaasPolicyVersion,
  createSaasException,
  type SaasCommissionPolicy,
} from '@/services/commissionSaas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings2, Plus, ShieldCheck, Loader2, Info } from 'lucide-react'

// ============================================================
// Políticas de Comissão SaaS (admin) — faixas configuráveis,
// recorrência, margem mínima e exceções por vendedor.
// Alterar faixas cria uma NOVA versão (versionamento): comissões
// antigas preservam a política aplicada no cálculo original.
// ============================================================

export interface SaasPoliciesProps {
  policy: SaasCommissionPolicy | null
  sellers: SaasSellerLite[]
  onMutated: () => void
}

export interface SaasSellerLite {
  id: string
  name?: string
  email: string
}

const DEFAULT_TIERS: SaasPolicyTier[] = [
  { min_value: 0, max_value: 300000, percentage: 0.1, label: 'Até R$ 3.000,00' },
  { min_value: 300001, max_value: 500000, percentage: 0.08, label: 'R$ 3.000,01 até R$ 5.000,00' },
  { min_value: 500001, max_value: 1000000, percentage: 0.07, label: 'R$ 5.000,01 até R$ 10.000,00' },
  { min_value: 1000001, max_value: 2000000, percentage: 0.06, label: 'R$ 10.000,01 até R$ 20.000,00' },
  { min_value: 2000001, max_value: 5000000, percentage: 0.05, label: 'R$ 20.000,01 até R$ 50.000,00' },
  { min_value: 5000001, max_value: null, percentage: 0.04, label: 'Acima de R$ 50.000,00' },
]

export default function SaasPolicies({ policy, sellers, onMutated }: SaasPoliciesProps) {
  const { user } = useAuth()
  const tiers = policy ? parsePolicyTiers(policy.tiers) : DEFAULT_TIERS

  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form de nova versão
  const [newTiers, setNewTiers] = useState<SaasPolicyTier[]>(tiers)
  const [recurringPctInput, setRecurringPctInput] = useState(
    policy ? String(policy.recurring_percentage * 100) : '10',
  )
  const [eligibleMonthsInput, setEligibleMonthsInput] = useState(
    policy ? String(policy.recurring_eligible_months) : '3',
  )
  const [minMarginInput, setMinMarginInput] = useState(
    policy ? String(policy.min_margin_percentage * 100) : '30',
  )
  const [versionNotes, setVersionNotes] = useState('')

  // Form de exceção
  const [excSellerId, setExcSellerId] = useState('')
  const [excType, setExcType] = useState<'percentage' | 'fixed_value'>('percentage')
  const [excScope, setExcScope] = useState<'development' | 'recurring'>('development')
  const [excPercentageInput, setExcPercentageInput] = useState('')
  const [excFixedInput, setExcFixedInput] = useState('')
  const [excValidUntil, setExcValidUntil] = useState('')
  const [excReason, setExcReason] = useState('')
  const [excSaving, setExcSaving] = useState(false)
  const [excError, setExcError] = useState<string | null>(null)
  const [excSuccess, setExcSuccess] = useState<string | null>(null)

  const startEdit = () => {
    setNewTiers(parsePolicyTiers(policy?.tiers))
    setRecurringPctInput(policy ? String(policy.recurring_percentage * 100) : '10')
    setEligibleMonthsInput(policy ? String(policy.recurring_eligible_months) : '3')
    setMinMarginInput(policy ? String(policy.min_margin_percentage * 100) : '30')
    setVersionNotes('')
    setShowForm(true)
    setSuccess(null)
    setError(null)
  }

  const updateTier = (idx: number, patch: Partial<SaasPolicyTier>) => {
    setNewTiers((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)))
  }

  const handleSaveVersion = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    const result = await createSaasPolicyVersion({
      name: `Política SaaS — v${(policy?.policy_version || 0) + 1}`,
      tiers: newTiers,
      recurring_percentage: (parseFloat(recurringPctInput.replace(',', '.')) || 0) / 100,
      recurring_eligible_months: parseInt(eligibleMonthsInput, 10) || 0,
      min_margin_percentage: (parseFloat(minMarginInput.replace(',', '.')) || 0) / 100,
      notes: versionNotes || undefined,
    })
    setSaving(false)
    if (result.ok) {
      setSuccess(`Nova versão v${(policy?.policy_version || 0) + 1} criada e ativada. Comissões antigas mantêm a política original.`)
      setShowForm(false)
      onMutated()
    } else {
      setError(result.error || 'Erro ao salvar política.')
    }
  }

  const handleCreateException = async () => {
    if (!excSellerId || !excReason.trim()) return
    setExcSaving(true)
    setExcError(null)
    setExcSuccess(null)
    const result = await createSaasException({
      sellerId: excSellerId,
      exceptionType: excType,
      percentage: excType === 'percentage' ? (parseFloat(excPercentageInput.replace(',', '.')) || 0) / 100 : undefined,
      fixedValueCents: excType === 'fixed_value' ? brlToCents(excFixedInput) : undefined,
      appliesTo: excScope,
      validUntil: excValidUntil ? new Date(excValidUntil + 'T23:59:59').toISOString() : undefined,
      reason: excReason.trim(),
      approvedBy: user?.id,
    })
    setExcSaving(false)
    if (result.ok) {
      setExcSuccess('Exceção criada e ativa.')
      setExcSellerId('')
      setExcPercentageInput('')
      setExcFixedInput('')
      setExcValidUntil('')
      setExcReason('')
      onMutated()
    } else {
      setExcError(result.error || 'Erro ao criar exceção.')
    }
  }

  return (
    <div className="space-y-5">
      {/* Política ativa */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262A33]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Política Ativa {policy ? `(v${policy.policy_version})` : ''}
              </h2>
              <p className="text-xs text-gray-400">
                Faixas por valor do desenvolvimento · recorrência · margem mínima
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={startEdit}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-9 text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova versão da política
          </Button>
        </div>

        {!policy ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            Nenhuma política ativa. Crie a primeira versão.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MiniStat label="Comissão de recorrência" value={formatPercentage(policy.recurring_percentage)} />
              <MiniStat label="Mensalidades elegíveis" value={`${policy.recurring_eligible_months} primeiras`} />
              <MiniStat label="Margem mínima" value={formatPercentage(policy.min_margin_percentage)} />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#262A33] text-gray-400 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3">Faixa de valor</th>
                    <th className="py-2.5 px-3 text-center">Percentual</th>
                    <th className="py-2.5 px-3 text-right">Exemplo (comissão)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262A33]/60">
                  {tiers.map((t, i) => {
                    const exampleCents = t.max_value ?? Math.max(t.min_value, 5000001 * 2)
                    return (
                      <tr key={i} className="hover:bg-[#181B26] transition-colors">
                        <td className="py-2.5 px-3 font-medium text-white">{t.label}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-[#171A24] border border-[#262A33] text-indigo-300">
                            {formatPercentage(t.percentage)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 tabular-nums">
                          {centsToBRL(Math.round(exampleCents * t.percentage))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Form nova versão */}
        {showForm && (
          <div className="pt-4 border-t border-[#262A33]/80 space-y-4">
            <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-700/40 flex items-start gap-2">
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-indigo-200 leading-relaxed">
                Salvar cria a <strong>versão v{(policy?.policy_version || 0) + 1}</strong> e a torna ativa.
                Comissões já registradas preservam a política usada no cálculo original (versionamento).
              </p>
            </div>
            <div className="space-y-2">
              {newTiers.map((t, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-4">
                    <label className="text-[10px] text-gray-500 block mb-1">Mínimo (R$)</label>
                    <Input
                      inputMode="decimal"
                      value={t.min_value === 0 ? '' : (t.min_value / 100).toFixed(2).replace('.', ',')}
                      onChange={(e) => updateTier(i, { min_value: brlToCents(e.target.value) })}
                      className="bg-[#0E1017] border-[#262A33] text-white h-9 text-xs"
                      placeholder="0,00"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="text-[10px] text-gray-500 block mb-1">Máximo (R$, vazio = sem limite)</label>
                    <Input
                      inputMode="decimal"
                      value={t.max_value === null ? '' : (t.max_value / 100).toFixed(2).replace('.', ',')}
                      onChange={(e) =>
                        updateTier(i, { max_value: e.target.value.trim() === '' ? null : brlToCents(e.target.value) })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white h-9 text-xs"
                      placeholder="sem limite"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-gray-500 block mb-1">%</label>
                    <Input
                      inputMode="decimal"
                      value={String(t.percentage * 100)}
                      onChange={(e) =>
                        updateTier(i, { percentage: (parseFloat(e.target.value.replace(',', '.')) || 0) / 100 })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white h-9 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-gray-500 block mb-1">Rótulo</label>
                    <Input
                      value={t.label}
                      onChange={(e) => updateTier(i, { label: e.target.value })}
                      className="bg-[#0E1017] border-[#262A33] text-white h-9 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Comissão de recorrência (%)</label>
                <Input
                  inputMode="decimal"
                  value={recurringPctInput}
                  onChange={(e) => setRecurringPctInput(e.target.value)}
                  className="bg-[#0E1017] border-[#262A33] text-white h-10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Mensalidades elegíveis</label>
                <Input
                  type="number"
                  min="0"
                  value={eligibleMonthsInput}
                  onChange={(e) => setEligibleMonthsInput(e.target.value)}
                  className="bg-[#0E1017] border-[#262A33] text-white h-10"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1.5">Margem mínima (%)</label>
                <Input
                  inputMode="decimal"
                  value={minMarginInput}
                  onChange={(e) => setMinMarginInput(e.target.value)}
                  className="bg-[#0E1017] border-[#262A33] text-white h-10"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">Notas da versão</label>
              <Input
                value={versionNotes}
                onChange={(e) => setVersionNotes(e.target.value)}
                placeholder="Ex: ajuste de faixas para campanha de fim de ano"
                className="bg-[#0E1017] border-[#262A33] text-white h-10"
              />
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/40 text-xs text-rose-200">{error}</div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={handleSaveVersion}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-10 text-sm"
              >
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                Salvar nova versão
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                className="border-[#262A33] bg-transparent text-gray-300 hover:text-white rounded-xl h-10 text-sm"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {success && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-xs text-emerald-200">
            {success}
          </div>
        )}
      </div>

      {/* Exceções por vendedor */}
      <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#262A33]">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Exceções e campanhas por vendedor</h2>
            <p className="text-xs text-gray-400">
              Percentual ou valor fixo que sobrepõe a faixa, com validade e aprovador registrados
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Vendedor</label>
            <Select value={excSellerId || undefined} onValueChange={setExcSellerId}>
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white h-10 w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-[#171A24] border-[#262A33] text-white">
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name || s.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Tipo</label>
            <Select value={excType} onValueChange={(v) => setExcType(v as 'percentage' | 'fixed_value')}>
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#171A24] border-[#262A33] text-white">
                <SelectItem value="percentage">Percentual (%)</SelectItem>
                <SelectItem value="fixed_value">Valor fixo (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Aplica-se a</label>
            <Select value={excScope} onValueChange={(v) => setExcScope(v as 'development' | 'recurring')}>
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#171A24] border-[#262A33] text-white">
                <SelectItem value="development">Comissão de desenvolvimento</SelectItem>
                <SelectItem value="recurring">Comissão de recorrência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Válida até (opcional)</label>
            <Input
              type="date"
              value={excValidUntil}
              onChange={(e) => setExcValidUntil(e.target.value)}
              className="bg-[#0E1017] border-[#262A33] text-white h-10"
            />
          </div>
          {excType === 'percentage' ? (
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">Percentual (%)</label>
              <Input
                inputMode="decimal"
                value={excPercentageInput}
                onChange={(e) => setExcPercentageInput(e.target.value)}
                placeholder="Ex: 12"
                className="bg-[#0E1017] border-[#262A33] text-white h-10"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1.5">Valor fixo (R$)</label>
              <Input
                inputMode="decimal"
                value={excFixedInput}
                onChange={(e) => setExcFixedInput(e.target.value)}
                placeholder="Ex: 1.500,00"
                className="bg-[#0E1017] border-[#262A33] text-white h-10 pl-9"
              />
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="text-xs font-semibold text-gray-300 block mb-1.5">Motivo *</label>
            <Input
              value={excReason}
              onChange={(e) => setExcReason(e.target.value)}
              placeholder="Ex: campanha Q4 — cliente estratégico"
              className="bg-[#0E1017] border-[#262A33] text-white h-10"
            />
          </div>
        </div>

        {excError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/40 text-xs text-rose-200">{excError}</div>
        )}
        {excSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-xs text-emerald-200">
            {excSuccess}
          </div>
        )}

        <Button
          onClick={handleCreateException}
          disabled={excSaving || !excSellerId || !excReason.trim()}
          className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl h-10 text-sm"
        >
          {excSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
          Criar exceção
        </Button>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-[#171A24]/60 border border-[#262A33]">
      <span className="text-[10px] text-gray-500 block">{label}</span>
      <span className="text-sm font-bold text-white block mt-0.5">{value}</span>
    </div>
  )
}