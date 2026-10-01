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

Run `pnpm lint:fix` to apply automatic lint fixes and `pnpm format` to format the source. `pnpm typecheck` checks the application and Vite configuration without building the production bundle.

Deploy with `vercel deploy --prod`.

## How the chat works

1. Enter a service or agency name, or choose an example. The home page forwards the query to the chat.
2. A Web Worker loads the catalog index on the first search and builds an inverted index over service and agency names. Search ignores accents and common question words; it shows eight results per page.
3. Select a result to fetch that service's record. Details include eligibility, ordered steps, documents, costs, conditional cases, contact channels, and links from the source.

This stage provides catalog navigation. It does not generate answers with AI or retrieve passages for a model. Try concise service names when a longer question returns no results. Missing information is identified explicitly; consult the official page for current requirements, fees, and deadlines.

## State, loading, and cache

- One chat reducer handles input, searches, pagination, selected services, loading, errors, and reset. Request IDs prevent late responses from replacing newer results. Async work starts in event handlers; effects handle session lifecycle and scrolling.
- The index stays in a worker, outside the React render path. Only the current result page is transferred to the UI. Service details and the Markdown renderer load on demand; the full dataset is never bundled or downloaded at once.
- Concurrent requests for the same record share a promise. Memory uses a 32-entry LRU cache. Cache Storage retains the index and up to 80 service records, with a 24-hour TTL. Cache failures fall back to network and memory; failed or invalid responses are not stored. Network requests time out after 20 seconds.
- The conversation keeps the latest 12 searches in memory, with eight results and at most one expanded service per search. It is not persisted. Reset and navigation dispose the worker; already fetched public data can remain cached.
- Cache keys include the dataset revision in `src/lib/services/model.ts`. When replacing the dataset, update that revision and collection date. Expired data needs a connection; there is no complete offline-app guarantee.
- Markdown and embedded HTML from the API are parsed and sanitized before rendering; scripts, unsafe attributes, and remote images are not rendered. Links accept only HTTP(S). No generated answers, simulated streaming, or placeholder source links are used.

## Structure

```text
src/
  main.tsx                         DOM mounting
  application.tsx                          Application entry point and error boundary
  pages/                           Home and chat page composition
  routes/                          Route selection and browser navigation
  components/
    layout/                        Header, logo, banner, and footer
    home/                          Home sections and illustrations
    services/                      Search results and service details
    reveal.tsx                     Visibility animation
  hooks/use-chat.ts                Async commands and session lifecycle
  reducers/chat-reducer.ts         Conversation state and transitions
  lib/services/                   Validation, cache, worker, and catalog search
  lib/photo-credits.ts             On-demand photo credit loading
  helpers/                        Shared URL validation
  styles/global.css               Application styles
public/
  photo-credits.json              Photo attribution, fetched when expanded
  data/v1/index.json                      5,729 service summaries (about 2.15 MB)
  data/v1/services/<id>.json           Individual service records
```

The loader derives service paths from validated IDs because the index's `arquivo` field uses the original `servicos/` directory name. Tests in `tests/` cover dataset integrity, catalog navigation, reducer races, and cache behavior. Photos under `public/img` are from Wikimedia Commons, with credits in `public/photo-credits.json` and the footer.

All source filenames use **kebab-case**. Components and types use **PascalCase**; functions, hooks, and variables use **camelCase**; module constants use **UPPER_SNAKE_CASE**. Use one variable declaration per statement and blank lines between functions and between declarations, validations, and returns. Prettier handles formatting; these separations remain part of the coding convention. Interface icons use named imports from `lucide-react`; the original Brazilian flag remains a brand asset in `public/brazil-flag.svg`. `application.tsx` composes the router and error boundary; chat state stays local to its page, so no global Context provider is needed.

## Next stages

Passage retrieval for AI, isolated browser model execution, integration with the chat, and broader desktop/mobile quality and performance validation remain separate tasks.

## Data provenance

The raw data was collected on October 1, 2026, directly from the [Serpro production API](https://api-servicos.estaleiro.serpro.gov.br/servicos-json), which provides the gov.br Portal's public services catalog. See the [official API documentation](https://www.gov.br/conecta/catalogo/apis/api-de-servicos/).

- **Collection method:** HTTP GET using `curl`, without login or a token.
- **Response:** HTTP 200. The complete JSON was downloaded and validated: `hasErro` was `false`, and `resposta` contained **5,729 services**.
- **Raw response size:** 41,282,421 bytes.
- **Raw response SHA-256:** `d4f38eed2e9a77a499859ffe69c6e6f13754cc310e94e37514549b9b898d7619`.

The raw data came from a direct API download, with no page scraping, AI generation, or content changes. The collection date does **not** indicate when each service was last updated. Although this download succeeded without authentication, the official documentation states that querying the complete catalog requires credentials.

The dataset under `public/data/v1/` is organized into `index.json` (a service summary index) and `services/<id>.json` (5,729 individual service records). The export process uses Python's standard library to split the source records and build the index, preserving each service's JSON content while changing file organization and formatting. Its validation checks cover duplicate JSON keys, unique IDs and filenames, required fields, and equality between exported records and the source; the original file's SHA-256 is checked for changes during export.
