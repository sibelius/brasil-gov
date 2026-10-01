import type {
  ModelCommand,
  ModelProgress,
  ModelRequest,
  ModelResponse,
  ModelResults,
} from './types.ts'

export type ModelWorker = Pick<
  Worker,
  'postMessage' | 'terminate' | 'onmessage' | 'onerror' | 'onmessageerror'
>

type Pending = {
  id: number
  resolve: (value: ModelResults[keyof ModelResults]) => void
  reject: (error: Error) => void
  progress?: (report: ModelProgress) => void
  timer: ReturnType<typeof setTimeout>
}

const TIMEOUTS = { inspect: 30_000, load: 600_000, generate: 120_000, clear: 30_000 }

export function createModelClient(
  worker: ModelWorker = new Worker(new URL('./model-worker.ts', import.meta.url), {
    type: 'module',
  }),
) {
  let pending: Pending | undefined
  let serial = 0
  let closed = false

  function dispose(message = 'Operação cancelada.') {
    if (closed) {
      return
    }

    closed = true
    worker.terminate()

    if (pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(message))
      pending = undefined
    }
  }

  worker.onerror = () =>
    dispose('A execução local falhou. Libere memória e tente carregar o modelo novamente.')
  worker.onmessageerror = () => dispose('Não foi possível receber a resposta do modelo.')
  worker.onmessage = (event: MessageEvent<ModelResponse>) => {
    const message = event.data

    if (!pending || pending.id !== message.id || closed) {
      return
    }

    if (message.type === 'progress') {
      pending.progress?.(message.report)

      return
    }

    const job = pending

    pending = undefined
    clearTimeout(job.timer)

    if (message.type === 'error') {
      job.reject(new Error(message.error))
    } else {
      job.resolve(message.result)
    }
  }

  function run<C extends ModelCommand>(
    command: C,
    progress?: (report: ModelProgress) => void,
  ): Promise<ModelResults[C['type']]> {
    if (closed || pending) {
      return Promise.reject(
        new Error(closed ? 'A sessão do modelo foi encerrada.' : 'Aguarde a operação atual.'),
      )
    }

    return new Promise((resolve, reject) => {
      const id = ++serial
      const timer = setTimeout(
        () =>
          dispose(
            'A operação demorou demais. Confira a conexão e a memória disponível antes de tentar novamente.',
          ),
        TIMEOUTS[command.type],
      )

      pending = {
        id,
        resolve: (value) => resolve(value as ModelResults[C['type']]),
        reject,
        progress,
        timer,
      }

      try {
        worker.postMessage({ id, command } satisfies ModelRequest)
      } catch {
        dispose('Não foi possível iniciar a operação no navegador.')
      }
    })
  }

  return {
    run,
    dispose,
    get available() {
      return !closed
    },
  }
}
