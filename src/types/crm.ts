import type { RecordModel } from 'pocketbase'

export interface OpportunityNote extends RecordModel {
  opportunity: string
  author: string
  type: 'ligacao' | 'whatsapp' | 'reuniao' | 'nota' | 'outro'
  text: string
  date: string
  expand?: {
    author?: {
      id: string
      name?: string
      email?: string
      role?: string
      avatar?: string
    }
  }
}

export interface Opportunity extends RecordModel {
  company: string
  stage: 'Novo' | 'Qualificado' | 'Agendado' | 'Proposta' | 'Ganho' | 'Perdido'
  source:
    | 'Formulário Público'
    | 'Indicação'
    | 'Site'
    | 'WhatsApp'
    | 'Evento'
    | 'Prospecção'
    | 'Outro'
  value: number
  seller?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  city?: string
  payment_type?: 'Débito' | 'PIX' | 'Parcelado' | string
  payment_installments?: number | null
  message?: string
  return_at?: string | null
  expand?: {
    seller?: {
      id: string
      name?: string
      email?: string
    }
  }
}

export const STAGE_CONFIG: Record<
  Opportunity['stage'],
  { label: string; color: string; border: string; bg: string; dot: string }
> = {
  Novo: {
    label: 'Novo',
    color: 'text-slate-300',
    border: 'border-slate-700/60',
    bg: 'bg-slate-800/40',
    dot: 'bg-slate-400',
  },
  Qualificado: {
    label: 'Qualificado',
    color: 'text-blue-300',
    border: 'border-blue-700/50',
    bg: 'bg-blue-950/40',
    dot: 'bg-blue-400',
  },
  Agendado: {
    label: 'Agendado',
    color: 'text-cyan-300',
    border: 'border-cyan-700/50',
    bg: 'bg-cyan-950/40',
    dot: 'bg-cyan-400',
  },
  Proposta: {
    label: 'Proposta',
    color: 'text-amber-300',
    border: 'border-amber-700/50',
    bg: 'bg-amber-950/40',
    dot: 'bg-amber-400',
  },
  Ganho: {
    label: 'Ganho',
    color: 'text-emerald-300',
    border: 'border-emerald-700/50',
    bg: 'bg-emerald-950/40',
    dot: 'bg-emerald-400',
  },
  Perdido: {
    label: 'Perdido',
    color: 'text-rose-300',
    border: 'border-rose-700/50',
    bg: 'bg-rose-950/40',
    dot: 'bg-rose-400',
  },
}

export const STAGES: Opportunity['stage'][] = [
  'Novo',
  'Qualificado',
  'Agendado',
  'Proposta',
  'Ganho',
  'Perdido',
]

export const SOURCES: Opportunity['source'][] = [
  'Formulário Público',
  'Indicação',
  'Site',
  'WhatsApp',
  'Evento',
  'Prospecção',
  'Outro',
]
export const formatBRL = (val: number | null | undefined): string => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val)
}

export const formatDateBR = (isoDate: string): string => {
  if (!isoDate) return ''
  try {
    const d = new Date(isoDate)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch {
    return isoDate
  }
}

export type ReturnStatus = 'none' | 'overdue' | 'today' | 'upcoming' | 'completed'

export interface ReturnAlertInfo {
  status: ReturnStatus
  label: string
  formattedDate: string
  badgeClass: string
  isActionable: boolean
}

/**
 * Formata a data/hora do alerta de retorno em pt-BR (ex: "12/05 14:30")
 */
export const formatReturnAt = (dateStr?: string | null): string => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const mins = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month} ${hours}:${mins}`
  } catch {
    return ''
  }
}

/**
 * Avalia o status do Alerta de Retorno (return_at) considerando:
 * - Se não há return_at => 'none'
 * - Se a oportunidade está fechada (Ganho ou Perdido) => 'completed' (não destaca atraso nem hoje)
 * - Se data < início de hoje ou já passou da hora hoje => se data/hora já passou: 'overdue' se hoje ainda não passou ou se é no mesmo dia:
 *   Requisito do usuário:
 *   "retorno de HOJE = destaque (âmbar/laranja); retorno VENCIDO (data/hora já passou e a oportunidade ainda está em estágio aberto: Novo/Qualificado/Agendado/Proposta) = vermelho com rótulo "Retorno atrasado"; oportunidades em Ganho/Perdido não devem destacar alerta vencido."
 */
export const getReturnAlertInfo = (
  returnAt?: string | null,
  stage?: Opportunity['stage'],
): ReturnAlertInfo => {
  if (!returnAt) {
    return {
      status: 'none',
      label: '',
      formattedDate: '',
      badgeClass: '',
      isActionable: false,
    }
  }

  const formattedDate = formatReturnAt(returnAt)
  const isClosed = stage === 'Ganho' || stage === 'Perdido'

  if (isClosed) {
    return {
      status: 'completed',
      label: `Retorno: ${formattedDate}`,
      formattedDate,
      badgeClass: 'bg-slate-800/60 text-slate-400 border-slate-700/60',
      isActionable: false,
    }
  }

  const returnDate = new Date(returnAt)
  if (isNaN(returnDate.getTime())) {
    return {
      status: 'none',
      label: '',
      formattedDate: '',
      badgeClass: '',
      isActionable: false,
    }
  }

  const now = new Date()

  // Se a data/hora já passou do momento atual
  const isPast = returnDate.getTime() < now.getTime()

  // Verifica se é hoje (mesmo ano, mês e dia)
  const isToday =
    returnDate.getFullYear() === now.getFullYear() &&
    returnDate.getMonth() === now.getMonth() &&
    returnDate.getDate() === now.getDate()

  if (isPast) {
    return {
      status: 'overdue',
      label: `Retorno atrasado: ${formattedDate}`,
      formattedDate,
      badgeClass:
        'bg-rose-950/70 text-rose-300 border-rose-600/60 shadow-sm shadow-rose-900/30 font-semibold',
      isActionable: true,
    }
  }

  if (isToday) {
    return {
      status: 'today',
      label: `Retorno hoje: ${formattedDate}`,
      formattedDate,
      badgeClass:
        'bg-amber-950/70 text-amber-300 border-amber-600/60 shadow-sm shadow-amber-900/30 font-semibold',
      isActionable: true,
    }
  }

  // Futuro além de hoje
  return {
    status: 'upcoming',
    label: `Retorno: ${formattedDate}`,
    formattedDate,
    badgeClass: 'bg-indigo-950/50 text-indigo-300 border-indigo-700/50',
    isActionable: true,
  }
}
