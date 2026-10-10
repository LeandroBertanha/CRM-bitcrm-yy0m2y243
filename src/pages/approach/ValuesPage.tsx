import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import pb from '@/lib/pocketbase/client'
import type { PlaybookValues } from '@/types/playbook'
import { ValuesCard } from '@/components/approach/ValuesCard'

export default function ValuesPage() {
  const [valuesList, setValuesList] = useState<PlaybookValues[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const data = await pb.collection('playbook_values').getFullList<PlaybookValues>({
          filter: 'is_active = true',
          sort: 'display_order,created',
          expand: 'product',
        })
        setValuesList(data)
      } catch (err) {
        console.error('Erro ao carregar valores do playbook:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const valuesConfig = valuesList[selectedIdx] || null
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

      {valuesList.length > 1 && (
        <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[#12141A] border border-[#262A33] overflow-x-auto">
          {valuesList.map((val, idx) => (
            <button
              key={val.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                selectedIdx === idx
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
              }`}
            >
              {val.product_name || val.title}
            </button>
          ))}
        </div>
      )}

      <ValuesCard
        valuesConfig={valuesConfig}
        productName={valuesConfig?.product_name || valuesConfig?.title}
      />
    </div>
  )
}
