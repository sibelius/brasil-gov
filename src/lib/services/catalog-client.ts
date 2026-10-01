import type { RetrievedContext, RetrievalRequest } from '../retrieval/types.ts'
import type { CatalogCommand, SearchResult } from './catalog-types.ts'

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

type WorkerResponse = {
  id: number
  result: unknown
  error?: string
}

export function createCatalogClient() {
  const worker = new Worker(new URL('./catalog-worker.ts', import.meta.url), { type: 'module' })
  const pending = new Map<number, PendingRequest>()
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

  function send<T>(command: CatalogCommand): Promise<T> {
    if (failed) {
      return Promise.reject(new Error('A busca foi interrompida. Tente novamente.'))
    }

    return new Promise((resolve, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error('A consulta demorou para responder. Tente novamente.'))
      }, 60_000)

      pending.set(id, { resolve: (result) => resolve(result as T), reject, timer })
      worker.postMessage({ ...command, id })
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
    search(query: string, offset = 0, selectedServiceId?: string) {
      return send<SearchResult>({ type: 'search', query, offset, selectedServiceId })
    },
    retrieveContext(request: RetrievalRequest) {
      return send<RetrievedContext>({ type: 'retrieve', request })
    },
    dispose: stop,
    get available() {
      return !failed
    },
  }
}
