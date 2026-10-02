import { useEffect, useState } from 'react'
import { navigate } from '../../routes/navigation'
import { REPOSITORY_URL } from '../../lib/project'
import { ContributeLink } from './contribute-link'
import { Logo } from './site-logo'

const MENU = [
  { label: 'Fazer uma pergunta', to: '/chat' },
  { label: 'Como funciona', to: '/#como-funciona' },
  { label: 'Privacidade', to: '/#privacidade' },
  { label: 'Fontes', to: '/#fontes' },
  { label: 'MCP', to: '/mcp' },
  { label: 'Em breve', to: '/#em-breve' },
]

export function Header({ light = false }: { light?: boolean }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = open ? 'hidden' : ''

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  return (
    <>
      <header className={`header ${light ? 'header-light' : ''}`}>
        <Logo />
        <nav className="header-nav" aria-label="Navegação principal">
          {MENU.slice(1).map((item) => (
            <a
              key={item.to}
              href={item.to}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                  return
                }

                event.preventDefault()
                navigate(item.to)
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <ContributeLink />
          <button
            className="menu-btn"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="site-menu"
          >
            Menu
          </button>
        </div>
      </header>
      {open && (
        <div
          className="menu-overlay"
          id="site-menu"
          role="dialog"
          aria-modal
          aria-label="Menu principal"
        >
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
                  navigate(m.to)
                }}
              >
                {m.label}
              </a>
            ))}
            <a
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="menu-contribute"
              style={{ animationDelay: `${MENU.length * 50}ms` }}
            >
              Conserte o Brasil ↗
            </a>
          </nav>
        </div>
      )}
    </>
  )
}
