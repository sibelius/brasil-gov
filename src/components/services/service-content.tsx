import { ArrowUpRight } from 'lucide-react'
import { Children, isValidElement, type ReactNode } from 'react'
import Markdown, { type Components } from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { safeUrl } from '../../helpers/safe-url'

function linkText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child)
      if (isValidElement<{ children?: ReactNode }>(child)) return linkText(child.props.children)
      return ''
    })
    .join('')
}

function ContentLink({
  href,
  children,
  label,
}: {
  href?: string
  children?: ReactNode
  label?: string
}) {
  const url = safeUrl(href)
  if (!url) return <span>{children}</span>

  const generic = /^(?:clique aqui|aqui|saiba mais|acesse(?: aqui| o site)?)[.!\s]*$/i.test(
    linkText(children).trim(),
  )

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={url}>
      {generic ? (label ?? `Acessar ${new URL(url).hostname.replace(/^www\./, '')}`) : children}
      <ArrowUpRight className="content-link-icon" size={12} aria-hidden="true" />
    </a>
  )
}

const MARKDOWN_COMPONENTS: Components = {
  a: ContentLink,
  img: ({ alt }) => <span>{alt}</span>,
  h1: ({ children }) => <h4>{children}</h4>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h4>{children}</h4>,
  table: ({ children }) => (
    <div className="service-table" tabIndex={0} role="region" aria-label="Tabela do serviço">
      <table>{children}</table>
    </div>
  ),
  details: ({ children }) => <section>{children}</section>,
  summary: ({ children }) => <h4>{children}</h4>,
}

export function ServiceContent({ text, linkLabel }: { text: string; linkLabel?: string }) {
  if (!text) return null

  return (
    <div className="service-content">
      <Markdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={
          linkLabel
            ? {
                ...MARKDOWN_COMPONENTS,
                a: ({ href, children }) => (
                  <ContentLink href={href} label={linkLabel}>
                    {children}
                  </ContentLink>
                ),
              }
            : MARKDOWN_COMPONENTS
        }
        urlTransform={safeUrl}
      >
        {text}
      </Markdown>
    </div>
  )
}
