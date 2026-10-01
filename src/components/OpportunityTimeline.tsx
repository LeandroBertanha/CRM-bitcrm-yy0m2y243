import React, { useState, useEffect, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useRealtime } from '@/hooks/use-realtime'
import { OpportunityNote, formatDateBR } from '@/types/crm'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  PhoneCall,
  MessageCircle,
  Users,
  FileText,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Calendar,
} from 'lucide-react'

export interface OpportunityTimelineProps {
  opportunityId: string
  currentUserId?: string
  currentUserRole?: string
  currentUserEmail?: string
}

const TYPE_CONFIG: Record<
  OpportunityNote['type'],
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  ligacao: {
    label: 'Ligação Feita',
    icon: PhoneCall,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  whatsapp: {
    label: 'WhatsApp Enviado',
    icon: MessageCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  reuniao: {
    label: 'Reunião Realizada',
    icon: Users,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  nota: {
    label: 'Anotação / Nota',
    icon: FileText,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  outro: {
    label: 'Outro Registro',
    icon: Clock,
    color: 'text-gray-400',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
  },
}

export function OpportunityTimeline({
  opportunityId,
  currentUserId,
  currentUserRole,
  currentUserEmail,
}: OpportunityTimelineProps) {
  const { toast } = useToast()
  const [notes, setNotes] = useState<OpportunityNote[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Campos do formulário de novo registro
  const [type, setType] = useState<OpportunityNote['type']>('ligacao')
  const [text, setText] = useState('')
  // Padrão: data e hora atual no formato YYYY-MM-DDTHH:mm
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    const localISOTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16)
    return localISOTime
  })

  const isAdmin =
    currentUserRole === 'admin' ||
    currentUserEmail?.toLowerCase() === 'leandro.bertanha@lbertanha.com' ||
    currentUserEmail?.toLowerCase() === 'leandro.bertanha@gmail.com'

  const fetchNotes = useCallback(async () => {
    if (!opportunityId) return
    try {
      setLoading(true)
      const records = await pb.collection('opportunity_notes').getFullList<OpportunityNote>({
        filter: `opportunity = "${opportunityId}"`,
        sort: '-date,-created',
        expand: 'author',
      })
      setNotes(records)
    } catch (err) {
      console.error('Erro ao buscar timeline da oportunidade:', err)
      const errorMsg = getErrorMessage(err)
      toast({
        title: 'Erro ao carregar timeline',
        description: errorMsg || 'Não foi possível carregar as interações da oportunidade.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [opportunityId, toast])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  // Inscrição em tempo real para sincronizar adições e exclusões
  useRealtime<OpportunityNote>('opportunity_notes', (data) => {
    const oppId = data.record?.opportunity
    if (oppId === opportunityId) {
      fetchNotes()
    }
  })

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) {
      toast({
        title: 'Texto obrigatório',
        description: 'Digite o resumo ou detalhes da conversa antes de registrar.',
        variant: 'destructive',
      })
      return
    }

    // Obter o ID do autor ativo com fallback direto no pb.authStore.record
    const effectiveUserId = currentUserId || pb.authStore.record?.id
    if (!effectiveUserId) {
      toast({
        title: 'Usuário não autenticado',
        description: 'Faça login para registrar uma interação.',
        variant: 'destructive',
      })
      return
    }

    if (!opportunityId) {
      toast({
        title: 'Oportunidade inválida',
        description: 'Não foi possível identificar a oportunidade vinculada.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Converte data local para formato padrão PocketBase RFC3339 com espaço (ex: 2026-10-01 15:04:05.000Z)
      const selectedDate = dateStr ? new Date(dateStr) : new Date()
      const isoDate = isNaN(selectedDate.getTime())
        ? new Date().toISOString().replace('T', ' ')
        : selectedDate.toISOString().replace('T', ' ')

      const createdRecord = await pb.collection('opportunity_notes').create({
        opportunity: opportunityId,
        author: effectiveUserId,
        type,
        text: text.trim(),
        date: isoDate,
      })

      toast({
        title: 'Interação registrada',
        description: 'A conversa foi incluída na timeline da oportunidade.',
      })

      setText('')
      setShowForm(false)
      // Resetar data para o momento atual
      const now = new Date()
      const tzOffset = now.getTimezoneOffset() * 60000
      setDateStr(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16))

      // Atualização otimista imediata caso fetchNotes demore
      if (createdRecord) {
        setNotes((prev) => {
          const exists = prev.some((n) => n.id === createdRecord.id)
          if (exists) return prev
          return [createdRecord as OpportunityNote, ...prev]
        })
      }

      await fetchNotes()
    } catch (err) {
      console.error('Erro ao criar registro na timeline:', err)
      const errorMsg = getErrorMessage(err)
      toast({
        title: 'Erro ao registrar interação',
        description: errorMsg || 'Não foi possível salvar o registro na timeline.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteNote = async (noteId: string, authorId: string) => {
    const effectiveUserId = currentUserId || pb.authStore.record?.id
    const canDelete = isAdmin || (effectiveUserId && authorId === effectiveUserId)
    if (!canDelete) {
      toast({
        title: 'Ação não permitida',
        description: 'Você só pode excluir registros criados por você mesmo.',
        variant: 'destructive',
      })
      return
    }

    if (!confirm('Deseja excluir esta entrada da timeline?')) return

    try {
      await pb.collection('opportunity_notes').delete(noteId)
      toast({
        title: 'Registro excluído',
        description: 'A entrada foi removida da timeline.',
      })
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
      fetchNotes()
    } catch (err) {
      console.error('Erro ao excluir nota da timeline:', err)
      const errorMsg = getErrorMessage(err)
      toast({
        title: 'Erro ao excluir',
        description: errorMsg || 'Não foi possível remover este registro.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Timeline de Conversas & Interações
          </h4>
          <span className="text-[10px] text-gray-400 bg-[#181B24] px-2 py-0.5 rounded-full border border-[#262A33]">
            {notes.length}
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowForm(!showForm)}
          className="h-7 text-xs border-indigo-500/30 text-indigo-300 hover:text-white hover:bg-indigo-600/20 rounded-lg px-2.5"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          {showForm ? 'Fechar' : 'Nova Interação'}
        </Button>
      </div>

      {/* Formulário de Adição */}
      {showForm && (
        <form
          onSubmit={handleAddNote}
          className="p-3.5 rounded-xl bg-[#0A0C11] border border-indigo-500/30 space-y-3 animate-fadeIn"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-300">Tipo de Interação</label>
              <Select value={type} onValueChange={(val) => setType(val as OpportunityNote['type'])}>
                <SelectTrigger className="h-8 text-xs bg-[#12141A] border-[#262A33] text-white rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                  <SelectItem value="ligacao">📞 Ligação Feita</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp Enviado</SelectItem>
                  <SelectItem value="reuniao">👥 Reunião Realizada</SelectItem>
                  <SelectItem value="nota">📝 Anotação / Nota</SelectItem>
                  <SelectItem value="outro">⏱️ Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-300 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-indigo-400" />
                Data e Hora
              </label>
              <Input
                type="datetime-local"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="h-8 text-xs bg-[#12141A] border-[#262A33] text-white rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-300">
              O que foi conversado / acordado?
            </label>
            <Textarea
              placeholder="Ex.: Liguei para o contato e apresentei a proposta comercial. Cliente pediu para retornar na quinta-feira após reunião com sócio..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[70px] text-xs bg-[#12141A] border-[#262A33] text-white rounded-lg placeholder:text-gray-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowForm(false)
                setText('')
              }}
              className="h-7 text-xs text-gray-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !text.trim()}
              className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 rounded-lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar na Timeline'
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Lista da Timeline */}
      {loading ? (
        <div className="py-6 flex items-center justify-center text-gray-500 text-xs">
          <Loader2 className="w-4 h-4 mr-2 animate-spin text-indigo-400" />
          Carregando timeline...
        </div>
      ) : notes.length === 0 ? (
        <div className="py-6 text-center border border-dashed border-[#262A33] rounded-xl bg-[#0A0C11]/50 text-gray-500 text-xs space-y-1">
          <Clock className="w-5 h-5 mx-auto text-gray-600 mb-1" />
          <p>Nenhuma conversa registrada ainda.</p>
          <p className="text-[11px] text-gray-600">
            Clique em &ldquo;Nova Interação&rdquo; para registrar ligações, WhatsApp ou reuniões com
            este lead.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#262A33]">
          {notes.map((item) => {
            const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.outro
            const Icon = config.icon
            const effectiveUserId = currentUserId || pb.authStore.record?.id
            const canDelete = isAdmin || (effectiveUserId && item.author === effectiveUserId)
            const authorName = item.expand?.author?.name || item.expand?.author?.email || 'Usuário'

            return (
              <div key={item.id} className="relative group text-xs">
                {/* Marcador na linha do tempo */}
                <div
                  className={`absolute -left-6 top-1 w-5 h-5 rounded-full ${config.bg} border ${config.border} flex items-center justify-center ${config.color}`}
                >
                  <Icon className="w-2.5 h-2.5" />
                </div>

                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] group-hover:border-[#383E4E] transition-all space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${config.bg} ${config.color} ${config.border}`}
                      >
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        por <strong className="text-gray-300 font-semibold">{authorName}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 font-mono">
                        {formatDateBR(item.date || item.created)}
                      </span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(item.id, item.author)}
                          title="Excluir entrada"
                          className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-200 text-xs whitespace-pre-wrap leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
