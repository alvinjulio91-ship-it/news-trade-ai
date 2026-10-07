import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  Time,
} from 'lightweight-charts';
import {
  CandleData,
  MarketQuote,
  MarketTimeframe,
  TechnicalIndicatorsConfig,
} from '../../types';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
} from '../../services/technicalIndicators';

interface LiveMarketChartProps {
  candles: CandleData[];
  quote: MarketQuote | null;
  timeframe: MarketTimeframe;
  onTimeframeChange: (tf: MarketTimeframe) => void;
  indicators: TechnicalIndicatorsConfig;
  isLoading?: boolean;
}

const TIMEFRAMES: MarketTimeframe[] = [
  '1m',
  '5m',
  '15m',
  '30m',
  '1H',
  '4H',
  '1D',
  '1W',
  '1M',
];

export const LiveMarketChart: React.FC<LiveMarketChartProps> = ({
  candles,
  quote,
  timeframe,
  onTimeframeChange,
  indicators,
  isLoading,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const rsiContainerRef = useRef<HTMLDivElement>(null);
  const macdContainerRef = useRef<HTMLDivElement>(null);

  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Indicator series refs
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sma200SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Hovered bar info for header tooltip
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);

  // Latest active candle for display
  const activeCandle = useMemo(() => {
    if (hoveredCandle) return hoveredCandle;
    if (candles && candles.length > 0) return candles[candles.length - 1];
    return null;
  }, [hoveredCandle, candles]);

  // 1. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up any existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 400,
      height: 380,
      layout: {
        background: { color: 'transparent' },
        textColor: '#8B949E',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.04)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#D4AF37',
          width: 1,
          style: 3, // dashed
          labelBackgroundColor: '#111821',
        },
        horzLine: {
          color: '#D4AF37',
          width: 1,
          style: 3,
          labelBackgroundColor: '#111821',
        },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: 0.2, // leave space for volume histogram
        },
      },
    });

    chartRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22C55E',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#22C55E',
      wickDownColor: '#EF4444',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    });
    candleSeriesRef.current = candleSeries;

    // Volume Histogram Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume', // separate scale
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Moving Averages & Bollinger Lines
    ema21SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#D4AF37',
      lineWidth: 2,
      title: 'EMA 21',
      priceLineVisible: false,
    });

    ema9SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#06B6D4',
      lineWidth: 1,
      title: 'EMA 9',
      priceLineVisible: false,
    });

    sma20SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#A855F7',
      lineWidth: 1,
      title: 'SMA 20',
      priceLineVisible: false,
    });

    sma50SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#EC4899',
      lineWidth: 1,
      title: 'SMA 50',
      priceLineVisible: false,
    });

    sma200SeriesRef.current = chart.addSeries(LineSeries, {
      color: '#F97316',
      lineWidth: 2,
      title: 'SMA 200',
      priceLineVisible: false,
    });

    bbUpperSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#6366F1',
      lineWidth: 1,
      lineStyle: 2, // dotted
      priceLineVisible: false,
    });
    bbMiddleSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#818CF8',
      lineWidth: 1,
      priceLineVisible: false,
    });
    bbLowerSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#6366F1',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
    });

    // Crosshair move listener for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (
        param.point === undefined ||
        !param.time ||
        param.point.x < 0 ||
        param.point.x > container.clientWidth ||
        param.point.y < 0 ||
        param.point.y > 380
      ) {
        setHoveredCandle(null);
      } else {
        const data = param.seriesData.get(candleSeries) as any;
        if (data && data.open !== undefined) {
          setHoveredCandle({
            time: Number(param.time),
            open: data.open,
            high: data.high,
            low: data.low,
            close: data.close,
          });
        }
      }
    });

    // Resize observer
    const handleResize = () => {
      if (chartRef.current && container) {
        chartRef.current.applyOptions({
          width: container.clientWidth,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // 2. Update Candle Data and Indicators when `candles` changes
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || !candles || candles.length === 0) {
      return;
    }

    try {
      // Candlestick data
      const chartCandles = candles.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      candleSeriesRef.current.setData(indicators.candlestick ? chartCandles : []);

      // Volume histogram
      const volumeData = candles.map((c) => ({
        time: c.time as Time,
        value: c.volume || 0,
        color: c.close >= c.open ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      }));
      volumeSeriesRef.current.setData(indicators.volume ? volumeData : []);

      // EMA 21
      if (ema21SeriesRef.current) {
        const ema21 = calculateEMA(candles, 21);
        ema21SeriesRef.current.setData(
          indicators.ema21 ? ema21.map((p) => ({ time: p.time as Time, value: p.value })) : []
        );
      }

      // EMA 9
      if (ema9SeriesRef.current) {
        const ema9 = calculateEMA(candles, 9);
        ema9SeriesRef.current.setData(
          indicators.ema9 ? ema9.map((p) => ({ time: p.time as Time, value: p.value })) : []
        );
      }

      // SMA 20
      if (sma20SeriesRef.current) {
        const sma20 = calculateSMA(candles, 20);
        sma20SeriesRef.current.setData(
          indicators.sma20 ? sma20.map((p) => ({ time: p.time as Time, value: p.value })) : []
        );
      }

      // SMA 50
      if (sma50SeriesRef.current) {
        const sma50 = calculateSMA(candles, 50);
        sma50SeriesRef.current.setData(
          indicators.sma50 ? sma50.map((p) => ({ time: p.time as Time, value: p.value })) : []
        );
      }

      // SMA 200
      if (sma200SeriesRef.current) {
        const sma200 = calculateSMA(candles, 200);
        sma200SeriesRef.current.setData(
          indicators.sma200 ? sma200.map((p) => ({ time: p.time as Time, value: p.value })) : []
        );
      }

      // Bollinger Bands
      if (bbUpperSeriesRef.current && bbMiddleSeriesRef.current && bbLowerSeriesRef.current) {
        const bb = calculateBollingerBands(candles, 20, 2);
        bbUpperSeriesRef.current.setData(
          indicators.bollingerBands ? bb.map((p) => ({ time: p.time as Time, value: p.upper })) : []
        );
        bbMiddleSeriesRef.current.setData(
          indicators.bollingerBands ? bb.map((p) => ({ time: p.time as Time, value: p.middle })) : []
        );
        bbLowerSeriesRef.current.setData(
          indicators.bollingerBands ? bb.map((p) => ({ time: p.time as Time, value: p.lower })) : []
        );
      }

      // Auto fit visible time scale once
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    } catch {
      // Safe fallback for time order
    }
  }, [candles, indicators]);

  // 3. Real-time Live Price Tick Update (without page reload!)
  useEffect(() => {
    if (!candleSeriesRef.current || !quote || !candles || candles.length === 0) return;

    try {
      const lastCandle = candles[candles.length - 1];
      const livePrice = quote.price;

      // Update current last candle bar with live tick
      const updatedBar = {
        time: lastCandle.time as Time,
        open: lastCandle.open,
        high: Math.max(lastCandle.high, livePrice),
        low: Math.min(lastCandle.low, livePrice),
        close: livePrice,
      };

      candleSeriesRef.current.update(updatedBar);
    } catch {
      // ignore live tick update errors
    }
  }, [quote?.price]);

  // Calculations for RSI & MACD sub-displays
  const rsiPoints = useMemo(() => {
    if (!indicators.rsi14) return [];
    return calculateRSI(candles, 14);
  }, [candles, indicators.rsi14]);

  const macdPoints = useMemo(() => {
    if (!indicators.macd) return [];
    return calculateMACD(candles, 12, 26, 9);
  }, [candles, indicators.macd]);

  const latestRsi = rsiPoints.length > 0 ? rsiPoints[rsiPoints.length - 1].value : null;
  const latestMacd = macdPoints.length > 0 ? macdPoints[macdPoints.length - 1] : null;

  return (
    <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 sm:p-4 space-y-3">
      {/* Timeframe Bar & Active Indicator Badges */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
          {TIMEFRAMES.map((tf) => {
            const isSelected = timeframe === tf;
            return (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframeChange(tf)}
                className={`min-w-[34px] h-7 px-2 rounded-lg text-xs font-mono-num font-extrabold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--gold-accent)] text-[#070A0F] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>

        {/* Active Indicators Pills */}
        <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono-num">
          {indicators.ema21 && (
            <span className="px-2 py-0.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
              EMA 21
            </span>
          )}
          {indicators.volume && (
            <span className="px-2 py-0.5 rounded-md bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30">
              VOL
            </span>
          )}
          {indicators.bollingerBands && (
            <span className="px-2 py-0.5 rounded-md bg-[#6366F1]/15 text-[#6366F1] border border-[#6366F1]/30">
              BB(20,2)
            </span>
          )}
          {indicators.rsi14 && (
            <span className="px-2 py-0.5 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              RSI 14
            </span>
          )}
          {indicators.macd && (
            <span className="px-2 py-0.5 rounded-md bg-[#F43F5E]/15 text-[#F43F5E] border border-[#F43F5E]/30">
              MACD
            </span>
          )}
        </div>
      </div>

      {/* OHLCV Crosshair Tooltip Display */}
      {activeCandle && (
        <div className="px-2 py-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono-num">
          <div className="flex items-center gap-3 flex-wrap">
            <span>
              <span className="text-[var(--text-secondary)]">O: </span>
              <strong className="text-[var(--text-primary)]">{activeCandle.open.toFixed(2)}</strong>
            </span>
            <span>
              <span className="text-[var(--text-secondary)]">H: </span>
              <strong className="text-[#22C55E]">{activeCandle.high.toFixed(2)}</strong>
            </span>
            <span>
              <span className="text-[var(--text-secondary)]">L: </span>
              <strong className="text-[#EF4444]">{activeCandle.low.toFixed(2)}</strong>
            </span>
            <span>
              <span className="text-[var(--text-secondary)]">C: </span>
              <strong
                className={
                  activeCandle.close >= activeCandle.open ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }
              >
                {activeCandle.close.toFixed(2)}
              </strong>
            </span>
          </div>

          <div className="text-[var(--text-secondary)] text-[10px]">
            {hoveredCandle ? 'Inspect bar' : 'Current candle'}
          </div>
        </div>
      )}

      {/* Main Candlestick Chart Canvas */}
      <div className="relative w-full h-[380px] rounded-xl overflow-hidden bg-[#070A0F] border border-[var(--border-subtle)]">
        <div ref={chartContainerRef} className="w-full h-full" />

        {isLoading && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center z-10">
            <div className="px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-gold)] text-xs font-bold text-[var(--gold-accent)] animate-pulse">
              Memuat data candle {timeframe}...
            </div>
          </div>
        )}
      </div>

      {/* RSI 14 Sub-Panel if enabled */}
      {indicators.rsi14 && latestRsi !== null && (
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-2.5 flex items-center justify-between text-xs font-mono-num">
          <div className="flex items-center gap-2">
            <span className="text-[#10B981] font-bold">RSI (14):</span>
            <span
              className={`font-extrabold ${
                latestRsi >= 70 ? 'text-[#EF4444]' : latestRsi <= 30 ? 'text-[#22C55E]' : 'text-[var(--text-primary)]'
              }`}
            >
              {latestRsi.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
            <span>Oversold: &lt;30</span>
            <span>·</span>
            <span>Overbought: &gt;70</span>
          </div>
        </div>
      )}

      {/* MACD Sub-Panel if enabled */}
      {indicators.macd && latestMacd && (
        <div className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-2.5 flex items-center justify-between text-xs font-mono-num flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[#F43F5E] font-bold">MACD (12,26,9):</span>
            <span className="text-[var(--text-primary)]">MACD: {latestMacd.macd.toFixed(2)}</span>
            <span className="text-[#06B6D4]">Signal: {latestMacd.signal.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[var(--text-secondary)]">Hist:</span>
            <strong className={latestMacd.histogram >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
              {latestMacd.histogram.toFixed(2)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
};
