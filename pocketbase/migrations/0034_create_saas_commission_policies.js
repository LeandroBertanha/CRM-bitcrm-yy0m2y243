migrate(
  (app) => {
    // ============================================================
    // 0034 — EXPANSÃO COMISSIONAMENTO SaaS (Fase 1/4)
    // Cria saas_commission_policies: política de comissão para
    // Desenvolvimento de Sistemas SaaS (faixas por VALOR, versionada).
    // ADDITIVE ONLY: não altera coleções existentes.
    // ============================================================
    const ADMIN_RULE =
      "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')"

    let policiesCol
    try {
      policiesCol = app.findCollectionByNameOrId('saas_commission_policies')
    } catch (_) {
      policiesCol = new Collection({
        name: 'saas_commission_policies',
        type: 'base',
        // Leitura para qualquer autenticado (vendedor precisa conhecer a política);
        // escrita restrita a administradores — mesmo padrão das coleções de comissão atuais.
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: ADMIN_RULE,
        updateRule: ADMIN_RULE,
        deleteRule: ADMIN_RULE,
        fields: [
          { name: 'name', type: 'text', required: true },
          // Versionamento: cada alteração de faixas cria uma NOVA política (versão +1);
          // comissões registram policy_version + snapshot, nunca mudam retroativamente.
          { name: 'policy_version', type: 'number', required: true, onlyInt: true },
          // Faixas por valor do desenvolvimento (em CENTAVOS inteiros):
          // [{ min_value, max_value (null = sem limite), percentage, label }]
          { name: 'tiers', type: 'json', required: true },
          // Comissão de recorrência: 10% sobre as N primeiras mensalidades elegíveis recebidas
          { name: 'recurring_percentage', type: 'number', required: true },
          { name: 'recurring_eligible_months', type: 'number', required: true, onlyInt: true },
          // Margem mínima de contribuição (0.30 = 30%) — configurável pelo admin
          { name: 'min_margin_percentage', type: 'number', required: true },
          { name: 'notes', type: 'text', required: false },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_saas_policies_active ON saas_commission_policies (is_active)',
          'CREATE INDEX idx_saas_policies_version ON saas_commission_policies (policy_version)',
        ],
      })
      app.save(policiesCol)
    }

    // Seed idempotente da política padrão v1 (tabela inicial do prompt).
    // Valores em centavos inteiros para evitar erro de ponto flutuante.
    try {
      app.findFirstRecordByData('saas_commission_policies', 'policy_version', 1)
    } catch (_) {
      const rec = new Record(policiesCol)
      rec.set('name', 'Política Padrão SaaS — v1')
      rec.set('policy_version', 1)
      rec.set(
        'tiers',
        JSON.stringify([
          { min_value: 0, max_value: 300000, percentage: 0.1, label: 'Até R$ 3.000,00' },
          {
            min_value: 300001,
            max_value: 500000,
            percentage: 0.08,
            label: 'R$ 3.000,01 até R$ 5.000,00',
          },
          {
            min_value: 500001,
            max_value: 1000000,
            percentage: 0.07,
            label: 'R$ 5.000,01 até R$ 10.000,00',
          },
          {
            min_value: 1000001,
            max_value: 2000000,
            percentage: 0.06,
            label: 'R$ 10.000,01 até R$ 20.000,00',
          },
          {
            min_value: 2000001,
            max_value: 5000000,
            percentage: 0.05,
            label: 'R$ 20.000,01 até R$ 50.000,00',
          },
          {
            min_value: 5000001,
            max_value: null,
            percentage: 0.04,
            label: 'Acima de R$ 50.000,00',
          },
        ]),
      )
      rec.set('recurring_percentage', 0.1)
      rec.set('recurring_eligible_months', 3)
      rec.set('min_margin_percentage', 0.3)
      rec.set(
        'notes',
        'Tabela inicial de comissão para Desenvolvimento de Sistemas SaaS: um único percentual aplicado ao valor integral do desenvolvimento conforme sua faixa. Recorrência: 10% sobre as 3 primeiras mensalidades elegíveis efetivamente recebidas (modelos com serviço recorrente). O modelo de hospedagem não altera o percentual de desenvolvimento. Margem mínima de contribuição: 30% — abaixo disso, aprovação administrativa obrigatória.',
      )
      rec.set('is_active', true)
      app.save(rec)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('saas_commission_policies')
      app.delete(col)
    } catch (_) {}
  },
)