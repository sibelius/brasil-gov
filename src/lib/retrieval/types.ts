import type { ServiceSummary } from '../services/model.ts'

export const RETRIEVAL_SCHEMA = 1

export const SECTIONS = [
  'description',
  'eligibility',
  'documents',
  'costs',
  'duration',
  'steps',
  'channels',
] as const

export type Section = (typeof SECTIONS)[number]

export type Passage = {
  id: string
  serviceId: string
  section: Section
  title: string
  text: string
  sourcePath: string
  order: number
}

export type PassageFile = {
  revision: string
  serviceId: string
  passages: Passage[]
}

export type SearchDocument = ServiceSummary & {
  titleTerms: string[]
}

export type RetrievalIndex = {
  schema: number
  revision: string
  documents: SearchDocument[]
  postings: Record<string, number[]>
}

export type RetrievalBudget = {
  maxCharacters: number
  maxPassages: number
  maxServices: number
}

export type RetrievalRequest = {
  question: string
  selectedServiceId?: string
  budget?: Partial<RetrievalBudget>
}

export type Candidate = {
  service: ServiceSummary
  score: number
  matchedTerms: string[]
  primaryTerms: string[]
  exactTitle: boolean
}

export type Evidence = Passage & {
  serviceName: string
  url: string
  score: number
}

export type RetrievedContext = {
  status: 'ready' | 'needs_clarification' | 'insufficient_evidence'
  reason?: 'missing_service' | 'ambiguous' | 'no_match' | 'missing_sections' | 'budget_exceeded'
  question: string
  revision: string
  services: ServiceSummary[]
  passages: Evidence[]
  context: string
  characters: number
  omittedPassages: number
  missingSections: Section[]
}

export const DEFAULT_BUDGET: RetrievalBudget = {
  maxCharacters: 12_000,
  maxPassages: 8,
  maxServices: 3,
}
