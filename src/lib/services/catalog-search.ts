import type { ServiceSummary } from './model.ts'

export const PAGE_SIZE = 8

const STOP_WORDS = new Set(
  'a o e os as um uma de do da dos das em no na nos nas por para pra com que se ao meu minha eu como qual quais quando onde quem posso pode preciso fazer faco quero saber sobre tirar obter solicitar'.split(
    ' ',
  ),
)

export type SearchResult = {
  items: ServiceSummary[]
  total: number
  catalogSize: number
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(text: string): string[] {
  const words = normalize(text)
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))

  return [...new Set(words)]
}

export function createCatalogSearch(catalog: ServiceSummary[]) {
  const postings = new Map<string, Map<number, number>>()

  catalog.forEach((service, index) => {
    const fields = [
      [service.name, 3],
      [service.agency, 1],
    ] as const

    for (const [field, weight] of fields) {
      for (const term of tokens(field)) {
        const docs = postings.get(term) ?? new Map<number, number>()

        docs.set(index, Math.max(weight, docs.get(index) ?? 0))
        postings.set(term, docs)
      }
    }
  })

  return (query: string, offset = 0): SearchResult => {
    const terms = tokens(query.slice(0, 300))
    const scores = new Map<number, { score: number; matched: number }>()

    for (const term of terms) {
      const docs = postings.get(term)

      if (!docs) {
        continue
      }

      const idf = Math.log(1 + catalog.length / docs.size)

      for (const [index, weight] of docs) {
        const hit = scores.get(index) ?? { score: 0, matched: 0 }

        hit.score += weight * idf
        hit.matched++
        scores.set(index, hit)
      }
    }

    const hits = [...scores.entries()]
      .filter(([, hit]) => hit.matched === terms.length)
      .sort(
        ([a, x], [b, y]) =>
          y.score - x.score || catalog[a].name.length - catalog[b].name.length || a - b,
      )

    return {
      items: hits.slice(offset, offset + PAGE_SIZE).map(([index]) => catalog[index]),
      total: hits.length,
      catalogSize: catalog.length,
    }
  }
}
