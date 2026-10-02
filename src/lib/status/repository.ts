import type { StatusHistory, StatusSnapshot } from './types.ts'

export const LIVE_BASE = 'https://raw.githubusercontent.com/sibelius/brasil-gov/status-data'
export const BUNDLED_BASE = '/data/status'

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15_000) })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

function valid(snapshot: StatusSnapshot) {
  return snapshot?.schema === 1 && Array.isArray(snapshot.targets) && snapshot.targets.length > 0
}

export async function loadStatus(): Promise<{
  snapshot: StatusSnapshot
  history?: StatusHistory
  live: boolean
}> {
  for (const [base, live] of [
    [LIVE_BASE, true],
    [BUNDLED_BASE, false],
  ] as const) {
    try {
      const snapshot = await fetchJson<StatusSnapshot>(`${base}/latest.json`)

      if (!valid(snapshot)) {
        continue
      }

      const history = await fetchJson<StatusHistory>(`${base}/history.json`).catch(() => undefined)

      return { snapshot, history, live }
    } catch {
      continue
    }
  }

  throw new Error('Não foi possível carregar o status.')
}
