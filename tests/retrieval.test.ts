import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { packContext, resolveBudget } from '../src/lib/retrieval/context.ts'
import { createRetriever } from '../src/lib/retrieval/engine.ts'
import { extractPassages } from '../src/lib/retrieval/extract-passages.ts'
import { tokenize } from '../src/lib/retrieval/query.ts'
import {
  DEFAULT_BUDGET,
  type Evidence,
  type PassageFile,
  type RetrievedContext,
  type RetrievalRequest,
} from '../src/lib/retrieval/types.ts'
import { validateIndex, validatePassages } from '../src/lib/retrieval/validation.ts'

const ROOT = new URL('../public/data/v1/retrieval/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('manifest.json', ROOT), 'utf8'))
const index = validateIndex(
  JSON.parse(await readFile(new URL('index.json', ROOT), 'utf8')),
  manifest.revision,
)

type EvaluationCase = RetrievalRequest & {
  status: RetrievedContext['status']
  reason?: RetrievedContext['reason']
  services?: string[]
  sources?: string[]
  contains?: string[]
}

const cases: EvaluationCase[] = JSON.parse(
  await readFile(new URL('fixtures/retrieval-questions.json', import.meta.url), 'utf8'),
)

async function loadPassages(id: string): Promise<PassageFile> {
  const raw = JSON.parse(await readFile(new URL(`passages/${id}.json`, ROOT), 'utf8'))

  return validatePassages(raw, index.revision, id)
}

const engine = createRetriever({ index, loadPassages })

for (const fixture of cases) {
  test(`retrieval: ${fixture.question} (${fixture.selectedServiceId ?? 'unscoped'})`, async () => {
    const result = await engine.retrieveContext(fixture)

    assert.equal(result.status, fixture.status)
    assert.equal(result.reason, fixture.reason)

    for (const id of fixture.services ?? []) {
      assert.ok(
        result.services.some((service) => service.id === id),
        `Missing service ${id}`,
      )
    }

    for (const id of fixture.sources ?? []) {
      assert.ok(
        result.passages.some((passage) => passage.id === id),
        `Missing passage ${id}`,
      )
    }

    for (const text of fixture.contains ?? []) {
      assert.ok(
        result.passages.some((passage) => passage.text.includes(text)),
        `Missing condition ${text}`,
      )
    }

    assert.equal(result.characters, result.context.length)
    assert.ok(result.characters <= DEFAULT_BUDGET.maxCharacters)

    for (const passage of result.passages) {
      const source = await loadPassages(passage.serviceId)

      assert.equal(
        passage.text,
        source.passages.find((original) => original.id === passage.id)?.text,
      )
      assert.ok(
        result.services.some(
          (service) => service.id === passage.serviceId && service.url === passage.url,
        ),
      )
    }
  })
}

test('generated passages match all source records and keep stable references', async () => {
  let count = 0

  for (const summary of index.documents) {
    const sourcePath = new URL(`../services/${summary.id}.json`, ROOT)
    const raw = JSON.parse(await readFile(sourcePath, 'utf8'))
    const generated = await loadPassages(summary.id)

    assert.deepEqual(generated.passages, extractPassages(raw, summary))
    count += generated.passages.length
  }

  assert.equal(count, manifest.passageCount)
})

test('cost conditions stay in one passage, including exemptions and variable values', () => {
  const summary = { id: '1', name: 'Example', agency: 'Agency', url: 'https://www.gov.br/example' }
  const raw = {
    id: 'https://servicos.gov.br/api/v1/servicos/1',
    nome: summary.name,
    orgao: { nomeOrgao: summary.agency },
    url: summary.url,
    gratuito: 'false',
    etapas: [
      {
        titulo: 'Pagar',
        custos: {
          custos: [{ descricao: 'Taxa normal', moeda: 'R$', valor: '50' }],
          casos: [{ descricao: 'Para menores: isenção', custo: [{ moeda: 'R$', valor: '0' }] }],
        },
      },
    ],
  }
  const passages = extractPassages(raw, summary)

  assert.equal(passages.length, 1)
  assert.ok(passages[0].text.includes('R$ 50'))
  assert.ok(passages[0].text.includes('Para menores: isenção'))
  assert.ok(passages[0].text.includes('R$ 0'))
  assert.equal(passages[0].sourcePath, '/etapas/0/custos')
})

test('whole-passage budgeting counts source metadata and never truncates conditions', async () => {
  const full = await engine.retrieveContext({ question: 'Quanto custa o passaporte?' })
  const exact = packContext(
    full.passages,
    { ...DEFAULT_BUDGET, maxCharacters: full.context.length },
    ['costs'],
  )
  const tiny = await engine.retrieveContext({
    question: 'Quanto custa o passaporte?',
    budget: { maxCharacters: 20 },
  })

  assert.equal(exact.context, full.context)
  assert.equal(tiny.status, 'insufficient_evidence')
  assert.equal(tiny.reason, 'budget_exceeded')
  assert.equal(tiny.context, '')
  assert.throws(() => resolveBudget({ maxCharacters: Number.NaN }))
  assert.throws(() => resolveBudget({ maxPassages: 0 }))
})

test('does not report readiness when the requested section is absent', async () => {
  const noCosts = createRetriever({
    index,
    loadPassages: async (id) => {
      const file = await loadPassages(id)

      return { ...file, passages: file.passages.filter((passage) => passage.section !== 'costs') }
    },
  })
  const result = await noCosts.retrieveContext({ question: 'Quanto custa passaporte?' })

  assert.equal(result.status, 'insufficient_evidence')
  assert.deepEqual(result.missingSections, ['costs'])
})

test('deduplicates in-flight queries, caches by scope/budget, and retries failed downloads', async () => {
  let calls = 0
  let fail = true
  const retriever = createRetriever({
    index,
    loadPassages: async (id) => {
      calls++

      if (fail) {
        throw new Error('offline')
      }

      return loadPassages(id)
    },
  })
  const request = { question: 'Quanto custa passaporte?' }

  await assert.rejects(retriever.retrieveContext(request), /offline/)
  fail = false

  await Promise.all([retriever.retrieveContext(request), retriever.retrieveContext(request)])
  await retriever.retrieveContext(request)
  assert.equal(calls, 2)

  await retriever.retrieveContext({ ...request, budget: { maxCharacters: 10 } })
  assert.equal(calls, 3)
  await retriever.retrieveContext({ ...request, selectedServiceId: '62' })
  assert.equal(calls, 4)
})

test('invalid or unrelated selections cannot silently answer about another service', async () => {
  await assert.rejects(
    engine.retrieveContext({ question: 'Quanto custa?', selectedServiceId: '../../bad' }),
  )

  const result = await engine.retrieveContext({
    question: 'Como abrir MEI?',
    selectedServiceId: '62',
  })

  assert.equal(result.status, 'insufficient_evidence')
  assert.equal(result.context, '')
})

test('clarifying one service preserves the other service in a multi-topic question', async () => {
  const result = await engine.retrieveContext({
    question: 'Quais documentos para passaporte e CPF?',
    selectedServiceId: '10420',
  })

  assert.deepEqual(
    result.services.map((service) => service.id),
    ['62', '10420'],
  )
})

test('keeps source order and deduplicates identical evidence without merging different conditions', () => {
  const base: Evidence = {
    id: '1:/descricao',
    serviceId: '1',
    serviceName: 'Example',
    section: 'description',
    title: 'First',
    text: 'Content',
    sourcePath: '/descricao',
    url: 'https://www.gov.br/',
    order: 0,
    score: 1,
  }
  const second = {
    ...base,
    id: '1:/etapas/0/descricao',
    title: 'Second',
    sourcePath: '/etapas/0/descricao',
    order: 1,
  }
  const result = packContext([second, base, base], DEFAULT_BUDGET, [])

  assert.deepEqual(
    result.passages.map((passage) => passage.id),
    [base.id, second.id],
  )
})

test('validates artifact revisions, posting references and passage identities', async () => {
  assert.throws(() => validateIndex(index, 'wrong-revision'))
  assert.throws(() =>
    validateIndex({ ...index, postings: { invalid: [999999, 1] } }, index.revision),
  )

  const file = await loadPassages('62')

  assert.throws(() => validatePassages(file, 'wrong-revision', '62'))
  assert.throws(() => validatePassages(file, index.revision, '1036'))
  assert.ok(tokenize('NÃO tenho documentos').includes('nao'))
  assert.deepEqual(tokenize('CRIANÇAS'), tokenize('menores'))
})
