migrate(
  (app) => {
    const AUTH = "@request.auth.id != ''"
    const ADMIN =
      "(@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"
    const SCOPE = `(seller = @request.auth.id || ${ADMIN})`

    let clients
    try {
      clients = app.findCollectionByNameOrId('clients')
    } catch (_) {
      const users = app.findCollectionByNameOrId('users')
      const opportunities = app.findCollectionByNameOrId('opportunities')
      const products = app.findCollectionByNameOrId('products')
      const documentMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ]

      clients = new Collection({
        name: 'clients',
        type: 'base',
        listRule: `${AUTH} && ${SCOPE}`,
        viewRule: `${AUTH} && ${SCOPE}`,
        createRule: `${AUTH} && (seller = @request.auth.id || ${ADMIN})`,
        updateRule: `${AUTH} && ${SCOPE}`,
        // O histórico de clientes não pode ser apagado pela interface.
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true, max: 240 },
          { name: 'legal_name', type: 'text', required: false, max: 240 },
          { name: 'cnpj', type: 'text', required: false, max: 14 },
          { name: 'state_registration', type: 'text', required: false, max: 40 },
          { name: 'contact_name', type: 'text', required: false, max: 200 },
          { name: 'contact_email', type: 'email', required: false },
          { name: 'contact_phone', type: 'text', required: false, max: 30 },
          { name: 'zip_code', type: 'text', required: false, max: 8 },
          { name: 'street', type: 'text', required: false, max: 240 },
          { name: 'address_number', type: 'text', required: false, max: 30 },
          { name: 'complement', type: 'text', required: false, max: 120 },
          { name: 'district', type: 'text', required: false, max: 120 },
          { name: 'city', type: 'text', required: false, max: 120 },
          { name: 'state', type: 'text', required: false, max: 2 },
          {
            name: 'seller',
            type: 'relation',
            required: false,
            collectionId: users.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'source_opportunity',
            type: 'relation',
            required: true,
            collectionId: opportunities.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'product',
            type: 'relation',
            required: false,
            collectionId: products.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'product_name', type: 'text', required: false, max: 240 },
          { name: 'setup_value', type: 'number', required: false, min: 0 },
          { name: 'recurring_value', type: 'number', required: false, min: 0 },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['Ativo', 'Implantacao', 'Inativo'],
          },
          { name: 'notes', type: 'text', required: false, max: 5000 },
          { name: 'won_at', type: 'date', required: false },
          {
            name: 'contract_files',
            type: 'file',
            required: false,
            maxSelect: 10,
            maxSize: 20971520,
            mimeTypes: documentMimeTypes,
            protected: true,
          },
          {
            name: 'proposal_files',
            type: 'file',
            required: false,
            maxSelect: 10,
            maxSize: 20971520,
            mimeTypes: documentMimeTypes,
            protected: true,
          },
          {
            name: 'cnpj_card_files',
            type: 'file',
            required: false,
            maxSelect: 5,
            maxSize: 20971520,
            mimeTypes: documentMimeTypes,
            protected: true,
          },
          {
            name: 'other_files',
            type: 'file',
            required: false,
            maxSelect: 10,
            maxSize: 20971520,
            mimeTypes: documentMimeTypes,
            protected: true,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_clients_source_opportunity ON clients (source_opportunity)',
          "CREATE INDEX idx_clients_cnpj ON clients (cnpj) WHERE cnpj != ''",
          'CREATE INDEX idx_clients_seller ON clients (seller)',
          'CREATE INDEX idx_clients_status ON clients (status)',
        ],
      })
      app.save(clients)
    }
  },
  () => {
    // Rollback intencionalmente não destrutivo para preservar clientes e documentos.
  },
)
