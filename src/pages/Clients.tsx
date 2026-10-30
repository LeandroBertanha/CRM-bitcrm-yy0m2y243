import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import useRealtime from '@/hooks/use-realtime'
import { formatCnpj, getClientCompletion, isValidCnpj, normalizeCnpj } from '@/lib/clientConversion'
import {
  getClientFileToken,
  getClientFileUrl,
  getClients,
  updateClient,
} from '@/services/clientService'
import type { ClientDocumentField, ClientRecord, ClientStatus } from '@/types/client'

type ClientForm = {
  name: string
  legal_name: string
  cnpj: string
  state_registration: string
  contact_name: string
  contact_email: string
  contact_phone: string
  zip_code: string
  street: string
  address_number: string
  complement: string
  district: string
  city: string
  state: string
  status: ClientStatus
  notes: string
}

const EMPTY_FORM: ClientForm = {
  name: '',
  legal_name: '',
  cnpj: '',
  state_registration: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  zip_code: '',
  street: '',
  address_number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  status: 'Implantacao',
  notes: '',
}

const DOCUMENTS: Array<{ field: ClientDocumentField; label: string; hint: string }> = [
  { field: 'contract_files', label: 'Contrato', hint: 'Contrato assinado ou minuta final' },
  { field: 'proposal_files', label: 'Proposta', hint: 'Proposta comercial aprovada' },
  { field: 'cnpj_card_files', label: 'Cartão CNPJ', hint: 'Comprovante de inscrição no CNPJ' },
  { field: 'other_files', label: 'Outros documentos', hint: 'Documentos complementares' },
]

const formatCurrency = (value?: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)

const formatDate = (value?: string) => {
  if (!value) return 'Não informado'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Não informado' : date.toLocaleDateString('pt-BR')
}

const formFromClient = (client: ClientRecord): ClientForm => ({
  name: client.name || '',
  legal_name: client.legal_name || '',
  cnpj: formatCnpj(client.cnpj || ''),
  state_registration: client.state_registration || '',
  contact_name: client.contact_name || '',
  contact_email: client.contact_email || '',
  contact_phone: client.contact_phone || '',
  zip_code: client.zip_code || '',
  street: client.street || '',
  address_number: client.address_number || '',
  complement: client.complement || '',
  district: client.district || '',
  city: client.city || '',
  state: client.state || '',
  status: client.status || 'Implantacao',
  notes: client.notes || '',
})

const inputClass = 'border-border bg-background text-foreground placeholder:text-muted-foreground'

