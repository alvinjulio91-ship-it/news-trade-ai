import React from 'react';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Compass,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { formatMarketPrice, XauusdSpecialAnalysis as XauAnalysisType } from '../../types';

interface XauusdSpecialAnalysisProps {
  data: XauAnalysisType | null;
}

export const XauusdSpecialAnalysis: React.FC<XauusdSpecialAnalysisProps> = ({ data }) => {
  if (!data) return null;

  return (
    <div
      className="rounded-3xl p-5 border border-[var(--border-gold)] space-y-4 shadow-2xl relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
      }}
    >
      {/* Gold Hero Header */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[var(--gold-accent)]/15 border border-[var(--border-gold)] flex items-center justify-center text-[var(--gold-accent)] font-extrabold text-sm">
            Au
          </div>
          <div>
            <h2 className="text-sm font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
              XAUUSD SPECIAL AI ANALYSIS
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Sintesis fundamental emas, DXY, Treasury yields & ekspektasi The Fed
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-[var(--text-secondary)] font-mono-num uppercase block">
            SPOT GOLD
          </span>
          <span className="font-mono-num text-lg font-extrabold text-[var(--text-primary)]">
            ${formatMarketPrice(data.currentPrice, 'XAUUSD')}
          </span>
        </div>
      </div>

      {/* Macro Drivers Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="p-3 rounded-2xl bg-[var(--bg-primary)]/70 border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">USD STRENGTH</span>
          <span
            className={`font-mono-num font-extrabold text-xs block ${
              data.usdStrength === 'WEAK'
                ? 'text-[#22C55E]'
                : data.usdStrength === 'STRONG'
                ? 'text-[#EF4444]'
                : 'text-[#F59E0B]'
            }`}
          >
            {data.usdStrength}
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">
            {data.usdStrength === 'WEAK' ? 'DXY Melemah (Bullish Gold)' : 'DXY Menguat (Tekanan Gold)'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--bg-primary)]/70 border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">10Y YIELDS</span>
          <span
            className={`font-mono-num font-extrabold text-xs block ${
              data.treasuryYield === 'FALLING'
                ? 'text-[#22C55E]'
                : data.treasuryYield === 'RISING'
                ? 'text-[#EF4444]'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {data.treasuryYield}
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">
            {data.treasuryYield === 'FALLING' ? 'Yield turun (Dukungan Emas)' : 'Yield stabil/naik'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--bg-primary)]/70 border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">FED POLICY</span>
          <span
            className={`font-mono-num font-extrabold text-xs block ${
              data.fedExpectations === 'DOVISH'
                ? 'text-[#22C55E]'
                : data.fedExpectations === 'HAWKISH'
                ? 'text-[#EF4444]'
                : 'text-[#F59E0B]'
            }`}
          >
            {data.fedExpectations}
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">
            {data.fedExpectations === 'DOVISH' ? 'Ekspektasi Rate Cut' : 'Suku bunga netral'}
          </span>
        </div>

        <div className="p-3 rounded-2xl bg-[var(--bg-primary)]/70 border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">ECONOMIC RISK</span>
          <span
            className={`font-mono-num font-extrabold text-xs block ${
              data.economicRisk === 'HIGH' ? 'text-[#F59E0B]' : 'text-[var(--text-primary)]'
            }`}
          >
            {data.economicRisk}
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">Safe-Haven Demand</span>
        </div>
      </div>

      {/* Bullish & Bearish Factors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[#22C55E]/30 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#22C55E]">
            <ShieldCheck className="w-4 h-4" />
            <span>BULLISH FACTORS</span>
          </div>
          <ul className="space-y-1.5 text-[11px]">
            {data.bullishFactors.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[var(--text-primary)] leading-snug">
                <span className="text-[#22C55E] font-bold">✓</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[#EF4444]/30 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#EF4444]">
            <ShieldAlert className="w-4 h-4" />
            <span>BEARISH FACTORS</span>
          </div>
          <ul className="space-y-1.5 text-[11px]">
            {data.bearishFactors.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[var(--text-primary)] leading-snug">
                <span className="text-[#EF4444] font-bold">✕</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Key Technical Levels */}
      <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-subtle)] space-y-2 text-xs">
        <div className="flex items-center justify-between text-xs font-bold text-[var(--gold-accent)]">
          <span>KEY TECHNICAL LEVELS</span>
          <span className="text-[10px] font-mono-num text-[var(--text-secondary)]">USD / Troy Ounce</span>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center font-mono-num text-xs">
          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="block text-[10px] text-[#EF4444]">Support 2</span>
            <strong className="text-[var(--text-primary)] font-extrabold">${data.keyLevels.support2}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="block text-[10px] text-[#EF4444]">Support 1</span>
            <strong className="text-[var(--text-primary)] font-extrabold">${data.keyLevels.support1}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="block text-[10px] text-[#22C55E]">Resistance 1</span>
            <strong className="text-[var(--text-primary)] font-extrabold">${data.keyLevels.resistance1}</strong>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)]">
            <span className="block text-[10px] text-[#22C55E]">Resistance 2</span>
            <strong className="text-[var(--text-primary)] font-extrabold">${data.keyLevels.resistance2}</strong>
          </div>
        </div>
      </div>

      {/* Upcoming Risk & News Impact */}
      <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-subtle)] space-y-2 text-xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#F59E0B]">
          <AlertTriangle className="w-4 h-4" />
          <span>UPCOMING RISK & NEWS IMPACT</span>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          {data.upcomingRisk}
        </p>
        <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">
          {data.newsImpactSummary}
        </p>
      </div>

      {/* Scenario Analysis (No certainty words, uses scenarios) */}
      <div className="p-3.5 rounded-2xl bg-[var(--bg-primary)]/60 border border-[var(--border-gold)]/40 space-y-2.5 text-xs">
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--gold-accent)] uppercase">
          <Compass className="w-4 h-4" />
          <span>SCENARIO ANALYSIS</span>
        </div>

        <div className="space-y-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[#22C55E]/30 space-y-1">
            <span className="font-extrabold text-[#22C55E] block">🟢 Bullish Scenario (Potential Upside):</span>
            <p className="text-[var(--text-primary)] leading-snug">{data.scenarioAnalysis.bullishScenario}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[#EF4444]/30 space-y-1">
            <span className="font-extrabold text-[#EF4444] block">🔴 Bearish Scenario (Potential Downside):</span>
            <p className="text-[var(--text-primary)] leading-snug">{data.scenarioAnalysis.bearishScenario}</p>
          </div>

          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] border border-[#F59E0B]/30 space-y-1">
            <span className="font-extrabold text-[#F59E0B] block">🟡 Neutral / Range-Bound Scenario:</span>
            <p className="text-[var(--text-primary)] leading-snug">{data.scenarioAnalysis.neutralScenario}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
