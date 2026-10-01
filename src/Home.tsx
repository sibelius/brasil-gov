import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Header, Icon, OfficialBanner, REPO, Reveal, Toast, navigate, useToast } from './ui'
import credits from './credits.json'
import type { Hit } from './search'
import type { Answer } from './data'

const SLIDES = [
  { key: 'lencois', caption: 'Lençóis Maranhenses, MA', q: 'Como tirar o passaporte?' },
  { key: 'veadeiros', caption: 'Chapada dos Veadeiros, GO', q: 'Como faço o Cartão do SUS?' },
  { key: 'rio', caption: 'Rio de Janeiro, RJ', q: 'Como abrir um MEI?' },
  { key: 'iguacu', caption: 'Cataratas do Iguaçu, PR', q: 'Quem precisa declarar o Imposto de Renda?' },
  { key: 'chapada', caption: 'Chapada Diamantina, BA', q: 'Quando posso me aposentar pelo INSS?' },
  { key: 'pantanal', caption: 'Pantanal, MT', q: 'Como me inscrevo no Bolsa Família?' },
  { key: 'noronha', caption: 'Fernando de Noronha, PE', q: 'Como renovar a CNH?' },
]

const ask = (q: string) => navigate(`/chat?q=${encodeURIComponent(q)}`)

