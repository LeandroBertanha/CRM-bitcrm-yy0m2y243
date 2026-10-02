import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import type { PlaybookValues } from '@/types/playbook'
import { ValuesCard } from '@/components/approach/ValuesCard'

export default function ValuesPage() {
  const [valuesConfig, setValuesConfig] = useState<PlaybookValues | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await pb.collection('playbook_values').getFullList<PlaybookValues>({
          filter: 'is_active = true',
          limit: 1,
        })
        if (data.length > 0) {
          setValuesConfig(data[0])
        }
      } catch (err) {
        console.error('Erro ao carregar valores:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        Carregando estrutura de valores...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Tabela de Valores & Inclusões</h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Criação a partir de R$ 500,00 e mensalidade de R$ 55,00/mês com domínio, hospedagem e
              suporte.
            </p>
          </div>
        </div>

        <Button
          asChild
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-bold"
        >
          <Link to="/abordagem">
            <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
            Iniciar Abordagem
          </Link>
        </Button>
      </div>

      <ValuesCard valuesConfig={valuesConfig} />
    </div>
  )
}
