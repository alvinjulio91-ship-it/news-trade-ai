import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Search,
  Sparkles,
  Layers,
  BarChart2,
  AlertTriangle,
  Globe,
  SlidersHorizontal,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  AIMarketAnalysisResult,
  CandleData,
  DEFAULT_TECHNICAL_INDICATORS,
  EconomicNewsItem,
  MarketOverviewData,
  MarketQuote,
  MarketStatusType,
  MarketTimeframe,
  TechnicalIndicatorsConfig,
  XauusdSpecialAnalysis as XauAnalysisType,
} from '../../types';
import { marketDataProvider } from '../../services/marketDataProvider';
import { MarketHeader } from './MarketHeader';
import { LiveMarketChart } from './LiveMarketChart';
import { TechnicalIndicatorsMenu } from './TechnicalIndicatorsMenu';
import { MarketWatchlist } from './MarketWatchlist';
import { MarketOverview } from './MarketOverview';
import { AIMarketAnalysis } from './AIMarketAnalysis';
import { XauusdSpecialAnalysis } from './XauusdSpecialAnalysis';
import { MarketContextPanel } from './MarketContextPanel';
import { NewsMarketConnection } from './NewsMarketConnection';

interface LiveMarketDashboardProps {
  newsItems: EconomicNewsItem[];
  onSelectNewsItem?: (item: EconomicNewsItem) => void;
}

