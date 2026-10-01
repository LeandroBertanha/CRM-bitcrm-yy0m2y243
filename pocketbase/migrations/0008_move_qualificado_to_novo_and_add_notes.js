migrate(
  (app) => {
    // 1. Atualizar TODAS as oportunidades que estão no estágio 'Qualificado' para 'Novo'
    app
      .db()
      .newQuery("UPDATE opportunities SET stage = 'Novo' WHERE stage = 'Qualificado'")
      .execute()

    // 2. Criar coleção opportunity_notes para timeline de conversas/interações
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const oppsCol = app.findCollectionByNameOrId('opportunities')

    const adminCheck =
      "@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com'"

    const notesCol = new Collection({
      name: 'opportunity_notes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      // Sem permissão para editar/apagar entradas de outros usuários (apenas autor ou admin)
      updateRule: `@request.auth.id != '' && (author = @request.auth.id || (${adminCheck}))`,
      deleteRule: `@request.auth.id != '' && (author = @request.auth.id || (${adminCheck}))`,
      fields: [
        {
          name: 'opportunity',
          type: 'relation',
          required: true,
          collectionId: oppsCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'author',
          type: 'relation',
          required: true,
          collectionId: usersCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['ligacao', 'whatsapp', 'reuniao', 'nota', 'outro'],
          maxSelect: 1,
        },
        {
          name: 'text',
          type: 'text',
          required: true,
        },
        {
          name: 'date',
          type: 'date',
          required: true,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        'CREATE INDEX idx_opportunity_notes_opp ON opportunity_notes (opportunity)',
        'CREATE INDEX idx_opportunity_notes_date ON opportunity_notes (date DESC)',
        'CREATE INDEX idx_opportunity_notes_author ON opportunity_notes (author)',
      ],
    })

    app.save(notesCol)
  },
  (app) => {
    try {
      const notesCol = app.findCollectionByNameOrId('opportunity_notes')
      app.delete(notesCol)
    } catch (_) {}
  },
)
