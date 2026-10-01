import type { RetrievedContext, RetrievalRequest } from '../retrieval/types.ts'
import type { ServiceSummary } from './model.ts'

export const PAGE_SIZE = 8

export type SearchResult = {
  items: ServiceSummary[]
  total: number
  catalogSize: number
  context?: RetrievedContext
}

export type CatalogCommand =
  | { type: 'search'; query: string; offset: number; selectedServiceId?: string }
  | { type: 'retrieve'; request: RetrievalRequest }

export type CatalogRequest = CatalogCommand & { id: number }
