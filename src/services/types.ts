export interface BrapiDividend {
  assetIssued: string;
  paymentDate: string;
  rate: number;
  relatedTo: string;
  approvedOn: string;
  label: string;
}

export interface BrapiStockResult {
  symbol: string;
  shortName: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketDayRange: string;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketTime: string;
  marketCap: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  regularMarketOpen: number;
  averageDailyVolume10Day: number;
  averageDailyVolume3Month: number;
  fiftyTwoWeekLowChange: number;
  fiftyTwoWeekRange: string;
  fiftyTwoWeekHighChange: number;
  fiftyTwoWeekHighChangePercent: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  twoHundredDayAverage: number;
  twoHundredDayAverageChange: number;
  twoHundredDayAverageChangePercent: number;
  logourl: string;
  sector?: string; // Included to map to 'setor'
  dividendsData?: {
    cashDividends?: BrapiDividend[];
    stockDividends?: any[];
    subscriptions?: any[];
  };
}

export interface BrapiResponse {
  results: BrapiStockResult[];
}

export interface QuoteResponse {
  ticker: string;
  nome: string;
  precoAtual: number;
  variacaoPercentualDia: number;
  dividendYieldAtual: number | null;
  ultimoFechamento: number;
  volume: number;
  setor: string;
  logo: string;
}

export interface DividendResponse {
  ticker: string;
  periodoMeses: number;
  totalNoPeriodo: number;
  dividendos: {
    dataCom: string;
    valorPorAcao: number;
    tipo: string;
  }[];
}

export interface PassiveIncomeRequest {
  ticker: string;
  aporteMensal: number;
  anos: number;
}

export interface PassiveIncomeResponse {
  ticker: string;
  aporteMensal: number;
  anos: number;
  precoAtual: number;
  dividendYieldAnual: number;
  cotasEstimadas: number;
  patrimonioFinalEstimado: number;
  rendaPassivaMensalEstimativa: number;
  magicNumberCotas: number;
}

export interface PortfolioItem {
  ticker: string;
  peso: number; // Percentage 0-100
}

export interface PortfolioRequest {
  ativos: PortfolioItem[];
  aporteMensalTotal: number;
  anos: number;
}

export interface PortfolioResponse {
  aporteMensalTotal: number;
  anos: number;
  dividendYieldMedioPonderado: number;
  rendaPassivaMensalTotalEstimativa: number;
  patrimonioTotalEstimado: number;
  ativos: PassiveIncomeResponse[];
}
