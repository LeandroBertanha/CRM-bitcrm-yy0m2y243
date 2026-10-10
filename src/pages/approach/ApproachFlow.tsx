import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import type { Opportunity, Product } from '@/types/crm'
import { getActiveProducts } from '@/services/productService'
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
import { getPlaybookBundle, saveApproachSession, getApproachSessions } from '@/services/playbook'
import {
  mapApproachStatusToOpportunityStage,
  syncApproachSessionWithOpportunity,
} from '@/services/approach-sync'
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
  MessageSquare,
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
import { OpportunitySelectorSection } from '@/components/approach/OpportunitySelectorSection'
import { WhatsAppCopilotAction } from '@/components/approach/WhatsAppCopilotAction'
import { buildWhatsAppMessage } from '@/lib/whatsappApproachHelper'

/**
 * Infere o segmento da oportunidade ou lead com base em palavras-chave em company, message ou notas.
 * restaurante/pizzaria/lanchonete/hamburgueria/bar/churrascaria → "Restaurante"
 * estética automotiva/polimento/detailing → "Estética Automotiva"
 * lava rápido/lava jato → "Lava-Rápido"
 * clínica/odonto/médic/saúde → "Clínica"
 * salão/hair/beleza/manicure → "Salão de Beleza"
 * barbearia/barber → "Barbearia"
 * sem padrão claro → ""
 */
