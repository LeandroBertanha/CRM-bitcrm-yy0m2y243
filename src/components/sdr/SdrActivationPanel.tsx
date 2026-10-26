import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Power, PowerOff, ShieldCheck } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { updateSdrSettings } from '@/services/sdrOperationsService'
import { getWhatsAppCloudStatus } from '@/services/whatsappCloudService'
import type { SdrSettings } from '@/types/sdr'

interface SdrActivationPanelProps {
  settings: SdrSettings
  onSettingsChanged: (settings: SdrSettings) => void
}

export function SdrActivationPanel({ settings, onSettingsChanged }: SdrActivationPanelProps) {
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isCheckingWhatsApp, setIsCheckingWhatsApp] = useState(true)
  const [whatsAppConfigured, setWhatsAppConfigured] = useState(false)
  const [phoneNumberIdMasked, setPhoneNumberIdMasked] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getWhatsAppCloudStatus().then((status) => {
      if (!active) return
      setWhatsAppConfigured(status.configured)
      setPhoneNumberIdMasked(status.phoneNumberIdMasked)
      setIsCheckingWhatsApp(false)
    })
    return () => {
      active = false
    }
  }, [])

  const saveSettings = async (enabled: boolean) => {
    setIsSaving(true)
    try {
      const updated = await updateSdrSettings({
        enabled,
        environment: 'producao',
        allowOpportunityCreation: false,
        confirmationPhrase: enabled ? 'ATIVAR SDR EM PRODUCAO' : '',
      })
      onSettingsChanged(updated)
      toast({
        title: enabled ? 'SDR ativado em producao' : 'SDR desativado',
        description: enabled
          ? 'As oportunidades abertas ja podem ser carregadas automaticamente para a fila do SDR.'
          : 'Novas operacoes do SDR foram interrompidas sem alterar as oportunidades do CRM.',
      })
    } catch (error) {
      toast({
        title: 'Nao foi possivel alterar o SDR',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <h2 className="text-xl font-semibold">Operacao do SDR</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Ao ativar, o SDR passa a usar as oportunidades abertas do CRM como fonte da fila. Os
            dados das oportunidades nao sao modificados: o sistema apenas cria o vinculo auditavel
            com a campanha.
          </p>
        </div>
        <div
          className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
            whatsAppConfigured
              ? 'border-emerald-400/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200'
              : 'border-amber-400/40 bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-200'
          }`}
        >
          {isCheckingWhatsApp ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : whatsAppConfigured ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {isCheckingWhatsApp
            ? 'Verificando WhatsApp'
            : whatsAppConfigured
              ? `WhatsApp configurado${phoneNumberIdMasked ? ` (${phoneNumberIdMasked})` : ''}`
              : 'WhatsApp ainda nao configurado'}
        </div>
      </div>

      {!whatsAppConfigured && !isCheckingWhatsApp && (
        <div className="mt-4 border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          O SDR pode organizar oportunidades e campanhas agora. O envio automatico pelo WhatsApp
          sera liberado quando o token, o Phone Number ID e o template aprovado da Meta estiverem
          configurados.
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <div>
          <p className="text-sm font-semibold">
            {settings.enabled ? 'SDR ativo em producao' : 'SDR desativado'}
          </p>
          <p className="text-xs text-muted-foreground">
            O modo de homologacao continua disponivel apenas para testes tecnicos internos.
          </p>
        </div>

        {settings.enabled ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => saveSettings(false)}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PowerOff className="h-4 w-4" />
            )}
            Desativar SDR
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" className="gap-2" disabled={isSaving}>
                <Power className="h-4 w-4" />
                Ativar SDR
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ativar o SDR em producao?</AlertDialogTitle>
                <AlertDialogDescription>
                  O SDR carregara automaticamente as oportunidades abertas com telefone valido.
                  Nenhuma oportunidade existente sera alterada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => saveSettings(true)}>
                  Confirmar ativacao
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </section>
  )
}
