# BrAPI Backend for GPT (Render Free migration)

Este projeto é um backend Node.js + TypeScript + Express que funciona como middleware entre um GPT personalizado e a API pública da B3 (brapi.dev). Ele oferece endpoints para cotações, histórico de dividendos e simulações de renda passiva, com cache em memória e lógica de fallback.

## Aviso de Uso
⚠️ As simulações de renda passiva são estimativas baseadas em dados históricos. Rentabilidade passada não garante resultados futuros.

## Funcionalidades

- GET `/quote?ticker=...` — cotação e dados fundamentais.
- GET `/dividends?ticker=...&periodoMeses=...` — histórico de proventos.
- POST `/renda-passiva` — simulação para ativo único.
- POST `/carteira-renda-passiva` — simulação para carteira ponderada.
- Cache em memória com TTL configurável para reduzir chamadas à BrAPI.
- Fallback para chamadas básicas quando módulos avançados são restritos.

## Porque Render Free

O plano Free da Render permite deploys simples sem exigir faturamento (ao contrário do requisito Blaze do Firebase). Limitações naturais do plano Free:

- Instâncias podem dormir (cold start) quando inativas — espere latência na primeira requisição.
- Limite de recursos (memória/CPU) e tráfego externo — otimize chamadas externas.
- Requisições externas (BrAPI) têm limites; use cache para minimizar consumo.

## Configuração para Render

### 1. Pré-requisitos locais
- Node.js (recomendo usar Node 20 para parity com Render)
- Git e conta GitHub

### 2. Variáveis de ambiente (Render)

Adicione estas ENV vars no painel do serviço Render (Environment -> Add Environment Variable):

- `BRAPI_TOKEN` — seu token da brapi.dev
- `CACHE_TTL_MS` — TTL do cache em ms (padrão 300000 = 5 minutos)
- `MAX_CACHE_ENTRIES` — limite máximo de entradas no cache (padrão 500)
- `ENABLE_CACHE_STATS` — `true` para ativar `/cache-stats` (útil para depuração)

### 3. Build & Start (Render)

Ao criar um **Web Service** na Render, preencha:

- Language: `Node`
- Branch: `main`
- Build Command: `npm install && npm run build`
- Start Command: `npm start`  (usa `node lib/index.js`)
- Instance Type: `Free`

### 4. Deploy

1. Push seu código para GitHub (branch `main`).
2. Na Render, conecte o repositório e crie o Web Service conforme acima.
3. Adicione as Environment Variables citadas.
4. Acompanhe os logs — se tudo ok, a URL do serviço aparecerá (ex: `https://seu-servico.onrender.com`).

## Testes e endpoints (após deploy)

Exemplos rápidos:

GET cotação:
```
GET /quote?ticker=PETR4
```

GET dividendos:
```
GET /dividends?ticker=VALE3&periodoMeses=12
```

POST renda passiva (JSON):
```
POST /renda-passiva
{
    "ticker": "ITUB4",
    "aporteMensal": 500,
    "anos": 10
}
```

POST carteira (JSON):
```
POST /carteira-renda-passiva
{
    "ativos": [{"ticker":"TAEE11","peso":50},{"ticker":"ITUB4","peso":50}],
    "aporteMensalTotal": 1000,
    "anos": 15
}
```

Se `ENABLE_CACHE_STATS=true`, acessível apenas para você: `GET /cache-stats` retornará `{ hits, misses, entries }`.

## Notas sobre testes locais

- Use Node 20 para evitar incompatibilidades de tipos (recomendo `nvm`/`nvm-windows`).
- Para testar localmente:

```pwsh
npm install
npm run build
node lib/index.js
# então faça requisições para http://localhost:3000
```

Se o `tsc` falhar localmente por problemas com tipos de dependências (por exemplo `undici-types`) tente:

```pwsh
rm -r node_modules
rm package-lock.json
npm install --legacy-peer-deps
npm run build
```

## Integração com GPT (OpenAPI)

1. Abra `openapi.yaml` e atualize `servers` com o host do seu serviço Render (ou mantenha o placeholder para o GPT importar e ajustar).
2. Importe o `openapi.yaml` na plataforma de Actions do seu GPT e configure a URL.

## Observações finais — Free tier

- Expectativa: baixos custos (Zero se dentro do nível gratuito). Contudo, instâncias dormem e podem haver atrasos em cold start.
- Recomendo ativar logs e `ENABLE_CACHE_STATS` durante os primeiros dias para calibrar `CACHE_TTL_MS` e `MAX_CACHE_ENTRIES` conforme seu tráfego.

Se quiser, eu posso:
- (A) ajustar `CACHE_TTL_MS` e `MAX_CACHE_ENTRIES` por padrão para minimizar chamadas à BrAPI, ou
- (B) adicionar suporte por variável `BRAPI_BASE_URL` e documentação para trocar potências de cache.
Diga qual prefere e eu aplico as alterações.