# Brasil.gov

An independent interface for exploring Brazilian public services from the gov.br catalog. **This is not an official government website.** The chat displays real catalog records, including service descriptions, requirements, steps, costs, and official links.

Live site: https://brasil-gov.vercel.app

## Development

Use Node.js 22.13+ and pnpm 11.

```sh
pnpm install
pnpm dev
```

```sh
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm build
```

Run `pnpm lint:fix` to apply automatic lint fixes and `pnpm format` to format the source. `pnpm typecheck` checks the application, scripts, tests, and Vite configuration without building the production bundle. `pnpm build` regenerates retrieval artifacts before compiling the application.

Deploy with `vercel deploy --prod`.

## How the chat works

1. Enter a service or agency name, or choose an example. Both the home page and chat show floating suggestions after two characters, with a 180 ms debounce. The list loads ten services at a time as you scroll, without moving the input. Suggestions match word prefixes, accents, and catalog aliases. Use the arrow keys and Enter to select, or Escape to dismiss. Selecting a suggestion opens that exact service by ID; submitting without selecting searches your original query.
2. A Web Worker loads the generated search index on the first search. It ranks service names, aliases, keywords, agencies, and passage text, ignoring accents and common question words. Results are paginated in groups of eight.
3. The worker retrieves relevant passages for the question. Ambiguous searches ask the user to choose a service; selecting a result updates the context and shows its full details. Up to three related services appear below the details when matches are available.
4. Follow-up questions such as “E quanto custa?” use the most recent expanded service. A question naming another service starts a new search.

The chat presents source records and prepares context for a future model. It does not generate AI answers yet. Consult the official page for current requirements, fees, and deadlines.

## Retrieval for AI

`scripts/build-retrieval.ts` derives a weighted inverted index and **67,488 passages** from the 5,729 service records. The index is about **7.78 MB**, or **2.30 MB with gzip**; passage files load only for selected candidates. HTTP compression depends on the hosting configuration.

```sh
pnpm data:build      # Regenerate index, passages, and content revision
pnpm data:check      # Verify generated files without writing
pnpm data:benchmark  # Measure local initialization, ranking, and context caching
```

Search uses weighted lexical matching and term rarity, with a small Portuguese alias dictionary. It recognizes questions about documents, eligibility, costs, deadlines, steps, and contact channels. Simple questions mentioning multiple services can retrieve evidence for each. This is not semantic search: unfamiliar paraphrases and spelling errors may need a more specific query.

Passages follow source sections and preserve the text of conditions, exceptions, and conditional cases together. Every passage includes a stable ID, service ID, source JSON pointer, section, and official service URL. Selected passages retain source order. No model rewrites or summarizes the dataset during indexing.

The worker client's `retrieveContext({ question, selectedServiceId?, budget? })` returns ranked services, passages, a serialized JSON `context`, its character count, omitted passage count, missing sections, and one of three statuses:

| Status                  | Meaning                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
| `ready`                 | Selected evidence covers the requested sections and recognized modifiers. |
| `needs_clarification`   | The service is missing or competing matches need a user selection.        |
| `insufficient_evidence` | No match, missing evidence, or the context budget prevents coverage.      |

Default limits are **12,000 characters, eight passages, and three services**. Limits include source metadata; passages are kept whole or omitted. These are character limits, not model token limits. `ready` is a retrieval heuristic, not proof that the evidence answers every possible interpretation. The model integration must respect the status, omitted evidence, and sources; tokenizer-specific budgeting belongs to that stage.

Question fixtures in `tests/fixtures/retrieval-questions.json` check service selection, expected passages, conditional requirements, ambiguity, follow-ups, and unrelated questions. Additional tests cover all generated passages against source records, revision validation, budgets, caching, failures, and stale reducer responses. The benchmark runs in Node against local files; it does not measure network latency, browser rendering, or mobile performance.

## Estimated completion date

