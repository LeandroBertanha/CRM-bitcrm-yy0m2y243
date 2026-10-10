import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { HelpCircle, Search, Play, Copy, Check, Filter, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import pb from '@/lib/pocketbase/client'
import type { PlaybookQuestion } from '@/types/playbook'

export default function DiagnosisPage() {
  const [questions, setQuestions] = useState<PlaybookQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'todos' | 'diagnóstico' | 'qualificação'>('todos')
  const [filterProduct, setFilterProduct] = useState<string>('todos')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await pb.collection('playbook_questions').getFullList<PlaybookQuestion>({
          filter: 'is_active = true',
          sort: 'display_order',
          expand: 'product',
        })
        setQuestions(data)
      } catch (err) {
        console.error('Erro ao carregar perguntas:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = questions.filter((q) => {
    if (filterType !== 'todos' && q.type !== filterType) return false
    if (filterProduct === 'whatsapp') {
      const pName = (q.product_name || '').toLowerCase()
      if (
        !pName.includes('whatsapp') &&
        !pName.includes('autônomo') &&
        !pName.includes('autonomo')
      ) {
        return false
      }
    } else if (filterProduct === 'site') {
      const pName = (q.product_name || '').toLowerCase()
      if (pName.includes('whatsapp') || pName.includes('autônomo')) return false
      if (!pName.includes('site') && (q.product || q.product_name)) return false
    } else if (filterProduct === 'generico') {
      if (q.product || q.product_name) return false
    }
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      q.text.toLowerCase().includes(term) ||
      (q.category || '').toLowerCase().includes(term) ||
      (q.triggers || '').toLowerCase().includes(term) ||
      (q.product_name || '').toLowerCase().includes(term)
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

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        Carregando perguntas de diagnóstico e qualificação...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">
              Perguntas de Diagnóstico & Qualificação
            </h1>
            <p className="text-xs sm:text-sm text-gray-400">
              Biblioteca completa do banco. Escolha entre 3 e 6 perguntas conforme a conversa.
            </p>
          </div>
        </div>

        <Button
          asChild
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-bold"
        >
          <Link to="/abordagem">
            <Play className="w-3.5 h-3.5 mr-1.5 fill-white" />
            Abrir no Copiloto
          </Link>
        </Button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <Input
            placeholder="Pesquisar perguntas (ex: Google, Instagram, fotos, decisor)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-[#12141A] p-1 rounded-xl border border-[#262A33]">
            {[
              { id: 'todos', label: 'Todos Produtos' },
              { id: 'whatsapp', label: 'WhatsApp Autônomo' },
              { id: 'site', label: 'Sites & Geral' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setFilterProduct(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterProduct === p.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-[#12141A] p-1 rounded-xl border border-[#262A33]">
            {(['todos', 'diagnóstico', 'qualificação'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filterType === type
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de Perguntas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filtered.map((q, idx) => {
          const isCopied = copiedId === q.id
          return (
            <div
              key={q.id}
              className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] hover:border-indigo-500/40 transition-all flex flex-col justify-between gap-3 shadow-md group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#181B24] border border-[#262A33] text-indigo-400">
                      {q.type} {q.category ? `• ${q.category}` : ''}
                    </span>
                    {q.product_name && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {q.product_name}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">#{idx + 1}</span>
                </div>
                <p className="text-sm font-semibold text-white leading-snug group-hover:text-indigo-200 transition-colors">
                  &quot;{q.text}&quot;
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#262A33]/70">
                <span className="text-[11px] text-gray-500 truncate max-w-[200px]">
                  {q.triggers ? `Gatilhos: ${q.triggers}` : 'Geral'}
                </span>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopy(q.id, q.text)}
                  className="h-7 px-2.5 text-xs text-gray-400 hover:text-white"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
