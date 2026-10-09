migrate(
  (app) => {
    // 1. Criar coleção whatsapp_settings para configurações de templates e limites
    // Regras: list e view liberados para autenticados; create, update, delete apenas para admin
    const col = new Collection({
      name: 'whatsapp_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'initial_template_name', type: 'text' },
        { name: 'initial_template_language', type: 'text' },
        { name: 'followup_template_name', type: 'text' },
        { name: 'followup_template_language', type: 'text' },
        { name: 'throttle_ms', type: 'number', min: 100, max: 10000 },
        { name: 'max_batch_size', type: 'number', min: 1, max: 200 },
        { name: 'is_active', type: 'bool' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    app.save(col)

    // 2. Inserir registro inicial de configuração
    const record = new Record(col)
    record.set('initial_template_name', 'bit_abordagem_inicial')
    record.set('initial_template_language', 'pt_BR')
    record.set('followup_template_name', 'bit_followup_comercial')
    record.set('followup_template_language', 'pt_BR')
    record.set('throttle_ms', 1000)
    record.set('max_batch_size', 50)
    record.set('is_active', true)
    record.set(
      'notes',
      'Configurações de templates Meta WhatsApp Cloud API e taxa padrão (1 mensagem/segundo).',
    )
    app.save(record)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('whatsapp_settings')
      app.delete(col)
    } catch (_) {}
  },
)
