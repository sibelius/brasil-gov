import { lazy, memo, Suspense } from 'react'
import { PAGE_SIZE } from '../../lib/services/catalog-search'
import type { ServiceSummary } from '../../lib/services/model'
import type { Turn } from '../../reducers/chat-reducer'
import { ArrowRight } from 'lucide-react'

const ServiceDetails = lazy(() => import('./service-details'))

export const SearchTurn = memo(function SearchTurn({
  turn,
  search,
  open,
  close,
}: {
  turn: Turn
  search: (query: string, id?: number, offset?: number) => void
  open: (id: number, summary: ServiceSummary) => void
  close: (id: number) => void
}) {
  const detail = turn.detail

  return (
    <section className="chat-turn" aria-label={`Busca: ${turn.query}`}>
      <h2 className="bubble">{turn.query}</h2>
      {turn.status === 'loading' && (
        <p className="search-status" role="status">
          Buscando no catálogo de serviços…
        </p>
      )}
      {turn.status === 'error' && (
        <div className="search-status" role="alert">
          <p>{turn.error}</p>
          <button className="retry-button" onClick={() => search(turn.query, turn.id, turn.offset)}>
            Tentar novamente
          </button>
        </div>
      )}
      {turn.status === 'ready' && (
        <>
          <p className="search-status" role="status">
            {turn.total
              ? `${turn.total.toLocaleString('pt-BR')} serviço(s) encontrado(s). Escolha um para consultar as etapas.`
              : 'Nenhum serviço encontrado. Tente o nome do serviço ou do órgão, como “passaporte” ou “INSS”.'}
          </p>
          <ul className="service-results">
            {turn.items.map((service) => (
              <li key={service.id}>
                <button
                  className={`service-result ${detail?.summary.id === service.id ? 'selected' : ''}`}
                  onClick={() =>
                    detail?.summary.id === service.id ? close(turn.id) : open(turn.id, service)
                  }
                  aria-expanded={detail?.summary.id === service.id}
                  aria-controls={`detail-${turn.id}`}
                >
                  <span>
                    <strong>{service.name}</strong>
                    <small>{service.agency}</small>
                  </span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {turn.total > PAGE_SIZE && (
            <nav className="result-pages" aria-label={`Páginas de resultados para ${turn.query}`}>
              <button
                disabled={turn.offset === 0}
                onClick={() => search(turn.query, turn.id, turn.offset - PAGE_SIZE)}
              >
                Anterior
              </button>
              <span>
                {turn.offset + 1}–{Math.min(turn.offset + PAGE_SIZE, turn.total)} de {turn.total}
              </span>
              <button
                disabled={turn.offset + PAGE_SIZE >= turn.total}
                onClick={() => search(turn.query, turn.id, turn.offset + PAGE_SIZE)}
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
      <div id={`detail-${turn.id}`}>
        {detail?.status === 'loading' && (
          <p className="search-status" role="status">
            Carregando {detail.summary.name}…
          </p>
        )}
        {detail?.status === 'error' && (
          <div className="search-status" role="alert">
            <p>{detail.error}</p>
            <button className="retry-button" onClick={() => open(turn.id, detail.summary)}>
              Tentar novamente
            </button>
            <a href={detail.summary.url} target="_blank" rel="noopener noreferrer">
              Abrir página oficial ↗
            </a>
          </div>
        )}
        {detail?.status === 'ready' && (
          <Suspense fallback={<p role="status">Preparando o serviço…</p>}>
            <ServiceDetails key={detail.service.id} service={detail.service} />
          </Suspense>
        )}
      </div>
    </section>
  )
})
