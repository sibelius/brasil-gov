import { Reveal } from '../reveal'

export function Feature({
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
