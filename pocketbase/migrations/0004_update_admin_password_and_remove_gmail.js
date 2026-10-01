migrate(
  (app) => {
    // 1. Localizar ou garantir o administrador oficial: leandro.bertanha@lbertanha.com
    let adminRecord = null
    try {
      adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@lbertanha.com')
    } catch (_) {}

    if (!adminRecord) {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      adminRecord = new Record(usersCol)
      adminRecord.setEmail('leandro.bertanha@lbertanha.com')
      adminRecord.setVerified(true)
      adminRecord.set('role', 'admin')
      adminRecord.set('name', 'Leandro Bertanha')
    }

    // Definir a nova senha do administrador
    adminRecord.setPassword('lbc26173$qTv3$')
    adminRecord.setVerified(true)
    adminRecord.set('role', 'admin')
    adminRecord.set('name', 'Leandro Bertanha')
    app.save(adminRecord)

    // 2. Verificar se o usuário antigo leandro.bertanha@gmail.com ainda existe
    let oldUser = null
    try {
      oldUser = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@gmail.com')
    } catch (_) {}

    if (oldUser && oldUser.id !== adminRecord.id) {
      // Reatribuir quaisquer oportunidades vinculadas ao antigo usuário para o admin atual
      try {
        app
          .db()
          .newQuery('UPDATE opportunities SET seller = {:newAdminId} WHERE seller = {:oldUserId}')
          .bind({
            newAdminId: adminRecord.id,
            oldUserId: oldUser.id,
          })
          .execute()
      } catch (_) {}

      // Excluir permanentemente o usuário antigo
      try {
        app.delete(oldUser)
      } catch (_) {}
    }

    // 3. Garantir integridade das regras de acesso da coleção 'opportunities'
    try {
      const oppsCol = app.findCollectionByNameOrId('opportunities')
      const ruleExpression =
        "@request.auth.id != '' && (seller = @request.auth.id || @request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"

      oppsCol.listRule = ruleExpression
      oppsCol.viewRule = ruleExpression
      oppsCol.createRule = ''
      oppsCol.updateRule = ruleExpression
      oppsCol.deleteRule = ruleExpression
      app.save(oppsCol)
    } catch (_) {}
  },
  (app) => {
    // Reverter caso necessário
    try {
      const adminRecord = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'leandro.bertanha@lbertanha.com',
      )
      if (adminRecord) {
        adminRecord.setPassword('Skip@Pass')
        app.save(adminRecord)
      }
    } catch (_) {}
  },
)
