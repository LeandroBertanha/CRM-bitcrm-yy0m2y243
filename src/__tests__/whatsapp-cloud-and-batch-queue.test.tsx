import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { BatchWhatsAppModal } from '@/components/approach/BatchWhatsAppModal'
import type { Opportunity } from '@/types/crm'
import * as whatsappCloudService from '@/services/whatsappCloudService'

vi.mock('@/lib/pocketbase/client', () => {
  return {
    default: {
      collection: vi.fn((name: string) => {
        if (name === 'playbook_scripts') {
          return {
            getFullList: vi.fn().mockResolvedValue([
              {
                id: 'script-1',
                title: 'Abordagem Inicial Padrão',
                channel: 'WhatsApp',
                script_text: 'Olá, {contato}! Falamos da Bit Consulting sobre o site da {empresa}.',
                is_active: true,
                display_order: 1,
              },
            ]),
          }
        }
        if (name === 'opportunity_notes') {
          return {
            getFullList: vi.fn().mockResolvedValue([]),
            create: vi.fn().mockResolvedValue({ id: 'note-new' }),
          }
        }
        if (name === 'approach_sessions') {
          return {
            create: vi.fn().mockResolvedValue({ id: 'sess-new' }),
          }
        }
        if (name === 'opportunities') {
          return {
            update: vi.fn().mockResolvedValue({ id: 'opp-1' }),
          }
        }
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
        }
      }),
      authStore: {
        record: {
          id: 'user-admin',
          name: 'Vendedor Teste',
          email: 'admin@bitconsulting.com.br',
        },
      },
    },
  }
})

