import { useEffect, useState } from 'react'
import { Check, Copy, Database, MessageSquareQuote, Plug, Wrench } from 'lucide-react'
import { Header } from '../components/layout/site-header'
import {
  MCP_NAME,
  MCP_PROMPTS,
  MCP_REPOSITORY_PATH,
  MCP_RESOURCES,
  MCP_TOOLS,
} from '../lib/mcp/manifest'
import { REPOSITORY_URL } from '../lib/project'
import '../styles/mcp.css'

const DIR = '/caminho/para/brasil-gov'
const ENTRY = `${DIR}/${MCP_REPOSITORY_PATH}`
const NODE_ARGS = ['--experimental-strip-types', '--no-warnings', ENTRY]

const SETUP = `git clone ${REPOSITORY_URL}.git
cd brasil-gov
pnpm install
pnpm mcp   # teste rápido: o servidor espera mensagens MCP via stdio`

const JSON_CONFIG = JSON.stringify(
  { mcpServers: { [MCP_NAME]: { command: 'node', args: NODE_ARGS } } },
  null,
  2,
)

const CLIENTS = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    steps: [
      {
        text: 'Adicione o servidor para todos os seus projetos:',
        code: `claude mcp add --scope user ${MCP_NAME} -- node ${NODE_ARGS.join(' ')}`,
      },
      {
        text: 'Confira se ele conectou. Dentro do Claude Code, /mcp lista as ferramentas.',
        code: `claude mcp list`,
      },
    ],
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    steps: [
      {
        text: 'Abra Settings → Developer → Edit Config e adicione ao claude_desktop_config.json:',
        code: JSON_CONFIG,
      },
      {
        text: 'Reinicie o Claude Desktop. As ferramentas aparecem no menu de conectores do chat.',
      },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    steps: [
      {
        text: 'Pela linha de comando:',
        code: `codex mcp add ${MCP_NAME} -- node ${NODE_ARGS.join(' ')}`,
      },
      {
        text: 'Ou edite ~/.codex/config.toml:',
        code: `[mcp_servers.${MCP_NAME}]
command = "node"
args = [${NODE_ARGS.map((arg) => `"${arg}"`).join(', ')}]`,
      },
    ],
  },
  {
    id: 'generic',
    label: 'Outros (stdio)',
    steps: [
      {
        text: 'Cursor, Windsurf, VS Code, Zed, Cline e a maioria dos clientes aceitam o formato mcpServers:',
        code: JSON_CONFIG,
      },
      {
        text: 'Sem clonar os dados? Acrescente --remote aos args para ler o catálogo publicado em brasil-gov.vercel.app.',
      },
    ],
  },
  {
    id: 'http',
    label: 'HTTP',
    steps: [
      {
        text: 'Suba o servidor com Streamable HTTP (sem sessão, só leitura):',
        code: `pnpm mcp:http            # http://127.0.0.1:3333/mcp
pnpm mcp:http --port 8080 --host 0.0.0.0`,
      },
      {
        text: 'Conecte qualquer cliente compatível com HTTP, por exemplo:',
        code: `claude mcp add --transport http ${MCP_NAME} http://127.0.0.1:3333/mcp`,
      },
      {
        text: 'Ou teste com curl:',
        code: `curl -s http://127.0.0.1:3333/mcp \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_services","arguments":{"query":"passaporte"}}}'`,
      },
    ],
  },
]

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }

    const timer = setTimeout(() => setCopied(false), 1600)

    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      className="mcp-copy"
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true))
      }}
      aria-label={copied ? 'Copiado' : 'Copiar'}
    >
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span>{copied ? 'Copiado' : 'Copiar'}</span>
    </button>
  )
}

function Code({ value }: { value: string }) {
  return (
    <div className="mcp-code">
      <pre>
        <code>{value}</code>
      </pre>
      <CopyButton value={value} />
    </div>
  )
}

