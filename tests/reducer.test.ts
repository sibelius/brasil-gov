import assert from 'node:assert/strict'
import test from 'node:test'
import { chatReducer, HISTORY_LIMIT, INITIAL_STATE } from '../src/reducers/chat-reducer.ts'
import type { Service } from '../src/lib/services/model.ts'

const summary = {
  id: '62',
  name: 'Passaporte',
  agency: 'Polícia Federal',
  url: 'https://www.gov.br/passaporte',
}
const result = { items: [summary], total: 1, catalogSize: 5729 }

test('ignores late search results after retry and reset', () => {
  let state = chatReducer(INITIAL_STATE, {
    type: 'search',
    id: 1,
    request: 1,
    query: 'passaporte',
    offset: 0,
  })
  state = chatReducer(state, { type: 'search', id: 1, request: 2, query: 'passaporte', offset: 0 })
  state = chatReducer(state, { type: 'results', id: 1, request: 1, result })
  assert.equal(state.turns[0].status, 'loading')
  state = chatReducer(state, { type: 'results', id: 1, request: 2, result })
  assert.equal(state.turns[0].status, 'ready')
  state = chatReducer(state, { type: 'reset' })
  state = chatReducer(state, { type: 'results', id: 1, request: 2, result })
  assert.deepEqual(state, INITIAL_STATE)
})

test('late details cannot overwrite a new selection or reopen a closed service', () => {
  let state = chatReducer(INITIAL_STATE, {
    type: 'search',
    id: 1,
    request: 1,
    query: 'passaporte',
    offset: 0,
  })
  state = chatReducer(state, { type: 'open', id: 1, request: 2, summary })
  state = chatReducer(state, {
    type: 'open',
    id: 1,
    request: 3,
    summary: { ...summary, id: '1036' },
  })
  state = chatReducer(state, { type: 'service', id: 1, request: 2, service: summary as Service })
  assert.equal(state.turns[0].detail?.summary.id, '1036')
  assert.equal(state.turns[0].detail?.status, 'loading')
  state = chatReducer(state, { type: 'close', id: 1 })
  state = chatReducer(state, { type: 'service-error', id: 1, request: 3, error: 'offline' })
  assert.equal(state.turns[0].detail, undefined)
})

test('bounds history while preserving unfinished input on pagination', () => {
  let state = INITIAL_STATE

  for (let id = 1; id <= 20; id++) {
    state = chatReducer(state, { type: 'search', id, request: id, query: 'INSS', offset: 0 })
  }

  assert.equal(state.turns.length, HISTORY_LIMIT)
  state = chatReducer(state, { type: 'draft', value: 'nova pergunta' })
  state = chatReducer(state, { type: 'search', id: 20, request: 21, query: 'INSS', offset: 8 })
  assert.equal(state.draft, 'nova pergunta')
  assert.equal(state.turns.length, HISTORY_LIMIT)
})
