import axios from 'axios';
import { BrapiResponse, BrapiStockResult } from '../types';

const BRAPI_BASE_URL = 'https://brapi.dev/api';

// Default 5 minutes (300000 ms) if not set via environment
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 300000;

const getClient = () => {
  // This is perfect for Render. We will set BRAPI_TOKEN as an environment variable.
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

// A simple in-memory cache that will be cleared on every deploy. Perfect for our use case.
const inMemoryCache = new Map<string, CacheEntry>();

/**
 * Retrieves data from the in-memory cache if available and fresh.
 */
const getCache = (ticker: string): BrapiStockResult | null => {
  const entry = inMemoryCache.get(ticker.toUpperCase());

  if (entry) {
    const now = Date.now();
    // Check if data is within TTL (Time To Live)
    if (now - entry.timestamp < CACHE_TTL_MS) {
      console.log(`[Cache Hit] Serving ${ticker} from in-memory cache.`);
      return entry.data;
    } else {
      console.log(`[Cache Expired] Entry for ${ticker} is older than ${CACHE_TTL_MS}ms.`);
      inMemoryCache.delete(ticker.toUpperCase()); // Clean up expired entry
    }
  } else {
    console.log(`[Cache Miss] No entry found for ${ticker}.`);
  }
  return null;
};

/**
 * Saves API response to the in-memory cache.
 */
const setCache = (ticker: string, data: BrapiStockResult) => {
  try {
    const entry: CacheEntry = {
      data: data,
      timestamp: Date.now()
    };
    inMemoryCache.set(ticker.toUpperCase(), entry);
    console.log(`[Cache Set] Saved ${ticker} to cache.`);
  } catch (error) {
    console.warn(`[Cache Write Error] Failed to write in-memory cache for ${ticker}:`, error);
  }
};


/**
 * Fetches stock data from BrAPI with caching and fallback logic.
 */
export const getStockData = async (ticker: string): Promise<BrapiStockResult | null> => {
  // 1. Try to get from cache first
  const cachedData = getCache(ticker); // No 'await' needed anymore
  if (cachedData) {
    return cachedData;
  }

  // 2. If not in cache or expired, fetch from BrAPI
  try {
    console.log(`[API Fetch] Requesting full data for ${ticker} from BrAPI`);
    const response = await getClient().get<BrapiResponse>(`/quote/${ticker}`, {
      params: {
        range: '1y',
        interval: '1d',
        fundamental: 'true',
        dividends: 'true',
      },
    });

    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      setCache(ticker, result); // No 'await' needed
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
            params: {
                range: '1d',
                interval: '1d',
            },
        });

        if (response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            console.log(`[Fallback Success] Retrieved basic data for ${ticker}.`);
            setCache(ticker, result); // No 'await' needed
            return result;
        }
    } catch (fallbackError: any) {
         console.error(`[API Fetch Error] Fallback also failed for ${ticker}:`, fallbackError.message);
         throw fallbackError;
    }
  }
  return null;
};

/**
 * Calculates the total dividends paid in the last X months.
 * (This function requires no changes)
 */
export const calculateHistoricalDividends = (
  stockData: BrapiStockResult,
  months: number
) => {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  const dividends = stockData.dividendsData?.cashDividends || [];
  
  const filteredDividends = dividends.filter((div) => {
    if (!div.paymentDate && !div.approvedOn) return false;
    const dateStr = div.paymentDate || div.approvedOn;
    const date = new Date(dateStr);
    return !isNaN(date.getTime()) && date >= cutoffDate;
  });

  const total = filteredDividends.reduce((sum, div) => sum + (div.rate || 0), 0);

  return {
    total,
    items: filteredDividends.map((d) => ({
      dataCom: d.approvedOn || d.paymentDate || "N/A",
      valorPorAcao: d.rate || 0,
      tipo: d.label || "Dividendo",
    })),
  };
};