The catalog publishes deadlines as amounts and units (`tempoTotalEstimado`), not as dates. `src/lib/services/deadline.ts` turns one into the date range a request filed today is estimated to finish in, and the service page shows it under the published deadline.

```sh
pnpm data:holidays   # Regenerate public/data/v1/holidays.json from BrasilAPI
pnpm data:check      # Verify generated retrieval and holiday data without writing
```

`estimateDeadline(start, parsedDuration, holidays)` is pure, and `start` plus the holiday calendar always come from the caller. Dates are civil dates (`YYYY-MM-DD`), never `Date` instances read in the host time zone; the only place a time zone is used is `today()`, which asks for the current calendar day in `America/Sao_Paulo`.

| Unit            | Rule                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| `dias-uteis`    | Counts from the next day, skipping Saturdays, Sundays, and national holidays |
| `dias-corridos` | Calendar days                                                                |
| `meses`         | Calendar months, clamped to the last day of a shorter month                  |
| `horas`         | Same day up to 24 hours, otherwise calendar days rounded up                  |
| `minutos`       | Same day up to a full day, otherwise calendar days rounded up                |

`ate` gives one date, `entre` gives a range, and `emMedia` is labelled as an average instead of a limit. Immediate service, `naoEstimadoAinda`, and the nine records whose amount carries an empty unit produce no date.

**Coverage.** Of the 5,729 services, 2,310 publish no amount at all, 698 are immediate, 2,322 publish days, and 390 publish months, hours, or minutes. The estimate is therefore absent on roughly 40% of the pages by design, and the published deadline still shows.

### Holidays

`public/data/v1/holidays.json` is generated and versioned, covering 2026 to 2032 — a fixed range, because a range derived from the current date would go stale every 1 January. Business-day counting does not depend on it: every national holiday falls on a fixed calendar date, so `isNationalHoliday()` answers for any year and the dataset can only add to that set. A deadline landing in 2040 still deducts Christmas.

