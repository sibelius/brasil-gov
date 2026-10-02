import { readFile } from 'node:fs/promises'
import { createRetriever } from '../src/lib/retrieval/engine.ts'
import { normalize } from '../src/lib/retrieval/query.ts'
import {
  SECTIONS,
  type PassageFile,
  type RetrievalBudget,
  type RetrievalIndex,
  type Section,
} from '../src/lib/retrieval/types.ts'
import { validateIndex, validatePassages } from '../src/lib/retrieval/validation.ts'
import { createCatalogSuggester } from '../src/lib/services/catalog-suggestions.ts'
import {
  DEADLINE_DISCLAIMER,
  estimateDeadline,
  isCivilDate,
  today,
  TIME_ZONE,
} from '../src/lib/services/deadline.ts'
import { durationLabel, parseDuration } from '../src/lib/services/duration.ts'
import { legalCalendar, parseHolidays, type HolidayCalendar } from '../src/lib/services/holidays.ts'
import { DATASET, parseService, type ServiceSummary } from '../src/lib/services/model.ts'

export const LOCAL_DATA = new URL('../public/data/v1/', import.meta.url)
export const REMOTE_DATA = new URL('https://brasil-gov.vercel.app/data/v1/')
export const MAX_PAGE = 50

const PASSAGE_CACHE_LIMIT = 64
const SERVICE_CACHE_LIMIT = 64

type Manifest = {
  revision: string
  serviceCount: number
  passageCount: number
}

type RecordValue = Record<string, unknown>

function object(value: unknown): RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : {}
}

function items(value: unknown): unknown[] {
  const list = object(value).item

  return Array.isArray(list) ? list : []
}

function labels(value: unknown): string[] {
  return items(value)
    .map((entry) => (typeof entry === 'string' ? entry : object(entry).item))
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    .map((entry) => entry.trim())
}

function assertId(id: string) {
  if (!/^\d{1,8}$/.test(id)) {
    throw new Error(`Identificador de serviço inválido: ${id}`)
  }
}

function remember<T>(cache: Map<string, T>, key: string, value: T, limit: number) {
  cache.set(key, value)

  while (cache.size > limit) {
    cache.delete(cache.keys().next().value!)
  }
}

export function page<T>(list: T[], offset = 0, limit = 10) {
  const size = Math.min(Math.max(1, limit), MAX_PAGE)
  const start = Math.max(0, offset)

  return {
    total: list.length,
    offset: start,
    limit: size,
    items: list.slice(start, start + size),
    nextOffset: start + size < list.length ? start + size : null,
  }
}

