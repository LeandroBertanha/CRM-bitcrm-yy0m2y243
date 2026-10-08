import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  History,
  Search,
  Calendar,
  Building,
  User,
  Phone,
  Flame,
  SunMedium,
  ThermometerSnowflake,
  ArrowRight,
  Eye,
  Loader2,
  Clock,
  CheckCircle,
  Edit2,
  Layers,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import useRealtime from '@/hooks/use-realtime'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { formatDateBR, type Opportunity } from '@/types/crm'
import type { ApproachSession, LeadTemperature, ApproachStatus } from '@/types/playbook'
import { getApproachSessions, updateApproachSession } from '@/services/playbook'
import { syncApproachSessionWithOpportunity } from '@/services/approach-sync'
import { EditApproachSessionModal } from '@/components/approach/EditApproachSessionModal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export default function HistoryPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const [sessions, setSessions] = useState<ApproachSession[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSession, setSelectedSession] = useState<ApproachSession | null>(null)
  const [editingSession, setEditingSession] = useState<ApproachSession | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [sessionsData, oppsData] = await Promise.all([
        getApproachSessions({
          sellerId: user.id,
          isAdmin,
        }),
        pb.collection('opportunities').getFullList<Opportunity>({
          batch: 500,
          sort: '-created',
          expand: 'seller',
        }),
      ])
      setSessions(sessionsData)
      setOpportunities(oppsData)
    } catch (err) {
      console.error('Erro ao carregar histórico de sessões:', err)
    } finally {
      setLoading(false)
    }
  }, [user, isAdmin])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Inscrição em tempo real para approach_sessions e opportunities
  useRealtime<ApproachSession>('approach_sessions', () => {
    loadData()
  })
  useRealtime<Opportunity>('opportunities', () => {
    loadData()
  })

  // Salvar edição da sessão e sincronizar com oportunidade
  const handleSaveSessionEdit = async (data: {
    temperature?: LeadTemperature
    temperature_reason?: string
    status: ApproachStatus
    next_action?: string
    next_contact_at?: string | null
    notes?: string
    opportunity?: string | null
    stage?: Opportunity['stage']
  }) => {
    if (!editingSession || !user) return

    try {
      // 1. Atualizar a sessão no banco
      const updated = await updateApproachSession(editingSession.id, {
        temperature: data.temperature,
        temperature_reason: data.temperature_reason,
        status: data.status,
        next_action: data.next_action,
        next_contact_at: data.next_contact_at,
        notes: data.notes,
        opportunity: data.opportunity || undefined,
      })

      // 2. Sincronizar com a oportunidade vinculada (se houver)
      if (data.opportunity) {
        await syncApproachSessionWithOpportunity({
          opportunityId: data.opportunity,
          status: data.status,
          nextContactAt: data.next_contact_at,
          notes: data.notes,
          authorId: user.id,
          manualStage: data.stage,
        })
      }

      toast({
        title: 'Sessão atualizada com sucesso!',
        description: data.opportunity
          ? 'Oportunidade e histórico sincronizados no CRM.'
          : 'Alterações salvas com sucesso.',
      })

      // Se o modal de detalhes estava aberto para essa sessão, atualizar detalhes
      if (selectedSession && selectedSession.id === editingSession.id) {
        setSelectedSession(updated)
      }

      await loadData()
    } catch (err) {
      console.error('Erro ao salvar edição da abordagem:', err)
      toast({
        title: 'Erro ao atualizar abordagem',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      })
      throw err
    }
  }

  const filtered = sessions.filter((s) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const companyDisplay = s.expand?.opportunity?.company || s.company_name || ''
    return (
      companyDisplay.toLowerCase().includes(term) ||
      (s.company_name || '').toLowerCase().includes(term) ||
      (s.contact_name || '').toLowerCase().includes(term) ||
      (s.channel || '').toLowerCase().includes(term) ||
      (s.status || '').toLowerCase().includes(term) ||
      (s.segment || '').toLowerCase().includes(term)
    )
  })

  const getTempBadge = (temp?: LeadTemperature) => {
    if (temp === 'quente') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-950/60 text-rose-300 border border-rose-600/50">
          <Flame className="w-3 h-3 text-rose-400" />
          Quente
        </span>
      )
    }
    if (temp === 'frio') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-950/60 text-sky-300 border border-sky-600/50">
          <ThermometerSnowflake className="w-3 h-3 text-sky-400" />
          Frio
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-600/50">
        <SunMedium className="w-3 h-3 text-amber-400" />
        Morno
      </span>
    )
  }

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        Carregando histórico de abordagens...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Histórico de Abordagens</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              {isAdmin
                ? 'Todas as sessões de abordagem realizadas pela equipe comercial.'
                : 'Suas sessões de abordagem comercial realizadas.'}
            </p>
          </div>
        </div>

        <Button
          asChild
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-bold"
        >
          <Link to="/abordagem">Nova Abordagem</Link>
        </Button>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Pesquisar por empresa, contato, canal, status ou segmento..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10"
        />
      </div>

      {/* Lista de Sessões */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-xs text-gray-500 rounded-2xl bg-[#12141A] border border-[#262A33] space-y-2">
          <History className="w-8 h-8 mx-auto opacity-40 text-gray-400" />
          <p className="font-semibold text-gray-300">Nenhuma abordagem registrada ainda.</p>
          <p>Clique em &quot;Nova Abordagem&quot; para iniciar com o Copiloto Comercial.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] hover:border-indigo-500/50 hover:bg-[#141722] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-md"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                    {s.expand?.opportunity?.company || s.company_name || 'Empresa sem nome'}
                  </span>
                  {getTempBadge(s.temperature)}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#181B24] border border-[#262A33] text-gray-300">
                    {s.channel}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-950/40 text-indigo-300 border border-indigo-900/40">
                    {s.status}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  {s.contact_name && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-500" />
                      {s.contact_name}
                    </span>
                  )}
                  {s.contact_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-gray-500" />
                      {s.contact_phone}
                    </span>
                  )}
                  {s.segment && <span className="text-gray-500">Segmento: {s.segment}</span>}
                  {s.next_action && (
                    <span className="text-indigo-400 font-medium">Próx: {s.next_action}</span>
                  )}
                </div>
              </div>

              <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-[#262A33] shrink-0 gap-2">
                <span className="text-xs text-gray-400">{formatDateBR(s.created)}</span>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingSession(s)
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </button>
                  <span className="text-[11px] text-gray-400 group-hover:text-white flex items-center gap-1 font-medium">
                    <Eye className="w-3.5 h-3.5" />
                    Detalhes
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalhes da Sessão */}
      <Dialog open={Boolean(selectedSession)} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar">
          {selectedSession && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    <span>
                      {selectedSession.expand?.opportunity?.company ||
                        selectedSession.company_name ||
                        'Abordagem Comercial'}
                    </span>
                    {getTempBadge(selectedSession.temperature)}
                  </DialogTitle>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setEditingSession(selectedSession)
                      setSelectedSession(null)
                    }}
                    className="h-8 px-3 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                </div>
                <DialogDescription className="text-xs text-gray-400">
                  Realizada em {formatDateBR(selectedSession.created)} via {selectedSession.channel}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 py-2 text-xs">
                {/* Dados do Contato */}
                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Contato</span>
                    <span className="font-semibold text-gray-200">
                      {selectedSession.contact_name || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Telefone</span>
                    <span className="font-semibold text-gray-200">
                      {selectedSession.contact_phone || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Segmento</span>
                    <span className="font-semibold text-gray-200">
                      {selectedSession.segment || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Situação Digital</span>
                    <span className="font-semibold text-gray-200">
                      {selectedSession.digital_situation || '—'}
                    </span>
                  </div>
                </div>

                {/* Motivo da Temperatura & Próxima Ação */}
                <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                    Avaliação do Copiloto
                  </span>
                  <p className="text-gray-300">
                    <strong>Motivo da Temperatura:</strong>{' '}
                    {selectedSession.temperature_reason || '—'}
                  </p>
                  <p className="text-gray-300">
                    <strong>Próxima Melhor Ação:</strong> {selectedSession.next_action || '—'}
                  </p>
                </div>

                {/* Perguntas & Respostas Registradas */}
                {selectedSession.answers && selectedSession.answers.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Respostas Coletadas:
                    </span>
                    <div className="space-y-1.5">
                      {selectedSession.answers.map((ans, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-[#0E1017] border border-[#262A33] space-y-0.5"
                        >
                          <span className="text-gray-400 block">Q: {ans.question}</span>
                          <span className="font-semibold text-indigo-300 block">
                            R: {ans.answer}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Oportunidade Vinculada */}
                {selectedSession.opportunity && (
                  <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-indigo-400" />
                      <div>
                        <span className="text-[10px] text-gray-500 block">
                          Oportunidade Vinculada
                        </span>
                        <span className="font-semibold text-gray-200">
                          {selectedSession.expand?.opportunity?.company ||
                            'Oportunidade no Pipeline'}
                        </span>
                      </div>
                    </div>
                    {selectedSession.expand?.opportunity?.stage && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-950/40 text-indigo-300 border border-indigo-800/40">
                        {selectedSession.expand.opportunity.stage}
                      </span>
                    )}
                  </div>
                )}

                {/* Observações da Sessão */}
                {selectedSession.notes && (
                  <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                      Observações e Follow-up:
                    </span>
                    <p className="text-gray-200 whitespace-pre-line">{selectedSession.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Edição de Sessão */}
      <EditApproachSessionModal
        open={Boolean(editingSession)}
        onOpenChange={(open) => {
          if (!open) setEditingSession(null)
        }}
        session={editingSession}
        opportunities={opportunities}
        onSave={handleSaveSessionEdit}
      />
    </div>
  )
}
