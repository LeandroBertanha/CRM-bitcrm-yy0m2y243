migrate(
  (app) => {
    const oppsCol = app.findCollectionByNameOrId('opportunities')

    // Atualizar o campo stage com a nova opção 'Agendado'
    // Ordem final do funil: Novo -> Qualificado -> Agendado -> Proposta -> Ganho -> Perdido
    oppsCol.fields.add(
      new SelectField({
        name: 'stage',
        values: ['Novo', 'Qualificado', 'Agendado', 'Proposta', 'Ganho', 'Perdido'],
        maxSelect: 1,
        required: true,
      }),
    )

    app.save(oppsCol)
  },
  (app) => {
    try {
      const oppsCol = app.findCollectionByNameOrId('opportunities')
      oppsCol.fields.add(
        new SelectField({
          name: 'stage',
          values: ['Novo', 'Qualificado', 'Proposta', 'Ganho', 'Perdido'],
          maxSelect: 1,
          required: true,
        }),
      )
      app.save(oppsCol)
    } catch (_) {}
  },
)
