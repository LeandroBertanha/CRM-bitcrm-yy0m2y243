migrate(
  (app) => {
    const usersCollectionId = '_pb_users_auth_'
    const opportunitiesCollection = app.findCollectionByNameOrId('opportunities')
    const adminRule = "@request.auth.id != '' && @request.auth.role = 'admin'"

    const findOrCreateCollection = (name, definition) => {
      try {
        return app.findCollectionByNameOrId(name)
      } catch (_) {
        const collection = new Collection({ name, type: 'base', ...definition })
        app.save(collection)
        return collection
      }
    }

    const settingsCollection = findOrCreateCollection('sdr_settings', {
      listRule: adminRule,
      viewRule: adminRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'enabled', type: 'bool', required: false },
        { name: 'allow_existing_opportunity_update', type: 'bool', required: false },
        { name: 'allow_opportunity_creation', type: 'bool', required: false },
        { name: 'require_human_confirmation', type: 'bool', required: false },
        {
          name: 'environment',
          type: 'select',
          required: true,
          values: ['homologacao', 'producao'],
          maxSelect: 1,
        },
        {
          name: 'created_by',
          type: 'relation',
          required: false,
          collectionId: usersCollectionId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'notes', type: 'text', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    const campaignsCollection = findOrCreateCollection('sdr_campaigns', {
      listRule: adminRule,
      viewRule: adminRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'rascunho',
            'em_revisao',
            'aprovada',
            'ativa',
            'pausada',
            'concluida',
            'cancelada',
          ],
          maxSelect: 1,
        },
        { name: 'description', type: 'text', required: false },
        {
          name: 'channel',
          type: 'select',
          required: true,
          values: ['whatsapp'],
          maxSelect: 1,
        },
        {
          name: 'created_by',
          type: 'relation',
          required: true,
          collectionId: usersCollectionId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'owner',
          type: 'relation',
          required: false,
          collectionId: usersCollectionId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'starts_at', type: 'date', required: false },
        { name: 'ends_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sdr_campaigns_status ON sdr_campaigns (status)',
        'CREATE INDEX idx_sdr_campaigns_owner ON sdr_campaigns (owner)',
      ],
    })

    const contactsCollection = findOrCreateCollection('sdr_campaign_contacts', {
      listRule: adminRule,
      viewRule: adminRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'campaign',
          type: 'relation',
          required: true,
          collectionId: campaignsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'opportunity',
          type: 'relation',
          required: false,
          collectionId: opportunitiesCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'company_name', type: 'text', required: true },
        { name: 'contact_name', type: 'text', required: false },
        { name: 'contact_email', type: 'email', required: false },
        { name: 'contact_phone', type: 'text', required: false },
        {
          name: 'owner',
          type: 'relation',
          required: false,
          collectionId: usersCollectionId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'em_revisao', 'aprovado', 'processando', 'concluido', 'falhou'],
          maxSelect: 1,
        },
        { name: 'deduplication_key', type: 'text', required: true },
        { name: 'requires_human_review', type: 'bool', required: false },
        { name: 'source_snapshot', type: 'json', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sdr_contacts_campaign ON sdr_campaign_contacts (campaign)',
        'CREATE INDEX idx_sdr_contacts_opportunity ON sdr_campaign_contacts (opportunity)',
        'CREATE INDEX idx_sdr_contacts_dedup ON sdr_campaign_contacts (deduplication_key)',
      ],
    })

    findOrCreateCollection('sdr_messages', {
      listRule: adminRule,
      viewRule: adminRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'campaign',
          type: 'relation',
          required: true,
          collectionId: campaignsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'opportunity',
          type: 'relation',
          required: false,
          collectionId: opportunitiesCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'direction',
          type: 'select',
          required: true,
          values: ['outbound', 'inbound'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: [
            'preparada',
            'aguardando_confirmacao',
            'enviando',
            'enviada',
            'entregue',
            'falhou',
          ],
          maxSelect: 1,
        },
        { name: 'template_name', type: 'text', required: false },
        { name: 'body', type: 'text', required: true },
        { name: 'provider_message_id', type: 'text', required: false },
        { name: 'correlation_id', type: 'text', required: true },
        { name: 'error_code', type: 'text', required: false },
        { name: 'error_message', type: 'text', required: false },
        { name: 'attempt_count', type: 'number', required: false, onlyInt: true, min: 0 },
        { name: 'sent_at', type: 'date', required: false },
        { name: 'delivered_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sdr_messages_contact ON sdr_messages (contact)',
        'CREATE INDEX idx_sdr_messages_correlation ON sdr_messages (correlation_id)',
      ],
    })

    findOrCreateCollection('sdr_scores', {
      listRule: adminRule,
      viewRule: adminRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'campaign',
          type: 'relation',
          required: true,
          collectionId: campaignsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'opportunity',
          type: 'relation',
          required: false,
          collectionId: opportunitiesCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'score', type: 'number', required: true, min: 0, max: 100 },
        { name: 'rationale', type: 'text', required: true },
        { name: 'model_name', type: 'text', required: true },
        { name: 'calculated_at', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE INDEX idx_sdr_scores_contact ON sdr_scores (contact)'],
    })

    findOrCreateCollection('sdr_tasks', {
      listRule: adminRule,
      viewRule: adminRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'campaign',
          type: 'relation',
          required: true,
          collectionId: campaignsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'contact',
          type: 'relation',
          required: true,
          collectionId: contactsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'opportunity',
          type: 'relation',
          required: false,
          collectionId: opportunitiesCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'assigned_to',
          type: 'relation',
          required: false,
          collectionId: usersCollectionId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text', required: false },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'em_andamento', 'concluida', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'due_at', type: 'date', required: false },
        { name: 'completed_at', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_sdr_tasks_assigned ON sdr_tasks (assigned_to)',
        'CREATE INDEX idx_sdr_tasks_due ON sdr_tasks (due_at)',
      ],
    })

    findOrCreateCollection('sdr_audit_logs', {
      listRule: adminRule,
      viewRule: adminRule,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'campaign',
          type: 'relation',
          required: false,
          collectionId: campaignsCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'opportunity',
          type: 'relation',
          required: false,
          collectionId: opportunitiesCollection.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'actor_user',
          type: 'relation',
          required: false,
          collectionId: usersCollectionId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'actor_type',
          type: 'select',
          required: true,
          values: ['user', 'ai', 'system'],
          maxSelect: 1,
        },
        { name: 'agent_name', type: 'text', required: false },
        { name: 'operation', type: 'text', required: true },
        { name: 'target_collection', type: 'text', required: true },
        { name: 'target_record_id', type: 'text', required: false },
        {
          name: 'result',
          type: 'select',
          required: true,
          values: ['success', 'rejected', 'error'],
          maxSelect: 1,
        },
        { name: 'metadata', type: 'json', required: false },
        { name: 'previous_value', type: 'json', required: false },
        { name: 'new_value', type: 'json', required: false },
        { name: 'error_message', type: 'text', required: false },
        { name: 'correlation_id', type: 'text', required: true },
        { name: 'event_at', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE INDEX idx_sdr_audit_event ON sdr_audit_logs (event_at DESC)',
        'CREATE INDEX idx_sdr_audit_correlation ON sdr_audit_logs (correlation_id)',
      ],
    })

    try {
      app.findFirstRecordByData('sdr_settings', 'environment', 'homologacao')
    } catch (_) {
      const settings = new Record(settingsCollection)
      settings.set('enabled', false)
      settings.set('allow_existing_opportunity_update', false)
      settings.set('allow_opportunity_creation', false)
      settings.set('require_human_confirmation', true)
      settings.set('environment', 'homologacao')
      settings.set(
        'notes',
        'Fundacao SDR criada desativada. A ativacao exige backup restaurado, homologacao aprovada e liberacao administrativa explicita.',
      )
      app.save(settings)
    }
  },
  () => {
    // Rollback intencionalmente nao destrutivo. A remocao dessas colecoes exige
    // aprovacao explicita e validacao previa de backup/restauracao.
  },
)
