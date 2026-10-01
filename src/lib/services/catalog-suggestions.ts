import { analyzeQuestion, normalize } from '../retrieval/query.ts'
import type { RetrievalIndex } from '../retrieval/types.ts'
import type { SuggestionPage } from './catalog-types.ts'

export const SUGGESTION_LIMIT = 10
export const MIN_SUGGESTION_LENGTH = 2

export function createCatalogSuggester(index: RetrievalIndex) {
  const vocabulary = Object.keys(index.postings).sort()
  const cache = new Map<string, number[]>()

  function page(documents: number[], offset: number): SuggestionPage {
    return {
      total: documents.length,
      items: documents.slice(offset, offset + SUGGESTION_LIMIT).map((document) => {
        const { id, name, agency, url } = index.documents[document]

        return { id, name, agency, url }
      }),
    }
  }

  function matchingTerms(prefix: string) {
    let left = 0
    let right = vocabulary.length

    while (left < right) {
      const middle = (left + right) >>> 1

      if (vocabulary[middle] < prefix) {
        left = middle + 1
      } else {
        right = middle
      }
    }

    const terms: string[] = []

    for (let position = left; vocabulary[position]?.startsWith(prefix); position++) {
      terms.push(vocabulary[position])
    }

    return terms
  }

  return (input: string, offset = 0): SuggestionPage => {
    const query = normalize(input.slice(0, 300))
    const terms = analyzeQuestion(query).topics

    if (query.length < MIN_SUGGESTION_LENGTH || !terms.length) {
      return { items: [], total: 0 }
    }

    const cached = cache.get(query)

    if (cached) {
      cache.delete(query)
      cache.set(query, cached)

      return page(cached, offset)
    }

    let matches: Map<number, number> | undefined

    for (const [position, term] of terms.entries()) {
      const variants = position === terms.length - 1 ? matchingTerms(term) : [term]
      const scores = new Map<number, number>()

      for (const variant of variants) {
        const postings = index.postings[variant] ?? []

        for (let offset = 0; offset < postings.length; offset += 2) {
          const document = postings[offset]
          const weight = postings[offset + 1]

          if (weight >= 3) {
            const score = weight + (variant === term ? 2 : 0)

            scores.set(document, Math.max(scores.get(document) ?? 0, score))
          }
        }
      }

      matches = matches
        ? new Map(
            [...matches]
              .filter(([id]) => scores.has(id))
              .map(([id, score]) => [id, score + scores.get(id)!]),
          )
        : scores

      if (!matches.size) break
    }

    const suggestions = [...(matches ?? [])]
      .sort(
        ([a, scoreA], [b, scoreB]) =>
          scoreB - scoreA ||
          index.documents[a].name.length - index.documents[b].name.length ||
          index.documents[a].id.localeCompare(index.documents[b].id, 'en'),
      )
      .map(([document]) => document)

    cache.set(query, suggestions)

    if (cache.size > 40) {
      cache.delete(cache.keys().next().value!)
    }

    return page(suggestions, offset)
  }
}
