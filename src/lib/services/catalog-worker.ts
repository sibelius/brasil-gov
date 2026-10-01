import { createRetriever } from '../retrieval/engine.ts'
import { loadPassages, loadRetrievalIndex } from '../retrieval/repository.ts'
import { PAGE_SIZE, type CatalogRequest, type SearchResult } from './catalog-types.ts'

let retriever: Promise<ReturnType<typeof createRetriever>> | undefined
let catalogSize = 0

function prepareRetriever() {
  retriever ??= loadRetrievalIndex()
    .then((index) => {
      catalogSize = index.documents.length

      return createRetriever({ index, loadPassages })
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