export async function openCatalog(base: URL = LOCAL_DATA) {
  async function readJson(path: string): Promise<unknown> {
    const url = new URL(path, base)

    if (url.protocol === 'file:') {
      return JSON.parse(await readFile(url, 'utf8'))
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) })

    if (!response.ok) {
      throw new Error(`Falha ao carregar ${url.href}: HTTP ${response.status}`)
    }

    return response.json()
  }

  const manifest = (await readJson('retrieval/manifest.json')) as Manifest
  const index: RetrievalIndex = validateIndex(
    await readJson('retrieval/index.json'),
    manifest.revision,
  )
  const documents = new Map(index.documents.map((document) => [document.id, document]))
  const passageCache = new Map<string, Promise<PassageFile>>()
  const serviceCache = new Map<string, Promise<RecordValue>>()

  function loadPassages(id: string): Promise<PassageFile> {
    assertId(id)

    const cached = passageCache.get(id)

    if (cached) {
      return cached
    }

    const job = readJson(`retrieval/passages/${id}.json`).then((value) => {
      return validatePassages(value, manifest.revision, id)
    })

    job.catch(() => passageCache.delete(id))
    remember(passageCache, id, job, PASSAGE_CACHE_LIMIT)

    return job
  }

  function loadRaw(id: string): Promise<RecordValue> {
    assertId(id)

    if (!documents.has(id)) {
      return Promise.reject(new Error(`Serviço ${id} não existe no catálogo.`))
    }

    const cached = serviceCache.get(id)

    if (cached) {
      return cached
    }

    const job = readJson(`services/${id}.json`).then(object)

    job.catch(() => serviceCache.delete(id))
    remember(serviceCache, id, job, SERVICE_CACHE_LIMIT)

    return job
  }

  // Federal law alone is enough to count business days, so a missing or
  // unreachable dataset degrades to the law-derived calendar instead of
  // failing the whole catalog.
  const holidays: HolidayCalendar = await readJson('holidays.json')
    .then(parseHolidays)
    .catch(() => legalCalendar(new Date().getUTCFullYear(), new Date().getUTCFullYear() + 4))

  const retriever = createRetriever({ index, loadPassages })
  const suggest = createCatalogSuggester(index)
  const agencies = new Map<string, number>()

  for (const document of index.documents) {
    agencies.set(document.agency, (agencies.get(document.agency) ?? 0) + 1)
  }

  function summary(id: string): ServiceSummary {
    const { name, agency, url } = documents.get(id)!

    return { id, name, agency, url }
  }

  function searchServices(query: string) {
    const ranked = retriever.rankServices(query).map((candidate) => ({
      ...candidate.service,
      score: Number(candidate.score.toFixed(2)),
      exactTitle: candidate.exactTitle,
    }))

    if (ranked.length) {
      return { strategy: 'ranked' as const, results: ranked }
    }

    const results = []

    for (let offset = 0; offset < 200; offset += 10) {
      const suggestions = suggest(query, offset)

      results.push(...suggestions.items)

      if (offset + 10 >= suggestions.total) {
        break
      }
    }

    return { strategy: 'prefix' as const, results }
  }

  async function getService(id: string) {
    const raw = await loadRaw(id)
    const service = parseService(raw, id)
    const agency = object(raw.orgao)

    return {
      ...service,
      free: raw.gratuito === 'true' ? true : raw.gratuito === 'false' ? false : null,
      digital: raw.servicoDigital === true,
      digitalPercentage: typeof raw.porcentagemDigital === 'number' ? raw.porcentagemDigital : null,
      agencySiorgUri: typeof agency.id === 'string' ? agency.id : null,
      audiences: labels(raw.segmentosDaSociedade),
      topics: labels(raw.areasDeInteresse),
      keywords: labels(raw.palavrasChave),
      popularNames: labels(raw.nomesPopulares),
    }
  }

  async function getSection(id: string, section: Section) {
    if (!documents.has(id)) {
      throw new Error(`Serviço ${id} não existe no catálogo.`)
    }

    const file = await loadPassages(id)

    return {
      service: summary(id),
      section,
      passages: file.passages
        .filter((passage) => passage.section === section)
        .map(({ id: passageId, title, text, sourcePath }) => ({
          id: passageId,
          title,
          text,
          sourcePath,
        })),
    }
  }

  function listAgencies(query = '') {
    const term = normalize(query)

    return [...agencies]
      .filter(([name]) => !term || normalize(name).includes(term))
      .map(([name, services]) => ({ name, services }))
      .sort((a, b) => b.services - a.services || a.name.localeCompare(b.name, 'pt-BR'))
  }

  function servicesByAgency(agency: string) {
    const term = normalize(agency)
    const exact = index.documents.filter((document) => normalize(document.agency) === term)
    const matches = exact.length
      ? exact
      : index.documents.filter((document) => normalize(document.agency).includes(term))

    return matches
      .map(({ id }) => summary(id))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }

  function retrieveContext(
    question: string,
    selectedServiceId?: string,
    budget?: Partial<RetrievalBudget>,
  ) {
    return retriever.retrieveContext({ question, selectedServiceId, budget })
  }

  async function estimateServiceDeadline(id: string, start?: string) {
    if (start !== undefined && !isCivilDate(start)) {
      throw new Error('Data inicial inválida. Use o formato AAAA-MM-DD.')
    }

    const raw = await loadRaw(id)
    const parsed = parseDuration(raw.tempoTotalEstimado)
    const from = start ?? today()
    const deadline = estimateDeadline(from, parsed, holidays)

    return {
      service: summary(id),
      start: from,
      timeZone: TIME_ZONE,
      publishedDuration: {
        kind: parsed.kind,
        label: durationLabel(parsed) || null,
        min: parsed.min || null,
        max: parsed.max || null,
        unit: parsed.unit || null,
        note: parsed.note || null,
      },
      estimate: deadline,
      holidayCalendar: {
        years: { from: holidays.from, to: holidays.to },
        nationalHolidays: holidays.national.size,
        coverage:
          'Os feriados nacionais são datas fixas de lei federal, então a contagem de dias úteis vale para qualquer ano, inclusive fora do intervalo acima.',
        pontoFacultativo:
          'Não descontado: Carnaval, Corpus Christi e Sexta-feira da Paixão contam como dias úteis.',
      },
      disclaimer: DEADLINE_DISCLAIMER,
    }
  }

  function info() {
    return {
      name: 'Brasil.gov',
      description:
        'Catálogo de serviços públicos federais do gov.br (projeto independente, não oficial).',
      source: 'https://api-servicos.estaleiro.serpro.gov.br/servicos-json',
      sourceDocumentation: 'https://www.gov.br/conecta/catalogo/apis/api-de-servicos/',
      collected: DATASET.collected,
      datasetRevision: DATASET.revision,
      retrievalRevision: manifest.revision,
      services: manifest.serviceCount,
      passages: manifest.passageCount,
      agencies: agencies.size,
      sections: SECTIONS,
      dataBase: base.protocol === 'file:' ? 'local' : base.href,
      disclaimer:
        'Os dados refletem a coleta indicada. Confirme requisitos, custos e prazos na página oficial de cada serviço.',
    }
  }

  return {
    info,
    has: (id: string) => documents.has(id),
    summary,
    searchServices,
    getService,
    getRaw: loadRaw,
    getSection,
    listAgencies,
    servicesByAgency,
    retrieveContext,
    estimateDeadline: estimateServiceDeadline,
  }
}

export type Catalog = Awaited<ReturnType<typeof openCatalog>>
