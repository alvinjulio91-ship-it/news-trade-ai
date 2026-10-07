import React from 'react';
import { Newspaper, ArrowRight, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { EconomicNewsItem } from '../../types';

interface NewsMarketConnectionProps {
  newsItems: EconomicNewsItem[];
  onSelectNewsItem?: (item: EconomicNewsItem) => void;
}

export const NewsMarketConnection: React.FC<NewsMarketConnectionProps> = ({
  newsItems,
  onSelectNewsItem,
}) => {
  // Take top 6 high-impact economic releases (released & upcoming)
  const keyEvents = newsItems.slice(0, 6);

  if (keyEvents.length === 0) return null;

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-[var(--gold-accent)]" />
          <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
            NEWS + MARKET INTELLIGENCE CONNECTION
          </h2>
        </div>
        <span className="text-[10px] text-[var(--text-secondary)] font-mono-num">
          Impact on XAUUSD & USD
        </span>
      </div>

      <div className="space-y-3">
        {keyEvents.map((item) => {
          const isReleased = item.status === 'RELEASED';
          const actualValue = isReleased && item.actualAvailable ? item.actual : null;

          return (
            <div
              key={item.id}
              onClick={() => onSelectNewsItem?.(item)}
              className="p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-gold)]/60 transition-all space-y-2.5 cursor-pointer"
            >
              {/* Event Title & Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🇺🇸</span>
                  <span className="text-xs font-extrabold text-[var(--text-primary)]">
                    {item.eventName}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono-num font-extrabold ${
                      isReleased
                        ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                        : 'bg-[var(--gold-accent)]/15 text-[var(--gold-accent)] border border-[var(--gold-accent)]/30'
                    }`}
                  >
                    {isReleased ? 'RELEASED' : 'UPCOMING'}
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono-num">
                    {item.releaseTime}
                  </span>
                </div>
              </div>

              {/* Data Triad: Previous, Forecast, Actual */}
              <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-[var(--bg-primary)]/70 text-center font-mono-num text-[11px]">
                <div>
                  <span className="block text-[9px] text-[var(--text-secondary)] uppercase">
                    PREVIOUS
                  </span>
                  <strong className="text-[var(--text-primary)]">{item.previous}</strong>
                </div>

                <div>
                  <span className="block text-[9px] text-[var(--text-secondary)] uppercase">
                    FORECAST
                  </span>
                  <strong className="text-[var(--gold-accent)]">{item.forecast}</strong>
                </div>

                <div>
                  <span className="block text-[9px] text-[var(--text-secondary)] uppercase">
                    ACTUAL
                  </span>
                  {actualValue !== null ? (
                    <strong className="text-[#22C55E]">{actualValue}</strong>
                  ) : (
                    <span className="text-[10px] text-[var(--text-secondary)] italic">
                      null (Pending)
                    </span>
                  )}
                </div>
              </div>

              {/* AI Market Impact Grid: XAUUSD & USD */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase block">
                    XAUUSD IMPACT
                  </span>
                  <span
                    className={`font-bold text-[11px] block ${
                      item.xauusdImpact.includes('SUPPORTIVE')
                        ? 'text-[#22C55E]'
                        : item.xauusdImpact.includes('NEGATIVE')
                        ? 'text-[#EF4444]'
                        : 'text-[#F59E0B]'
                    }`}
                  >
                    {item.xauusdImpact}
                  </span>
                </div>

                <div className="p-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] space-y-0.5">
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase block">
                    USD IMPACT
                  </span>
                  <span
                    className={`font-bold text-[11px] block ${
                      item.xauusdImpact.includes('SUPPORTIVE')
                        ? 'text-[#EF4444]'
                        : item.xauusdImpact.includes('NEGATIVE')
                        ? 'text-[#22C55E]'
                        : 'text-[#F59E0B]'
                    }`}
                  >
                    {item.xauusdImpact.includes('SUPPORTIVE')
                      ? 'POTENTIALLY BEARISH FOR USD'
                      : item.xauusdImpact.includes('NEGATIVE')
                      ? 'POTENTIALLY BULLISH FOR USD'
                      : 'NEUTRAL / MIXED FOR USD'}
                  </span>
                </div>
              </div>

              {/* Reasoning */}
              {(item.impactReasoning || item.summary) && (
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">
                  <strong className="text-[var(--text-primary)]">Reason: </strong>
                  {item.impactReasoning || item.summary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
