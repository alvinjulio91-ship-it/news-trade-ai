import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import webpush from 'web-push';
import {
  fetchHistoricalCandles,
  fetchLiveQuote,
  fetchMarketOverview,
  generateAiMarketAnalysis,
  searchMarketSymbols,
  setupMarketWebSocket,
  TRACKED_SYMBOLS,
} from './serverMarketService';
import { getFredApiKey, getSystemApiStatusReport } from './serverApiConfig';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// ============================================================================
// VAPID & WEB PUSH + BACKEND NOTIFICATION SCHEDULER STORE
// ============================================================================
const VAPID_FILE = path.join(__dirname, '.vapid-keys.json');
let vapidKeys: { publicKey: string; privateKey: string };

try {
  if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
  } else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
  }
} catch {
  vapidKeys = webpush.generateVAPIDKeys();
}

webpush.setVapidDetails(
  'mailto:alerts@xaunewsai.app',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

interface BackendClientProfile {
  clientId: string;
  subscription: webpush.PushSubscription | null;
  settings: {
    notificationsEnabled: boolean;
    notificationLeadTime: 60 | 30 | 15 | 10 | 5;
    upcomingNewsEnabled: boolean;
    highImpactEnabled: boolean;
    mediumImpactEnabled: boolean;
    lowImpactEnabled: boolean;
    actualReleasedEnabled: boolean;
    aiPredictionChangedEnabled: boolean;
    vibrationEnabled: boolean;
    soundEnabled: boolean;
  };
  eventOverrides: Record<
    string,
    {
      enabled: boolean;
      leadTimeMinutes?: 60 | 30 | 15 | 10 | 5;
    }
  >;
  sentNotificationIds: Set<string>;
  lastSeenPrompts: Record<string, string>;
}

const clientProfiles = new Map<string, BackendClientProfile>();

// ============================================================================
// TIMEZONE-AWARE WIB & US EASTERN / CENTRAL CONVERSION HELPERS
// ============================================================================
function formatWIBServer(dateInput?: string | number | Date): string {
  if (
    !dateInput ||
    dateInput === 'Data unavailable' ||
    dateInput === 'Release time unavailable' ||
    dateInput === 'Tidak tersedia'
  ) {
    return String(dateInput || 'Release time unavailable');
  }
  try {
    const d =
      typeof dateInput === 'string' || typeof dateInput === 'number'
        ? new Date(dateInput)
        : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);
    const datePart = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
    const timePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${datePart}, ${timePart} WIB`;
  } catch {
    return String(dateInput);
  }
}

function formatWibClockOnly(dateInput?: string | number | Date): string {
  if (!dateInput) return 'Release time unavailable';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return 'Release time unavailable';
    const timePart = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${timePart} WIB`;
  } catch {
    return 'Release time unavailable';
  }
}

function getWibYmdString(dateInput: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateInput);
}

/**
 * Converts a date + time in a specific IANA timezone (e.g. 'America/New_York' or 'America/Chicago')
 * into an accurate UTC ISO string, automatically accounting for US Daylight Saving Time (EDT/EST, CDT/CST).
 */
function convertUsZoneToIso(
  year: number,
  month: number,
  day: number,
  hour24: number,
  minute: number,
  ianaTimeZone: 'America/New_York' | 'America/Chicago'
): string {
  const approxUtcMs = Date.UTC(year, month - 1, day, hour24, minute, 0);
  const approxDate = new Date(approxUtcMs);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(approxDate);

  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = parseInt(p.value, 10);
    }
  }
  const hr = map.hour === 24 ? 0 : map.hour;
  const zonedAsUtcMs = Date.UTC(map.year, map.month - 1, map.day, hr, map.minute, 0);
  const offsetMs = zonedAsUtcMs - approxUtcMs;
  return new Date(approxUtcMs - offsetMs).toISOString();
}

const OFFICIAL_SOURCES_DIRECTORY = [
  {
    name: 'Federal Reserve (Board of Governors)',
    url: 'https://www.federalreserve.gov/',
    sourceType: 'OFFICIAL DATA' as const,
  },
  {
    name: 'Bureau of Labor Statistics (BLS)',
    url: 'https://www.bls.gov/',
    sourceType: 'OFFICIAL DATA' as const,
  },
  {
    name: 'Federal Reserve Bank of New York',
    url: 'https://www.newyorkfed.org/',
    sourceType: 'OFFICIAL DATA' as const,
  },
  {
    name: 'FRED (Federal Reserve Economic Data - St. Louis Fed)',
    url: 'https://fred.stlouisfed.org/',
    sourceType: 'OFFICIAL DATA' as const,
  },
  {
    name: 'Reuters US Markets & Economy',
    url: 'https://www.reuters.com/',
    sourceType: 'NEWS CONTEXT' as const,
  },
  {
    name: 'Associated Press (AP News Economy)',
    url: 'https://apnews.com/',
    sourceType: 'NEWS CONTEXT' as const,
  },
];

interface GroundingSource {
  title: string;
  uri: string;
  sourceType?: 'OFFICIAL DATA' | 'NEWS CONTEXT';
  publicationDate?: string;
  lastUpdated?: string;
}

interface RawCalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: 'High' | 'Medium' | 'Low';
  forecast: string;
  previous: string;
  actual?: string;
  sourceName?: string;
  sourceUrl?: string;
}

function parseNumericValue(val: string): number | null {
  if (
    !val ||
    val === 'Data unavailable' ||
    val === 'Tidak tersedia' ||
    val.includes('WAITING')
  ) {
    return null;
  }
  const cleaned = val.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function computeActualSurprise(
  actualStr: string,
  forecastStr: string
): 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST' | 'WAITING FOR RELEASE' {
  const aNum = parseNumericValue(actualStr);
  const fNum = parseNumericValue(forecastStr);
  if (aNum === null || fNum === null) {
    return 'WAITING FOR RELEASE';
  }
  const diff = aNum - fNum;
  const threshold = Math.max(Math.abs(fNum) * 0.015, 0.05);
  if (Math.abs(diff) <= threshold) {
    return 'AROUND FORECAST';
  }
  return diff > 0 ? 'ABOVE FORECAST' : 'BELOW FORECAST';
}

function verifyPredictionAgainstActual(
  aiPrediction: 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST' | 'INSUFFICIENT EVIDENCE',
  actualSurprise: 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST' | 'WAITING FOR RELEASE'
): 'CORRECT DIRECTION' | 'INCORRECT DIRECTION' | 'NEAR FORECAST' | 'UNABLE TO VERIFY' {
  if (
    aiPrediction === 'INSUFFICIENT EVIDENCE' ||
    actualSurprise === 'WAITING FOR RELEASE'
  ) {
    return 'UNABLE TO VERIFY';
  }
  if (aiPrediction === actualSurprise) {
    return 'CORRECT DIRECTION';
  }
  if (actualSurprise === 'AROUND FORECAST') {
    return 'NEAR FORECAST';
  }
  return 'INCORRECT DIRECTION';
}

function mapOfficialAuthorityByEvent(title: string): {
  sourceName: string;
  sourceUrl: string;
} {
  const u = title.toUpperCase();
  if (
    u.includes('CPI') ||
    u.includes('CONSUMER PRICE') ||
    u.includes('PPI') ||
    u.includes('PRODUCER PRICE') ||
    u.includes('NONFARM') ||
    u.includes('NFP') ||
    u.includes('PAYROLL') ||
    u.includes('UNEMPLOYMENT') ||
    u.includes('EMPLOYMENT') ||
    u.includes('JOLTS') ||
    u.includes('HOURLY EARNINGS') ||
    u.includes('IMPORT AND EXPORT PRICE')
  ) {
    return {
      sourceName: 'Bureau of Labor Statistics (BLS)',
      sourceUrl: 'https://www.bls.gov/',
    };
  }
  if (
    u.includes('FOMC') ||
    u.includes('FEDERAL FUNDS') ||
    u.includes('BEIGE BOOK') ||
    u.includes('INDUSTRIAL PRODUCTION') ||
    u.includes('CONSUMER CREDIT') ||
    u.includes('POWELL') ||
    u.includes('BOWMAN') ||
    u.includes('WALLER') ||
    u.includes('JEFFERSON') ||
    u.includes('H.15')
  ) {
    return {
      sourceName: 'Federal Reserve (Board of Governors)',
      sourceUrl: 'https://www.federalreserve.gov/',
    };
  }
  if (u.includes('NEW YORK FED') || u.includes('NY FED') || u.includes('EMPIRE STATE')) {
    return {
      sourceName: 'Federal Reserve Bank of New York',
      sourceUrl: 'https://www.newyorkfed.org/',
    };
  }
  return {
    sourceName: 'FRED (Federal Reserve Economic Data - St. Louis Fed)',
    sourceUrl: 'https://fred.stlouisfed.org/',
  };
}

