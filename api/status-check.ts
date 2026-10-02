import { timingSafeEqual } from 'node:crypto'
import type { StatusTarget } from '../src/lib/status/types.ts'
import TARGETS from '../status/targets.json' with { type: 'json' }
import { checkAll } from '../status/check.ts'

const targets = TARGETS as StatusTarget[]

function authorized(request: Request) {
  const token = process.env.STATUS_TOKEN
  const given = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''

  if (!token || given.length !== token.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(given), Buffer.from(token))
}

export default {
  async fetch(request: Request) {
    if (!authorized(request)) {
      return Response.json({ error: 'unauthorized' }, { status: 401 })
    }

    const params = new URL(request.url).searchParams
    const shards = Math.min(Math.max(1, Number(params.get('shards') ?? 1)), 16)
    const shard = Math.min(Math.max(0, Number(params.get('shard') ?? 0)), shards - 1)

    const slice = targets.filter((_, position) => position % shards === shard)
    const started = Date.now()
    const results = await checkAll(slice, 24)

    return Response.json({
      region: process.env.VERCEL_REGION ?? 'local',
      shard,
      shards,
      durationMs: Date.now() - started,
      results,
    })
  },
}
