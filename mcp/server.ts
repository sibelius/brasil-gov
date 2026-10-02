import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { SECTIONS } from '../src/lib/retrieval/types.ts'
import { MCP_NAME, MCP_TOOLS, MCP_VERSION } from '../src/lib/mcp/manifest.ts'
import { page, MAX_PAGE, type Catalog } from './catalog.ts'
import { queryStatus } from './status.ts'
import { STATUS_GROUPS, STATUS_LEVELS } from '../src/lib/status/types.ts'

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const

const id = z
  .string()
  .regex(/^\d{1,8}$/)
  .describe('ID numérico do serviço, ex.: "2833".')
const offset = z.number().int().min(0).default(0).describe('Início da página.')
const limit = z.number().int().min(1).max(MAX_PAGE).default(10).describe('Itens por página.')

const INSTRUCTIONS = `Brasil.gov: catálogo de 5.729 serviços públicos federais do gov.br (projeto independente, não oficial).
Para responder perguntas factuais, chame retrieve_context e responda somente com os trechos retornados, citando o link oficial (url) de cada serviço.
Se o status for needs_clarification, peça ao usuário para escolher entre os serviços listados. Se for insufficient_evidence, diga o que falta e indique a página oficial.
Use search_services para descobrir IDs e get_service ou get_service_section para ler detalhes.\nPara saber se um sistema está no ar (Detran, prefeitura, Meu INSS, e-CAC ou o link de um serviço), use get_status.
Para "até quando fica pronto", use estimate_deadline em vez de calcular: ele conta dias úteis com os feriados nacionais. Apresente o resultado como estimativa e não como prazo oficial.
Os dados vêm de uma coleta pontual (veja catalog_info). Lembre o usuário de confirmar custos e prazos na página oficial.`

function describe(name: string) {
  const tool = MCP_TOOLS.find((entry) => entry.name === name)

  if (!tool) {
    throw new Error(`Tool sem manifesto: ${name}`)
  }

  return { title: tool.title, description: tool.description }
}

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] }
}

function failure(error: unknown) {
  return {
    isError: true,
    content: [
      { type: 'text' as const, text: error instanceof Error ? error.message : String(error) },
    ],
  }
}

async function attempt(job: () => unknown) {
  try {
    return json(await job())
  } catch (error) {
    return failure(error)
  }
}

