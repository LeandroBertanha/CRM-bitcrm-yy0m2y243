/**
 * Operacoes administrativas do SDR.
 *
 * Todas as escritas passam pelo servidor. As colecoes SDR continuam sem regras
 * publicas de create/update/delete e nenhuma oportunidade existente e alterada.
 */

function sdrOpsCleanText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function sdrOpsNormalizePhone(value) {
  var digits = String(value || '').replace(/\D/g, '')
  if (digits.indexOf('55') !== 0 && (digits.length === 10 || digits.length === 11)) {
    return '55' + digits
  }
  return digits
}

function sdrOpsNormalizeEmail(value) {
  return sdrOpsCleanText(value, 200).toLowerCase()
}

function sdrOpsNormalizeComparableText(value) {
  return sdrOpsCleanText(value, 200).toLowerCase().replace(/\s+/g, ' ')
}

function sdrOpsFindOpenOpportunityConflict(app, contact) {
  var opportunities = app.findRecordsByFilter(
    'opportunities',
    "stage != 'Ganho' && stage != 'Perdido'",
    '-updated',
    5000,
    0,
  )
  var inputPhone = sdrOpsNormalizePhone(contact.phone)
  var inputEmail = sdrOpsNormalizeEmail(contact.email)
  var inputCompany = sdrOpsNormalizeComparableText(contact.companyName)

  for (var index = 0; index < opportunities.length; index += 1) {
    var opportunity = opportunities[index]
    var samePhone =
      inputPhone && sdrOpsNormalizePhone(opportunity.getString('contact_phone')) === inputPhone
    var sameEmail =
      inputEmail && sdrOpsNormalizeEmail(opportunity.getString('contact_email')) === inputEmail
    var sameCompany =
      inputCompany &&
      sdrOpsNormalizeComparableText(opportunity.getString('company')) === inputCompany

    if (samePhone || sameEmail || sameCompany) {
      return {
        opportunityId: opportunity.id,
        company: opportunity.getString('company'),
        matchedBy: samePhone ? 'phone' : sameEmail ? 'email' : 'company',
      }
    }
  }
  return null
}

function sdrOpsIsAdmin(authRecord) {
  if (!authRecord) return false
  return (
    authRecord.getString('role') === 'admin' ||
    authRecord.getString('email').toLowerCase() === 'leandro.bertanha@gmail.com'
  )
}

function sdrOpsSettings(app) {
  var records = app.findRecordsByFilter('sdr_settings', "id != ''", '-created', 1, 0)
  return records.length ? records[0] : null
}

