import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  BarChart2,
  ChevronRight,
} from 'lucide-react';
import {
  formatMarketChange,
  formatMarketPrice,
  MarketOverviewData,
  MarketQuote,
} from '../../types';

interface MarketOverviewProps {
  overview: MarketOverviewData | null;
  onSelectSymbol: (symbol: string) => void;
  isLoading?: boolean;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  overview,
  onSelectSymbol,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<
    'gainers' | 'losers' | 'active' | 'volatility'
  >('gainers');

  if (!overview) {
    return (
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 space-y-3">
        <div className="h-5 w-36 bg-[var(--bg-secondary)] rounded-md animate-pulse" />
        <div className="h-28 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
      </div>
    );
  }

  const getList = (): MarketQuote[] => {
    switch (activeTab) {
      case 'gainers':
        return overview.topGainers;
      case 'losers':
        return overview.topLosers;
      case 'active':
        return overview.mostActive;
      case 'volatility':
        return overview.highestVolatility;
      default:
        return overview.topGainers;
    }
  };

  const list = getList();

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-[var(--gold-accent)]" />
          <h2 className="text-xs font-extrabold tracking-wider text-[var(--text-primary)] uppercase">
            MARKET OVERVIEW
          </h2>
        </div>
        <span className="text-[10px] text-[var(--text-secondary)] font-mono-num">
          Live Realtime Ranking
        </span>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)] text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab('gainers')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'gainers'
              ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          <span>Gainers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('losers')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'losers'
              ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <TrendingDown className="w-3 h-3" />
          <span>Losers</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'active'
              ? 'bg-[#3B82F6]/20 text-[#3B82F6] border border-[#3B82F6]/40'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Activity className="w-3 h-3" />
          <span>Active</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('volatility')}
          className={`py-1.5 rounded-lg font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
            activeTab === 'volatility'
              ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>Volatility</span>
        </button>
      </div>

      {/* Ranked Items List */}
      <div className="space-y-1.5">
        {list.map((item, idx) => {
          const isPositive = item.changePercent > 0;
          const isNegative = item.changePercent < 0;

          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol(item.symbol)}
              className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--border-subtle)] hover:border-[var(--border-gold)] transition-all flex items-center justify-between gap-3 cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-5 h-5 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-[10px] font-mono-num font-extrabold flex items-center justify-center text-[var(--gold-accent)] shrink-0">
                  #{idx + 1}
                </span>

                <div className="min-w-0">
                  <div className="font-extrabold text-xs text-[var(--text-primary)] truncate">
                    {item.symbol}
                  </div>
                  <div className="text-[10px] text-[var(--text-secondary)] truncate">
                    {item.displayName}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 flex items-center gap-2">
                <div>
                  <div className="font-mono-num text-xs font-bold text-[var(--text-primary)]">
                    {formatMarketPrice(item.price, item.symbol)}
                  </div>
                  <div
                    className={`font-mono-num text-[11px] font-extrabold ${
                      isPositive
                        ? 'text-[#22C55E]'
                        : isNegative
                        ? 'text-[#EF4444]'
                        : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {item.changePercent.toFixed(2)}%
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
