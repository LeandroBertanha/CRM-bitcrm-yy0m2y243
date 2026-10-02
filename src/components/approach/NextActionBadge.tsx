import React from 'react'
import {
  Sparkles,
  ArrowRight,
  Flame,
  ThermometerSnowflake,
  SunMedium,
  CheckCircle,
} from 'lucide-react'
import type { LeadTemperature } from '@/types/playbook'

export interface NextActionBadgeProps {
  action: string
  description: string
  temperature: LeadTemperature
  temperatureReason: string
}

export const NextActionBadge: React.FC<NextActionBadgeProps> = ({
  action,
  description,
  temperature,
  temperatureReason,
}) => {
  const tempConfig: Record<
    LeadTemperature,
    {
      label: string
      bg: string
      text: string
      border: string
      icon: React.ComponentType<{ className?: string }>
    }
  > = {
    quente: {
      label: 'LEAD QUENTE',
      bg: 'bg-rose-950/40',
      text: 'text-rose-300',
      border: 'border-rose-500/50',
      icon: Flame,
    },
    morno: {
      label: 'LEAD MORNO',
      bg: 'bg-amber-950/40',
      text: 'text-amber-300',
      border: 'border-amber-500/50',
      icon: SunMedium,
    },
    frio: {
      label: 'LEAD FRIO',
      bg: 'bg-sky-950/40',
      text: 'text-sky-300',
      border: 'border-sky-500/50',
      icon: ThermometerSnowflake,
    },
  }

  const currentTemp = tempConfig[temperature] || tempConfig.morno
  const TempIcon = currentTemp.icon

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-[#12141A] p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Próxima Melhor Ação Recomendada */}
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30 shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
            Próxima Melhor Ação Sugerida
          </span>
          <h4 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-1.5 mt-0.5">
            <span>{action}</span>
            <ArrowRight className="w-4 h-4 text-indigo-400 shrink-0" />
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>

      {/* Classificação da Temperatura & Motivo */}
      <div className="flex flex-col sm:items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-[#262A33] pt-3 md:pt-0 md:pl-4">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border ${currentTemp.bg} ${currentTemp.text} ${currentTemp.border}`}
        >
          <TempIcon className="w-3.5 h-3.5" />
          <span>{currentTemp.label}</span>
        </div>
        <p className="text-[11px] text-gray-400 mt-1 max-w-xs sm:text-right font-medium">
          {temperatureReason}
        </p>
      </div>
    </div>
  )
}
