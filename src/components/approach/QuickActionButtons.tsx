import React from 'react'
import {
  Sparkles,
  PhoneCall,
  Calendar,
  DollarSign,
  Send,
  Users,
  CheckCircle,
  FileText,
  ThumbsUp,
  Globe,
  Instagram,
} from 'lucide-react'

export interface QuickActionButtonsProps {
  onTagClick: (tag: string) => void
  activeTags: string[]
  onOpenObjections: () => void
  onOpenValues: () => void
  onOpenPersonalizedPitch: () => void
  onOpenFollowUpModal: () => void
}

export const QuickActionButtons: React.FC<QuickActionButtonsProps> = ({
  onTagClick,
  activeTags,
  onOpenObjections,
  onOpenValues,
  onOpenPersonalizedPitch,
  onOpenFollowUpModal,
}) => {
  const quickActions = [
    {
      id: 'interessado',
      label: 'INTERESSADO',
      icon: ThumbsUp,
      color: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-600/30',
      activeColor: 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/50',
    },
    {
      id: 'já tem site',
      label: 'JÁ TEM SITE',
      icon: Globe,
      color: 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30',
      activeColor: 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-950/50',
    },
    {
      id: 'já tem instagram',
      label: 'JÁ TEM INSTAGRAM',
      icon: Instagram,
      color: 'bg-pink-600/20 text-pink-300 border-pink-500/40 hover:bg-pink-600/30',
      activeColor: 'bg-pink-600 text-white border-pink-400 shadow-md shadow-pink-950/50',
    },
    {
      id: 'achou caro',
      label: 'ACHOU CARO',
      icon: DollarSign,
      color: 'bg-amber-600/20 text-amber-300 border-amber-500/40 hover:bg-amber-600/30',
      activeColor: 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950/50',
    },
    {
      id: 'quer ver exemplos',
      label: 'QUER VER EXEMPLOS',
      icon: Send,
      color: 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30',
      activeColor: 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/50',
    },
    {
      id: 'falar com sócio',
      label: 'FALAR COM SÓCIO',
      icon: Users,
      color: 'bg-violet-600/20 text-violet-300 border-violet-500/40 hover:bg-violet-600/30',
      activeColor: 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-950/50',
    },
  ]

  return (
    <div className="space-y-3">
      {/* Botões Rápidos de Registro Durante a Ligação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {quickActions.map((qa) => {
          const Icon = qa.icon
          const isActive = activeTags.includes(qa.id)
          return (
            <button
              key={qa.id}
              type="button"
              onClick={() => onTagClick(qa.id)}
              className={`p-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[46px] select-none text-center ${
                isActive ? qa.activeColor : qa.color
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{qa.label}</span>
            </button>
          )
        })}
      </div>

      {/* Botões Principais de Navegação do Modo Copiloto */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
        <button
          type="button"
          onClick={onOpenObjections}
          className="p-3.5 rounded-xl bg-[#17141A] border border-rose-500/40 hover:border-rose-500 text-rose-300 hover:text-white hover:bg-rose-950/40 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          CLIENTE APRESENTOU UMA OBJEÇÃO
        </button>

        <button
          type="button"
          onClick={onOpenValues}
          className="p-3.5 rounded-xl bg-[#101A15] border border-emerald-500/40 hover:border-emerald-500 text-emerald-300 hover:text-white hover:bg-emerald-950/40 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          VER VALORES (R$ 500 / R$ 55)
        </button>

        <button
          type="button"
          onClick={onOpenFollowUpModal}
          className="p-3.5 rounded-xl bg-[#141824] border border-indigo-500/40 hover:border-indigo-500 text-indigo-300 hover:text-white hover:bg-indigo-950/40 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-sm"
        >
          <Calendar className="w-4 h-4 text-indigo-400" />
          AGENDAR RETORNO (FOLLOW-UP)
        </button>

        <button
          type="button"
          onClick={onOpenPersonalizedPitch}
          className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30"
        >
          <Sparkles className="w-4 h-4" />
          GERAR ABORDAGEM PERSONALIZADA
        </button>
      </div>
    </div>
  )
}
