import axios from 'axios';
// CORREÇÃO: O caminho para 'types' foi corrigido de '../types' para './types'
import { BrapiResponse, BrapiStockResult } from './types';

const BRAPI_BASE_URL = 'https://brapi.dev/api';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 300000;

const getClient = () => {
  const token = process.env.BRAPI_TOKEN;
  return axios.create({
    baseURL: BRAPI_BASE_URL,
    params: token ? { token } : {},
  });
};

interface CacheEntry {
  data: BrapiStockResult;
  timestamp: number;
}

const inMemoryCache = new Map<string, CacheEntry>();

const getCache = (ticker: string): BrapiStockResult | null => {
  const entry = inMemoryCache.get(ticker.toUpperCase());
  if (entry) {
    const now = Date.now();
    if (now - entry.timestamp < CACHE_TTL_MS) {
      console.log(`[Cache Hit] Serving ${ticker} from in-memory cache.`);
      return entry.data;
    } else {
      console.log(`[Cache Expired] Entry for ${ticker} is older than ${CACHE_TTL_MS}ms.`);
      inMemoryCache.delete(ticker.toUpperCase());
    }
  } else {
    console.log(`[Cache Miss] No entry found for ${ticker}.`);
  }
  return null;
};

const setCache = (ticker: string, data: BrapiStockResult) => {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    inMemoryCache.set(ticker.toUpperCase(), entry);
    console.log(`[Cache Set] Saved ${ticker} to cache.`);
  } catch (error) {
    console.warn(`[Cache Write Error] Failed to write in-memory cache for ${ticker}:`, error);
  }
};

export const getStockData = async (ticker: string): Promise<BrapiStockResult | null> => {
  const cachedData = getCache(ticker);
  if (cachedData) {
    return cachedData;
  }

  try {
    console.log(`[API Fetch] Requesting full data for ${ticker} from BrAPI`);
    const response = await getClient().get<BrapiResponse>(`/quote/${ticker}`, {
      params: { range: '1y', interval: '1d', fundamental: 'true', dividends: 'true' },
    });
    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      setCache(ticker, result);
      return result;
    }
  } catch (error: any) {
    if (error.response && (error.response.status === 404 || error.response.status === 400)) {
      console.error(`[API Fetch Error] Ticker ${ticker} not found or invalid.`);
      throw error;
    }
    console.warn(`[API Fetch Warning] Full data fetch failed for ${ticker}. Attempting fallback... Error: ${error.message}`);
    try {
      const response = await getClient().get<BrapiResponse>(`/quote/${ticker}`, {
        params: { range: '1d', interval: '1d' },
      });
      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        console.log(`[Fallback Success] Retrieved basic data for ${ticker}.`);
        setCache(ticker, result);
        return result;
      }
    } catch (fallbackError: any) {
      console.error(`[API Fetch Error] Fallback also failed for ${ticker}:`, fallbackError.message);
      throw fallbackError;
    }
  }
  return null;
};

// CORREÇÃO: Adicionados tipos explícitos para os parâmetros para evitar erros 'any'
export const calculateHistoricalDividends = (
  stockData: BrapiStockResult,
  months: number
) => {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const dividends = stockData.dividendsData?.cashDividends || [];
  
  const filteredDividends = dividends.filter((div: any) => { // 'div' tipado como any para simplicidade
    if (!div.paymentDate && !div.approvedOn) return false;
    const dateStr = div.paymentDate || div.approvedOn;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date >= cutoffDate;
  });

  const total = filteredDividends.reduce((sum: number, div: any) => sum + (div.rate || 0), 0);

  return {
    total,
    items: filteredDividends.map((d: any) => ({
      dataCom: d.approvedOn || d.paymentDate || "N/A",
      valorPorAcao: d.rate || 0,
      tipo: d.label || "Dividendo",
    })),
  };
};
