import { useEffect, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  Database,
  FileClock,
  ListChecks,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Target,
  UsersRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SdrActivationPanel } from '@/components/sdr/SdrActivationPanel'
import { SdrCampaignSimulator } from '@/components/sdr/SdrCampaignSimulator'
import { getSdrDashboardSnapshot, getSdrFoundationStatus } from '@/services/sdrSettingsService'
import type { SdrDashboardSnapshot, SdrFoundationStatus } from '@/types/sdr'

const safeguards = [
  'As oportunidades abertas sao carregadas automaticamente pelo SDR.',
  'O SDR apenas vincula a oportunidade; os dados e a etapa do funil nao sao alterados.',
  'Contatos encerrados ou sem telefone valido sao ignorados automaticamente.',
  'Campanhas, vinculos e mensagens geram trilha de auditoria e correlacao.',
]

export default function SdrCenter() {
  const [status, setStatus] = useState<SdrFoundationStatus | null>(null)
  const [snapshot, setSnapshot] = useState<SdrDashboardSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadDashboard = async () => {
    setIsLoading(true)
    const [foundationResult, dashboardResult] = await Promise.all([
      getSdrFoundationStatus(),
      getSdrDashboardSnapshot(),
    ])
    setStatus(foundationResult)
    setSnapshot(dashboardResult)
    setIsLoading(false)
  }

  useEffect(() => {
    let active = true

    Promise.all([getSdrFoundationStatus(), getSdrDashboardSnapshot()]).then(
      ([foundationResult, dashboardResult]) => {
        if (!active) return
        setStatus(foundationResult)
        setSnapshot(dashboardResult)
        setIsLoading(false)
      },
    )

    return () => {
      active = false
    }
  }, [])

  if (!status || !snapshot) {
    return (
      <div className="min-h-[45vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" aria-label="Carregando SDR" />
      </div>
    )
  }

  const isProtected = !status.settings.enabled
  const hasUnavailableCollections = snapshot.unavailableCollections.length > 0
  const metrics = [
    { label: 'Campanhas', value: snapshot.counts.campaigns, icon: Target },
    { label: 'Contatos', value: snapshot.counts.contacts, icon: UsersRound },
    { label: 'Mensagens', value: snapshot.counts.messages, icon: MessageSquareText },
    { label: 'Tarefas', value: snapshot.counts.tasks, icon: ListChecks },
    { label: 'Scores', value: snapshot.counts.scores, icon: ShieldCheck },
    { label: 'Auditoria', value: snapshot.counts.auditLogs, icon: FileClock },
  ]

  return (
    <div className="space-y-6 text-foreground">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-500 dark:text-indigo-300">
            <Bot className="h-4 w-4" />
            Modulo administrativo
          </div>
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">SDR Inteligente</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Operacao automatizada sobre as oportunidades abertas do CRM, com fila e auditoria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadDashboard}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <span
            className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
              isProtected
                ? 'border-amber-400/50 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                : 'border-emerald-400/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
          >
            <LockKeyhole className="h-4 w-4" />
            {isProtected ? 'SDR desativado' : 'SDR ativo em producao'}
          </span>
        </div>
      </header>

      {!status.available && (
        <section className="border border-amber-400/40 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Estrutura ainda nao aplicada neste ambiente</h2>
              <p className="mt-1 text-sm opacity-90">
                A interface usa configuracao segura local. A migracao so deve ser aplicada depois da
                validacao de backup restauravel e homologacao.
              </p>
            </div>
          </div>
        </section>
      )}

      {status.available && hasUnavailableCollections && (
        <section className="border border-rose-400/40 bg-rose-50 p-4 text-rose-900 dark:bg-rose-950/20 dark:text-rose-100">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="font-semibold">Leitura parcial da fundacao SDR</h2>
              <p className="mt-1 text-sm opacity-90">
                Nao foi possivel consultar: {snapshot.unavailableCollections.join(', ')}. Nenhum
                valor foi presumido e nenhuma escrita foi tentada.
              </p>
            </div>
          </div>
        </section>
      )}

      {status.available && (
        <SdrActivationPanel
          settings={status.settings}
          onSettingsChanged={(settings) => setStatus({ available: true, settings })}
        />
      )}

      <section aria-label="Indicadores do SDR" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <div
              key={metric.label}
              className="border border-border bg-card p-4 text-card-foreground"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {metric.label}
                </span>
                <Icon className="h-4 w-4 text-indigo-500" />
              </div>
              <p className="mt-3 text-2xl font-bold">{metric.value}</p>
            </div>
          )
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="border border-border bg-card p-5 text-card-foreground">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
          <h2 className="mt-4 text-lg font-semibold">Protecao do CRM</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O acesso administrativo, a deduplicacao e a auditoria sao validados pelo servidor.
          </p>
        </div>
        <div className="border border-border bg-card p-5 text-card-foreground">
          <Database className="h-6 w-6 text-blue-500" />
          <h2 className="mt-4 text-lg font-semibold">Persistencia aditiva</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sete colecoes novas e independentes, com acesso inicial exclusivo de administradores.
          </p>
        </div>
        <div className="border border-border bg-card p-5 text-card-foreground">
          <CheckCircle2 className="h-6 w-6 text-indigo-500" />
          <h2 className="mt-4 text-lg font-semibold">Estado controlado</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Operacao em producao. O modo de homologacao fica reservado aos testes tecnicos.
          </p>
        </div>
      </section>

      <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
        <h2 className="text-xl font-semibold">Como o SDR trabalha</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {safeguards.map((item) => (
            <div key={item} className="flex items-start gap-3 border-t border-border py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-sm text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Campanhas e fila</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              As oportunidades elegiveis sao carregadas automaticamente do funil comercial.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5" />
            {isProtected ? 'Operacao desativada' : 'Operacao protegida ativa'}
          </span>
        </div>
        <div className="mt-5 grid gap-4 border-t border-border pt-5 md:grid-cols-4">
          <div>
            <h3 className="text-sm font-semibold">1. Oportunidades</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              O SDR consulta automaticamente os cards abertos com telefone valido.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">2. Selecao</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              O administrador revisa quais oportunidades entram em cada campanha.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">3. Fila auditavel</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cada contato fica vinculado a oportunidade e recebe identificador de correlacao.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">4. Envio</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              O WhatsApp automatico e liberado quando as credenciais da Meta estiverem prontas.
            </p>
          </div>
        </div>
      </section>

      <SdrCampaignSimulator
        foundationAvailable={status.available}
        settings={status.settings}
        onCampaignCreated={loadDashboard}
      />

      <section className="border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
        O envio automatico real depende das credenciais e de um template aprovado na Meta. A
        ausencia dessa integracao nao impede a leitura das oportunidades nem a criacao da fila
        auditavel.
      </section>
    </div>
  )
}