describe('BatchWhatsAppModal — Fila de Envio Assistido, Cópia Agrupada e Relatório da Leva (Fase 1 e Fase 2)', () => {
  const mockOpportunities: Opportunity[] = [
    {
      id: 'opp-1',
      company: 'Padaria Estrela',
      contact_name: 'Carlos Santos',
      contact_phone: '(11) 98765-4321',
      city: 'São Paulo',
      stage: 'Novo',
      source: 'Site',
      value: 1000,
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
    {
      id: 'opp-2',
      company: 'Mecânica Central',
      contact_name: 'Ana Silva',
      contact_phone: '11999998888',
      city: 'Campinas',
      stage: 'Novo',
      source: 'Indicação',
      value: 1500,
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
    {
      id: 'opp-3',
      company: 'Empresa Sem Tel',
      contact_name: 'Marcos',
      contact_phone: '',
      city: 'Santos',
      stage: 'Novo',
      source: 'Prospecção',
      value: 500,
      collectionId: 'opportunities',
      collectionName: 'opportunities',
      created: '2025-01-01',
      updated: '2025-01-01',
    },
  ]

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    window.open = vi.fn()
  })

  it('renderiza o modal com botões de alternância entre "Visão Geral" e "Modo Fila de Envio"', async () => {
    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={() => {}}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="user-admin"
        currentUserName="Vendedor Teste"
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('tab-view-list')).toBeDefined()
      expect(screen.getByTestId('tab-view-queue')).toBeDefined()
    })

    // Na visão padrão de lista, temos os cards
    expect(screen.getByTestId('batch-item-opp-1')).toBeDefined()
    expect(screen.getByTestId('batch-item-opp-2')).toBeDefined()
  })

  it('FASE 1 Item 1: Navega para a Fila de Envio Assistido, mostra progresso "1 de 3" e avança automaticamente após "Sim, enviado"', async () => {
    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={() => {}}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="user-admin"
        currentUserName="Vendedor Teste"
      />,
    )

    // Clica para ir para o modo Fila de Envio
    const queueTab = screen.getByTestId('tab-view-queue')
    fireEvent.click(queueTab)

    await waitFor(() => {
      const badge = screen.getByTestId('queue-progress-badge')
      expect(badge.textContent).toContain('1 de 3')
      expect(screen.getByTestId('queue-item-card-opp-1')).toBeDefined()
    })

    // Clica em "Enviar via WhatsApp Web"
    const sendBtn = screen.getByTestId('btn-send-opp-1')
    fireEvent.click(sendBtn)

    expect(window.open).toHaveBeenCalled()

    // O card agora entra no estado "Aguardando confirmação" com botões "Sim, enviado" e "Não, sem WhatsApp"
    await waitFor(() => {
      expect(screen.getByTestId('confirm-box-opp-1')).toBeDefined()
      expect(screen.getByTestId('btn-confirm-yes-opp-1')).toBeDefined()
      expect(screen.getByTestId('btn-confirm-no-opp-1')).toBeDefined()
    })

    // Clica em "Sim, enviado"
    const confirmYesBtn = screen.getByTestId('btn-confirm-yes-opp-1')
    fireEvent.click(confirmYesBtn)

    // A fila deve avançar automaticamente para o próximo item acionável (Padaria Estrela -> Mecânica Central)
    await waitFor(() => {
      const badge = screen.getByTestId('queue-progress-badge')
      expect(badge.textContent).toContain('2 de 3')
      expect(screen.getByTestId('queue-item-card-opp-2')).toBeDefined()
    })
  })

  it('FASE 1 Item 2: Botão "Copiar todas as mensagens" copia textos agrupados por empresa/contato/mensagem', async () => {
    let copiedText = ''
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          copiedText = text
          return Promise.resolve()
        }),
      },
    })

    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={() => {}}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="user-admin"
        currentUserName="Vendedor Teste"
      />,
    )

    const copyAllBtn = screen.getByTestId('btn-copy-all-grouped')
    fireEvent.click(copyAllBtn)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      expect(copiedText).toContain('Padaria Estrela')
      expect(copiedText).toContain('Carlos Santos')
      expect(copiedText).toContain('Mecânica Central')
      expect(copiedText).toContain('Ana Silva')
    })
  })

  it('FASE 1 Item 3: Relatório da leva ao finalizar exibe métricas (enviadas, sem telefone, já abordadas, perdidos e puladas) e permite copiar resumo', async () => {
    let copiedReport = ''
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation((text: string) => {
          copiedReport = text
          return Promise.resolve()
        }),
      },
    })

    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={() => {}}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="user-admin"
        currentUserName="Vendedor Teste"
      />,
    )

    const reportBtn = screen.getByTestId('btn-open-session-report')
    fireEvent.click(reportBtn)

    await waitFor(() => {
      expect(screen.getByTestId('dialog-session-report')).toBeDefined()
      expect(screen.getByTestId('report-text-pre')).toBeDefined()
    })

    const copySummaryBtn = screen.getByTestId('btn-copy-report-text')
    fireEvent.click(copySummaryBtn)

    await waitFor(() => {
      expect(copiedReport).toContain('RELATÓRIO DA LEVA')
      expect(copiedReport).toContain('Total na Coluna: 3')
      expect(copiedReport).toContain('Sem telefone cadastrado: 1')
    })
  })

  it('FASE 2: Quando Cloud API não configurada, exibe banner informativo claro e NÃO oferece botão automático', async () => {
    vi.spyOn(whatsappCloudService, 'getWhatsAppCloudStatus').mockResolvedValue({
      configured: false,
      phoneNumberIdMasked: null,
      graphApiVersion: 'v26.0',
      settings: {
        initialTemplateName: 'bit_abordagem_inicial',
        initialTemplateLanguage: 'pt_BR',
        followupTemplateName: 'bit_followup_comercial',
        followupTemplateLanguage: 'pt_BR',
        throttleMs: 1000,
        maxBatchSize: 50,
      },
    })

    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={() => {}}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="user-admin"
        currentUserName="Vendedor Teste"
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('banner-cloud-api-not-configured')).toBeDefined()
      expect(screen.queryByTestId('btn-send-all-auto')).toBeNull()
    })
  })

  it('FASE 2: Quando Cloud API está configurada com secrets, exibe painel automático e botão "Enviar todos de uma vez"', async () => {
    vi.spyOn(whatsappCloudService, 'getWhatsAppCloudStatus').mockResolvedValue({
      configured: true,
      phoneNumberIdMasked: '10••••89',
      graphApiVersion: 'v26.0',
      settings: {
        initialTemplateName: 'bit_abordagem_inicial',
        initialTemplateLanguage: 'pt_BR',
        followupTemplateName: 'bit_followup_comercial',
        followupTemplateLanguage: 'pt_BR',
        throttleMs: 1000,
        maxBatchSize: 50,
      },
    })

    const mockSendAuto = vi.spyOn(whatsappCloudService, 'sendWhatsAppBatchAuto').mockResolvedValue({
      total: 2,
      sentCount: 2,
      failedCount: 0,
      results: [
        {
          opportunityId: 'opp-1',
          company: 'Padaria Estrela',
          status: 'sent',
          messageId: 'wamid.1',
        },
        {
          opportunityId: 'opp-2',
          company: 'Mecânica Central',
          status: 'sent',
          messageId: 'wamid.2',
        },
      ],
    })

    render(
      <BatchWhatsAppModal
        open={true}
        onOpenChange={() => {}}
        stage="Novo"
        actionType="initial"
        opportunities={mockOpportunities}
        currentUserId="user-admin"
        currentUserName="Vendedor Teste"
      />,
    )

    await waitFor(() => {
      expect(screen.getByTestId('panel-cloud-api-configured')).toBeDefined()
      expect(screen.getByTestId('btn-send-all-auto')).toBeDefined()
    })

    // Dispara o envio automático
    fireEvent.click(screen.getByTestId('btn-send-all-auto'))

    await waitFor(() => {
      expect(mockSendAuto).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'initial',
          opportunityIds: ['opp-1', 'opp-2'],
          templateName: 'bit_abordagem_inicial',
        }),
      )
      expect(screen.getByTestId('dialog-auto-batch-result')).toBeDefined()
    })
  })
})
