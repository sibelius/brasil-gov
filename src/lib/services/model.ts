import { safeUrl } from '../../helpers/safe-url.ts'
import { formatDuration, parseDuration, type ParsedDuration } from './duration.ts'

export const DATASET = {
  base: '/data/v1',
  revision: '2026-10-01-d4f38eed',
  collected: '01/10/2026',
} as const

export type ServiceSummary = {
  id: string
  name: string
  agency: string
  url: string
}

export type ContentGroup = {
  title: string
  entries: string[]
}

export type ServiceStep = {
  title: string
  description: string
  duration: string
  durationEstimate: ParsedDuration
  groups: ContentGroup[]
}

export type Service = ServiceSummary & {
  description: string
  digitalUrl: string
  cost: string
  duration: string
  durationEstimate: ParsedDuration
  applicants: ContentGroup[]
  steps: ServiceStep[]
  contact: string
}

type RecordValue = Record<string, unknown>

function object(value: unknown): RecordValue {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as RecordValue
  }

  return {}
}

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(object) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function serviceId(value: unknown): string {
  const id = text(value).match(/^https:\/\/servicos\.gov\.br\/api\/v1\/servicos\/([0-9]+)$/)?.[1]

  if (!id) {
    throw new Error('Identificador de serviço inválido.')
  }

  return id
}

export function parseCatalog(value: unknown): ServiceSummary[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error('Catálogo inválido.')
  }

  const ids = new Set<string>()

  return value.map((entry) => {
    const row = object(entry)
    const id = serviceId(row.id)
    const name = text(row.nome)
    const agency = text(row.orgao)
    const url = safeUrl(row.url)

    if (!name || !agency || !url || ids.has(id)) {
      throw new Error('Entrada inválida no catálogo.')
    }

    ids.add(id)

    return { id, name, agency, url }
  })
}

export function duration(value: unknown): string {
  return formatDuration(parseDuration(value))
}

function entryText(row: RecordValue): string {
  const amount = row.statusCustoVariavel === 1 ? text(row.valorVariavel) : text(row.valor)

  return [
    text(row.nome),
    text(row.descricao),
    [text(row.moeda), amount].filter(Boolean).join(' '),
    text(row.ondeObter),
    text(row.observacoes),
    text(row.procedimentoSistemaIndisponivel),
  ]
    .filter(Boolean)
    .join('\n\n')
}

function groups(value: unknown, plural: string, singular: string, title: string): ContentGroup[] {
  const row = object(value)

  return [
    { title, entries: records(row[plural]).map(entryText).filter(Boolean) },
    ...records(row.casos).map((item) => ({
      title: `${title} — ${text(item.descricao) || 'Caso específico'}`,
      entries: records(item[singular]).map(entryText).filter(Boolean),
    })),
  ].filter((group) => group.entries.length)
}

function serviceCost(value: unknown): string {
  if (value === 'true') {
    return 'Gratuito'
  }

  if (value === 'false') {
    return 'Pode haver custos. Consulte as etapas.'
  }

  return 'Custo não informado'
}

export function parseService(value: unknown, expectedId: string): Service {
  const row = object(value)
  const agency = object(row.orgao)
  const id = serviceId(row.id)
  const name = text(row.nome)
  const url = safeUrl(row.url)

  if (id !== expectedId || !name || !text(agency.nomeOrgao) || !url || !Array.isArray(row.etapas)) {
    throw new Error('Os dados do serviço são inválidos.')
  }

  return {
    id,
    name,
    url,
    agency: text(agency.nomeOrgao),
    description: text(row.descricao),
    digitalUrl: safeUrl(row.linkServicoDigital),
    contact: text(row.contato),
    cost: serviceCost(row.gratuito),
    duration: duration(row.tempoTotalEstimado),
    durationEstimate: parseDuration(row.tempoTotalEstimado),
    applicants: records(object(row.solicitantes).solicitante).map((item) => ({
      title: text(item.tipo),
      entries: [text(item.requisitos)].filter(Boolean),
    })),
    steps: records(row.etapas).map((step, index) => ({
      title: text(step.titulo) || `Etapa ${index + 1}`,
      description: text(step.descricao),
      duration: duration(step.tempoTotalEstimado),
      durationEstimate: parseDuration(step.tempoTotalEstimado),
      groups: [
        ...groups(step.documentos, 'documentos', 'documento', 'Documentos'),
        ...groups(step.custos, 'custos', 'custo', 'Custos'),
        ...groups(
          step.canaisDePrestacao,
          'canaisDePrestacao',
          'canalDePrestacao',
          'Canais de atendimento',
        ),
      ],
    })),
  }
}
