import { useEffect, useState, type FormEvent } from 'react'
import { Header } from '../layout/site-header'
import { InputAccessories } from '../input-accessories'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { navigate } from '../../routes/navigation'
import { useServiceSuggestions } from '../../hooks/use-service-suggestions'
import { ServiceSuggestions } from '../services/service-suggestions'
import type { ServiceSummary } from '../../lib/services/model'

const SLIDES = [
  { key: 'lencois', caption: 'Lençóis Maranhenses, MA', q: 'Como tirar o passaporte?' },
  { key: 'veadeiros', caption: 'Chapada dos Veadeiros, GO', q: 'Cartão Nacional de Saúde' },
  { key: 'rio', caption: 'Rio de Janeiro, RJ', q: 'Microempreendedor individual' },
  { key: 'iguacu', caption: 'Cataratas do Iguaçu, PR', q: 'Imposto de Renda' },
  { key: 'chapada', caption: 'Chapada Diamantina, BA', q: 'Aposentadoria' },
  { key: 'pantanal', caption: 'Pantanal, MT', q: 'Bolsa Família' },
  { key: 'noronha', caption: 'Fernando de Noronha, PE', q: 'Carteira Nacional de Habilitação' },
]

const ask = (q: string) => navigate(`/chat?q=${encodeURIComponent(q)}`)

export function Hero() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [value, setValue] = useState('')
  const suggestions = useServiceSuggestions()

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [playing])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    suggestions.dismiss()
    ask(value.trim() || SLIDES[i].q)
  }

  function selectSuggestion(service: ServiceSummary) {
    suggestions.dismiss()
    setValue(service.name)
    navigate(
      `/chat?service=${encodeURIComponent(service.id)}&q=${encodeURIComponent(service.name)}`,
    )
  }

  const tries = SLIDES.map((s) => `Experimente “${s.q}”`)

  return (
    <section className="hero-wrap">
      <div className="hero">
        <Header />
        <h1 className="display">Olá, Brasil</h1>
        <p className="lead">Tudo o que você precisa do governo, começa aqui.</p>

        <div className="stage">
          {SLIDES.map((s, idx) => (
            <img
              key={s.key}
              src={`/img/${s.key}.jpg`}
              alt={s.caption}
              className={`slide ${idx === i ? 'on' : ''}`}
              loading={idx === 0 ? 'eager' : 'lazy'}
            />
          ))}
          <div className="stage-shade" />
          <form className="hero-search" onSubmit={submit}>
            <div className="hero-input">
              <input
                {...suggestions.inputProps}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value)
                  suggestions.update(event.target.value)
                }}
                onFocus={() => suggestions.update(value)}
                onKeyDown={(event) => suggestions.keyDown(event, selectSuggestion)}
                aria-label="Faça uma pergunta"
                maxLength={300}
              />
              {!value && (
                <div className="marquee" aria-hidden>
                  <div className="marquee-track">
                    {[...tries, ...tries].map((t, k) => (
                      <span key={k}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <ServiceSuggestions
              state={suggestions.state}
              id={suggestions.listId}
              placement="home"
              select={selectSuggestion}
              activate={suggestions.activate}
              input={suggestions.input}
              loadMore={suggestions.loadMore}
            />
            <div className="hero-actions">
              <InputAccessories />
              <button type="submit" className={`send ${value ? 'ready' : ''}`} aria-label="Enviar">
                <ArrowRight size={20} aria-hidden="true" />
              </button>
            </div>
          </form>
          <span className="caption">{SLIDES[i].caption}</span>
        </div>

        <div className="controls">
          <button
            onClick={() => setI((x) => (x - 1 + SLIDES.length) % SLIDES.length)}
            aria-label="Anterior"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pausar' : 'Reproduzir'}
          >
            {playing ? (
              <Pause size={20} aria-hidden="true" />
            ) : (
              <Play size={20} aria-hidden="true" />
            )}
          </button>
          <button onClick={() => setI((x) => (x + 1) % SLIDES.length)} aria-label="Próxima">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  )
}