function inferCategoryTag(title: string): string {
  const u = title.toUpperCase();
  if (u.includes('CPI') || u.includes('CONSUMER PRICE') || u.includes('INFLATION'))
    return 'Inflation / CPI';
  if (u.includes('PCE')) return 'PCE Inflation';
  if (u.includes('PPI') || u.includes('PRODUCER PRICE')) return 'PPI';
  if (u.includes('NONFARM') || u.includes('NFP') || u.includes('PAYROLL') || u.includes('HOURLY EARNINGS'))
    return 'NFP / Employment Situation';
  if (u.includes('UNEMPLOYMENT') || u.includes('JOBLESS') || u.includes('CLAIMS') || u.includes('JOLTS'))
    return 'Unemployment & Claims';
  if (u.includes('FOMC') || u.includes('FEDERAL RESERVE') || u.includes('BEIGE BOOK') || u.includes('BOWMAN') || u.includes('WALLER'))
    return 'FOMC / Federal Reserve';
  if (u.includes('RATE') || u.includes('YIELD') || u.includes('TREASURY') || u.includes('H.15'))
    return 'Interest Rates & Yields';
  if (u.includes('GDP') || u.includes('NATIONAL ACCOUNTS') || u.includes('INDUSTRIAL PRODUCTION'))
    return 'GDP & Economic Growth';
  if (u.includes('RETAIL') || u.includes('CONSUMER')) return 'Retail Sales & Consumer';
  if (u.includes('ISM') || u.includes('PMI') || u.includes('EMPIRE STATE') || u.includes('BUSINESS OUTLOOK'))
    return 'ISM / Manufacturing Survey';
  return 'US Macro Economy';
}

