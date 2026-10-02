migrate(
  (app) => {
    const oppsCol = app.findCollectionByNameOrId('opportunities')

    if (!oppsCol.fields.getByName('return_at')) {
      oppsCol.fields.add(
        new DateField({
          name: 'return_at',
          required: false,
        }),
      )
      oppsCol.addIndex('idx_opportunities_return_at', false, 'return_at', '')
      app.save(oppsCol)
    }
  },
  (app) => {
    try {
      const oppsCol = app.findCollectionByNameOrId('opportunities')
      oppsCol.fields.removeByName('return_at')
      oppsCol.removeIndex('idx_opportunities_return_at')
      app.save(oppsCol)
    } catch (_) {}
  },
)
