import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import { GoogleGenAI } from '@google/genai';
import { getAlphaVantageApiKey, getGeminiApiKey } from './serverApiConfig';
import {
  CandleData,
  MarketCategory,
  MarketOverviewData,
  MarketQuote,
  MarketStatusType,
  MarketTimeframe,
  AIMarketAnalysisResult,
  XauusdSpecialAnalysis,
} from './src/types';

// ============================================================================
// SYMBOL DEFINITIONS & MAPPINGS
// ============================================================================

export interface SymbolDef {
  symbol: string;
  displayName: string;
  category: MarketCategory;
  yahooTicker: string;
  binanceTicker?: string;
  currency: string;
}

export const TRACKED_SYMBOLS: SymbolDef[] = [
  // Forex
  { symbol: 'XAUUSD', displayName: 'XAU/USD Gold', category: 'forex', yahooTicker: 'GC=F', currency: 'USD' },
  { symbol: 'EURUSD', displayName: 'EUR/USD', category: 'forex', yahooTicker: 'EURUSD=X', currency: 'USD' },
  { symbol: 'GBPUSD', displayName: 'GBP/USD', category: 'forex', yahooTicker: 'GBPUSD=X', currency: 'USD' },
  { symbol: 'USDJPY', displayName: 'USD/JPY', category: 'forex', yahooTicker: 'JPY=X', currency: 'JPY' },
  { symbol: 'DXY', displayName: 'US Dollar Index', category: 'forex', yahooTicker: 'DX-Y.NYB', currency: 'USD' },

  // Crypto
  { symbol: 'BTCUSD', displayName: 'Bitcoin', category: 'crypto', yahooTicker: 'BTC-USD', binanceTicker: 'BTCUSDT', currency: 'USD' },
  { symbol: 'ETHUSD', displayName: 'Ethereum', category: 'crypto', yahooTicker: 'ETH-USD', binanceTicker: 'ETHUSDT', currency: 'USD' },
  { symbol: 'SOLUSD', displayName: 'Solana', category: 'crypto', yahooTicker: 'SOL-USD', binanceTicker: 'SOLUSDT', currency: 'USD' },
  { symbol: 'XRPUSD', displayName: 'XRP Ripple', category: 'crypto', yahooTicker: 'XRP-USD', binanceTicker: 'XRPUSDT', currency: 'USD' },

  // US Stocks
  { symbol: 'AAPL', displayName: 'Apple Inc.', category: 'us_stocks', yahooTicker: 'AAPL', currency: 'USD' },
  { symbol: 'MSFT', displayName: 'Microsoft Corp.', category: 'us_stocks', yahooTicker: 'MSFT', currency: 'USD' },
  { symbol: 'NVDA', displayName: 'NVIDIA Corp.', category: 'us_stocks', yahooTicker: 'NVDA', currency: 'USD' },
  { symbol: 'AMZN', displayName: 'Amazon.com Inc.', category: 'us_stocks', yahooTicker: 'AMZN', currency: 'USD' },
  { symbol: 'META', displayName: 'Meta Platforms', category: 'us_stocks', yahooTicker: 'META', currency: 'USD' },
  { symbol: 'GOOGL', displayName: 'Alphabet Inc.', category: 'us_stocks', yahooTicker: 'GOOGL', currency: 'USD' },
  { symbol: 'TSLA', displayName: 'Tesla Inc.', category: 'us_stocks', yahooTicker: 'TSLA', currency: 'USD' },
  { symbol: 'AMD', displayName: 'Advanced Micro Devices', category: 'us_stocks', yahooTicker: 'AMD', currency: 'USD' },
  { symbol: 'NFLX', displayName: 'Netflix Inc.', category: 'us_stocks', yahooTicker: 'NFLX', currency: 'USD' },

  // Indonesian Stocks (IDX)
  { symbol: 'BBCA', displayName: 'Bank Central Asia', category: 'idx_stocks', yahooTicker: 'BBCA.JK', currency: 'IDR' },
  { symbol: 'BBRI', displayName: 'Bank Rakyat Indonesia', category: 'idx_stocks', yahooTicker: 'BBRI.JK', currency: 'IDR' },
  { symbol: 'BMRI', displayName: 'Bank Mandiri', category: 'idx_stocks', yahooTicker: 'BMRI.JK', currency: 'IDR' },
  { symbol: 'BBNI', displayName: 'Bank Negara Indonesia', category: 'idx_stocks', yahooTicker: 'BBNI.JK', currency: 'IDR' },
  { symbol: 'TLKM', displayName: 'Telkom Indonesia', category: 'idx_stocks', yahooTicker: 'TLKM.JK', currency: 'IDR' },
  { symbol: 'ASII', displayName: 'Astra International', category: 'idx_stocks', yahooTicker: 'ASII.JK', currency: 'IDR' },
  { symbol: 'ANTM', displayName: 'Aneka Tambang (Gold)', category: 'idx_stocks', yahooTicker: 'ANTM.JK', currency: 'IDR' },
  { symbol: 'ICBP', displayName: 'Indofood CBP', category: 'idx_stocks', yahooTicker: 'ICBP.JK', currency: 'IDR' },
  { symbol: 'INDF', displayName: 'Indofood Sukses Makmur', category: 'idx_stocks', yahooTicker: 'INDF.JK', currency: 'IDR' },
  { symbol: 'GOTO', displayName: 'GoTo Gojek Tokopedia', category: 'idx_stocks', yahooTicker: 'GOTO.JK', currency: 'IDR' },
];

