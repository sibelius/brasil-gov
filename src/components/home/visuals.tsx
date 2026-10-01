import { Check, Landmark, Laptop, Smartphone, Tablet, UserRound } from 'lucide-react'

const SITES = [
  { org: 'Receita Federal', title: 'Declare seu Imposto de Renda', c: '#0b3d91' },
  { org: 'INSS', title: 'Meu INSS: pedidos e extratos', c: '#1f5aa6' },
  { org: 'Ministério da Saúde', title: 'Campanha de vacinação 2026', c: '#0a7d4f' },
  { org: 'Polícia Federal', title: 'Passaporte: agende seu atendimento', c: '#132c5a' },
  { org: 'Caixa', title: 'Consulte seu FGTS', c: '#005ca9' },
  { org: 'Justiça Eleitoral', title: 'Regularize seu título', c: '#5b2a86' },
  { org: 'Detran', title: 'Renovação de CNH', c: '#c0392b' },
  { org: 'MEC', title: 'Inscrições do Enem', c: '#1d6fa5' },
  { org: 'Portal do Empreendedor', title: 'Seja MEI em minutos', c: '#2e7d32' },
  { org: 'Correios', title: 'Rastreie sua encomenda', c: '#e4a400' },
  { org: 'IBGE', title: 'Censo e estatísticas', c: '#0f4c81' },
  { org: 'Ministério do Trabalho', title: 'Carteira de Trabalho Digital', c: '#7a4b00' },
  { org: 'Anvisa', title: 'Consulta de medicamentos', c: '#0b6e75' },
  { org: 'Itamaraty', title: 'Serviços consulares', c: '#283593' },
  { org: 'MDS', title: 'Cadastro Único', c: '#ad1457' },
  { org: 'Prefeitura', title: 'IPTU 2027: segunda via', c: '#37474f' },
]

export function Collage() {
  return (
    <div className="collage" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className={`collage-row r${row}`}>
          {[...SITES, ...SITES].slice(row * 5, row * 5 + 16).map((s, k) => (
            <div key={k} className="mini-site">
              <div className="mini-bar" style={{ background: s.c }}>
                <i />
                <b>{s.org}</b>
              </div>
              <div className="mini-body">
                <strong>{s.title}</strong>
                <span />
                <span />
                <span className="short" />
                <em style={{ background: s.c }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const SEALS = [
  { a: 'RFB', n: 'Receita Federal', c: '#0b3d91' },
  { a: 'INSS', n: 'Previdência Social', c: '#1f5aa6' },
  { a: 'SUS', n: 'Sistema Único de Saúde', c: '#0a7d4f' },
  { a: 'PF', n: 'Polícia Federal', c: '#132c5a' },
  { a: 'TSE', n: 'Justiça Eleitoral', c: '#5b2a86' },
  { a: 'MEC', n: 'Educação', c: '#1d6fa5' },
  { a: 'MTE', n: 'Trabalho e Emprego', c: '#7a4b00' },
  { a: 'MDS', n: 'Desenvolvimento Social', c: '#ad1457' },
  { a: 'IBGE', n: 'Geografia e Estatística', c: '#0f4c81' },
]

function Seal({ a, n, c }: { a: string; n: string; c: string }) {
  return (
    <div className="seal" style={{ color: c }} aria-label={n}>
      <Landmark size={28} aria-hidden="true" />
      <strong>{a}</strong>
      <small>{n}</small>
    </div>
  )
}

export function Devices() {
  return (
    <div className="devices" aria-hidden>
      <div className="device-tray">
        <div className="device-tile">
          <Smartphone size={48} color="#0b1f4d" aria-hidden="true" />
          <span>Celular</span>
        </div>
        <div className="device-tile">
          <Tablet size={48} color="#009c3b" aria-hidden="true" />
          <span>Tablet</span>
        </div>
        <div className="device-tile">
          <Laptop size={48} color="#e0a800" aria-hidden="true" />
          <span>Computador</span>
        </div>
      </div>
    </div>
  )
}

export function UpcomingCards() {
  return (
    <div className="upcoming" aria-hidden>
      <div className="up-track">
        <div className="up-card">
          <h4>Agende no Poupatempo mais perto</h4>
          {[
            ['Poupatempo Sé', 'Pça. do Carmo, s/n, São Paulo'],
            ['Poupatempo Lapa', 'R. Catão, 72, São Paulo'],
            ['Poupatempo Itaquera', 'Av. do Contorno, 60, São Paulo'],
          ].map(([n, a]) => (
            <div className="up-row" key={n}>
              <div className="up-thumb" />
              <div>
                <b>{n}</b>
                <small>{a}</small>
              </div>
              <span className="pill">Escolher</span>
            </div>
          ))}
        </div>

        <div className="up-card">
          <h4>Confirme sua foto</h4>
          <div className="photo-confirm">
            <div className="avatar">
              <UserRound size={56} aria-hidden="true" />
            </div>
            <div className="doc-lines">
              <b>SILVA</b>
              <b>MARIA EDUARDA</b>
              <small>CPF 000.000.000-00</small>
            </div>
          </div>
          <span className="pill ghost">Emitir CIN digital</span>
        </div>

        <div className="up-card wide">
          <h4>Compare preços de remédios</h4>
          <div className="fake-input">Buscar medicamento</div>
          <div className="med">
            <div className="med-head">
              <b>Losartana potássica</b>
              <small>Remover</small>
            </div>
            <div className="med-row">
              <small>Forma</small>
              <span className="seg on">Comprimido</span>
              <span className="seg">Solução</span>
            </div>
            <div className="med-row">
              <small>Dose</small>
              <span className="seg on">50 mg</span>
              <span className="seg">100 mg</span>
            </div>
            <div className="med-row">
              <small>Farmácia Popular</small>
              <span className="seg on free">Grátis</span>
            </div>
          </div>
        </div>

        <div className="up-card">
          <h4>Atualize seu nome em todos os órgãos</h4>
          {['Receita Federal', 'Justiça Eleitoral', 'INSS', 'Detran'].map((o, k) => (
            <label className="check-row" key={o}>
              <span>{o}</span>
              <i className={k < 2 ? 'on' : ''}>{k < 2 && <Check size={10} aria-hidden="true" />}</i>
            </label>
          ))}
          <span className="pill ghost">Alterar nome</span>
        </div>

        <div className="up-card dashed">
          <span className="drop">Arraste seu currículo aqui</span>
          <div className="pdf">
            <em>PDF</em> curriculo_2026.pdf
          </div>
          <small>Vagas do Sine compatíveis com seu perfil</small>
        </div>

        <div className="up-card">
          <h4>Acompanhe seus pedidos</h4>
          {[
            ['Passaporte', 'Pronto para retirada', 100],
            ['Restituição IR', '3º lote · 30/07', 70],
            ['Aposentadoria', 'Em análise', 35],
          ].map(([n, s, p]) => (
            <div className="track-row" key={n as string}>
              <div className="track-top">
                <b>{n}</b>
                <small>{s}</small>
              </div>
              <div className="bar">
                <i style={{ width: `${p}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function AgencySeals() {
  return (
    <div className="seals">
      {SEALS.map((seal) => (
        <Seal key={seal.a} {...seal} />
      ))}
    </div>
  )
}
