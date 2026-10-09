import React, { useState, useEffect, useMemo, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import type { Opportunity } from '@/types/crm'
import type { PlaybookScript } from '@/types/playbook'
import {
  normalizePhoneForWhatsApp,
  buildBatchWhatsAppMessage,
  buildWhatsAppWebUrl,
  logWhatsAppInteractionToOpportunity,
  formatInteractionDateShort,
  type WhatsAppActionType,
} from '@/lib/whatsappApproachHelper'
import {
  getWhatsAppCloudStatus,
  sendWhatsAppBatchAuto,
  type WhatsAppCloudStatusResponse,
  type WhatsAppBatchSendResponse,
} from '@/services/whatsappCloudService'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Send,
  CheckCircle2,
  Copy,
  AlertTriangle,
  RefreshCw,
  Phone,
  Building,
  UserCheck,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Info,
  Clock,
  ShieldAlert,
  Search,
  PhoneOff,
  XCircle,
  HelpCircle,
  Check,
  Zap,
  ChevronRight,
  ChevronLeft,
  FileText,
  ListOrdered,
  Layers,
  RotateCcw,
  SkipForward,
} from 'lucide-react'

export interface BatchWhatsAppModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  stage: 'Novo' | 'Qualificado'
  actionType: WhatsAppActionType
  /** Lista de todas as oportunidades da coluna no escopo do usuário */
  opportunities: Opportunity[]
  currentUserId?: string
  currentUserName?: string
  onInteractionLogged?: () => void
}

interface InteractionSummary {
  hasInitial: boolean
  hasFollowup: boolean
  lastDate?: string
  totalNotes: number
}

const STORAGE_KEY_PREFIX = 'bitcrm_batch_whatsapp_sent_'
const STORAGE_KEY_AWAITING_PREFIX = 'bitcrm_batch_whatsapp_awaiting_'
const STORAGE_KEY_SKIPPED_PREFIX = 'bitcrm_batch_whatsapp_skipped_'