export default function McpPage() {
  const [client, setClient] = useState(CLIENTS[0].id)
  const active = CLIENTS.find((entry) => entry.id === client) ?? CLIENTS[0]

  useEffect(() => {
    document.title = 'Servidor MCP · Brasil.gov'
  }, [])

  return (
    <>
      <Header light />
      <main className="mcp-page">
        <section className="mcp-hero">
          <span className="mcp-eyebrow">
            <Plug size={16} aria-hidden="true" /> Model Context Protocol
          </span>
          <h1>O catálogo do gov.br dentro do seu assistente.</h1>
          <p className="lead">
            O servidor MCP do Brasil.gov dá ao Claude, ao Codex e a qualquer cliente MCP acesso
            somente leitura a 5.729 serviços públicos federais e 67.488 trechos com fonte. As
            respostas citam a página oficial de cada serviço.
          </p>
          <ul className="mcp-facts">
            <li>
              <strong>{MCP_TOOLS.length}</strong> ferramentas
            </li>
            <li>
              <strong>{MCP_RESOURCES.length}</strong> recursos
            </li>
            <li>
              <strong>{MCP_PROMPTS.length}</strong> prompt
            </li>
            <li>
              <strong>0</strong> chaves de API
            </li>
          </ul>
        </section>

        <section className="mcp-section" aria-labelledby="mcp-install">
          <h2 id="mcp-install">Instalação</h2>
          <p>
            Requer Node.js 22.13+ e pnpm. Clone o repositório uma vez; os dados ficam no seu
            computador e nenhuma pergunta sai dele.
          </p>
          <Code value={SETUP} />
          <p className="mcp-note">
            Troque <code>{DIR}</code> pelo caminho absoluto do clone nos exemplos abaixo.
          </p>

          <div className="mcp-tabs" role="tablist" aria-label="Cliente MCP">
            {CLIENTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`tab-${entry.id}`}
                aria-selected={entry.id === active.id}
                aria-controls="mcp-client-panel"
                className={entry.id === active.id ? 'active' : ''}
                onClick={() => setClient(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div
            className="mcp-panel"
            role="tabpanel"
            id="mcp-client-panel"
            aria-labelledby={`tab-${active.id}`}
          >
            <ol>
              {active.steps.map((step) => (
                <li key={step.text}>
                  <p>{step.text}</p>
                  {step.code && <Code value={step.code} />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mcp-section" aria-labelledby="mcp-tools">
          <h2 id="mcp-tools">
            <Wrench size={22} aria-hidden="true" /> Ferramentas
          </h2>
          <p>Todas são somente leitura e não acessam a internet, exceto no modo --remote.</p>
          <div className="mcp-grid">
            {MCP_TOOLS.map((tool) => (
              <article className="mcp-tool" key={tool.name} id={tool.name}>
                <header>
                  <code className="mcp-tool-name">{tool.name}</code>
                  <h3>{tool.title}</h3>
                </header>
                <p>{tool.description}</p>
                {tool.parameters.length > 0 && (
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Parâmetro</th>
                        <th scope="col">Tipo</th>
                        <th scope="col">Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tool.parameters.map((parameter) => (
                        <tr key={parameter.name}>
                          <td>
                            <code>{parameter.name}</code>
                            {parameter.required && <span className="mcp-required">*</span>}
                          </td>
                          <td>{parameter.type}</td>
                          <td>{parameter.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mcp-label">Argumentos de exemplo</p>
                <Code value={JSON.stringify(tool.example)} />
                <p className="mcp-ask">
                  <MessageSquareQuote size={16} aria-hidden="true" />
                  <span>“{tool.prompt}”</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mcp-section mcp-split" aria-labelledby="mcp-resources">
          <div>
            <h2 id="mcp-resources">
              <Database size={22} aria-hidden="true" /> Recursos
            </h2>
            <ul className="mcp-list">
              {MCP_RESOURCES.map((resource) => (
                <li key={resource.uri}>
                  <code>{resource.uri}</code>
                  <span>{resource.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>
              <MessageSquareQuote size={22} aria-hidden="true" /> Prompts
            </h2>
            <ul className="mcp-list">
              {MCP_PROMPTS.map((prompt) => (
                <li key={prompt.name}>
                  <code>{prompt.name}</code>
                  <span>{prompt.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mcp-section" aria-labelledby="mcp-status">
          <h2 id="mcp-status">Como ler o status de retrieve_context</h2>
          <dl className="mcp-status">
            <dt>
              <code>ready</code>
            </dt>
            <dd>Os trechos cobrem as seções pedidas. Responda citando as fontes.</dd>
            <dt>
              <code>needs_clarification</code>
            </dt>
            <dd>
              Há serviços concorrentes ou nenhum serviço na pergunta. Pergunte qual é o certo.
            </dd>
            <dt>
              <code>insufficient_evidence</code>
            </dt>
            <dd>
              Faltam trechos ou o orçamento não coube. Diga o que falta e indique a página oficial.
            </dd>
          </dl>
          <p className="mcp-note">
            Os dados vêm da API de Serviços do gov.br, coletados em 01/10/2026. Este é um projeto
            independente, não um site oficial. Confirme custos e prazos na página de cada serviço.
          </p>
        </section>
      </main>
    </>
  )
}
