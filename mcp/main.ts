#!/usr/bin/env -S node --experimental-strip-types --no-warnings
import { createServer as createHttpServer } from 'node:http'
import { parseArgs } from 'node:util'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { LOCAL_DATA, REMOTE_DATA, openCatalog } from './catalog.ts'
import { createServer } from './server.ts'

const { values } = parseArgs({
  options: {
    http: { type: 'boolean', default: false },
    port: { type: 'string', default: process.env.PORT ?? '3333' },
    host: { type: 'string', default: '127.0.0.1' },
    remote: { type: 'boolean', default: false },
    data: { type: 'string', default: process.env.BRASIL_GOV_DATA_URL },
  },
})

const base = values.data
  ? new URL(values.data.endsWith('/') ? values.data : `${values.data}/`)
  : values.remote
    ? REMOTE_DATA
    : LOCAL_DATA
const catalog = await openCatalog(base)

if (!values.http) {
  await createServer(catalog).connect(new StdioServerTransport())
} else {
  const port = Number(values.port)

  createHttpServer(async (request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname

    if (path === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ ok: true, ...catalog.info() }))

      return
    }

    if (path !== '/mcp') {
      response.writeHead(404).end()

      return
    }

    if (request.method !== 'POST') {
      response.writeHead(405, { allow: 'POST' }).end()

      return
    }

    const server = createServer(catalog)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })

    response.on('close', () => {
      void transport.close()
      void server.close()
    })

    try {
      await server.connect(transport)
      await transport.handleRequest(request, response)
    } catch (error) {
      console.error(error)

      if (!response.headersSent) {
        response.writeHead(500).end()
      }
    }
  }).listen(port, values.host, () => {
    console.error(`brasil-gov MCP em http://${values.host}:${port}/mcp`)
  })
}
