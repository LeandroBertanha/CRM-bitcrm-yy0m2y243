import { describe, expect, it, vi, beforeEach } from 'vitest'
import pb from '@/lib/pocketbase/client'
import { updateOpportunityStage } from '@/services/clientService'

describe('atualização de estágio de oportunidade (updateOpportunityStage)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('chama POST /backend/v1/opportunities/{id}/stage com payload correto no sucesso', async () => {
    const mockResult = {
      success: true,
      opportunity: {
        id: 'opp-123',
        company: 'Empresa Teste',
        stage: 'Proposta',
        seller: 'usr-seller',
      },
      client: null,
      clientCreated: false,
    }

    const sendSpy = vi.spyOn(pb, 'send').mockResolvedValue(mockResult)

    const res = await updateOpportunityStage('opp-123', 'Proposta')

    expect(sendSpy).toHaveBeenCalledWith('/backend/v1/opportunities/opp-123/stage', {
      method: 'POST',
      body: { stage: 'Proposta' },
    })
    expect(res.success).toBe(true)
    expect(res.opportunity.stage).toBe('Proposta')
  })

  it('repassa erro com mensagem específica de regra de negócio quando vendedor não tem permissão', async () => {
    const errorPayload = {
      status: 403,
      response: {
        success: false,
        error:
          'Você não tem permissão para mover esta oportunidade porque ela pertence a outro vendedor.',
      },
    }

    vi.spyOn(pb, 'send').mockRejectedValue(errorPayload)

    await expect(updateOpportunityStage('opp-456', 'Ganho')).rejects.toMatchObject({
      status: 403,
      response: {
        error:
          'Você não tem permissão para mover esta oportunidade porque ela pertence a outro vendedor.',
      },
    })
  })

  it('repassa erro 400 se o estágio for inválido', async () => {
    const errorPayload = {
      status: 400,
      response: {
        success: false,
        error: 'Estágio inválido: Inexistente',
      },
    }

    vi.spyOn(pb, 'send').mockRejectedValue(errorPayload)

    await expect(updateOpportunityStage('opp-123', 'Inexistente' as any)).rejects.toMatchObject({
      status: 400,
      response: {
        error: 'Estágio inválido: Inexistente',
      },
    })
  })

  it('converte para Ganho e retorna cliente criado/atualizado', async () => {
    const mockWonResult = {
      success: true,
      opportunity: {
        id: 'opp-789',
        company: 'Cliente Vencedor',
        stage: 'Ganho',
        seller: 'usr-seller',
      },
      client: {
        id: 'cli-001',
        name: 'Cliente Vencedor',
        status: 'Implantacao',
        source_opportunity: 'opp-789',
      },
      clientCreated: true,
    }

    vi.spyOn(pb, 'send').mockResolvedValue(mockWonResult)

    const res = await updateOpportunityStage('opp-789', 'Ganho')

    expect(res.success).toBe(true)
    expect(res.opportunity.stage).toBe('Ganho')
    expect(res.clientCreated).toBe(true)
    expect(res.client?.status).toBe('Implantacao')
  })
})
