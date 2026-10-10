migrate(
  (app) => {
    // 1. Criar collection 'products' (catálogo de produtos do CRM)
    let productsCol
    try {
      productsCol = app.findCollectionByNameOrId('products')
    } catch (_) {
      productsCol = new Collection({
        name: 'products',
        type: 'base',
        // Qualquer usuário autenticado pode listar e visualizar; administradores podem criar, editar e excluir
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'description', type: 'text', required: false },
          { name: 'setup_value', type: 'number', required: true }, // Valor de implantação/configuração (único)
          { name: 'recurring_value', type: 'number', required: false }, // Mensalidade / recorrência
          { name: 'recurring_interval', type: 'text', required: false }, // ex: 'mensal'
          { name: 'commission_base_type', type: 'text', required: false }, // 'setup' | 'total' (default 'setup')
          { name: 'commission_rules_note', type: 'text', required: false },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'display_order', type: 'number', required: false, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_products_active ON products (is_active)'],
      })
      app.save(productsCol)
    }

    // 2. Inserir os produtos no catálogo se não existirem
    // Produto 1: "Site ou Landing Page sob medida" (produto histórico)
    let siteProduct
    try {
      siteProduct = app.findFirstRecordByData('products', 'name', 'Site ou Landing Page sob medida')
    } catch (_) {
      siteProduct = new Record(productsCol)
      siteProduct.set('name', 'Site ou Landing Page sob medida')
      siteProduct.set(
        'description',
        'Criação de site profissional ou landing page de alta conversão sob medida com domínio e hospedagem.',
      )
      siteProduct.set('setup_value', 500)
      siteProduct.set('recurring_value', 55)
      siteProduct.set('recurring_interval', 'mensal')
      siteProduct.set('commission_base_type', 'setup')
      siteProduct.set(
        'commission_rules_note',
        'A comissão incide exclusivamente sobre a criação (R$ 500,00). A hospedagem de R$ 55,00/mês não integra a base de comissão.',
      )
      siteProduct.set('is_active', true)
      siteProduct.set('display_order', 1)
      app.save(siteProduct)
    }

    // Produto 2: "WhatsApp Autônomo e Humanizado" (novo produto solicitado)
    let waProduct
    try {
      waProduct = app.findFirstRecordByData('products', 'name', 'WhatsApp Autônomo e Humanizado')
    } catch (_) {
      waProduct = new Record(productsCol)
      waProduct.set('name', 'WhatsApp Autônomo e Humanizado')
      waProduct.set(
        'description',
        'Atendente automatizado no WhatsApp do cliente final, com resposta autônoma e tom humanizado que responde com naturalidade.',
      )
      waProduct.set('setup_value', 500) // Configuração (Meta Business e implantação): R$ 500,00 valor único
      waProduct.set('recurring_value', 55) // Hospedagem, Suporte e Manutenção: R$ 55,00/mês recorrente
      waProduct.set('recurring_interval', 'mensal')
      waProduct.set('commission_base_type', 'setup')
      waProduct.set(
        'commission_rules_note',
        'A comissão incide EXCLUSIVAMENTE sobre o setup de R$ 500,00 (valor único) — a mensalidade de R$ 55,00/mês NUNCA entra na base de comissão.',
      )
      waProduct.set('is_active', true)
      waProduct.set('display_order', 2)
      app.save(waProduct)
    }

    // 3. Adicionar campos product (relation ou text) e recurring_value em 'opportunities' se não existirem
    const oppsCol = app.findCollectionByNameOrId('opportunities')
    let oppsChanged = false

    if (!oppsCol.fields.getByName('product')) {
      oppsCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      oppsChanged = true
    }

    if (!oppsCol.fields.getByName('product_name')) {
      oppsCol.fields.add(
        new TextField({
          name: 'product_name',
          required: false,
        }),
      )
      oppsChanged = true
    }

    if (!oppsCol.fields.getByName('recurring_value')) {
      oppsCol.fields.add(
        new NumberField({
          name: 'recurring_value',
          required: false,
        }),
      )
      oppsChanged = true
    }

    if (oppsChanged) {
      app.save(oppsCol)
    }

    // 4. Adicionar campo 'product' e 'product_name' em 'playbook_scripts' para associar scripts a produtos
    const scriptsCol = app.findCollectionByNameOrId('playbook_scripts')
    let scriptsChanged = false

    if (!scriptsCol.fields.getByName('product')) {
      scriptsCol.fields.add(
        new RelationField({
          name: 'product',
          collectionId: productsCol.id,
          maxSelect: 1,
          required: false,
        }),
      )
      scriptsChanged = true
    }

    if (!scriptsCol.fields.getByName('product_name')) {
      scriptsCol.fields.add(
        new TextField({
          name: 'product_name',
          required: false,
        }),
      )
      scriptsChanged = true
    }

    if (scriptsChanged) {
      app.save(scriptsCol)
    }

    // 5. Vincular scripts existentes de WhatsApp ao produto "Site ou Landing Page sob medida"
    try {
      const existingScripts = app.findRecordsByFilter(
        'playbook_scripts',
        "channel = 'WhatsApp'",
        'created',
        20,
        0,
      )
      for (const sc of existingScripts) {
        if (!sc.getString('product')) {
          sc.set('product', siteProduct.id)
          sc.set('product_name', siteProduct.getString('name'))
          app.save(sc)
        }
      }
    } catch (e) {
      console.log('Aviso ao associar scripts existentes ao siteProduct:', e)
    }

    // 6. Cadastrar os novos scripts próprios para o produto "WhatsApp Autônomo e Humanizado"
    // Abordagem Inicial
    const waInitialTitle = 'Abordagem Inicial - WhatsApp Autônomo'
    try {
      app.findFirstRecordByData('playbook_scripts', 'title', waInitialTitle)
    } catch (_) {
      const sc = new Record(scriptsCol)
      sc.set('channel', 'WhatsApp')
      sc.set('situation', 'Primeiro contato consultivo / WhatsApp Autônomo e Humanizado')
      sc.set('title', waInitialTitle)
      sc.set(
        'script_text',
        'Olá, {contato}! Tudo bem? Aqui é {vendedor}, da bit Consulting.\n\nVi o atendimento da {empresa} em {cidade} e gostaria de compartilhar uma solução rápida: implementamos um atendente no WhatsApp que responde sozinho com total naturalidade, sem parecer robô, atendendo dúvidas e qualificando clientes 24 horas por dia.\n\nPodemos conversar alguns minutos para eu te mostrar como funciona na prática?\n\n— {vendedor}, bit Consulting · Ref. {ref}',
      )
      sc.set(
        'instructions',
        'Tom consultivo focado no WhatsApp Autônomo e Humanizado. Destacar que responde sozinho sem parecer robô e agendar conversa. Variáveis: {contato}, {empresa}, {cidade}, {vendedor}, {ref}.',
      )
      sc.set('display_order', 8)
      sc.set('is_active', true)
      sc.set('product', waProduct.id)
      sc.set('product_name', waProduct.getString('name'))
      app.save(sc)
    }

    // Follow-up
    const waFollowupTitle = 'Follow-up - WhatsApp Autônomo'
    try {
      app.findFirstRecordByData('playbook_scripts', 'title', waFollowupTitle)
    } catch (_) {
      const sc = new Record(scriptsCol)
      sc.set('channel', 'WhatsApp')
      sc.set('situation', 'Retomada de qualificação / WhatsApp Autônomo e Humanizado')
      sc.set('title', waFollowupTitle)
      sc.set(
        'script_text',
        'Olá, {contato}! Tudo bem? Aqui é o {vendedor}, da bit Consulting.\n\nPassando para retomar nosso contato de {data} sobre o atendimento da {empresa} em {cidade}. Com o WhatsApp Autônomo e Humanizado, sua equipe nunca mais perde um cliente fora do horário e todas as respostas são instantâneas e humanizadas.\n\nConsegue receber uma demonstração rápida de 5 minutos hoje?\n\n— {vendedor}, bit Consulting · Ref. {ref}',
      )
      sc.set(
        'instructions',
        'Tom de retomada reforçando o benefício principal (respostas instantâneas humanizadas e não perder atendimento fora do horário) e convite para demonstração. Variáveis: {contato}, {empresa}, {cidade}, {vendedor}, {data}, {ref}.',
      )
      sc.set('display_order', 9)
      sc.set('is_active', true)
      sc.set('product', waProduct.id)
      sc.set('product_name', waProduct.getString('name'))
      app.save(sc)
    }

    // 7. Atualizar / criar comissão em 'commission_settings' para registrar WhatsApp Autônomo e Humanizado
    try {
      app.findFirstRecordByData(
        'commission_settings',
        'product_name',
        'WhatsApp Autônomo e Humanizado',
      )
    } catch (_) {
      const commSettingsCol = app.findCollectionByNameOrId('commission_settings')
      const rec = new Record(commSettingsCol)
      rec.set('product_name', 'WhatsApp Autônomo e Humanizado')
      rec.set('base_sale_value', 500) // Setup único
      rec.set('monthly_hosting_value', 55) // Hospedagem/suporte mensal
      rec.set(
        'hosting_note',
        'A comissão incide EXCLUSIVAMENTE sobre o setup de R$ 500,00 (valor único). A mensalidade de R$ 55,00/mês referente a hospedagem, suporte e manutenção NUNCA entra na base de comissão.',
      )
      rec.set('essential_rules', [
        'A comissão incide exclusivamente sobre o setup de implantação e configuração (R$ 500,00).',
        'A mensalidade de hospedagem, suporte e manutenção de R$ 55,00/mês NUNCA integra a base de comissão.',
        'A faixa de comissão segue a quantidade total de vendas do mês, com cálculo proporcional para setups superiores a R$ 500,00.',
        'Vendas canceladas, estornadas ou não pagas não geram comissão.',
      ])
      rec.set('detailed_rules', [
        {
          rule: '1. Produto elegível',
          description:
            'WhatsApp Autônomo e Humanizado vendido pelo setup comercial vigente de R$ 500,00.',
        },
        {
          rule: '2. Base de cálculo exclusiva no setup',
          description:
            'A comissão incide exclusivamente sobre o setup de R$ 500,00 (valor único). A mensalidade de R$ 55,00/mês nunca entra na base de cálculo.',
        },
        {
          rule: '3. Mensalidade técnica',
          description:
            'A taxa recorrente de R$ 55,00/mês cobre hospedagem em nuvem, suporte e manutenção e não gera comissão.',
        },
      ])
      rec.set('is_active', true)
      app.save(rec)
    }

    // 8. Se houver tabela playbook_values, adicionar ou atualizar plano comercial para o novo produto
    try {
      const valuesCol = app.findCollectionByNameOrId('playbook_values')
      let waValues
      try {
        waValues = app.findFirstRecordByData(
          'playbook_values',
          'title',
          'WhatsApp Autônomo e Humanizado - Atendente IA',
        )
      } catch (_) {
        waValues = new Record(valuesCol)
        waValues.set('title', 'WhatsApp Autônomo e Humanizado - Atendente IA')
        waValues.set('creation_value', 500)
        waValues.set('monthly_value', 55)
        waValues.set('inclusions', [
          'Configuração completa da conta Meta Business e WhatsApp Cloud API',
          'Atendente com respostas humanizadas e naturais sem parecer robô',
          'Qualificação automática de leads e agendamento de reuniões',
          'Hospedagem em nuvem de alta disponibilidade inclusa',
          'Suporte técnico e manutenção contínua',
        ])
        waValues.set(
          'script',
          'O investimento funciona em dois componentes: a configuração e implantação no Meta Business é de R$ 500,00 em valor único. Depois, há apenas R$ 55,00 por mês para cobrir a hospedagem, manutenção e suporte contínuo.',
        )
        waValues.set('closing_questions', [
          'Esse modelo de atendimento 24h faria sentido para a empresa?',
          'O que achou de não perder mais clientes fora do horário?',
          'Esse investimento cabe no que você planejava?',
        ])
        waValues.set('is_active', true)
        app.save(waValues)
      }
    } catch (e) {
      console.log('Aviso playbook_values:', e)
    }
  },
  (app) => {
    // Reversão
    try {
      const productsCol = app.findCollectionByNameOrId('products')
      app.delete(productsCol)
    } catch (_) {}
  },
)
