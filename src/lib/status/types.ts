export const STATUS_LEVELS = ['up', 'slow', 'restricted', 'broken', 'down'] as const

export type StatusLevel = (typeof STATUS_LEVELS)[number]

export const STATUS_GROUPS = ['federal', 'detran', 'estado', 'capital', 'catalogo'] as const

export type StatusGroup = (typeof STATUS_GROUPS)[number]

export type StatusTarget = {
  id: string
  group: StatusGroup
  name: string
  url: string
  uf?: string
  city?: string
  serviceIds?: string[]
  agencies?: string[]
}

export type CheckResult = {
  id: string
  level: StatusLevel
  http?: number
  ms: number
  finalUrl?: string
  error?: string
  tlsIssue?: boolean
}

export type StatusSnapshot = {
  schema: 1
  checkedAt: string
  origin: string
  durationMs: number
  targets: (StatusTarget & CheckResult)[]
}

export type StatusHistory = {
  schema: 1
  updatedAt: string
  runs: string[]
  levels: Record<string, string>
}

export const LEVEL_CODES: Record<StatusLevel, string> = {
  up: 'u',
  slow: 's',
  restricted: 'r',
  broken: 'b',
  down: 'd',
}

export const HISTORY_LIMIT = 168
