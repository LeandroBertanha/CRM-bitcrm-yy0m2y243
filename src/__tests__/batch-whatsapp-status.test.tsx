import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BatchWhatsAppModal } from '@/components/approach/BatchWhatsAppModal'
import type { Opportunity } from '@/types/crm'

// Mock de window.open
const mockWindowOpen = vi.fn()
window.open = mockWindowOpen

// Mock das chamadas de create e update para asserções nos testes
const mockOppUpdate = vi.fn().mockResolvedValue({ id: 'opp_mock_updated' })
const mockNoteCreate = vi.fn().mockResolvedValue({ id: 'note_mock_created' })
const mockApproachSessionCreate = vi.fn().mockResolvedValue({ id: 'session_mock_created' })

// Mock do PocketBase
vi.mock('@/lib/pocketbase/client', () => {
  const collectionHandler = (colName: string) => {
    if (colName === 'opportunities') {
      return {
        update: (...args: unknown[]) => mockOppUpdate(...args),
        getFullList: vi.fn().mockResolvedValue([]),
        getOne: vi
          .fn()
          .mockResolvedValue({ id: 'opp_1', stage: 'Novo', company: 'SHEL Lava-rápido' }),
      }
    }
    if (colName === 'opportunity_notes') {
      return {
        create: (...args: unknown[]) => mockNoteCreate(...args),
        getFullList: vi.fn().mockResolvedValue([]),
      }
    }
    if (colName === 'approach_sessions') {
      return {
        create: (...args: unknown[]) => mockApproachSessionCreate(...args),
        getFullList: vi.fn().mockResolvedValue([]),
      }
    }
    if (colName === 'playbook_scripts') {
      return {
        getFullList: vi.fn().mockResolvedValue([
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
        ]),
      }
    }
    return {
      getFullList: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'mock_created' }),
      update: vi.fn().mockResolvedValue({ id: 'mock_updated' }),
    }
  }

  const clientObj = {
    authStore: {
      record: { id: 'usr_mock_123', name: 'Leandro Bertanha' },
    },
    collection: collectionHandler,
  }

  return {
    __esModule: true,
    default: clientObj,
    pb: clientObj,
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

  it('após clicar em Enviar: abre WhatsApp, entra no estado neutro "Aguardando confirmação", NÃO fica Enviada nem move estágio', async () => {
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
    expect(screen.queryByTestId('status-badge-aguardando-opp_1')).toBeNull()

    // Clicar em "Enviar" no primeiro item
    fireEvent.click(sendButtonOpp1)

    // 1. WhatsApp Web deve ter sido aberto
    expect(mockWindowOpen).toHaveBeenCalled()

    // 2. Item entra em "Aguardando confirmação" (estado neutro)
    await waitFor(() => {
      const badgeAwaiting = screen.getByTestId('status-badge-aguardando-opp_1')
      expect(badgeAwaiting).toBeDefined()
      expect(badgeAwaiting.textContent).toContain('Aguardando confirmação')

      // Mostra a pergunta "O número tem WhatsApp?" com os botões Sim e Não
      const confirmBox = screen.getByTestId('confirm-box-opp_1')
      expect(confirmBox.textContent).toContain('O número tem WhatsApp?')
      expect(screen.getByTestId('btn-confirm-yes-opp_1').textContent).toContain('Sim, enviado')
      expect(screen.getByTestId('btn-confirm-no-opp_1').textContent).toContain('Não, sem WhatsApp')
    })

    // 3. NÃO deve registrar ainda nada na timeline ou no banco
    expect(mockOppUpdate).not.toHaveBeenCalled()
    expect(mockNoteCreate).not.toHaveBeenCalled()
    expect(mockApproachSessionCreate).not.toHaveBeenCalled()
    expect(handleInteractionLogged).not.toHaveBeenCalled()

    // 4. NÃO deve marcar como "Enviada" em azul
    expect(screen.queryByTestId('status-badge-enviada-opp_1')).toBeNull()

    // 5. Persistência de "Aguardando confirmação" no localStorage
    const savedAwaiting = localStorage.getItem('bitcrm_batch_whatsapp_awaiting_novo_usr_mock_123')
    expect(savedAwaiting).toBeDefined()
    expect(JSON.parse(savedAwaiting!)).toContain('opp_1')

    // 6. Lista de "Enviadas" no localStorage permanece vazia
    const savedSent = localStorage.getItem('bitcrm_batch_whatsapp_sent_novo_usr_mock_123')
    expect(savedSent ? JSON.parse(savedSent) : []).not.toContain('opp_1')
  })

  it('clicar "Sim, enviado" → badge azul Enviada + movimentação para Qualificado + registros na timeline e histórico', async () => {
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

    // Clicar em "Enviar"
    fireEvent.click(screen.getByTestId('btn-send-opp_1'))

    // Aguardar caixa de confirmação
    const yesBtn = await screen.findByTestId('btn-confirm-yes-opp_1')
    fireEvent.click(yesBtn)

    // Aguardar conclusão da confirmação
    await waitFor(() => {
      // 1. Badge azul "Enviada" deve aparecer
      const badge = screen.getByTestId('status-badge-enviada-opp_1')
      expect(badge).toBeDefined()
      expect(badge.textContent).toContain('Enviada')
      expect(badge.className).toContain('text-blue-300')
      expect(badge.className).toContain('bg-blue-500/20')

      // 2. Card do item fica com estilo azul
      const itemCard = screen.getByTestId('batch-item-opp_1')
      expect(itemCard.className).toContain('border-blue-500/40')
      expect(itemCard.className).toContain('bg-[#0E1322]')

      // 3. Botão do item vira "Enviada (Reenviar)"
      const updatedBtn = screen.getByTestId('btn-send-opp_1')
      expect(updatedBtn.textContent).toContain('Enviada (Reenviar)')
      expect(updatedBtn.className).toContain('text-blue-200')

      // 4. Mudança de estágio Novo -> Qualificado deve ser chamada
      expect(mockOppUpdate).toHaveBeenCalledWith('opp_1', {
        stage: 'Qualificado',
      })

      // 5. Timeline registrada (nota de whatsapp e mudança de estágio)
      expect(mockNoteCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_1',
          type: 'whatsapp',
        }),
      )

      // 6. Sessão em approach_sessions criada com status 'Contato realizado'
      expect(mockApproachSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_1',
          status: 'Contato realizado',
        }),
      )

      // 7. Callback disparado
      expect(handleInteractionLogged).toHaveBeenCalled()
    })

    // 8. Persistência de Enviadas no localStorage atualizada e retirado de aguardando
    const savedSent = localStorage.getItem('bitcrm_batch_whatsapp_sent_novo_usr_mock_123')
    expect(JSON.parse(savedSent!)).toContain('opp_1')

    const savedAwaiting = localStorage.getItem('bitcrm_batch_whatsapp_awaiting_novo_usr_mock_123')
    expect(JSON.parse(savedAwaiting!)).not.toContain('opp_1')
  })

  it('clicar "Não, sem WhatsApp" → estágio Perdido + nota + sessão + badge, sem NUNCA registrar Enviada', async () => {
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

    // Clicar em "Enviar"
    fireEvent.click(screen.getByTestId('btn-send-opp_1'))

    // Clicar em "Não, sem WhatsApp"
    const noBtn = await screen.findByTestId('btn-confirm-no-opp_1')
    fireEvent.click(noBtn)

    // Abre diálogo de confirmação com comentário pré-preenchido
    const dialog = await screen.findByTestId('dialog-mark-lost')
    expect(dialog).toBeDefined()
    expect(dialog.textContent).toContain('Marcar como Perdido — Sem WhatsApp')
    const inputComment = screen.getByTestId('input-lost-comment') as HTMLInputElement
    expect(inputComment.value).toBe('Número não está no WhatsApp')

    // Confirmar marcar como perdido
    const confirmBtn = screen.getByTestId('btn-confirm-mark-lost')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      // 1. Oportunidade é movida para 'Perdido' (e NUNCA para 'Qualificado')
      expect(mockOppUpdate).toHaveBeenCalledWith('opp_1', {
        stage: 'Perdido',
      })
      expect(mockOppUpdate).not.toHaveBeenCalledWith('opp_1', {
        stage: 'Qualificado',
      })

      // 2. Nota criada com type 'outro' e motivo
      expect(mockNoteCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_1',
          type: 'outro',
          text: expect.stringContaining('Número não está no WhatsApp'),
        }),
      )

      // 3. NÃO deve criar nota do tipo 'whatsapp' de envio com sucesso
      const calls = mockNoteCreate.mock.calls
      const hasWhatsappNote = calls.some((c) => c[0]?.type === 'whatsapp')
      expect(hasWhatsappNote).toBe(false)

      // 4. Sessão criada com status 'Perdido'
      expect(mockApproachSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_1',
          status: 'Perdido',
        }),
      )

      // 5. Badge exibida é "Marcada como Perdido (Sem WhatsApp)"
      const lostBadge = screen.getByTestId('status-badge-perdido-opp_1')
      expect(lostBadge).toBeDefined()
      expect(lostBadge.textContent).toContain('Marcada como Perdido (Sem WhatsApp)')

      // 6. NUNCA exibe badge "Enviada"
      expect(screen.queryByTestId('status-badge-enviada-opp_1')).toBeNull()

      // 7. Contador de Perdidos na Sessão é incrementado
      const lostStat = screen.getByTestId('stat-lost-in-session')
      expect(lostStat.textContent).toContain('1')
    })

    // 8. O item NÃO está em enviadas do localStorage e foi removido de aguardando
    const savedSent = localStorage.getItem('bitcrm_batch_whatsapp_sent_novo_usr_mock_123')
    expect(savedSent ? JSON.parse(savedSent) : []).not.toContain('opp_1')

    const savedAwaiting = localStorage.getItem('bitcrm_batch_whatsapp_awaiting_novo_usr_mock_123')
    expect(JSON.parse(savedAwaiting!)).not.toContain('opp_1')
  })

  it('estado "Aguardando confirmação" persiste no localStorage e volta ao reabrir/recarregar', () => {
    // Pré-carrega sessão com opp_1 em aguardando confirmação
    localStorage.setItem(
      'bitcrm_batch_whatsapp_awaiting_novo_usr_mock_123',
      JSON.stringify(['opp_1']),
    )

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

    // O item opp_1 já inicia com o badge "Aguardando confirmação" e caixa de confirmação visível
    const badge = screen.getByTestId('status-badge-aguardando-opp_1')
    expect(badge).toBeDefined()
    expect(badge.textContent).toContain('Aguardando confirmação')

    const confirmBox = screen.getByTestId('confirm-box-opp_1')
    expect(confirmBox.textContent).toContain('O número tem WhatsApp?')
    expect(screen.getByTestId('btn-confirm-yes-opp_1')).toBeDefined()
    expect(screen.getByTestId('btn-confirm-no-opp_1')).toBeDefined()

    // Não consta como Enviada
    expect(screen.queryByTestId('status-badge-enviada-opp_1')).toBeNull()
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

    // Entra em aguardando confirmação
    await waitFor(() => {
      const badgeAwaiting = screen.getByTestId('status-badge-aguardando-opp_qual_1')
      expect(badgeAwaiting).toBeDefined()
      expect(badgeAwaiting.textContent).toContain('Aguardando confirmação')
    })

    // Clica em "Sim, enviado"
    const yesBtn = screen.getByTestId('btn-confirm-yes-opp_qual_1')
    fireEvent.click(yesBtn)

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

  it('exibe ação "Sem WhatsApp" em cada item e abre modal de confirmação com texto padrão', async () => {
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

    // Botão "Sem WhatsApp" existe no item opp_1
    const markLostBtn = screen.getByTestId('btn-mark-lost-opp_1')
    expect(markLostBtn).toBeDefined()
    expect(markLostBtn.textContent).toContain('Sem WhatsApp')

    // Ao clicar, abre o diálogo de confirmação
    fireEvent.click(markLostBtn)

    const dialog = await screen.findByTestId('dialog-mark-lost')
    expect(dialog).toBeDefined()
    expect(dialog.textContent).toContain('Marcar como Perdido — Sem WhatsApp')
    expect(dialog.textContent).toContain('SHEL Lava-rápido')

    // Campo de comentário com sugestão padrão preenchível
    const inputComment = screen.getByTestId('input-lost-comment') as HTMLInputElement
    expect(inputComment.value).toBe('Número não está no WhatsApp')
  })

  it('ao confirmar marcar como perdido: move estágio para Perdido, grava nota na timeline, atualiza o item e contadores', async () => {
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

    // Contadores iniciais
    expect(screen.getByText('Total na Coluna').parentElement?.textContent).toContain('2')

    // Clicar no botão "Sem WhatsApp" do primeiro item
    const markLostBtn = screen.getByTestId('btn-mark-lost-opp_1')
    fireEvent.click(markLostBtn)

    // Personalizar o comentário
    const inputComment = (await screen.findByTestId('input-lost-comment')) as HTMLInputElement
    fireEvent.change(inputComment, {
      target: { value: 'Número não existe no WhatsApp e chamada dá caixa postal' },
    })

    // Confirmar a ação
    const confirmBtn = screen.getByTestId('btn-confirm-mark-lost')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      // 1. Verifica chamada ao update da oportunidade com stage = Perdido
      expect(mockOppUpdate).toHaveBeenCalledWith('opp_1', {
        stage: 'Perdido',
      })

      // 2. Verifica registro de nota na timeline (opportunity_notes) com type outro e motivo
      expect(mockNoteCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_1',
          author: 'usr_mock_123',
          type: 'outro',
          text: expect.stringContaining('Número não existe no WhatsApp e chamada dá caixa postal'),
        }),
      )

      // 3. Verifica registro em approach_sessions com status Perdido
      expect(mockApproachSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          opportunity: 'opp_1',
          seller: 'usr_mock_123',
          status: 'Perdido',
          notes: expect.stringContaining('Número não existe no WhatsApp e chamada dá caixa postal'),
        }),
      )
    })

    // 4. Item agora é marcado claramente como "Marcada como Perdido (Sem WhatsApp)"
    await waitFor(() => {
      const lostBadge = screen.getByTestId('status-badge-perdido-opp_1')
      expect(lostBadge).toBeDefined()
      expect(lostBadge.textContent).toContain('Marcada como Perdido (Sem WhatsApp)')

      // O botão "Enviar" não fica mais disponível para opp_1
      expect(screen.queryByTestId('btn-send-opp_1')).toBeNull()
      // Botão "Sem WhatsApp" também é substituído pelo indicador
      expect(screen.queryByTestId('btn-mark-lost-opp_1')).toBeNull()

      // 5. Contador de Perdidos na Sessão é exibido
      const lostStat = screen.getByTestId('stat-lost-in-session')
      expect(lostStat.textContent).toContain('1')
      expect(lostStat.textContent).toContain('Perdidos na Sessão')

      // Total ativo diminui para 1 (opp_2 continua ativa)
      expect(screen.getByText('Total na Coluna').parentElement?.textContent).toContain('1')

      // Callback notificado para atualizar pipeline de fundo
      expect(handleInteractionLogged).toHaveBeenCalled()
    })
  })
})
