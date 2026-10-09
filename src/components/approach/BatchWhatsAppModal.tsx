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

  // Chave de persistência de sessão no localStorage
  const sessionKey = useMemo(() => {
    return `${STORAGE_KEY_PREFIX}${stage.toLowerCase()}_${currentUserId || 'default'}`
  }, [stage, currentUserId])

  // IDs das oportunidades enviadas nesta sessão
  const [sessionSentIds, setSessionSentIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(sessionKey)
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
      // Ignora se quota cheia
    }
  }, [sessionSentIds, sessionKey])

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

  // Estado de envio em andamento
  const [sendingOppId, setSendingOppId] = useState<string | null>(null)

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

      // Identificar o script adequado para a coluna
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
      // Buscar notas das oportunidades envolvidas
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
    }
  }, [open, fetchScripts, fetchNotesHistory])

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

      // Já abordada se tiver interação do tipo no histórico
      const isAlreadyApproached =
        actionType === 'initial' ? summary.hasInitial : summary.hasFollowup

      const isSentInSession = sessionSentIds.includes(opp.id)

      return {
        opp,
        message,
        phoneNormalized,
        hasPhone,
        isAlreadyApproached,
        isSentInSession,
        summary,
        lastInteractionDate: formattedLastDate,
      }
    })
  }, [opportunities, notesSummary, actionType, activeScript, currentUserName, sessionSentIds])

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

  // Contadores do topo
  const stats = useMemo(() => {
    const total = itemsWithMessages.length
    const withPhone = itemsWithMessages.filter((i) => i.hasPhone).length
    const alreadyApproached = itemsWithMessages.filter((i) => i.isAlreadyApproached).length
    const sentInSession = itemsWithMessages.filter((i) => i.isSentInSession).length
    return {
      total,
      withPhone,
      alreadyApproached,
      sentInSession,
    }
  }, [itemsWithMessages])

  // Executar disparo assistido: abre wa.me + registra na timeline
  const executeSend = async (item: (typeof itemsWithMessages)[0]) => {
    if (!item.hasPhone) {
      toast({
        title: 'Sem telefone cadastrado',
        description: `A oportunidade "${item.opp.company}" não possui telefone válido para WhatsApp.`,
        variant: 'destructive',
      })
      return
    }

    setSendingOppId(item.opp.id)
    try {
      // 1. Abrir WhatsApp Web com mensagem pré-preenchida
      const url = buildWhatsAppWebUrl(item.phoneNormalized, item.message)
      window.open(url, '_blank', 'noopener,noreferrer')

      // 2. Registrar automaticamente na timeline, criar sessão de histórico e auto-qualificar se initial
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

      // 3. Atualizar sessão local
      setSessionSentIds((prev) => (prev.includes(item.opp.id) ? prev : [...prev, item.opp.id]))

      // 4. Atualizar resumo de notas local
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
        title: 'WhatsApp aberto e registrado!',
        description: `Interação registrada na timeline de "${item.opp.company}".`,
      })

      onInteractionLogged?.()
    } catch (err) {
      console.error('Erro ao registrar envio:', err)
      toast({
        title: 'Erro ao registrar interação',
        description: 'A mensagem foi aberta mas não foi possível salvar na timeline.',
        variant: 'destructive',
      })
    } finally {
      setSendingOppId(null)
    }
  }

  // Clicou no botão Enviar de um card
  const handleItemSendClick = (item: (typeof itemsWithMessages)[0]) => {
    if (item.isAlreadyApproached || item.isSentInSession) {
      setConfirmResendOpp(item.opp)
      return
    }
    executeSend(item)
  }

  // Copiar todas as mensagens para quem prefere colar manualmente
  const handleCopyAll = async () => {
    const textAll = itemsWithMessages
      .map((item, idx) => {
        const phone = item.opp.contact_phone || 'Sem telefone'
        return `=== [${idx + 1}/${itemsWithMessages.length}] ${item.opp.company} (${phone}) ===\n${item.message}`
      })
      .join('\n\n----------------------------------------\n\n')

    try {
      await navigator.clipboard.writeText(textAll)
      toast({
        title: 'Mensagens copiadas!',
        description: `Todas as ${itemsWithMessages.length} mensagens foram copiadas para a área de transferência.`,
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

  // Limpar histórico da sessão atual
  const handleResetSession = () => {
    if (confirm('Deseja reiniciar a contagem de disparos desta sessão?')) {
      setSessionSentIds([])
      try {
        localStorage.removeItem(sessionKey)
      } catch {
        /* intentionally ignored */
      }
      toast({
        title: 'Sessão reiniciada',
        description: 'O contador de disparos desta sessão foi zerado.',
      })
    }
  }

  const isInitial = actionType === 'initial'
  const title = isInitial
    ? 'Enviar Abordagem Inicial (WhatsApp) — Coluna Novo'
    : 'Mensagem de Continuação (Follow-up) — Coluna Qualificado'

  const subtitle = isInitial
    ? 'Disparo assistido em lote para novos leads. Abre o WhatsApp com a mensagem personalizada pronta e registra automaticamente na timeline.'
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
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
            </div>

            {/* Info do script ativo e barra de ações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  Script ativo:{' '}
                  <strong className="text-gray-200">
                    {activeScript?.title ||
                      (loadingScripts ? 'Carregando script...' : 'Padrão Bit Consulting')}
                  </strong>
                </span>
                {activeScript?.situation && (
                  <span className="text-gray-500 hidden md:inline">({activeScript.situation})</span>
                )}
              </div>

              <div className="flex items-center gap-2">
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
                  onClick={handleCopyAll}
                  disabled={itemsWithMessages.length === 0}
                  className="h-8 text-xs border-[#262A33] bg-[#12141A] text-gray-300 hover:text-white hover:bg-[#181B24] rounded-xl font-medium"
                  title="Copiar todas as mensagens geradas para a área de transferência"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                  Copiar todas as mensagens
                </Button>
              </div>
            </div>

            {/* Barra de busca de oportunidade */}
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
                }}
                className="h-7 text-xs border-red-500/50 bg-red-900/30 text-white hover:bg-red-900/50"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Lista de Oportunidades com Mensagens Prontas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar bg-[#0A0C11]">
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
                const isApproached = item.isAlreadyApproached
                const isCurrentSending = sendingOppId === item.opp.id

                return (
                  <div
                    key={item.opp.id}
                    data-testid={`batch-item-${item.opp.id}`}
                    data-status={isSent ? 'enviada' : isApproached ? 'abordada' : 'pendente'}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 space-y-3 ${
                      isSent
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
                            className="font-bold text-sm text-white truncate"
                            title={item.opp.company}
                          >
                            {item.opp.company}
                          </h4>

                          {/* Badges de Status */}
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
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
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
                                : 'Abrir WhatsApp Web e registrar na timeline'
                          }
                        >
                          {isCurrentSending ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              Registrando...
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
                      <p className="text-gray-200 whitespace-pre-wrap leading-relaxed font-sans text-xs select-text">
                        {item.message}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer do Modal */}
          <DialogFooter className="p-3 sm:p-4 border-t border-[#262A33] bg-[#0E1017] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>
                Disparo assistido 100% em conformidade com o WhatsApp. Cada clique abre o WhatsApp
                Web preenchido e marca na timeline.
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-[#262A33] text-gray-300 hover:text-white rounded-xl h-8 px-4 text-xs font-semibold"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  )
}
