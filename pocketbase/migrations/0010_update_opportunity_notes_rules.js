migrate(
  (app) => {
    const notesCol = app.findCollectionByNameOrId('opportunity_notes')
    const adminCheck =
      "@request.auth.role = 'admin' || @request.auth.email = 'leandro.bertanha@lbertanha.com'"

    // Usuários autenticados podem criar interações
    notesCol.createRule = "@request.auth.id != ''"
    notesCol.listRule = "@request.auth.id != ''"
    notesCol.viewRule = "@request.auth.id != ''"
    notesCol.updateRule = `@request.auth.id != '' && (author = @request.auth.id || (${adminCheck}))`
    notesCol.deleteRule = `@request.auth.id != '' && (author = @request.auth.id || (${adminCheck}))`

    app.save(notesCol)
  },
  (app) => {
    try {
      const notesCol = app.findCollectionByNameOrId('opportunity_notes')
      notesCol.createRule = "@request.auth.id != ''"
      app.save(notesCol)
    } catch (_) {}
  },
)
