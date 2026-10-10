import type {
  ApproachChannel,
  DigitalSituation,
  LeadTemperature,
  PlaybookBundle,
  PlaybookQuestion,
  PlaybookAnswer,
  PersonalizedPitchData,
  ApproachStatus,
} from '@/types/playbook'

export interface InterpolationContext {
  sellerName?: string
  companyName?: string
  contactName?: string
  segment?: string
  city?: string
  phone?: string
  ref?: string
  date?: string
  channel?: ApproachChannel
  digitalSituation?: DigitalSituation | string
}

export interface EngineDecisionInput {
  channel: ApproachChannel
  segment?: string
  digitalSituation?: DigitalSituation | string
  currentQuestionIndex: number
  askedQuestions: string[]
  givenAnswers: { question: string; answer: string }[]
  activeObjection?: string
  quickTags: string[]
  needs?: string
  interests?: string
  decisionMaker?: string
  deadline?: string
  budget?: string
  playbook: PlaybookBundle
  context?: InterpolationContext
  productId?: string
  productName?: string
  productDescription?: string
}

export interface EngineDecisionOutput {
  currentScript: string
  currentScriptTitle: string
  currentScriptProductName?: string
  currentQuestion: PlaybookQuestion | null
  possibleAnswers: PlaybookAnswer[]
  recommendedArgument: string | null
  nextBestAction: string
  nextBestActionDescription: string
  temperature: LeadTemperature
  temperatureReason: string
  suggestedStatus: ApproachStatus
  personalizedPitch?: PersonalizedPitchData
}

/**
 * Interpola variáveis no texto:
 * - Sintaxe moderna de chaves: {contato}, {empresa}, {cidade}, {vendedor}, {ref}, {data}, {segmento}, {telefone}
 * - Sintaxe legada de colchetes: [NOME DO VENDEDOR], [NOME DA EMPRESA], [NOME DO CONTATO], [SEGMENTO], [CIDADE], [TELEFONE], [EMPRESA], [DATA], [REF]
 *
 * Fallbacks elegantes:
 * - contato: primeiro nome do contato (ou "Responsável")
 * - vendedor: nome do vendedor (ou "Consultor Comercial")
 * - empresa: nome da empresa (ou "sua empresa")
 * - segmento: nome do segmento (ou "sua área")
 * - ref: código rastreável (ou "BIT")
 * - data: data informada (ou "nosso último contato")
 * - telefone: telefone informado (ou "")
 * - cidade vazia: remove os fragmentos " em {cidade}" / " na cidade de {cidade}" / " em [CIDADE]" inteiros
 *   sem deixar resíduo de preposição e limpa espaços duplos.
 */
export function interpolateText(text: string, ctx?: InterpolationContext): string {
  if (!text) return ''

  // Contato: usar primeiro nome com fallback
  const rawContact = ctx?.contactName?.trim() || ''
  const contactFirstName = rawContact ? rawContact.split(/\s+/)[0] : ''
  const contact = contactFirstName || 'Responsável'

  const seller = ctx?.sellerName?.trim() || 'Consultor Comercial'
  const company = ctx?.companyName?.trim() || 'sua empresa'
  const seg = ctx?.segment?.trim() || 'sua área'
  const ref = ctx?.ref?.trim() || 'BIT'
  const date = ctx?.date?.trim() || 'nosso último contato'
  const phone = ctx?.phone?.trim() || ''

  const rawCity = ctx?.city?.trim() || ''

  let result = text

  // Tratamento de cidade vazia: remover fragmento " em {cidade}" / " na cidade de {cidade}" / " em [CIDADE]"
  if (!rawCity) {
    result = result
      // " na cidade de {cidade}" ou " na cidade de [CIDADE]"
      .replace(/\s+(?:na\s+cidade\s+de|no\s+município\s+de|em)\s+\{(?:cidade)\}/gi, '')
      .replace(/\s+(?:na\s+cidade\s+de|no\s+município\s+de|em)\s+\[CIDADE\]/gi, '')
      // Casos sem preposição direta anterior: limpa a chave isolada
      .replace(/\{cidade\}/gi, '')
      .replace(/\[CIDADE\]/gi, '')
  } else {
    result = result.replace(/\{cidade\}/gi, rawCity).replace(/\[CIDADE\]/gi, rawCity)
  }

  result = result
    // Chaves modernas ({...})
    .replace(/\{contato\}/gi, contact)
    .replace(/\{empresa\}/gi, company)
    .replace(/\{vendedor\}/gi, seller)
    .replace(/\{ref\}/gi, ref)
    .replace(/\{data\}/gi, date)
    .replace(/\{segmento\}/gi, seg)
    .replace(/\{telefone\}/gi, phone)
    // Colchetes legados ([...])
    .replace(/\[NOME DO VENDEDOR\]/gi, seller)
    .replace(/\[NOME DA EMPRESA\]/gi, company)
    .replace(/\[EMPRESA\]/gi, company)
    .replace(/\[NOME DO CONTATO\]/gi, contact)
    .replace(/\[CONTATO\]/gi, contact)
    .replace(/\[SEGMENTO\]/gi, seg)
    .replace(/\[TELEFONE\]/gi, phone)
    .replace(/\[DATA\]/gi, date)
    .replace(/\[REF\]/gi, ref)

  // Limpeza de múltiplos espaços em branco por linha (sem estragar quebras de linha \n)
  result = result
    .split('\n')
    .map((line) =>
      line
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([,.;!?])/g, '$1')
        .trimEnd(),
    )
    .join('\n')

  return result
}

