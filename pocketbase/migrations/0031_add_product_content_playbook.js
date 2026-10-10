migrate(
  (app) => {
    const productsCol = app.findCollectionByNameOrId('products')

    // Obter IDs dos produtos para vincular com segurança
    let waProduct
    try {
      waProduct = app.findFirstRecordByData('products', 'name', 'WhatsApp Autônomo e Humanizado')
    } catch (_) {}

    // 1. Adicionar campos 'product' (relation) e 'product_name' (text) em playbook_questions
    const questionsCol = app.findCollectionByNameOrId('playbook_questions')
    let questionsChanged = false
    if (!questionsCol.fields.getByName('product')) {
      questionsCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      questionsChanged = true
    }
    if (!questionsCol.fields.getByName('product_name')) {
      questionsCol.fields.add(
        new TextField({
          name: 'product_name',
          required: false,
        }),
      )
      questionsChanged = true
    }
    if (questionsChanged) {
      app.save(questionsCol)
    }

    // 2. Adicionar campos 'product' e 'product_name' em playbook_objections
    const objectionsCol = app.findCollectionByNameOrId('playbook_objections')
    let objectionsChanged = false
    if (!objectionsCol.fields.getByName('product')) {
      objectionsCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      objectionsChanged = true
    }
    if (!objectionsCol.fields.getByName('product_name')) {
      objectionsCol.fields.add(
        new TextField({
          name: 'product_name',
          required: false,
        }),
      )
      objectionsChanged = true
    }
    if (objectionsChanged) {
      app.save(objectionsCol)
    }

    // 3. Adicionar campos 'product' e 'product_name' em playbook_arguments
    const argumentsCol = app.findCollectionByNameOrId('playbook_arguments')
    let argsChanged = false
    if (!argumentsCol.fields.getByName('product')) {
      argumentsCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      argsChanged = true
    }
    if (!argumentsCol.fields.getByName('product_name')) {
      argumentsCol.fields.add(
        new TextField({
          name: 'product_name',
          required: false,
        }),
      )
      argsChanged = true
    }
    if (argsChanged) {
      app.save(argumentsCol)
    }

    // 4. Adicionar campos 'product' e 'product_name' em playbook_next_steps
    const nextStepsCol = app.findCollectionByNameOrId('playbook_next_steps')
    let stepsChanged = false
    if (!nextStepsCol.fields.getByName('product')) {
      nextStepsCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      stepsChanged = true
    }
    if (!nextStepsCol.fields.getByName('product_name')) {
      nextStepsCol.fields.add(
        new TextField({
          name: 'product_name',
          required: false,
        }),
      )
      stepsChanged = true
    }
    if (stepsChanged) {
      app.save(nextStepsCol)
    }

    // 5. Adicionar campos 'product' e 'product_name' em playbook_values se não existirem
    const valuesCol = app.findCollectionByNameOrId('playbook_values')
    let valuesChanged = false
    if (!valuesCol.fields.getByName('product')) {
      valuesCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      valuesChanged = true
    }
    if (!valuesCol.fields.getByName('product_name')) {
      valuesCol.fields.add(
        new TextField({
          name: 'product_name',
          required: false,
        }),
      )
      valuesChanged = true
    }
    if (valuesChanged) {
      app.save(valuesCol)
    }

    // Vincular o registro de playbook_values existente do WhatsApp Autônomo ao produto
    if (waProduct) {
      try {
        const waValRecord = app.findFirstRecordByData(
          'playbook_values',
          'title',
          'WhatsApp Autônomo e Humanizado - Atendente IA',
        )
        if (!waValRecord.getString('product')) {
          waValRecord.set('product', waProduct.id)
          waValRecord.set('product_name', waProduct.getString('name'))
          app.save(waValRecord)
        }
      } catch (_) {}
    }

    // 6. Cadastrar o novo Próximo Passo: "Agendar demonstração do atendente"
    try {
      app.findFirstRecordByData(
        'playbook_next_steps',
        'action',
        'Agendar demonstração do atendente',
      )
    } catch (_) {
      const stepRec = new Record(nextStepsCol)
      stepRec.set('action', 'Agendar demonstração do atendente')
      stepRec.set(
        'description',
        'Acionar demonstração prática e em tempo real do atendente autônomo diretamente no WhatsApp do lead.',
      )
      stepRec.set(
        'trigger_condition',
        'cliente interessado em ver na prática como o atendente responde com naturalidade',
      )
      stepRec.set('display_order', 11)
      stepRec.set('is_active', true)
      if (waProduct) {
        stepRec.set('product', waProduct.id)
        stepRec.set('product_name', waProduct.getString('name'))
      }
      app.save(stepRec)
    }

    // 7. Cadastrar Perguntas do produto "WhatsApp Autônomo e Humanizado" e suas Respostas
    const answersCol = app.findCollectionByNameOrId('playbook_answers')

    const newQuestions = [
      // Perguntas de Diagnóstico
      {
        text: 'Quem responde o WhatsApp da empresa hoje e quantas pessoas cuidam do atendimento?',
        type: 'diagnóstico',
        category: 'Equipe de Atendimento',
        triggers: 'equipe,atendimento,whatsapp,pessoas',
        display_order: 30,
        answers: [
          {
            answer_text: 'O próprio dono / sócio responde',
            resulting_action: 'Destacar economia de tempo e foco na gestão comercial',
            recommended_argument:
              'O tempo do dono é o mais valioso da empresa. Com o WhatsApp Autônomo, você para de responder dúvidas repetidas e foca 100% no fechamento e na gestão.',
            next_suggested_question:
              'Vocês recebem mensagens fora do horário comercial e o que acontece com elas hoje?',
          },
          {
            answer_text: 'Temos 1 ou mais atendentes dedicados',
            resulting_action: 'Apresentar triagem automática e redução de sobrecarga',
            recommended_argument:
              'O atendente autônomo funciona como uma primeira linha de qualificação: filtra os curiosos, tira dúvidas básicas e entrega o lead pronto para o seu atendente fechar a venda.',
            next_suggested_question:
              'Os clientes costumam reclamar de demora para responder nos horários de pico?',
          },
        ],
      },
      {
        text: 'Vocês recebem mensagens fora do horário comercial e o que acontece com elas hoje?',
        type: 'diagnóstico',
        category: 'Horário de Atendimento',
        triggers: 'fora do horário,noite,fim de semana,perda de clientes',
        display_order: 31,
        answers: [
          {
            answer_text: 'Ficam esperando até o dia seguinte / expediente',
            resulting_action: 'Destacar perda de vendas e imediatismo do consumidor',
            recommended_argument:
              'Mais de 60% dos clientes que mandam mensagem à noite ou no final de semana fecham com o primeiro que responder. O atendente 24h garante resposta imediata e retém o cliente.',
            next_suggested_question: 'Os clientes costumam reclamar de demora para responder?',
          },
          {
            answer_text: 'Tentamos responder mesmo fora do expediente',
            resulting_action: 'Destacar desgaste pessoal e qualidade de vida',
            recommended_argument:
              'Ninguém merece ficar escravo do WhatsApp corporativo até tarde da noite. Nosso atendente autônomo assume esse turno com respostas naturais e qualificadas.',
            next_suggested_question:
              'Qual é o volume aproximado de mensagens que vocês recebem por dia?',
          },
        ],
      },
      {
        text: 'Os clientes costumam reclamar de demora para responder nos horários de pico ou fins de semana?',
        type: 'diagnóstico',
        category: 'Gargalo de Espera',
        triggers: 'demora,espera,reclamação,tempo de resposta',
        display_order: 32,
        answers: [
          {
            answer_text: 'Sim, reclamam ou desistem antes de sermos atendidos',
            resulting_action: 'Apresentar velocidade imediata de resposta',
            recommended_argument:
              'A velocidade de atendimento é o fator número 1 de conversão no WhatsApp. Nosso atendente responde em menos de 10 segundos com precisão humana.',
            next_suggested_question:
              'Qual é o volume aproximado de mensagens que vocês recebem por dia?',
          },
          {
            answer_text: 'Não costumam reclamar, mas sei que demoramos um pouco',
            resulting_action: 'Evidenciar o cliente silencioso que vai para o concorrente',
            recommended_argument:
              'A maioria dos clientes não reclama: simplesmente abre o WhatsApp do concorrente e compra lá. Ter atendimento instantâneo estanca esse vazamento.',
            next_suggested_question:
              'Vocês já usam alguma resposta automática ou chatbot no WhatsApp hoje?',
          },
        ],
      },
      {
        text: 'Qual é o volume aproximado de mensagens que vocês recebem por dia no WhatsApp?',
        type: 'diagnóstico',
        category: 'Volume de Mensagens',
        triggers: 'volume,mensagens por dia,fluxo,demanda',
        display_order: 33,
        answers: [
          {
            answer_text: 'Volume alto (mais de 30 a 50 mensagens/dia)',
            resulting_action: 'Destacar automação em escala e organização',
            recommended_argument:
              'Com esse volume, uma triagem autônoma economiza de 2 a 4 horas diárias da equipe, organizando quem é cliente quente e quem é apenas curiosidade.',
            next_suggested_question:
              'Vocês já usam alguma resposta automática ou chatbot no WhatsApp hoje?',
          },
          {
            answer_text: 'Volume moderado (até 20 mensagens/dia)',
            resulting_action: 'Destacar que cada lead é precioso e não pode ser perdido',
            recommended_argument:
              'Quando o fluxo é moderado, cada lead tem valor ainda maior: perder 2 ou 3 contatos por semana por demora paga com folga o investimento.',
            next_suggested_question:
              'Qual é o horário oficial de funcionamento da empresa para atendimento?',
          },
        ],
      },
      {
        text: 'Qual é o horário oficial de funcionamento da empresa para atendimento?',
        type: 'diagnóstico',
        category: 'Disponibilidade',
        triggers: 'horário de funcionamento,expediente,turnos',
        display_order: 34,
        answers: [
          {
            answer_text: 'Horário comercial tradicional (ex: 8h às 18h)',
            resulting_action: 'Mostrar que 50% das buscas acontecem após as 18h',
            recommended_argument:
              'As pessoas pesquisam e tomam decisões de compra em casa à noite. Com o WhatsApp Autônomo, sua empresa atende normalmente das 18h às 8h da manhã.',
            next_suggested_question:
              'Vocês já usam alguma resposta automática ou chatbot no WhatsApp hoje?',
          },
        ],
      },
      {
        text: 'Vocês já usam alguma resposta automática ou chatbot no WhatsApp hoje?',
        type: 'diagnóstico',
        category: 'Tecnologia Atual',
        triggers: 'chatbot,resposta automática,robô,menu numérico',
        display_order: 35,
        answers: [
          {
            answer_text: 'Usamos apenas mensagem de ausência do WhatsApp Business',
            resulting_action: 'Explicar a diferença para um atendente que conversa de verdade',
            recommended_argument:
              'Mensagem de ausência avisa que ninguém vai responder e manda o cliente esperar. Nosso atendente conversa de verdade, tira dúvidas, passa preços e agenda o cliente.',
            next_suggested_question: 'Vocês recebem muitos pedidos ou agendamentos pelo WhatsApp?',
          },
          {
            answer_text: 'Já testamos chatbot com menu de opções (digite 1, 2, 3)',
            resulting_action: 'Destacar humanização vs robô irritante',
            recommended_argument:
              'Aquele modelo de "digite 1 para financeiro, 2 para vendas" afasta o cliente. Nossa solução tem linguagem natural: o cliente fala como quiser e o atendente entende o contexto.',
            next_suggested_question:
              'O que mais incomoda vocês no processo de atendimento atual no WhatsApp?',
          },
          {
            answer_text: 'Não usamos nenhuma automação hoje',
            resulting_action: 'Apresentar como um salto de modernização com setup assistido',
            recommended_argument:
              'Excelente momento para implantar: você já começa com o que há de mais moderno, sem passar pela fase dos robôs antigos e travados.',
            next_suggested_question: 'Vocês recebem muitos pedidos ou agendamentos pelo WhatsApp?',
          },
        ],
      },
      {
        text: 'Vocês recebem muitos pedidos ou agendamentos pelo WhatsApp?',
        type: 'diagnóstico',
        category: 'Conversão Comercial',
        triggers: 'pedidos,agendamento,compras,reservas',
        display_order: 36,
        answers: [
          {
            answer_text: 'Sim, a maior parte das vendas e agendamentos passa por lá',
            resulting_action: 'Posicionar o WhatsApp como o motor principal de faturamento',
            recommended_argument:
              'Sendo seu canal principal, qualquer atrito custa caro. O atendente agiliza orçamentos e pré-agendamentos na hora, garantindo máxima taxa de conversão.',
            next_suggested_question:
              'O que mais incomoda vocês no processo de atendimento atual no WhatsApp?',
          },
          {
            answer_text: 'Recebemos algumas consultas, mas gostaríamos de converter mais',
            resulting_action: 'Focar na qualificação rápida para fechar a venda',
            recommended_argument:
              'Muitas vezes o cliente desiste porque fez uma pergunta simples e demorou para ter retorno. Resposta imediata destrava o interesse dele na hora.',
            next_suggested_question:
              'O que mais incomoda vocês no processo de atendimento atual no WhatsApp?',
          },
        ],
      },
      {
        text: 'O que mais incomoda vocês no processo de atendimento atual no WhatsApp?',
        type: 'diagnóstico',
        category: 'Dor Principal',
        triggers: 'incomoda,dor,gargalo,problema,atendimento atual',
        display_order: 37,
        answers: [
          {
            answer_text: 'Perguntas repetitivas de preço, horário e endereço o dia todo',
            resulting_action: 'Apresentar o atendente como filtro das dúvidas repetitivas',
            recommended_argument:
              'O atendente autônomo responde todas as dúvidas repetitivas com paciência infinita e tom educado, deixando sua equipe livre para focar nas vendas reais.',
            next_suggested_question:
              'Para vocês faria sentido ter um atendente operando 24h por dia sem faltas?',
          },
          {
            answer_text: 'Clientes que chamam à noite e nos finais de semana',
            resulting_action: 'Apresentar a cobertura 24/7 sem custo de plantonista',
            recommended_argument:
              'O atendente trabalha 24 horas por dia, 7 dias por semana, sem cansaço, sem folga e sem encargos trabalhistas, por apenas R$ 55,00/mês.',
            next_suggested_question:
              'Para vocês faria sentido ter um atendente operando 24h por dia sem faltas?',
          },
          {
            answer_text: 'Falta de padrão e atendimento desorganizado',
            resulting_action: 'Destacar padronização de tom e qualidade',
            recommended_argument:
              'Configuramos o tom exato da sua marca: educado, empático e objetivo, garantindo que todo cliente receba o mesmo nível excelente de atendimento.',
            next_suggested_question:
              'Para vocês faria sentido ter um atendente operando 24h por dia sem faltas?',
          },
        ],
      },

      // Perguntas de Qualificação e Fluxo do produto
      {
        text: 'Para vocês faria sentido ter um atendente operando 24h por dia no WhatsApp sem risco de faltas ou demora?',
        type: 'qualificação',
        category: 'Interesse 24h',
        triggers: 'interesse 24h,atendente 24h,disponibilidade total',
        display_order: 38,
        answers: [
          {
            answer_text: 'Com certeza, resolveria nosso maior gargalo',
            resulting_action: 'Validar decisor e apresentar estrutura de implantação',
            recommended_argument:
              'Perfeito! Nossa implantação é completa: cuidamos de toda a configuração no Meta Business por R$ 500,00 único e apenas R$ 55,00/mês de suporte e hospedagem.',
            next_suggested_question:
              'Além de você, mais alguém participa da decisão para colocar o atendente no ar?',
          },
          {
            answer_text: 'Gostaria de ver como funciona antes de decidir',
            resulting_action: 'Acionar próximo passo de agendar demonstração prática',
            recommended_argument:
              'Podemos rodar uma demonstração de 5 minutos direto no seu WhatsApp agora mesmo para você sentir a naturalidade das respostas.',
            next_suggested_question:
              'Além de você, mais alguém participa da decisão para colocar o atendente no ar?',
          },
        ],
      },
      {
        text: 'Além de você, mais alguém participa da decisão para colocar o atendente autônomo no ar na empresa?',
        type: 'qualificação',
        category: 'Decisor',
        triggers: 'decisor,sócio,gerente,diretoria',
        display_order: 39,
        answers: [
          {
            answer_text: 'A decisão é 100% minha',
            resulting_action: 'Avançar direto para fechamento / prazo de implantação',
            recommended_argument:
              'Excelente. Conseguimos iniciar a configuração técnica hoje mesmo e entregar em poucos dias.',
            next_suggested_question:
              'Se fecharmos agora, qual seria o prazo ideal para colocar o atendente funcionando?',
          },
          {
            answer_text: 'Preciso alinhar com meu sócio / gerente',
            resulting_action: 'Oferecer demonstração conjunta ou material executivo',
            recommended_argument:
              'Perfeito, faz todo sentido. O que acha de fazermos uma demonstração rápida de 10 minutos com vocês dois juntos para ele ver o atendente na prática?',
            next_suggested_question:
              'Se fecharmos agora, qual seria o prazo ideal para colocar o atendente funcionando?',
          },
        ],
      },
      {
        text: 'Se aprovarmos o projeto, qual seria o prazo ideal para colocar o atendente funcionando no WhatsApp da empresa?',
        type: 'fluxo',
        category: 'Prazo de Implantação',
        triggers: 'prazo,implantação,início,quando',
        display_order: 40,
        answers: [
          {
            answer_text: 'O quanto antes / esta semana ainda',
            resulting_action: 'Priorizar setup com envio de proposta imediata',
            recommended_argument:
              'Nossa equipe técnica já está pronta. O setup é de R$ 500,00 e nós cuidamos de toda a parametrização e testes em até 3 a 5 dias úteis.',
          },
          {
            answer_text: 'Nas próximas semanas / próximo mês',
            resulting_action: 'Agendar retorno no CRM com data e hora combinadas',
            recommended_argument:
              'Ótimo! Já deixamos o escopo alinhado e agendamos a data de início para garantir sua vaga na fila de implantação.',
          },
        ],
      },
    ]

    for (const qData of newQuestions) {
      let qRecord
      try {
        qRecord = app.findFirstRecordByData('playbook_questions', 'text', qData.text)
      } catch (_) {
        qRecord = new Record(questionsCol)
        qRecord.set('text', qData.text)
        qRecord.set('type', qData.type)
        qRecord.set('category', qData.category)
        qRecord.set('triggers', qData.triggers)
        qRecord.set('display_order', qData.display_order)
        qRecord.set('is_active', true)
        if (waProduct) {
          qRecord.set('product', waProduct.id)
          qRecord.set('product_name', waProduct.getString('name'))
        }
        app.save(qRecord)
      }

      // Salvar as respostas correspondentes se não existirem
      if (qData.answers && qData.answers.length > 0) {
        let ansOrder = 1
        for (const ans of qData.answers) {
          try {
            app.findFirstRecordByData('playbook_answers', 'answer_text', ans.answer_text)
          } catch (_) {
            const ansRecord = new Record(answersCol)
            ansRecord.set('question', qRecord.id)
            ansRecord.set('question_pattern', qData.text)
            ansRecord.set('answer_text', ans.answer_text)
            ansRecord.set('resulting_action', ans.resulting_action)
            ansRecord.set('recommended_argument', ans.recommended_argument)
            if (ans.next_suggested_question) {
              ansRecord.set('next_suggested_question', ans.next_suggested_question)
            }
            ansRecord.set('display_order', ansOrder++)
            app.save(ansRecord)
          }
        }
      }
    }

    // 8. Cadastrar as Objeções do produto "WhatsApp Autônomo e Humanizado"
    const newObjections = [
      {
        name: 'Já tenho atendente/secretária',
        clarification_question:
          'Ela consegue responder em menos de 1 minuto fora do horário comercial, feriados ou quando o balcão está cheio?',
        treatment_script:
          'Compreendo perfeitamente e é ótimo que já tenham esse cuidado! O atendente autônomo não vem para substituir sua secretária, mas para ser o braço direito dela: ele filtra dúvidas repetitivas, cuida da primeira resposta imediata fora do expediente e entrega o cliente pronto e qualificado para ela fechar a venda, sem cansaço e sem sobrecarga.',
        sub_scenarios: [
          {
            scenario: 'Se o cliente disser que o custo de uma secretária já é alto:',
            script:
              'Exatamente por isso: um atendente humano custa mais de R$ 2.000/mês com encargos para 8h diárias. Nosso atendente opera 24/7 por R$ 500 único de setup e apenas R$ 55/mês de manutenção.',
          },
          {
            scenario: 'Se disser que a secretária cuida bem durante o dia:',
            script:
              'E à noite ou nos fins de semana? Mais de 50% das mensagens chegam quando ela já foi embora. O atendente assume o turno noturno para sua empresa não perder negócios.',
          },
        ],
        display_order: 15,
      },
      {
        name: 'Não quero robô atendendo',
        clarification_question:
          'Você tem receio daqueles menus numéricos travados tipo "digite 1 para falar com financeiro" que irritam o cliente?',
        treatment_script:
          'Eu concordo 100% com você! Ninguém suporta aquele atendimento engessado de robô de telefonia. O nosso modelo é totalmente diferente: ele tem inteligência de linguagem natural e conversa com tom humano, empático e fluido. Se você não avisar, o cliente nem percebe que é uma inteligência respondendo. O que acha de fazermos um teste no seu próprio WhatsApp agora?',
        sub_scenarios: [
          {
            scenario: 'Se o cliente achar que a resposta vai soar fria:',
            script:
              'Nós configuramos a personalidade do atendente exatamente no tom da sua empresa: acolhedor, descontraído ou formal, com saudações naturais e emojis na medida certa.',
          },
        ],
        display_order: 16,
      },
      {
        name: 'E se a resposta errar?',
        clarification_question:
          'Seu receio é o atendente passar alguma informação de preço ou serviço incorreta para o cliente?',
        treatment_script:
          'Excelente pergunta, e essa segurança é nossa prioridade absoluta. O atendente é parametrizado com uma base de conhecimento fechada sobre a sua empresa — ele só responde o que foi validado com você. Quando surge uma pergunta fora do escopo ou personalizada demais, ele avisa cordialmente com naturalidade e transfere imediatamente para você ou sua equipe.',
        sub_scenarios: [
          {
            scenario: 'Se quiser saber quem ajusta as informações:',
            script:
              'Qualquer mudança de preço, cardápio ou serviço é ajustada pelo nosso suporte técnico contínuo incluso na mensalidade de R$ 55,00 sem custo extra.',
          },
        ],
        display_order: 17,
      },
      {
        name: 'Já uso chatbot',
        clarification_question:
          'O chatbot atual de vocês responde com conversação natural ou ainda usa botões e menus numéricos (digite 1, 2, 3)?',
        treatment_script:
          'Muito bom já terem essa visão de automação! A diferença fundamental é que chatbots antigos funcionam em árvores rígidas: se o cliente manda áudio ou pergunta algo fora do menu, o robô trava. O nosso atendente autônomo e humanizado entende o contexto real da conversa e qualifica o cliente com empatia, gerando muito mais fechamentos.',
        sub_scenarios: [
          {
            scenario: 'Se o cliente disser que a taxa de conversão do chatbot dele é baixa:',
            script:
              'É o sintoma clássico do robô antigo: o cliente se sente ignorado e abandona a conversa. A resposta humanizada retém o cliente desde a primeira mensagem.',
          },
        ],
        display_order: 18,
      },
      {
        name: 'Não tenho tempo para implementar',
        clarification_question:
          'Você acha que vai precisar gastar horas configurando e programando mensagens?',
        treatment_script:
          'É exatamente por isso que nosso modelo foi criado: nós cuidamos de 100% da parte técnica, homologação no Meta Business e configuração das respostas. Você só precisa de 15 minutos em uma ligação ou áudio de WhatsApp para nos contar como funciona sua empresa. Por R$ 500,00 de setup único entregamos tudo pronto e rodando.',
        sub_scenarios: [
          {
            scenario: 'Se disser que a semana está muito corrida:',
            script:
              'Podemos pegar as informações direto do seu Instagram ou materiais existentes e nós mesmos montamos a base inicial para sua aprovação rápida.',
          },
        ],
        display_order: 19,
      },
    ]

    for (const obData of newObjections) {
      try {
        app.findFirstRecordByData('playbook_objections', 'name', obData.name)
      } catch (_) {
        const obRec = new Record(objectionsCol)
        obRec.set('name', obData.name)
        obRec.set('clarification_question', obData.clarification_question)
        obRec.set('treatment_script', obData.treatment_script)
        obRec.set('sub_scenarios', obData.sub_scenarios)
        obRec.set('display_order', obData.display_order)
        obRec.set('is_active', true)
        if (waProduct) {
          obRec.set('product', waProduct.id)
          obRec.set('product_name', waProduct.getString('name'))
        }
        app.save(obRec)
      }
    }

    // 9. Cadastrar os Argumentos de Apoio do produto "WhatsApp Autônomo e Humanizado"
    const newArguments = [
      {
        situation: 'Cliente perde clientes fora do horário comercial',
        argument_text:
          'Mais de 60% das mensagens de clientes chegam no período da noite, feriados ou fins de semana. Quem responde primeiro fecha a venda. Com o WhatsApp Autônomo sua empresa atende 24 horas por dia com simpatia e agilidade.',
        display_order: 10,
      },
      {
        situation: 'Demora para responder espanta cliente no WhatsApp',
        argument_text:
          'No WhatsApp, 5 minutos de espera já são suficientes para o cliente chamar o concorrente no Google ou Instagram. Nosso atendente responde em menos de 10 segundos, retendo o lead na hora.',
        display_order: 11,
      },
      {
        situation: 'Atendente responde sozinho com naturalidade 24/7',
        argument_text:
          'Diferente de robôs travados que irritam as pessoas, nosso atendente usa linguagem natural, entende gírias e frases completas e conduz a conversa com tom humanizado sem parecer máquina.',
        display_order: 12,
      },
      {
        situation: 'Foco da equipe nas vendas e não em perguntas repetidas',
        argument_text:
          'Sua equipe gasta metade do dia respondendo onde fica, qual o horário e quanto custa. O atendente autônomo filtra todas essas dúvidas básicas e entrega o cliente pronto para a equipe apenas fechar a venda.',
        display_order: 13,
      },
      {
        situation: 'Comparativo de custo com atendente humano',
        argument_text:
          'Um atendente humano custa facilmente mais de R$ 2.000 por mês em salário e encargos para cobrir apenas 8 horas diárias. O WhatsApp Autônomo cobre 24 horas ininterruptas por um setup único de R$ 500,00 e mensalidade fixa de apenas R$ 55,00.',
        display_order: 14,
      },
    ]

    for (const argData of newArguments) {
      try {
        app.findFirstRecordByData('playbook_arguments', 'situation', argData.situation)
      } catch (_) {
        const argRec = new Record(argumentsCol)
        argRec.set('situation', argData.situation)
        argRec.set('argument_text', argData.argument_text)
        argRec.set('display_order', argData.display_order)
        argRec.set('is_active', true)
        if (waProduct) {
          argRec.set('product', waProduct.id)
          argRec.set('product_name', waProduct.getString('name'))
        }
        app.save(argRec)
      }
    }
  },
  (app) => {
    // Reversão limpa
  },
)
