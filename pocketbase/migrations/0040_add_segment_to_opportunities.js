migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('opportunities')
    if (!collection.fields.getByName('segment')) {
      collection.fields.add(
        new TextField({
          name: 'segment',
          required: false,
        }),
      )
      app.save(collection)
    }
  },
  () => {
    // Rollback intencionalmente não destrutivo para preservar categorias já cadastradas.
  },
)
