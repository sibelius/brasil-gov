import { useCallback, useEffect, useId, useReducer, useRef, type KeyboardEvent } from 'react'
import { createCatalogClient } from '../lib/services/catalog-client.ts'
import { MIN_SUGGESTION_LENGTH } from '../lib/services/catalog-suggestions.ts'
import type { SuggestionPage } from '../lib/services/catalog-types.ts'
import type { ServiceSummary } from '../lib/services/model.ts'
import { INITIAL_SUGGESTIONS, suggestionsReducer } from '../reducers/suggestions-reducer.ts'

export function useServiceSuggestions(
  suggest?: (query: string, offset: number) => Promise<SuggestionPage>,
) {
  const [state, dispatch] = useReducer(suggestionsReducer, INITIAL_SUGGESTIONS)
  const listId = useId()
  const client = useRef<ReturnType<typeof createCatalogClient> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const serial = useRef(0)
  const composing = useRef(false)
  const input = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const currentQuery = useRef('')
  const pendingPage = useRef<number | null>(null)

  const fetchPage = useCallback(
    (query: string, offset: number) => {
      if (suggest) return suggest(query, offset)

      if (!client.current?.available) {
        client.current = createCatalogClient()
      }

      return client.current.suggest(query, offset)
    },
    [suggest],
  )

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    dispatch({ type: 'close', request: ++serial.current })
  }, [])

  const update = useCallback(
    (value: string) => {
      clearTimeout(timer.current)

      const request = ++serial.current
      const query = value.trim().slice(0, 300)

      currentQuery.current = query
      pendingPage.current = null

      if (query.length < MIN_SUGGESTION_LENGTH || composing.current) {
        dispatch({ type: 'close', request })

        return
      }

      dispatch({ type: 'loading', request })
      timer.current = setTimeout(async () => {
        try {
          const page = await fetchPage(query, 0)

          if (serial.current === request) {
            dispatch({ type: 'results', request, ...page })
          }
        } catch {
          if (serial.current === request) {
            dispatch({ type: 'close', request })
          }
        }
      }, 180)
    },
    [fetchPage],
  )

  async function loadMore() {
    const request = state.request

    if (
      state.status !== 'ready' ||
      state.items.length >= state.total ||
      state.loadingMore ||
      serial.current !== request ||
      pendingPage.current === request
    ) {
      return
    }

    pendingPage.current = request
    dispatch({ type: 'more', request })

    try {
      const page = await fetchPage(currentQuery.current, state.items.length)

      if (serial.current === request) dispatch({ type: 'append', request, ...page })
    } catch {
      if (serial.current === request) dispatch({ type: 'more-error', request })
    } finally {
      if (pendingPage.current === request) pendingPage.current = null
    }
  }

  function keyDown(
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    select: (service: ServiceSummary) => void,
  ) {
    if (event.nativeEvent.isComposing || composing.current) return false

    if (event.key === 'Escape' && state.status !== 'closed') {
      event.preventDefault()
      dismiss()

      return true
    }

    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && state.items.length) {
      event.preventDefault()

      if (
        event.key === 'ArrowDown' &&
        state.active >= state.items.length - 2 &&
        state.items.length < state.total
      ) {
        void loadMore()

        if (state.active === state.items.length - 1) return true
      }

      dispatch({ type: 'move', direction: event.key === 'ArrowDown' ? 1 : -1 })

      return true
    }

    if (event.key === 'Enter' && !event.shiftKey && state.items[state.active]) {
      event.preventDefault()
      select(state.items[state.active])
      dismiss()

      return true
    }

    return false
  }

  useEffect(
    () => () => {
      serial.current++
      clearTimeout(timer.current)
      client.current?.dispose()
      client.current = null
    },
    [],
  )

  return {
    state,
    listId,
    input,
    loadMore,
    update,
    dismiss,
    keyDown,
    activate: (index: number) => dispatch({ type: 'activate', index }),
    inputProps: {
      ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
        input.current = element
      },
      role: 'combobox' as const,
      'aria-autocomplete': 'list' as const,
      'aria-expanded': state.status === 'ready',
      'aria-controls': state.status === 'ready' ? listId : undefined,
      'aria-activedescendant': state.active >= 0 ? `${listId}-${state.active}` : undefined,
      autoComplete: 'off',
      onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!event.relatedTarget?.closest('[role="listbox"]')) dismiss()
      },
      onCompositionStart: () => {
        composing.current = true
        dismiss()
      },
      onCompositionEnd: (event: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        composing.current = false
        update(event.currentTarget.value)
      },
    },
  }
}
