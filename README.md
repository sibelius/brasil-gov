# Brasil.gov (protótipo conceitual)

Exercício de design inspirado no America.gov: um só lugar para perguntar sobre serviços públicos no Brasil.
**Não é um site oficial.** Todas as respostas, valores e prazos são fictícios.

Produção: https://brasil-gov.vercel.app

## Rodando

```sh
pnpm install
pnpm dev
```

## Estrutura

- `src/data.ts` — temas base, categorias e `findAnswer` / `suggest`
- `src/data/*.json` — banco de perguntas por área (um tema = resposta completa + variações de como as pessoas perguntam)
- `src/search.ts` — busca no navegador: normalização de acentos e abreviações, tolerância a erros de digitação, IDF e perguntas com várias partes
- `public/img` — fotos da Wikimedia Commons (créditos em `src/credits.json` e no rodapé)

Deploy: `vercel deploy --prod`

## Data provenance

The raw data was collected on October 1, 2026, directly from the [Serpro production API](https://api-servicos.estaleiro.serpro.gov.br/servicos-json), which provides the gov.br Portal's public services catalog. See the [official API documentation](https://www.gov.br/conecta/catalogo/apis/api-de-servicos/).

- **Collection method:** HTTP GET using `curl`, without login or a token.
- **Response:** HTTP 200. The complete JSON was downloaded and validated: `hasErro` was `false`, and `resposta` contained **5,729 services**.
- **Raw response size:** 41,282,421 bytes.
- **Raw response SHA-256:** `d4f38eed2e9a77a499859ffe69c6e6f13754cc310e94e37514549b9b898d7619`.

The raw data came from a direct API download, with no page scraping, AI generation, or content changes. The collection date does **not** indicate when each service was last updated. Although this download succeeded without authentication, the official documentation states that querying the complete catalog requires credentials.

The dataset under `public/data/v1/` is organized into `index.json` (a service summary index) and `services/<id>.json` (5,729 individual service records). The export process uses Python's standard library to split the source records and build the index, preserving each service's JSON content while changing file organization and formatting. Its validation checks cover duplicate JSON keys, unique IDs and filenames, required fields, and equality between exported records and the source; the original file's SHA-256 is checked for changes during export.
