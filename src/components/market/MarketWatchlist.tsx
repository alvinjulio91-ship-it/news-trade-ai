import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Star,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Layers,
} from 'lucide-react';
import {
  formatMarketChange,
  formatMarketPrice,
  MarketCategory,
  MarketQuote,
} from '../../types';

interface MarketWatchlistProps {
  quotes: Record<string, MarketQuote>;
  activeSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  isLoading?: boolean;
}

const FAVORITES_STORAGE_KEY = 'xau_news_ai_watchlist_favorites_v1';

export const MarketWatchlist: React.FC<MarketWatchlistProps> = ({
  quotes,
  activeSymbol,
  onSelectSymbol,
  isLoading,
}) => {
  const [activeCategory, setActiveCategory] = useState<MarketCategory | 'all' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<'symbol' | 'price' | 'changePercent'>('changePercent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Favorites state persisted in localStorage
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    // Default favorites
    return { XAUUSD: true, BTCUSD: true, NVDA: true, BBCA: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  const toggleFavorite = (sym: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => ({
      ...prev,
      [sym]: !prev[sym],
    }));
  };

  const quotesList = useMemo(() => {
    return Object.values(quotes);
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotesList.filter((item) => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSymbol = item.symbol.toLowerCase().includes(q);
        const matchName = item.displayName.toLowerCase().includes(q);
        if (!matchSymbol && !matchName) return false;
      }

      // Category filter
      if (activeCategory === 'favorites') {
        return Boolean(favorites[item.symbol]);
      }
      if (activeCategory !== 'all') {
        return item.category === activeCategory;
      }
      return true;
    });
  }, [quotesList, searchQuery, activeCategory, favorites]);

  // Sorting
  const sortedQuotes = useMemo(() => {
    return [...filteredQuotes].sort((a, b) => {
      let diff = 0;
      if (sortKey === 'symbol') {
        diff = a.symbol.localeCompare(b.symbol);
      } else if (sortKey === 'price') {
        diff = a.price - b.price;
      } else if (sortKey === 'changePercent') {
        diff = a.changePercent - b.changePercent;
      }
      return sortOrder === 'desc' ? -diff : diff;
    });
  }, [filteredQuotes, sortKey, sortOrder]);

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3.5 space-y-3">
      {/* Header & Title */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[var(--gold-accent)]" />
          <h2 className="text-xs font-extrabold tracking-wider text-[var(--text-primary)] uppercase">
            WATCHLIST
          </h2>
        </div>

        <span className="text-[10px] font-mono-num text-[var(--text-secondary)]">
          {sortedQuotes.length} aset
        </span>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari simbol (e.g. XAUUSD, BTC, NVDA, BBCA)..."
          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--border-gold)] text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/60 focus:outline-none font-mono-num"
        />
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
        {[
          { id: 'all' as const, label: 'All' },
          { id: 'favorites' as const, label: '⭐ Favs' },
          { id: 'forex' as const, label: 'Forex' },
          { id: 'crypto' as const, label: 'Crypto' },
          { id: 'us_stocks' as const, label: 'US Stocks' },
          { id: 'idx_stocks' as const, label: 'IDX Stocks' },
        ].map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Sort Buttons Bar */}
      <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] px-1">
        <button
          type="button"
          onClick={() => {
            if (sortKey === 'symbol') {
              setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
              setSortKey('symbol');
              setSortOrder('asc');
            }
          }}
          className="flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
        >
          <span>Instrumen</span>
          {sortKey === 'symbol' && <ArrowUpDown className="w-2.5 h-2.5 text-[var(--gold-accent)]" />}
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (sortKey === 'price') {
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
              } else {
                setSortKey('price');
                setSortOrder('desc');
              }
            }}
            className="flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
          >
            <span>Harga</span>
            {sortKey === 'price' && <ArrowUpDown className="w-2.5 h-2.5 text-[var(--gold-accent)]" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (sortKey === 'changePercent') {
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
              } else {
                setSortKey('changePercent');
                setSortOrder('desc');
              }
            }}
            className="flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
          >
            <span>24h %</span>
            {sortKey === 'changePercent' && <ArrowUpDown className="w-2.5 h-2.5 text-[var(--gold-accent)]" />}
          </button>
        </div>
      </div>

      {/* Watchlist Item Rows */}
      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-0.5">
        {sortedQuotes.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
            {isLoading ? 'Memuat data market...' : 'Tidak ada instrumen yang cocok.'}
          </div>
        ) : (
          sortedQuotes.map((item) => {
            const isSelected = item.symbol === activeSymbol;
            const isFav = Boolean(favorites[item.symbol]);
            const isPositive = item.changePercent > 0;
            const isNegative = item.changePercent < 0;

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectSymbol(item.symbol)}
                className={`w-full p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 text-left cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--bg-secondary)] border-[var(--border-gold)] shadow-sm'
                    : 'bg-[var(--bg-secondary)]/40 border-[var(--border-subtle)] hover:bg-[var(--bg-secondary)] hover:border-[var(--border-subtle)]/80'
                }`}
              >
                {/* Left: Star + Symbol & Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(item.symbol, e)}
                    className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--gold-accent)] cursor-pointer"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        isFav ? 'fill-[var(--gold-accent)] text-[var(--gold-accent)]' : ''
                      }`}
                    />
                  </button>

                  <div className="min-w-0">
                    <div className="font-extrabold text-xs text-[var(--text-primary)] truncate">
                      {item.symbol}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] truncate">
                      {item.displayName}
                    </div>
                  </div>
                </div>

                {/* Right: Price & Change % */}
                <div className="text-right shrink-0">
                  <div className="font-mono-num text-xs font-bold text-[var(--text-primary)]">
                    {formatMarketPrice(item.price, item.symbol)}
                  </div>
                  <div
                    className={`font-mono-num text-[11px] font-extrabold flex items-center justify-end gap-0.5 ${
                      isPositive
                        ? 'text-[#22C55E]'
                        : isNegative
                        ? 'text-[#EF4444]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : isNegative ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : null}
                    <span>
                      {isPositive ? '+' : ''}
                      {item.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
