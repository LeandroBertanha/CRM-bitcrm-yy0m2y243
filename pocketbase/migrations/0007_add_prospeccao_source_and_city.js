migrate(
  (app) => {
    const oppsCol = app.findCollectionByNameOrId('opportunities')

    // 1. Atualizar o campo source com a nova opção 'Prospecção'
    oppsCol.fields.add(
      new SelectField({
        name: 'source',
        values: [
          'Formulário Público',
          'Indicação',
          'Site',
          'WhatsApp',
          'Evento',
          'Prospecção',
          'Outro',
        ],
        maxSelect: 1,
        required: true,
      }),
    )

    // 2. Adicionar campo 'city' (opcional) para registrar a cidade do lead
    if (!oppsCol.fields.getByName('city')) {
      oppsCol.fields.add(
        new TextField({
          name: 'city',
          required: false,
        }),
      )
    }

    app.save(oppsCol)
  },
  (app) => {
    try {
      const oppsCol = app.findCollectionByNameOrId('opportunities')
      oppsCol.fields.add(
        new SelectField({
          name: 'source',
          values: ['Formulário Público', 'Indicação', 'Site', 'WhatsApp', 'Evento', 'Outro'],
          maxSelect: 1,
          required: true,
        }),
      )
      app.save(oppsCol)
    } catch (_) {}
  },
)
