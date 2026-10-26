/**
 * Escritas protegidas do comissionamento SaaS.
 *
 * A migração 0038 bloqueia gravações diretas nas coleções financeiras. Todas
 * as mutações passam por esta rota, com autorização, recálculo no servidor,
 * transação, idempotência e auditoria.
 */

function commissionSaasIsAdmin(auth) {
  if (!auth) return false
  var email = auth.getString('email').toLowerCase()
  return (
    auth.getString('role') === 'admin' ||
    email === 'leandro.bertanha@lbertanha.com' ||
    email === 'leandro.bertanha@gmail.com'
  )
}

function commissionSaasText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function commissionSaasInt(value, maxValue) {
  var parsed = Math.round(Number(value) || 0)
  return Math.min(maxValue || 999999999999, Math.max(0, parsed))
}

function commissionSaasFraction(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}

function commissionSaasJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch (_) {
    return fallback
  }
}

function commissionSaasActivePolicy(app) {
  var records = app.findRecordsByFilter(
    'saas_commission_policies',
    'is_active = true',
    '-policy_version',
    1,
    0,
  )
  return records.length ? records[0] : null
}

function commissionSaasPolicyPayload(policy) {
  return {
    id: policy.id,
    name: policy.getString('name'),
    policy_version: policy.getInt('policy_version'),
    tiers: commissionSaasJson(policy.get('tiers'), []),
    recurring_percentage: Number(policy.get('recurring_percentage')) || 0,
    recurring_eligible_months: policy.getInt('recurring_eligible_months'),
    min_margin_percentage: Number(policy.get('min_margin_percentage')) || 0,
    notes: policy.getString('notes'),
    is_active: policy.getBool('is_active'),
  }
}

function commissionSaasValidateTiers(rawTiers) {
  var source = commissionSaasJson(rawTiers, [])
  if (!Array.isArray(source) || source.length === 0 || source.length > 20) return null
  var tiers = []
  for (var index = 0; index < source.length; index += 1) {
    var item = source[index] || {}
    var minimum = commissionSaasInt(item.min_value)
    var maximum = item.max_value === null ? null : commissionSaasInt(item.max_value)
    var percentage = commissionSaasFraction(item.percentage)
    if (!percentage || (maximum !== null && maximum < minimum)) return null
    tiers.push({
      min_value: minimum,
      max_value: maximum,
      percentage: percentage,
      label: commissionSaasText(item.label, 160) || 'Faixa ' + String(index + 1),
    })
  }
  tiers.sort(function (a, b) {
    return a.min_value - b.min_value
  })
  return tiers
}

function commissionSaasMatchTier(valueCents, tiers) {
  for (var index = 0; index < tiers.length; index += 1) {
    var tier = tiers[index]
    if (valueCents >= tier.min_value && (tier.max_value === null || valueCents <= tier.max_value)) {
      return tier
    }
  }
  return tiers.length ? tiers[tiers.length - 1] : null
}

function commissionSaasFindException(app, sellerId, scope) {
  var records = app.findRecordsByFilter(
    'saas_commission_exceptions',
    "seller = '" + sellerId + "' && applies_to = '" + scope + "' && is_active = true",
    '-created',
    100,
    0,
  )
  var now = new Date().toISOString()
  for (var index = 0; index < records.length; index += 1) {
    var record = records[index]
    var from = record.getString('valid_from')
    var until = record.getString('valid_until')
    if ((!from || from <= now) && (!until || until >= now)) return record
  }
  return null
}