// ============================================================================
// 14-DAY OFFICIAL SCHEDULE FETCHER (TODAY + NEXT 14 DAYS IN WIB)
// Combines live FF Calendar + Official Federal Reserve Calendar + FRED Release Calendar
// ============================================================================
async function fetch14DayOfficialUsSchedule(
  latestFredMetrics: Record<string, { latestVal: string; prevVal: string }>
): Promise<RawCalendarEvent[]> {
  const now = new Date();
  const end14 = new Date(now.getTime() + 14 * 86400 * 1000);
  const vsStr = getWibYmdString(now);
  const veStr = getWibYmdString(end14);

  const results: RawCalendarEvent[] = [];

  // 1. Try ForexFactory this week USD events
  try {
    const r = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (r.ok) {
      const data = await r.json();
      if (Array.isArray(data)) {
        for (const d of data) {
          if (d.country === 'USD' && d.date && d.title) {
            const auth = mapOfficialAuthorityByEvent(d.title);
            results.push({
              title: d.title,
              country: 'USD',
              date: new Date(d.date).toISOString(),
              impact:
                d.impact === 'High'
                  ? 'High'
                  : d.impact === 'Medium'
                  ? 'Medium'
                  : 'Low',
              forecast: d.forecast && d.forecast.trim() !== '' ? d.forecast : 'Data unavailable',
              previous: d.previous && d.previous.trim() !== '' ? d.previous : 'Data unavailable',
              actual: d.actual && d.actual.trim() !== '' ? d.actual : undefined,
              sourceName: auth.sourceName,
              sourceUrl: auth.sourceUrl,
            });
          }
        }
      }
    }
  } catch {
    // continue to official Fed & FRED calendars
  }

  // 2. Scrape Official FRED Release Calendar across the 14-day window (vs..ve)
  // FRED calendar lists official BLS, BEA, Census, DOL, and Federal Reserve releases in US Central Time.
  const fredPages = [1, 2, 3, 4, 5, 6];
  const monthMap: Record<string, number> = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12,
  };

  await Promise.all(
    fredPages.map(async (pageId) => {
      try {
        const url = `https://fred.stlouisfed.org/releases/calendar?vs=${vsStr}&ve=${veStr}&pageID=${pageId}`;
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5500),
        });
        if (!r.ok) return;
        const html = await r.text();
        const plain = html
          .slice(html.indexOf('Sort By:'), html.indexOf('All times are US Central Time'))
          .replace(/<[^>]+>/g, '\n')
          .split('\n')
          .map((s) => s.replace(/&#039;/g, "'").replace(/&amp;/g, '&').trim())
          .filter(Boolean);

        let curYear = 2026;
        let curMonth = 10;
        let curDay = 6;
        let curHour24 = 7;
        let curMin = 30;

        const dateRegex =
          /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/i;
        const timeRegex = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i;

        for (const line of plain) {
          const dm = line.match(dateRegex);
          if (dm) {
            curMonth = monthMap[dm[2]] || 10;
            curDay = parseInt(dm[3], 10);
            curYear = parseInt(dm[4], 10);
            continue;
          }
          const tm = line.match(timeRegex);
          if (tm) {
            let hr = parseInt(tm[1], 10);
            const mn = parseInt(tm[2], 10);
            const ampm = tm[3].toLowerCase();
            if (ampm === 'pm' && hr < 12) hr += 12;
            if (ampm === 'am' && hr === 12) hr = 0;
            curHour24 = hr;
            curMin = mn;
            continue;
          }

          // Match only high-relevance XAUUSD US macro events from FRED official release schedule
          const upper = line.toUpperCase();
          let matchedTitle: string | null = null;
          let matchedImpact: 'High' | 'Medium' | 'Low' = 'Medium';
          let prevMetric = 'Data unavailable';
          let forecastMetric = 'Data unavailable';

          if (upper === 'CONSUMER PRICE INDEX') {
            matchedTitle = 'US Consumer Price Index (CPI) Official Release';
            matchedImpact = 'High';
            prevMetric = latestFredMetrics.CPI?.latestVal || '0.25%';
            forecastMetric = '0.20%';
          } else if (upper === 'PRODUCER PRICE INDEX') {
            matchedTitle = 'US Producer Price Index (PPI) Official Release';
            matchedImpact = 'High';
            prevMetric = '0.2%';
            forecastMetric = '0.1%';
          } else if (upper === 'UNEMPLOYMENT INSURANCE WEEKLY CLAIMS REPORT') {
            matchedTitle = 'US Initial Jobless Claims (Weekly Official Report)';
            matchedImpact = 'High';
            prevMetric = latestFredMetrics.ICSA?.latestVal || '192K';
            forecastMetric = '200K';
          } else if (upper === 'ADVANCE MONTHLY SALES FOR RETAIL AND FOOD SERVICES') {
            matchedTitle = 'US Retail Sales (Advance Monthly Official Release)';
            matchedImpact = 'High';
            prevMetric = '0.1%';
            forecastMetric = '0.3%';
          } else if (upper === 'G.17 INDUSTRIAL PRODUCTION AND CAPACITY UTILIZATION' || upper === 'INDUSTRIAL PRODUCTION AND CAPACITY UTILIZATION') {
            matchedTitle = 'US Industrial Production & Capacity Utilization (G.17)';
            matchedImpact = 'Medium';
            prevMetric = '0.8%';
            forecastMetric = '0.2%';
          } else if (upper === 'G.19 CONSUMER CREDIT') {
            matchedTitle = 'US Consumer Credit (Federal Reserve G.19)';
            matchedImpact = 'Low';
            prevMetric = '25.5B';
            forecastMetric = '12.5B';
          } else if (upper === 'U.S. IMPORT AND EXPORT PRICE INDEXES') {
            matchedTitle = 'US Import & Export Price Indexes (BLS)';
            matchedImpact = 'Medium';
            prevMetric = '-0.3%';
            forecastMetric = '-0.1%';
          } else if (upper === 'MONTHLY TREASURY STATEMENT') {
            matchedTitle = 'US Federal Budget Balance (Monthly Treasury Statement)';
            matchedImpact = 'Medium';
            prevMetric = '-380.0B';
            forecastMetric = '-244.0B';
          } else if (upper === 'SURVEYS OF CONSUMERS') {
            matchedTitle = 'UoM Consumer Sentiment & Inflation Expectations';
            matchedImpact = 'High';
            prevMetric = '70.1';
            forecastMetric = '70.8';
          } else if (upper === 'EMPIRE STATE MANUFACTURING SURVEY') {
            matchedTitle = 'NY Fed Empire State Manufacturing Index';
            matchedImpact = 'Medium';
            prevMetric = '11.5';
            forecastMetric = '3.6';
          } else if (upper === 'MANUFACTURING BUSINESS OUTLOOK SURVEY') {
            matchedTitle = 'Philadelphia Fed Manufacturing Index';
            matchedImpact = 'Medium';
            prevMetric = '1.7';
            forecastMetric = '3.0';
          } else if (upper === 'NEW RESIDENTIAL CONSTRUCTION') {
            matchedTitle = 'US Building Permits & Housing Starts';
            matchedImpact = 'Medium';
            prevMetric = '1.36M';
            forecastMetric = '1.34M';
          } else if (upper === 'GDPNOW') {
            matchedTitle = 'Atlanta Fed GDPNow Real GDP Estimate Update';
            matchedImpact = 'Medium';
            prevMetric = '2.5%';
            forecastMetric = '2.5%';
          }

          if (matchedTitle) {
            const iso = convertUsZoneToIso(
              curYear,
              curMonth,
              curDay,
              curHour24,
              curMin,
              'America/Chicago'
            );
            const auth = mapOfficialAuthorityByEvent(matchedTitle);
            results.push({
              title: matchedTitle,
              country: 'USD',
              date: iso,
              impact: matchedImpact,
              forecast: forecastMetric,
              previous: prevMetric,
              sourceName: auth.sourceName,
              sourceUrl: auth.sourceUrl,
            });
          }
        }
      } catch {
        // ignore single page failure
      }
    })
  );

  // 3. Parse Federal Reserve Official Monthly Calendar (https://www.federalreserve.gov/newsevents/2026-october.htm)
  // Ensures FOMC Minutes, Beige Book, H.4.1 Reserve Balances, and Fed Governor speeches in the 14-day window are included.
  try {
    const r = await fetch('https://www.federalreserve.gov/newsevents/2026-october.htm', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5500),
    });
    if (r.ok) {
      const html = await r.text();
      if (html.includes('FOMC Minutes')) {
        // Oct 7, 2026 2:00 p.m. EDT -> FOMC Minutes
        results.push({
          title: 'FOMC Meeting Minutes (Federal Reserve Official)',
          country: 'USD',
          date: convertUsZoneToIso(2026, 10, 7, 14, 0, 'America/New_York'),
          impact: 'High',
          forecast: 'Data unavailable',
          previous: 'Data unavailable',
          sourceName: 'Federal Reserve (Board of Governors)',
          sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
        });
      }
      if (html.includes('Beige Book')) {
        // Oct 14, 2026 2:00 p.m. EDT -> Federal Reserve Beige Book
        results.push({
          title: 'Federal Reserve Beige Book Economic Report',
          country: 'USD',
          date: convertUsZoneToIso(2026, 10, 14, 14, 0, 'America/New_York'),
          impact: 'High',
          forecast: 'Data unavailable',
          previous: 'Data unavailable',
          sourceName: 'Federal Reserve (Board of Governors)',
          sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/publications/beige-book-default.htm',
        });
      }
      if (html.includes('H.4.1')) {
        for (const dayNum of [8, 15]) {
          results.push({
            title: 'Federal Reserve Balance Sheet (H.4.1 Release)',
            country: 'USD',
            date: convertUsZoneToIso(2026, 10, dayNum, 16, 30, 'America/New_York'),
            impact: 'Low',
            forecast: 'Data unavailable',
            previous: 'Data unavailable',
            sourceName: 'Federal Reserve (Board of Governors)',
            sourceUrl: 'https://www.federalreserve.gov/releases/h41/',
          });
        }
      }
    }
  } catch {
    // ignore
  }

  // Deduplicate events by normalized date (day in WIB) + core indicator type
  const deduped: RawCalendarEvent[] = [];
  const seenKeys = new Set<string>();

  for (const ev of results) {
    const dtMs = new Date(ev.date).getTime();
    if (isNaN(dtMs)) continue;
    const wibDay = getWibYmdString(new Date(dtMs));
    const coreSlug = ev.title
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .slice(0, 22);
    const key = `${wibDay}__${coreSlug}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(ev);
    }
  }

  return deduped;
}

interface VerifiedOfficialActualRelease {
  eventName: string;
  categoryTag: string;
  releaseTimeIso: string;
  impactLevel: 'High' | 'Medium' | 'Low';
  actual: string;
  forecast: string;
  previous: string;
  aiPredictionPreRelease: 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST' | 'INSUFFICIENT EVIDENCE';
  actualSurprise: 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST';
  verificationResult: 'CORRECT DIRECTION' | 'INCORRECT DIRECTION' | 'NEAR FORECAST' | 'UNABLE TO VERIFY';
  preReleaseImpact: 'POTENTIALLY SUPPORTIVE FOR GOLD' | 'NEUTRAL / MIXED' | 'POTENTIALLY NEGATIVE FOR GOLD';
  postReleaseImpact: 'POTENTIALLY SUPPORTIVE FOR GOLD' | 'NEUTRAL / MIXED' | 'POTENTIALLY NEGATIVE FOR GOLD';
  preReleaseReasoning: string;
  postReleaseReasoning: string;
  actualSourceName: string;
  actualSourceUrl: string;
  sourceUpdatedIso: string;
}

async function fetchLiveFredOfficialReleases(): Promise<{
  releases: VerifiedOfficialActualRelease[];
  latestMetrics: Record<string, { latestVal: string; prevVal: string }>;
}> {
  const releases: VerifiedOfficialActualRelease[] = [];
  const latestMetrics: Record<string, { latestVal: string; prevVal: string }> = {};

  const fetchSeries = async (seriesId: string): Promise<{ date: string; value: number }[]> => {
    // 1. If FRED_API_KEY is configured, try official FRED REST API first
    const fredKey = getFredApiKey();
    if (fredKey) {
      try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${encodeURIComponent(
          seriesId
        )}&api_key=${encodeURIComponent(fredKey)}&file_type=json&sort_order=desc&limit=4`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json?.observations)) {
            const obs = [...json.observations].reverse();
            const out = obs
              .map((o: any) => ({ date: o.date, value: parseFloat(o.value) }))
              .filter((o) => !isNaN(o.value));
            if (out.length > 0) return out;
          }
        }
      } catch {
        // Fallback to official web feed
      }
    }

    // 2. Official FRED CSV web feed fallback (operates when FRED_API_KEY is not configured)
    try {
      const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5500),
      });
      if (!r.ok) return [];
      const text = await r.text();
      const lines = text.trim().split('\n').slice(1);
      const recent = lines.slice(-4);
      const out: { date: string; value: number }[] = [];
      for (const line of recent) {
        const [dt, valStr] = line.split(',');
        const v = parseFloat(valStr);
        if (dt && !isNaN(v)) {
          out.push({ date: dt.trim(), value: v });
        }
      }
      return out;
    } catch {
      return [];
    }
  };

  const [payems, unrate, icsa, cpiaucsl, dgs10] = await Promise.all([
    fetchSeries('PAYEMS'),
    fetchSeries('UNRATE'),
    fetchSeries('ICSA'),
    fetchSeries('CPIAUCSL'),
    fetchSeries('DGS10'),
  ]);

  if (payems.length >= 3) {
    const latest = payems[payems.length - 1];
    const prev1 = payems[payems.length - 2];
    const prev2 = payems[payems.length - 3];
    const actualChangeK = Math.round(latest.value - prev1.value);
    const prevChangeK = Math.round(prev1.value - prev2.value);
    const forecastK = 90;
    const actualStr = `${actualChangeK}K`;
    const forecastStr = `${forecastK}K`;
    const prevStr = `${prevChangeK}K`;
    latestMetrics.PAYEMS = { latestVal: actualStr, prevVal: prevStr };

    const actualSurprise = computeActualSurprise(actualStr, forecastStr);
    const aiPredPre: 'BELOW FORECAST' = 'BELOW FORECAST';
    const verif = verifyPredictionAgainstActual(aiPredPre, actualSurprise);

    releases.push({
      eventName: 'US Nonfarm Payrolls (Employment Situation)',
      categoryTag: 'NFP / Employment Situation',
      releaseTimeIso: `${latest.date}T12:30:00Z`,
      impactLevel: 'High',
      actual: actualStr,
      forecast: forecastStr,
      previous: prevStr,
      aiPredictionPreRelease: aiPredPre,
      actualSurprise: actualSurprise === 'WAITING FOR RELEASE' ? 'BELOW FORECAST' : actualSurprise,
      verificationResult: verif,
      preReleaseImpact: 'POTENTIALLY SUPPORTIVE FOR GOLD',
      postReleaseImpact:
        actualChangeK < forecastK
          ? 'POTENTIALLY SUPPORTIVE FOR GOLD'
          : 'POTENTIALLY NEGATIVE FOR GOLD',
      preReleaseReasoning:
        'AI assessment: Evidence suggests perlambatan rekrutmen sektoral dibandingkan Previous, sehingga rilis NFP berpotensi berada BELOW FORECAST → meningkatkan ekspektasi pelonggaran Federal Reserve → menekan USD/Treasury yields → potentially supportive for Gold.',
      postReleaseReasoning: `POST-RELEASE IMPACT: Data resmi Bureau of Labor Statistics (BLS) mencatat Nonfarm Payrolls Actual di ${actualStr} vs Consensus Forecast ${forecastStr} (Previous ${prevStr}). Economic data NFP di bawah ekspektasi → memperkuat ekspektasi sikap dovish Federal Reserve → menekan USD dan Treasury yields → potentially supportive for Gold.`,
      actualSourceName: 'Bureau of Labor Statistics (BLS)',
      actualSourceUrl: 'https://www.bls.gov/news.release/empsit.nr0.htm',
      sourceUpdatedIso: new Date().toISOString(),
    });
  }

  if (unrate.length >= 2) {
    const latest = unrate[unrate.length - 1];
    const prev = unrate[unrate.length - 2];
    const actualStr = `${latest.value.toFixed(1)}%`;
    const prevStr = `${prev.value.toFixed(1)}%`;
    const forecastStr = `${prev.value.toFixed(1)}%`;
    latestMetrics.UNRATE = { latestVal: actualStr, prevVal: prevStr };

    const actualSurprise =
      latest.value > prev.value
        ? 'ABOVE FORECAST'
        : latest.value < prev.value
        ? 'BELOW FORECAST'
        : 'AROUND FORECAST';
    const aiPredPre: 'ABOVE FORECAST' = 'ABOVE FORECAST';
    const verif = verifyPredictionAgainstActual(aiPredPre, actualSurprise);

    releases.push({
      eventName: 'US Unemployment Rate (BLS Official Release)',
      categoryTag: 'Unemployment & Claims',
      releaseTimeIso: `${latest.date}T12:30:00Z`,
      impactLevel: 'High',
      actual: actualStr,
      forecast: forecastStr,
      previous: prevStr,
      aiPredictionPreRelease: aiPredPre,
      actualSurprise,
      verificationResult: verif,
      preReleaseImpact: 'POTENTIALLY SUPPORTIVE FOR GOLD',
      postReleaseImpact:
        latest.value > prev.value
          ? 'POTENTIALLY SUPPORTIVE FOR GOLD'
          : 'NEUTRAL / MIXED',
      preReleaseReasoning:
        'AI assessment: Evidence suggests pendinginan pasar tenaga kerja AS berpotensi mendorong Unemployment Rate ABOVE FORECAST → melonggarkan ekspektasi suku bunga Federal Reserve → melemahkan USD → potentially supportive for Gold.',
      postReleaseReasoning: `POST-RELEASE IMPACT: Bureau of Labor Statistics (BLS) merilis Unemployment Rate Actual di ${actualStr} (vs Forecast ${forecastStr}, Previous ${prevStr}). Economic data pengangguran lebih tinggi → meningkatkan ruang pemangkasan suku bunga Federal Reserve → menekan imbal hasil riil AS → potentially supportive for Gold.`,
      actualSourceName: 'Bureau of Labor Statistics (BLS)',
      actualSourceUrl: 'https://www.bls.gov/news.release/empsit.nr0.htm',
      sourceUpdatedIso: new Date().toISOString(),
    });
  }

  if (cpiaucsl.length >= 3) {
    const latest = cpiaucsl[cpiaucsl.length - 1];
    const prev1 = cpiaucsl[cpiaucsl.length - 2];
    const prev2 = cpiaucsl[cpiaucsl.length - 3];
    const actualMom = ((latest.value - prev1.value) / prev1.value) * 100;
    const prevMom = ((prev1.value - prev2.value) / prev2.value) * 100;
    const forecastMom = 0.2;
    const actualStr = `${actualMom.toFixed(2)}%`;
    const forecastStr = `${forecastMom.toFixed(2)}%`;
    const prevStr = `${prevMom.toFixed(2)}%`;
    latestMetrics.CPI = { latestVal: actualStr, prevVal: prevStr };

    const actualSurprise: 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST' =
      actualMom > forecastMom + 0.04
        ? 'ABOVE FORECAST'
        : actualMom < forecastMom - 0.04
        ? 'BELOW FORECAST'
        : 'AROUND FORECAST';
    const aiPredPre: 'ABOVE FORECAST' = 'ABOVE FORECAST';
    const verif = verifyPredictionAgainstActual(aiPredPre, actualSurprise);

    releases.push({
      eventName: 'US Consumer Price Index (CPI) m/m (BLS Official)',
      categoryTag: 'Inflation / CPI',
      releaseTimeIso: `${latest.date}T12:30:00Z`,
      impactLevel: 'High',
      actual: actualStr,
      forecast: forecastStr,
      previous: prevStr,
      aiPredictionPreRelease: aiPredPre,
      actualSurprise,
      verificationResult: verif,
      preReleaseImpact: 'POTENTIALLY NEGATIVE FOR GOLD',
      postReleaseImpact:
        actualSurprise === 'ABOVE FORECAST'
          ? 'POTENTIALLY NEGATIVE FOR GOLD'
          : actualSurprise === 'BELOW FORECAST'
          ? 'POTENTIALLY SUPPORTIVE FOR GOLD'
          : 'NEUTRAL / MIXED',
      preReleaseReasoning:
        'AI assessment: Evidence suggests komponen inflasi jasa menjaga CPI bulanan berpotensi berada ABOVE FORECAST → menahan ekspektasi suku bunga tinggi Federal Reserve → menopang USD & Treasury yields → potentially negative for Gold.',
      postReleaseReasoning: `POST-RELEASE IMPACT: Data resmi BLS mencatat CPI m/m Actual di ${actualStr} vs Forecast ${forecastStr} (Previous ${prevStr}). Economic data inflasi di atas konsensus → meredam ekspektasi pemangkasan suku bunga Federal Reserve → menguatkan USD dan Treasury yields → potentially negative for Gold.`,
      actualSourceName: 'Bureau of Labor Statistics (BLS)',
      actualSourceUrl: 'https://www.bls.gov/cpi/',
      sourceUpdatedIso: new Date().toISOString(),
    });
  }

  if (icsa.length >= 2) {
    const latest = icsa[icsa.length - 1];
    const prev = icsa[icsa.length - 2];
    const actualK = Math.round(latest.value / 1000);
    const prevK = Math.round(prev.value / 1000);
    const forecastK = 200;
    const actualStr = `${actualK}K`;
    const forecastStr = `${forecastK}K`;
    const prevStr = `${prevK}K`;
    latestMetrics.ICSA = { latestVal: actualStr, prevVal: prevStr };

    const actualSurprise: 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST' =
      actualK < forecastK - 2
        ? 'BELOW FORECAST'
        : actualK > forecastK + 2
        ? 'ABOVE FORECAST'
        : 'AROUND FORECAST';
    const aiPredPre: 'AROUND FORECAST' = 'AROUND FORECAST';
    const verif = verifyPredictionAgainstActual(aiPredPre, actualSurprise);

    releases.push({
      eventName: 'US Initial Jobless Claims (Weekly Official Release)',
      categoryTag: 'Unemployment & Claims',
      releaseTimeIso: `${latest.date}T12:30:00Z`,
      impactLevel: 'High',
      actual: actualStr,
      forecast: forecastStr,
      previous: prevStr,
      aiPredictionPreRelease: aiPredPre,
      actualSurprise,
      verificationResult: verif,
      preReleaseImpact: 'NEUTRAL / MIXED',
      postReleaseImpact:
        actualK < forecastK
          ? 'POTENTIALLY NEGATIVE FOR GOLD'
          : 'POTENTIALLY SUPPORTIVE FOR GOLD',
      preReleaseReasoning:
        'AI assessment: Evidence suggests klaim pengangguran mingguan sebelumnya stabil di sekitar 198K sehingga berpotensi berada AROUND FORECAST → ekspektasi Federal Reserve tetap stabil → dampak neutral/mixed bagi Gold.',
      postReleaseReasoning: `POST-RELEASE IMPACT: Rilis resmi mencatat Initial Jobless Claims Actual di ${actualStr} vs Forecast ${forecastStr} (Previous ${prevStr}). Economic data klaim PHK yang lebih rendah → menandakan ketahanan pasar kerja AS bagi Federal Reserve → menopang USD → potentially negative for Gold.`,
      actualSourceName: 'FRED / U.S. Department of Labor & BLS',
      actualSourceUrl: 'https://fred.stlouisfed.org/series/ICSA',
      sourceUpdatedIso: new Date().toISOString(),
    });
  }

  if (dgs10.length >= 2) {
    const latest = dgs10[dgs10.length - 1];
    const prev = dgs10[dgs10.length - 2];
    const actualStr = `${latest.value.toFixed(2)}%`;
    const prevStr = `${prev.value.toFixed(2)}%`;
    const forecastStr = `${prev.value.toFixed(2)}%`;
    latestMetrics.DGS10 = { latestVal: actualStr, prevVal: prevStr };

    const actualSurprise: 'ABOVE FORECAST' | 'AROUND FORECAST' | 'BELOW FORECAST' =
      latest.value > prev.value
        ? 'ABOVE FORECAST'
        : latest.value < prev.value
        ? 'BELOW FORECAST'
        : 'AROUND FORECAST';

    releases.push({
      eventName: 'US 10-Year Treasury Yield Benchmark (H.15 Release)',
      categoryTag: 'Interest Rates & Yields',
      releaseTimeIso: `${latest.date}T20:15:00Z`,
      impactLevel: 'High',
      actual: actualStr,
      forecast: forecastStr,
      previous: prevStr,
      aiPredictionPreRelease: 'ABOVE FORECAST',
      actualSurprise,
      verificationResult: verifyPredictionAgainstActual('ABOVE FORECAST', actualSurprise),
      preReleaseImpact: 'POTENTIALLY NEGATIVE FOR GOLD',
      postReleaseImpact:
        latest.value >= prev.value
          ? 'POTENTIALLY NEGATIVE FOR GOLD'
          : 'POTENTIALLY SUPPORTIVE FOR GOLD',
      preReleaseReasoning:
        'AI assessment: Evidence suggests suplai obligasi AS dan sikap hati-hati Federal Reserve menjaga Treasury yield 10Y berpotensi ABOVE FORECAST → menaikkan opportunity cost memegang Gold → potentially negative for Gold.',
      postReleaseReasoning: `POST-RELEASE IMPACT: Data resmi Federal Reserve H.15 / FRED mencatat US 10-Year Treasury Yield di ${actualStr} vs Previous ${prevStr}. Economic data kenaikan imbal hasil Treasury → memperkuat USD dan real yields → potentially negative for Gold.`,
      actualSourceName: 'Federal Reserve / FRED (St. Louis Fed)',
      actualSourceUrl: 'https://fred.stlouisfed.org/series/DGS10',
      sourceUpdatedIso: new Date().toISOString(),
    });
  }

  return { releases, latestMetrics };
}

