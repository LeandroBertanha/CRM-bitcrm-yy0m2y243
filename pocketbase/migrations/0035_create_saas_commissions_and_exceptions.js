migrate(
  (app) => {
    // ============================================================
    // 0035 — EXPANSÃO COMISSIONAMENTO SaaS (Fase 2/4)
    // Cria saas_commission_exceptions (regras específicas por vendedor)
    // e saas_commissions (comissões de desenvolvimento SaaS).
    // ADDITIVE ONLY: não altera coleções existentes.
    // ============================================================
    const ADMIN_RULE =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // ------------------------------------------------------------
    // 1. saas_commission_exceptions — exceções/campanhas por vendedor
    // ------------------------------------------------------------
    let exceptionsCol
    try {
      exceptionsCol = app.findCollectionByNameOrId('saas_commission_exceptions')
    } catch (_) {
      exceptionsCol = new Collection({
        name: 'saas_commission_exceptions',
        type: 'base',
        // Vendedor vê apenas as próprias exceções; admin vê todas
        listRule:
          "@request.auth.id != '' && (seller = @request.auth.id || " +
          ADMIN_RULE.replace("@request.auth.id != '' && ", '') +
          ')',
        viewRule:
          "@request.auth.id != '' && (seller = @request.auth.id || " +
          ADMIN_RULE.replace("@request.auth.id != '' && ", '') +
          ')',
        createRule: ADMIN_RULE,
        updateRule: ADMIN_RULE,
        deleteRule: ADMIN_RULE,
        fields: [
          { name: 'seller', type: 'relation', required: true, collectionId: usersCol.id, maxSelect: 1, cascadeDelete: false },
          // 'percentage' sobrepõe o percentual da faixa; 'fixed_value' paga valor fixo por projeto
          {
            name: 'exception_type',
            type: 'select',
            required: true,
            values: ['percentage', 'fixed_value'],
            maxSelect: 1,
          },
          { name: 'percentage', type: 'number', required: false }, // ex: 0.12 = 12%
          { name: 'fixed_value_cents', type: 'number', required: false }, // valor fixo em centavos
          // A que incide a exceção: comissão de desenvolvimento ou de recorrência
          {
            name: 'applies_to',
            type: 'select',
            required: true,
            values: ['development', 'recurring'],
            maxSelect: 1,
          },
          { name: 'valid_from', type: 'date', required: false },
          { name: 'valid_until', type: 'date', required: false }, // vazio = sem prazo (campanha permanente)
          { name: 'reason', type: 'text', required: true },
          { name: 'approved_by', type: 'relation', required: false, collectionId: usersCol.id, maxSelect: 1, cascadeDelete: false },
          { name: 'approved_at', type: 'date', required: false },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_saas_exceptions_seller ON saas_commission_exceptions (seller)',
          'CREATE INDEX idx_saas_exceptions_active ON saas_commission_exceptions (is_active)',
        ],
      })
      app.save(exceptionsCol)
    }

    // ------------------------------------------------------------
    // 2. saas_commissions — a comissão de um projeto SaaS vendido
    // ------------------------------------------------------------
    const oppsCol = app.findCollectionByNameOrId('opportunities')

    let commissionsCol
    try {
      commissionsCol = app.findCollectionByNameOrId('saas_commissions')
    } catch (_) {
      commissionsCol = new Collection({
        name: 'saas_commissions',
        type: 'base',
        // Vendedor vê/computa apenas as próprias comissões; admin vê todas
        listRule:
          "@request.auth.id != '' && (seller = @request.auth.id || " +
          ADMIN_RULE.replace("@request.auth.id != '' && ", '') +
          ')',
        viewRule:
          "@request.auth.id != '' && (seller = @request.auth.id || " +
          ADMIN_RULE.replace("@request.auth.id != '' && ", '') +
          ')',
        // Criação: vendedor registra a própria comissão; admin registra de qualquer vendedor
        createRule: "@request.auth.id != '' && (seller = @request.auth.id || " + ADMIN_RULE.replace("@request.auth.id != '' && ", '') + ')',
        // Transições de estado, aprovações e correções: somente admin
        updateRule: ADMIN_RULE,
        deleteRule: ADMIN_RULE,
        fields: [
          // Vínculos com o CRM (cliente é texto denormalizado — oportunidades usam company: text)
          { name: 'client_name', type: 'text', required: true },
          { name: 'opportunity', type: 'relation', required: false, collectionId: oppsCol.id, maxSelect: 1, cascadeDelete: false },
          { name: 'seller', type: 'relation', required: true, collectionId: usersCol.id, maxSelect: 1, cascadeDelete: false },
          { name: 'system_name', type: 'text', required: true },
          { name: 'system_description', type: 'text', required: false },
          // Modelo de infraestrutura — NÃO altera percentual de desenvolvimento
          {
            name: 'hosting_model',
            type: 'select',
            required: true,
            values: ['bit_cloud', 'client_cloud', 'client_cloud_support', 'hybrid'],
            maxSelect: 1,
          },
          // Valores em CENTAVOS inteiros
          { name: 'list_value_cents', type: 'number', required: false }, // valor de tabela
          { name: 'discount_cents', type: 'number', required: false }, // desconto comercial
          { name: 'contract_value_cents', type: 'number', required: true }, // valor contratado
          { name: 'installments_count', type: 'number', required: true, onlyInt: true }, // parcelas do desenvolvimento
          // Recorrência (mensalidades elegíveis)
          { name: 'recurring_monthly_cents', type: 'number', required: false }, // 0 = sem recorrência
          { name: 'recurring_percentage', type: 'number', required: false }, // snapshot da política
          { name: 'recurring_commissionable_months', type: 'number', required: false, onlyInt: true }, // snapshot (3)
          // Comissões calculadas (centavos)
          { name: 'development_commission_cents', type: 'number', required: true },
          { name: 'recurring_commission_potential_cents', type: 'number', required: false },
          // Como a comissão de desenvolvimento foi calculada
          {
            name: 'commission_type',
            type: 'select',
            required: true,
            values: ['percentage', 'fixed_value'],
            maxSelect: 1,
          },
          // Versionamento da política aplicada (histórico preservado)
          { name: 'dev_policy_version', type: 'number', required: true, onlyInt: true },
          { name: 'dev_policy_snapshot', type: 'json', required: false }, // faixas usadas no cálculo
          { name: 'exception', type: 'relation', required: false, collectionId: exceptionsCol.id, maxSelect: 1, cascadeDelete: false },
          // Rentabilidade
          { name: 'direct_costs_cents', type: 'number', required: false }, // custo direto estimado
          { name: 'taxes_cents', type: 'number', required: false }, // tributos estimados (contam 1x, dentro da receita líquida)
          { name: 'margin_percentage', type: 'number', required: false }, // margem de contribuição estimada
          { name: 'requires_approval', type: 'bool', required: false },
          // Ciclo de vida
          {
            name: 'status',
            type: 'select',
            required: true,
            values: [
              'simulada',
              'pendente_aprovacao',
              'aprovada',
              'aguardando_recebimento',
              'parcialmente_liberada',
              'disponivel_pagamento',
              'paga',
              'cancelada',
              'estornada',
            ],
            maxSelect: 1,
          },
          { name: 'approved_by', type: 'relation', required: false, collectionId: usersCol.id, maxSelect: 1, cascadeDelete: false },
          { name: 'approved_at', type: 'date', required: false },
          { name: 'approval_note', type: 'text', required: false },
          { name: 'commercial_notes', type: 'text', required: false }, // observações comerciais
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_saas_commissions_status ON saas_commissions (status)',
          'CREATE INDEX idx_saas_commissions_seller ON saas_commissions (seller)',
          'CREATE INDEX idx_saas_commissions_opportunity ON saas_commissions (opportunity)',
        ],
      })
      app.save(commissionsCol)
    }
  },
  (app) => {
    try {
      const c = app.findCollectionByNameOrId('saas_commissions')
      app.delete(c)
    } catch (_) {}
    try {
      const e = app.findCollectionByNameOrId('saas_commission_exceptions')
      app.delete(e)
    } catch (_) {}
  },
)