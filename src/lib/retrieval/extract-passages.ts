import { duration, parseService, type ServiceSummary } from '../services/model.ts'
import type { Passage, Section } from './types.ts'

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {}
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(object) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function join(values: unknown[]): string {
  return values.map(text).filter(Boolean).join('\n\n')
}

function entryText(entry: JsonObject): string {
  const amount = entry.statusCustoVariavel === 1 ? entry.valorVariavel : entry.valor
  const cost = [text(entry.moeda), text(amount)].filter(Boolean).join(' ')

  return join([
    entry.nome,
    entry.descricao,
    cost,
    entry.ondeObter,
    entry.observacoes,
    entry.procedimentoSistemaIndisponivel,
  ])
}

function groupText(value: unknown, plural: string, singular: string): string {
  const group = object(value)
  const common = objects(group[plural]).map(entryText)
  const cases = objects(group.casos).map((condition) => {
    const entries = objects(condition[singular]).map(entryText)

    return join([condition.descricao, ...entries])
  })

  return join([...common, ...cases])
}

export function extractPassages(raw: unknown, summary: ServiceSummary): Passage[] {
  parseService(raw, summary.id)

  const record = object(raw)
  const passages: Passage[] = []

  function add(section: Section, sourcePath: string, title: string, content: string) {
    if (!content.trim()) {
      return
    }

    passages.push({
      id: `${summary.id}:${sourcePath}`,
      serviceId: summary.id,
      section,
      title,
      text: content,
      sourcePath,
      order: passages.length,
    })
  }

  add('description', '/descricao', 'Descrição do serviço', text(record.descricao))
  add(
    'duration',
    '/tempoTotalEstimado',
    'Prazo total estimado',
    duration(record.tempoTotalEstimado),
  )

  const applicants = objects(object(record.solicitantes).solicitante)
  const eligibility = applicants.map((applicant) => join([applicant.tipo, applicant.requisitos]))

  add('eligibility', '/solicitantes', 'Quem pode utilizar e requisitos', join(eligibility))

  if (record.gratuito === 'true') {
    add('costs', '/gratuito', 'Gratuidade', 'Serviço gratuito (gratuito: true).')
  }

  for (const [index, step] of objects(record.etapas).entries()) {
    const path = `/etapas/${index}`
    const title = `${index + 1}. ${text(step.titulo) || 'Etapa sem título'}`

    add('steps', `${path}/descricao`, title, text(step.descricao))
    add(
      'duration',
      `${path}/tempoTotalEstimado`,
      `${title} — Prazo`,
      duration(step.tempoTotalEstimado),
    )
    add(
      'documents',
      `${path}/documentos`,
      `${title} — Documentos`,
      groupText(step.documentos, 'documentos', 'documento'),
    )
    add(
      'costs',
      `${path}/custos`,
      `${title} — Custos e condições`,
      groupText(step.custos, 'custos', 'custo'),
    )
    add(
      'channels',
      `${path}/canaisDePrestacao`,
      `${title} — Canais de atendimento`,
      groupText(step.canaisDePrestacao, 'canaisDePrestacao', 'canalDePrestacao'),
    )
  }

  add('channels', '/contato', 'Contato', text(record.contato))

  return passages
}

export function searchMetadata(raw: unknown): string[] {
  const record = object(raw)

  return ['nomesPopulares', 'palavrasChave'].map((field) => {
    return objects(object(record[field]).item)
      .map((entry) => text(entry.item))
      .join(' ')
  })
}
