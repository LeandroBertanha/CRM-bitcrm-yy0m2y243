migrate(
  (app) => {
    // Atualiza somente oportunidades WhatsApp ainda nos dois primeiros estágios.
    // A condição por nome e relação cobre registros antigos e atuais sem afetar Site/LP.
    app
      .db()
      .newQuery(`
        UPDATE opportunities
        SET value = 497,
            recurring_value = 397,
            updated = CURRENT_TIMESTAMP
        WHERE stage IN ('Novo', 'Qualificado')
          AND (
            LOWER(COALESCE(product_name, '')) LIKE '%whatsapp%'
            OR product IN (
              SELECT id
              FROM products
              WHERE LOWER(COALESCE(name, '')) LIKE '%whatsapp%'
            )
          )
          AND (
            COALESCE(value, 0) != 497
            OR COALESCE(recurring_value, 0) != 397
          )
      `)
      .execute()
  },
  () => {
    // Rollback intencionalmente não destrutivo: os valores anteriores variavam por oportunidade.
  },
)
