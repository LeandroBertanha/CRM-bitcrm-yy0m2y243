import React from 'react'
import {
  Sparkles,
  Copy,
  Check,
  Building,
  User,
  Phone,
  MapPin,
  HelpCircle,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PersonalizedPitchData } from '@/types/playbook'

export interface PersonalizedPitchModalProps {
  data: PersonalizedPitchData | null
  companyName?: string
  contactName?: string
  city?: string
  phone?: string
  onClose: () => void
}

export const PersonalizedPitchCard: React.FC<PersonalizedPitchModalProps> = ({
  data,
  companyName,
  contactName,
  city,
  phone,
  onClose,
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null)

  if (!data) return null

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // Ignora erro
    }
  }

  const sections: {
    key: string
    title: string
    icon: React.ComponentType<{ className?: string }>
    text: string
    color: string
  }[] = [
    {
      key: 'abertura',
      title: 'Abertura Personalizada',
      icon: MessageSquare,
      text: data.abertura,
      color: 'text-indigo-400',
    },
    {
      key: 'pergunta1',
      title: 'Pergunta Diagnóstica 1',
      icon: HelpCircle,
      text: data.pergunta1,
      color: 'text-blue-400',
    },
    {
      key: 'pergunta2',
      title: 'Pergunta de Destaque 2',
      icon: HelpCircle,
      text: data.pergunta2,
      color: 'text-cyan-400',
    },
    {
      key: 'pitch',
      title: 'Pitch Direto de 30s',
      icon: Sparkles,
      text: data.pitch,
      color: 'text-amber-400',
    },
    {
      key: 'argumento',
      title: 'Argumento de Valor',
      icon: Check,
      text: data.argumento,
      color: 'text-emerald-400',
    },
    {
      key: 'objecao',
      title: `Possível Objeção: "${data.possivelObjecao.objecao}"`,
      icon: ShieldAlert,
      text: `Esclarecimento: "${data.possivelObjecao.clarificacao}"\nTratamento: ${data.possivelObjecao.argumento}`,
      color: 'text-rose-400',
    },
    {
      key: 'proximo',
      title: 'Próximo Passo Recomendado',
      icon: ArrowRight,
      text: data.proximoPasso,
      color: 'text-purple-400',
    },
  ]

  return (
    <div className="rounded-2xl border border-indigo-500/40 bg-[#12141A] p-5 shadow-2xl space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between pb-3 border-b border-[#262A33]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Roteiro de Abordagem Personalizado
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-0.5">
              {companyName && (
                <span className="flex items-center gap-1 text-gray-300 font-medium">
                  <Building className="w-3 h-3 text-indigo-400" />
                  {companyName}
                </span>
              )}
              {contactName && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-500" />
                  {contactName}
                </span>
              )}
              {city && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-500" />
                  {city}
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-gray-500" />
                  {phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onClose}
          className="text-xs border-[#262A33] text-gray-400 hover:text-white h-8 rounded-xl"
        >
          Fechar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {sections.map((sec) => {
          const Icon = sec.icon
          const isCopied = copiedKey === sec.key
          return (
            <div
              key={sec.key}
              className="p-3.5 rounded-xl bg-[#0E1017] border border-[#262A33] hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${sec.color}`}
                >
                  <Icon className="w-3 h-3" />
                  {sec.title}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(sec.key, sec.text)}
                  className="h-6 px-2 text-[10px] text-gray-400 hover:text-white"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-line font-normal">
                {sec.text}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
