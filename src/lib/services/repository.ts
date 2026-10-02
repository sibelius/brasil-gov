import { DATASET, parseCatalog, parseService } from './model.ts'
import { parseHolidays } from './holidays.ts'
import { createJsonLoader } from '../json-cache.ts'

const loadJson = createJsonLoader({ cacheName: `brasil-gov-data-${DATASET.revision}` })

export function loadCatalog() {
  return loadJson(`${DATASET.base}/index.json`, parseCatalog)
}

export function loadService(id: string) {
  if (!/^\d+$/.test(id)) {
    return Promise.reject(new Error('Identificador de serviço inválido.'))
  }

  return loadJson(`${DATASET.base}/services/${id}.json`, (value) => parseService(value, id))
}

export function loadHolidays() {
  return loadJson(`${DATASET.base}/holidays.json`, parseHolidays)
}
