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
    'segmentos' | 'scripts' | 'perguntas' | 'objecoes' | 'argumentos' | 'valores'
  >('segmentos')

  const [loading, setLoading] = useState(true)

  // Estados dos itens
  const [segments, setSegments] = useState<PlaybookSegment[]>([])
  const [scripts, setScripts] = useState<PlaybookScript[]>([])
  const [questions, setQuestions] = useState<PlaybookQuestion[]>([])
  const [objections, setObjections] = useState<PlaybookObjection[]>([])
  const [argumentsList, setArgumentsList] = useState<PlaybookArgument[]>([])
  const [valuesConfig, setValuesConfig] = useState<PlaybookValues | null>(null)

  // Modal genérico de criação / edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states específicos
  const [segmentForm, setSegmentForm] = useState({ name: '', display_order: '1' })
  const [scriptForm, setScriptForm] = useState({
    channel: 'Telefone',
    situation: '',
    title: '',
    script_text: '',
    instructions: '',
    display_order: '1',
  })
  const [questionForm, setQuestionForm] = useState({
    type: 'diagnóstico',
    text: '',
    category: '',
    triggers: '',
    display_order: '1',
  })
  const [objectionForm, setObjectionForm] = useState({
    name: '',
    clarification_question: '',
    treatment_script: '',
    display_order: '1',
  })
  const [argumentForm, setArgumentForm] = useState({
    situation: '',
    argument_text: '',
    display_order: '1',
  })
  const [valuesForm, setValuesForm] = useState({
    title: '',
    creation_value: '500',
    monthly_value: '55',
    script: '',
  })

  const fetchData = async () => {
    try {
      setLoading(true)
      const [segs, scrs, quests, objs, args, vals] = await Promise.all([
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
        pb.collection('playbook_values').getFullList<PlaybookValues>({ limit: 1 }),
      ])
      setSegments(segs)
      setScripts(scrs)
      setQuestions(quests)
      setObjections(objs)
      setArgumentsList(args)
      if (vals.length > 0) {
        setValuesConfig(vals[0])
        setValuesForm({
          title: vals[0].title,
          creation_value: String(vals[0].creation_value),
          monthly_value: String(vals[0].monthly_value),
          script: vals[0].script,
        })
      }
    } catch (err) {
      console.error('Erro ao carregar dados de configuração:', err)
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
    if (activeTab === 'segmentos') {
      setSegmentForm({ name: '', display_order: String(segments.length + 1) })
    } else if (activeTab === 'scripts') {
      setScriptForm({
        channel: 'Telefone',
        situation: '',
        title: '',
        script_text: '',
        instructions: '',
        display_order: String(scripts.length + 1),
      })
    } else if (activeTab === 'perguntas') {
      setQuestionForm({
        type: 'diagnóstico',
        text: '',
        category: '',
        triggers: '',
        display_order: String(questions.length + 1),
      })
    } else if (activeTab === 'objecoes') {
      setObjectionForm({
        name: '',
        clarification_question: '',
        treatment_script: '',
        display_order: String(objections.length + 1),
      })
    } else if (activeTab === 'argumentos') {
      setArgumentForm({
        situation: '',
        argument_text: '',
        display_order: String(argumentsList.length + 1),
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
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'perguntas') {
      setQuestionForm({
        type: item.type,
        text: item.text,
        category: item.category || '',
        triggers: item.triggers || '',
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'objecoes') {
      setObjectionForm({
        name: item.name,
        clarification_question: item.clarification_question || '',
        treatment_script: item.treatment_script,
        display_order: String(item.display_order),
      })
    } else if (activeTab === 'argumentos') {
      setArgumentForm({
        situation: item.situation,
        argument_text: item.argument_text,
        display_order: String(item.display_order),
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
        const payload = {
          channel: scriptForm.channel,
          situation: scriptForm.situation.trim(),
          title: scriptForm.title.trim(),
          script_text: scriptForm.script_text.trim(),
          instructions: scriptForm.instructions.trim(),
          display_order: parseInt(scriptForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_scripts').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_scripts').create(payload)
        }
      } else if (activeTab === 'perguntas') {
        const payload = {
          type: questionForm.type,
          text: questionForm.text.trim(),
          category: questionForm.category.trim(),
          triggers: questionForm.triggers.trim(),
          display_order: parseInt(questionForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_questions').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_questions').create(payload)
        }
      } else if (activeTab === 'objecoes') {
        const payload = {
          name: objectionForm.name.trim(),
          clarification_question: objectionForm.clarification_question.trim(),
          treatment_script: objectionForm.treatment_script.trim(),
          display_order: parseInt(objectionForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_objections').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_objections').create(payload)
        }
      } else if (activeTab === 'argumentos') {
        const payload = {
          situation: argumentForm.situation.trim(),
          argument_text: argumentForm.argument_text.trim(),
          display_order: parseInt(argumentForm.display_order, 10) || 1,
          is_active: true,
        }
        if (editingItem) {
          await pb.collection('playbook_arguments').update(editingItem.id, payload)
        } else {
          await pb.collection('playbook_arguments').create(payload)
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

  const handleSaveValues = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        title: valuesForm.title.trim(),
        creation_value: parseFloat(valuesForm.creation_value) || 500,
        monthly_value: parseFloat(valuesForm.monthly_value) || 55,
        script: valuesForm.script.trim(),
        is_active: true,
      }

      if (valuesConfig) {
        await pb.collection('playbook_values').update(valuesConfig.id, payload)
      } else {
        await pb.collection('playbook_values').create(payload)
      }

      toast({ title: 'Valores atualizados com sucesso!' })
      fetchData()
    } catch {
      toast({ title: 'Erro ao atualizar valores', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

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
              Edite segmentos, scripts, perguntas, respostas, objeções e valores direto no banco de
              dados.
            </p>
          </div>
        </div>

        {activeTab !== 'valores' && (
          <Button
            type="button"
            onClick={handleOpenAdd}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-bold"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Adicionar Novo Item
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 bg-[#12141A] p-1.5 rounded-2xl border border-[#262A33]">
        {[
          { id: 'segmentos', label: 'Segmentos' },
          { id: 'scripts', label: 'Scripts & Canais' },
          { id: 'perguntas', label: 'Perguntas' },
          { id: 'objecoes', label: 'Objeções' },
          { id: 'argumentos', label: 'Argumentos' },
          { id: 'valores', label: 'Valores Comerciais' },
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
          {scripts.map((sc) => (
            <div
              key={sc.id}
              className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] flex flex-col justify-between gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                    {sc.channel} • {sc.title}
                  </span>
                  {sc.situation && <p className="text-xs text-gray-400">{sc.situation}</p>}
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
          ))}
        </div>
      )}

      {/* 3. PERGUNTAS */}
      {activeTab === 'perguntas' && (
        <div className="space-y-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#181B24] border border-[#262A33] text-indigo-400">
                    {q.type}
                  </span>
                  {q.category && <span className="text-xs text-gray-400">• {q.category}</span>}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-white mt-1">
                  &quot;{q.text}&quot;
                </p>
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
          ))}
        </div>
      )}

      {/* 4. OBJEÇÕES */}
      {activeTab === 'objecoes' && (
        <div className="space-y-3">
          {objections.map((ob) => (
            <div
              key={ob.id}
              className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-rose-400">{ob.name}</span>
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
          ))}
        </div>
      )}

      {/* 5. ARGUMENTOS */}
      {activeTab === 'argumentos' && (
        <div className="space-y-3">
          {argumentsList.map((arg) => (
            <div
              key={arg.id}
              className="p-4 rounded-xl bg-[#12141A] border border-[#262A33] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400">{arg.situation}</span>
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
          ))}
        </div>
      )}

      {/* 6. VALORES */}
      {activeTab === 'valores' && (
        <form
          onSubmit={handleSaveValues}
          className="p-6 rounded-2xl bg-[#12141A] border border-[#262A33] max-w-2xl space-y-4"
        >
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-300">Título do Plano Comercial</Label>
            <Input
              value={valuesForm.title}
              onChange={(e) => setValuesForm({ ...valuesForm, title: e.target.value })}
              className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Valor de Criação (R$)</Label>
              <Input
                type="number"
                value={valuesForm.creation_value}
                onChange={(e) => setValuesForm({ ...valuesForm, creation_value: e.target.value })}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-300">Mensalidade Técnica (R$)</Label>
              <Input
                type="number"
                value={valuesForm.monthly_value}
                onChange={(e) => setValuesForm({ ...valuesForm, monthly_value: e.target.value })}
                className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-gray-300">Script Verbal de Apresentação</Label>
            <Textarea
              value={valuesForm.script}
              onChange={(e) => setValuesForm({ ...valuesForm, script: e.target.value })}
              className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl min-h-[90px]"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold h-10 rounded-xl px-6"
          >
            {submitting ? 'Salvando...' : 'Salvar Configuração de Valores'}
          </Button>
        </form>
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
                  <Label className="text-xs text-gray-300">Título</Label>
                  <Input
                    value={scriptForm.title}
                    onChange={(e) => setScriptForm({ ...scriptForm, title: e.target.value })}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    required
                  />
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
              </>
            )}

            {activeTab === 'objecoes' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-300">Nome da Objeção</Label>
                  <Input
                    value={objectionForm.name}
                    onChange={(e) => setObjectionForm({ ...objectionForm, name: e.target.value })}
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs rounded-xl h-10"
                    required
                  />
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
                <div className="space-y-1">
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
