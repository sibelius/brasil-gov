import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  BUSINESS_DAY_NOTE,
  DEADLINE_DISCLAIMER,
  DEADLINE_NOTE,
  addBusinessDays,
  addMonths,
  estimateDeadline,
  formatCivilDate,
  isBusinessDay,
  isCivilDate,
  today,
} from '../src/lib/services/deadline.ts'
import { durationRange, parseDuration } from '../src/lib/services/duration.ts'
import { legalCalendar, parseHolidays } from '../src/lib/services/holidays.ts'
import { duration } from '../src/lib/services/model.ts'

const root = new URL('../public/data/v1/', import.meta.url)
const holidays = parseHolidays(JSON.parse(await readFile(new URL('holidays.json', root), 'utf8')))

function estimate(raw: unknown, start = '2026-10-02') {
  return estimateDeadline(start, parseDuration(raw), holidays)
}

function range(kind: string, max: string, unidade: string, min?: string) {
  return { [kind]: min === undefined ? { max, unidade } : { min, max, unidade } }
}

test('deadline: the generated calendar covers this year and the next', () => {
  const year = Number(today().slice(0, 4))

  assert.ok(holidays.from <= year, `calendário começa em ${holidays.from}`)
  assert.ok(
    holidays.to >= year + 1,
    `calendário termina em ${holidays.to}; rode pnpm data:holidays`,
  )
  assert.equal(holidays.businessDayExceptions.size, (holidays.to - holidays.from + 1) * 9)
})

test('deadline: national holidays are not business days, ponto facultativo is', () => {
  assert.equal(isBusinessDay('2026-01-01', holidays), false)
  assert.equal(isBusinessDay('2026-11-20', holidays), false)
  assert.equal(isBusinessDay('2026-12-25', holidays), false)
  assert.equal(isBusinessDay('2026-10-03', holidays), false)
  assert.equal(isBusinessDay('2026-10-04', holidays), false)

  // Carnaval, Sexta-feira da Paixão and Corpus Christi stay business days.
  assert.equal(isBusinessDay('2026-02-16', holidays), true)
  assert.equal(isBusinessDay('2026-02-17', holidays), true)
  assert.equal(isBusinessDay('2026-04-03', holidays), true)
  assert.equal(isBusinessDay('2026-06-04', holidays), true)
})

test('deadline: business days skip weekends and holidays, counting from the next day', () => {
  // Friday + 3 business days runs through both Carnaval days.
  assert.equal(addBusinessDays('2026-02-13', 3, holidays), '2026-02-18')
  assert.equal(addBusinessDays('2026-04-30', 1, holidays), '2026-05-04')
  assert.equal(addBusinessDays('2026-10-02', 0, holidays), '2026-10-02')

  const result = estimate(range('ate', '30', 'dias-uteis'))

  assert.equal(result.kind, 'data')
  assert.equal(result.unit, 'dias-uteis')
  assert.equal(result.to, '2026-11-17')
  assert.equal(result.label, 'Se você pedir em 02/10/2026, a estimativa é até 17/11/2026.')
})

test('deadline: business days cross the turn of the year', () => {
  assert.equal(addBusinessDays('2026-12-24', 5, holidays), '2027-01-04')

  const result = estimate(range('ate', '5', 'dias-uteis'), '2026-12-24')

  assert.equal(result.to, '2027-01-04')
  assert.equal(result.label, 'Se você pedir em 24/12/2026, a estimativa é até 04/01/2027.')
})

test('deadline: calendar days ignore weekends and holidays', () => {
  const result = estimate(range('ate', '10', 'dias-corridos'), '2026-12-24')

  assert.equal(result.kind, 'data')
  assert.equal(result.to, '2027-01-03')
  assert.equal(result.beyondHolidayData, false)
})

test('deadline: "entre" returns a range of dates', () => {
  const result = estimate(range('entre', '7', 'dias-corridos', '2'))

  assert.equal(result.kind, 'intervalo')
  assert.equal(result.from, '2026-10-04')
  assert.equal(result.to, '2026-10-09')
  assert.equal(
    result.label,
    'Se você pedir em 02/10/2026, a estimativa é entre 04/10/2026 e 09/10/2026.',
  )

  const business = estimate(range('entre', '5', 'dias-uteis', '2'))

  assert.equal(business.from, '2026-10-06')
  assert.equal(business.to, '2026-10-09')
})

test('deadline: "em média" is reported as an average, not a limit', () => {
  const result = estimate(range('emMedia', '15', 'dias-corridos'))

  assert.equal(result.average, true)
  assert.equal(result.to, '2026-10-17')
  assert.equal(
    result.label,
    'Se você pedir em 02/10/2026, a estimativa é por volta de 17/10/2026, em média.',
  )
})

test('deadline: months land on the same day, clamped to shorter months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2026-12-31', 2), '2027-02-28')
  assert.equal(addMonths('2027-12-31', 2), '2028-02-29')
  assert.equal(estimate(range('ate', '60', 'meses')).to, '2031-10-02')
})

