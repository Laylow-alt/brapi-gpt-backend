import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import * as brapiService from "./services/brapiService";
import { 
  DividendResponse, 
  PassiveIncomeRequest, 
  PassiveIncomeResponse, 
  PortfolioRequest, 
  PortfolioResponse, 
  QuoteResponse 
} from "./services/types";

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp();
}

// Initialize Express App
const app = express();

// Middleware
app.use(cors({ origin: true }) as any);
app.use(express.json() as any);

// --- Endpoints ---

// 1. GET /api/quote
// Note: Since the function is exported as 'api', this route maps to /api/quote
app.get("/quote", async (req, res) => {
  try {
    const ticker = req.query.ticker as string;

    if (!ticker) {
      res.status(400).json({ error: "Parâmetro 'ticker' é obrigatório." });
      return;
    }

    const data = await brapiService.getStockData(ticker);

    if (!data) {
      // Should have been caught by 404 catch block, but double check
      res.status(404).json({ error: "Ticker não encontrado." });
      return;
    }

    // Calculate approximate DY if not provided explicitly
    const last12mDivs = brapiService.calculateHistoricalDividends(data, 12);
    const calculatedDy = (data.regularMarketPrice > 0) 
      ? (last12mDivs.total / data.regularMarketPrice) * 100 
      : 0;

    const response: QuoteResponse = {
      ticker: data.symbol,
      nome: data.shortName || data.symbol,
      precoAtual: data.regularMarketPrice || 0,
      variacaoPercentualDia: data.regularMarketChangePercent || 0,
      dividendYieldAtual: parseFloat(calculatedDy.toFixed(2)),
      ultimoFechamento: data.regularMarketPreviousClose || 0,
      volume: data.regularMarketVolume || 0,
      setor: data.sector || "N/A",
      logo: data.logourl || ""
    };

    res.json(response);
  } catch (error: any) {
    console.error(`Error in /quote for ticker ${req.query.ticker}:`, error);
    const status = error.response ? error.response.status : 500;
    
    if (status === 404 || status === 400) {
        res.status(404).json({ error: "Ticker não encontrado ou inválido." });
    } else if (status === 502 || status >= 503) {
        res.status(502).json({ error: "Serviço da BrAPI indisponível." });
    } else {
        res.status(500).json({ error: "Erro interno do servidor." });
    }
  }
});

// 2. GET /api/dividends
app.get("/dividends", async (req, res) => {
  try {
    const ticker = req.query.ticker as string;
    const periodoMeses = parseInt(req.query.periodoMeses as string) || 12;

    if (!ticker) {
      res.status(400).json({ error: "Parâmetro 'ticker' é obrigatório." });
      return;
    }

    const data = await brapiService.getStockData(ticker);

    if (!data) {
      res.status(404).json({ error: "Ticker não encontrado." });
      return;
    }

    const history = brapiService.calculateHistoricalDividends(data, periodoMeses);

    const response: DividendResponse = {
      ticker: data.symbol,
      periodoMeses,
      totalNoPeriodo: parseFloat(history.total.toFixed(2)),
      dividendos: history.items
    };

    res.json(response);
  } catch (error: any) {
    console.error(error);
    const status = error.response ? error.response.status : 500;
    if (status === 404) {
      res.status(404).json({ error: "Ticker não encontrado." });
    } else {
      res.status(502).json({ error: "Erro ao buscar dados de dividendos." });
    }
  }
});

// Helper for Simulation Logic
async function calculateAssetSimulation(
  ticker: string, 
  aporteMensal: number, 
  anos: number
): Promise<PassiveIncomeResponse> {
  const data = await brapiService.getStockData(ticker);
  
  if (!data) {
    throw new Error(`Ticker ${ticker} não encontrado`);
  }

  const price = data.regularMarketPrice || 0;
  // Use last 12 months dividends to estimate Annual Yield
  const last12m = brapiService.calculateHistoricalDividends(data, 12);
  const annualYield = price > 0 ? last12m.total / price : 0; // decimal format (e.g. 0.08 for 8%)
  
  // Simulation: Compound Interest with Monthly Contributions
  // Formula: FV = P * (((1 + r)^n - 1) / r)
  // Where r is monthly rate, n is total months
  
  // Convert annual yield to monthly geometric rate: (1 + annual)^(1/12) - 1
  const monthlyRate = Math.pow(1 + annualYield, 1/12) - 1;
  const totalMonths = anos * 12;

  let finalValue = 0;
  
  if (monthlyRate > 0) {
    finalValue = aporteMensal * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);
  } else {
    // If no yield, just linear accumulation
    finalValue = aporteMensal * totalMonths;
  }

  const estimatedShares = price > 0 ? Math.floor(finalValue / price) : 0;
  
  // Monthly passive income in the future
  const estimatedMonthlyIncome = finalValue * monthlyRate;

  // Magic Number: Cost needed to buy 1 share with dividends
  // Magic Number (Cotas) = Price / DividendPerShare = Price / (Price * Yield) = 1/Yield?
  // Actually Magic Number is when MonthlyIncome >= Price.
  // MonthlyIncome = Shares * Price * MonthlyRate. 
  // Shares * Price * MonthlyRate >= Price => Shares * MonthlyRate >= 1 => Shares >= 1/MonthlyRate.
  const magicNumberCotas = monthlyRate > 0 ? Math.ceil(1 / monthlyRate) : 0;

  return {
    ticker: data.symbol,
    aporteMensal,
    anos,
    precoAtual: price,
    dividendYieldAnual: parseFloat((annualYield * 100).toFixed(2)),
    cotasEstimadas: estimatedShares,
    patrimonioFinalEstimado: parseFloat(finalValue.toFixed(2)),
    rendaPassivaMensalEstimativa: parseFloat(estimatedMonthlyIncome.toFixed(2)),
    magicNumberCotas
  };
}