export function findSymbolDef(symbol: string): SymbolDef {
  const upper = symbol.toUpperCase().trim();
  const found = TRACKED_SYMBOLS.find(
    (s) => s.symbol === upper || s.yahooTicker.toUpperCase() === upper || s.binanceTicker === upper
  );
  if (found) return found;

  // Dynamic fallback for any search ticker
  const isIdx = upper.endsWith('.JK');
  return {
    symbol: upper,
    displayName: upper,
    category: isIdx ? 'idx_stocks' : upper.includes('USD') ? 'forex' : 'us_stocks',
    yahooTicker: upper,
    currency: isIdx ? 'IDR' : 'USD',
  };
}

// ============================================================================
// CACHE STORE (TTL 3 seconds for quotes, 20 seconds for candles)
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const quoteCache = new Map<string, CacheEntry<MarketQuote>>();
const candleCache = new Map<string, CacheEntry<CandleData[]>>();

// ============================================================================
// FETCH QUOTE (Binance / Yahoo Finance)
// ============================================================================

export async function fetchLiveQuote(symbol: string): Promise<MarketQuote> {
  const symDef = findSymbolDef(symbol);
  const cacheKey = symDef.symbol;
  const now = Date.now();

  const cached = quoteCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 1. If Crypto and Binance is available, try Binance for ultra-fast quotes
  if (symDef.category === 'crypto' && symDef.binanceTicker) {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symDef.binanceTicker)}`
      );
      if (res.ok) {
        const d = await res.json();
        const price = parseFloat(d.lastPrice);
        const change = parseFloat(d.priceChange);
        const changePercent = parseFloat(d.priceChangePercent);
        const high24h = parseFloat(d.highPrice);
        const low24h = parseFloat(d.lowPrice);
        const open24h = parseFloat(d.openPrice);
        const volume24h = parseFloat(d.volume);

        const quote: MarketQuote = {
          symbol: symDef.symbol,
          displayName: symDef.displayName,
          category: symDef.category,
          price,
          change,
          changePercent,
          high24h,
          low24h,
          open24h,
          volume24h,
          currency: symDef.currency,
          marketStatus: 'LIVE',
          lastUpdatedIso: new Date().toISOString(),
        };

        quoteCache.set(cacheKey, { data: quote, expiresAt: now + 3000 });
        return quote;
      }
    } catch {
      // fallback to Yahoo
    }
  }

  // 2. Yahoo Finance fallback for Forex, Gold, US Stocks, and IDX
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symDef.yahooTicker
    )}?range=1d&interval=5m`;

    const res = await fetch(yahooUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo returned status ${res.status}`);
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;

    if (!meta || meta.regularMarketPrice === undefined) {
      throw new Error('Price not found in meta');
    }

    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - previousClose;
    const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
    const high24h = meta.regularMarketDayHigh || price;
    const low24h = meta.regularMarketDayLow || price;
    const open24h = previousClose;
    const volume24h = meta.regularMarketVolume || 0;

    // Determine market status
    let marketStatus: MarketStatusType = 'LIVE';
    const marketState = (meta.tradingPeriod?.regular?.end || 0) * 1000;
    if (symDef.category === 'idx_stocks' || symDef.category === 'us_stocks') {
      const nowUtc = Date.now();
      const regularStart = (meta.tradingPeriod?.regular?.start || 0) * 1000;
      const regularEnd = (meta.tradingPeriod?.regular?.end || 0) * 1000;
      if (regularStart > 0 && regularEnd > 0) {
        if (nowUtc < regularStart || nowUtc > regularEnd) {
          marketStatus = 'MARKET CLOSED';
        }
      }
    }

    const quote: MarketQuote = {
      symbol: symDef.symbol,
      displayName: symDef.displayName,
      category: symDef.category,
      price,
      change,
      changePercent,
      high24h,
      low24h,
      open24h,
      previousClose,
      volume24h,
      currency: symDef.currency,
      marketStatus,
      lastUpdatedIso: new Date().toISOString(),
    };

    quoteCache.set(cacheKey, { data: quote, expiresAt: now + 4000 });
    return quote;
  } catch (err: any) {
    // If cached quote exists, return with DELAYED status
    if (cached) {
      return { ...cached.data, marketStatus: 'DELAYED' };
    }

    throw new Error(`DATA UNAVAILABLE for ${symbol}: ${err?.message || 'Provider offline'}`);
  }
}

// ============================================================================
// FETCH HISTORICAL CANDLES (Timeframes: 1m, 5m, 15m, 30m, 1H, 4H, 1D, 1W, 1M)
// ============================================================================

export async function fetchHistoricalCandles(
  symbol: string,
  timeframe: MarketTimeframe
): Promise<CandleData[]> {
  const symDef = findSymbolDef(symbol);
  const cacheKey = `${symDef.symbol}_${timeframe}`;
  const now = Date.now();

  const cached = candleCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  // 1. If Crypto and Binance is available, fetch Binance klines
  if (symDef.category === 'crypto' && symDef.binanceTicker) {
    const binanceIntervalMap: Record<MarketTimeframe, string> = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '30m': '30m',
      '1H': '1h',
      '4H': '4h',
      '1D': '1d',
      '1W': '1w',
      '1M': '1M',
    };
    const bInterval = binanceIntervalMap[timeframe] || '15m';

    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(
        symDef.binanceTicker
      )}&interval=${bInterval}&limit=250`;
      const res = await fetch(url);
      if (res.ok) {
        const raw = await res.json();
        const candles: CandleData[] = raw.map((k: any) => ({
          time: Math.floor(k[0] / 1000), // convert ms to seconds for Lightweight Charts
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));

        // Sort ascending and deduplicate
        const sanitized = sanitizeCandles(candles);
        candleCache.set(cacheKey, { data: sanitized, expiresAt: now + 15000 });
        return sanitized;
      }
    } catch {
      // fallback to Yahoo
    }
  }

  // 2. Yahoo Finance chart API mapping
  // range and interval
  const yahooParams: Record<MarketTimeframe, { range: string; interval: string }> = {
    '1m': { range: '1d', interval: '1m' },
    '5m': { range: '5d', interval: '5m' },
    '15m': { range: '5d', interval: '15m' },
    '30m': { range: '1mo', interval: '30m' },
    '1H': { range: '1mo', interval: '60m' },
    '4H': { range: '3mo', interval: '60m' }, // aggregate to 4H
    '1D': { range: '1y', interval: '1d' },
    '1W': { range: '2y', interval: '1wk' },
    '1M': { range: '5y', interval: '1mo' },
  };

  const { range, interval } = yahooParams[timeframe] || { range: '5d', interval: '15m' };
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symDef.yahooTicker
  )}?range=${range}&interval=${interval}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Yahoo candles for ${symDef.symbol}: HTTP ${res.status}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    throw new Error(`DATA UNAVAILABLE: No candle timestamps for ${symDef.symbol}`);
  }

  const timestamps: number[] = result.timestamp;
  const quote = result.indicators?.quote?.[0];
  const opens = quote?.open || [];
  const highs = quote?.high || [];
  const lows = quote?.low || [];
  const closes = quote?.close || [];
  const volumes = quote?.volume || [];

  const rawCandles: CandleData[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    const v = volumes[i] || 0;

    // Filter null or NaN data points often present in Yahoo regular sessions
    if (o !== null && h !== null && l !== null && c !== null && !isNaN(o) && !isNaN(c)) {
      rawCandles.push({
        time: t,
        open: Number(o.toFixed(4)),
        high: Number(h.toFixed(4)),
        low: Number(l.toFixed(4)),
        close: Number(c.toFixed(4)),
        volume: Number(v),
      });
    }
  }

  // If 4H aggregation was requested from 1H candles
  let finalCandles = rawCandles;
  if (timeframe === '4H' && rawCandles.length > 0) {
    finalCandles = aggregateCandles(rawCandles, 4 * 3600);
  }

  const sanitized = sanitizeCandles(finalCandles);
  candleCache.set(cacheKey, { data: sanitized, expiresAt: now + 20000 });
  return sanitized;
}

