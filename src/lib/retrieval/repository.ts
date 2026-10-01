import manifest from '../../../public/data/v1/retrieval/manifest.json' with { type: 'json' }
import { createJsonLoader } from '../json-cache.ts'
import { validateIndex, validatePassages } from './validation.ts'

export const RETRIEVAL_REVISION = manifest.revision
const BASE_PATH = '/data/v1/retrieval'
const loadJson = createJsonLoader({
  cacheName: `brasil-gov-retrieval-${RETRIEVAL_REVISION}`,
  memoryLimit: 8,
  diskLimit: 49,
})

export function loadRetrievalIndex() {
  return loadJson(`${BASE_PATH}/index.json?v=${RETRIEVAL_REVISION}`, (value) => {
    return validateIndex(value, RETRIEVAL_REVISION)
  })
}

export function loadPassages(serviceId: string) {
  if (!/^\d+$/.test(serviceId)) {
    return Promise.reject(new Error('Identificador de serviço inválido.'))
  }

  return loadJson(`${BASE_PATH}/passages/${serviceId}.json?v=${RETRIEVAL_REVISION}`, (value) => {
    return validatePassages(value, RETRIEVAL_REVISION, serviceId)
  })
}