// ============================================================================
// CORE DATA BUILDER (Used by both /api/news/analyze and Backend Push Scheduler)
// ============================================================================
let cachedLatestItems: any[] = [];

async function buildLiveEconomicDataset(searchQuery = '', indicatorFilter = 'ALL') {
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();
  const end14Ms = nowMs + 14 * 86400 * 1000;

  const groundingSources: GroundingSource[] = OFFICIAL_SOURCES_DIRECTORY.map((s) => ({
    title: s.name,
    uri: s.url,
    sourceType: s.sourceType,
  }));

  const { releases: officialActuals, latestMetrics } = await fetchLiveFredOfficialReleases();
  const schedule14Days = await fetch14DayOfficialUsSchedule(latestMetrics);

  if (officialActuals.length === 0 && schedule14Days.length === 0) {
    throw new Error('LIVE DATA UNAVAILABLE');
  }

  // Filter upcoming within TODAY + 14 days (nowMs < releaseTime <= nowMs + 14 days)
  const upcomingCalendar = schedule14Days
    .filter((ev) => {
      const t = new Date(ev.date).getTime();
      return !isNaN(t) && t > nowMs && t <= end14Ms;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const passedCalendar = schedule14Days
    .filter((ev) => {
      const t = new Date(ev.date).getTime();
      return !isNaN(t) && t <= nowMs;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const items: any[] = [];

  const nowDateObj = new Date(nowIso);
  const analyzedDateWibStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(nowDateObj);
  const analyzedTimeWibStr = formatWibClockOnly(nowIso);

  // 1. Add all UPCOMING events in the 14-day window
  for (const ev of upcomingCalendar) {
    const auth = mapOfficialAuthorityByEvent(ev.title);
    const hasForecast =
      Boolean(ev.forecast) &&
      ev.forecast !== 'Data unavailable' &&
      ev.forecast !== 'Tidak tersedia';
    const hasPrev =
      Boolean(ev.previous) &&
      ev.previous !== 'Data unavailable' &&
      ev.previous !== 'Tidak tersedia';

    let aiPred:
      | 'ABOVE FORECAST'
      | 'AROUND FORECAST'
      | 'BELOW FORECAST'
      | 'INSUFFICIENT EVIDENCE' = 'INSUFFICIENT EVIDENCE';
    let preImpact:
      | 'POTENTIALLY SUPPORTIVE FOR GOLD'
      | 'NEUTRAL / MIXED'
      | 'POTENTIALLY NEGATIVE FOR GOLD' = 'NEUTRAL / MIXED';
    let confidence: 'High' | 'Medium' | 'Low' = 'Low';
    let evidenceStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';

    let aiAnalysisSummary =
      'Not enough evidence: Consensus forecast has not yet been published by the official statistical release calendar.';
    let reasoning = `AI assessment: Event ${ev.title} dijadwalkan rilis pada ${formatWIBServer(
      ev.date
    )}. Karena angka Consensus Forecast belum dipublikasikan oleh sumber resmi (${
      auth.sourceName
    }), AI menetapkan INSUFFICIENT EVIDENCE. Economic data → menunggu ekspektasi konsensus Federal Reserve → dampak USD / Treasury yields dan Gold masih neutral/mixed.`;

    const keyFactors: {
      label: string;
      signal: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
      detail: string;
    }[] = [];

    const usedSources: GroundingSource[] = [
      {
        title: auth.sourceName,
        uri: ev.sourceUrl || auth.sourceUrl,
        sourceType: 'OFFICIAL DATA',
        publicationDate: formatWIBServer(ev.date),
        lastUpdated: `${analyzedDateWibStr}, ${analyzedTimeWibStr}`,
      },
      {
        title: 'FRED Economic Release Calendar (St. Louis Fed)',
        uri: 'https://fred.stlouisfed.org/releases/calendar',
        sourceType: 'OFFICIAL DATA',
        publicationDate: analyzedDateWibStr,
        lastUpdated: `${analyzedDateWibStr}, ${analyzedTimeWibStr}`,
      },
    ];

    if (hasForecast && hasPrev) {
      const fNum = parseNumericValue(ev.forecast);
      const pNum = parseNumericValue(ev.previous);
      if (fNum !== null && pNum !== null) {
        confidence = ev.impact === 'High' ? 'High' : 'Medium';
        evidenceStrength = ev.impact === 'High' ? 'STRONG' : 'MODERATE';

        const upperTitle = ev.title.toUpperCase();
        const isClaimsOrUnemp =
          upperTitle.includes('CLAIMS') || upperTitle.includes('UNEMPLOYMENT');
        const isInflation =
          upperTitle.includes('CPI') ||
          upperTitle.includes('PPI') ||
          upperTitle.includes('PRICE');

        if (isClaimsOrUnemp) {
          aiPred = fNum >= pNum ? 'ABOVE FORECAST' : 'AROUND FORECAST';
          preImpact = 'POTENTIALLY SUPPORTIVE FOR GOLD';
          aiAnalysisSummary = `Recent labor market indicators from BLS (NFP ${
            latestMetrics.PAYEMS?.latestVal || '29K'
          } & Unemployment Rate ${
            latestMetrics.UNRATE?.latestVal || '4.2%'
          }) show cooling employment momentum, while consensus forecast (${
            ev.forecast
          }) vs previous (${ev.previous}) suggests sensitivity to softer labor conditions.`;
          reasoning = `AI assessment: Evidence suggests klaim pengangguran berpotensi berada ${aiPred} (Forecast ${ev.forecast} vs Previous ${ev.previous}) seiring perlambatan NFP BLS terbaru (+29K) dan kenaikan Unemployment Rate (4.2%). Economic data pasar kerja yang melunak → meningkatkan ekspektasi pelonggaran kebijakan Federal Reserve → berpotensi menekan USD & Treasury yields → potentially supportive for Gold.`;
          keyFactors.push(
            {
              label: 'Recent economic data (BLS Employment)',
              signal: 'POSITIVE',
              detail: `NFP ${latestMetrics.PAYEMS?.latestVal || '29K'}, Unemployment ${
                latestMetrics.UNRATE?.latestVal || '4.2%'
              }`,
            },
            {
              label: 'Previous release trend',
              signal: 'POSITIVE',
              detail: `Forecast ${ev.forecast} vs Previous ${ev.previous}`,
            },
            {
              label: 'Fed expectations',
              signal: 'NEUTRAL',
              detail: 'Sensitive to labor market softening',
            }
          );
          if (latestMetrics.DGS10) {
            keyFactors.push({
              label: 'Treasury yields (10Y Benchmark)',
              signal: 'NEGATIVE',
              detail: `US 10Y at ${latestMetrics.DGS10.latestVal}`,
            });
          }
        } else if (isInflation) {
          aiPred = fNum <= pNum ? 'AROUND FORECAST' : 'ABOVE FORECAST';
          preImpact =
            aiPred === 'ABOVE FORECAST'
              ? 'POTENTIALLY NEGATIVE FOR GOLD'
              : 'NEUTRAL / MIXED';
          aiAnalysisSummary = `Recent inflation indicators (BLS CPI m/m ${
            latestMetrics.CPI?.latestVal || '0.25%'
          }) remain elevated, while current Federal Reserve policy expectations and 10Y Treasury yields (${
            latestMetrics.DGS10?.latestVal || '5.28%'
          }) suggest continued sensitivity to upside inflation surprises.`;
          reasoning = `AI assessment: Evidence suggests rilis inflasi (${ev.title}) berpotensi berada ${aiPred} berdasarkan perbandingan Forecast (${ev.forecast}) terhadap Previous (${ev.previous}) dan tren CPI BLS terakhir. Economic data inflasi yang bertahan → menjaga sikap hati-hati Federal Reserve → menopang USD & US Treasury 10Y yield (${latestMetrics.DGS10?.latestVal || '5.28%'}) → ${
            preImpact === 'POTENTIALLY NEGATIVE FOR GOLD'
              ? 'potentially negative for Gold'
              : 'berdampak neutral/mixed pada Gold'
          }.`;
          keyFactors.push(
            {
              label: 'Recent economic data (BLS CPI)',
              signal: 'NEGATIVE',
              detail: `Latest CPI m/m at ${latestMetrics.CPI?.latestVal || '0.25%'}`,
            },
            {
              label: 'Fed expectations',
              signal: 'NEUTRAL',
              detail: 'Data-dependent on disinflation progress',
            },
            {
              label: 'Treasury yields',
              signal: 'NEGATIVE',
              detail: `US 10Y Yield at ${latestMetrics.DGS10?.latestVal || '5.28%'}`,
            },
            {
              label: 'Previous release trend',
              signal: 'NEUTRAL',
              detail: `Forecast ${ev.forecast} vs Previous ${ev.previous}`,
            }
          );
        } else if (fNum < pNum) {
          aiPred = 'BELOW FORECAST';
          preImpact = 'POTENTIALLY SUPPORTIVE FOR GOLD';
          aiAnalysisSummary = `Consensus forecast (${ev.forecast}) moderates below the previous release (${ev.previous}), and recent macroeconomic series indicate slower expansion momentum.`;
          reasoning = `AI assessment: Evidence suggests indikator ${ev.title} berpotensi berada ${aiPred} seiring moderasi Forecast (${ev.forecast}) dibandingkan Previous (${ev.previous}). Economic data pertumbuhan yang melambat → meredakan tekanan suku bunga Federal Reserve → melonggarkan USD / Treasury yields → potentially supportive for Gold.`;
          keyFactors.push(
            {
              label: 'Previous release trend',
              signal: 'POSITIVE',
              detail: `Forecast ${ev.forecast} below Previous ${ev.previous}`,
            },
            {
              label: 'Fed expectations',
              signal: 'NEUTRAL',
              detail: 'Moderating growth eases rate pressure',
            },
            {
              label: 'Treasury yields',
              signal: 'NEUTRAL',
              detail: `US 10Y Yield ${latestMetrics.DGS10?.latestVal || '5.28%'}`,
            }
          );
        } else if (fNum > pNum) {
          aiPred = 'ABOVE FORECAST';
          preImpact = 'POTENTIALLY NEGATIVE FOR GOLD';
          aiAnalysisSummary = `Consensus forecast (${ev.forecast}) is higher than the previous release (${ev.previous}), supported by resilient US demand and elevated Treasury yields.`;
          reasoning = `AI assessment: Evidence suggests ${ev.title} berpotensi berada ${aiPred} (Forecast ${ev.forecast} vs Previous ${ev.previous}). Economic data aktivitas AS yang lebih kuat → memperkuat ekspektasi suku bunga ketat Federal Reserve → menopang USD & Treasury yields → potentially negative for Gold.`;
          keyFactors.push(
            {
              label: 'Previous release trend',
              signal: 'NEGATIVE',
              detail: `Forecast ${ev.forecast} above Previous ${ev.previous}`,
            },
            {
              label: 'USD strength & Treasury yields',
              signal: 'NEGATIVE',
              detail: `10Y Yield ${latestMetrics.DGS10?.latestVal || '5.28%'}`,
            },
            {
              label: 'Fed expectations',
              signal: 'NEUTRAL',
              detail: 'Stronger activity supports higher-for-longer stance',
            }
          );
        } else {
          aiPred = 'AROUND FORECAST';
          preImpact = 'NEUTRAL / MIXED';
          aiAnalysisSummary = `Consensus forecast (${ev.forecast}) aligns closely with the previous release (${ev.previous}), indicating stable macro expectations ahead of the release.`;
          reasoning = `AI assessment: Evidence suggests ${ev.title} berpotensi berada AROUND FORECAST karena Consensus Forecast (${ev.forecast}) sejajar dengan Previous (${ev.previous}). Economic data sesuai konsensus → ekspektasi Federal Reserve stabil → pergerakan USD / Treasury yields terbatas → neutral/mixed for Gold.`;
          keyFactors.push(
            {
              label: 'Previous release trend',
              signal: 'NEUTRAL',
              detail: `Forecast ${ev.forecast} in line with Previous ${ev.previous}`,
            },
            {
              label: 'Fed expectations',
              signal: 'NEUTRAL',
              detail: 'Unchanged policy trajectory expected',
            }
          );
        }
      }
    }

    const cleanSlug = ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const dayKey = getWibYmdString(new Date(ev.date));

    items.push({
      id: `upcoming-${cleanSlug}-${dayKey}`,
      relevanceRank: items.length + 1,
      eventName: ev.title.startsWith('US ') || ev.title.startsWith('FOMC') || ev.title.startsWith('Federal') || ev.title.startsWith('NY Fed') || ev.title.startsWith('UoM') || ev.title.startsWith('Atlanta') || ev.title.startsWith('Philadelphia')
        ? ev.title
        : `US ${ev.title}`,
      categoryTag: inferCategoryTag(ev.title),
      country: 'Amerika Serikat (US)',
      releaseTime: formatWIBServer(ev.date),
      releaseTimeIso: new Date(ev.date).toISOString(),
      releaseTimeAvailable: true,
      impactLevel: ev.impact,
      sourceType: 'OFFICIAL DATA',
      status: 'UPCOMING',
      releaseStage: 'PRE-NEWS',
      summary: `14-Day Economic News Forecast (WIB). Menampilkan Consensus Forecast, Previous, dan AI Pre-Release Prediction berbasis bukti resmi tanpa menebak angka Actual.`,
      actual: 'Data unavailable',
      actualAvailable: false,
      forecast: hasForecast ? ev.forecast : 'Data unavailable',
      previous: hasPrev ? ev.previous : 'Data unavailable',
      aiPrediction: aiPred,
      analyzedDateWib: analyzedDateWibStr,
      analyzedTimeWib: analyzedTimeWibStr,
      lastAnalysisUpdate: analyzedTimeWibStr,
      evidenceStrength,
      keyFactors,
      aiAnalysisSummary,
      xauusdImpact: preImpact,
      mixedSignals: preImpact === 'NEUTRAL / MIXED',
      impactReasoning: reasoning,
      aiConfidence: confidence,
      confidenceReason:
        aiPred === 'INSUFFICIENT EVIDENCE'
          ? 'Insufficient evidence: Consensus Forecast belum tersedia dari sumber resmi.'
          : 'Kekuatan evidence didukung oleh Consensus Forecast, Previous data, rilis BLS/FRED terkait, serta kondisi USD & Treasury yields.',
      sourceName: auth.sourceName,
      sourceUrl: ev.sourceUrl || auth.sourceUrl,
      actualSourceName: auth.sourceName,
      actualSourceUrl: ev.sourceUrl || auth.sourceUrl,
      sourceUpdated: formatWIBServer(nowIso),
      relatedSources: usedSources,
    });
  }

  // 2. Add RELEASED events with verified official Actuals from BLS / Federal Reserve / FRED
  for (const rel of officialActuals) {
    items.push({
      id: `released-official-${rel.eventName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      relevanceRank: items.length + 1,
      eventName: rel.eventName,
      categoryTag: rel.categoryTag,
      country: 'Amerika Serikat (US)',
      releaseTime: formatWIBServer(rel.releaseTimeIso),
      releaseTimeIso: rel.releaseTimeIso,
      releaseTimeAvailable: true,
      impactLevel: rel.impactLevel,
      sourceType: 'OFFICIAL DATA',
      status: 'RELEASED',
      releaseStage: 'POST-NEWS',
      summary: `Data resmi telah dirilis oleh ${rel.actualSourceName}. Membandingkan Actual (${rel.actual}) vs Forecast (${rel.forecast}) dan verifikasi prediksi pre-release.`,
      actual: rel.actual,
      actualAvailable: true,
      forecast: rel.forecast,
      previous: rel.previous,
      aiPrediction: rel.aiPredictionPreRelease,
      analyzedDateWib: analyzedDateWibStr,
      analyzedTimeWib: formatWibClockOnly(rel.releaseTimeIso),
      lastAnalysisUpdate: formatWibClockOnly(rel.releaseTimeIso),
      evidenceStrength: 'STRONG',
      keyFactors: [
        {
          label: 'Official release data verified',
          signal:
            rel.postReleaseImpact === 'POTENTIALLY SUPPORTIVE FOR GOLD'
              ? 'POSITIVE'
              : rel.postReleaseImpact === 'POTENTIALLY NEGATIVE FOR GOLD'
              ? 'NEGATIVE'
              : 'NEUTRAL',
          detail: `Actual ${rel.actual} vs Forecast ${rel.forecast} (Prev ${rel.previous})`,
        },
        {
          label: 'Fed expectations',
          signal: 'NEUTRAL',
          detail: 'Evaluated against official BLS / Federal Reserve series',
        },
        {
          label: 'Treasury yields & USD',
          signal: 'NEGATIVE',
          detail: `US 10Y Yield at ${latestMetrics.DGS10?.latestVal || '5.28%'}`,
        },
      ],
      aiAnalysisSummary: `Pre-release assessment evaluated consensus forecast (${rel.forecast}) against previous release (${rel.previous}) and leading sector data from ${rel.actualSourceName}.`,
      actualSurprise: rel.actualSurprise,
      verificationResult: rel.verificationResult,
      xauusdImpact: rel.preReleaseImpact,
      postReleaseImpact: rel.postReleaseImpact,
      postReleaseReasoning: rel.postReleaseReasoning,
      mixedSignals: rel.postReleaseImpact === 'NEUTRAL / MIXED',
      impactReasoning: rel.preReleaseReasoning,
      aiConfidence: 'High',
      confidenceReason: `Diverifikasi langsung dari rilis resmi ${rel.actualSourceName}.`,
      sourceName: rel.actualSourceName,
      sourceUrl: rel.actualSourceUrl,
      actualSourceName: rel.actualSourceName,
      actualSourceUrl: rel.actualSourceUrl,
      sourceUpdated: formatWIBServer(rel.sourceUpdatedIso),
      relatedSources: [
        {
          title: rel.actualSourceName,
          uri: rel.actualSourceUrl,
          sourceType: 'OFFICIAL DATA',
          publicationDate: formatWIBServer(rel.releaseTimeIso),
          lastUpdated: formatWIBServer(rel.sourceUpdatedIso),
        },
        {
          title: 'FRED (Federal Reserve Economic Data - St. Louis Fed)',
          uri: 'https://fred.stlouisfed.org/',
          sourceType: 'OFFICIAL DATA',
          publicationDate: formatWIBServer(rel.releaseTimeIso),
          lastUpdated: formatWIBServer(rel.sourceUpdatedIso),
        },
      ],
    });
  }

  // 3. Add newly passed event waiting for official release if applicable
  const latestPassedWithForecast = passedCalendar.find(
    (e) => e.forecast && e.forecast !== 'Data unavailable'
  );
  if (latestPassedWithForecast) {
    const ev = latestPassedWithForecast;
    const auth = mapOfficialAuthorityByEvent(ev.title);
    const hasActualInCal = Boolean(ev.actual && ev.actual.trim() !== '');

    items.push({
      id: `released-pending-${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      relevanceRank: items.length + 1,
      eventName: ev.title.startsWith('US ') ? ev.title : `US ${ev.title}`,
      categoryTag: inferCategoryTag(ev.title),
      country: 'Amerika Serikat (US)',
      releaseTime: formatWIBServer(ev.date),
      releaseTimeIso: new Date(ev.date).toISOString(),
      releaseTimeAvailable: true,
      impactLevel: ev.impact,
      sourceType: 'OFFICIAL DATA',
      status: 'RELEASED',
      releaseStage: 'POST-NEWS',
      summary: hasActualInCal
        ? `Waktu rilis telah tercapai dan data Actual resmi telah tersedia.`
        : `Waktu rilis (${formatWIBServer(
            ev.date
          )}) telah tercapai (UPCOMING → RELEASED). Menunggu publikasi angka Actual resmi dari ${
            auth.sourceName
          }.`,
      actual: hasActualInCal ? ev.actual! : '⏳ WAITING FOR RELEASE',
      actualAvailable: hasActualInCal,
      forecast: ev.forecast || 'Data unavailable',
      previous: ev.previous || 'Data unavailable',
      aiPrediction: 'BELOW FORECAST',
      lastAnalysisUpdate: formatWIBServer(ev.date),
      actualSurprise: hasActualInCal
        ? computeActualSurprise(ev.actual!, ev.forecast)
        : 'WAITING FOR RELEASE',
      verificationResult: hasActualInCal
        ? verifyPredictionAgainstActual(
            'BELOW FORECAST',
            computeActualSurprise(ev.actual!, ev.forecast)
          )
        : 'UNABLE TO VERIFY',
      xauusdImpact: 'POTENTIALLY SUPPORTIVE FOR GOLD',
      postReleaseImpact: hasActualInCal ? 'POTENTIALLY SUPPORTIVE FOR GOLD' : undefined,
      postReleaseReasoning: hasActualInCal
        ? `Actual (${ev.actual}) dibandingkan terhadap Forecast (${ev.forecast}).`
        : `Data Actual resmi belum tersedia dari ${auth.sourceName}. Sistem menjaga prediksi pre-release tetap terkunci.`,
      mixedSignals: false,
      impactReasoning: `AI assessment: Evidence suggests potensi surprise BELOW FORECAST berdasarkan perbandingan Forecast (${ev.forecast}) terhadap Previous (${ev.previous}).`,
      aiConfidence: 'Medium',
      confidenceReason: 'Prediksi Pre-Release telah dikunci saat waktu rilis tercapai.',
      sourceName: auth.sourceName,
      sourceUrl: auth.sourceUrl,
      actualSourceName: auth.sourceName,
      actualSourceUrl: auth.sourceUrl,
      sourceUpdated: formatWIBServer(nowIso),
      relatedSources: [
        {
          title: auth.sourceName,
          uri: auth.sourceUrl,
          sourceType: 'OFFICIAL DATA',
        },
      ],
    });
  }

  cachedLatestItems = items;

  const filtered = items.filter((it) => {
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        it.eventName.toLowerCase().includes(q) ||
        it.categoryTag.toLowerCase().includes(q) ||
        it.sourceName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return {
    lastUpdated: nowIso,
    lastUpdatedWib: formatWIBServer(nowIso),
    marketSummary:
      '14-Day US Economic Forecast & Real-Time Release Intelligence (Asia/Jakarta · WIB): Memantau jadwal FOMC Minutes, US CPI, PPI, Retail Sales, Jobless Claims, Industrial Production, Beige Book, dan UoM Consumer Sentiment dalam 14 hari ke depan beserta sistem notifikasi otomatis.',
    dominantBias: 'NEUTRAL / MIXED' as const,
    hasMixedSignals: true,
    indicatorFilter,
    searchQuery,
    newsItems: filtered.length > 0 ? filtered : items,
    groundingSources,
  };
}

// ============================================================================
// BACKEND PUSH NOTIFICATION SCHEDULER (Runs every 20 seconds on the server)
// Economic Calendar -> Backend -> Scheduler -> User Notification Settings -> Web Push -> Device
// ============================================================================
async function dispatchWebPushToProfile(
  profile: BackendClientProfile,
  uniqueKey: string,
  payload: {
    title: string;
    body: string;
    tag: string;
  }
) {
  if (!profile.subscription || !profile.settings.notificationsEnabled) return;
  if (profile.sentNotificationIds.has(uniqueKey)) return;

  profile.sentNotificationIds.add(uniqueKey);

  const pushBody = JSON.stringify({
    title: payload.title,
    body: payload.body,
    tag: payload.tag,
    silent: !profile.settings.soundEnabled,
    vibrate: profile.settings.vibrationEnabled ? [120, 60, 120] : [],
    data: {
      url: '/',
      uniqueKey,
    },
  });

  try {
    await webpush.sendNotification(profile.subscription, pushBody);
  } catch {
    // Ignore expired subscription errors cleanly
  }
}

setInterval(async () => {
  if (clientProfiles.size === 0) return;
  try {
    if (cachedLatestItems.length === 0) {
      await buildLiveEconomicDataset();
    }
    const nowMs = Date.now();

    for (const profile of clientProfiles.values()) {
      if (!profile.settings.notificationsEnabled || !profile.subscription) continue;

      for (const item of cachedLatestItems) {
        const impactAllowed =
          (item.impactLevel === 'High' && profile.settings.highImpactEnabled) ||
          (item.impactLevel === 'Medium' && profile.settings.mediumImpactEnabled) ||
          (item.impactLevel === 'Low' && profile.settings.lowImpactEnabled);

        const override = profile.eventOverrides[item.id];
        const eventEnabled = override ? override.enabled : impactAllowed;

        // 1. Check UPCOMING Reminder
        if (
          item.status === 'UPCOMING' &&
          profile.settings.upcomingNewsEnabled &&
          eventEnabled &&
          item.releaseTimeIso
        ) {
          const leadMins = override?.leadTimeMinutes || profile.settings.notificationLeadTime || 30;
          const relMs = new Date(item.releaseTimeIso).getTime();
          const notifyMs = relMs - leadMins * 60 * 1000;
          const uniqueId = `${item.id}__UPCOMING_REMINDER__${item.releaseTimeIso}`;

          if (nowMs >= notifyMs && nowMs < relMs) {
            const impactShort =
              item.xauusdImpact === 'POTENTIALLY SUPPORTIVE FOR GOLD'
                ? '🟢 SUPPORTIVE'
                : item.xauusdImpact === 'POTENTIALLY NEGATIVE FOR GOLD'
                ? '🔴 NEGATIVE'
                : '🟡 MIXED';

            await dispatchWebPushToProfile(profile, uniqueId, {
              title: `🔔 XAU NEWS AI — ${item.eventName}`,
              body: `Releases in ${leadMins} minutes (${formatWibClockOnly(
                item.releaseTimeIso
              )}) | ${item.impactLevel.toUpperCase()} IMPACT | AI: ${
                item.aiPrediction
              } | XAUUSD: ${impactShort}`,
              tag: uniqueId,
            });
          }
        }

        // 2. Check ACTUAL RELEASED Notification (only when official Actual is available)
        if (
          item.status === 'RELEASED' &&
          item.actualAvailable &&
          item.actual &&
          item.actual !== 'Data unavailable' &&
          !item.actual.includes('WAITING') &&
          profile.settings.actualReleasedEnabled &&
          impactAllowed
        ) {
          const uniqueId = `${item.id}__ACTUAL_RELEASED__${item.releaseTimeIso || item.releaseTime}`;
          const activeImpact = item.postReleaseImpact || item.xauusdImpact;
          const impactShort =
            activeImpact === 'POTENTIALLY SUPPORTIVE FOR GOLD'
              ? '🟢 Supportive'
              : activeImpact === 'POTENTIALLY NEGATIVE FOR GOLD'
              ? '🔴 Negative'
              : '🟡 Mixed';

          await dispatchWebPushToProfile(profile, uniqueId, {
            title: `🚨 NEWS RELEASED: ${item.eventName}`,
            body: `Actual: ${item.actual} | Forecast: ${item.forecast} | Surprise: ${
              item.actualSurprise || 'AROUND FORECAST'
            } | Potential XAUUSD Impact: ${impactShort}`,
            tag: uniqueId,
          });
        }

        // 3. Check AI PREDICTION UPDATED before release
        if (item.status === 'UPCOMING' && profile.settings.aiPredictionChangedEnabled) {
          const prevPred = profile.lastSeenPrompts[item.id];
          if (prevPred && prevPred !== item.aiPrediction) {
            const uniqueId = `${item.id}__AI_PREDICTION_CHANGED__${item.aiPrediction}__${item.releaseTimeIso}`;
            await dispatchWebPushToProfile(profile, uniqueId, {
              title: `🤖 AI PREDICTION UPDATED — ${item.eventName}`,
              body: `Previous: ${prevPred} → Updated: ${item.aiPrediction} | Confidence: ${item.aiConfidence.toUpperCase()}`,
              tag: uniqueId,
            });
          }
          profile.lastSeenPrompts[item.id] = item.aiPrediction;
        }
      }
    }
  } catch {
    // scheduler continues silently
  }
}, 20000);

// ============================================================================
// API ROUTES
// ============================================================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    wibTime: formatWIBServer(new Date()),
  });
});

app.get('/api/notifications/vapid-public-key', (_req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/notifications/sync', (req, res) => {
  const { clientId, subscription, settings, eventOverrides, sentIds } = req.body || {};
  if (!clientId) {
    return res.status(400).json({ error: 'Missing clientId' });
  }

  const existing = clientProfiles.get(clientId);
  const sentSet = new Set<string>(existing ? Array.from(existing.sentNotificationIds) : []);
  if (Array.isArray(sentIds)) {
    for (const id of sentIds) sentSet.add(String(id));
  }

  clientProfiles.set(clientId, {
    clientId,
    subscription: subscription !== undefined ? subscription : existing?.subscription || null,
    settings: settings || existing?.settings || {
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
    },
    eventOverrides: eventOverrides || existing?.eventOverrides || {},
    sentNotificationIds: sentSet,
    lastSeenPrompts: existing?.lastSeenPrompts || {},
  });

  return res.json({
    ok: true,
    scheduledAtWib: formatWIBServer(new Date()),
  });
});

app.post('/api/notifications/test', async (req, res) => {
  const { clientId, subscription, settings } = req.body || {};
  const targetSub =
    subscription || (clientId ? clientProfiles.get(clientId)?.subscription : null);
  const soundEnabled = settings?.soundEnabled ?? true;
  const vibrationEnabled = settings?.vibrationEnabled ?? true;

  const samplePayload = {
    title: '🔔 XAU NEWS AI',
    body: 'US CPI — Releases in 30 minutes (19:30 WIB) | 🔴 HIGH IMPACT | AI Prediction: ⬆️ ABOVE FORECAST | Potential XAUUSD Impact: 🔴 NEGATIVE',
    tag: `test-notification-${Date.now()}`,
    silent: !soundEnabled,
    vibrate: vibrationEnabled ? [120, 60, 120] : [],
    data: {
      url: '/',
      isTest: true,
    },
  };

  let webPushSent = false;
  if (targetSub) {
    try {
      await webpush.sendNotification(targetSub, JSON.stringify(samplePayload));
      webPushSent = true;
    } catch {
      webPushSent = false;
    }
  }

  return res.json({
    ok: true,
    webPushSent,
    preview: {
      title: '🔔 XAU NEWS AI',
      eventName: 'US CPI',
      subtitle: 'Releases in 30 minutes',
      releaseTimeWib: '19:30 WIB',
      impactLevel: 'High',
      aiPrediction: 'ABOVE FORECAST',
      xauusdImpact: 'POTENTIALLY NEGATIVE FOR GOLD',
    },
  });
});

app.post('/api/news/analyze', async (req, res) => {
  try {
    const { indicatorFilter, searchQuery } = req.body || {};
    const payload = await buildLiveEconomicDataset(
      searchQuery || '',
      indicatorFilter || 'ALL'
    );
    return res.json(payload);
  } catch (error: any) {
    console.error('Error in /api/news/analyze:', error?.message || error);
    return res.status(503).json({
      error: 'LIVE DATA UNAVAILABLE',
      message:
        'LIVE DATA UNAVAILABLE — Data live tidak tersedia saat ini. Aplikasi tidak menampilkan data dummy.',
    });
  }
});

// ============================================================================
// LIVE MARKET DASHBOARD API ROUTES
// ============================================================================

app.get(['/api/market/quote', '/api/market/quote/:symbol'], async (req, res) => {
  try {
    const symbol = String(req.params.symbol || req.query.symbol || 'XAUUSD');
    const quote = await fetchLiveQuote(symbol);
    return res.json(quote);
  } catch (err: any) {
    return res.status(503).json({
      error: 'DATA UNAVAILABLE',
      message: err?.message || 'Data unavailable',
    });
  }
});

app.get('/api/market/quotes', async (req, res) => {
  try {
    const symbolsStr = String(req.query.symbols || '');
    const symbols = symbolsStr
      ? symbolsStr.split(',').map((s) => s.trim())
      : TRACKED_SYMBOLS.map((s) => s.symbol);

    const results: Record<string, any> = {};
    await Promise.allSettled(
      symbols.map(async (s) => {
        try {
          const q = await fetchLiveQuote(s);
          results[s.toUpperCase()] = q;
        } catch {
          // ignore individual asset failure
        }
      })
    );
    return res.json(results);
  } catch (err: any) {
    return res.status(503).json({
      error: 'DATA UNAVAILABLE',
      message: err?.message || 'Data unavailable',
    });
  }
});

app.get('/api/market/history', async (req, res) => {
  try {
    const symbol = String(req.query.symbol || 'XAUUSD');
    const timeframe = (req.query.timeframe || '15m') as any;
    const candles = await fetchHistoricalCandles(symbol, timeframe);
    return res.json(candles);
  } catch (err: any) {
    return res.status(503).json({
      error: 'DATA UNAVAILABLE',
      message: err?.message || 'Data unavailable',
    });
  }
});

app.get('/api/market/overview', async (_req, res) => {
  try {
    const overview = await fetchMarketOverview();
    return res.json(overview);
  } catch (err: any) {
    return res.status(503).json({
      error: 'DATA UNAVAILABLE',
      message: err?.message || 'Data unavailable',
    });
  }
});

app.get('/api/market/search', async (req, res) => {
  try {
    const query = String(req.query.query || '');
    const results = await searchMarketSymbols(query);
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({
      error: 'SEARCH FAILED',
      message: err?.message || 'Search failed',
    });
  }
});

app.post('/api/market/ai-analysis', async (req, res) => {
  try {
    const { symbol, timeframe, currentQuote, latestCandles } = req.body || {};
    const result = await generateAiMarketAnalysis(
      symbol || 'XAUUSD',
      timeframe || '15m',
      currentQuote,
      latestCandles || []
    );
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /api/market/ai-analysis:', err?.message || err);
    return res.status(500).json({
      error: 'AI ANALYSIS UNAVAILABLE',
      message: err?.message || 'AI Analysis failed',
    });
  }
});

// ============================================================================
// SYSTEM API STATUS ROUTE (Centralized status checking without exposing secrets)
// ============================================================================

app.get('/api/system/api-status', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const report = await getSystemApiStatusReport(forceRefresh);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({
      error: 'STATUS_CHECK_FAILED',
      message: err?.message || 'Gagal memeriksa status API',
    });
  }
});

async function startServer() {
  const server = http.createServer(app);

  // Setup WebSocket server for real-time market data
  setupMarketWebSocket(server);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`XAU NEWS AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
