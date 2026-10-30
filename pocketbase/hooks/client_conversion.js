/**
 * Converte oportunidades ganhas em clientes sem duplicar registros.
 * A rota concentra a mudança de estágio e a criação do cliente na mesma transação.
 */

function clientConversionIsAdmin(auth) {
  if (!auth) return false
  var email = auth.getString('email').trim().toLowerCase()
  return (
    auth.getString('role') === 'admin' ||
    email === 'leandro.bertanha@lbertanha.com' ||
    email === 'leandro.bertanha@gmail.com'
  )
}

function clientConversionText(value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function clientConversionFind(app, opportunityId) {
  try {
    return app.findFirstRecordByData('clients', 'source_opportunity', opportunityId)
  } catch (_) {
    return null
  }
}

function clientConversionEnsure(app, opportunity) {
  var client = clientConversionFind(app, opportunity.id)
  var created = false

  if (!client) {
    client = new Record(app.findCollectionByNameOrId('clients'))
    client.set('source_opportunity', opportunity.id)
    client.set('status', 'Implantacao')
    client.set('won_at', new Date().toISOString())
    created = true
  }

  // Mantém os dados comerciais sincronizados, sem apagar dados fiscais ou documentos.
  client.set('name', clientConversionText(opportunity.getString('company'), 240))
  client.set('seller', opportunity.getString('seller'))
  client.set('product', opportunity.getString('product'))
  client.set('product_name', clientConversionText(opportunity.getString('product_name'), 240))
  client.set('setup_value', Number(opportunity.get('value')) || 0)
  client.set('recurring_value', Number(opportunity.get('recurring_value')) || 0)

  if (!client.getString('contact_name')) {
    client.set('contact_name', clientConversionText(opportunity.getString('contact_name'), 200))
  }
  if (!client.getString('contact_email')) {
    client.set('contact_email', clientConversionText(opportunity.getString('contact_email'), 240))
  }
  if (!client.getString('contact_phone')) {
    client.set('contact_phone', clientConversionText(opportunity.getString('contact_phone'), 30))
  }
  if (!client.getString('city')) {
    client.set('city', clientConversionText(opportunity.getString('city'), 120))
  }

  app.save(client)
  return { record: client, created: created }
}

function clientConversionRecordPayload(record) {
  if (!record) return null
  return {
    id: record.id,
    collectionId: record.collection().id,
    collectionName: record.collection().name,
    created: record.getString('created'),
    updated: record.getString('updated'),
    name: record.getString('name'),
    legal_name: record.getString('legal_name'),
    cnpj: record.getString('cnpj'),
    contact_name: record.getString('contact_name'),
    contact_email: record.getString('contact_email'),
    contact_phone: record.getString('contact_phone'),
    city: record.getString('city'),
    state: record.getString('state'),
    seller: record.getString('seller'),
    source_opportunity: record.getString('source_opportunity'),
    product: record.getString('product'),
    product_name: record.getString('product_name'),
    setup_value: Number(record.get('setup_value')) || 0,
    recurring_value: Number(record.get('recurring_value')) || 0,
    status: record.getString('status'),
    won_at: record.getString('won_at'),
  }
}

routerAdd(
  'POST',
  '/backend/v1/opportunities/{id}/stage',
  (e) => {
    var auth = e.auth
    if (!auth) return e.json(401, { success: false, error: 'Não autenticado.' })

    var opportunityId = clientConversionText(e.request.pathValue('id'), 40)
    var body = e.requestInfo().body || {}
    var stage = clientConversionText(body.stage, 40)
    var allowedStages = ['Novo', 'Qualificado', 'Agendado', 'Proposta', 'Ganho', 'Perdido']
    if (allowedStages.indexOf(stage) === -1) {
      return e.json(400, { success: false, error: 'Estágio inválido.' })
    }

    var current
    try {
      current = $app.findRecordById('opportunities', opportunityId)
    } catch (_) {
      return e.json(404, { success: false, error: 'Oportunidade não encontrada.' })
    }

    if (current.getString('seller') !== auth.id && !clientConversionIsAdmin(auth)) {
      return e.json(403, { success: false, error: 'Sem permissão para alterar esta oportunidade.' })
    }

    var result = null
    try {
      $app.runInTransaction((txApp) => {
        var opportunity = txApp.findRecordById('opportunities', opportunityId)
        opportunity.set('stage', stage)
        txApp.save(opportunity)

        var conversion = null
        if (stage === 'Ganho') conversion = clientConversionEnsure(txApp, opportunity)
        result = {
          opportunity: opportunity,
          client: conversion ? conversion.record : clientConversionFind(txApp, opportunity.id),
          clientCreated: conversion ? conversion.created : false,
        }
      })
    } catch (error) {
      console.error('Falha ao alterar estágio e converter cliente:', error)
      return e.json(500, {
        success: false,
        error: 'Não foi possível salvar o estágio e o cadastro do cliente.',
      })
    }

    return e.json(200, {
      success: true,
      opportunity: {
        id: result.opportunity.id,
        company: result.opportunity.getString('company'),
        stage: result.opportunity.getString('stage'),
        seller: result.opportunity.getString('seller'),
      },
      client: clientConversionRecordPayload(result.client),
      clientCreated: result.clientCreated,
    })
  },
  $apis.requireAuth(),
)

// Rede de segurança para integrações que ainda escrevam o estágio diretamente.
onRecordAfterCreateSuccess((e) => {
  if (e.record.getString('stage') === 'Ganho') {
    try {
      clientConversionEnsure(e.app || $app, e.record)
    } catch (error) {
      console.error('Falha ao converter oportunidade ganha após criação:', error)
    }
  }
  e.next()
}, 'opportunities')

onRecordAfterUpdateSuccess((e) => {
  if (e.record.getString('stage') === 'Ganho') {
    try {
      clientConversionEnsure(e.app || $app, e.record)
    } catch (error) {
      console.error('Falha ao converter oportunidade ganha após atualização:', error)
    }
  }
  e.next()
}, 'opportunities')
