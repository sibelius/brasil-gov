import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { CheckResult, StatusLevel, StatusTarget } from '../src/lib/status/types.ts'

const USER_AGENT =
  'Mozilla/5.0 (compatible; BrasilGovStatus/1.0; +https://brasil-gov.vercel.app/status)'
const REQUEST_TIMEOUT = 10_000
const SLOW_MS = 4_000
const MAX_REDIRECTS = 5
const TLS_ERRORS = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_GET_ISSUER_CERT',
  'CERT_UNTRUSTED',
])

type Hop = { status: number; location?: string }

function hop(url: URL, strictTls: boolean): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'http:' ? httpRequest : httpsRequest)(
      url,
      {
        method: 'GET',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          'accept-language': 'pt-BR,pt;q=0.9',
        },
        timeout: REQUEST_TIMEOUT,
        rejectUnauthorized: strictTls,
      },
      (response: IncomingMessage) => {
        const location = response.headers.location

        response.destroy()
        resolve({ status: response.statusCode ?? 0, location })
      },
    )

    request.on('timeout', () =>
      request.destroy(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })),
    )
    request.on('error', reject)
    request.end()
  })
}

async function follow(start: string, strictTls: boolean) {
  let url = new URL(start)

  for (let redirects = 0; ; redirects++) {
    const { status, location } = await hop(url, strictTls)

    if (status >= 300 && status < 400 && location && redirects < MAX_REDIRECTS) {
      url = new URL(location, url)

      continue
    }

    return { status, finalUrl: url.href }
  }
}

export function classify(status: number, ms: number): StatusLevel {
  if (status >= 500 || status === 0) {
    return 'down'
  }

  if ([401, 403, 407, 429, 451].includes(status)) {
    return 'restricted'
  }

  if (status >= 400) {
    return 'broken'
  }

  return ms > SLOW_MS ? 'slow' : 'up'
}

function errorCode(error: unknown) {
  const code = (error as { code?: string }).code

  return code ?? (error instanceof Error ? error.message : String(error))
}

export async function checkTarget(target: Pick<StatusTarget, 'id' | 'url'>): Promise<CheckResult> {
  const started = performance.now()
  let tlsIssue = false

  try {
    let outcome

    try {
      outcome = await follow(target.url, true)
    } catch (error) {
      if (!TLS_ERRORS.has(errorCode(error))) {
        throw error
      }

      tlsIssue = true
      outcome = await follow(target.url, false)
    }

    const ms = Math.round(performance.now() - started)

    return {
      id: target.id,
      level: classify(outcome.status, ms),
      http: outcome.status,
      ms,
      finalUrl: outcome.finalUrl === target.url ? undefined : outcome.finalUrl,
      ...(tlsIssue ? { tlsIssue } : {}),
    }
  } catch (error) {
    return {
      id: target.id,
      level: 'down',
      ms: Math.round(performance.now() - started),
      error: errorCode(error),
      ...(tlsIssue ? { tlsIssue } : {}),
    }
  }
}

export async function checkAll(
  targets: Pick<StatusTarget, 'id' | 'url'>[],
  concurrency = 24,
): Promise<CheckResult[]> {
  const results: CheckResult[] = new Array(targets.length)
  let next = 0

  async function worker() {
    while (next < targets.length) {
      const position = next++

      results[position] = await checkTarget(targets[position])
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker))

  return results
}
