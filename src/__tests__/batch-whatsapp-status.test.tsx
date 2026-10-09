import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BatchWhatsAppModal } from '@/components/approach/BatchWhatsAppModal'
import type { Opportunity } from '@/types/crm'

// Mock de window.open
const mockWindowOpen = vi.fn()
window.open = mockWindowOpen

// Mock do PocketBase
vi.mock('@/lib/pocketbase/client', () => {
  return {
    __esModule: true,
    default: {
      authStore: {
        record: { id: 'usr_mock_123', name: 'Leandro Bertanha' },
      },
      collection: (colName: string) => ({
        getFullList: vi.fn().mockImplementation(() => {
          if (colName === 'playbook_scripts') {
            return Promise.resolve([
              {
                id: 'script_1',
                channel: 'WhatsApp',
                title: 'Primeira Mensagem WhatsApp',
                situation: 'Primeiro contato por mensagem',
                script_text: 'Olá, {contato}! Aqui é {vendedor} da bit Consulting.',
                is_active: true,
                display_order: 1,
              },
              {
                id: 'script_2',
                channel: 'WhatsApp',
                title: 'Follow-up WhatsApp',
                situation: 'Continuação do contato',
                script_text: 'Olá, {contato}! Retomando da {empresa}.',
                is_active: true,
                display_order: 2,
              },
            ])
          }
          if (colName === 'opportunity_notes') {
            return Promise.resolve([])
          }
          return Promise.resolve([])
        }),
        create: vi.fn().mockResolvedValue({ id: 'note_mock_created' }),
        update: vi.fn().mockResolvedValue({ id: 'opp_mock_updated' }),
      }),
    },
    pb: {
      authStore: {
        record: { id: 'usr_mock_123', name: 'Leandro Bertanha' },
      },
      collection: (colName: string) => ({
        getFullList: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 'note_mock_created' }),
        update: vi.fn().mockResolvedValue({ id: 'opp_mock_updated' }),
      }),
    },
  }
})

