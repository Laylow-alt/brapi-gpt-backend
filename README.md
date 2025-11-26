# BrAPI Backend for GPT

Este projeto é uma Cloud Function no Firebase que atua como middleware entre GPTs personalizados e a API da B3 (brapi.dev). Ele fornece cotações, histórico de dividendos e simulações de renda passiva, com sistema de cache e tratamento de erros.

## Disclaimer (Aviso Legal)
⚠️ **Atenção**: As simulações de renda passiva geradas por esta API são **estimativas** baseadas em dados históricos (Dividend Yield dos últimos 12 meses). **Rentabilidade passada não é garantia de rentabilidade futura.** O mercado financeiro é volátil e os pagamentos de proventos podem variar.

## Funcionalidades

1.  **Cotação (/quote)**: Preço atual, variação, yield e setor.
2.  **Dividendos (/dividends)**: Histórico de proventos de um período.
3.  **Simulação Renda Passiva (/renda-passiva)**: Projeção de juros compostos para um ativo.
4.  **Simulação Carteira (/carteira-renda-passiva)**: Projeção consolidada para múltiplos ativos (com validação de pesos).
5.  **Cache**: Usa Firebase Realtime Database para economizar requisições à BrAPI.
6.  **Fallback**: Se os módulos avançados da BrAPI falharem (limite do plano free), tenta buscar apenas a cotação básica.

## Limitações da BrAPI (Plano Gratuito)
*   Limite de **15.000 requisições/mês**.
*   **1 ticker por requisição**.
*   Atraso de 15 a 30 minutos nas cotações.
*   *Nota*: Tickers de teste como `PETR4`, `VALE3`, `MGLU3` e `ITUB4` geralmente funcionam sem token e com mais dados disponíveis.

## Configuração e Deploy

### 1. Pré-requisitos
*   Node.js 20+
*   Firebase CLI (`npm install -g firebase-tools`)
*   Conta na [brapi.dev](https://brapi.dev)

### 2. Instalação
```bash
npm install
```

### 3. Variáveis de Ambiente
Configure o token da BrAPI e o tempo de cache.

**Opções de configuração:**

*   `BRAPI_TOKEN`: Seu token de acesso (Bearer).
*   `CACHE_TTL_MS`: Tempo de vida do cache em milissegundos. Padrão: `300000` (5 minutos).

**Local (.env):**
```env
BRAPI_TOKEN=seu_token_aqui
CACHE_TTL_MS=300000
```

**Produção (Firebase Config):**
```bash
firebase functions:config:set brapi.token="SEU_TOKEN" brapi.cache_ttl="300000"
# Certifique-se que seu código acessa essas variaveis corretamente (via process.env ou functions.config())
# Neste projeto, usamos process.env, então certifique-se de passar as variáveis no deploy ou usar Secrets.
```

### 4. Deploy
```bash
npm run deploy
# ou
firebase deploy --only functions
```

Após o deploy, você receberá uma URL, por exemplo:
`https://us-central1-seu-projeto.cloudfunctions.net/api`

## Integração com GPT (OpenAI)

1.  Vá em **GPTs** > **Create/Configure** > **Actions**.
2.  Copie o conteúdo de `openapi.yaml`.
3.  **IMPORTANTE**: Substitua a URL em `servers` pela URL da sua função gerada no passo anterior.
    *   Substitua `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api` pela sua URL real.
4.  Authentication: **None** (O token da BrAPI é gerenciado pelo backend).

## Monitoramento
Verifique os logs no Console do Firebase para ver:
*   `[Cache Hit]`: Dados servidos do cache.
*   `[Cache Miss]`: Requisição feita à API.
*   `[Fallback Success]`: Uso do mecanismo de segurança quando a API principal falha.