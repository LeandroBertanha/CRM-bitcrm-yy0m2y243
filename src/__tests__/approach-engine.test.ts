import { describe, it, expect } from 'vitest'
import {
  evaluateLeadTemperature,
  interpolateText,
  runApproachEngine,
} from '../services/approach-engine'
import type { PlaybookBundle } from '../types/playbook'

describe('Motor de Abordagem Comercial (approach-engine)', () => {
  it('deve interpolar corretamente variáveis no texto do script', () => {
    const raw =
      'Olá, meu nome é [NOME DO VENDEDOR], da Bit Consulting. Vi o trabalho da [NOME DA EMPRESA] em [CIDADE].'
    const result = interpolateText(raw, {
      sellerName: 'Leandro',
      companyName: 'Mendes Estética',
      city: 'Carapicuíba',
    })

    expect(result).toBe(
      'Olá, meu nome é Leandro, da Bit Consulting. Vi o trabalho da Mendes Estética em Carapicuíba.',
    )
  })

  describe('Interpolação moderna de scripts com chaves ({contato}, {empresa}, {cidade}, {vendedor}, {ref})', () => {
    const rawTemplate =
      'Olá, {contato}! Tudo bem? Aqui é {vendedor}, da bit Consulting... Vi o atendimento da {empresa} em {cidade}... — {vendedor}, bit Consulting · Ref. {ref}'

    it('interpola todos os valores presentes corretamente', () => {
      const result = interpolateText(rawTemplate, {
        contactName: 'Afonso',
        sellerName: 'Gabriel',
        companyName: 'A.R Estética Automotiva',
        city: 'Osasco',
        ref: 'ARE-1948',
      })

      expect(result).toBe(
        'Olá, Afonso! Tudo bem? Aqui é Gabriel, da bit Consulting... Vi o atendimento da A.R Estética Automotiva em Osasco... — Gabriel, bit Consulting · Ref. ARE-1948',
      )
      expect(result).not.toContain('{')
      expect(result).not.toContain('}')
    })

    it('remove fragmento " em {cidade}" sem deixar resíduo de preposição nem espaço duplo quando cidade é vazia ou nula', () => {
      const result = interpolateText(rawTemplate, {
        contactName: 'Afonso',
        sellerName: 'Gabriel',
        companyName: 'A.R Estética Automotiva',
        city: '',
        ref: 'ARE-1948',
      })

      expect(result).toBe(
        'Olá, Afonso! Tudo bem? Aqui é Gabriel, da bit Consulting... Vi o atendimento da A.R Estética Automotiva... — Gabriel, bit Consulting · Ref. ARE-1948',
      )
      expect(result).not.toContain(' em ...')
      expect(result).not.toContain(' em ')
      expect(result).not.toContain('{cidade}')
      expect(result).not.toMatch(/[ ]{2,}/)
    })

    it('usa apenas o primeiro nome quando o nome do contato for composto', () => {
      const template = 'Olá, {contato}! Tudo bem?'
      const result = interpolateText(template, {
        contactName: 'Afonso Rodrigues de Oliveira',
      })

      expect(result).toBe('Olá, Afonso! Tudo bem?')
    })

    it('aplica fallbacks elegantes quando campos não estão preenchidos', () => {
      const template =
        'Olá, {contato}! Aqui é {vendedor}. Vi o trabalho da {empresa} em {cidade} no segmento {segmento}. Ref. {ref}. Último contato: {data}.'
      const result = interpolateText(template, {})

      expect(result).toContain('Olá, Responsável!')
      expect(result).toContain('Aqui é Consultor Comercial.')
      expect(result).toContain('Vi o trabalho da sua empresa no segmento sua área.')
      expect(result).toContain('Ref. BIT.')
      expect(result).toContain('Último contato: nosso último contato.')
      expect(result).not.toContain('{')
    })
  })

  it('deve classificar lead como QUENTE quando pede proposta ou demonstra interesse forte', () => {
    const evalResult = evaluateLeadTemperature({
      quickTags: ['interessado', 'gerar proposta'],
      decisionMaker: 'Carlos Dono',
      interests: 'Quer implantar site completo',
    })

    expect(evalResult.temperature).toBe('quente')
    expect(evalResult.reason).toContain('solicitação de proposta')
  })

  it('deve classificar lead como FRIO quando declara sem interesse ou recusa', () => {
    const evalResult = evaluateLeadTemperature({
      activeObjection: 'Não tenho interesse',
      quickTags: ['sem interesse'],
    })

    expect(evalResult.temperature).toBe('frio')
    expect(evalResult.reason).toContain('sem interesse')
  })

  it('deve classificar lead como MORNO quando pede para falar com o sócio ou ver exemplos', () => {
    const evalResult = evaluateLeadTemperature({
      activeObjection: 'Preciso falar com meu sócio',
      quickTags: ['falar com sócio'],
    })

    expect(evalResult.temperature).toBe('morno')
    expect(evalResult.reason).toContain('sócio')
  })

  it('deve recomendar próxima ação coerente com as tags da conversa', () => {
    const dummyPlaybook: PlaybookBundle = {
      segments: [],
      scripts: [
        {
          id: '1',
          collectionId: '',
          collectionName: '',
          created: '',
          updated: '',
          channel: 'Telefone',
          title: 'Abertura',
          script_text: 'Olá [NOME DO VENDEDOR]',
          display_order: 1,
          is_active: true,
        },
      ],
      questions: [
        {
          id: 'q1',
          collectionId: '',
          collectionName: '',
          created: '',
          updated: '',
          type: 'diagnóstico',
          text: 'Hoje vocês possuem algum site?',
          display_order: 1,
          is_active: true,
        },
      ],
      answers: [],
      objections: [],
      argumentsList: [],
      valuesConfig: null,
      nextSteps: [],
    }

    const decision = runApproachEngine({
      channel: 'Telefone',
      currentQuestionIndex: 0,
      askedQuestions: [],
      givenAnswers: [],
      quickTags: ['falar com sócio'],
      playbook: dummyPlaybook,
      context: { sellerName: 'Ana' },
    })

    expect(decision.nextBestAction).toBe('Agendar retorno')
    expect(decision.temperature).toBe('morno')
  })

  it('deve selecionar script do WhatsApp Autônomo quando o produto informado for WhatsApp Autônomo', () => {
    const playbookComProdutos: PlaybookBundle = {
      segments: [],
      scripts: [
        {
          id: 'sc_site',
          collectionId: 'playbook_scripts',
          collectionName: 'playbook_scripts',
          created: '',
          updated: '',
          channel: 'WhatsApp',
          title: 'Primeira Mensagem WhatsApp',
          script_text: 'Olá, ajudamos com sites.',
          product: 'prod_site',
          product_name: 'Site ou Landing Page sob medida',
          display_order: 4,
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
          script_text: 'Olá [NOME DO CONTATO], implementamos atendente no WhatsApp.',
          product: 'prod_wa',
          product_name: 'WhatsApp Autônomo e Humanizado',
          display_order: 8,
          is_active: true,
        },
      ],
      questions: [],
      answers: [],
      objections: [],
      argumentsList: [],
      valuesConfig: null,
      nextSteps: [],
    }

    // Caso 1: Oportunidade com produto WhatsApp Autônomo
    const decisionWa = runApproachEngine({
      channel: 'WhatsApp',
      currentQuestionIndex: 0,
      askedQuestions: [],
      givenAnswers: [],
      quickTags: [],
      playbook: playbookComProdutos,
      productId: 'prod_wa',
      productName: 'WhatsApp Autônomo e Humanizado',
      context: { contactName: 'Juliana' },
    })

    expect(decisionWa.currentScriptTitle).toBe('Abordagem Inicial - WhatsApp Autônomo')
    expect(decisionWa.currentScriptProductName).toBe('WhatsApp Autônomo e Humanizado')
    expect(decisionWa.currentScript).toContain('Olá Juliana, implementamos atendente no WhatsApp.')
    // Pitch personalizado para WhatsApp Autônomo
    expect(decisionWa.personalizedPitch?.pitch).toContain(
      'atendente autônomo e humanizado no WhatsApp',
    )

    // Caso 2: Oportunidade com produto Site
    const decisionSite = runApproachEngine({
      channel: 'WhatsApp',
      currentQuestionIndex: 0,
      askedQuestions: [],
      givenAnswers: [],
      quickTags: [],
      playbook: playbookComProdutos,
      productId: 'prod_site',
      productName: 'Site ou Landing Page sob medida',
      context: { contactName: 'Juliana' },
    })

    expect(decisionSite.currentScriptTitle).toBe('Primeira Mensagem WhatsApp')
    expect(decisionSite.currentScriptProductName).toBe('Site ou Landing Page sob medida')
    expect(decisionSite.currentScript).toContain('Olá, ajudamos com sites.')
    expect(decisionSite.personalizedPitch?.pitch).toContain('página profissional sob medida')

    // Caso 3: Oportunidade sem produto especificado -> cai no primeiro do canal
    const decisionSemProd = runApproachEngine({
      channel: 'WhatsApp',
      currentQuestionIndex: 0,
      askedQuestions: [],
      givenAnswers: [],
      quickTags: [],
      playbook: playbookComProdutos,
    })

    expect(decisionSemProd.currentScriptTitle).toBe('Primeira Mensagem WhatsApp')

    // Caso 4: Produto sem script no canal -> cai no script genérico sem produto se houver
    const playbookComGenerico: PlaybookBundle = {
      ...playbookComProdutos,
      scripts: [
        ...playbookComProdutos.scripts,
        {
          id: 'sc_gen',
          collectionId: 'playbook_scripts',
          collectionName: 'playbook_scripts',
          created: '',
          updated: '',
          channel: 'WhatsApp',
          title: 'Script Genérico',
          script_text: 'Olá genérico',
          display_order: 1,
          is_active: true,
        },
      ],
    }

    const decisionFallbackGenerico = runApproachEngine({
      channel: 'WhatsApp',
      currentQuestionIndex: 0,
      askedQuestions: [],
      givenAnswers: [],
      quickTags: [],
      playbook: playbookComGenerico,
      productId: 'outro_produto_inexistente',
      productName: 'Sistema Customizado',
    })

    expect(decisionFallbackGenerico.currentScriptTitle).toBe('Script Genérico')
  })

  describe('Especialização de Pitch por Segmento e Interpolação Neutra (sem Estética Automotiva fixa)', () => {
    const dummyPlaybook: PlaybookBundle = {
      segments: [],
      scripts: [
        {
          id: 'sc_padrao',
          collectionId: '',
          collectionName: '',
          created: '',
          updated: '',
          channel: 'WhatsApp',
          title: 'Primeira Mensagem',
          script_text: 'Olá! Ajudamos empresas do segmento de [SEGMENTO].',
          display_order: 1,
          is_active: true,
        },
      ],
      questions: [],
      answers: [],
      objections: [],
      argumentsList: [],
      valuesConfig: null,
      nextSteps: [],
    }

    it('quando ctx.segment estiver vazio ou nulo, [SEGMENTO] interpola como texto genérico ("sua área") e nunca "Estética Automotiva"', () => {
      const template = 'Ajudamos empresas do nicho de [SEGMENTO] a venderem mais.'
      const resVazio = interpolateText(template, { segment: '' })
      const resNulo = interpolateText(template, { segment: undefined })

      expect(resVazio).toBe('Ajudamos empresas do nicho de sua área a venderem mais.')
      expect(resNulo).toBe('Ajudamos empresas do nicho de sua área a venderem mais.')
      expect(resVazio).not.toContain('Estética Automotiva')
      expect(resNulo).not.toContain('Estética Automotiva')
    })

    it('lead com segmento Restaurante gera pitch especializado com foco em cardápio digital, reservas, pedidos fora de hora e horários de pico', () => {
      const decision = runApproachEngine({
        channel: 'WhatsApp',
        segment: 'Restaurante',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: dummyPlaybook,
        context: {
          companyName: 'Restaurante Fogão a Lenha',
          city: 'Curitiba',
          segment: 'Restaurante',
        },
      })

      const pitch = decision.personalizedPitch
      expect(pitch).toBeDefined()
      // Deve conter termos específicos de gastronomia / restaurante
      expect(pitch?.pitch).toContain('cardápio digital')
      expect(pitch?.pitch).toContain('reservas')
      expect(pitch?.pergunta2).toContain('pedidos fora de hora')
      expect(pitch?.pergunta2).toContain('horários de pico')
      // NUNCA conter estética automotiva
      expect(pitch?.pitch).not.toContain('automotivo')
      expect(pitch?.pitch).not.toContain('Estética Automotiva')
      expect(pitch?.pitch).not.toContain('polimento')
    })

    it('lead com segmento Restaurante no produto WhatsApp Autônomo gera pitch de atendente para cardápio digital, horários de pico e reservas', () => {
      const decisionWa = runApproachEngine({
        channel: 'WhatsApp',
        segment: 'Restaurante',
        productName: 'WhatsApp Autônomo e Humanizado',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: dummyPlaybook,
        context: {
          companyName: 'Pizzaria Bella Napoli',
          city: 'São Paulo',
          segment: 'Restaurante',
        },
      })

      const pitch = decisionWa.personalizedPitch
      expect(pitch).toBeDefined()
      expect(pitch?.abertura).toContain('pedidos e reservas')
      expect(pitch?.pergunta1).toContain('cardápio digital')
      expect(pitch?.pitch).toContain('cardápio digital instantaneamente')
      expect(pitch?.pitch).toContain('horários de pico')
      expect(pitch?.pitch).not.toContain('Estética Automotiva')
    })

    it('lead com segmento Estética Automotiva / Lava-Rápido gera pitch com agendamento de serviços e orçamentos rápidos', () => {
      const decisionAuto = runApproachEngine({
        channel: 'WhatsApp',
        segment: 'Estética Automotiva',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: dummyPlaybook,
        context: {
          companyName: 'Auto Brilho Detailing',
          city: 'Campinas',
          segment: 'Estética Automotiva',
        },
      })

      const pitch = decisionAuto.personalizedPitch
      expect(pitch).toBeDefined()
      expect(pitch?.pitch).toContain('agendamento de serviços')
      expect(pitch?.pitch).toContain('orçamentos rápidos')
      expect(pitch?.pitch).not.toContain('cardápio')
    })

    it('lead sem segmento gera pitch neutro comercial sem nicho automotivo fixo', () => {
      const decisionNeutro = runApproachEngine({
        channel: 'WhatsApp',
        segment: '',
        currentQuestionIndex: 0,
        askedQuestions: [],
        givenAnswers: [],
        quickTags: [],
        playbook: dummyPlaybook,
        context: {
          companyName: 'Consultoria Alpha',
          city: 'Belo Horizonte',
          segment: '',
        },
      })

      const pitch = decisionNeutro.personalizedPitch
      expect(pitch).toBeDefined()
      // Mantém abordagem comercial neutra
      expect(pitch?.pitch).toContain('apresentar todos os serviços')
      expect(pitch?.pitch).not.toContain('Estética Automotiva')
      expect(pitch?.pitch).not.toContain('cardápio')
      expect(pitch?.pitch).not.toContain('polimento')
    })
  })
})
