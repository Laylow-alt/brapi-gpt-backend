BrAPI Backend for GPT (Render Free Migration) ⚠️ Versão Única / Sem Manutenção Futura

🇧🇷 Português
Visão Geral

Este projeto é um backend em Node.js + TypeScript + Express que funciona como middleware entre um GPT personalizado e a API pública da B3 (via brapi.dev). Ele fornece endpoints para cotação de ações, histórico de dividendos e simulação de renda passiva (tanto para um ativo quanto para uma carteira). Utiliza cache configurável e lógica de fallback para reduzir requisições externas e melhorar a confiabilidade.

⚠️ Importante: Este projeto foi desenvolvido como uma versão única, sem compromisso de manutenção, correções ou novas versões no futuro. Use por sua própria conta e risco. Se você gostou e quiser contribuir financeiramente como forma de gratidão ou apoio — agradeço de coração.

Funcionalidades

GET /quote?ticker=... — cotação e dados essenciais de um ativo.

GET /dividends?ticker=...&periodoMeses=... — histórico de proventos.

POST /renda-passiva — simulação de crescimento e renda passiva mensal de um ativo com aporte mensal.

POST /carteira-renda-passiva — simulação para uma carteira diversificada com pesos definidos e aporte mensal total.

Cache com TTL configurável para reduzir uso da API externa.

Fallback automático quando dados completos não estão disponíveis (útil para planos gratuitos da brapi.dev).

Deploy no Render (plano Free)

Pré-requisitos:

Node.js (recomenda-se v20)

Conta no GitHub

Variáveis de ambiente (no painel da Render):

- `BRAPI_TOKEN` — token da brapi.dev (opcional se usar apenas tickers públicos).
- `CACHE_TTL_MS` — duração do cache em milissegundos (padrão: 300000 = 5 min).
- `ENABLE_CACHE_STATS` — `true` para habilitar `/cache-stats` (depuração).
- `ALLOWED_ORIGINS` — origens permitidas (CSV), ex: `https://chat.openai.com,https://seu-site.com`. Vazio = libera todos.
- `ENABLE_CORS_RESTRICT` — `true` para restringir CORS às origens informadas; `false`/omitido = libera todos.
- `RATE_LIMIT_WINDOW_MS` — janela do rate limit (padrão: 60000).
- `RATE_LIMIT_MAX` — máximo de requisições por IP por janela (padrão: 60).
- `ENABLE_RATE_LIMIT` — `true` para habilitar o rate limit; `false` para desabilitar.

Comandos de build/start:

```pwsh
npm install
npm run build
npm start
```

Etapas de deploy:

Fazer push do código para o branch main no GitHub.

Criar um Web Service na Render apontando para este repositório, definindo instância como Free.

Adicionar as variáveis de ambiente necessárias.

Aguardar a build e deploy — Render fornecerá a URL pública do serviço.

Exemplos de uso

Cotação (GET):

```http
GET /quote?ticker=PETR4
```

Dividendos (GET):

```http
GET /dividends?ticker=VALE3&periodoMeses=12
```

Simulação renda passiva — ativo único (POST):

```json
POST /renda-passiva
{
	"ticker": "ITUB4",
	"aporteMensal": 500,
	"anos": 10
}
```

Simulação carteira (POST):

```json
POST /carteira-renda-passiva
{
	"ativos": [ { "ticker": "TAEE11", "peso": 50 }, { "ticker": "ITUB4", "peso": 50 } ],
	"aporteMensalTotal": 1000,
	"anos": 15
}
```

Integração com GPT / OpenAPI

- Edite o arquivo `openapi.yaml`, atualizando `servers.url` para a URL pública do seu serviço Render.
- Importe o schema por URL (recomendado): `https://brapi-gpt-backend.onrender.com/openapi.yaml`.
- Alternativa: copie/cole o conteúdo do `openapi.yaml` nas Actions do GPT.

Doações / Apoio

Se você usou este projeto e achou útil, e quiser contribuir com uma doação por gratidão ou apoio — ficarei muito grato. A contribuição é completamente opcional e não implica em compromissos de manutenção ou atualizações futuras.

