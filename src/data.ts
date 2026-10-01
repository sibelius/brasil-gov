import { createIndex, splitTopics, confident, type Hit } from './search'
import baseVariants from './data/variants-base.json'

export type Answer = {
  id: string
  variants?: string[]
  category: string
  question: string
  keywords: string[]
  summary: string
  steps?: string[]
  note?: string
  sources: { name: string; path?: string }[]
}

export const CATEGORIES = [
  { id: 'documentos', label: 'Documentos', icon: '🪪' },
  { id: 'impostos', label: 'Impostos', icon: '🧾' },
  { id: 'saude', label: 'Saúde', icon: '🩺' },
  { id: 'trabalho', label: 'Trabalho', icon: '💼' },
  { id: 'previdencia', label: 'Previdência', icon: '👵' },
  { id: 'beneficios', label: 'Benefícios', icon: '🤝' },
  { id: 'eleicoes', label: 'Eleições', icon: '🗳️' },
  { id: 'empresas', label: 'Empresas', icon: '🏪' },
  { id: 'educacao', label: 'Educação', icon: '🎓' },
  { id: 'imoveis', label: 'Imóveis', icon: '🏠' },
  { id: 'justica', label: 'Justiça', icon: '⚖️' },
  { id: 'transito', label: 'Trânsito', icon: '🚗' },
  { id: 'viagem', label: 'Viagem', icon: '✈️' },
] as const

