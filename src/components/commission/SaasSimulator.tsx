import React, { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { formatBRL } from '@/types/crm'
import {
  brlToCents,
  calculateSaasCommission,
  centsToBRL,
  findActiveException,
  hostingModelAllowsRecurring,
  parsePolicyTiers,
  SAAS_HOSTING_MODEL_DESCRIPTIONS,
  SAAS_HOSTING_MODEL_LABELS,
  type SaasHostingModel,
  type SaasPolicyTier,
} from '@/types/commissionSaas'
import {
  createSaasCommission,
  type SaasCommissionRecord,
} from '@/services/commissionSaas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calculator,
  Save,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Info,
  Loader2,
} from 'lucide-react'

// ============================================================
// Simulador de Comissão SaaS — cálculo em tempo real
// ============================================================

const HOSTING_MODELS: SaasHostingModel[] = [
  'bit_cloud',
  'client_cloud',
  'client_cloud_support',
  'hybrid',
]

export interface SaasSimulatorProps {
  policy: SaasPolicyVersionInfo | null
  tiers: SaasPolicyTier[]
  exceptions: SaasExceptionLite[]
  opportunities: SaasOpportunityLite[]
  sellers: SaasSellerLite[]
  onCreated?: (commissionId: string) => void
}

export interface SaasPolicyVersionInfo {
  id: string
  name: string
  policy_version: number
  recurring_percentage: number
  recurring_eligible_months: number
  min_margin_percentage: number
}

export interface SaasExceptionLite {
  id: string
  seller: string
  exception_type: 'percentage' | 'fixed_value'
  percentage?: number
  fixed_value_cents?: number
  applies_to: 'development' | 'recurring'
  valid_from?: string
  valid_until?: string
  is_active?: boolean
}

export interface SaasOpportunityLite {
  id: string
  company: string
  value?: number
  seller?: string
  stage?: string
}

export interface SaasSellerLite {
  id: string
  name?: string
  email: string
}

