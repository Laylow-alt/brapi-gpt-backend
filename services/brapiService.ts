import axios from 'axios';
import * as admin from 'firebase-admin';
import { BrapiResponse, BrapiStockResult } from '../types';

const BRAPI_BASE_URL = 'https://brapi.dev/api';
const CACHE_PATH = 'brapi_cache';

// Default 5 minutes (300000 ms) if not set via environment
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 300000;

const getClient = () => {
  const token = process.env.BRAPI_TOKEN;
  // If no token is provided, BrAPI might restrict access to some tickers or modules
  // Note: Test tickers like PETR4, VALE3 may work without token.
  return axios.create({
    baseURL: BRAPI_BASE_URL,
    params: token ? { token } : {},
  });
};

interface CacheEntry {
  data: BrapiStockResult;
  timestamp: number;
}

/**
 * Retrieves data from Realtime Database cache if available and fresh.
 */
const getCache = async (ticker: string): Promise<BrapiStockResult | null> => {
  try {
    if (!admin.apps.length) admin.initializeApp();
    
    const db = admin.database();
    const ref = db.ref(`${CACHE_PATH}/${ticker.toUpperCase()}`);
    const snapshot = await ref.once('value');

    if (snapshot.exists()) {
      const entry = snapshot.val() as CacheEntry;
      const now = Date.now();
      
      // Check if data is within TTL
      if (entry && entry.timestamp && (now - entry.timestamp < CACHE_TTL_MS)) {
        console.log(`[Cache Hit] Serving ${ticker} from RTDB cache.`);
        return entry.data;
      } else {
        console.log(`[Cache Expired] Entry for ${ticker} is older than ${CACHE_TTL_MS}ms.`);
      }
    } else {
      console.log(`[Cache Miss] No entry found for ${ticker}.`);
    }
  } catch (error) {
    console.warn(`[Cache Read Error] Failed to read cache for ${ticker}:`, error);
  }
  return null;
};

/**
 * Saves API response to Realtime Database cache.
 */
const setCache = async (ticker: string, data: BrapiStockResult) => {
  try {
    if (!admin.apps.length) admin.initializeApp();

    const db = admin.database();
    const ref = db.ref(`${CACHE_PATH}/${ticker.toUpperCase()}`);
    
    const entry: CacheEntry = {
      data: data,
      timestamp: Date.now()
    };
    
    await ref.set(entry);
    console.log(`[Cache Set] Saved ${ticker} to cache.`);
  } catch (error) {
    console.warn(`[Cache Write Error] Failed to write cache for ${ticker}:`, error);
  }
};

/**
 * Fetches stock data from BrAPI with caching and fallback logic.
 */
export const getStockData = async (ticker: string): Promise<BrapiStockResult | null> => {
  // 1. Try to get from cache first
  const cachedData = await getCache(ticker);
  if (cachedData) {
    return cachedData;
  }

  // 2. If not in cache or expired, fetch from BrAPI
  try {
    console.log(`[API Fetch] Requesting full data for ${ticker} from BrAPI`);
    // Attempt with full parameters (fundamental + dividends)
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
      await setCache(ticker, result);
      return result;
    }
  } catch (error: any) {
    // If error is 404, the ticker likely doesn't exist, don't retry fallback
    if (error.response && (error.response.status === 404 || error.response.status === 400)) {
      console.error(`[API Fetch Error] Ticker ${ticker} not found or invalid.`);
      throw error; // Propagate to controller for 404 response
    }

    console.warn(`[API Fetch Warning] Full data fetch failed for ${ticker}. Attempting fallback... Error: ${error.message}`);
    
    // Fallback: Try fetching without optional modules (fundamental/dividends)
    // This handles cases where the plan limits these modules or they are temporarily unavailable.
    try {
        const response = await getClient().get<BrapiResponse>(`/quote/${ticker}`, {
            params: {
                range: '1d',
                interval: '1d',
                // fundamental and dividends omitted
            },
        });

        if (response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            console.log(`[Fallback Success] Retrieved basic data for ${ticker}.`);
            // Cache the fallback result too so we don't spam the API on errors
            await setCache(ticker, result);
            return result;
        }
    } catch (fallbackError: any) {
         console.error(`[API Fetch Error] Fallback also failed for ${ticker}:`, fallbackError.message);
         throw fallbackError; // Propagate original or fallback error
    }
  }
  return null;
};

/**
 * Calculates the total dividends paid in the last X months.
 */
export const calculateHistoricalDividends = (
  stockData: BrapiStockResult,
  months: number
) => {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - months);

  // Gracefully handle missing dividendsData or cashDividends
  const dividends = stockData.dividendsData?.cashDividends || [];
  
  const filteredDividends = dividends.filter((div) => {
    // Handle potential missing dates or malformed data
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