export const HOLIDAYS_SCHEMA = 1

export type Observance = 'nacional' | 'opcional'

export type Holiday = {
  date: string
  name: string
  observance: Observance
}

export type HolidayCalendar = {
  from: number
  to: number
  holidays: Holiday[]
  /** Only `nacional` dates. Optional closures never shorten a legal deadline. */
  national: Set<string>
}

/**
 * National holidays set by federal law. Every one of them falls on a fixed
 * calendar date, so this table is the authority and the aggregator API is only
 * a cross-check. Carnaval, Corpus Christi and Sexta-feira da Paixão are absent
 * on purpose: the first two are ponto facultativo and the third depends on
 * municipal law (Lei 9.093/1995, art. 2), so none of them is a national holiday.
 */
export const NATIONAL_HOLIDAYS: { monthDay: string; name: string; law: string }[] = [
  { monthDay: '01-01', name: 'Confraternização Universal', law: 'Lei 662/1949' },
  { monthDay: '04-21', name: 'Tiradentes', law: 'Lei 662/1949, art. 1º' },
  { monthDay: '05-01', name: 'Dia do Trabalho', law: 'Lei 662/1949' },
  { monthDay: '09-07', name: 'Independência do Brasil', law: 'Lei 662/1949' },
  { monthDay: '10-12', name: 'Nossa Senhora Aparecida', law: 'Lei 6.802/1980' },
  { monthDay: '11-02', name: 'Finados', law: 'Lei 662/1949 (Lei 10.607/2002)' },
  { monthDay: '11-15', name: 'Proclamação da República', law: 'Lei 662/1949' },
  {
    monthDay: '11-20',
    name: 'Dia Nacional de Zumbi e da Consciência Negra',
    law: 'Lei 14.759/2023',
  },
  { monthDay: '12-25', name: 'Natal', law: 'Lei 662/1949' },
]

/** 20 November only became a national holiday in 2024. */
const ZUMBI_FIRST_YEAR = 2024

const MONTH_DAYS = new Set(NATIONAL_HOLIDAYS.map((entry) => entry.monthDay))

/**
 * Whether a date is a national holiday, for any year. Every national holiday
 * falls on a fixed calendar date, so this answers correctly outside the years
 * the generated dataset happens to cover.
 */
export function isNationalHoliday(date: string): boolean {
  const monthDay = date.slice(5)

  if (monthDay === '11-20' && Number(date.slice(0, 4)) < ZUMBI_FIRST_YEAR) {
    return false
  }

  return MONTH_DAYS.has(monthDay)
}

export function nationalHolidays(from: number, to: number): Holiday[] {
  const holidays: Holiday[] = []

  for (let year = from; year <= to; year += 1) {
    for (const entry of NATIONAL_HOLIDAYS) {
      if (entry.monthDay === '11-20' && year < ZUMBI_FIRST_YEAR) {
        continue
      }

      holidays.push({
        date: `${year}-${entry.monthDay}`,
        name: entry.name,
        observance: 'nacional',
      })
    }
  }

  return holidays
}

export function calendar(holidays: Holiday[], from: number, to: number): HolidayCalendar {
  return {
    from,
    to,
    holidays,
    national: new Set(
      holidays.filter((entry) => entry.observance === 'nacional').map((entry) => entry.date),
    ),
  }
}

/** A calendar derived from federal law alone, for when the dataset is missing. */
export function legalCalendar(from: number, to: number): HolidayCalendar {
  return calendar(nationalHolidays(from, to), from, to)
}

function year(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)

  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2199) {
    throw new Error('Intervalo de anos inválido no calendário de feriados.')
  }

  return parsed
}

/**
 * Validates the generated dataset against federal law: every legal holiday in
 * the covered range must be present as `nacional`, otherwise a deadline would
 * silently count a holiday as a business day.
 */
export function parseHolidays(value: unknown): HolidayCalendar {
  const row = value as Record<string, unknown>

  if (!row || typeof row !== 'object' || row.schema !== HOLIDAYS_SCHEMA) {
    throw new Error('Calendário de feriados inválido.')
  }

  const years = (row.years ?? {}) as Record<string, unknown>
  const from = year(years.from)
  const to = year(years.to)

  if (to < from || !Array.isArray(row.holidays)) {
    throw new Error('Calendário de feriados inválido.')
  }

  const holidays = row.holidays.map((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>
    const date = typeof item.date === 'string' ? item.date : ''
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const observance = item.observance === 'nacional' ? 'nacional' : 'opcional'

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name) {
      throw new Error(`Feriado inválido no calendário: ${JSON.stringify(entry)}`)
    }

    const parsed = Number(date.slice(0, 4))

    if (parsed < from || parsed > to) {
      throw new Error(`Feriado fora do intervalo declarado: ${date}`)
    }

    return { date, name, observance } satisfies Holiday
  })

  const known = new Set(holidays.map((entry) => `${entry.date}:${entry.observance}`))

  for (const expected of nationalHolidays(from, to)) {
    if (!known.has(`${expected.date}:nacional`)) {
      throw new Error(`Feriado nacional ausente no calendário: ${expected.date}`)
    }
  }

  return calendar(holidays, from, to)
}