Only the nine national holidays set by federal law count as non-business days (Leis 662/1949, 6.802/1980, 10.607/2002 and 14.759/2023). **Ponto facultativo is not deducted:** [BrasilAPI](https://brasilapi.com.br/api/feriados/v1/2026) reports Carnaval, Corpus Christi, Sexta-feira da Paixão, and Páscoa as `national`, but the first two are ponto facultativo, the third depends on municipal law (Lei 9.093/1995, art. 2), and the fourth is a Sunday. They are kept in the dataset as `opcional` for transparency and count as business days, which makes the estimate shorter rather than longer. State and municipal holidays are not considered at all.

`src/lib/services/holidays.ts` is the authority and the aggregator is a cross-check: the builder warns when BrasilAPI omits a legal holiday, and `parseHolidays` refuses a calendar that is missing one, so a holiday can never silently be counted as a business day. If the dataset cannot be read, the MCP server falls back to the calendar derived from the law.

The estimate is presented as an estimate. It does not replace the official deadline, which can be suspended, interrupted, or changed by the agency.

## State, loading, and cache

- One chat reducer handles input, searches, pagination, selected services, loading, errors, and reset. Request IDs prevent late responses from replacing newer results. Async work starts in event handlers; effects handle session lifecycle and scrolling.
- The search index stays in a worker, outside the React render path. The worker sends the current result page and bounded context to the reducer. Service details and the Markdown renderer load on demand; the full dataset is never bundled or downloaded at once.
- Autocomplete uses the same catalog worker as chat searches and caches its latest 40 queries. It reads only the index and does not fetch service records or passages while typing. New input, dismissal, and navigation invalidate pending suggestions; the home page creates its worker only when a query is eligible.
- Concurrent requests share a promise. Service records use a 32-entry memory LRU and up to 81 Cache Storage entries. Retrieval uses a separate revision namespace, eight memory entries, and up to 49 persistent entries, including the index. Both loaders use a 24-hour TTL and a 20-second network timeout. Cache failures fall back to network and memory; failed or invalid responses are not stored.
- The worker caches 24 context results by question, selected service, and budget. Passage downloads run in batches of at most three per retrieval. The generated content revision prevents mixing artifacts from different dataset exports; mismatched files are rejected.
- The conversation keeps the latest 12 searches in memory, with eight results and at most one expanded service per search. It is not persisted. Reset and navigation dispose the worker; already fetched public data can remain cached.
- Service record cache keys include the dataset revision in `src/lib/services/model.ts`. When replacing the dataset, update that revision and collection date, then regenerate retrieval artifacts. Retrieval revisions are content hashes generated automatically. Expired data needs a connection; there is no complete offline-app guarantee.
- Markdown and embedded HTML from the API are parsed and sanitized before rendering; scripts, unsafe attributes, and remote images are not rendered. Links accept only HTTP(S). No generated answers, simulated streaming, or placeholder source links are used.

## Structure

```text
src/
  main.tsx                        DOM mounting
  application.tsx                 Application entry point and error boundary
  pages/                          Home and chat page composition
  routes/                         Route selection and browser navigation
  components/
    layout/                       Header, logo, banner, and footer
    home/                         Home sections and illustrations
    services/                     Search results and service details
    reveal.tsx                    Visibility animation
  hooks/use-chat.ts                Async commands and session lifecycle
  hooks/use-holidays.ts            Shared holiday calendar loading
  reducers/chat-reducer.ts         Conversation state and transitions
  lib/services/                   Service validation, loading, deadlines, and worker protocol
  lib/retrieval/                  Query analysis, ranking, passages, and context
  lib/json-cache.ts               Shared bounded JSON loader
  lib/photo-credits.ts            On-demand photo credit loading
  helpers/                        Shared URL validation
  styles/global.css               Application styles
public/
  photo-credits.json              Photo attribution, fetched when expanded
  data/v1/index.json              5,729 service summaries (about 2.15 MB)
  data/v1/services/<id>.json       Individual source records
  data/v1/retrieval/              Generated index, revision manifest, and passages
  data/v1/holidays.json           Generated national holidays for 2026-2032
scripts/                         Reproducible retrieval and holiday builds, benchmark
mcp/                             MCP server (stdio and Streamable HTTP)
tests/                           Dataset, retrieval, reducer, and cache checks
```

The loader derives service paths from validated IDs because the index's `arquivo` field uses the original `servicos/` directory name. Tests in `tests/` cover dataset integrity, catalog navigation, reducer races, and cache behavior. Photos under `public/img` are from Wikimedia Commons, with credits in `public/photo-credits.json` and the footer.

All source filenames use **kebab-case**. Components and types use **PascalCase**; functions, hooks, and variables use **camelCase**; module constants use **UPPER_SNAKE_CASE**. Use one variable declaration per statement and blank lines between functions and between declarations, validations, and returns. Prettier handles formatting; these separations remain part of the coding convention. Interface icons use named imports from `lucide-react`; the original Brazilian flag remains a brand asset in `public/brazil-flag.svg`. `application.tsx` composes the router and error boundary; chat state stays local to its page, so no global Context provider is needed.

## MCP server

`mcp/` exposes the catalog to Claude, Codex, and any [Model Context Protocol](https://modelcontextprotocol.io) client. It reuses the same retrieval engine as the chat, is read-only, and needs no API key. Installation instructions for each client and the full tool reference are at [`/mcp`](https://brasil-gov.vercel.app/mcp).

The hosted endpoint needs no clone: `https://brasil-gov.vercel.app/mcp` (Streamable HTTP, stateless). `api/mcp.ts` runs it as a Vercel function, reading the published catalog; `vercel.json` routes `/mcp` requests that accept JSON or event streams to the function, while browsers get the documentation page.

```sh
claude mcp add --scope user --transport http brasil-gov https://brasil-gov.vercel.app/mcp
```

To run it yourself:

```sh
pnpm mcp                    # stdio, reads public/data/v1 from this clone
pnpm mcp --remote           # stdio, reads the published catalog from brasil-gov.vercel.app
pnpm mcp:http --port 3333   # Streamable HTTP (stateless) at http://127.0.0.1:3333/mcp
claude mcp add --scope user brasil-gov -- node --experimental-strip-types --no-warnings "$PWD/mcp/main.ts"
```

| Tool                      | Purpose                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| `search_services`         | Ranked, paginated search by name, agency, alias, or keyword                              |
| `get_service`             | Normalized record: steps, documents, costs, deadlines, channels, audiences               |
| `get_service_section`     | Passages of one section with their source JSON pointer                                   |
| `retrieve_context`        | Question → cited passages plus `ready` / `needs_clarification` / `insufficient_evidence` |
| `list_agencies`           | Agencies with service counts, optional filter                                            |
| `list_services_by_agency` | Services of one agency                                                                   |
| `get_status`              | Hourly availability of federal systems, Detrans, states, capitals, and catalog hosts     |
| `estimate_deadline`       | Published deadline → estimated completion date, counting business days and holidays      |
| `catalog_info`            | Provenance, collection date, revisions, and counts                                       |

Resources: `brasil-gov://catalog` and `brasil-gov://services/{id}` (the original API record). Prompt: `answer_with_sources`. Tool names and descriptions live in `src/lib/mcp/manifest.ts`, shared by the server and the `/mcp` page; `tests/mcp.test.ts` checks that both stay in sync.

## Status page

`/status` shows whether public systems are reachable: 23 federal platforms, the 27 Detrans, the 27 state governments, the 27 state-capital city halls (`status/curated.ts`), and the 835 distinct hosts behind the catalog's digital-service links (`status/targets.json`, built by `pnpm status:targets`). Each catalog host lists the services that depend on it.

`.github/workflows/status.yml` runs hourly. It calls `api/status-check.ts`, a Vercel function pinned to São Paulo (`gru1`) because many `.gov.br` sites block foreign IPs, and pushes `latest.json` and a 7-day `history.json` to the `status-data` branch. The page reads that branch from raw.githubusercontent.com and falls back to the snapshot in `public/data/status/`. Run `pnpm status:check` to check locally.

The function requires a `STATUS_TOKEN` environment variable on Vercel, and the same value as a GitHub Actions secret.

## Next stages

Dataset organization, real-service chat navigation, and passage retrieval are implemented. Remaining stages are isolated browser model execution, connecting retrieved context to model generation in the chat, and broader desktop/mobile quality and performance validation.

## Data provenance

The raw data was collected on October 1, 2026, directly from the [Serpro production API](https://api-servicos.estaleiro.serpro.gov.br/servicos-json), which provides the gov.br Portal's public services catalog. See the [official API documentation](https://www.gov.br/conecta/catalogo/apis/api-de-servicos/).

- **Collection method:** HTTP GET using `curl`, without login or a token.
- **Response:** HTTP 200. The complete JSON was downloaded and validated: `hasErro` was `false`, and `resposta` contained **5,729 services**.
- **Raw response size:** 41,282,421 bytes.
- **Raw response SHA-256:** `d4f38eed2e9a77a499859ffe69c6e6f13754cc310e94e37514549b9b898d7619`.

The raw data came from a direct API download, with no page scraping, AI generation, or content changes. The collection date does **not** indicate when each service was last updated. Although this download succeeded without authentication, the official documentation states that querying the complete catalog requires credentials.

The dataset under `public/data/v1/` is organized into `index.json` (a service summary index) and `services/<id>.json` (5,729 individual service records). The export process uses Python's standard library to split the source records and build the index, preserving each service's JSON content while changing file organization and formatting. Its validation checks cover duplicate JSON keys, unique IDs and filenames, required fields, and equality between exported records and the source; the original file's SHA-256 is checked for changes during export.
