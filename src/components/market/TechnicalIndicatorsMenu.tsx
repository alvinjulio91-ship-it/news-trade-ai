import React from 'react';
import { X, CheckSquare, Square, SlidersHorizontal, Info } from 'lucide-react';
import { TechnicalIndicatorsConfig } from '../../types';

interface TechnicalIndicatorsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  config: TechnicalIndicatorsConfig;
  onChange: (newConfig: TechnicalIndicatorsConfig) => void;
}

export const TechnicalIndicatorsMenu: React.FC<TechnicalIndicatorsMenuProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
}) => {
  if (!isOpen) return null;

  const toggle = (key: keyof TechnicalIndicatorsConfig) => {
    onChange({
      ...config,
      [key]: !config[key],
    });
  };

  const indicatorList: {
    key: keyof TechnicalIndicatorsConfig;
    name: string;
    desc: string;
    color: string;
    isDefault?: boolean;
  }[] = [
    {
      key: 'candlestick',
      name: 'Candlestick Chart',
      desc: 'Tampilan utama bar harga OHLC (Open, High, Low, Close).',
      color: '#22C55E',
      isDefault: true,
    },
    {
      key: 'volume',
      name: 'Volume Histogram',
      desc: 'Volume transaksi aktual per candle pada panel bawah.',
      color: '#3B82F6',
      isDefault: true,
    },
    {
      key: 'ema21',
      name: 'EMA 21 (Exponential Moving Average)',
      desc: 'Rata-rata eksponensial 21 periode untuk arah tren jangka pendek/menengah.',
      color: '#D4AF37',
      isDefault: true,
    },
    {
      key: 'ema9',
      name: 'EMA 9 (Fast Exponential Moving Average)',
      desc: 'Garis tren cepat 9 periode untuk mendeteksi trigger momentum.',
      color: '#06B6D4',
    },
    {
      key: 'sma20',
      name: 'SMA 20 (Simple Moving Average)',
      desc: 'Garis rata-rata 20 periode, basis baseline Bollinger Bands.',
      color: '#A855F7',
    },
    {
      key: 'sma50',
      name: 'SMA 50 (Medium Trend Average)',
      desc: 'Level dinamis support/resistensi tren menengah.',
      color: '#EC4899',
    },
    {
      key: 'sma200',
      name: 'SMA 200 (Long Term Trend Benchmark)',
      desc: 'Benchmark tren institusional jangka panjang.',
      color: '#F97316',
    },
    {
      key: 'bollingerBands',
      name: 'Bollinger Bands (20, 2)',
      desc: 'Pita volatilitas atas, tengah (SMA 20), dan bawah berjarak 2 standar deviasi.',
      color: '#6366F1',
    },
    {
      key: 'rsi14',
      name: 'RSI 14 (Relative Strength Index)',
      desc: 'Osilator momentum 0–100 untuk mengidentifikasi overbought (>70) & oversold (<30).',
      color: '#10B981',
    },
    {
      key: 'macd',
      name: 'MACD (12, 26, 9)',
      desc: 'Moving Average Convergence Divergence: garis MACD, Signal, dan Histogram.',
      color: '#F43F5E',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-view-enter"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-[var(--gold-accent)]" />
            <h2 className="text-sm font-extrabold tracking-wider text-[var(--text-primary)] uppercase">
              TECHNICAL INDICATORS
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {indicatorList.map((item) => {
            const isActive = config[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggle(item.key)}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--bg-secondary)] border-[var(--border-gold)]'
                    : 'bg-[var(--bg-secondary)]/50 border-[var(--border-subtle)] hover:border-[var(--border-subtle)]/80'
                }`}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {item.name}
                    </span>
                    {item.isDefault && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--gold-accent)]/15 text-[var(--gold-accent)]">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="shrink-0 mt-0.5 text-[var(--gold-accent)]">
                  {isActive ? (
                    <CheckSquare className="w-5 h-5" />
                  ) : (
                    <Square className="w-5 h-5 text-[var(--text-secondary)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <Info className="w-3.5 h-3.5 text-[var(--gold-accent)]" />
            <span>Preset tersimpan di sesi chart</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--gold-accent)] text-[#070A0F] text-xs font-extrabold cursor-pointer"
          >
            Terapkan
          </button>
        </div>
      </div>
    </div>
  );
};
