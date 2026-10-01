import { createRetriever } from '../retrieval/engine.ts'
import { loadPassages, loadRetrievalIndex } from '../retrieval/repository.ts'
import { PAGE_SIZE, type CatalogRequest, type SearchResult } from './catalog-types.ts'
import { createCatalogSuggester } from './catalog-suggestions.ts'

let retriever:
  | Promise<
      ReturnType<typeof createRetriever> & { suggest: ReturnType<typeof createCatalogSuggester> }
    >
  | undefined
let catalogSize = 0

function prepareRetriever() {
  retriever ??= loadRetrievalIndex()
    .then((index) => {
      catalogSize = index.documents.length

      return { ...createRetriever({ index, loadPassages }), suggest: createCatalogSuggester(index) }
    })
    .catch((error: unknown) => {
      retriever = undefined

      throw error
    })

  return retriever
}

self.onmessage = async (event: MessageEvent<CatalogRequest>) => {
  const command = event.data

  try {
    const engine = await prepareRetriever()

    if (command.type === 'related') {
      const result = engine
        .rankServices(command.query)
        .filter((candidate) => candidate.service.id !== command.serviceId)
        .slice(0, 3)
        .map((candidate) => candidate.service)

      self.postMessage({ id: command.id, result })

      return
    }

    if (command.type === 'suggest') {
      self.postMessage({ id: command.id, result: engine.suggest(command.query, command.offset) })

      return
    }

    if (command.type === 'retrieve') {
      const result = await engine.retrieveContext(command.request)

      self.postMessage({ id: command.id, result })

      return
    }

    const context = await engine.retrieveContext({
      question: command.query,
      selectedServiceId: command.selectedServiceId,
    })
    const candidates = engine.rankServices(command.query)
    const services = command.selectedServiceId
      ? context.services
      : candidates.map((candidate) => candidate.service)
    const result: SearchResult = {
      items: services.slice(command.offset, command.offset + PAGE_SIZE),
      total: services.length,
      catalogSize,
      context,
    }

    self.postMessage({ id: command.id, result })
  } catch {
    self.postMessage({
      id: command.id,
      error: 'Não foi possível consultar os dados. Verifique sua conexão e tente novamente.',
    })
  }
}
