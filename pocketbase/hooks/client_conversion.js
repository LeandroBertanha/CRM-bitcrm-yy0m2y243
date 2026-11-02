/**
 * Converte oportunidades ganhas em clientes sem duplicar registros e
 * gerencia movimentação de estágio com histórico e permissões.
 *
 * OBSERVAÇÃO CRÍTICA DE ESCOPO DO POCKETBASE (Goja):
 * Callbacks do routerAdd e eventos rodam em JSVMs isoladas. Nenhuma função
 * ou variável declarada no escopo raiz (top-level) pode ser acessada dentro
 * dos callbacks. Portanto, todas as funções auxiliares DEVEM ser declaradas
 * inline dentro de cada callback.
 */

routerAdd(
  'POST',
  '/backend/v1/opportunities/{id}/stage',
  (e) => {
    var auth = e.auth
    if (!auth) return e.json(401, { success: false, error: 'Não autenticado.' })

    function cleanText(value, maxLength) {
      return String(value || '')
        .trim()
        .slice(0, maxLength)
    }

    function isAdmin(authRecord) {
      if (!authRecord) return false
      var email = authRecord.getString('email').trim().toLowerCase()
      return (
        authRecord.getString('role') === 'admin' ||
        email === 'leandro.bertanha@lbertanha.com' ||
        email === 'leandro.bertanha@gmail.com'
      )
    }

    function findClient(appInstance, oppId) {
      try {
        return appInstance.findFirstRecordByData('clients', 'source_opportunity', oppId)
      } catch (_) {
        return null
      }
    }

    function ensureClient(appInstance, oppRecord) {
      var client = findClient(appInstance, oppRecord.id)
      var created = false

      if (!client) {
        client = new Record(appInstance.findCollectionByNameOrId('clients'))
        client.set('source_opportunity', oppRecord.id)
        client.set('status', 'Implantacao')
        client.set('won_at', new Date().toISOString())
        created = true
      }

      client.set('name', cleanText(oppRecord.getString('company'), 240))
      client.set('seller', oppRecord.getString('seller'))
      client.set('product', oppRecord.getString('product'))
      client.set('product_name', cleanText(oppRecord.getString('product_name'), 240))
      client.set('setup_value', Number(oppRecord.get('value')) || 0)
      client.set('recurring_value', Number(oppRecord.get('recurring_value')) || 0)

      if (!client.getString('contact_name')) {
        client.set('contact_name', cleanText(oppRecord.getString('contact_name'), 200))
      }
      if (!client.getString('contact_email')) {
        client.set('contact_email', cleanText(oppRecord.getString('contact_email'), 240))
      }
      if (!client.getString('contact_phone')) {
        client.set('contact_phone', cleanText(oppRecord.getString('contact_phone'), 30))
      }
      if (!client.getString('city')) {
        client.set('city', cleanText(oppRecord.getString('city'), 120))
      }

      appInstance.save(client)
      return { record: client, created: created }
    }

    function clientPayload(record) {
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

    function recordHistoryEntries(appInstance, oppRecord, oldStage, newStage, actorId) {
      var nowIso = new Date().toISOString()
      var oppId = oppRecord.id
      var sellerId = oppRecord.getString('seller') || actorId

      // 1. Registro na timeline (opportunity_notes)
      try {
        var notesCol = appInstance.findCollectionByNameOrId('opportunity_notes')
        var note = new Record(notesCol)
        note.set('opportunity', oppId)
        note.set('author', actorId)
        note.set('type', 'outro')
        note.set(
          'text',
          '[Mudança de estágio] Estágio alterado de "' + oldStage + '" para "' + newStage + '".',
        )
        note.set('date', nowIso)
        appInstance.save(note)
      } catch (noteErr) {
        console.warn('Aviso: Falha ao registrar nota em opportunity_notes:', noteErr)
      }

      // 2. Registro no Histórico de Abordagens (approach_sessions)
      try {
        var sessionsCol = appInstance.findCollectionByNameOrId('approach_sessions')
        var session = new Record(sessionsCol)
        session.set('seller', sellerId)
        session.set('opportunity', oppId)
        session.set('company_name', oppRecord.getString('company'))
        session.set('contact_name', oppRecord.getString('contact_name'))
        session.set('contact_phone', oppRecord.getString('contact_phone'))
        session.set('city', oppRecord.getString('city'))
        session.set('channel', 'Retorno')

        var approachStatus = 'Contato realizado'
        var leadTemp = 'morno'
        if (newStage === 'Ganho') {
          approachStatus = 'Fechado'
          leadTemp = 'quente'
        } else if (newStage === 'Perdido') {
          approachStatus = 'Perdido'
          leadTemp = 'frio'
        } else if (newStage === 'Proposta') {
          approachStatus = 'Proposta enviada'
          leadTemp = 'quente'
        } else if (newStage === 'Agendado') {
          approachStatus = 'Retorno agendado'
          leadTemp = 'morno'
        } else if (newStage === 'Qualificado') {
          approachStatus = 'Interessado'
          leadTemp = 'morno'
        } else if (newStage === 'Novo') {
          approachStatus = 'Não abordado'
          leadTemp = 'frio'
        }

        session.set('status', approachStatus)
        session.set('temperature', leadTemp)
        session.set(
          'temperature_reason',
          'Estágio alterado no Kanban: ' + oldStage + ' → ' + newStage,
        )
        session.set('next_action', 'Acompanhamento do estágio ' + newStage)
        session.set(
          'notes',
          'Movimentação de estágio no Kanban: de ' + oldStage + ' para ' + newStage + '.',
        )
        session.set('questions_asked', JSON.stringify([]))
        session.set('answers', JSON.stringify([]))
        session.set('objections', JSON.stringify([]))
        session.set('quick_tags', JSON.stringify(['Kanban', 'Mudança de Estágio', newStage]))
        appInstance.save(session)
      } catch (sessErr) {
        console.warn('Aviso: Falha ao registrar sessão em approach_sessions:', sessErr)
      }
    }

    var opportunityId = cleanText(e.request.pathValue('id'), 40)
    var body = e.requestInfo().body || {}
    var stage = cleanText(body.stage, 40)
    var allowedStages = ['Novo', 'Qualificado', 'Agendado', 'Proposta', 'Ganho', 'Perdido']
    if (allowedStages.indexOf(stage) === -1) {
      return e.json(400, { success: false, error: 'Estágio inválido: ' + stage })
    }

    var current
    try {
      current = $app.findRecordById('opportunities', opportunityId)
    } catch (_) {
      return e.json(404, { success: false, error: 'Oportunidade não encontrada.' })
    }

    var sellerId = current.getString('seller')
    // Vendedor só move a própria oportunidade (ou oportunidade sem vendedor atribuído), admin move qualquer uma
    if (sellerId && sellerId !== auth.id && !isAdmin(auth)) {
      return e.json(403, {
        success: false,
        error:
          'Você não tem permissão para mover esta oportunidade porque ela pertence a outro vendedor.',
      })
    }

    var oldStage = current.getString('stage')
    var result = null

    try {
      $app.runInTransaction((txApp) => {
        var opportunity = txApp.findRecordById('opportunities', opportunityId)
        opportunity.set('stage', stage)
        txApp.save(opportunity)

        // Se o estágio mudou, grava no histórico de abordagens e timeline
        if (oldStage !== stage) {
          recordHistoryEntries(txApp, opportunity, oldStage, stage, auth.id)
        }

        var conversion = null
        if (stage === 'Ganho') {
          conversion = ensureClient(txApp, opportunity)
        }

        result = {
          opportunity: opportunity,
          client: conversion ? conversion.record : findClient(txApp, opportunity.id),
          clientCreated: conversion ? conversion.created : false,
        }
      })
    } catch (error) {
      console.error('Falha ao alterar estágio e converter cliente:', error)
      return e.json(500, {
        success: false,
        error:
          'Não foi possível salvar o estágio da oportunidade: ' + (error.message || String(error)),
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
      client: clientPayload(result.client),
      clientCreated: result.clientCreated,
    })
  },
  $apis.requireAuth(),
)

// Rede de segurança para integrações que ainda escrevam o estágio diretamente.
onRecordAfterCreateSuccess((e) => {
  if (e.record.getString('stage') === 'Ganho') {
    try {
      var appInstance = e.app || $app
      var oppRecord = e.record
      var existing = null
      try {
        existing = appInstance.findFirstRecordByData('clients', 'source_opportunity', oppRecord.id)
      } catch (_) {}

      if (!existing) {
        var client = new Record(appInstance.findCollectionByNameOrId('clients'))
        client.set('source_opportunity', oppRecord.id)
        client.set('status', 'Implantacao')
        client.set('won_at', new Date().toISOString())
        client.set('name', String(oppRecord.getString('company') || '').slice(0, 240))
        client.set('seller', oppRecord.getString('seller'))
        client.set('product', oppRecord.getString('product'))
        client.set('product_name', String(oppRecord.getString('product_name') || '').slice(0, 240))
        client.set('setup_value', Number(oppRecord.get('value')) || 0)
        client.set('recurring_value', Number(oppRecord.get('recurring_value')) || 0)
        client.set('contact_name', String(oppRecord.getString('contact_name') || '').slice(0, 200))
        client.set(
          'contact_email',
          String(oppRecord.getString('contact_email') || '').slice(0, 240),
        )
        client.set('contact_phone', String(oppRecord.getString('contact_phone') || '').slice(0, 30))
        client.set('city', String(oppRecord.getString('city') || '').slice(0, 120))
        appInstance.save(client)
      }
    } catch (error) {
      console.error('Falha ao converter oportunidade ganha após criação:', error)
    }
  }
  e.next()
}, 'opportunities')

onRecordAfterUpdateSuccess((e) => {
  if (e.record.getString('stage') === 'Ganho') {
    try {
      var appInstance = e.app || $app
      var oppRecord = e.record
      var existing = null
      try {
        existing = appInstance.findFirstRecordByData('clients', 'source_opportunity', oppRecord.id)
      } catch (_) {}

      if (!existing) {
        var client = new Record(appInstance.findCollectionByNameOrId('clients'))
        client.set('source_opportunity', oppRecord.id)
        client.set('status', 'Implantacao')
        client.set('won_at', new Date().toISOString())
        client.set('name', String(oppRecord.getString('company') || '').slice(0, 240))
        client.set('seller', oppRecord.getString('seller'))
        client.set('product', oppRecord.getString('product'))
        client.set('product_name', String(oppRecord.getString('product_name') || '').slice(0, 240))
        client.set('setup_value', Number(oppRecord.get('value')) || 0)
        client.set('recurring_value', Number(oppRecord.get('recurring_value')) || 0)
        client.set('contact_name', String(oppRecord.getString('contact_name') || '').slice(0, 200))
        client.set(
          'contact_email',
          String(oppRecord.getString('contact_email') || '').slice(0, 240),
        )
        client.set('contact_phone', String(oppRecord.getString('contact_phone') || '').slice(0, 30))
        client.set('city', String(oppRecord.getString('city') || '').slice(0, 120))
        appInstance.save(client)
      }
    } catch (error) {
      console.error('Falha ao converter oportunidade ganha após atualização:', error)
    }
  }
  e.next()
}, 'opportunities')
