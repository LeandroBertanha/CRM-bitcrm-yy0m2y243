import { getReturnAlertInfo, Opportunity } from '@/types/crm'

export type ReturnPeriodPreset = 'today' | 'this_week' | 'next_7_days' | 'next_30_days' | 'custom'

export interface ReturnPeriodFilterState {
  preset: ReturnPeriodPreset
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
}

/**
 * Formata um objeto Date para YYYY-MM-DD em horário local
 */
export function formatDateToLocalYMD(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Retorna os limites (data inicial e final YYYY-MM-DD) para um preset dado um "agora" (Date de referência)
 */
export function getPresetDateRange(
  preset: ReturnPeriodPreset,
  referenceDate: Date = new Date(),
): { startDate: string; endDate: string } {
  const ref = new Date(referenceDate)
  const todayStr = formatDateToLocalYMD(ref)

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr }
  }

  if (preset === 'this_week') {
    // Semana civil (de hoje até domingo ou fim da semana)
    // No contexto comercial de retornos "a serem realizados", abrange de hoje até o final da semana (domingo)
    const dayOfWeek = ref.getDay() // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek
    const sunday = new Date(ref)
    sunday.setDate(ref.getDate() + daysUntilSunday)
    return {
      startDate: todayStr,
      endDate: formatDateToLocalYMD(sunday),
    }
  }

  if (preset === 'next_7_days') {
    const end = new Date(ref)
    end.setDate(ref.getDate() + 6) // Hoje + 6 dias = janela de 7 dias
    return {
      startDate: todayStr,
      endDate: formatDateToLocalYMD(end),
    }
  }

  if (preset === 'next_30_days') {
    const end = new Date(ref)
    end.setDate(ref.getDate() + 29) // Janela de 30 dias
    return {
      startDate: todayStr,
      endDate: formatDateToLocalYMD(end),
    }
  }

  return { startDate: todayStr, endDate: todayStr }
}

export interface FilterScheduledReturnsResult {
  overdue: Opportunity[]
  periodReturns: Opportunity[]
}

/**
 * Filtra oportunidades em:
 * 1. Atrasados: abertos e com status === 'overdue' (sempre mantidos, independentes do filtro de período)
 * 2. Retornos do período: abertos (não Ganho/Perdido), com return_at válido e cuja data esteja entre startDate e endDate (inclusivo).
 *    Caso o preset seja 'today', equivale a status === 'today'.
 *    Caso contrário, inclui retornos não atrasados com data dentro do intervalo startDate/endDate.
 */
export function filterScheduledReturns(
  opportunities: Opportunity[],
  filter: ReturnPeriodFilterState,
  referenceDate: Date = new Date(),
): FilterScheduledReturnsResult {
  const overdue: Opportunity[] = []
  const periodReturns: Opportunity[] = []

  // Constrói limites em milissegundos para o range startDate - endDate (dia inteiro no fuso local)
  const [startYear, startMonth, startDay] = filter.startDate.split('-').map(Number)
  const [endYear, endMonth, endDay] = filter.endDate.split('-').map(Number)

  const startTimestamp =
    filter.startDate && !isNaN(startYear)
      ? new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0).getTime()
      : -Infinity

  const endTimestamp =
    filter.endDate && !isNaN(endYear)
      ? new Date(endYear, endMonth - 1, endDay, 23, 59, 59, 999).getTime()
      : Infinity

  for (const opp of opportunities) {
    if (!opp.return_at) continue

    // Verifica status básico usando helper padrão
    const info = getReturnAlertInfo(opp.return_at, opp.stage)

    // Se estiver atrasado, adiciona à lista de atrasados
    if (info.status === 'overdue') {
      overdue.push(opp)
    }

    // Oportunidades fechadas (Ganho/Perdido) não participam dos retornos a serem realizados
    if (opp.stage === 'Ganho' || opp.stage === 'Perdido') {
      continue
    }

    // Se o preset for 'today' estrito, segue a regra de 'today'
    if (filter.preset === 'today') {
      if (info.status === 'today') {
        periodReturns.push(opp)
      }
      continue
    }

    // Para outros presets ou custom:
    // O retorno deve ter data futura ou hoje (não atrasado) e estar dentro do intervalo [startTimestamp, endTimestamp]
    const returnTime = new Date(opp.return_at).getTime()
    if (isNaN(returnTime)) continue

    // Se não for atrasado e estiver dentro da janela
    if (info.status !== 'overdue' && returnTime >= startTimestamp && returnTime <= endTimestamp) {
      periodReturns.push(opp)
    }
  }

  // Ordena cronologicamente
  overdue.sort((a, b) => new Date(a.return_at!).getTime() - new Date(b.return_at!).getTime())
  periodReturns.sort((a, b) => new Date(a.return_at!).getTime() - new Date(b.return_at!).getTime())

  return { overdue, periodReturns }
}

/**
 * Agrupa retornos por dia (rótulo amigável: "Hoje", "Amanhã", ou "Segunda-feira, 24/03")
 */
export interface GroupedReturnDay {
  dateKey: string // YYYY-MM-DD
  displayTitle: string
  items: Opportunity[]
}

export function groupReturnsByDay(
  items: Opportunity[],
  referenceDate: Date = new Date(),
): GroupedReturnDay[] {
  const groupsMap = new Map<string, Opportunity[]>()

  const todayStr = formatDateToLocalYMD(referenceDate)
  const tomorrow = new Date(referenceDate)
  tomorrow.setDate(referenceDate.getDate() + 1)
  const tomorrowStr = formatDateToLocalYMD(tomorrow)

  for (const item of items) {
    if (!item.return_at) continue
    const d = new Date(item.return_at)
    if (isNaN(d.getTime())) continue
    const dateKey = formatDateToLocalYMD(d)
    const existing = groupsMap.get(dateKey) || []
    existing.push(item)
    groupsMap.set(dateKey, existing)
  }

  const sortedKeys = Array.from(groupsMap.keys()).sort()

  return sortedKeys.map((key) => {
    let displayTitle: string
    if (key === todayStr) {
      displayTitle = 'Hoje'
    } else if (key === tomorrowStr) {
      displayTitle = 'Amanhã'
    } else {
      const [year, month, day] = key.split('-').map(Number)
      const d = new Date(year, month - 1, day)
      const dayOfWeek = d.toLocaleDateString('pt-BR', { weekday: 'long' })
      const capitalized = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)
      const formattedDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
      displayTitle = `${capitalized}, ${formattedDate}`
    }

    return {
      dateKey: key,
      displayTitle,
      items: groupsMap.get(key) || [],
    }
  })
}
