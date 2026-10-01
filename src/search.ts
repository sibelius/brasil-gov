// Small in-browser search engine for the mock Q&A bank.
// Accent/abbreviation normalization, typo tolerance (edit distance), IDF weighting,
// best-phrasing matching across variants, and multi-topic ("mix and match") detection.

export type Doc = {
  id: string
  question: string
  variants?: string[]
  keywords: string[]
  summary: string
}

const STOP = new Set(
  'a o e os as um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para pra pro com sem que se ao aos meu minha meus minhas seu sua seus suas eu voce ele ela isso isto esse essa este esta como qual quais quando onde quem tem ter tenho posso pode preciso precisa fazer faco faz quero queria saber gostaria sobre mais muito ja nao sim ou ate tambem agora hoje favor ola oi bom dia boa tarde noite obrigado'.split(
    ' ',
  ),
)

const REWRITE: [RegExp, string][] = [
  [/\b(2a|2ª|2|seg)\s*via\b/g, 'segunda via'],
  [/\bvc\b|\bvoce\b/g, 'voce'],
  [/\bpq\b/g, 'porque'],
  [/\bq\b/g, 'que'],
  [/\bpra\b|\bpro\b/g, 'para'],
  [/\btb\b|\btbm\b/g, 'tambem'],
  [/\bimposto de renda\b|\birpf\b/g, 'imposto renda irpf'],
  [/^ir$|\bir\b(?= \d| declar| 20)/g, 'imposto renda irpf declarar'],
  [/\bir\b/g, 'irpf'],
  [/\bcarteira de motorista\b|\bhabilitacao\b/g, 'cnh habilitacao'],
  [/\bidentidade\b|\brg\b/g, 'identidade cin'],
  [/\baposentar\b/g, 'aposentadoria'],
  [/\bdemitido\b|\bdemissao\b|\bmandado embora\b/g, 'demissao demitido'],
  [/\bremedio\b|\bremedios\b/g, 'medicamento remedio'],
]

export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ª\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stem = (w: string) => {
  if (w.length > 5 && w.endsWith('oes')) return w.slice(0, -3) + 'ao'
  if (w.length > 5 && w.endsWith('aes')) return w.slice(0, -3) + 'ao'
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ces')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1)
  return w
}

export function tokenize(s: string, keepStop = false): string[] {
  let t = fold(s)
  for (const [re, to] of REWRITE) t = t.replace(re, to)
  return t
    .split(' ')
    .filter((w) => w && (keepStop || (!STOP.has(w) && (w.length > 1 || /\d/.test(w)))))
    .map(stem)
}

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  // optimal string alignment distance, so swapped letters ("aposentadoira") count as one edit
  let pp: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1)
      cur.push(v)
      rowMin = Math.min(rowMin, v)
    }
    if (rowMin > max) return max + 1
    pp = prev
    prev = cur
  }
  return prev[b.length]
}

type Field = 'q' | 'v' | 'k' | 's'
const FIELD_W: Record<Field, number> = { k: 3, q: 2.6, v: 2.2, s: 0.7 }

export type Hit<T> = { doc: T; score: number; matched: Set<number>; phrase: string }

export function createIndex<T extends Doc>(docs: T[], prior: (doc: T) => number = () => 1) {
  // term -> doc index -> best field weight
  const postings = new Map<string, Map<number, number>>()
  const phrases: { d: number; text: string; toks: string[] }[] = []

  const add = (term: string, d: number, w: number) => {
    let m = postings.get(term)
    if (!m) postings.set(term, (m = new Map()))
    m.set(d, Math.max(m.get(d) ?? 0, w))
  }

  docs.forEach((doc, d) => {
    const fields: [Field, string][] = [
      ['q', doc.question],
      ['k', doc.keywords.join(' ')],
      ['s', doc.summary],
      ...(doc.variants ?? []).map((v) => ['v', v] as [Field, string]),
    ]
    for (const [f, text] of fields) for (const t of tokenize(text)) add(t, d, FIELD_W[f])
    for (const text of [doc.question, ...(doc.variants ?? [])]) phrases.push({ d, text, toks: tokenize(text) })
  })

  const N = docs.length
  const vocab = [...postings.keys()]
  const idf = (term: string) => Math.log(1 + N / (postings.get(term)?.size ?? N))
  const cache = new Map<string, [string, number][]>()

  // query token -> list of (index term, similarity)
  function expand(tok: string): [string, number][] {
    const hit = cache.get(tok)
    if (hit) return hit
    const out: [string, number][] = []
    if (postings.has(tok)) out.push([tok, 1])
    const max = tok.length >= 8 ? 2 : tok.length >= 4 ? 1 : 0
    for (const v of vocab) {
      if (v === tok) continue
      if (tok.length >= 3 && v.startsWith(tok) && v.length - tok.length <= 3) out.push([v, 0.82])
      else if (max && lev(tok, v, max) <= max) out.push([v, 0.72])
    }
    cache.set(tok, out)
    return out
  }

  function search(query: string, limit = 8): Hit<T>[] {
    const q = tokenize(query)
    if (!q.length) return []
    const scores = new Map<number, { s: number; matched: Set<number> }>()
    q.forEach((tok, qi) => {
      const perDoc = new Map<number, number>()
      for (const [term, sim] of expand(tok)) {
        const w = idf(term) * sim
        for (const [d, fw] of postings.get(term)!) perDoc.set(d, Math.max(perDoc.get(d) ?? 0, w * fw))
      }
      for (const [d, v] of perDoc) {
        const e = scores.get(d) ?? { s: 0, matched: new Set() }
        e.s += v
        e.matched.add(qi)
        scores.set(d, e)
      }
    })

    // phrase bonus: how well the query covers its closest phrasing
    const best = new Map<number, { cov: number; text: string }>()
    const qset = new Set(q)
    for (const p of phrases) {
      if (!scores.has(p.d) || !p.toks.length) continue
      let inter = 0
      for (const t of p.toks) if (qset.has(t)) inter++
      const cov = inter / Math.max(p.toks.length, q.length)
      const b = best.get(p.d)
      if (!b || cov > b.cov) best.set(p.d, { cov, text: p.text })
    }

    return [...scores.entries()]
      .map(([d, e]) => {
        const b = best.get(d)
        const coverage = e.matched.size / q.length
        return {
          doc: docs[d],
          score: (e.s * (0.25 + 0.75 * coverage) + (b?.cov ?? 0) * 6) * prior(docs[d]),
          matched: e.matched,
          phrase: b?.text ?? docs[d].question,
        }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  return { search, tokenize }
}

export const MIN_SCORE = 10

// off-topic queries ("receita de bolo") only partially match and score low
export const confident = <T extends Doc>(h: Hit<T> | undefined, qlen: number) =>
  !!h && (h.score >= MIN_SCORE || (h.matched.size === qlen && h.score >= 8))

// Detect a query that asks about two different things: top hits match disjoint parts of the query.
export function splitTopics<T extends Doc>(hits: Hit<T>[]): Hit<T>[] {
  const [a, b] = hits
  if (!a || !b || b.score < MIN_SCORE || b.score < a.score * 0.45) return [a].filter(Boolean)
  const onlyB = [...b.matched].filter((i) => !a.matched.has(i))
  const onlyA = [...a.matched].filter((i) => !b.matched.has(i))
  return onlyA.length && onlyB.length ? [a, b] : [a]
}
