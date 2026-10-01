import { useState, type FormEvent } from 'react'
import { useChat } from '../hooks/use-chat'
import { SearchTurn } from '../components/services/search-turn'
import { Header } from '../components/layout/site-header'
import { InputAccessories } from '../components/input-accessories'
import { ArrowRight } from 'lucide-react'
import { useServiceSuggestions } from '../hooks/use-service-suggestions'
import { ServiceSuggestions } from '../components/services/service-suggestions'
import type { ServiceSummary } from '../lib/services/model'

const EXAMPLES = ['Passaporte', 'Cadastro Único', 'Microempreendedor individual', 'Aposentadoria']

export default function ChatPage() {
  const [initialQuery] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [initialServiceId] = useState(
    () => new URLSearchParams(window.location.search).get('service') ?? undefined,
  )
  const { state, dispatch, search, open, reset, suggest, select } = useChat(
    initialQuery,
    initialServiceId,
  )
  const suggestions = useServiceSuggestions(suggest)
  const selectedServiceId = state.turns.findLast((turn) => turn.detail)?.detail?.summary.id

  function submit(event: FormEvent) {
    event.preventDefault()
    suggestions.dismiss()
    void search(state.draft, undefined, 0, selectedServiceId)
  }

  function selectSuggestion(service: ServiceSummary) {
    suggestions.dismiss()
    void select(service)
  }

  return (
    <div className="chat-page">
      <Header light />
      <main className="chat">
        <div className="chat-heading">
          <h1>Serviços públicos</h1>
          {state.turns.length > 0 && (
            <button
              onClick={() => {
                suggestions.dismiss()
                reset()
              }}
            >
              Nova conversa
            </button>
          )}
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
          <SearchTurn key={turn.id} turn={turn} search={search} open={open} select={select} />
        ))}
        <div className="chat-spacer" />
      </main>
      <div className="composer-dock">
        <form className="composer" onSubmit={submit}>
          <ServiceSuggestions
            state={suggestions.state}
            id={suggestions.listId}
            placement="chat"
            select={selectSuggestion}
            activate={suggestions.activate}
            input={suggestions.input}
            loadMore={suggestions.loadMore}
          />
          <label className="sr-only" htmlFor="service-query">
            Nome do serviço ou do órgão
          </label>
          <textarea
            {...suggestions.inputProps}
            id="service-query"
            rows={1}
            maxLength={300}
            value={state.draft}
            placeholder="Busque um serviço ou órgão…"
            onChange={(event) => {
              dispatch({ type: 'draft', value: event.target.value })
              suggestions.update(event.target.value)
            }}
            onFocus={() => suggestions.update(state.draft)}
            onKeyDown={(event) => {
              if (suggestions.keyDown(event, selectSuggestion)) return

              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                suggestions.dismiss()
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
          Projeto independente. Confirme as informações nos links oficiais. Não insira dados
          pessoais.
        </p>
      </div>
    </div>
  )
}
