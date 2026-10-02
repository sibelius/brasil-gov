import { useEffect, useMemo, useState } from 'react'
import { Activity, ChevronDown, ExternalLink, MapPin, Search } from 'lucide-react'
import { Header } from '../components/layout/site-header'
import { normalize } from '../lib/retrieval/query'
import { loadCatalog } from '../lib/services/repository'
import type { ServiceSummary } from '../lib/services/model'
import { loadStatus } from '../lib/status/repository'
import {
  STATUS_GROUPS,
  STATUS_LEVELS,
  type StatusGroup,
  type StatusHistory,
  type StatusLevel,
  type StatusSnapshot,
} from '../lib/status/types'
import { REPOSITORY_URL } from '../lib/project'
import '../styles/status.css'

type Row = StatusSnapshot['targets'][number]

const LEVEL_LABELS: Record<StatusLevel, string> = {
  up: 'No ar',
  slow: 'Lento',
  restricted: 'Bloqueou o robô',
  broken: 'Link quebrado',
  down: 'Fora do ar',
}

const LEVEL_HINTS: Record<StatusLevel, string> = {
  up: 'Respondeu com sucesso em até 4 segundos.',
  slow: 'Respondeu, mas levou mais de 4 segundos.',
  restricted: 'Respondeu 401, 403 ou 429. O site está de pé, mas recusou a verificação automática.',
  broken: 'Respondeu 404 ou outro erro 4xx: o endereço cadastrado não existe mais.',
  down: 'Erro 5xx, tempo esgotado, DNS inexistente ou conexão recusada.',
}

const GROUP_LABELS: Record<StatusGroup, string> = {
  federal: 'Plataformas federais',
  detran: 'Detrans',
  estado: 'Governos estaduais',
  capital: 'Prefeituras das capitais',
  catalogo: 'Sistemas do catálogo gov.br',
}

const CODE_LEVEL: Record<string, StatusLevel> = {
  u: 'up',
  s: 'slow',
  r: 'restricted',
  b: 'broken',
  d: 'down',
}

const PAGE = 40

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  })
}

function uptime(codes: string) {
  const checked = [...codes].filter((code) => code !== '-')

  if (checked.length < 3) {
    return undefined
  }

  const ok = checked.filter((code) => code === 'u' || code === 's' || code === 'r').length

  return Math.round((ok / checked.length) * 1000) / 10
}

function Dot({ level }: { level: StatusLevel }) {
  return <span className={`status-dot level-${level}`} aria-hidden="true" />
}

function Bars({ codes }: { codes?: string }) {
  if (!codes) {
    return null
  }

  const recent = codes.slice(-30).padStart(30, '-')

  return (
    <span className="status-bars" aria-hidden="true">
      {[...recent].map((code, index) => (
        <span key={index} className={code === '-' ? 'level-none' : `level-${CODE_LEVEL[code]}`} />
      ))}
    </span>
  )
}

function Services({ ids }: { ids: string[] }) {
  const [catalog, setCatalog] = useState<Map<string, ServiceSummary>>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true

    loadCatalog()
      .then((list) => active && setCatalog(new Map(list.map((service) => [service.id, service]))))
      .catch(() => active && setFailed(true))

    return () => {
      active = false
    }
  }, [])

  if (failed) {
    return <p className="status-muted">Não foi possível carregar os nomes dos serviços.</p>
  }

  if (!catalog) {
    return <p className="status-muted">Carregando serviços…</p>
  }

  return (
    <ul className="status-services">
      {ids.map((id) => {
        const service = catalog.get(id)

        return (
          <li key={id}>
            <a href={`/chat?${new URLSearchParams({ q: service?.name ?? id, service: id })}`}>
              {service?.name ?? `Serviço ${id}`}
            </a>
            {service && <span>{service.agency}</span>}
          </li>
        )
      })}
    </ul>
  )
}

