import { GitPullRequest } from 'lucide-react'
import { REPOSITORY_URL } from '../../lib/project'

export function ContributeLink() {
  return (
    <a
      className="contribute-link"
      href={REPOSITORY_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conserte o Brasil no GitHub"
    >
      <GitPullRequest size={18} aria-hidden="true" />
      <span>Conserte o Brasil</span>
    </a>
  )
}