export function inferSegmentFromOpportunity(data: {
  company?: string | null
  message?: string | null
  segment?: string | null
}): string {
  if (data.segment && data.segment.trim()) {
    return data.segment.trim()
  }

  const rawText = `${data.company || ''} ${data.message || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!rawText.trim()) return ''

  // 1. Restaurante e gastronomia
  if (
    rawText.includes('restaurante') ||
    rawText.includes('pizzaria') ||
    rawText.includes('lanchonete') ||
    rawText.includes('hamburgueria') ||
    rawText.includes('bar') ||
    rawText.includes('churrascaria')
  ) {
    return 'Restaurante'
  }

  // 2. Estética automotiva / detalhamento
  if (
    rawText.includes('estetica automotiva') ||
    rawText.includes('polimento') ||
    rawText.includes('detailing') ||
    rawText.includes('auto detailing') ||
    rawText.includes('espelhamento')
  ) {
    return 'Estética Automotiva'
  }

  // 3. Lava Rápido / Lava Jato
  if (
    rawText.includes('lava rapido') ||
    rawText.includes('lava jato') ||
    rawText.includes('lavarapido') ||
    rawText.includes('lavajato')
  ) {
    return 'Lava-Rápido'
  }

  // 4. Clínica / Saúde
  if (
    rawText.includes('clinica') ||
    rawText.includes('odonto') ||
    rawText.includes('medic') ||
    rawText.includes('saude')
  ) {
    return 'Clínica'
  }

  // 5. Salão de Beleza / Cabelo
  if (
    rawText.includes('salao') ||
    rawText.includes('hair') ||
    rawText.includes('beleza') ||
    rawText.includes('manicure')
  ) {
    return 'Salão de Beleza'
  }

  // 6. Barbearia
  if (rawText.includes('barbearia') || rawText.includes('barber')) {
    return 'Barbearia'
  }

  return ''
}

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

  // Produtos ativos do catálogo (banco de dados)
  const [productsList, setProductsList] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string>('')

  // Minhas oportunidades para vínculo opcional
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [selectedOppId, setSelectedOppId] = useState<string>(searchParams.get('opp') || '')

  // Estado do Início de Abordagem
  const [isCopilotActive, setIsCopilotActive] = useState(false)
  const [channel, setChannel] = useState<ApproachChannel>(
    (searchParams.get('channel') as ApproachChannel) || 'Telefone',
  )
  const [selectedSegment, setSelectedSegment] = useState<string>('')
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

  // 1. Carregar Playbook do banco e oportunidades completas da carteira
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        // Busca com batch máximo de 500 para garantir que nenhuma oportunidade fique de fora
        const [pbBundle, opps, prods] = await Promise.all([
          getPlaybookBundle(),
          pb.collection('opportunities').getFullList<Opportunity>({
            batch: 500,
            sort: '-created',
            expand: 'seller,product',
          }),
          getActiveProducts(),
        ])
        setPlaybook(pbBundle)
        setOpportunities(opps)
        setProductsList(prods)

        // Se veio opp na URL, preenche os dados
        const urlOppId = searchParams.get('opp')
        let initialProdId = ''
        let inferredSeg = ''

        if (urlOppId) {
          const matched = opps.find((o) => o.id === urlOppId)
          if (matched) {
            setSelectedOppId(matched.id)
            setCustomCompanyName(matched.company)
            setCustomContactName(matched.contact_name || '')
            setCustomPhone(matched.contact_phone || '')
            setCustomCity(matched.city || '')
            if (matched.product) {
              initialProdId = matched.product
            } else if (matched.product_name) {
              const p = prods.find(
                (pr) =>
                  pr.name.toLowerCase() === matched.product_name?.toLowerCase() ||
                  pr.name.toLowerCase().includes(matched.product_name?.toLowerCase() || ''),
              )
              if (p) initialProdId = p.id
            }

            // Tentar recuperar segmento de sessão prévia em approach_sessions
            try {
              const prevSessions = await getApproachSessions({ opportunityId: matched.id })
              const sessionWithSeg = prevSessions.find(
                (s) => s.segment && s.segment.trim().length > 0,
              )
              if (sessionWithSeg?.segment) {
                inferredSeg = sessionWithSeg.segment.trim()
              }
            } catch {
              // fallback silencioso para inferência direta
            }

            if (!inferredSeg) {
              inferredSeg = inferSegmentFromOpportunity({
                company: matched.company,
                message: matched.message,
              })
            }
          }
        }

        if (inferredSeg) {
          setSelectedSegment(inferredSeg)
        }
        if (!initialProdId && prods.length > 0) {
          initialProdId = prods[0].id
        }
        if (initialProdId) {
          setSelectedProductId(initialProdId)
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
  const handleSelectOpp = async (oppId: string) => {
    setSelectedOppId(oppId)
    if (!oppId) {
      setSelectedSegment('')
      return
    }

    const opp = opportunities.find((o) => o.id === oppId)
    if (opp) {
      setCustomCompanyName(opp.company)
      setCustomContactName(opp.contact_name || '')
      setCustomPhone(opp.contact_phone || '')
      setCustomCity(opp.city || '')
      if (opp.product) {
        setSelectedProductId(opp.product)
      } else if (opp.product_name) {
        const p = productsList.find(
          (pr) =>
            pr.name.toLowerCase() === opp.product_name?.toLowerCase() ||
            pr.name.toLowerCase().includes(opp.product_name?.toLowerCase() || ''),
        )
        if (p) setSelectedProductId(p.id)
      }

      // 1. Tentar buscar segmento de sessão prévia em approach_sessions
      let finalSegment = ''
      try {
        const prevSessions = await getApproachSessions({ opportunityId: opp.id })
        const sessionWithSeg = prevSessions.find((s) => s.segment && s.segment.trim().length > 0)
        if (sessionWithSeg?.segment) {
          finalSegment = sessionWithSeg.segment.trim()
        }
      } catch {
        // fallback
      }

      // 2. Se não houver sessão prévia com segmento, inferir por palavras-chave
      if (!finalSegment) {
        finalSegment = inferSegmentFromOpportunity({
          company: opp.company,
          message: opp.message,
        })
      }

      setSelectedSegment(finalSegment)
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

  // Determinar o produto ativo da abordagem: seletor manual tem prioridade; se não houver, usa da oportunidade
  const activeProduct = useMemo(() => {
    if (selectedProductId) {
      const match = productsList.find((p) => p.id === selectedProductId)
      if (match) return match
    }
    const opp = opportunities.find((o) => o.id === selectedOppId)
    if (opp?.product) {
      const match = productsList.find((p) => p.id === opp.product)
      if (match) return match
    }
    if (opp?.product_name) {
      const match = productsList.find(
        (p) =>
          p.name.toLowerCase() === opp.product_name?.toLowerCase() ||
          p.name.toLowerCase().includes(opp.product_name?.toLowerCase() || ''),
      )
      if (match) return match
      return {
        id: opp.product || '',
        name: opp.product_name,
        setup_value: opp.value || 500,
        recurring_value: opp.recurring_value ?? 55,
      } as Product
    }
    return productsList[0] || null
  }, [selectedProductId, selectedOppId, opportunities, productsList])

  // Determinar identificadores do produto ativo (seletor manual tem precedência sobre opp vinculada)
  const currentOpp = opportunities.find((o) => o.id === selectedOppId)
  const effectiveProdId = activeProduct?.id || currentOpp?.product
  const effectiveProdName = activeProduct?.name || currentOpp?.product_name
  const effectiveProdDesc = activeProduct?.description

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
      productId: effectiveProdId,
      productName: effectiveProdName,
      productDescription: effectiveProdDesc,
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
    effectiveProdId,
    effectiveProdName,
    effectiveProdDesc,
  ])

  // Função auxiliar de correspondência de produto para o copiloto
  const matchesActiveProduct = useCallback(
    (item: { product?: string; product_name?: string }) => {
      if (effectiveProdId && item.product === effectiveProdId) return true
      if (effectiveProdName && item.product_name) {
        const iName = item.product_name.toLowerCase()
        const tName = effectiveProdName.toLowerCase()
        if (iName === tName || iName.includes(tName) || tName.includes(iName)) {
          return true
        }
      }
      if (effectiveProdName) {
        const tLower = effectiveProdName.toLowerCase()
        const isWaTarget =
          tLower.includes('whatsapp') &&
          (tLower.includes('autônomo') || tLower.includes('autonomo'))
        if (isWaTarget && item.product_name) {
          const iLower = item.product_name.toLowerCase()
          if (
            iLower.includes('whatsapp') &&
            (iLower.includes('autônomo') || iLower.includes('autonomo'))
          ) {
            return true
          }
        }
      }
      return false
    },
    [effectiveProdId, effectiveProdName],
  )

  // Filtrar biblioteca de objeções por produto para a gaveta do copiloto
  const copilotObjections = useMemo(() => {
    const all = playbook.objections || []
    if (effectiveProdId || effectiveProdName) {
      const prodObjs = all.filter(matchesActiveProduct)
      const genericObjs = all.filter((o) => !o.product && !o.product_name)
      return prodObjs.length > 0 ? [...prodObjs, ...genericObjs] : all
    }
    const genericOnly = all.filter((o) => !o.product && !o.product_name)
    return genericOnly.length > 0 ? genericOnly : all
  }, [playbook.objections, effectiveProdId, effectiveProdName, matchesActiveProduct])

  // Resolver estrutura de valores (playbook_values) correspondente ao produto
  const copilotValuesConfig = useMemo(() => {
    const list = playbook.valuesList || (playbook.valuesConfig ? [playbook.valuesConfig] : [])
    if (effectiveProdId || effectiveProdName) {
      const prodValues = list.find(matchesActiveProduct)
      if (prodValues) return prodValues
    }
    return playbook.valuesConfig || (list.length > 0 ? list[0] : null)
  }, [
    playbook.valuesList,
    playbook.valuesConfig,
    effectiveProdId,
    effectiveProdName,
    matchesActiveProduct,
  ])

  // Mensagem de WhatsApp interpolada usando script do playbook do banco (com a mesma regra a/b/c)
  const whatsAppMessage = useMemo(() => {
    const opp = opportunities.find((o) => o.id === selectedOppId)
    const targetProdId = activeProduct?.id || opp?.product
    const targetProdName = activeProduct?.name || opp?.product_name

    const waScripts = playbook.scripts.filter(
      (s) => s.channel === 'WhatsApp' && s.is_active !== false,
    )

    const matchesProduct = (s: (typeof waScripts)[0]) => {
      if (targetProdId && s.product === targetProdId) return true
      if (targetProdName && s.product_name) {
        const sName = s.product_name.toLowerCase()
        const tName = targetProdName.toLowerCase()
        if (sName === tName || sName.includes(tName) || tName.includes(sName)) {
          return true
        }
      }
      if (targetProdName) {
        const tLower = targetProdName.toLowerCase()
        const isWaAutonomous =
          tLower.includes('whatsapp') &&
          (tLower.includes('autônomo') || tLower.includes('autonomo'))
        if (isWaAutonomous && s.product_name) {
          const sLower = s.product_name.toLowerCase()
          if (
            sLower.includes('whatsapp') &&
            (sLower.includes('autônomo') || sLower.includes('autonomo'))
          ) {
            return true
          }
        }
      }
      return false
    }

    let waScript: (typeof waScripts)[0] | undefined

    if (targetProdId || targetProdName) {
      // Regra (a): se a opp/seletor tem produto -> preferir script do MESMO produto
      waScript = waScripts.find(matchesProduct)
      // Regra (b): se não houver script daquele produto no canal, cair para script sem produto (genérico)
      if (!waScript) {
        waScript = waScripts.find((s) => !s.product && !s.product_name)
      }
    }

    // Regra (c): se a opp/seletor não tem produto ou se ainda não achou, primeiro WhatsApp da lista
    if (!waScript) {
      waScript = waScripts[0]
    }

    return buildWhatsAppMessage({
      scriptTemplate: waScript?.script_text || null,
      context: interpolationContext,
      hasOpportunity: Boolean(selectedOppId),
    })
  }, [playbook.scripts, interpolationContext, selectedOppId, opportunities, activeProduct])

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

      let nextContactAtIso: string | null = null
      if (data.returnDate) {
        const [y, m, d] = data.returnDate.split('-').map(Number)
        const [h, min] = (data.returnTime || '10:00').split(':').map(Number)
        const dt = new Date(y, m - 1, d, h || 10, min || 0)
        nextContactAtIso = dt.toISOString()
      }

      // Se marcou para criar nova oportunidade e não tem opp vinculada
      if (data.createOppIfMissing && !finalOppId && (customCompanyName || 'Lead de Abordagem')) {
        const initialStage = mapApproachStatusToOpportunityStage(data.status) || 'Novo'

        const newOpp = await pb.collection('opportunities').create<Opportunity>({
          company: customCompanyName.trim() || 'Novo Lead Abordagem',
          stage: initialStage,
          source: 'Prospecção',
          value: 500,
          seller: user.id,
          contact_name: customContactName.trim(),
          contact_phone: customPhone.trim(),
          city: customCity.trim(),
          message: data.notes || 'Criado automaticamente pelo Guia de Abordagem Comercial.',
          return_at: nextContactAtIso,
        })
        finalOppId = newOpp.id
      } else if (finalOppId) {
        // Se já tem oportunidade vinculada, sincronizar estágio e retorno via serviço centralizado
        await syncApproachSessionWithOpportunity({
          opportunityId: finalOppId,
          status: data.status,
          nextContactAt: nextContactAtIso,
          notes: data.notes,
          authorId: user.id,
        })
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
        description: 'Sessão concluída e oportunidade sincronizada no CRM.',
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
              <Select
                value={selectedSegment || '__none__'}
                onValueChange={(val) => setSelectedSegment(val === '__none__' ? '' : val)}
              >
                <SelectTrigger className="bg-[#0E1017] border-[#262A33] text-white text-xs h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o segmento (ou deixe genérico)" />
                </SelectTrigger>
                <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs max-h-60">
                  <SelectItem value="__none__">Nenhum / Geral (abordagem neutra)</SelectItem>
                  {playbook.segments.map((seg) => (
                    <SelectItem key={seg.id} value={seg.name}>
                      {seg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSegment && (
                <div className="flex items-center justify-between text-[11px] text-gray-400 px-1 pt-0.5">
                  <span>
                    Segmento ativo: <strong className="text-indigo-300">{selectedSegment}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSegment('')}
                    className="text-xs text-gray-400 hover:text-rose-400 underline"
                  >
                    Limpar nicho (usar neutro)
                  </button>
                </div>
              )}
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

            {/* Etapa 4: Produto da Abordagem */}
            {productsList.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                    4. Produto da Abordagem
                  </Label>
                  {Boolean(
                    selectedOppId &&
                    opportunities.find((o) => o.id === selectedOppId)?.product_name,
                  ) && (
                    <span className="text-[11px] text-indigo-400 font-medium">
                      Definido pela oportunidade vinculada
                    </span>
                  )}
                </div>
                <Select
                  value={activeProduct?.id || selectedProductId}
                  onValueChange={(val) => setSelectedProductId(val)}
                >
                  <SelectTrigger
                    data-testid="select-approach-product"
                    className="bg-[#0E1017] border-[#262A33] text-white text-xs h-11 rounded-xl"
                  >
                    <SelectValue placeholder="Selecione o produto da abordagem" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs">
                    {productsList.map((prod) => (
                      <SelectItem key={prod.id} value={prod.id}>
                        {prod.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeProduct?.description && (
                  <p className="text-[11px] text-gray-400 leading-relaxed italic">
                    {activeProduct.description}
                  </p>
                )}
              </div>
            )}

            {/* Escolha da Oportunidade da Carteira com Filtro/Busca e Campos de Personalização */}
            <OpportunitySelectorSection
              opportunities={opportunities}
              selectedOppId={selectedOppId}
              onSelectOpp={handleSelectOpp}
              companyName={customCompanyName}
              onChangeCompanyName={setCustomCompanyName}
              contactName={customContactName}
              onChangeContactName={setCustomContactName}
              city={customCity}
              onChangeCity={setCustomCity}
              phone={customPhone}
              onChangePhone={setCustomPhone}
            />

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
                Segmento:{' '}
                <strong className="text-white">{selectedSegment || 'Geral / Neutro'}</strong>
              </span>
              {(decision.currentScriptProductName || activeProduct?.name) && (
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold">
                  Produto: {decision.currentScriptProductName || activeProduct?.name}
                </span>
              )}
            </div>
          </div>

          {/* BOTÃO EM DESTAQUE NO TOPO QUANDO O CANAL FOR WHATSAPP COM SELETOR DE TIPO DE MENSAGEM */}
          {channel === 'WhatsApp' && (
            <div className="space-y-2">
              {productsList.length > 0 && (
                <div className="p-3 rounded-2xl bg-[#12141A] border border-[#262A33] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        Tipo de Mensagem WhatsApp:
                      </span>
                      <span className="text-[11px] text-gray-400">
                        Escolha se a mensagem oferecerá Site/Landing Page ou WhatsApp Autônomo
                      </span>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto min-w-[260px]">
                    <Select
                      value={activeProduct?.id || selectedProductId}
                      onValueChange={(val) => setSelectedProductId(val)}
                    >
                      <SelectTrigger
                        data-testid="select-approach-whatsapp-product-type"
                        className="bg-[#0E1017] border-[#262A33] text-white text-xs h-9 rounded-xl focus:ring-1 focus:ring-indigo-500"
                      >
                        <SelectValue placeholder="Selecione o produto/script" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#12141A] border-[#262A33] text-white text-xs z-[100]">
                        {productsList.map((prod) => (
                          <SelectItem key={prod.id} value={prod.id}>
                            {prod.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <WhatsAppCopilotAction
                phone={customPhone}
                message={whatsAppMessage}
                companyName={customCompanyName}
                contactName={customContactName}
                opportunityId={selectedOppId}
                authorId={user?.id}
                title="Abrir WhatsApp Web com Mensagem Pronta"
                showMessagePreview={true}
              />
            </div>
          )}

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
            situation={`Canal: ${channel} | Segmento: ${selectedSegment || 'Geral / Neutro'}`}
            scriptText={decision.currentScript}
            instructions="Fale de forma natural e com entusiasmo moderado. Pare imediatamente ao terminar para escutar o cliente."
            highlight
            productBadge={decision.currentScriptProductName || activeProduct?.name}
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
              objections={copilotObjections}
              activeObjectionName={activeObjection}
              onSelectObjection={handleSelectObjection}
              onClearActiveObjection={() => setActiveObjection(undefined)}
            />
          )}

          {/* 7. GAVETA / SEÇÃO: VALORES (R$ 500 / R$ 55) */}
          {showValuesDrawer && (
            <ValuesCard
              valuesConfig={copilotValuesConfig}
              productName={effectiveProdName}
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
