import { safeUrl } from '../helpers/safe-url'

export type PhotoCredit = {
  key: string
  title: string
  artist: string
  license: string
  page: string
}

let pending: Promise<PhotoCredit[]> | undefined

async function fetchCredits(): Promise<PhotoCredit[]> {
  const response = await fetch('/photo-credits.json')

  if (!response.ok) {
    throw new Error('Não foi possível carregar os créditos.')
  }

  const value: unknown = await response.json()

  if (!Array.isArray(value)) {
    throw new Error('Créditos inválidos.')
  }

  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error('Crédito inválido.')
    }

    const row = entry as Record<string, unknown>
    const { key, title, artist, license } = row
    const page = safeUrl(row.page)

    if (
      typeof key !== 'string' ||
      typeof title !== 'string' ||
      typeof artist !== 'string' ||
      typeof license !== 'string' ||
      !page
    ) {
      throw new Error('Crédito inválido.')
    }

    return { key, title, artist, license, page }
  })
}

export function loadPhotoCredits(): Promise<PhotoCredit[]> {
  pending ??= fetchCredits().catch((error: unknown) => {
    pending = undefined

    throw error
  })

  return pending
}
