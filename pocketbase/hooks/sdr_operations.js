/**
 * Operacoes administrativas do SDR.
 *
 * O hook usa uma unica rota parametrizada para manter todos os helpers no
 * escopo aceito pelo JSVM do PocketBase/Skip.
 */

routerAdd(
  'POST',
  '/backend/v1/sdr/{resource}/{action}',
  (e) => {
    function cleanText(value, maxLength) {
      return String(value || '')
        .trim()
        .slice(0, maxLength)
    }

    function normalizePhone(value) {
      var digits = String(value || '').replace(/\D/g, '')
      if (digits.indexOf('55') !== 0 && (digits.length === 10 || digits.length === 11)) {
        return '55' + digits
      }
      return digits
    }

    function normalizeEmail(value) {
      return cleanText(value, 200).toLowerCase()
    }

    function isAdmin(authRecord) {
      if (!authRecord) return false
      var email = authRecord.getString('email').toLowerCase()
      return (
        authRecord.getString('role') === 'admin' ||
        email === 'leandro.bertanha@lbertanha.com' ||
        email === 'leandro.bertanha@gmail.com'
      )
    }

    function getSettings(app) {
      var records = app.findRecordsByFilter('sdr_settings', "id != ''", '-created', 1, 0)
      return records.length ? records[0] : null
    }

    function settingsPayload(record) {
      return {
        id: record.id,
        enabled: record.getBool('enabled'),
        allow_existing_opportunity_update: record.getBool('allow_existing_opportunity_update'),
        allow_opportunity_creation: record.getBool('allow_opportunity_creation'),
        require_human_confirmation: record.getBool('require_human_confirmation'),
        environment: record.getString('environment'),
        notes: record.getString('notes'),
        created: record.getString('created'),
        updated: record.getString('updated'),
      }
    }

    function writeAudit(app, data) {
      var record = new Record(app.findCollectionByNameOrId('sdr_audit_logs'))
      if (data.campaignId) record.set('campaign', data.campaignId)
      record.set('actor_user', data.actorUserId)
      record.set('actor_type', 'user')
      record.set('agent_name', 'SDR Inteligente')
      record.set('operation', data.operation)
      record.set('target_collection', data.targetCollection)
      record.set('target_record_id', data.targetRecordId || '')
      record.set('result', data.result || 'success')
      record.set('metadata', data.metadata || {})
      record.set('previous_value', data.previousValue || {})
      record.set('new_value', data.newValue || {})
      record.set('error_message', data.errorMessage || '')
      record.set('correlation_id', data.correlationId)
      record.set('event_at', new Date().toISOString())
      app.save(record)
      return record
    }

    function apiError(status, code, message, extra) {
      var payload = { success: false, code: code, error: message }
      if (extra) {
        var keys = Object.keys(extra)
        for (var index = 0; index < keys.length; index += 1) {
          payload[keys[index]] = extra[keys[index]]
        }
      }
      return e.json(status, payload)
    }

    var authRecord = e.auth
    if (!isAdmin(authRecord)) {
      return apiError(
        authRecord ? 403 : 401,
        authRecord ? 'ADMIN_REQUIRED' : 'UNAUTHENTICATED',
        authRecord ? 'Somente administradores podem configurar o SDR.' : 'Nao autenticado.',
      )
    }

    var resource = cleanText(e.request.pathValue('resource'), 40)
    var action = cleanText(e.request.pathValue('action'), 40)
    var body = e.requestInfo().body || {}

    if (resource === 'settings' && action === 'update') {
      var enabled = body.enabled === true
      var environment = body.environment === 'producao' ? 'producao' : 'homologacao'
      var confirmationPhrase = cleanText(body.confirmationPhrase, 80).toUpperCase()

      if (
        enabled &&
        environment === 'producao' &&
        confirmationPhrase !== 'ATIVAR SDR EM PRODUCAO'
      ) {
        return apiError(
          400,
          'PRODUCTION_CONFIRMATION_REQUIRED',
          'Confirme a ativacao do SDR em producao.',
        )
      }

      var settings = null
      try {
        settings = getSettings($app)
      } catch (_) {
        return apiError(
          409,
          'SDR_FOUNDATION_UNAVAILABLE',
          'A estrutura do SDR ainda nao foi aplicada.',
        )
      }
      if (!settings) {
        return apiError(409, 'SDR_SETTINGS_MISSING', 'Configuracao do SDR nao encontrada.')
      }

      var previousValue = settingsPayload(settings)
      try {
        $app.runInTransaction((txApp) => {
          var txSettings = txApp.findRecordById('sdr_settings', settings.id)
          txSettings.set('enabled', enabled)
          txSettings.set('allow_existing_opportunity_update', false)
          txSettings.set('allow_opportunity_creation', false)
          txSettings.set('require_human_confirmation', true)
          txSettings.set('environment', environment)
          txSettings.set(
            'notes',
            enabled
              ? 'SDR ativo em producao para vincular oportunidades abertas a filas auditaveis.'
              : 'SDR desativado pelo administrador.',
          )
          txApp.save(txSettings)

          writeAudit(txApp, {
            actorUserId: authRecord.id,
            operation: enabled ? 'sdr_settings_activate' : 'sdr_settings_deactivate',
            targetCollection: 'sdr_settings',
            targetRecordId: txSettings.id,
            correlationId: 'sdr-settings-' + String(Date.now()).slice(-8),
            previousValue: previousValue,
            newValue: settingsPayload(txSettings),
            metadata: { environment: environment, opportunitySource: 'crm' },
          })
          settings = txSettings
        })
      } catch (error) {
        console.error('Falha ao atualizar configuracao SDR:', error)
        return apiError(
          500,
          'SDR_SETTINGS_UPDATE_FAILED',
          'A configuracao nao foi alterada. A transacao foi revertida.',
        )
      }

      return e.json(200, { success: true, settings: settingsPayload(settings) })
    }

    if (resource !== 'campaigns' || action !== 'create') {
      return apiError(404, 'SDR_OPERATION_NOT_FOUND', 'Operacao do SDR nao encontrada.')
    }

    var activeSettings = null
    try {
      activeSettings = getSettings($app)
    } catch (_) {}
    if (!activeSettings || !activeSettings.getBool('enabled')) {
      return apiError(403, 'SDR_DISABLED', 'Ative o SDR antes de registrar uma campanha.')
    }
    if (body.humanConfirmed !== true) {
      return apiError(400, 'HUMAN_CONFIRMATION_REQUIRED', 'Confirme a criacao da fila do SDR.')
    }

    var name = cleanText(body.name, 200)
    var template = cleanText(body.template, 4000)
    var contacts = Array.isArray(body.contacts) ? body.contacts : []
    if (name.length < 3 || !template || contacts.length === 0 || contacts.length > 50) {
      return apiError(
        400,
        'INVALID_CAMPAIGN',
        'Informe nome, mensagem e entre 1 e 50 oportunidades validas.',
      )
    }

    var normalizedContacts = []
    var seenOpportunityIds = {}
    var seenDeduplicationKeys = {}
    for (var contactIndex = 0; contactIndex < contacts.length; contactIndex += 1) {
      var source = contacts[contactIndex] || {}
      var opportunityId = cleanText(source.opportunityId, 40)
      var correlationId = cleanText(source.correlationId, 80)
      var messageBody = cleanText(source.messageBody, 4000)
      if (!opportunityId || !/^sdr-[a-z0-9]{8}$/i.test(correlationId) || !messageBody) {
        return apiError(
          400,
          'INVALID_CAMPAIGN_CONTACT',
          'A oportunidade ' + (contactIndex + 1) + ' possui dados invalidos.',
        )
      }
      if (seenOpportunityIds[opportunityId]) {
        return apiError(
          409,
          'DUPLICATE_CAMPAIGN_CONTACT',
          'A oportunidade foi selecionada mais de uma vez.',
        )
      }

      var opportunity = null
      try {
        opportunity = $app.findRecordById('opportunities', opportunityId)
      } catch (_) {
        return apiError(
          404,
          'OPPORTUNITY_NOT_FOUND',
          'Uma oportunidade selecionada nao existe mais.',
        )
      }
      var stage = opportunity.getString('stage')
      if (stage === 'Ganho' || stage === 'Perdido') {
        return apiError(409, 'OPPORTUNITY_CLOSED', 'Uma oportunidade selecionada ja foi encerrada.')
      }

      var phone = normalizePhone(opportunity.getString('contact_phone'))
      if (phone.length < 12 || phone.length > 13) {
        return apiError(
          409,
          'OPPORTUNITY_PHONE_INVALID',
          'Uma oportunidade selecionada esta sem WhatsApp valido.',
        )
      }
      var deduplicationKey = 'phone:' + phone
      if (seenDeduplicationKeys[deduplicationKey]) {
        return apiError(
          409,
          'DUPLICATE_CAMPAIGN_CONTACT',
          'O mesmo WhatsApp aparece em mais de uma oportunidade.',
        )
      }
      seenOpportunityIds[opportunityId] = true
      seenDeduplicationKeys[deduplicationKey] = true

      var activeContacts = $app.findRecordsByFilter(
        'sdr_campaign_contacts',
        "opportunity = '" + opportunityId + "' && status != 'concluido' && status != 'falhou'",
        '-created',
        1,
        0,
      )
      if (activeContacts.length) {
        return apiError(
          409,
          'ACTIVE_SDR_CONTACT_CONFLICT',
          'A oportunidade ' + opportunity.getString('company') + ' ja esta em uma campanha ativa.',
        )
      }

      normalizedContacts.push({
        opportunityId: opportunity.id,
        companyName: cleanText(opportunity.getString('company'), 200),
        contactName: cleanText(opportunity.getString('contact_name'), 200) || 'Contato',
        phone: phone,
        email: normalizeEmail(opportunity.getString('contact_email')),
        stage: stage,
        correlationId: correlationId,
        deduplicationKey: deduplicationKey,
        messageBody: messageBody,
      })
    }

    var createdCampaign = null
    try {
      $app.runInTransaction((txApp) => {
        var campaign = new Record(txApp.findCollectionByNameOrId('sdr_campaigns'))
        campaign.set('name', name)
        campaign.set('status', 'ativa')
        campaign.set(
          'description',
          'Fila criada automaticamente a partir das oportunidades abertas do CRM.',
        )
        campaign.set('channel', 'whatsapp')
        campaign.set('created_by', authRecord.id)
        campaign.set('owner', authRecord.id)
        txApp.save(campaign)

        for (var itemIndex = 0; itemIndex < normalizedContacts.length; itemIndex += 1) {
          var item = normalizedContacts[itemIndex]
          var txOpportunity = txApp.findRecordById('opportunities', item.opportunityId)
          var txStage = txOpportunity.getString('stage')
          if (txStage === 'Ganho' || txStage === 'Perdido') {
            throw new Error('SDR_OPPORTUNITY_CLOSED:' + item.opportunityId)
          }
          var transactionActiveContacts = txApp.findRecordsByFilter(
            'sdr_campaign_contacts',
            "opportunity = '" +
              item.opportunityId +
              "' && status != 'concluido' && status != 'falhou'",
            '-created',
            1,
            0,
          )
          if (transactionActiveContacts.length) {
            throw new Error('SDR_ACTIVE_CONTACT_CONFLICT:' + item.opportunityId)
          }

          var contact = new Record(txApp.findCollectionByNameOrId('sdr_campaign_contacts'))
          contact.set('campaign', campaign.id)
          contact.set('opportunity', item.opportunityId)
          contact.set('company_name', item.companyName)
          contact.set('contact_name', item.contactName)
          contact.set('contact_email', item.email)
          contact.set('contact_phone', item.phone)
          contact.set('owner', authRecord.id)
          contact.set('status', 'aprovado')
          contact.set('deduplication_key', item.deduplicationKey)
          contact.set('requires_human_review', false)
          contact.set('source_snapshot', {
            source: 'opportunities',
            opportunityId: item.opportunityId,
            stage: item.stage,
            environment: activeSettings.getString('environment'),
          })
          txApp.save(contact)

          var message = new Record(txApp.findCollectionByNameOrId('sdr_messages'))
          message.set('campaign', campaign.id)
          message.set('contact', contact.id)
          message.set('opportunity', item.opportunityId)
          message.set('direction', 'outbound')
          message.set('status', 'aguardando_confirmacao')
          message.set('body', item.messageBody)
          message.set('correlation_id', item.correlationId)
          message.set('attempt_count', 0)
          txApp.save(message)
        }

        writeAudit(txApp, {
          actorUserId: authRecord.id,
          campaignId: campaign.id,
          operation: 'sdr_campaign_create_from_opportunities',
          targetCollection: 'sdr_campaigns',
          targetRecordId: campaign.id,
          correlationId: 'sdr-campaign-' + String(Date.now()).slice(-8),
          newValue: { name: name, status: 'ativa', contacts: normalizedContacts.length },
          metadata: {
            environment: activeSettings.getString('environment'),
            source: 'opportunities',
            opportunityIds: normalizedContacts.map(function (item) {
              return item.opportunityId
            }),
          },
        })
        createdCampaign = campaign
      })
    } catch (error) {
      var errorMessage = error && error.message ? error.message : String(error)
      if (errorMessage.indexOf('SDR_OPPORTUNITY_CLOSED:') === 0) {
        return apiError(
          409,
          'OPPORTUNITY_CLOSED',
          'Uma oportunidade foi encerrada durante a criacao da fila.',
        )
      }
      if (errorMessage.indexOf('SDR_ACTIVE_CONTACT_CONFLICT:') === 0) {
        return apiError(
          409,
          'ACTIVE_SDR_CONTACT_CONFLICT',
          'Uma oportunidade entrou em outra campanha ativa.',
        )
      }
      console.error('Falha ao registrar campanha SDR:', error)
      return apiError(
        500,
        'SDR_CAMPAIGN_CREATE_FAILED',
        'A campanha nao foi registrada. A transacao foi revertida.',
      )
    }

    return e.json(201, {
      success: true,
      campaignId: createdCampaign.id,
      status: createdCampaign.getString('status'),
      contactsCreated: normalizedContacts.length,
      messagesCreated: normalizedContacts.length,
      message: 'Fila do SDR criada com as oportunidades selecionadas e trilha de auditoria.',
    })
  },
  $apis.requireAuth(),
)