export function BatchWhatsAppModal({
  open,
  onOpenChange,
  stage,
  actionType,
  opportunities,
  currentUserId,
  currentUserName,
  onInteractionLogged,
}: BatchWhatsAppModalProps) {
  const { toast } = useToast()

  // Chaves de persistência no localStorage
  const sessionKey = useMemo(() => {
    return `${STORAGE_KEY_PREFIX}${stage.toLowerCase()}_${currentUserId || 'default'}`
  }, [stage, currentUserId])

  const awaitingKey = useMemo(() => {
    return `${STORAGE_KEY_AWAITING_PREFIX}${stage.toLowerCase()}_${currentUserId || 'default'}`
  }, [stage, currentUserId])

  const skippedKey = useMemo(() => {
    return `${STORAGE_KEY_SKIPPED_PREFIX}${stage.toLowerCase()}_${currentUserId || 'default'}`
  }, [stage, currentUserId])

  // IDs das oportunidades enviadas nesta sessão (já confirmadas como "Sim, enviado")
  const [sessionSentIds, setSessionSentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(sessionKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // IDs das oportunidades aguardando confirmação ("O número tem WhatsApp?")
  const [awaitingConfirmationIds, setAwaitingConfirmationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(awaitingKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // IDs das oportunidades puladas manualmente na fila
  const [skippedIds, setSkippedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(skippedKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sincronizar sessionSentIds com localStorage
  useEffect(() => {
    try {
      localStorage.setItem(sessionKey, JSON.stringify(sessionSentIds))
    } catch {
      /* ignore */
    }
  }, [sessionSentIds, sessionKey])

  // Sincronizar awaitingConfirmationIds com localStorage
  useEffect(() => {
    try {
      localStorage.setItem(awaitingKey, JSON.stringify(awaitingConfirmationIds))
    } catch {
      /* ignore */
    }
  }, [awaitingConfirmationIds, awaitingKey])

  // Sincronizar skippedIds com localStorage
  useEffect(() => {
    try {
      localStorage.setItem(skippedKey, JSON.stringify(skippedIds))
    } catch {
      /* ignore */
    }
  }, [skippedIds, skippedKey])

  // Scripts carregados do banco (playbook_scripts)
  const [scripts, setScripts] = useState<PlaybookScript[]>([])
  const [activeScript, setActiveScript] = useState<PlaybookScript | null>(null)
  const [loadingScripts, setLoadingScripts] = useState(false)
  const [scriptLoadError, setScriptLoadError] = useState<string | null>(null)

  // Mapa de notas por oportunidade: opportunityId -> InteractionSummary
  const [notesSummary, setNotesSummary] = useState<Record<string, InteractionSummary>>({})
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [notesLoadError, setNotesLoadError] = useState<string | null>(null)

  // Filtro de busca interna
  const [searchTerm, setSearchTerm] = useState('')

  // Oportunidade com confirmação pendente de reenvio
  const [confirmResendOpp, setConfirmResendOpp] = useState<Opportunity | null>(null)

  // Oportunidades marcadas como perdidas durante a sessão atual
  const [lostOppIds, setLostOppIds] = useState<string[]>([])

  // Modal / diálogo para marcar oportunidade como perdida (Sem WhatsApp)
  const [markLostOpp, setMarkLostOpp] = useState<Opportunity | null>(null)
  const [markLostComment, setMarkLostComment] = useState('Número não está no WhatsApp')
  const [savingLost, setSavingLost] = useState(false)

  // Estado de envio ou confirmação em andamento
  const [sendingOppId, setSendingOppId] = useState<string | null>(null)
  const [confirmingOppId, setConfirmingOppId] = useState<string | null>(null)

  // Modo de visualização: 'list' (geral) ou 'queue' (Fila de Envio Assistido)
  const [viewMode, setViewMode] = useState<'list' | 'queue'>('list')
  // Índice atual na fila de envio assistido
  const [queueIndex, setQueueIndex] = useState(0)

  // Relatório da Leva ao finalizar a sessão
  const [showReportDialog, setShowReportDialog] = useState(false)
  const [reportCopied, setReportCopied] = useState(false)

  // FASE 2: Estado de integração com Meta WhatsApp Cloud API
  const [cloudStatus, setCloudStatus] = useState<WhatsAppCloudStatusResponse | null>(null)
  const [loadingCloudStatus, setLoadingCloudStatus] = useState(false)
  const [templateInputName, setTemplateInputName] = useState('')
  const [autoSending, setAutoSending] = useState(false)
  const [autoBatchResult, setAutoBatchResult] = useState<WhatsAppBatchSendResponse | null>(null)
  const [showAutoResultModal, setShowAutoResultModal] = useState(false)

  // Carregar status do WhatsApp Cloud API
  const fetchCloudStatus = useCallback(async () => {
    setLoadingCloudStatus(true)
    try {
      const res = await getWhatsAppCloudStatus()
      setCloudStatus(res)
      if (res.settings) {
        if (actionType === 'initial' && res.settings.initialTemplateName) {
          setTemplateInputName(res.settings.initialTemplateName)
        } else if (actionType === 'followup' && res.settings.followupTemplateName) {
          setTemplateInputName(res.settings.followupTemplateName)
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar status do Cloud API:', err)
    } finally {
      setLoadingCloudStatus(false)
    }
  }, [actionType])

  // Carregar scripts do Playbook no banco
  const fetchScripts = useCallback(async () => {
    setLoadingScripts(true)
    setScriptLoadError(null)
    try {
      const records = await pb.collection('playbook_scripts').getFullList<PlaybookScript>({
        filter: 'is_active = true',
        sort: 'display_order',
      })
      setScripts(records)

      if (actionType === 'initial') {
        const found =
          records.find(
            (s) => s.channel === 'WhatsApp' && s.title.toLowerCase().includes('primeira'),
          ) ||
          records.find((s) => s.channel === 'WhatsApp') ||
          records[0] ||
          null
        setActiveScript(found)
      } else {
        const found =
          records.find(
            (s) =>
              s.channel === 'WhatsApp' &&
              (s.title.toLowerCase().includes('follow') ||
                s.situation.toLowerCase().includes('continuação')),
          ) ||
          records.find((s) => s.channel === 'Retorno') ||
          records.find((s) => s.channel === 'WhatsApp') ||
          records[0] ||
          null
        setActiveScript(found)
      }
    } catch (err) {
      console.error('Erro ao carregar scripts do playbook:', err)
      setScriptLoadError('Falha ao carregar scripts do Playbook Comercial.')
    } finally {
      setLoadingScripts(false)
    }
  }, [actionType])

  // Carregar histórico de notas/interações das oportunidades desta coluna
  const fetchNotesHistory = useCallback(async () => {
    if (opportunities.length === 0) {
      setNotesSummary({})
      return
    }

    setLoadingNotes(true)
    setNotesLoadError(null)
    try {
      const oppIds = opportunities.map((o) => o.id)
      const filterExpr = oppIds.map((id) => `opportunity = "${id}"`).join(' || ')

      const notes = await pb.collection('opportunity_notes').getFullList<{
        id: string
        opportunity: string
        type: string
        text: string
        date: string
      }>({
        filter: filterExpr,
        sort: '-date,-created',
      })

      const map: Record<string, InteractionSummary> = {}
      for (const id of oppIds) {
        map[id] = {
          hasInitial: false,
          hasFollowup: false,
          totalNotes: 0,
        }
      }

      for (const n of notes) {
        const summary = map[n.opportunity]
        if (!summary) continue
        summary.totalNotes += 1

        const lowerText = (n.text || '').toLowerCase()
        const isWhatsapp = n.type === 'whatsapp'

        if (
          lowerText.includes('[whatsapp inicial]') ||
          lowerText.includes('mensagem inicial via whatsapp') ||
          lowerText.includes('mensagem de abertura')
        ) {
          summary.hasInitial = true
        }

        if (
          lowerText.includes('[whatsapp follow-up]') ||
          lowerText.includes('follow-up via whatsapp') ||
          lowerText.includes('continuação') ||
          lowerText.includes('retomando')
        ) {
          summary.hasFollowup = true
        }

        if (!summary.lastDate && (n.date || isWhatsapp)) {
          summary.lastDate = n.date
        }
      }

      setNotesSummary(map)
    } catch (err) {
      console.error('Erro ao carregar interações da timeline:', err)
      setNotesLoadError('Não foi possível verificar o histórico de interações na timeline.')
    } finally {
      setLoadingNotes(false)
    }
  }, [opportunities])

  useEffect(() => {
    if (open) {
      fetchScripts()
      fetchNotesHistory()
      fetchCloudStatus()
    }
  }, [open, fetchScripts, fetchNotesHistory, fetchCloudStatus])

  // Oportunidades com mensagens calculadas
  const itemsWithMessages = useMemo(() => {
    return opportunities.map((opp) => {
      const summary = notesSummary[opp.id] || {
        hasInitial: false,
        hasFollowup: false,
        totalNotes: 0,
      }

      const formattedLastDate = formatInteractionDateShort(summary.lastDate)

      const message = buildBatchWhatsAppMessage({
        actionType,
        scriptTemplate: activeScript?.script_text,
        opportunity: opp,
        sellerName: currentUserName || 'Consultor Comercial',
        lastInteractionDate: formattedLastDate || null,
      })

      const phoneNormalized = normalizePhoneForWhatsApp(opp.contact_phone)
      const hasPhone = Boolean(phoneNormalized)

      const isAlreadyApproached =
        actionType === 'initial' ? summary.hasInitial : summary.hasFollowup

      const isSentInSession = sessionSentIds.includes(opp.id)
      const isLost = lostOppIds.includes(opp.id) || opp.stage === 'Perdido'
      const isAwaitingConfirmation =
        awaitingConfirmationIds.includes(opp.id) && !isSentInSession && !isLost
      const isSkipped = skippedIds.includes(opp.id) && !isSentInSession && !isLost

      return {
        opp,
        message,
        phoneNormalized,
        hasPhone,
        isAlreadyApproached,
        isSentInSession,
        isAwaitingConfirmation,
        isSkipped,
        isLost,
        summary,
        lastInteractionDate: formattedLastDate,
      }
    })
  }, [
    opportunities,
    notesSummary,
    actionType,
    activeScript,
    currentUserName,
    sessionSentIds,
    awaitingConfirmationIds,
    skippedIds,
    lostOppIds,
  ])

  // Filtragem local por termo de busca
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return itemsWithMessages
    const q = searchTerm.toLowerCase().trim()
    return itemsWithMessages.filter((item) => {
      return (
        item.opp.company.toLowerCase().includes(q) ||
        (item.opp.contact_name && item.opp.contact_name.toLowerCase().includes(q)) ||
        (item.opp.contact_phone && item.opp.contact_phone.includes(q)) ||
        (item.opp.city && item.opp.city.toLowerCase().includes(q))
      )
    })
  }, [itemsWithMessages, searchTerm])

  // Lista de itens para a Fila de Envio (itera sobre itens que têm telefone e não foram perdidos)
  const queueItems = useMemo(() => {
    return itemsWithMessages.filter((i) => !i.isLost)
  }, [itemsWithMessages])

  // Contadores do topo e do relatório da leva
  const stats = useMemo(() => {
    const activeItems = itemsWithMessages.filter((i) => !i.isLost)
    const total = activeItems.length
    const withPhone = activeItems.filter((i) => i.hasPhone).length
    const noPhone = activeItems.filter((i) => !i.hasPhone).length
    const alreadyApproached = activeItems.filter((i) => i.isAlreadyApproached).length
    const sentInSession = activeItems.filter((i) => i.isSentInSession).length
    const lostInSession = itemsWithMessages.filter((i) => i.isLost).length
    const skippedInSession = activeItems.filter((i) => i.isSkipped).length
    const awaitingInSession = activeItems.filter((i) => i.isAwaitingConfirmation).length

    // Ações restantes na fila: itens com telefone que ainda não foram enviados nem perdidos
    const pendingActionable = activeItems.filter(
      (i) => i.hasPhone && !i.isSentInSession && !i.isLost,
    ).length

    return {
      total,
      withPhone,
      noPhone,
      alreadyApproached,
      sentInSession,
      lostInSession,
      skippedInSession,
      awaitingInSession,
      pendingActionable,
    }
  }, [itemsWithMessages])

  // Encontrar próximo item acionável na fila a partir de um índice
  const findNextActionableIndex = useCallback(
    (startIndex: number): number => {
      if (queueItems.length === 0) return 0
      for (let i = startIndex; i < queueItems.length; i++) {
        const item = queueItems[i]
        if (item.hasPhone && !item.isSentInSession && !item.isLost) {
          return i
        }
      }
      // Se não encontrou do startIndex em diante, tenta do início
      for (let i = 0; i < startIndex; i++) {
        const item = queueItems[i]
        if (item.hasPhone && !item.isSentInSession && !item.isLost) {
          return i
        }
      }
      return startIndex < queueItems.length ? startIndex : 0
    },
    [queueItems],
  )

  // Item ativo da fila de envio
  const currentQueueItem = useMemo(() => {
    if (queueItems.length === 0) return null
    const safeIdx = Math.max(0, Math.min(queueIndex, queueItems.length - 1))
    return queueItems[safeIdx] || null
  }, [queueItems, queueIndex])

  // Disparo assistido wa.me (coloca em "Aguardando confirmação")
  const executeSend = (item: (typeof itemsWithMessages)[0]) => {
    if (!item.hasPhone) {
      toast({
        title: 'Sem telefone cadastrado',
        description: `A oportunidade "${item.opp.company}" não possui telefone válido para WhatsApp.`,
        variant: 'destructive',
      })
      return
    }

    try {
      const url = buildWhatsAppWebUrl(item.phoneNormalized, item.message)
      window.open(url, '_blank', 'noopener,noreferrer')

      setAwaitingConfirmationIds((prev) =>
        prev.includes(item.opp.id) ? prev : [...prev, item.opp.id],
      )

      toast({
        title: 'WhatsApp aberto!',
        description: `Verifique se o número de "${item.opp.company}" possui WhatsApp para confirmar.`,
      })
    } catch (err) {
      console.error('Erro ao abrir WhatsApp:', err)
      toast({
        title: 'Erro ao abrir WhatsApp',
        description: 'Não foi possível abrir o link do WhatsApp.',
        variant: 'destructive',
      })
    }
  }

  // Avançar fila automaticamente após confirmação
  const advanceQueueAfterAction = useCallback(
    (currentOppId: string) => {
      // Procura o próximo item na fila que ainda não foi enviado nem perdido
      const currentIdx = queueItems.findIndex((q) => q.opp.id === currentOppId)
      const nextIdx = findNextActionableIndex(currentIdx + 1)
      setQueueIndex(nextIdx)

      // Se todas as acionáveis foram concluídas, sugere relatório
      const remaining = queueItems.filter(
        (q) => q.opp.id !== currentOppId && q.hasPhone && !q.isSentInSession && !q.isLost,
      ).length
      if (remaining === 0) {
        setShowReportDialog(true)
      }
    },
    [queueItems, findNextActionableIndex],
  )

  // Confirmar pós-envio: "Sim, enviado"
  const handleConfirmSentYes = async (item: (typeof itemsWithMessages)[0]) => {
    setConfirmingOppId(item.opp.id)
    try {
      const effectiveUserId = currentUserId || pb.authStore.record?.id || ''

      await logWhatsAppInteractionToOpportunity({
        opportunityId: item.opp.id,
        authorId: effectiveUserId,
        message: item.message,
        phone: item.opp.contact_phone,
        actionType,
        opportunityDetails: {
          company: item.opp.company,
          contact_name: item.opp.contact_name,
          contact_phone: item.opp.contact_phone,
          city: item.opp.city,
          stage: item.opp.stage,
        },
      })

      setAwaitingConfirmationIds((prev) => prev.filter((id) => id !== item.opp.id))
      setSessionSentIds((prev) => (prev.includes(item.opp.id) ? prev : [...prev, item.opp.id]))
      // Remove de pulados se estiver
      setSkippedIds((prev) => prev.filter((id) => id !== item.opp.id))

      setNotesSummary((prev) => ({
        ...prev,
        [item.opp.id]: {
          hasInitial: actionType === 'initial' ? true : prev[item.opp.id]?.hasInitial || false,
          hasFollowup: actionType === 'followup' ? true : prev[item.opp.id]?.hasFollowup || false,
          lastDate: new Date().toISOString(),
          totalNotes: (prev[item.opp.id]?.totalNotes || 0) + 1,
        },
      }))

      toast({
        title: 'Envio confirmado com sucesso!',
        description: `Interação registrada na timeline de "${item.opp.company}".`,
      })

      onInteractionLogged?.()

      // Fila: avançar automaticamente para o próximo
      advanceQueueAfterAction(item.opp.id)
    } catch (err) {
      console.error('Erro ao confirmar envio:', err)
      toast({
        title: 'Erro ao registrar interação',
        description: 'Não foi possível salvar a interação na timeline.',
        variant: 'destructive',
      })
    } finally {
      setConfirmingOppId(null)
    }
  }

  // Confirmar pós-envio: "Não, sem WhatsApp"
  const handleConfirmSentNo = (item: (typeof itemsWithMessages)[0]) => {
    handleOpenMarkLost(item.opp)
  }

  // Clicou no botão Enviar de um card
  const handleItemSendClick = (item: (typeof itemsWithMessages)[0]) => {
    if (item.isAlreadyApproached || item.isSentInSession) {
      setConfirmResendOpp(item.opp)
      return
    }
    executeSend(item)
  }

  // Pular item atual na fila
  const handleSkipCurrent = (item: (typeof itemsWithMessages)[0]) => {
    setSkippedIds((prev) => (prev.includes(item.opp.id) ? prev : [...prev, item.opp.id]))
    const currentIdx = queueItems.findIndex((q) => q.opp.id === item.opp.id)
    const nextIdx = findNextActionableIndex(currentIdx + 1)
    setQueueIndex(nextIdx)
    toast({
      title: 'Item pulado',
      description: `Avançando para a próxima oportunidade. "${item.opp.company}" pode ser retomada depois.`,
    })
  }

  // Abrir diálogo de "Sem WhatsApp / Marcar como perdido"
  const handleOpenMarkLost = (opp: Opportunity) => {
    setMarkLostOpp(opp)
    setMarkLostComment('Número não está no WhatsApp')
  }

  // Confirmar marcação como perdido
  const handleConfirmMarkLost = async () => {
    if (!markLostOpp) return
    const oppToMark = markLostOpp
    const commentText = markLostComment.trim() || 'Número não está no WhatsApp'
    const effectiveUserId = currentUserId || pb.authStore.record?.id || ''

    setSavingLost(true)
    try {
      const previousStage = oppToMark.stage

      await pb.collection('opportunities').update(oppToMark.id, {
        stage: 'Perdido',
      })

      if (effectiveUserId) {
        const fullNote = `[Sem WhatsApp / Perdido] Estágio alterado de "${previousStage}" para "Perdido". Motivo: ${commentText}`
        await pb.collection('opportunity_notes').create({
          opportunity: oppToMark.id,
          author: effectiveUserId,
          type: 'outro',
          text: fullNote,
          date: new Date().toISOString(),
        })

        try {
          await pb.collection('approach_sessions').create({
            seller: effectiveUserId,
            opportunity: oppToMark.id,
            company_name: oppToMark.company,
            contact_name: oppToMark.contact_name || '',
            contact_phone: oppToMark.contact_phone || '',
            city: oppToMark.city || '',
            channel: 'WhatsApp',
            status: 'Perdido',
            temperature: 'frio',
            temperature_reason: 'Número sem WhatsApp / contato inválido',
            notes: `[Disparo WhatsApp] Oportunidade dada como perdida direto do painel de disparo. Motivo: ${commentText}`,
            questions_asked: [],
            answers: [],
            objections: ['Número não possui WhatsApp'],
            quick_tags: ['Sem WhatsApp', 'Perdido no disparo'],
          })
        } catch (sessionErr) {
          console.warn('Erro ao registrar sessão em approach_sessions:', sessionErr)
        }
      }

      setAwaitingConfirmationIds((prev) => prev.filter((id) => id !== oppToMark.id))
      setLostOppIds((prev) => (prev.includes(oppToMark.id) ? prev : [...prev, oppToMark.id]))

      toast({
        title: 'Oportunidade marcada como Perdida',
        description: `"${oppToMark.company}" foi movida para Perdido e o motivo registrado na timeline.`,
      })

      setMarkLostOpp(null)
      onInteractionLogged?.()

      // Avançar na fila
      advanceQueueAfterAction(oppToMark.id)
    } catch (err) {
      console.error('Erro ao marcar oportunidade como perdida:', err)
      toast({
        title: 'Erro ao marcar como perdido',
        description: 'Não foi possível atualizar a oportunidade. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setSavingLost(false)
    }
  }

  // FASE 1 item 2: Botão "Copiar todas as mensagens" aprimorado
  // Copiar o texto agrupado por oportunidade (empresa + contato + mensagem), um bloco por oportunidade
  const handleCopyAllGrouped = async () => {
    const textAll = itemsWithMessages
      .map((item, idx) => {
        const phone = item.opp.contact_phone || 'Sem telefone'
        const contact = item.opp.contact_name ? ` · Contato: ${item.opp.contact_name}` : ''
        const city = item.opp.city ? ` · ${item.opp.city}` : ''
        return `══════════════════════════════════════════════════════════════════════
[#${idx + 1}/${itemsWithMessages.length}] EMPRESA: ${item.opp.company}${contact} (${phone}${city})
══════════════════════════════════════════════════════════════════════
${item.message}`
      })
      .join('\n\n\n')

    try {
      await navigator.clipboard.writeText(textAll)
      toast({
        title: 'Mensagens agrupadas copiadas!',
        description: `Todas as ${itemsWithMessages.length} mensagens foram copiadas em blocos estruturados para colagem em sequência.`,
      })
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar para a área de transferência.',
        variant: 'destructive',
      })
    }
  }

  // Copiar mensagem única
  const handleCopySingle = async (text: string, company: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: 'Mensagem copiada!',
        description: `Texto personalizado de "${company}" copiado.`,
      })
    } catch {
      toast({
        title: 'Erro ao copiar',
        variant: 'destructive',
      })
    }
  }

  // Texto consolidado do Relatório da Leva
  const reportText = useMemo(() => {
    const stageName = stage
    const actionLabel = actionType === 'initial' ? 'Abordagem Inicial' : 'Follow-up WhatsApp'
    const dateStr = new Date().toLocaleString('pt-BR')
    const seller = currentUserName || 'Consultor Comercial'

    const sentCompanies = itemsWithMessages
      .filter((i) => i.isSentInSession)
      .map((i) => `  • ${i.opp.company} (${i.opp.contact_phone || 'sem tel'})`)
      .join('\n')

    const lostCompanies = itemsWithMessages
      .filter((i) => i.isLost)
      .map((i) => `  • ${i.opp.company} (Sem WhatsApp)`)
      .join('\n')

    const noPhoneCompanies = itemsWithMessages
      .filter((i) => !i.hasPhone && !i.isLost)
      .map((i) => `  • ${i.opp.company}`)
      .join('\n')

    const skippedCompanies = itemsWithMessages
      .filter((i) => i.isSkipped && !i.isSentInSession)
      .map((i) => `  • ${i.opp.company}`)
      .join('\n')

    return `📊 RELATÓRIO DA LEVA — ${actionLabel.toUpperCase()}
Coluna: ${stageName}
Data/Hora: ${dateStr}
Vendedor: ${seller}

RESUMO NUMÉRICO:
• Total na Coluna: ${stats.total}
• Enviadas nesta sessão: ${stats.sentInSession}
• Marcadas como Perdido (sem WhatsApp): ${stats.lostInSession}
• Sem telefone cadastrado: ${stats.noPhone}
• Já abordadas anteriormente: ${stats.alreadyApproached}
• Puladas na fila: ${stats.skippedInSession}

${sentCompanies ? `\n✅ OPORTUNIDADES ENVIADAS (${stats.sentInSession}):\n${sentCompanies}` : ''}
${lostCompanies ? `\n❌ MARCADAS COMO PERDIDO (${stats.lostInSession}):\n${lostCompanies}` : ''}
${noPhoneCompanies ? `\n⚠️ SEM TELEFONE (${stats.noPhone}):\n${noPhoneCompanies}` : ''}
${skippedCompanies ? `\n⏭️ PULADAS NA SESSÃO (${stats.skippedInSession}):\n${skippedCompanies}` : ''}

bit Consulting CRM · bitCRM`
  }, [stage, actionType, currentUserName, stats, itemsWithMessages])

  // Copiar relatório da leva
  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText)
      setReportCopied(true)
      toast({
        title: 'Relatório copiado!',
        description: 'Resumo da leva copiado para a área de transferência.',
      })
      setTimeout(() => setReportCopied(false), 3000)
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o relatório.',
        variant: 'destructive',
      })
    }
  }

  // Limpar histórico da sessão atual
  const handleResetSession = () => {
    if (confirm('Deseja reiniciar a contagem de disparos desta sessão?')) {
      setSessionSentIds([])
      setAwaitingConfirmationIds([])
      setSkippedIds([])
      try {
        localStorage.removeItem(sessionKey)
        localStorage.removeItem(awaitingKey)
        localStorage.removeItem(skippedKey)
      } catch {
        /* intentionally ignored */
      }
      setQueueIndex(0)
      toast({
        title: 'Sessão reiniciada',
        description: 'O contador de disparos e confirmações pendentes desta sessão foram zerados.',
      })
    }
  }

  // FASE 2: Envio automático em lote via WhatsApp Cloud API
  const handleSendAllAutomatic = async (retryFailedOnly = false) => {
    if (!cloudStatus?.configured) {
      toast({
        title: 'Integração não configurada',
        description:
          'As credenciais da WhatsApp Cloud API não foram adicionadas aos segredos do backend.',
        variant: 'destructive',
      })
      return
    }

    // Abordagem inicial exige template
    if (actionType === 'initial' && !templateInputName.trim()) {
      toast({
        title: 'Template obrigatório',
        description: 'Informe o nome do modelo aprovado pela Meta para Abordagem Inicial.',
        variant: 'destructive',
      })
      return
    }

    // IDs elegíveis para disparo
    let targetOppIds: string[] = []
    if (retryFailedOnly && autoBatchResult) {
      targetOppIds = autoBatchResult.results
        .filter((r) => r.status === 'failed')
        .map((r) => r.opportunityId)
    } else {
      // Dispara todas que têm telefone e ainda não foram enviadas na sessão nem marcadas como perdidas
      targetOppIds = itemsWithMessages
        .filter((i) => i.hasPhone && !i.isSentInSession && !i.isLost)
        .map((i) => i.opp.id)
    }

    if (targetOppIds.length === 0) {
      toast({
        title: 'Nenhuma oportunidade elegível',
        description: 'Não há oportunidades pendentes com telefone válido para envio automático.',
      })
      return
    }

    setAutoSending(true)
    try {
      const res = await sendWhatsAppBatchAuto({
        actionType,
        opportunityIds: targetOppIds,
        templateName: templateInputName.trim(),
        templateLanguage: cloudStatus.settings?.initialTemplateLanguage || 'pt_BR',
      })

      setAutoBatchResult(res)
      setShowAutoResultModal(true)

      // Atualiza sessionSentIds para as que tiveram sucesso
      const newlySent = res.results.filter((r) => r.status === 'sent').map((r) => r.opportunityId)
      if (newlySent.length > 0) {
        setSessionSentIds((prev) => Array.from(new Set([...prev, ...newlySent])))
        setAwaitingConfirmationIds((prev) => prev.filter((id) => !newlySent.includes(id)))
        setSkippedIds((prev) => prev.filter((id) => !newlySent.includes(id)))
        onInteractionLogged?.()
      }

      toast({
        title: `Lote processado: ${res.sentCount} enviada(s), ${res.failedCount} falha(s)`,
        description:
          res.failedCount > 0
            ? 'Verifique os motivos de falha no painel de resultados.'
            : 'Todas as mensagens foram enviadas com sucesso via WhatsApp Cloud API!',
      })
    } catch (err: unknown) {
      console.error('Erro no disparo automático:', err)
      const msg = err instanceof Error ? err.message : 'Falha ao processar disparo em lote.'
      toast({
        title: 'Erro no disparo automático',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setAutoSending(false)
    }
  }

  const isInitial = actionType === 'initial'
  const title = isInitial
    ? 'Enviar Abordagem Inicial (WhatsApp) — Coluna Novo'
    : 'Mensagem de Continuação (Follow-up) — Coluna Qualificado'

  const subtitle = isInitial
    ? 'Disparo assistido em lote e fila guiada para novos leads. Abre o WhatsApp com a mensagem pronta e registra na timeline.'
    : 'Retomada comercial para leads qualificados. Gera mensagem de continuidade baseada no Playbook e registra na timeline.'

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-4xl max-h-[92vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl p-0 gap-0">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 border-b border-[#262A33] bg-[#0E1017] space-y-2">
            <div className="flex items-start justify-between gap-3 pr-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                      isInitial
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    {isInitial ? 'Abordagem Inicial' : 'Follow-up / Continuação'}
                  </span>
                  <span className="text-[11px] text-gray-400 bg-[#171A24] px-2 py-0.5 rounded-full border border-[#262A33]">
                    Coluna: <strong className="text-white">{stage}</strong>
                  </span>

                  {/* Badges de Modo e Integração Cloud API */}
                  {cloudStatus?.configured ? (
                    <span
                      data-testid="badge-cloud-api-active"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 uppercase"
                      title="WhatsApp Cloud API conectada via secrets do backend"
                    >
                      <Zap className="w-3 h-3 text-emerald-400" />
                      Cloud API Ativa ({cloudStatus.phoneNumberIdMasked})
                    </span>
                  ) : (
                    <span
                      data-testid="badge-cloud-api-standby"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700"
                      title="Cloud API pronta para ativação automática assim que as credenciais forem cadastradas nos secrets"
                    >
                      <Info className="w-3 h-3 text-indigo-400" />
                      Fase 1 Assistida Ativa (Fase 2 Pronta)
                    </span>
                  )}
                </div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {title}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400 leading-relaxed">
                  {subtitle}
                </DialogDescription>
              </div>
            </div>

            {/* Contadores no topo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase font-medium">
                    Total na Coluna
                  </span>
                  <span className="text-base font-bold text-white tabular-nums">{stats.total}</span>
                </div>
                <Building className="w-4 h-4 text-gray-500" />
              </div>

              <div className="p-2.5 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 block uppercase font-medium">
                    Com Telefone
                  </span>
                  <span className="text-base font-bold text-emerald-300 tabular-nums">
                    {stats.withPhone}
                  </span>
                </div>
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>

              <div className="p-2.5 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 block uppercase font-medium">
                    Já Abordadas
                  </span>
                  <span className="text-base font-bold text-amber-300 tabular-nums">
                    {stats.alreadyApproached}
                  </span>
                </div>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>

              <div className="p-2.5 rounded-xl bg-[#12141A] border border-blue-500/40 bg-blue-950/25 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-blue-300 block uppercase font-medium">
                    Enviadas na Sessão
                  </span>
                  <span className="text-base font-bold text-blue-200 tabular-nums">
                    {stats.sentInSession}
                  </span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
              </div>

              {stats.lostInSession > 0 ? (
                <div
                  data-testid="stat-lost-in-session"
                  className="col-span-2 sm:col-span-4 lg:col-span-1 p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-center justify-between"
                >
                  <div>
                    <span className="text-[10px] text-rose-300 block uppercase font-medium">
                      Perdidos na Sessão
                    </span>
                    <span className="text-base font-bold text-rose-200 tabular-nums">
                      {stats.lostInSession}
                    </span>
                  </div>
                  <XCircle className="w-4 h-4 text-rose-400" />
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-indigo-400 block uppercase font-medium">
                      Pendentes Ação
                    </span>
                    <span className="text-base font-bold text-indigo-200 tabular-nums">
                      {stats.pendingActionable}
                    </span>
                  </div>
                  <MessageSquare className="w-4 h-4 text-indigo-400" />
                </div>
              )}
            </div>

            {/* Alternância de Modo (Lista Geral vs. Fila de Envio Assistido) + Ações do Topo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#262A33]/70">
              {/* Botões de alternância de modo */}
              <div className="flex items-center gap-1.5 p-1 bg-[#12141A] border border-[#262A33] rounded-xl self-start sm:self-auto">
                <button
                  type="button"
                  data-testid="tab-view-list"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                    viewMode === 'list'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Visão Geral ({itemsWithMessages.length})
                </button>
                <button
                  type="button"
                  data-testid="tab-view-queue"
                  onClick={() => {
                    setViewMode('queue')
                    // Ajusta para o primeiro item acionável se o atual já estiver enviado
                    if (currentQueueItem?.isSentInSession || currentQueueItem?.isLost) {
                      setQueueIndex(findNextActionableIndex(0))
                    }
                  }}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                    viewMode === 'queue'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  Modo Fila de Envio
                  {stats.pendingActionable > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/60 text-indigo-200 border border-indigo-400/40">
                      {stats.pendingActionable}
                    </span>
                  )}
                </button>
              </div>

              {/* Ações da Barra: Copiar todas, Relatório, Reset e Envio Automático */}
              <div className="flex flex-wrap items-center gap-2">
                {stats.sentInSession > 0 && (
                  <button
                    type="button"
                    onClick={handleResetSession}
                    className="text-[11px] text-gray-400 hover:text-white underline transition-colors"
                    title="Zerar progresso salvo desta sessão"
                  >
                    Resetar sessão ({stats.sentInSession})
                  </button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="btn-copy-all-grouped"
                  onClick={handleCopyAllGrouped}
                  disabled={itemsWithMessages.length === 0}
                  className="h-8 text-xs border-[#262A33] bg-[#12141A] text-gray-300 hover:text-white hover:bg-[#181B24] rounded-xl font-medium"
                  title="Copiar todas as mensagens agrupadas por oportunidade (empresa + contato + mensagem) para colagem rápida"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                  Copiar todas as mensagens
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-testid="btn-open-session-report"
                  onClick={() => setShowReportDialog(true)}
                  className="h-8 text-xs border-indigo-500/30 bg-indigo-950/20 text-indigo-300 hover:text-white hover:bg-indigo-900/40 rounded-xl font-medium"
                  title="Visualizar o relatório consolidado da leva atual"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                  Relatório da Leva
                </Button>
              </div>
            </div>

            {/* SEÇÃO FASE 2: Envio Automático via WhatsApp Cloud API (Visível se configurado ou mostra status informativo) */}
            {cloudStatus?.configured ? (
              <div
                data-testid="panel-cloud-api-configured"
                className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">
                      Envio Automático Oficial — WhatsApp Cloud API
                    </span>
                    <span className="text-[10px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Disparo no Servidor
                    </span>
                  </div>
                  {isInitial && (
                    <div className="flex items-center gap-2 text-xs">
                      <label className="text-gray-300 text-[11px] font-medium shrink-0">
                        Template Meta aprovado:
                      </label>
                      <input
                        type="text"
                        data-testid="input-cloud-template-name"
                        value={templateInputName}
                        onChange={(e) => setTemplateInputName(e.target.value)}
                        placeholder="Ex: bit_abordagem_inicial"
                        className="px-2.5 py-1 text-xs bg-[#0E1017] border border-[#262A33] rounded-lg text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>

                <Button
                  type="button"
                  size="sm"
                  data-testid="btn-send-all-auto"
                  disabled={
                    autoSending ||
                    stats.pendingActionable === 0 ||
                    (isInitial && !templateInputName.trim())
                  }
                  onClick={() => handleSendAllAutomatic(false)}
                  className="h-8 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 px-3.5 shrink-0"
                  title={
                    isInitial && !templateInputName.trim()
                      ? 'Informe o template aprovado pela Meta para habilitar'
                      : 'Enviar todas as oportunidades pendentes em lote no servidor'
                  }
                >
                  {autoSending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Disparando lote...
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      Enviar todos de uma vez ({stats.pendingActionable})
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div
                data-testid="banner-cloud-api-not-configured"
                className="p-2.5 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between gap-3 text-[11px] text-gray-400"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>
                    <strong>WhatsApp Cloud API:</strong> Integração ainda não configurada nos
                    segredos. O sistema opera na <strong>Fase 1 (Fila Assistida Oficial)</strong> e
                    ativará o botão <em>&quot;Enviar todos de uma vez&quot;</em> automaticamente
                    assim que as credenciais forem cadastradas.
                  </span>
                </div>
              </div>
            )}

            {/* Barra de busca de oportunidade (apenas no modo lista geral) */}
            {viewMode === 'list' && (
              <div className="relative pt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filtrar por empresa, contato, cidade ou telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#12141A] border border-[#262A33] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/60"
                />
              </div>
            )}
          </DialogHeader>

          {/* Banner de erro com retry caso falhe o carregamento */}
          {(scriptLoadError || notesLoadError) && (
            <div className="p-3 bg-red-950/40 border-b border-red-500/40 text-red-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{scriptLoadError || notesLoadError}</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  fetchScripts()
                  fetchNotesHistory()
                  fetchCloudStatus()
                }}
                className="h-7 text-xs border-red-500/50 bg-red-900/30 text-white hover:bg-red-900/50"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* CORPO: MODO FILA DE ENVIO ASSISTIDO (FASE 1 - ITEM 1) */}
          {viewMode === 'queue' && (
            <div
              data-testid="queue-view-container"
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar bg-[#0A0C11]"
            >
              {queueItems.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-[#262A33] rounded-2xl bg-[#0E1017]/50 space-y-2 p-6">
                  <Info className="w-8 h-8 mx-auto text-gray-500" />
                  <h4 className="text-sm font-semibold text-white">Nenhum item na fila</h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Não há oportunidades ativas para processamento nesta coluna.
                  </p>
                </div>
              ) : currentQueueItem ? (
                (() => {
                  const item = currentQueueItem
                  const isSent = item.isSentInSession
                  const isAwaiting = item.isAwaitingConfirmation
                  const isApproached = item.isAlreadyApproached
                  const isSkipped = item.isSkipped
                  const isCurrentConfirming = confirmingOppId === item.opp.id
                  const isCurrentSending = sendingOppId === item.opp.id

                  const progressText = `${queueIndex + 1} de ${queueItems.length}`

                  return (
                    <div className="space-y-4 max-w-3xl mx-auto">
                      {/* Barra de Progresso da Fila */}
                      <div className="p-3 rounded-2xl bg-[#12141A] border border-[#262A33] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            data-testid="queue-progress-badge"
                            className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 tabular-nums"
                          >
                            Item {progressText}
                          </span>
                          <span className="text-xs text-gray-400 hidden sm:inline">
                            · Progresso da sessão: {stats.sentInSession} enviadas de {stats.total}
                          </span>
                        </div>

                        {/* Navegação entre itens */}
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-testid="btn-queue-prev"
                            disabled={queueIndex === 0}
                            onClick={() => setQueueIndex((i) => Math.max(0, i - 1))}
                            className="h-7 text-xs border-[#262A33] text-gray-300 hover:text-white px-2 rounded-lg"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                            Anterior
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            data-testid="btn-queue-next"
                            disabled={queueIndex >= queueItems.length - 1}
                            onClick={() =>
                              setQueueIndex((i) => Math.min(queueItems.length - 1, i + 1))
                            }
                            className="h-7 text-xs border-[#262A33] text-gray-300 hover:text-white px-2 rounded-lg"
                          >
                            Próximo
                            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Card do Item em Foco */}
                      <div
                        data-testid={`queue-item-card-${item.opp.id}`}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-4 ${
                          isAwaiting
                            ? 'bg-[#151722] border-indigo-400/50 shadow-lg shadow-indigo-500/10'
                            : isSent
                              ? 'bg-[#0E1322] border-blue-500/40'
                              : 'bg-[#12141A] border-[#262A33]'
                        }`}
                      >
                        {/* Topo do Card */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#262A33]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-white">{item.opp.company}</h3>

                              {isAwaiting && (
                                <span
                                  data-testid={`status-badge-aguardando-${item.opp.id}`}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600 uppercase tracking-wide"
                                >
                                  <HelpCircle className="w-3 h-3 text-slate-300 animate-pulse" />
                                  Aguardando confirmação
                                </span>
                              )}

                              {isSent && (
                                <span
                                  data-testid={`status-badge-enviada-${item.opp.id}`}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wide"
                                >
                                  <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                  Enviada
                                </span>
                              )}

                              {isApproached && !isSent && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock className="w-3 h-3" />
                                  Já abordada anteriormente
                                </span>
                              )}

                              {isSkipped && !isSent && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950/40 text-indigo-300 border border-indigo-500/30">
                                  Pulada na fila
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                              {item.opp.contact_name && (
                                <span className="flex items-center gap-1">
                                  <UserCheck className="w-3 h-3 text-gray-500" />
                                  {item.opp.contact_name}
                                </span>
                              )}
                              <span
                                className={`flex items-center gap-1 font-mono text-xs ${
                                  item.hasPhone ? 'text-gray-300' : 'text-rose-400'
                                }`}
                              >
                                <Phone className="w-3 h-3 text-gray-500" />
                                {item.opp.contact_phone || 'Sem telefone'}
                              </span>
                              {item.opp.city && (
                                <span className="text-gray-500 text-xs">· {item.opp.city}</span>
                              )}
                              {item.lastInteractionDate && (
                                <span className="text-indigo-400 text-xs font-medium">
                                  · Último contato: {item.lastInteractionDate}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Botões de Ação na Fila */}
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              data-testid={`btn-mark-lost-${item.opp.id}`}
                              onClick={() => handleOpenMarkLost(item.opp)}
                              className="h-8 text-xs text-gray-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl px-2.5"
                              title="Marcar como Perdido direto"
                            >
                              <PhoneOff className="w-3.5 h-3.5 mr-1 text-rose-400/70" />
                              Sem WhatsApp
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSkipCurrent(item)}
                              className="h-8 text-xs text-gray-400 hover:text-white rounded-xl px-2.5"
                              title="Pular este item e ir para o próximo"
                            >
                              <SkipForward className="w-3.5 h-3.5 mr-1" />
                              Pular
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopySingle(item.message, item.opp.company)}
                              className="h-8 text-xs text-gray-300 hover:text-white rounded-xl px-2.5"
                              title="Copiar mensagem individual"
                            >
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copiar
                            </Button>
                          </div>
                        </div>

                        {/* Pré-visualização da Mensagem */}
                        <div className="rounded-xl bg-[#0A0C11] border border-[#262A33] p-3.5 text-xs space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                            <span className="uppercase tracking-wider flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-indigo-400" />
                              Mensagem Preparada para Disparo
                            </span>
                            <span className="font-mono text-gray-500">
                              {item.message.length} caracteres
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed font-sans text-xs text-gray-200 select-text">
                            {item.message}
                          </p>
                        </div>

                        {/* Barra de Ação Principal do Item na Fila */}
                        <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          {isAwaiting ? (
                            <div
                              data-testid={`confirm-box-${item.opp.id}`}
                              className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full"
                            >
                              <div className="flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="text-xs font-bold text-white">
                                  O número tem WhatsApp?
                                </span>
                                <span className="text-[11px] text-gray-400 hidden md:inline">
                                  (Ao confirmar, a fila avança automaticamente para o próximo lead)
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  data-testid={`btn-confirm-yes-${item.opp.id}`}
                                  disabled={isCurrentConfirming}
                                  onClick={() => handleConfirmSentYes(item)}
                                  className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 shadow-md shadow-blue-600/30"
                                >
                                  {isCurrentConfirming ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                      Confirmando...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3 h-3 mr-1" />
                                      Sim, enviado (Avançar)
                                    </>
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  data-testid={`btn-confirm-no-${item.opp.id}`}
                                  disabled={isCurrentConfirming}
                                  onClick={() => handleConfirmSentNo(item)}
                                  className="h-8 text-xs font-semibold border-rose-500/40 bg-rose-950/20 text-rose-300 hover:bg-rose-950/50 hover:text-white rounded-xl px-3"
                                >
                                  <XCircle className="w-3 h-3 mr-1 text-rose-400" />
                                  Não, sem WhatsApp
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
                              <span className="text-xs text-gray-400">
                                {isSent
                                  ? 'Mensagem já confirmada como enviada nesta sessão.'
                                  : 'Clique para abrir o WhatsApp Web com a mensagem pré-preenchida.'}
                              </span>

                              <Button
                                type="button"
                                size="sm"
                                data-testid={`btn-send-${item.opp.id}`}
                                disabled={!item.hasPhone || isCurrentSending}
                                onClick={() => handleItemSendClick(item)}
                                className={`h-8 text-xs font-semibold rounded-xl px-4 shadow-md transition-all ${
                                  !item.hasPhone
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                                    : isSent
                                      ? 'bg-blue-600/25 text-blue-200 hover:bg-blue-600/35 border border-blue-500/40 shadow-blue-500/10'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                                }`}
                              >
                                {isCurrentSending ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Abrindo...
                                  </>
                                ) : isSent ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-blue-300" />
                                    Enviada (Reabrir WhatsApp)
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5 mr-1.5" />
                                    Enviar via WhatsApp Web
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()
              ) : null}
            </div>
          )}

          {/* CORPO: MODO VISÃO GERAL (LISTA DE CARDS) */}
          {viewMode === 'list' && (
            <div
              data-testid="list-view-container"
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar bg-[#0A0C11]"
            >
              {itemsWithMessages.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-[#262A33] rounded-2xl bg-[#0E1017]/50 space-y-2 p-6">
                  <Info className="w-8 h-8 mx-auto text-gray-500" />
                  <h4 className="text-sm font-semibold text-white">
                    Nenhuma oportunidade nesta coluna
                  </h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Não há oportunidades no estágio <strong>{stage}</strong> dentro do seu escopo de
                    carteira.
                  </p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-[#262A33] rounded-xl">
                  Nenhum resultado para &quot;{searchTerm}&quot;.
                </div>
              ) : (
                filteredItems.map((item, index) => {
                  const isSent = item.isSentInSession
                  const isAwaiting = item.isAwaitingConfirmation
                  const isApproached = item.isAlreadyApproached
                  const isLost = item.isLost
                  const isCurrentSending = sendingOppId === item.opp.id
                  const isCurrentConfirming = confirmingOppId === item.opp.id

                  return (
                    <div
                      key={item.opp.id}
                      data-testid={`batch-item-${item.opp.id}`}
                      data-status={
                        isLost
                          ? 'perdido'
                          : isAwaiting
                            ? 'aguardando'
                            : isSent
                              ? 'enviada'
                              : isApproached
                                ? 'abordada'
                                : 'pendente'
                      }
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 space-y-3 ${
                        isLost
                          ? 'bg-[#150D11] border-rose-900/50 opacity-80'
                          : isAwaiting
                            ? 'bg-[#151722] border-indigo-400/50 shadow-md shadow-indigo-500/10'
                            : isSent
                              ? 'bg-[#0E1322] border-blue-500/40 shadow-sm shadow-blue-500/5'
                              : isApproached
                                ? 'bg-[#12141A] border-amber-500/30'
                                : 'bg-[#12141A] border-[#262A33] hover:border-indigo-500/50'
                      }`}
                    >
                      {/* Topo do Item */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#262A33]/70">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono text-gray-500">#{index + 1}</span>
                            <h4
                              className={`font-bold text-sm truncate ${
                                isLost ? 'text-gray-400 line-through' : 'text-white'
                              }`}
                              title={item.opp.company}
                            >
                              {item.opp.company}
                            </h4>

                            {/* Badges de Status */}
                            {isLost ? (
                              <span
                                data-testid={`status-badge-perdido-${item.opp.id}`}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wide"
                              >
                                <XCircle className="w-3 h-3 text-rose-400" />
                                Marcada como Perdido (Sem WhatsApp)
                              </span>
                            ) : isAwaiting ? (
                              <span
                                data-testid={`status-badge-aguardando-${item.opp.id}`}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-600 uppercase tracking-wide"
                              >
                                <HelpCircle className="w-3 h-3 text-slate-300 animate-pulse" />
                                Aguardando confirmação
                              </span>
                            ) : (
                              <>
                                {isSent && (
                                  <span
                                    data-testid={`status-badge-enviada-${item.opp.id}`}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wide"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-blue-400" />
                                    Enviada
                                  </span>
                                )}

                                {isApproached && !isSent && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    <Clock className="w-3 h-3" />
                                    Já abordada anteriormente
                                  </span>
                                )}

                                {!item.hasPhone && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                                    <AlertTriangle className="w-3 h-3" />
                                    Sem telefone cadastrado
                                  </span>
                                )}
                              </>
                            )}
                          </div>

                          {/* Contato, Telefone e Cidade */}
                          <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                            {item.opp.contact_name && (
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3 h-3 text-gray-500" />
                                {item.opp.contact_name}
                              </span>
                            )}

                            <span
                              className={`flex items-center gap-1 font-mono text-[11px] ${
                                item.hasPhone ? 'text-gray-300' : 'text-rose-400'
                              }`}
                            >
                              <Phone className="w-3 h-3 text-gray-500" />
                              {item.opp.contact_phone || 'Sem telefone'}
                            </span>

                            {item.opp.city && (
                              <span className="text-gray-500 text-[11px]">· {item.opp.city}</span>
                            )}

                            {item.lastInteractionDate && (
                              <span className="text-indigo-400 text-[11px] font-medium">
                                · Último contato: {item.lastInteractionDate}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botões de Ação do Item */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap sm:flex-nowrap">
                          {isLost ? (
                            <span className="text-xs text-rose-400/90 font-medium px-2 py-1 bg-rose-950/40 rounded-lg border border-rose-900/60 flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" />
                              Oportunidade Perdida
                            </span>
                          ) : isAwaiting ? (
                            <div
                              data-testid={`confirm-box-${item.opp.id}`}
                              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 sm:p-2 rounded-xl bg-[#0E1017] border border-indigo-400/30"
                            >
                              <span className="text-xs font-semibold text-gray-200 px-1 flex items-center gap-1">
                                <HelpCircle className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                O número tem WhatsApp?
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  data-testid={`btn-confirm-yes-${item.opp.id}`}
                                  disabled={isCurrentConfirming}
                                  onClick={() => handleConfirmSentYes(item)}
                                  className="h-7 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-2.5 shadow-sm shadow-blue-600/30"
                                  title="Confirmar envio e seguir fluxo de qualificação"
                                >
                                  {isCurrentConfirming ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                      Confirmando...
                                    </>
                                  ) : (
                                    <>
                                      <Check className="w-3 h-3 mr-1" />
                                      Sim, enviado
                                    </>
                                  )}
                                </Button>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  data-testid={`btn-confirm-no-${item.opp.id}`}
                                  disabled={isCurrentConfirming}
                                  onClick={() => handleConfirmSentNo(item)}
                                  className="h-7 text-xs font-semibold border-rose-500/40 bg-rose-950/20 text-rose-300 hover:bg-rose-950/50 hover:text-white rounded-lg px-2.5"
                                  title="Marcar como Perdido direto (Sem WhatsApp)"
                                >
                                  <XCircle className="w-3 h-3 mr-1 text-rose-400" />
                                  Não, sem WhatsApp
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                data-testid={`btn-mark-lost-${item.opp.id}`}
                                onClick={() => handleOpenMarkLost(item.opp)}
                                className="h-8 text-xs text-gray-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-xl px-2.5 transition-colors border border-transparent hover:border-rose-900/50"
                                title="Marcar oportunidade como Perdido caso o número não possua WhatsApp"
                              >
                                <PhoneOff className="w-3.5 h-3.5 mr-1 text-rose-400/70" />
                                <span className="hidden sm:inline">Sem WhatsApp</span>
                                <span className="sm:hidden">Perdido</span>
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCopySingle(item.message, item.opp.company)}
                                className="h-8 text-xs text-gray-300 hover:text-white hover:bg-[#1A1D27] rounded-xl px-2.5"
                                title="Copiar mensagem individual"
                              >
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                Copiar
                              </Button>

                              <Button
                                type="button"
                                size="sm"
                                data-testid={`btn-send-${item.opp.id}`}
                                disabled={!item.hasPhone || isCurrentSending}
                                onClick={() => handleItemSendClick(item)}
                                className={`h-8 text-xs font-semibold rounded-xl px-3.5 shadow-md transition-all ${
                                  !item.hasPhone
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                                    : isSent
                                      ? 'bg-blue-600/25 text-blue-200 hover:bg-blue-600/35 border border-blue-500/40 shadow-blue-500/10'
                                      : isApproached
                                        ? 'bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/40'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                                }`}
                                title={
                                  !item.hasPhone
                                    ? 'Não é possível enviar sem telefone válido'
                                    : isSent
                                      ? 'Mensagem já enviada. Clique para reenviar.'
                                      : 'Abrir WhatsApp Web e aguardar confirmação'
                                }
                              >
                                {isCurrentSending ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    Abrindo...
                                  </>
                                ) : isSent ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-blue-300" />
                                    Enviada (Reenviar)
                                  </>
                                ) : isApproached ? (
                                  <>
                                    <Send className="w-3.5 h-3.5 mr-1.5" />
                                    Reenviar (Já abordada)
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5 mr-1.5" />
                                    Enviar
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Pré-visualização da Mensagem Gerada */}
                      <div className="rounded-xl bg-[#0A0C11] border border-[#262A33] p-3 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                          <span className="uppercase tracking-wider flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-indigo-400" />
                            Mensagem Gerada (Preview do WhatsApp)
                          </span>
                          <span className="font-mono text-gray-500">
                            {item.message.length} caracteres
                          </span>
                        </div>
                        <p
                          className={`whitespace-pre-wrap leading-relaxed font-sans text-xs select-text ${
                            isLost ? 'text-gray-500' : 'text-gray-200'
                          }`}
                        >
                          {item.message}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Footer do Modal */}
          <DialogFooter className="p-3 sm:p-4 border-t border-[#262A33] bg-[#0E1017] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                Disparo assistido com fila guiada e avanço automático. Cada confirmação salva na
                timeline e alimenta o histórico de abordagens.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowReportDialog(true)}
                className="border-[#262A33] text-indigo-300 hover:text-white rounded-xl h-8 px-3 text-xs font-semibold"
              >
                <FileText className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                Finalizar sessão / Resumo
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="border-[#262A33] text-gray-300 hover:text-white rounded-xl h-8 px-4 text-xs font-semibold"
              >
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: RELATÓRIO DA LEVA (FASE 1 - ITEM 3) */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent
          data-testid="dialog-session-report"
          className="bg-[#12141A] border-[#262A33] text-white max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar"
        >
          <DialogHeader className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400">
              <FileText className="w-5 h-5" />
              <DialogTitle className="text-lg font-bold text-white">
                Relatório da Leva — Disparo WhatsApp
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-gray-400">
              Consolidado dos atendimentos processados nesta sessão para a coluna{' '}
              <strong className="text-gray-200">{stage}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Cards de Métricas do Relatório */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
            <div className="p-3 rounded-xl bg-[#0E1017] border border-blue-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-blue-300 uppercase font-medium block">
                  Enviadas
                </span>
                <span className="text-lg font-bold text-blue-200 tabular-nums">
                  {stats.sentInSession}
                </span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-blue-400" />
            </div>

            <div className="p-3 rounded-xl bg-[#0E1017] border border-rose-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-rose-300 uppercase font-medium block">
                  Sem WhatsApp (Perdido)
                </span>
                <span className="text-lg font-bold text-rose-200 tabular-nums">
                  {stats.lostInSession}
                </span>
              </div>
              <XCircle className="w-5 h-5 text-rose-400" />
            </div>

            <div className="p-3 rounded-xl bg-[#0E1017] border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-amber-300 uppercase font-medium block">
                  Sem Telefone
                </span>
                <span className="text-lg font-bold text-amber-200 tabular-nums">
                  {stats.noPhone}
                </span>
              </div>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>

            <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-medium block">
                  Já Abordadas
                </span>
                <span className="text-lg font-bold text-gray-200 tabular-nums">
                  {stats.alreadyApproached}
                </span>
              </div>
              <Clock className="w-5 h-5 text-gray-400" />
            </div>

            <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-medium block">
                  Puladas
                </span>
                <span className="text-lg font-bold text-gray-200 tabular-nums">
                  {stats.skippedInSession}
                </span>
              </div>
              <SkipForward className="w-5 h-5 text-gray-400" />
            </div>

            <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-center justify-between">
              <div>
                <span className="text-[10px] text-indigo-400 uppercase font-medium block">
                  Total da Coluna
                </span>
                <span className="text-lg font-bold text-white tabular-nums">{stats.total}</span>
              </div>
              <Building className="w-5 h-5 text-indigo-400" />
            </div>
          </div>

          {/* Área com texto formatado do relatório para cópia rápida */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="font-medium">Texto consolidado para cópia:</span>
              <Button
                type="button"
                size="sm"
                data-testid="btn-copy-report-text"
                onClick={handleCopyReport}
                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-2.5 font-medium"
              >
                {reportCopied ? (
                  <>
                    <Check className="w-3 h-3 mr-1 text-emerald-300" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar Resumo
                  </>
                )}
              </Button>
            </div>
            <pre
              data-testid="report-text-pre"
              className="p-3.5 rounded-xl bg-[#0A0C11] border border-[#262A33] text-[11px] font-mono text-gray-300 whitespace-pre-wrap max-h-56 overflow-y-auto select-text custom-scrollbar leading-relaxed"
            >
              {reportText}
            </pre>
          </div>

          <DialogFooter className="pt-3 border-t border-[#262A33] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReportDialog(false)}
              className="border-[#262A33] text-gray-300 text-xs rounded-xl"
            >
              Voltar ao Painel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: RESULTADO DO DISPARO AUTOMÁTICO CLOUD API (FASE 2 - ITEM 6) */}
      {autoBatchResult && (
        <Dialog open={showAutoResultModal} onOpenChange={setShowAutoResultModal}>
          <DialogContent
            data-testid="dialog-auto-batch-result"
            className="bg-[#12141A] border-[#262A33] text-white max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar"
          >
            <DialogHeader className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400">
                <Zap className="w-5 h-5" />
                <DialogTitle className="text-lg font-bold text-white">
                  Resultado do Disparo — WhatsApp Cloud API
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-gray-400">
                Retorno do envio em lote processado diretamente pela infraestrutura da Meta.
              </DialogDescription>
            </DialogHeader>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
                <span className="text-[10px] text-gray-400 uppercase font-medium block">Total</span>
                <span className="text-lg font-bold text-white tabular-nums">
                  {autoBatchResult.total}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40">
                <span className="text-[10px] text-emerald-300 uppercase font-medium block">
                  Enviadas com Sucesso
                </span>
                <span className="text-lg font-bold text-emerald-200 tabular-nums">
                  {autoBatchResult.sentCount}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/40">
                <span className="text-[10px] text-rose-300 uppercase font-medium block">
                  Falhas
                </span>
                <span className="text-lg font-bold text-rose-200 tabular-nums">
                  {autoBatchResult.failedCount}
                </span>
              </div>
            </div>

            {/* Lista detalhada item a item */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-semibold text-gray-300 block">
                Detalhamento por oportunidade:
              </span>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {autoBatchResult.results.map((res) => (
                  <div
                    key={res.opportunityId}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      res.status === 'sent'
                        ? 'bg-[#0E1322] border-blue-500/30 text-gray-300'
                        : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <strong className="text-white block">{res.company}</strong>
                      {res.reason && (
                        <span className="text-[11px] text-rose-300 block">{res.reason}</span>
                      )}
                      {res.messageId && (
                        <span className="text-[10px] text-gray-500 font-mono block">
                          ID Meta: {res.messageId}
                        </span>
                      )}
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                        res.status === 'sent'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {res.status === 'sent' ? 'Enviada' : 'Falhou'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-[#262A33] flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                {autoBatchResult.failedCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    data-testid="btn-retry-failed-auto"
                    disabled={autoSending}
                    onClick={() => handleSendAllAutomatic(true)}
                    className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded-xl px-3"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Reenviar falhadas ({autoBatchResult.failedCount})
                  </Button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAutoResultModal(false)}
                className="border-[#262A33] text-gray-300 text-xs rounded-xl"
              >
                Concluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmação de Reenvio para Oportunidade Já Abordada */}
      {confirmResendOpp && (
        <Dialog
          open={Boolean(confirmResendOpp)}
          onOpenChange={(o) => !o && setConfirmResendOpp(null)}
        >
          <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-md rounded-2xl shadow-2xl">
            <DialogHeader>
              <div className="flex items-center gap-2 text-amber-400 pb-1">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <DialogTitle className="text-base font-bold text-white">
                  Confirmar Reenvio de Mensagem
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-gray-300 leading-relaxed pt-2">
                A oportunidade{' '}
                <strong className="text-white">&quot;{confirmResendOpp.company}&quot;</strong> já
                possui interações anteriores registradas na timeline.
                <br />
                <br />
                Deseja realmente abrir o WhatsApp novamente e registrar um novo contato?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="pt-3 border-t border-[#262A33] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmResendOpp(null)}
                className="border-[#262A33] text-gray-300 text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const targetItem = itemsWithMessages.find((i) => i.opp.id === confirmResendOpp.id)
                  setConfirmResendOpp(null)
                  if (targetItem) {
                    executeSend(targetItem)
                  }
                }}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl"
              >
                Sim, Reenviar Agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Confirmação: Marcar como Perdido (Sem WhatsApp) */}
      {markLostOpp && (
        <Dialog
          open={Boolean(markLostOpp)}
          onOpenChange={(o) => !o && !savingLost && setMarkLostOpp(null)}
        >
          <DialogContent
            data-testid="dialog-mark-lost"
            className="bg-[#12141A] border-[#262A33] text-white max-w-md rounded-2xl shadow-2xl"
          >
            <DialogHeader className="space-y-1.5">
              <div className="flex items-center gap-2 text-rose-400 pb-1">
                <PhoneOff className="w-5 h-5 shrink-0 text-rose-400" />
                <DialogTitle className="text-base font-bold text-white">
                  Marcar como Perdido — Sem WhatsApp
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-gray-300 leading-relaxed">
                Você está prestes a mover{' '}
                <strong className="text-white">&quot;{markLostOpp.company}&quot;</strong>{' '}
                diretamente para o estágio{' '}
                <span className="text-rose-400 font-semibold">Perdido</span> e registrar o motivo na
                timeline.
              </DialogDescription>
            </DialogHeader>

            <div className="py-2 space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#0E1017] border border-[#262A33] text-gray-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Telefone testado:</span>
                  <span className="font-mono text-white font-semibold">
                    {markLostOpp.contact_phone || 'Sem telefone'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Estágio atual:</span>
                  <span className="text-gray-300">{markLostOpp.stage}</span>
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <label
                  htmlFor="lost-comment-input"
                  className="text-[11px] font-medium text-gray-300 block"
                >
                  Motivo / Comentário registrado na timeline:
                </label>
                <input
                  id="lost-comment-input"
                  data-testid="input-lost-comment"
                  type="text"
                  value={markLostComment}
                  onChange={(e) => setMarkLostComment(e.target.value)}
                  placeholder="Ex.: Número não existe no WhatsApp / Número inválido"
                  className="w-full px-3 py-2 text-xs bg-[#0E1017] border border-[#262A33] focus:border-rose-500/60 rounded-xl text-white placeholder:text-gray-500 focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 block">
                  Esse comentário ficará salvo nas notas da oportunidade para histórico da equipe.
                </span>
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-[#262A33] flex flex-col sm:flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingLost}
                onClick={() => setMarkLostOpp(null)}
                className="border-[#262A33] text-gray-300 text-xs rounded-xl w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid="btn-confirm-mark-lost"
                disabled={savingLost}
                onClick={handleConfirmMarkLost}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl w-full sm:w-auto shadow-rose-900/30 shadow-md"
              >
                {savingLost ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Confirmar e Marcar Perdido
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
