import { useState } from 'react'
import { Info } from 'lucide-react'

export function OfficialBanner() {
  const [open, setOpen] = useState(false)
  return (
    <div className="banner">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        Protótipo conceitual · não é um site oficial do governo brasileiro
        <Info size={14} aria-hidden="true" />
      </button>
      {open && (
        <p className="banner-detail">
          Este é um exercício de design inspirado no America.gov. O chat apresenta dados reais do
          catálogo gov.br, coletados em 1º de outubro de 2026. Confirme requisitos, valores e prazos
          nos canais oficiais de cada órgão.
        </p>
      )}
    </div>
  )
}
