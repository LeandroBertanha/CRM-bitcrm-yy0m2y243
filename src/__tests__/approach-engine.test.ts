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
})
