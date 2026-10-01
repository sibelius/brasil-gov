import { useCallback, useEffect, useReducer, useRef } from 'react'
import { analyzeQuestion } from '../lib/retrieval/query.ts'
import { createCatalogClient } from '../lib/services/catalog-client.ts'
import { loadService } from '../lib/services/repository.ts'
import type { ServiceSummary } from '../lib/services/model.ts'
import { chatReducer, INITIAL_STATE } from '../reducers/chat-reducer.ts'

export function useChat(initialQuery: string, initialServiceId?: string) {
  const [state, dispatch] = useReducer(chatReducer, INITIAL_STATE)
  const client = useRef<ReturnType<typeof createCatalogClient> | null>(null)
  const serial = useRef(0)
  const generation = useRef(0)

  const suggest = useCallback((query: string, offset = 0) => {
    if (!client.current?.available) {
      client.current = createCatalogClient()
    }

    return client.current.suggest(query, offset)
  }, [])

  const search = useCallback(
    async (query: string, id?: number, offset = 0, selectedServiceId?: string) => {
      const text = query.trim().slice(0, 300)

      if (!text) {
        return
      }

      const scopeId = analyzeQuestion(text).topics.length ? undefined : selectedServiceId
      const request = ++serial.current
      const turnId = id ?? request
      const currentGeneration = generation.current

      dispatch({ type: 'search', id: turnId, request, query: text, offset, scopeId })

      try {
        if (!client.current?.available) {
          client.current = createCatalogClient()
        }

        const result = await client.current.search(text, offset, scopeId)

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
    },
    [],
  )

  const open = useCallback(async (id: number, summary: ServiceSummary, question: string) => {
    const request = ++serial.current
    const currentGeneration = generation.current

    dispatch({ type: 'open', id, summary, request })

    void Promise.resolve()
      .then(() => {
        if (!client.current?.available) {
          client.current = createCatalogClient()
        }

        void client.current
          .related(summary.name, summary.id)
          .then((items) => {
            if (currentGeneration === generation.current) {
              dispatch({ type: 'related', id, request, items })
            }
          })
          .catch(() => undefined)

        return client.current.retrieveContext({ question, selectedServiceId: summary.id })
      })
      .then((context) => {
        if (currentGeneration === generation.current) {
          dispatch({ type: 'context', id, request, context })
        }
      })
      .catch(() => {
        if (currentGeneration === generation.current) {
          dispatch({ type: 'context-error', id, request })
        }
      })

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

  const select = useCallback(
    async (summary: Pick<ServiceSummary, 'id' | 'name'>, id?: number) => {
      const request = ++serial.current
      const turnId = id ?? request
      const currentGeneration = generation.current

      dispatch({ type: 'select', id: turnId, request, query: summary.name, serviceId: summary.id })

      try {
        const service = await loadService(summary.id)

        if (currentGeneration === generation.current) {
          void open(turnId, service, service.name)
        }
      } catch {
        if (currentGeneration === generation.current) {
          dispatch({
            type: 'search-error',
            id: turnId,
            request,
            error:
              'Não foi possível carregar este serviço. Verifique sua conexão e tente novamente.',
          })
        }
      }
    },
    [open],
  )

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

    if (initialServiceId) {
      void select({ id: initialServiceId, name: initialQuery || 'Serviço selecionado' })
    } else {
      void search(initialQuery)
    }

    return dispose
  }, [initialQuery, initialServiceId, search, select, dispose])

  return { state, dispatch, search, open, close, reset, suggest, select }
}
