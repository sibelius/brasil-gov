import { readFile } from 'node:fs/promises'
import { normalize } from '../src/lib/retrieval/query.ts'
import type { StatusGroup, StatusLevel, StatusSnapshot } from '../src/lib/status/types.ts'

const LIVE = 'https://raw.githubusercontent.com/sibelius/brasil-gov/status-data/latest.json'
const PUBLISHED = 'https://brasil-gov.vercel.app/data/status/latest.json'
const LOCAL = new URL('../public/data/status/latest.json', import.meta.url)
const TTL = 5 * 60 * 1000

let cached: { at: number; snapshot: StatusSnapshot; source: string } | undefined

async function fetchSnapshot(url: string): Promise<StatusSnapshot> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return (await response.json()) as StatusSnapshot
}

export async function loadSnapshot() {
  if (cached && Date.now() - cached.at < TTL) {
    return cached
  }

  const sources: [string, () => Promise<StatusSnapshot>][] = [
    [LIVE, () => fetchSnapshot(LIVE)],
    [PUBLISHED, () => fetchSnapshot(PUBLISHED)],
    ['local', async () => JSON.parse(await readFile(LOCAL, 'utf8')) as StatusSnapshot],
  ]

  for (const [source, load] of sources) {
    try {
      const snapshot = await load()

      if (snapshot.schema === 1 && snapshot.targets.length) {
        cached = { at: Date.now(), snapshot, source }

        return cached
      }
    } catch {
      continue
    }
  }

  throw new Error('Status indisponível no momento.')
}

export type StatusFilter = {
  query?: string
  uf?: string
  group?: StatusGroup
  level?: StatusLevel
  serviceId?: string
}

export async function queryStatus(filter: StatusFilter) {
  const { snapshot, source } = await loadSnapshot()
  const term = filter.query ? normalize(filter.query) : ''
  const uf = filter.uf?.toUpperCase()
  const matches = snapshot.targets.filter(
    (target) =>
      (!filter.group || target.group === filter.group) &&
      (!filter.level || target.level === filter.level) &&
      (!uf || target.uf === uf) &&
      (!filter.serviceId || target.serviceIds?.includes(filter.serviceId)) &&
      (!term ||
        normalize(
          [target.name, target.url, target.city, ...(target.agencies ?? [])].join(' '),
        ).includes(term)),
  )
  const summary: Record<string, number> = {}

  for (const target of snapshot.targets) {
    summary[target.level] = (summary[target.level] ?? 0) + 1
  }

  return {
    checkedAt: snapshot.checkedAt,
    origin: snapshot.origin,
    source,
    summary,
    legend: {
      up: 'respondeu em até 4 s',
      slow: 'respondeu em mais de 4 s',
      restricted: 'respondeu 401/403/429: no ar, mas recusou a verificação automática',
      broken: 'respondeu 404/4xx: endereço cadastrado não existe mais',
      down: 'erro 5xx, timeout, DNS ou conexão recusada',
    },
    page: 'https://brasil-gov.vercel.app/status',
    matches: matches.map(({ serviceIds, ...target }) => ({
      ...target,
      services: serviceIds?.length,
    })),
  }
}
