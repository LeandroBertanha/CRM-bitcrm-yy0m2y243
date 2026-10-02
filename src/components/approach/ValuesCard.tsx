import React, { useState } from 'react'
import {
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBRL } from '@/types/crm'
import type { PlaybookValues } from '@/types/playbook'

export interface ValuesCardProps {
  valuesConfig: PlaybookValues | null
  onQuestionClick?: (q: string) => void
}

export const ValuesCard: React.FC<ValuesCardProps> = ({ valuesConfig, onQuestionClick }) => {
  const [copied, setCopied] = useState(false)

  const creation = valuesConfig?.creation_value ?? 500
  const monthly = valuesConfig?.monthly_value ?? 55
  const inclusions = valuesConfig?.inclusions ?? [
    'Criação do site ou landing page profissional sob medida',
    'Domínio próprio incluso e configurado',
    'Hospedagem de alta performance inclusa',
    'Suporte técnico e apoio a atualizações contínuas',
    'Acompanhamento técnico dedicado',
  ]
  const script =
    valuesConfig?.script ??
    'O investimento funciona em dois passos muito simples: A criação do site ou landing page começa em R$ 500,00. Depois, há uma mensalidade de R$ 55,00 cobrindo hospedagem, domínio e suporte técnico contínuo.'

  const closingQuestions = valuesConfig?.closing_questions ?? [
    'Esse modelo faria sentido para sua empresa?',
    'O que você achou dessa estrutura?',
    'Esse investimento está dentro do que você imaginava?',
  ]

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(script)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignora erro
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-[#121A16] to-[#0E1311] p-5 shadow-xl space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1E2B24]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Tabela de Valores & Apresentação
            </h3>
            <p className="text-xs text-gray-400">
              Modelo claro, sem letras miúdas, com hospedagem e suporte
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCopyScript}
          className={`h-8 px-3 rounded-xl text-xs border transition-all ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-[#18241D] border-[#2A3E31] text-emerald-200 hover:text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 mr-1" />
              Copiar Script de Valores
            </>
          )}
        </Button>
      </div>

      {/* Grid de Valores Destaque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="p-4 rounded-xl bg-[#0F1813] border border-emerald-600/30 flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Criação do Site / Landing Page
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xs text-gray-400">a partir de</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {formatBRL(creation)}
            </span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1">Investimento único de implantação</span>
        </div>

        <div className="p-4 rounded-xl bg-[#0F1813] border border-emerald-600/30 flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
            Mensalidade Técnica
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight tabular-nums">
              {formatBRL(monthly)}
            </span>
            <span className="text-xs text-gray-400">/mês</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1">
            Hospedagem + Domínio + Suporte dedicado
          </span>
        </div>
      </div>

      {/* O que está incluso */}
      <div className="p-3.5 rounded-xl bg-[#0D1410] border border-[#1E2B24] space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 block">
          Inclusões do Plano:
        </span>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-200">
          {inclusions.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Script do que falar */}
      <div className="p-3.5 rounded-xl bg-[#0B0F0D] border border-[#22352A] space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
          Script de Apresentação de Valores:
        </span>
        <p className="text-xs sm:text-sm text-gray-100 leading-relaxed italic">
          &quot;{script}&quot;
        </p>
      </div>

      {/* Instrução Crucial: NÃO CONTINUE EXPLICANDO */}
      <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wide">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Regra de Ouro: Não continue explicando imediatamente!</span>
        </div>
        <p className="text-xs text-amber-100/90 leading-normal">
          Após falar os valores, faça silêncio e devolva o controle ao cliente com uma das perguntas
          abaixo:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {closingQuestions.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onQuestionClick && onQuestionClick(q)}
              className="text-left p-2.5 rounded-lg bg-[#1A1813] border border-amber-700/40 hover:border-amber-400 hover:bg-[#252015] transition-all text-xs text-amber-200 group flex items-start gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
              <span className="font-medium">&quot;{q}&quot;</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
