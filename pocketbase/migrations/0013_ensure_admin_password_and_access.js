migrate(
  (app) => {
    // 1. Localizar o admin principal: leandro.bertanha@lbertanha.com
    let adminRecord = null
    try {
      adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@lbertanha.com')
    } catch (_) {}

    if (adminRecord) {
      // Garantir senha oficial do admin e flags de acesso
      adminRecord.setPassword('lbc26173$qTv3$')
      adminRecord.setVerified(true)
      adminRecord.set('role', 'admin')
      adminRecord.set('name', 'Leandro Bertanha')
      adminRecord.set('mustChangePassword', false)
      adminRecord.set('emailVisibility', true)
      app.save(adminRecord)
    }

    // 2. Se existir o registro antigo leandro.bertanha@gmail.com, alinhar a senha para evitar bloqueios
    try {
      const gmailUser = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@gmail.com')
      if (gmailUser) {
        gmailUser.setPassword('lbc26173$qTv3$')
        gmailUser.setVerified(true)
        gmailUser.set('emailVisibility', true)
        app.save(gmailUser)
      }
    } catch (_) {}

    // 3. Garantir no SQLite direto que mustChangePassword do admin principal seja 0/false
    try {
      app
        .db()
        .newQuery(
          "UPDATE users SET mustChangePassword = 0 WHERE lower(email) = 'leandro.bertanha@lbertanha.com'",
        )
        .execute()
    } catch (_) {}
  },
  (app) => {
    // Rollback não altera senhas por segurança
  },
)
