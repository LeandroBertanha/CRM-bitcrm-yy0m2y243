/**
 * Utilitários e helpers para o Feed de Agenda (ICS / webcal) e Resumo Diário de Retornos
 * bitCRM - bit Consulting
 */

export interface CalendarEventData {
  id: string
  company: string
  contact_name?: string
  contact_phone?: string
  stage?: string
  value?: number
  message?: string
  return_at: string
}

/**
 * Escapa strings conforme especificação RFC 5545 (iCalendar)
 * Vírgulas, barras invertidas e ponto-e-vírgulas devem ser precedidos por \
 * Quebras de linha tornam-se \n
 */
export function escapeIcsValue(val: string | null | undefined): string {
  if (!val) return ''
  return String(val)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Formata um objeto Date para UTC no formato iCalendar: YYYYMMDDTHHMMSSZ
 */
export function formatIcsUtcDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  const year = date.getUTCFullYear()
  const month = pad(date.getUTCMonth() + 1)
  const day = pad(date.getUTCDate())
  const hours = pad(date.getUTCHours())
  const mins = pad(date.getUTCMinutes())
  const secs = pad(date.getUTCSeconds())
  return `${year}${month}${day}T${hours}${mins}${secs}Z`
}

/**
 * Converte data ISO e adiciona 30 minutos para término padrão
 */
export function buildIcsDates(returnAtIso: string): { dtStart: string; dtEnd: string } {
  const start = new Date(returnAtIso)
  const end = new Date(start.getTime() + 30 * 60 * 1000)
  return {
    dtStart: formatIcsUtcDate(start),
    dtEnd: formatIcsUtcDate(end),
  }
}

/**
 * Gera string de VEVENT com alarme (VALARM) de 30 minutos antes e campos exigidos
 */
export function buildIcsEvent(opp: CalendarEventData, stampDate: Date = new Date()): string {
  const { dtStart, dtEnd } = buildIcsDates(opp.return_at)
  const dtStamp = formatIcsUtcDate(stampDate)

  const titleParts = ['Retorno: ' + (opp.company || 'Empresa')]
  if (opp.contact_name) {
    titleParts.push(opp.contact_name)
  }
  const summary = titleParts.join(' — ')

  const descLines: string[] = [
    `Empresa: ${opp.company || 'Empresa'}`,
    `Estágio: ${opp.stage || 'Novo'}`,
    `Valor: R$ ${(Number(opp.value) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  ]
  if (opp.contact_name) descLines.push(`Contato: ${opp.contact_name}`)
  if (opp.contact_phone) descLines.push(`Telefone: ${opp.contact_phone}`)
  if (opp.message) descLines.push(`Observações: ${opp.message}`)
  descLines.push('Origem: bitCRM Follow-up Comercial')

  const description = descLines.join('\n')
  const uid = `opp-${opp.id}@crm.lbertanha.com`

  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeIcsValue(summary)}`,
    `DESCRIPTION:${escapeIcsValue(description)}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsValue('Lembrete de retorno bitCRM: ' + (opp.company || 'Empresa'))}`,
    'END:VALARM',
    'END:VEVENT',
  ].join('\r\n')
}

/**
 * Gera um arquivo/feed VCALENDAR completo para uma lista de oportunidades
 */
export function buildFullIcsCalendar(
  calendarName: string,
  events: CalendarEventData[],
  now: Date = new Date(),
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//bit Consulting//bitCRM Calendar//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsValue(calendarName)}`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
    'X-WR-CALDESC:Retornos agendados e follow-ups comerciais do bitCRM',
  ]

  for (const ev of events) {
    lines.push(buildIcsEvent(ev, now))
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/**
 * Converte a URL HTTP(S) do backend para protocolo webcal:// para assinatura nativa
 */
export function convertToWebcalUrl(httpUrl: string): string {
  if (!httpUrl) return ''
  return httpUrl.replace(/^https?:\/\//i, 'webcal://')
}

/**
 * Separa oportunidades entre atrasadas e de hoje, com respeito a escopo de vendedor vs admin
 */
export interface SellerSummaryResult {
  overdue: CalendarEventData[]
  today: CalendarEventData[]
  teamOverdue: CalendarEventData[]
  teamToday: CalendarEventData[]
  totalOwn: number
  totalTeam: number
  shouldSend: boolean
}

export function partitionReturnsForSeller(
  allOpps: (CalendarEventData & { seller?: string })[],
  currentUserId: string,
  isAdmin: boolean,
  referenceDateUtc: Date = new Date(),
): SellerSummaryResult {
  // Ajuste de fuso horário de Brasília (UTC-3)
  const brOffsetMs = -3 * 60 * 60 * 1000
  const brNow = new Date(referenceDateUtc.getTime() + brOffsetMs)

  const yyyy = brNow.getUTCFullYear()
  const mm = brNow.getUTCMonth()
  const dd = brNow.getUTCDate()

  const todayStartUtc = new Date(Date.UTC(yyyy, mm, dd, 3, 0, 0))
  const todayEndUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000 - 1)

  const overdue: CalendarEventData[] = []
  const today: CalendarEventData[] = []
  const teamOverdue: CalendarEventData[] = []
  const teamToday: CalendarEventData[] = []

  for (const opp of allOpps) {
    if (!opp.return_at) continue
    const date = new Date(opp.return_at)
    if (isNaN(date.getTime())) continue

    const isMine = opp.seller === currentUserId

    if (isMine) {
      if (date < todayStartUtc) {
        overdue.push(opp)
      } else if (date <= todayEndUtc) {
        today.push(opp)
      }
    } else if (isAdmin) {
      if (date < todayStartUtc) {
        teamOverdue.push(opp)
      } else if (date <= todayEndUtc) {
        teamToday.push(opp)
      }
    }
  }

  const totalOwn = overdue.length + today.length
  const totalTeam = teamOverdue.length + teamToday.length

  const shouldSend = isAdmin ? totalOwn > 0 || totalTeam > 0 : totalOwn > 0

  return {
    overdue,
    today,
    teamOverdue,
    teamToday,
    totalOwn,
    totalTeam,
    shouldSend,
  }
}
