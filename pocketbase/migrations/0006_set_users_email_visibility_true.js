migrate(
  (app) => {
    // 1. Atualizar todos os usuários existentes para emailVisibility = true
    try {
      app.db().newQuery('UPDATE users SET emailVisibility = true').execute()
    } catch (err) {
      // Fallback para 1 (SQLite boolean)
      app.db().newQuery('UPDATE users SET emailVisibility = 1').execute()
    }

    // Também garantir que para cada registro individual os campos do Record estejam atualizados
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const records = app.findRecordsByFilter('_pb_users_auth_', '', '-created', 0, 0)
      for (let i = 0; i < records.length; i++) {
        const record = records[i]
        record.set('emailVisibility', true)
        app.save(record)
      }
    } catch (_) {}
  },
  (app) => {
    // Reverter não é estritamente necessário ou pode voltar para false
    try {
      app.db().newQuery('UPDATE users SET emailVisibility = 0').execute()
    } catch (_) {}
  },
)
