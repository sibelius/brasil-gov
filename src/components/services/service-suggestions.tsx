import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { ServiceSummary } from '../../lib/services/model'
import type { SuggestionsState } from '../../reducers/suggestions-reducer'
import '../../styles/service-suggestions.css'

export function ServiceSuggestions({
  state,
  id,
  placement,
  select,
  activate,
  input,
  loadMore,
}: {
  state: SuggestionsState
  id: string
  placement: 'home' | 'chat'
  select: (service: ServiceSummary) => void
  activate: (index: number) => void
  input: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
  loadMore: () => Promise<void>
}) {
  const list = useRef<HTMLUListElement>(null)

  useLayoutEffect(() => {
    const anchor = input.current?.closest('form')

    if (state.status !== 'ready' || !anchor) return

    function position() {
      if (!list.current || !anchor) return

      const rect = anchor.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight)
      const below = Math.max(0, viewportBottom - rect.bottom - 16)
      const above = Math.max(0, rect.top - viewportTop - 16)
      const opensAbove =
        placement === 'chat' ? above >= 160 || above > below : below < 160 && above > below

      Object.assign(list.current.style, {
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${Math.min(320, opensAbove ? above : below)}px`,
        top: opensAbove ? 'auto' : `${rect.bottom + 8}px`,
        bottom: opensAbove ? `${window.innerHeight - rect.top + 8}px` : 'auto',
      })
    }

    position()

    const observer = new ResizeObserver(position)

    observer.observe(anchor)
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
    }
  }, [state.status, placement, input])

  useEffect(() => {
    const option = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')

    if (option && list.current) {
      const top = option.offsetTop
      const bottom = top + option.offsetHeight

      if (top < list.current.scrollTop) list.current.scrollTop = top
      if (bottom > list.current.scrollTop + list.current.clientHeight)
        list.current.scrollTop = bottom - list.current.clientHeight
    }
  }, [state.active])

  return (
    <>
      <span className="sr-only" role="status">
        {state.status === 'loading'
          ? 'Buscando sugestões…'
          : state.status === 'ready'
            ? `${state.total} sugestões disponíveis. Use as setas para navegar.`
            : ''}
      </span>
      {state.status === 'ready' &&
        createPortal(
          <ul
            ref={list}
            id={id}
            className="service-suggestions"
            role="listbox"
            aria-label="Sugestões de serviços"
            aria-busy={state.loadingMore}
            onScroll={(event) => {
              const { scrollTop, scrollHeight, clientHeight } = event.currentTarget

              if (scrollHeight - scrollTop - clientHeight < 100 && !state.moreError) {
                void loadMore()
              }
            }}
          >
            {state.items.map((service, index) => (
              <li key={service.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`${id}-${index}`}
                  aria-selected={state.active === index}
                  aria-setsize={state.total}
                  aria-posinset={index + 1}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => activate(index)}
                  onClick={() => select(service)}
                >
                  <strong>{service.name}</strong>
                  <small>{service.agency}</small>
                </button>
              </li>
            ))}
            {state.loadingMore && (
              <li className="suggestions-status" role="presentation">
                <span role="status">Carregando mais serviços…</span>
              </li>
            )}
            {state.moreError && (
              <li role="presentation">
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void loadMore()}
                >
                  Não foi possível carregar mais. Tentar novamente
                </button>
              </li>
            )}
          </ul>,
          document.body,
        )}
    </>
  )
}
