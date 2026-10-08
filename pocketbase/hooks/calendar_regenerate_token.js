routerAdd(
  'POST',
  '/backend/v1/calendar/regenerate-token',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autenticado.' })
    }

    const userId = authRecord.id
    const user = $app.findRecordById('users', userId)
    if (!user) {
      return e.json(404, { error: 'Usuário não encontrado.' })
    }

    const newToken = $security.randomString(32)
    user.set('calendar_token', newToken)
    $app.save(user)

    return e.json(200, {
      success: true,
      calendar_token: newToken,
    })
  },
  $apis.requireAuth(),
)
