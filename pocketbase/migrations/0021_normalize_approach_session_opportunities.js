migrate(
  (app) => {
    // 1. Atualizar oportunidades vinculadas a sessões com status 'Perdido' ou 'Sem interesse'
    // que não estejam ainda com stage = 'Perdido'
    app
      .db()
      .newQuery(`
      UPDATE opportunities
      SET stage = 'Perdido', updated = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT DISTINCT opportunity
        FROM approach_sessions
        WHERE opportunity != ''
          AND opportunity IS NOT NULL
          AND status IN ('Perdido', 'Sem interesse')
      )
      AND stage != 'Perdido'
    `)
      .execute()

    // 2. Atualizar oportunidades vinculadas a sessões com status 'Fechado'
    // que não estejam ainda com stage = 'Ganho'
    app
      .db()
      .newQuery(`
      UPDATE opportunities
      SET stage = 'Ganho', updated = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT DISTINCT opportunity
        FROM approach_sessions
        WHERE opportunity != ''
          AND opportunity IS NOT NULL
          AND status = 'Fechado'
      )
      AND stage != 'Ganho'
    `)
      .execute()

    // 3. Atualizar oportunidades vinculadas a sessões com status de proposta
    app
      .db()
      .newQuery(`
      UPDATE opportunities
      SET stage = 'Proposta', updated = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT DISTINCT opportunity
        FROM approach_sessions
        WHERE opportunity != ''
          AND opportunity IS NOT NULL
          AND status IN ('Proposta solicitada', 'Proposta enviada', 'Negociação')
      )
      AND stage NOT IN ('Proposta', 'Ganho', 'Perdido')
    `)
      .execute()

    // 4. Atualizar oportunidades vinculadas a sessões com retorno ou reunião agendada
    app
      .db()
      .newQuery(`
      UPDATE opportunities
      SET stage = 'Agendado', updated = CURRENT_TIMESTAMP
      WHERE id IN (
        SELECT DISTINCT opportunity
        FROM approach_sessions
        WHERE opportunity != ''
          AND opportunity IS NOT NULL
          AND status IN ('Reunião agendada', 'Retorno agendado')
      )
      AND stage NOT IN ('Agendado', 'Proposta', 'Ganho', 'Perdido')
    `)
      .execute()
  },
  (app) => {
    // Reversão não é necessária para dados normalizados
  },
)
