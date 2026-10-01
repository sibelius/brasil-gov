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
