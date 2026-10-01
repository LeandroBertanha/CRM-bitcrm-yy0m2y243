onRecordUpdate((e) => {
  try {
    e.record.set('emailVisibility', true)
  } catch (_) {}
  e.next()
}, 'users')
