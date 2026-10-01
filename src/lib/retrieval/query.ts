import type { Section } from './types.ts'

const STOP_WORDS = new Set(
  'a o e os as um uma de do da dos das em no na nos nas por para pra com que se ao aos meu minha meus minhas eu como qual quais quando onde quem posso pode preciso fazer faco quero saber sobre tirar obter solicitar tem tenho seria voce favor gostaria necessario necessarios necessaria necessarias'.split(
    ' ',
  ),
)

const EQUIVALENTS: Record<string, string> = {
  crianca: 'menor',
  criancas: 'menor',
  menores: 'menor',
  filho: 'menor',
  filha: 'menor',
  filhos: 'menor',
  documentos: 'documento',
  documentacao: 'documento',
  papeis: 'documento',
  requisitos: 'requisito',
  custos: 'custo',
  custa: 'custo',
  custam: 'custo',
  preco: 'custo',
  precos: 'custo',
  valor: 'custo',
  valores: 'custo',
  taxa: 'custo',
  taxas: 'custo',
  pagar: 'custo',
  pagamento: 'custo',
  demora: 'prazo',
  demorar: 'prazo',
  prazos: 'prazo',
  tempo: 'prazo',
  etapas: 'etapa',
  passos: 'etapa',
}

const INTENT_TERMS: Record<string, Section> = {
  documento: 'documents',
  requisito: 'eligibility',
  direito: 'eligibility',
  custo: 'costs',
  gratuito: 'costs',
  gratis: 'costs',
  isencao: 'costs',
  prazo: 'duration',
  etapa: 'steps',
  procedimento: 'steps',
  contato: 'channels',
  telefone: 'channels',
  atendimento: 'channels',
}

const QUESTION_WORDS = new Set([
  'quanto',
  'quantos',
  'quanta',
  'quantas',
  'levar',
  'leva',
  'funciona',
])
const MODIFIERS = new Set(['menor', 'idoso', 'idosos', 'deficiencia'])

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function searchableText(text: string): string {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
}

export function tokenize(text: string): string[] {
  const normalized = normalize(searchableText(text))
    .replace(/\bmei\b/g, 'microempreendedor individual')
    .replace(
      /\babrir (?:um )?microempreendedor individual\b/g,
      'formalizar microempreendedor individual',
    )
    .replace(/\brg\b/g, 'identidade')
    .replace(/\bcnh\b/g, 'carteira nacional habilitacao')
    .replace(/\birpf\b/g, 'imposto renda')

  const words = normalized
    .split(' ')
    .filter((word) => word.length > 1 && word.length <= 40 && !STOP_WORDS.has(word))
    .map((word) => EQUIVALENTS[word] ?? word)

  return [...new Set(words)]
}

export function analyzeQuestion(question: string) {
  const terms = tokenize(question)
  const intents = new Set<Section>()

  for (const term of terms) {
    const section = INTENT_TERMS[term]

    if (section) {
      intents.add(section)
    }
  }

  if (/\bcomo\b/.test(normalize(question)) && !intents.size) {
    intents.add('steps')
  }

  return {
    terms,
    topics: terms.filter(
      (term) => !INTENT_TERMS[term] && !QUESTION_WORDS.has(term) && !MODIFIERS.has(term),
    ),
    modifiers: terms.filter((term) => MODIFIERS.has(term)),
    intents: [...intents],
  }
}

export function splitQuestion(question: string): string[] {
  const parts = question
    .split(/\s+e\s+|;|\s+tamb[eé]m\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2 || parts.some((part) => !analyzeQuestion(part).topics.length)) {
    return [question]
  }

  return parts.slice(0, 6)
}
