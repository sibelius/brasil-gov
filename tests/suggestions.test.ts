import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  createCatalogSuggester,
  SUGGESTION_LIMIT,
} from '../src/lib/services/catalog-suggestions.ts'
import type { RetrievalIndex } from '../src/lib/retrieval/types.ts'
import { INITIAL_SUGGESTIONS, suggestionsReducer } from '../src/reducers/suggestions-reducer.ts'

const index: RetrievalIndex = JSON.parse(
  await readFile(new URL('../public/data/v1/retrieval/index.json', import.meta.url), 'utf8'),
)
const suggestPage = createCatalogSuggester(index)
const suggest = (query: string) => suggestPage(query).items

test('suggests real services before the last word is complete', () => {
  assert.equal(suggest('passap')[0].id, '62')
  assert.equal(suggest('carteira de trab')[0].id, '60')
  assert.equal(suggest('como tirar passa')[0].id, '62')
  assert.ok(suggest('aposenta').some((service) => service.name.includes('Aposentadoria')))
})

test('suggestions ignore accents and support catalog agencies and aliases', () => {
  assert.deepEqual(suggest('saúde'), suggest('saude'))
  assert.ok(suggest('mei').some((service) => service.id === '9435'))
  assert.ok(
    suggest('INSS').every(
      (service) => service.name.includes('INSS') || service.agency.includes('Seguro Social'),
    ),
  )
})

test('suggestions are bounded, unique, and cache equivalent queries', () => {
  const result = suggest('pa')

  assert.equal(result.length, SUGGESTION_LIMIT)
  assert.equal(new Set(result.map((service) => service.id)).size, result.length)
  assert.deepEqual(suggest(' PA '), result)
  assert.deepEqual(suggest('p'), [])
  assert.deepEqual(suggest('Quanto custa?'), [])
  assert.deepEqual(suggest('zzzzinexistente'), [])
})

test('suggestions exclude body-only matches and require every topic', () => {
  const fixture: RetrievalIndex = {
    schema: 1,
    revision: 'test',
    documents: [
      {
        id: '1',
        name: 'Passaporte',
        agency: 'Agency',
        url: 'https://www.gov.br/1',
        titleTerms: ['passaporte'],
      },
      {
        id: '2',
        name: 'Other',
        agency: 'Agency',
        url: 'https://www.gov.br/2',
        titleTerms: ['other'],
      },
    ],
    postings: { passaporte: [0, 8, 1, 1], digital: [1, 8] },
  }
  const findPage = createCatalogSuggester(fixture)
  const find = (query: string) => findPage(query).items

  assert.deepEqual(
    find('passap').map((service) => service.id),
    ['1'],
  )
  assert.deepEqual(find('passaporte digi'), [])
})

test('late suggestions cannot replace new input or reopen a dismissed list', () => {
  const items = suggest('passap')
  let state = suggestionsReducer(INITIAL_SUGGESTIONS, { type: 'loading', request: 1 })

  state = suggestionsReducer(state, { type: 'loading', request: 2 })
  state = suggestionsReducer(state, { type: 'results', request: 1, items, total: items.length })
  assert.equal(state.status, 'loading')
  assert.deepEqual(state.items, [])
  state = suggestionsReducer(state, { type: 'close', request: 3 })
  state = suggestionsReducer(state, { type: 'results', request: 2, items, total: items.length })
  assert.equal(state.status, 'closed')
  assert.equal(state.active, -1)
})

test('keyboard navigation wraps without selecting a result automatically', () => {
  let state = suggestionsReducer(INITIAL_SUGGESTIONS, { type: 'loading', request: 1 })

  state = suggestionsReducer(state, { type: 'results', request: 1, ...suggestPage('passap') })
  assert.equal(state.active, -1)
  state = suggestionsReducer(state, { type: 'move', direction: -1 })
  assert.equal(state.active, state.items.length - 1)
  state = suggestionsReducer(state, { type: 'move', direction: 1 })
  assert.equal(state.active, 0)
  state = suggestionsReducer(state, { type: 'activate', index: 999 })
  assert.equal(state.active, 0)
  state = suggestionsReducer(state, { type: 'loading', request: 2 })
  assert.equal(state.active, -1)
  assert.deepEqual(state.items, [])
})
