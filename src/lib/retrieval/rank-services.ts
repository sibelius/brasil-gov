import { analyzeQuestion } from './query.ts'
import type { Candidate, RetrievalIndex } from './types.ts'

type Match = {
  score: number
  matched: Set<string>
  primary: Set<string>
}

export function createServiceRanker(index: RetrievalIndex) {
  const postings = new Map(Object.entries(index.postings))

  return (question: string): Candidate[] => {
    const query = analyzeQuestion(question)
    const matches = new Map<number, Match>()

    for (const term of query.topics) {
      const list = postings.get(term)

      if (!list) {
        continue
      }

      const rarity = Math.log(1 + index.documents.length / (list.length / 2))

      for (let position = 0; position < list.length; position += 2) {
        const documentIndex = list[position]
        const weight = list[position + 1]
        const match = matches.get(documentIndex) ?? {
          score: 0,
          matched: new Set(),
          primary: new Set(),
        }

        match.score += weight * rarity
        match.matched.add(term)

        if (weight >= 3) {
          match.primary.add(term)
        }

        matches.set(documentIndex, match)
      }
    }

    const candidates: Candidate[] = []

    for (const [documentIndex, match] of matches) {
      const document = index.documents[documentIndex]
      const coverage = match.matched.size / query.topics.length
      const exactTitle =
        document.titleTerms.length > 0 &&
        document.titleTerms.every((term) => query.topics.includes(term))
      const titleCoverage =
        document.titleTerms.filter((term) => query.topics.includes(term)).length /
        Math.max(1, document.titleTerms.length)
      const score =
        match.score * (0.25 + coverage * 0.75) + titleCoverage * 25 + (exactTitle ? 60 : 0)

      if (coverage < 0.65 || (!match.primary.size && match.score < 8)) {
        continue
      }

      candidates.push({
        service: {
          id: document.id,
          name: document.name,
          agency: document.agency,
          url: document.url,
        },
        score,
        matchedTerms: [...match.matched],
        primaryTerms: [...match.primary],
        exactTitle,
      })
    }

    return candidates.sort(
      (a, b) => b.score - a.score || a.service.id.localeCompare(b.service.id, 'en'),
    )
  }
}
