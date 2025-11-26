"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const brapiService = __importStar(require("./services/brapiService"));
// Initialize Express App
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000; // Render uses the PORT env variable
// Middleware
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// --- Endpoints ---
// 1. GET /quote
app.get("/quote", async (req, res) => {
    try {
        const ticker = req.query.ticker;
        if (!ticker) {
            res.status(400).json({ error: "Parâmetro 'ticker' é obrigatório." });
            return;
        }
        const data = await brapiService.getStockData(ticker);
        if (!data) {
            res.status(404).json({ error: "Ticker não encontrado." });
            return;
        }
        const last12mDivs = brapiService.calculateHistoricalDividends(data, 12);
        const calculatedDy = (data.regularMarketPrice > 0)
            ? (last12mDivs.total / data.regularMarketPrice) * 100
            : 0;
        const response = {
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
    }
    catch (error) {
        console.error(`Error in /quote for ticker ${req.query.ticker}:`, error);
        const status = error.response ? error.response.status : 500;
        if (status === 404 || status === 400) {
            res.status(404).json({ error: "Ticker não encontrado ou inválido." });
        }
        else if (status === 502 || status >= 503) {
            res.status(502).json({ error: "Serviço da BrAPI indisponível." });
        }
        else {
            res.status(500).json({ error: "Erro interno do servidor." });
        }
    }
});
// 2. GET /dividends
app.get("/dividends", async (req, res) => {
    try {
        const ticker = req.query.ticker;
        const periodoMeses = parseInt(req.query.periodoMeses) || 12;
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
        const response = {
            ticker: data.symbol,
            periodoMeses,
            totalNoPeriodo: parseFloat(history.total.toFixed(2)),
            dividendos: history.items
        };
        res.json(response);
    }
    catch (error) {
        console.error(error);
        const status = error.response ? error.response.status : 500;
        if (status === 404) {
            res.status(404).json({ error: "Ticker não encontrado." });
        }
        else {
            res.status(502).json({ error: "Erro ao buscar dados de dividendos." });
        }
    }
});
// Helper for Simulation Logic
async function calculateAssetSimulation(ticker, aporteMensal, anos) {
    const data = await brapiService.getStockData(ticker);
    if (!data) {
        throw new Error(`Ticker ${ticker} não encontrado`);
    }
    const price = data.regularMarketPrice || 0;
    const last12m = brapiService.calculateHistoricalDividends(data, 12);
    const annualYield = price > 0 ? last12m.total / price : 0;
    const monthlyRate = Math.pow(1 + annualYield, 1 / 12) - 1;
    const totalMonths = anos * 12;
    let finalValue = 0;
    if (monthlyRate > 0) {
        finalValue = aporteMensal * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);
    }
    else {
        finalValue = aporteMensal * totalMonths;
    }
    const estimatedShares = price > 0 ? Math.floor(finalValue / price) : 0;
    const estimatedMonthlyIncome = finalValue * monthlyRate;
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
// 3. POST /renda-passiva
app.post("/renda-passiva", async (req, res) => {
    var _a;
    try {
        const { ticker, aporteMensal, anos } = req.body;
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
    }
    catch (error) {
        console.error(error);
        const msg = error.message || "Erro na simulação";
        const status = (((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 404 || msg.includes("não encontrado")) ? 404 : 500;
        res.status(status).json({ error: msg });
    }
});
// 4. POST /carteira-renda-passiva
app.post("/carteira-renda-passiva", async (req, res) => {
    var _a;
    try {
        const { ativos, aporteMensalTotal, anos } = req.body;
        if (!ativos || !Array.isArray(ativos) || aporteMensalTotal === undefined || !anos) {
            res.status(400).json({ error: "Body inválido. Requer 'ativos' (array), 'aporteMensalTotal', 'anos'" });
            return;
        }
        if (aporteMensalTotal <= 0 || anos <= 0) {
            res.status(400).json({ error: "Aporte total e anos devem ser números positivos maiores que zero." });
            return;
        }
        const totalWeight = ativos.reduce((acc, item) => acc + (item.peso || 0), 0);
        if (totalWeight < 99.0 || totalWeight > 101.0) {
            res.status(400).json({ error: `A soma dos pesos deve ser 100%. Total atual: ${totalWeight}%` });
            return;
        }
        const simulationPromises = ativos.map(async (item) => {
            const itemContribution = aporteMensalTotal * (item.peso / 100);
            return calculateAssetSimulation(item.ticker, itemContribution, anos);
        });
        const results = await Promise.all(simulationPromises);
        const totalPassiveIncome = results.reduce((sum, item) => sum + item.rendaPassivaMensalEstimativa, 0);
        const totalPatrimony = results.reduce((sum, item) => sum + item.patrimonioFinalEstimado, 0);
        let weightedDySum = 0;
        ativos.forEach((ativo, index) => {
            weightedDySum += (results[index].dividendYieldAnual * (ativo.peso / 100));
        });
        const response = {
            aporteMensalTotal,
            anos,
            dividendYieldMedioPonderado: parseFloat(weightedDySum.toFixed(2)),
            rendaPassivaMensalTotalEstimativa: parseFloat(totalPassiveIncome.toFixed(2)),
            patrimonioTotalEstimado: parseFloat(totalPatrimony.toFixed(2)),
            ativos: results
        };
        res.json(response);
    }
    catch (error) {
        console.error(error);
        const status = ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("não encontrado")) ? 404 : 500;
        res.status(status).json({ error: error.message || "Erro na simulação de carteira. Verifique se todos os tickers são válidos." });
    }
});
// Start Server
// Optional cache stats endpoint (enable with environment variable)
if (process.env.ENABLE_CACHE_STATS === 'true') {
    app.get('/cache-stats', (req, res) => {
        try {
            const stats = brapiService.getCacheStats ? brapiService.getCacheStats() : { hits: 0, misses: 0, entries: 0 };
            res.json(stats);
        }
        catch (e) {
            res.status(500).json({ error: 'Unable to read cache stats' });
        }
    });
}
app.listen(PORT, () => {
    console.log(`Servidor escutando na porta ${PORT}`);
});
//# sourceMappingURL=index.js.map