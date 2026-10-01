import { MLCEngine, deleteModelAllInfoInCache, hasModelInCache } from '@mlc-ai/web-llm'
import { MAX_PROMPT_LENGTH, MODEL_CONFIG, MODEL_ID } from './config.ts'
import type {
  CacheStatus,
  ModelCommand,
  ModelRequest,
  ModelResponse,
  ModelSupport,
} from './types.ts'

type GpuNavigator = Navigator & {
  gpu?: { requestAdapter: () => Promise<{ features: ReadonlySet<string> } | null> }
}

let engine: MLCEngine | undefined
let loaded = false
let busy = false

function respond(message: ModelResponse) {
  self.postMessage(message)
}

async function cacheStatus(): Promise<CacheStatus> {
  try {
    return (await hasModelInCache(MODEL_ID, MODEL_CONFIG)) ? 'present' : 'absent'
  } catch {
    return 'unknown'
  }
}

async function inspect(): Promise<ModelSupport> {
  const cached = await cacheStatus()
  const gpu = (navigator as GpuNavigator).gpu

  if (!globalThis.isSecureContext || !gpu) {
    return {
      supported: false,
      cached,
      reason:
        'Este navegador não disponibiliza WebGPU. Use um navegador compatível em HTTPS ou localhost.',
    }
  }

  const adapter = await gpu.requestAdapter()

  if (!adapter || !adapter.features.has('shader-f16')) {
    return {
      supported: false,
      cached,
      reason: 'A GPU disponível não oferece os recursos necessários para este modelo (shader-f16).',
    }
  }

  return { supported: true, cached }
}

async function execute(id: number, command: ModelCommand) {
  switch (command.type) {
    case 'inspect':
      return inspect()
    case 'load': {
      const support = await inspect()

      if (!support.supported) {
        throw new Error(support.reason)
      }

      engine ??= new MLCEngine({
        appConfig: MODEL_CONFIG,
        logLevel: 'ERROR',
        initProgressCallback: (report) => respond({ id, type: 'progress', report }),
      })
      await engine.reload(MODEL_ID)
      loaded = true

      return { cached: await cacheStatus() }
    }
    case 'generate': {
      const prompt = command.prompt.trim()

      if (!loaded || !engine) {
        throw new Error('Carregue o modelo antes de gerar uma resposta.')
      }

      if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
        throw new Error(`Escreva uma pergunta com até ${MAX_PROMPT_LENGTH} caracteres.`)
      }

      const started = performance.now()

      await engine.resetChat()

      const reply = await engine.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'Responda em português brasileiro, de forma breve e clara. Este é um teste local, sem acesso ao catálogo de serviços.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 256,
        temperature: 0.6,
        top_p: 0.95,
        stream: false,
        extra_body: { enable_thinking: false },
      })
      const choice = reply.choices[0]
      const text = choice?.message.content?.trim()

      if (!text) {
        throw new Error('O modelo não retornou texto. Tente novamente.')
      }

      return {
        text,
        elapsedMs: Math.round(performance.now() - started),
        tokens: reply.usage?.completion_tokens ?? 0,
        truncated: choice.finish_reason === 'length',
      }
    }
    case 'clear':
      await engine?.unload()
      engine = undefined
      loaded = false
      await deleteModelAllInfoInCache(MODEL_ID, MODEL_CONFIG)

      return { cached: await cacheStatus() }
  }
}

self.onmessage = async (event: MessageEvent<ModelRequest>) => {
  const { id, command } = event.data

  if (busy) {
    respond({ id, type: 'error', error: 'Já existe uma operação em andamento.' })

    return
  }

  busy = true

  try {
    const result = await execute(id, command)

    respond({ id, type: 'result', result })
  } catch (error) {
    loaded = false
    await engine?.unload().catch(() => undefined)
    engine = undefined
    respond({ id, type: 'error', error: error instanceof Error ? error.message : String(error) })
  } finally {
    busy = false
  }
}
