migrate(
  (app) => {
    const auth = "@request.auth.id != ''"
    const admin =
      "(@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com' || @request.auth.email = 'leandro.bertanha@gmail.com')"
    const ownerRead = auth + ' && (seller = @request.auth.id || ' + admin + ')'

    const policies = app.findCollectionByNameOrId('saas_commission_policies')
    policies.listRule = auth
    policies.viewRule = auth
    policies.createRule = null
    policies.updateRule = null
    policies.deleteRule = null
    app.save(policies)

    ;[
      'saas_commission_exceptions',
      'saas_commissions',
      'saas_commission_receivables',
      'saas_commission_releases',
    ].forEach((name) => {
      const collection = app.findCollectionByNameOrId(name)
      collection.listRule = ownerRead
      collection.viewRule = ownerRead
      collection.createRule = null
      collection.updateRule = null
      collection.deleteRule = null
      app.save(collection)
    })

    const events = app.findCollectionByNameOrId('saas_commission_events')
    events.listRule = ownerRead
    events.viewRule = ownerRead
    events.createRule = null
    events.updateRule = null
    events.deleteRule = null
    app.save(events)
  },
  (app) => {
    const auth = "@request.auth.id != ''"
    const admin =
      "(@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"
    const owner = auth + ' && (seller = @request.auth.id || ' + admin + ')'

    const policies = app.findCollectionByNameOrId('saas_commission_policies')
    policies.createRule = auth + ' && ' + admin
    policies.updateRule = auth + ' && ' + admin
    policies.deleteRule = auth + ' && ' + admin
    app.save(policies)

    const exceptions = app.findCollectionByNameOrId('saas_commission_exceptions')
    exceptions.createRule = auth + ' && ' + admin
    exceptions.updateRule = auth + ' && ' + admin
    exceptions.deleteRule = auth + ' && ' + admin
    app.save(exceptions)

    const commissions = app.findCollectionByNameOrId('saas_commissions')
    commissions.createRule = owner
    commissions.updateRule = auth + ' && ' + admin
    commissions.deleteRule = auth + ' && ' + admin
    app.save(commissions)

    const receivables = app.findCollectionByNameOrId('saas_commission_receivables')
    receivables.createRule = owner
    receivables.updateRule = owner
    receivables.deleteRule = auth + ' && ' + admin
    app.save(receivables)

    const releases = app.findCollectionByNameOrId('saas_commission_releases')
    releases.createRule = owner
    releases.updateRule = auth + ' && ' + admin
    releases.deleteRule = ''
    app.save(releases)

    const events = app.findCollectionByNameOrId('saas_commission_events')
    events.createRule = owner
    events.updateRule = ''
    events.deleteRule = ''
    app.save(events)
  },
)