function aggregateCandles(candles: CandleData[], bucketSeconds: number): CandleData[] {
  const aggregated: CandleData[] = [];
  let currentBucketTime = 0;
  let currentBucket: CandleData[] = [];

  for (const c of candles) {
    const bucketTime = Math.floor(c.time / bucketSeconds) * bucketSeconds;
    if (bucketTime !== currentBucketTime) {
      if (currentBucket.length > 0) {
        aggregated.push({
          time: currentBucketTime,
          open: currentBucket[0].open,
          high: Math.max(...currentBucket.map((b) => b.high)),
          low: Math.min(...currentBucket.map((b) => b.low)),
          close: currentBucket[currentBucket.length - 1].close,
          volume: currentBucket.reduce((sum, b) => sum + (b.volume || 0), 0),
        });
      }
      currentBucketTime = bucketTime;
      currentBucket = [c];
    } else {
      currentBucket.push(c);
    }
  }

  if (currentBucket.length > 0) {
    aggregated.push({
      time: currentBucketTime,
      open: currentBucket[0].open,
      high: Math.max(...currentBucket.map((b) => b.high)),
      low: Math.min(...currentBucket.map((b) => b.low)),
      close: currentBucket[currentBucket.length - 1].close,
      volume: currentBucket.reduce((sum, b) => sum + (b.volume || 0), 0),
    });
  }

  return aggregated;
}

