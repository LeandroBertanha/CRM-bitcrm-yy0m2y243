migrate(
  (app) => {
    // ============================================================
    // 0037 — EXPANSÃO COMISSIONAMENTO SaaS (Fase 4/4)
    // Cria saas_commission_releases: liberação proporcional de
    // comissão por recebimento confirmado, idempotente.
    // ADDITIVE ONLY: não altera coleções existentes.
    // ============================================================
    const ADMIN_RULE =
      "@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com'"
    const AUTH = "@request.auth.id != ''"

    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const commissionsCol = app.findCollectionByNameOrId('saas_commissions')
    const receivablesCol = app.findCollectionByNameOrId('saas_commission_receivables')

    let releasesCol
    try {
      releasesCol = app.findCollectionByNameOrId('saas_commission_releases')
    } catch (_) {
      releasesCol = new Collection({
        name: 'saas_commission_releases',
        type: 'base',
        // Vendedor vê liberações das próprias comissões; admin vê todas
        listRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        viewRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        // Liberação registrada pelo serviço (vendedor ou admin), validada no backend
        createRule: AUTH + ' && (seller = @request.auth.id || ' + ADMIN_RULE + ')',
        updateRule: ADMIN_RULE,
        // Liberações NUNCA são excluídas (auditabilidade) — estorno é novo registro
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
            name: 'receivable',
            type: 'relation',
            required: false,
            collectionId: receivablesCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'seller',
            type: 'relation',
            required: true,
            collectionId: usersCol.id,
            maxSelect: 1,
            cascadeDelete: false,
          },
          {
            name: 'kind',
            type: 'select',
            required: true,
            values: ['development', 'recurring'],
            maxSelect: 1,
          },
          { name: 'amount_cents', type: 'number', required: true }, // valor liberado em centavos
          // IDEMPOTÊNCIA: uma única liberação por (comissão, recebível, tipo).
          // O serviço gera a chave determinística antes de gravar.
          { name: 'idempotency_key', type: 'text', required: true },
          { name: 'released_at', type: 'date', required: false },
          { name: 'notes', type: 'text', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_saas_releases_idempotency ON saas_commission_releases (idempotency_key)',
          'CREATE INDEX idx_saas_releases_commission ON saas_commission_releases (commission)',
          'CREATE INDEX idx_saas_releases_seller ON saas_commission_releases (seller)',
        ],
      })
      app.save(releasesCol)
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('saas_commission_releases')
      app.delete(c)
    } catch (_) {}
  },
)
