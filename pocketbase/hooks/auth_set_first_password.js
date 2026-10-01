routerAdd(
  'POST',
  '/backend/v1/auth/set-first-password',
  (e) => {
    // 1. O usuário que está chamando DEVE estar autenticado
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Autenticação necessária.' })
    }

    const data = e.requestInfo().body || {}
    const newPassword = (data.password || '').trim()
    const passwordConfirm = (data.passwordConfirm || '').trim()
    const oldPassword = (data.oldPassword || '').trim()

    // 2. Validações mínimas
    if (!newPassword || newPassword.length < 8) {
      return e.json(400, { error: 'A nova senha deve ter no mínimo 8 caracteres.' })
    }

    if (newPassword !== passwordConfirm) {
      return e.json(400, { error: 'As senhas não coincidem.' })
    }

    // 3. Obter registro atualizado do usuário
    let targetUser = null
    try {
      targetUser = $app.findRecordById('_pb_users_auth_', authRecord.id)
    } catch (_) {
      return e.json(404, { error: 'Usuário não encontrado.' })
    }

    // 4. Se foi informada oldPassword, validar se bate com a senha atual
    if (oldPassword) {
      if (!targetUser.validatePassword(oldPassword)) {
        return e.json(400, { error: 'A senha atual/temporária informada está incorreta.' })
      }
    }

    // 5. Atualizar senha e desmarcar mustChangePassword
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
  },
  $apis.requireAuth(),
)
