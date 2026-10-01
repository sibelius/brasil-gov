import { ArrowRight, GitPullRequest } from 'lucide-react'
import { REPOSITORY_URL } from '../../lib/project'
import { Reveal } from '../reveal'

export function Contribute() {
  return (
    <section className="contribute" id="contribua" aria-labelledby="contribute-title">
      <Reveal className="contribute-card">
        <GitPullRequest className="contribute-icon" size={40} aria-hidden="true" />
        <h2 className="display-md" id="contribute-title">
          Conserte o Brasil
        </h2>
        <p className="lead">
          O Brasil.gov é aberto. Achou uma resposta errada, um prazo desatualizado ou tem uma ideia?
          Abra uma issue ou mande um pull request.
        </p>
        <div className="contribute-actions">
          <a
            className="contribute-cta"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Contribuir no GitHub
            <ArrowRight size={20} aria-hidden="true" />
          </a>
          <a
            className="contribute-cta secondary"
            href={`${REPOSITORY_URL}/issues/new`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Reportar um erro
          </a>
        </div>
      </Reveal>
    </section>
  )
}
