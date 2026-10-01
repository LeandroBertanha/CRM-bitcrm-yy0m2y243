migrate(
  (app) => {
    // 1. Criar collection commission_settings (configurações gerais de comissionamento)
    let settingsCol
    try {
      settingsCol = app.findCollectionByNameOrId('commission_settings')
    } catch (_) {
      settingsCol = new Collection({
        name: 'commission_settings',
        type: 'base',
        // Qualquer usuário autenticado pode listar e visualizar; administradores podem editar/criar/excluir
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        fields: [
          { name: 'product_name', type: 'text', required: true },
          { name: 'base_sale_value', type: 'number', required: true },
          { name: 'monthly_hosting_value', type: 'number', required: true },
          { name: 'hosting_note', type: 'text', required: false },
          { name: 'essential_rules', type: 'json', required: false },
          { name: 'detailed_rules', type: 'json', required: false },
          { name: 'is_active', type: 'bool', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_commission_settings_active ON commission_settings (is_active)'],
      })
      app.save(settingsCol)
    }

    // 2. Criar collection commission_tiers (faixas de comissão)
    let tiersCol
    try {
      tiersCol = app.findCollectionByNameOrId('commission_tiers')
    } catch (_) {
      tiersCol = new Collection({
        name: 'commission_tiers',
        type: 'base',
        // Leitura para todos autenticados; escrita restrita a admins
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        updateRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        deleteRule:
          "@request.auth.id != '' && (@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com')",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'min_sales', type: 'number', required: true, onlyInt: true },
          { name: 'max_sales', type: 'number', required: false, onlyInt: true }, // null ou 0 = sem limite máximo
          { name: 'percentage', type: 'number', required: true }, // e.g. 0.20, 0.25, 0.30 (ou 20, 25, 30)
          { name: 'commission_per_sale', type: 'number', required: true }, // e.g. 100, 125, 150
          { name: 'is_active', type: 'bool', required: false },
          { name: 'display_order', type: 'number', required: true, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_commission_tiers_order ON commission_tiers (display_order)',
          'CREATE INDEX idx_commission_tiers_active ON commission_tiers (is_active)',
        ],
      })
      app.save(tiersCol)
    }

    // 3. Popular dados iniciais na collection commission_settings
    try {
      app.findFirstRecordByData('commission_settings', 'is_active', true)
    } catch (_) {
      const settingsRecord = new Record(settingsCol)
      settingsRecord.set('product_name', 'Site ou Landing Page sob medida')
      settingsRecord.set('base_sale_value', 500)
      settingsRecord.set('monthly_hosting_value', 55)
      settingsRecord.set(
        'hosting_note',
        'A mensalidade de R$ 55,00 referente à hospedagem com domínio próprio não integra a base de comissão e não altera o valor comissionado.',
      )
      settingsRecord.set('essential_rules', [
        'A comissão incide exclusivamente sobre o valor da venda do Site/LP (R$ 500,00).',
        'A hospedagem de R$ 55,00/mês não integra a base de comissão.',
        'A faixa de comissão é definida pela quantidade total de vendas válidas e recebidas no mês.',
        'Ao atingir uma nova faixa, o percentual correspondente daquela faixa é aplicado a TODAS as vendas válidas do mês (não é progressivo por venda).',
        'A comissão é devida somente após o efetivo recebimento do valor da venda pela Bit Consulting.',
        'Vendas canceladas, estornadas, não pagas ou reembolsadas não geram comissão.',
        'Política comercial destinada ao time de vendas da Bit Consulting.',
      ])
      settingsRecord.set('detailed_rules', [
        {
          rule: '1. Produto elegível',
          description:
            'Site ou Landing Page sob medida vendido pelo valor comercial vigente de R$ 500,00.',
        },
        {
          rule: '2. Base de cálculo',
          description:
            'A comissão é calculada exclusivamente sobre o valor de R$ 500,00 referente à venda do Site/LP.',
        },
        {
          rule: '3. Hospedagem',
          description:
            'A mensalidade de R$ 55,00 referente à hospedagem com domínio próprio não possui comissão.',
        },
        {
          rule: '4. Apuração mensal',
          description:
            'A faixa é determinada pelo total de vendas válidas e efetivamente recebidas dentro do mês de apuração.',
        },
        {
          rule: '5. Aplicação da faixa',
          description:
            'Ao atingir uma nova faixa, o percentual correspondente é aplicado às vendas válidas daquele mês.',
        },
        {
          rule: '6. Condição para pagamento',
          description:
            'A comissão somente é gerada após o efetivo recebimento do cliente pela Bit Consulting.',
        },
        {
          rule: '7. Cancelamentos e estornos',
          description:
            'Vendas canceladas, estornadas, não pagas ou reembolsadas são excluídas da apuração da comissão.',
        },
      ])
      settingsRecord.set('is_active', true)
      app.save(settingsRecord)
    }

    // 4. Popular dados iniciais na collection commission_tiers
    const initialTiers = [
      {
        name: 'Faixa 1 (1 a 4 vendas)',
        min_sales: 1,
        max_sales: 4,
        percentage: 0.2, // 20%
        commission_per_sale: 100,
        display_order: 1,
        is_active: true,
      },
      {
        name: 'Faixa 2 (5 a 9 vendas)',
        min_sales: 5,
        max_sales: 9,
        percentage: 0.25, // 25%
        commission_per_sale: 125,
        display_order: 2,
        is_active: true,
      },
      {
        name: 'Faixa 3 (10 ou mais vendas)',
        min_sales: 10,
        max_sales: null, // sem limite
        percentage: 0.3, // 30%
        commission_per_sale: 150,
        display_order: 3,
        is_active: true,
      },
    ]

    for (const t of initialTiers) {
      try {
        app.findFirstRecordByData('commission_tiers', 'display_order', t.display_order)
      } catch (_) {
        const tierRec = new Record(tiersCol)
        tierRec.set('name', t.name)
        tierRec.set('min_sales', t.min_sales)
        if (t.max_sales !== null) {
          tierRec.set('max_sales', t.max_sales)
        }
        tierRec.set('percentage', t.percentage)
        tierRec.set('commission_per_sale', t.commission_per_sale)
        tierRec.set('display_order', t.display_order)
        tierRec.set('is_active', t.is_active)
        app.save(tierRec)
      }
    }
  },
  (app) => {
    try {
      const tiersCol = app.findCollectionByNameOrId('commission_tiers')
      app.delete(tiersCol)
    } catch (_) {}
    try {
      const settingsCol = app.findCollectionByNameOrId('commission_settings')
      app.delete(settingsCol)
    } catch (_) {}
  },
)
