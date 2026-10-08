routerAdd('GET', '/backend/v1/calendar/feed/{token}', (e) => {
  // Redirecionamento 301 se a requisição chegar por HTTP puro em vez de HTTPS
  // No PocketBase / proxies reversos, o cabeçalho X-Forwarded-Proto indica o protocolo do cliente
  const reqProto = (
    e.request.header.get('x-forwarded-proto') ||
    e.request.header.get('x-forwarded-protocol') ||
    ''
  ).toLowerCase()
  const reqHost = e.request.header.get('x-forwarded-host') || e.request.header.get('host') || ''

  if (reqProto === 'http' && reqHost) {
    const rawPath =
      e.request.url.rawPath ||
      e.request.url.path ||
      '/backend/v1/calendar/feed/' + (e.request.pathValue('token') || '')
    const httpsTarget = 'https://' + reqHost + rawPath
    e.response.header().set('Location', httpsTarget)
    return e.string(301, 'Redirecionando para HTTPS...')
  }

  let rawToken = (e.request.pathValue('token') || '').trim()
  // Normaliza caso venha com extensão .ics (ex.: feed/{token}.ics comum em clientes como Google Calendar / macOS)
  if (rawToken.toLowerCase().endsWith('.ics')) {
    rawToken = rawToken.slice(0, -4)
  }
  const token = rawToken.trim()

  if (!token || token.length < 10) {
    return e.string(404, 'Feed de agenda não encontrado.')
  }

  let user = null
  try {
    user = $app.findFirstRecordByData('users', 'calendar_token', token)
  } catch (_) {}

  if (!user || user.getBool('disabled')) {
    return e.string(404, 'Feed de agenda inválido ou usuário inativo.')
  }

  const userId = user.id
  const userName = user.getString('name') || user.getString('email')
  const userRole = user.getString('role') || 'seller'
  const userEmail = (user.getString('email') || '').toLowerCase()
  const isAdmin = userRole === 'admin' || userEmail === 'leandro.bertanha@lbertanha.com'

  let opps = []
  if (isAdmin) {
    // Admin tem seu próprio feed: oportunidades próprias ou toda a equipe se não tiver próprias (mesmo fallback do painel)
    const ownOpps = $app.findRecordsByFilter(
      'opportunities',
      `seller = '${userId}' && return_at != ''`,
      '-return_at',
      500,
      0,
    )
    if (ownOpps && ownOpps.length > 0) {
      opps = ownOpps
    } else {
      opps = $app.findRecordsByFilter('opportunities', "return_at != ''", '-return_at', 500, 0)
    }
  } else {
    // Vendedor recebe apenas os retornos dele
    opps = $app.findRecordsByFilter(
      'opportunities',
      `seller = '${userId}' && return_at != ''`,
      '-return_at',
      500,
      0,
    )
  }

  const escapeIcs = (val) => {
    if (!val) return ''
    return String(val)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n')
  }

  const formatUtcDate = (d) => {
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    const year = d.getUTCFullYear()
    const month = pad(d.getUTCMonth() + 1)
    const day = pad(d.getUTCDate())
    const hours = pad(d.getUTCHours())
    const mins = pad(d.getUTCMinutes())
    const secs = pad(d.getUTCSeconds())
    return `${year}${month}${day}T${hours}${mins}${secs}Z`
  }

  const now = new Date()
  const dtStamp = formatUtcDate(now)

  let lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//bit Consulting//bitCRM Calendar//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcs('bitCRM Retornos - ' + userName)}`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'X-WR-CALDESC:Retornos agendados e follow-ups comerciais do bitCRM',
  ]

  const formatBrDatePart = (isoStr) => {
    if (!isoStr) return ''
    const d = new Date(isoStr)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => (n < 10 ? '0' + n : '' + n)
    // Offset fixo de Brasília UTC-3
    const brDate = new Date(d.getTime() - 3 * 60 * 60 * 1000)
    const day = pad(brDate.getUTCDate())
    const month = pad(brDate.getUTCMonth() + 1)
    const year = brDate.getUTCFullYear()
    const hours = pad(brDate.getUTCHours())
    const mins = pad(brDate.getUTCMinutes())
    return `${day}/${month}/${year} às ${hours}:${mins}`
  }

  for (let i = 0; i < opps.length; i++) {
    const opp = opps[i]
    const returnAtStr = opp.getString('return_at')
    if (!returnAtStr) continue

    const startDate = new Date(returnAtStr)
    if (isNaN(startDate.getTime())) continue

    // Evento padrão de 30 minutos de duração
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

    const company = opp.getString('company') || 'Empresa'
    const contactName = opp.getString('contact_name') || ''
    const contactPhone = opp.getString('contact_phone') || ''
    const stage = opp.getString('stage') || 'Novo'
    const numValue = Number(opp.get('value')) || 0
    const message = opp.getString('message') || ''

    const titleParts = ['Retorno: ' + company]
    if (contactName) {
      titleParts.push(contactName)
    }
    const summary = titleParts.join(' — ')

    // Formatação monetária segura compatível com Goja (sem toLocaleString)
    const formattedValue = (typeof numValue === 'number' && !isNaN(numValue) ? numValue : 0)
      .toFixed(2)
      .replace('.', ',')

    const formattedScheduledDate = formatBrDatePart(returnAtStr)

    let descLines = [`Empresa: ${company}`, `Estágio: ${stage}`, `Valor: R$ ${formattedValue}`]
    if (formattedScheduledDate) descLines.push(`Horário agendado: ${formattedScheduledDate}`)
    if (contactName) descLines.push(`Contato: ${contactName}`)
    if (contactPhone) descLines.push(`Telefone: ${contactPhone}`)
    if (message) descLines.push(`Observações: ${message}`)
    descLines.push('Origem: bitCRM Follow-up Comercial')

    const description = descLines.join('\n')
    const uid = `opp-${opp.id}@crm.lbertanha.com`

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${dtStamp}`)
    lines.push(`DTSTART:${formatUtcDate(startDate)}`)
    lines.push(`DTEND:${formatUtcDate(endDate)}`)
    lines.push(`SUMMARY:${escapeIcs(summary)}`)
    lines.push(`DESCRIPTION:${escapeIcs(description)}`)
    lines.push('STATUS:CONFIRMED')
    lines.push('BEGIN:VALARM')
    lines.push('TRIGGER:-PT30M')
    lines.push('ACTION:DISPLAY')
    lines.push(`DESCRIPTION:${escapeIcs('Lembrete de retorno bitCRM: ' + company)}`)
    lines.push('END:VALARM')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  const icsBody = lines.join('\r\n') + '\r\n'

  e.response.header().set('Content-Type', 'text/calendar; charset=utf-8')
  e.response.header().set('Content-Disposition', 'inline; filename="bitcrm-retornos.ics"')
  e.response.header().set('Cache-Control', 'no-cache, no-store, must-revalidate')
  e.response.header().set('Access-Control-Allow-Origin', '*')

  return e.string(200, icsBody)
})
