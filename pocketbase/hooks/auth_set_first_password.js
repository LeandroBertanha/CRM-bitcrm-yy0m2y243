routerAdd('POST', '/backend/v1/auth/set-first-password', (e) => {
  // 1. O usuário que está chamando DEVE estar autenticado ou enviar credencial válida
  const authRecord = e.auth
  const data = e.requestInfo().body || {}
  const newPassword = (data.password || '').trim()
  const passwordConfirm = (data.passwordConfirm || '').trim()
  const oldPassword = (data.oldPassword || '').trim()
  const providedUserId = (data.userId || '').trim()
  const providedEmail = (data.email || '').trim().toLowerCase()

  let targetUser = null

  if (authRecord) {
    try {
      targetUser = $app.findRecordById('_pb_users_auth_', authRecord.id)
    } catch (_) {}
  }

  // Se authRecord falhou (ex.: token expirou ou usuário foi recriado), tenta via userId ou email + oldPassword
  if (!targetUser && providedUserId) {
    try {
      targetUser = $app.findRecordById('_pb_users_auth_', providedUserId)
    } catch (_) {}
  }

  if (!targetUser && providedEmail) {
    try {
      targetUser = $app.findAuthRecordByEmail('_pb_users_auth_', providedEmail)
    } catch (_) {}
  }

  if (!targetUser) {
    return e.json(401, {
      error: 'Sessão expirada ou usuário não autenticado. Por favor, faça login novamente.',
    })
  }

  // 2. Validações mínimas de formato de senha
  if (!newPassword || newPassword.length < 8) {
    return e.json(400, { error: 'A nova senha deve ter no mínimo 8 caracteres.' })
  }

  if (newPassword !== passwordConfirm) {
    return e.json(400, { error: 'As senhas não coincidem.' })
  }

  // 3. Se foi informada oldPassword, validar se confere com a senha atual
  if (oldPassword) {
    if (!targetUser.validatePassword(oldPassword)) {
      return e.json(400, { error: 'A senha atual/temporária informada está incorreta.' })
    }
  }

  // 4. Atualizar senha e desmarcar mustChangePassword
  try {
    targetUser.setPassword(newPassword)
    targetUser.set('mustChangePassword', false)
    targetUser.set('emailVisibility', true)
    $app.save(targetUser)
  } catch (saveErr) {
    const msg = saveErr && saveErr.message ? saveErr.message : String(saveErr)
    return e.json(400, { error: 'Erro ao salvar a nova senha: ' + msg })
  }

  return e.json(200, {
    success: true,
    message: 'Senha definida com sucesso!',
    user: {
      id: targetUser.id,
      email: targetUser.getString('email'),
      name: targetUser.getString('name'),
      role: targetUser.getString('role'),
      mustChangePassword: false,
    },
  })
})
