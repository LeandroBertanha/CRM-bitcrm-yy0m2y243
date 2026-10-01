migrate(
  (app) => {
    // 1. Apagar todas as oportunidades de demonstração existentes
    const oppsCol = app.findCollectionByNameOrId('opportunities')
    app.truncateCollection(oppsCol)

    // 2. Adicionar payment_type e payment_installments à coleção opportunities se não existirem
    if (!oppsCol.fields.getByName('payment_type')) {
      oppsCol.fields.add(
        new SelectField({
          name: 'payment_type',
          values: ['Débito', 'PIX', 'Parcelado'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    if (!oppsCol.fields.getByName('payment_installments')) {
      oppsCol.fields.add(
        new NumberField({
          name: 'payment_installments',
          min: 1,
          max: 10,
          onlyInt: true,
          required: false,
        }),
      )
    }

    app.save(oppsCol)

    // 3. Atualizar regras de criação/gerenciamento de usuários
    // Apenas administradores (role='admin' ou leandro.bertanha@lbertanha.com) podem criar novos usuários
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const adminOnlyRule =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"

    usersCol.createRule = adminOnlyRule
    usersCol.deleteRule = adminOnlyRule
    // Update permite que o próprio usuário edite seus dados ou admin edite
    usersCol.updateRule = `id = @request.auth.id || (${adminOnlyRule})`
    app.save(usersCol)
  },
  (app) => {
    // Reverter regras de usuários se necessário
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      usersCol.createRule = ''
      usersCol.deleteRule = 'id = @request.auth.id'
      usersCol.updateRule = 'id = @request.auth.id'
      app.save(usersCol)
    } catch (_) {}
  },
)
