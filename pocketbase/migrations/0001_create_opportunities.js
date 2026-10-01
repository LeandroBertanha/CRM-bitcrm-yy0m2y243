migrate(
  (app) => {
    const usersCollection = app.findCollectionByNameOrId('_pb_users_auth_')

    const collection = new Collection({
      name: 'opportunities',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')",
      viewRule:
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')",
      createRule: '', // Permite que o formulário público crie registros sem autenticação, além de sellers autenticados
      updateRule:
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')",
      deleteRule:
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')",
      fields: [
        { name: 'company', type: 'text', required: true },
        {
          name: 'stage',
          type: 'select',
          required: true,
          values: ['Novo', 'Qualificado', 'Proposta', 'Ganho', 'Perdido'],
          maxSelect: 1,
        },
        {
          name: 'source',
          type: 'select',
          required: true,
          values: ['Formulário Público', 'Indicação', 'Site', 'WhatsApp', 'Evento', 'Outro'],
          maxSelect: 1,
        },
        { name: 'value', type: 'number', required: false },
        {
          name: 'seller',
          type: 'relation',
          required: false,
          collectionId: usersCollection.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'contact_name', type: 'text', required: false },
        { name: 'contact_email', type: 'email', required: false },
        { name: 'contact_phone', type: 'text', required: false },
        { name: 'message', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_opportunities_stage ON opportunities (stage)',
        'CREATE INDEX idx_opportunities_seller ON opportunities (seller)',
        'CREATE INDEX idx_opportunities_created ON opportunities (created)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('opportunities')
      app.delete(collection)
    } catch (_) {}
  },
)