export function createServer(catalog: Catalog) {
  const server = new McpServer(
    { name: MCP_NAME, version: MCP_VERSION, title: 'Brasil.gov' },
    { instructions: INSTRUCTIONS },
  )

  server.registerTool(
    'search_services',
    {
      ...describe('search_services'),
      inputSchema: { query: z.string().min(2).max(300), offset, limit },
      annotations: READ_ONLY,
    },
    ({ query, offset, limit }) =>
      attempt(() => {
        const { strategy, results } = catalog.searchServices(query)

        return { query, strategy, ...page(results, offset, limit) }
      }),
  )

  server.registerTool(
    'get_service',
    { ...describe('get_service'), inputSchema: { id }, annotations: READ_ONLY },
    ({ id }) => attempt(() => catalog.getService(id)),
  )

  server.registerTool(
    'get_service_section',
    {
      ...describe('get_service_section'),
      inputSchema: { id, section: z.enum(SECTIONS) },
      annotations: READ_ONLY,
    },
    ({ id, section }) => attempt(() => catalog.getSection(id, section)),
  )

  server.registerTool(
    'retrieve_context',
    {
      ...describe('retrieve_context'),
      inputSchema: {
        question: z.string().min(2).max(1000),
        selectedServiceId: id.optional(),
        maxCharacters: z.number().int().min(500).max(100_000).optional(),
        maxPassages: z.number().int().min(1).max(32).optional(),
        maxServices: z.number().int().min(1).max(5).optional(),
      },
      annotations: READ_ONLY,
    },
    ({ question, selectedServiceId, maxCharacters, maxPassages, maxServices }) =>
      attempt(async () => {
        const budget = Object.fromEntries(
          Object.entries({ maxCharacters, maxPassages, maxServices }).filter(
            ([, value]) => value !== undefined,
          ),
        )
        const result = await catalog.retrieveContext(question, selectedServiceId, budget)
        const { context: _serialized, ...rest } = result

        return rest
      }),
  )

  server.registerTool(
    'list_agencies',
    {
      ...describe('list_agencies'),
      inputSchema: { query: z.string().max(200).optional(), offset, limit },
      annotations: READ_ONLY,
    },
    ({ query, offset, limit }) => attempt(() => page(catalog.listAgencies(query), offset, limit)),
  )

  server.registerTool(
    'list_services_by_agency',
    {
      ...describe('list_services_by_agency'),
      inputSchema: { agency: z.string().min(2).max(200), offset, limit },
      annotations: READ_ONLY,
    },
    ({ agency, offset, limit }) =>
      attempt(() => ({ agency, ...page(catalog.servicesByAgency(agency), offset, limit) })),
  )

  server.registerTool(
    'get_status',
    {
      ...describe('get_status'),
      inputSchema: {
        query: z.string().max(200).optional().describe('Nome, domínio, órgão ou cidade.'),
        uf: z.string().length(2).optional().describe('Sigla do estado, ex.: "SP".'),
        group: z.enum(STATUS_GROUPS).optional(),
        level: z.enum(STATUS_LEVELS).optional(),
        serviceId: id.optional().describe('Sistemas usados por este serviço do catálogo.'),
        offset,
        limit,
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    ({ offset, limit, ...filter }) =>
      attempt(async () => {
        const { matches, ...rest } = await queryStatus(filter)

        return { ...rest, ...page(matches, offset, limit) }
      }),
  )

  server.registerTool(
    'estimate_deadline',
    {
      ...describe('estimate_deadline'),
      inputSchema: {
        id,
        start: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('Data do pedido em AAAA-MM-DD. Padrão: hoje em São Paulo.'),
      },
      annotations: READ_ONLY,
    },
    ({ id: serviceId, start }) => attempt(() => catalog.estimateDeadline(serviceId, start)),
  )

  server.registerTool(
    'catalog_info',
    { ...describe('catalog_info'), inputSchema: {}, annotations: READ_ONLY },
    () => attempt(() => catalog.info()),
  )

  server.registerResource(
    'catalog',
    'brasil-gov://catalog',
    {
      title: 'Catálogo Brasil.gov',
      description: 'Metadados e proveniência do catálogo.',
      mimeType: 'application/json',
    },
    (uri) => ({
      contents: [
        { uri: uri.href, mimeType: 'application/json', text: JSON.stringify(catalog.info()) },
      ],
    }),
  )

  server.registerResource(
    'service',
    new ResourceTemplate('brasil-gov://services/{id}', { list: undefined }),
    {
      title: 'Registro de serviço',
      description: 'Registro original de um serviço, como veio da API do gov.br.',
      mimeType: 'application/json',
    },
    async (uri, { id }) => {
      const raw = await catalog.getRaw(String(id))

      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(raw) }],
      }
    },
  )

  server.registerPrompt(
    'answer_with_sources',
    {
      title: 'Responder com fontes',
      description:
        'Responde a uma pergunta sobre serviços públicos usando apenas evidências do catálogo.',
      argsSchema: { question: z.string().describe('Pergunta sobre um serviço público.') },
    },
    ({ question }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `${question}

Responda em português do Brasil usando o servidor MCP brasil-gov:
1. Chame retrieve_context com a pergunta acima.
2. Se o status for needs_clarification, liste os serviços encontrados e pergunte qual é o certo.
3. Responda apenas com base nos trechos retornados. Não invente valores, prazos ou documentos.
4. Termine com "Fontes:" e o link oficial (url) de cada serviço usado, e lembre que os dados podem ter mudado desde a coleta.`,
          },
        },
      ],
    }),
  )

  return server
}
