import { readFile } from 'node:fs/promises'
import { createJsonLoader } from '../src/lib/json-cache.ts'
import { createRetriever } from '../src/lib/retrieval/engine.ts'
import type { RetrievalRequest } from '../src/lib/retrieval/types.ts'
import { validateIndex, validatePassages } from '../src/lib/retrieval/validation.ts'

const ROOT = new URL('../public/data/v1/retrieval/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', ROOT), 'utf8'))
const fixtures: RetrievalRequest[] = JSON.parse(
  await readFile(new URL('../tests/fixtures/retrieval-questions.json', import.meta.url), 'utf8'),
)
const heapBefore = process.memoryUsage().heapUsed
const started = performance.now()
const index = validateIndex(
  JSON.parse(await readFile(new URL('index.json', ROOT), 'utf8')),
  manifest.revision,
)
let passageFilesRead = 0
let passageBytesRead = 0
const loadJson = createJsonLoader({
  memoryLimit: 8,
  fetcher: async (input) => {
    const bytes = await readFile(new URL(String(input), ROOT))

    passageFilesRead++
    passageBytesRead += bytes.length

    return new Response(bytes.toString())
  },
})
const engine = createRetriever({
  index,
  loadPassages: (id) =>
    loadJson(`passages/${id}.json`, (value) => {
      return validatePassages(value, manifest.revision, id)
    }),
})
const initializationMs = performance.now() - started
const cold: number[] = []
const search: number[] = []
const cached: number[] = []

for (const fixture of fixtures) {
  const start = performance.now()

  await engine.retrieveContext(fixture)
  cold.push(performance.now() - start)
}

for (let run = 0; run < 20; run++) {
  for (const fixture of fixtures) {
    const searchStart = performance.now()

    engine.rankServices(fixture.question)
    search.push(performance.now() - searchStart)

    const cachedStart = performance.now()

    await engine.retrieveContext(fixture)
    cached.push(performance.now() - cachedStart)
  }
}

function percentiles(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  const at = (fraction: number) =>
    Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(3))

  return { samples: sorted.length, p50Ms: at(0.5), p95Ms: at(0.95) }
}

console.log(
  JSON.stringify(
    {
      environment: `Node ${process.version}, ${process.platform}/${process.arch}; local files, no network or browser rendering`,
      revision: manifest.revision,
      indexBytes: manifest.indexBytes,
      indexGzipBytes: manifest.indexGzipBytes,
      initializationMs: Number(initializationMs.toFixed(2)),
      firstQueries: percentiles(cold),
      serviceRanking: percentiles(search),
      cachedContext: percentiles(cached),
      passageFilesRead,
      passageBytesRead,
      heapGrowthMiB: Number(
        ((process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024).toFixed(2),
      ),
    },
    null,
    2,
  ),
)
