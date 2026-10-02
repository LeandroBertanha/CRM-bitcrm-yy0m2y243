import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import type { PlaybookScript } from '@/types/playbook'
import { ScriptCard } from '@/components/approach/ScriptCard'

export default function InPersonApproachPage() {
  const [scripts, setScripts] = useState<PlaybookScript[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await pb.collection('playbook_scripts').getFullList<PlaybookScript>({
          filter: 'channel = "Presencial" && is_active = true',
          sort: 'display_order',
        })
        setScripts(data)
      } catch (err) {
        console.error('Erro ao carregar scripts:', err)
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
        Carregando abordagem presencial...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Abordagem Presencial</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Roteiros para visitas em comércio local, balcão e contato direto com responsáveis.
            </p>
          </div>
        </div>

        <Button
          asChild
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-bold"
        >
          <Link to="/abordagem?channel=Presencial">
            <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
            Iniciar Visita com Copiloto
          </Link>
        </Button>
      </div>

      <div className="space-y-4">
        {scripts.map((sc) => (
          <ScriptCard
            key={sc.id}
            title={sc.title}
            situation={sc.situation}
            scriptText={sc.script_text}
            instructions={sc.instructions}
            highlight={sc.title.includes('Inicial')}
          />
        ))}
      </div>
    </div>
  )
}
