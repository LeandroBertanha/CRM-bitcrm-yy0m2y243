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
export function formatCurrencyBRLManual(value: number | string | null | undefined): string {
  const num = Number(value)
  const safeNum = typeof num === 'number' && !isNaN(num) ? num : 0
  return safeNum.toFixed(2).replace('.', ',')
}

export function formatDateTimeBRManual(isoStr: string | null | undefined): string {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  // Fuso de Brasília UTC-3
  const brDate = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  const day = pad(brDate.getUTCDate())
  const month = pad(brDate.getUTCMonth() + 1)
  const year = brDate.getUTCFullYear()
  const hours = pad(brDate.getUTCHours())
  const mins = pad(brDate.getUTCMinutes())
  return `${day}/${month}/${year} às ${hours}:${mins}`
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

  const formattedScheduled = formatDateTimeBRManual(opp.return_at)
  const formattedVal = formatCurrencyBRLManual(opp.value)

  const descLines: string[] = [
    `Empresa: ${opp.company || 'Empresa'}`,
    `Estágio: ${opp.stage || 'Novo'}`,
    `Valor: R$ ${formattedVal}`,
  ]
  if (formattedScheduled) descLines.push(`Horário agendado: ${formattedScheduled}`)
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

export const PRODUCTION_DEFAULT_DOMAIN = 'bitcrm.lbertanha.com'
export const CALENDAR_BASE_URL = `https://${PRODUCTION_DEFAULT_DOMAIN}`

/**
 * Normaliza e resolve o host base para endpoints públicos do feed ICS.
 * - O feed de agenda do bitCRM deve ser SEMPRE o domínio oficial de produção https://bitcrm.lbertanha.com,
 *   nunca domínios de preview (*.goskip.app), localhost ou ambientes internos.
 * - Permite passar um customBaseUrl explícito (ex.: em testes unitários para verificação de formatos).
 */
export function resolveCalendarBaseUrl(customBaseUrl?: string): string {
  const rawUrl = (customBaseUrl || '').trim()

  // Se nenhum override explícito foi fornecido, utiliza SEMPRE a URL oficial de produção
  if (!rawUrl) {
    return CALENDAR_BASE_URL
  }

  // Se o override contiver localhost, goskip.app (previews), goskip.dev ou domínios de teste,
  // força de forma rígida o domínio oficial de produção
  const isDevOrPreview =
    /localhost|127\.0\.0\.1|goskip\.app|internal\.goskip\.dev|webcontainer|\.local\b/i.test(rawUrl)

  if (isDevOrPreview) {
    return CALENDAR_BASE_URL
  }

  // Para um domínio explicitamente customizado e válido, garante HTTPS
  const withoutProtocol = rawUrl.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  return `https://${withoutProtocol}`
}

/**
 * Monta as URLs completas de assinatura da agenda (HTTPS copiável e webcal:// nativo).
 * Garante que NUNCA haja HTTP puro e que ambos usem o host público correto.
 */
export function buildCalendarFeedUrls(
  calendarToken: string | null | undefined,
  customBaseUrl?: string,
): { httpsFeedUrl: string; webcalFeedUrl: string } {
  const token = (calendarToken || '').trim()
  if (!token) {
    return {
      httpsFeedUrl: '',
      webcalFeedUrl: '',
    }
  }

  const base = resolveCalendarBaseUrl(customBaseUrl)
  const path = `/backend/v1/calendar/feed/${token}`
  const httpsFeedUrl = `${base}${path}`
  const webcalFeedUrl = convertToWebcalUrl(httpsFeedUrl)

  return {
    httpsFeedUrl,
    webcalFeedUrl,
  }
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
