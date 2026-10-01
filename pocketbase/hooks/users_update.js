routerAdd(
  'POST',
  '/backend/v1/users/update',
  (e) => {
    // 1. Checar autenticação e se quem está chamando é Admin
    const authRecord = e.auth
    const requesterEmail = authRecord ? authRecord.getString('email').toLowerCase() : ''
    const requesterRole = authRecord ? authRecord.getString('role') : ''
    const isAdmin =
      authRecord &&
      (requesterRole === 'admin' || requesterEmail === 'leandro.bertanha@lbertanha.com')

    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem editar usuários.' })
    }

    const data = e.requestInfo().body || {}
    const targetUserId = (data.userId || '').trim()
    const targetEmail = (data.email || '').trim().toLowerCase()
    const targetName = (data.name !== undefined ? String(data.name) : '').trim()
    const targetRole = data.role === 'admin' ? 'admin' : data.role === 'seller' ? 'seller' : null
    const targetPassword = data.password ? String(data.password).trim() : ''

    if (!targetUserId) {
      return e.json(400, { error: 'ID do usuário não fornecido.' })
    }

    // 2. Buscar o registro do usuário alvo
    let targetUser = null
    try {
      targetUser = $app.findRecordById('_pb_users_auth_', targetUserId)
    } catch (_) {
      return e.json(404, { error: 'Usuário não encontrado.' })
    }

    const currentTargetEmail = targetUser.getString('email').toLowerCase()
    const isMainAdminTarget = currentTargetEmail === 'leandro.bertanha@lbertanha.com'
    const isSelfTarget = authRecord.id === targetUser.id

    // 3. Regra de segurança: Não permitir que o admin principal seja rebaixado para vendedor
    if (isMainAdminTarget && targetRole && targetRole !== 'admin') {
      return e.json(400, {
        error:
          'O Administrador Principal (leandro.bertanha@lbertanha.com) não pode ter o papel alterado para vendedor.',
      })
    }

    // Regra de segurança: Não permitir auto-rebaixamento se for o único admin ativo ou admin atual
    if (isSelfTarget && targetRole && targetRole !== 'admin') {
      return e.json(400, {
        error: 'Você não pode rebaixar a sua própria conta para vendedor.',
      })
    }

    // 4. Validar e-mail se foi alterado
    if (targetEmail && targetEmail !== currentTargetEmail) {
      if (!targetEmail.includes('@') || targetEmail.length < 5) {
        return e.json(400, { error: 'Formato de e-mail inválido.' })
      }
      try {
        const existing = $app.findAuthRecordByEmail('_pb_users_auth_', targetEmail)
        if (existing && existing.id !== targetUser.id) {
          return e.json(400, { error: 'Já existe outro usuário cadastrado com este e-mail.' })
        }
      } catch (_) {
        // e-mail livre
      }

      // Proteger e-mail do admin principal
      if (isMainAdminTarget && targetEmail !== 'leandro.bertanha@lbertanha.com') {
        return e.json(400, {
          error: 'O e-mail do Administrador Principal não pode ser alterado.',
        })
      }

      targetUser.setEmail(targetEmail)
    }

    // 5. Atualizar nome se fornecido
    if (targetName) {
      targetUser.set('name', targetName)
    }

    // 6. Atualizar papel se fornecido
    if (targetRole) {
      targetUser.set('role', targetRole)
    }

    // 7. Redefinir senha se fornecida
    if (targetPassword) {
      if (targetPassword.length < 8) {
        return e.json(400, { error: 'A nova senha deve ter no mínimo 8 caracteres.' })
      }
      targetUser.setPassword(targetPassword)
    }

    // Garantir que emailVisibility permaneça sempre verdadeiro
    targetUser.set('emailVisibility', true)

    // 8. Salvar usuário
    try {
      $app.save(targetUser)
    } catch (saveErr) {
      const msg = saveErr && saveErr.message ? saveErr.message : String(saveErr)
      return e.json(400, { error: 'Erro ao salvar alterações do usuário: ' + msg })
    }

    return e.json(200, {
      success: true,
      user: {
        id: targetUser.id,
        email: targetUser.getString('email'),
        name: targetUser.getString('name'),
        role: targetUser.getString('role'),
        updated: targetUser.getString('updated'),
      },
      passwordUpdated: Boolean(targetPassword),
      message: 'Usuário atualizado com sucesso!',
    })
  },
  $apis.requireAuth(),
)
