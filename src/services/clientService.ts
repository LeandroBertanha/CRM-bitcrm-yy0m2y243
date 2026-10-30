import pb from '@/lib/pocketbase/client'
import type { ClientRecord } from '@/types/client'
import type { Opportunity } from '@/types/crm'

export interface StageUpdateResult {
  success: boolean
  opportunity: Opportunity
  client?: ClientRecord | null
  clientCreated?: boolean
}

export async function updateOpportunityStage(
  opportunityId: string,
  stage: Opportunity['stage'],
): Promise<StageUpdateResult> {
  return pb.send<StageUpdateResult>(`/backend/v1/opportunities/${opportunityId}/stage`, {
    method: 'POST',
    body: { stage },
  })
}

export async function getClients(): Promise<ClientRecord[]> {
  return pb.collection('clients').getFullList<ClientRecord>({
    sort: '-won_at,-created',
    expand: 'seller,source_opportunity,product',
  })
}

export async function updateClient(
  clientId: string,
  data: FormData | Partial<ClientRecord>,
): Promise<ClientRecord> {
  return pb.collection('clients').update<ClientRecord>(clientId, data, {
    expand: 'seller,source_opportunity,product',
  })
}

export const getClientFileToken = (): Promise<string> => pb.files.getToken()

export const getClientFileUrl = (client: ClientRecord, filename: string, token?: string): string =>
  pb.files.getURL(client, filename, token ? { token } : undefined)
