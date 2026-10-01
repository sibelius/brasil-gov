import { lazy, memo, Suspense, useEffect, useRef } from 'react'
import { PAGE_SIZE } from '../../lib/services/catalog-types'
import type { ServiceSummary } from '../../lib/services/model'
import type { Turn } from '../../reducers/chat-reducer'
import { ArrowRight, Search } from 'lucide-react'
import { scrollToChatContent } from '../../helpers/scroll-to-chat-content'

const ServiceDetails = lazy(() => import('./service-details'))

export const SearchTurn = memo(function SearchTurn({
  turn,
  search,
  open,
  select,
}: {
  turn: Turn
  search: (query: string, id?: number, offset?: number, scopeId?: string) => void
  open: (id: number, summary: ServiceSummary, question: string) => void
  select: (summary: Pick<ServiceSummary, 'id' | 'name'>, id?: number) => void
}) {
  const detail = turn.detail
  const turnRef = useRef<HTMLElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const detailRequest = detail?.request

  useEffect(() => {
    // Each search (including pagination) and service selection has its own request.
    // Context updates should not pull the reader away from the section they opened.
    if (detailRequest) {
      scrollToChatContent(detailRef.current)
    } else {
      scrollToChatContent(turnRef.current)
    }
  }, [turn.request, detailRequest])

  return (
    <section ref={turnRef} className="chat-turn" aria-label={`Busca: ${turn.query}`}>
      <h2 className="bubble">{turn.query}</h2>
      {turn.status === 'loading' && (
        <p className="search-status" role="status">
          {turn.serviceId
            ? 'Carregando o serviço selecionado…'
            : 'Buscando no catálogo de serviços…'}
        </p>
      )}
      {turn.status === 'error' && (
        <div className="search-status" role="alert">
          <p>{turn.error}</p>
          <button
            className="retry-button"
            onClick={() =>
              turn.serviceId
                ? select({ id: turn.serviceId, name: turn.query }, turn.id)
                : search(turn.query, turn.id, turn.offset, turn.scopeId)
            }
          >
            Tentar novamente
          </button>
        </div>
      )}
      {turn.status === 'ready' && !detail && !turn.serviceId && (
        <>
          <div className="results-heading">
            <Search size={16} aria-hidden="true" />
            <span>Catálogo de serviços</span>
          </div>
          <p className="search-status" role="status">
            {turn.context?.status === 'needs_clarification'
              ? turn.context.reason === 'missing_service'
                ? 'Sobre qual serviço você quer saber? Informe o nome do serviço ou escolha um resultado anterior.'
                : 'Há mais de um serviço possível. Escolha abaixo qual você quer consultar.'
              : turn.total
                ? `${turn.total.toLocaleString('pt-BR')} ${turn.total === 1 ? 'serviço encontrado' : 'serviços encontrados'}. Escolha para ver os detalhes.`
                : 'Nenhum serviço encontrado. Tente o nome do serviço ou do órgão, como “passaporte” ou “INSS”.'}
          </p>
          <ul className="service-results">
            {turn.items.map((service) => (
              <li key={service.id}>
                <button
                  className="service-result"
                  onClick={() => open(turn.id, service, turn.query)}
                  aria-expanded={false}
                  aria-controls={`detail-${turn.id}`}
                >
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.agency}</small>
                  </span>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {turn.total > PAGE_SIZE && (
            <nav className="result-pages" aria-label={`Páginas de resultados para ${turn.query}`}>
              <button
                disabled={turn.offset === 0}
                onClick={() => search(turn.query, turn.id, turn.offset - PAGE_SIZE, turn.scopeId)}
              >
                Anterior
              </button>
              <span>
                {turn.offset + 1}–{Math.min(turn.offset + PAGE_SIZE, turn.total)} de {turn.total}
              </span>
              <button
                disabled={turn.offset + PAGE_SIZE >= turn.total}
                onClick={() => search(turn.query, turn.id, turn.offset + PAGE_SIZE, turn.scopeId)}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
      {turn.contextError && detail && (
        <div className="search-status" role="alert">
          <p>Não foi possível consultar os trechos relacionados à pergunta.</p>
          <button
            className="retry-button"
            onClick={() => open(turn.id, detail.summary, turn.query)}
          >
            Tentar novamente
          </button>
        </div>
      )}
      <div id={`detail-${turn.id}`} ref={detailRef} className="service-detail-anchor">
        {detail?.status === 'loading' && (
          <p className="search-status" role="status">
            Carregando {detail.summary.name}…
          </p>
        )}
        {detail?.status === 'error' && (
          <div className="search-status" role="alert">
            <p>{detail.error}</p>
            <button
              className="retry-button"
              onClick={() => open(turn.id, detail.summary, turn.query)}
            >
              Tentar novamente
            </button>
            <a href={detail.summary.url} target="_blank" rel="noopener noreferrer">
              Abrir página oficial ↗
            </a>
          </div>
        )}
        {detail?.status === 'ready' && (
          <Suspense fallback={<p role="status">Preparando o serviço…</p>}>
            <ServiceDetails key={detail.service.id} service={detail.service}>
              {!!turn.related?.length && (
                <aside className="service-block" aria-label="Tópicos relacionados">
                  <h3>Tópicos relacionados</h3>
                  <ul className="service-results">
                    {turn.related.map((service) => (
                      <li key={service.id}>
                        <button className="service-result" onClick={() => select(service)}>
                          <span>
                            <strong>{service.name}</strong>
                            <small>{service.agency}</small>
                          </span>
                          <ArrowRight size={18} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </aside>
              )}
            </ServiceDetails>
          </Suspense>
        )}
      </div>
    </section>
  )
})
