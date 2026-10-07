import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// ============================================================================
// CENTRAL API KEY RESOLVERS & ACCESSORS
// ============================================================================

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key && key.length > 5 ? key : null;
}

export function getAlphaVantageApiKey(): string | null {
  const key = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  return key && key.length > 3 ? key : null;
}

export function getFredApiKey(): string | null {
  const key = process.env.FRED_API_KEY?.trim();
  return key && key.length > 5 ? key : null;
}

export type ApiConnectionStatus = 'CONNECTED' | 'NOT CONFIGURED' | 'ERROR';

export interface ApiStatusItem {
  name: string;
  configured: boolean;
  status: ApiConnectionStatus;
  message: string;
  lastCheckedIso: string;
}

export interface SystemApiStatusReport {
  gemini: ApiStatusItem;
  alphaVantage: ApiStatusItem;
  fred: ApiStatusItem;
  timestampIso: string;
}

// In-memory cache for API health checks to avoid burning rate limits
let cachedStatusReport: SystemApiStatusReport | null = null;
let lastCheckTimeMs = 0;
const HEALTH_CACHE_TTL_MS = 30000; // 30 seconds cache

// ============================================================================
// VERIFY GEMINI API CONNECTION
// ============================================================================
export async function testGeminiConnection(): Promise<{
  status: ApiConnectionStatus;
  message: string;
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      status: 'NOT CONFIGURED',
      message: 'Gemini API belum dikonfigurasi',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Prefer gemini-3.1-flash-lite for instant speed and reliable quota
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'Ping: reply with PONG in 1 word',
    });

    if (res && res.text) {
      return {
        status: 'CONNECTED',
        message: 'Gemini AI Intelligence aktif & terhubung',
      };
    }

    return {
      status: 'ERROR',
      message: 'Gemini API response kosong',
    };
  } catch (err: any) {
    const msg = String(err?.message || err);
    if (msg.includes('API_KEY_INVALID') || msg.includes('401') || msg.includes('403')) {
      return {
        status: 'ERROR',
        message: 'Gemini API key tidak valid atau tidak diizinkan',
      };
    }
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return {
        status: 'CONNECTED', // Key is valid, just rate-limited
        message: 'Gemini API terhubung (Rate limit kuota tercapai)',
      };
    }
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
      return {
        status: 'CONNECTED',
        message: 'Gemini API terhubung (Model sedang lonjakan trafik/busy)',
      };
    }
    return {
      status: 'ERROR',
      message: `Gemini API error: ${msg.slice(0, 100)}`,
    };
  }
}

// ============================================================================
// VERIFY ALPHA VANTAGE API CONNECTION
// ============================================================================
export async function testAlphaVantageConnection(): Promise<{
  status: ApiConnectionStatus;
  message: string;
}> {
  const apiKey = getAlphaVantageApiKey();
  if (!apiKey) {
    return {
      status: 'NOT CONFIGURED',
      message: 'Alpha Vantage API belum dikonfigurasi',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=EUR&to_currency=USD&apikey=${apiKey}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        status: 'ERROR',
        message: `Alpha Vantage HTTP error: ${res.status}`,
      };
    }

    const data = await res.json();
    if (data['Realtime Currency Exchange Rate']) {
      return {
        status: 'CONNECTED',
        message: 'Alpha Vantage market data aktif & terhubung',
      };
    }

    if (data['Information'] || data['Note']) {
      // Free tier rate limit message means the API key is verified & valid
      return {
        status: 'CONNECTED',
        message: 'Alpha Vantage terhubung (Free tier rate limit 1 req/sec aktif)',
      };
    }

    if (data['Error Message']) {
      return {
        status: 'ERROR',
        message: 'Alpha Vantage API key tidak valid atau query salah',
      };
    }

    return {
      status: 'CONNECTED',
      message: 'Alpha Vantage terhubung',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        status: 'ERROR',
        message: 'Alpha Vantage request timeout (>7s)',
      };
    }
    return {
      status: 'ERROR',
      message: `Alpha Vantage network error: ${err?.message || 'Gagal terhubung'}`,
    };
  }
}

// ============================================================================
// VERIFY FRED API CONNECTION
// ============================================================================
export async function testFredConnection(): Promise<{
  status: ApiConnectionStatus;
  message: string;
}> {
  const apiKey = getFredApiKey();
  if (!apiKey) {
    return {
      status: 'NOT CONFIGURED',
      message: 'FRED API belum dikonfigurasi (menggunakan fallback kalender resmi FRED)',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const url = `https://api.stlouisfed.org/fred/releases?api_key=${apiKey}&file_type=json&limit=1`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return {
          status: 'ERROR',
          message: 'FRED API key tidak valid',
        };
      }
      return {
        status: 'ERROR',
        message: `FRED API HTTP error: ${res.status}`,
      };
    }

    const data = await res.json();
    if (data && Array.isArray(data.releases)) {
      return {
        status: 'CONNECTED',
        message: 'FRED US Economic Data aktif & terhubung',
      };
    }

    if (data && data.error_code) {
      return {
        status: 'ERROR',
        message: `FRED API error: ${data.error_message || data.error_code}`,
      };
    }

    return {
      status: 'CONNECTED',
      message: 'FRED API terhubung',
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        status: 'ERROR',
        message: 'FRED API request timeout (>7s)',
      };
    }
    return {
      status: 'ERROR',
      message: `FRED API network error: ${err?.message || 'Gagal terhubung'}`,
    };
  }
}

// ============================================================================
// SYSTEM API STATUS REPORT
// ============================================================================
export async function getSystemApiStatusReport(forceRefresh = false): Promise<SystemApiStatusReport> {
  const now = Date.now();
  if (!forceRefresh && cachedStatusReport && now - lastCheckTimeMs < HEALTH_CACHE_TTL_MS) {
    return cachedStatusReport;
  }

  const [geminiResult, alphaResult, fredResult] = await Promise.all([
    testGeminiConnection(),
    testAlphaVantageConnection(),
    testFredConnection(),
  ]);

  const report: SystemApiStatusReport = {
    gemini: {
      name: 'Gemini AI Intelligence',
      configured: Boolean(getGeminiApiKey()),
      status: geminiResult.status,
      message: geminiResult.message,
      lastCheckedIso: new Date().toISOString(),
    },
    alphaVantage: {
      name: 'Alpha Vantage Market Data',
      configured: Boolean(getAlphaVantageApiKey()),
      status: alphaResult.status,
      message: alphaResult.message,
      lastCheckedIso: new Date().toISOString(),
    },
    fred: {
      name: 'FRED US Economic Data',
      configured: Boolean(getFredApiKey()),
      status: fredResult.status,
      message: fredResult.message,
      lastCheckedIso: new Date().toISOString(),
    },
    timestampIso: new Date().toISOString(),
  };

  cachedStatusReport = report;
  lastCheckTimeMs = now;
  return report;
}
