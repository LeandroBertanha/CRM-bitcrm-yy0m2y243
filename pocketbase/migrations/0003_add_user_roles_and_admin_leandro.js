migrate(
  (app) => {
    // 1. Atualizar a coleção users: adicionar campo 'role' (admin ou seller)
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          values: ['admin', 'seller'],
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(usersCol)
    }

    // 2. Atualizar ou criar o usuário Administrador: leandro.bertanha@lbertanha.com
    let adminRecord = null
    // Tenta encontrar pelo novo e-mail primeiro
    try {
      adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@lbertanha.com')
    } catch (_) {}

    // Se não encontrou pelo novo, tenta pelo antigo leandro.bertanha@gmail.com
    if (!adminRecord) {
      try {
        adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@gmail.com')
      } catch (_) {}
    }

    if (adminRecord) {
      adminRecord.setEmail('leandro.bertanha@lbertanha.com')
      adminRecord.setVerified(true)
      adminRecord.setPassword('Skip@Pass')
      adminRecord.set('role', 'admin')
      adminRecord.set('name', 'Leandro Bertanha')
      app.save(adminRecord)
    } else {
      const newAdmin = new Record(usersCol)
      newAdmin.setEmail('leandro.bertanha@lbertanha.com')
      newAdmin.setPassword('Skip@Pass')
      newAdmin.setVerified(true)
      newAdmin.set('role', 'admin')
      newAdmin.set('name', 'Leandro Bertanha')
      app.save(newAdmin)
      adminRecord = newAdmin
    }

    // 3. Garantir que outros usuários tenham role='seller' se não tiverem role
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET role = 'seller' WHERE (role IS NULL OR role = '') AND id != {:adminId}",
        )
        .bind({ adminId: adminRecord.id })
        .execute()
    } catch (_) {}

    // 4. Atualizar as regras de acesso da coleção 'opportunities'
    // Admins (role='admin' ou email leandro.bertanha@lbertanha.com) veem e gerenciam tudo;
    // Sellers comuns continuam acessando apenas as oportunidades em que são o 'seller' ou atribuídos.
    const oppsCol = app.findCollectionByNameOrId('opportunities')
    const ruleExpression =
      "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"

    oppsCol.listRule = ruleExpression
    oppsCol.viewRule = ruleExpression
    oppsCol.createRule = '' // Aberto para permitir captação pelo formulário público ou vendedores autenticados
    oppsCol.updateRule = ruleExpression
    oppsCol.deleteRule = ruleExpression
    app.save(oppsCol)

    // 5. Atualizar as regras de acesso da coleção 'users' para permitir que admin liste a equipe
    // e os sellers vejam uns aos outros (ou seu próprio perfil)
    usersCol.listRule = "@request.auth.id != ''"
    usersCol.viewRule = "@request.auth.id != ''"
    app.save(usersCol)
  },
  (app) => {
    // Reverter regras se necessário
    try {
      const oppsCol = app.findCollectionByNameOrId('opportunities')
      oppsCol.listRule =
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')"
      oppsCol.viewRule =
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')"
      oppsCol.updateRule =
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')"
      oppsCol.deleteRule =
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.email = 'leandro.bertanha@gmail.com')"
      app.save(oppsCol)
    } catch (_) {}
  },
)
