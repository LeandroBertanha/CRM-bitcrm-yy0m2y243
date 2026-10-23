import { useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { prepareSdrCampaign, prepareSdrMessageQueue } from '@/services/sdrCampaignPreparation'
import type {
  SdrCampaignContactInput,
  SdrCampaignPreparationResult,
  SdrPreparedMessage,
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

export function SdrCampaignSimulator() {
  const nextContactId = useRef(2)
  const [campaignName, setCampaignName] = useState('Campanha de homologacao')
  const [template, setTemplate] = useState(
    'Ola, {contato}. Esta e uma mensagem de teste autorizada para a {empresa}.',
  )
  const [contacts, setContacts] = useState<DraftContact[]>([createEmptyContact(1)])
  const [result, setResult] = useState<SdrCampaignPreparationResult | null>(null)
  const [queue, setQueue] = useState<SdrPreparedMessage[]>([])

  const resetResult = () => {
    setResult(null)
    setQueue([])
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

  return (
    <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <h2 className="text-xl font-semibold">Simulador local de campanha</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Valide contatos, duplicidades e a fila preparada. Nenhum dado sera salvo e nenhuma
            mensagem sera enviada.
          </p>
        </div>
        <span className="inline-flex w-fit items-center rounded-md border border-emerald-400/40 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200">
          Somente memoria local
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
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Fila simulada aguardando confirmacao
              </h3>
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
        </div>
      )}
    </section>
  )
}
