import React from 'react';
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Compass,
  Zap,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Target,
} from 'lucide-react';
import { AIMarketAnalysisResult, MarketQuote } from '../../types';

interface AIMarketAnalysisProps {
  analysis: AIMarketAnalysisResult | null;
  quote: MarketQuote | null;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const AIMarketAnalysis: React.FC<AIMarketAnalysisProps> = ({
  analysis,
  quote,
  onRefresh,
  isLoading,
}) => {
  if (!analysis) {
    return (
      <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-36 bg-[var(--bg-secondary)] rounded-md animate-pulse" />
          <div className="h-4 w-20 bg-[var(--bg-secondary)] rounded-md animate-pulse" />
        </div>
        <div className="h-32 bg-[var(--bg-secondary)] rounded-xl animate-pulse" />
      </div>
    );
  }

  const getBiasBadge = (bias: string) => {
    switch (bias) {
      case 'BULLISH':
        return (
          <span className="px-3 py-1 rounded-xl bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E] text-xs font-extrabold flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>BULLISH BIAS</span>
          </span>
        );
      case 'BEARISH':
        return (
          <span className="px-3 py-1 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] text-xs font-extrabold flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>BEARISH BIAS</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-xs font-extrabold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>NEUTRAL / MIXED</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-4 sm:p-5 space-y-4 shadow-xl relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--gold-accent)]" />
          <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
            AI MARKET INTELLIGENCE · {analysis.symbol}
          </h2>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="p-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--gold-accent)]/15 border border-[var(--border-subtle)] text-[var(--gold-accent)] transition-colors cursor-pointer disabled:opacity-50"
          title="Segarkan Analisis AI"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Primary Verdict & Confidence Banner */}
      <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <span className="text-[10px] font-mono-num text-[var(--text-secondary)] block uppercase">
              MARKET BIAS
            </span>
            <div className="mt-1">{getBiasBadge(analysis.bias)}</div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-mono-num text-[var(--text-secondary)] block uppercase">
              CONFIDENCE SCORE
            </span>
            <span className="font-mono-num text-lg font-extrabold text-[var(--gold-accent)]">
              {analysis.confidence}%
            </span>
          </div>
        </div>

        {/* Confidence Bar */}
        <div className="w-full h-2 rounded-full bg-[var(--bg-primary)] overflow-hidden border border-[var(--border-subtle)]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${analysis.confidence}%`,
              background:
                analysis.bias === 'BULLISH'
                  ? 'linear-gradient(90deg, #D4AF37 0%, #22C55E 100%)'
                  : analysis.bias === 'BEARISH'
                  ? 'linear-gradient(90deg, #D4AF37 0%, #EF4444 100%)'
                  : '#F59E0B',
            }}
          />
        </div>
      </div>

      {/* 3 Metrics: Trend, Momentum, Volatility */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">TREND</span>
          <span
            className={`font-mono-num text-xs font-extrabold truncate block ${
              analysis.trend.includes('BULLISH')
                ? 'text-[#22C55E]'
                : analysis.trend.includes('BEARISH')
                ? 'text-[#EF4444]'
                : 'text-[#F59E0B]'
            }`}
          >
            {analysis.trend}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">MOMENTUM</span>
          <span className="font-mono-num text-xs font-extrabold text-[var(--text-primary)] block">
            {analysis.momentum}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">VOLATILITY</span>
          <span className="font-mono-num text-xs font-extrabold text-[var(--gold-accent)] block">
            {analysis.volatility}
          </span>
        </div>
      </div>

      {/* AI Synthesis Summary */}
      <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/70 border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] leading-relaxed">
        {analysis.summary}
      </div>

      {/* Bullish & Bearish Factors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Bullish Factors */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[#22C55E]/20 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#22C55E]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>BULLISH FACTORS</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
            {analysis.bullishFactors.map((factor, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-[#22C55E] font-bold">✓</span>
                <span className="leading-snug text-[var(--text-primary)]">{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bearish Factors */}
        <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[#EF4444]/20 space-y-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#EF4444]">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>BEARISH FACTORS</span>
          </div>
          <ul className="space-y-1.5 text-[11px] text-[var(--text-secondary)]">
            {analysis.bearishFactors.map((factor, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-[#EF4444] font-bold">✕</span>
                <span className="leading-snug text-[var(--text-primary)]">{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Levels (Support & Resistance) */}
      {analysis.keyLevels && (
        <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--gold-accent)]">
            <Target className="w-3.5 h-3.5" />
            <span>KEY TECHNICAL LEVELS</span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center font-mono-num text-[11px]">
            <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <span className="block text-[9px] text-[#EF4444]">S2</span>
              <strong className="text-[var(--text-primary)]">{analysis.keyLevels.support2}</strong>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <span className="block text-[9px] text-[#EF4444]">S1</span>
              <strong className="text-[var(--text-primary)]">{analysis.keyLevels.support1}</strong>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <span className="block text-[9px] text-[#22C55E]">R1</span>
              <strong className="text-[var(--text-primary)]">{analysis.keyLevels.resistance1}</strong>
            </div>
            <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)]">
              <span className="block text-[9px] text-[#22C55E]">R2</span>
              <strong className="text-[var(--text-primary)]">{analysis.keyLevels.resistance2}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
