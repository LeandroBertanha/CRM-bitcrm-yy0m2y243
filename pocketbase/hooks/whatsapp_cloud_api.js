/**
 * Hook para WhatsApp Cloud API da Meta (Fase 2).
 *
 * Rotas:
 * 1. GET /backend/v1/whatsapp/status
 *    - Verifica se os secrets WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID existem no ambiente via $os.getenv.
 *    - Retorna { configured: boolean, phoneNumberIdMasked: string | null, graphApiVersion: string, settings: { ... } }
 *
 * 2. POST /backend/v1/whatsapp/batch-send
 *    - Envia em lote as mensagens personalizadas usando a Meta Cloud API.
 *    - Lê token e phone_number_id dos secrets via $os.getenv.
 *    - Se não configurado, retorna 400 com "integração não configurada".
 *    - Valida permissões (escopo por usuário: vendedor só dispara para sua carteira, admin só para sua carteira).
 *    - Realiza throttling entre requisições para respeitar limites da Meta.
 *    - Registra timeline (opportunity_notes), sessão em approach_sessions, move Novo -> Qualificado no modo initial.
 *    - Retorna resumo com { sentCount, failedCount, results: [...] }.
 */

routerAdd(
  'GET',
  '/backend/v1/whatsapp/status',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Não autenticado.' })
    }

    const token = ($os.getenv('WHATSAPP_TOKEN') || '').trim()
    const phoneNumberId = ($os.getenv('WHATSAPP_PHONE_NUMBER_ID') || '').trim()

    const configured = Boolean(token && phoneNumberId)
    const configuredGraphApiVersion = ($os.getenv('WHATSAPP_GRAPH_API_VERSION') || '').trim()
    const graphApiVersion = /^v\d+\.\d+$/.test(configuredGraphApiVersion)
      ? configuredGraphApiVersion
      : 'v26.0'
    let phoneNumberIdMasked = null
    if (phoneNumberId) {
      const len = phoneNumberId.length
      phoneNumberIdMasked =
        len > 4 ? phoneNumberId.slice(0, 2) + '••••' + phoneNumberId.slice(-2) : '••••'
    }

    // Carrega configurações do banco (whatsapp_settings)
    let settings = null
    try {
      const records = $app.findRecordsByFilter(
        'whatsapp_settings',
        'is_active = true',
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        const s = records[0]
        settings = {
          id: s.id,
          initialTemplateName: s.getString('initial_template_name'),
          initialTemplateLanguage: s.getString('initial_template_language') || 'pt_BR',
          followupTemplateName: s.getString('followup_template_name'),
          followupTemplateLanguage: s.getString('followup_template_language') || 'pt_BR',
          throttleMs: s.getInt('throttle_ms') || 1000,
          maxBatchSize: s.getInt('max_batch_size') || 50,
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar whatsapp_settings:', err)
    }

    return e.json(200, {
      configured,
      phoneNumberIdMasked,
      graphApiVersion,
      settings: settings || {
        initialTemplateName: 'bit_abordagem_inicial',
        initialTemplateLanguage: 'pt_BR',
        followupTemplateName: 'bit_followup_comercial',
        followupTemplateLanguage: 'pt_BR',
        throttleMs: 1000,
        maxBatchSize: 50,
      },
    })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/whatsapp/batch-send',
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

    const token = ($os.getenv('WHATSAPP_TOKEN') || '').trim()
    const phoneNumberId = ($os.getenv('WHATSAPP_PHONE_NUMBER_ID') || '').trim()
    const configuredGraphApiVersion = ($os.getenv('WHATSAPP_GRAPH_API_VERSION') || '').trim()
    const graphApiVersion = /^v\d+\.\d+$/.test(configuredGraphApiVersion)
      ? configuredGraphApiVersion
      : 'v26.0'

    if (!token || !phoneNumberId) {
      return e.json(400, {
        error:
          'Integração com WhatsApp Cloud API não configurada. Defina as credenciais nos segredos do sistema.',
        code: 'WHATSAPP_NOT_CONFIGURED',
      })
    }

    let body = {}
    try {
      body = e.requestInfo().body
      if (typeof body === 'string') {
        body = JSON.parse(body)
      }
    } catch (_) {
      return e.json(400, { error: 'Corpo da requisição inválido.' })
    }

    const actionType = body.actionType === 'followup' ? 'followup' : 'initial'
    const requestedTemplateName = (body.templateName || '').trim()
    const requestedLanguage = (body.templateLanguage || 'pt_BR').trim()
    const opportunityIds = Array.isArray(body.opportunityIds) ? body.opportunityIds : []

    if (opportunityIds.length === 0) {
      return e.json(400, { error: 'Nenhuma oportunidade fornecida para envio.' })
    }

    // Carrega configurações de throttling do banco
    let throttleMs = 1000
    let maxBatchSize = 50
    let dbInitialTemplate = ''
    let dbFollowupTemplate = ''
    try {
      const records = $app.findRecordsByFilter(
        'whatsapp_settings',
        'is_active = true',
        '-created',
        1,
        0,
      )
      if (records && records.length > 0) {
        const s = records[0]
        throttleMs = s.getInt('throttle_ms') || 1000
        maxBatchSize = s.getInt('max_batch_size') || 50
        dbInitialTemplate = s.getString('initial_template_name')
        dbFollowupTemplate = s.getString('followup_template_name')
      }
    } catch (_) {}

    if (opportunityIds.length > maxBatchSize) {
      return e.json(400, {
        error: 'Limite de oportunidades por lote excedido. Máximo permitido: ' + maxBatchSize,
      })
    }

    const effectiveTemplateName =
      requestedTemplateName || (actionType === 'initial' ? dbInitialTemplate : dbFollowupTemplate)

    if (!effectiveTemplateName) {
      return e.json(400, {
        error:
          actionType === 'initial'
            ? 'Abordagem Inicial exige template aprovado pela Meta configurado.'
            : 'Follow-up exige template aprovado pela Meta enquanto não houver confirmação de mensagem recebida pelo webhook.',
        code: 'TEMPLATE_REQUIRED',
      })
    }

    const sellerName = user.getString('name') || user.getString('email') || 'Consultor Comercial'
    const results = []
    let sentCount = 0
    let failedCount = 0

    const cleanPhoneDigits = (phone) => {
      if (!phone) return ''
      let digits = String(phone).replace(/\D/g, '').replace(/^0+/, '')
      if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
        return digits
      }
      if (digits.length === 10 || digits.length === 11) {
        return '55' + digits
      }
      return digits
    }

    const generateShortRef = (company, oppId) => {
      const comp = (company || '').trim()
      const words = comp
        .replace(/[^a-zA-Z0-9À-ÿ\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
      let initials = 'BIT'
      if (words.length === 1) {
        initials = words[0].slice(0, 3).toUpperCase()
      } else if (words.length > 1) {
        initials = words
          .slice(0, 3)
          .map((w) => w[0].toUpperCase())
          .join('')
      }
      const suffix = oppId ? oppId.slice(-4) : '0000'
      return initials + '-' + suffix
    }

    for (let i = 0; i < opportunityIds.length; i++) {
      const oppId = opportunityIds[i]
      let oppRecord = null
      try {
        oppRecord = $app.findRecordById('opportunities', oppId)
      } catch (_) {
        results.push({
          opportunityId: oppId,
          company: 'Desconhecida',
          status: 'failed',
          reason: 'Oportunidade não encontrada.',
        })
        failedCount++
        continue
      }

      // Validação de escopo: vendedor só envia para sua carteira; admin também apenas para sua carteira
      const oppSellerId = oppRecord.getString('seller')
      if (oppSellerId && oppSellerId !== userId) {
        results.push({
          opportunityId: oppId,
          company: oppRecord.getString('company'),
          status: 'failed',
          reason: 'Oportunidade fora do escopo da sua carteira comercial.',
        })
        failedCount++
        continue
      }

      const company = oppRecord.getString('company') || 'Empresa'
      const contactName = oppRecord.getString('contact_name') || 'Responsável'
      const city = oppRecord.getString('city') || 'sua região'
      const rawPhone = oppRecord.getString('contact_phone')
      const phoneDigits = cleanPhoneDigits(rawPhone)

      if (!phoneDigits || phoneDigits.length < 10) {
        results.push({
          opportunityId: oppId,
          company,
          status: 'failed',
          reason: 'Número de telefone inválido ou ausente.',
        })
        failedCount++
        continue
      }

      const shortRef = generateShortRef(company, oppId)

      // Monta payload para Meta WhatsApp Cloud API
      // Até o webhook registrar mensagens recebidas com data verificável, todos os
      // disparos usam template aprovado. Anotações manuais e ligações não comprovam a
      // janela de atendimento de 24 horas exigida pelo WhatsApp.
      const metaPayload = {
        messaging_product: 'whatsapp',
        to: phoneDigits,
        type: 'template',
        template: {
          name: effectiveTemplateName,
          language: { code: requestedLanguage },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: contactName },
                { type: 'text', text: company },
                { type: 'text', text: city },
                { type: 'text', text: sellerName },
                { type: 'text', text: shortRef },
              ],
            },
          ],
        },
      }
      const messageSummaryForTimeline =
        'Template Meta: ' +
        effectiveTemplateName +
        ' (' +
        requestedLanguage +
        ')\nParâmetros: contato=' +
        contactName +
        ', empresa=' +
        company +
        ', cidade=' +
        city +
        ', vendedor=' +
        sellerName +
        ', ref=' +
        shortRef

      // Chamada HTTP à Meta Cloud API
      const metaUrl =
        'https://graph.facebook.com/' + graphApiVersion + '/' + phoneNumberId + '/messages'

      let sendSuccess = false
      let metaErrorMsg = ''
      let metaMessageId = ''

      try {
        const res = $http.send({
          url: metaUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
          },
          body: JSON.stringify(metaPayload),
          timeout: 15,
        })

        if (res.statusCode >= 200 && res.statusCode < 300) {
          sendSuccess = true
          try {
            const data = JSON.parse(res.rawText)
            metaMessageId = (data.messages && data.messages[0] && data.messages[0].id) || ''
          } catch (_) {}
        } else {
          try {
            const data = JSON.parse(res.rawText)
            metaErrorMsg =
              (data.error && (data.error.message || data.error.error_user_msg)) ||
              'HTTP ' + res.statusCode
          } catch (_) {
            metaErrorMsg = 'HTTP ' + res.statusCode + ': ' + res.rawText
          }
        }
      } catch (httpErr) {
        metaErrorMsg = 'Erro de conexão com Meta: ' + httpErr.message
      }

      if (!sendSuccess) {
        results.push({
          opportunityId: oppId,
          company,
          status: 'failed',
          reason: metaErrorMsg || 'Falha desconhecida na Meta Cloud API',
        })
        failedCount++
        continue
      }

      // Sucesso no envio: registra timeline, sessão em approach_sessions e avanço de estágio
      try {
        const notesCol = $app.findCollectionByNameOrId('opportunity_notes')
        const titleLabel =
          actionType === 'initial'
            ? 'Mensagem inicial via WhatsApp — enviada automática'
            : 'Follow-up via WhatsApp — enviada automática'

        const fullNoteText =
          '[' +
          titleLabel +
          '] para ' +
          rawPhone +
          (metaMessageId ? ' (ID Meta: ' + metaMessageId + ')' : '') +
          ':\n\n' +
          messageSummaryForTimeline

        const noteRec = new Record(notesCol)
        noteRec.set('opportunity', oppId)
        noteRec.set('author', userId)
        noteRec.set('type', 'whatsapp')
        noteRec.set('text', fullNoteText)
        noteRec.set('date', new Date().toISOString())
        $app.save(noteRec)

        // Registra sessão no Histórico de Abordagens
        try {
          const sessionsCol = $app.findCollectionByNameOrId('approach_sessions')
          const sessionRec = new Record(sessionsCol)
          sessionRec.set('seller', userId)
          sessionRec.set('opportunity', oppId)
          sessionRec.set('company_name', company)
          sessionRec.set('contact_name', contactName)
          sessionRec.set('contact_phone', rawPhone)
          sessionRec.set('city', city)
          sessionRec.set('channel', 'WhatsApp')
          sessionRec.set('status', 'Contato realizado')
          sessionRec.set('temperature', 'morno')
          sessionRec.set('temperature_reason', titleLabel)
          sessionRec.set('notes', '[WhatsApp Cloud API - Disparo Automático]\n' + fullNoteText)
          sessionRec.set('questions_asked', JSON.stringify([]))
          sessionRec.set('answers', JSON.stringify([]))
          sessionRec.set('objections', JSON.stringify([]))
          sessionRec.set(
            'quick_tags',
            JSON.stringify([
              'WhatsApp Automático',
              actionType === 'initial' ? 'Inicial' : 'Followup',
            ]),
          )
          $app.save(sessionRec)
        } catch (sessErr) {
          console.warn('Erro ao criar approach_session no disparo automático:', sessErr)
        }

        // Se Abordagem Inicial: avança Novo -> Qualificado (sem retroceder)
        if (actionType === 'initial') {
          const currentStage = oppRecord.getString('stage')
          if (currentStage === 'Novo') {
            oppRecord.set('stage', 'Qualificado')
            $app.save(oppRecord)

            // Nota de mudança de estágio
            const stageNoteRec = new Record(notesCol)
            stageNoteRec.set('opportunity', oppId)
            stageNoteRec.set('author', userId)
            stageNoteRec.set('type', 'outro')
            stageNoteRec.set(
              'text',
              '[Mudança de estágio] Estágio alterado automaticamente de "Novo" para "Qualificado" após disparo automático via WhatsApp Cloud API.',
            )
            stageNoteRec.set('date', new Date().toISOString())
            $app.save(stageNoteRec)
          }
        }

        sentCount++
        results.push({
          opportunityId: oppId,
          company,
          status: 'sent',
          messageId: metaMessageId,
        })
      } catch (postSaveErr) {
        console.error('Erro ao registrar pós-envio:', postSaveErr)
        sentCount++
        results.push({
          opportunityId: oppId,
          company,
          status: 'sent',
          warning:
            'Enviado ao WhatsApp, mas falhou ao gravar histórico local: ' + postSaveErr.message,
        })
      }

      // Throttling entre envios consecutivos se houver próximo item
      if (i < opportunityIds.length - 1 && throttleMs > 0) {
        // Em Goja/PocketBase, usamos espera busy loop ou pausa curta
        const startWait = Date.now()
        while (Date.now() - startWait < Math.min(throttleMs, 3000)) {
          // pausa de throttle
        }
      }
    }

    return e.json(200, {
      total: opportunityIds.length,
      sentCount,
      failedCount,
      results,
    })
  },
  $apis.requireAuth(),
)
