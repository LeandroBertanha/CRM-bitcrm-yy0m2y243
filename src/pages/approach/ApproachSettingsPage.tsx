import React, { useState, useEffect } from 'react'
import {
  Settings,
  Plus,
  Trash2,
  Edit2,
  Save,
  Loader2,
  Sparkles,
  HelpCircle,
  ShieldAlert,
  Layers,
  DollarSign,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  PlaybookSegment,
  PlaybookScript,
  PlaybookQuestion,
  PlaybookObjection,
  PlaybookArgument,
  PlaybookValues,
} from '@/types/playbook'

export default function ApproachSettingsPage() {
  const { isAdmin } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<
    | 'segmentos'
    | 'scripts'
    | 'perguntas'
    | 'objecoes'
    | 'argumentos'
    | 'proximos_passos'
    | 'valores'
  >('segmentos')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Filtro de produto selecionado no painel
  // 'all': Todos os itens
  // 'generic': Apenas genéricos (sem produto vinculado)
  // '<prodId>': Itens vinculados a um produto específico
  const [productFilter, setProductFilter] = useState<string>('all')

  // Estados dos itens
  const [segments, setSegments] = useState<PlaybookSegment[]>([])
  const [scripts, setScripts] = useState<PlaybookScript[]>([])
  const [questions, setQuestions] = useState<PlaybookQuestion[]>([])
  const [objections, setObjections] = useState<PlaybookObjection[]>([])
  const [argumentsList, setArgumentsList] = useState<PlaybookArgument[]>([])
  const [nextSteps, setNextSteps] = useState<any[]>([])
  const [valuesList, setValuesList] = useState<PlaybookValues[]>([])
  const [valuesConfig, setValuesConfig] = useState<PlaybookValues | null>(null)

  // Modal genérico de criação / edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Lista de produtos para associação de scripts, perguntas, objeções, argumentos, próximos passos e valores
  const [productsList, setProductsList] = useState<Array<{ id: string; name: string }>>([])

  // Form states específicos com suporte a product / product_name
  const [segmentForm, setSegmentForm] = useState({ name: '', display_order: '1' })
  const [scriptForm, setScriptForm] = useState({
    channel: 'Telefone',
    situation: '',
    title: '',
    script_text: '',
    instructions: '',
    product: '',
    display_order: '1',
  })
  const [questionForm, setQuestionForm] = useState({
    type: 'diagnóstico',
    text: '',
    category: '',
    triggers: '',
    product: '',
    display_order: '1',
  })
  const [objectionForm, setObjectionForm] = useState({
    name: '',
    clarification_question: '',
    treatment_script: '',
    product: '',
    display_order: '1',
  })
  const [argumentForm, setArgumentForm] = useState({
    situation: '',
    argument_text: '',
    product: '',
    display_order: '1',
  })
  const [nextStepForm, setNextStepForm] = useState({
    action: '',
    description: '',
    trigger_condition: '',
    product: '',
    display_order: '1',
  })
  const [valuesForm, setValuesForm] = useState({
    title: '',
    creation_value: '500',
    monthly_value: '55',
    script: '',
    product: '',
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      setLoadError(false)
      const [segs, scrs, quests, objs, args, nSteps, vals, prods] = await Promise.all([
        pb.collection('playbook_segments').getFullList<PlaybookSegment>({ sort: 'display_order' }),
        pb.collection('playbook_scripts').getFullList<PlaybookScript>({ sort: 'display_order' }),
        pb
          .collection('playbook_questions')
          .getFullList<PlaybookQuestion>({ sort: 'display_order' }),
        pb
          .collection('playbook_objections')
          .getFullList<PlaybookObjection>({ sort: 'display_order' }),
        pb
          .collection('playbook_arguments')
          .getFullList<PlaybookArgument>({ sort: 'display_order' }),
        pb
          .collection('playbook_next_steps')
          .getFullList({ sort: 'display_order' })
          .catch(() => []),
        pb
          .collection('playbook_values')
          .getFullList<PlaybookValues>({ sort: 'display_order,created' }),
        pb
          .collection('products')
          .getFullList({ filter: 'is_active = true', sort: 'display_order,name' }),
      ])
      setSegments(segs)
      setScripts(scrs)
      setProductsList(prods.map((p) => ({ id: p.id, name: (p as any).name })))
      setQuestions(quests)
      setObjections(objs)
      setArgumentsList(args)
      setNextSteps(nSteps)
      setValuesList(vals)
      if (vals.length > 0) {
        setValuesConfig(vals[0])
        setValuesForm({
          title: vals[0].title,
          creation_value: String(vals[0].creation_value),
          monthly_value: String(vals[0].monthly_value),
          script: vals[0].script,
          product: vals[0].product || '',
        })
      }
    } catch (err) {
      console.error('Erro ao carregar dados de configuração:', err)
      setLoadError(true)
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as configurações do playbook.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenAdd = () => {
    setEditingItem(null)
    const initialProduct =
      productFilter !== 'all' && productFilter !== 'generic' ? productFilter : ''
    if (activeTab === 'segmentos') {
      setSegmentForm({ name: '', display_order: String(segments.length + 1) })
    } else if (activeTab === 'scripts') {
      setScriptForm({
        channel: 'Telefone',
        situation: '',
        title: '',
        script_text: '',
        instructions: '',
        product: initialProduct,
        display_order: String(scripts.length + 1),
      })
    } else if (activeTab === 'perguntas') {
      setQuestionForm({
        type: 'diagnóstico',
        text: '',
        category: '',
        triggers: '',
        product: initialProduct,
        display_order: String(questions.length + 1),
      })
    } else if (activeTab === 'objecoes') {
      setObjectionForm({
        name: '',
        clarification_question: '',
        treatment_script: '',
        product: initialProduct,
        display_order: String(objections.length + 1),
      })
    } else if (activeTab === 'argumentos') {
      setArgumentForm({
        situation: '',
        argument_text: '',
        product: initialProduct,
        display_order: String(argumentsList.length + 1),
      })
    } else if (activeTab === 'proximos_passos') {
      setNextStepForm({
        action: '',
        description: '',
        trigger_condition: '',
        product: initialProduct,
        display_order: String(nextSteps.length + 1),
      })
    } else if (activeTab === 'valores') {
      setValuesForm({
        title: '',
        creation_value: '500',
        monthly_value: '55',
        script: '',
        product: initialProduct,
      })
    }
    setModalOpen(true)
  }

  const handleOpenEdit = (item: any) => {
    setEditingItem(item)
    if (activeTab === 'segmentos') {
      setSegmentForm({ name: item.name, display_order: String(item.display_order) })
    } else if (activeTab === 'scripts') {
      setScriptForm({
        channel: item.channel,
        situation: item.situation || '',
        title: item.title,
        script_text: item.script_text,
        instructions: item.instructions || '',
        product: item.product || '',
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'perguntas') {
      setQuestionForm({
        type: item.type,
        text: item.text,
        category: item.category || '',
        triggers: item.triggers || '',
        product: item.product || '',
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'objecoes') {
      setObjectionForm({
        name: item.name,
        clarification_question: item.clarification_question || '',
        treatment_script: item.treatment_script,
        product: item.product || '',
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'argumentos') {
      setArgumentForm({
        situation: item.situation,
        argument_text: item.argument_text,
        product: item.product || '',
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'proximos_passos') {
      setNextStepForm({
        action: item.action,
        description: item.description || '',
        trigger_condition: item.trigger_condition || '',
        product: item.product || '',
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'valores') {
      setValuesForm({
        title: item.title,
        creation_value: String(item.creation_value),
        monthly_value: String(item.monthly_value),
        script: item.script || '',
        product: item.product || '',
      })
    }
    setModalOpen(true)
  }

  const handleDelete = async (collection: string, id: string) => {
    if (!confirm('Deseja realmente excluir este item do playbook?')) return
    try {
      await pb.collection(collection).delete(id)
      toast({ title: 'Item removido' })
      fetchData()
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (activeTab === 'segmentos') {
        const payload = {
          name: segmentForm.name.trim(),
          display_order: parseInt(segmentForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_segments').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_segments').create(payload)
        }
      } else if (activeTab === 'scripts') {
        const matchedProduct = productsList.find((p) => p.id === scriptForm.product)
        const payload = {
          channel: scriptForm.channel,
          situation: scriptForm.situation.trim(),
          title: scriptForm.title.trim(),
          script_text: scriptForm.script_text.trim(),
          instructions: scriptForm.instructions.trim(),
          product: scriptForm.product || null,
          product_name: matchedProduct ? matchedProduct.name : '',
          display_order: parseInt(scriptForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_scripts').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_scripts').create(payload)
        }
      } else if (activeTab === 'perguntas') {
        const matchedProduct = productsList.find((p) => p.id === questionForm.product)
        const payload = {
          type: questionForm.type,
          text: questionForm.text.trim(),
          category: questionForm.category.trim(),
          triggers: questionForm.triggers.trim(),
          product: questionForm.product || null,
          product_name: matchedProduct ? matchedProduct.name : '',
          display_order: parseInt(questionForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_questions').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_questions').create(payload)
        }
      } else if (activeTab === 'objecoes') {
        const matchedProduct = productsList.find((p) => p.id === objectionForm.product)
        const payload = {
          name: objectionForm.name.trim(),
          clarification_question: objectionForm.clarification_question.trim(),
          treatment_script: objectionForm.treatment_script.trim(),
          product: objectionForm.product || null,
          product_name: matchedProduct ? matchedProduct.name : '',
          display_order: parseInt(objectionForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_objections').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_objections').create(payload)
        }
      } else if (activeTab === 'argumentos') {
        const matchedProduct = productsList.find((p) => p.id === argumentForm.product)
        const payload = {
          situation: argumentForm.situation.trim(),
          argument_text: argumentForm.argument_text.trim(),
          product: argumentForm.product || null,
          product_name: matchedProduct ? matchedProduct.name : '',
          display_order: parseInt(argumentForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_arguments').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_arguments').create(payload)
        }
      } else if (activeTab === 'proximos_passos') {
        const matchedProduct = productsList.find((p) => p.id === nextStepForm.product)
        const payload = {
          action: nextStepForm.action.trim(),
          description: nextStepForm.description.trim(),
          trigger_condition: nextStepForm.trigger_condition.trim(),
          product: nextStepForm.product || null,
          product_name: matchedProduct ? matchedProduct.name : '',
          display_order: parseInt(nextStepForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_next_steps').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_next_steps').create(payload)
        }
      } else if (activeTab === 'valores') {
        const matchedProduct = productsList.find((p) => p.id === valuesForm.product)
        const payload = {
          title: valuesForm.title.trim(),
          creation_value: parseFloat(valuesForm.creation_value) || 500,
          monthly_value: parseFloat(valuesForm.monthly_value) || 55,
          script: valuesForm.script.trim(),
          product: valuesForm.product || null,
          product_name: matchedProduct ? matchedProduct.name : '',
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_values').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_values').create(payload)
        }
      }

      toast({ title: 'Salvo com sucesso!' })
      setModalOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // Função auxiliar para testar se um item passa no filtro por produto
  const matchesProductFilter = (item: { product?: string; product_name?: string }) => {
    if (productFilter === 'all') return true
    if (productFilter === 'generic') {
      return !item.product && !item.product_name
    }
    // Filtro por ID de produto ou comparação de nome
    if (item.product && item.product === productFilter) return true
    const selectedProd = productsList.find((p) => p.id === productFilter)
    if (selectedProd && item.product_name) {
      return item.product_name.toLowerCase().trim() === selectedProd.name.toLowerCase().trim()
    }
    return false
  }

  // Itens filtrados para cada seção
  const filteredScripts = scripts.filter(matchesProductFilter)
  const filteredQuestions = questions.filter(matchesProductFilter)
  const filteredObjections = objections.filter(matchesProductFilter)
  const filteredArguments = argumentsList.filter(matchesProductFilter)
  const filteredNextSteps = nextSteps.filter(matchesProductFilter)
  const filteredValues = valuesList.filter(matchesProductFilter)

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
        Carregando painel de configurações do playbook...
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Banner de erro com retry se falhar */}
      {loadError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Falha ao carregar as configurações do playbook comercial do banco de dados.</span>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={fetchData}
            className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-7 px-3 rounded-lg"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-white">Configurações do Playbook</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                Exclusivo Admin
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400">
              Edite segmentos, scripts, perguntas, objeções, argumentos, próximos passos e valores
              por produto lidos do catálogo.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleOpenAdd}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-bold"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Adicionar Novo Item
        </Button>
      </div>

      {/* Barra de Filtro por Produto (Dinâmico do Banco) */}
      <div className="p-3.5 rounded-2xl bg-[#12141A] border border-[#262A33] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-gray-300">Filtrar conteúdo por produto:</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setProductFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              productFilter === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
            }`}
          >
            Todos os Produtos
          </button>

          {productsList.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProductFilter(p.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                productFilter === p.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
              }`}
            >
              {p.name}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setProductFilter('generic')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              productFilter === 'generic'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
            }`}
          >
            Geral / Sem Produto
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-[#12141A] p-1.5 rounded-2xl border border-[#262A33]">
        {[
          { id: 'segmentos', label: 'Segmentos' },
          { id: 'scripts', label: `Scripts & Canais (${filteredScripts.length})` },
          { id: 'perguntas', label: `Perguntas (${filteredQuestions.length})` },
          { id: 'objecoes', label: `Objeções (${filteredObjections.length})` },
          { id: 'argumentos', label: `Argumentos (${filteredArguments.length})` },
          { id: 'proximos_passos', label: `Próximos Passos (${filteredNextSteps.length})` },
          { id: 'valores', label: `Valores Comerciais (${filteredValues.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white hover:bg-[#1A1D27]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO DAS TABS */}
      {/* 1. SEGMENTOS */}
      {activeTab === 'segmentos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {segments.map((seg) => (
            <div
              key={seg.id}
              className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between gap-2"
            >
              <div>
                <span className="text-xs font-bold text-white block">{seg.name}</span>
                <span className="text-[10px] text-gray-500">Ordem: {seg.display_order}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleOpenEdit(seg)}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete('playbook_segments', seg.id)}
                  className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. SCRIPTS */}
      {activeTab === 'scripts' && (
        <div className="space-y-3">
          {filteredScripts.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 bg-[#12141A] rounded-xl border border-[#262A33]">
              Nenhum script encontrado para este filtro de produto.
            </div>
          ) : (
            filteredScripts.map((sc) => {
              const prodName =
                sc.product_name || productsList.find((p) => p.id === sc.product)?.name
              return (
                <div
                  key={sc.id}
                  className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                          {sc.channel} • {sc.title}
                        </span>
                        {prodName ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            Produto: {prodName}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold">
                            Geral (Sem Produto)
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500">Ordem: {sc.display_order}</span>
                      </div>
                      {sc.situation && (
                        <p className="text-xs text-gray-400 mt-0.5">{sc.situation}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(sc)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete('playbook_scripts', sc.id)}
                        className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-200 whitespace-pre-line mt-1 bg-[#0A0B0E] p-3 rounded-lg border border-[#262A33]">
                    {sc.script_text}
                  </p>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 3. PERGUNTAS */}
      {activeTab === 'perguntas' && (
        <div className="space-y-3">
          {filteredQuestions.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 bg-[#12141A] rounded-xl border border-[#262A33]">
              Nenhuma pergunta encontrada para este filtro de produto.
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const prodName = q.product_name || productsList.find((p) => p.id === q.product)?.name
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#181B24] border border-[#262A33] text-indigo-400">
                        {q.type}
                      </span>
                      {q.category && <span className="text-xs text-gray-400">• {q.category}</span>}
                      {prodName ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          {prodName}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold">
                          Geral
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">#{q.display_order}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-white mt-1">
                      &quot;{q.text}&quot;
                    </p>
                    {q.triggers && (
                      <p className="text-[11px] text-gray-500 mt-0.5">Gatilhos: {q.triggers}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(q)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete('playbook_questions', q.id)}
                      className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 4. OBJEÇÕES */}
      {activeTab === 'objecoes' && (
        <div className="space-y-3">
          {filteredObjections.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 bg-[#12141A] rounded-xl border border-[#262A33]">
              Nenhuma objeção encontrada para este filtro de produto.
            </div>
          ) : (
            filteredObjections.map((ob) => {
              const prodName =
                ob.product_name || productsList.find((p) => p.id === ob.product)?.name
              return (
                <div
                  key={ob.id}
                  className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-rose-400">{ob.name}</span>
                      {prodName ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          {prodName}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold">
                          Geral
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">Ordem: {ob.display_order}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(ob)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete('playbook_objections', ob.id)}
                        className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {ob.clarification_question && (
                    <p className="text-xs text-amber-300">
                      <strong>Pergunta de Esclarecimento:</strong> &quot;{ob.clarification_question}
                      &quot;
                    </p>
                  )}
                  <p className="text-xs text-gray-300 bg-[#0A0B0E] p-2.5 rounded-lg border border-[#262A33]">
                    {ob.treatment_script}
                  </p>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 5. ARGUMENTOS */}
      {activeTab === 'argumentos' && (
        <div className="space-y-3">
          {filteredArguments.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 bg-[#12141A] rounded-xl border border-[#262A33]">
              Nenhum argumento encontrado para este filtro de produto.
            </div>
          ) : (
            filteredArguments.map((arg) => {
              const prodName =
                arg.product_name || productsList.find((p) => p.id === arg.product)?.name
              return (
                <div
                  key={arg.id}
                  className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-indigo-400">{arg.situation}</span>
                      {prodName ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          {prodName}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold">
                          Geral
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">Ordem: {arg.display_order}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(arg)}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete('playbook_arguments', arg.id)}
                        className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-200 italic">&quot;{arg.argument_text}&quot;</p>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 6. PRÓXIMOS PASSOS */}
      {activeTab === 'proximos_passos' && (
        <div className="space-y-3">
          {filteredNextSteps.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 bg-[#12141A] rounded-xl border border-[#262A33]">
              Nenhum próximo passo encontrado para este filtro de produto.
            </div>
          ) : (
            filteredNextSteps.map((step) => {
              const prodName =
                step.product_name || productsList.find((p) => p.id === step.product)?.name
              return (
                <div
                  key={step.id}
                  className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-emerald-400">{step.action}</span>
                      {prodName ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                          {prodName}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold">
                          Geral
                        </span>
                      )}
                      <span className="text-[10px] text-gray-500">Ordem: {step.display_order}</span>
                    </div>
                    <p className="text-xs text-gray-200">{step.description}</p>
                    {step.trigger_condition && (
                      <p className="text-[11px] text-amber-300/90">
                        Condição: {step.trigger_condition}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(step)}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete('playbook_next_steps', step.id)}
                      className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* 7. VALORES COMERCIAIS */}
      {activeTab === 'valores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Estruturas comerciais cadastradas. A comissão é apurada apenas sobre o valor de
              setup/criação (R$ 500,00).
            </p>
            <Button
              type="button"
              size="sm"
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar Nova Estrutura
            </Button>
          </div>

          {filteredValues.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400 bg-[#12141A] rounded-xl border border-[#262A33]">
              Nenhuma estrutura de valores encontrada para este filtro de produto.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredValues.map((val) => {
                const prodName =
                  val.product_name || productsList.find((p) => p.id === val.product)?.name
                return (
                  <div
                    key={val.id}
                    className="p-5 rounded-2xl bg-[#12141A] border border-[#262A33] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold text-white">{val.title}</h3>
                            {prodName ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                {prodName}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 font-semibold">
                                Estrutura Padrão
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(val)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete('playbook_values', val.id)}
                            className="h-8 w-8 p-0 text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                            Criação / Setup
                          </span>
                          <span className="text-base font-extrabold text-white">
                            R${' '}
                            {Number(val.creation_value || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="text-[10px] text-emerald-400 block mt-0.5 font-medium">
                            Base de comissão
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-[#0E1017] border border-[#262A33]">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold block">
                            Mensalidade Técnica
                          </span>
                          <span className="text-base font-extrabold text-white">
                            R${' '}
                            {Number(val.monthly_value || 0).toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                            })}
                            <span className="text-xs font-normal text-gray-400">/mês</span>
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">
                            Fora da comissão
                          </span>
                        </div>
                      </div>

                      {val.script && (
                        <div className="mt-2 p-3 rounded-xl bg-[#0A0B0E] border border-[#262A33]">
                          <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">
                            Script Verbal
                          </span>
                          <p className="text-xs text-gray-300 line-clamp-3">{val.script}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Genérico de Criação/Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#12141A] border-[#262A33] text-white max-w-lg rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              {editingItem ? 'Editar Item do Playbook' : 'Adicionar Novo Item'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="space-y-4 py-2">
            {/* Campos dinâmicos conforme activeTab */}
            {activeTab === 'segmentos' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Nome do Segmento</Label>
                  <Input
                    value={segmentForm.name}
                    onChange={(e) => setSegmentForm({ ...segmentForm, name: e.target.value })}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Ordem de Exibição</Label>
                  <Input
                    type="number"
                    value={segmentForm.display_order}
                    onChange={(e) =>
                      setSegmentForm({ ...segmentForm, display_order: e.target.value })
                    }
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
              </>
            )}

            {activeTab === 'scripts' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Canal</Label>
                    <Select
                      value={scriptForm.channel}
                      onValueChange={(val) => setScriptForm({ ...scriptForm, channel: val })}
                    >
                      <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {['Telefone', 'Presencial', 'WhatsApp', 'Reunião', 'Retorno'].map((ch) => (
                          <SelectItem key={ch} value={ch}>
                            {ch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Produto Associado</Label>
                    <Select
                      value={scriptForm.product || 'none'}
                      onValueChange={(val) =>
                        setScriptForm({ ...scriptForm, product: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                        <SelectValue placeholder="Selecione um produto..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        <SelectItem value="none">Geral (qualquer produto)</SelectItem>
                        {productsList.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-gray-300">Título</Label>
                    <Input
                      value={scriptForm.title}
                      onChange={(e) => setScriptForm({ ...scriptForm, title: e.target.value })}
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Ordem</Label>
                    <Input
                      type="number"
                      value={scriptForm.display_order}
                      onChange={(e) =>
                        setScriptForm({ ...scriptForm, display_order: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Texto do Script</Label>
                  <Textarea
                    value={scriptForm.script_text}
                    onChange={(e) => setScriptForm({ ...scriptForm, script_text: e.target.value })}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[90px]"
                    required
                  />
                </div>
              </>
            )}

            {activeTab === 'perguntas' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Tipo</Label>
                    <Select
                      value={questionForm.type}
                      onValueChange={(val) => setQuestionForm({ ...questionForm, type: val })}
                    >
                      <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        {['diagnóstico', 'qualificação', 'fluxo'].map((tp) => (
                          <SelectItem key={tp} value={tp}>
                            {tp}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Produto Associado</Label>
                    <Select
                      value={questionForm.product || 'none'}
                      onValueChange={(val) =>
                        setQuestionForm({ ...questionForm, product: val === 'none' ? '' : val })
                      }
                    >
                      <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                        <SelectItem value="none">Geral (qualquer produto)</SelectItem>
                        {productsList.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-gray-300">Categoria (opcional)</Label>
                    <Input
                      value={questionForm.category}
                      onChange={(e) =>
                        setQuestionForm({ ...questionForm, category: e.target.value })
                      }
                      placeholder="Ex: Equipe de Atendimento"
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Ordem</Label>
                    <Input
                      type="number"
                      value={questionForm.display_order}
                      onChange={(e) =>
                        setQuestionForm({ ...questionForm, display_order: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Texto da Pergunta</Label>
                  <Textarea
                    value={questionForm.text}
                    onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[70px]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">
                    Gatilhos (palavras-chave separadas por vírgula)
                  </Label>
                  <Input
                    value={questionForm.triggers}
                    onChange={(e) => setQuestionForm({ ...questionForm, triggers: e.target.value })}
                    placeholder="ex: equipe,atendimento,horário"
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
              </>
            )}

            {activeTab === 'objecoes' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-gray-300">Nome da Objeção</Label>
                    <Input
                      value={objectionForm.name}
                      onChange={(e) => setObjectionForm({ ...objectionForm, name: e.target.value })}
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Ordem</Label>
                    <Input
                      type="number"
                      value={objectionForm.display_order}
                      onChange={(e) =>
                        setObjectionForm({ ...objectionForm, display_order: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Produto Associado</Label>
                  <Select
                    value={objectionForm.product || 'none'}
                    onValueChange={(val) =>
                      setObjectionForm({ ...objectionForm, product: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                      <SelectItem value="none">Geral (qualquer produto)</SelectItem>
                      {productsList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Pergunta de Esclarecimento</Label>
                  <Input
                    value={objectionForm.clarification_question}
                    onChange={(e) =>
                      setObjectionForm({
                        ...objectionForm,
                        clarification_question: e.target.value,
                      })
                    }
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Script de Tratamento</Label>
                  <Textarea
                    value={objectionForm.treatment_script}
                    onChange={(e) =>
                      setObjectionForm({ ...objectionForm, treatment_script: e.target.value })
                    }
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[90px]"
                    required
                  />
                </div>
              </>
            )}

            {activeTab === 'argumentos' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-gray-300">Situação / Gatilho</Label>
                    <Input
                      value={argumentForm.situation}
                      onChange={(e) =>
                        setArgumentForm({ ...argumentForm, situation: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Ordem</Label>
                    <Input
                      type="number"
                      value={argumentForm.display_order}
                      onChange={(e) =>
                        setArgumentForm({ ...argumentForm, display_order: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Produto Associado</Label>
                  <Select
                    value={argumentForm.product || 'none'}
                    onValueChange={(val) =>
                      setArgumentForm({ ...argumentForm, product: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                      <SelectItem value="none">Geral (qualquer produto)</SelectItem>
                      {productsList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Texto do Argumento</Label>
                  <Textarea
                    value={argumentForm.argument_text}
                    onChange={(e) =>
                      setArgumentForm({ ...argumentForm, argument_text: e.target.value })
                    }
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[90px]"
                    required
                  />
                </div>
              </>
            )}

            {activeTab === 'proximos_passos' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-gray-300">Ação Recomendada</Label>
                    <Input
                      value={nextStepForm.action}
                      onChange={(e) => setNextStepForm({ ...nextStepForm, action: e.target.value })}
                      placeholder="Ex: Agendar demonstração do atendente"
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Ordem</Label>
                    <Input
                      type="number"
                      value={nextStepForm.display_order}
                      onChange={(e) =>
                        setNextStepForm({ ...nextStepForm, display_order: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Produto Associado</Label>
                  <Select
                    value={nextStepForm.product || 'none'}
                    onValueChange={(val) =>
                      setNextStepForm({ ...nextStepForm, product: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                      <SelectItem value="none">Geral (qualquer produto)</SelectItem>
                      {productsList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Descrição</Label>
                  <Textarea
                    value={nextStepForm.description}
                    onChange={(e) =>
                      setNextStepForm({ ...nextStepForm, description: e.target.value })
                    }
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[70px]"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Condição / Gatilho</Label>
                  <Input
                    value={nextStepForm.trigger_condition}
                    onChange={(e) =>
                      setNextStepForm({ ...nextStepForm, trigger_condition: e.target.value })
                    }
                    placeholder="Ex: cliente interessado em ver demonstração prática"
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                  />
                </div>
              </>
            )}

            {activeTab === 'valores' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Título da Estrutura Comercial</Label>
                  <Input
                    value={valuesForm.title}
                    onChange={(e) => setValuesForm({ ...valuesForm, title: e.target.value })}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Produto Associado</Label>
                  <Select
                    value={valuesForm.product || 'none'}
                    onValueChange={(val) =>
                      setValuesForm({ ...valuesForm, product: val === 'none' ? '' : val })
                    }
                  >
                    <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-10 rounded-xl">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                      <SelectItem value="none">Geral / Estrutura Padrão</SelectItem>
                      {productsList.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">Setup / Criação (R$ - Base)</Label>
                    <Input
                      type="number"
                      value={valuesForm.creation_value}
                      onChange={(e) =>
                        setValuesForm({ ...valuesForm, creation_value: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-300">
                      Mensalidade Técnica (R$ - Fora da Base)
                    </Label>
                    <Input
                      type="number"
                      value={valuesForm.monthly_value}
                      onChange={(e) =>
                        setValuesForm({ ...valuesForm, monthly_value: e.target.value })
                      }
                      className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Script Verbal de Apresentação</Label>
                  <Textarea
                    value={valuesForm.script}
                    onChange={(e) => setValuesForm({ ...valuesForm, script: e.target.value })}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[90px]"
                    required
                  />
                </div>
              </>
            )}

            <DialogFooter className="pt-2 border-t border-[#262A33] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="text-xs border-[#262A33] text-gray-300 h-9"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9"
              >
                {submitting ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
