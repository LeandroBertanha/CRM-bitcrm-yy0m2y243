import { describe, it, expect } from 'vitest'
import {
  escapeIcsValue,
  formatIcsUtcDate,
  buildIcsDates,
  buildIcsEvent,
  buildFullIcsCalendar,
  convertToWebcalUrl,
  partitionReturnsForSeller,
  resolveCalendarBaseUrl,
  buildCalendarFeedUrls,
  formatCurrencyBRLManual,
  formatDateTimeBRManual,
  CALENDAR_BASE_URL,
} from '@/lib/calendarHelper'

describe('calendarHelper - ICS Feed & Retornos Follow-up', () => {
  describe('escapeIcsValue', () => {
    it('escapa vírgulas, ponto-e-vírgulas e barras invertidas corretamente', () => {
      const input = 'Empresa A, B & C; filial / setor\\1\nNova linha'
      const output = escapeIcsValue(input)
      expect(output).toContain('\\,')
      expect(output).toContain('\\;')
      expect(output).toContain('\\\\')
      expect(output).toContain('\\n')
      expect(output).not.toContain('\r')
    })

    it('trata nulos e strings vazias sem falhar', () => {
      expect(escapeIcsValue('')).toBe('')
      expect(escapeIcsValue(null)).toBe('')
      expect(escapeIcsValue(undefined)).toBe('')
    })
  })

  describe('formatIcsUtcDate & buildIcsDates', () => {
    it('formata UTC no padrão YYYYMMDDTHHMMSSZ', () => {
      const d = new Date(Date.UTC(2026, 9, 15, 14, 30, 0))
      expect(formatIcsUtcDate(d)).toBe('20261015T143000Z')
    })

    it('cria horário de término com duração padrão de 30 minutos', () => {
      const returnAtIso = '2026-10-15T14:00:00.000Z'
      const { dtStart, dtEnd } = buildIcsDates(returnAtIso)
      expect(dtStart).toBe('20261015T140000Z')
      expect(dtEnd).toBe('20261015T143000Z')
    })
  })

  describe('formatadores manuais seguros (sem toLocaleString / Intl)', () => {
    it('formatCurrencyBRLManual formata números monetários no padrão brasileiro com vírgula', () => {
      expect(formatCurrencyBRLManual(500)).toBe('500,00')
      expect(formatCurrencyBRLManual(1234.5)).toBe('1234,50')
      expect(formatCurrencyBRLManual(0)).toBe('0,00')
      expect(formatCurrencyBRLManual(null)).toBe('0,00')
      expect(formatCurrencyBRLManual(undefined)).toBe('0,00')
      expect(formatCurrencyBRLManual('250.75')).toBe('250,75')
    })

    it('formatDateTimeBRManual formata ISO para data e hora em Brasília (UTC-3)', () => {
      // 2026-10-19T14:30:00.000Z em UTC corresponde a 11:30 em Brasília (UTC-3)
      const res = formatDateTimeBRManual('2026-10-19T14:30:00.000Z')
      expect(res).toBe('19/10/2026 às 11:30')
      expect(formatDateTimeBRManual('')).toBe('')
      expect(formatDateTimeBRManual(null)).toBe('')
    })
  })

  describe('buildIcsEvent', () => {
    it('monta evento com título Retorno: {empresa} — {contato}, alarme VALARM de 30m e descrição detalhada', () => {
      const opp = {
        id: 'opp123',
        company: 'Restaurante & Bar Bela Vista, Ltda.',
        contact_name: 'Dona Maria; Gerente',
        contact_phone: '(11) 98888-7777',
        stage: 'Proposta',
        value: 1500,
        message: 'Apresentar proposta de cardápio digital, combinar horário comercial.',
        return_at: '2026-10-20T17:00:00.000Z',
      }
      const stamp = new Date(Date.UTC(2026, 9, 10, 12, 0, 0))
      const eventIcs = buildIcsEvent(opp, stamp)

      // Verificações essenciais de especificação
      expect(eventIcs).toContain('BEGIN:VEVENT')
      expect(eventIcs).toContain('UID:opp-opp123@crm.lbertanha.com')
      expect(eventIcs).toContain('DTSTART:20261020T170000Z')
      expect(eventIcs).toContain('DTEND:20261020T173000Z')
      // Título com empresa e contato
      expect(eventIcs).toContain(
        'SUMMARY:Retorno: Restaurante & Bar Bela Vista\\, Ltda. — Dona Maria\\; Gerente',
      )
      // Formatação de valor em R$
      expect(eventIcs).toContain('Valor: R$ 1500,00')
      // Horário agendado no fuso BR (17:00 UTC = 14:00 BRT)
      expect(eventIcs).toContain('Horário agendado: 20/10/2026 às 14:00')
      // Alarme VALARM 30 minutos antes
      expect(eventIcs).toContain('BEGIN:VALARM')
      expect(eventIcs).toContain('TRIGGER:-PT30M')
      expect(eventIcs).toContain('ACTION:DISPLAY')
      expect(eventIcs).toContain('END:VALARM')
      expect(eventIcs).toContain('END:VEVENT')
    })
  })

  describe('buildFullIcsCalendar', () => {
    it('gera VCALENDAR com timezone America/Sao_Paulo e múltiplos eventos', () => {
      const opps = [
        {
          id: '1',
          company: 'Empresa Alpha',
          contact_name: 'João',
          return_at: '2026-10-21T13:00:00.000Z',
        },
        {
          id: '2',
          company: 'Empresa Beta',
          return_at: '2026-10-21T15:00:00.000Z',
        },
      ]
      const ics = buildFullIcsCalendar('bitCRM Retornos - Carlos', opps)

      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('X-WR-TIMEZONE:America/Sao_Paulo')
      expect(ics).toContain('X-WR-CALNAME:bitCRM Retornos - Carlos')
      expect(ics).toContain('UID:opp-1@crm.lbertanha.com')
      expect(ics).toContain('UID:opp-2@crm.lbertanha.com')
      expect(ics).toContain('END:VCALENDAR')
    })
  })

  describe('convertToWebcalUrl', () => {
    it('converte https:// e http:// para webcal://', () => {
      expect(convertToWebcalUrl('https://crm.example.com/feed')).toBe(
        'webcal://crm.example.com/feed',
      )
      expect(convertToWebcalUrl('http://crm.example.com/feed')).toBe(
        'webcal://crm.example.com/feed',
      )
    })
  })

  describe('resolveCalendarBaseUrl e buildCalendarFeedUrls', () => {
    it('aponta para o endpoint real do backend PocketBase onde /backend/v1/* responde', () => {
      expect(CALENDAR_BASE_URL).toContain(
        'crm-de-vendas-comercial-ba27a.shrd00.internal.goskip.dev',
      )
      expect(resolveCalendarBaseUrl()).toBe(CALENDAR_BASE_URL)
      const urls = buildCalendarFeedUrls('my-token-123')
      expect(urls.httpsFeedUrl).toBe(`${CALENDAR_BASE_URL}/backend/v1/calendar/feed/my-token-123`)
      expect(urls.webcalFeedUrl).toBe(
        `webcal://${CALENDAR_BASE_URL.replace(/^https?:\/\//, '')}/backend/v1/calendar/feed/my-token-123`,
      )
    })

    it('evita que domínios de frontend (SPA bitcrm.lbertanha.com e goskip.app) causem 404', () => {
      // Cenário: o frontend SPA não roteia /backend/*, logo deve redirecionar para a URL que realmente responde
      const urlsPreview = buildCalendarFeedUrls(
        'GoiARQbLO3bzhw65C5L8kNFWiW2XlosF',
        'https://crm-de-vendas-comercial-ba27a--preview.goskip.app',
      )
      expect(urlsPreview.httpsFeedUrl).toBe(
        `${CALENDAR_BASE_URL}/backend/v1/calendar/feed/GoiARQbLO3bzhw65C5L8kNFWiW2XlosF`,
      )
      expect(urlsPreview.webcalFeedUrl).toBe(
        `webcal://${CALENDAR_BASE_URL.replace(/^https?:\/\//, '')}/backend/v1/calendar/feed/GoiARQbLO3bzhw65C5L8kNFWiW2XlosF`,
      )

      const urlsDomain = buildCalendarFeedUrls(
        'GoiARQbLO3bzhw65C5L8kNFWiW2XlosF',
        'https://bitcrm.lbertanha.com',
      )
      expect(urlsDomain.httpsFeedUrl).toBe(
        `${CALENDAR_BASE_URL}/backend/v1/calendar/feed/GoiARQbLO3bzhw65C5L8kNFWiW2XlosF`,
      )
    })

    it('redireciona para o domínio de backend real quando em contexto de desenvolvimento localhost', () => {
      const urlsLocal = buildCalendarFeedUrls('tok456', 'http://localhost:5173')
      expect(urlsLocal.httpsFeedUrl).toBe(`${CALENDAR_BASE_URL}/backend/v1/calendar/feed/tok456`)
      expect(urlsLocal.webcalFeedUrl).toBe(
        `webcal://${CALENDAR_BASE_URL.replace(/^https?:\/\//, '')}/backend/v1/calendar/feed/tok456`,
      )
    })

    it('retorna strings vazias se o token for nulo, indefinido ou vazio', () => {
      expect(buildCalendarFeedUrls('')).toEqual({ httpsFeedUrl: '', webcalFeedUrl: '' })
      expect(buildCalendarFeedUrls(null)).toEqual({ httpsFeedUrl: '', webcalFeedUrl: '' })
      expect(buildCalendarFeedUrls(undefined)).toEqual({ httpsFeedUrl: '', webcalFeedUrl: '' })
    })

    it('preserva customBaseUrl explícito de backend garantindo HTTPS', () => {
      const urls = buildCalendarFeedUrls('token-abc', 'https://api.crm.lbertanha.com')
      expect(urls.httpsFeedUrl).toBe(
        'https://api.crm.lbertanha.com/backend/v1/calendar/feed/token-abc',
      )
      expect(urls.webcalFeedUrl).toBe(
        'webcal://api.crm.lbertanha.com/backend/v1/calendar/feed/token-abc',
      )
    })
  })

  describe('partitionReturnsForSeller (Resumo diário por vendedor e admin)', () => {
    it('separa retornos atrasados e de hoje respeitando fuso de Brasília e escopo', () => {
      // 2026-10-15 12:00:00 UTC (09:00 de Brasília)
      const refDate = new Date(Date.UTC(2026, 9, 15, 12, 0, 0))

      const opps = [
        // Atrasado do vendedor (14 de outubro às 15:00 UTC = 12:00 BRT)
        {
          id: 'opp-overdue-seller',
          company: 'Atrasado Vendedor',
          seller: 'user-seller-1',
          return_at: '2026-10-14T15:00:00.000Z',
        },
        // De hoje do vendedor (15 de outubro às 17:00 UTC = 14:00 BRT)
        {
          id: 'opp-today-seller',
          company: 'Hoje Vendedor',
          seller: 'user-seller-1',
          return_at: '2026-10-15T17:00:00.000Z',
        },
        // Futuro do vendedor (18 de outubro)
        {
          id: 'opp-future-seller',
          company: 'Futuro Vendedor',
          seller: 'user-seller-1',
          return_at: '2026-10-18T17:00:00.000Z',
        },
        // De outro vendedor (user-seller-2)
        {
          id: 'opp-today-other',
          company: 'Hoje Outro',
          seller: 'user-seller-2',
          return_at: '2026-10-15T19:00:00.000Z',
        },
      ]

      // 1. Visão do Vendedor (user-seller-1)
      const sellerRes = partitionReturnsForSeller(opps, 'user-seller-1', false, refDate)
      expect(sellerRes.overdue.map((o) => o.id)).toEqual(['opp-overdue-seller'])
      expect(sellerRes.today.map((o) => o.id)).toEqual(['opp-today-seller'])
      expect(sellerRes.teamToday).toEqual([])
      expect(sellerRes.totalOwn).toBe(2)
      expect(sellerRes.shouldSend).toBe(true)

      // Vendedor sem retornos não deve enviar
      const emptySellerRes = partitionReturnsForSeller(opps, 'user-seller-empty', false, refDate)
      expect(emptySellerRes.totalOwn).toBe(0)
      expect(emptySellerRes.shouldSend).toBe(false)

      // 2. Visão do Admin (user-admin)
      const adminRes = partitionReturnsForSeller(opps, 'user-admin', true, refDate)
      expect(adminRes.totalOwn).toBe(0)
      expect(adminRes.totalTeam).toBe(3) // 1 atrasado da equipe + 2 de hoje da equipe
      expect(adminRes.teamOverdue.map((o) => o.id)).toEqual(['opp-overdue-seller'])
      expect(adminRes.teamToday.map((o) => o.id)).toEqual(['opp-today-seller', 'opp-today-other'])
      expect(adminRes.shouldSend).toBe(true)
    })
  })
})