function commissionSaasCalculate(app, body, policy, sellerId) {
  var contract = commissionSaasInt(body.contractValueCents)
  var monthly = commissionSaasInt(body.recurringMonthlyCents)
  var costs = commissionSaasInt(body.directCostsCents)
  var recurringCosts = commissionSaasInt(body.recurringCostsCents)
  var taxes = commissionSaasInt(body.taxesCents)
  var hostingModel = commissionSaasText(body.hostingModel, 40)
  var tiers = commissionSaasValidateTiers(policy.get('tiers')) || []
  var tier = commissionSaasMatchTier(contract, tiers)
  var developmentException = commissionSaasFindException(app, sellerId, 'development')
  var recurringException = commissionSaasFindException(app, sellerId, 'recurring')
  var commissionType = 'percentage'
  var developmentPercentage = tier ? Number(tier.percentage) || 0 : 0
  var developmentCommission = 0

  if (developmentException && developmentException.getString('exception_type') === 'fixed_value') {
    commissionType = 'fixed_value'
    developmentCommission = commissionSaasInt(developmentException.get('fixed_value_cents'))
    developmentPercentage = 0
  } else {
    if (developmentException && developmentException.getString('exception_type') === 'percentage') {
      developmentPercentage = commissionSaasFraction(developmentException.get('percentage'))
    }
    developmentCommission = Math.round(contract * developmentPercentage)
  }

  var recurringAllowed = hostingModel !== 'client_cloud'
  var eligibleMonths = recurringAllowed
    ? commissionSaasInt(policy.get('recurring_eligible_months'), 120)
    : 0
  var recurringPerMonth = 0
  if (monthly > 0 && eligibleMonths > 0) {
    if (recurringException && recurringException.getString('exception_type') === 'fixed_value') {
      recurringPerMonth = commissionSaasInt(recurringException.get('fixed_value_cents'))
    } else {
      var recurringPercentage = recurringException
        ? commissionSaasFraction(recurringException.get('percentage'))
        : commissionSaasFraction(policy.get('recurring_percentage'))
      recurringPerMonth = Math.round(monthly * recurringPercentage)
    }
  }
  var recurringPotential = recurringPerMonth * eligibleMonths
  var netRevenue = Math.max(0, contract + monthly * eligibleMonths - taxes)
  var totalCommission = developmentCommission + recurringPotential
  var totalCosts = costs + recurringCosts * eligibleMonths
  var margin = netRevenue > 0 ? (netRevenue - totalCosts - totalCommission) / netRevenue : -1
  var minMargin = Number(policy.get('min_margin_percentage')) || 0

  return {
    tier: tier,
    commissionType: commissionType,
    developmentPercentage: developmentPercentage,
    developmentCommissionCents: developmentCommission,
    recurringEligibleMonths: eligibleMonths,
    recurringCommissionPerMonthCents: recurringPerMonth,
    recurringCommissionPotentialCents: recurringPotential,
    totalPotentialCents: totalCommission,
    netRevenueCents: netRevenue,
    marginPercentage: margin,
    requiresApproval: margin < minMargin,
    developmentExceptionId: developmentException ? developmentException.id : '',
    recurringExceptionId: recurringException ? recurringException.id : '',
  }
}

function commissionSaasAddMonths(date, months) {
  var result = new Date(date)
  result.setUTCMonth(result.getUTCMonth() + months)
  return result.toISOString()
}

function commissionSaasBuildPlan(body, calc) {
  var contract = commissionSaasInt(body.contractValueCents)
  var installments = Math.min(60, Math.max(1, commissionSaasInt(body.installmentsCount, 60)))
  var base = Math.floor(contract / installments)
  var remainder = contract - base * installments
  var firstDate = body.firstDueDate ? new Date(body.firstDueDate) : new Date()
  if (isNaN(firstDate.getTime())) firstDate = new Date()
  var plan = []
  for (var index = 0; index < installments; index += 1) {
    plan.push({
      kind: 'development',
      installmentNumber: index + 1,
      amountCents: base + (index < remainder ? 1 : 0),
      expectedDate: commissionSaasAddMonths(firstDate, index),
    })
  }
  var monthly = commissionSaasInt(body.recurringMonthlyCents)
  for (var month = 0; month < calc.recurringEligibleMonths; month += 1) {
    plan.push({
      kind: 'recurring',
      installmentNumber: month + 1,
      amountCents: monthly,
      expectedDate: commissionSaasAddMonths(firstDate, month),
    })
  }
  return plan
}

