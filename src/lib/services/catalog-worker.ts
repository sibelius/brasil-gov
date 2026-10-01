import { createCatalogSearch } from './catalog-search.ts'
import { loadCatalog } from './repository.ts'

let index: Promise<ReturnType<typeof createCatalogSearch>> | undefined

self.onmessage = async (event: MessageEvent<{ id: number; query: string; offset: number }>) => {
  const { id, query, offset } = event.data

  try {
    index ??= loadCatalog()
      .then(createCatalogSearch)
      .catch((error: unknown) => {
        index = undefined

        throw error
      })

    const search = await index

    self.postMessage({ id, result: search(query, offset) })
  } catch {
    self.postMessage({
      id,
      error: 'Não foi possível carregar o catálogo. Verifique sua conexão e tente novamente.',
    })
  }
}
