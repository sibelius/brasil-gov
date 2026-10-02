import type { DurationRange, ParsedDuration } from './duration.ts'
import { durationRange } from './duration.ts'
import { isNationalHoliday, type HolidayCalendar } from './holidays.ts'

export const TIME_ZONE = 'America/Sao_Paulo'

/** Full wording, for clients that show the estimate without any other context. */
export const DEADLINE_DISCLAIMER =
  'Estimativa calculada a partir do prazo publicado no catálogo. Não substitui o prazo oficial do órgão, que pode ser suspenso, interrompido ou alterado, e não considera feriados estaduais e municipais.'

/** Short wording, for the service page, where the published deadline is next to it. */
export const DEADLINE_NOTE = 'Estimativa; não substitui o prazo oficial do órgão.'

export const BUSINESS_DAY_NOTE =
  'Dias úteis descontam sábados, domingos e feriados nacionais. Pontos facultativos, como o Carnaval, contam como dias úteis.'

/**
 * Refuses amounts no real deadline reaches, so a corrupt value cannot make the
 * business-day loop run for millions of iterations. The catalog's longest
 * published deadline is 1,825 calendar days.
 */
const MAX_AMOUNT = 36_500

const HOURS_IN_DAY = 24
const MINUTES_IN_DAY = 24 * 60
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000

/** A civil date as `YYYY-MM-DD`. Deliberately not a `Date`: see `today`. */
export type CivilDate = string

export type DeadlineKind = 'imediato' | 'mesmo-dia' | 'data' | 'intervalo' | 'indisponivel'

export type Deadline = {
  kind: DeadlineKind
  start: CivilDate
  from: CivilDate | null
  to: CivilDate | null
  unit: DurationRange['unit'] | null
  average: boolean
  label: string
}

export function isCivilDate(value: unknown): value is CivilDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return toEpochDay(value) !== null
}

function toEpochDay(date: CivilDate): number | null {
  const [year, month, day] = date.split('-').map(Number)
  const time = Date.UTC(year, month - 1, day)
  const parsed = new Date(time)

  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1) {
    return null
  }

  if (parsed.getUTCDate() !== day) {
    return null
  }

  return time / MILLISECONDS_IN_DAY
}

function epochDay(date: CivilDate): number {
  const day = toEpochDay(date)

  if (day === null) {
    throw new Error(`Data inválida: ${date}`)
  }

  return day
}

function fromEpochDay(day: number): CivilDate {
  return new Date(day * MILLISECONDS_IN_DAY).toISOString().slice(0, 10)
}

/** 0 is Sunday, 6 is Saturday. */
function weekday(date: CivilDate): number {
  return new Date(epochDay(date) * MILLISECONDS_IN_DAY).getUTCDay()
}

/**
 * Today in Brasília. Civil dates avoid the whole class of off-by-one-day bugs
 * that come from reading a `Date` in the host time zone: the only moment a time
 * zone is involved is right here, deciding which calendar day it is.
 */
export function today(now: Date = new Date()): CivilDate {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const field = (type: string) => parts.find((part) => part.type === type)?.value ?? ''

  return `${field('year')}-${field('month')}-${field('day')}`
}

export function formatCivilDate(date: CivilDate): string {
  const [year, month, day] = date.split('-')

  return `${day}/${month}/${year}`
}

export function addCalendarDays(date: CivilDate, days: number): CivilDate {
  return fromEpochDay(epochDay(date) + days)
}

export function isBusinessDay(date: CivilDate, holidays: HolidayCalendar): boolean {
  const day = weekday(date)

  if (day === 0 || day === 6) {
    return false
  }

  // The law covers every year; the dataset can only add to it.
  return !isNationalHoliday(date) && !holidays.national.has(date)
}

/**
 * Counts from the day after `date`, the way administrative deadlines run: the
 * day a request is filed does not count, and a deadline never lands on a
 * non-business day.
 */
export function addBusinessDays(
  date: CivilDate,
  days: number,
  holidays: HolidayCalendar,
): CivilDate {
  let current = epochDay(date)
  let remaining = days

  while (remaining > 0) {
    current += 1

    if (isBusinessDay(fromEpochDay(current), holidays)) {
      remaining -= 1
    }
  }

  return fromEpochDay(current)
}

