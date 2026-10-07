import React from 'react';
import { Globe, ArrowRight, ShieldCheck, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { MarketQuote } from '../../types';

interface MarketContextPanelProps {
  xauQuote?: MarketQuote;
  dxyQuote?: MarketQuote;
}

export const MarketContextPanel: React.FC<MarketContextPanelProps> = ({
  xauQuote,
  dxyQuote,
}) => {
  const isGoldBullish = (xauQuote?.changePercent || 0) >= 0;
  const isUsdWeak = (dxyQuote?.changePercent || 0) <= 0;

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[var(--gold-accent)]" />
          <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
            GLOBAL MARKET CONTEXT
          </h2>
        </div>
        <span className="text-[10px] text-[var(--text-secondary)] font-mono-num">
          Intermarket Correlation
        </span>
      </div>

      {/* 5-Pillar Correlation Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">XAUUSD</span>
          <span className={`font-mono-num font-extrabold text-xs block ${isGoldBullish ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {isGoldBullish ? 'Bullish Bias' : 'Bearish Bias'}
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">
            ${xauQuote ? xauQuote.price.toFixed(2) : '---'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">USD (DXY)</span>
          <span className={`font-mono-num font-extrabold text-xs block ${isUsdWeak ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {isUsdWeak ? 'Weak / Soft' : 'Firm / Strong'}
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">
            {dxyQuote ? `${dxyQuote.price.toFixed(2)} (${dxyQuote.changePercent >= 0 ? '+' : ''}${dxyQuote.changePercent.toFixed(2)}%)` : '---'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">US 10Y YIELDS</span>
          <span className="font-mono-num font-extrabold text-xs text-[#22C55E] block">
            Easing
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">Benchmark Rate</span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">FED EXPECTATION</span>
          <span className="font-mono-num font-extrabold text-xs text-[#22C55E] block">
            Dovish Tilt
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">Policy Pivot</span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-[var(--text-secondary)] uppercase block">ECONOMIC RISK</span>
          <span className="font-mono-num font-extrabold text-xs text-[#F59E0B] block">
            Elevated (High)
          </span>
          <span className="text-[9px] text-[var(--text-secondary)] block">Safe-Haven Support</span>
        </div>
      </div>

      {/* Intermarket Relationship Synthesis */}
      <div className="p-3.5 rounded-xl bg-[var(--bg-secondary)]/60 border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] space-y-2 leading-relaxed">
        <div className="font-bold text-[var(--gold-accent)] text-[11px] uppercase tracking-wider">
          HUBUNGAN INTERMARKET TERHADAP XAUUSD:
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]">
          1. <strong>USD Inversely Correlated:</strong> Emas diperdagangkan dalam mata uang USD. Pelemahan Indeks Dolar AS (DXY) membuat emas lebih murah bagi investor dengan mata uang non-dolar, sehingga mendorong aliran masuk modal ke XAUUSD.
        </p>
        <p className="text-[11px] text-[var(--text-secondary)]">
          2. <strong>Treasury Yields Opportunity Cost:</strong> Emas adalah aset tanpa imbal hasil bunga (*non-yielding asset*). Ketika yield obligasi US Treasury menurun, daya tarik emas meningkat karena *opportunity cost* kepemilikannya menurun.
        </p>
        <p className="text-[11px] text-[var(--text-secondary)]">
          3. <strong>Ekspektasi Suku Bunga The Fed:</strong> Siklus pelonggaran moneter / pemangkasan suku bunga Fed secara historis memberikan dorongan likuiditas makro yang kuat bagi harga emas.
        </p>
      </div>
    </div>
  );
};
