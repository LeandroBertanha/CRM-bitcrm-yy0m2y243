migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('saas_commissions')
    if (!collection.fields.getByName('recurring_costs_cents')) {
      collection.fields.add(
        new NumberField({
          name: 'recurring_costs_cents',
          type: 'number',
          required: false,
        }),
      )
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('saas_commissions')
    if (collection.fields.getByName('recurring_costs_cents')) {
      collection.fields.removeByName('recurring_costs_cents')
      app.save(collection)
    }
  },
)
