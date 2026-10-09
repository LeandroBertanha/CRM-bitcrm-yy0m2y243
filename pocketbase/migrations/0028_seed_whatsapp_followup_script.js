migrate(
  (app) => {
    const scriptsCol = app.findCollectionByNameOrId('playbook_scripts')

    // Verificar se já existe script com título 'Follow-up WhatsApp (Qualificado)' ou channel 'WhatsApp' com situação de continuação
    try {
      app.findFirstRecordByData('playbook_scripts', 'title', 'Follow-up WhatsApp (Qualificado)')
      return // Já existe, não duplica
    } catch (_) {}

    // Script padrão de retomada/continuação para leads na coluna Qualificado
    const record = new Record(scriptsCol)
    record.set('channel', 'WhatsApp')
    record.set('situation', 'Continuação / Follow-up de qualificação')
    record.set('title', 'Follow-up WhatsApp (Qualificado)')
    record.set(
      'script_text',
      'Olá, [NOME DO CONTATO]! Tudo bem?\n\nAqui é o [NOME DO VENDEDOR], da Bit Consulting. Passando para saber se pude tirar todas as suas dúvidas sobre o projeto do site da [NOME DA EMPRESA] em [CIDADE].\n\nConseguiu avaliar com calma a nossa proposta ou precisa de mais algum exemplo para alinharmos os próximos passos?',
    )
    record.set(
      'instructions',
      'Script padrão de continuação para a coluna Qualificado. Se houver interação anterior, pode citar a data do último contato.',
    )
    record.set('display_order', 7)
    record.set('is_active', true)
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData(
        'playbook_scripts',
        'title',
        'Follow-up WhatsApp (Qualificado)',
      )
      app.delete(record)
    } catch (_) {}
  },
)
