cronAdd(
  'daily_returns_morning_alert',
  $os.getenv('CRON_DAILY_RETURNS_SCHEDULE') || '30 10 * * *',
  () => {
    // 10:30 UTC = 07:30 Horário de Brasília (UTC-3)
    // Horário configurável via CRON_DAILY_RETURNS_SCHEDULE (padrão '30 10 * * *')

    const now = new Date()
    // Calcula o início e fim do dia corrente no fuso de Brasília (UTC-3)
    const brOffsetMs = -3 * 60 * 60 * 1000
    const brNow = new Date(now.getTime() + brOffsetMs)
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const yyyy = brNow.getUTCFullYear()
    const mm = pad(brNow.getUTCMonth() + 1)
    const dd = pad(brNow.getUTCDate())

    // Intervalo do dia de hoje em UTC:
    // 00:00:00 Brasília = 03:00:00 UTC
    // 23:59:59 Brasília = (dia seguinte) 02:59:59 UTC
    const todayStartUtc = new Date(Date.UTC(yyyy, brNow.getUTCMonth(), brNow.getUTCDate(), 3, 0, 0))
    const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1)

    const todayStartIso = todayStartUtc.toISOString().replace('T', ' ')
    const todayEndIso = todayEndUtc.toISOString().replace('T', ' ')

    // Formatação de data/hora no fuso BR
    const formatBrDateTime = (isoStr) => {
      if (!isoStr) return ''
      const d = new Date(isoStr)
      const local = new Date(d.getTime() + brOffsetMs)
      const day = pad(local.getUTCDate())
      const month = pad(local.getUTCMonth() + 1)
      const year = local.getUTCFullYear()
      const hours = pad(local.getUTCHours())
      const minutes = pad(local.getUTCMinutes())
      return `${day}/${month}/${year} às ${hours}:${minutes}`
    }

    const formatBrTime = (isoStr) => {
      if (!isoStr) return ''
      const d = new Date(isoStr)
      const local = new Date(d.getTime() + brOffsetMs)
      const hours = pad(local.getUTCHours())
      const minutes = pad(local.getUTCMinutes())
      return `${hours}:${minutes}`
    }

    const cleanPhone = (phone) => {
      if (!phone) return ''
      return String(phone).replace(/\D/g, '')
    }

    // Busca todos os usuários ativos
    let users = []
    try {
      users = $app.findRecordsByFilter('users', 'disabled != true', '', 1000, 0)
    } catch (err) {
      console.error('[daily_returns_cron] Erro ao buscar usuários:', err)
      return
    }

    // Busca todas as oportunidades ativas com return_at preenchido
    let allReturnOpps = []
    try {
      allReturnOpps = $app.findRecordsByFilter(
        'opportunities',
        "return_at != '' && stage != 'Ganho' && stage != 'Perdido'",
        'return_at',
        1000,
        0,
      )
    } catch (err) {
      console.error('[daily_returns_cron] Erro ao buscar oportunidades de retorno:', err)
      return
    }

    // Mapeia vendedor id -> dados para exibição do nome do vendedor no resumo admin
    const sellerNamesMap = {}
    for (let uIdx = 0; uIdx < users.length; uIdx++) {
      const u = users[uIdx]
      sellerNamesMap[u.id] = u.getString('name') || u.getString('email')
    }

    const appSettings = $app.settings()
    const senderEmail = appSettings.meta.senderAddress || 'contato@lbertanha.com'
    const senderName = appSettings.meta.senderName || 'bit Consulting CRM'

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      const alertEmail = (user.getString('alert_email') || user.getString('email') || '').trim()
      // Se e-mail estiver em branco, pula silenciosamente sem erro
      if (!alertEmail || !alertEmail.includes('@')) {
        continue
      }

      const userId = user.id
      const userName = user.getString('name') || user.getString('email')
      const userRole = user.getString('role') || 'seller'
      const userEmail = (user.getString('email') || '').toLowerCase()
      const isAdmin = userRole === 'admin' || userEmail === 'leandro.bertanha@lbertanha.com'

      // Filtra oportunidades para este usuário
      // Atrasados: return_at < todayStartIso
      // De hoje: return_at >= todayStartIso && return_at <= todayEndIso
      const overdueOpps = []
      const todayOpps = []

      // No caso do admin, retornos de outros vendedores para resumo consolidado
      const teamOverdueOpps = []
      const teamTodayOpps = []

      for (let oIdx = 0; oIdx < allReturnOpps.length; oIdx++) {
        const opp = allReturnOpps[oIdx]
        const returnAt = opp.getString('return_at')
        if (!returnAt) continue

        const oppSellerId = opp.getString('seller')
        const isMine = oppSellerId === userId

        if (isMine) {
          if (returnAt < todayStartIso) {
            overdueOpps.push(opp)
          } else if (returnAt <= todayEndIso) {
            todayOpps.push(opp)
          }
        } else if (isAdmin) {
          if (returnAt < todayStartIso) {
            teamOverdueOpps.push(opp)
          } else if (returnAt <= todayEndIso) {
            teamTodayOpps.push(opp)
          }
        }
      }

      const totalOwnReturns = overdueOpps.length + todayOpps.length
      const totalTeamReturns = teamOverdueOpps.length + teamTodayOpps.length

      // Regra: Não enviar e-mail se o vendedor não tiver retornos (nem atrasados nem do dia)
      // Se for admin, envia se tiver retornos próprios OU retornos da equipe
      if (!isAdmin && totalOwnReturns === 0) {
        continue
      }
      if (isAdmin && totalOwnReturns === 0 && totalTeamReturns === 0) {
        continue
      }

      // Monta o template dark/indigo bit Consulting
      const renderOppRow = (opp, showSeller) => {
        const company = opp.getString('company') || 'Empresa'
        const contact = opp.getString('contact_name') || ''
        const phone = opp.getString('contact_phone') || ''
        const stage = opp.getString('stage') || 'Novo'
        const returnAt = opp.getString('return_at')
        const sellerId = opp.getString('seller')
        const sellerName = sellerNamesMap[sellerId] || 'Não atribuído'

        const rawDigits = cleanPhone(phone)
        let phoneHtml = '<span style="color: #9CA3AF;">Não informado</span>'
        if (phone) {
          const waLink =
            rawDigits.length >= 10
              ? `https://wa.me/55${rawDigits.startsWith('55') ? rawDigits.slice(2) : rawDigits}`
              : '#'
          phoneHtml = `<a href="${waLink}" target="_blank" style="color: #818CF8; text-decoration: none; font-weight: 500;">${phone} 📲</a>`
        }

        return `
        <div style="background: #12141A; border: 1px solid #262A33; border-radius: 8px; padding: 14px; margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <strong style="color: #FFFFFF; font-size: 15px;">${company}</strong>
            <span style="background: #1E1B4B; color: #A5B4FC; border: 1px solid #3730A3; font-size: 11px; padding: 2px 8px; border-radius: 12px; font-weight: 600;">${stage}</span>
          </div>
          <div style="font-size: 13px; color: #D1D5DB; line-height: 1.5;">
            ${contact ? `<div><strong>Contato:</strong> ${contact}</div>` : ''}
            <div><strong>Telefone:</strong> ${phoneHtml}</div>
            <div><strong>Horário agendado:</strong> <span style="color: #FCD34D;">${formatBrDateTime(returnAt)}</span></div>
            ${showSeller ? `<div style="color: #9CA3AF; font-size: 12px; margin-top: 4px;"><strong>Responsável:</strong> ${sellerName}</div>` : ''}
          </div>
        </div>
      `
      }

      let overdueHtml = ''
      if (overdueOpps.length > 0) {
        overdueHtml = `
        <div style="margin-top: 20px;">
          <h3 style="color: #F87171; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center;">
            ⚠️ Retornos Atrasados (${overdueOpps.length})
          </h3>
          ${overdueOpps.map((o) => renderOppRow(o, false)).join('')}
        </div>
      `
      }

      let todayHtml = ''
      if (todayOpps.length > 0) {
        todayHtml = `
        <div style="margin-top: 20px;">
          <h3 style="color: #FBBF24; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
            ⏰ Retornos de Hoje (${todayOpps.length})
          </h3>
          ${todayOpps.map((o) => renderOppRow(o, false)).join('')}
        </div>
      `
      }

      let teamHtml = ''
      if (isAdmin && (teamOverdueOpps.length > 0 || teamTodayOpps.length > 0)) {
        teamHtml = `
        <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #262A33;">
          <h3 style="color: #818CF8; font-size: 15px; margin-bottom: 6px;">
            👥 Resumo da Equipe (Visão Geral de Liderança)
          </h3>
          <p style="color: #9CA3AF; font-size: 12px; margin-bottom: 14px;">
            Acompanhe abaixo os retornos atrasados e programados dos vendedores da sua equipe.
          </p>
          ${
            teamOverdueOpps.length > 0
              ? `
            <div style="margin-bottom: 14px;">
              <div style="color: #FCA5A5; font-size: 12px; font-weight: bold; margin-bottom: 8px;">Atrasados da equipe (${teamOverdueOpps.length}):</div>
              ${teamOverdueOpps.map((o) => renderOppRow(o, true)).join('')}
            </div>
          `
              : ''
          }
          ${
            teamTodayOpps.length > 0
              ? `
            <div>
              <div style="color: #FDE68A; font-size: 12px; font-weight: bold; margin-bottom: 8px;">De hoje da equipe (${teamTodayOpps.length}):</div>
              ${teamTodayOpps.map((o) => renderOppRow(o, true)).join('')}
            </div>
          `
              : ''
          }
        </div>
      `
      }

      const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 24px 12px; background: #0A0B0E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F5F6F8;">
        <div style="max-width: 600px; margin: 0 auto; background: #12141A; border: 1px solid #262A33; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Topo Indigo -->
          <div style="background: linear-gradient(135deg, #4F46E5 0%, #3730A3 100%); padding: 24px; text-align: left;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #C7D2FE; font-weight: 700; margin-bottom: 4px;">bit Consulting • bitCRM</div>
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #FFFFFF;">Resumo Diário de Retornos Agendados</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #E0E7FF;">
              Bom dia, ${userName}! Aqui estão seus contatos prioritários para ${dd}/${mm}/${yyyy}.
            </p>
          </div>

          <!-- Conteúdo -->
          <div style="padding: 24px; background: #0E1017;">
            ${overdueHtml || todayHtml ? '' : '<p style="color: #9CA3AF; font-size: 13px;">Você não possui retornos pendentes na sua carteira individual hoje.</p>'}
            ${overdueHtml}
            ${todayHtml}
            ${teamHtml}

            <!-- Rodapé com botão de acesso -->
            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #262A33; text-align: center;">
              <a href="https://crm.lbertanha.com/painel" target="_blank" style="display: inline-block; background: #4F46E5; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px;">
                Acessar o Painel Comercial
              </a>
              <p style="color: #6B7280; font-size: 11px; margin-top: 16px;">
                Este é um alerta automático gerado pelo bitCRM. Configure suas preferências em Meu Perfil.
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `

      try {
        const mailer = $app.newMailClient()
        const subject = `[bitCRM] Seus Retornos de Hoje (${dd}/${mm}) — ${totalOwnReturns} pendente${totalOwnReturns === 1 ? '' : 's'}`

        const message = new MailerMessage({
          from: {
            address: senderEmail,
            name: senderName,
          },
          to: [{ address: alertEmail, name: userName }],
          subject: subject,
          html: htmlBody,
        })

        mailer.send(message)
      } catch (sendErr) {
        console.error(`[daily_returns_cron] Falha ao enviar para ${alertEmail}:`, sendErr)
      }
    }
  },
)
