import React from 'react';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  SlidersHorizontal,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  formatMarketChange,
  formatMarketPrice,
  MarketQuote,
  MarketStatusType,
} from '../../types';

interface MarketHeaderProps {
  quote: MarketQuote | null;
  status: MarketStatusType;
  onOpenIndicators: () => void;
  onOpenSearch: () => void;
  isLoading?: boolean;
}

export const MarketHeader: React.FC<MarketHeaderProps> = ({
  quote,
  status,
  onOpenIndicators,
  onOpenSearch,
  isLoading,
}) => {
  if (!quote) {
    return (
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 flex items-center justify-between animate-pulse">
        <div className="h-6 w-32 bg-[var(--bg-secondary)] rounded-md" />
        <div className="h-6 w-24 bg-[var(--bg-secondary)] rounded-md" />
      </div>
    );
  }

  const { text: changeText, isPositive, isNegative } = formatMarketChange(
    quote.change,
    quote.changePercent
  );

  const getStatusBadge = (st: MarketStatusType) => {
    switch (st) {
      case 'LIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            LIVE
          </span>
        );
      case 'CONNECTING':
      case 'RECONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-spin" />
            {st}
          </span>
        );
      case 'DELAYED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[#3B82F6] text-[10px] font-bold">
            DATA DELAYED
          </span>
        );
      case 'MARKET CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--text-secondary)]/15 border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[10px] font-bold">
            MARKET CLOSED
          </span>
        );
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-bold">
            OFFLINE
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 space-y-2.5">
      {/* Top row: Symbol, Name, Badges, Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 text-left group cursor-pointer"
          >
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)] group-hover:text-[var(--gold-accent)] transition-colors">
              {quote.symbol}
            </h1>
            <Search className="w-3.5 h-3.5 text-[var(--text-secondary)] group-hover:text-[var(--gold-accent)]" />
          </button>

          <span className="text-xs text-[var(--text-secondary)] font-medium">
            {quote.displayName}
          </span>

          <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[10px] font-mono-num font-semibold text-[var(--text-secondary)] uppercase">
            {quote.category.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge(status)}

          <button
            type="button"
            onClick={onOpenIndicators}
            title="Indikator Teknikal"
            className="h-8 px-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-gold)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--gold-accent)]" />
            <span className="hidden sm:inline">Indicators</span>
          </button>
        </div>
      </div>

      {/* Middle row: Live Price, Change, 24h High/Low */}
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-3">
          <span className="font-mono-num text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)]">
            {formatMarketPrice(quote.price, quote.symbol)}
          </span>

          <span
            className={`font-mono-num text-sm font-bold flex items-center gap-0.5 ${
              isPositive ? 'text-[#22C55E]' : isNegative ? 'text-[#EF4444]' : 'text-[var(--text-secondary)]'
            }`}
          >
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : isNegative ? <ArrowDownRight className="w-4 h-4" /> : null}
            {changeText}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono-num text-[var(--text-secondary)]">
          {quote.high24h !== undefined && (
            <div>
              <span className="text-[10px] block opacity-70">HIGH</span>
              <span className="text-[var(--text-primary)]">{formatMarketPrice(quote.high24h, quote.symbol)}</span>
            </div>
          )}
          {quote.low24h !== undefined && (
            <div>
              <span className="text-[10px] block opacity-70">LOW</span>
              <span className="text-[var(--text-primary)]">{formatMarketPrice(quote.low24h, quote.symbol)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom info bar: Last update */}
      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[var(--gold-accent)]" />
          <span>Updated just now</span>
        </div>

        {isLoading && (
          <div className="flex items-center gap-1 text-[var(--gold-accent)] text-[10px]">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Syncing candles...</span>
          </div>
        )}
      </div>
    </div>
  );
};
