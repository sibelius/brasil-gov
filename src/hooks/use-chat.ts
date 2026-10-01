import { useCallback, useEffect, useReducer, useRef } from 'react'
import { createCatalogClient } from '../lib/services/catalog-client.ts'
import { loadService } from '../lib/services/repository.ts'
import type { ServiceSummary } from '../lib/services/model.ts'
import { chatReducer, INITIAL_STATE } from '../reducers/chat-reducer.ts'

export function useChat(initialQuery: string) {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE)
  const client = useRef<ReturnType<typeof createCatalogClient> | null>(null)
  const serial = useRef(0)
  const generation = useRef(0)

  const search = useCallback(async (query: string, id?: number, offset = 0) => {
    const text = query.trim().slice(0, 300)

    if (!text) {
      return
    }

    const request = ++serial.current
    const turnId = id ?? request
    const currentGeneration = generation.current

    dispatch({ type: 'search', id: turnId, request, query: text, offset })

    try {
      if (!client.current?.available) {
        client.current = createCatalogClient()
      }

      const result = await client.current.search(text, offset)

      if (currentGeneration === generation.current) {
        dispatch({ type: 'results', id: turnId, request, result })
      }
    } catch (error) {
      if (currentGeneration === generation.current) {
        dispatch({
          type: 'search-error',
          id: turnId,
          request,
          error: error instanceof Error ? error.message : 'Não foi possível pesquisar.',
        })
      }
    }
  }, [])

  const open = useCallback(async (id: number, summary: ServiceSummary) => {
    const request = ++serial.current
    const currentGeneration = generation.current

    dispatch({ type: 'open', id, summary, request })

    try {
      const service = await loadService(summary.id)

      if (currentGeneration === generation.current) {
        dispatch({ type: 'service', id, request, service })
      }
    } catch {
      if (currentGeneration === generation.current) {
        dispatch({
          type: 'service-error',
          id,
          request,
          error: 'Não foi possível carregar este serviço. Verifique sua conexão e tente novamente.',
        })
      }
    }
  }, [])

  const close = useCallback((id: number) => {
    dispatch({ type: 'close', id })
  }, [])

  const dispose = useCallback(() => {
    generation.current++
    client.current?.dispose()
    client.current = null
  }, [])

  const reset = useCallback(() => {
    dispose()
    dispatch({ type: 'reset' })
    window.history.replaceState({}, '', '/chat')
  }, [dispose])

  useEffect(() => {
    document.title = 'Serviços públicos · Brasil.gov'
    dispatch({ type: 'reset' })
    void search(initialQuery)

    return dispose
  }, [initialQuery, search, dispose])

  return { state, dispatch, search, open, close, reset }
}
