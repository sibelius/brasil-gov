import assert from 'node:assert/strict'
import test from 'node:test'
import { createModelClient, type ModelWorker } from '../src/lib/local-model/model-client.ts'
import type { ModelRequest, ModelResponse } from '../src/lib/local-model/types.ts'
import { INITIAL_MODEL_STATE, localModelReducer } from '../src/reducers/local-model-reducer.ts'

function fakeWorker() {
  const requests: ModelRequest[] = []
  let terminated = false
  const worker: ModelWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: (message: ModelRequest) => {
      requests.push(message)
    },
    terminate: () => {
      terminated = true
    },
  }

  function respond(message: ModelResponse) {
    worker.onmessage?.call(worker as Worker, new MessageEvent('message', { data: message }))
  }

  return {
    worker,
    requests,
    respond,
    get terminated() {
      return terminated
    },
  }
}

test('model loading delivers progress and rejects overlapping operations', async () => {
  const fake = fakeWorker()
  const client = createModelClient(fake.worker)
  const progress: number[] = []
  const loading = client.run({ type: 'load' }, (report) => progress.push(report.progress))
  const id = fake.requests[0].id

  await assert.rejects(client.run({ type: 'generate', prompt: 'Olá' }), /Aguarde/)
  fake.respond({
    type: 'progress',
    id: id + 1,
    report: { progress: 1, text: 'stale', timeElapsed: 0 },
  })
  fake.respond({ type: 'progress', id, report: { progress: 0.5, text: 'Loading', timeElapsed: 2 } })
  fake.respond({ type: 'result', id, result: { cached: 'present' } })

  assert.deepEqual(await loading, { cached: 'present' })
  assert.deepEqual(progress, [0.5])
  assert.equal(fake.requests.length, 1)
  client.dispose()
})

test('cancel terminates the worker and rejects its pending operation immediately', async () => {
  const fake = fakeWorker()
  const client = createModelClient(fake.worker)
  const generating = client.run({ type: 'generate', prompt: 'Olá' })

  client.dispose()
  await assert.rejects(generating, /cancelada/)
  fake.respond({
    type: 'result',
    id: fake.requests[0].id,
    result: { text: 'Late', elapsedMs: 1, tokens: 1, truncated: false },
  })
  assert.equal(fake.terminated, true)
  assert.equal(client.available, false)
  await assert.rejects(client.run({ type: 'load' }), /encerrada/)
})

test('worker errors reject pending work without leaving the client busy', async () => {
  const fake = fakeWorker()
  const client = createModelClient(fake.worker)
  const loading = client.run({ type: 'load' })

  fake.respond({ type: 'error', id: fake.requests[0].id, error: 'GPU lost' })
  await assert.rejects(loading, /GPU lost/)

  const clearing = client.run({ type: 'clear' })

  fake.respond({ type: 'result', id: fake.requests[1].id, result: { cached: 'absent' } })
  assert.deepEqual(await clearing, { cached: 'absent' })
  client.dispose()
})

test('model timeouts terminate the worker and make retries use a new session', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })

  const fake = fakeWorker()
  const client = createModelClient(fake.worker)
  const checking = client.run({ type: 'inspect' })

  context.mock.timers.tick(30_001)
  await assert.rejects(checking, /demorou demais/)
  assert.equal(fake.terminated, true)
  assert.equal(client.available, false)
})

test('model reducer ignores load and generation results after cancel or a new operation', () => {
  let state = localModelReducer(INITIAL_MODEL_STATE, {
    type: 'start',
    request: 1,
    phase: 'loading',
  })

  state = localModelReducer(state, { type: 'release', request: 2 })
  state = localModelReducer(state, { type: 'loaded', request: 1, cached: 'present' })
  assert.equal(state.phase, 'idle')
  assert.equal(state.cached, 'unknown')
  state = localModelReducer(state, { type: 'start', request: 3, phase: 'loading' })
  state = localModelReducer(state, { type: 'loaded', request: 3, cached: 'present' })
  state = localModelReducer(state, { type: 'start', request: 4, phase: 'generating' })
  state = localModelReducer(state, { type: 'release', request: 5 })
  state = localModelReducer(state, {
    type: 'answer',
    request: 4,
    answer: { text: 'Late', elapsedMs: 1, tokens: 1, truncated: false },
  })
  assert.equal(state.answer, undefined)
  assert.equal(state.cached, 'present')
  state = localModelReducer(state, { type: 'start', request: 6, phase: 'clearing' })
  state = localModelReducer(state, { type: 'cleared', request: 6, cached: 'absent' })
  assert.equal(state.cached, 'absent')
  assert.equal(state.phase, 'idle')
})
