migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')
    const oppsCollection = app.findCollectionByNameOrId('opportunities')

    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@gmail.com')
    } catch (_) {
      const newUser = new Record(usersCollection)
      newUser.setEmail('leandro.bertanha@gmail.com')
      newUser.setPassword('Skip@Pass')
      newUser.setVerified(true)
      newUser.set('name', 'Leandro Bertanha')
      app.save(newUser)
      adminUser = newUser
    }

    const sampleOpportunities = [
      {
        company: 'Indústrias Souza',
        stage: 'Proposta',
        source: 'Indicação',
        value: 45000,
        contact_name: 'Marcos Souza',
        contact_email: 'marcos@industriassouza.com.br',
        contact_phone: '(11) 98765-4321',
        message: 'Interesse em diagnóstico operacional e framework omnichannel para 80 atendentes.',
      },
      {
        company: 'Tech Valley',
        stage: 'Qualificado',
        source: 'Site',
        value: 12500,
        contact_name: 'Camila Duarte',
        contact_email: 'camila@techvalley.io',
        contact_phone: '(19) 99123-4567',
        message: 'Procura consultoria de IA generativa para triagem automatizada no suporte.',
      },
      {
        company: 'Grupo Alfa',
        stage: 'Ganho',
        source: 'WhatsApp',
        value: 80000,
        contact_name: 'Roberto Silveira',
        contact_email: 'roberto@grupoalfa.com.br',
        contact_phone: '(21) 97654-3210',
        message: 'Projeto fechado de reestruturação de processos com foco em FCR e NPS.',
      },
      {
        company: 'Café Aurora',
        stage: 'Novo',
        source: 'Formulário Público',
        value: 8900,
        contact_name: 'Fernanda Lima',
        contact_email: 'fernanda@cafeaurora.com.br',
        contact_phone: '(31) 98888-1122',
        message:
          'Enviado pelo formulário público: interesse em consultoria de atendimento e expansão.',
      },
      {
        company: 'Romazzino Logística',
        stage: 'Qualificado',
        source: 'Indicação',
        value: 32000,
        contact_name: 'Paulo Mendes',
        contact_email: 'paulo@romazzino.com.br',
        contact_phone: '(11) 97111-2233',
        message: 'Otimização de rotas de atendimento e integração de CRM com ERP.',
      },
    ]

    for (const item of sampleOpportunities) {
      try {
        app.findFirstRecordByData('opportunities', 'company', item.company)
        // já existe, não duplica
      } catch (_) {
        const record = new Record(oppsCollection)
        record.set('company', item.company)
        record.set('stage', item.stage)
        record.set('source', item.source)
        record.set('value', item.value)
        record.set('seller', adminUser.id)
        record.set('contact_name', item.contact_name)
        record.set('contact_email', item.contact_email)
        record.set('contact_phone', item.contact_phone)
        record.set('message', item.message)
        app.save(record)
      }
    }
  },
  (app) => {
    try {
      const opps = app.findRecordsByFilter('opportunities', "company != ''", '-created', 100, 0)
      for (const opp of opps) {
        app.delete(opp)
      }
    } catch (_) {}
  },
)
