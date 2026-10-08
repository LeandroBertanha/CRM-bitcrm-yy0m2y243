migrate(
  (app) => {
    // 1. Adicionar o campo booleano 'disabled' na coleção de usuários caso não exista
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('disabled')) {
      usersCol.fields.add(
        new BoolField({
          name: 'disabled',
          required: false,
        }),
      )
      app.save(usersCol)
    }

    // 2. DESATIVAR A CONTA DE TESTE 'Leandro Bertanha 2' (leandro.bertanha@gmail.com, id piob7nn50xqhan6)
    // NÃO apagar registro nem dados: apenas marcar disabled = true e invalidar tokenKey / alterar senha
    let testUser = null
    try {
      testUser = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@gmail.com')
    } catch (_) {
      try {
        testUser = app.findRecordById('_pb_users_auth_', 'piob7nn50xqhan6')
      } catch (_) {}
    }

    if (testUser) {
      testUser.set('disabled', true)
      // Definir uma senha aleatória / inutilizada para impedir login direto
      testUser.setPassword($security.randomString(32))
      app.save(testUser)
    }

    // Garantir via SQL que o campo disabled esteja setado como 1 para a conta de teste
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET disabled = 1 WHERE id = 'piob7nn50xqhan6' OR lower(email) = 'leandro.bertanha@gmail.com'",
        )
        .execute()
    } catch (_) {}

    // Garantir que todos os outros usuários tenham disabled = 0 se null
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET disabled = 0 WHERE id != 'piob7nn50xqhan6' AND lower(email) != 'leandro.bertanha@gmail.com' AND (disabled IS NULL OR disabled = '')",
        )
        .execute()
    } catch (_) {}

    // 3. RESTAURAR ACESSO DO ADMIN PRINCIPAL (leandro.bertanha@lbertanha.com, id 015c920nyv4tnwl)
    // Redefinir senha para a senha temporária forte conhecida: 'Bit@2026!Temp'
    let adminUser = null
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@lbertanha.com')
    } catch (_) {
      try {
        adminUser = app.findRecordById('_pb_users_auth_', '015c920nyv4tnwl')
      } catch (_) {}
    }

    if (adminUser) {
      adminUser.setPassword('Bit@2026!Temp')
      adminUser.setVerified(true)
      adminUser.set('role', 'admin')
      adminUser.set('name', 'Leandro Bertanha')
      adminUser.set('mustChangePassword', false)
      adminUser.set('emailVisibility', true)
      adminUser.set('disabled', false)
      app.save(adminUser)
    }

    // Garantir flags no SQLite direto para o admin principal
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET disabled = 0, mustChangePassword = 0, role = 'admin', verified = 1 WHERE lower(email) = 'leandro.bertanha@lbertanha.com' OR id = '015c920nyv4tnwl'",
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    // Rollback defensivo
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const field = usersCol.fields.getByName('disabled')
      if (field) {
        usersCol.fields.removeByName('disabled')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
