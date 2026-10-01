migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('mustChangePassword')) {
      usersCol.fields.add(
        new BoolField({
          name: 'mustChangePassword',
          required: false,
        }),
      )
      app.save(usersCol)
    }

    // Garantir que o admin principal não tenha mustChangePassword ativo
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
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const field = usersCol.fields.getByName('mustChangePassword')
      if (field) {
        usersCol.fields.removeByName('mustChangePassword')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
