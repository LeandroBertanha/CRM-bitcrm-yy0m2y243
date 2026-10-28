migrate(
  (app) => {
    const auth = "@request.auth.id != ''"
    const owner = auth + " && @request.auth.email = 'leandro.bertanha@lbertanha.com'"

    // O catálogo continua legível por todos os usuários autenticados, mas apenas
    // o proprietário pode criar ou alterar produtos.
    const products = app.findCollectionByNameOrId('products')
    products.listRule = auth
    products.viewRule = auth
    products.createRule = owner
    products.updateRule = owner
    products.deleteRule = owner
    app.save(products)

    // A política ativa é pública para a equipe autenticada. Exceções são dados
    // sensíveis e ficam visíveis apenas para o proprietário.
    const policies = app.findCollectionByNameOrId('saas_commission_policies')
    policies.listRule = auth
    policies.viewRule = auth
    policies.createRule = null
    policies.updateRule = null
    policies.deleteRule = null
    app.save(policies)

    const exceptions = app.findCollectionByNameOrId('saas_commission_exceptions')
    exceptions.listRule = owner
    exceptions.viewRule = owner
    exceptions.createRule = null
    exceptions.updateRule = null
    exceptions.deleteRule = null
    app.save(exceptions)
  },
  (app) => {
    const auth = "@request.auth.id != ''"
    const admin = auth + " && @request.auth.role = 'admin'"

    const products = app.findCollectionByNameOrId('products')
    products.listRule = auth
    products.viewRule = auth
    products.createRule = admin
    products.updateRule = admin
    products.deleteRule = admin
    app.save(products)

    // Mantém as escritas financeiras centralizadas no hook mesmo no rollback.
    const exceptions = app.findCollectionByNameOrId('saas_commission_exceptions')
    exceptions.listRule = auth + ' && (seller = @request.auth.id || ' + admin + ')'
    exceptions.viewRule = auth + ' && (seller = @request.auth.id || ' + admin + ')'
    exceptions.createRule = null
    exceptions.updateRule = null
    exceptions.deleteRule = null
    app.save(exceptions)
  },
)
