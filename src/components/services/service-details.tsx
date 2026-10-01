import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { safeUrl } from '../../helpers/safe-url'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { DATASET, type Service } from '../../lib/services/model.ts'

const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children }) =>
    safeUrl(href) ? (
      <a href={safeUrl(href)} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: ({ alt }) => <span>{alt}</span>,
  h1: ({ children }) => <h4>{children}</h4>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h4>{children}</h4>,
}

function Content({ text }: { text: string }) {
  if (!text) return null

  return (
    <Markdown
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={MARKDOWN_COMPONENTS}
      urlTransform={safeUrl}
    >
      {text}
    </Markdown>
  )
}

function focusHeading(node: HTMLHeadingElement | null) {
  node?.focus({ preventScroll: true })
}

export default function ServiceDetails({ service }: { service: Service }) {
  return (
    <article className="service-detail" aria-label={service.name}>
      <p className="service-agency">{service.agency}</p>
      <h2 tabIndex={-1} ref={focusHeading}>
        {service.name}
      </h2>
      <div className="service-links">
        <a href={service.url} target="_blank" rel="noopener noreferrer">
          Ver serviço no gov.br ↗
        </a>
        {service.digitalUrl && (
          <a href={service.digitalUrl} target="_blank" rel="noopener noreferrer">
            Acessar serviço ↗
          </a>
        )}
      </div>
      <p className="dataset-note">
        Catálogo coletado em {DATASET.collected}. Confirme requisitos, valores e prazos na página
        oficial.
      </p>
      <Content text={service.description || 'Descrição não informada no catálogo.'} />
      <dl className="service-facts">
        <div>
          <dt>Custo</dt>
          <dd>{service.cost}</dd>
        </div>
        <div>
          <dt>Prazo estimado</dt>
          <dd>
            <Content text={service.duration || 'Não informado no catálogo.'} />
          </dd>
        </div>
      </dl>
      {service.applicants.length > 0 && (
        <details className="service-section">
          <summary>Quem pode utilizar e requisitos</summary>
          {service.applicants.map((applicant, index) => (
            <div key={index}>
              <Content text={applicant.title} />
              {applicant.entries.map((entry, i) => (
                <Content key={i} text={entry} />
              ))}
            </div>
          ))}
        </details>
      )}
      <h3>Etapas para realizar o serviço</h3>
      {service.steps.length ? (
        <ol className="service-steps">
          {service.steps.map((step, index) => (
            <li key={index}>
              <details className="service-section" open={index === 0}>
                <summary>
                  {index + 1}. {step.title}
                </summary>
                <Content text={step.description || 'Descrição da etapa não informada.'} />
                {step.duration && (
                  <div>
                    <h4>Tempo estimado</h4>
                    <Content text={step.duration} />
                  </div>
                )}
                {step.groups.map((group, i) => (
                  <section key={i}>
                    <h4>{group.title}</h4>
                    {group.entries.map((entry, n) => (
                      <Content key={n} text={entry} />
                    ))}
                  </section>
                ))}
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <p>Etapas não informadas no catálogo. Consulte a página oficial.</p>
      )}
      {service.contact && (
        <details className="service-section">
          <summary>Contato</summary>
          <Content text={service.contact} />
        </details>
      )}
    </article>
  )
}