export default function Clients() {
  const { toast } = useToast()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ClientRecord | null>(null)
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM)
  const [files, setFiles] = useState<Partial<Record<ClientDocumentField, File[]>>>({})
  const [fileToken, setFileToken] = useState('')
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setClients(await getClients())
    } catch (requestError) {
      console.error('Erro ao carregar clientes:', requestError)
      setError('Não foi possível carregar os clientes. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchClients()
  }, [fetchClients])

  useRealtime<ClientRecord>('clients', () => {
    void fetchClients()
  })

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clients
    return clients.filter((client) =>
      [
        client.name,
        client.legal_name,
        client.cnpj,
        client.contact_name,
        client.contact_email,
        client.contact_phone,
        client.city,
        client.product_name,
      ].some((value) =>
        String(value || '')
          .toLowerCase()
          .includes(term),
      ),
    )
  }, [clients, search])

  const totals = useMemo(
    () => ({
      all: clients.length,
      implementation: clients.filter((client) => client.status === 'Implantacao').length,
      complete: clients.filter((client) => getClientCompletion(client) === 100).length,
    }),
    [clients],
  )

  const openClient = async (client: ClientRecord) => {
    setSelected(client)
    setForm(formFromClient(client))
    setFiles({})
    setFormError('')
    setOpen(true)
    try {
      setFileToken(await getClientFileToken())
    } catch {
      setFileToken('')
    }
  }

  const setField = <K extends keyof ClientForm>(field: K, value: ClientForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const handleFiles = (field: ClientDocumentField, list: FileList | null) => {
    if (!list) return
    const selectedFiles = Array.from(list)
    const invalid = selectedFiles.find((file) => file.size > 20 * 1024 * 1024)
    if (invalid) {
      setFormError(`O arquivo "${invalid.name}" ultrapassa o limite de 20 MB.`)
      return
    }
    setFiles((current) => ({ ...current, [field]: selectedFiles }))
    setFormError('')
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selected) return
    if (!form.name.trim()) {
      setFormError('Informe o nome do cliente.')
      return
    }
    if (form.cnpj && !isValidCnpj(form.cnpj)) {
      setFormError('Informe um CNPJ válido ou deixe o campo em branco.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([field, value]) => {
        payload.append(
          field,
          field === 'cnpj' ? normalizeCnpj(String(value)) : String(value).trim(),
        )
      })
      Object.entries(files).forEach(([field, selectedFiles]) => {
        selectedFiles?.forEach((file) => payload.append(field, file))
      })

      const updated = await updateClient(selected.id, payload)
      setClients((current) =>
        current.map((client) => (client.id === updated.id ? updated : client)),
      )
      setSelected(updated)
      setOpen(false)
      toast({
        title: 'Cliente atualizado',
        description: 'Dados e documentos foram salvos com segurança.',
      })
    } catch (requestError) {
      console.error('Erro ao atualizar cliente:', requestError)
      setFormError('Não foi possível salvar o cadastro. Revise os dados e tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const documentCount = (client: ClientRecord) =>
    DOCUMENTS.reduce((total, item) => total + (client[item.field]?.length || 0), 0)

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 pb-12 pt-24 sm:px-6 sm:pt-28">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Building2 className="h-5 w-5" />
            <span className="text-sm font-semibold">Base de clientes</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">Clientes</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            O cadastro nasce automaticamente quando uma oportunidade é marcada como ganha.
          </p>
        </div>
        <Button variant="outline" onClick={() => void fetchClients()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <section className="mb-6 grid grid-cols-1 border-y border-border bg-card sm:grid-cols-3">
        {[
          ['Total de clientes', totals.all],
          ['Em implantação', totals.implementation],
          ['Cadastros completos', totals.complete],
        ].map(([label, value], index) => (
          <div
            key={String(label)}
            className={`px-5 py-4 ${index > 0 ? 'border-t border-border sm:border-l sm:border-t-0' : ''}`}
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </section>

      <div className="mb-5 max-w-xl">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por cliente, CNPJ, contato ou cidade"
            className={`${inputClass} pl-10`}
          />
        </label>
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 border border-destructive/40 bg-destructive/10 p-5 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" onClick={() => void fetchClients()}>
            Tentar novamente
          </Button>
        </div>
      ) : loading ? (
        <div className="flex min-h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando clientes...
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center border border-dashed border-border px-6 text-center">
          <Building2 className="mb-3 h-9 w-9 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Nenhum cliente encontrado</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Mova uma oportunidade para Ganho para criar o primeiro cadastro automaticamente.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Contato</th>
                  <th className="px-4 py-3 font-semibold">Produto</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Cadastro</th>
                  <th className="px-4 py-3 font-semibold">Documentos</th>
                  <th className="px-4 py-3 text-right font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredClients.map((client) => {
                  const completion = getClientCompletion(client)
                  return (
                    <tr key={client.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-4">
                        <p className="max-w-64 font-semibold text-foreground">{client.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {client.cnpj ? formatCnpj(client.cnpj) : 'CNPJ pendente'}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm">
                        <p className="text-foreground">{client.contact_name || 'Não informado'}</p>
                        <p className="mt-1 text-muted-foreground">
                          {client.contact_email || client.contact_phone || 'Contato pendente'}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">
                        {client.product_name || client.expand?.product?.name || 'Não informado'}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                          {client.status === 'Implantacao' ? 'Implantação' : client.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-28 items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-foreground">
                            {completion}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-foreground">{documentCount(client)}</td>
                      <td className="px-4 py-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => void openClient(client)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-border bg-background text-foreground">
          <form onSubmit={handleSave}>
            <DialogHeader className="pr-8">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-5 w-5 text-primary" /> Cadastro do cliente
              </DialogTitle>
              <DialogDescription>
                Complete os dados fiscais, endereço e documentos do contrato fechado.
              </DialogDescription>
            </DialogHeader>

            {formError && (
              <div className="mt-5 flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {formError}
              </div>
            )}

            <div className="mt-6 space-y-8">
              <FormSection title="Dados empresariais" icon={<Building2 className="h-4 w-4" />}>
                <Field label="Nome fantasia *">
                  <Input
                    className={inputClass}
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </Field>
                <Field label="Razão social">
                  <Input
                    className={inputClass}
                    value={form.legal_name}
                    onChange={(e) => setField('legal_name', e.target.value)}
                  />
                </Field>
                <Field label="CNPJ">
                  <Input
                    className={inputClass}
                    value={form.cnpj}
                    onChange={(e) => setField('cnpj', formatCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00"
                  />
                </Field>
                <Field label="Inscrição estadual">
                  <Input
                    className={inputClass}
                    value={form.state_registration}
                    onChange={(e) => setField('state_registration', e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(value) => setField('status', value as ClientStatus)}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Implantacao">Implantação</SelectItem>
                      <SelectItem value="Ativo">Ativo</SelectItem>
                      <SelectItem value="Inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </FormSection>

              <FormSection title="Contato principal" icon={<CheckCircle2 className="h-4 w-4" />}>
                <Field label="Nome do contato">
                  <Input
                    className={inputClass}
                    value={form.contact_name}
                    onChange={(e) => setField('contact_name', e.target.value)}
                  />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    className={inputClass}
                    value={form.contact_email}
                    onChange={(e) => setField('contact_email', e.target.value)}
                  />
                </Field>
                <Field label="Telefone">
                  <Input
                    className={inputClass}
                    value={form.contact_phone}
                    onChange={(e) => setField('contact_phone', e.target.value)}
                  />
                </Field>
              </FormSection>

              <FormSection title="Endereço" icon={<MapPin className="h-4 w-4" />}>
                <Field label="CEP">
                  <Input
                    className={inputClass}
                    value={form.zip_code}
                    onChange={(e) =>
                      setField('zip_code', e.target.value.replace(/\D/g, '').slice(0, 8))
                    }
                  />
                </Field>
                <Field label="Logradouro" className="md:col-span-2">
                  <Input
                    className={inputClass}
                    value={form.street}
                    onChange={(e) => setField('street', e.target.value)}
                  />
                </Field>
                <Field label="Número">
                  <Input
                    className={inputClass}
                    value={form.address_number}
                    onChange={(e) => setField('address_number', e.target.value)}
                  />
                </Field>
                <Field label="Complemento">
                  <Input
                    className={inputClass}
                    value={form.complement}
                    onChange={(e) => setField('complement', e.target.value)}
                  />
                </Field>
                <Field label="Bairro">
                  <Input
                    className={inputClass}
                    value={form.district}
                    onChange={(e) => setField('district', e.target.value)}
                  />
                </Field>
                <Field label="Cidade">
                  <Input
                    className={inputClass}
                    value={form.city}
                    onChange={(e) => setField('city', e.target.value)}
                  />
                </Field>
                <Field label="UF">
                  <Input
                    className={inputClass}
                    maxLength={2}
                    value={form.state}
                    onChange={(e) =>
                      setField('state', e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))
                    }
                  />
                </Field>
              </FormSection>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-foreground">Dados da venda</h3>
                <div className="grid grid-cols-2 gap-4 border-y border-border bg-muted/30 p-4 text-sm md:grid-cols-4">
                  <Summary
                    label="Produto"
                    value={
                      selected?.product_name || selected?.expand?.product?.name || 'Não informado'
                    }
                  />
                  <Summary label="Setup" value={formatCurrency(selected?.setup_value)} />
                  <Summary label="Mensalidade" value={formatCurrency(selected?.recurring_value)} />
                  <Summary label="Ganho em" value={formatDate(selected?.won_at)} />
                </div>
              </section>

              <section>
                <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText className="h-4 w-4" /> Documentos
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  PDF, Word ou imagem, com até 20 MB por arquivo.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {DOCUMENTS.map((document) => (
                    <div key={document.field} className="border border-border bg-card p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{document.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{document.hint}</p>
                        </div>
                        <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <Input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                        className={inputClass}
                        onChange={(event) => handleFiles(document.field, event.target.files)}
                      />
                      {(selected?.[document.field] || []).length > 0 && (
                        <div className="mt-3 space-y-2">
                          {(selected?.[document.field] || []).map((filename) => (
                            <a
                              key={filename}
                              href={getClientFileUrl(selected!, filename, fileToken)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{filename}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <Field label="Observações" className="block">
                <Textarea
                  className={inputClass}
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                />
              </Field>
            </div>

            <DialogFooter className="mt-8 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar cliente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function FormSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon} {title}
      </h3>
      <div className="grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block text-sm text-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold text-foreground" title={value}>
        {value}
      </p>
    </div>
  )
}
