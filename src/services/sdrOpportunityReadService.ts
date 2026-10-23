import pb from '@/lib/pocketbase/client'
import type { Opportunity } from '@/types/crm'
import type { SdrOpportunityReadModel } from '@/types/sdr'

export async function getSdrOpportunityReadModel(): Promise<SdrOpportunityReadModel[]> {
  const opportunities = await pb.collection('opportunities').getFullList<Opportunity>({
    fields: 'id,company,stage,seller,contact_name,contact_email,contact_phone,updated',
    sort: '-updated',
    requestKey: 'sdr-opportunity-read-model',
  })

  return opportunities.map((opportunity) => ({
    id: opportunity.id,
    company: opportunity.company,
    stage: opportunity.stage,
    seller: opportunity.seller,
    contactName: opportunity.contact_name,
    contactEmail: opportunity.contact_email,
    contactPhone: opportunity.contact_phone,
    updated: opportunity.updated,
  }))
}
