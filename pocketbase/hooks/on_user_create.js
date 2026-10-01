onRecordCreate((e) => {
  e.record.set('emailVisibility', true)
  e.next()
}, 'users')
