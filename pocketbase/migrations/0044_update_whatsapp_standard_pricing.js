migrate(
  (app) => {
    const products = app.findRecordsByFilter(
      'products',
      'is_active = true',
      'display_order',
      100,
      0,
    )

    for (const product of products) {
      const normalizedName = product
        .getString('name')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

      if (!normalizedName.includes('whatsapp') || !normalizedName.includes('autonomo')) continue

      product.set('setup_value', 497)
      product.set('recurring_value', 397)
      product.set('recurring_interval', 'mensal')
      product.set('commission_base_type', 'setup')
      product.set(
        'commission_rules_note',
        'A comissão incide exclusivamente sobre o setup contratado. A mensalidade do plano Essencial de R$ 397,00/mês não integra a base de comissão.',
      )
      app.save(product)
    }
  },
  (app) => {
    const products = app.findRecordsByFilter(
      'products',
      'is_active = true',
      'display_order',
      100,
      0,
    )

    for (const product of products) {
      const normalizedName = product
        .getString('name')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()

      if (!normalizedName.includes('whatsapp') || !normalizedName.includes('autonomo')) continue

      product.set('setup_value', 350)
      product.set('recurring_value', 69.9)
      product.set('recurring_interval', 'mensal')
      product.set('commission_base_type', 'setup')
      product.set(
        'commission_rules_note',
        'A comissão incide exclusivamente sobre o setup contratado. A mensalidade promocional não integra a base de comissão.',
      )
      app.save(product)
    }
  },
)
