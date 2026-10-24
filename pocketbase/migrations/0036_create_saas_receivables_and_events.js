migrate(
  (app) => {
    // ============================================================
    // 0036 — EXPANSÃO COMISSIONAMENTO SaaS (Fase 3/4)
    // Cria saas_commission_receivables (parcelas e mensalidades)
    // e saas_commission_events (auditoria append-only).
    // ADDITIVE ONLY: não altera coleções existentes.
    // ============================================================
    const ADMIN_RULE =
      "@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com'"
    const AUTH = "@request.auth.id != ''"

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const commissionsCol = app.findCollectionByNameOrId('saas_commissions')

    // ------------------------------------------------------------
    // 1. saas_commission_receivables — parcelas do desenvolvimento
    //    e mensalidades elegíveis
    // ------------------------------------------------------------
    let receivablesCol
    try {
      receivablesCol = app.findCollectionByNameOrId('saas_commission_receivables')
    } catch (_) {
      receivablesCol = new Collection({
        name: 'saas_commission_receivables',
        type: 'base',
        // Vendedor vê recebíveis das próprias comissões; admin vê todos
        listRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        viewRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        // Confirmação de recebimento: vendedor da comissão ou admin (validado no serviço)
        updateRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        createRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        // Recebíveis financeiros NUNCA são excluídos (auditabilidade)
        deleteRule: ADMIN_RULE,
        fields: [
          {
            name: 'commission',
            type: 'relation',
            required: true,
            collectionId: commissionsCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'seller',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          // 'development' = parcela do desenvolvimento; 'recurring' = mensalidade elegível
          {
            name: 'kind',
            type: 'select',
            required: true,
            values: ['development', 'recurring'],
            maxSelect: 1,
          },
          { name: 'installment_number', type: 'number', required: true, onlyInt: true }, // 1..N
          { name: 'amount_cents', type: 'number', required: true }, // valor da parcela/mensalidade em centavos
          { name: 'expected_date', type: 'date', required: false }, // data prevista do recebimento
          { name: 'received_at', type: 'date', required: false }, // preenchido quando confirmado
          { name: 'received', type: 'bool', required: false },
          { name: 'received_amount_cents', type: 'number', required: false }, // recebido parcialmente
          { name: 'notes', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_saas_receivables_commission ON saas_commission_receivables (commission)',
          'CREATE INDEX idx_saas_receivables_seller ON saas_commission_receivables (seller)',
          'CREATE INDEX idx_saas_receivables_received ON saas_commission_receivables (received)',
        ],
      })
      app.save(receivablesCol)
    }

    // ------------------------------------------------------------
    // 2. saas_commission_events — auditoria append-only
    //    (criação, aprovação, liberação, pagamento, cancelamento, estorno)
    // ------------------------------------------------------------
    let eventsCol
    try {
      eventsCol = app.findCollectionByNameOrId('saas_commission_events')
    } catch (_) {
      eventsCol = new Collection({
        name: 'saas_commission_events',
        type: 'base',
        // Mesmo acesso dos recebíveis; registros nunca são alterados nem excluídos
        listRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        viewRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        createRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        updateRule: '',
        deleteRule: '',
        fields: [
          {
            name: 'commission',
            type: 'relation',
            required: true,
            collectionId: commissionsCol.id,
            maxSelect: 1,
            cascadeDelete: true,
          },
          {
            name: 'seller',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'actor',
            type: 'relation',
            required: false,
            collectionId: usersCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'event_type',
            type: 'select',
            required: true,
            values: [
              'created',
              'approved',
              'approval_rejected',
              'receivable_confirmed',
              'released',
              'paid',
              'cancelled',
              'reversed',
              'adjusted',
            ],
            maxSelect: 1,
          },
          { name: 'amount_cents', type: 'number', required: false }, // valor envolvido (liberação/pagamento)
          {
            name: 'receivable',
            type: 'relation',
            required: false,
            collectionId: receivablesCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          { name: 'description', type: 'text', required: false },
          { name: 'metadata', type: 'json', required: false }, // snapshot do estado anterior
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_saas_events_commission ON saas_commission_events (commission)',
          'CREATE INDEX idx_saas_events_type ON saas_commission_events (event_type)',
        ],
      })
      app.save(eventsCol)
    }
  },
  (app) => {
    try {
      const e = app.findCollectionByNameOrId('saas_commission_events')
      app.delete(e)
    } catch (_) {}
    try {
      const r = app.findCollectionByNameOrId('saas_commission_receivables')
      app.delete(r)
    } catch (_) {}
  },
)
