import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowUpRight, Clock3, Wallet } from 'lucide-react'
import { DATASET, type Service } from '../../lib/services/model.ts'
import { scrollToChatContent } from '../../helpers/scroll-to-chat-content'
import { ServiceContent as Content } from './service-content'
import ServiceDeadline from './service-deadline'

export default function ServiceDetails({
  service,
  children,
}: {
  service: Service
  children?: ReactNode
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    scrollToChatContent(headingRef.current?.closest('article') ?? null)
  }, [service.id])

  return (
    <article className="service-detail" aria-label={service.name}>
      <header className="service-detail-header">
        <p className="service-eyebrow">Serviço selecionado</p>
        <h2 ref={headingRef}>{service.name}</h2>
        <p className="service-agency">{service.agency}</p>
      </header>
      <div className="service-links">
        {service.digitalUrl && (
          <a href={service.digitalUrl} target="_blank" rel="noopener noreferrer">
            Acessar serviço <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        )}
        <a href={service.url} target="_blank" rel="noopener noreferrer">
          Ver no gov.br <ArrowUpRight size={13} aria-hidden="true" />
        </a>
      </div>
      <dl className="service-facts">
        <div>
          <dt>
            <Wallet size={16} aria-hidden="true" /> Custo
          </dt>
          <dd>{service.cost}</dd>
        </div>
        <div>
          <dt>
            <Clock3 size={16} aria-hidden="true" /> Prazo estimado
          </dt>
          <dd>
            <Content text={service.duration || 'Não informado no catálogo.'} />
            <ServiceDeadline duration={service.durationEstimate} />
          </dd>
        </div>
      </dl>
      <section className="service-block">
        <h3>Sobre este serviço</h3>
        <div className="service-block-body">
          <Content text={service.description || 'Descrição não informada no catálogo.'} />
        </div>
      </section>
      {service.applicants.length > 0 && (
        <section className="service-block">
          <h3>Quem pode utilizar e requisitos</h3>
          <div className="service-block-body">
            {service.applicants.map((applicant, index) => (
              <div className="service-content-group" key={index}>
                <div className="service-topic">
                  <Content text={applicant.title} />
                </div>
                {applicant.entries.map((entry, i) => (
                  <Content key={i} text={entry} />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="service-steps-heading">
        <h3>Como realizar</h3>
        {service.steps.length > 0 && (
          <span>
            {service.steps.length} {service.steps.length === 1 ? 'etapa' : 'etapas'}
          </span>
        )}
      </div>
      {service.steps.length ? (
        <ol className="service-steps">
          {service.steps.map((step, index) => (
            <li key={index}>
              <section className="service-step">
                <h4 className="step-title">
                  <span className="step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>
                    <span className="sr-only">Etapa {index + 1}: </span>
                    {step.title}
                  </span>
                </h4>
                <div className="service-block-body">
                  <Content text={step.description || 'Descrição da etapa não informada.'} />
                  {step.duration && (
                    <div className="service-step-duration">
                      <Clock3 size={13} aria-hidden="true" />
                      <span>Prazo da etapa:</span>
                      <Content text={step.duration} />
                    </div>
                  )}
                  {step.groups.map((group, i) => (
                    <section className="service-content-group" key={i}>
                      <h4>{group.title}</h4>
                      {group.entries.map((entry, n) => (
                        <div className="service-entry" key={n}>
                          <Content text={entry} />
                        </div>
                      ))}
                    </section>
                  ))}
                </div>
              </section>
            </li>
          ))}
        </ol>
      ) : (
        <p>Etapas não informadas no catálogo. Consulte a página oficial.</p>
      )}
      {service.contact && (
        <section className="service-contact">
          <h3>Atendimento</h3>
          <div className="service-block-body">
            <Content text={service.contact} linkLabel="Consultar canais de atendimento" />
          </div>
        </section>
      )}
      {children}
      <p className="dataset-note">
        Catálogo de {DATASET.collected}. Confirme requisitos, valores e prazos na página oficial.
      </p>
    </article>
  )
}
