export type XauImpactCategory =
  | 'POTENTIALLY SUPPORTIVE FOR GOLD'
  | 'NEUTRAL / MIXED'
  | 'POTENTIALLY NEGATIVE FOR GOLD';

export type SurprisePredictionDirection =
  | 'ABOVE FORECAST'
  | 'AROUND FORECAST'
  | 'BELOW FORECAST'
  | 'INSUFFICIENT EVIDENCE';

export type ActualSurpriseDirection =
  | 'ABOVE FORECAST'
  | 'AROUND FORECAST'
  | 'BELOW FORECAST'
  | 'WAITING FOR RELEASE';

export type PredictionVerificationResult =
  | 'CORRECT DIRECTION'
  | 'INCORRECT DIRECTION'
  | 'NEAR FORECAST'
  | 'UNABLE TO VERIFY';

export type EventLifecycleStatus = 'UPCOMING' | 'RELEASED';

export type LevelCategory = 'High' | 'Medium' | 'Low';

export type EvidenceStrengthLevel = 'STRONG' | 'MODERATE' | 'WEAK';

export type KeyFactorSignal = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface KeyFactorItem {
  label: string;
  signal: KeyFactorSignal;
  detail?: string;
}

export type SourceAuthorityType = 'OFFICIAL DATA' | 'NEWS CONTEXT';

export type ReleaseStageType = 'PRE-NEWS' | 'POST-NEWS';

export type ThemeMode = 'dark' | 'light' | 'system';

export type RefreshIntervalOption = 30 | 60 | 300;

export type NotificationLeadTimeOption = 60 | 30 | 15 | 10 | 5;

export type ActiveTab =
  | 'home'
  | 'market'
  | 'upcoming'
  | 'released'
  | 'trading_plan'
  | 'accuracy'
  | 'settings'
  | 'notifications'
  | 'about';

export type ImpactFilterTab = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface TradingPlanRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'profit' | 'loss';
  amount: number;
  note: string;
}

export interface MonthlyTradingPlanData {
  target: number;
  review: string;
  records: TradingPlanRecord[];
}

export type TradingPlanStore = Record<string, MonthlyTradingPlanData>;

export function formatRupiah(value: number): string {
  const rounded = Math.round(value);
  const isNeg = rounded < 0;
  const absVal = Math.abs(rounded);
  const formatted = absVal.toLocaleString('id-ID');
  return isNeg ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthNameIndonesian(monthKey: string): string {
  try {
    const [yStr, mStr] = monthKey.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10) - 1;
    const date = new Date(y, m, 1);
    const monthName = new Intl.DateTimeFormat('id-ID', { month: 'long' }).format(date);
    return `${monthName} ${y}`;
  } catch {
    return monthKey;
  }
}

export function formatRecordDateIndonesian(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const date = new Date(y, m, d);
      return new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date);
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

export interface NotificationSettings {
  notificationsEnabled: boolean;
  notificationLeadTime: NotificationLeadTimeOption;
  upcomingNewsEnabled: boolean;
  highImpactEnabled: boolean;
  mediumImpactEnabled: boolean;
  lowImpactEnabled: boolean;
  actualReleasedEnabled: boolean;
  aiPredictionChangedEnabled: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
}

export interface EventNotificationOverride {
  enabled: boolean;
  leadTimeMinutes?: NotificationLeadTimeOption;
}

export type NotificationDeliveryType =
  | 'UPCOMING_REMINDER'
  | 'ACTUAL_RELEASED'
  | 'AI_PREDICTION_CHANGED'
  | 'TEST_NOTIFICATION';

export interface AppNotificationToast {
  id: string;
  uniqueKey: string;
  type: NotificationDeliveryType;
  title: string;
  eventName: string;
  subtitle: string;
  releaseTimeWib: string;
  impactLevel: LevelCategory;
  aiPrediction?: SurprisePredictionDirection;
  previousPrediction?: SurprisePredictionDirection;
  actual?: string;
  forecast?: string;
  actualSurprise?: ActualSurpriseDirection;
  xauusdImpact: XauImpactCategory;
  confidence?: LevelCategory;
  createdAtWib: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
  sourceType?: SourceAuthorityType;
  publicationDate?: string;
  lastUpdated?: string;
}

export interface PredictionReassessmentEntry {
  previousPrediction: SurprisePredictionDirection;
  currentPrediction: SurprisePredictionDirection;
  updatedAtWib: string;
  reason: string;
}