/**
 * Avalia de forma estritamente objetiva a temperatura do lead e o motivo
 * Regras inegociáveis:
 * - QUENTE: demonstrou interesse, possui necessidade, decisor identificado, pediu proposta, quer implantar.
 * - MORNO: pediu exemplos, precisa conversar com outra pessoa, pediu retorno, interesse parcial.
 * - FRIO: sem interesse, já possui solução satisfatória, não pretende avançar.
 */
export function evaluateLeadTemperature(input: {
  quickTags?: string[]
  interests?: string
  needs?: string
  decisionMaker?: string
  deadline?: string
  activeObjection?: string
  answers?: { question: string; answer: string }[]
  status?: string
}): { temperature: LeadTemperature; reason: string; suggestedStatus: ApproachStatus } {
  const tags = (input.quickTags || []).map((t) => t.toLowerCase())
  const answersText = (input.answers || []).map((a) => a.answer.toLowerCase()).join(' ')
  const objection = (input.activeObjection || '').toLowerCase()
  const interests = (input.interests || '').toLowerCase()
  const needs = (input.needs || '').toLowerCase()
  const hasDecisionMaker = Boolean(input.decisionMaker && input.decisionMaker.trim().length > 2)

  // 1. Condições de FRIO
  if (
    tags.includes('não tenho interesse') ||
    tags.includes('sem interesse') ||
    objection === 'não tenho interesse' ||
    objection === 'não preciso' ||
    answersText.includes('não tenho interesse') ||
    (tags.includes('já tem site') && !needs && !interests)
  ) {
    return {
      temperature: 'frio',
      reason:
        'Cliente sem interesse explícito ou declarou possuir solução satisfatória sem intenção de mudança.',
      suggestedStatus: 'Sem interesse',
    }
  }

  // 2. Condições de QUENTE
  const hasHotTags =
    tags.includes('interessado') ||
    tags.includes('gerar proposta') ||
    tags.includes('proposta solicitada') ||
    tags.includes('quer implantar')

  const hasHighInterest =
    interests.includes('implantar') ||
    interests.includes('fechar') ||
    interests.includes('urgente') ||
    interests.includes('site completo')

  if (hasHotTags || (hasHighInterest && hasDecisionMaker) || tags.includes('gerar proposta')) {
    let reason = 'Demonstrou alto interesse, necessidade clara identificada'
    if (hasDecisionMaker) reason += ' com decisor mapeado'
    if (tags.includes('gerar proposta')) reason += ' e solicitação de proposta comercial.'
    else reason += ' pronto para avançar.'

    return {
      temperature: 'quente',
      reason,
      suggestedStatus: tags.includes('gerar proposta') ? 'Proposta solicitada' : 'Interessado',
    }
  }

  // 3. Condições de MORNO
  const hasWarmTags =
    tags.includes('quer ver exemplos') ||
    tags.includes('falar com sócio') ||
    tags.includes('agendar retorno') ||
    tags.includes('achou caro') ||
    tags.includes('já tem instagram')

  if (
    hasWarmTags ||
    objection === 'preciso falar com meu sócio' ||
    objection === 'vou pensar' ||
    objection === 'está caro' ||
    objection === 'me manda no whatsapp' ||
    (input.answers && input.answers.length >= 2)
  ) {
    let reason = 'Interesse demonstrado com pendência de validação'
    if (tags.includes('falar com sócio') || objection.includes('sócio')) {
      reason = 'Interesse parcial, necessita alinhar com o sócio/decisor.'
    } else if (tags.includes('quer ver exemplos') || objection.includes('whatsapp')) {
      reason = 'Solicitou exemplos visuais e informações pelo WhatsApp.'
    } else if (tags.includes('achou caro') || objection.includes('caro')) {
      reason = 'Interessado na solução porém sensível ao investimento inicial ou mensal.'
    } else if (tags.includes('agendar retorno')) {
      reason = 'Solicitou retorno programado para reavaliar a proposta.'
    } else {
      reason = 'Respondeu positivamente ao diagnóstico com interesse moderado.'
    }

    const suggestedStatus: ApproachStatus = tags.includes('agendar retorno')
      ? 'Retorno agendado'
      : tags.includes('quer ver exemplos')
        ? 'Exemplos enviados'
        : 'Contato realizado'

    return {
      temperature: 'morno',
      reason,
      suggestedStatus,
    }
  }

  // Padrão inicial
  return {
    temperature: 'morno',
    reason: 'Contato em andamento, coletando respostas de diagnóstico.',
    suggestedStatus: 'Contato realizado',
  }
}

