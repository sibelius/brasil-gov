import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { REMOTE_DATA, openCatalog, type Catalog } from '../mcp/catalog.ts'
import { createServer } from '../mcp/server.ts'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers':
    'content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'mcp-session-id, mcp-protocol-version',
}

let catalog: Promise<Catalog> | undefined

function loadCatalog() {
  catalog ??= openCatalog(
    process.env.BRASIL_GOV_DATA_URL ? new URL(process.env.BRASIL_GOV_DATA_URL) : REMOTE_DATA,
  ).catch((error) => {
    catalog = undefined

    throw error
  })

  return catalog
}

function withCors(response: Response) {
  const headers = new Headers(response.headers)

  for (const [key, value] of Object.entries(CORS)) {
    headers.set(key, value)
  }

  return new Response(response.body, { status: response.status, headers })
}

function json(body: unknown, status = 200) {
  return withCors(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }),
  )
}

export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }))
    }

    if (request.method === 'GET' && request.headers.get('accept')?.includes('text/event-stream')) {
      return json(
        { jsonrpc: '2.0', error: { code: -32000, message: 'SSE não suportado.' }, id: null },
        405,
      )
    }

    if (request.method !== 'POST') {
      return json({
        name: 'brasil-gov',
        transport: 'streamable-http',
        endpoint: 'https://brasil-gov.vercel.app/mcp',
        usage:
          'Envie requisições JSON-RPC via POST. Documentação: https://brasil-gov.vercel.app/mcp',
      })
    }

    try {
      const server = createServer(await loadCatalog())
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      })

      await server.connect(transport)

      return withCors(await transport.handleRequest(request))
    } catch (error) {
      console.error(error)

      return json(
        {
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Falha ao carregar o catálogo.' },
          id: null,
        },
        500,
      )
    }
  },
}