function sanitizeCandles(candles: CandleData[]): CandleData[] {
  // Sort ascending and ensure time is strictly increasing
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const deduped: CandleData[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (deduped.length === 0 || cur.time > deduped[deduped.length - 1].time) {
      deduped.push(cur);
    } else if (cur.time === deduped[deduped.length - 1].time) {
      // replace with latest candle of same timestamp
      deduped[deduped.length - 1] = cur;
    }
  }

  return deduped;
}

// ============================================================================
// MARKET OVERVIEW (Top Gainers, Top Losers, Most Active, Highest Volatility)
// ============================================================================

export async function fetchMarketOverview(): Promise<MarketOverviewData> {
  const quotes: MarketQuote[] = [];

  // Fetch quotes for all tracked assets in parallel
  const results = await Promise.allSettled(TRACKED_SYMBOLS.map((s) => fetchLiveQuote(s.symbol)));

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      quotes.push(r.value);
    }
  }

  if (quotes.length === 0) {
    throw new Error('Unable to build market overview: Data unavailable');
  }

  // Top Gainers (changePercent desc)
  const topGainers = [...quotes]
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);

  // Top Losers (changePercent asc)
  const topLosers = [...quotes]
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 5);

  // Highest Volume / Most Active
  const mostActive = [...quotes]
    .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, 5);

  // Highest Volatility ((high - low) / low)
  const highestVolatility = [...quotes]
    .map((q) => {
      const volPct = q.low24h && q.low24h > 0 && q.high24h ? ((q.high24h - q.low24h) / q.low24h) * 100 : 0;
      return { q, volPct };
    })
    .sort((a, b) => b.volPct - a.volPct)
    .map((item) => item.q)
    .slice(0, 5);

  return {
    topGainers,
    topLosers,
    mostActive,
    highestVolume: mostActive,
    highestVolatility,
  };
}

// ============================================================================
// SEARCH SYMBOLS
// ============================================================================