export interface LockedPreReleasePrediction {
  eventKey: string;
  eventName: string;
  releaseTime: string;
  consensusForecast: string;
  previous: string;
  aiPrediction: SurprisePredictionDirection;
  aiConfidence: LevelCategory;
  evidenceStrength?: EvidenceStrengthLevel;
  keyFactors?: KeyFactorItem[];
  aiAnalysisSummary?: string;
  xauusdPotentialImpact: XauImpactCategory;
  reasoning: string;
  lockedAt: string;
  lockedAtWib?: string;
  analyzedDateWib?: string;
  analyzedTimeWib?: string;
  lastAnalysisUpdate?: string;
  previousPredictionBeforeReassessment?: SurprisePredictionDirection;
  reassessmentReason?: string;
  reassessmentHistory?: PredictionReassessmentEntry[];
}

export interface EconomicNewsItem {
  id: string;
  eventName: string;
  categoryTag: string;
  country: string;
  releaseTime: string;
  releaseTimeIso?: string;
  releaseTimeAvailable?: boolean;
  impactLevel: LevelCategory;
  sourceType: SourceAuthorityType;
  status: EventLifecycleStatus;
  releaseStage: ReleaseStageType;
  summary: string;
  actual: string;
  actualAvailable: boolean;
  forecast: string;
  previous: string;
  aiPrediction: SurprisePredictionDirection;
  previousAiPrediction?: SurprisePredictionDirection;
  reassessmentReason?: string;
  analyzedDateWib?: string;
  analyzedTimeWib?: string;
  lastAnalysisUpdate?: string;
  evidenceStrength?: EvidenceStrengthLevel;
  keyFactors?: KeyFactorItem[];
  aiAnalysisSummary?: string;
  actualSurprise?: ActualSurpriseDirection;
  verificationResult?: PredictionVerificationResult;
  xauusdImpact: XauImpactCategory;
  postReleaseImpact?: XauImpactCategory;
  postReleaseReasoning?: string;
  mixedSignals: boolean;
  impactReasoning: string;
  aiConfidence: LevelCategory;
  confidenceReason: string;
  sourceName: string;
  sourceUrl: string;
  actualSourceName?: string;
  actualSourceUrl?: string;
  sourceUpdated?: string;
  relevanceRank?: number;
  relatedSources?: GroundingSource[];
  lockedPreRelease?: LockedPreReleasePrediction;
}

export interface NewsAnalysisBatch {
  id: string;
  lastUpdated: string;
  marketSummary: string;
  dominantBias: XauImpactCategory;
  hasMixedSignals?: boolean;
  indicatorFilter: string;
  searchQuery?: string;
  newsItems: EconomicNewsItem[];
  groundingSources: GroundingSource[];
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  notificationsEnabled: true,
  notificationLeadTime: 30,
  upcomingNewsEnabled: true,
  highImpactEnabled: true,
  mediumImpactEnabled: false,
  lowImpactEnabled: false,
  actualReleasedEnabled: true,
  aiPredictionChangedEnabled: true,
  vibrationEnabled: true,
  soundEnabled: true,
};

export function formatToWIB(dateInput?: string | number | Date): string {
  if (
    !dateInput ||
    dateInput === 'Tidak tersedia' ||
    dateInput === 'Data unavailable' ||
    dateInput === 'Release time unavailable'
  ) {
    return String(dateInput || 'Release time unavailable');
  }
  try {
    const d =
      typeof dateInput === 'string' || typeof dateInput === 'number'
        ? new Date(dateInput)
        : dateInput;
    if (isNaN(d.getTime())) {
      return String(dateInput);
    }
    const formatted = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
    return `${formatted} WIB`;
  } catch {
    return String(dateInput);
  }
}

export function formatWibDateGroupParts(isoInput?: string): {
  dayBadge: string;
  fullDateId: string;
  dateKey: string;
} {
  if (!isoInput) {
    return {
      dayBadge: 'SCHEDULED',
      fullDateId: 'Jadwal Terkini (WIB)',
      dateKey: 'unknown',
    };
  }
  try {
    const d = new Date(isoInput);
    if (isNaN(d.getTime())) {
      return {
        dayBadge: 'SCHEDULED',
        fullDateId: 'Jadwal Terkini (WIB)',
        dateKey: 'unknown',
      };
    }

    const now = new Date();
    const fmtKey = (dt: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(dt);

    const dKey = fmtKey(d);
    const todayKey = fmtKey(now);
    const tomorrow = new Date(now.getTime() + 86400000);
    const yesterday = new Date(now.getTime() - 86400000);

    // Full Date in WIB (e.g. Tuesday, 6 October 2026 / Selasa, 6 Oktober 2026)
    const fullDateEn = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);

    const enWeekdayUpper = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
    })
      .format(d)
      .toUpperCase();

    let dayBadge = enWeekdayUpper;
    if (dKey === todayKey) dayBadge = 'TODAY';
    else if (dKey === fmtKey(tomorrow)) dayBadge = 'TOMORROW';
    else if (dKey === fmtKey(yesterday)) dayBadge = 'YESTERDAY';

    return {
      dayBadge,
      fullDateId: fullDateEn,
      dateKey: dKey,
    };
  } catch {
    return {
      dayBadge: 'SCHEDULED',
      fullDateId: 'Jadwal Terkini (WIB)',
      dateKey: 'unknown',
    };
  }
}

