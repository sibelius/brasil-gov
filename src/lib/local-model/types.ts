export type ModelProgress = { progress: number; text: string; timeElapsed: number }
export type CacheStatus = 'present' | 'absent' | 'unknown'
export type ModelSupport = { supported: boolean; reason?: string; cached: CacheStatus }
export type ModelAnswer = { text: string; elapsedMs: number; tokens: number; truncated: boolean }

export type ModelCommand =
  { type: 'inspect' } | { type: 'load' } | { type: 'generate'; prompt: string } | { type: 'clear' }

export type ModelResults = {
  inspect: ModelSupport
  load: { cached: CacheStatus }
  generate: ModelAnswer
  clear: { cached: CacheStatus }
}

export type ModelRequest = { id: number; command: ModelCommand }
export type ModelResponse =
  | { id: number; type: 'progress'; report: ModelProgress }
  | { id: number; type: 'result'; result: ModelResults[keyof ModelResults] }
  | { id: number; type: 'error'; error: string }
