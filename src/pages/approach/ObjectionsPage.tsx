import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ShieldAlert, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import type { PlaybookObjection } from '@/types/playbook'
import { ObjectionSection } from '@/components/approach/ObjectionSection'

export default function ObjectionsPage() {
  const [objections, setObjections] = useState<PlaybookObjection[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedObjection, setSelectedObjection] = useState<string | undefined>()

  useEffect(() => {
    async function load() {
      try {
        const data = await pb.collection('playbook_objections').getFullList<PlaybookObjection>({
          filter: 'is_active = true',
          sort: 'display_order',
          expand: 'product',
        })
        setObjections(data)
      } catch (err) {
        console.error('Erro ao carregar objeções:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
        Carregando biblioteca de objeções...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Biblioteca de Objeções</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Perguntas de esclarecimento obrigatórias e scripts de tratamento verbatim do banco.
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

      <ObjectionSection
        objections={objections}
        activeObjectionName={selectedObjection}
        onSelectObjection={(ob) => setSelectedObjection(ob.name)}
        onClearActiveObjection={() => setSelectedObjection(undefined)}
      />
    </div>
  )
}