const BASE: Answer[] = [
  {
    id: 'cpf-segunda-via',
    category: 'documentos',
    question: 'Como tiro a segunda via do CPF?',
    keywords: ['cpf', 'segunda via', 'comprovante', 'perdi cpf', 'cadastro pessoa fisica'],
    summary:
      'O comprovante do CPF pode ser emitido gratuitamente pela internet, a qualquer hora. Desde a nova Carteira de Identidade Nacional, o número do CPF também passa a ser o número do seu RG, então muitas vezes você nem precisa de um documento separado.',
    steps: [
      'Acesse a área "Comprovante de Inscrição no CPF" no portal da Receita Federal.',
      'Informe o número do CPF e a data de nascimento.',
      'Marque o "Não sou um robô" e clique em Consultar.',
      'Baixe ou imprima o comprovante em PDF. Ele tem a mesma validade do cartão físico.',
    ],
    note: 'Se você não sabe o número do CPF, pode consultá-lo nas agências dos Correios, Banco do Brasil ou Caixa, levando um documento com foto. A taxa é de R$ 7,00.',
    sources: [
      { name: 'Receita Federal', path: 'receita/cpf/comprovante' },
      { name: 'Correios', path: 'correios/servicos/cpf' },
    ],
  },
  {
    id: 'cin-rg',
    category: 'documentos',
    question: 'Como emitir a nova Carteira de Identidade Nacional (CIN)?',
    keywords: ['rg', 'identidade', 'cin', 'carteira de identidade', 'documento', 'nova identidade'],
    summary:
      'A Carteira de Identidade Nacional (CIN) usa o CPF como número único e substitui o antigo RG. A primeira via é gratuita e é emitida pelo instituto de identificação do seu estado.',
    steps: [
      'Agende o atendimento no site do órgão de identificação do seu estado (ex.: Poupatempo, SAC, Vapt Vupt).',
      'Leve certidão de nascimento ou casamento (original) e o CPF regularizado.',
      'Faça a coleta de biometria e foto no posto de atendimento.',
      'Acompanhe a emissão: a versão digital fica disponível no app gov.br e a impressa sai em até 15 dias úteis.',
    ],
    note: 'A segunda via pode ter taxa, que varia de estado para estado (em média entre R$ 30 e R$ 60).',
    sources: [
      { name: 'Ministério da Gestão e Inovação', path: 'gestao/cin' },
      { name: 'Instituto de Identificação estadual', path: 'estados/identificacao' },
    ],
  },
  {
    id: 'passaporte',
    category: 'viagem',
    question: 'Quanto custa e como tirar o passaporte?',
    keywords: ['passaporte', 'viajar', 'viagem', 'exterior', 'policia federal', 'gru'],
    summary:
      'O passaporte comum é emitido pela Polícia Federal, tem validade de 10 anos para maiores de 18 anos e custa R$ 257,25 (valor da GRU em 2026). O prazo médio de entrega é de 6 dias úteis após o atendimento.',
    steps: [
      'Preencha o formulário de solicitação online no site da Polícia Federal.',
      'Emita e pague a Guia de Recolhimento da União (GRU).',
      'Agende o atendimento em um posto da Polícia Federal.',
      'Compareça com RG ou CIN, CPF, título de eleitor com comprovante de quitação e certificado de reservista (homens de 18 a 45 anos).',
      'Retire o passaporte pessoalmente no mesmo posto.',
    ],
    note: 'Em caso de viagem urgente comprovada, é possível pedir o passaporte de emergência.',
    sources: [
      { name: 'Polícia Federal', path: 'pf/passaporte' },
      { name: 'Ministério das Relações Exteriores', path: 'itamaraty/viagens' },
    ],
  },
  {
    id: 'imposto-renda',
    category: 'impostos',
    question: 'Quem precisa declarar o Imposto de Renda em 2027?',
    keywords: ['imposto de renda', 'irpf', 'declarar', 'declaracao', 'leao', 'ir', 'restituicao'],
    summary:
      'Precisa declarar o IRPF quem recebeu rendimentos tributáveis acima de R$ 35.584,00 no ano anterior, teve bens acima de R$ 800 mil, recebeu rendimentos isentos acima de R$ 200 mil ou teve receita da atividade rural acima de R$ 177.920,00. O prazo vai de 16 de março a 29 de maio.',
    steps: [
      'Baixe o programa da declaração ou use a versão online no portal e-CAC.',
      'Importe a declaração pré-preenchida com sua conta gov.br nível prata ou ouro.',
      'Confira rendimentos, dependentes, despesas médicas e de educação.',
      'Escolha entre desconto simplificado ou deduções legais e transmita.',
    ],
    note: 'Quem envia a declaração pré-preenchida e opta por receber a restituição via Pix tem prioridade nos lotes de pagamento.',
    sources: [
      { name: 'Receita Federal', path: 'receita/irpf/2027' },
    ],
  },
  {
    id: 'restituicao',
    category: 'impostos',
    question: 'Como consultar minha restituição do Imposto de Renda?',
    keywords: ['restituicao', 'lote', 'consultar restituicao', 'malha fina', 'devolucao imposto'],
    summary:
      'A restituição é paga em 5 lotes, entre maio e setembro. Você pode consultar se está em um lote, ou se caiu na malha fina, pelo portal e-CAC ou pelo app da Receita Federal.',
    steps: [
      'Entre no e-CAC com sua conta gov.br.',
      'Abra "Meu Imposto de Renda" e escolha o ano da declaração.',
      'Veja o status: "Em processamento", "Em fila de restituição", "Com pendências" ou "Processada".',
      'Se houver pendência, envie uma declaração retificadora para corrigir.',
    ],
    sources: [
      { name: 'Receita Federal', path: 'receita/restituicao' },
    ],
  },
  {
    id: 'cartao-sus',
    category: 'saude',
    question: 'Como faço o Cartão do SUS?',
    keywords: ['sus', 'cartao sus', 'cns', 'saude', 'cartao nacional de saude', 'conecte sus'],
    summary:
      'O Cartão Nacional de Saúde (CNS) é gratuito e pode ser feito em qualquer Unidade Básica de Saúde (UBS) ou pelo app Meu SUS Digital. Hoje, o próprio CPF já é aceito como identificação no SUS.',
    steps: [
      'Baixe o aplicativo Meu SUS Digital e entre com sua conta gov.br.',
      'O número do seu CNS aparece na tela inicial, junto com vacinas e exames.',
      'Se preferir, vá até a UBS mais próxima com documento com foto, CPF e comprovante de residência.',
    ],
    sources: [
      { name: 'Ministério da Saúde', path: 'saude/cns' },
    ],
  },
  {
    id: 'farmacia-popular',
    category: 'saude',
    question: 'Quais remédios são gratuitos no Farmácia Popular?',
    keywords: ['farmacia popular', 'remedio', 'remedios', 'medicamento', 'gratis', 'diabetes', 'hipertensao'],
    summary:
      'O Farmácia Popular oferece gratuitamente medicamentos para hipertensão, diabetes, asma, osteoporose, anticoncepcionais e fraldas geriátricas, além de absorventes para pessoas em situação de vulnerabilidade. São mais de 40 itens na lista gratuita.',
    steps: [
      'Procure uma farmácia credenciada com a placa "Aqui tem Farmácia Popular".',
      'Leve documento com foto, CPF e receita médica válida (do SUS ou particular).',
      'A receita vale por 365 dias para uso contínuo.',
    ],
    sources: [
      { name: 'Ministério da Saúde', path: 'saude/farmacia-popular' },
    ],
  },
  {
    id: 'fgts',
    category: 'trabalho',
    question: 'Como saco meu FGTS?',
    keywords: ['fgts', 'saque', 'fundo de garantia', 'saque aniversario', 'demissao', 'caixa'],
    summary:
      'O FGTS pode ser sacado em situações como demissão sem justa causa, aposentadoria, compra da casa própria, doenças graves ou pelo saque-aniversário. Tudo pode ser solicitado pelo aplicativo FGTS, da Caixa.',
    steps: [
      'Baixe o app FGTS e entre com CPF e senha.',
      'Toque em "Meus saques" e escolha o motivo.',
      'Envie os documentos pedidos (ex.: termo de rescisão) pelo próprio app.',
      'Indique uma conta bancária. O dinheiro cai em até 5 dias úteis.',
    ],
    note: 'Quem aderiu ao saque-aniversário só pode sacar o saldo total na demissão depois de 25 meses da volta ao saque-rescisão.',
    sources: [
      { name: 'Caixa Econômica Federal', path: 'caixa/fgts' },
      { name: 'Ministério do Trabalho e Emprego', path: 'trabalho/fgts' },
    ],
  },
  {
    id: 'seguro-desemprego',
    category: 'trabalho',
    question: 'Tenho direito ao seguro-desemprego?',
    keywords: ['seguro desemprego', 'desempregado', 'demitido', 'demissao', 'parcelas'],
    summary:
      'Tem direito quem foi demitido sem justa causa e trabalhou com carteira assinada por pelo menos 12 meses nos últimos 18 meses (na primeira solicitação). O benefício vai de 3 a 5 parcelas, entre R$ 1.518,00 e R$ 2.424,11.',
    steps: [
      'Peça no app ou portal Carteira de Trabalho Digital, entre 7 e 120 dias após a demissão.',
      'Informe o número do requerimento que consta no termo entregue pelo empregador.',
      'Acompanhe o pagamento, que é feito pela Caixa na conta poupança social digital.',
    ],
    sources: [
      { name: 'Ministério do Trabalho e Emprego', path: 'trabalho/seguro-desemprego' },
    ],
  },
  {
    id: 'aposentadoria',
    category: 'previdencia',
    question: 'Quando posso me aposentar pelo INSS?',
    keywords: ['aposentadoria', 'aposentar', 'inss', 'idade', 'tempo de contribuicao', 'meu inss'],
    summary:
      'Pela regra geral, as mulheres se aposentam com 62 anos e os homens com 65 anos, com no mínimo 15 anos de contribuição (20 anos para homens que começaram a contribuir depois de novembro de 2019). Existem regras de transição para quem já contribuía antes da reforma.',
    steps: [
      'Acesse o Meu INSS (app ou site) com sua conta gov.br.',
      'Use o "Simular Aposentadoria" para ver quando você atinge cada regra.',
      'Confira o CNIS (extrato de contribuições) e corrija períodos que estejam faltando.',
      'Quando cumprir os requisitos, faça o pedido em "Novo Pedido" e "Aposentadoria".',
    ],
    note: 'Você também pode ligar no 135, de segunda a sábado, das 7h às 22h.',
    sources: [
      { name: 'INSS', path: 'inss/aposentadoria' },
      { name: 'Ministério da Previdência Social', path: 'previdencia/regras' },
    ],
  },
  {
    id: 'bolsa-familia',
    category: 'beneficios',
    question: 'Como me inscrevo no Bolsa Família?',
    keywords: ['bolsa familia', 'cadunico', 'cadastro unico', 'auxilio', 'beneficio social', 'renda'],
    summary:
      'Para receber o Bolsa Família, a família precisa estar inscrita no Cadastro Único e ter renda de até R$ 218,00 por pessoa. O valor mínimo é de R$ 600,00 por família, com adicionais para crianças, gestantes e nutrizes.',
    steps: [
      'Vá ao CRAS ou ao posto do Cadastro Único da sua cidade.',
      'Leve o CPF ou título de eleitor do responsável familiar e documentos de todos os moradores.',
      'Mantenha o cadastro atualizado pelo menos a cada 2 anos.',
      'Acompanhe a seleção pelo app Bolsa Família ou pelo telefone 121.',
    ],
    note: 'A inscrição no CadÚnico não garante entrada imediata no programa: a seleção é mensal e automática.',
    sources: [
      { name: 'Ministério do Desenvolvimento Social', path: 'mds/bolsa-familia' },
    ],
  },
  {
    id: 'titulo-eleitor',
    category: 'eleicoes',
    question: 'Como tirar ou regularizar o título de eleitor?',
    keywords: ['titulo de eleitor', 'titulo', 'eleitor', 'votar', 'tse', 'e-titulo', 'justica eleitoral', 'eleicao'],
    summary:
      'O primeiro título e a regularização podem ser feitos online pelo Autoatendimento Eleitoral (Título Net). O voto é obrigatório dos 18 aos 70 anos e facultativo para jovens de 16 e 17 anos e pessoas acima de 70.',
    steps: [
      'Acesse o Autoatendimento Eleitoral no site da Justiça Eleitoral.',
      'Escolha "Tirar o primeiro título" ou "Regularizar situação".',
      'Envie foto de documento, comprovante de residência e uma selfie segurando o documento.',
      'Acompanhe pelo número do protocolo e baixe o e-Título depois da aprovação.',
    ],
    note: 'O cadastro eleitoral fecha 150 dias antes de cada eleição.',
    sources: [
      { name: 'Tribunal Superior Eleitoral', path: 'tse/titulo' },
    ],
  },
  {
    id: 'mei',
    category: 'empresas',
    question: 'Como abrir um MEI?',
    keywords: ['mei', 'microempreendedor', 'cnpj', 'abrir empresa', 'das', 'empreender'],
    summary:
      'A formalização como Microempreendedor Individual é gratuita e feita 100% online. O limite de faturamento é de R$ 81.000,00 por ano e você paga uma guia mensal fixa (DAS) de cerca de R$ 76 a R$ 81, dependendo da atividade.',
    steps: [
      'Entre no Portal do Empreendedor com uma conta gov.br nível prata ou ouro.',
      'Escolha "Quero ser MEI" e depois "Formalize-se".',
      'Informe a ocupação, o endereço comercial e a forma de atuação.',
      'Pronto: o CNPJ e o Certificado da Condição de MEI (CCMEI) saem na hora.',
    ],
    note: 'Todo ano, até 31 de maio, o MEI deve entregar a Declaração Anual de Faturamento (DASN-SIMEI).',
    sources: [
      { name: 'Portal do Empreendedor', path: 'empreendedor/mei' },
      { name: 'Receita Federal', path: 'receita/simples-nacional' },
    ],
  },
  {
    id: 'cnh-renovar',
    category: 'transito',
    question: 'Como renovar a CNH?',
    keywords: ['cnh', 'carteira de motorista', 'renovar', 'habilitacao', 'detran', 'cnh digital', 'carteira de habilitacao'],
    summary:
      'A renovação da CNH é feita pelo Detran do seu estado. A validade é de 10 anos para quem tem até 49 anos, 5 anos dos 50 aos 69 e 3 anos a partir dos 70. Você pode dirigir com a CNH vencida por até 30 dias.',
    steps: [
      'Acesse o site do Detran do seu estado e inicie a renovação.',
      'Pague as taxas (variam por estado, geralmente entre R$ 100 e R$ 300).',
      'Agende e faça o exame médico em uma clínica credenciada.',
      'Depois da aprovação, a nova CNH aparece no app Carteira Digital de Trânsito.',
    ],
    sources: [
      { name: 'Secretaria Nacional de Trânsito', path: 'senatran/cnh' },
      { name: 'Detran estadual', path: 'estados/detran' },
    ],
  },
  {
    id: 'multas',
    category: 'transito',
    question: 'Como consultar e pagar multas de trânsito?',
    keywords: ['multa', 'multas', 'infracao', 'pontos', 'cnh pontos', 'sne', 'desconto multa'],
    summary:
      'Você pode consultar multas e pontos pelo app Carteira Digital de Trânsito. Quem adere ao Sistema de Notificação Eletrônica (SNE) recebe as notificações pelo app e tem 40% de desconto se pagar sem recorrer.',
    steps: [
      'Baixe o app Carteira Digital de Trânsito e entre com a conta gov.br.',
      'Ative o SNE em "Infrações" e "Notificações".',
      'Consulte as multas por veículo ou por condutor.',
      'Pague via Pix ou boleto direto no app, ou apresente recurso dentro do prazo.',
    ],
    sources: [
      { name: 'Secretaria Nacional de Trânsito', path: 'senatran/infracoes' },
    ],
  },
  {
    id: 'conta-gov',
    category: 'documentos',
    question: 'Como subo minha conta gov.br para o nível ouro?',
    keywords: ['gov.br', 'conta gov', 'nivel ouro', 'nivel prata', 'senha gov', 'login', 'acesso'],
    summary:
      'A conta gov.br tem três níveis: bronze, prata e ouro. O nível ouro libera todos os serviços digitais e pode ser obtido pela validação facial com a base da CNH ou da CIN, ou com um certificado digital.',
    steps: [
      'Abra o app gov.br e entre na sua conta.',
      'Toque em "Aumentar nível" na tela inicial.',
      'Escolha "Reconhecimento facial" e siga as instruções da câmera.',
      'Se a foto for aprovada, a conta vira ouro na mesma hora.',
    ],
    note: 'Também é possível subir para prata pelo internet banking de bancos credenciados.',
    sources: [
      { name: 'Ministério da Gestão e Inovação', path: 'gestao/conta-gov' },
    ],
  },
  {
    id: 'bpc',
    category: 'beneficios',
    question: 'Quem tem direito ao BPC/LOAS?',
    keywords: ['bpc', 'loas', 'deficiencia', 'idoso', 'beneficio de prestacao continuada', 'salario minimo'],
    summary:
      'O Benefício de Prestação Continuada paga um salário mínimo (R$ 1.518,00) por mês a pessoas idosas com 65 anos ou mais e a pessoas com deficiência de qualquer idade, desde que a renda familiar seja de até 1/4 do salário mínimo por pessoa.',
    steps: [
      'Faça ou atualize a inscrição no Cadastro Único.',
      'Peça o benefício pelo Meu INSS ou pelo telefone 135.',
      'Pessoas com deficiência passam por avaliação médica e social.',
      'Acompanhe o resultado em "Consultar Pedidos".',
    ],
    note: 'O BPC não é aposentadoria: não paga 13º e não gera pensão por morte.',
    sources: [
      { name: 'INSS', path: 'inss/bpc' },
      { name: 'Ministério do Desenvolvimento Social', path: 'mds/bpc' },
    ],
  },
  {
    id: 'correios-endereco',
    category: 'documentos',
    question: 'Como atualizo meu endereço nos órgãos do governo?',
    keywords: ['endereco', 'mudanca', 'mudei', 'atualizar endereco', 'cep', 'correios'],
    summary:
      'Ainda não existe um único lugar para mudar seu endereço em todos os órgãos. Os principais são a Receita Federal (CPF), a Justiça Eleitoral (transferência de título), o Detran (CNH e veículo) e o INSS.',
    steps: [
      'CPF: altere pelo portal da Receita Federal, em "Atualizar CPF".',
      'Título de eleitor: peça a transferência no Autoatendimento Eleitoral (é preciso morar há 3 meses no novo endereço).',
      'Veículo e CNH: atualize no Detran em até 30 dias.',
      'INSS: altere pelo Meu INSS em "Atualizar dados cadastrais".',
    ],
    note: 'Em breve: atualização de endereço em todos os órgãos com um só pedido.',
    sources: [
      { name: 'Receita Federal', path: 'receita/cpf/atualizar' },
      { name: 'Tribunal Superior Eleitoral', path: 'tse/transferencia' },
    ],
  },
]

