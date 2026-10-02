import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import type { PlaybookScript } from '@/types/playbook'
import { ScriptCard } from '@/components/approach/ScriptCard'

export default function WhatsAppApproachPage() {
  const [scripts, setScripts] = useState<PlaybookScript[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await pb.collection('playbook_scripts').getFullList<PlaybookScript>({
          filter: 'channel = "WhatsApp" && is_active = true',
          sort: 'display_order',
        })
        setScripts(data)
      } catch (err) {
        console.error('Erro ao carregar scripts WhatsApp:', err)
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
        Carregando scripts de WhatsApp...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Abordagem pelo WhatsApp</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Modelos de mensagens persuasivas de primeiro contato, envio de portfólio e retomada.
            </p>
          </div>
        </div>

        <Button
          asChild
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 rounded-xl font-bold"
        >
          <Link to="/abordagem?channel=WhatsApp">
            <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
            Iniciar Abordagem WhatsApp
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
            highlight={true}
          />
        ))}
      </div>
    </div>
  )
}
