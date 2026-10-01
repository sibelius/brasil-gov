import { safeUrl } from '../../helpers/safe-url.ts'
import { RETRIEVAL_SCHEMA, SECTIONS, type PassageFile, type RetrievalIndex } from './types.ts'

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function validateIndex(value: unknown, revision: string): RetrievalIndex {
  if (
    !isObject(value) ||
    value.schema !== RETRIEVAL_SCHEMA ||
    value.revision !== revision ||
    !Array.isArray(value.documents) ||
    !value.documents.length ||
    !isObject(value.postings)
  ) {
    throw new Error('Índice de recuperação inválido ou desatualizado.')
  }

  const ids = new Set<string>()

  for (const document of value.documents) {
    if (
      !isObject(document) ||
      typeof document.id !== 'string' ||
      !/^\d+$/.test(document.id) ||
      ids.has(document.id) ||
      typeof document.name !== 'string' ||
      typeof document.agency !== 'string' ||
      !safeUrl(document.url) ||
      !Array.isArray(document.titleTerms) ||
      !document.titleTerms.every((term) => typeof term === 'string')
    ) {
      throw new Error('Serviço inválido no índice de recuperação.')
    }

    ids.add(document.id)
  }

  for (const list of Object.values(value.postings)) {
    if (!Array.isArray(list) || list.length % 2 !== 0) {
      throw new Error('Lista de busca inválida.')
    }

    for (let position = 0; position < list.length; position += 2) {
      const documentIndex = list[position]
      const weight = list[position + 1]

      if (
        !Number.isInteger(documentIndex) ||
        documentIndex < 0 ||
        documentIndex >= value.documents.length ||
        !Number.isInteger(weight) ||
        weight < 1 ||
        weight > 8
      ) {
        throw new Error('Referência inválida no índice de recuperação.')
      }
    }
  }

  return value as RetrievalIndex
}

export function validatePassages(value: unknown, revision: string, serviceId: string): PassageFile {
  if (
    !isObject(value) ||
    value.revision !== revision ||
    value.serviceId !== serviceId ||
    !Array.isArray(value.passages)
  ) {
    throw new Error('Trechos inválidos ou desatualizados.')
  }

  const ids = new Set<string>()

  for (const passage of value.passages) {
    if (
      !isObject(passage) ||
      passage.serviceId !== serviceId ||
      typeof passage.sourcePath !== 'string' ||
      !passage.sourcePath.startsWith('/') ||
      passage.id !== `${serviceId}:${passage.sourcePath}` ||
      typeof passage.id !== 'string' ||
      ids.has(passage.id) ||
      !SECTIONS.includes(passage.section as (typeof SECTIONS)[number]) ||
      typeof passage.title !== 'string' ||
      typeof passage.text !== 'string' ||
      !Number.isInteger(passage.order)
    ) {
      throw new Error('Trecho sem referência válida.')
    }

    ids.add(passage.id)
  }

  return value as PassageFile
}
