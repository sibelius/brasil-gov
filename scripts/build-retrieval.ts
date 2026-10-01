import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { extractPassages, searchMetadata } from '../src/lib/retrieval/extract-passages.ts'
import { tokenize } from '../src/lib/retrieval/query.ts'
import { RETRIEVAL_SCHEMA, type Passage, type RetrievalIndex } from '../src/lib/retrieval/types.ts'
import { parseCatalog } from '../src/lib/services/model.ts'

const ROOT = new URL('../public/data/v1/', import.meta.url)
const OUTPUT = new URL('retrieval/', ROOT)
const CHECK_ONLY = process.argv.includes('--check')

async function writeChanged(path: URL, value: unknown) {
  const content = `${JSON.stringify(value)}\n`
  const previous = await readFile(path, 'utf8').catch(() => '')

  if (previous !== content) {
    if (CHECK_ONLY) {
      throw new Error(
        `Generated retrieval data is stale: ${fileURLToPath(path)}. Run pnpm data:build.`,
      )
    }

    await writeFile(path, content)
  }
}

export async function buildRetrieval() {
  const started = performance.now()
  const catalogBytes = await readFile(new URL('index.json', ROOT))
  const catalog = parseCatalog(JSON.parse(catalogBytes.toString()))
  const files = await readdir(new URL('services/', ROOT))
  const sourceHash = createHash('sha256').update(catalogBytes)
  const postings = new Map<string, number[]>()
  const documents: RetrievalIndex['documents'] = []
  const passageFiles = new Map<string, Passage[]>()
  let passageCount = 0

  if (files.length !== catalog.length) {
    throw new Error('Service files do not match the catalog.')
  }

  for (const [documentIndex, summary] of catalog.entries()) {
    const bytes = await readFile(new URL(`services/${summary.id}.json`, ROOT))
    const raw: unknown = JSON.parse(bytes.toString())
    const passages = extractPassages(raw, summary)
    const [aliases, keywords] = searchMetadata(raw)
    const weights = new Map<string, number>()
    const fields: [string, number][] = [
      [summary.name, 8],
      [aliases, 6],
      [keywords, 4],
      [summary.agency, 3],
      [passages.map((passage) => passage.text).join(' '), 1],
    ]

    sourceHash.update(summary.id).update(bytes)

    for (const [field, weight] of fields) {
      for (const term of tokenize(field)) {
        weights.set(term, Math.max(weight, weights.get(term) ?? 0))
      }
    }

    for (const [term, weight] of weights) {
      const list = postings.get(term) ?? []

      list.push(documentIndex, weight)
      postings.set(term, list)
    }

    documents.push({ ...summary, titleTerms: tokenize(summary.name) })
    passageFiles.set(summary.id, passages)
    passageCount += passages.length
  }

  const sourceDigest = sourceHash.digest('hex')
  const content = {
    documents,
    postings: Object.fromEntries(
      [...postings.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')),
    ),
  }
  const revisionHash = createHash('sha256')
    .update(String(RETRIEVAL_SCHEMA))
    .update(sourceDigest)
    .update(JSON.stringify(content))
    .update(JSON.stringify([...passageFiles]))
    .digest('hex')
  const revision = revisionHash.slice(0, 20)
  const index: RetrievalIndex = { schema: RETRIEVAL_SCHEMA, revision, ...content }

  if (!CHECK_ONLY) {
    await mkdir(new URL('passages/', OUTPUT), { recursive: true })
  }
  await writeChanged(new URL('index.json', OUTPUT), index)

  for (const [serviceId, passages] of passageFiles) {
    await writeChanged(new URL(`passages/${serviceId}.json`, OUTPUT), {
      revision,
      serviceId,
      passages,
    })
  }

  const indexBytes = Buffer.from(JSON.stringify(index))
  const manifest = {
    schema: RETRIEVAL_SCHEMA,
    revision,
    sourceDigest,
    serviceCount: documents.length,
    passageCount,
    indexBytes: indexBytes.length,
    indexGzipBytes: gzipSync(indexBytes).length,
  }

  await writeChanged(new URL('manifest.json', OUTPUT), manifest)

  return { ...manifest, buildMs: Math.round(performance.now() - started) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await buildRetrieval(), null, 2))
}
