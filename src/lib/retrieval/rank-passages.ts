import { analyzeQuestion, tokenize } from './query.ts'
import type { Candidate, Evidence, Passage } from './types.ts'

export function rankPassages(
  question: string,
  candidate: Candidate,
  passages: Passage[],
): Evidence[] {
  const query = analyzeQuestion(question)
  const matches: Evidence[] = []

  for (const passage of passages) {
    const terms = new Set(tokenize(`${passage.title} ${passage.text}`))
    const matchesIntent = query.intents.includes(passage.section)
    const modifierMatches = query.modifiers.filter((term) => terms.has(term)).length
    const topicMatches = query.topics.filter((term) => terms.has(term)).length
    const isScope = passage.section === 'eligibility'

    if (query.intents.length && !matchesIntent && !isScope) {
      continue
    }

    const score =
      (matchesIntent ? 30 : 0) +
      modifierMatches * 20 +
      topicMatches * 2 +
      (isScope ? 8 : 0) +
      (passage.section === 'description' ? 5 : 0)

    matches.push({
      ...passage,
      serviceName: candidate.service.name,
      url: candidate.service.url,
      score,
    })
  }

  return matches.sort((a, b) => b.score - a.score || a.order - b.order)
}
