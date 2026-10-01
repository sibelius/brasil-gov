import { useEffect, useRef, useState, type ReactNode } from 'react'

export const navigate = (to: string) => {
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

export function Flag({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 40 28" aria-hidden className="flag">
      <rect width="40" height="28" rx="2" fill="#009c3b" />
      <path d="M20 3.2 36.4 14 20 24.8 3.6 14Z" fill="#ffdf00" />
      <circle cx="20" cy="14" r="6.4" fill="#002776" />
      <path d="M13.8 12.6c4.2-.9 8.7-.2 12.1 2.1" stroke="#fff" strokeWidth="1.1" fill="none" />
    </svg>
  )
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <a
      href="/"
      className="logo"
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
        navigate('/')
      }}
    >
      <Flag />
      <span>Brasil.gov</span>
    </a>
  )
}

export function OfficialBanner() {
  const [open, setOpen] = useState(false)
  return (
    <div className="banner">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Protótipo conceitual · não é um site oficial do governo brasileiro
        <Icon.Info />
      </button>
      {open && (
        <p className="banner-detail">
          Este é um exercício de design inspirado no America.gov. Todas as respostas, valores e prazos são fictícios e
          servem apenas para demonstração. Para serviços reais, procure os canais oficiais de cada órgão.
        </p>
      )}
    </div>
  )
}

const MENU = [
  { label: 'Fazer uma pergunta', to: '/chat' },
  { label: 'Como funciona', to: '/#como-funciona' },
  { label: 'Privacidade', to: '/#privacidade' },
  { label: 'Fontes', to: '/#fontes' },
  { label: 'Em breve', to: '/#em-breve' },
]

export function Header({ light = false }: { light?: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
  }, [open])
  return (
    <>
      <header className={`header ${light ? 'header-light' : ''}`}>
        <Logo />
        <button className="menu-btn" onClick={() => setOpen(true)}>
          Menu
        </button>
      </header>
      {open && (
        <div className="menu-overlay" role="dialog" aria-modal>
          <div className="menu-top">
            <Logo onClick={() => setOpen(false)} />
            <button className="menu-btn" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
          <nav className="menu-links">
            {MENU.map((m, i) => (
              <a
                key={m.to}
                href={m.to}
                style={{ animationDelay: `${i * 50}ms` }}
                onClick={(e) => {
                  e.preventDefault()
                  setOpen(false)
                  const [path, hash] = m.to.split('#')
                  navigate(path || '/')
                  if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 60)
                }}
              >
                {m.label}
              </a>
            ))}
          </nav>
        </div>
      )}
    </>
  )
}

export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`reveal ${shown ? 'in' : ''} ${className}`}>
      {children}
    </div>
  )
}

export function Toast({ text }: { text: string | null }) {
  return <div className={`toast ${text ? 'show' : ''}`}>{text}</div>
}

export function useToast() {
  const [text, setText] = useState<string | null>(null)
  const t = useRef<number>(0)
  const show = (s: string) => {
    setText(s)
    clearTimeout(t.current)
    t.current = window.setTimeout(() => setText(null), 2200)
  }
  return [text, show] as const
}

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const Icon = {
  Info: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" {...s}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  ),
  Clip: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...s} strokeWidth={2}>
      <path d="M9 7v9a3 3 0 0 0 6 0V6a2 2 0 0 0-4 0v9" />
    </svg>
  ),
  Mic: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" {...s} strokeWidth={2}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
    </svg>
  ),
  Arrow: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" {...s} strokeWidth={2.4}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Ext: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" {...s} strokeWidth={2.2}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  ),
  Prev: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s} strokeWidth={2.4}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  ),
  Next: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s} strokeWidth={2.4}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  Play: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  ),
  Pause: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4.5" width="4" height="15" rx="1" />
      <rect x="14" y="4.5" width="4" height="15" rx="1" />
    </svg>
  ),
  Lock: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 10V7a5 5 0 0 1 9.6-2" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="4.5" y="10" width="15" height="11" rx="2.2" />
      <rect x="11" y="13.5" width="2" height="4" rx="1" fill="#fff" />
    </svg>
  ),
  Copy: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  ),
  Up: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <path d="M7 10v11M3 10h4l4-7a2 2 0 0 1 2 2v4h6a2 2 0 0 1 2 2.3l-1.4 7A2 2 0 0 1 17.6 21H7" />
    </svg>
  ),
  Down: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" {...s}>
      <path d="M17 14V3M21 14h-4l-4 7a2 2 0 0 1-2-2v-4H5a2 2 0 0 1-2-2.3l1.4-7A2 2 0 0 1 6.4 3H17" />
    </svg>
  ),
  Plus: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" {...s} strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
}
