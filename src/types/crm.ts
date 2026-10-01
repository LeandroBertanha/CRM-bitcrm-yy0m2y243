import type { RecordModel } from 'pocketbase'

export interface Opportunity extends RecordModel {
  company: string
  stage: 'Novo' | 'Qualificado' | 'Proposta' | 'Ganho' | 'Perdido'
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
