import { packContext, resolveBudget } from './context.ts'
import { analyzeQuestion, splitQuestion, tokenize } from './query.ts'
import { rankPassages } from './rank-passages.ts'
import { createServiceRanker } from './rank-services.ts'
import type {
  Candidate,
  PassageFile,
  RetrievedContext,
  RetrievalIndex,
  RetrievalRequest,
} from './types.ts'

const RESULT_CACHE_LIMIT = 24
const CANDIDATE_LIMIT = 6
const CONCURRENT_DOWNLOADS = 3

type RetrieverOptions = {
  index: RetrievalIndex
  loadPassages: (id: string) => Promise<PassageFile>
}

export function createRetriever({ index, loadPassages }: RetrieverOptions) {
  const rankSingleQuestion = createServiceRanker(index)
  const documents = new Map(index.documents.map((document) => [document.id, document]))
  const cache = new Map<string, RetrievedContext>()
  const pending = new Map<string, Promise<RetrievedContext>>()

  function rankServices(question: string): Candidate[] {
    const groups = splitQuestion(question).map(rankSingleQuestion)
    const seen = new Set<string>()
    const merged: Candidate[] = []
    const length = Math.max(0, ...groups.map((group) => group.length))

    for (let position = 0; position < length; position++) {
      for (const group of groups) {
        const candidate = group[position]

        if (candidate && !seen.has(candidate.service.id)) {
          seen.add(candidate.service.id)
          merged.push(candidate)
        }
      }
    }

    return merged
  }

  async function retrieve(request: RetrievalRequest): Promise<RetrievedContext> {
    const question = request.question.trim().slice(0, 1000)
    const query = analyzeQuestion(question)
    const budget = resolveBudget(request.budget)
    const candidates = rankServices(question)
    const selected = request.selectedServiceId
      ? documents.get(request.selectedServiceId)
      : undefined
    const result: RetrievedContext = {
      status: 'insufficient_evidence',
      reason: 'no_match',
      question,
      revision: index.revision,
      services: candidates.slice(0, CANDIDATE_LIMIT).map((candidate) => candidate.service),
      passages: [],
      context: '',
      characters: 0,
      omittedPassages: 0,
      missingSections: query.intents,
    }

    if (request.selectedServiceId && !selected) {
      throw new Error('O serviço selecionado não pertence a esta revisão do catálogo.')
    }

    if (!query.topics.length && !selected) {
      return { ...result, status: 'needs_clarification', reason: 'missing_service' }
    }

    const groups = splitQuestion(question).map(rankSingleQuestion)
    const chosen: Candidate[] = []

    if (selected && !query.topics.length) {
      chosen.push({
        service: selected,
        score: 0,
        matchedTerms: [],
        primaryTerms: [],
        exactTitle: true,
      })
    } else {
      let selectionApplied = false

      for (const group of groups) {
        const [first, second] = group
        const selection = selected
          ? group.find((candidate) => candidate.service.id === selected.id)
          : undefined
        const winner = selection ?? first

        if (!winner) {
          return result
        }

        const competing = second && second.score >= first.score * 0.85
        const ambiguous = !selection && competing && (!first.exactTitle || second.exactTitle)

        if (ambiguous) {
          return { ...result, status: 'needs_clarification', reason: 'ambiguous' }
        }

        selectionApplied ||= Boolean(selection)

        if (!chosen.some((candidate) => candidate.service.id === winner.service.id)) {
          chosen.push(winner)
        }
      }

      if (selected && !selectionApplied) {
        return result
      }
    }

    if (chosen.length > budget.maxServices) {
      return { ...result, reason: 'budget_exceeded' }
    }

    const ranked = []

    for (let offset = 0; offset < chosen.length; offset += CONCURRENT_DOWNLOADS) {
      const batch = chosen.slice(offset, offset + CONCURRENT_DOWNLOADS)
      const files = await Promise.all(batch.map((candidate) => loadPassages(candidate.service.id)))

      for (const [position, file] of files.entries()) {
        if (file.revision !== index.revision || file.serviceId !== batch[position].service.id) {
          throw new Error('Os trechos não correspondem à revisão do índice.')
        }

        ranked.push(rankPassages(question, batch[position], file.passages))
      }
    }

    const evidence = ranked
      .flatMap((passages, serviceRank) => {
        return passages.map((passage, passageRank) => ({
          passage,
          priority: passageRank * chosen.length + serviceRank,
        }))
      })
      .sort((a, b) => a.priority - b.priority)
      .map(({ passage }) => passage)
    const packed = packContext(evidence, budget, query.intents)
    const supportedModifiers = new Set(packed.passages.flatMap((passage) => tokenize(passage.text)))
    const missingDetail = query.modifiers.some((term) => !supportedModifiers.has(term))
    const missingService = chosen.some(
      (candidate) => !packed.passages.some((passage) => passage.serviceId === candidate.service.id),
    )
    const missingSections = [
      ...new Set(
        chosen.flatMap((candidate) => {
          return query.intents.filter(
            (section) =>
              !packed.passages.some(
                (passage) =>
                  passage.serviceId === candidate.service.id && passage.section === section,
              ),
          )
        }),
      ),
    ]
    const enough =
      packed.passages.length > 0 && !missingDetail && !missingService && !missingSections.length

    return {
      ...result,
      ...packed,
      missingSections,
      status: enough ? 'ready' : 'insufficient_evidence',
      reason: enough
        ? undefined
        : !packed.passages.length && evidence.length
          ? 'budget_exceeded'
          : 'missing_sections',
      services: chosen.map((candidate) => candidate.service),
    }
  }

  async function retrieveContext(request: RetrievalRequest): Promise<RetrievedContext> {
    const budget = resolveBudget(request.budget)
    const key = JSON.stringify([
      request.question.trim().slice(0, 1000),
      request.selectedServiceId,
      budget,
    ])
    const cached = cache.get(key)

    if (cached) {
      cache.delete(key)
      cache.set(key, cached)

      return cached
    }

    const inFlight = pending.get(key)

    if (inFlight) {
      return inFlight
    }

    const job = retrieve({ ...request, budget })
    pending.set(key, job)

    try {
      const result = await job
      cache.set(key, result)

      while (cache.size > RESULT_CACHE_LIMIT) {
        cache.delete(cache.keys().next().value!)
      }

      return result
    } finally {
      pending.delete(key)
    }
  }

  return { rankServices, retrieveContext }
}
