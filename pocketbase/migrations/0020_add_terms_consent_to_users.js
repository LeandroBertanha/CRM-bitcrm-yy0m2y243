migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!usersCol.fields.getByName('terms_accepted_version')) {
      usersCol.fields.add(
        new TextField({
          name: 'terms_accepted_version',
          required: false,
        }),
      )
    }

    if (!usersCol.fields.getByName('terms_accepted_at')) {
      usersCol.fields.add(
        new DateField({
          name: 'terms_accepted_at',
          required: false,
        }),
      )
    }

    app.save(usersCol)
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      if (usersCol.fields.getByName('terms_accepted_version')) {
        usersCol.fields.removeByName('terms_accepted_version')
      }
      if (usersCol.fields.getByName('terms_accepted_at')) {
        usersCol.fields.removeByName('terms_accepted_at')
      }
      app.save(usersCol)
    } catch (_) {}
  },
)
