export const DURATION_UNITS = ['minutos', 'horas', 'dias-uteis', 'dias-corridos', 'meses'] as const

export type DurationUnit = (typeof DURATION_UNITS)[number]

export type DurationKind = 'imediato' | 'ate' | 'emMedia' | 'entre' | 'desconhecido'

export type ParsedDuration = {
  kind: DurationKind
  min: string
  max: string
  unit: string
  note: string
}

export type DurationRange = {
  min: number
  max: number
  unit: DurationUnit
  average: boolean
}

type RecordValue = Record<string, unknown>

function object(value: unknown): RecordValue {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as RecordValue
  }

  return {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function numberText(value: unknown): string {
  return typeof value === 'number' ? String(value) : text(value)
}

function timeUnit(value: string): string {
  return value.replaceAll('-', ' ').replace('uteis', 'úteis')
}

function isUnit(value: string): value is DurationUnit {
  return (DURATION_UNITS as readonly string[]).includes(value)
}

/**
 * Reads `tempoTotalEstimado` without interpreting it. The catalog stores the
 * amounts as strings and leaves every branch present but null, so the parsed
 * shape keeps the source text and lets callers decide how to use it.
 */
export function parseDuration(value: unknown): ParsedDuration {
  const row = object(value)
  const note = text(row.descricao)

  if (row.atendimentoImediato != null) {
    return { kind: 'imediato', min: '', max: '', unit: '', note }
  }

  if (row.entre != null) {
    const range = object(row.entre)

    return {
      kind: 'entre',
      min: numberText(range.min),
      max: numberText(range.max),
      unit: text(range.unidade),
      note,
    }
  }

  const range = object(row.ate ?? row.emMedia)

  if (range.max == null) {
    return { kind: 'desconhecido', min: '', max: '', unit: '', note }
  }

  return {
    kind: row.ate != null ? 'ate' : 'emMedia',
    min: '',
    max: numberText(range.max),
    unit: text(range.unidade),
    note,
  }
}

/** The human label for a parsed duration, without the source observation. */
export function durationLabel(parsed: ParsedDuration): string {
  if (parsed.kind === 'imediato') {
    return 'Atendimento imediato'
  }

  if (parsed.kind === 'entre') {
    return `Entre ${parsed.min} e ${parsed.max} ${timeUnit(parsed.unit)}`
  }

  if (parsed.kind === 'ate' || parsed.kind === 'emMedia') {
    const prefix = parsed.kind === 'ate' ? 'Até' : 'Em média'

    return `${prefix} ${parsed.max} ${timeUnit(parsed.unit)}`
  }

  return ''
}

export function formatDuration(parsed: ParsedDuration): string {
  return [durationLabel(parsed), parsed.note].filter(Boolean).join('\n\n')
}

/**
 * The numeric range a deadline can be computed from, or null when the catalog
 * gives no amount, no recognized unit or a value that is not a whole number.
 * 9 records carry an amount with an empty unit, so the unit check matters.
 */
export function durationRange(parsed: ParsedDuration): DurationRange | null {
  if (parsed.kind !== 'ate' && parsed.kind !== 'emMedia' && parsed.kind !== 'entre') {
    return null
  }

  if (!isUnit(parsed.unit)) {
    return null
  }

  const max = Number(parsed.max)
  const min = parsed.kind === 'entre' ? Number(parsed.min) : max

  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) {
    return null
  }

  return { min, max, unit: parsed.unit, average: parsed.kind === 'emMedia' }
}
