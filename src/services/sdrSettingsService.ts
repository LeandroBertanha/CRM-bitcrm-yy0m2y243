import pb from '@/lib/pocketbase/client'
import type {
  SdrDashboardCounts,
  SdrDashboardSnapshot,
  SdrFoundationStatus,
  SdrSettings,
} from '@/types/sdr'

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

const EMPTY_DASHBOARD_COUNTS: SdrDashboardCounts = {
  campaigns: 0,
  contacts: 0,
  messages: 0,
  scores: 0,
  tasks: 0,
  auditLogs: 0,
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

export async function getSdrDashboardSnapshot(): Promise<SdrDashboardSnapshot> {
  const countTargets: Array<[keyof SdrDashboardCounts, (typeof SDR_COLLECTIONS)[number]]> = [
    ['campaigns', 'sdr_campaigns'],
    ['contacts', 'sdr_campaign_contacts'],
    ['messages', 'sdr_messages'],
    ['scores', 'sdr_scores'],
    ['tasks', 'sdr_tasks'],
    ['auditLogs', 'sdr_audit_logs'],
  ]

  const counts = { ...EMPTY_DASHBOARD_COUNTS }
  const unavailableCollections: string[] = []

  await Promise.all(
    countTargets.map(async ([key, collection]) => {
      try {
        const result = await pb.collection(collection).getList(1, 1, {
          fields: 'id',
          requestKey: `sdr-count-${collection}`,
        })
        counts[key] = result.totalItems
      } catch {
        unavailableCollections.push(collection)
      }
    }),
  )

  return { counts, unavailableCollections }
}
