import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { openCatalog } from '../mcp/catalog.ts'
import { createServer } from '../mcp/server.ts'
import { MCP_TOOLS } from '../src/lib/mcp/manifest.ts'

const catalog = await openCatalog()
const server = createServer(catalog)
const client = new Client({ name: 'test', version: '0.0.0' })
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const [content] = result.content as { type: string; text: string }[]

  return { isError: result.isError === true, body: content.text }
}

async function callJson(name: string, args: Record<string, unknown> = {}) {
  const result = await call(name, args)

  assert.equal(result.isError, false, result.body)

  return JSON.parse(result.body)
}

test.after(() => client.close())

test('mcp: lists every tool in the manifest', async () => {
  const { tools } = await client.listTools()

  assert.deepEqual(tools.map((tool) => tool.name).sort(), MCP_TOOLS.map((tool) => tool.name).sort())

  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, tool.name)
  }
})

test('mcp: catalog_info reports counts and provenance', async () => {
  const info = await callJson('catalog_info')

  assert.equal(info.services, 5729)
  assert.equal(info.passages, 67488)
  assert.ok(info.agencies > 100)
  assert.match(info.source, /^https:\/\/api-servicos\.estaleiro\.serpro\.gov\.br/)
})

test('mcp: search_services paginates ranked results', async () => {
  const first = await callJson('search_services', { query: 'passaporte', limit: 3 })

  assert.equal(first.items.length, 3)
  assert.ok(first.total >= 3)
  assert.ok(first.items.every((item: { url: string }) => item.url.startsWith('https://')))

  if (first.nextOffset !== null) {
    const second = await callJson('search_services', {
      query: 'passaporte',
      limit: 3,
      offset: first.nextOffset,
    })

    assert.notEqual(second.items[0].id, first.items[0].id)
  }
})

test('mcp: get_service returns normalized details', async () => {
  const service = await callJson('get_service', { id: '2833' })

  assert.equal(service.id, '2833')
  assert.match(service.agency, /INPI/)
  assert.equal(service.free, false)
  assert.ok(service.steps.length > 0)
  assert.ok(service.audiences.includes('Empresas'))
})

test('mcp: get_service rejects unknown services', async () => {
  const result = await call('get_service', { id: '99999999' })

  assert.equal(result.isError, true)
  assert.match(result.body, /não existe/)
})

test('mcp: get_service_section filters passages by section', async () => {
  const section = await callJson('get_service_section', { id: '2833', section: 'steps' })

  assert.equal(section.service.id, '2833')
  assert.ok(section.passages.length > 0)
  assert.ok(section.passages.every((passage: { id: string }) => passage.id.startsWith('2833')))
})

test('mcp: retrieve_context returns cited evidence', async () => {
  const context = await callJson('retrieve_context', {
    question:
      'Quais são as etapas para solicitar consulta sobre contratos de transferência de tecnologia?',
  })

  assert.ok(['ready', 'insufficient_evidence', 'needs_clarification'].includes(context.status))
  assert.equal(context.context, undefined)

  if (context.status !== 'needs_clarification') {
    assert.ok(context.passages.length > 0)
    assert.ok(context.passages.every((passage: { url: string }) => passage.url))
  }
})

test('mcp: agencies and their services', async () => {
  const agencies = await callJson('list_agencies', { query: 'inpi' })

  assert.equal(agencies.total, 1)

  const services = await callJson('list_services_by_agency', {
    agency: agencies.items[0].name,
    limit: 50,
  })

  assert.equal(services.total, agencies.items[0].services)
  assert.ok(services.items.some((item: { id: string }) => item.id === '2833'))
})

test('mcp: service resource and prompt', async () => {
  const resource = await client.readResource({ uri: 'brasil-gov://services/2833' })
  const [content] = resource.contents as { text: string }[]

  assert.equal(JSON.parse(content.text).id, 'https://servicos.gov.br/api/v1/servicos/2833')

  const prompt = await client.getPrompt({
    name: 'answer_with_sources',
    arguments: { question: 'Como tirar passaporte?' },
  })

  assert.match(JSON.stringify(prompt.messages), /retrieve_context/)
})
