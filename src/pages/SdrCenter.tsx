import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, Database, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { getSdrFoundationStatus } from '@/services/sdrSettingsService'
import type { SdrFoundationStatus } from '@/types/sdr'

const safeguards = [
  'Oportunidades existentes permanecem somente leitura para o SDR.',
  'Criacao e alteracao de oportunidades continuam bloqueadas por padrao.',
  'Mensagens e acoes exigem confirmacao humana enquanto a fundacao estiver protegida.',
  'Operacoes futuras devem gerar trilha de auditoria e identificador de correlacao.',
]

export default function SdrCenter() {
  const [status, setStatus] = useState<SdrFoundationStatus | null>(null)

  useEffect(() => {
    let active = true

    getSdrFoundationStatus().then((result) => {
      if (active) setStatus(result)
    })

    return () => {
      active = false
    }
  }, [])

  if (!status) {
    return (
      <div className="min-h-[45vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-500" aria-label="Carregando SDR" />
      </div>
    )
  }

  const isProtected = !status.settings.enabled

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
            Fundacao isolada para campanhas, contatos, mensagens, scores, tarefas e auditoria.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
            isProtected
              ? 'border-amber-400/50 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
              : 'border-emerald-400/50 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200'
          }`}
        >
          <LockKeyhole className="h-4 w-4" />
          {isProtected ? 'Desativado por padrao' : 'Ativo'}
        </span>
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

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="border border-border bg-card p-5 text-card-foreground">
          <ShieldCheck className="h-6 w-6 text-emerald-500" />
          <h2 className="mt-4 text-lg font-semibold">Protecao do CRM</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhuma colecao atual foi alterada e nenhuma oportunidade e modificada por esta fase.
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
            Ambiente: {status.settings.environment}. Confirmacao humana:{' '}
            {status.settings.require_human_confirmation ? 'obrigatoria' : 'desativada'}.
          </p>
        </div>
      </section>

      <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
        <h2 className="text-xl font-semibold">Garantias da Fase 1</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {safeguards.map((item) => (
            <div key={item} className="flex items-start gap-3 border-t border-border py-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span className="text-sm text-muted-foreground">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
        A ativacao permanecera indisponivel ate existirem evidencias de backup restaurado,
        homologacao aprovada e liberacao administrativa explicita.
      </section>
    </div>
  )
}
