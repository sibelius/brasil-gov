import { useCallback, useEffect, useReducer, useRef } from 'react'
import { createModelClient } from '../lib/local-model/model-client.ts'
import type { ModelCommand, ModelResults } from '../lib/local-model/types.ts'
import {
  INITIAL_MODEL_STATE,
  localModelReducer,
  type LocalModelAction,
} from '../reducers/local-model-reducer.ts'

const PHASES = {
  inspect: 'checking',
  load: 'loading',
  generate: 'generating',
  clear: 'clearing',
} as const

export function useLocalModel() {
  const [state, dispatch] = useReducer(localModelReducer, INITIAL_MODEL_STATE)
  const client = useRef<ReturnType<typeof createModelClient> | null>(null)
  const serial = useRef(0)
  const active = useRef(false)

  const dispose = useCallback(() => {
    serial.current++
    active.current = false
    client.current?.dispose()
    client.current = null
  }, [])

  const perform = useCallback(
    async <C extends ModelCommand>(
      command: C,
      resultAction: (result: ModelResults[C['type']], request: number) => LocalModelAction,
    ) => {
      if (active.current) {
        return
      }

      active.current = true

      const request = ++serial.current

      dispatch({ type: 'start', request, phase: PHASES[command.type] })

      try {
        if (!client.current?.available) {
          client.current = createModelClient()
        }

        const result = await client.current.run(command, (report) => {
          if (serial.current === request) {
            dispatch({ type: 'progress', request, report })
          }
        })

        if (serial.current === request) {
          dispatch(resultAction(result, request))
        }
      } catch (error) {
        if (serial.current === request) {
          client.current?.dispose()
          client.current = null
          dispatch({
            type: 'error',
            request,
            error: error instanceof Error ? error.message : 'Não foi possível executar o modelo.',
          })
        }
      } finally {
        if (serial.current === request) {
          active.current = false
        }
      }
    },
    [],
  )

  const inspect = useCallback(
    () =>
      perform({ type: 'inspect' }, (support, request) => ({ type: 'inspected', request, support })),
    [perform],
  )
  const load = useCallback(
    () =>
      perform({ type: 'load' }, (result, request) => ({
        type: 'loaded',
        request,
        cached: result.cached,
      })),
    [perform],
  )
  const clear = useCallback(
    () =>
      perform({ type: 'clear' }, (result, request) => ({
        type: 'cleared',
        request,
        cached: result.cached,
      })),
    [perform],
  )
  const generate = useCallback(
    () =>
      perform({ type: 'generate', prompt: state.prompt }, (answer, request) => ({
        type: 'answer',
        request,
        answer,
      })),
    [perform, state.prompt],
  )

  const release = useCallback(() => {
    dispose()
    dispatch({ type: 'release', request: serial.current })
  }, [dispose])

  useEffect(() => {
    document.title = 'Modelo local · Brasil.gov'
    void inspect()

    return dispose
  }, [inspect, dispose])

  return { state, dispatch, inspect, load, clear, generate, release }
}