const extra = import.meta.glob<{ default: Answer[] }>(['./data/*.json', '!./data/variants-base.json'], { eager: true })
const variants = baseVariants as Record<string, string[]>

const seen = new Set<string>()
export const ANSWERS: Answer[] = [
  ...BASE.map((a) => ({ ...a, variants: variants[a.id] ?? [] })),
  ...Object.values(extra).flatMap((m) => m.default),
].filter((a) => !seen.has(a.id) && seen.add(a.id))

export const QUESTION_COUNT = ANSWERS.reduce((n, a) => n + 1 + (a.variants?.length ?? 0), 0)

export const SUGGESTED = ['cin-rg', 'passaporte', 'imposto-renda', 'aposentadoria', 'bolsa-familia', 'mei']

const baseIds = new Set(BASE.map((a) => a.id))
const index = createIndex(ANSWERS, (a) => (baseIds.has(a.id) ? 1.08 : 1))

// "passaporte e título de eleitor": answer each part when every part has a strong, distinct match
function multiPart(query: string): Answer[] | null {
  const split = (re: RegExp) => query.split(re).filter((p) => index.tokenize(p).length)
  let parts = split(/\s+e\s+|;|\+|\s+tambem\s+|\s+também\s+/i)
  // commas usually add context ("sou autônomo, preciso declarar?"); only split short lists ("cnh, ipva e licenciamento")
  const withCommas = split(/,|\s+e\s+|;|\+/i)
  if (withCommas.length > parts.length && withCommas.every((p) => p.trim().split(/\s+/).length <= 3)) parts = withCommas
  if (parts.length < 2) return null
  const picks: Answer[] = []
  for (const p of parts) {
    const top = index.search(p, 1)[0]
    if (!top || top.score < 10 || !confident(top, index.tokenize(p).length)) return null
    if (!picks.includes(top.doc)) picks.push(top.doc)
  }
  return picks.length > 1 ? picks.slice(0, 3) : null
}

export function findAnswer(query: string): { best: Answer[]; related: Answer[] } {
  const hits = index.search(query, 8)
  const parts = multiPart(query)
  if (parts) return { best: parts, related: hits.filter((h) => !parts.includes(h.doc)).slice(0, 3).map((h) => h.doc) }
  if (!confident(hits[0], index.tokenize(query).length)) return { best: [], related: hits.slice(0, 3).map((h) => h.doc) }
  const best = splitTopics(hits).map((h) => h.doc)
  const related = hits.filter((h) => !best.includes(h.doc)).slice(0, 3).map((h) => h.doc)
  return { best, related }
}

// typeahead: one row per topic, showing the phrasing closest to what the user typed
export function suggest(query: string, limit = 6): Hit<Answer>[] {
  if (query.trim().length < 2) return []
  return index.search(query, limit).filter((h) => h.score > 1.2)
}