export const LiveMarketDashboard: React.FC<LiveMarketDashboardProps> = ({
  newsItems,
  onSelectNewsItem,
}) => {
  // 1. Primary Market State
  const [activeSymbol, setActiveSymbol] = useState<string>('XAUUSD');
  const [timeframe, setTimeframe] = useState<MarketTimeframe>('15m');
  const [quotes, setQuotes] = useState<Record<string, MarketQuote>>({});
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [overview, setOverview] = useState<MarketOverviewData | null>(null);

  // 2. Status & Loading states
  const [status, setStatus] = useState<MarketStatusType>('CONNECTING');
  const [isCandlesLoading, setIsCandlesLoading] = useState<boolean>(false);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 3. Technical Indicators Config
  const [indicators, setIndicators] = useState<TechnicalIndicatorsConfig>(
    DEFAULT_TECHNICAL_INDICATORS
  );
  const [isIndicatorsMenuOpen, setIsIndicatorsMenuOpen] = useState<boolean>(false);

  // 4. AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState<AIMarketAnalysisResult | null>(null);
  const [xauSpecial, setXauSpecial] = useState<XauAnalysisType | null>(null);

  // 5. Search Modal State
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<MarketQuote[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);

  // 6. View Mode for layout on desktop/mobile
  const [showWatchlistMobile, setShowWatchlistMobile] = useState<boolean>(false);

  // Current active quote
  const activeQuote = useMemo(() => {
    return quotes[activeSymbol.toUpperCase()] || null;
  }, [quotes, activeSymbol]);

  // Subscribe to MarketDataProvider status
  useEffect(() => {
    const unsubscribeStatus = marketDataProvider.onStatusChange((st) => {
      setStatus(st);
    });
    return unsubscribeStatus;
  }, []);

  // Fetch initial batch quotes & overview
  const loadBatchQuotes = useCallback(async () => {
    try {
      const defaultList = [
        'XAUUSD',
        'EURUSD',
        'GBPUSD',
        'USDJPY',
        'DXY',
        'BTCUSD',
        'ETHUSD',
        'SOLUSD',
        'XRPUSD',
        'AAPL',
        'MSFT',
        'NVDA',
        'AMZN',
        'META',
        'GOOGL',
        'TSLA',
        'AMD',
        'NFLX',
        'BBCA',
        'BBRI',
        'BMRI',
        'BBNI',
        'TLKM',
        'ASII',
        'ANTM',
        'ICBP',
        'INDF',
        'GOTO',
      ];
      const batch = await marketDataProvider.getQuotes(defaultList);
      setQuotes((prev) => ({ ...prev, ...batch }));
    } catch {
      // ignore batch error
    }
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const ov = await marketDataProvider.getOverview();
      setOverview(ov);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadBatchQuotes();
    loadOverview();
    const interval = setInterval(() => {
      loadBatchQuotes();
      loadOverview();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadBatchQuotes, loadOverview]);

  // Subscribe to real-time updates for activeSymbol
  useEffect(() => {
    setErrorMessage(null);

    const unsubscribe = marketDataProvider.subscribe(activeSymbol, (quoteUpdate) => {
      setQuotes((prev) => ({
        ...prev,
        [quoteUpdate.symbol]: quoteUpdate,
      }));
    });

    return () => {
      unsubscribe();
    };
  }, [activeSymbol]);

  // Fetch historical candles when activeSymbol or timeframe changes
  const loadCandles = useCallback(async () => {
    setIsCandlesLoading(true);
    setErrorMessage(null);
    try {
      const data = await marketDataProvider.getHistoricalData(activeSymbol, timeframe);
      setCandles(data);
    } catch (err: any) {
      setErrorMessage(
        err?.message?.includes('DATA UNAVAILABLE')
          ? 'DATA UNAVAILABLE — Data instrumen tidak tersedia dari provider.'
          : 'Unable to load market data. Periksa koneksi internet.'
      );
    } finally {
      setIsCandlesLoading(false);
    }
  }, [activeSymbol, timeframe]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  // Fetch AI Market Analysis
  const loadAiAnalysis = useCallback(async () => {
    if (candles.length === 0) return;
    setIsAiLoading(true);
    try {
      const result = await marketDataProvider.getAiMarketAnalysis(
        activeSymbol,
        timeframe,
        candles,
        activeQuote || undefined
      );
      if (result?.analysis) {
        setAiAnalysis(result.analysis);
      }
      if (result?.xauusdSpecial) {
        setXauSpecial(result.xauusdSpecial);
      }
    } catch {
      // safe fallback
    } finally {
      setIsAiLoading(false);
    }
  }, [activeSymbol, timeframe, candles, activeQuote]);

  useEffect(() => {
    if (candles.length > 0) {
      loadAiAnalysis();
    }
  }, [activeSymbol, candles.length > 0 ? 1 : 0]);

  // Search handler
  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await marketDataProvider.searchSymbols(q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSymbol = (sym: string) => {
    setActiveSymbol(sym);
    setIsSearchOpen(false);
    setShowWatchlistMobile(false);
  };

  return (
    <div className="space-y-4 pb-12 animate-view-enter">
      {/* Top Banner Navigation: Live Market Dashboard Title & Quick Watchlist Toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--gold-accent)]/15 border border-[var(--border-gold)] flex items-center justify-center text-[var(--gold-accent)]">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
              Live Market Dashboard
            </h1>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Realtime Candlestick, Technical Analysis & AI Economic Intelligence
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowWatchlistMobile((prev) => !prev)}
          className="h-8 px-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-gold)] text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-[var(--gold-accent)]" />
          <span>Watchlist</span>
        </button>
      </div>

      {/* Error / Data Unavailable Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-between gap-3 text-xs text-[#EF4444]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-bold">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={loadCandles}
            className="px-3 py-1 rounded-lg bg-[#EF4444] text-white font-extrabold text-[11px] cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Watchlist Sidebar (Desktop: 4 cols, Mobile: Toggleable Drawer/Section) */}
        <div
          className={`${
            showWatchlistMobile ? 'block' : 'hidden'
          } lg:block lg:col-span-4 space-y-4`}
        >
          <MarketWatchlist
            quotes={quotes}
            activeSymbol={activeSymbol}
            onSelectSymbol={selectSymbol}
            isLoading={Object.keys(quotes).length === 0}
          />

          <MarketOverview
            overview={overview}
            onSelectSymbol={selectSymbol}
            isLoading={!overview}
          />
        </div>

        {/* Center / Main Chart & AI Section (Desktop: 8 cols, Mobile: full width) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Market Header */}
          <MarketHeader
            quote={activeQuote}
            status={status}
            onOpenIndicators={() => setIsIndicatorsMenuOpen(true)}
            onOpenSearch={() => setIsSearchOpen(true)}
            isLoading={isCandlesLoading}
          />

          {/* Candlestick Chart */}
          <LiveMarketChart
            candles={candles}
            quote={activeQuote}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            indicators={indicators}
            isLoading={isCandlesLoading}
          />

          {/* AI Market Analysis */}
          <AIMarketAnalysis
            analysis={aiAnalysis}
            quote={activeQuote}
            onRefresh={loadAiAnalysis}
            isLoading={isAiLoading}
          />

          {/* Dedicated XAUUSD Special Analysis if gold is selected */}
          {(activeSymbol === 'XAUUSD' || activeSymbol === 'GC=F') && xauSpecial && (
            <XauusdSpecialAnalysis data={xauSpecial} />
          )}

          {/* Global Market Context (5-Pillar Matrix: Gold, USD, Yields, Fed, Risk) */}
          <MarketContextPanel
            xauQuote={quotes['XAUUSD']}
            dxyQuote={quotes['DXY']}
          />

          {/* News + Market Connection */}
          <NewsMarketConnection
            newsItems={newsItems}
            onSelectNewsItem={onSelectNewsItem}
          />
        </div>
      </div>

      {/* Technical Indicators Configuration Menu Modal */}
      <TechnicalIndicatorsMenu
        isOpen={isIndicatorsMenuOpen}
        onClose={() => setIsIndicatorsMenuOpen(false)}
        config={indicators}
        onChange={setIndicators}
      />

      {/* Search Ticker Modal */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-view-enter"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-5 space-y-3.5 shadow-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[var(--gold-accent)]" />
                <h3 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                  SEARCH TICKER / INSTRUMENT
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Ketik simbol atau nama (e.g. XAUUSD, TSLA, BBCA, ETH)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--border-gold)] text-xs text-[var(--text-primary)] focus:outline-none font-mono-num"
              />
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[300px]">
              {isSearching ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                  Mencari simbol...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
                  {searchQuery ? 'Tidak ada hasil ditemukan.' : 'Ketik simbol untuk mencari.'}
                </div>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => selectSymbol(item.symbol)}
                    className="w-full p-2.5 rounded-xl bg-[var(--bg-secondary)]/60 hover:bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-gold)] text-left flex items-center justify-between gap-2 transition-all cursor-pointer"
                  >
                    <div>
                      <div className="font-extrabold text-xs text-[var(--text-primary)]">
                        {item.symbol}
                      </div>
                      <div className="text-[10px] text-[var(--text-secondary)]">
                        {item.displayName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-num text-xs font-bold text-[var(--text-primary)]">
                        ${item.price.toFixed(2)}
                      </div>
                      <div
                        className={`font-mono-num text-[10px] font-bold ${
                          item.changePercent >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                        }`}
                      >
                        {item.changePercent >= 0 ? '+' : ''}
                        {item.changePercent.toFixed(2)}%
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
