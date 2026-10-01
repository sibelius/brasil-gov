import type { ServiceSummary } from '../lib/services/model.ts'

export type SuggestionsState = {
  request: number
  status: 'closed' | 'loading' | 'ready'
  items: ServiceSummary[]
  active: number
  total: number
  loadingMore: boolean
  moreError: boolean
}

export type SuggestionsAction =
  | { type: 'loading'; request: number }
  | { type: 'results'; request: number; items: ServiceSummary[]; total: number }
  | { type: 'more'; request: number }
  | { type: 'append'; request: number; items: ServiceSummary[]; total: number }
  | { type: 'more-error'; request: number }
  | { type: 'close'; request: number }
  | { type: 'move'; direction: 1 | -1 }
  | { type: 'activate'; index: number }

export const INITIAL_SUGGESTIONS: SuggestionsState = {
  request: 0,
  status: 'closed',
  items: [],
  active: -1,
  total: 0,
  loadingMore: false,
  moreError: false,
}

export function suggestionsReducer(
  state: SuggestionsState,
  action: SuggestionsAction,
): SuggestionsState {
  switch (action.type) {
    case 'loading':
      return { ...INITIAL_SUGGESTIONS, request: action.request, status: 'loading' }
    case 'close':
      return { ...INITIAL_SUGGESTIONS, request: action.request }
    case 'results':
      return state.request === action.request && state.status === 'loading'
        ? {
            ...state,
            status: action.items.length ? 'ready' : 'closed',
            items: action.items,
            total: action.total,
            active: -1,
          }
        : state
    case 'more':
      return state.request === action.request && state.status === 'ready'
        ? { ...state, loadingMore: true, moreError: false }
        : state
    case 'append':
      return state.request === action.request && state.loadingMore
        ? {
            ...state,
            items: [...state.items, ...action.items],
            total: action.total,
            loadingMore: false,
          }
        : state
    case 'more-error':
      return state.request === action.request && state.loadingMore
        ? { ...state, loadingMore: false, moreError: true }
        : state
    case 'move':
      return state.items.length
        ? {
            ...state,
            active:
              state.active === -1
                ? action.direction === 1
                  ? 0
                  : state.items.length - 1
                : (state.active + action.direction + state.items.length) % state.items.length,
          }
        : state
    case 'activate':
      return action.index >= 0 && action.index < state.items.length
        ? { ...state, active: action.index }
        : state
  }
}
