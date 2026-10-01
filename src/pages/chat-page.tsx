import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useChat } from '../hooks/use-chat'
import { SearchTurn } from '../components/services/search-turn'
import { Header } from '../components/layout/site-header'
import { OfficialBanner } from '../components/layout/official-banner'
import { InputAccessories } from '../components/input-accessories'
import { ArrowRight } from 'lucide-react'

const EXAMPLES = ['Passaporte', 'Cadastro Único', 'Microempreendedor individual', 'Aposentadoria']

export default function ChatPage() {
  const [initialQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const { state, dispatch, search, open, close, reset } = useChat(initialQuery)
  const latestTurn = useRef<HTMLDivElement>(null)
  const lastId = state.turns.at(-1)?.id
  const selectedServiceId = state.turns.findLast((turn) => turn.detail)?.detail?.summary.id

  useEffect(() => {
    latestTurn.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [lastId])

  function submit(event: FormEvent) {
    event.preventDefault()
    void search(state.draft, undefined, 0, selectedServiceId)
  }

  return (
    <div className="chat-page">
      <OfficialBanner />
      <Header light />
      <main className="chat">
        <div className="chat-heading">
          <h1>Serviços públicos</h1>
          {state.turns.length > 0 && <button onClick={reset}>Nova conversa</button>}
        </div>
        {state.turns.length === 0 && (
          <div className="empty">
            <h2 className="display-md">Qual serviço você procura?</h2>
            <p className="lead">
              Encontre serviços do catálogo gov.br e consulte requisitos, etapas e canais de
              atendimento.
            </p>
            <div className="cat-qs">
              {EXAMPLES.map((query) => (
                <button key={query} onClick={() => search(query)}>
                  {query}
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}
        {state.turns.map((turn) => (
          <div key={turn.id} ref={turn.id === lastId ? latestTurn : undefined}>
            <SearchTurn turn={turn} search={search} open={open} close={close} />
          </div>
        ))}
        <div className="chat-spacer" />
      </main>
      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="service-query">
          Nome do serviço ou do órgão
        </label>
        <textarea
          id="service-query"
          rows={1}
          maxLength={300}
          value={state.draft}
          placeholder="Busque um serviço ou órgão…"
          onChange={(event) => dispatch({ type: 'draft', value: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              void search(state.draft, undefined, 0, selectedServiceId)
            }
          }}
        />
        <InputAccessories />
        <button
          type="submit"
          className="send ready"
          disabled={!state.draft.trim()}
          aria-label="Buscar serviços"
        >
          <ArrowRight size={20} aria-hidden="true" />
        </button>
      </form>
      <p className="composer-note">
        Projeto independente. Confirme as informações nos links oficiais. Não insira dados pessoais.
      </p>
    </div>
  )
}
