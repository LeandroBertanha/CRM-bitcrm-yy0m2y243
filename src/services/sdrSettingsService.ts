import pb from '@/lib/pocketbase/client'
import type { SdrFoundationStatus, SdrSettings } from '@/types/sdr'

export const SDR_COLLECTIONS = [
  'sdr_settings',
  'sdr_campaigns',
  'sdr_campaign_contacts',
  'sdr_messages',
  'sdr_scores',
  'sdr_tasks',
  'sdr_audit_logs',
] as const

export const DEFAULT_SDR_SETTINGS: SdrSettings = {
  id: 'local-safe-default',
  collectionId: '',
  collectionName: 'sdr_settings',
  created: '',
  updated: '',
  enabled: false,
  allow_existing_opportunity_update: false,
  allow_opportunity_creation: false,
  require_human_confirmation: true,
  environment: 'homologacao',
  notes: 'Configuracao local segura enquanto a fundacao SDR nao estiver aplicada.',
}

export async function getSdrFoundationStatus(): Promise<SdrFoundationStatus> {
  try {
    const settings = await pb
      .collection('sdr_settings')
      .getFirstListItem<SdrSettings>('', { requestKey: 'sdr-foundation-status' })

    return { available: true, settings }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Colecao sdr_settings indisponivel.'

    return {
      available: false,
      settings: DEFAULT_SDR_SETTINGS,
      reason: message,
    }
  }
}
