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

const MCP_URL = 'https://brasil-gov.vercel.app/mcp'
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

const REMOTE_JSON = JSON.stringify(
  { mcpServers: { [MCP_NAME]: { type: 'http', url: MCP_URL } } },
  null,
  2,
)

const BRIDGE_JSON = JSON.stringify(
  { mcpServers: { [MCP_NAME]: { command: 'npx', args: ['-y', 'mcp-remote', MCP_URL] } } },
  null,
  2,
)

type Step = { text: string; code?: string }

const CLIENTS: { id: string; label: string; remote: Step[]; local: Step[] }[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    remote: [
      {
        text: 'Um comando, para todos os seus projetos:',
        code: `claude mcp add --scope user --transport http ${MCP_NAME} ${MCP_URL}`,
      },
      {
        text: 'Confira se ele conectou. Dentro do Claude Code, /mcp lista as ferramentas.',
        code: 'claude mcp list',
      },
    ],
    local: [
      {
        text: 'Depois de clonar, aponte para o arquivo local:',
        code: `claude mcp add --scope user ${MCP_NAME} -- node ${NODE_ARGS.join(' ')}`,
      },
    ],
  },
  {
    id: 'claude-ai',
    label: 'Claude.ai e Desktop',
    remote: [
      {
        text: 'Em Configurações → Conectores, clique em “Adicionar conector personalizado” e cole a URL:',
        code: MCP_URL,
      },
      {
        text: 'Ative o conector em uma conversa pelo menu de ferramentas. Ele vale para o Claude.ai e para o Claude Desktop.',
      },
    ],
    local: [
      {
        text: 'Abra Settings → Developer → Edit Config e adicione ao claude_desktop_config.json. Depois, reinicie o app.',
        code: JSON_CONFIG,
      },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    remote: [
      {
        text: 'Adicione ao ~/.codex/config.toml:',
        code: `[mcp_servers.${MCP_NAME}]
url = "${MCP_URL}"`,
      },
      {
        text: 'Ou pela linha de comando:',
        code: `codex mcp add ${MCP_NAME} --url ${MCP_URL}`,
      },
    ],
    local: [
      {
        text: 'Adicione ao ~/.codex/config.toml:',
        code: `[mcp_servers.${MCP_NAME}]
command = "node"
args = [${NODE_ARGS.map((arg) => `"${arg}"`).join(', ')}]`,
      },
    ],
  },
  {
    id: 'generic',
    label: 'Cursor, VS Code e outros',
    remote: [
      {
        text: 'Clientes com suporte a HTTP (Cursor, VS Code, Windsurf, Cline…) aceitam a URL direto:',
        code: REMOTE_JSON,
      },
      {
        text: 'Seu cliente só aceita stdio? Use a ponte mcp-remote:',
        code: BRIDGE_JSON,
      },
    ],
    local: [
      {
        text: 'Formato mcpServers com stdio. Acrescente --remote aos args para ler os dados publicados em vez dos arquivos locais.',
        code: JSON_CONFIG,
      },
    ],
  },
  {
    id: 'curl',
    label: 'curl',
    remote: [
      {
        text: 'Teste o endpoint sem nenhum cliente:',
        code: `curl -s ${MCP_URL} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_services","arguments":{"query":"passaporte"}}}'`,
      },
    ],
    local: [
      {
        text: 'Suba o servidor HTTP no seu computador e troque a URL nos exemplos:',
        code: `pnpm mcp:http            # http://127.0.0.1:3333/mcp
pnpm mcp:http --port 8080 --host 0.0.0.0`,
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
  const [mode, setMode] = useState<'remote' | 'local'>('remote')
  const active = CLIENTS.find((entry) => entry.id === client) ?? CLIENTS[0]
  const steps = active[mode]

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
            O servidor MCP do Brasil.gov, hospedado em brasil-gov.vercel.app/mcp, dá ao Claude, ao
            Codex e a qualquer cliente MCP acesso somente leitura a 5.729 serviços públicos federais
            e 67.488 trechos com fonte. As respostas citam a página oficial de cada serviço.
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
            O servidor já está no ar. Cole a URL no seu cliente; não precisa baixar nem rodar nada.
          </p>
          <Code value={MCP_URL} />

          <div className="mcp-mode" role="radiogroup" aria-label="Modo de instalação">
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'remote'}
              className={mode === 'remote' ? 'active' : ''}
              onClick={() => setMode('remote')}
            >
              Remoto · recomendado
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'local'}
              className={mode === 'local' ? 'active' : ''}
              onClick={() => setMode('local')}
            >
              Local · offline
            </button>
          </div>

          {mode === 'local' && (
            <>
              <p className="mcp-note">
                Requer Node.js 22.13+ e pnpm. Os dados ficam no seu computador e nenhuma pergunta
                sai dele. Troque <code>{DIR}</code> pelo caminho absoluto do clone.
              </p>
              <Code value={SETUP} />
            </>
          )}

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
              {steps.map((step) => (
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
          <p>Todas são somente leitura. Nenhuma pede login, chave de API ou dados pessoais.</p>
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
