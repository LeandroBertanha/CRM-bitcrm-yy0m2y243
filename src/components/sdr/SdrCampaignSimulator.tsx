import { useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FilePlus2,
  Link2,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { prepareSdrCampaign, prepareSdrMessageQueue } from '@/services/sdrCampaignPreparation'
import { buildSdrOpportunityAssociationSuggestions } from '@/services/sdrOpportunityAssociation'
import { buildSdrOpportunityCreationPlans } from '@/services/sdrOpportunityCreationPlan'
import { createSdrOpportunity } from '@/services/sdrOpportunityCreateService'
import { findSdrOpportunityConflicts } from '@/services/sdrOpportunityGuard'
import { getSdrOpportunityReadModel } from '@/services/sdrOpportunityReadService'
import type {
  SdrCampaignContactInput,
  SdrCampaignPreparationResult,
  SdrOpportunityAssociationSuggestion,
  SdrOpportunityConflictResult,
  SdrOpportunityCreationPlan,
  SdrPreparedMessage,
  SdrSettings,
} from '@/types/sdr'

type DraftContact = SdrCampaignContactInput & { id: number }

const createEmptyContact = (id: number): DraftContact => ({
  id,
  companyName: '',
  contactName: '',
  phone: '',
  email: '',
  authorizedForTest: false,
})

interface SdrCampaignSimulatorProps {
  foundationAvailable: boolean
  settings: SdrSettings
}

interface CreationOutcome {
  status: 'success' | 'error'
  message: string
  opportunityId?: string
}

export function SdrCampaignSimulator({ foundationAvailable, settings }: SdrCampaignSimulatorProps) {
  const nextContactId = useRef(2)
  const [campaignName, setCampaignName] = useState('Campanha de homologacao')
  const [template, setTemplate] = useState(
    'Ola, {contato}. Esta e uma mensagem de teste autorizada para a {empresa}.',
  )
  const [contacts, setContacts] = useState<DraftContact[]>([createEmptyContact(1)])
  const [result, setResult] = useState<SdrCampaignPreparationResult | null>(null)
  const [queue, setQueue] = useState<SdrPreparedMessage[]>([])
  const [conflicts, setConflicts] = useState<SdrOpportunityConflictResult[]>([])
  const [associationSuggestions, setAssociationSuggestions] = useState<
    SdrOpportunityAssociationSuggestion[]
  >([])
  const [reviewedAssociations, setReviewedAssociations] = useState<Set<string>>(new Set())
  const [creationPlans, setCreationPlans] = useState<SdrOpportunityCreationPlan[]>([])
  const [confirmedCreationPlans, setConfirmedCreationPlans] = useState<Set<string>>(new Set())
  const [conflictError, setConflictError] = useState('')
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)
  const [creatingPlans, setCreatingPlans] = useState<Set<string>>(new Set())
  const [creationOutcomes, setCreationOutcomes] = useState<Record<string, CreationOutcome>>({})

  const resetResult = () => {
    setResult(null)
    setQueue([])
    setConflicts([])
    setAssociationSuggestions([])
    setReviewedAssociations(new Set())
    setCreationPlans([])
    setConfirmedCreationPlans(new Set())
    setConflictError('')
    setCreatingPlans(new Set())
    setCreationOutcomes({})
  }

  const updateContact = (
    id: number,
    field: keyof SdrCampaignContactInput,
    value: string | boolean,
  ) => {
    setContacts((current) =>
      current.map((contact) => (contact.id === id ? { ...contact, [field]: value } : contact)),
    )
    resetResult()
  }

  const addContact = () => {
    setContacts((current) => [...current, createEmptyContact(nextContactId.current)])
    nextContactId.current += 1
    resetResult()
  }

  const removeContact = (id: number) => {
    setContacts((current) => current.filter((contact) => contact.id !== id))
    resetResult()
  }

  const validateSimulation = () => {
    const prepared = prepareSdrCampaign({
      name: campaignName,
      channel: 'whatsapp',
      contacts: contacts.map(({ id: _id, ...contact }) => contact),
    })
    setResult(prepared)
    setQueue(prepareSdrMessageQueue(prepared, template))
  }

  const clearSimulation = () => {
    nextContactId.current = 2
    setCampaignName('Campanha de homologacao')
    setTemplate('Ola, {contato}. Esta e uma mensagem de teste autorizada para a {empresa}.')
    setContacts([createEmptyContact(1)])
    resetResult()
  }

  const checkOpportunityConflicts = async () => {
    if (!result?.accepted.length) return

    setIsCheckingConflicts(true)
    setConflictError('')
    setConflicts([])
    setAssociationSuggestions([])
    setReviewedAssociations(new Set())
    setCreationPlans([])
    setConfirmedCreationPlans(new Set())

    try {
      const opportunities = await getSdrOpportunityReadModel()
      const detectedConflicts = findSdrOpportunityConflicts(result.accepted, opportunities)
      setConflicts(detectedConflicts)
      setAssociationSuggestions(buildSdrOpportunityAssociationSuggestions(detectedConflicts))
      setCreationPlans(buildSdrOpportunityCreationPlans(result.accepted, detectedConflicts))
    } catch (error) {
      setConflictError(
        error instanceof Error
          ? `Nao foi possivel consultar as oportunidades: ${error.message}`
          : 'Nao foi possivel consultar as oportunidades. Tente novamente.',
      )
    } finally {
      setIsCheckingConflicts(false)
    }
  }

  const setAssociationReviewed = (correlationId: string, reviewed: boolean) => {
    setReviewedAssociations((current) => {
      const next = new Set(current)
      if (reviewed) next.add(correlationId)
      else next.delete(correlationId)
      return next
    })
  }

  const setCreationPlanConfirmed = (correlationId: string, confirmed: boolean) => {
    setConfirmedCreationPlans((current) => {
      const next = new Set(current)
      if (confirmed) next.add(correlationId)
      else next.delete(correlationId)
      return next
    })
  }

  const creationBlockReason = !foundationAvailable
    ? 'A fundacao SDR ainda nao foi aplicada neste ambiente.'
    : settings.environment !== 'homologacao'
      ? 'A criacao permanece bloqueada fora da homologacao.'
      : !settings.enabled
        ? 'Ative o SDR na configuracao de homologacao.'
        : !settings.allow_opportunity_creation
          ? 'Libere a criacao de oportunidades na feature flag do SDR.'
          : !settings.require_human_confirmation
            ? 'A configuracao esta insegura: reative a confirmacao humana.'
            : ''

  const executeCreationPlan = async (plan: SdrOpportunityCreationPlan) => {
    if (creationBlockReason || !confirmedCreationPlans.has(plan.correlationId)) return

    setCreatingPlans((current) => new Set(current).add(plan.correlationId))
    setCreationOutcomes((current) => {
      const next = { ...current }
      delete next[plan.correlationId]
      return next
    })

    try {
      const response = await createSdrOpportunity({
        ...plan.payload,
        correlationId: plan.correlationId,
        idempotencyKey: plan.idempotencyKey,
        humanConfirmed: true,
      })
      setCreationOutcomes((current) => ({
        ...current,
        [plan.correlationId]: {
          status: 'success',
          opportunityId: response.opportunityId,
          message: response.message,
        },
      }))
    } catch (error) {
      setCreationOutcomes((current) => ({
        ...current,
        [plan.correlationId]: {
          status: 'error',
          message:
            error instanceof Error ? error.message : 'Nao foi possivel criar a oportunidade.',
        },
      }))
    } finally {
      setCreatingPlans((current) => {
        const next = new Set(current)
        next.delete(plan.correlationId)
        return next
      })
    }
  }

  return (
    <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xl font-semibold">Simulador e criacao controlada</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Valide contatos, consulte possiveis duplicidades e prepare a fila. A criacao de uma
            oportunidade exige homologacao ativa, confirmacao humana e auditoria no servidor.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-md border border-emerald-400/40 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
          Escrita protegida
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sdr-campaign-name">Nome da campanha</Label>
          <Input
            id="sdr-campaign-name"
            value={campaignName}
            onChange={(event) => {
              setCampaignName(event.target.value)
              resetResult()
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sdr-message-template">Mensagem simulada</Label>
          <Textarea
            id="sdr-message-template"
            value={template}
            onChange={(event) => {
              setTemplate(event.target.value)
              resetResult()
            }}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Variaveis: {'{contato}'} e {'{empresa}'}
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Contatos de teste</h3>
            <p className="text-sm text-muted-foreground">
              A autorizacao deve ser marcada individualmente.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addContact} className="gap-2">
            <Plus className="h-4 w-4" />
            Adicionar contato
          </Button>
        </div>

        <div className="mt-4 divide-y divide-border border-y border-border">
          {contacts.map((contact, index) => (
            <div key={contact.id} className="py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Contato {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeContact(contact.id)}
                  disabled={contacts.length === 1}
                  aria-label={`Remover contato ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor={`sdr-company-${contact.id}`}>Empresa</Label>
                  <Input
                    id={`sdr-company-${contact.id}`}
                    value={contact.companyName}
                    onChange={(event) =>
                      updateContact(contact.id, 'companyName', event.target.value)
                    }
                    placeholder="Empresa Teste"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`sdr-contact-${contact.id}`}>Contato</Label>
                  <Input
                    id={`sdr-contact-${contact.id}`}
                    value={contact.contactName}
                    onChange={(event) =>
                      updateContact(contact.id, 'contactName', event.target.value)
                    }
                    placeholder="Maria Teste"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`sdr-phone-${contact.id}`}>WhatsApp</Label>
                  <Input
                    id={`sdr-phone-${contact.id}`}
                    value={contact.phone}
                    onChange={(event) => updateContact(contact.id, 'phone', event.target.value)}
                    placeholder="+55 11 99999-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`sdr-email-${contact.id}`}>E-mail opcional</Label>
                  <Input
                    id={`sdr-email-${contact.id}`}
                    type="email"
                    value={contact.email}
                    onChange={(event) => updateContact(contact.id, 'email', event.target.value)}
                    placeholder="teste@empresa.com"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <Checkbox
                  id={`sdr-authorized-${contact.id}`}
                  checked={contact.authorizedForTest}
                  onCheckedChange={(checked) =>
                    updateContact(contact.id, 'authorizedForTest', checked === true)
                  }
                />
                <Label
                  htmlFor={`sdr-authorized-${contact.id}`}
                  className="cursor-pointer text-sm font-normal leading-5"
                >
                  Confirmo que este numero esta autorizado para teste em homologacao.
                </Label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={clearSimulation}>
          Limpar
        </Button>
        <Button type="button" onClick={validateSimulation}>
          Validar simulacao
        </Button>
      </div>

      {result && (
        <div className="mt-6 border-t border-border pt-5" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className="text-xs uppercase text-muted-foreground">Recebidos</span>
              <p className="mt-1 text-2xl font-bold">{result.totals.received}</p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Aceitos</span>
              <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {result.totals.accepted}
              </p>
            </div>
            <div>
              <span className="text-xs uppercase text-muted-foreground">Rejeitados</span>
              <p className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400">
                {result.totals.rejected}
              </p>
            </div>
          </div>

          {result.rejected.length > 0 && (
            <div className="mt-5 space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4" />
                Pendencias encontradas
              </h3>
              {result.rejected.map((item, index) => (
                <p
                  key={`${item.index}-${item.code}-${index}`}
                  className="text-sm text-muted-foreground"
                >
                  {item.index >= 0 ? `Contato ${item.index + 1}: ` : ''}
                  {item.reason}
                </p>
              ))}
            </div>
          )}

          {queue.length > 0 && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Fila simulada aguardando confirmacao
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={checkOpportunityConflicts}
                  disabled={isCheckingConflicts}
                  className="gap-2"
                >
                  {isCheckingConflicts ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Verificar duplicidades no CRM
                </Button>
              </div>
              <div className="divide-y divide-border border-y border-border">
                {queue.map((message) => (
                  <div key={message.correlationId} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{message.phone}</span>
                      <span>{message.correlationId}</span>
                    </div>
                    <p className="mt-2 text-sm">{message.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {conflictError && (
            <div className="mt-5 border border-rose-400/50 bg-rose-50 p-4 text-sm text-rose-900 dark:bg-rose-950/20 dark:text-rose-100">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{conflictError}</p>
              </div>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="mt-5 space-y-3">
              <div>
                <h3 className="text-sm font-semibold">Resultado da verificacao somente leitura</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  O resultado orienta a revisao humana e nao associa nem altera oportunidades.
                </p>
              </div>
              {conflicts.map((conflict) => {
                const suggestion = associationSuggestions.find(
                  (item) => item.correlationId === conflict.correlationId,
                )
                const creationPlan = creationPlans.find(
                  (item) => item.correlationId === conflict.correlationId,
                )
                const stateClass =
                  conflict.level === 'blocking'
                    ? 'border-rose-400/50 bg-rose-50 text-rose-900 dark:bg-rose-950/20 dark:text-rose-100'
                    : conflict.level === 'review'
                      ? 'border-amber-400/50 bg-amber-50 text-amber-900 dark:bg-amber-950/20 dark:text-amber-100'
                      : 'border-emerald-400/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100'
                const stateLabel =
                  conflict.level === 'blocking'
                    ? 'Bloquear'
                    : conflict.level === 'review'
                      ? 'Revisar'
                      : 'Livre'

                return (
                  <article
                    key={conflict.correlationId}
                    className={`border p-4 text-sm ${stateClass}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>{conflict.companyName}</strong>
                      <span className="rounded-md border border-current/25 px-2 py-1 text-xs font-semibold">
                        {stateLabel}
                      </span>
                    </div>
                    <p className="mt-2 opacity-90">{conflict.reason}</p>
                    {conflict.candidates.length > 0 && (
                      <ul className="mt-3 space-y-1 border-t border-current/20 pt-3 text-xs opacity-90">
                        {conflict.candidates.map((candidate) => (
                          <li key={candidate.opportunityId}>
                            {candidate.company} - {candidate.stage} - correspondencia:{' '}
                            {candidate.matchedBy
                              .map((field) =>
                                field === 'phone'
                                  ? 'telefone'
                                  : field === 'email'
                                    ? 'e-mail'
                                    : 'empresa',
                              )
                              .join(', ')}
                          </li>
                        ))}
                      </ul>
                    )}

                    {suggestion && suggestion.status !== 'none' && (
                      <div className="mt-3 border-t border-current/20 pt-3">
                        <div className="flex items-center gap-2 font-semibold">
                          <Link2 className="h-4 w-4" />
                          Sugestao de associacao em modo leitura
                        </div>
                        <p className="mt-2 text-xs opacity-90">{suggestion.reason}</p>

                        {suggestion.status === 'ambiguous' && (
                          <p className="mt-2 text-xs font-semibold">
                            Nenhuma candidata foi pre-selecionada devido ao empate.
                          </p>
                        )}

                        {suggestion.recommendedCandidate && (
                          <div className="mt-3 border border-current/25 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold">
                                {suggestion.recommendedCandidate.company} -{' '}
                                {suggestion.recommendedCandidate.stage}
                              </span>
                              <span className="rounded-md border border-current/25 px-2 py-1 text-xs font-semibold">
                                Confianca {suggestion.confidence === 'high' ? 'alta' : 'media'}
                              </span>
                            </div>
                            <div className="mt-3 flex items-start gap-3">
                              <Checkbox
                                id={`sdr-association-review-${conflict.correlationId}`}
                                checked={reviewedAssociations.has(conflict.correlationId)}
                                onCheckedChange={(checked) =>
                                  setAssociationReviewed(conflict.correlationId, checked === true)
                                }
                              />
                              <Label
                                htmlFor={`sdr-association-review-${conflict.correlationId}`}
                                className="cursor-pointer text-xs font-normal leading-5"
                              >
                                Confirmo que revisei esta candidata. Esta marcacao e apenas local e
                                nao salva associacao no CRM.
                              </Label>
                            </div>
                            {reviewedAssociations.has(conflict.correlationId) && (
                              <p className="mt-3 text-xs font-semibold">
                                Revisao humana simulada concluida. Persistencia continua bloqueada.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {creationPlan && (
                      <div className="mt-3 border-t border-current/20 pt-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-semibold">
                            <FilePlus2 className="h-4 w-4" />
                            Proposta de nova oportunidade
                          </div>
                          <span className="rounded-md border border-current/25 px-2 py-1 text-xs font-semibold">
                            {creationBlockReason ? 'Execucao bloqueada' : 'Pronta no servidor'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs opacity-90">{creationPlan.reason}</p>

                        {creationPlan.status === 'ready_for_confirmation' && (
                          <div className="mt-3 border border-current/25 p-3">
                            <dl className="grid gap-3 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="opacity-70">Empresa</dt>
                                <dd className="mt-1 font-semibold">
                                  {creationPlan.payload.company}
                                </dd>
                              </div>
                              <div>
                                <dt className="opacity-70">Etapa e origem</dt>
                                <dd className="mt-1 font-semibold">
                                  {creationPlan.payload.stage} - {creationPlan.payload.source}
                                </dd>
                              </div>
                              <div>
                                <dt className="opacity-70">Contato</dt>
                                <dd className="mt-1 font-semibold">
                                  {creationPlan.payload.contact_name}
                                </dd>
                              </div>
                              <div>
                                <dt className="opacity-70">Valor inicial</dt>
                                <dd className="mt-1 font-semibold">R$ 0,00</dd>
                              </div>
                            </dl>
                            <div className="mt-3 flex items-start gap-3 border-t border-current/20 pt-3">
                              <Checkbox
                                id={`sdr-creation-confirm-${conflict.correlationId}`}
                                checked={confirmedCreationPlans.has(conflict.correlationId)}
                                onCheckedChange={(checked) =>
                                  setCreationPlanConfirmed(conflict.correlationId, checked === true)
                                }
                              />
                              <Label
                                htmlFor={`sdr-creation-confirm-${conflict.correlationId}`}
                                className="cursor-pointer text-xs font-normal leading-5"
                              >
                                Confirmo que revisei os dados desta proposta e autorizo a criacao
                                controlada em homologacao.
                              </Label>
                            </div>
                            <div className="mt-3 border-t border-current/20 pt-3">
                              {creationBlockReason && (
                                <p className="mb-3 text-xs font-semibold">{creationBlockReason}</p>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                className="gap-2"
                                disabled={
                                  Boolean(creationBlockReason) ||
                                  !confirmedCreationPlans.has(conflict.correlationId) ||
                                  creatingPlans.has(conflict.correlationId) ||
                                  creationOutcomes[conflict.correlationId]?.status === 'success'
                                }
                                onClick={() => executeCreationPlan(creationPlan)}
                              >
                                {creatingPlans.has(conflict.correlationId) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <FilePlus2 className="h-4 w-4" />
                                )}
                                Criar oportunidade com auditoria
                              </Button>
                              {creationOutcomes[conflict.correlationId] && (
                                <p
                                  className={`mt-3 text-xs font-semibold ${
                                    creationOutcomes[conflict.correlationId].status === 'success'
                                      ? 'text-emerald-800 dark:text-emerald-200'
                                      : 'text-rose-800 dark:text-rose-200'
                                  }`}
                                >
                                  {creationOutcomes[conflict.correlationId].message}
                                  {creationOutcomes[conflict.correlationId].opportunityId
                                    ? ` ID: ${creationOutcomes[conflict.correlationId].opportunityId}`
                                    : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
