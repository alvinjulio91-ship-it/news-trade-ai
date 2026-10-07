import { CandleData, TechnicalIndicatorValues } from '../types';

export interface IndicatorSeriesPoint {
  time: number;
  value: number;
}

export interface BollingerBandsSeriesPoint {
  time: number;
  upper: number;
  middle: number;
  lower: number;
}

export interface MacdSeriesPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(candles: CandleData[], period: number): IndicatorSeriesPoint[] {
  if (!candles || candles.length < period) return [];
  const result: IndicatorSeriesPoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    result.push({
      time: candles[i].time,
      value: Number((sum / period).toFixed(4)),
    });
  }
  return result;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(candles: CandleData[], period: number): IndicatorSeriesPoint[] {
  if (!candles || candles.length < period) return [];
  const result: IndicatorSeriesPoint[] = [];
  const multiplier = 2 / (period + 1);

  // Initial SMA as starting point
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  result.push({
    time: candles[period - 1].time,
    value: Number(prevEma.toFixed(4)),
  });

  for (let i = period; i < candles.length; i++) {
    const currentClose = candles[i].close;
    const currentEma = (currentClose - prevEma) * multiplier + prevEma;
    result.push({
      time: candles[i].time,
      value: Number(currentEma.toFixed(4)),
    });
    prevEma = currentEma;
  }

  return result;
}

/**
 * Calculates Relative Strength Index (RSI) 14
 */
export function calculateRSI(candles: CandleData[], period = 14): IndicatorSeriesPoint[] {
  if (!candles || candles.length <= period) return [];
  const result: IndicatorSeriesPoint[] = [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);

  result.push({
    time: candles[period].time,
    value: Number(rsi.toFixed(2)),
  });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const currentGain = diff > 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);

    result.push({
      time: candles[i].time,
      value: Number(rsi.toFixed(2)),
    });
  }

  return result;
}

/**
 * Calculates Bollinger Bands (period 20, stdDev 2)
 */
export function calculateBollingerBands(
  candles: CandleData[],
  period = 20,
  stdDevMultiplier = 2
): BollingerBandsSeriesPoint[] {
  if (!candles || candles.length < period) return [];
  const result: BollingerBandsSeriesPoint[] = [];

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += candles[i - j].close;
    }
    const middle = sum / period;

    let varianceSum = 0;
    for (let j = 0; j < period; j++) {
      varianceSum += Math.pow(candles[i - j].close - middle, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);

    const upper = middle + stdDevMultiplier * stdDev;
    const lower = middle - stdDevMultiplier * stdDev;

    result.push({
      time: candles[i].time,
      upper: Number(upper.toFixed(4)),
      middle: Number(middle.toFixed(4)),
      lower: Number(lower.toFixed(4)),
    });
  }

  return result;
}

/**
 * Calculates MACD (Fast 12, Slow 26, Signal 9)
 */
export function calculateMACD(
  candles: CandleData[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MacdSeriesPoint[] {
  if (!candles || candles.length < slowPeriod + signalPeriod) return [];

  const fastEma = calculateEMA(candles, fastPeriod);
  const slowEma = calculateEMA(candles, slowPeriod);

  // Map slow EMA times to fast EMA values
  const fastMap = new Map<number, number>();
  for (const f of fastEma) {
    fastMap.set(f.time, f.value);
  }

  const macdLinePoints: { time: number; value: number }[] = [];
  for (const s of slowEma) {
    const fVal = fastMap.get(s.time);
    if (fVal !== undefined) {
      macdLinePoints.push({
        time: s.time,
        value: fVal - s.value,
      });
    }
  }

  if (macdLinePoints.length < signalPeriod) return [];

  // Signal EMA over MACD line
  const multiplier = 2 / (signalPeriod + 1);
  let sum = 0;
  for (let i = 0; i < signalPeriod; i++) {
    sum += macdLinePoints[i].value;
  }
  let prevSignal = sum / signalPeriod;

  const result: MacdSeriesPoint[] = [];
  result.push({
    time: macdLinePoints[signalPeriod - 1].time,
    macd: Number(macdLinePoints[signalPeriod - 1].value.toFixed(4)),
    signal: Number(prevSignal.toFixed(4)),
    histogram: Number((macdLinePoints[signalPeriod - 1].value - prevSignal).toFixed(4)),
  });

  for (let i = signalPeriod; i < macdLinePoints.length; i++) {
    const macdVal = macdLinePoints[i].value;
    const signalVal = (macdVal - prevSignal) * multiplier + prevSignal;
    const hist = macdVal - signalVal;

    result.push({
      time: macdLinePoints[i].time,
      macd: Number(macdVal.toFixed(4)),
      signal: Number(signalVal.toFixed(4)),
      histogram: Number(hist.toFixed(4)),
    });
    prevSignal = signalVal;
  }

  return result;
}

/**
 * Extracts latest technical indicator values from candle series
 */
export function getLatestIndicatorValues(candles: CandleData[]): TechnicalIndicatorValues {
  if (!candles || candles.length === 0) return {};

  const rsi = calculateRSI(candles, 14);
  const macd = calculateMACD(candles, 12, 26, 9);
  const ema21 = calculateEMA(candles, 21);
  const ema9 = calculateEMA(candles, 9);
  const sma20 = calculateSMA(candles, 20);
  const sma50 = calculateSMA(candles, 50);
  const sma200 = calculateSMA(candles, 200);
  const bb = calculateBollingerBands(candles, 20, 2);

  const latestRsi = rsi.length > 0 ? rsi[rsi.length - 1].value : undefined;
  const latestMacd = macd.length > 0 ? macd[macd.length - 1] : undefined;
  const latestEma21 = ema21.length > 0 ? ema21[ema21.length - 1].value : undefined;
  const latestEma9 = ema9.length > 0 ? ema9[ema9.length - 1].value : undefined;
  const latestSma20 = sma20.length > 0 ? sma20[sma20.length - 1].value : undefined;
  const latestSma50 = sma50.length > 0 ? sma50[sma50.length - 1].value : undefined;
  const latestSma200 = sma200.length > 0 ? sma200[sma200.length - 1].value : undefined;
  const latestBb = bb.length > 0 ? bb[bb.length - 1] : undefined;

  return {
    rsi14: latestRsi,
    macd: latestMacd,
    ema21: latestEma21,
    ema9: latestEma9,
    sma20: latestSma20,
    sma50: latestSma50,
    sma200: latestSma200,
    bollingerBands: latestBb
      ? { upper: latestBb.upper, middle: latestBb.middle, lower: latestBb.lower }
      : undefined,
  };
}