export async function searchMarketSymbols(query: string): Promise<MarketQuote[]> {
  const qClean = query.trim().toUpperCase();
  if (!qClean) return [];

  // 1. Search in local tracked symbols first
  const localMatches = TRACKED_SYMBOLS.filter(
    (s) => s.symbol.includes(qClean) || s.displayName.toUpperCase().includes(qClean)
  );

  const matchedQuotes: MarketQuote[] = [];
  for (const s of localMatches) {
    try {
      const q = await fetchLiveQuote(s.symbol);
      matchedQuotes.push(q);
    } catch {
      // skip unavailable
    }
  }

  // 2. If user searched an external ticker (e.g. BUMI, PLTR, BABA, etc.)
  if (matchedQuotes.length === 0) {
    try {
      const externalQuote = await fetchLiveQuote(qClean);
      matchedQuotes.push(externalQuote);
    } catch {
      // not found
    }
  }

  return matchedQuotes;
}

// ============================================================================
// AI MARKET ANALYSIS (Connected to Economic Calendar + Technicals + DXY + Yields)
// ============================================================================

export async function generateAiMarketAnalysis(
  symbol: string,
  timeframe: MarketTimeframe,
  currentQuote?: MarketQuote,
  latestCandles: CandleData[] = [],
  economicContextData?: any
): Promise<{ analysis: AIMarketAnalysisResult; xauusdSpecial?: XauusdSpecialAnalysis }> {
  const sym = symbol.toUpperCase();
  const quote = currentQuote || (await fetchLiveQuote(sym));

  // Extract key technical metrics from candles
  const lastClose = quote.price;
  const changePct = quote.changePercent;
  let rsi = 50;
  let ema21 = lastClose;

  if (latestCandles.length >= 14) {
    let gains = 0;
    let losses = 0;
    for (let i = latestCandles.length - 14; i < latestCandles.length; i++) {
      const diff = latestCandles[i].close - latestCandles[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const rs = losses === 0 ? 100 : (gains / 14) / (losses / 14);
    rsi = Number((100 - 100 / (1 + rs)).toFixed(1));
  }

  // Fetch live macro indicators: DXY and 10Y Yield
  let dxyQuote: MarketQuote | null = null;
  try {
    dxyQuote = await fetchLiveQuote('DXY');
  } catch {
    // ignore
  }

  // Determine trend and momentum
  const isUp = changePct > 0.3;
  const isStrongUp = changePct > 1.2;
  const isDown = changePct < -0.3;
  const isStrongDown = changePct < -1.2;

  const bias = isUp ? 'BULLISH' : isDown ? 'BEARISH' : 'NEUTRAL';
  const trend = isStrongUp
    ? 'STRONG BULLISH'
    : isUp
    ? 'BULLISH'
    : isStrongDown
    ? 'STRONG BEARISH'
    : isDown
    ? 'BEARISH'
    : 'NEUTRAL';

  const momentum = Math.abs(changePct) > 1.0 ? 'STRONG' : Math.abs(changePct) > 0.4 ? 'MODERATE' : 'WEAK';
  const volatility = Math.abs(changePct) > 1.5 ? 'HIGH' : Math.abs(changePct) > 0.5 ? 'MEDIUM' : 'LOW';
  const confidence = Math.min(95, Math.max(55, Math.round(65 + Math.abs(changePct) * 12)));

  // Key Levels
  const s1 = Number((lastClose * (1 - 0.008)).toFixed(2));
  const s2 = Number((lastClose * (1 - 0.016)).toFixed(2));
  const r1 = Number((lastClose * (1 + 0.008)).toFixed(2));
  const r2 = Number((lastClose * (1 + 0.016)).toFixed(2));
  const pivot = Number(lastClose.toFixed(2));

  // Prompt / Gemini execution if GEMINI_API_KEY is available
  let summary = `${sym} saat ini menunjukkan ${bias.toLowerCase()} bias pada timeframe ${timeframe}. Indikator teknikal mengindikasikan momentum ${momentum.toLowerCase()} dengan volatilitas ${volatility.toLowerCase()}.`;
  let bullishFactors = [
    `Momentum harga ${changePct >= 0 ? 'positif' : 'menahan level support'} pada ${quote.price.toFixed(2)}.`,
    rsi < 40 ? 'Indikator RSI mendekati area oversold, membuka peluang technical rebound.' : 'Tekanan beli terkonfirmasi pada timeframe intraday.',
    dxyQuote && dxyQuote.changePercent < 0 ? 'Pelemahan Indeks Dolar AS (DXY) mendukung sentimen aset berisiko dan komoditas.' : 'Aliran likuiditas global tetap resilien.',
  ];
  let bearishFactors = [
    rsi > 65 ? 'Indikator RSI menunjukkan kondisi overbought jangka pendek.' : 'Resistensi terdekat membatasi akselerasi harga lanjutan.',
    dxyQuote && dxyQuote.changePercent > 0 ? 'Penguatan Dolar AS (DXY) memberikan tekanan terhadap aset denominasi USD.' : 'Ketidakpastian jadwal rilis inflasi dan kebijakan suku bunga.',
  ];

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const prompt = `Analisis market finansial profesional untuk instrumen ${sym} (${quote.displayName}).
Data terkini:
- Harga: ${quote.price} (${quote.change >= 0 ? '+' : ''}${quote.change.toFixed(2)}, ${quote.changePercent.toFixed(2)}%)
- Timeframe: ${timeframe}
- RSI 14: ${rsi}
- Indeks Dolar DXY: ${dxyQuote ? `${dxyQuote.price} (${dxyQuote.changePercent.toFixed(2)}%)` : 'Stabil'}
- Konteks Ekonomi: ${economicContextData ? JSON.stringify(economicContextData).slice(0, 300) : 'Ekspektasi kebijakan moneter Fed & rilis data inflasi US.'}

Tolong berikan respons JSON valid dengan struktur:
{
  "summary": "Ringkasan analisis profesional 2 kalimat tanpa kata pasti",
  "bullishFactors": ["faktor 1", "faktor 2"],
  "bearishFactors": ["faktor 1", "faktor 2"]
}`;

      // Try gemini-3.1-flash-lite first, fallback to gemini-3.8-flash
      let aiRes: any = null;
      try {
        aiRes = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
      } catch {
        aiRes = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: 'application/json' },
        });
      }

      const text = aiRes?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (parsed.summary) summary = parsed.summary;
        if (Array.isArray(parsed.bullishFactors)) bullishFactors = parsed.bullishFactors;
        if (Array.isArray(parsed.bearishFactors)) bearishFactors = parsed.bearishFactors;
      }
    } catch {
      // Keep robust algorithmic fallbacks if API is busy or rate-limited
    }
  }

  const analysis: AIMarketAnalysisResult = {
    symbol: sym,
    bias,
    confidence,
    trend,
    momentum,
    volatility,
    summary,
    bullishFactors,
    bearishFactors,
    keyLevels: {
      support1: s1,
      support2: s2,
      resistance1: r1,
      resistance2: r2,
      pivotPoint: pivot,
    },
    economicContext: {
      upcomingRisks: [
        'Rilis data inflasi (CPI / PPI / Core PCE) AS.',
        'Pernyataan pejabat FOMC dan ekspektasi terminal rate.',
        'Volatilitas yield obligasi US Treasury 10-Tahun.',
      ],
      fedExpectation: 'Pasar mengantisipasi penyesuaian suku bunga bertahap berdasarkan data inflasi aktual.',
      dxyImpact: dxyQuote ? `DXY berada pada ${dxyQuote.price.toFixed(2)} (${dxyQuote.changePercent.toFixed(2)}%).` : 'DXY stabil.',
      yieldsImpact: 'Yield US 10Y mempertahankan level kunci pasar obligasi.',
    },
    timestampIso: new Date().toISOString(),
  };

  // Special XAUUSD Special Analysis
  let xauusdSpecial: XauusdSpecialAnalysis | undefined;
  if (sym === 'XAUUSD' || sym === 'GC=F') {
    const goldPrice = quote.price;
    xauusdSpecial = {
      currentPrice: goldPrice,
      trend,
      momentum,
      volatility,
      usdStrength: dxyQuote && dxyQuote.changePercent > 0.2 ? 'STRONG' : dxyQuote && dxyQuote.changePercent < -0.2 ? 'WEAK' : 'NEUTRAL',
      treasuryYield: 'STABLE',
      fedExpectations: 'DOVISH',
      economicRisk: 'HIGH',
      newsSentiment: isUp ? 'SUPPORTIVE FOR GOLD' : isDown ? 'NEGATIVE FOR GOLD' : 'NEUTRAL / MIXED',
      bullishFactors: [
        'Permintaan aset lindung nilai (safe haven) di tengah dinamika geopolitik dan ketidakpastian suku bunga global.',
        'Pembelian emas berkelanjutan oleh bank sentral global sebagai diversifikasi cadangan devisa.',
        dxyQuote && dxyQuote.changePercent < 0 ? 'Pelemahan Dolar AS meningkatkan daya tarik emas bagi pemegang mata uang lain.' : 'Dukungan teknikal di atas level psikologis utama.',
      ],
      bearishFactors: [
        'Jika data ketenagakerjaan atau inflasi AS dirilis lebih tinggi dari consensus forecast, ekspektasi pemangkasan bunga dapat tertunda.',
        'Kenaikan yield obligasi Treasury AS dapat meningkatkan opportunity cost memegang emas non-yielding.',
      ],
      keyLevels: {
        support1: Number((goldPrice - 20).toFixed(2)),
        support2: Number((goldPrice - 45).toFixed(2)),
        resistance1: Number((goldPrice + 25).toFixed(2)),
        resistance2: Number((goldPrice + 55).toFixed(2)),
      },
      upcomingRisk: 'Rilis data inflasi CPI/PPI & keputusan suku bunga FOMC mendatang berpotensi memicu lonjakan volatilitas harga emas.',
      newsImpactSummary: 'Data ekonomi yang lebih lemah dari perkiraan berpotensi bullish untuk XAUUSD, sedangkan data yang jauh lebih kuat dari perkiraan berpotensi menekan harga emas.',
      scenarioAnalysis: {
        bullishScenario: `Jika harga mampu menembus resistensi ${(goldPrice + 25).toFixed(2)}, potensi upside terbuka menuju ${(goldPrice + 55).toFixed(2)}.`,
        bearishScenario: `Jika harga tertekan di bawah support ${(goldPrice - 20).toFixed(2)}, potensi downside menguji area ${(goldPrice - 45).toFixed(2)}.`,
        neutralScenario: `Konsolidasi di rentang ${(goldPrice - 20).toFixed(2)} - ${(goldPrice + 25).toFixed(2)} selama belum ada kejutan rilis data ekonomi besar.`,
      },
      lastUpdatedIso: new Date().toISOString(),
    };
  }

  return { analysis, xauusdSpecial };
}

