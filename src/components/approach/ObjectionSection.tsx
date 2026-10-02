import React, { useState } from 'react'
import {
  ShieldAlert,
  Search,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { PlaybookObjection } from '@/types/playbook'

export interface ObjectionSectionProps {
  objections: PlaybookObjection[]
  activeObjectionName?: string
  onSelectObjection: (objection: PlaybookObjection, subScenarioText?: string) => void
  onClearActiveObjection?: () => void
}

export const ObjectionSection: React.FC<ObjectionSectionProps> = ({
  objections,
  activeObjectionName,
  onSelectObjection,
  onClearActiveObjection,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = objections.filter((ob) => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return true
    return (
      ob.name.toLowerCase().includes(term) ||
      (ob.clarification_question || '').toLowerCase().includes(term) ||
      ob.treatment_script.toLowerCase().includes(term)
    )
  })

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      // Ignora erro
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
  }

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-[#12141A] p-5 shadow-xl space-y-4">
      {/* Cabeçalho e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#262A33]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">
              Tratamento de Objeções
            </h3>
            <p className="text-xs text-gray-400">
              Perguntas de esclarecimento e roteiros prontos de contorno
            </p>
          </div>
        </div>

        {activeObjectionName && onClearActiveObjection && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onClearActiveObjection}
            className="text-xs border-rose-500/30 text-rose-300 hover:bg-rose-950/40 h-8 rounded-xl"
          >
            Limpar objeção ativa ({activeObjectionName})
          </Button>
        )}
      </div>

      {/* Campo de Busca Rápida de Situação / Objeção */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          placeholder="Pesquisar situação ou objeção (ex: Instagram, Preço, Sócio, Sem tempo, Site)..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10 placeholder:text-gray-500 focus:border-rose-500/60"
        />
      </div>

      {/* Botões Rápidos de Acesso Direto para as Principais Objeções */}
      <div className="flex flex-wrap gap-2 pt-1">
        {objections.slice(0, 8).map((ob) => {
          const isSelected = activeObjectionName === ob.name
          return (
            <button
              key={ob.id}
              type="button"
              onClick={() => {
                onSelectObjection(ob)
                setExpandedId(ob.id)
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isSelected
                  ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-950/40'
                  : 'bg-[#171A24] border-[#262A33] text-gray-300 hover:text-white hover:border-rose-500/50 hover:bg-[#1C1620]'
              }`}
            >
              {ob.name}
            </button>
          )
        })}
      </div>

      {/* Lista com Acordeões */}
      <div className="space-y-2.5 pt-2">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-gray-500 rounded-xl bg-[#0E1017] border border-[#262A33]">
            Nenhuma objeção encontrada para o termo pesquisado.
          </div>
        ) : (
          filtered.map((ob) => {
            const isExpanded = expandedId === ob.id || activeObjectionName === ob.name
            const isSelected = activeObjectionName === ob.name

            return (
              <div
                key={ob.id}
                className={`rounded-xl border transition-all ${
                  isSelected
                    ? 'border-rose-500/60 bg-[#161217]'
                    : isExpanded
                      ? 'border-[#383D4D] bg-[#141720]'
                      : 'border-[#262A33] bg-[#0E1017] hover:border-[#383D4D]'
                }`}
              >
                {/* Cabeçalho do Card da Objeção */}
                <div
                  onClick={() => {
                    toggleExpand(ob.id)
                    onSelectObjection(ob)
                  }}
                  className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isSelected ? 'bg-rose-400 animate-pulse' : 'bg-rose-500/40'
                      }`}
                    />
                    <span className="text-xs sm:text-sm font-bold text-white block truncate">
                      {ob.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 hidden sm:inline">
                      {isExpanded ? 'Recolher' : 'Ver Tratamento'}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Conteúdo Expandido */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-[#262A33]/70 space-y-3 text-xs animate-fadeIn">
                    {/* Pergunta de esclarecimento (obrigatória quando houver) */}
                    {ob.clarification_question && (
                      <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-900/40 text-amber-200">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block mb-1">
                          1º Passo: Pergunte para Esclarecer
                        </span>
                        <p className="text-xs sm:text-sm font-medium">
                          &quot;{ob.clarification_question}&quot;
                        </p>
                      </div>
                    )}

                    {/* Script de tratamento */}
                    <div className="p-3 rounded-xl bg-[#0A0B0E] border border-[#262A33] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                          2º Passo: Argumento / Resposta de Contorno
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopy(ob.id, ob.treatment_script)}
                          className="h-6 px-2 text-[10px] text-gray-400 hover:text-white"
                        >
                          {copiedId === ob.id ? (
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
                        {ob.treatment_script}
                      </p>
                    </div>

                    {/* Subcenários (ex: inicial vs mensal no "Está caro") */}
                    {ob.sub_scenarios && ob.sub_scenarios.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                          Ramificações da resposta:
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {ob.sub_scenarios.map((sub, i) => (
                            <div
                              key={i}
                              onClick={() => onSelectObjection(ob, sub.script)}
                              className="p-2.5 rounded-lg bg-[#181B24] border border-[#262A33] hover:border-indigo-500/50 cursor-pointer transition-all"
                            >
                              <span className="text-[11px] font-semibold text-indigo-300 block mb-0.5">
                                {sub.scenario}
                              </span>
                              <p className="text-xs text-gray-300">&quot;{sub.script}&quot;</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
