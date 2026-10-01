import assert from 'node:assert/strict'
import test from 'node:test'
import { CACHE_TTL, createJsonLoader } from '../src/lib/json-cache.ts'

function validate(value: unknown) {
  if (typeof value !== 'number') throw new Error('invalid')
  return value
}

function fakeStorage() {
  const entries = new Map<string, Response>()
  const keyOf = (key: RequestInfo | URL) =>
    typeof key === 'string' ? key : key instanceof URL ? key.pathname : new URL(key.url).pathname
  const cache = {
    match: async (key: RequestInfo | URL) => entries.get(keyOf(key))?.clone(),
    put: async (key: RequestInfo | URL, value: Response) => {
      entries.set(keyOf(key), value.clone())
    },
    delete: async (key: RequestInfo | URL) => entries.delete(keyOf(key)),
    keys: async () => [...entries.keys()].map((key) => new Request(`https://example.com${key}`)),
  }

  return { entries, storage: { open: async () => cache } as unknown as CacheStorage }
}

const flushWrites = () => new Promise((resolve) => setTimeout(resolve, 25))

test('deduplicates concurrent fetches, reuses memory, and expires entries', async () => {
  let count = 0
  let now = 0
  const load = createJsonLoader({ now: () => now, fetcher: async () => Response.json(++count) })
  assert.deepEqual(await Promise.all([load('/one', validate), load('/one', validate)]), [1, 1])
  assert.equal(await load('/one', validate), 1)
  now = CACHE_TTL + 1
  assert.equal(await load('/one', validate), 2)
})

test('network and validation failures are retryable and never cached', async () => {
  let count = 0
  const load = createJsonLoader({
    fetcher: async () => {
      count++
      if (count === 1) return new Response('missing', { status: 404 })
      if (count === 2) return Response.json('invalid')
      return Response.json(3)
    },
  })
  await assert.rejects(load('/one', validate))
  await assert.rejects(load('/one', validate))
  assert.equal(await load('/one', validate), 3)
})

test('memory evicts least recently used entries', async () => {
  let count = 0
  const load = createJsonLoader({ memoryLimit: 2, fetcher: async () => Response.json(++count) })
  await load('/one', validate)
  await load('/two', validate)
  await load('/one', validate)
  await load('/three', validate)
  assert.equal(await load('/one', validate), 1)
  assert.equal(await load('/two', validate), 4)
})

test('persistent cache survives loader recreation and evicts old detail files', async () => {
  const { storage, entries } = fakeStorage()
  let count = 0
  const fetcher: typeof fetch = async () => Response.json(++count)
  const load = createJsonLoader({ storage, diskLimit: 3, fetcher })
  await load('/index.json', validate)
  await load('/one', validate)
  await load('/two', validate)
  await load('/three', validate)
  await flushWrites()
  assert.equal(entries.size, 3)
  assert.ok(entries.has('/index.json'))
  assert.ok(!entries.has('/one'))
  const offline = createJsonLoader({
    storage,
    fetcher: async () => {
      throw new Error('offline')
    },
  })
  assert.equal(await offline('/three', validate), 4)
})

test('corrupt cache and unavailable storage fall back to network', async () => {
  const { storage, entries } = fakeStorage()
  entries.set(
    '/one',
    new Response('broken JSON', {
      headers: { 'x-dataset-expires': String(Date.now() + CACHE_TTL) },
    }),
  )
  const load = createJsonLoader({ storage, fetcher: async () => Response.json(1) })
  assert.equal(await load('/one', validate), 1)
  const blocked = {
    open: async () => {
      throw new Error('blocked')
    },
  } as unknown as CacheStorage
  assert.equal(
    await createJsonLoader({ storage: blocked, fetcher: async () => Response.json(2) })(
      '/two',
      validate,
    ),
    2,
  )
})
