import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Power, PowerOff, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { updateSdrSettings } from '@/services/sdrOperationsService'
import { getWhatsAppCloudStatus } from '@/services/whatsappCloudService'
import type { SdrEnvironment, SdrSettings } from '@/types/sdr'

interface SdrActivationPanelProps {
  settings: SdrSettings
  onSettingsChanged: (settings: SdrSettings) => void
}

export function SdrActivationPanel({ settings, onSettingsChanged }: SdrActivationPanelProps) {
  const { toast } = useToast()
  const [environment, setEnvironment] = useState<SdrEnvironment>(settings.environment)
  const [allowOpportunityCreation, setAllowOpportunityCreation] = useState(
    settings.allow_opportunity_creation,
  )
  const [confirmationPhrase, setConfirmationPhrase] = useState('')
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

  useEffect(() => {
    setEnvironment(settings.environment)
    setAllowOpportunityCreation(settings.allow_opportunity_creation)
  }, [settings.allow_opportunity_creation, settings.environment])

  const saveSettings = async (enabled: boolean) => {
    setIsSaving(true)
    try {
      const updated = await updateSdrSettings({
        enabled,
        environment,
        allowOpportunityCreation: enabled && allowOpportunityCreation,
        confirmationPhrase: enabled ? confirmationPhrase : '',
      })
      onSettingsChanged(updated)
      setConfirmationPhrase('')
      toast({
        title: enabled ? 'SDR ativado com protecoes' : 'SDR desativado',
        description: enabled
          ? `Ambiente ${updated.environment}; confirmacao humana e auditoria permanecem obrigatorias.`
          : 'Novas operacoes SDR foram bloqueadas sem afetar o CRM.',
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

  const productionPhraseReady =
    environment !== 'producao' ||
    confirmationPhrase.trim().toUpperCase() === 'ATIVAR SDR EM PRODUCAO'

  return (
    <section className="border border-border bg-card p-5 text-card-foreground sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-500" />
            <h2 className="text-xl font-semibold">Ativacao operacional</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A ativacao libera campanhas persistidas e criacao confirmada de novas oportunidades. O
            SDR nunca altera oportunidades existentes.
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
              : 'WhatsApp aguardando credenciais Meta'}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sdr-environment">Ambiente operacional</Label>
          <Select
            value={environment}
            onValueChange={(value) => setEnvironment(value as SdrEnvironment)}
            disabled={isSaving}
          >
            <SelectTrigger id="sdr-environment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="homologacao">Homologacao</SelectItem>
              <SelectItem value="producao">Producao real</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start gap-3 border border-border p-4">
          <Checkbox
            id="sdr-allow-opportunity-creation"
            checked={allowOpportunityCreation}
            onCheckedChange={(checked) => setAllowOpportunityCreation(checked === true)}
            disabled={isSaving}
          />
          <div>
            <Label htmlFor="sdr-allow-opportunity-creation" className="cursor-pointer">
              Permitir novas oportunidades com confirmacao humana
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Deduplicacao e auditoria continuam obrigatorias no servidor.
            </p>
          </div>
        </div>
      </div>

      {environment === 'producao' && (
        <div className="mt-4 space-y-2">
          <Label htmlFor="sdr-production-confirmation">
            Confirmacao de producao: digite ATIVAR SDR EM PRODUCAO
          </Label>
          <Input
            id="sdr-production-confirmation"
            value={confirmationPhrase}
            onChange={(event) => setConfirmationPhrase(event.target.value)}
            autoComplete="off"
            disabled={isSaving}
          />
        </div>
      )}

      {!whatsAppConfigured && !isCheckingWhatsApp && (
        <div className="mt-4 border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-100">
          Campanhas e oportunidades poderao operar, mas nenhum envio automatico sera liberado ate o
          token, o Phone Number ID e o template aprovado da Meta estarem configurados.
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {settings.enabled && (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() => saveSettings(false)}
            disabled={isSaving}
          >
            <PowerOff className="h-4 w-4" />
            Desativar SDR
          </Button>
        )}
        <Button
          type="button"
          className="gap-2"
          onClick={() => saveSettings(true)}
          disabled={isSaving || !productionPhraseReady}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          {settings.enabled ? 'Salvar regras' : 'Ativar SDR'}
        </Button>
      </div>
    </section>
  )
}