function commissionSaasEvent(app, data) {
  var event = new Record(app.findCollectionByNameOrId('saas_commission_events'))
  event.set('commission', data.commissionId)
  event.set('seller', data.sellerId)
  event.set('actor', data.actorId)
  event.set('event_type', data.eventType)
  if (data.amountCents) event.set('amount_cents', data.amountCents)
  if (data.receivableId) event.set('receivable', data.receivableId)
  event.set('description', commissionSaasText(data.description, 2000))
  event.set('metadata', data.metadata || {})
  app.save(event)
  return event
}

function commissionSaasError(e, status, code, message) {
  return e.json(status, { ok: false, code: code, error: message })
}

routerAdd(
  'POST',
  '/backend/v1/commissions/saas/{action}',
  (e) => {
    var auth = e.auth
    var action = commissionSaasText(e.request.pathValue('action'), 60)
    var body = e.requestInfo().body || {}
    var isAdmin = commissionSaasIsAdmin(auth)

    if (action === 'policy-version') {
      if (!isAdmin)
        return commissionSaasError(
          e,
          403,
          'ADMIN_REQUIRED',
          'Somente administradores podem alterar políticas.',
        )
      var tiers = commissionSaasValidateTiers(body.tiers)
      if (!tiers)
        return commissionSaasError(
          e,
          400,
          'INVALID_TIERS',
          'Informe faixas válidas, sem limites invertidos e com percentuais maiores que zero.',
        )
      var createdPolicy = null
      try {
        $app.runInTransaction((txApp) => {
          var current = commissionSaasActivePolicy(txApp)
          var nextVersion = current ? current.getInt('policy_version') + 1 : 1
          if (current) {
            current.set('is_active', false)
            txApp.save(current)
          }
          var record = new Record(txApp.findCollectionByNameOrId('saas_commission_policies'))
          record.set('name', commissionSaasText(body.name, 200) || 'Política SaaS v' + nextVersion)
          record.set('policy_version', nextVersion)
          record.set('tiers', tiers)
          record.set('recurring_percentage', commissionSaasFraction(body.recurring_percentage))
          record.set(
            'recurring_eligible_months',
            commissionSaasInt(body.recurring_eligible_months, 120),
          )
          record.set('min_margin_percentage', commissionSaasFraction(body.min_margin_percentage))
          record.set('notes', commissionSaasText(body.notes, 4000))
          record.set('is_active', true)
          txApp.save(record)
          createdPolicy = record
        })
        return e.json(201, { ok: true, policyId: createdPolicy.id })
      } catch (error) {
        console.error('Falha ao versionar política SaaS:', error)
        return commissionSaasError(
          e,
          500,
          'POLICY_VERSION_FAILED',
          'A política não foi alterada. A transação foi revertida.',
        )
      }
    }

    if (action === 'exception-create') {
      if (!isAdmin)
        return commissionSaasError(
          e,
          403,
          'ADMIN_REQUIRED',
          'Somente administradores podem criar exceções.',
        )
      var exceptionSellerId = commissionSaasText(body.sellerId, 30)
      var exceptionType = body.exceptionType === 'fixed_value' ? 'fixed_value' : 'percentage'
      var appliesTo = body.appliesTo === 'recurring' ? 'recurring' : 'development'
      var reason = commissionSaasText(body.reason, 1000)
      if (!exceptionSellerId || !reason)
        return commissionSaasError(
          e,
          400,
          'INVALID_EXCEPTION',
          'Informe vendedor e justificativa da exceção.',
        )
      try {
        var seller = $app.findRecordById('users', exceptionSellerId)
        if (seller.getBool('disabled')) throw new Error('disabled')
        var exception = new Record($app.findCollectionByNameOrId('saas_commission_exceptions'))
        exception.set('seller', exceptionSellerId)
        exception.set('exception_type', exceptionType)
        exception.set(
          'percentage',
          exceptionType === 'percentage' ? commissionSaasFraction(body.percentage) : 0,
        )
        exception.set(
          'fixed_value_cents',
          exceptionType === 'fixed_value' ? commissionSaasInt(body.fixedValueCents) : 0,
        )
        exception.set('applies_to', appliesTo)
        if (body.validUntil) exception.set('valid_until', body.validUntil)
        exception.set('reason', reason)
        exception.set('approved_by', auth.id)
        exception.set('approved_at', new Date().toISOString())
        exception.set('is_active', true)
        $app.save(exception)
        return e.json(201, { ok: true, exceptionId: exception.id })
      } catch (error) {
        console.error('Falha ao criar exceção SaaS:', error)
        return commissionSaasError(e, 500, 'EXCEPTION_CREATE_FAILED', 'A exceção não foi criada.')
      }
    }

    if (action === 'commission-create') {
      var sellerId = isAdmin ? commissionSaasText(body.sellerId, 30) : auth.id
      var clientName = commissionSaasText(body.clientName, 200)
      var systemName = commissionSaasText(body.systemName, 200)
      var opportunityId = commissionSaasText(body.opportunityId, 30)
      var hostingModel = commissionSaasText(body.hostingModel, 40)
      var allowedModels = ['bit_cloud', 'client_cloud', 'client_cloud_support', 'hybrid']
      if (
        !clientName ||
        !systemName ||
        !sellerId ||
        commissionSaasInt(body.contractValueCents) <= 0
      ) {
        return commissionSaasError(
          e,
          400,
          'INVALID_COMMISSION',
          'Informe cliente, sistema, vendedor e valor contratado.',
        )
      }
      if (allowedModels.indexOf(hostingModel) < 0)
        return commissionSaasError(
          e,
          400,
          'INVALID_HOSTING_MODEL',
          'Modelo de hospedagem inválido.',
        )
      try {
        var targetSeller = $app.findRecordById('users', sellerId)
        if (targetSeller.getBool('disabled')) throw new Error('disabled')
      } catch (_) {
        return commissionSaasError(e, 400, 'INVALID_SELLER', 'O vendedor informado não está ativo.')
      }
      if (opportunityId) {
        if (!/^[a-zA-Z0-9]+$/.test(opportunityId))
          return commissionSaasError(e, 400, 'INVALID_OPPORTUNITY', 'Oportunidade inválida.')
        var opportunity
        try {
          opportunity = $app.findRecordById('opportunities', opportunityId)
        } catch (_) {
          return commissionSaasError(
            e,
            400,
            'INVALID_OPPORTUNITY',
            'A oportunidade não foi encontrada.',
          )
        }
        if (!isAdmin && opportunity.getString('seller') !== auth.id)
          return commissionSaasError(
            e,
            403,
            'OPPORTUNITY_SCOPE_DENIED',
            'A oportunidade não pertence ao vendedor autenticado.',
          )
        var duplicate = $app.findRecordsByFilter(
          'saas_commissions',
          "opportunity = '" + opportunityId + "' && status != 'cancelada' && status != 'estornada'",
          '-created',
          1,
          0,
        )
        if (duplicate.length)
          return commissionSaasError(
            e,
            409,
            'DUPLICATE_COMMISSION',
            'Esta oportunidade já possui uma comissão SaaS ativa.',
          )
      }
      var policy = commissionSaasActivePolicy($app)
      if (!policy)
        return commissionSaasError(
          e,
          409,
          'POLICY_MISSING',
          'Nenhuma política SaaS ativa foi encontrada.',
        )
      var calc = commissionSaasCalculate($app, body, policy, sellerId)
      var commissionId = ''
      var initialStatus = calc.requiresApproval ? 'pendente_aprovacao' : 'aprovada'
      try {
        $app.runInTransaction((txApp) => {
          var record = new Record(txApp.findCollectionByNameOrId('saas_commissions'))
          record.set('client_name', clientName)
          if (opportunityId) record.set('opportunity', opportunityId)
          record.set('seller', sellerId)
          record.set('system_name', systemName)
          record.set('system_description', commissionSaasText(body.systemDescription, 4000))
          record.set('hosting_model', hostingModel)
          record.set('list_value_cents', commissionSaasInt(body.listValueCents))
          record.set('discount_cents', commissionSaasInt(body.discountCents))
          record.set('contract_value_cents', commissionSaasInt(body.contractValueCents))
          record.set(
            'installments_count',
            Math.min(60, Math.max(1, commissionSaasInt(body.installmentsCount, 60))),
          )
          record.set('recurring_monthly_cents', commissionSaasInt(body.recurringMonthlyCents))
          record.set('recurring_percentage', Number(policy.get('recurring_percentage')) || 0)
          record.set('recurring_commissionable_months', calc.recurringEligibleMonths)
          record.set('development_commission_cents', calc.developmentCommissionCents)
          record.set('recurring_commission_potential_cents', calc.recurringCommissionPotentialCents)
          record.set('commission_type', calc.commissionType)
          record.set('dev_policy_version', policy.getInt('policy_version'))
          record.set('dev_policy_snapshot', {
            policy: commissionSaasPolicyPayload(policy),
            developmentExceptionId: calc.developmentExceptionId,
            recurringExceptionId: calc.recurringExceptionId,
          })
          if (calc.developmentExceptionId) record.set('exception', calc.developmentExceptionId)
          record.set('direct_costs_cents', commissionSaasInt(body.directCostsCents))
          record.set('recurring_costs_cents', commissionSaasInt(body.recurringCostsCents))
          record.set('taxes_cents', commissionSaasInt(body.taxesCents))
          record.set('margin_percentage', calc.marginPercentage)
          record.set('requires_approval', calc.requiresApproval)
          record.set('status', initialStatus)
          record.set('commercial_notes', commissionSaasText(body.commercialNotes, 4000))
          txApp.save(record)
          commissionId = record.id

          var plan = commissionSaasBuildPlan(body, calc)
          for (var index = 0; index < plan.length; index += 1) {
            var item = plan[index]
            var receivable = new Record(
              txApp.findCollectionByNameOrId('saas_commission_receivables'),
            )
            receivable.set('commission', record.id)
            receivable.set('seller', sellerId)
            receivable.set('kind', item.kind)
            receivable.set('installment_number', item.installmentNumber)
            receivable.set('amount_cents', item.amountCents)
            receivable.set('expected_date', item.expectedDate)
            receivable.set('received', false)
            txApp.save(receivable)
          }
          commissionSaasEvent(txApp, {
            commissionId: record.id,
            sellerId: sellerId,
            actorId: auth.id,
            eventType: 'created',
            amountCents: calc.totalPotentialCents,
            description:
              'Comissão SaaS criada com política v' +
              policy.getInt('policy_version') +
              '. Status inicial: ' +
              initialStatus +
              '.',
            metadata: {
              margin: calc.marginPercentage,
              policy: commissionSaasPolicyPayload(policy),
            },
          })
        })
        return e.json(201, {
          ok: true,
          commissionId: commissionId,
          status: initialStatus,
          calc: calc,
        })
      } catch (error) {
        console.error('Falha ao criar comissão SaaS:', error)
        return commissionSaasError(
          e,
          500,
          'COMMISSION_CREATE_FAILED',
          'A comissão não foi criada. A transação foi revertida.',
        )
      }
    }

    if (!isAdmin)
      return commissionSaasError(
        e,
        403,
        'ADMIN_REQUIRED',
        'Somente administradores podem executar esta operação financeira.',
      )

    if (action === 'commission-approve') {
      var approvalId = commissionSaasText(body.commissionId, 30)
      try {
        $app.runInTransaction((txApp) => {
          var commission = txApp.findRecordById('saas_commissions', approvalId)
          if (['pendente_aprovacao', 'simulada'].indexOf(commission.getString('status')) < 0)
            throw new Error('INVALID_STATUS')
          commission.set('status', 'aprovada')
          commission.set('approved_by', auth.id)
          commission.set('approved_at', new Date().toISOString())
          commission.set('approval_note', commissionSaasText(body.note, 2000))
          txApp.save(commission)
          commissionSaasEvent(txApp, {
            commissionId: commission.id,
            sellerId: commission.getString('seller'),
            actorId: auth.id,
            eventType: 'approved',
            description:
              commissionSaasText(body.note, 2000) || 'Aprovação administrativa registrada.',
          })
        })
        return e.json(200, { ok: true })
      } catch (error) {
        return commissionSaasError(
          e,
          409,
          'APPROVAL_FAILED',
          String(error).indexOf('INVALID_STATUS') >= 0
            ? 'A comissão não está pendente de aprovação.'
            : 'A aprovação não foi concluída.',
        )
      }
    }

    if (action === 'receivable-confirm') {
      var receivableId = commissionSaasText(body.receivableId, 30)
      var releasedCents = 0
      var newStatus = ''
      try {
        $app.runInTransaction((txApp) => {
          var receivable = txApp.findRecordById('saas_commission_receivables', receivableId)
          var commission = txApp.findRecordById(
            'saas_commissions',
            receivable.getString('commission'),
          )
          if (receivable.getBool('received')) {
            newStatus = commission.getString('status')
            return
          }
          if (['cancelada', 'estornada', 'paga'].indexOf(commission.getString('status')) >= 0)
            throw new Error('INVALID_STATUS')
          if (
            commission.getBool('requires_approval') &&
            commission.getString('status') === 'pendente_aprovacao'
          )
            throw new Error('APPROVAL_REQUIRED')
          var amount = commissionSaasInt(body.receivedAmountCents || receivable.get('amount_cents'))
          var key = commission.id + ':' + receivable.id + ':' + receivable.getString('kind')
          var existing = txApp.findRecordsByFilter(
            'saas_commission_releases',
            "idempotency_key = '" + key + "'",
            '-created',
            1,
            0,
          )
          if (existing.length) {
            newStatus = commission.getString('status')
            return
          }
          receivable.set('received', true)
          receivable.set('received_at', new Date().toISOString())
          receivable.set('received_amount_cents', amount)
          txApp.save(receivable)

          var kind = receivable.getString('kind')
          var lineTotal =
            kind === 'development'
              ? commission.getInt('contract_value_cents')
              : commission.getInt('recurring_monthly_cents') *
                commission.getInt('recurring_commissionable_months')
          var lineCommission =
            kind === 'development'
              ? commission.getInt('development_commission_cents')
              : commission.getInt('recurring_commission_potential_cents')
          var previousReleases = txApp.findRecordsByFilter(
            'saas_commission_releases',
            "commission = '" + commission.id + "' && kind = '" + kind + "'",
            '-created',
            500,
            0,
          )
          var alreadyReleased = 0
          for (var releaseIndex = 0; releaseIndex < previousReleases.length; releaseIndex += 1)
            alreadyReleased += previousReleases[releaseIndex].getInt('amount_cents')
          releasedCents = Math.min(
            Math.max(0, lineCommission - alreadyReleased),
            lineTotal > 0 ? Math.round((amount / lineTotal) * lineCommission) : 0,
          )
          if (releasedCents > 0) {
            var release = new Record(txApp.findCollectionByNameOrId('saas_commission_releases'))
            release.set('commission', commission.id)
            release.set('receivable', receivable.id)
            release.set('seller', commission.getString('seller'))
            release.set('kind', kind)
            release.set('amount_cents', releasedCents)
            release.set('idempotency_key', key)
            release.set('released_at', new Date().toISOString())
            txApp.save(release)
            commissionSaasEvent(txApp, {
              commissionId: commission.id,
              sellerId: commission.getString('seller'),
              actorId: auth.id,
              eventType: 'released',
              amountCents: releasedCents,
              receivableId: receivable.id,
              description: 'Comissão proporcional liberada após recebimento confirmado.',
            })
          }
          var allReleases = txApp.findRecordsByFilter(
            'saas_commission_releases',
            "commission = '" + commission.id + "'",
            '-created',
            1000,
            0,
          )
          var totalReleased = 0
          for (var totalIndex = 0; totalIndex < allReleases.length; totalIndex += 1)
            totalReleased += allReleases[totalIndex].getInt('amount_cents')
          var totalCommission =
            commission.getInt('development_commission_cents') +
            commission.getInt('recurring_commission_potential_cents')
          newStatus =
            totalReleased >= totalCommission ? 'disponivel_pagamento' : 'parcialmente_liberada'
          commission.set('status', newStatus)
          txApp.save(commission)
          commissionSaasEvent(txApp, {
            commissionId: commission.id,
            sellerId: commission.getString('seller'),
            actorId: auth.id,
            eventType: 'receivable_confirmed',
            amountCents: amount,
            receivableId: receivable.id,
            description: 'Recebimento confirmado pelo administrador.',
          })
        })
        return e.json(200, { ok: true, releasedCents: releasedCents, newStatus: newStatus })
      } catch (error) {
        var text = String(error)
        if (text.indexOf('APPROVAL_REQUIRED') >= 0)
          return commissionSaasError(
            e,
            409,
            'APPROVAL_REQUIRED',
            'A comissão precisa ser aprovada antes da liberação.',
          )
        return commissionSaasError(
          e,
          409,
          'RECEIVABLE_CONFIRM_FAILED',
          text.indexOf('INVALID_STATUS') >= 0
            ? 'O estado atual não permite recebimentos.'
            : 'O recebimento não foi confirmado.',
        )
      }
    }

    if (['commission-pay', 'commission-cancel', 'commission-reverse'].indexOf(action) >= 0) {
      var targetId = commissionSaasText(body.commissionId, 30)
      var targetStatus =
        action === 'commission-pay'
          ? 'paga'
          : action === 'commission-cancel'
            ? 'cancelada'
            : 'estornada'
      var eventType =
        action === 'commission-pay'
          ? 'paid'
          : action === 'commission-cancel'
            ? 'cancelled'
            : 'reversed'
      try {
        $app.runInTransaction((txApp) => {
          var target = txApp.findRecordById('saas_commissions', targetId)
          var currentStatus = target.getString('status')
          if (action === 'commission-pay' && currentStatus !== 'disponivel_pagamento')
            throw new Error('INVALID_STATUS')
          if (action === 'commission-cancel' && currentStatus === 'paga')
            throw new Error('USE_REVERSAL')
          if (['cancelada', 'estornada'].indexOf(currentStatus) >= 0)
            throw new Error('INVALID_STATUS')
          target.set('status', targetStatus)
          txApp.save(target)
          commissionSaasEvent(txApp, {
            commissionId: target.id,
            sellerId: target.getString('seller'),
            actorId: auth.id,
            eventType: eventType,
            amountCents: action === 'commission-pay' ? commissionSaasInt(body.amountCents) : 0,
            description:
              commissionSaasText(body.reason || body.note, 2000) ||
              'Operação financeira registrada.',
            metadata: { previousStatus: currentStatus, newStatus: targetStatus },
          })
        })
        return e.json(200, { ok: true })
      } catch (error) {
        var actionError = String(error)
        return commissionSaasError(
          e,
          409,
          'STATUS_CHANGE_FAILED',
          actionError.indexOf('USE_REVERSAL') >= 0
            ? 'Comissão paga deve ser estornada, não cancelada.'
            : 'A alteração de status não foi concluída.',
        )
      }
    }

    return commissionSaasError(e, 404, 'UNKNOWN_ACTION', 'Operação SaaS não reconhecida.')
  },
  $apis.requireAuth(),
)
