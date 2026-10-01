migrate(
  (app) => {
    // 1. Obter admin oficial
    let adminRecord = null
    try {
      adminRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@lbertanha.com')
    } catch (_) {}

    if (adminRecord) {
      // Garantir mustChangePassword falso e senha oficial
      adminRecord.setPassword('lbc26173$qTv3$')
      adminRecord.setVerified(true)
      adminRecord.set('role', 'admin')
      adminRecord.set('mustChangePassword', false)
      adminRecord.set('emailVisibility', true)
      app.save(adminRecord)
    }

    // 2. Transferir quaisquer registros vinculados a leandro.bertanha@gmail.com ou tfd9ud5e0m1wjbr
    let gmailUser = null
    try {
      gmailUser = app.findRecordById('_pb_users_auth_', 'tfd9ud5e0m1wjbr')
    } catch (_) {
      try {
        gmailUser = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@gmail.com')
      } catch (_) {}
    }

    if (gmailUser && (!adminRecord || gmailUser.id !== adminRecord.id)) {
      const adminId = adminRecord ? adminRecord.id : '015c920nyv4tnwl'

      // Transferir oportunidades
      try {
        app
          .db()
          .newQuery('UPDATE opportunities SET seller = {:adminId} WHERE seller = {:oldId}')
          .bind({ adminId: adminId, oldId: gmailUser.id })
          .execute()
      } catch (_) {}

      // Transferir notas de oportunidades
      try {
        app
          .db()
          .newQuery('UPDATE opportunity_notes SET author = {:adminId} WHERE author = {:oldId}')
          .bind({ adminId: adminId, oldId: gmailUser.id })
          .execute()
      } catch (_) {}

      // Excluir a conta residual
      try {
        app.delete(gmailUser)
      } catch (err) {
        console.log('Erro ao excluir conta residual:', err)
      }
    }

    // Limpeza defensiva direta no banco SQLite caso sobre algum registro com gmail
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM users WHERE lower(email) = 'leandro.bertanha@gmail.com' OR id = 'tfd9ud5e0m1wjbr'",
        )
        .execute()
    } catch (_) {}

    // Garantir que o admin oficial permaneça intacto
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
    // Reverter não recria conta residual excluída
  },
)
