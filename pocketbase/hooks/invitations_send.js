routerAdd(
  'POST',
  '/backend/v1/invitations/send',
  (e) => {
    const data = e.requestInfo().body || {}
    const email = (data.email || '').trim().toLowerCase()
    const name = (data.name || '').trim()

    if (!email || !email.includes('@')) {
      return e.json(400, { error: 'E-mail inválido ou não informado.' })
    }

    const usersCollection = $app.findCollectionByNameOrId('_pb_users_auth_')

    let existingUser = null
    try {
      existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', email)
    } catch (_) {}

    if (existingUser) {
      return e.json(400, { error: 'Já existe um usuário cadastrado com este e-mail.' })
    }

    // Apenas administrador pode disparar este convite/criação
    const authRecord = e.auth
    const isAdmin =
      authRecord &&
      (authRecord.getString('role') === 'admin' ||
        authRecord.getString('email').toLowerCase() === 'leandro.bertanha@lbertanha.com')
    if (!isAdmin) {
      return e.json(403, { error: 'Apenas administradores podem cadastrar novos usuários.' })
    }

    const role = data.role === 'admin' ? 'admin' : 'seller'

    // Gera senha temporária de 10 caracteres
    const tempPassword = (data.password || '').trim() || 'Bit@' + $security.randomString(8)

    const newUser = new Record(usersCollection)
    newUser.setEmail(email)
    newUser.setPassword(tempPassword)
    newUser.setVerified(true)
    newUser.set('emailVisibility', true)
    newUser.set('name', name || email.split('@')[0])
    newUser.set('role', role)
    newUser.set('mustChangePassword', true)
    $app.save(newUser)

    // Tenta enviar e-mail transacional de convite
    try {
      const mailer = $app.newMailClient()
      const appName = 'bit Consulting CRM'
      const subject = 'Convite de Acesso - ' + appName
      const htmlBody = `
      <div style="font-family: sans-serif; background: #0A0B0E; color: #F5F6F8; padding: 32px; border-radius: 8px;">
        <h2 style="color: #6366F1; margin-top: 0;">Você foi convidado para o ${appName}</h2>
        <p>Olá, ${name || 'Vendedor'}!</p>
        <p>Sua conta no CRM de vendas foi criada com sucesso. Abaixo estão as suas credenciais temporárias de primeiro acesso:</p>
        <div style="background: #12141A; border: 1px solid #262A33; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 4px 0;"><strong>E-mail:</strong> ${email}</p>
          <p style="margin: 4px 0;"><strong>Senha temporária:</strong> <code style="color: #818CF8; font-size: 16px;">${tempPassword}</code></p>
        </div>
        <p style="color: #9CA3AF; font-size: 13px;">Recomendamos alterar sua senha após o primeiro acesso.</p>
      </div>
    `

      const message = new MailerMessage({
        from: {
          address: $app.settings().meta.senderAddress || 'contato@lbertanha.com',
          name: $app.settings().meta.senderName || appName,
        },
        to: [{ address: email, name: name }],
        subject: subject,
        html: htmlBody,
      })

      mailer.send(message)
    } catch (err) {
      // E-mail falhou mas o usuário foi criado, retornamos as credenciais para o admin exibir na UI
      return e.json(200, {
        success: true,
        emailSent: false,
        user: { id: newUser.id, email: email, name: newUser.get('name'), role: role },
        tempPassword: tempPassword,
        message: 'Usuário criado com sucesso. (Não foi possível enviar o e-mail automaticamente).',
      })
    }

    return e.json(200, {
      success: true,
      emailSent: true,
      user: { id: newUser.id, email: email, name: newUser.get('name'), role: role },
      tempPassword: tempPassword,
      message: 'Convite enviado com sucesso por e-mail.',
    })
  },
  $apis.requireAuth(),
)