🎁 Perfis de doação:

- GitHub Sponsors: https://github.com/sponsors/Laylow-alt
- Patreon: https://www.patreon.com/cw/Laylow_alt
- Post de agradecimento: https://www.patreon.com/posts/obrigado-por-e-144421080

Mensagem de agradecimento (PT):
> Muito obrigado por apoiar este projeto! Seu suporte mantém o backend online e viabiliza melhorias e manutenção. — Laylow-alt

🇬🇧 English
Overview

This is a Node.js + TypeScript + Express backend acting as a middleware between a custom GPT and the public B3 stock market API (brapi.dev). It provides endpoints for stock quotes, dividend history, and passive-income simulation (single asset or portfolio). It includes configurable cache and fallback logic to reduce external API usage and improve reliability.

⚠️ Important: This project was built as a one-time release, with no commitment to maintenance, bug fixes, or future versions. Use it at your own risk. If you appreciate the work and wish to send a donation — your support is deeply appreciated.

Features

GET /quote?ticker=... — returns quote and basic data of an asset.

GET /dividends?ticker=...&periodoMeses=... — returns dividend history.

POST /renda-passiva — simulates growth and monthly passive income from a single asset with monthly contributions.

POST /carteira-renda-passiva — simulates a diversified portfolio with defined weights and total monthly contribution.

Configurable cache with TTL to minimize calls to external API.

Automatic fallback when advanced data is unavailable (useful when using free plan of brapi.dev).

Deploy on Render (Free Tier)

Prerequisites:

Node.js (recommended v20)

GitHub account

Environment Variables (in Render dashboard):

- `BRAPI_TOKEN` — your brapi.dev token (optional for public tickers).
- `CACHE_TTL_MS` — cache TTL in milliseconds (default 300000 = 5 minutes).
- `ENABLE_CACHE_STATS` — `true` to enable `/cache-stats` (debugging).
- `ALLOWED_ORIGINS` — allowed origins (CSV), e.g., `https://chat.openai.com,https://your-site.com`. Empty = allow all.
- `ENABLE_CORS_RESTRICT` — `true` to restrict CORS to `ALLOWED_ORIGINS`; `false`/unset = allow all.
- `RATE_LIMIT_WINDOW_MS` — rate limit window (default: 60000).
- `RATE_LIMIT_MAX` — max requests per IP per window (default: 60).
- `ENABLE_RATE_LIMIT` — `true` to enable; `false` to disable.

Build / Start Commands:

```pwsh
npm install
npm run build
npm start
```

Deployment Steps:

Push code to main branch on GitHub.

Create a Web Service in Render pointing to this repository; select Free instance.

Add the required environment variables.

Wait for build and deployment — Render will give you a public URL.

Usage Examples

```http
GET /quote?ticker=PETR4
GET /dividends?ticker=VALE3&periodoMeses=12
```

```json
POST /renda-passiva
{
	"ticker": "ITUB4",
	"aporteMensal": 500,
	"anos": 10
}
```

```json
POST /carteira-renda-passiva
{
	"ativos": [ { "ticker": "TAEE11", "peso": 50 }, { "ticker": "ITUB4", "peso": 50 } ],
	"aporteMensalTotal": 1000,
	"anos": 15
}
```

GPT / OpenAPI Integration

- Update `servers.url` in `openapi.yaml` to your public Render service URL.
- Import the schema via URL (recommended): `https://brapi-gpt-backend.onrender.com/openapi.yaml`.
- Alternatively, paste the content manually when needed.

Donations / Support

If you found this project useful and want to support it via donation — you are welcome and deeply appreciated. This support is purely optional and does not guarantee any ongoing maintenance or future updates.

🎁 Donation profiles:

- GitHub Sponsors: https://github.com/sponsors/Laylow-alt
- Patreon: https://www.patreon.com/cw/Laylow_alt

Thank-you message (EN):
> Thank you for supporting this project! Your support keeps the backend online and enables maintenance and improvements. — Laylow-alt