function sdrOpsAudit(app, data) {
  var collection = app.findCollectionByNameOrId('sdr_audit_logs')
  var record = new Record(collection)
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

function sdrOpsSettingsPayload(record) {
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

routerAdd(
  'POST',
  '/backend/v1/sdr/settings/update',
  (e) => {
    var authRecord = e.auth
    if (!sdrOpsIsAdmin(authRecord)) {
      return e.json(authRecord ? 403 : 401, {
        success: false,
        code: authRecord ? 'ADMIN_REQUIRED' : 'UNAUTHENTICATED',
        error: authRecord ? 'Somente administradores podem configurar o SDR.' : 'Nao autenticado.',
      })
    }

    var body = e.requestInfo().body || {}
    var enabled = body.enabled === true
    var environment = body.environment === 'producao' ? 'producao' : 'homologacao'
    var allowOpportunityCreation = enabled && body.allowOpportunityCreation === true
    var confirmationPhrase = sdrOpsCleanText(body.confirmationPhrase, 80).toUpperCase()

    if (enabled && environment === 'producao' && confirmationPhrase !== 'ATIVAR SDR EM PRODUCAO') {
      return e.json(400, {
        success: false,
        code: 'PRODUCTION_CONFIRMATION_REQUIRED',
        error: 'Digite ATIVAR SDR EM PRODUCAO para confirmar a ativacao real.',
      })
    }

    var settings = null
    try {
      settings = sdrOpsSettings($app)
    } catch (_) {
      return e.json(409, {
        success: false,
        code: 'SDR_FOUNDATION_UNAVAILABLE',
        error: 'A fundacao SDR ainda nao foi aplicada.',
      })
    }
    if (!settings) {
      return e.json(409, {
        success: false,
        code: 'SDR_SETTINGS_MISSING',
        error: 'Configuracao do SDR nao encontrada.',
      })
    }

    var previousValue = sdrOpsSettingsPayload(settings)
    try {
      $app.runInTransaction((txApp) => {
        var txSettings = txApp.findRecordById('sdr_settings', settings.id)
        txSettings.set('enabled', enabled)
        txSettings.set('allow_existing_opportunity_update', false)
        txSettings.set('allow_opportunity_creation', allowOpportunityCreation)
        txSettings.set('require_human_confirmation', true)
        txSettings.set('environment', environment)
        txSettings.set(
          'notes',
          enabled
            ? 'SDR ativado pelo administrador com confirmacao humana e auditoria obrigatorias.'
            : 'SDR desativado pelo administrador. Nenhuma operacao real e permitida.',
        )
        txApp.save(txSettings)

        sdrOpsAudit(txApp, {
          actorUserId: authRecord.id,
          operation: enabled ? 'sdr_settings_activate' : 'sdr_settings_deactivate',
          targetCollection: 'sdr_settings',
          targetRecordId: txSettings.id,
          correlationId: 'sdr-settings-' + String(Date.now()).slice(-8),
          previousValue: previousValue,
          newValue: sdrOpsSettingsPayload(txSettings),
          metadata: { humanConfirmationRequired: true },
        })
        settings = txSettings
      })
    } catch (error) {
      console.error('Falha ao atualizar configuracao SDR:', error)
      return e.json(500, {
        success: false,
        code: 'SDR_SETTINGS_UPDATE_FAILED',
        error: 'A configuracao nao foi alterada. A transacao foi revertida.',
      })
    }

    return e.json(200, { success: true, settings: sdrOpsSettingsPayload(settings) })
  },
  $apis.requireAuth(),
)

routerAdd(
  'POST',
  '/backend/v1/sdr/campaigns/create',
  (e) => {
    var authRecord = e.auth
    if (!sdrOpsIsAdmin(authRecord)) {
      return e.json(authRecord ? 403 : 401, {
        success: false,
        code: authRecord ? 'ADMIN_REQUIRED' : 'UNAUTHENTICATED',
        error: authRecord
          ? 'Somente administradores podem criar campanhas SDR.'
          : 'Nao autenticado.',
      })
    }

    var settings = null
    try {
      settings = sdrOpsSettings($app)
    } catch (_) {}
    if (!settings || !settings.getBool('enabled')) {
      return e.json(403, {
        success: false,
        code: 'SDR_DISABLED',
        error: 'Ative o SDR antes de registrar uma campanha real.',
      })
    }
    if (!settings.getBool('require_human_confirmation')) {
      return e.json(409, {
        success: false,
        code: 'UNSAFE_SDR_SETTINGS',
        error: 'A confirmacao humana precisa permanecer obrigatoria.',
      })
    }

    var body = e.requestInfo().body || {}
    if (body.humanConfirmed !== true) {
      return e.json(400, {
        success: false,
        code: 'HUMAN_CONFIRMATION_REQUIRED',
        error: 'Confirme a revisao humana da campanha.',
      })
    }

    var name = sdrOpsCleanText(body.name, 200)
    var template = sdrOpsCleanText(body.template, 4000)
    var contacts = Array.isArray(body.contacts) ? body.contacts : []
    if (name.length < 3 || !template || contacts.length === 0 || contacts.length > 50) {
      return e.json(400, {
        success: false,
        code: 'INVALID_CAMPAIGN',
        error: 'Informe nome, mensagem e entre 1 e 50 contatos validos.',
      })
    }

    var normalizedContacts = []
    var seenKeys = {}
    for (var index = 0; index < contacts.length; index += 1) {
      var source = contacts[index] || {}
      var companyName = sdrOpsCleanText(source.companyName, 200)
      var contactName = sdrOpsCleanText(source.contactName, 200)
      var phone = sdrOpsNormalizePhone(source.phone)
      var email = sdrOpsNormalizeEmail(source.email)
      var correlationId = sdrOpsCleanText(source.correlationId, 80)
      var deduplicationKey = sdrOpsCleanText(source.deduplicationKey, 120)
      var messageBody = sdrOpsCleanText(source.messageBody, 4000)

      if (
        source.authorizedForContact !== true ||
        companyName.length < 2 ||
        phone.length < 12 ||
        phone.length > 13 ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
        !/^sdr-[a-z0-9]{8}$/i.test(correlationId) ||
        !/^phone:\d{10,15}$/.test(deduplicationKey) ||
        !messageBody
      ) {
        return e.json(400, {
          success: false,
          code: 'INVALID_CAMPAIGN_CONTACT',
          error: 'Contato ' + (index + 1) + ' invalido ou sem autorizacao explicita.',
        })
      }
      if (seenKeys[deduplicationKey]) {
        return e.json(409, {
          success: false,
          code: 'DUPLICATE_CAMPAIGN_CONTACT',
          error: 'O mesmo contato aparece mais de uma vez na campanha.',
        })
      }
      seenKeys[deduplicationKey] = true
      var normalizedContact = {
        companyName: companyName,
        contactName: contactName,
        phone: phone,
        email: email,
        correlationId: correlationId,
        deduplicationKey: deduplicationKey,
        messageBody: messageBody,
      }
      var openConflict = sdrOpsFindOpenOpportunityConflict($app, normalizedContact)
      if (openConflict) {
        return e.json(409, {
          success: false,
          code: 'OPEN_OPPORTUNITY_CONFLICT',
          error:
            'O contato ' +
            (index + 1) +
            ' possui oportunidade aberta relacionada. A campanha foi bloqueada.',
          conflict: openConflict,
        })
      }
      var activeContact = $app.findRecordsByFilter(
        'sdr_campaign_contacts',
        "deduplication_key = '" +
          deduplicationKey +
          "' && status != 'concluido' && status != 'falhou'",
        '-created',
        1,
        0,
      )
      if (activeContact.length) {
        return e.json(409, {
          success: false,
          code: 'ACTIVE_SDR_CONTACT_CONFLICT',
          error: 'O contato ' + (index + 1) + ' ja esta em uma campanha SDR ativa.',
        })
      }
      normalizedContacts.push(normalizedContact)
    }

    var createdCampaign = null
    try {
      $app.runInTransaction((txApp) => {
        var campaignCollection = txApp.findCollectionByNameOrId('sdr_campaigns')
        var contactCollection = txApp.findCollectionByNameOrId('sdr_campaign_contacts')
        var messageCollection = txApp.findCollectionByNameOrId('sdr_messages')
        var campaign = new Record(campaignCollection)
        campaign.set('name', name)
        campaign.set(
          'status',
          settings.getString('environment') === 'producao' ? 'ativa' : 'em_revisao',
        )
        campaign.set('description', 'Campanha registrada pelo painel SDR com confirmacao humana.')
        campaign.set('channel', 'whatsapp')
        campaign.set('created_by', authRecord.id)
        campaign.set('owner', authRecord.id)
        txApp.save(campaign)

        for (var itemIndex = 0; itemIndex < normalizedContacts.length; itemIndex += 1) {
          var item = normalizedContacts[itemIndex]
          var transactionConflict = sdrOpsFindOpenOpportunityConflict(txApp, item)
          if (transactionConflict) {
            throw new Error(
              'SDR_CAMPAIGN_CONFLICT:' +
                transactionConflict.opportunityId +
                ':' +
                transactionConflict.matchedBy,
            )
          }
          var transactionActiveContact = txApp.findRecordsByFilter(
            'sdr_campaign_contacts',
            "deduplication_key = '" +
              item.deduplicationKey +
              "' && status != 'concluido' && status != 'falhou'",
            '-created',
            1,
            0,
          )
          if (transactionActiveContact.length) {
            throw new Error('SDR_ACTIVE_CONTACT_CONFLICT:' + item.deduplicationKey)
          }
          var contact = new Record(contactCollection)
          contact.set('campaign', campaign.id)
          contact.set('company_name', item.companyName)
          contact.set('contact_name', item.contactName)
          contact.set('contact_email', item.email)
          contact.set('contact_phone', item.phone)
          contact.set('owner', authRecord.id)
          contact.set('status', 'aprovado')
          contact.set('deduplication_key', item.deduplicationKey)
          contact.set('requires_human_review', true)
          contact.set('source_snapshot', {
            environment: settings.getString('environment'),
            authorizedForContact: true,
          })
          txApp.save(contact)

          var message = new Record(messageCollection)
          message.set('campaign', campaign.id)
          message.set('contact', contact.id)
          message.set('direction', 'outbound')
          message.set('status', 'aguardando_confirmacao')
          message.set('body', item.messageBody)
          message.set('correlation_id', item.correlationId)
          message.set('attempt_count', 0)
          txApp.save(message)
        }

        sdrOpsAudit(txApp, {
          actorUserId: authRecord.id,
          campaignId: campaign.id,
          operation: 'sdr_campaign_create',
          targetCollection: 'sdr_campaigns',
          targetRecordId: campaign.id,
          correlationId: 'sdr-campaign-' + String(Date.now()).slice(-8),
          newValue: {
            name: name,
            status: campaign.getString('status'),
            contacts: normalizedContacts.length,
          },
          metadata: {
            environment: settings.getString('environment'),
            humanConfirmed: true,
            messagesStatus: 'aguardando_confirmacao',
          },
        })
        createdCampaign = campaign
      })
    } catch (error) {
      var errorMessage = error && error.message ? error.message : String(error)
      if (errorMessage.indexOf('SDR_CAMPAIGN_CONFLICT:') === 0) {
        return e.json(409, {
          success: false,
          code: 'OPEN_OPPORTUNITY_CONFLICT',
          error: 'Uma oportunidade relacionada surgiu durante a confirmacao. Nada foi salvo.',
        })
      }
      if (errorMessage.indexOf('SDR_ACTIVE_CONTACT_CONFLICT:') === 0) {
        return e.json(409, {
          success: false,
          code: 'ACTIVE_SDR_CONTACT_CONFLICT',
          error: 'O contato entrou em outra campanha ativa durante a confirmacao. Nada foi salvo.',
        })
      }
      console.error('Falha ao registrar campanha SDR:', error)
      return e.json(500, {
        success: false,
        code: 'SDR_CAMPAIGN_CREATE_FAILED',
        error: 'A campanha nao foi registrada. A transacao foi revertida.',
      })
    }

    return e.json(201, {
      success: true,
      campaignId: createdCampaign.id,
      status: createdCampaign.getString('status'),
      contactsCreated: normalizedContacts.length,
      messagesCreated: normalizedContacts.length,
      message: 'Campanha registrada com fila auditavel aguardando confirmacao de envio.',
    })
  },
  $apis.requireAuth(),
)
