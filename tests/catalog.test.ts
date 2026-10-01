import { safeUrl } from '../src/helpers/safe-url.ts'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { parseCatalog, parseService } from '../src/lib/services/model.ts'

const root = new URL('../public/data/v1/', import.meta.url)
const catalog = parseCatalog(JSON.parse(await readFile(new URL('index.json', root), 'utf8')))

test('all catalog entries resolve to validated service records', async () => {
  const files = await readdir(new URL('services/', root))
  assert.equal(catalog.length, 5729)
  assert.equal(files.length, catalog.length)

  for (const summary of catalog) {
    const raw = JSON.parse(await readFile(new URL(`services/${summary.id}.json`, root), 'utf8'))
    const service = parseService(raw, summary.id)
    assert.equal(service.name, summary.name)
    assert.equal(service.url, summary.url)
    assert.equal(service.steps.length, raw.etapas.length)
  }
})

test('rejects malformed records, duplicate IDs, unsafe links and mismatched service files', () => {
  const entry = {
    id: 'https://servicos.gov.br/api/v1/servicos/1',
    nome: 'Serviço',
    orgao: 'Órgão',
    url: 'https://www.gov.br/servico',
  }
  assert.throws(() => parseCatalog([entry, entry]))
  assert.throws(() => parseCatalog([{ ...entry, id: '../../private' }]))
  assert.throws(() => parseService({ ...entry, orgao: { nomeOrgao: 'Órgão' }, etapas: [] }, '2'))
  assert.equal(safeUrl('javascript:alert(1)'), '')
  assert.equal(safeUrl('data:text/html,test'), '')
  assert.equal(safeUrl('//example.com'), '')
  assert.equal(safeUrl('https://user:password@example.com'), '')
  assert.equal(safeUrl('https://www.gov.br/servico'), 'https://www.gov.br/servico')
})

test('preserves conditional documents, costs, channels and variable costs', () => {
  const service = parseService(
    {
      id: 'https://servicos.gov.br/api/v1/servicos/1',
      nome: 'Serviço',
      orgao: { nomeOrgao: 'Órgão' },
      url: 'https://www.gov.br/servico',
      etapas: [
        {
          titulo: 'Solicitar',
          custos: {
            custos: [{ moeda: 'R$', valor: '0', valorVariavel: '75,00', statusCustoVariavel: 1 }],
            casos: [{ descricao: 'Isenção', custo: [{ descricao: 'Sem cobrança' }] }],
          },
          documentos: {
            casos: [{ descricao: 'Menor', documento: [{ descricao: 'Autorização' }] }],
          },
          canaisDePrestacao: {
            casos: [
              {
                descricao: 'Ajuda',
                canalDePrestacao: [{ descricao: '[Contato](https://www.gov.br/contato)' }],
              },
            ],
          },
        },
      ],
    },
    '1',
  )
  assert.deepEqual(
    service.steps[0].groups.map((group) => group.entries),
    [['Autorização'], ['R$ 75,00'], ['Sem cobrança'], ['[Contato](https://www.gov.br/contato)']],
  )
})
