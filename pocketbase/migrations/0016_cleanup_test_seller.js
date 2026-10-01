migrate(
  (app) => {
    // 1. Remover o usuário de teste de primeiro acesso para não poluir a base de produção
    try {
      const testUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'vendedor.teste.acesso@lbertanha.com',
      )
      if (testUser) {
        app.delete(testUser)
      }
    } catch (_) {}

    // 2. Garantir que o admin principal permaneça sempre com mustChangePassword = false
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'leandro.bertanha@lbertanha.com')
      if (admin) {
        admin.set('mustChangePassword', false)
        admin.set('role', 'admin')
        app.save(admin)
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter não precisa recriar
  },
)
