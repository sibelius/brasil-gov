import { DATASET, parseCatalog, parseService } from './model.ts'

export const CACHE_TTL = 24 * 60 * 60 * 1000
const CACHE_NAME = `brasil-gov-data-${DATASET.revision}`

type LoaderOptions = {
  fetcher?: typeof fetch
  storage?: CacheStorage
  now?: () => number
  memoryLimit?: number
  diskLimit?: number
}

export function createJsonLoader({
  fetcher = globalThis.fetch.bind(globalThis),
  storage = globalThis.caches,
  now = Date.now,
  memoryLimit = 32,
  diskLimit = 81,
}: LoaderOptions = {}) {
  const memory = new Map<string, { value: unknown; expires: number }>()
  const pending = new Map<string, Promise<unknown>>()
  let writing = Promise.resolve()

  async function openCache() {
    try {
      return await storage?.open(CACHE_NAME)
    } catch {
      return undefined
    }
  }

  async function persist(disk: Cache | undefined, path: string, raw: unknown, expires: number) {
    if (!disk) {
      return
    }

    const response = new Response(JSON.stringify(raw), {
      headers: {
        'content-type': 'application/json',
        'x-dataset-expires': String(expires),
      },
    })

    await disk.delete(path)
    await disk.put(path, response)

    const keys = await disk.keys()
    const removable = keys.filter((key) => !new URL(key.url).pathname.endsWith('/index.json'))
    const overflow = Math.max(0, keys.length - diskLimit)

    for (const key of removable.slice(0, overflow)) {
      await disk.delete(key)
    }
  }

  async function read<T>(path: string, validate: (value: unknown) => T) {
    const disk = await openCache()
    let value: T | undefined
    let expires = 0

    try {
      const response = await disk?.match(path)
      expires = Number(response?.headers.get('x-dataset-expires'))

      if (response && expires > now()) {
        value = validate(await response.json())
      } else if (response) {
        await disk?.delete(path)
      }
    } catch {
      await disk?.delete(path).catch(() => undefined)
    }

    if (value === undefined) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20_000)

      try {
        const response = await fetcher(path, { signal: controller.signal, cache: 'no-cache' })

        if (!response.ok) {
          throw new Error(`Falha ao carregar os dados (HTTP ${response.status}).`)
        }

        const raw: unknown = await response.json()
        value = validate(raw)
        expires = now() + CACHE_TTL
        writing = writing.then(() => persist(disk, path, raw, expires)).catch(() => undefined)
      } finally {
        clearTimeout(timeout)
      }
    }

    memory.set(path, { value, expires })

    while (memory.size > memoryLimit) {
      memory.delete(memory.keys().next().value!)
    }

    return value
  }

  return async function load<T>(path: string, validate: (value: unknown) => T): Promise<T> {
    const cached = memory.get(path)

    if (cached && cached.expires > now()) {
      memory.delete(path)
      memory.set(path, cached)

      return cached.value as T
    }

    memory.delete(path)

    const inFlight = pending.get(path)

    if (inFlight) {
      return inFlight as Promise<T>
    }

    const request = read(path, validate)
    pending.set(path, request)

    try {
      return await request
    } finally {
      pending.delete(path)
    }
  }
}

const loadJson = createJsonLoader()

export function loadCatalog() {
  return loadJson(`${DATASET.base}/index.json`, parseCatalog)
}

export function loadService(id: string) {
  if (!/^\d+$/.test(id)) {
    return Promise.reject(new Error('Identificador de serviço inválido.'))
  }

  return loadJson(`${DATASET.base}/services/${id}.json`, (value) => parseService(value, id))
}