/**
 * Motor principal desacoplado de abordagem (Coach Comercial desacoplado / Preparado para IA futura)
 */
export function runApproachEngine(input: EngineDecisionInput): EngineDecisionOutput {
  const {
    playbook,
    channel,
    context,
    currentQuestionIndex,
    askedQuestions,
    givenAnswers,
    activeObjection,
    quickTags,
  } = input

  // 1. Script principal do canal
  const channelScripts = playbook.scripts.filter(
    (s) => s.channel === channel && s.is_active !== false,
  )
  const targetProdId = input.productId?.trim()
  const targetProdName = input.productName?.trim()

  const scriptMatchesProduct = (s: { product?: string; product_name?: string }) => {
    if (targetProdId && s.product === targetProdId) return true
    if (targetProdName && s.product_name) {
      const sName = s.product_name.toLowerCase()
      const tName = targetProdName.toLowerCase()
      if (sName === tName || sName.includes(tName) || tName.includes(sName)) {
        return true
      }
    }
    // Suporte a detecção semântica se produto alvo for "WhatsApp Autônomo"
    if (targetProdName) {
      const tLower = targetProdName.toLowerCase()
      const isWaAutonomousTarget =
        tLower.includes('whatsapp') && (tLower.includes('autônomo') || tLower.includes('autonomo'))
      if (isWaAutonomousTarget && s.product_name) {
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

  let mainScriptObj: (typeof playbook.scripts)[0] | undefined

  if (targetProdId || targetProdName) {
    // Regra (a): se foi informado produto, buscar script do MESMO produto no canal
    mainScriptObj = channelScripts.find(scriptMatchesProduct)

    // Regra (b): se não houver script daquele produto no canal, cair para script do canal sem produto (genéricos)
    if (!mainScriptObj) {
      mainScriptObj = channelScripts.find((s) => !s.product && !s.product_name)
    }
  }

  // Regra (c): fallback para o primeiro script do canal ou do playbook
  if (!mainScriptObj) {
    mainScriptObj = channelScripts[0] ||
      playbook.scripts[0] || {
        title: 'Script de Abordagem',
        script_text:
          'Olá, sou da Bit Consulting. Gostaria de falar sobre a presença digital da empresa.',
        display_order: 1,
        is_active: true,
        channel,
        collectionId: '',
        collectionName: '',
        created: '',
        updated: '',
        id: '',
      }
  }

  const currentScriptTitle = mainScriptObj.title
  const currentScriptProductName = mainScriptObj.product_name || undefined
  const currentScript = interpolateText(mainScriptObj.script_text, context)

  // Função auxiliar universal para correspondência de produto em itens do playbook
  const itemMatchesProduct = (item: { product?: string; product_name?: string }) => {
    if (targetProdId && item.product === targetProdId) return true
    if (targetProdName && item.product_name) {
      const iName = item.product_name.toLowerCase()
      const tName = targetProdName.toLowerCase()
      if (iName === tName || iName.includes(tName) || tName.includes(iName)) {
        return true
      }
    }
    if (targetProdName) {
      const tLower = targetProdName.toLowerCase()
      const isWaAutonomousTarget =
        tLower.includes('whatsapp') && (tLower.includes('autônomo') || tLower.includes('autonomo'))
      if (isWaAutonomousTarget && item.product_name) {
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
  }

  // 2. Perguntas disponíveis para diagnóstico / qualificação
  // Filtrar ativas pelo produto: se produto informado, perguntas do produto + genéricas (sem produto)
  const allActiveQuestions = playbook.questions.filter((q) => {
    if (!q.is_active) return false
    if (!targetProdId && !targetProdName) {
      // Sem produto selecionado: aceita itens sem produto (genéricos)
      return !q.product && !q.product_name
    }
    // Com produto: aceita itens do mesmo produto OU genéricos (compatibilidade total)
    return itemMatchesProduct(q) || (!q.product && !q.product_name)
  })

  // Ordenar priorizando as do produto sobre as genéricas
  const sortedQuestions = [...allActiveQuestions].sort((a, b) => {
    const aMatch = itemMatchesProduct(a) ? 1 : 0
    const bMatch = itemMatchesProduct(b) ? 1 : 0
    if (aMatch !== bMatch) return bMatch - aMatch
    return (a.display_order || 0) - (b.display_order || 0)
  })

  const remainingQuestions = sortedQuestions.filter((q) => !askedQuestions.includes(q.text))

  // Priorização contextual:
  // Se situação digital é "Utiliza somente Instagram", prioriza a pergunta sobre Instagram
  let currentQuestion: PlaybookQuestion | null = null

  if (input.digitalSituation === 'Utiliza somente Instagram') {
    const instaQ = sortedQuestions.find((q) => q.text.toLowerCase().includes('instagram'))
    if (instaQ && !askedQuestions.includes(instaQ.text)) {
      currentQuestion = instaQ
    }
  }

  if (!currentQuestion) {
    if (currentQuestionIndex < sortedQuestions.length) {
      currentQuestion = sortedQuestions[currentQuestionIndex]
    } else if (remainingQuestions.length > 0) {
      currentQuestion = remainingQuestions[0]
    } else {
      currentQuestion = sortedQuestions[0] || null
    }
  }

  // 3. Respostas possíveis para a pergunta atual
  let possibleAnswers: PlaybookAnswer[] = []
  if (currentQuestion) {
    const qText = currentQuestion.text.toLowerCase()
    possibleAnswers = playbook.answers.filter((a) => {
      if (a.question && a.question === currentQuestion?.id) return true
      if (a.question_pattern) {
        return qText.includes(a.question_pattern.toLowerCase())
      }
      return false
    })
  }

  // Se não houver respostas específicas cadastradas para essa pergunta, fornece respostas padrão de alto valor
  if (possibleAnswers.length === 0) {
    possibleAnswers = [
      {
        id: 'std_sim',
        collectionId: '',
        collectionName: '',
        created: '',
        updated: '',
        answer_text: 'Sim / Positivo',
        resulting_action: 'Avançar para próximo ponto',
        recommended_argument: 'Ótimo, isso agiliza muito o projeto e eleva o resultado.',
        display_order: 1,
      },
      {
        id: 'std_nao',
        collectionId: '',
        collectionName: '',
        created: '',
        updated: '',
        answer_text: 'Não / Ainda não',
        resulting_action: 'Explicar como o site resolve esse gargalo',
        recommended_argument:
          'É exatamente esse ponto que a Bit Consulting estrutura para você sem você perder tempo.',
        display_order: 2,
      },
      {
        id: 'std_parcial',
        collectionId: '',
        collectionName: '',
        created: '',
        updated: '',
        answer_text: 'Mais ou menos / Parcial',
        resulting_action: 'Investigar detalhes',
        recommended_argument:
          'Com um site profissional, esse processo fica 100% automatizado e padronizado.',
        display_order: 3,
      },
    ]
  }

  // 4. Argumento recomendado com base na última resposta ou objeção
  let recommendedArgument: string | null = null
  const lastAnswer = givenAnswers[givenAnswers.length - 1]

  // Se houver uma objeção ativa, o argumento vem do tratamento da objeção
  if (activeObjection) {
    const objObj = playbook.objections.find(
      (o) => o.name.toLowerCase() === activeObjection.toLowerCase(),
    )
    if (objObj) {
      recommendedArgument = objObj.treatment_script
    }
  }

  // Se não tiver argumento de objeção, busca na última resposta dada
  if (!recommendedArgument && lastAnswer) {
    const matchedAnswer = playbook.answers.find(
      (a) => a.answer_text.toLowerCase() === lastAnswer.answer.toLowerCase(),
    )
    if (matchedAnswer?.recommended_argument) {
      recommendedArgument = matchedAnswer.recommended_argument
    }
  }

  // Se ainda não tiver, busca argumento correlacionado por situação e produto
  if (!recommendedArgument) {
    const activeArguments = playbook.argumentsList.filter((a) => {
      if (!a.is_active) return false
      if (!targetProdId && !targetProdName) return !a.product && !a.product_name
      return itemMatchesProduct(a) || (!a.product && !a.product_name)
    })

    if (input.digitalSituation === 'Utiliza somente Instagram') {
      const arg = activeArguments.find((a) => a.situation.toLowerCase().includes('instagram'))
      if (arg) recommendedArgument = arg.argument_text
    }
    if (!recommendedArgument && activeArguments.length > 0) {
      // Priorizar argumento que seja específico do produto se houver
      const prodArg = activeArguments.find(itemMatchesProduct)
      recommendedArgument = prodArg ? prodArg.argument_text : activeArguments[0].argument_text
    }
  }

  if (recommendedArgument) {
    recommendedArgument = interpolateText(recommendedArgument, context)
  }

  // 5. Avaliação da Temperatura e Motivo
  const tempEval = evaluateLeadTemperature({
    quickTags,
    interests: input.interests,
    needs: input.needs,
    decisionMaker: input.decisionMaker,
    deadline: input.deadline,
    activeObjection,
    answers: givenAnswers,
  })

  // 6. Próxima melhor ação recomendada (com suporte a produto)
  const isWaAutonomoProduct =
    (targetProdName || '').toLowerCase().includes('whatsapp') &&
    ((targetProdName || '').toLowerCase().includes('autônomo') ||
      (targetProdName || '').toLowerCase().includes('autonomo'))

  let nextBestAction = 'Fazer mais uma pergunta'
  let nextBestActionDescription = 'Aprofunde o diagnóstico para mapear os gargalos do cliente.'

  if (
    quickTags.includes('demonstração') ||
    quickTags.includes('demo') ||
    (isWaAutonomoProduct && quickTags.includes('quer ver exemplos'))
  ) {
    nextBestAction = 'Agendar demonstração do atendente'
    nextBestActionDescription =
      'Acione demonstração prática em tempo real do atendente direto no WhatsApp do lead.'
  } else if (quickTags.includes('gerar proposta') || tempEval.temperature === 'quente') {
    nextBestAction = 'Criar proposta'
    nextBestActionDescription = 'Cliente qualificado e pronto para receber formalização comercial.'
  } else if (
    quickTags.includes('falar com sócio') ||
    activeObjection === 'Preciso falar com meu sócio'
  ) {
    nextBestAction = 'Agendar retorno'
    nextBestActionDescription =
      'Defina dia e horário no CRM para falar após o alinhamento com o sócio.'
  } else if (
    quickTags.includes('quer ver exemplos') ||
    activeObjection === 'Me manda no WhatsApp'
  ) {
    if (isWaAutonomoProduct) {
      nextBestAction = 'Agendar demonstração do atendente'
      nextBestActionDescription =
        'Demonstre em tempo real o atendente respondendo com linguagem natural.'
    } else {
      nextBestAction = 'Enviar portfólio'
      nextBestActionDescription = 'Envie link com 2 ou 3 modelos de destaque via WhatsApp.'
    }
  } else if (quickTags.includes('achou caro') || activeObjection === 'Está caro') {
    nextBestAction = 'Mostrar exemplo'
    nextBestActionDescription = isWaAutonomoProduct
      ? 'Compare o custo de R$ 500 único + R$ 55/mês com mais de R$ 2.000/mês de um atendente humano.'
      : 'Ressalte que os R$ 55,00 já cobrem hospedagem, domínio e suporte.'
  } else if (givenAnswers.length >= 3 && !input.decisionMaker) {
    nextBestAction = 'Identificar decisor'
    nextBestActionDescription = 'Pergunte se além dele há mais alguém envolvido na decisão.'
  } else if (tempEval.temperature === 'frio') {
    nextBestAction = 'Encerrar oportunidade'
    nextBestActionDescription = 'Agradeça pela atenção cordialmente e registre sem desgaste.'
  }

  // 7. Geração da abordagem personalizada (interpolação pura sem IA)
  // Detecta se a abordagem atual é voltada ao WhatsApp Autônomo e Humanizado
  const effectiveProdName = (currentScriptProductName || targetProdName || '').toLowerCase()
  const scriptTitleLower = (currentScriptTitle || '').toLowerCase()
  const isWhatsAppAutonomous =
    effectiveProdName.includes('autônomo') ||
    effectiveProdName.includes('autonomo') ||
    scriptTitleLower.includes('autônomo') ||
    scriptTitleLower.includes('autonomo')

  let personalizedPitch: PersonalizedPitchData

  // Especialização contextual por segmento (Restaurante, Automotivo, etc.)
  const rawSegment = (input.segment || context?.segment || '').trim().toLowerCase()
  const isRestaurantSegment =
    rawSegment.includes('restaurante') ||
    rawSegment.includes('pizzaria') ||
    rawSegment.includes('lanchonete') ||
    rawSegment.includes('hamburgueria') ||
    rawSegment.includes('bar') ||
    rawSegment.includes('churrascaria')
  const isAutomotiveSegment =
    rawSegment.includes('estética automotiva') ||
    rawSegment.includes('estetica automotiva') ||
    rawSegment.includes('lava-rápido') ||
    rawSegment.includes('lava rápido') ||
    rawSegment.includes('lava jato') ||
    rawSegment.includes('lavarapido') ||
    rawSegment.includes('detailing') ||
    rawSegment.includes('polimento')

  if (isWhatsAppAutonomous) {
    if (isRestaurantSegment) {
      personalizedPitch = {
        abertura: interpolateText(
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], da Bit Consulting. Vi o movimento e o atendimento da [NOME DA EMPRESA] em [CIDADE] e achei excelente. Posso te fazer uma pergunta rápida sobre como vocês recebem pedidos e reservas no WhatsApp hoje?',
          context,
        ),
        pergunta1: interpolateText(
          'Hoje quando um cliente chama a [NOME DA EMPRESA] no WhatsApp nos horários de pico ou fora do expediente para ver o cardápio digital, fazer pedidos ou reservar mesas, ele tem resposta imediata ou precisa esperar alguém responder manualmente?',
          context,
        ),
        pergunta2: interpolateText(
          'Vocês costumam perder pedidos fora de hora ou clientes impacientes na fila de espera do WhatsApp enquanto a equipe está ocupada na cozinha ou no salão?',
          context,
        ),
        pitch: interpolateText(
          'Nós implementamos um atendente autônomo e humanizado no WhatsApp da [NOME DA EMPRESA] que envia o cardápio digital instantaneamente, tira dúvidas sobre pratos, horários e localização, e direciona reservas 24 horas por dia, com atendimento ágil nos horários de pico. O setup inicial de implantação e configuração Meta Business é de R$ 500,00, e R$ 55,00/mês cobrindo toda a infraestrutura, suporte e manutenção.',
          context,
        ),
        argumento: interpolateText(
          'O atendente autônomo não substitui seu atendimento acolhedor, ele elimina o tempo de espera no WhatsApp: o cliente recebe o cardápio e faz o pedido em segundos sem desistir para o concorrente.',
          context,
        ),
        possivelObjecao: {
          objecao: 'Já respondo pelo WhatsApp normalmente',
          clarificacao:
            'E nos horários de pico de pedidos ou tarde da noite, vocês conseguem responder em menos de 1 minuto sem atrasar a operação?',
          argumento:
            'Quem pede comida tem pressa. O WhatsApp Autônomo garante envio imediato de cardápio digital e triagem de pedidos 24/7 sem sobrecarregar sua equipe no salão.',
        },
        proximoPasso:
          'Fazer uma demonstração prática em tempo real do atendente autônomo enviando cardápio e agilizando pedidos no WhatsApp.',
      }
    } else if (isAutomotiveSegment) {
      personalizedPitch = {
        abertura: interpolateText(
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], da Bit Consulting. Vi os serviços da [NOME DA EMPRESA] em [CIDADE] e achei impecável. Posso te fazer uma pergunta rápida sobre como vocês recebem pedidos de orçamento e agendamento no WhatsApp?',
          context,
        ),
        pergunta1: interpolateText(
          'Hoje quando um cliente chama para pedir orçamento de serviços ou agendar um horário no WhatsApp enquanto vocês estão na operação, ele recebe resposta imediata ou precisa esperar?',
          context,
        ),
        pergunta2: interpolateText(
          'Vocês costumam perder orçamentos rápidos de clientes que mandam mensagem à noite, fins de semana ou enquanto a equipe está executando serviços?',
          context,
        ),
        pitch: interpolateText(
          'Nós implementamos um atendente autônomo e humanizado no WhatsApp da [NOME DA EMPRESA] focado em agendamento de serviços, orçamentos rápidos e envio de tabela de serviços 24 horas por dia. O setup inicial de implantação e configuração Meta Business é de R$ 500,00, e R$ 55,00/mês cobrindo infraestrutura, suporte e manutenção.',
          context,
        ),
        argumento: interpolateText(
          'Enquanto sua equipe foca na execução dos serviços com excelência, o atendente autônomo qualifica o veículo, lista os serviços e pré-agenda o cliente sem perder a venda.',
          context,
        ),
        possivelObjecao: {
          objecao: 'Já respondo pelo WhatsApp normalmente',
          clarificacao:
            'E quando você está executando um serviço ou fora do horário, consegue responder orçamentos em menos de 1 minuto?',
          argumento:
            'O cliente de serviços automotivos quer orçamento rápido. O WhatsApp Autônomo responde de imediato, apresenta os pacotes e agenda o atendimento 24/7.',
        },
        proximoPasso:
          'Demonstrar em tempo real como o atendente autônomo qualifica o cliente e agenda serviços no WhatsApp.',
      }
    } else {
      // Genérico / neutro para demais segmentos ou sem segmento
      personalizedPitch = {
        abertura: interpolateText(
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], da Bit Consulting. Vi o atendimento da [NOME DA EMPRESA] em [CIDADE] e achei excelente. Posso te fazer uma pergunta rápida sobre como vocês recebem mensagens no WhatsApp hoje?',
          context,
        ),
        pergunta1: interpolateText(
          'Hoje quando um cliente chama a [NOME DA EMPRESA] no WhatsApp fora do horário comercial ou em horários de pico, ele recebe uma resposta imediata ou precisa esperar alguém da equipe responder manualmente?',
          context,
        ),
        pergunta2: interpolateText(
          'Vocês costumam perder atendimentos ou orçamentos quando o cliente manda mensagem à noite, fins de semana ou feriados?',
          context,
        ),
        pitch: interpolateText(
          'Nós implementamos um atendente autônomo e humanizado no WhatsApp da [NOME DA EMPRESA] que atende 24 horas por dia, responde com naturalidade (sem parecer robô), tira dúvidas e agenda clientes. O setup inicial de implantação e configuração Meta Business é de R$ 500,00, e R$ 55,00/mês cobrindo toda a infraestrutura, suporte e manutenção.',
          context,
        ),
        argumento: interpolateText(
          'O atendente autônomo não substitui a sua equipe humana, ele assume a primeira resposta em segundos e qualifica o cliente. Sua empresa nunca mais perde uma venda por demora no WhatsApp.',
          context,
        ),
        possivelObjecao: {
          objecao: 'Já respondo pelo WhatsApp normalmente',
          clarificacao:
            'E fora do horário comercial ou quando a loja está cheia, vocês conseguem responder em menos de 1 minuto?',
          argumento:
            'O cliente de hoje não espera mais de alguns minutos antes de chamar o concorrente. O WhatsApp Autônomo garante resposta imediata e humanizada 24/7 sem sobrecarregar sua equipe.',
        },
        proximoPasso:
          'Fazer uma demonstração prática em tempo real do atendente autônomo respondendo no WhatsApp e agendar 15 minutos.',
      }
    }
  } else {
    // Produto: Site ou Landing Page (ou geral)
    if (isRestaurantSegment) {
      personalizedPitch = {
        abertura: interpolateText(
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], da Bit Consulting. Conheci o trabalho da [NOME DA EMPRESA] em [CIDADE] e achei de muito bom gosto. Posso te fazer uma pergunta rápida sobre o atendimento e cardápio de vocês?',
          context,
        ),
        pergunta1: interpolateText(
          input.digitalSituation === 'Utiliza somente Instagram'
            ? 'Hoje no Instagram os clientes encontram com facilidade o cardápio digital completo, horários e botão direto para pedidos e reservas no WhatsApp, ou ainda mandam muito direct perguntando preços?'
            : 'Quando alguém procura onde comer ou quer fazer pedidos e reservas na [NOME DA EMPRESA] em [CIDADE], onde encontra o cardápio digital oficial e atualizado?',
          context,
        ),
        pergunta2: interpolateText(
          'Vocês gostariam de facilitar pedidos fora de hora e agilizar o atendimento no WhatsApp nos horários de pico com cardápio digital interativo e reservas online?',
          context,
        ),
        pitch: interpolateText(
          input.productDescription
            ? `${input.productDescription} O investimento inicial é a partir de R$ 500,00, e R$ 55,00/mês cobrindo domínio, hospedagem segura e todo o suporte técnico.`
            : 'Nós criamos uma página profissional sob medida para a [NOME DA EMPRESA] com cardápio digital interativo, fotos atraentes dos pratos, informações de localização, horários e botão direto para pedidos e reservas no WhatsApp sem taxa de aplicativo. O investimento inicial é a partir de R$ 500,00, e R$ 55,00/mês cobrindo domínio, hospedagem segura e todo o suporte técnico.',
          context,
        ),
        argumento: interpolateText(
          'O cardápio digital oficial agiliza o atendimento nos horários de pico e permite receber pedidos e reservas a qualquer hora, transmitindo autoridade e praticidade para o cliente.',
          context,
        ),
        possivelObjecao: {
          objecao: 'Já tenho Instagram ou app de entrega',
          clarificacao:
            'Os apps cobram altas taxas e no Instagram o cliente não tem um cardápio organizado e direto para pedidos sem comissão, certo?',
          argumento:
            'A página própria com cardápio digital fideliza o cliente direto no seu WhatsApp, eliminando comissões abusivas e organizando pedidos e reservas.',
        },
        proximoPasso:
          'Enviar modelos de cardápio digital e páginas de restaurantes para o WhatsApp e agendar 15 minutos.',
      }
    } else if (isAutomotiveSegment) {
      personalizedPitch = {
        abertura: interpolateText(
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], da Bit Consulting. Vi o trabalho da [NOME DA EMPRESA] em [CIDADE] e achei muito profissional. Posso te fazer uma pergunta rápida?',
          context,
        ),
        pergunta1: interpolateText(
          input.digitalSituation === 'Utiliza somente Instagram'
            ? 'Hoje no Instagram os clientes já entendem todos os pacotes de serviços e valores ou ainda chamam toda hora para tirar dúvidas básicas antes de agendar?'
            : 'Hoje quando alguém busca por estética automotiva e cuidados com veículos em [CIDADE], onde essa pessoa encontra a tabela oficial de serviços e portfólio da [NOME DA EMPRESA]?',
          context,
        ),
        pergunta2: interpolateText(
          'Vocês gostariam de agilizar o agendamento de serviços e pedidos de orçamento rápido com uma página de alta conversão?',
          context,
        ),
        pitch: interpolateText(
          input.productDescription
            ? `${input.productDescription} O investimento inicial é a partir de R$ 500,00, e R$ 55,00/mês cobrindo domínio, hospedagem segura e todo o suporte técnico.`
            : 'Nós criamos uma página profissional sob medida para a [NOME DA EMPRESA] apresentar todos os serviços, fotos de antes e depois, localização e botão direto para agendamento de serviços e orçamentos rápidos no WhatsApp. O investimento inicial é a partir de R$ 500,00, e R$ 55,00/mês cobrindo domínio, hospedagem segura e todo o suporte técnico.',
          context,
        ),
        argumento: interpolateText(
          'A página profissional passa autoridade imediata para donos de veículos exigentes. O cliente vê os serviços executados e clica para agendar já sabendo o padrão do trabalho.',
          context,
        ),
        possivelObjecao: {
          objecao: 'Já tenho Instagram',
          clarificacao:
            'No Instagram os clientes encontram a lista clara de serviços e botão para agendamento direto sem distrações?',
          argumento:
            'A página profissional organiza seus serviços e agiliza orçamentos rápidos e agendamentos no WhatsApp, complementando o Instagram.',
        },
        proximoPasso:
          'Enviar exemplos do segmento automotivo no WhatsApp e validar se faz sentido agendar 15 minutos.',
      }
    } else {
      // Neutro / geral sem inventar nicho
      personalizedPitch = {
        abertura: interpolateText(
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], da Bit Consulting. Vi o trabalho da [NOME DA EMPRESA] em [CIDADE] e achei muito profissional. Posso te fazer uma pergunta rápida?',
          context,
        ),
        pergunta1: interpolateText(
          input.digitalSituation === 'Utiliza somente Instagram'
            ? 'O Instagram hoje atende tudo o que a [NOME DA EMPRESA] precisa ou os clientes ainda perguntam bastante sobre serviços, localização ou orçamento?'
            : 'Hoje quando alguém busca pelos serviços da [NOME DA EMPRESA] em [CIDADE], onde essa pessoa encontra as informações oficiais?',
          context,
        ),
        pergunta2: interpolateText(
          'Quais são os serviços que vocês mais gostariam de destacar e vender este mês?',
          context,
        ),
        pitch: interpolateText(
          input.productDescription
            ? `${input.productDescription} O investimento inicial é a partir de R$ 500,00, e R$ 55,00/mês cobrindo domínio, hospedagem segura e todo o suporte técnico.`
            : 'Nós criamos uma página profissional sob medida para a [NOME DA EMPRESA] apresentar todos os serviços, fotos e localização, direcionando o cliente direto para o WhatsApp. O investimento inicial é a partir de R$ 500,00, e R$ 55,00/mês cobrindo domínio, hospedagem segura e todo o suporte técnico.',
          context,
        ),
        argumento: interpolateText(
          'O site não substitui seus canais atuais, ele organiza. O cliente vê autoridade imediata e clica no WhatsApp já sabendo o que quer comprar.',
          context,
        ),
        possivelObjecao: {
          objecao: 'Já tenho Instagram',
          clarificacao: 'O Instagram hoje consegue atender tudo que vocês precisam?',
          argumento:
            'O site complementa o Instagram. No Instagram o cliente se distrai; no site oficial ele foca na contratação.',
        },
        proximoPasso: 'Enviar exemplos no WhatsApp e validar se faz sentido agendar 15 minutos.',
      }
    }
  }

  return {
    currentScript,
    currentScriptTitle,
    currentScriptProductName,
    currentQuestion,
    possibleAnswers,
    recommendedArgument,
    nextBestAction,
    nextBestActionDescription,
    temperature: tempEval.temperature,
    temperatureReason: tempEval.reason,
    suggestedStatus: tempEval.suggestedStatus,
    personalizedPitch,
  }
}
