import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import type { Opportunity } from '@/types/crm'
import type {
  ApproachChannel,
  DigitalSituation,
  PlaybookBundle,
  PlaybookQuestion,
  PlaybookAnswer,
  PlaybookObjection,
  AnswerLogItem,
  ObjectionLogItem,
  ApproachStatus,
} from '@/types/playbook'
import { getPlaybookBundle, saveApproachSession } from '@/services/playbook'
import { runApproachEngine, interpolateText } from '@/services/approach-engine'
import { ScriptCard } from '@/components/approach/ScriptCard'
import { QuestionCard } from '@/components/approach/QuestionCard'
import { ObjectionSection } from '@/components/approach/ObjectionSection'
import { ValuesCard } from '@/components/approach/ValuesCard'
import { NextActionBadge } from '@/components/approach/NextActionBadge'
import { QuickActionButtons } from '@/components/approach/QuickActionButtons'
import { PersonalizedPitchCard } from '@/components/approach/PersonalizedPitchCard'
import { SessionFollowUpModal } from '@/components/approach/SessionFollowUpModal'
import {
  Phone,
  UserCheck,
  Building,
  MapPin,
  Sparkles,
  Headset,
  Play,
  RotateCcw,
  ArrowRight,
  HelpCircle,
  ShieldAlert,
  DollarSign,
  Calendar,
  Layers,
  Search,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function ApproachFlow() {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [playbook, setPlaybook] = useState<PlaybookBundle>({
    segments: [],
    scripts: [],
    questions: [],
    answers: [],
    objections: [],
    argumentsList: [],
    valuesConfig: null,
    nextSteps: [],
  })

  // Minhas oportunidades para vínculo opcional
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOppId, setSelectedOppId] = useState<string>(searchParams.get('opp') || '')

  // Estado do Início de Abordagem
  const [isCopilotActive, setIsCopilotActive] = useState(false)
  const [channel, setChannel] = useState<ApproachChannel>(
    (searchParams.get('channel') as ApproachChannel) || 'Telefone',
  )
  const [selectedSegment, setSelectedSegment] = useState<string>('Estética Automotiva')
  const [digitalSituation, setDigitalSituation] = useState<DigitalSituation>(
    'Utiliza somente Instagram',
  )
  const [customCompanyName, setCustomCompanyName] = useState('')
  const [customContactName, setCustomContactName] = useState('')
  const [customPhone, setCustomPhone] = useState('')
  const [customCity, setCustomCity] = useState('')

  // Estado do Copiloto durante a ligação
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [askedQuestions, setAskedQuestions] = useState<string[]>([])
  const [givenAnswers, setGivenAnswers] = useState<AnswerLogItem[]>([])
  const [activeObjection, setActiveObjection] = useState<string | undefined>()
  const [activeObjectionsLog, setActiveObjectionsLog] = useState<ObjectionLogItem[]>([])
  const [quickTags, setQuickTags] = useState<string[]>([])
  const [needs, setNeeds] = useState('')
  const [interests, setInterests] = useState('')
  const [decisionMaker, setDecisionMaker] = useState('')
  const [deadline, setDeadline] = useState('')
  const [budget, setBudget] = useState('')

  // Modais e gavetas
  const [showObjectionsDrawer, setShowObjectionsDrawer] = useState(false)
  const [showValuesDrawer, setShowValuesDrawer] = useState(false)
  const [showPersonalizedPitchModal, setShowPersonalizedPitchModal] = useState(false)
  const [showFollowUpModal, setShowFollowUpModal] = useState(false)

  // 1. Carregar Playbook do banco e oportunidades
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const [pbBundle, opps] = await Promise.all([
          getPlaybookBundle(),
          pb.collection('opportunities').getFullList<Opportunity>({
            sort: '-created',
            fields: 'id,company,contact_name,contact_phone,city,stage,seller',
          }),
        ])
        setPlaybook(pbBundle)
        setOpportunities(opps)

        // Se veio opp na URL, preenche os dados
        const urlOppId = searchParams.get('opp')
        if (urlOppId) {
          const matched = opps.find((o) => o.id === urlOppId)
          if (matched) {
            setSelectedOppId(matched.id)
            setCustomCompanyName(matched.company)
            setCustomContactName(matched.contact_name || '')
            setCustomPhone(matched.contact_phone || '')
            setCustomCity(matched.city || '')
          }
        }
      } catch (err) {
        console.error('Erro ao carregar playbook:', err)
        toast({
          title: 'Erro ao carregar Guia de Abordagem',
          description: 'Não foi possível carregar os dados do banco.',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [searchParams, toast])

  // Atualizar campos quando seleciona oportunidade existente
  const handleSelectOpp = (oppId: string) => {
    setSelectedOppId(oppId)
    const opp = opportunities.find((o) => o.id === oppId)
    if (opp) {
      setCustomCompanyName(opp.company)
      setCustomContactName(opp.contact_name || '')
      setCustomPhone(opp.contact_phone || '')
      setCustomCity(opp.city || '')
    }
  }

  // Objeto de contexto para interpolação
  const interpolationContext = useMemo(() => {
    return {
      sellerName: user?.name || user?.email?.split('@')[0] || 'Consultor Bit',
      companyName: customCompanyName,
      contactName: customContactName,
      segment: selectedSegment,
      city: customCity,
      phone: customPhone,
      channel,
      digitalSituation,
    }
  }, [
    user,
    customCompanyName,
    customContactName,
    selectedSegment,
    customCity,
    customPhone,
    channel,
    digitalSituation,
  ])

  // 2. Executar Motor de Decisão Desacoplado
  const decision = useMemo(() => {
    return runApproachEngine({
      channel,
      segment: selectedSegment,
      digitalSituation,
      currentQuestionIndex,
      askedQuestions,
      givenAnswers: givenAnswers.map((g) => ({ question: g.question, answer: g.answer })),
      activeObjection,
      quickTags,
      needs,
      interests,
      decisionMaker,
      deadline,
      budget,
      playbook,
      context: interpolationContext,
    })
  }, [
    channel,
    selectedSegment,
    digitalSituation,
    currentQuestionIndex,
    askedQuestions,
    givenAnswers,
    activeObjection,
    quickTags,
    needs,
    interests,
    decisionMaker,
    deadline,
    budget,
    playbook,
    interpolationContext,
  ])

  // Iniciar Copiloto
  const handleStartCopilot = () => {
    setIsCopilotActive(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Selecionar resposta do cliente
  const handleSelectAnswer = (ans: PlaybookAnswer) => {
    if (!decision.currentQuestion) return

    const newLogItem: AnswerLogItem = {
      question: decision.currentQuestion.text,
      answer: ans.answer_text,
      timestamp: new Date().toISOString(),
      recommendedArgument: ans.recommended_argument,
    }

    setGivenAnswers((prev) => [...prev, newLogItem])
    setAskedQuestions((prev) => [...prev, decision.currentQuestion!.text])
    setCurrentQuestionIndex((prev) => prev + 1)

    toast({
      title: 'Resposta registrada',
      description: `Argumento recomendado atualizado.`,
    })
  }

  // Pular para a próxima pergunta
  const handleNextQuestion = () => {
    if (decision.currentQuestion) {
      setAskedQuestions((prev) => [...prev, decision.currentQuestion!.text])
    }
    setCurrentQuestionIndex((prev) => prev + 1)
  }

  // Alternar tag rápida
  const handleToggleTag = (tag: string) => {
    setQuickTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag)
      }
      return [...prev, tag]
    })
  }

  // Selecionar objeção
  const handleSelectObjection = (ob: PlaybookObjection, subScenarioText?: string) => {
    setActiveObjection(ob.name)
    setActiveObjectionsLog((prev) => [
      ...prev,
      {
        name: ob.name,
        clarificationQuestion: ob.clarification_question,
        chosenSubScenario: subScenarioText,
        timestamp: new Date().toISOString(),
      },
    ])
    setShowObjectionsDrawer(false)

    toast({
      title: `Objeção ativa: ${ob.name}`,
      description: 'Veja o roteiro de contorno na tela principal.',
    })
  }

  // Concluir e salvar abordagem
  const handleSaveFollowUp = async (data: {
    status: ApproachStatus
    returnDate: string
    returnTime: string
    notes: string
    createOppIfMissing: boolean
    needs: string
    interests: string
    decisionMaker: string
  }) => {
    if (!user) return

    try {
      let finalOppId = selectedOppId || undefined

      // Se marcou para criar nova oportunidade e não tem opp vinculada
      if (data.createOppIfMissing && !finalOppId && (customCompanyName || 'Lead de Abordagem')) {
        let returnAtIso: string | null = null
        if (data.returnDate) {
          const [y, m, d] = data.returnDate.split('-').map(Number)
          const [h, min] = (data.returnTime || '10:00').split(':').map(Number)
          const dt = new Date(y, m - 1, d, h || 10, min || 0)
          returnAtIso = dt.toISOString()
        }

        const newOpp = await pb.collection('opportunities').create<Opportunity>({
          company: customCompanyName.trim() || 'Novo Lead Abordagem',
          stage: 'Novo',
          source: 'Prospecção',
          value: 500,
          seller: user.id,
          contact_name: customContactName.trim(),
          contact_phone: customPhone.trim(),
          city: customCity.trim(),
          message: data.notes || 'Criado automaticamente pelo Guia de Abordagem Comercial.',
          return_at: returnAtIso,
        })
        finalOppId = newOpp.id
      } else if (finalOppId && data.returnDate) {
        // Se já tinha opp e agendou retorno, atualiza return_at na opp existente
        const [y, m, d] = data.returnDate.split('-').map(Number)
        const [h, min] = (data.returnTime || '10:00').split(':').map(Number)
        const dt = new Date(y, m - 1, d, h || 10, min || 0)
        await pb.collection('opportunities').update(finalOppId, {
          return_at: dt.toISOString(),
        })

        // E cria uma nota de follow-up na timeline
        await pb.collection('opportunity_notes').create({
          opportunity: finalOppId,
          author: user.id,
          type: 'ligacao',
          text: `Retorno agendado via Guia de Abordagem para ${data.returnDate} às ${data.returnTime}. Observações: ${data.notes || 'Sem observações'}`,
          date: new Date().toISOString(),
        })
      }

      let nextContactAtIso: string | null = null
      if (data.returnDate) {
        const [y, m, d] = data.returnDate.split('-').map(Number)
        const [h, min] = (data.returnTime || '10:00').split(':').map(Number)
        const dt = new Date(y, m - 1, d, h || 10, min || 0)
        nextContactAtIso = dt.toISOString()
      }

      await saveApproachSession({
        seller: user.id,
        opportunity: finalOppId,
        company_name: customCompanyName,
        contact_name: customContactName,
        contact_phone: customPhone,
        city: customCity,
        channel,
        segment: selectedSegment,
        digital_situation: digitalSituation,
        status: data.status,
        temperature: decision.temperature,
        temperature_reason: decision.temperatureReason,
        needs: data.needs || needs,
        interests: data.interests || interests,
        decision_maker: data.decisionMaker || decisionMaker,
        deadline,
        budget,
        next_action: decision.nextBestAction,
        next_contact_at: nextContactAtIso,
        questions_asked: askedQuestions,
        answers: givenAnswers,
        objections: activeObjectionsLog,
        quick_tags: quickTags,
        notes: data.notes,
      })

      toast({
        title: 'Abordagem Registrada!',
        description: 'Sessão concluída e salva com sucesso no histórico.',
      })

      navigate('/abordagem/historico')
    } catch (err) {
      console.error('Erro ao salvar abordagem:', err)
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o registro de abordagem.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-gray-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm">Carregando Guia de Abordagem Comercial...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 animate-fadeInUp">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#262A33]">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/30">
            <Headset className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Guia de Abordagem Comercial
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Playbook Interativo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Copiloto comercial em tempo real com roteiros, perguntas, contorno de objeções e
              valores.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCopilotActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Deseja reiniciar a abordagem atual?')) {
                  setIsCopilotActive(false)
                  setAskedQuestions([])
                  setGivenAnswers([])
                  setActiveObjection(undefined)
                  setQuickTags([])
                  setCurrentQuestionIndex(0)
                }
              }}
              className="border-[#262A33] text-gray-300 hover:text-white text-xs h-9 rounded-xl"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reiniciar
            </Button>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-[#262A33] text-gray-300 hover:text-white text-xs h-9 rounded-xl"
          >
            <Link to="/abordagem/historico">Ver Histórico</Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-[#262A33] text-gray-300 hover:text-white text-xs h-9 rounded-xl"
          >
            <Link to="/abordagem/objecoes">Biblioteca de Objeções</Link>
          </Button>
        </div>
      </div>

      {/* ========================================================
          FLUXO DE INÍCIO (SE NÃO ESTIVER NO MODO COPILOTO ATIVO)
         ======================================================== */}
      {!isCopilotActive ? (
        <div className="max-w-3xl mx-auto space-y-6 pt-2">
          <div className="rounded-2xl border border-indigo-500/30 bg-[#12141A] p-6 shadow-2xl space-y-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-[#262A33]">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Configurar Nova Abordagem</h2>
                <p className="text-xs text-gray-400">
                  Defina o canal, segmento e situação do cliente para calibrar os roteiros e
                  perguntas.
                </p>
              </div>
            </div>

            {/* Etapa 1: Tipo de Contato / Canal */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                1. Tipo de Contato (Canal)
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {(
                  ['Telefone', 'Presencial', 'WhatsApp', 'Reunião', 'Retorno'] as ApproachChannel[]
                ).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`p-3 rounded-xl border text-xs font-bold transition-all ${
                      channel === ch
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/30'
                        : 'bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white hover:border-[#3A3F50]'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Etapa 2: Segmento */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                2. Segmento da Empresa
              </Label>
              <Select value={selectedSegment} onValueChange={setSelectedSegment}>
                <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs max-h-60">
                  {playbook.segments.map((seg) => (
                    <SelectItem key={seg.id} value={seg.name}>
                      {seg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Etapa 3: Situação Digital */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                3. Situação Digital Conhecida
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  'Não possui site',
                  'Utiliza somente Instagram',
                  'Utiliza somente WhatsApp',
                  'Possui site antigo',
                  'Possui site insatisfatório',
                  'Possui site e quer melhorar',
                  'Não sabemos ainda',
                ].map((sit) => (
                  <button
                    key={sit}
                    type="button"
                    onClick={() => setDigitalSituation(sit as DigitalSituation)}
                    className={`p-2.5 px-3 rounded-xl border text-xs text-left font-medium transition-all ${
                      digitalSituation === sit
                        ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500 font-bold'
                        : 'bg-[#0E1017] border-[#262A33] text-gray-400 hover:text-white'
                    }`}
                  >
                    {sit}
                  </button>
                ))}
              </div>
            </div>

            {/* Opcional: Vincular a Oportunidade Existente ou Preencher Manual */}
            <div className="p-4 rounded-xl bg-[#0E1017] border border-[#262A33] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-indigo-400" />
                  Vincular a Oportunidade Existente (Opcional)
                </span>
                <span className="text-[10px] text-gray-500">Personaliza os textos</span>
              </div>

              <Select value={selectedOppId} onValueChange={handleSelectOpp}>
                <SelectTrigger className="bg-[#12141A] border-[#262A33] text-white text-xs h-10 rounded-xl">
                  <SelectValue placeholder="Escolha uma oportunidade da carteira..." />
                </SelectTrigger>
                <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs max-h-60">
                  <SelectItem value="none">Nenhuma (Preencher dados avulsos)</SelectItem>
                  {opportunities.map((opp) => (
                    <SelectItem key={opp.id} value={opp.id}>
                      {opp.company} {opp.contact_name ? `(${opp.contact_name})` : ''} - {opp.stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Campos Rápidos para Personalização */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <div>
                  <Label className="text-[10px] text-gray-400">Nome da Empresa</Label>
                  <Input
                    placeholder="Ex: Mendes Estética Automotiva"
                    value={customCompanyName}
                    onChange={(e) => setCustomCompanyName(e.target.value)}
                    className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-9 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400">Nome do Contato</Label>
                  <Input
                    placeholder="Ex: Carlos Mendes"
                    value={customContactName}
                    onChange={(e) => setCustomContactName(e.target.value)}
                    className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-9 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400">Cidade / Região</Label>
                  <Input
                    placeholder="Ex: Carapicuíba"
                    value={customCity}
                    onChange={(e) => setCustomCity(e.target.value)}
                    className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-9 mt-1"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-gray-400">Telefone / WhatsApp</Label>
                  <Input
                    placeholder="Ex: (11) 98765-4321"
                    value={customPhone}
                    onChange={(e) => setCustomPhone(e.target.value)}
                    className="bg-[#12141A] border-[#262A33] text-white text-xs rounded-xl h-9 mt-1"
                  />
                </div>
              </div>
            </div>

            {/* BOTÃO PRINCIPAL EM DESTAQUE: INICIAR ABORDAGEM */}
            <Button
              type="button"
              onClick={handleStartCopilot}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-base sm:text-lg shadow-xl shadow-indigo-600/30 tracking-wide flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
            >
              <Play className="w-5 h-5 fill-white" />
              INICIAR ABORDAGEM (MODO COPILOTO)
            </Button>
          </div>
        </div>
      ) : (
        /* ========================================================
            MODO COPILOTO — TELA ÚNICA "ESTOU FALANDO COM O CLIENTE AGORA"
           ======================================================== */
        <div className="space-y-5 animate-fadeIn">
          {/* Barra de Status da Abordagem em Curso */}
          <div className="p-3.5 rounded-2xl bg-[#12141A] border border-[#262A33] flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Em Ligação / Atendimento:
              </span>
              <span className="text-xs font-bold text-indigo-400">
                {customCompanyName || 'Empresa em Prospecção'}
              </span>
              {customContactName && (
                <span className="text-xs text-gray-400">({customContactName})</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-lg bg-[#181B24] border border-[#262A33] text-gray-300">
                Canal: <strong className="text-white">{channel}</strong>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-[#181B24] border border-[#262A33] text-gray-300">
                Segmento: <strong className="text-white">{selectedSegment}</strong>
              </span>
            </div>
          </div>

          {/* 1. PRÓXIMA MELHOR AÇÃO & TEMPERATURA DO LEAD */}
          <NextActionBadge
            action={decision.nextBestAction}
            description={decision.nextBestActionDescription}
            temperature={decision.temperature}
            temperatureReason={decision.temperatureReason}
          />

          {/* 2. BOTÕES RÁPIDOS DURANTE A LIGAÇÃO (BOTÕES GRANDES) */}
          <QuickActionButtons
            activeTags={quickTags}
            onTagClick={handleToggleTag}
            onOpenObjections={() => setShowObjectionsDrawer(true)}
            onOpenValues={() => setShowValuesDrawer(true)}
            onOpenPersonalizedPitch={() => setShowPersonalizedPitchModal(true)}
            onOpenFollowUpModal={() => setShowFollowUpModal(true)}
          />

          {/* Seção de Abordagem Personalizada Expandida */}
          {showPersonalizedPitchModal && (
            <PersonalizedPitchCard
              data={decision.personalizedPitch || null}
              companyName={customCompanyName}
              contactName={customContactName}
              city={customCity}
              phone={customPhone}
              onClose={() => setShowPersonalizedPitchModal(false)}
            />
          )}

          {/* 3. CARD: O QUE FALAR (SCRIPT ATUAL DA ETAPA) */}
          <ScriptCard
            title={`O Que Falar Agora — ${decision.currentScriptTitle}`}
            situation={`Canal: ${channel} | Segmento: ${selectedSegment}`}
            scriptText={decision.currentScript}
            instructions="Fale de forma natural e com entusiasmo moderado. Pare imediatamente ao terminar para escutar o cliente."
            highlight
          />

          {/* 4. CARD: PERGUNTE AGORA (UMA PERGUNTA POR VEZ COM RESPOSTAS RÁPIDAS) */}
          <QuestionCard
            question={decision.currentQuestion}
            possibleAnswers={decision.possibleAnswers}
            onSelectAnswer={handleSelectAnswer}
            onNextQuestion={handleNextQuestion}
            questionNumber={currentQuestionIndex + 1}
            totalQuestions={Math.max(6, askedQuestions.length + 1)}
          />

          {/* 5. CARD: O QUE RESPONDER (ARGUMENTO RECOMENDADO BASEADO NA RESPOSTA OU OBJEÇÃO) */}
          {decision.recommendedArgument && (
            <div className="rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-[#141824] to-[#0E1017] p-5 shadow-xl space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                  O Que Responder — Argumento Recomendado
                </span>
              </div>
              <p className="text-sm sm:text-base text-gray-100 font-medium leading-relaxed italic bg-[#0A0B0E] p-3.5 rounded-xl border border-[#262A33]">
                &quot;{decision.recommendedArgument}&quot;
              </p>
            </div>
          )}

          {/* 6. GAVETA / SEÇÃO: OBJEÇÕES (QUANDO CLICADO) */}
          {showObjectionsDrawer && (
            <ObjectionSection
              objections={playbook.objections}
              activeObjectionName={activeObjection}
              onSelectObjection={handleSelectObjection}
              onClearActiveObjection={() => setActiveObjection(undefined)}
            />
          )}

          {/* 7. GAVETA / SEÇÃO: VALORES (R$ 500 / R$ 55) */}
          {showValuesDrawer && (
            <ValuesCard
              valuesConfig={playbook.valuesConfig}
              onQuestionClick={(q) => {
                toast({
                  title: 'Pergunta selecionada',
                  description: `Faça a pergunta ao cliente: "${q}"`,
                })
              }}
            />
          )}

          {/* Barra Flutuante de Fechamento / Agendamento */}
          <div className="sticky bottom-4 z-40 p-4 rounded-2xl bg-[#12141A]/95 backdrop-blur-md border border-indigo-500/40 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-white block">
                Atendimento em andamento ({givenAnswers.length} respostas registradas)
              </span>
              <span className="text-[11px] text-gray-400">
                Finalize com o agendamento de retorno para garantir o follow-up no CRM.
              </span>
            </div>

            <Button
              type="button"
              onClick={() => setShowFollowUpModal(true)}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Finalizar Abordagem & Agendar Retorno
            </Button>
          </div>

          {/* Modal de Conclusão e Follow-up */}
          <SessionFollowUpModal
            open={showFollowUpModal}
            onOpenChange={setShowFollowUpModal}
            companyName={customCompanyName}
            contactName={customContactName}
            phone={customPhone}
            currentStatus={decision.suggestedStatus}
            existingOppId={selectedOppId}
            onSaveFollowUp={handleSaveFollowUp}
          />
        </div>
      )}
    </div>
  )
}
