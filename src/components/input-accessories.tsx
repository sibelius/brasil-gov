import { Mic, Paperclip } from 'lucide-react'

export function InputAccessories() {
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label="Anexar arquivo (em breve)"
        title="Anexar arquivo — em breve"
        disabled
      >
        <Paperclip size={22} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Usar microfone (em breve)"
        title="Usar microfone — em breve"
        disabled
      >
        <Mic size={22} aria-hidden="true" />
      </button>
    </>
  )
}
