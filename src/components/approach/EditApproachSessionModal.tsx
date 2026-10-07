import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Flame,
  SunMedium,
  ThermometerSnowflake,
  Clock,
  Building,
  Edit,
  Save,
  Loader2,
} from 'lucide-react'
import type {
  ApproachSession,
  ApproachStatus,
  LeadTemperature,
  ApproachChannel,
} from '@/types/playbook'
import { STAGES, STAGE_CONFIG, type Opportunity } from '@/types/crm'

export interface EditApproachSessionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: ApproachSession | null
  opportunities: Opportunity[]
  onSave: (updatedData: {
    temperature?: LeadTemperature
    temperature_reason?: string
    status: ApproachStatus
    next_action?: string
    next_contact_at?: string | null
    notes?: string
    opportunity?: string | null
    stage?: Opportunity['stage']
  }) => Promise<void>
}

const APPROACH_STATUSES: ApproachStatus[] = [
  'Não abordado',
  'Tentativa de contato',
  'Contato realizado',
  'Diagnóstico realizado',
  'Interessado',
  'Exemplos enviados',
  'Reunião agendada',
  'Retorno agendado',
  'Proposta solicitada',
  'Proposta enviada',
  'Negociação',
  'Fechado',
  'Sem interesse',
  'Perdido',
]

