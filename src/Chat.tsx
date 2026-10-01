import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ANSWERS, CATEGORIES, QUESTION_COUNT, SUGGESTED, findAnswer, suggest, type Answer } from './data'
import { Header, Icon, Toast, useToast } from './ui'

type Msg =
  | { role: 'user'; text: string }
  | { role: 'bot'; answers: Answer[]; related: Answer[]; query: string }

const byId = (id: string) => ANSWERS.find((a) => a.id === id)!

function BotAnswer({ m, onAsk, onToast, animate }: { m: Extract<Msg, { role: 'bot' }>; onAsk: (q: string) => void; onToast: (s: string) => void; animate: boolean }) {
  const { answers, related } = m
  const answer = answers[0] ?? null
  const blocks: React.ReactNode[] = []
  const multi = answers.length > 1

  if (multi) blocks.push(<p key="intro">Sua pergunta tem {answers.length} partes. Vamos por partes:</p>)
  answers.forEach((a, ai) => {
    const k = (s: string) => `${a.id}-${s}`
    if (multi) blocks.push(<h2 key={k('t')} className="part-title">{a.question}</h2>)
    blocks.push(<p key={k('s')}>{a.summary}</p>)
    if (a.steps?.length) {
      blocks.push(<h3 key={k('h')}>Passo a passo</h3>)
      a.steps.forEach((st, n) =>
        blocks.push(
          <li key={k(`st${n}`)} className="step">
            {st}
          </li>,
        ),
      )
    }
    if (a.note) {
      blocks.push(<h3 key={k('nh')}>Bom saber</h3>)
      blocks.push(<p key={k('n')}>{a.note}</p>)
    }
    blocks.push(
      <div key={k('src')} className="sources">
        <span>Fontes</span>
        {a.sources.map((src) => (
          <a
            key={src.name}
            href="#"
            onClick={(e) => {
              e.preventDefault()
              onToast('Link fictício: este é um protótipo')
            }}
          >
            {src.name}
            <Icon.Ext />
          </a>
        ))}
      </div>,
    )
    if (multi && ai < answers.length - 1) blocks.push(<hr key={k('hr')} />)
  })
  if (!answers.length) {
    blocks.push(
      <p key="nf">
        Ainda não tenho uma resposta para “{m.query}”. Este protótipo responde a um conjunto fixo de perguntas sobre documentos,
        impostos, saúde, trabalho, previdência, benefícios, eleições, empresas, trânsito e viagens.
      </p>,
    )
    blocks.push(<h3 key="nh">Talvez você queira saber</h3>)
  }

  const more = [...related, ...SUGGESTED.map(byId)]
    .filter((a, i, arr) => !answers.includes(a) && arr.indexOf(a) === i)
    .slice(0, 3)

  // reveal blocks one by one, like a streaming answer
  const [shown, setShown] = useState(animate ? 0 : blocks.length)
  useEffect(() => {
    if (shown >= blocks.length) return
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 650 : 140)
    return () => clearTimeout(t)
  }, [shown, blocks.length])

  if (shown === 0)
    return (
      <div className="thinking" aria-live="polite">
        <span />
        <span />
        <span />
        Consultando fontes oficiais…
      </div>
    )

  const visible = blocks.slice(0, shown)
  const out: React.ReactNode[] = []
  let list: React.ReactNode[] = []
  visible.forEach((b, k) => {
    const isStep = (b as React.ReactElement).props && (b as React.ReactElement<{ className?: string }>).props.className === 'step'
    if (isStep) list.push(b)
    else {
      if (list.length) out.push(<ul key={`ul${k}`}>{list}</ul>)
      list = []
      out.push(b)
    }
  })
  if (list.length) out.push(<ul key="ul-end">{list}</ul>)
  const done = shown >= blocks.length

  return (
    <div className="answer">
      {out}
      {done && (
        <>
          <div className="related">
            {answer && <h3>Perguntas relacionadas</h3>}
            {more.map((a) => (
              <button key={a.id} onClick={() => onAsk(a.question)}>
                {a.question}
                <Icon.Arrow />
              </button>
            ))}
          </div>
          {answer && (
            <div className="answer-tools">
              <button
                aria-label="Copiar"
                onClick={() => {
                  navigator.clipboard?.writeText(`${answer.question}\n\n${answer.summary}\n\n${(answer.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`)
                  onToast('Resposta copiada')
                }}
              >
                <Icon.Copy />
              </button>
              <button aria-label="Útil" onClick={() => onToast('Obrigado pelo retorno!')}>
                <Icon.Up />
              </button>
              <button aria-label="Não útil" onClick={() => onToast('Obrigado, vamos melhorar')}>
                <Icon.Down />
              </button>
              <small>Respostas fictícias, geradas para demonstração</small>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function Chat() {
  const initial = new URLSearchParams(window.location.search).get('q') ?? ''
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [value, setValue] = useState('')
  const [cat, setCat] = useState<string>('documentos')
  const [active, setActive] = useState(-1)
  const sugg = useMemo(() => suggest(value), [value])
  const [toast, showToast] = useToast()
  const bottom = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const started = useRef(false)

  const ask = (q: string) => {
    const text = q.trim()
    if (!text) return
    const { best, related } = findAnswer(text)
    setMsgs((m) => [...m, { role: 'user', text }, { role: 'bot', answers: best, related, query: text }])
    setActive(-1)
    setValue('')
    const url = `/chat?q=${encodeURIComponent(text)}`
    window.history.replaceState({}, '', url)
  }

  useEffect(() => {
    document.title = 'Pergunte · Brasil.gov'
    if (initial && !started.current) {
      started.current = true
      ask(initial)
    }
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80)
    return () => clearTimeout(t)
  }, [msgs])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(value)
  }

  return (
    <div className="chat-page">
      <Header light />
      <main className="chat">
        {msgs.length === 0 && (
          <div className="empty">
            <h1 className="display-md">Como podemos ajudar?</h1>
            <p className="lead">
              Pergunte sobre qualquer serviço público. São {ANSWERS.length} temas e mais de {Math.floor(QUESTION_COUNT / 100) * 100} jeitos de perguntar.
            </p>
            <div className="cats">
              {CATEGORIES.map((c) => (
                <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
            <div className="cat-qs">
              {ANSWERS.filter((a) => a.category === cat).map((a) => (
                <button key={a.id} onClick={() => ask(a.question)}>
                  {a.question}
                  <Icon.Arrow />
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, k) =>
          m.role === 'user' ? (
            <div key={k} className="bubble">
              {m.text}
            </div>
          ) : (
            <BotAnswer key={k} m={m} onAsk={ask} onToast={showToast} animate={k === msgs.length - 1} />
          ),
        )}
        <div ref={bottom} className="chat-spacer" />
      </main>

      <form className="composer" onSubmit={submit}>
        {sugg.length > 0 && (
          <ul className="typeahead" role="listbox">
            {sugg.map((h, i) => (
              <li key={h.doc.id} role="option" aria-selected={i === active}>
                <button type="button" className={i === active ? 'on' : ''} onMouseEnter={() => setActive(i)} onClick={() => ask(h.doc.question)}>
                  <span>{h.doc.question}</span>
                  {h.phrase !== h.doc.question && <small>“{h.phrase}”</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          placeholder="Pergunte qualquer coisa..."
          onChange={(e) => {
            setValue(e.target.value)
            setActive(-1)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' && sugg.length) {
              e.preventDefault()
              setActive((i) => (i + 1) % sugg.length)
            } else if (e.key === 'ArrowUp' && sugg.length) {
              e.preventDefault()
              setActive((i) => (i <= 0 ? sugg.length - 1 : i - 1))
            } else if (e.key === 'Escape') setActive(-1)
            else if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(active >= 0 && sugg[active] ? sugg[active].doc.question : value)
            }
          }}
        />
        <button type="button" className="icon-btn" onClick={() => showToast('Envio de arquivos chega em breve')} aria-label="Anexar">
          <Icon.Clip />
        </button>
        <button type="button" className="icon-btn" onClick={() => showToast('Busca por voz chega em breve')} aria-label="Falar">
          <Icon.Mic />
        </button>
        <button type="submit" className="send ready" aria-label="Enviar">
          <Icon.Arrow />
        </button>
      </form>
      <p className="composer-note">Protótipo com respostas fictícias. Não insira dados pessoais.</p>
      <Toast text={toast} />
    </div>
  )
}
