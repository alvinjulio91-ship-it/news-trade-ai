import {
  CandleData,
  MarketCategory,
  MarketOverviewData,
  MarketQuote,
  MarketStatusType,
  MarketTimeframe,
} from '../types';

export type QuoteUpdateCallback = (quote: MarketQuote) => void;
export type StatusUpdateCallback = (status: MarketStatusType) => void;

class MarketDataProviderService {
  private subscribers = new Map<string, Set<QuoteUpdateCallback>>();
  private statusListeners = new Set<StatusUpdateCallback>();
  private ws: WebSocket | null = null;
  private wsStatus: MarketStatusType = 'CONNECTING';
  private reconnectAttempts = 0;
  private reconnectTimer: any = null;
  private pollingTimer: any = null;
  private activeSubscribedSymbols = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.initWebSocket();
      // Setup background polling as a resilient fallback
      this.startPollingFallback();
    }
  }

  public getStatus(): MarketStatusType {
    return this.wsStatus;
  }

  public onStatusChange(callback: StatusUpdateCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.wsStatus);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private setStatus(newStatus: MarketStatusType) {
    if (this.wsStatus !== newStatus) {
      this.wsStatus = newStatus;
      this.statusListeners.forEach((cb) => cb(newStatus));
    }
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/market/ws`;

      this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('LIVE');

        // Resubscribe all active symbols
        for (const symbol of this.activeSubscribedSymbols) {
          this.sendWsMessage({ action: 'subscribe', symbol });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'tick' && data.quote) {
            const quote: MarketQuote = data.quote;
            this.notifySubscribers(quote.symbol, quote);
          } else if (data.type === 'status' && data.status) {
            this.setStatus(data.status);
          }
        } catch {
          // ignore malformed messages
        }
      };

      this.ws.onerror = () => {
        this.setStatus('OFFLINE');
      };

      this.ws.onclose = () => {
        this.ws = null;
        this.setStatus('RECONNECTING');
        this.scheduleReconnect();
      };
    } catch {
      this.setStatus('OFFLINE');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(30000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.initWebSocket();
    }, delay);
  }

  private sendWsMessage(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private notifySubscribers(symbol: string, quote: MarketQuote) {
    const subs = this.subscribers.get(symbol.toUpperCase());
    if (subs) {
      subs.forEach((cb) => cb(quote));
    }
  }

  private startPollingFallback() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = setInterval(async () => {
      // Poll active subscribed symbols every 4 seconds if ws is not open
      if (this.activeSubscribedSymbols.size > 0 && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        try {
          const symbols = Array.from(this.activeSubscribedSymbols);
          const quotes = await this.getQuotes(symbols);
          for (const [sym, q] of Object.entries(quotes)) {
            this.notifySubscribers(sym, q);
          }
          if (this.wsStatus === 'OFFLINE') {
            this.setStatus('DELAYED');
          }
        } catch {
          // keep fallback silent
        }
      }
    }, 4000);
  }

  // ==========================================================================
  // PUBLIC API INTERFACE
  // ==========================================================================

  public async getQuote(symbol: string): Promise<MarketQuote> {
    const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch quote for ${symbol}: ${res.statusText}`);
    }
    const data = await res.json();
    return data;
  }

  public async getQuotes(symbols: string[]): Promise<Record<string, MarketQuote>> {
    if (!symbols || symbols.length === 0) return {};
    const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(','))}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch batch quotes: ${res.statusText}`);
    }
    return res.json();
  }

  public async getHistoricalData(
    symbol: string,
    timeframe: MarketTimeframe
  ): Promise<CandleData[]> {
    const res = await fetch(
      `/api/market/history?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch historical data for ${symbol}: ${res.statusText}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Historical data returned invalid format');
    }
    return data;
  }

  public async getOverview(): Promise<MarketOverviewData> {
    const res = await fetch('/api/market/overview');
    if (!res.ok) {
      throw new Error(`Failed to fetch market overview: ${res.statusText}`);
    }
    return res.json();
  }

  public async searchSymbols(query: string): Promise<MarketQuote[]> {
    if (!query || !query.trim()) return [];
    const res = await fetch(`/api/market/search?query=${encodeURIComponent(query.trim())}`);
    if (!res.ok) return [];
    return res.json();
  }

  public subscribe(symbol: string, callback: QuoteUpdateCallback): () => void {
    const symUpper = symbol.toUpperCase();
    if (!this.subscribers.has(symUpper)) {
      this.subscribers.set(symUpper, new Set());
    }
    this.subscribers.get(symUpper)!.add(callback);
    this.activeSubscribedSymbols.add(symUpper);

    // Notify backend WebSocket server
    this.sendWsMessage({ action: 'subscribe', symbol: symUpper });

    // Fetch initial quote immediately
    this.getQuote(symUpper)
      .then((q) => callback(q))
      .catch(() => {});

    return () => {
      this.unsubscribe(symUpper, callback);
    };
  }

  public unsubscribe(symbol: string, callback?: QuoteUpdateCallback) {
    const symUpper = symbol.toUpperCase();
    const subs = this.subscribers.get(symUpper);
    if (subs) {
      if (callback) {
        subs.delete(callback);
      } else {
        subs.clear();
      }
      if (subs.size === 0) {
        this.subscribers.delete(symUpper);
        this.activeSubscribedSymbols.delete(symUpper);
        this.sendWsMessage({ action: 'unsubscribe', symbol: symUpper });
      }
    }
  }

  public async getAiMarketAnalysis(
    symbol: string,
    timeframe: MarketTimeframe,
    candles: CandleData[],
    currentQuote?: MarketQuote
  ) {
    const res = await fetch('/api/market/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        timeframe,
        currentQuote,
        latestCandles: candles.slice(-50),
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to generate AI Market Analysis: ${res.statusText}`);
    }
    return res.json();
  }
}

export const marketDataProvider = new MarketDataProviderService();
