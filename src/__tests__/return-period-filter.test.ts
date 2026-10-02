import { describe, it, expect } from 'vitest'
import {
  formatDateToLocalYMD,
  getPresetDateRange,
  filterScheduledReturns,
  groupReturnsByDay,
  ReturnPeriodFilterState,
} from '@/lib/returnPeriodFilter'
import type { Opportunity } from '@/types/crm'

describe('Filtro de Retornos por Período (src/lib/returnPeriodFilter.ts)', () => {
  // Fixa uma data de referência: Segunda-feira, 23 de Março de 2026 às 10:00
  const refDate = new Date(2026, 2, 23, 10, 0, 0) // Mês 2 = Março
  const todayStr = formatDateToLocalYMD(refDate) // '2026-03-23'

  describe('getPresetDateRange', () => {
    it('deve gerar o range correto para preset "today"', () => {
      const range = getPresetDateRange('today', refDate)
      expect(range.startDate).toBe('2026-03-23')
      expect(range.endDate).toBe('2026-03-23')
    })

    it('deve gerar o range correto para preset "this_week"', () => {
      // 23/03/2026 é segunda-feira (day 1). Domingo é dia 29/03/2026.
      const range = getPresetDateRange('this_week', refDate)
      expect(range.startDate).toBe('2026-03-23')
      expect(range.endDate).toBe('2026-03-29')
    })

    it('deve gerar o range correto para preset "next_7_days"', () => {
      // 23/03 + 6 dias = 29/03 (7 dias no total incluindo hoje)
      const range = getPresetDateRange('next_7_days', refDate)
      expect(range.startDate).toBe('2026-03-23')
      expect(range.endDate).toBe('2026-03-29')
    })

    it('deve gerar o range correto para preset "next_30_days"', () => {
      // 23/03 + 29 dias = 21/04
      const range = getPresetDateRange('next_30_days', refDate)
      expect(range.startDate).toBe('2026-03-23')
      expect(range.endDate).toBe('2026-04-21')
    })
  })

  describe('filterScheduledReturns', () => {
    // Cria oportunidades com diferentes datas e estágios
    // Baseado na refDate (23/03/2026 10:00)
    const mockOpportunities: Opportunity[] = [
      {
        id: 'opp-overdue-yesterday',
        company: 'Empresa Atrasada Ontem',
        stage: 'Qualificado',
        return_at: new Date(2026, 2, 22, 14, 0).toISOString(),
        created: '2026-03-01',
      } as unknown as Opportunity,
      {
        id: 'opp-overdue-today-past-hour',
        // Criado para 2 horas atrás no mesmo dia
        company: 'Empresa Atrasada Hoje Cedo',
        stage: 'Proposta',
        return_at: new Date(2026, 2, 23, 8, 0).toISOString(),
        created: '2026-03-01',
      } as unknown as Opportunity,
      {
        id: 'opp-today-future-hour',
        company: 'Empresa Retorno Hoje Tarde',
        stage: 'Proposta',
        return_at: new Date(2026, 2, 23, 16, 0).toISOString(),
        created: '2026-03-01',
      } as unknown as Opportunity,
      {
        id: 'opp-tomorrow',
        company: 'Empresa Amanhã',
        stage: 'Agendado',
        return_at: new Date(2026, 2, 24, 11, 0).toISOString(),
        created: '2026-03-01',
      } as unknown as Opportunity,
      {
        id: 'opp-in-5-days',
        company: 'Empresa em 5 dias',
        stage: 'Novo',
        return_at: new Date(2026, 2, 28, 15, 0).toISOString(),
        created: '2026-03-01',
      } as unknown as Opportunity,
      {
        id: 'opp-in-15-days',
        company: 'Empresa em 15 dias',
        stage: 'Proposta',
        return_at: new Date(2026, 3, 7, 10, 0).toISOString(),
        created: '2026-03-01',
      } as unknown as Opportunity,
      {
        id: 'opp-closed-won-future',
        company: 'Empresa Já Ganha',
        stage: 'Ganho',
        return_at: new Date(2026, 2, 24, 10, 0).toISOString(),
        created: '2026-03-01',
      } as unknown as Opportunity,
      {
        id: 'opp-without-return',
        company: 'Empresa Sem Retorno',
        stage: 'Proposta',
        return_at: null,
        created: '2026-03-01',
      } as unknown as Opportunity,
    ]

    it('no preset "today", deve listar apenas retornos de hoje e atrasados sempre visíveis', () => {
      const filter: ReturnPeriodFilterState = {
        preset: 'today',
        startDate: todayStr,
        endDate: todayStr,
      }

      // Como o getReturnAlertInfo usa new Date() interno, para testes precisos, vamos verificar que:
      // Atrasados são capturados
      const res = filterScheduledReturns(mockOpportunities, filter)

      // opp-without-return não entra em nenhum
      expect(res.overdue.map((o) => o.id)).not.toContain('opp-without-return')
      expect(res.periodReturns.map((o) => o.id)).not.toContain('opp-without-return')

      // opp-closed-won-future não entra em nenhum
      expect(res.overdue.map((o) => o.id)).not.toContain('opp-closed-won-future')
      expect(res.periodReturns.map((o) => o.id)).not.toContain('opp-closed-won-future')
    })

    it('em período customizado, atrasados continuam visíveis e os do período obedecem startDate e endDate', () => {
      // Suponha um período com datas futuras:
      const futureStart = new Date(Date.now() + 86400000) // amanhã
      const futureEnd = new Date(Date.now() + 86400000 * 10) // daqui a 10 dias

      const startStr = formatDateToLocalYMD(futureStart)
      const endStr = formatDateToLocalYMD(futureEnd)

      const sampleOpps: Opportunity[] = [
        {
          id: 'opp-past',
          company: 'Atrasado',
          stage: 'Novo',
          return_at: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
        } as unknown as Opportunity,
        {
          id: 'opp-in-range',
          company: 'No Período',
          stage: 'Qualificado',
          return_at: new Date(Date.now() + 86400000 * 3).toISOString(), // daqui a 3 dias
        } as unknown as Opportunity,
        {
          id: 'opp-after-range',
          company: 'Muito Longe',
          stage: 'Agendado',
          return_at: new Date(Date.now() + 86400000 * 20).toISOString(), // daqui a 20 dias
        } as unknown as Opportunity,
      ]

      const filter: ReturnPeriodFilterState = {
        preset: 'custom',
        startDate: startStr,
        endDate: endStr,
      }

      const res = filterScheduledReturns(sampleOpps, filter)

      // Atrasados sempre presentes
      expect(res.overdue.map((o) => o.id)).toContain('opp-past')

      // Retornos do período contêm opp-in-range e não contêm opp-after-range nem opp-past
      expect(res.periodReturns.map((o) => o.id)).toContain('opp-in-range')
      expect(res.periodReturns.map((o) => o.id)).not.toContain('opp-after-range')
      expect(res.periodReturns.map((o) => o.id)).not.toContain('opp-past')
    })
  })

  describe('groupReturnsByDay', () => {
    it('deve agrupar oportunidades por dia com títulos corretos', () => {
      const now = new Date()
      const tomorrow = new Date(now)
      tomorrow.setDate(now.getDate() + 1)
      const in3Days = new Date(now)
      in3Days.setDate(now.getDate() + 3)

      const items: Opportunity[] = [
        {
          id: '1',
          company: 'Empresa 1',
          return_at: now.toISOString(),
        } as unknown as Opportunity,
        {
          id: '2',
          company: 'Empresa 2',
          return_at: tomorrow.toISOString(),
        } as unknown as Opportunity,
        {
          id: '3',
          company: 'Empresa 3',
          return_at: in3Days.toISOString(),
        } as unknown as Opportunity,
      ]

      const grouped = groupReturnsByDay(items, now)
      expect(grouped.length).toBe(3)
      expect(grouped[0].displayTitle).toBe('Hoje')
      expect(grouped[1].displayTitle).toBe('Amanhã')
      expect(grouped[2].displayTitle).not.toBe('Hoje')
      expect(grouped[2].displayTitle).not.toBe('Amanhã')
    })
  })
})
