import type { SearchResult } from './catalog-search.ts'

type PendingSearch = {
  resolve: (result: SearchResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type WorkerResponse = {
  id: number
  result: SearchResult
  error?: string
}

export function createCatalogClient() {
  const worker = new Worker(new URL('./catalog-worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, PendingSearch>()
  let nextId = 0
  let failed = false

  function stop() {
    failed = true
    worker.terminate()

    for (const job of pending.values()) {
      clearTimeout(job.timer)
      job.reject(new Error('A busca foi interrompida. Tente novamente.'))
    }

    pending.clear()
  }

  function search(query: string, offset = 0): Promise<SearchResult> {
    if (failed) {
      return Promise.reject(
        new Error('A busca foi interrompida. Recarregue a página para tentar novamente.'),
      )
    }

    return new Promise((resolve, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('O catálogo demorou para responder. Tente novamente.'))
      }, 30_000)

      pending.set(id, { resolve, reject, timer })
      worker.postMessage({ id, query, offset })
    })
  }

  worker.onerror = stop
  worker.onmessageerror = stop
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const job = pending.get(event.data.id)

    if (!job) {
      return
    }

    clearTimeout(job.timer)
    pending.delete(event.data.id)

    if (event.data.error) {
      job.reject(new Error(event.data.error))
    } else {
      job.resolve(event.data.result)
    }
  }

  return {
    search,
    dispose: stop,
    get available() {
      return !failed
    },
  }
}
