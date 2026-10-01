import { Cpu, Download, Play, Square, Trash2 } from 'lucide-react'
import { Header } from '../components/layout/site-header'
import { useLocalModel } from '../hooks/use-local-model'
import { MAX_PROMPT_LENGTH, MODEL_NAME } from '../lib/local-model/config'
import '../styles/local-model.css'

const CACHE_LABELS = {
  present: 'Arquivos do modelo encontrados no cache.',
  absent: 'O modelo ainda não está salvo neste navegador.',
  unknown: 'Não foi possível confirmar o cache do modelo.',
}

export default function LocalModelPage() {
  const { state, dispatch, inspect, load, clear, generate, release } = useLocalModel()
  const busy = ['checking', 'loading', 'generating', 'clearing'].includes(state.phase)
  const ready = state.phase === 'ready'
  const supported = state.support?.supported
  const progress =
    state.progress && Number.isFinite(state.progress.progress)
      ? Math.round(Math.min(1, Math.max(0, state.progress.progress)) * 100)
      : undefined

  return (
    <>
      <Header light />
      <main className="model-page">
        <div className="model-heading">
          <Cpu size={28} aria-hidden="true" />
          <div>
            <h1>Teste do modelo local</h1>
            <p>Uma resposta gerada no seu aparelho, sem consultar o catálogo de serviços.</p>
          </div>
        </div>

        <section className="model-panel" aria-labelledby="model-title">
          <h2 id="model-title">{MODEL_NAME}</h2>
          <p>
            O primeiro carregamento baixa cerca de 400 MB. Reserve aproximadamente 1,5 GB de memória
            disponível; o uso varia conforme o aparelho.
          </p>
          <p>
            Os arquivos vêm do Hugging Face e do projeto MLC. A pergunta e a resposta ficam neste
            navegador. O modelo só é baixado quando você escolhe carregar.
          </p>
          <p className="model-cache">
            {CACHE_LABELS[state.cached]} O navegador pode remover arquivos para liberar espaço.
          </p>

          {state.phase === 'checking' && <p role="status">Verificando compatibilidade e cache…</p>}
          {state.support && !supported && (
            <p role="status">
              {state.support.reason} A busca de serviços continua disponível no chat.
            </p>
          )}
          {state.phase === 'loading' && (
            <div className="model-progress">
              <label htmlFor="model-progress">
                Carregando modelo{progress !== undefined ? ` · ${progress}%` : '…'}
              </label>
              <progress id="model-progress" max={100} value={progress} />
              <p role="status">{state.progress?.text ?? 'Preparando o download e a execução…'}</p>
            </div>
          )}
          {state.phase === 'clearing' && <p role="status">Removendo arquivos do modelo…</p>}
          {ready && <p role="status">Modelo carregado. Você já pode gerar uma resposta.</p>}
          {state.error && (
            <div className="model-error" role="alert">
              <p>
                Não foi possível concluir a operação. Confira a conexão, o espaço livre e a memória
                do aparelho.
              </p>
              <details>
                <summary>Detalhes do erro</summary>
                <p>{state.error}</p>
              </details>
            </div>
          )}

          <div className="model-actions">
            <button
              className="model-button primary"
              onClick={() => void load()}
              disabled={busy || ready || supported !== true}
            >
              <Download size={18} aria-hidden="true" />
              {state.cached === 'present' ? 'Carregar do cache' : 'Carregar modelo'}
            </button>
            {(state.phase === 'loading' || state.phase === 'generating' || ready) && (
              <button className="model-button" onClick={release}>
                <Square size={18} aria-hidden="true" />
                {busy ? 'Cancelar e liberar memória' : 'Liberar memória'}
              </button>
            )}
            {!ready && (
              <button className="model-button" onClick={() => void inspect()} disabled={busy}>
                Verificar novamente
              </button>
            )}
            <button
              className="model-button"
              onClick={() => void clear()}
              disabled={busy || state.cached === 'absent'}
            >
              <Trash2 size={18} aria-hidden="true" />
              Remover modelo do cache
            </button>
          </div>
          <p className="model-note">
            Cancelar encerra a execução; arquivos já baixados podem permanecer no cache. Liberar
            memória preserva o download para o próximo uso.
          </p>
        </section>

        <form
          className="model-panel"
          onSubmit={(event) => {
            event.preventDefault()
            void generate()
          }}
        >
          <label htmlFor="model-prompt">Pergunta de teste</label>
          <textarea
            id="model-prompt"
            value={state.prompt}
            maxLength={MAX_PROMPT_LENGTH}
            rows={4}
            disabled={busy}
            onChange={(event) => dispatch({ type: 'prompt', value: event.target.value })}
          />
          <p className="model-note">
            Este teste não usa dados oficiais e pode produzir informações incorretas.
          </p>
          <button
            type="submit"
            className="model-button primary"
            disabled={!ready || !state.prompt.trim()}
          >
            <Play size={18} aria-hidden="true" />
            Gerar resposta de teste
          </button>
          {state.phase === 'generating' && <p role="status">Gerando no seu aparelho…</p>}
        </form>

        {state.answer && (
          <section className="model-panel" aria-labelledby="model-answer-title">
            <h2 id="model-answer-title">Resposta do modelo</h2>
            <p className="model-answer">{state.answer.text}</p>
            <p className="model-note">
              {(state.answer.elapsedMs / 1000).toFixed(1)} s · {state.answer.tokens} tokens gerados
              {state.answer.truncated ? ' · Resposta interrompida no limite do teste.' : ''}
            </p>
          </section>
        )}
      </main>
    </>
  )
}
