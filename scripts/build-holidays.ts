import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  HOLIDAYS_SCHEMA,
  NATIONAL_HOLIDAYS,
  nationalHolidays,
  parseHolidays,
  type Holiday,
} from '../src/lib/services/holidays.ts'

const OUTPUT = new URL('../public/data/v1/holidays.json', import.meta.url)
const AGGREGATOR = 'https://brasilapi.com.br/api/feriados/v1'
const CHECK_ONLY = process.argv.includes('--check')

/**
 * A fixed range instead of "the current year and the next one": the longest
 * deadline in the catalog is 720 business days, about three years, and a range
 * derived from the current date would make the committed file go stale every
 * 1 January.
 */
export const YEARS = { from: 2026, to: 2032 } as const

const MONTH_DAYS = new Set(NATIONAL_HOLIDAYS.map((entry) => entry.monthDay))

type AggregatorHoliday = {
  date: string
  name: string
}

async function fetchYear(year: number): Promise<AggregatorHoliday[]> {
  const response = await fetch(`${AGGREGATOR}/${year}`, { signal: AbortSignal.timeout(20_000) })

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${AGGREGATOR}/${year}: HTTP ${response.status}`)
  }

  const body: unknown = await response.json()

  if (!Array.isArray(body)) {
    throw new Error(`Resposta inesperada para ${year}.`)
  }

  return body.flatMap((entry) => {
    const item = (entry ?? {}) as Record<string, unknown>

    return typeof item.date === 'string' && typeof item.name === 'string'
      ? [{ date: item.date, name: item.name }]
      : []
  })
}

export function classify(year: number, entries: AggregatorHoliday[]): Holiday[] {
  const legal = nationalHolidays(year, year)
  const byDate = new Map(legal.map((entry) => [entry.date, entry]))
  const extra: Holiday[] = []

  for (const entry of entries) {
    if (!entry.date.startsWith(`${year}-`)) {
      continue
    }

    // The law decides, not the aggregator: it reports Carnaval, Corpus Christi,
    // Sexta-feira da Paixão and Páscoa as "national" too. They are kept for
    // transparency, marked `opcional`, and never count as non-business days.
    if (MONTH_DAYS.has(entry.date.slice(5))) {
      continue
    }

    extra.push({ date: entry.date, name: entry.name, observance: 'opcional' })
  }

  const missing = legal.filter(
    (entry) => !entries.some((item) => item.date === entry.date) && byDate.has(entry.date),
  )

  for (const entry of missing) {
    console.warn(`Aviso: ${AGGREGATOR}/${year} não trouxe o feriado nacional ${entry.date}.`)
  }

  return [...legal, ...extra].sort((a, b) => a.date.localeCompare(b.date))
}

export async function buildHolidays() {
  if (CHECK_ONLY) {
    const current = parseHolidays(JSON.parse(await readFile(OUTPUT, 'utf8')))

    if (current.from !== YEARS.from || current.to !== YEARS.to) {
      throw new Error(
        `Generated holiday data is stale: ${fileURLToPath(OUTPUT)}. Run pnpm data:holidays.`,
      )
    }

    return current
  }

  const holidays: Holiday[] = []

  for (let year = YEARS.from; year <= YEARS.to; year += 1) {
    holidays.push(...classify(year, await fetchYear(year)))
  }

  const content = {
    schema: HOLIDAYS_SCHEMA,
    years: YEARS,
    observances: {
      nacional: 'Feriado nacional por lei federal. Não conta como dia útil.',
      opcional:
        'Ponto facultativo, feriado religioso de competência municipal ou data comemorativa. Conta como dia útil nesta estimativa.',
    },
    sources: [
      `${AGGREGATOR}/{ano}`,
      'Lei 662/1949',
      'Lei 6.802/1980',
      'Lei 9.093/1995',
      'Lei 10.607/2002',
      'Lei 14.759/2023',
    ],
    holidays,
  }

  // Validate before writing, so a bad aggregator response cannot land.
  const parsed = parseHolidays(content)
  const serialized = `${JSON.stringify(content, null, 2)}\n`
  const previous = await readFile(OUTPUT, 'utf8').catch(() => '')

  if (previous !== serialized) {
    await writeFile(OUTPUT, serialized)
  }

  return parsed
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await buildHolidays()
  const national = result.national.size
  const optional = result.holidays.length - national

  console.log(
    `${CHECK_ONLY ? 'Checked' : 'Wrote'} ${result.holidays.length} dates for ${YEARS.from}-${YEARS.to}: ${national} nacional, ${optional} opcional.`,
  )
}
