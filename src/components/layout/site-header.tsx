import { useEffect, useState } from 'react'
import { navigate } from '../../routes/navigation'
import { Logo } from './site-logo'

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
                  if (hash)
                    setTimeout(
                      () => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }),
                      60,
                    )
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
