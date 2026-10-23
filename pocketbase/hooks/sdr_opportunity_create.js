/**
 * Criacao controlada de oportunidades pelo modulo SDR.
 *
 * A rota permanece restrita a administradores, homologacao, feature flag ativa,
 * confirmacao humana e nova verificacao de duplicidade no servidor. A oportunidade
 * e a auditoria sao persistidas na mesma transacao.
 */

function sdrCleanText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function sdrNormalizeText(value) {
  return sdrCleanText(value, 200).toLowerCase().replace(/\s+/g, ' ')
}

function sdrNormalizePhone(value) {
  var digits = String(value || '').replace(/\D/g, '')
  if (digits.indexOf('55') === 0 && (digits.length === 12 || digits.length === 13)) {
    return digits.slice(2)
  }
  return digits
}

function sdrNormalizeEmail(value) {
  return sdrCleanText(value, 200).toLowerCase()
}

function sdrFindOpenConflict(app, payload) {
  var opportunities = app.findRecordsByFilter(
    'opportunities',
    "stage != 'Ganho' && stage != 'Perdido'",
    '-updated',
    5000,
    0,
  )
  var inputPhone = sdrNormalizePhone(payload.contactPhone)
  var inputEmail = sdrNormalizeEmail(payload.contactEmail)
  var inputCompany = sdrNormalizeText(payload.company)

  for (var index = 0; index < opportunities.length; index += 1) {
    var opportunity = opportunities[index]
    var samePhone =
      inputPhone && sdrNormalizePhone(opportunity.getString('contact_phone')) === inputPhone
    var sameEmail =
      inputEmail && sdrNormalizeEmail(opportunity.getString('contact_email')) === inputEmail
    var sameCompany =
      inputCompany && sdrNormalizeText(opportunity.getString('company')) === inputCompany

    if (samePhone || sameEmail || sameCompany) {
      return {
        opportunityId: opportunity.id,
        company: opportunity.getString('company'),
        stage: opportunity.getString('stage'),
        matchedBy: samePhone ? 'phone' : sameEmail ? 'email' : 'company',
      }
    }
  }

  return null
}

function sdrWriteAudit(app, data) {
  var auditCollection = app.findCollectionByNameOrId('sdr_audit_logs')
  var audit = new Record(auditCollection)
  audit.set('actor_user', data.actorUserId)
  audit.set('actor_type', 'user')
  audit.set('agent_name', 'SDR Inteligente')
  audit.set('operation', 'sdr_opportunity_create')
  audit.set('target_collection', 'opportunities')
  audit.set('target_record_id', data.targetRecordId || '')
  audit.set('result', data.result)
  audit.set('metadata', data.metadata || {})
  audit.set('previous_value', {})
  audit.set('new_value', data.newValue || {})
  audit.set('error_message', data.errorMessage || '')
  audit.set('correlation_id', data.idempotencyKey)
  audit.set('event_at', new Date().toISOString())
  app.save(audit)
  return audit
}

function sdrRejectWithAudit(e, status, code, message, context) {
  var auditRecorded = false
  if (context && context.actorUserId && context.idempotencyKey) {
    try {
      sdrWriteAudit($app, {
        actorUserId: context.actorUserId,
        idempotencyKey: context.idempotencyKey,
        result: 'rejected',
        errorMessage: message,
        metadata: {
          code: code,
          correlationId: context.correlationId || '',
          conflict: context.conflict || null,
        },
      })
      auditRecorded = true
    } catch (auditError) {
      console.error('Falha ao auditar rejeicao do SDR:', auditError)
    }
  }

  return e.json(status, {
    success: false,
    code: code,
    error: message,
    auditRecorded: auditRecorded,
    conflict: context && context.conflict ? context.conflict : undefined,
  })
}