function StatusRow({ row, codes }: { row: Row; codes?: string }) {
  const [open, setOpen] = useState(false)
  const ratio = codes ? uptime(codes) : undefined
  const detail = row.http ? `HTTP ${row.http}` : row.error

  return (
    <li className="status-row">
      <div className="status-row-main">
        <Dot level={row.level} />
        <div className="status-row-name">
          <a href={row.finalUrl ?? row.url} target="_blank" rel="noopener noreferrer">
            {row.name}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
          <span>
            {[
              row.city ?? row.uf,
              row.agencies?.slice(0, 2).join(' · '),
              row.tlsIssue && 'certificado inválido',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
        <Bars codes={codes} />
        <div className="status-row-meta">
          <strong className={`level-text-${row.level}`}>{LEVEL_LABELS[row.level]}</strong>
          <span>
            {detail} · {(row.ms / 1000).toFixed(1)} s{ratio !== undefined ? ` · ${ratio}%` : ''}
          </span>
        </div>
      </div>
      {row.serviceIds && row.serviceIds.length > 0 && (
        <>
          <button
            type="button"
            className="status-expand"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown size={16} aria-hidden="true" />
            {row.serviceIds.length}{' '}
            {row.serviceIds.length === 1 ? 'serviço depende' : 'serviços dependem'} deste sistema
          </button>
          {open && <Services ids={row.serviceIds} />}
        </>
      )}
    </li>
  )
}

export default function StatusPage() {
  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'error' }
    | { phase: 'ready'; snapshot: StatusSnapshot; history?: StatusHistory; live: boolean }
  >({ phase: 'loading' })
  const [group, setGroup] = useState<StatusGroup | 'all'>('all')
  const [level, setLevel] = useState<StatusLevel | 'all'>('all')
  const [uf, setUf] = useState('')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    document.title = 'Status dos serviços públicos · Brasil.gov'

    let active = true

    loadStatus()
      .then((result) => active && setState({ phase: 'ready', ...result }))
      .catch(() => active && setState({ phase: 'error' }))

    return () => {
      active = false
    }
  }, [])

  const snapshot = state.phase === 'ready' ? state.snapshot : undefined
  const targets = useMemo(() => snapshot?.targets ?? [], [snapshot])
  const levels = state.phase === 'ready' ? state.history?.levels : undefined
  const states = useMemo(
    () => [...new Set(targets.map((target) => target.uf).filter(Boolean) as string[])].sort(),
    [targets],
  )
  const filtered = useMemo(() => {
    const term = normalize(query.trim())

    return targets.filter(
      (target) =>
        (group === 'all' || target.group === group) &&
        (level === 'all' || target.level === level) &&
        (!uf || target.uf === uf) &&
        (!term ||
          normalize(
            [target.name, target.url, target.city, ...(target.agencies ?? [])].join(' '),
          ).includes(term)),
    )
  }, [targets, group, level, uf, query])
  const counts = useMemo(() => {
    const map = new Map<StatusLevel, number>()

    for (const target of targets) {
      map.set(target.level, (map.get(target.level) ?? 0) + 1)
    }

    return map
  }, [targets])
  const affected = useMemo(
    () =>
      targets
        .filter(
          (target) =>
            target.group === 'catalogo' && (target.level === 'down' || target.level === 'broken'),
        )
        .reduce((sum, target) => sum + (target.serviceIds?.length ?? 0), 0),
    [targets],
  )
  const local = uf
    ? targets.filter((target) => target.uf === uf && target.group !== 'catalogo')
    : []
  const ordered = STATUS_GROUPS.filter((key) => group === 'all' || key === group)
  const reachable =
    (counts.get('up') ?? 0) + (counts.get('slow') ?? 0) + (counts.get('restricted') ?? 0)

  function reset() {
    setLimit(PAGE)
  }

  return (
    <>
      <Header light />
      <main className="status-page">
        <section className="status-hero">
          <span className="status-eyebrow">
            <Activity size={16} aria-hidden="true" /> Monitoramento independente
          </span>
          <h1>Status dos serviços públicos brasileiros</h1>
          <p className="lead">
            Verificamos de hora em hora os sistemas federais, os 27 Detrans, os governos estaduais,
            as prefeituras das capitais e cada sistema usado pelos serviços do catálogo gov.br.
          </p>

          {state.phase === 'loading' && <p role="status">Carregando o último retrato…</p>}
          {state.phase === 'error' && (
            <p role="alert">
              Não foi possível carregar o status agora. Tente novamente em instantes.
            </p>
          )}
          {state.phase === 'ready' && (
            <>
              <div className="status-summary">
                <div>
                  <strong>
                    {reachable}/{targets.length}
                  </strong>
                  <span>sistemas respondendo</span>
                </div>
                <div>
                  <strong className="level-text-down">
                    {(counts.get('down') ?? 0) + (counts.get('broken') ?? 0)}
                  </strong>
                  <span>fora do ar ou com link quebrado</span>
                </div>
                <div>
                  <strong className="level-text-down">{affected}</strong>
                  <span>serviços do catálogo afetados</span>
                </div>
              </div>
              <p className="status-muted">
                Última verificação: {formatDate(state.snapshot.checkedAt)} · origem:{' '}
                {state.snapshot.origin}
                {!state.live && ' · exibindo o retrato publicado com o site'}
              </p>
            </>
          )}
        </section>

        {state.phase === 'ready' && (
          <>
            <div className="status-legend" role="group" aria-label="Filtrar por situação">
              <button
                type="button"
                className={level === 'all' ? 'active' : ''}
                onClick={() => {
                  setLevel('all')
                  reset()
                }}
              >
                Todos <span>{targets.length}</span>
              </button>
              {STATUS_LEVELS.map((key) => (
                <button
                  key={key}
                  type="button"
                  title={LEVEL_HINTS[key]}
                  className={level === key ? 'active' : ''}
                  onClick={() => {
                    setLevel(key)
                    reset()
                  }}
                >
                  <Dot level={key} /> {LEVEL_LABELS[key]} <span>{counts.get(key) ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="status-filters">
              <label className="status-search">
                <Search size={18} aria-hidden="true" />
                <span className="sr-only">Buscar sistema, órgão ou cidade</span>
                <input
                  type="search"
                  placeholder="Buscar sistema, órgão ou cidade"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value)
                    reset()
                  }}
                />
              </label>
              <label className="status-select">
                <MapPin size={18} aria-hidden="true" />
                <span className="sr-only">Estado</span>
                <select
                  value={uf}
                  onChange={(event) => {
                    setUf(event.target.value)
                    reset()
                  }}
                >
                  <option value="">Todos os estados</option>
                  {states.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="status-select">
                <span className="sr-only">Grupo</span>
                <select
                  value={group}
                  onChange={(event) => {
                    setGroup(event.target.value as StatusGroup | 'all')
                    reset()
                  }}
                >
                  <option value="all">Todos os grupos</option>
                  {STATUS_GROUPS.map((key) => (
                    <option key={key} value={key}>
                      {GROUP_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {uf && local.length > 0 && (
              <section className="status-local" aria-labelledby="status-local-title">
                <h2 id="status-local-title">Em {uf}</h2>
                <div className="status-cards">
                  {local.map((target) => (
                    <a
                      key={target.id}
                      className="status-card"
                      href={target.finalUrl ?? target.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className="status-card-group">{GROUP_LABELS[target.group]}</span>
                      <strong>{target.name}</strong>
                      <span className={`level-text-${target.level}`}>
                        <Dot level={target.level} /> {LEVEL_LABELS[target.level]}
                      </span>
                    </a>
                  ))}
                </div>
                <p className="status-muted">
                  Serviços federais valem em todo o país e aparecem nos grupos abaixo.
                </p>
              </section>
            )}

            {ordered.map((key) => {
              const rows = filtered
                .filter((target) => target.group === key)
                .sort(
                  (a, b) =>
                    STATUS_LEVELS.indexOf(b.level) - STATUS_LEVELS.indexOf(a.level) ||
                    (b.serviceIds?.length ?? 0) - (a.serviceIds?.length ?? 0) ||
                    a.name.localeCompare(b.name, 'pt-BR'),
                )

              if (!rows.length) {
                return null
              }

              const visible = key === 'catalogo' ? rows.slice(0, limit) : rows

              return (
                <section className="status-group" key={key} aria-labelledby={`group-${key}`}>
                  <h2 id={`group-${key}`}>
                    {GROUP_LABELS[key]} <span>{rows.length}</span>
                  </h2>
                  <ul>
                    {visible.map((row) => (
                      <StatusRow key={row.id} row={row} codes={levels?.[row.id]} />
                    ))}
                  </ul>
                  {visible.length < rows.length && (
                    <button
                      type="button"
                      className="status-more"
                      onClick={() => setLimit(limit + PAGE * 2)}
                    >
                      Mostrar mais {Math.min(PAGE * 2, rows.length - visible.length)} de{' '}
                      {rows.length - visible.length}
                    </button>
                  )}
                </section>
              )
            })}

            {!filtered.length && <p className="status-muted">Nenhum sistema com esses filtros.</p>}
          </>
        )}

        <section className="status-method" aria-labelledby="status-method-title">
          <h2 id="status-method-title">Como medimos</h2>
          <ul>
            <li>
              Uma função na Vercel na região de São Paulo (gru1), acionada de hora em hora pelo
              GitHub Actions, faz uma requisição GET a cada endereço, segue até 5 redirecionamentos
              e espera no máximo 10 segundos. Medir de dentro do Brasil importa: muitos sites
              .gov.br bloqueiam acessos do exterior.
            </li>
            <li>
              Os resultados ficam no branch <code>status-data</code> do repositório, com histórico
              das últimas 168 verificações (7 dias). As barras mostram as 30 mais recentes e a
              porcentagem conta “no ar”, “lento” e “bloqueou o robô” como disponível.
            </li>
            <li>
              Os sistemas do catálogo são os{' '}
              {targets.filter((target) => target.group === 'catalogo').length || 835} domínios
              distintos dos links “acessar serviço digital” da API de Serviços do gov.br.
              Verificamos o link mais usado de cada domínio.
            </li>
            <li>
              É um teste de disponibilidade da página, não do serviço completo: login, pagamentos e
              filas internas podem falhar mesmo com a página no ar.
            </li>
          </ul>

          <h2>Como acompanhar mais serviços</h2>
          <ul>
            <li>
              <strong>Todas as prefeituras:</strong> o Wikidata tem o site oficial (propriedade
              P856) de boa parte dos 5.570 municípios, ligado ao código do IBGE. Uma consulta SPARQL
              gera a lista.
            </li>
            <li>
              <strong>Detrans e Sefaz:</strong> a lista curada fica em{' '}
              <code>status/curated.ts</code>. Para acrescentar um sistema, basta uma linha e um pull
              request.
            </li>
            <li>
              <strong>Avisos oficiais:</strong> alguns órgãos publicam indisponibilidades
              programadas (Receita Federal, eSocial, Serpro). Integrar esses avisos é uma boa
              primeira contribuição.
            </li>
          </ul>
          <a
            className="status-cta"
            href={`${REPOSITORY_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Adados-reais`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver issues abertas <ExternalLink size={16} aria-hidden="true" />
          </a>
        </section>
      </main>
    </>
  )
}
