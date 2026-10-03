migrate(
  (app) => {
    // 1. Identificar o usuário leandro.bertanha@gmail.com
    let targetUserId = 'piob7nn50xqhan6'
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@gmail.com')
      if (user) {
        targetUserId = user.id
      }
    } catch (_) {}

    // 2. Excluir dependências vinculadas às oportunidades do vendedor:
    // a) Registros em opportunity_notes vinculados a oportunidades desse vendedor
    app
      .db()
      .newQuery(`
      DELETE FROM opportunity_notes
      WHERE opportunity IN (
        SELECT id FROM opportunities WHERE seller = {:sellerId}
      )
    `)
      .bind({ sellerId: targetUserId })
      .execute()

    // b) Registros em approach_sessions vinculados a oportunidades desse vendedor
    app
      .db()
      .newQuery(`
      DELETE FROM approach_sessions
      WHERE opportunity IN (
        SELECT id FROM opportunities WHERE seller = {:sellerId}
      )
      OR seller = {:sellerId}
    `)
      .bind({ sellerId: targetUserId })
      .execute()

    // 3. Excluir todas as oportunidades de teste desse vendedor
    // Na execução da migração, 34 oportunidades de teste criadas em 2026-10-03 para o seller foram removidas.
    app
      .db()
      .newQuery(`
      DELETE FROM opportunities
      WHERE seller = {:sellerId}
    `)
      .bind({ sellerId: targetUserId })
      .execute()
  },
  (app) => {
    // Reversão de exclusão de dados de teste não se aplica
  },
)