routerAdd(
  'POST',
  '/backend/v1/sdr/opportunities/create',
  (e) => {
    var authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { success: false, code: 'UNAUTHENTICATED', error: 'Nao autenticado.' })
    }

    var role = authRecord.getString('role')
    var email = authRecord.getString('email').toLowerCase()
    var isMasterAdmin = email === 'leandro.bertanha@gmail.com'
    if (role !== 'admin' && !isMasterAdmin) {
      return e.json(403, {
        success: false,
        code: 'ADMIN_REQUIRED',
        error: 'Somente administradores podem criar oportunidades pelo SDR.',
      })
    }

    var body = {}
    try {
      body = e.requestInfo().body || {}
      if (typeof body === 'string') body = JSON.parse(body)
    } catch (_) {
      return e.json(400, {
        success: false,
        code: 'INVALID_BODY',
        error: 'Corpo da requisicao invalido.',
      })
    }

    var correlationId = sdrCleanText(body.correlationId, 80)
    var idempotencyKey = sdrCleanText(body.idempotencyKey, 80)
    var context = {
      actorUserId: authRecord.id,
      correlationId: correlationId,
      idempotencyKey: idempotencyKey,
    }
    var payload = {
      company: sdrCleanText(body.company, 200),
      contactName: sdrCleanText(body.contactName, 200),
      contactPhone: String(body.contactPhone || '')
        .replace(/\D/g, '')
        .slice(0, 15),
      contactEmail: sdrNormalizeEmail(body.contactEmail),
    }

    if (!/^sdr-[a-z0-9]{8}$/i.test(correlationId)) {
      return sdrRejectWithAudit(
        e,
        400,
        'INVALID_CORRELATION_ID',
        'Identificador de correlacao invalido.',
        context,
      )
    }
    if (!/^sdr-create-[a-z0-9]{8}$/i.test(idempotencyKey)) {
      return e.json(400, {
        success: false,
        code: 'INVALID_IDEMPOTENCY_KEY',
        error: 'Chave de idempotencia invalida.',
      })
    }
    if (!payload.company || payload.company.length < 2) {
      return sdrRejectWithAudit(
        e,
        400,
        'COMPANY_REQUIRED',
        'Empresa obrigatoria para criar a oportunidade.',
        context,
      )
    }
    if (payload.contactPhone.length < 10 || payload.contactPhone.length > 15) {
      return sdrRejectWithAudit(
        e,
        400,
        'INVALID_PHONE',
        'Telefone deve conter entre 10 e 15 digitos.',
        context,
      )
    }
    if (payload.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.contactEmail)) {
      return sdrRejectWithAudit(e, 400, 'INVALID_EMAIL', 'E-mail invalido.', context)
    }
    if (body.humanConfirmed !== true) {
      return sdrRejectWithAudit(
        e,
        400,
        'HUMAN_CONFIRMATION_REQUIRED',
        'A confirmacao humana e obrigatoria.',
        context,
      )
    }

    var settings = null
    try {
      var settingsList = $app.findRecordsByFilter(
        'sdr_settings',
        "environment = 'homologacao'",
        '-created',
        1,
        0,
      )
      settings = settingsList.length ? settingsList[0] : null
    } catch (_) {
      return e.json(409, {
        success: false,
        code: 'SDR_FOUNDATION_UNAVAILABLE',
        error: 'A fundacao SDR ainda nao foi aplicada neste ambiente.',
      })
    }

    if (!settings) {
      return e.json(409, {
        success: false,
        code: 'SDR_SETTINGS_MISSING',
        error: 'Configuracao de homologacao do SDR nao encontrada.',
      })
    }
    if (settings.getString('environment') !== 'homologacao') {
      return sdrRejectWithAudit(
        e,
        403,
        'SDR_PRODUCTION_BLOCKED',
        'Criacao SDR bloqueada fora da homologacao.',
        context,
      )
    }
    if (!settings.getBool('enabled') || !settings.getBool('allow_opportunity_creation')) {
      return sdrRejectWithAudit(
        e,
        403,
        'SDR_CREATION_DISABLED',
        'A criacao de oportunidades pelo SDR esta desativada.',
        context,
      )
    }
    if (!settings.getBool('require_human_confirmation')) {
      return sdrRejectWithAudit(
        e,
        409,
        'UNSAFE_SDR_SETTINGS',
        'Configuracao insegura: confirmacao humana precisa permanecer obrigatoria.',
        context,
      )
    }

    try {
      var existingAudits = $app.findRecordsByFilter(
        'sdr_audit_logs',
        "operation = 'sdr_opportunity_create' && result = 'success' && correlation_id = '" +
          idempotencyKey +
          "'",
        '-created',
        1,
        0,
      )
      if (existingAudits.length) {
        var existingOpportunityId = existingAudits[0].getString('target_record_id')
        return e.json(200, {
          success: true,
          idempotent: true,
          opportunityId: existingOpportunityId,
          message: 'A oportunidade ja havia sido criada por esta confirmacao.',
        })
      }
    } catch (idempotencyError) {
      return e.json(500, {
        success: false,
        code: 'IDEMPOTENCY_CHECK_FAILED',
        error: 'Nao foi possivel validar a idempotencia com seguranca.',
      })
    }

    var initialConflict = sdrFindOpenConflict($app, payload)
    if (initialConflict) {
      context.conflict = initialConflict
      return sdrRejectWithAudit(
        e,
        409,
        'OPEN_OPPORTUNITY_CONFLICT',
        'Foi encontrada uma oportunidade aberta relacionada. A criacao foi bloqueada.',
        context,
      )
    }

    var createdOpportunity = null
    try {
      $app.runInTransaction((txApp) => {
        var transactionConflict = sdrFindOpenConflict(txApp, payload)
        if (transactionConflict) {
          throw new Error(
            'SDR_DUPLICATE_RACE:' +
              transactionConflict.opportunityId +
              ':' +
              transactionConflict.matchedBy,
          )
        }

        var opportunitiesCollection = txApp.findCollectionByNameOrId('opportunities')
        var opportunity = new Record(opportunitiesCollection)
        opportunity.set('company', payload.company)
        opportunity.set('stage', 'Novo')
        opportunity.set('source', 'Prospecção')
        opportunity.set('value', 0)
        opportunity.set('seller', authRecord.id)
        opportunity.set('contact_name', payload.contactName || 'Contato')
        opportunity.set('contact_phone', payload.contactPhone)
        opportunity.set('contact_email', payload.contactEmail)
        opportunity.set(
          'message',
          'Oportunidade criada pelo SDR Inteligente em homologacao. Correlacao: ' + correlationId,
        )
        txApp.save(opportunity)

        sdrWriteAudit(txApp, {
          actorUserId: authRecord.id,
          idempotencyKey: idempotencyKey,
          targetRecordId: opportunity.id,
          result: 'success',
          metadata: {
            correlationId: correlationId,
            environment: 'homologacao',
            humanConfirmed: true,
          },
          newValue: {
            company: payload.company,
            stage: 'Novo',
            source: 'Prospecção',
            seller: authRecord.id,
            contact_name: payload.contactName || 'Contato',
            contact_phone: payload.contactPhone,
            contact_email: payload.contactEmail,
          },
        })

        createdOpportunity = opportunity
      })
    } catch (saveError) {
      var saveMessage = saveError && saveError.message ? saveError.message : String(saveError)
      if (saveMessage.indexOf('SDR_DUPLICATE_RACE:') === 0) {
        var raceParts = saveMessage.split(':')
        context.conflict = {
          opportunityId: raceParts[1] || '',
          matchedBy: raceParts[2] || 'unknown',
        }
        return sdrRejectWithAudit(
          e,
          409,
          'OPEN_OPPORTUNITY_CONFLICT',
          'Uma oportunidade relacionada foi criada durante a confirmacao. A operacao foi revertida.',
          context,
        )
      }

      console.error('Falha transacional ao criar oportunidade pelo SDR:', saveError)
      try {
        sdrWriteAudit($app, {
          actorUserId: authRecord.id,
          idempotencyKey: idempotencyKey,
          result: 'error',
          errorMessage: 'Falha transacional ao criar oportunidade.',
          metadata: { correlationId: correlationId },
        })
      } catch (auditError) {
        console.error('Falha ao auditar erro transacional do SDR:', auditError)
      }
      return e.json(500, {
        success: false,
        code: 'SDR_CREATE_FAILED',
        error: 'A oportunidade nao foi criada. A transacao foi revertida.',
      })
    }

    return e.json(201, {
      success: true,
      idempotent: false,
      opportunityId: createdOpportunity.id,
      message: 'Oportunidade criada com auditoria em homologacao.',
    })
  },
  $apis.requireAuth(),
)
