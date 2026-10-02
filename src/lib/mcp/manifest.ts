export const MCP_NAME = 'brasil-gov'

export const MCP_VERSION = '0.1.0'

export const MCP_REPOSITORY_PATH = 'mcp/main.ts'

export type ToolParameter = {
  name: string
  type: string
  required: boolean
  description: string
}

export type ToolManifest = {
  name: string
  title: string
  description: string
  parameters: ToolParameter[]
  example: Record<string, unknown>
  prompt: string
}

export const MCP_TOOLS: ToolManifest[] = [
  {
    name: 'search_services',
    title: 'Buscar serviços',
    description:
      'Busca serviços públicos do catálogo gov.br por nome, órgão, apelido ou palavra-chave, ignorando acentos. Retorna ID, nome, órgão e link oficial, em páginas.',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Termo ou pergunta.' },
      { name: 'offset', type: 'integer', required: false, description: 'Início da página.' },
      { name: 'limit', type: 'integer', required: false, description: 'Até 50 itens.' },
    ],
    example: { query: 'emitir passaporte', limit: 5 },
    prompt: 'Quais serviços do gov.br existem para tirar passaporte?',
  },
  {
    name: 'get_service',
    title: 'Detalhar serviço',
    description:
      'Retorna o registro completo de um serviço: descrição, quem pode solicitar, etapas, documentos, custos, prazos, canais, público-alvo e palavras-chave.',
    parameters: [{ name: 'id', type: 'string', required: true, description: 'ID numérico.' }],
    example: { id: '2833' },
    prompt: 'Me mostre todas as etapas do serviço 2833.',
  },
  {
    name: 'get_service_section',
    title: 'Ler uma seção',
    description:
      'Retorna apenas os trechos de uma seção de um serviço (description, eligibility, documents, costs, duration, steps ou channels), com o caminho JSON da fonte.',
    parameters: [
      { name: 'id', type: 'string', required: true, description: 'ID numérico.' },
      { name: 'section', type: 'enum', required: true, description: 'Seção desejada.' },
    ],
    example: { id: '2833', section: 'documents' },
    prompt: 'Quais documentos preciso para o serviço 2833?',
  },
  {
    name: 'retrieve_context',
    title: 'Recuperar evidências',
    description:
      'Recebe uma pergunta em linguagem natural e devolve os trechos mais relevantes com fontes, o status (ready, needs_clarification, insufficient_evidence) e as seções que faltam. Use antes de responder qualquer pergunta factual.',
    parameters: [
      { name: 'question', type: 'string', required: true, description: 'Pergunta do usuário.' },
      {
        name: 'selectedServiceId',
        type: 'string',
        required: false,
        description: 'Restringe a um serviço (perguntas de acompanhamento).',
      },
      {
        name: 'maxCharacters',
        type: 'integer',
        required: false,
        description: 'Orçamento de caracteres (padrão 12.000).',
      },
      {
        name: 'maxPassages',
        type: 'integer',
        required: false,
        description: 'Máximo de trechos (padrão 8).',
      },
      {
        name: 'maxServices',
        type: 'integer',
        required: false,
        description: 'Máximo de serviços (padrão 3).',
      },
    ],
    example: { question: 'Quanto custa tirar o passaporte comum?' },
    prompt: 'Quanto custa tirar o passaporte e quanto tempo demora?',
  },
  {
    name: 'list_agencies',
    title: 'Listar órgãos',
    description:
      'Lista os órgãos que prestam serviços no catálogo, com o número de serviços de cada um. Aceita filtro por parte do nome ou sigla.',
    parameters: [
      { name: 'query', type: 'string', required: false, description: 'Filtro, ex.: "INSS".' },
      { name: 'offset', type: 'integer', required: false, description: 'Início da página.' },
      { name: 'limit', type: 'integer', required: false, description: 'Até 50 itens.' },
    ],
    example: { query: 'universidade', limit: 10 },
    prompt: 'Quais universidades federais têm mais serviços no gov.br?',
  },
  {
    name: 'list_services_by_agency',
    title: 'Serviços de um órgão',
    description:
      'Lista os serviços de um órgão, pelo nome exato ou por parte do nome (por exemplo, a sigla entre parênteses).',
    parameters: [
      { name: 'agency', type: 'string', required: true, description: 'Nome ou sigla do órgão.' },
      { name: 'offset', type: 'integer', required: false, description: 'Início da página.' },
      { name: 'limit', type: 'integer', required: false, description: 'Até 50 itens.' },
    ],
    example: { agency: '(INSS)', limit: 20 },
    prompt: 'Liste os serviços do INSS.',
  },
  {
    name: 'catalog_info',
    title: 'Sobre o catálogo',
    description:
      'Informa a origem dos dados, a data da coleta, as revisões, as contagens de serviços, trechos e órgãos, e o aviso de uso.',
    parameters: [],
    example: {},
    prompt: 'De onde vêm esses dados e quando foram coletados?',
  },
]

export const MCP_RESOURCES = [
  {
    uri: 'brasil-gov://catalog',
    description: 'Metadados e proveniência do catálogo (JSON).',
  },
  {
    uri: 'brasil-gov://services/{id}',
    description: 'Registro original de um serviço, exatamente como veio da API do gov.br (JSON).',
  },
]

export const MCP_PROMPTS = [
  {
    name: 'answer_with_sources',
    description:
      'Responde a uma pergunta sobre serviços públicos usando apenas evidências do catálogo, citando os links oficiais.',
  },
]