test('deadline: hours and minutes under a day stay on the same day', () => {
  assert.equal(estimate(range('emMedia', '120', 'minutos')).kind, 'mesmo-dia')
  assert.equal(estimate(range('ate', '2', 'horas')).kind, 'mesmo-dia')
  assert.equal(
    estimate(range('emMedia', '30', 'minutos')).label,
    'Se você pedir em 02/10/2026, a estimativa é de conclusão no mesmo dia.',
  )

  // 96 hours is four days in practice, not a same-day service.
  const long = estimate(range('ate', '96', 'horas'))

  assert.equal(long.kind, 'data')
  assert.equal(long.to, '2026-10-06')
})

test('deadline: no estimate when the catalog has no usable amount', () => {
  assert.equal(estimate({ naoEstimadoAinda: true }).kind, 'indisponivel')
  assert.equal(estimate({}).kind, 'indisponivel')
  assert.equal(estimate({ atendimentoImediato: true }).kind, 'imediato')

  // 9 records carry an amount with an empty unit; one of them reads "2028".
  assert.equal(durationRange(parseDuration(range('ate', '2028', ''))), null)
  assert.equal(estimate(range('ate', '2028', '')).kind, 'indisponivel')
  assert.equal(
    estimate(range('ate', '2028', '')).label,
    'O catálogo não informa um prazo que permita estimar uma data.',
  )
})

test('deadline: flags results that leave the known holiday years', () => {
  const narrow = legalCalendar(2026, 2026)
  const long = estimateDeadline(
    '2026-10-02',
    parseDuration(range('ate', '720', 'dias-uteis')),
    narrow,
  )

  assert.equal(long.beyondHolidayData, true)
  assert.equal(estimate(range('ate', '720', 'dias-uteis')).beyondHolidayData, false)
  assert.equal(estimate(range('ate', '1825', 'dias-corridos')).beyondHolidayData, false)
})

test('deadline: today follows America/Sao_Paulo, not the host time zone', () => {
  assert.equal(today(new Date('2026-01-01T02:30:00Z')), '2025-12-31')
  assert.equal(today(new Date('2026-01-01T03:00:00Z')), '2026-01-01')
  assert.equal(today(new Date('2026-07-15T23:00:00Z')), '2026-07-15')
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/)
})

test('deadline: rejects invalid dates', () => {
  assert.equal(isCivilDate('2026-02-30'), false)
  assert.equal(isCivilDate('2026-13-01'), false)
  assert.equal(isCivilDate('02/10/2026'), false)
  assert.equal(isCivilDate('2026-02-28'), true)
  assert.equal(formatCivilDate('2026-02-28'), '28/02/2026')
  assert.throws(() => estimate(range('ate', '5', 'dias-uteis'), '2026-02-30'))
})

test('deadline: the estimate is labelled as an estimate, not an official deadline', () => {
  assert.match(DEADLINE_DISCLAIMER, /Não substitui o prazo oficial/)
  assert.match(DEADLINE_DISCLAIMER, /feriados estaduais e municipais/)
  assert.match(DEADLINE_NOTE, /não substitui o prazo oficial/)
  assert.match(BUSINESS_DAY_NOTE, /Pontos facultativos.+contam como dias úteis/)
})

test('deadline: the parser keeps the published label untouched', () => {
  assert.equal(duration({ atendimentoImediato: true }), 'Atendimento imediato')
  assert.equal(duration(range('ate', '30', 'dias-uteis')), 'Até 30 dias úteis')
  assert.equal(duration(range('emMedia', '3', 'meses')), 'Em média 3 meses')
  assert.equal(duration(range('entre', '90', 'dias-corridos', '20')), 'Entre 20 e 90 dias corridos')
  assert.equal(
    duration({ ...range('ate', '5', 'dias-uteis'), descricao: 'Após o pagamento.' }),
    'Até 5 dias úteis\n\nApós o pagamento.',
  )
  assert.equal(duration({ naoEstimadoAinda: true }), '')
})

test('deadline: rejects a calendar that is missing a national holiday', () => {
  const valid = {
    schema: 1,
    years: { from: 2026, to: 2026 },
    holidays: legalCalendar(2026, 2026).holidays,
  }

  assert.equal(parseHolidays(valid).businessDayExceptions.size, 9)
  assert.throws(
    () => parseHolidays({ ...valid, holidays: valid.holidays.slice(1) }),
    /Feriado nacional ausente/,
  )
  assert.throws(
    () =>
      parseHolidays({
        ...valid,
        holidays: valid.holidays.map((entry) =>
          entry.date === '2026-12-25' ? { ...entry, observance: 'opcional' } : entry,
        ),
      }),
    /Feriado nacional ausente/,
  )
  assert.throws(() => parseHolidays({ ...valid, schema: 2 }), /Calendário de feriados inválido/)
  assert.throws(
    () =>
      parseHolidays({ ...valid, holidays: [...valid.holidays, { date: '2030-01-02', name: 'X' }] }),
    /fora do intervalo/,
  )
})