export function formatWibDateHeader(isoInput?: string): string {
  const parts = formatWibDateGroupParts(isoInput);
  return `${parts.dayBadge} — ${parts.fullDateId}`;
}

export function formatWibShortTime(isoInput?: string, fallback?: string): string {
  if (!isoInput) return fallback || 'Release time unavailable';
  try {
    const d = new Date(isoInput);
    if (isNaN(d.getTime())) return fallback || 'Release time unavailable';
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${parts} WIB`;
  } catch {
    return fallback || 'Release time unavailable';
  }
}

export function formatWibShortDate(isoInput?: string, fallback?: string): string {
  if (!isoInput) return fallback || 'Data unavailable';
  try {
    const d = new Date(isoInput);
    if (isNaN(d.getTime())) return fallback || 'Data unavailable';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return fallback || 'Data unavailable';
  }
}

export function calculateNotificationWibTime(
  releaseIso?: string,
  leadMinutes: number = 30
): { notifyIso: string | null; notifyTimeWib: string; notifyTimestampMs: number | null } {
  if (!releaseIso) {
    return {
      notifyIso: null,
      notifyTimeWib: 'Release time unavailable',
      notifyTimestampMs: null,
    };
  }
  try {
    const relMs = new Date(releaseIso).getTime();
    if (isNaN(relMs)) {
      return {
        notifyIso: null,
        notifyTimeWib: 'Release time unavailable',
        notifyTimestampMs: null,
      };
    }
    const notifyMs = relMs - leadMinutes * 60 * 1000;
    const notifyDate = new Date(notifyMs);
    const timeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(notifyDate);
    return {
      notifyIso: notifyDate.toISOString(),
      notifyTimeWib: `${timeStr} WIB`,
      notifyTimestampMs: notifyMs,
    };
  } catch {
    return {
      notifyIso: null,
      notifyTimeWib: 'Release time unavailable',
      notifyTimestampMs: null,
    };
  }
}

export function getWibGreeting(): { greeting: string; periodLabel: string } {
  try {
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hour = parseInt(hourStr, 10);
    if (hour >= 4 && hour < 12) {
      return { greeting: 'GOOD MORNING', periodLabel: 'Sesi Pagi WIB' };
    }
    if (hour >= 12 && hour < 18) {
      return { greeting: 'GOOD AFTERNOON', periodLabel: 'Sesi Siang/Sore WIB' };
    }
    return { greeting: 'GOOD EVENING', periodLabel: 'Sesi Malam WIB' };
  } catch {
    return { greeting: 'GOOD EVENING', periodLabel: 'Waktu WIB' };
  }
}

export function formatCountdown(targetIso?: string, nowMs = Date.now()): string {
  if (!targetIso) return 'Release time unavailable';
  const targetMs = new Date(targetIso).getTime();
  if (isNaN(targetMs)) return 'Release time unavailable';
  const diff = targetMs - nowMs;
  if (diff <= 0) return '00:00:00';

  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function makeNotificationUniqueId(
  eventId: string,
  notificationType: NotificationDeliveryType,
  releaseDatetime?: string
): string {
  return `${eventId}__${notificationType}__${releaseDatetime || 'no-time'}`;
}

// ============================================================================
// LIVE MARKET DASHBOARD TYPES & HELPERS
// ============================================================================

export type MarketCategory = 'forex' | 'crypto' | 'us_stocks' | 'idx_stocks';

export type MarketStatusType =
  | 'LIVE'
  | 'CONNECTING'
  | 'RECONNECTING'
  | 'DELAYED'
  | 'MARKET CLOSED'
  | 'OFFLINE';

export type MarketTimeframe =
  | '1m'
  | '5m'
  | '15m'
  | '30m'
  | '1H'
  | '4H'
  | '1D'
  | '1W'
  | '1M';

export interface MarketQuote {
  symbol: string;
  displayName: string;
  category: MarketCategory;
  price: number;
  change: number;
  changePercent: number;
  high24h?: number;
  low24h?: number;
  open24h?: number;
  previousClose?: number;
  volume24h?: number;
  currency: string;
  marketStatus: MarketStatusType;
  lastUpdatedIso: string;
  sparkline?: number[];
}

export interface CandleData {
  time: number; // Unix timestamp in seconds for lightweight-charts
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TechnicalIndicatorsConfig {
  candlestick: boolean;
  volume: boolean;
  ema21: boolean;
  ema9: boolean;
  sma20: boolean;
  sma50: boolean;
  sma200: boolean;
  bollingerBands: boolean;
  rsi14: boolean;
  macd: boolean;
}

export const DEFAULT_TECHNICAL_INDICATORS: TechnicalIndicatorsConfig = {
  candlestick: true,
  volume: true,
  ema21: true,
  ema9: false,
  sma20: false,
  sma50: false,
  sma200: false,
  bollingerBands: false,
  rsi14: false,
  macd: false,
};

export interface TechnicalIndicatorValues {
  rsi14?: number;
  macd?: { macd: number; signal: number; histogram: number };
  ema21?: number;
  ema9?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  bollingerBands?: { upper: number; middle: number; lower: number };
}

export type MarketBiasType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export type TrendStrengthType =
  | 'STRONG BULLISH'
  | 'BULLISH'
  | 'NEUTRAL'
  | 'BEARISH'
  | 'STRONG BEARISH';

export type MomentumLevelType = 'STRONG' | 'MODERATE' | 'WEAK';

export type VolatilityLevelType = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AIMarketAnalysisResult {
  symbol: string;
  bias: MarketBiasType;
  confidence: number; // 0–100
  trend: TrendStrengthType;
  momentum: MomentumLevelType;
  volatility: VolatilityLevelType;
  summary: string;
  bullishFactors: string[];
  bearishFactors: string[];
  keyLevels?: {
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
    pivotPoint?: number;
  };
  economicContext?: {
    upcomingRisks: string[];
    fedExpectation: string;
    dxyImpact: string;
    yieldsImpact: string;
  };
  timestampIso: string;
}

export interface XauusdSpecialAnalysis {
  currentPrice: number;
  trend: TrendStrengthType;
  momentum: MomentumLevelType;
  volatility: VolatilityLevelType;
  usdStrength: 'STRONG' | 'NEUTRAL' | 'WEAK';
  treasuryYield: 'RISING' | 'STABLE' | 'FALLING';
  fedExpectations: 'DOVISH' | 'NEUTRAL' | 'HAWKISH';
  economicRisk: 'HIGH' | 'MODERATE' | 'LOW';
  newsSentiment: 'SUPPORTIVE FOR GOLD' | 'NEUTRAL / MIXED' | 'NEGATIVE FOR GOLD';
  bullishFactors: string[];
  bearishFactors: string[];
  keyLevels: {
    support1: number;
    support2: number;
    resistance1: number;
    resistance2: number;
  };
  upcomingRisk: string;
  newsImpactSummary: string;
  scenarioAnalysis: {
    bullishScenario: string;
    bearishScenario: string;
    neutralScenario: string;
  };
  lastUpdatedIso: string;
}

export interface MarketOverviewData {
  topGainers: MarketQuote[];
  topLosers: MarketQuote[];
  mostActive: MarketQuote[];
  highestVolume: MarketQuote[];
  highestVolatility: MarketQuote[];
}

export function formatMarketPrice(price: number, symbol = ''): string {
  if (price === undefined || price === null || isNaN(price)) return 'DATA UNAVAILABLE';
  const upper = symbol.toUpperCase();
  if (upper.includes('BTC') || upper.includes('ETH')) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (upper.endsWith('.JK') || ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'ANTM', 'ICBP', 'INDF', 'GOTO'].includes(upper)) {
    return price.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (upper.includes('XAU') || upper.includes('GC=F')) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (upper.includes('EUR') || upper.includes('GBP') || upper.includes('JPY')) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  if (price < 1) {
    return price.toFixed(4);
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatMarketChange(change: number, changePercent: number): {
  text: string;
  isPositive: boolean;
  isNegative: boolean;
} {
  const isPositive = change > 0;
  const isNegative = change < 0;
  const sign = isPositive ? '+' : isNegative ? '' : '';
  const signPct = isPositive ? '+' : isNegative ? '' : '';
  const text = `${sign}${change.toFixed(2)} (${signPct}${changePercent.toFixed(2)}%)`;
  return { text, isPositive, isNegative };
}

export type ApiConnectionStatus = 'CONNECTED' | 'NOT CONFIGURED' | 'ERROR';

export interface ApiStatusItem {
  name: string;
  configured: boolean;
  status: ApiConnectionStatus;
  message: string;
  lastCheckedIso: string;
}

export interface SystemApiStatusReport {
  gemini: ApiStatusItem;
  alphaVantage: ApiStatusItem;
  fred: ApiStatusItem;
  timestampIso: string;
}


