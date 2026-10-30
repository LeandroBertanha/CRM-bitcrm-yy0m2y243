migrate(
  (app) => {
    const clients = app.findCollectionByNameOrId('clients')
    const wonOpportunities = app.findRecordsByFilter(
      'opportunities',
      "stage = 'Ganho'",
      '-updated',
      10000,
      0,
    )

    for (const opportunity of wonOpportunities) {
      try {
        app.findFirstRecordByData('clients', 'source_opportunity', opportunity.id)
        continue
      } catch (_) {
        // O cadastro ainda não existe e será criado abaixo.
      }

      const client = new Record(clients)
      client.set('name', opportunity.getString('company').trim().slice(0, 240))
      client.set('contact_name', opportunity.getString('contact_name').trim().slice(0, 200))
      client.set('contact_email', opportunity.getString('contact_email').trim().slice(0, 240))
      client.set('contact_phone', opportunity.getString('contact_phone').trim().slice(0, 30))
      client.set('city', opportunity.getString('city').trim().slice(0, 120))
      client.set('seller', opportunity.getString('seller'))
      client.set('source_opportunity', opportunity.id)
      client.set('product', opportunity.getString('product'))
      client.set('product_name', opportunity.getString('product_name').trim().slice(0, 240))
      client.set('setup_value', Number(opportunity.get('value')) || 0)
      client.set('recurring_value', Number(opportunity.get('recurring_value')) || 0)
      client.set('status', 'Implantacao')
      client.set('won_at', opportunity.getString('updated') || opportunity.getString('created'))
      app.save(client)
    }
  },
  () => {
    // Rollback intencionalmente não destrutivo para preservar cadastros retroalimentados.
  },
)
