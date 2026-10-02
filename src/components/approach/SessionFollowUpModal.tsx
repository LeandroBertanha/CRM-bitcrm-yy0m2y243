import React, { useState } from 'react'
import {
  Calendar,
  Clock,
  Check,
  Building,
  User,
  ArrowRight,
  PlusCircle,
  AlertTriangle,
} from 'lucide-react'
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
import type { ApproachStatus } from '@/types/playbook'

export interface SessionFollowUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyName: string
  contactName: string
  phone: string
  currentStatus: ApproachStatus
  existingOppId?: string
  onSaveFollowUp: (data: {
    status: ApproachStatus
    returnDate: string
    returnTime: string
    notes: string
    createOppIfMissing: boolean
    needs: string
    interests: string
    decisionMaker: string
  }) => Promise<void>
}

export const SessionFollowUpModal: React.FC<SessionFollowUpModalProps> = ({
  open,
  onOpenChange,
  companyName,
  contactName,
  phone,
  currentStatus,
  existingOppId,
  onSaveFollowUp,
}) => {
  const [status, setStatus] = useState<ApproachStatus>(currentStatus || 'Retorno agendado')
  const [returnDate, setReturnDate] = useState('')
  const [returnTime, setReturnTime] = useState('14:00')
  const [notes, setNotes] = useState('')
  const [needs, setNeeds] = useState('')
  const [interests, setInterests] = useState('')
  const [decisionMaker, setDecisionMaker] = useState('')
  const [createOpp, setCreateOpp] = useState(!existingOppId)
  const [submitting, setSubmitting] = useState(false)

  // Atalhos rápidos de data (Hoje +2h, Amanhã, Sexta, Próxima Semana)
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
    setSubmitting(true)
    try {
      await onSaveFollowUp({
        status,
        returnDate,
        returnTime,
        notes,
        createOppIfMissing: createOpp,
        needs,
        interests,
        decisionMaker,
      })
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-lg rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <span>Agendar Retorno & Concluir Abordagem</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            {companyName ? `Empresa: ${companyName}` : 'Registre o próximo contato e observações'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Status do Atendimento */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-300">Status do Atendimento</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as ApproachStatus)}>
              <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                {[
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
                ].map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Atalhos Rápidos para Agendamento */}
          <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Agendar Retorno (Follow-up)
              </span>
              <span className="text-[10px] text-gray-500">Integrado ao CRM</span>
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
                <Label className="text-[10px] text-gray-400">Data do Retorno</Label>
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

          {/* Qualificação Rápida */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-gray-400">Decisor Mapeado</Label>
              <Input
                placeholder="Ex: Carlos (Dono/Sócio)"
                value={decisionMaker}
                onChange={(e) => setDecisionMaker(e.target.value)}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-gray-400">Interesse Principal</Label>
              <Input
                placeholder="Ex: Landing Page / WhatsApp"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-9"
              />
            </div>
          </div>

          {/* Observações da Sessão */}
          <div className="space-y-1">
            <Label className="text-xs text-gray-300">Resumo / Próximos Passos</Label>
            <Textarea
              placeholder="Ex: Cliente gostou dos R$ 500, vai alinhar com a esposa/sócia na quinta e pediu retorno sexta às 10h."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[70px]"
            />
          </div>

          {/* Criar Oportunidade no CRM se não existir */}
          {!existingOppId && (
            <label className="flex items-center gap-2 p-3 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-xs text-indigo-300 cursor-pointer">
              <input
                type="checkbox"
                checked={createOpp}
                onChange={(e) => setCreateOpp(e.target.checked)}
                className="rounded border-[#262A33] text-indigo-600 focus:ring-0 w-4 h-4"
              />
              <span className="font-medium">
                Criar automaticamente uma nova oportunidade no Pipeline (Estágio Novo) com esses
                dados
              </span>
            </label>
          )}

          <DialogFooter className="pt-2 border-t border-[#262A33] flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs border-[#262A33] text-gray-300 h-9"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9"
            >
              {submitting ? 'Salvando...' : 'Salvar e Concluir Abordagem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
