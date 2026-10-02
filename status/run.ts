import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import {
  HISTORY_LIMIT,
  LEVEL_CODES,
  type CheckResult,
  type StatusHistory,
  type StatusSnapshot,
  type StatusTarget,
} from '../src/lib/status/types.ts'
import { checkAll } from './check.ts'

const { values } = parseArgs({
  options: {
    out: { type: 'string', default: 'public/data/status' },
    remote: { type: 'string' },
    shards: { type: 'string', default: '4' },
    origin: { type: 'string', default: process.env.STATUS_ORIGIN ?? 'local' },
  },
})

const targets: StatusTarget[] = JSON.parse(
  await readFile(new URL('./targets.json', import.meta.url), 'utf8'),
)
const started = Date.now()

async function remoteShard(shard: number, shards: number): Promise<CheckResult[]> {
  const url = new URL(values.remote!)

  url.searchParams.set('shard', String(shard))
  url.searchParams.set('shards', String(shards))

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${process.env.STATUS_TOKEN ?? ''}` },
    signal: AbortSignal.timeout(320_000),
  })

  if (!response.ok) {
    throw new Error(`Shard ${shard}: HTTP ${response.status} ${await response.text()}`)
  }

  return ((await response.json()) as { results: CheckResult[] }).results
}

const results = values.remote
  ? (
      await Promise.all(
        Array.from({ length: Number(values.shards) }, (_, shard) =>
          remoteShard(shard, Number(values.shards)),
        ),
      )
    ).flat()
  : await checkAll(targets)
const byId = new Map(results.map((result) => [result.id, result]))
const checkedAt = new Date().toISOString()
const snapshot: StatusSnapshot = {
  schema: 1,
  checkedAt,
  origin: values.origin,
  durationMs: Date.now() - started,
  targets: targets.map((target) => {
    const result = byId.get(target.id) ?? {
      id: target.id,
      level: 'down',
      ms: 0,
      error: 'not_checked',
    }

    return { ...target, ...result }
  }),
}
const out = new URL(`${values.out.replace(/\/$/, '')}/`, `file://${process.cwd()}/`)
const historyFile = new URL('history.json', out)
const previous: StatusHistory = await readFile(historyFile, 'utf8')
  .then((text) => JSON.parse(text) as StatusHistory)
  .catch(() => ({ schema: 1, updatedAt: checkedAt, runs: [], levels: {} }))
const keep = Math.min(previous.runs.length, HISTORY_LIMIT - 1)
const history: StatusHistory = {
  schema: 1,
  updatedAt: checkedAt,
  runs: [...previous.runs.slice(previous.runs.length - keep), checkedAt],
  levels: Object.fromEntries(
    snapshot.targets.map((target) => {
      const past = (previous.levels[target.id] ?? '').padStart(previous.runs.length, '-')

      return [target.id, past.slice(past.length - keep) + LEVEL_CODES[target.level]]
    }),
  ),
}

await mkdir(out, { recursive: true })
await writeFile(new URL('latest.json', out), `${JSON.stringify(snapshot)}\n`)
await writeFile(historyFile, `${JSON.stringify(history)}\n`)

const counts = new Map<string, number>()

for (const target of snapshot.targets) {
  counts.set(target.level, (counts.get(target.level) ?? 0) + 1)
}

console.log(
  `${snapshot.targets.length} alvos em ${(snapshot.durationMs / 1000).toFixed(1)} s · ` +
    [...counts].map(([level, count]) => `${level}: ${count}`).join(' · '),
)