export const EditApproachSessionModal: React.FC<EditApproachSessionModalProps> = ({
  open,
  onOpenChange,
  session,
  opportunities,
  onSave,
}) => {
  const [temperature, setTemperature] = useState<LeadTemperature>('morno')
  const [temperatureReason, setTemperatureReason] = useState('')
  const [status, setStatus] = useState<ApproachStatus>('Contato realizado')
  const [nextAction, setNextAction] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [returnTime, setReturnTime] = useState('10:00')
  const [notes, setNotes] = useState('')
  const [selectedOppId, setSelectedOppId] = useState<string>('none')
  const [selectedStage, setSelectedStage] = useState<Opportunity['stage']>('Novo')
  const [submitting, setSubmitting] = useState(false)

  // Encontrar oportunidade selecionada na lista
  const selectedOpp = opportunities.find((o) => o.id === selectedOppId)
  const currentOppStage = selectedOpp?.stage

  useEffect(() => {
    if (session) {
      setTemperature(session.temperature || 'morno')
      setTemperatureReason(session.temperature_reason || '')
      setStatus(session.status || 'Contato realizado')
      setNextAction(session.next_action || '')
      setNotes(session.notes || '')
      const oppId = session.opportunity || 'none'
      setSelectedOppId(oppId)

      const matched = opportunities.find((o) => o.id === oppId)
      const stageFromOpp = (matched?.stage || session.expand?.opportunity?.stage) as
        | Opportunity['stage']
        | undefined
      if (stageFromOpp && STAGES.includes(stageFromOpp)) {
        setSelectedStage(stageFromOpp)
      } else {
        setSelectedStage('Novo')
      }

      if (session.next_contact_at) {
        try {
          const dt = new Date(session.next_contact_at)
          if (!isNaN(dt.getTime())) {
            const y = dt.getFullYear()
            const m = String(dt.getMonth() + 1).padStart(2, '0')
            const d = String(dt.getDate()).padStart(2, '0')
            const hh = String(dt.getHours()).padStart(2, '0')
            const mm = String(dt.getMinutes()).padStart(2, '0')
            setReturnDate(`${y}-${m}-${d}`)
            setReturnTime(`${hh}:${mm}`)
          } else {
            setReturnDate('')
            setReturnTime('10:00')
          }
        } catch {
          setReturnDate('')
          setReturnTime('10:00')
        }
      } else {
        setReturnDate('')
        setReturnTime('10:00')
      }
    }
  }, [session, open])

  // Atualizar selectedStage ao mudar a oportunidade selecionada
  const handleOpportunityChange = (oppId: string) => {
    setSelectedOppId(oppId)
    if (oppId !== 'none') {
      const opp = opportunities.find((o) => o.id === oppId)
      if (opp?.stage && STAGES.includes(opp.stage)) {
        setSelectedStage(opp.stage)
      }
    }
  }

  // Atalhos rápidos de data
  const setQuickDate = (daysAhead: number, defaultTime = '10:00') => {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    setReturnDate(`${year}-${month}-${day}`)
    setReturnTime(defaultTime)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session) return

    setSubmitting(true)
    try {
      let nextContactIso: string | null = null
      if (returnDate) {
        const [y, m, d] = returnDate.split('-').map(Number)
        const [hh, mm] = (returnTime || '10:00').split(':').map(Number)
        const dateObj = new Date(y, m - 1, d, hh || 10, mm || 0)
        nextContactIso = dateObj.toISOString()
      }

      await onSave({
        temperature,
        temperature_reason: temperatureReason.trim(),
        status,
        next_action: nextAction.trim(),
        next_contact_at: nextContactIso,
        notes: notes.trim(),
        opportunity: selectedOppId === 'none' ? null : selectedOppId,
        stage: selectedOppId !== 'none' ? selectedStage : undefined,
      })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl custom-scrollbar">
        {(() => {
          const companyDisplay =
            session?.expand?.opportunity?.company || session?.company_name || 'Empresa sem nome'
          return (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Edit className="w-5 h-5 text-indigo-400" />
                  <span>Editar Sessão de Abordagem</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-400">
                  {companyDisplay !== 'Empresa sem nome'
                    ? `Editando abordagem de "${companyDisplay}"`
                    : 'Altere as informações da abordagem e mantenha a oportunidade sincronizada.'}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 py-2">
                {/* Informações fixas / identificação */}
                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Empresa</span>
                    <span className="font-semibold text-gray-200">{companyDisplay}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Canal</span>
                    <span className="font-semibold text-gray-200">{session?.channel || '—'}</span>
                  </div>
                  {session?.contact_name && (
                    <div>
                      <span className="text-[10px] text-gray-500 block">Contato</span>
                      <span className="text-gray-300">{session.contact_name}</span>
                    </div>
                  )}
                  {session?.contact_phone && (
                    <div>
                      <span className="text-[10px] text-gray-500 block">Telefone</span>
                      <span className="text-gray-300">{session.contact_phone}</span>
                    </div>
                  )}
                </div>

                {/* Oportunidade Vinculada */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    Oportunidade Vinculada no Pipeline
                  </Label>
                  <Select value={selectedOppId} onValueChange={handleOpportunityChange}>
                    <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                      <SelectValue placeholder="Selecione uma oportunidade" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs max-h-60">
                      <SelectItem value="none">Nenhuma oportunidade vinculada</SelectItem>
                      {opportunities.map((opp) => (
                        <SelectItem key={opp.id} value={opp.id}>
                          {opp.company} {opp.contact_name ? `(${opp.contact_name})` : ''} — Estágio:{' '}
                          {opp.stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-gray-400">
                    Vincular a uma oportunidade sincroniza a linha do tempo e permite alterar seu
                    estágio diretamente por aqui.
                  </p>
                </div>

                {/* Seletor de Estágio do Pipeline (visível quando há oportunidade vinculada) */}
                {selectedOppId !== 'none' && (
                  <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-indigo-200">
                        Estágio no Pipeline (Kanban)
                      </Label>
                      {currentOppStage && (
                        <span className="text-[11px] text-gray-400">
                          Atual:{' '}
                          <span className="font-semibold text-gray-200">{currentOppStage}</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {STAGES.map((stg) => {
                        const cfg = STAGE_CONFIG[stg]
                        const isSelected = selectedStage === stg
                        return (
                          <button
                            key={stg}
                            type="button"
                            onClick={() => setSelectedStage(stg)}
                            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all text-left ${
                              isSelected
                                ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-1 ring-indigo-500 shadow-md`
                                : 'bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white hover:border-[#3A3F50]'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="truncate">{cfg.label}</span>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-gray-400">
                      O card no kanban será movido em tempo real para o estágio selecionado e uma
                      nota será registrada na timeline.
                    </p>
                  </div>
                )}

                {/* Status / Desfecho */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">Status / Desfecho da Abordagem</Label>
                  <Select value={status} onValueChange={(val) => setStatus(val as ApproachStatus)}>
                    <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs max-h-64">
                      {APPROACH_STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(status === 'Perdido' || status === 'Sem interesse') && (
                    <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/40 text-[11px] text-rose-300">
                      A oportunidade vinculada será marcada automaticamente como{' '}
                      <strong>Perdido</strong> no pipeline.
                    </div>
                  )}
                  {status === 'Fechado' && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-[11px] text-emerald-300">
                      A oportunidade vinculada será marcada automaticamente como{' '}
                      <strong>Ganho</strong> no pipeline.
                    </div>
                  )}
                  {(status === 'Proposta solicitada' ||
                    status === 'Proposta enviada' ||
                    status === 'Negociação') && (
                    <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/40 text-[11px] text-amber-300">
                      A oportunidade vinculada será movida para a coluna <strong>Proposta</strong>{' '}
                      no pipeline.
                    </div>
                  )}
                  {(status === 'Reunião agendada' || status === 'Retorno agendado') && (
                    <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-900/40 text-[11px] text-cyan-300">
                      A oportunidade vinculada será movida para a coluna <strong>Agendado</strong>{' '}
                      no pipeline.
                    </div>
                  )}
                </div>

                {/* Temperatura do Lead */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-300">Temperatura do Lead</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTemperature('quente')}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        temperature === 'quente'
                          ? 'bg-rose-950/70 text-rose-300 border-rose-500 shadow-md shadow-rose-950/50'
                          : 'bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white'
                      }`}
                    >
                      <Flame className="w-3.5 h-3.5 text-rose-400" />
                      Quente
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemperature('morno')}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        temperature === 'morno'
                          ? 'bg-amber-950/70 text-amber-300 border-amber-500 shadow-md shadow-amber-950/50'
                          : 'bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white'
                      }`}
                    >
                      <SunMedium className="w-3.5 h-3.5 text-amber-400" />
                      Morno
                    </button>
                    <button
                      type="button"
                      onClick={() => setTemperature('frio')}
                      className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        temperature === 'frio'
                          ? 'bg-sky-950/70 text-sky-300 border-sky-500 shadow-md shadow-sky-950/50'
                          : 'bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white'
                      }`}
                    >
                      <ThermometerSnowflake className="w-3.5 h-3.5 text-sky-400" />
                      Frio
                    </button>
                  </div>
                </div>

                {/* Motivo da Temperatura */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-gray-300">Motivo da Temperatura</Label>
                  <Input
                    placeholder="Ex: Demonstrou alto interesse, necessidade clara identificada."
                    value={temperatureReason}
                    onChange={(e) => setTemperatureReason(e.target.value)}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-9"
                  />
                </div>

                {/* Próxima Ação */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-gray-300">Próxima Ação</Label>
                  <Input
                    placeholder="Ex: Criar proposta, Enviar portfólio, Ligar na sexta..."
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-9"
                  />
                </div>

                {/* Data do Próximo Contato (Agendamento) */}
                <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      Data do Próximo Contato (Follow-up)
                    </span>
                    {returnDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnDate('')
                          setReturnTime('10:00')
                        }}
                        className="text-[10px] text-rose-400 hover:underline"
                      >
                        Limpar data
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setQuickDate(0, '16:00')}
                      className="px-2.5 py-1 rounded-lg bg-[#181B24] border border-[#262A33] hover:border-indigo-500/50 text-[11px] text-gray-300 hover:text-white"
                    >
                      Hoje 16:00
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDate(1, '10:00')}
                      className="px-2.5 py-1 rounded-lg bg-[#181B24] border border-[#262A33] hover:border-indigo-500/50 text-[11px] text-gray-300 hover:text-white"
                    >
                      Amanhã 10:00
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDate(2, '14:30')}
                      className="px-2.5 py-1 rounded-lg bg-[#181B24] border border-[#262A33] hover:border-indigo-500/50 text-[11px] text-gray-300 hover:text-white"
                    >
                      Em 2 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickDate(7, '10:00')}
                      className="px-2.5 py-1 rounded-lg bg-[#181B24] border border-[#262A33] hover:border-indigo-500/50 text-[11px] text-gray-300 hover:text-white"
                    >
                      Próxima Semana
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-[10px] text-gray-400">Data</Label>
                      <Input
                        type="date"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-9 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-400">Horário</Label>
                      <Input
                        type="time"
                        value={returnTime}
                        onChange={(e) => setReturnTime(e.target.value)}
                        className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-9 mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Observações da Sessão */}
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Observações e Follow-up</Label>
                  <Textarea
                    placeholder="Ex: Telefone só chama, tentou 3 vezes, cai na caixa postal..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[80px]"
                  />
                </div>

                <DialogFooter className="pt-2 border-t border-[#262A33] flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="text-xs border-[#262A33] text-gray-300 h-9 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9 rounded-xl flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Salvando e sincronizando...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Salvar Alterações
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )
        })()}
      </DialogContent>
    </Dialog>
  )
}