export default function SaasSimulator({
  policy,
  tiers,
  exceptions,
  opportunities,
  sellers,
  onCreated,
}: SaasSimulatorProps) {
  const { user } = useAuth()

  // ---- Campos do formulário ----
  const [clientName, setClientName] = useState('')
  const [opportunityId, setOpportunityId] = useState('')
  const [sellerId, setSellerId] = useState(user?.id || '')
  const [systemName, setSystemName] = useState('')
  const [systemDescription, setSystemDescription] = useState('')
  const [listValueInput, setListValueInput] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [contractInput, setContractInput] = useState('')
  const [costsInput, setCostsInput] = useState('')
  const [taxesInput, setTaxesInput] = useState('')
  const [hostingModel, setHostingModel] = useState<SaasHostingModel>('bit_cloud')
  const [monthlyInput, setMonthlyInput] = useState('')
  const [installmentsInput, setInstallmentsInput] = useState('1')
  const [firstDueDate, setFirstDueDate] = useState('')
  const [commercialNotes, setCommercialNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // ---- Conversão para centavos ----
  const listCents = brlToCents(listValueInput)
  const discountCents = brlToCents(discountInput)
  // Valor contratado: digitado ou derivado (tabela − desconto)
  const derivedContract = Math.max(0, listCents - discountCents)
  const contractCents = contractInput.trim() !== '' ? brlToCents(contractInput) : derivedContract
  const costsCents = brlToCents(costsInput)
  const taxesCents = brlToCents(taxesInput)
  const monthlyCents = brlToCents(monthlyInput)

  // ---- Cálculo em tempo real ----
  const calc = useMemo(() => {
    if (!policy || tiers.length === 0) return null
    return calculateSaasCommission({
      contractValueCents: contractCents,
      recurringMonthlyCents: monthlyCents,
      directCostsCents: costsCents,
      taxesCents: taxesCents,
      hostingModel,
      policy: {
        tiers,
        recurring_percentage: policy.recurring_percentage,
        recurring_eligible_months: policy.recurring_eligible_months,
        min_margin_percentage: policy.min_margin_percentage,
      },
    })
  }, [policy, tiers, contractCents, monthlyCents, costsCents, taxesCents, hostingModel])

  const canSave =
    clientName.trim() !== '' &&
    sellerId !== '' &&
    systemName.trim() !== '' &&
    contractCents > 0 &&
    !!calc &&
    !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(null)
    const result = await createSaasCommission({
      clientName: clientName.trim(),
      opportunityId: opportunityId || undefined,
      sellerId,
      systemName: systemName.trim(),
      systemDescription: systemDescription.trim() || undefined,
      hostingModel,
      listValueCents: listCents,
      discountCents,
      contractValueCents: contractCents,
      installmentsCount: Math.max(1, parseInt(installmentsInput, 10) || 1),
      recurringMonthlyCents: monthlyCents,
      directCostsCents: costsCents,
      taxesCents: taxesCents,
      commercialNotes: commercialNotes.trim() || undefined,
      firstDueDate: firstDueDate ? new Date(firstDueDate + 'T12:00:00') : undefined,
    })
    setSaving(false)
    if (result.ok) {
      setSaveSuccess(
        `Comissão registrada (${result.status === 'pendente_aprovacao' ? 'pendente de aprovação — margem abaixo da política' : 'aprovada'}). Plano de recebimentos gerado.`,
      )
      onCreated?.(result.commissionId!)
      // Limpa formulário parcialmente
      setClientName('')
      setSystemName('')
      setSystemDescription('')
      setListValueInput('')
      setDiscountInput('')
      setContractInput('')
      setCostsInput('')
      setTaxesInput('')
      setMonthlyInput('')
      setCommercialNotes('')
    } else {
      setSaveError(result.error || 'Erro ao registrar comissão.')
    }
  }

  const marginPctDisplay = calc ? formatPercentage(calc.marginPercentage) : '—'
  const minMarginDisplay = policy ? formatPercentage(policy.min_margin_percentage) : '—'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* ---------- Formulário (7 colunas) ---------- */}
      <div className="lg:col-span-7 bg-[#12141A] border border-[#262A33] rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#262A33]">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">Simulador de Comissão SaaS</h2>
            <p className="text-xs text-gray-400">
              Cálculo em tempo real sobre a política ativa (v{policy?.policy_version ?? '—'})
            </p>
          </div>
        </div>

        {/* Vínculos CRM */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Cliente *</label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do cliente/empresa"
              className="bg-[#0E1017] border-[#262A33] text-white h-10 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Oportunidade vinculada
            </label>
            <Select
              value={opportunityId || undefined}
              onValueChange={(v) => setOpportunityId(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white h-10 w-full">
                <SelectValue placeholder="Nenhuma (opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-[#171A24] border-[#262A33] text-white">
                <SelectItem value="none">Nenhuma (opcional)</SelectItem>
                {opportunities.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.company} {o.stage ? `(${o.stage})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Vendedor responsável *
            </label>
            <Select value={sellerId || undefined} onValueChange={(v) => setSellerId(v)}>
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white h-10 w-full">
                <SelectValue placeholder="Selecione o vendedor" />
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
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Nome do sistema SaaS *</label>
            <Input
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder="Ex: Sistema Financeiro — Controle Mensal"
              className="bg-[#0E1017] border-[#262A33] text-white h-10 focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Descrição do projeto</label>
          <Textarea
            value={systemDescription}
            onChange={(e) => setSystemDescription(e.target.value)}
            rows={2}
            placeholder="Escopo resumido do sistema vendido (qualquer segmento/tecnologia)"
            className="bg-[#0E1017] border-[#262A33] text-white focus:border-indigo-500"
          />
        </div>

        {/* Valores financeiros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MoneyField
            label="Valor de tabela do desenvolvimento"
            value={listValueInput}
            onChange={setListValueInput}
          />
          <MoneyField label="Desconto comercial" value={discountInput} onChange={setDiscountInput} />
          <MoneyField
            label="Valor contratado (tabela − desconto)"
            value={contractInput}
            onChange={setContractInput}
            placeholder={derivedContract > 0 ? centsToBRL(derivedContract) : '0,00'}
            hint="Deixe vazio para usar tabela − desconto"
          />
          <MoneyField label="Custo direto estimado" value={costsInput} onChange={setCostsInput} />
          <MoneyField label="Tributos estimados" value={taxesInput} onChange={setTaxesInput} hint="Contam uma única vez (dentro da receita líquida)" />
          <MoneyField
            label="Mensalidade contratada (recorrência)"
            value={monthlyInput}
            onChange={setMonthlyInput}
            hint={
              hostingModelAllowsRecurring(hostingModel)
                ? 'Comissiona as 3 primeiras mensalidades recebidas'
                : 'Nuvem do cliente sem suporte: sem comissão de recorrência'
            }
          />
        </div>

        {/* Modelo de hospedagem */}
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Modelo de hospedagem *</label>
          <Select value={hostingModel} onValueChange={(v) => setHostingModel(v as SaasHostingModel)}>
            <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#171A24] border-[#262A33] text-white">
              {HOSTING_MODELS.map((m) => (
                <SelectItem key={m} value={m}>
                  {SAAS_HOSTING_MODEL_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed flex items-start gap-1.5">
            <Info className="w-3 h-3 mt-0.5 shrink-0 text-indigo-400" />
            {SAAS_HOSTING_MODEL_DESCRIPTIONS[hostingModel]}
          </p>
        </div>

        {/* Parcelas e datas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Parcelas do desenvolvimento
            </label>
            <Input
              type="number"
              min="1"
              max="60"
              value={installmentsInput}
              onChange={(e) => setInstallmentsInput(e.target.value)}
              className="bg-[#0E1017] border-[#262A33] text-white h-10 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              1º vencimento previsto
            </label>
            <Input
              type="date"
              value={firstDueDate}
              onChange={(e) => setFirstDueDate(e.target.value)}
              className="bg-[#0E1017] border-[#262A33] text-white h-10 focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1.5">Observações comerciais</label>
          <Textarea
            value={commercialNotes}
            onChange={(e) => setCommercialNotes(e.target.value)}
            rows={2}
            placeholder="Contexto da negociação, campanha vigente, autorizações…"
            className="bg-[#0E1017] border-[#262A33] text-white focus:border-indigo-500"
          />
        </div>
      </div>

      {/* ---------- Resultados (5 colunas) ---------- */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-[#12141A] border border-indigo-500/30 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-[#262A33]">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">Resultado em tempo real</h3>
          </div>

          {!calc ? (
            <p className="text-xs text-gray-500">
              Carregando política ativa…
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ResultBox label="Faixa aplicada" value={calc.tierLabel} />
                <ResultBox
                  label="Percentual dev."
                  value={calc.commissionType === 'fixed_value' ? 'Valor fixo' : formatPercentage(calc.devPercentage)}
                />
                <ResultBox
                  label="Comissão do desenvolvimento"
                  value={centsToBRL(calc.devCommissionCents)}
                  highlight
                />
                <ResultBox
                  label="Comissão/mês (recorrência)"
                  value={centsToBRL(calc.recurringCommissionPerMonthCents)}
                />
                <ResultBox
                  label={`Comissão potencial de recorrência (${calc.recurringEligibleMonths}x)`}
                  value={centsToBRL(calc.recurringCommissionPotentialCents)}
                />
                <ResultBox label="Comissão total potencial" value={centsToBRL(calc.totalPotentialCents)} highlight />
                <ResultBox label="Receita líquida estimada" value={centsToBRL(calc.netRevenueCents)} />
                <ResultBox
                  label="Comissão por parcela"
                  value={centsToBRL(parcelaDev(calc, Math.max(1, parseInt(installmentsInput, 10) || 1)))}
                />
              </div>

              {/* Margem e aprovação */}
              <div
                className={`p-3.5 rounded-xl border ${
                  calc.marginStatus === 'ok'
                    ? 'bg-emerald-950/30 border-emerald-600/40'
                    : calc.marginStatus === 'needs_approval'
                      ? 'bg-amber-950/30 border-amber-600/40'
                      : 'bg-rose-950/30 border-rose-600/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    Margem de contribuição
                  </span>
                  <span className="text-lg font-black text-white tabular-nums">{marginPctDisplay}</span>
                </div>
                <div className="flex items-start gap-2">
                  {calc.marginStatus === 'ok' ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : calc.marginStatus === 'needs_approval' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <p className="text-[11px] leading-relaxed text-gray-300">
                    {calc.marginStatus === 'ok'
                      ? `Dentro da política (mínimo ${minMarginDisplay}). Comissão pode ser liberada normalmente após recebimentos.`
                      : calc.marginStatus === 'needs_approval'
                        ? `Abaixo da margem mínima (${minMarginDisplay}). Aprovação administrativa obrigatória antes da liberação.`
                        : 'Alerta crítico: margem negativa. Operação fora da política — revisar preços/custos.'}
                  </p>
                </div>
              </div>

              {calc.exceptionApplied && (
                <p className="text-[11px] text-indigo-300 bg-indigo-950/30 border border-indigo-700/40 p-2.5 rounded-lg">
                  Exceção/campanha do vendedor aplicada ao cálculo.
                </p>
              )}
            </>
          )}
        </div>

        {/* Ações */}
        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-5 shadow-xl space-y-3">
          {saveError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-600/40 text-xs text-rose-200">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-xs text-emerald-200">
              {saveSuccess}
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando…
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Registrar comissão SaaS
              </>
            )}
          </Button>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            Ao registrar, a comissão entra como <strong>Pendente de aprovação</strong> quando a margem
            estiver abaixo da política, ou <strong>Aprovada</strong> caso contrário. O plano de
            recebimentos (parcelas + mensalidades) é gerado automaticamente; a liberação ocorre
            proporcionalmente a cada recebimento confirmado.
          </p>
        </div>
      </div>
    </div>
  )
}

// Comissão por parcela do desenvolvimento (proporcional: total ÷ nº de parcelas)
function parcelaDev(
  calc: NonNullable<ReturnType<typeof calculateSaasCommission>>,
  installments: number,
): number {
  return Math.floor(calc.devCommissionCents / Math.max(1, installments))
}

function MoneyField({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-300 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || '0,00'}
          className="bg-[#0E1017] border-[#262A33] text-white h-10 pl-9 focus:border-indigo-500"
        />
      </div>
      {hint && <p className="text-[10px] text-gray-500 mt-1">{hint}</p>}
    </div>
  )
}

function ResultBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-3 rounded-xl border ${highlight ? 'bg-indigo-950/40 border-indigo-500/40' : 'bg-[#171A24]/60 border-[#262A33]'}`}>
      <span className="text-[10px] text-gray-400 block">{label}</span>
      <span className={`text-sm font-bold block mt-0.5 tabular-nums ${highlight ? 'text-indigo-200' : 'text-white'}`}>
        {value}
      </span>
    </div>
  )
}