migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    let changed = false
    if (!usersCol.fields.getByName('calendar_token')) {
      usersCol.fields.add(
        new TextField({
          name: 'calendar_token',
          required: false,
        }),
      )
      changed = true
    }

    if (!usersCol.fields.getByName('alert_email')) {
      usersCol.fields.add(
        new EmailField({
          name: 'alert_email',
          required: false,
        }),
      )
      changed = true
    }

    if (changed) {
      app.save(usersCol)
    }

    // Preencher tokens para usuários existentes
    try {
      const allUsers = app.findRecordsByFilter('users', '', '', 1000, 0)
      for (let i = 0; i < allUsers.length; i++) {
        const u = allUsers[i]
        let saveUser = false
        if (!u.getString('calendar_token')) {
          u.set('calendar_token', $security.randomString(32))
          saveUser = true
        }
        const userEmail = u.getString('email') || ''
        if (!u.getString('alert_email') && userEmail) {
          u.set('alert_email', userEmail)
          saveUser = true
        }
        if (saveUser) {
          app.save(u)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      let changed = false
      if (usersCol.fields.getByName('calendar_token')) {
        usersCol.fields.removeByName('calendar_token')
        changed = true
      }
      if (usersCol.fields.getByName('alert_email')) {
        usersCol.fields.removeByName('alert_email')
        changed = true
      }
      if (changed) {
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