describe('BatchWhatsAppModal — Status Enviada em Azul', () => {
  const mockOpportunities: Opportunity[] = [
    {
      id: 'opp_1',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'SHEL Lava-rápido',
      stage: 'Novo',
      source: 'Site',
      value: 500,
      seller: 'usr_mock_123',
      contact_name: 'Roberto',
      contact_phone: '(11) 99777-4143',
      city: 'Osasco',
      created: '2026-03-01T10:00:00Z',
      updated: '2026-03-01T10:00:00Z',
    },
    {
      id: 'opp_2',
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      company: 'Rodrigues Estacionamento',
      stage: 'Novo',
      source: 'Prospecção',
      value: 600,
      seller: 'usr_mock_123',
      contact_name: 'Carlos',
      contact_phone: '(11) 95849-2793',
      city: 'Osasco',
      created: '2026-03-01T10:00:00Z',
      updated: '2026-03-01T10:00:00Z',
    },
  ]

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('muda imediatamente o status para Enviada em Azul ao clicar em Enviar (coluna Novo / initial)', async () => {
    const handleInteractionLogged = vi.fn()

    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={vi.fn()}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="usr_mock_123"
        currentUserName="Leandro Bertanha"
        onInteractionLogged={handleInteractionLogged}
      />,
    )

    // Antes do clique: botão mostra "Enviar"
    const sendButtonOpp1 = screen.getByTestId('btn-send-opp_1')
    expect(sendButtonOpp1.textContent).toContain('Enviar')
    expect(screen.queryByTestId('status-badge-enviada-opp_1')).toBeNull()

    // Clicar em "Enviar" no primeiro item
    fireEvent.click(sendButtonOpp1)

    // Window open deve ter sido disparado
    expect(mockWindowOpen).toHaveBeenCalled()

    // Aguardar atualização de estado
    await waitFor(() => {
      // 1. Badge "Enviada" deve existir
      const badge = screen.getByTestId('status-badge-enviada-opp_1')
      expect(badge).toBeDefined()
      expect(badge.textContent).toContain('Enviada')
      // Cor azul consistente
      expect(badge.className).toContain('text-blue-300')
      expect(badge.className).toContain('bg-blue-500/20')
      expect(badge.className).toContain('border-blue-500/40')

      // 2. Card do item deve ter destaque azul
      const itemCard = screen.getByTestId('batch-item-opp_1')
      expect(itemCard.className).toContain('border-blue-500/40')
      expect(itemCard.className).toContain('bg-[#0E1322]')

      // 3. Botão do item deve virar "Enviada (Reenviar)" com estilo azul
      const updatedBtn = screen.getByTestId('btn-send-opp_1')
      expect(updatedBtn.textContent).toContain('Enviada (Reenviar)')
      expect(updatedBtn.className).toContain('bg-blue-600/25')
      expect(updatedBtn.className).toContain('text-blue-200')
      expect(updatedBtn.className).toContain('border-blue-500/40')

      // 4. Segundo item continua inalterado (Enviar pendente)
      const sendButtonOpp2 = screen.getByTestId('btn-send-opp_2')
      expect(sendButtonOpp2.textContent).toContain('Enviar')
      expect(screen.queryByTestId('status-badge-enviada-opp_2')).toBeNull()
    })

    // Persistência no localStorage
    const savedInStorage = localStorage.getItem('bitcrm_batch_whatsapp_sent_novo_usr_mock_123')
    expect(savedInStorage).toBeDefined()
    expect(JSON.parse(savedInStorage!)).toContain('opp_1')
  })

  it('funciona de forma idêntica na coluna Qualificado (followup)', async () => {
    const qualOpps: Opportunity[] = [
      {
        ...mockOpportunities[0],
        id: 'opp_qual_1',
        stage: 'Qualificado',
      },
    ]

    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={vi.fn()}
        stage="Qualificado"
        actionType="followup"
        opportunities={qualOpps}
        currentUserId="usr_mock_123"
        currentUserName="Leandro Bertanha"
      />,
    )

    const sendBtn = screen.getByTestId('btn-send-opp_qual_1')
    expect(sendBtn.textContent).toContain('Enviar')

    fireEvent.click(sendBtn)

    await waitFor(() => {
      const badge = screen.getByTestId('status-badge-enviada-opp_qual_1')
      expect(badge).toBeDefined()
      expect(badge.textContent).toContain('Enviada')
      expect(badge.className).toContain('text-blue-300')

      const updatedBtn = screen.getByTestId('btn-send-opp_qual_1')
      expect(updatedBtn.textContent).toContain('Enviada (Reenviar)')
      expect(updatedBtn.className).toContain('text-blue-200')
    })

    const savedInStorage = localStorage.getItem(
      'bitcrm_batch_whatsapp_sent_qualificado_usr_mock_123',
    )
    expect(savedInStorage).toBeDefined()
    expect(JSON.parse(savedInStorage!)).toContain('opp_qual_1')
  })

  it('preserva o status "Enviada" em azul quando já consta na sessão salva no localStorage', () => {
    // Pré-carrega sessão com opp_1 já enviada
    localStorage.setItem('bitcrm_batch_whatsapp_sent_novo_usr_mock_123', JSON.stringify(['opp_1']))

    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={vi.fn()}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="usr_mock_123"
        currentUserName="Leandro Bertanha"
      />,
    )

    // O item opp_1 já inicia com o badge "Enviada" em azul
    const badge = screen.getByTestId('status-badge-enviada-opp_1')
    expect(badge).toBeDefined()
    expect(badge.textContent).toContain('Enviada')
    expect(badge.className).toContain('text-blue-300')

    const btn = screen.getByTestId('btn-send-opp_1')
    expect(btn.textContent).toContain('Enviada (Reenviar)')
    expect(btn.className).toContain('text-blue-200')

    // Contador do topo "ENVIADAS NA SESSÃO" reflete 1
    expect(screen.getByText('Enviadas na Sessão')).toBeDefined()
  })
})
