migrate(
  (app) => {
    // Atualizar regras de listagem e visualização da coleção 'opportunities'
    // Permite que vendedores vejam suas próprias oportunidades e as não atribuídas (seller = '' ou seller = null),
    // enquanto administradores continuam vendo todas as oportunidades.
    const oppsCol = app.findCollectionByNameOrId('opportunities')
    const ruleExpression =
      "@request.auth.id != '' && (seller = @request.auth.id || seller = '' || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"

    oppsCol.listRule = ruleExpression
    oppsCol.viewRule = ruleExpression
    app.save(oppsCol)
  },
  (app) => {
    try {
      const oppsCol = app.findCollectionByNameOrId('opportunities')
      const ruleExpression =
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"
      oppsCol.listRule = ruleExpression
      oppsCol.viewRule = ruleExpression
      app.save(oppsCol)
    } catch (_) {}
  },
)