function Hero() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [value, setValue] = useState('')
  const [toast, showToast] = useToast()
  const [sugg, setSugg] = useState<Hit<Answer>[]>([])
  const [active, setActive] = useState(-1)
  const suggestFn = useRef<((q: string) => Hit<Answer>[]) | null>(null)

  // load the Q&A bank the first time the user focuses the search
  const warm = () => {
    if (!suggestFn.current) import('./data').then((m) => (suggestFn.current = m.suggest))
  }
  useEffect(() => {
    setSugg(suggestFn.current ? suggestFn.current(value).slice(0, 5) : [])
    setActive(-1)
  }, [value])

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [playing])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(active >= 0 && sugg[active] ? sugg[active].doc.question : value.trim() || SLIDES[i].q)
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
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={warm}
                onMouseEnter={warm}
                onKeyDown={(e) => {
                  if (!sugg.length) return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActive((x) => (x + 1) % sugg.length)
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((x) => (x <= 0 ? sugg.length - 1 : x - 1))
                  }
                }}
                aria-label="Faça uma pergunta"
                autoComplete="off"
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
            {sugg.length > 0 && (
              <ul className="hero-sugg" role="listbox">
                {sugg.map((h, k) => (
                  <li key={h.doc.id}>
                    <button type="button" className={k === active ? 'on' : ''} onMouseEnter={() => setActive(k)} onClick={() => ask(h.doc.question)}>
                      {h.doc.question}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="hero-actions">
              <button type="button" className="icon-btn" onClick={() => showToast('Envio de arquivos chega em breve')} aria-label="Anexar">
                <Icon.Clip />
              </button>
              <button type="button" className="icon-btn" onClick={() => showToast('Busca por voz chega em breve')} aria-label="Falar">
                <Icon.Mic />
              </button>
              <button type="submit" className={`send ${value ? 'ready' : ''}`} aria-label="Enviar">
                <Icon.Arrow />
              </button>
            </div>
          </form>
          <span className="caption">{SLIDES[i].caption}</span>
        </div>

        <div className="controls">
          <button onClick={() => setI((x) => (x - 1 + SLIDES.length) % SLIDES.length)} aria-label="Anterior">
            <Icon.Prev />
          </button>
          <button onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pausar' : 'Reproduzir'}>
            {playing ? <Icon.Pause /> : <Icon.Play />}
          </button>
          <button onClick={() => setI((x) => (x + 1) % SLIDES.length)} aria-label="Próxima">
            <Icon.Next />
          </button>
        </div>
      </div>
      <Toast text={toast} />
    </section>
  )
}

const SITES = [
  { org: 'Receita Federal', title: 'Declare seu Imposto de Renda', c: '#0b3d91' },
  { org: 'INSS', title: 'Meu INSS: pedidos e extratos', c: '#1f5aa6' },
  { org: 'Ministério da Saúde', title: 'Campanha de vacinação 2026', c: '#0a7d4f' },
  { org: 'Polícia Federal', title: 'Passaporte: agende seu atendimento', c: '#132c5a' },
  { org: 'Caixa', title: 'Consulte seu FGTS', c: '#005ca9' },
  { org: 'Justiça Eleitoral', title: 'Regularize seu título', c: '#5b2a86' },
  { org: 'Detran', title: 'Renovação de CNH', c: '#c0392b' },
  { org: 'MEC', title: 'Inscrições do Enem', c: '#1d6fa5' },
  { org: 'Portal do Empreendedor', title: 'Seja MEI em minutos', c: '#2e7d32' },
  { org: 'Correios', title: 'Rastreie sua encomenda', c: '#e4a400' },
  { org: 'IBGE', title: 'Censo e estatísticas', c: '#0f4c81' },
  { org: 'Ministério do Trabalho', title: 'Carteira de Trabalho Digital', c: '#7a4b00' },
  { org: 'Anvisa', title: 'Consulta de medicamentos', c: '#0b6e75' },
  { org: 'Itamaraty', title: 'Serviços consulares', c: '#283593' },
  { org: 'MDS', title: 'Cadastro Único', c: '#ad1457' },
  { org: 'Prefeitura', title: 'IPTU 2027: segunda via', c: '#37474f' },
]

function Collage() {
  return (
    <div className="collage" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className={`collage-row r${row}`}>
          {[...SITES, ...SITES].slice(row * 5, row * 5 + 16).map((s, k) => (
            <div key={k} className="mini-site">
              <div className="mini-bar" style={{ background: s.c }}>
                <i />
                <b>{s.org}</b>
              </div>
              <div className="mini-body">
                <strong>{s.title}</strong>
                <span />
                <span />
                <span className="short" />
                <em style={{ background: s.c }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const SEALS = [
  { a: 'RFB', n: 'Receita Federal', c: '#0b3d91' },
  { a: 'INSS', n: 'Previdência Social', c: '#1f5aa6' },
  { a: 'SUS', n: 'Sistema Único de Saúde', c: '#0a7d4f' },
  { a: 'PF', n: 'Polícia Federal', c: '#132c5a' },
  { a: 'TSE', n: 'Justiça Eleitoral', c: '#5b2a86' },
  { a: 'MEC', n: 'Educação', c: '#1d6fa5' },
  { a: 'MTE', n: 'Trabalho e Emprego', c: '#7a4b00' },
  { a: 'MDS', n: 'Desenvolvimento Social', c: '#ad1457' },
  { a: 'IBGE', n: 'Geografia e Estatística', c: '#0f4c81' },
]

function Seal({ a, n, c }: { a: string; n: string; c: string }) {
  const id = `arc-${a}`
  return (
    <div className="seal">
      <svg viewBox="0 0 120 120">
        <defs>
          <path id={id} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
        </defs>
        <circle cx="60" cy="60" r="56" fill="#fff" />
        <circle cx="60" cy="60" r="52" fill="none" stroke={c} strokeWidth="2" />
        <circle cx="60" cy="60" r="34" fill={c} />
        <text fontSize="9.5" letterSpacing="1.6" fill={c} fontWeight="600">
          <textPath href={`#${id}`} startOffset="2%">
            {`${n.toUpperCase()} • BRASIL •`}
          </textPath>
        </text>
        <text x="60" y="65" textAnchor="middle" fill="#fff" fontSize={a.length > 3 ? 14 : 17} fontWeight="700" fontFamily="Newsreader, serif">
          {a}
        </text>
      </svg>
    </div>
  )
}

function Devices() {
  return (
    <div className="devices" aria-hidden>
      <div className="device-tray">
        <div className="device-tile">
          <svg viewBox="0 0 48 48" width="56">
            <rect x="14" y="4" width="20" height="40" rx="4" fill="none" stroke="#0b1f4d" strokeWidth="2.6" />
            <rect x="20" y="8" width="8" height="2" rx="1" fill="#0b1f4d" />
          </svg>
          <span>Celular</span>
        </div>
        <div className="device-tile">
          <svg viewBox="0 0 48 48" width="56">
            <rect x="8" y="5" width="32" height="38" rx="4" fill="none" stroke="#009c3b" strokeWidth="2.6" />
            <circle cx="24" cy="38.5" r="1.6" fill="#009c3b" />
          </svg>
          <span>Tablet</span>
        </div>
        <div className="device-tile">
          <svg viewBox="0 0 48 48" width="56">
            <rect x="8" y="10" width="32" height="22" rx="2.5" fill="none" stroke="#e0a800" strokeWidth="2.6" />
            <path d="M3 37h42" stroke="#e0a800" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
          <span>Computador</span>
        </div>
      </div>
    </div>
  )
}

function Feature({
  id,
  visual,
  title,
  body,
  cta,
  onCta,
}: {
  id?: string
  visual: React.ReactNode
  title: React.ReactNode
  body: string
  cta: string
  onCta?: () => void
}) {
  return (
    <section className="feature" id={id}>
      <Reveal>
        <div className="feature-visual">{visual}</div>
      </Reveal>
      <Reveal className="feature-text">
        <h2>{title}</h2>
        <p>{body}</p>
        <button className="text-link" onClick={onCta}>
          {cta}
        </button>
      </Reveal>
    </section>
  )
}

function UpcomingCards() {
  return (
    <div className="upcoming" aria-hidden>
      <div className="up-track">
        <div className="up-card">
          <h4>Agende no Poupatempo mais perto</h4>
          {[
            ['Poupatempo Sé', 'Pça. do Carmo, s/n, São Paulo'],
            ['Poupatempo Lapa', 'R. Catão, 72, São Paulo'],
            ['Poupatempo Itaquera', 'Av. do Contorno, 60, São Paulo'],
          ].map(([n, a]) => (
            <div className="up-row" key={n}>
              <div className="up-thumb" />
              <div>
                <b>{n}</b>
                <small>{a}</small>
              </div>
              <span className="pill">Escolher</span>
            </div>
          ))}
        </div>

        <div className="up-card">
          <h4>Confirme sua foto</h4>
          <div className="photo-confirm">
            <div className="avatar">
              <svg viewBox="0 0 64 64">
                <rect width="64" height="64" fill="#d7dbe0" />
                <circle cx="32" cy="25" r="11" fill="#9aa3ad" />
                <path d="M10 64c2-14 11-21 22-21s20 7 22 21z" fill="#9aa3ad" />
              </svg>
            </div>
            <div className="doc-lines">
              <b>SILVA</b>
              <b>MARIA EDUARDA</b>
              <small>CPF 000.000.000-00</small>
            </div>
          </div>
          <span className="pill ghost">Emitir CIN digital</span>
        </div>

        <div className="up-card wide">
          <h4>Compare preços de remédios</h4>
          <div className="fake-input">Buscar medicamento</div>
          <div className="med">
            <div className="med-head">
              <b>Losartana potássica</b>
              <small>Remover</small>
            </div>
            <div className="med-row">
              <small>Forma</small>
              <span className="seg on">Comprimido</span>
              <span className="seg">Solução</span>
            </div>
            <div className="med-row">
              <small>Dose</small>
              <span className="seg on">50 mg</span>
              <span className="seg">100 mg</span>
            </div>
            <div className="med-row">
              <small>Farmácia Popular</small>
              <span className="seg on free">Grátis</span>
            </div>
          </div>
        </div>

        <div className="up-card">
          <h4>Atualize seu nome em todos os órgãos</h4>
          {['Receita Federal', 'Justiça Eleitoral', 'INSS', 'Detran'].map((o, k) => (
            <label className="check-row" key={o}>
              <span>{o}</span>
              <i className={k < 2 ? 'on' : ''} />
            </label>
          ))}
          <span className="pill ghost">Alterar nome</span>
        </div>

        <div className="up-card dashed">
          <span className="drop">Arraste seu currículo aqui</span>
          <div className="pdf">
            <em>PDF</em> curriculo_2026.pdf
          </div>
          <small>Vagas do Sine compatíveis com seu perfil</small>
        </div>

        <div className="up-card">
          <h4>Acompanhe seus pedidos</h4>
          {[
            ['Passaporte', 'Pronto para retirada', 100],
            ['Restituição IR', '3º lote · 30/07', 70],
            ['Aposentadoria', 'Em análise', 35],
          ].map(([n, s, p]) => (
            <div className="track-row" key={n as string}>
              <div className="track-top">
                <b>{n}</b>
                <small>{s}</small>
              </div>
              <div className="bar">
                <i style={{ width: `${p}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Footer() {
  const [showCredits, setShowCredits] = useState(false)
  const links = [
    ['Como funciona', '#como-funciona'],
    ['Privacidade', '#privacidade'],
    ['Fontes', '#fontes'],
    ['Em breve', '#em-breve'],
    ['Fazer uma pergunta', '/chat'],
    ['Conserte o Brasil', REPO],
  ]
  return (
    <footer className="footer">
      <nav className="footer-links">
        {links.map(([l, h]) => (
          <a
            key={l}
            href={h}
            {...(h.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
            onClick={(e) => {
              if (h.startsWith('/')) {
                e.preventDefault()
                navigate(h)
              }
            }}
          >
            {l}
          </a>
        ))}
      </nav>
      <div className="wordmark">Brasil.gov</div>
      <p className="footer-small">
        Um protótipo conceitual
        <br />
        com dados fictícios
      </p>
      <p className="footer-tag">Todos os órgãos, trabalhando juntos</p>
      <div className="footer-legal">
        <button onClick={() => setShowCredits((v) => !v)}>Créditos das fotos</button>
        <span>Português (Brasil)</span>
      </div>
      {showCredits && (
        <ul className="credits">
          {credits.map((c) => (
            <li key={c.key}>
              <a href={c.page} target="_blank" rel="noreferrer">
                {c.title.replace('File:', '').replace(/\.jpg$/i, '')}
              </a>{' '}
              · {c.artist} · {c.license} · Wikimedia Commons
            </li>
          ))}
        </ul>
      )}
      <p className="footer-made">Feito no Brasil, com café</p>
    </footer>
  )
}

export default function Home() {
  const howRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    document.title = 'Brasil.gov · Tudo o que você precisa do governo, começa aqui'
    if (window.location.hash) {
      setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView(), 50)
    }
  }, [])
  return (
    <>
      <OfficialBanner />
      <Hero />
      <main ref={howRef}>
        <Feature
          id="como-funciona"
          visual={<Collage />}
          title={
            <>
              5.400 sites
              <br />
              em um só.
            </>
          }
          body="Chega de pular de site em site. O Brasil.gov reúne os serviços de ministérios, autarquias, estados e prefeituras em um só lugar."
          cta="Veja como funciona"
          onCta={() => ask('Como subo minha conta gov.br para o nível ouro?')}
        />
        <Feature
          id="privacidade"
          visual={
            <div className="lock-wrap">
              <div className="lock">
                <Icon.Lock />
              </div>
            </div>
          }
          title={
            <>
              O Brasil.gov mantém
              <br />
              seus dados privados.
            </>
          }
          body="Suas informações pessoais não são coletadas nem armazenadas, e a conversa desaparece quando você sai. Em conformidade com a LGPD."
          cta="Saiba mais sobre privacidade"
        />
        <Feature
          id="fontes"
          visual={
            <div className="seals">
              {SEALS.map((s) => (
                <Seal key={s.a} {...s} />
              ))}
            </div>
          }
          title={
            <>
              Respostas claras.
              <br />
              Fontes oficiais.
            </>
          }
          body="Cada resposta vem exclusivamente de sites federais, estaduais e municipais."
          cta="Saiba mais sobre as fontes"
        />
        <Feature
          visual={<Devices />}
          title="Nada para baixar."
          body="É só abrir o Brasil.gov no navegador do celular, do tablet ou do computador."
          cta="Faça uma pergunta"
          onCta={() => navigate('/chat')}
        />

        <section className="coming" id="em-breve">
          <Reveal>
            <h2 className="display-md">Mais novidades em 2027</h2>
            <p className="lead">
              Indo além das respostas: você vai poder preencher formulários, acompanhar pedidos e organizar tudo em um só lugar.
            </p>
            <button className="pill-btn" disabled>
              Veja o que vem por aí
            </button>
          </Reveal>
          <UpcomingCards />
        </section>

        <section className="contribute" id="contribua">
          <Reveal className="contribute-card">
            <Icon.Github />
            <h2 className="display-md">Conserte o Brasil</h2>
            <p className="lead">
              O Brasil.gov é aberto. Achou uma resposta errada, um prazo desatualizado ou tem uma ideia? Abra uma issue ou mande um
              pull request.
            </p>
            <div className="contribute-actions">
              <a className="cta" href={REPO} target="_blank" rel="noreferrer">
                Contribuir no GitHub
                <Icon.Arrow />
              </a>
              <a className="cta ghost" href={`${REPO}/issues/new`} target="_blank" rel="noreferrer">
                Reportar um erro
              </a>
            </div>
          </Reveal>
        </section>
      </main>
      <Footer />
    </>
  )
}
