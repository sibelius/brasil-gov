import { DEFAULT_BUDGET, type Evidence, type RetrievalBudget, type Section } from './types.ts'

export function resolveBudget(options: Partial<RetrievalBudget> = {}): RetrievalBudget {
  const budget = { ...DEFAULT_BUDGET, ...options }
  const limits: RetrievalBudget = { maxCharacters: 100_000, maxPassages: 32, maxServices: 5 }

  for (const key of Object.keys(limits) as (keyof RetrievalBudget)[]) {
    if (!Number.isInteger(budget[key]) || budget[key] < 1 || budget[key] > limits[key]) {
      throw new RangeError(`Invalid retrieval budget: ${key}`)
    }
  }

  return budget
}

function serialize(passages: Evidence[]): string {
  return JSON.stringify({
    sources: passages.map((passage) => ({
      id: passage.id,
      service: passage.serviceName,
      section: passage.title,
      path: passage.sourcePath,
      url: passage.url,
      text: passage.text,
    })),
  })
}

export function packContext(evidence: Evidence[], budget: RetrievalBudget, intents: Section[]) {
  const selected: Evidence[] = []
  const seen = new Set<string>()
  const services = new Set<string>()

  for (const passage of evidence) {
    const key = `${passage.serviceId}:${passage.title}:${passage.text}`

    if (
      seen.has(key) ||
      selected.length >= budget.maxPassages ||
      (!services.has(passage.serviceId) && services.size >= budget.maxServices)
    ) {
      continue
    }

    const next = [...selected, passage]

    if (serialize(next).length > budget.maxCharacters) {
      continue
    }

    selected.push(passage)
    seen.add(key)
    services.add(passage.serviceId)
  }

  const serviceOrder = [...services]

  selected.sort(
    (a, b) =>
      serviceOrder.indexOf(a.serviceId) - serviceOrder.indexOf(b.serviceId) || a.order - b.order,
  )

  const context = selected.length ? serialize(selected) : ''
  const sections = new Set(selected.map((passage) => passage.section))

  return {
    passages: selected,
    context,
    characters: context.length,
    omittedPassages: evidence.length - selected.length,
    missingSections: intents.filter((section) => !sections.has(section)),
  }
}
