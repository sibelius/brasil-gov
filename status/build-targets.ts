import { readdir, readFile, writeFile } from 'node:fs/promises'
import { safeUrl } from '../src/helpers/safe-url.ts'
import type { StatusTarget } from '../src/lib/status/types.ts'
import { curatedTargets } from './curated.ts'

const SERVICES = new URL('../public/data/v1/services/', import.meta.url)
const OUTPUT = new URL('./targets.json', import.meta.url)

type Host = {
  services: string[]
  urls: Map<string, number>
  agencies: Map<string, number>
}

function top(counts: Map<string, number>, limit: number) {
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limit)
    .map(([value]) => value)
}

export async function buildTargets(): Promise<StatusTarget[]> {
  const hosts = new Map<string, Host>()
  const files = (await readdir(SERVICES)).filter((file) => file.endsWith('.json')).sort()

  for (const file of files) {
    const raw = JSON.parse(await readFile(new URL(file, SERVICES), 'utf8'))
    const url = safeUrl(raw.linkServicoDigital)

    if (!url) {
      continue
    }

    const host = new URL(url).host.toLowerCase()
    const entry: Host = hosts.get(host) ?? { services: [], urls: new Map(), agencies: new Map() }
    const agency = String(raw.orgao?.nomeOrgao ?? '').trim()

    entry.services.push(file.replace('.json', ''))
    entry.urls.set(url, (entry.urls.get(url) ?? 0) + 1)

    if (agency) {
      entry.agencies.set(agency, (entry.agencies.get(agency) ?? 0) + 1)
    }

    hosts.set(host, entry)
  }

  const catalog: StatusTarget[] = [...hosts]
    .sort((a, b) => b[1].services.length - a[1].services.length || a[0].localeCompare(b[0]))
    .map(([host, entry]) => ({
      id: `catalogo:${host}`,
      group: 'catalogo',
      name: host,
      url: top(entry.urls, 1)[0],
      serviceIds: entry.services.sort((a, b) => Number(a) - Number(b)),
      agencies: top(entry.agencies, 3),
    }))

  return [...curatedTargets(), ...catalog]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const targets = await buildTargets()
  const next = `${JSON.stringify(targets)}\n`

  if (process.argv.includes('--check')) {
    const current = await readFile(OUTPUT, 'utf8').catch(() => '')

    if (current !== next) {
      console.error('status/targets.json está desatualizado. Rode pnpm status:targets.')
      process.exit(1)
    }
  } else {
    await writeFile(OUTPUT, next)
  }

  console.log(
    `${targets.length} alvos (${targets.filter((t) => t.group === 'catalogo').length} hosts do catálogo)`,
  )
}