// 3. POST /api/renda-passiva
app.post("/renda-passiva", async (req, res) => {
  try {
    const { ticker, aporteMensal, anos } = req.body as PassiveIncomeRequest;

    // Validation: Check required fields and positive numbers
    if (!ticker || aporteMensal === undefined || !anos) {
      res.status(400).json({ error: "Campos obrigatórios: ticker, aporteMensal, anos" });
      return;
    }

    if (aporteMensal <= 0 || anos <= 0) {
      res.status(400).json({ error: "Aporte mensal e anos devem ser números positivos maiores que zero." });
      return;
    }

    const result = await calculateAssetSimulation(ticker, aporteMensal, anos);
    res.json(result);

  } catch (error: any) {
    console.error(error);
    const msg = error.message || "Erro na simulação";
    // Check if error message came from 404 throw
    const status = (error.response?.status === 404 || msg.includes("não encontrado")) ? 404 : 500;
    res.status(status).json({ error: msg });
  }
});

// 4. POST /api/carteira-renda-passiva
app.post("/carteira-renda-passiva", async (req, res) => {
  try {
    const { ativos, aporteMensalTotal, anos } = req.body as PortfolioRequest;

    // Validation: Check array and basic numbers
    if (!ativos || !Array.isArray(ativos) || aporteMensalTotal === undefined || !anos) {
      res.status(400).json({ error: "Body inválido. Requer 'ativos' (array), 'aporteMensalTotal', 'anos'" });
      return;
    }

    if (aporteMensalTotal <= 0 || anos <= 0) {
       res.status(400).json({ error: "Aporte total e anos devem ser números positivos maiores que zero." });
       return;
    }

    // Validation: Check weight sum (must be close to 100)
    const totalWeight = ativos.reduce((acc, item) => acc + (item.peso || 0), 0);
    // Allow slight float tolerance (99.0 - 101.0) due to potential UI rounding
    if (totalWeight < 99.0 || totalWeight > 101.0) {
      res.status(400).json({ error: `A soma dos pesos deve ser 100%. Total atual: ${totalWeight}%` });
      return;
    }

    const simulationPromises = ativos.map(async (item) => {
      // Calculate individual contribution based on weight
      const itemContribution = aporteMensalTotal * (item.peso / 100);
      return calculateAssetSimulation(item.ticker, itemContribution, anos);
    });

    const results = await Promise.all(simulationPromises);

    // Aggregation
    const totalPassiveIncome = results.reduce((sum, item) => sum + item.rendaPassivaMensalEstimativa, 0);
    const totalPatrimony = results.reduce((sum, item) => sum + item.patrimonioFinalEstimado, 0);
    
    // Calculate Weighted Average DY
    let weightedDySum = 0;
    ativos.forEach((ativo, index) => {
        weightedDySum += (results[index].dividendYieldAnual * (ativo.peso / 100));
    });

    const response: PortfolioResponse = {
      aporteMensalTotal,
      anos,
      dividendYieldMedioPonderado: parseFloat(weightedDySum.toFixed(2)),
      rendaPassivaMensalTotalEstimativa: parseFloat(totalPassiveIncome.toFixed(2)),
      patrimonioTotalEstimado: parseFloat(totalPatrimony.toFixed(2)),
      ativos: results
    };

    res.json(response);

  } catch (error: any) {
    console.error(error);
    const status = error.message?.includes("não encontrado") ? 404 : 500;
    res.status(status).json({ error: error.message || "Erro na simulação de carteira. Verifique se todos os tickers são válidos." });
  }
});

// Expose Express App as a single Cloud Function named 'api'
// Request URL will be: https://[region]-[project].cloudfunctions.net/api/[endpoint]
export const api = onRequest({ region: "us-central1" }, app as any);