/** Adds whole months, clamping to the last day when the target month is shorter. */
export function addMonths(date: CivilDate, months: number): CivilDate {
  const [year, month, day] = date.split('-').map(Number)
  const target = month - 1 + months
  const targetYear = year + Math.floor(target / 12)
  const targetMonth = ((target % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()

  return fromEpochDay(
    Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)) / MILLISECONDS_IN_DAY,
  )
}

function advance(
  start: CivilDate,
  amount: number,
  unit: DurationRange['unit'],
  holidays: HolidayCalendar,
): CivilDate | null {
  if (unit === 'dias-uteis') {
    return addBusinessDays(start, amount, holidays)
  }

  if (unit === 'dias-corridos') {
    return addCalendarDays(start, amount)
  }

  if (unit === 'meses') {
    return addMonths(start, amount)
  }

  const days = unit === 'horas' ? amount / HOURS_IN_DAY : amount / MINUTES_IN_DAY

  // Hours and minutes describe the service time, not a calendar deadline:
  // anything within a day stays "same day", longer windows become calendar days.
  return days <= 1 ? null : addCalendarDays(start, Math.ceil(days))
}

function sentence(start: CivilDate, parts: string): string {
  return `Se você pedir em ${formatCivilDate(start)}, ${parts}`
}

function label(
  kind: DeadlineKind,
  start: CivilDate,
  from: CivilDate | null,
  to: CivilDate | null,
  average: boolean,
): string {
  if (kind === 'imediato') {
    return 'O atendimento é imediato: a conclusão acontece na própria solicitação.'
  }

  if (kind === 'mesmo-dia') {
    return sentence(start, 'a estimativa é de conclusão no mesmo dia.')
  }

  if (kind === 'intervalo' && from && to) {
    return sentence(
      start,
      `a estimativa é entre ${formatCivilDate(from)} e ${formatCivilDate(to)}.`,
    )
  }

  if (kind === 'data' && to) {
    return average
      ? sentence(start, `a estimativa é por volta de ${formatCivilDate(to)}, em média.`)
      : sentence(start, `a estimativa é até ${formatCivilDate(to)}.`)
  }

  return 'O catálogo não informa um prazo que permita estimar uma data.'
}

function unavailable(start: CivilDate): Deadline {
  return {
    kind: 'indisponivel',
    start,
    from: null,
    to: null,
    unit: null,
    average: false,
    label: label('indisponivel', start, null, null, false),
  }
}

/**
 * Turns a catalog duration into the date range a request filed on `start` is
 * estimated to finish in. Pure: the caller supplies both the start date and the
 * holiday calendar.
 */
export function estimateDeadline(
  start: CivilDate,
  parsed: ParsedDuration,
  holidays: HolidayCalendar,
): Deadline {
  if (!isCivilDate(start)) {
    throw new Error(`Data inicial inválida: ${start}`)
  }

  if (parsed.kind === 'imediato') {
    return {
      kind: 'imediato',
      start,
      from: null,
      to: null,
      unit: null,
      average: false,
      label: label('imediato', start, null, null, false),
    }
  }

  const range = durationRange(parsed)

  if (!range || range.max > MAX_AMOUNT) {
    return unavailable(start)
  }

  const to = advance(start, range.max, range.unit, holidays)
  const from = range.min === range.max ? to : advance(start, range.min, range.unit, holidays)

  if (!to) {
    return {
      kind: 'mesmo-dia',
      start,
      from: null,
      to: start,
      unit: range.unit,
      average: range.average,
      label: label('mesmo-dia', start, null, null, range.average),
    }
  }

  // A minimum that falls inside the same day still reads as a range: the
  // estimate then runs from the request date itself to the maximum.
  const begin = from ?? start
  const interval = begin !== to
  const kind = interval ? 'intervalo' : 'data'

  return {
    kind,
    start,
    from: interval ? begin : null,
    to,
    unit: range.unit,
    average: range.average,
    label: label(kind, start, interval ? begin : null, to, range.average),
  }
}
