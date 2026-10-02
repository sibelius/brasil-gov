import { useState } from 'react'
import { navigate } from '../../routes/navigation'
import { loadPhotoCredits, type PhotoCredit } from '../../lib/photo-credits'
import { REPOSITORY_URL } from '../../lib/project'

type CreditsState =
  { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; items: PhotoCredit[] }

export function Footer() {
  const [credits, setCredits] = useState<CreditsState>({ status: 'idle' })

  async function loadCredits() {
    setCredits({ status: 'loading' })

    try {
      const items = await loadPhotoCredits()

      setCredits({ status: 'ready', items })
    } catch {
      setCredits({ status: 'error' })
    }
  }

  const links = [
    ['Como funciona', '#como-funciona'],
    ['Privacidade', '#privacidade'],
    ['Fontes', '#fontes'],
    ['Em breve', '#em-breve'],
    ['Fazer uma pergunta', '/chat'],
    ['Status dos serviços', '/status'],
    ['Servidor MCP', '/mcp'],
    ['Conserte o Brasil', REPOSITORY_URL],
  ]

  return (
    <footer className="footer">
      <nav className="footer-links">
        {links.map(([l, h]) => (
          <a
            key={l}
            href={h}
            target={h.startsWith('https://') ? '_blank' : undefined}
            rel={h.startsWith('https://') ? 'noopener noreferrer' : undefined}
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
        com dados do catálogo gov.br
      </p>
      <p className="footer-tag">Todos os órgãos, trabalhando juntos</p>
      <div className="footer-legal">
        <span>Português (Brasil)</span>
      </div>
      <details
        className="photo-credits"
        onToggle={(event) => {
          if (event.currentTarget.open && credits.status === 'idle') {
            void loadCredits()
          }
        }}
      >
        <summary>Créditos das fotos</summary>
        {credits.status === 'loading' && <p role="status">Carregando créditos…</p>}
        {credits.status === 'error' && (
          <div role="alert">
            <p>Não foi possível carregar os créditos.</p>
            <button className="retry-button" onClick={loadCredits}>
              Tentar novamente
            </button>
          </div>
        )}
        {credits.status === 'ready' && (
          <ul className="credits">
            {credits.items.map((credit) => (
              <li key={credit.key}>
                <a href={credit.page} target="_blank" rel="noreferrer">
                  {credit.title.replace('File:', '').replace(/\.jpg$/i, '')}
                </a>{' '}
                · {credit.artist} · {credit.license} · Wikimedia Commons
              </li>
            ))}
          </ul>
        )}
      </details>
      <p className="footer-made">Feito no Brasil, com café</p>
    </footer>
  )
}
