import type { SearchResult } from '../lib/services/catalog-search.ts'
import type { Service, ServiceSummary } from '../lib/services/model.ts'

export type Detail =
  | { status: 'loading'; summary: ServiceSummary; request: number }
  | { status: 'error'; summary: ServiceSummary; request: number; error: string }
  | { status: 'ready'; summary: ServiceSummary; request: number; service: Service }

export type Turn = {
  id: number
  query: string
  request: number
  status: 'loading' | 'ready' | 'error'
  items: ServiceSummary[]
  total: number
  offset: number
  error?: string
  detail?: Detail
}

export type ChatState = { draft: string; turns: Turn[] }

export type ChatAction =
  | { type: 'draft'; value: string }
  | { type: 'reset' }
  | { type: 'search'; id: number; request: number; query: string; offset: number }
  | { type: 'results'; id: number; request: number; result: SearchResult }
  | { type: 'search-error'; id: number; request: number; error: string }
  | { type: 'open'; id: number; request: number; summary: ServiceSummary }
  | { type: 'service'; id: number; request: number; service: Service }
  | { type: 'service-error'; id: number; request: number; error: string }
  | { type: 'close'; id: number }

export const INITIAL_STATE: ChatState = { draft: '', turns: [] }
export const HISTORY_LIMIT = 12

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  if (action.type === 'draft') {
    return { ...state, draft: action.value }
  }

  if (action.type === 'reset') {
    return INITIAL_STATE
  }

  if (action.type === 'search') {
    const turn: Turn = {
      id: action.id,
      request: action.request,
      query: action.query,
      offset: action.offset,
      status: 'loading',
      items: [],
      total: 0,
    }
    const exists = state.turns.some((item) => item.id === action.id)

    return {
      draft: exists ? state.draft : '',
      turns: exists
        ? state.turns.map((item) => (item.id === action.id ? turn : item))
        : [...state.turns, turn].slice(-HISTORY_LIMIT),
    }
  }

  return {
    ...state,
    turns: state.turns.map((turn) => {
      if (turn.id !== action.id) {
        return turn
      }

      switch (action.type) {
        case 'results':
          return turn.request === action.request
            ? { ...turn, status: 'ready', items: action.result.items, total: action.result.total }
            : turn
        case 'search-error':
          return turn.request === action.request
            ? { ...turn, status: 'error', error: action.error }
            : turn
        case 'open':
          return {
            ...turn,
            detail: { status: 'loading', summary: action.summary, request: action.request },
          }
        case 'close':
          return { ...turn, detail: undefined }
        case 'service':
          return turn.detail?.request === action.request
            ? { ...turn, detail: { ...turn.detail, status: 'ready', service: action.service } }
            : turn
        case 'service-error':
          return turn.detail?.request === action.request
            ? { ...turn, detail: { ...turn.detail, status: 'error', error: action.error } }
            : turn
      }
    }),
  }
}
