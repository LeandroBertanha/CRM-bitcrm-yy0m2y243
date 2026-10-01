import pb from '@/lib/pocketbase/client'
import type { CommissionTier, CommissionSettings } from '@/types/commission'

/**
 * Serviço para carregar dados de comissionamento direto do PocketBase/Skip Cloud.
 * NUNCA utiliza valores hardcoded no código.
 */
export async function getCommissionTiers(): Promise<CommissionTier[]> {
  try {
    const records = await pb.collection('commission_tiers').getFullList<CommissionTier>({
      filter: 'is_active = true',
      sort: 'display_order',
    })
    return records
  } catch (err) {
    console.error('Erro ao buscar faixas de comissão do banco:', err)
    return []
  }
}

export async function getCommissionSettings(): Promise<CommissionSettings | null> {
  try {
    const record = await pb
      .collection('commission_settings')
      .getFirstListItem<CommissionSettings>('is_active = true', {
        sort: '-updated',
      })
    return record
  } catch (err) {
    console.error('Erro ao buscar configurações de comissionamento do banco:', err)
    return null
  }
}
