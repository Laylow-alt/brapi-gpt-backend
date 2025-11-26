"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCacheStats = exports.calculateHistoricalDividends = exports.getStockData = void 0;
const axios_1 = __importDefault(require("axios"));
const BRAPI_BASE_URL = 'https://brapi.dev/api';
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS) || 300000;
const getClient = () => {
    const token = process.env.BRAPI_TOKEN;
    return axios_1.default.create({
        baseURL: BRAPI_BASE_URL,
        params: token ? { token } : {},
    });
};
// A simple in-memory cache that will be cleared on every deploy. Perfect for our use case.
const inMemoryCache = new Map();
// Max entries to avoid unbounded memory growth on free tier instances
const MAX_CACHE_ENTRIES = Number(process.env.MAX_CACHE_ENTRIES) || 500;
// Simple stats
let cacheHits = 0;
let cacheMisses = 0;
/**
 * Retrieves data from the in-memory cache if available and fresh.
 */
const getCache = (ticker) => {
    const entry = inMemoryCache.get(ticker.toUpperCase());
    if (entry) {
        const now = Date.now();
        // Check if data is within TTL (Time To Live)
        if (now - entry.timestamp < CACHE_TTL_MS) {
            console.log(`[Cache Hit] Serving ${ticker} from in-memory cache.`);
            return entry.data;
        }
        else {
            console.log(`[Cache Expired] Entry for ${ticker} is older than ${CACHE_TTL_MS}ms.`);
            inMemoryCache.delete(ticker.toUpperCase()); // Clean up expired entry
        }
    }
    else {
        console.log(`[Cache Miss] No entry found for ${ticker}.`);
    }
    return null;
};
/**
 * Saves API response to the in-memory cache.
 */
const setCache = (ticker, data) => {
    try {
        const entry = {
            data: data,
            timestamp: Date.now()
        };
        inMemoryCache.set(ticker.toUpperCase(), entry);
        console.log(`[Cache Set] Saved ${ticker} to cache.`);
        // Evict oldest entries if over limit (Map preserves insertion order)
        if (inMemoryCache.size > MAX_CACHE_ENTRIES) {
            const oldestKey = inMemoryCache.keys().next().value;
            if (oldestKey) {
                inMemoryCache.delete(oldestKey);
                console.log(`[Cache Evict] Removed oldest cache entry: ${oldestKey}`);
            }
        }
    }
    catch (error) {
        console.warn(`[Cache Write Error] Failed to write in-memory cache for ${ticker}:`, error);
    }
};
const getStockData = async (ticker) => {
    // 1. Try to get from cache first
    const cachedData = getCache(ticker);
    if (cachedData) {
        cacheHits += 1;
        return cachedData;
    }
    cacheMisses += 1;
    // 2. If not in cache or expired, fetch from BrAPI
    try {
        console.log(`[API Fetch] Requesting full data for ${ticker} from BrAPI`);
        const response = await getClient().get(`/quote/${ticker}`, {
            params: {
                range: '1y',
                interval: '1d',
                fundamental: 'true',
                dividends: 'true',
            },
        });
        if (response.data.results && response.data.results.length > 0) {
            const result = response.data.results[0];
            setCache(ticker, result);
            return result;
        }
    }
    catch (error) {
        if (error.response && (error.response.status === 404 || error.response.status === 400)) {
            console.error(`[API Fetch Error] Ticker ${ticker} not found or invalid.`);
            throw error;
        }
        console.warn(`[API Fetch Warning] Full data fetch failed for ${ticker}. Attempting fallback... Error: ${error.message}`);
        try {
            const response = await getClient().get(`/quote/${ticker}`, {
                params: {
                    range: '1d',
                    interval: '1d',
                },
            });
            if (response.data.results && response.data.results.length > 0) {
                const result = response.data.results[0];
                console.log(`[Fallback Success] Retrieved basic data for ${ticker}.`);
                setCache(ticker, result);
                return result;
            }
        }
        catch (fallbackError) {
            console.error(`[API Fetch Error] Fallback also failed for ${ticker}:`, fallbackError.message);
            throw fallbackError;
        }
    }
    return null;
};
exports.getStockData = getStockData;
/**
 * Calculates the total dividends paid in the last X months.
 * (This function requires no changes)
 */
const calculateHistoricalDividends = (stockData, months) => {
    var _a;
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    const dividends = ((_a = stockData.dividendsData) === null || _a === void 0 ? void 0 : _a.cashDividends) || [];
    const filteredDividends = dividends.filter((div) => {
        if (!div.paymentDate && !div.approvedOn)
            return false;
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
exports.calculateHistoricalDividends = calculateHistoricalDividends;
const getCacheStats = () => ({ hits: cacheHits, misses: cacheMisses, entries: inMemoryCache.size });
exports.getCacheStats = getCacheStats;
//# sourceMappingURL=brapiService.js.map