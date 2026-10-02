migrate(
  (app) => {
    // Obter ID da collection users para relation
    const usersColId = '_pb_users_auth_'
    const oppsCol = app.findCollectionByNameOrId('opportunities')
    const oppsColId = oppsCol.id

    // Regra admin geral: role = 'admin' ou leandro.bertanha@lbertanha.com
    const adminRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"

    // 1. playbook_segments
    let segmentsCol
    try {
      segmentsCol = app.findCollectionByNameOrId('playbook_segments')
    } catch (_) {
      segmentsCol = new Collection({
        name: 'playbook_segments',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_playbook_segments_order ON playbook_segments (display_order)'],
      })
      app.save(segmentsCol)
    }

    // 2. playbook_scripts
    let scriptsCol
    try {
      scriptsCol = app.findCollectionByNameOrId('playbook_scripts')
    } catch (_) {
      scriptsCol = new Collection({
        name: 'playbook_scripts',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          {
            name: 'channel',
            type: 'select',
            required: true,
            values: ['Telefone', 'Presencial', 'WhatsApp', 'Reunião', 'Retorno'],
            maxSelect: 1,
          },
          { name: 'situation', type: 'text', required: false },
          { name: 'title', type: 'text', required: true },
          { name: 'script_text', type: 'text', required: true },
          { name: 'instructions', type: 'text', required: false },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_playbook_scripts_channel ON playbook_scripts (channel, display_order)',
        ],
      })
      app.save(scriptsCol)
    }

    // 3. playbook_questions
    let questionsCol
    try {
      questionsCol = app.findCollectionByNameOrId('playbook_questions')
    } catch (_) {
      questionsCol = new Collection({
        name: 'playbook_questions',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          {
            name: 'type',
            type: 'select',
            required: true,
            values: ['diagnóstico', 'qualificação', 'fluxo'],
            maxSelect: 1,
          },
          { name: 'text', type: 'text', required: true },
          { name: 'category', type: 'text', required: false },
          { name: 'triggers', type: 'text', required: false },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_playbook_questions_type ON playbook_questions (type, display_order)',
        ],
      })
      app.save(questionsCol)
    }

    // 4. playbook_answers
    let answersCol
    try {
      answersCol = app.findCollectionByNameOrId('playbook_answers')
    } catch (_) {
      answersCol = new Collection({
        name: 'playbook_answers',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          {
            name: 'question',
            type: 'relation',
            required: false,
            collectionId: questionsCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'question_pattern', type: 'text', required: false },
          { name: 'answer_text', type: 'text', required: true },
          { name: 'resulting_action', type: 'text', required: false },
          { name: 'recommended_argument', type: 'text', required: false },
          { name: 'next_suggested_question', type: 'text', required: false },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_playbook_answers_order ON playbook_answers (display_order)'],
      })
      app.save(answersCol)
    }

    // 5. playbook_objections
    let objectionsCol
    try {
      objectionsCol = app.findCollectionByNameOrId('playbook_objections')
    } catch (_) {
      objectionsCol = new Collection({
        name: 'playbook_objections',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'clarification_question', type: 'text', required: false },
          { name: 'treatment_script', type: 'text', required: true },
          { name: 'sub_scenarios', type: 'json', required: false },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_playbook_objections_order ON playbook_objections (display_order)',
        ],
      })
      app.save(objectionsCol)
    }

    // 6. playbook_arguments
    let argsCol
    try {
      argsCol = app.findCollectionByNameOrId('playbook_arguments')
    } catch (_) {
      argsCol = new Collection({
        name: 'playbook_arguments',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          { name: 'situation', type: 'text', required: true },
          { name: 'argument_text', type: 'text', required: true },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_playbook_arguments_order ON playbook_arguments (display_order)',
        ],
      })
      app.save(argsCol)
    }

    // 7. playbook_values
    let valuesCol
    try {
      valuesCol = app.findCollectionByNameOrId('playbook_values')
    } catch (_) {
      valuesCol = new Collection({
        name: 'playbook_values',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'creation_value', type: 'number', required: true },
          { name: 'monthly_value', type: 'number', required: true },
          { name: 'inclusions', type: 'json', required: false },
          { name: 'script', type: 'text', required: true },
          { name: 'closing_questions', type: 'json', required: false },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(valuesCol)
    }

    // 8. playbook_next_steps
    let stepsCol
    try {
      stepsCol = app.findCollectionByNameOrId('playbook_next_steps')
    } catch (_) {
      stepsCol = new Collection({
        name: 'playbook_next_steps',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: adminRule,
        updateRule: adminRule,
        deleteRule: adminRule,
        fields: [
          { name: 'action', type: 'text', required: true },
          { name: 'description', type: 'text', required: true },
          { name: 'trigger_condition', type: 'text', required: false },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_playbook_next_steps_order ON playbook_next_steps (display_order)',
        ],
      })
      app.save(stepsCol)
    }

    // 9. approach_sessions (sessões de abordagem comercial)
    let sessionsCol
    try {
      sessionsCol = app.findCollectionByNameOrId('approach_sessions')
    } catch (_) {
      sessionsCol = new Collection({
        name: 'approach_sessions',
        type: 'base',
        // Leitura e escrita: dono da sessão ou admin
        listRule:
          "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        viewRule:
          "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        createRule: "@request.auth.id != ''",
        updateRule:
          "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        deleteRule:
          "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        fields: [
          {
            name: 'opportunity',
            type: 'relation',
            required: false,
            collectionId: oppsColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'seller',
            type: 'relation',
            required: true,
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'company_name', type: 'text', required: false },
          { name: 'contact_name', type: 'text', required: false },
          { name: 'contact_phone', type: 'text', required: false },
          { name: 'city', type: 'text', required: false },
          {
            name: 'channel',
            type: 'select',
            required: true,
            values: ['Telefone', 'Presencial', 'WhatsApp', 'Reunião', 'Retorno'],
            maxSelect: 1,
          },
          { name: 'segment', type: 'text', required: false },
          { name: 'digital_situation', type: 'text', required: false },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: [
              'Não abordado',
              'Tentativa de contato',
              'Contato realizado',
              'Diagnóstico realizado',
              'Interessado',
              'Exemplos enviados',
              'Reunião agendada',
              'Retorno agendado',
              'Proposta solicitada',
              'Proposta enviada',
              'Negociação',
              'Fechado',
              'Sem interesse',
              'Perdido',
            ],
            maxSelect: 1,
          },
          {
            name: 'temperature',
            type: 'select',
            required: false,
            values: ['frio', 'morno', 'quente'],
            maxSelect: 1,
          },
          { name: 'temperature_reason', type: 'text', required: false },
          { name: 'needs', type: 'text', required: false },
          { name: 'interests', type: 'text', required: false },
          { name: 'decision_maker', type: 'text', required: false },
          { name: 'deadline', type: 'text', required: false },
          { name: 'budget', type: 'text', required: false },
          { name: 'next_action', type: 'text', required: false },
          { name: 'next_contact_at', type: 'date', required: false },
          { name: 'questions_asked', type: 'json', required: false },
          { name: 'answers', type: 'json', required: false },
          { name: 'objections', type: 'json', required: false },
          { name: 'quick_tags', type: 'json', required: false },
          { name: 'notes', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_approach_sessions_seller ON approach_sessions (seller)',
          'CREATE INDEX idx_approach_sessions_opp ON approach_sessions (opportunity)',
          'CREATE INDEX idx_approach_sessions_created ON approach_sessions (created DESC)',
          'CREATE INDEX idx_approach_sessions_next ON approach_sessions (next_contact_at)',
        ],
      })
      app.save(sessionsCol)
    }

    // 10. SEED INICIAL: Segmentos
    const segmentsSeed = [
      'Estética Automotiva',
      'Lava-Rápido',
      'Salão de Beleza',
      'Barbearia',
      'Clínica',
      'Restaurante',
      'Loja',
      'Escritório',
      'Academia',
      'Imobiliária',
      'Prestador de Serviço',
      'Outro',
    ]
    let segOrder = 1
    for (const name of segmentsSeed) {
      try {
        app.findFirstRecordByData('playbook_segments', 'name', name)
      } catch (_) {
        const r = new Record(segmentsCol)
        r.set('name', name)
        r.set('is_active', true)
        r.set('display_order', segOrder++)
        app.save(r)
      }
    }

    // 11. SEED INICIAL: Scripts (Telefone, Presencial, WhatsApp, Reunião, Retorno e Pitch)
    const scriptsSeed = [
      {
        channel: 'Telefone',
        situation: 'Ligação de abertura / Prospecção fria',
        title: 'Script de Abertura Telefônica',
        script_text:
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], da Bit Consulting. Posso falar com o responsável pela empresa? Nós trabalhamos com criação de sites e landing pages para empresas que querem melhorar sua presença digital e facilitar novos contatos pelo WhatsApp. Temos projetos a partir de R$ 500,00, mais R$ 55,00 mensais com suporte, hospedagem e domínio. Posso te explicar em 30 segundos como funciona?',
        instructions:
          'Fale em tom tranquilo e profissional. Aguarde a resposta do interlocutor antes de prosseguir.',
        display_order: 1,
      },
      {
        channel: 'Telefone',
        situation: 'Pitch rápido após autorização',
        title: 'Pitch de 30 Segundos',
        script_text:
          'Funciona assim: Nós criamos um site ou landing page profissional para apresentar sua empresa, serviços, fotos, localização e formas de contato. O cliente consegue conhecer melhor o negócio e falar diretamente com vocês pelo WhatsApp. A criação começa em R$ 500,00 e depois existe um investimento de R$ 55,00 por mês, que inclui suporte, hospedagem do site e domínio. A ideia é deixar sua empresa com uma presença profissional na internet sem vocês precisarem se preocupar com a parte técnica.',
        instructions:
          'AGORA FAÇA UMA PERGUNTA. Não tente fechar a venda imediatamente; puxe para o diagnóstico.',
        display_order: 2,
      },
      {
        channel: 'Presencial',
        situation: 'Visita presencial / Abordagem balcão',
        title: 'Abordagem Presencial Inicial',
        script_text:
          'Olá, tudo bem? Meu nome é [NOME DO VENDEDOR], sou consultor da Bit Consulting aqui da região. Estava passando por aqui, conheci o espaço de vocês e gostaria de saber se o responsável pela empresa está disponível por dois minutinhos. Nós desenvolvemos páginas e sites profissionais para empresas locais organizarem seus serviços e receberem clientes prontos pelo WhatsApp.',
        instructions:
          'Apresente-se com postura cordial, sorrindo e sem invadir o espaço de atendimento ao cliente.',
        display_order: 3,
      },
      {
        channel: 'WhatsApp',
        situation: 'Primeiro contato por mensagem / Lead inbound ou prospecção',
        title: 'Primeira Mensagem WhatsApp',
        script_text:
          'Olá, tudo bem? Aqui é o [NOME DO VENDEDOR], da Bit Consulting.\n\nVi o trabalho de vocês e achei excelente. Nós ajudamos empresas do segmento de [SEGMENTO] a terem um site ou landing page profissional completo a partir de R$ 500,00, já com hospedagem, domínio e suporte inclusos por R$ 55,00/mês.\n\nA ideia é facilitar para quem procura seus serviços no Google ou Instagram conseguir ver fotos, endereço e chamar no WhatsApp em um clique.\n\nHoje vocês já possuem um site oficial ou utilizam mais as redes sociais?',
        instructions:
          'Personalize com o nome da empresa e o segmento antes de enviar. Mantenha os parágrafos curtos.',
        display_order: 4,
      },
      {
        channel: 'Reunião',
        situation: 'Apresentação comercial / Demonstração agendada',
        title: 'Roteiro de Reunião Comercial',
        script_text:
          'Olá, [NOME DO CONTATO]! Agradeço pelo tempo reservado. Conforme alinhamos, o objetivo deste encontro rápido é entender como vocês atendem e recebem novos clientes hoje e mostrar como uma página moderna e objetiva pode elevar a percepção de valor da [NOME DA EMPRESA] e dobrar as chances de conversão pelo WhatsApp. Antes de mostrar exemplos práticos, posso te fazer três perguntas rápidas sobre o seu modelo de atendimento?',
        instructions:
          'Valide o tempo disponível do cliente e mantenha o foco nos gargalos que o site resolve.',
        display_order: 5,
      },
      {
        channel: 'Retorno',
        situation: 'Follow-up agendado',
        title: 'Script de Retorno Agendado',
        script_text:
          'Olá, [NOME DO CONTATO], tudo bem? Aqui é o [NOME DO VENDEDOR], da Bit Consulting. Conforme combinamos na nossa última conversa, estou retornando para darmos sequência. Você conseguiu dar uma olhada nos exemplos que te enviei ou conversar com o seu sócio?',
        instructions: 'Seja direto e faça referência imediata ao combinado anterior.',
        display_order: 6,
      },
    ]

    for (const sc of scriptsSeed) {
      try {
        app.findFirstRecordByData('playbook_scripts', 'title', sc.title)
      } catch (_) {
        const r = new Record(scriptsCol)
        r.set('channel', sc.channel)
        r.set('situation', sc.situation)
        r.set('title', sc.title)
        r.set('script_text', sc.script_text)
        r.set('instructions', sc.instructions)
        r.set('display_order', sc.display_order)
        r.set('is_active', true)
        app.save(r)
      }
    }

    // 12. SEED INICIAL: Perguntas (Diagnóstico e Qualificação)
    const questionsSeed = [
      // Diagnóstico (3 a 6 seleções contextuais)
      {
        type: 'diagnóstico',
        text: 'Hoje vocês possuem algum site?',
        category: 'Presença Atual',
        triggers: 'abertura,situação digital',
        display_order: 1,
      },
      {
        type: 'diagnóstico',
        text: 'Hoje vocês utilizam mais Instagram, WhatsApp ou outro canal para apresentar a empresa?',
        category: 'Canais',
        triggers: 'canais,redes',
        display_order: 2,
      },
      {
        type: 'diagnóstico',
        text: 'Como os clientes normalmente encontram vocês?',
        category: 'Origem',
        triggers: 'origem,aquisição',
        display_order: 3,
      },
      {
        type: 'diagnóstico',
        text: 'Vocês recebem muitos pedidos pelo WhatsApp?',
        category: 'Atendimento',
        triggers: 'whatsapp,pedidos',
        display_order: 4,
      },
      {
        type: 'diagnóstico',
        text: 'Quais serviços vocês mais gostariam de divulgar?',
        category: 'Serviços',
        triggers: 'serviços,destaque',
        display_order: 5,
      },
      {
        type: 'diagnóstico',
        text: 'Quando um cliente recebe uma indicação da empresa, onde ele consegue conhecer melhor o trabalho de vocês?',
        category: 'Autoridade',
        triggers: 'indicação,autoridade',
        display_order: 6,
      },
      {
        type: 'diagnóstico',
        text: 'Se alguém pesquisar sua empresa agora, encontra facilmente serviços, endereço e WhatsApp?',
        category: 'Google / Presença',
        triggers: 'google,busca',
        display_order: 7,
      },
      {
        type: 'diagnóstico',
        text: 'Quais são os principais serviços?',
        category: 'Portfólio',
        triggers: 'serviços,carro-chefe',
        display_order: 8,
      },
      {
        type: 'diagnóstico',
        text: 'Qual serviço vocês mais querem vender?',
        category: 'Estratégia',
        triggers: 'faturamento,margem',
        display_order: 9,
      },
      {
        type: 'diagnóstico',
        text: 'Como os clientes chegam hoje?',
        category: 'Origem',
        triggers: 'origem,indicação',
        display_order: 10,
      },
      {
        type: 'diagnóstico',
        text: 'Utilizam Instagram?',
        category: 'Redes Sociais',
        triggers: 'instagram',
        display_order: 11,
      },
      {
        type: 'diagnóstico',
        text: 'Possuem Google Meu Negócio?',
        category: 'Google',
        triggers: 'google,mapa',
        display_order: 12,
      },
      {
        type: 'diagnóstico',
        text: 'Recebem contatos pelo Google?',
        category: 'Google',
        triggers: 'google,contato',
        display_order: 13,
      },
      {
        type: 'diagnóstico',
        text: 'Os clientes pedem orçamento pelo WhatsApp?',
        category: 'Atendimento',
        triggers: 'orçamento,whatsapp',
        display_order: 14,
      },
      {
        type: 'diagnóstico',
        text: 'Possuem fotos dos serviços?',
        category: 'Conteúdo',
        triggers: 'fotos,material',
        display_order: 15,
      },
      {
        type: 'diagnóstico',
        text: 'Possuem fotos do estabelecimento?',
        category: 'Conteúdo',
        triggers: 'fotos,espaço',
        display_order: 16,
      },
      {
        type: 'diagnóstico',
        text: 'Possuem logotipo?',
        category: 'Conteúdo',
        triggers: 'marca,logo',
        display_order: 17,
      },
      {
        type: 'diagnóstico',
        text: 'Possuem domínio?',
        category: 'Técnico',
        triggers: 'domínio,registro',
        display_order: 18,
      },
      {
        type: 'diagnóstico',
        text: 'Gostariam de receber orçamento diretamente pelo WhatsApp?',
        category: 'Conversão',
        triggers: 'orçamento,conversão',
        display_order: 19,
      },
      {
        type: 'diagnóstico',
        text: 'Existe algum serviço ou promoção que querem destacar?',
        category: 'Oferta',
        triggers: 'promoção,campanha',
        display_order: 20,
      },

      // Qualificação (decisor, interesse, prazo, orçamento)
      {
        type: 'qualificação',
        text: 'Existe interesse em melhorar a presença digital?',
        category: 'Interesse',
        triggers: 'interesse,abertura',
        display_order: 21,
      },
      {
        type: 'qualificação',
        text: 'Quem normalmente toma essa decisão?',
        category: 'Decisor',
        triggers: 'decisor,sócio',
        display_order: 22,
      },
      {
        type: 'qualificação',
        text: 'Além de você, alguém precisa avaliar?',
        category: 'Decisor',
        triggers: 'decisor,parceiro',
        display_order: 23,
      },
      {
        type: 'qualificação',
        text: 'Se fizer sentido, vocês pretendem fazer isso agora ou mais para frente?',
        category: 'Prazo',
        triggers: 'prazo,momento',
        display_order: 24,
      },
      {
        type: 'qualificação',
        text: 'Quando gostariam de colocar o projeto no ar?',
        category: 'Prazo',
        triggers: 'prazo,lançamento',
        display_order: 25,
      },

      // Perguntas de fluxo sugeridas pelo motor
      {
        type: 'fluxo',
        text: 'O Instagram hoje atende tudo o que vocês precisam ou os clientes ainda perguntam bastante sobre serviços, localização ou orçamento?',
        category: 'Fluxo Instagram',
        triggers: 'instagram,fluxo',
        display_order: 26,
      },
      {
        type: 'fluxo',
        text: 'Quais serviços vocês mais gostariam de destacar?',
        category: 'Fluxo Serviços',
        triggers: 'serviços,destaque',
        display_order: 27,
      },
    ]

    for (const q of questionsSeed) {
      try {
        app.findFirstRecordByData('playbook_questions', 'text', q.text)
      } catch (_) {
        const r = new Record(questionsCol)
        r.set('type', q.type)
        r.set('text', q.text)
        r.set('category', q.category)
        r.set('triggers', q.triggers)
        r.set('display_order', q.display_order)
        r.set('is_active', true)
        app.save(r)
      }
    }

    // 13. SEED INICIAL: Respostas Rápidas e Ações Resultantes
    const answersSeed = [
      {
        pattern: 'Hoje vocês possuem algum site?',
        answer_text: 'Não possuo site',
        resulting_action: 'Apresentar benefício de ter presença oficial própria',
        recommended_argument:
          'Hoje mais de 70% dos clientes buscam confirmação no Google antes de fechar negócio. Com a página própria, sua empresa passa muito mais autoridade.',
        next_suggested_question:
          'Hoje vocês utilizam mais Instagram, WhatsApp ou outro canal para apresentar a empresa?',
        display_order: 1,
      },
      {
        pattern: 'Hoje vocês possuem algum site?',
        answer_text: 'Já tenho site antigo/insatisfatório',
        resulting_action: 'Focar na modernização e otimização para mobile/WhatsApp',
        recommended_argument:
          'Sites antigos costumam ser lentos e difíceis de ler no celular. O nosso modelo é focado 100% em carregar em 2 segundos e levar o cliente direto pro WhatsApp.',
        next_suggested_question: 'O site atual de vocês gera contatos pelo WhatsApp?',
        display_order: 2,
      },
      {
        pattern: 'Hoje vocês utilizam mais Instagram',
        answer_text: 'Utilizo somente Instagram',
        resulting_action: 'Disparar pergunta de aprofundamento sobre gargalos do Instagram',
        recommended_argument:
          'O Instagram é excelente para atração, mas muitos clientes se perdem no direct sem achar valores, endereço ou tabela de serviços.',
        next_suggested_question:
          'O Instagram hoje atende tudo o que vocês precisam ou os clientes ainda perguntam bastante sobre serviços, localização ou orçamento?',
        display_order: 3,
      },
      {
        pattern: 'O Instagram hoje atende tudo',
        answer_text: 'Clientes perguntam muito sobre serviços e orçamento',
        resulting_action: 'Apresentar o argumento central de complementação do site ao Instagram',
        recommended_argument:
          'É justamente aí que o site pode ajudar. O Instagram continua sendo usado para divulgação, enquanto o site organiza serviços, localização, contatos e direciona o cliente para o WhatsApp.',
        next_suggested_question: 'Quais serviços vocês mais gostariam de destacar?',
        display_order: 4,
      },
      {
        pattern: 'Como os clientes normalmente encontram vocês?',
        answer_text: 'Google',
        resulting_action: 'Fortalecer presença no Google com página profissional',
        recommended_argument:
          'Quem busca no Google já está pronto para comprar. Um site bem estruturado aumenta drasticamente o fechamento dessas buscas.',
        next_suggested_question: 'Possuem Google Meu Negócio ativo e com fotos?',
        display_order: 5,
      },
      {
        pattern: 'Como os clientes normalmente encontram vocês?',
        answer_text: 'Indicação',
        resulting_action: 'Explicar validação da indicação através do site',
        recommended_argument:
          'Mesmo quando é indicação, hoje as pessoas pesquisam a empresa para ver fotos e credibilidade antes de mandar mensagem.',
        next_suggested_question:
          'Quando um cliente recebe uma indicação da empresa, onde ele consegue conhecer melhor o trabalho de vocês?',
        display_order: 6,
      },
      {
        pattern: 'Como os clientes normalmente encontram vocês?',
        answer_text: 'WhatsApp direto',
        resulting_action: 'Otimizar o fluxo para economizar tempo no WhatsApp',
        recommended_argument:
          'Com a página organizada, o cliente já chega no seu WhatsApp sabendo o que quer, economizando tempo precioso da sua equipe.',
        next_suggested_question: 'Vocês recebem muitos pedidos pelo WhatsApp?',
        display_order: 7,
      },
    ]

    for (const a of answersSeed) {
      try {
        app.findFirstRecordByData('playbook_answers', 'answer_text', a.answer_text)
      } catch (_) {
        const r = new Record(answersCol)
        r.set('question_pattern', a.pattern)
        r.set('answer_text', a.answer_text)
        r.set('resulting_action', a.resulting_action)
        r.set('recommended_argument', a.recommended_argument)
        r.set('next_suggested_question', a.next_suggested_question)
        r.set('display_order', a.display_order)
        app.save(r)
      }
    }

    // 14. SEED INICIAL: Objeções e Tratamentos Verbatim
    const objectionsSeed = [
      {
        name: 'Está caro',
        clarification_question:
          'Quando você fala que ficou caro, é mais pelo investimento inicial ou pelos R$ 55,00 mensais?',
        treatment_script:
          'Compreendo perfeitamente sua preocupação com investimento. Vamos entender o que pesa mais para você:',
        sub_scenarios: [
          {
            scenario: 'Se o cliente disser que é pelo inicial (R$ 500,00):',
            script:
              'O projeto começa em R$ 500,00 justamente para permitir que pequenas empresas tenham uma presença profissional sem um investimento inicial muito alto.',
          },
          {
            scenario: 'Se o cliente disser que é pelo mensal (R$ 55,00):',
            script:
              'Os R$ 55,00 já incluem domínio, hospedagem e suporte, evitando que você precise contratar e administrar esses serviços separadamente.',
          },
        ],
        display_order: 1,
      },
      {
        name: 'Já tenho Instagram',
        clarification_question: 'O Instagram hoje consegue atender tudo que vocês precisam?',
        treatment_script:
          'O site não substitui o Instagram. Ele complementa. O Instagram funciona muito bem para divulgação e relacionamento. O site organiza a presença oficial da empresa e concentra serviços, contatos, localização e acesso ao WhatsApp.',
        sub_scenarios: [
          {
            scenario: 'Ponto chave:',
            script:
              'No Instagram o cliente se distrai facilmente com concorrentes; no site oficial ele só vê a sua marca e os botões diretos de ação.',
          },
        ],
        display_order: 2,
      },
      {
        name: 'Já tenho site',
        clarification_question:
          'Legal! E o site atual de vocês hoje está atualizado, rápido no celular e gerando contatos frequentes pelo WhatsApp?',
        treatment_script:
          'Excelente que já tenham essa cultura digital! A maioria dos sites foi feita há anos e hoje não é responsiva ou não tem botão direto de WhatsApp. Se vocês já estiverem 100% satisfeitos, perfeito; se quiserem dar uma modernizada rápida sem dor de cabeça, nós cuidamos de toda a transição.',
        sub_scenarios: [],
        display_order: 3,
      },
      {
        name: 'Não preciso',
        clarification_question:
          'Entendi. Hoje o fluxo de novos clientes de vocês já está na capacidade máxima da empresa?',
        treatment_script:
          'Compreendo. Muitos clientes nossos também achavam que não precisavam até verem concorrentes aparecendo na frente no Google. Um site bem posicionado não serve apenas para quem está sem clientes, mas para valorizar sua marca e permitir cobrar mais caro pelo seu serviço.',
        sub_scenarios: [],
        display_order: 4,
      },
      {
        name: 'Vou pensar',
        clarification_question:
          'Claro. Existe algum ponto específico que você gostaria de avaliar melhor?',
        treatment_script:
          'Perfeito, avaliar com calma faz todo sentido. Existe algum ponto específico que você gostaria de avaliar melhor? (Preço, necessidade, falar com sócio, comparar propostas, ver exemplos ou momento?)\n\n[REGRA DE OURO: NUNCA finalize com "Tudo bem, qualquer coisa me chama." Agende um próximo contato específico.]',
        sub_scenarios: [
          {
            scenario: 'Opções para esclarecer:',
            script:
              'Preço | Necessidade | Falar com sócio | Comparar propostas | Ver exemplos | Momento | Outro',
          },
        ],
        display_order: 5,
      },
      {
        name: 'Preciso falar com meu sócio',
        clarification_question:
          'Perfeito. Posso te enviar um resumo e alguns exemplos para facilitar essa conversa?',
        treatment_script:
          'Perfeito. Posso te enviar um resumo e alguns exemplos para facilitar essa conversa?\n\nQuando seria um bom momento para eu entrar em contato novamente com vocês para tirarmos eventuais dúvidas juntos?',
        sub_scenarios: [
          {
            scenario: 'Ação automática recomendada:',
            script:
              'Enviar portfólio no WhatsApp e criar follow-up (return_at) para 2 a 3 dias úteis.',
          },
        ],
        display_order: 6,
      },
      {
        name: 'Não tenho tempo',
        clarification_question:
          'Entendo totalmente a correria do dia a dia. É justamente por isso que cuidamos de tudo!',
        treatment_script:
          'É exatamente por isso que desenvolvemos esse modelo: nós cuidamos de toda a parte técnica, fotos, textos e configuração. Você só precisa de 10 minutos para nos mandar o básico e nós entregamos tudo pronto para você aprovar.',
        sub_scenarios: [],
        display_order: 7,
      },
      {
        name: 'Já tenho fornecedor',
        clarification_question:
          'Entendido. E vocês contam com suporte rápido quando precisam atualizar fotos ou preços?',
        treatment_script:
          'Muito bom já terem alguém cuidando. A nossa grande diferença é que incluímos o suporte contínuo nos R$ 55,00 mensais sem custos adicionais por hora de manutenção. Guarde nosso contato para qualquer necessidade futura!',
        sub_scenarios: [],
        display_order: 8,
      },
      {
        name: 'Não tenho interesse',
        clarification_question:
          'Tudo bem! Posso te fazer uma última pergunta rápida apenas para nosso controle interno?',
        treatment_script:
          'Sem problemas, agradeço muito sua sinceridade e atenção. Posso te fazer apenas uma última pergunta para nosso aprendizado: hoje vocês já têm outra prioridade de investimento comercial na empresa?',
        sub_scenarios: [],
        display_order: 9,
      },
      {
        name: 'Me manda no WhatsApp',
        clarification_question:
          'Mando com certeza! Qual o melhor número e nome para eu colocar na mensagem?',
        treatment_script:
          'Com certeza! Vou te enviar agora mesmo um portfólio com exemplos parecidos com o seu segmento. Para eu te mandar o material mais certeiro: vocês gostariam de destacar algum serviço específico hoje?',
        sub_scenarios: [],
        display_order: 10,
      },
      {
        name: 'Outro',
        clarification_question:
          'Qual é a principal dúvida ou impedimento que você enxerga nesse momento?',
        treatment_script:
          'Entendo seu ponto. Nosso papel na Bit Consulting é ser parceiro de crescimento do seu negócio. Vamos alinhar como podemos adaptar ao seu momento.',
        sub_scenarios: [],
        display_order: 11,
      },
    ]

    for (const ob of objectionsSeed) {
      try {
        app.findFirstRecordByData('playbook_objections', 'name', ob.name)
      } catch (_) {
        const r = new Record(objectionsCol)
        r.set('name', ob.name)
        r.set('clarification_question', ob.clarification_question)
        r.set('treatment_script', ob.treatment_script)
        r.set('sub_scenarios', ob.sub_scenarios)
        r.set('display_order', ob.display_order)
        r.set('is_active', true)
        app.save(r)
      }
    }

    // 15. SEED INICIAL: Argumentos Verbatim
    const argsSeed = [
      {
        situation: 'Cliente usa apenas Instagram e os clientes perguntam muito',
        argument_text:
          'É justamente aí que o site pode ajudar. O Instagram continua sendo usado para divulgação, enquanto o site organiza serviços, localização, contatos e direciona o cliente para o WhatsApp.',
        display_order: 1,
      },
      {
        situation: 'Cliente quer passar mais credibilidade no Google',
        argument_text:
          'Mais de 80% das pessoas pesquisam no Google antes de ir a um local ou pedir orçamento. Ter o site oficial garante que sua empresa seja a primeira a passar confiança.',
        display_order: 2,
      },
      {
        situation:
          'Cliente reclama que gasta muito tempo respondendo perguntas básicas no WhatsApp',
        argument_text:
          'O site atua como um atendente 24 horas: o cliente já chega sabendo onde você fica, o que faz e com fotos do trabalho. A conversa no WhatsApp vai direto para o fechamento.',
        display_order: 3,
      },
      {
        situation: 'Cliente tem medo de ter dor de cabeça com parte técnica',
        argument_text:
          'Você não precisa entender nada de domínio, servidor ou programação. A Bit Consulting entrega tudo pronto, no ar e com suporte contínuo para atualizações.',
        display_order: 4,
      },
      {
        situation: 'Cliente acha que site é caro para pequenas empresas',
        argument_text:
          'Antigamente um site custava 3 a 5 mil reais. Nosso modelo foi desenhado exatamente para o pequeno e médio empresário: criação a partir de R$ 500,00 e R$ 55,00/mês para manter tudo seguro e atualizado.',
        display_order: 5,
      },
    ]

    for (const ar of argsSeed) {
      try {
        app.findFirstRecordByData('playbook_arguments', 'situation', ar.situation)
      } catch (_) {
        const r = new Record(argsCol)
        r.set('situation', ar.situation)
        r.set('argument_text', ar.argument_text)
        r.set('display_order', ar.display_order)
        r.set('is_active', true)
        app.save(r)
      }
    }

    // 16. SEED INICIAL: Valores Verbatim
    try {
      app.findFirstRecordByData('playbook_values', 'is_active', true)
    } catch (_) {
      const r = new Record(valuesCol)
      r.set('title', 'Estrutura Comercial Padrão - Bit Consulting')
      r.set('creation_value', 500)
      r.set('monthly_value', 55)
      r.set('inclusions', [
        'Criação do site ou landing page profissional sob medida',
        'Domínio próprio incluso e configurado',
        'Hospedagem de alta performance inclusa',
        'Suporte técnico e apoio a atualizações contínuas',
        'Acompanhamento técnico dedicado',
        'Otimização e botões diretos de chamada no WhatsApp',
        'Design 100% responsivo para celulares e computadores',
      ])
      r.set(
        'script',
        'O investimento funciona em dois passos muito simples: A criação do site ou landing page sob medida começa em R$ 500,00. Depois, há uma mensalidade de R$ 55,00 que já cobre toda a hospedagem em servidor seguro, o domínio próprio, suporte técnico e apoio com atualizações. Assim vocês não têm nenhuma preocupação com parte técnica.',
      )
      r.set('closing_questions', [
        'Esse modelo faria sentido para sua empresa?',
        'O que você achou dessa estrutura?',
        'Esse investimento está dentro do que você imaginava?',
      ])
      r.set('is_active', true)
      app.save(r)
    }

    // 17. SEED INICIAL: Próximos Passos
    const nextStepsSeed = [
      {
        action: 'Fazer mais uma pergunta',
        description: 'Aprofundar diagnóstico para entender o volume ou gargalo de atendimento.',
        trigger_condition: 'cliente participativo, informações ainda incompletas',
        display_order: 1,
      },
      {
        action: 'Mostrar exemplo',
        description: 'Exibir página de referência do mesmo segmento do cliente.',
        trigger_condition: 'cliente quer ver visualmente ou tem dúvida sobre qualidade',
        display_order: 2,
      },
      {
        action: 'Enviar portfólio',
        description: 'Compartilhar link de modelos via WhatsApp durante ou após a conversa.',
        trigger_condition: 'cliente pediu no WhatsApp ou precisa avaliar',
        display_order: 3,
      },
      {
        action: 'Enviar WhatsApp',
        description: 'Disparar mensagem formal com resumo da proposta e links.',
        trigger_condition: 'ligação encerrada com abertura para follow-up',
        display_order: 4,
      },
      {
        action: 'Identificar decisor',
        description: 'Perguntar quem avalia o projeto além do interlocutor atual.',
        trigger_condition: 'interlocutor não é o dono ou citou sócio/gerente',
        display_order: 5,
      },
      {
        action: 'Marcar reunião',
        description: 'Agendar call de 15 minutos pelo Google Meet ou visita presencial.',
        trigger_condition: 'cliente interessado que deseja apresentação formal',
        display_order: 6,
      },
      {
        action: 'Agendar retorno',
        description: 'Definir dia e horário exatos no CRM para retorno obrigatório.',
        trigger_condition: 'cliente pediu para pensar ou falar com sócio',
        display_order: 7,
      },
      {
        action: 'Criar oportunidade',
        description: 'Registrar lead no pipeline em estágio Novo ou Qualificado.',
        trigger_condition: 'abordagem sem oportunidade vinculada que demonstrou potencial',
        display_order: 8,
      },
      {
        action: 'Criar proposta',
        description: 'Mover ou criar oportunidade no estágio Proposta com valores alinhados.',
        trigger_condition: 'cliente solicitou formalização comercial',
        display_order: 9,
      },
      {
        action: 'Encerrar oportunidade',
        description: 'Registrar motivo de perda sem desgastar o relacionamento.',
        trigger_condition: 'cliente sem interesse explícito ou perfil inadequado',
        display_order: 10,
      },
    ]

    for (const ns of nextStepsSeed) {
      try {
        app.findFirstRecordByData('playbook_next_steps', 'action', ns.action)
      } catch (_) {
        const r = new Record(stepsCol)
        r.set('action', ns.action)
        r.set('description', ns.description)
        r.set('trigger_condition', ns.trigger_condition)
        r.set('display_order', ns.display_order)
        r.set('is_active', true)
        app.save(r)
      }
    }
  },
  (app) => {
    // Reverter coleções criadas
    const toDelete = [
      'approach_sessions',
      'playbook_next_steps',
      'playbook_values',
      'playbook_arguments',
      'playbook_objections',
      'playbook_answers',
      'playbook_questions',
      'playbook_scripts',
      'playbook_segments',
    ]
    for (const name of toDelete) {
      try {
        const c = app.findCollectionByNameOrId(name)
        app.delete(c)
      } catch (_) {}
    }
  },
)