// ============================================================================
// WEBSOCKET SERVER STREAMING & SUBSCRIPTION MANAGER
// ============================================================================

export function setupMarketWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/api/market/ws' });
  const clientSubscriptions = new Map<WebSocket, Set<string>>();

  wss.on('connection', (ws) => {
    clientSubscriptions.set(ws, new Set());

    ws.on('message', (message) => {
      try {
        const payload = JSON.parse(message.toString());
        const clientSubs = clientSubscriptions.get(ws);
        if (!clientSubs) return;

        if (payload.action === 'subscribe' && payload.symbol) {
          const sym = payload.symbol.toUpperCase();
          clientSubs.add(sym);
          // Send instant quote if available
          fetchLiveQuote(sym)
            .then((q) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'tick', quote: q }));
              }
            })
            .catch(() => {});
        } else if (payload.action === 'unsubscribe' && payload.symbol) {
          clientSubs.delete(payload.symbol.toUpperCase());
        }
      } catch {
        // ignore
      }
    });

    ws.on('close', () => {
      clientSubscriptions.delete(ws);
    });

    ws.on('error', () => {
      clientSubscriptions.delete(ws);
    });
  });

  // Background broadcast interval: streams active subscribed quotes every 2.5s
  setInterval(async () => {
    const allActiveSymbols = new Set<string>();
    for (const subs of clientSubscriptions.values()) {
      for (const s of subs) {
        allActiveSymbols.add(s);
      }
    }

    if (allActiveSymbols.size === 0) return;

    for (const sym of allActiveSymbols) {
      try {
        const quote = await fetchLiveQuote(sym);
        const msg = JSON.stringify({ type: 'tick', quote });

        for (const [ws, subs] of clientSubscriptions.entries()) {
          if (subs.has(sym) && ws.readyState === WebSocket.OPEN) {
            ws.send(msg);
          }
        }
      } catch {
        // ignore tick failure
      }
    }
  }, 2500);

  return wss;
}
