import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Save, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { prepareSdrCampaign, prepareSdrMessageQueue } from '@/services/sdrCampaignPreparation'
import { createSdrCampaign } from '@/services/sdrOperationsService'
import { getSdrOpportunityReadModel } from '@/services/sdrOpportunityReadService'
import type { SdrOpportunityReadModel, SdrSettings } from '@/types/sdr'

const MAX_CONTACTS_PER_CAMPAIGN = 50

interface SdrCampaignSimulatorProps {
  foundationAvailable: boolean
  settings: SdrSettings
  onCampaignCreated?: () => void
}

interface CampaignOutcome {
  status: 'success' | 'error'
  message: string
}

function normalizePhone(value?: string) {
  return (value || '').replace(/\D/g, '')
}

function isEligibleOpportunity(opportunity: SdrOpportunityReadModel) {
  const phone = normalizePhone(opportunity.contactPhone)
  return (
    opportunity.stage !== 'Ganho' &&
    opportunity.stage !== 'Perdido' &&
    phone.length >= 10 &&
    phone.length <= 15
  )
}

export function SdrCampaignSimulator({
  foundationAvailable,
  settings,
  onCampaignCreated,
}: SdrCampaignSimulatorProps) {
  const [campaignName, setCampaignName] = useState('Oportunidades abertas do CRM')
  const [template, setTemplate] = useState(
    'Ola, {contato}. Aqui e da bit Consulting. Gostaria de dar continuidade ao atendimento da {empresa}.',
  )
  const [opportunities, setOpportunities] = useState<SdrOpportunityReadModel[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [outcome, setOutcome] = useState<CampaignOutcome | null>(null)

  const loadOpportunities = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const records = await getSdrOpportunityReadModel()
      setOpportunities(records)
      setSelectedIds(
        new Set(
          records
            .filter(isEligibleOpportunity)
            .slice(0, MAX_CONTACTS_PER_CAMPAIGN)
            .map((opportunity) => opportunity.id),
        ),
      )
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? `Nao foi possivel carregar as oportunidades: ${error.message}`
          : 'Nao foi possivel carregar as oportunidades.',
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOpportunities()
  }, [loadOpportunities])

  const eligibleOpportunities = useMemo(
    () => opportunities.filter(isEligibleOpportunity),
    [opportunities],
  )
  const ignoredCount = opportunities.length - eligibleOpportunities.length
  const selectedOpportunities = useMemo(
    () => eligibleOpportunities.filter((opportunity) => selectedIds.has(opportunity.id)),
    [eligibleOpportunities, selectedIds],
  )

  const preparation = useMemo(
    () =>
      prepareSdrCampaign({
        name: campaignName,
        channel: 'whatsapp',
        contacts: selectedOpportunities.map((opportunity) => ({
          opportunityId: opportunity.id,
          companyName: opportunity.company,
          contactName: opportunity.contactName || 'Contato',
          phone: opportunity.contactPhone || '',
          email: opportunity.contactEmail || '',
          authorizedForTest: true,
        })),
      }),
    [campaignName, selectedOpportunities],
  )
  const queue = useMemo(
    () => prepareSdrMessageQueue(preparation, template),
    [preparation, template],
  )

  const toggleOpportunity = (opportunityId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) {
        if (next.size < MAX_CONTACTS_PER_CAMPAIGN) next.add(opportunityId)
      } else {
        next.delete(opportunityId)
      }
      return next
    })
    setOutcome(null)
  }

  const selectAll = (checked: boolean) => {
    setSelectedIds(
      checked
        ? new Set(
            eligibleOpportunities
              .slice(0, MAX_CONTACTS_PER_CAMPAIGN)
              .map((opportunity) => opportunity.id),
          )
        : new Set(),
    )
    setOutcome(null)
  }

  const saveCampaign = async () => {
    if (!foundationAvailable || !settings.enabled || !preparation.valid || queue.length === 0)
      return
    setIsSaving(true)
    setOutcome(null)
    try {
      const response = await createSdrCampaign({
        name: preparation.campaignName,
        template,
        contacts: preparation.accepted,
        messages: queue,
      })
      setOutcome({ status: 'success', message: response.message })
      onCampaignCreated?.()
      await loadOpportunities()
    } catch (error) {
      setOutcome({
        status: 'error',
        message: error instanceof Error ? error.message : 'Nao foi possivel registrar a campanha.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const blockReason = !foundationAvailable
    ? 'A estrutura do SDR ainda nao esta disponivel.'
    : !settings.enabled
      ? 'Ative o SDR para registrar a fila.'
      : !selectedOpportunities.length
        ? 'Nenhuma oportunidade foi selecionada.'
        : !template.trim()
          ? 'Informe a mensagem da campanha.'
          : !preparation.valid
            ? preparation.rejected[0]?.reason || 'Revise os dados selecionados.'
            : ''

  return (
    <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xl font-semibold">Fila automatica de oportunidades</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A lista abaixo vem diretamente de Oportunidades. Nao e necessario digitar contatos e
            nenhum card do funil e alterado pelo SDR.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadOpportunities}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar oportunidades
        </Button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sdr-campaign-name">Nome da campanha</Label>
          <Input
            id="sdr-campaign-name"
            value={campaignName}
            onChange={(event) => {
              setCampaignName(event.target.value)
              setOutcome(null)
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sdr-message-template">Mensagem da abordagem</Label>
          <Textarea
            id="sdr-message-template"
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value)
              setOutcome(null)
            }}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Variaveis disponiveis: {'{contato}'} e {'{empresa}'}.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mt-5 flex items-start gap-2 border border-rose-400/40 bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/20 dark:text-rose-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Oportunidades elegiveis</h3>
            <p className="text-sm text-muted-foreground">
              {eligibleOpportunities.length} aberta(s) com telefone valido; {ignoredCount}{' '}
              ignorada(s) por estarem encerradas ou sem telefone valido.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="sdr-select-all"
              checked={
                eligibleOpportunities.length > 0 &&
                selectedIds.size ===
                  Math.min(eligibleOpportunities.length, MAX_CONTACTS_PER_CAMPAIGN)
              }
              onCheckedChange={(checked) => selectAll(checked === true)}
              disabled={isLoading || eligibleOpportunities.length === 0}
            />
            <Label htmlFor="sdr-select-all" className="cursor-pointer">
              Selecionar ate {MAX_CONTACTS_PER_CAMPAIGN}
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
          </div>
        ) : eligibleOpportunities.length === 0 ? (
          <div className="mt-4 border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhuma oportunidade aberta com telefone valido foi encontrada.
          </div>
        ) : (
          <div className="mt-4 max-h-[28rem] divide-y divide-border overflow-y-auto border-y border-border">
            {eligibleOpportunities.map((opportunity) => {
              const checked = selectedIds.has(opportunity.id)
              return (
                <label
                  key={opportunity.id}
                  className="flex cursor-pointer items-start gap-3 px-2 py-4 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleOpportunity(opportunity.id, value === true)}
                    disabled={!checked && selectedIds.size >= MAX_CONTACTS_PER_CAMPAIGN}
                    aria-label={`Selecionar ${opportunity.company}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{opportunity.company}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      {opportunity.contactName || 'Contato'} · {opportunity.contactPhone} · Etapa:{' '}
                      {opportunity.stage}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-semibold">{selectedOpportunities.length} oportunidade(s) na fila</p>
          <p className="text-muted-foreground">
            A campanha criara vinculos e mensagens auditaveis, sem alterar o funil.
          </p>
        </div>
        <Button
          type="button"
          className="gap-2"
          onClick={saveCampaign}
          disabled={isSaving || Boolean(blockReason)}
          title={blockReason || undefined}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Criar fila do SDR
        </Button>
      </div>

      {blockReason && (
        <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">{blockReason}</p>
      )}

      {outcome && (
        <div
          className={`mt-4 flex items-start gap-2 border p-4 text-sm ${
            outcome.status === 'success'
              ? 'border-emerald-400/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100'
              : 'border-rose-400/40 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:text-rose-100'
          }`}
        >
          {outcome.status === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{outcome.message}</span>
        </div>
      )}
    </section>
  )
}
