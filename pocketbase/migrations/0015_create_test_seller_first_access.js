migrate(
  (app) => {
    // 1. Criar usuário de teste específico para validação de primeiro acesso
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const testEmail = 'vendedor.teste.acesso@lbertanha.com'

    let testUser = null
    try {
      testUser = app.findAuthRecordByEmail('_pb_users_auth_', testEmail)
    } catch (_) {}

    if (!testUser) {
      testUser = new Record(usersCol)
      testUser.setEmail(testEmail)
    }

    testUser.setPassword('1234mudar')
    testUser.setVerified(true)
    testUser.set('emailVisibility', true)
    testUser.set('name', 'Vendedor Teste Primeiro Acesso')
    testUser.set('role', 'seller')
    testUser.set('mustChangePassword', true)
    app.save(testUser)

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
    // Reverter excluindo o usuário de teste se existir
    try {
      const testUser = app.findAuthRecordByEmail(
        '_pb_users_auth_',
        'vendedor.teste.acesso@lbertanha.com',
      )
      if (testUser) {
        app.delete(testUser)
      }
    } catch (_) {}
  },
)
