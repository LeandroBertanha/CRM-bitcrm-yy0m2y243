import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Play, Copy, Check, HelpCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import type { PlaybookScript } from '@/types/playbook'
import { ScriptCard } from '@/components/approach/ScriptCard'

export default function PitchPage() {
  const [pitchScript, setPitchScript] = useState<PlaybookScript | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const records = await pb.collection('playbook_scripts').getFullList<PlaybookScript>({
          filter: 'title ~ "Pitch" && is_active = true',
          sort: 'display_order',
        })
        if (records.length > 0) {
          setPitchScript(records[0])
        }
      } catch (err) {
        console.error('Erro ao carregar pitch:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        Carregando Pitch de 30 Segundos...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Pitch de 30 Segundos</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Apresentação direta, sem enrolação, destacando o valor e os diferenciais.
            </p>
          </div>
        </div>

        <Button
          asChild
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-bold"
        >
          <Link to="/abordagem">
            <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
            Usar no Copiloto
          </Link>
        </Button>
      </div>

      {pitchScript && (
        <ScriptCard
          title={pitchScript.title}
          situation={pitchScript.situation}
          scriptText={pitchScript.script_text}
          instructions="AGORA FAÇA UMA PERGUNTA. Não tente fechar a venda neste momento; devolva a palavra ao cliente com uma pergunta de diagnóstico."
          highlight={true}
        />
      )}

      {/* Regras e Boas Práticas do Pitch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] space-y-1.5">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
            1. Clareza Imediata
          </span>
          <p className="text-xs text-gray-300">
            Em menos de 10 segundos o cliente já sabe o que é (site/landing page profissional) e
            para que serve (novos contatos no WhatsApp).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] space-y-1.5">
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
            2. Transparência de Preço
          </span>
          <p className="text-xs text-gray-300">
            A partir de R$ 500,00 + R$ 55,00/mês. Isso elimina a objeção de &quot;deve custar
            milhares de reais&quot; imediatamente.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] space-y-1.5">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
            3. Devolução da Palavra
          </span>
          <p className="text-xs text-gray-300">
            Nunca termine o pitch no silêncio ou pedindo compra. Pergunte: &quot;Hoje vocês já têm
            site ou usam mais o Instagram?&quot;.
          </p>
        </div>
      </div>
    </div>
  )
}
