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
})
