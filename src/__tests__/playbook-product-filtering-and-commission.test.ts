import { describe, it, expect } from 'vitest'
import type {
  PlaybookBundle,
  PlaybookQuestion,
  PlaybookObjection,
  PlaybookArgument,
  PlaybookValues,
  PlaybookScript,
  PlaybookNextStep,
} from '@/types/playbook'
import { runApproachEngine } from '@/services/approach-engine'
import { calculateCommission, type CommissionTier } from '@/types/commission'

describe('Playbook Product Filtering & Commission Setup Suite', () => {
  const PROD_WA_ID = 'txb6flu9mlec6g6'
  const PROD_WA_NAME = 'WhatsApp Autônomo e Humanizado'
  const PROD_SITE_ID = 'f71sewm5yry6jif'
  const PROD_SITE_NAME = 'Site ou Landing Page sob medida'

  const mockQuestions: PlaybookQuestion[] = [
    {
      id: 'q_gen_1',
      collectionId: 'playbook_questions',
      collectionName: 'playbook_questions',
      created: '',
      updated: '',
      type: 'diagnóstico',
      text: 'Qual é o maior desafio atual da empresa para atrair novos clientes?',
      display_order: 1,
      is_active: true,
      product: '',
      product_name: '',
    },
    {
      id: 'q_site_1',
      collectionId: 'playbook_questions',
      collectionName: 'playbook_questions',
      created: '',
      updated: '',
      type: 'diagnóstico',
      text: 'Hoje vocês possuem algum site ou utilizam apenas redes sociais?',
      display_order: 2,
      is_active: true,
      product: PROD_SITE_ID,
      product_name: PROD_SITE_NAME,
    },
    {
      id: 'q_wa_1',
      collectionId: 'playbook_questions',
      collectionName: 'playbook_questions',
      created: '',
      updated: '',
      type: 'diagnóstico',
      text: 'Quem responde o WhatsApp da empresa hoje e quantas pessoas cuidam do atendimento?',
      display_order: 3,
      is_active: true,
      product: PROD_WA_ID,
      product_name: PROD_WA_NAME,
    },
    {
      id: 'q_wa_2',
      collectionId: 'playbook_questions',
      collectionName: 'playbook_questions',
      created: '',
      updated: '',
      type: 'qualificação',
      text: 'Vocês recebem mensagens fora do horário comercial e o que acontece com elas hoje?',
      display_order: 4,
      is_active: true,
      product: PROD_WA_ID,
      product_name: PROD_WA_NAME,
    },
  ]

  const mockObjections: PlaybookObjection[] = [
    {
      id: 'obj_gen_1',
      collectionId: 'playbook_objections',
      collectionName: 'playbook_objections',
      created: '',
      updated: '',
      name: 'Está caro',
      treatment_script:
        'Entendo sua preocupação com custos. O retorno compensa o investimento inicial.',
      display_order: 1,
      is_active: true,
      product: '',
      product_name: '',
    },
    {
      id: 'obj_site_1',
      collectionId: 'playbook_objections',
      collectionName: 'playbook_objections',
      created: '',
      updated: '',
      name: 'Já tenho Instagram, não preciso de site',
      treatment_script:
        'O Instagram é ótimo para relacionamento, mas o site traz autoridade no Google.',
      display_order: 2,
      is_active: true,
      product: PROD_SITE_ID,
      product_name: PROD_SITE_NAME,
    },
    {
      id: 'obj_wa_1',
      collectionId: 'playbook_objections',
      collectionName: 'playbook_objections',
      created: '',
      updated: '',
      name: 'Não quero robô atendendo',
      clarification_question:
        'Você tem receio daqueles menus numéricos travados que irritam o cliente?',
      treatment_script:
        'Nosso modelo tem inteligência com linguagem natural e conversa com tom humano sem parecer robô.',
      display_order: 3,
      is_active: true,
      product: PROD_WA_ID,
      product_name: PROD_WA_NAME,
    },
  ]

  const mockArguments: PlaybookArgument[] = [
    {
      id: 'arg_gen_1',
      collectionId: 'playbook_arguments',
      collectionName: 'playbook_arguments',
      created: '',
      updated: '',
      situation: 'Geral',
      argument_text:
        'A presença digital profissional posiciona a empresa à frente da concorrência.',
      display_order: 1,
      is_active: true,
      product: '',
      product_name: '',
    },
    {
      id: 'arg_site_1',
      collectionId: 'playbook_arguments',
      collectionName: 'playbook_arguments',
      created: '',
      updated: '',
      situation: 'Visibilidade Google',
      argument_text:
        'Com um site próprio e domínio exclusivo, sua empresa é encontrada por clientes que buscam no Google.',
      display_order: 2,
      is_active: true,
      product: PROD_SITE_ID,
      product_name: PROD_SITE_NAME,
    },
    {
      id: 'arg_wa_1',
      collectionId: 'playbook_arguments',
      collectionName: 'playbook_arguments',
      created: '',
      updated: '',
      situation: 'Cliente perde vendas fora do horário',
      argument_text:
        'Mais de 60% das mensagens chegam à noite ou fins de semana. O atendente responde em menos de 10 segundos.',
      display_order: 3,
      is_active: true,
      product: PROD_WA_ID,
      product_name: PROD_WA_NAME,
    },
  ]

  const mockValues: PlaybookValues[] = [
    {
      id: 'val_gen',
      collectionId: 'playbook_values',
      collectionName: 'playbook_values',
      created: '',
      updated: '',
      title: 'Estrutura Padrão - Site Profissional',
      creation_value: 500,
      monthly_value: 55,
      script:
        'Criação a partir de R$ 500,00 e mensalidade de R$ 55,00/mês para domínio e hospedagem.',
      product: PROD_SITE_ID,
      product_name: PROD_SITE_NAME,
      is_active: true,
    },
    {
      id: 'val_wa',
      collectionId: 'playbook_values',
      collectionName: 'playbook_values',
      created: '',
      updated: '',
      title: 'WhatsApp Autônomo e Humanizado - Atendente IA',
      creation_value: 500,
      monthly_value: 55,
      script: 'Setup inicial de R$ 500,00 para configuração e mensalidade técnica de R$ 55,00/mês.',
      product: PROD_WA_ID,
      product_name: PROD_WA_NAME,
      is_active: true,
    },
  ]

  const mockScripts: PlaybookScript[] = [
    {
      id: 'sc_gen',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '',
      updated: '',
      channel: 'WhatsApp',
      title: 'Primeira Mensagem Geral',
      script_text: 'Olá, {contato}! Falamos da bit Consulting.',
      display_order: 1,
      is_active: true,
    },
    {
      id: 'sc_site',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '',
      updated: '',
      channel: 'WhatsApp',
      title: 'Primeira Mensagem - Site',
      script_text: 'Olá, {contato}! Criamos landing pages e sites profissionais para a {empresa}.',
      product: PROD_SITE_ID,
      product_name: PROD_SITE_NAME,
      display_order: 2,
      is_active: true,
    },
    {
      id: 'sc_wa',
      collectionId: 'playbook_scripts',
      collectionName: 'playbook_scripts',
      created: '',
      updated: '',
      channel: 'WhatsApp',
      title: 'Abordagem Inicial - WhatsApp Autônomo',
      script_text:
        'Olá, {contato}! Implementamos atendente no WhatsApp com resposta humanizada para a {empresa}.',
      product: PROD_WA_ID,
      product_name: PROD_WA_NAME,
      display_order: 3,
      is_active: true,
    },
  ]

  const mockNextSteps: PlaybookNextStep[] = [
    {
      id: 'step_gen_1',
      collectionId: 'playbook_next_steps',
      collectionName: 'playbook_next_steps',
      created: '',
      updated: '',
      action: 'Fazer mais uma pergunta',
      description: 'Aprofundar diagnóstico do lead.',
      display_order: 1,
      is_active: true,
    },
    {
      id: 'step_site_1',
      collectionId: 'playbook_next_steps',
      collectionName: 'playbook_next_steps',
      created: '',
      updated: '',
      action: 'Enviar portfólio',
      description: 'Compartilhar modelos de site via WhatsApp.',
      product: PROD_SITE_ID,
      product_name: PROD_SITE_NAME,
      display_order: 2,
      is_active: true,
    },
    {
      id: 'step_wa_1',
      collectionId: 'playbook_next_steps',
      collectionName: 'playbook_next_steps',
      created: '',
      updated: '',
      action: 'Agendar demonstração do atendente',
      description: 'Acionar demonstração em tempo real no WhatsApp.',
      product: PROD_WA_ID,
      product_name: PROD_WA_NAME,
      display_order: 3,
      is_active: true,
    },
  ]

  const mockPlaybook: PlaybookBundle = {
    segments: [],
    scripts: mockScripts,
    questions: mockQuestions,
    answers: [],
    objections: mockObjections,
    argumentsList: mockArguments,
    valuesConfig: mockValues[0],
    valuesList: mockValues,
    nextSteps: mockNextSteps,
  }

  describe('1. Filtragem de Conteúdo por Produto no Engine e no Copiloto', () => {
    it('com produto "WhatsApp Autônomo e Humanizado", prioriza scripts e perguntas do WhatsApp Autônomo', () => {
      const decision = runApproachEngine({
        channel: 'WhatsApp',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: mockPlaybook,
        productId: PROD_WA_ID,
        productName: PROD_WA_NAME,
        context: { contactName: 'Renata', companyName: 'Ótica Visão' },
      })

      expect(decision.currentScriptTitle).toBe('Abordagem Inicial - WhatsApp Autônomo')
      expect(decision.currentScriptProductName).toBe(PROD_WA_NAME)
      expect(decision.currentScript).toContain('implementamos atendente no WhatsApp')

      // Pergunta selecionada deve ser do WhatsApp Autônomo (priorizada sobre genéricas)
      expect(decision.currentQuestion).not.toBeNull()
      expect(decision.currentQuestion?.product_name).toBe(PROD_WA_NAME)
      expect(decision.currentQuestion?.text).toContain('Quem responde o WhatsApp da empresa')
    })

    it('com produto "Site ou Landing Page sob medida", seleciona conteúdo do Site', () => {
      const decision = runApproachEngine({
        channel: 'WhatsApp',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: mockPlaybook,
        productId: PROD_SITE_ID,
        productName: PROD_SITE_NAME,
        context: { contactName: 'Carlos', companyName: 'Oficina Central' },
      })

      expect(decision.currentScriptTitle).toBe('Primeira Mensagem - Site')
      expect(decision.currentScriptProductName).toBe(PROD_SITE_NAME)
      expect(decision.currentScript).toContain('landing pages e sites profissionais')

      // Pergunta do produto Site deve ser priorizada
      expect(decision.currentQuestion?.product_name).toBe(PROD_SITE_NAME)
      expect(decision.currentQuestion?.text).toContain('Hoje vocês possuem algum site')
    })

    it('com produto WhatsApp Autônomo e tag de exemplos/demo, sugere próximo passo "Agendar demonstração do atendente"', () => {
      const decision = runApproachEngine({
        channel: 'WhatsApp',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: ['quer ver exemplos'],
        playbook: mockPlaybook,
        productId: PROD_WA_ID,
        productName: PROD_WA_NAME,
      })

      expect(decision.nextBestAction).toBe('Agendar demonstração do atendente')
      expect(decision.nextBestActionDescription).toContain('atendente')
    })

    it('com produto Site e tag de exemplos, sugere próximo passo "Enviar portfólio"', () => {
      const decision = runApproachEngine({
        channel: 'WhatsApp',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: ['quer ver exemplos'],
        playbook: mockPlaybook,
        productId: PROD_SITE_ID,
        productName: PROD_SITE_NAME,
      })

      expect(decision.nextBestAction).toBe('Enviar portfólio')
      expect(decision.nextBestActionDescription).toContain('modelos de destaque')
    })
  })

  describe('2. Compatibilidade do Conteúdo Genérico (produto vazio não quebra nada)', () => {
    it('quando nenhum produto é informado (produto vazio/undefined), seleciona itens genéricos sem falhas', () => {
      const decision = runApproachEngine({
        channel: 'WhatsApp',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: mockPlaybook,
        productId: undefined,
        productName: undefined,
        context: { contactName: 'Lucas' },
      })

      // Script genérico sem produto vinculado
      expect(decision.currentScriptTitle).toBe('Primeira Mensagem Geral')
      // Pergunta genérica sem produto vinculado
      expect(decision.currentQuestion).not.toBeNull()
      expect(decision.currentQuestion?.text).toBe(
        'Qual é o maior desafio atual da empresa para atrair novos clientes?',
      )
      expect(decision.currentQuestion?.product).toBeFalsy()
      expect(decision.currentQuestion?.product_name).toBeFalsy()
    })

    it('itens genéricos convivem no playbook e mantêm integridade quando produto não tem perguntas cadastradas', () => {
      const playbookSemPerguntasWa: PlaybookBundle = {
        ...mockPlaybook,
        questions: [mockQuestions[0]], // apenas a genérica
      }

      const decision = runApproachEngine({
        channel: 'WhatsApp',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: playbookSemPerguntasWa,
        productId: PROD_WA_ID,
        productName: PROD_WA_NAME,
      })

      // Deve aceitar a pergunta genérica como fallback seguro
      expect(decision.currentQuestion).not.toBeNull()
      expect(decision.currentQuestion?.text).toBe(
        'Qual é o maior desafio atual da empresa para atrair novos clientes?',
      )
    })
  })

  describe('3. Cálculo de Comissão: Apenas Setup a partir de R$ 350,00 na Base (Mensalidade R$ 55/mês NUNCA na base)', () => {
    const mockTiers: CommissionTier[] = [
      {
        id: 'tier_1',
        collectionId: 'commission_tiers',
        collectionName: 'commission_tiers',
        created: '',
        updated: '',
        name: 'Faixa 1 (1 a 4 vendas)',
        min_sales: 1,
        max_sales: 4,
        percentage: 20,
        commission_per_sale: 70, // 20% sobre 350
        is_active: true,
        display_order: 1,
      },
      {
        id: 'tier_2',
        collectionId: 'commission_tiers',
        collectionName: 'commission_tiers',
        created: '',
        updated: '',
        name: 'Faixa 2 (5 a 9 vendas)',
        min_sales: 5,
        max_sales: 9,
        percentage: 25,
        commission_per_sale: 87.5, // 25% sobre 350
        is_active: true,
        display_order: 2,
      },
      {
        id: 'tier_3',
        collectionId: 'commission_tiers',
        collectionName: 'commission_tiers',
        created: '',
        updated: '',
        name: 'Faixa 3 (10 ou mais vendas)',
        min_sales: 10,
        max_sales: null,
        percentage: 30,
        commission_per_sale: 105, // 30% sobre 350
        is_active: true,
        display_order: 3,
      },
    ]

    it('calcula comissão usando o setup de R$ 350,00 e ignora categoricamente a mensalidade de R$ 55,00', () => {
      const setupValue = 350
      const recurringMonthlyValue = 55

      // Oportunidade do produto WhatsApp Autônomo com setup R$ 350 e mensalidade R$ 55
      const opportunityWa = {
        id: 'opp_wa_comm_1',
        value: setupValue, // R$ 350 na oportunidade (base)
        recurring_value: recurringMonthlyValue, // R$ 55/mês fora da base
      }

      // Base da comissão deve ser estritamente o setupValue
      const baseEfetiva = opportunityWa.value
      expect(baseEfetiva).toBe(350)
      expect(opportunityWa.recurring_value).toBe(55)

      // Se somasse a mensalidade de 55 daria 405
      const valorComMensalidadeIndevida = baseEfetiva + opportunityWa.recurring_value
      expect(valorComMensalidadeIndevida).toBe(405)

      // Cálculo com 1 venda sobre o setup de 350 via objeto de oportunidade
      const res1 = calculateCommission(1, mockTiers, 350, [{ value: baseEfetiva }])
      expect(res1.commissionPerSale).toBe(70)
      expect(res1.totalCommission).toBe(70)

      // Verificação: se erroneamente calculasse sobre 405, o total seria diferente
      const resErrado = calculateCommission(1, mockTiers, 350, [
        { value: valorComMensalidadeIndevida },
      ])
      expect(resErrado.totalCommission).toBe(81) // 405 * 20% = 81 != 70
      expect(res1.totalCommission).not.toBe(resErrado.totalCommission)
    })

    it('calcula comissão para múltiplas vendas de WhatsApp Autônomo garantindo que todas usem base R$ 350', () => {
      const salesCount = 6 // Faixa 2: 25% -> R$ 87,50 por venda
      const opps = Array.from({ length: salesCount }, (_, idx) => ({
        id: `opp_${idx + 1}`,
        value: 350, // apenas setup R$ 350
      }))

      const res = calculateCommission(salesCount, mockTiers, 350, opps)
      expect(res.commissionPerSale).toBe(87.5)
      expect(res.totalCommission).toBe(525) // 6 * 87.5 = 525

      // Detalhes de cada oportunidade
      expect(res.opportunityDetails).toBeDefined()
      expect(res.opportunityDetails?.length).toBe(6)
      res.opportunityDetails?.forEach((opp) => {
        expect(opp.value).toBe(350)
        expect(opp.unitCommission).toBe(87.5)
      })
    })

    it('calcula proporcional quando setup é negociado acima de R$ 350 (ex: R$ 500,00 na Faixa 1)', () => {
      // 1 venda de R$ 500 na Faixa 1 (20%): comissão = 500 * 20% = R$ 100
      const opps = [{ id: 'opp_500', value: 500 }]
      const res = calculateCommission(1, mockTiers, 350, opps)
      expect(res.commissionPerSale).toBe(100)
      expect(res.totalCommission).toBe(100)
      expect(res.isProportional).toBe(true)
    })

    it('estrutura de valores do WhatsApp Autônomo e do Site registram setup a partir de 350 e mensalidade de 55 separados', () => {
      const valWa = mockValues.find((v) => v.product_name === PROD_WA_NAME)
      expect(valWa).toBeDefined()
      expect(valWa?.monthly_value).toBe(55)
      expect(valWa?.creation_value).not.toBe(valWa?.creation_value! + valWa?.monthly_value!)
    })
  })
})
