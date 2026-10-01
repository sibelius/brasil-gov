import { TEST_PROMPT } from '../lib/local-model/config.ts'
import type {
  CacheStatus,
  ModelAnswer,
  ModelProgress,
  ModelSupport,
} from '../lib/local-model/types.ts'

export type ModelPhase =
  'idle' | 'checking' | 'loading' | 'ready' | 'generating' | 'clearing' | 'error'
export type LocalModelState = {
  phase: ModelPhase
  request: number
  prompt: string
  cached: CacheStatus
  support?: ModelSupport
  progress?: ModelProgress
  answer?: ModelAnswer
  error?: string
}

export type LocalModelAction =
  | { type: 'prompt'; value: string }
  | { type: 'start'; request: number; phase: 'checking' | 'loading' | 'generating' | 'clearing' }
  | { type: 'progress'; request: number; report: ModelProgress }
  | { type: 'inspected'; request: number; support: ModelSupport }
  | { type: 'loaded' | 'cleared'; request: number; cached: CacheStatus }
  | { type: 'answer'; request: number; answer: ModelAnswer }
  | { type: 'error'; request: number; error: string }
  | { type: 'release'; request: number }

export const INITIAL_MODEL_STATE: LocalModelState = {
  phase: 'idle',
  request: 0,
  prompt: TEST_PROMPT,
  cached: 'unknown',
}

export function localModelReducer(
  state: LocalModelState,
  action: LocalModelAction,
): LocalModelState {
  if (action.type === 'prompt') {
    return { ...state, prompt: action.value }
  }

  if (action.type === 'start') {
    return {
      ...state,
      phase: action.phase,
      request: action.request,
      progress: undefined,
      error: undefined,
      answer: undefined,
    }
  }

  if (action.type === 'release') {
    return {
      ...state,
      phase: 'idle',
      request: action.request,
      progress: undefined,
      error: undefined,
      cached: state.phase === 'loading' ? 'unknown' : state.cached,
    }
  }

  if (action.request !== state.request) {
    return state
  }

  switch (action.type) {
    case 'progress':
      return state.phase === 'loading' ? { ...state, progress: action.report } : state
    case 'inspected':
      return { ...state, phase: 'idle', support: action.support, cached: action.support.cached }
    case 'loaded':
      return { ...state, phase: 'ready', cached: action.cached, progress: undefined }
    case 'cleared':
      return { ...state, phase: 'idle', cached: action.cached }
    case 'answer':
      return { ...state, phase: 'ready', answer: action.answer }
    case 'error':
      return {
        ...state,
        phase: 'error',
        error: action.error,
        progress: undefined,
        cached: 'unknown',
      }
  }
}
