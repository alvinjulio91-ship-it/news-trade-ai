import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RefreshCw,
  Clock,
  ChevronRight,
  ArrowLeft,
  X,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Lock,
  Bell,
  BellOff,
  CheckSquare,
  Square,
  Volume2,
  Vibrate,
} from 'lucide-react';
import {
  ActiveTab,
  AppNotificationToast,
  calculateNotificationWibTime,
  DEFAULT_NOTIFICATION_SETTINGS,
  EconomicNewsItem,
  EventNotificationOverride,
  formatCountdown,
  formatToWIB,
  formatWibDateGroupParts,
  formatWibShortDate,
  formatWibShortTime,
  getWibGreeting,
  ImpactFilterTab,
  LockedPreReleasePrediction,
  makeNotificationUniqueId,
  NewsAnalysisBatch,
  NotificationLeadTimeOption,
  NotificationSettings,
  RefreshIntervalOption,
  ThemeMode,
} from './types';
import { NewsCard } from './components/NewsCard';
import { NewsDetailSheet } from './components/NewsDetailSheet';
import { TradingPlan } from './components/TradingPlan';
import { LiveMarketDashboard } from './components/market/LiveMarketDashboard';
import { ApiStatusCard } from './components/ApiStatusCard';

const STORAGE_KEY = 'xau_news_ai_history_v6';
const PRERELEASE_VAULT_KEY = 'xau_news_ai_prerelease_vault_v4';
const THEME_STORAGE_KEY = 'xau_news_ai_theme_v1';
const REFRESH_INTERVAL_KEY = 'xau_news_ai_refresh_sec_v1';
const AUTO_REFRESH_ENABLED_KEY = 'xau_news_ai_auto_refresh_v1';

// Notification System Persistence Keys
const NOTIF_SETTINGS_KEY = 'xau_news_ai_notif_settings_v1';
const NOTIF_EVENT_OVERRIDES_KEY = 'xau_news_ai_notif_overrides_v1';
const NOTIF_SENT_LOG_KEY = 'xau_news_ai_notif_sent_ids_v1';
const NOTIF_CLIENT_ID_KEY = 'xau_news_ai_client_id_v1';
const NOTIF_PERMISSION_ASKED_KEY = 'xau_news_ai_perm_asked_v1';

const VERIFIED_PRIMARY_SOURCES = [
  {
    id: 1,
    name: 'Bureau of Labor Statistics (BLS)',
    url: 'https://www.bls.gov/',
    type: 'OFFICIAL DATA' as const,
    desc: 'CPI, PPI, Employment Situation, Unemployment Rate & Nonfarm Payrolls.',
  },
  {
    id: 2,
    name: 'Federal Reserve',
    url: 'https://www.federalreserve.gov/',
    type: 'OFFICIAL DATA' as const,
    desc: 'FOMC Rate Decision, FOMC Statement, FOMC Minutes, Beige Book & Fed Releases.',
  },
  {
    id: 3,
    name: 'Federal Reserve Bank of New York',
    url: 'https://www.newyorkfed.org/',
    type: 'OFFICIAL DATA' as const,
    desc: 'Consumer Inflation Expectations, Empire State Manufacturing & Desk Ops.',
  },
  {
    id: 4,
    name: 'FRED (St. Louis Fed)',
    url: 'https://fred.stlouisfed.org/',
    type: 'OFFICIAL DATA' as const,
    desc: '14-Day US Economic Release Calendar, Initial Jobless Claims, GDP & Treasury Yields.',
  },
  {
    id: 5,
    name: 'Reuters',
    url: 'https://www.reuters.com/',
    type: 'NEWS CONTEXT' as const,
    desc: 'Real-time US Market & Economic News Context.',
  },
  {
    id: 6,
    name: 'Associated Press (AP)',
    url: 'https://apnews.com/',
    type: 'NEWS CONTEXT' as const,
    desc: 'US Economy, Labor & Public Policy News Context.',
  },
];

function makeEventVaultKey(eventName: string, releaseTimeIso?: string): string {
  const dayPart = releaseTimeIso ? releaseTimeIso.slice(0, 10) : 'nodate';
  return `${eventName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}__${dayPart}`;
}

function groupEventsByWibDate(items: EconomicNewsItem[]) {
  const groups: {
    dateKey: string;
    dayBadge: string;
    fullDateId: string;
    items: EconomicNewsItem[];
  }[] = [];
  const map = new Map<string, EconomicNewsItem[]>();

  for (const item of items) {
    const parts = formatWibDateGroupParts(item.releaseTimeIso);
    const key = `${parts.dayBadge}__${parts.fullDateId}`;
    const existing = map.get(key);
    if (existing) {
      existing.push(item);
    } else {
      const arr = [item];
      map.set(key, arr);
      groups.push({
        dateKey: key,
        dayBadge: parts.dayBadge,
        fullDateId: parts.fullDateId,
        items: arr,
      });
    }
  }
  return groups;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function playSubtleNotificationChime() {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.29);
  } catch {
    // Ignore audio context restriction errors
  }
}

function triggerDeviceVibration(enabled: boolean) {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([120, 60, 120]);
    }
  } catch {
    // Ignore if device/browser does not support vibration
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [upcomingImpactFilter, setUpcomingImpactFilter] = useState<ImpactFilterTab>('ALL');
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<EconomicNewsItem | null>(null);

  const [currentBatch, setCurrentBatch] = useState<NewsAnalysisBatch | null>(null);
  const [preReleaseVault, setPreReleaseVault] = useState<
    Record<string, LockedPreReleasePrediction>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // In-app Notification Banner Preview / Live Toast Queue
  const [activeToast, setActiveToast] = useState<AppNotificationToast | null>(null);
  const [showPermissionHelpModal, setShowPermissionHelpModal] = useState<boolean>(false);

  // Client ID for Backend Push Scheduler
  const [clientId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_CLIENT_ID_KEY);
      if (saved) return saved;
      const generated = `xau-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(NOTIF_CLIENT_ID_KEY, generated);
      return generated;
    } catch {
      return `xau-client-${Date.now()}`;
    }
  });

  // Notification Settings State (persisted in localStorage)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
    () => {
      try {
        const raw = localStorage.getItem(NOTIF_SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return { ...DEFAULT_NOTIFICATION_SETTINGS, ...parsed };
        }
      } catch {
        // ignore
      }
      return DEFAULT_NOTIFICATION_SETTINGS;
    }
  );

  // Per-Event Notification Overrides (persisted in localStorage)
  const [eventOverrides, setEventOverrides] = useState<
    Record<string, EventNotificationOverride>
  >(() => {
    try {
      const raw = localStorage.getItem(NOTIF_EVENT_OVERRIDES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  // Duplicate Protection: Set of unique notification IDs already sent
  const [sentNotificationIds, setSentNotificationIds] = useState<Record<string, boolean>>(
    () => {
      try {
        const raw = localStorage.getItem(NOTIF_SENT_LOG_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch {
        // ignore
      }
      return {};
    }
  );
  const sentIdsRef = useRef<Record<string, boolean>>(sentNotificationIds);
  useEffect(() => {
    sentIdsRef.current = sentNotificationIds;
  }, [sentNotificationIds]);

  // Browser Notification Permission State
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const pushSubscriptionRef = useRef<PushSubscription | null>(null);

  // Theme & Refresh Settings
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light' || saved === 'system') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'dark';
  });

  const [refreshIntervalSec, setRefreshIntervalSec] = useState<RefreshIntervalOption>(() => {
    try {
      const saved = Number(localStorage.getItem(REFRESH_INTERVAL_KEY));
      if (saved === 30 || saved === 60 || saved === 300) return saved;
    } catch {
      // ignore
    }
    return 60;
  });

  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(AUTO_REFRESH_ENABLED_KEY);
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  // Apply Theme (Dark default, Light, or System)
  useEffect(() => {
    const applyResolvedTheme = () => {
      let resolved: 'dark' | 'light' = 'dark';
      if (themeMode === 'light') {
        resolved = 'light';
      } else if (themeMode === 'dark') {
        resolved = 'dark';
      } else {
        const prefersLight =
          typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-color-scheme: light)').matches;
        resolved = prefersLight ? 'light' : 'dark';
      }
      document.documentElement.setAttribute('data-theme', resolved);
    };

    applyResolvedTheme();
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore
    }

    if (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const listener = () => applyResolvedTheme();
      mq.addEventListener('change', listener);
      return () => mq.removeEventListener('change', listener);
    }
  }, [themeMode]);

  // Persist refresh settings
  useEffect(() => {
    try {
      localStorage.setItem(REFRESH_INTERVAL_KEY, String(refreshIntervalSec));
      localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, String(autoRefreshEnabled));
    } catch {
      // ignore
    }
  }, [refreshIntervalSec, autoRefreshEnabled]);

  // Persist Notification Settings, Event Overrides, and Sent Log + Sync with Backend Scheduler
  useEffect(() => {
    try {
      localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(notificationSettings));
      localStorage.setItem(NOTIF_EVENT_OVERRIDES_KEY, JSON.stringify(eventOverrides));
      localStorage.setItem(NOTIF_SENT_LOG_KEY, JSON.stringify(sentNotificationIds));
    } catch {
      // ignore
    }

    fetch('/api/notifications/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        subscription: pushSubscriptionRef.current,
        settings: notificationSettings,
        eventOverrides,
        sentIds: Object.keys(sentNotificationIds),
      }),
    }).catch(() => {});
  }, [clientId, notificationSettings, eventOverrides, sentNotificationIds]);

  // Register Service Worker & Subscribe to Web Push if permission granted
  const setupServiceWorkerAndPush = useCallback(async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      if ('PushManager' in window && Notification.permission === 'granted') {
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const vapidRes = await fetch('/api/notifications/vapid-public-key');
          if (vapidRes.ok) {
            const { publicKey } = await vapidRes.json();
            if (publicKey) {
              sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
              });
            }
          }
        }
        if (sub) {
          pushSubscriptionRef.current = sub;
          fetch('/api/notifications/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId,
              subscription: sub,
              settings: notificationSettings,
              eventOverrides,
              sentIds: Object.keys(sentIdsRef.current),
            }),
          }).catch(() => {});
        }
      }
    } catch {
      // Service worker or Push registration optional in restricted iframe
    }
  }, [clientId, notificationSettings, eventOverrides]);

  useEffect(() => {
    setupServiceWorkerAndPush();
  }, [setupServiceWorkerAndPush]);

  const requestNotificationPermissionOnce = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserPermission('unsupported');
      return;
    }
    setBrowserPermission(Notification.permission);
    if (Notification.permission === 'default') {
      try {
        localStorage.setItem(NOTIF_PERMISSION_ASKED_KEY, 'true');
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
        if (perm === 'granted') {
          await setupServiceWorkerAndPush();
        }
      } catch {
        // ignore
      }
    } else if (Notification.permission === 'granted') {
      await setupServiceWorkerAndPush();
    }
  }, [setupServiceWorkerAndPush]);

  // Mark a unique notification key as sent
  const markNotificationSent = useCallback((uniqueKey: string) => {
    setSentNotificationIds((prev) => {
      if (prev[uniqueKey]) return prev;
      const next = { ...prev, [uniqueKey]: true };
      sentIdsRef.current = next;
      return next;
    });
  }, []);

  // Unified Notification Dispatcher (Service Worker + Browser Notification + Vibration + Sound + In-App Banner)
  const triggerNotificationAlert = useCallback(
    async (toastPayload: AppNotificationToast, isTest = false) => {
      if (!isTest) {
        if (!notificationSettings.notificationsEnabled) return;
        if (sentIdsRef.current[toastPayload.uniqueKey]) return;
        markNotificationSent(toastPayload.uniqueKey);
      }

      // 1. Vibration (if ON)
      triggerDeviceVibration(notificationSettings.vibrationEnabled);

      // 2. Sound (if ON)
      if (notificationSettings.soundEnabled) {
        playSubtleNotificationChime();
      }

      // 3. Show In-App Notification Banner
      setActiveToast(toastPayload);

      // 4. Native Browser / Service Worker Notification if permission is granted
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const bodyLines = [
          `${toastPayload.eventName} — ${toastPayload.subtitle}`,
          toastPayload.releaseTimeWib ? `Time: ${toastPayload.releaseTimeWib}` : '',
          `Impact: ${toastPayload.impactLevel.toUpperCase()}`,
          toastPayload.aiPrediction ? `AI Prediction: ${toastPayload.aiPrediction}` : '',
          `XAUUSD: ${toastPayload.xauusdImpact}`,
        ]
          .filter(Boolean)
          .join(' | ');

        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg && typeof reg.showNotification === 'function') {
              await reg.showNotification(toastPayload.title, {
                body: bodyLines,
                tag: toastPayload.uniqueKey,
                silent: !notificationSettings.soundEnabled,
                icon: '/icon.svg',
              });
              return;
            }
          }
          new Notification(toastPayload.title, {
            body: bodyLines,
            tag: toastPayload.uniqueKey,
            silent: !notificationSettings.soundEnabled,
          });
        } catch {
          // Fallback to in-app banner already displayed
        }
      }
    },
    [
      notificationSettings.notificationsEnabled,
      notificationSettings.vibrationEnabled,
      notificationSettings.soundEnabled,
      markNotificationSent,
    ]
  );

  // Load Pre-Release Vault on mount
  useEffect(() => {
    try {
      const rawVault = localStorage.getItem(PRERELEASE_VAULT_KEY);
      if (rawVault) {
        const parsed = JSON.parse(rawVault);
        if (parsed && typeof parsed === 'object') {
          setPreReleaseVault(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  /**
   * Live Reassessment & Pre-Release Lock Logic:
   * - While event is UPCOMING (releaseTime > now), AI may update its prediction if new economic data arrives.
   *   If the prediction changes, we record `previousAiPrediction` and trigger AI PREDICTION UPDATED notification (if enabled).
   * - Once releaseTime <= now (or status === 'RELEASED'), the last pre-release prediction is LOCKED permanently.
   */
  const mergeAndReassessPreReleasePredictions = useCallback(
    (items: EconomicNewsItem[]): EconomicNewsItem[] => {
      let currentVault: Record<string, LockedPreReleasePrediction> = {};
      try {
        const raw = localStorage.getItem(PRERELEASE_VAULT_KEY);
        if (raw) currentVault = JSON.parse(raw) || {};
      } catch {
        currentVault = {};
      }

      let updated = false;
      const nowTime = Date.now();

      const mergedItems = items.map((item) => {
        const key = makeEventVaultKey(item.eventName, item.releaseTimeIso);
        const existingLock = currentVault[key];
        const relMs = item.releaseTimeIso ? new Date(item.releaseTimeIso).getTime() : 0;
        const hasReachedRelease =
          item.status === 'RELEASED' || (relMs > 0 && relMs <= nowTime);

        if (existingLock) {
          // If still UPCOMING before release time, allow Live Reassessment if AI prediction changed
          if (!hasReachedRelease && existingLock.aiPrediction !== item.aiPrediction) {
            const prevDirection = existingLock.aiPrediction;
            const updatedWibStr = item.lastAnalysisUpdate || formatWibShortTime(new Date().toISOString());
            const reasonStr = `Updated based on latest consensus forecast (${item.forecast}) vs previous (${item.previous}) and official macro indicators.`;
            const reassessedLock: LockedPreReleasePrediction = {
              ...existingLock,
              consensusForecast: item.forecast,
              previous: item.previous,
              previousPredictionBeforeReassessment: prevDirection,
              reassessmentReason: reasonStr,
              aiPrediction: item.aiPrediction,
              aiConfidence: item.aiConfidence,
              evidenceStrength: item.evidenceStrength,
              keyFactors: item.keyFactors,
              aiAnalysisSummary: item.aiAnalysisSummary,
              xauusdPotentialImpact: item.xauusdImpact,
              reasoning: item.impactReasoning,
              lastAnalysisUpdate: updatedWibStr,
            };
            currentVault[key] = reassessedLock;
            updated = true;

            // Trigger AI PREDICTION UPDATED notification if enabled
            if (
              notificationSettings.notificationsEnabled &&
              notificationSettings.aiPredictionChangedEnabled
            ) {
              const uniqueId = makeNotificationUniqueId(
                item.id,
                'AI_PREDICTION_CHANGED',
                `${item.releaseTimeIso}_${item.aiPrediction}`
              );
              triggerNotificationAlert({
                id: `toast-${Date.now()}`,
                uniqueKey: uniqueId,
                type: 'AI_PREDICTION_CHANGED',
                title: '🤖 AI PREDICTION UPDATED',
                eventName: item.eventName,
                subtitle: `Previous: ${prevDirection} → Updated: ${item.aiPrediction}`,
                releaseTimeWib: formatWibShortTime(item.releaseTimeIso, item.releaseTime),
                impactLevel: item.impactLevel,
                previousPrediction: prevDirection,
                aiPrediction: item.aiPrediction,
                xauusdImpact: item.xauusdImpact,
                confidence: item.aiConfidence,
                createdAtWib: formatToWIB(new Date()),
              });
            }

            return {
              ...item,
              previousAiPrediction: prevDirection,
              lockedPreRelease: reassessedLock,
            };
          }

          // Once release time is reached, NEVER alter the locked pre-release prediction
          return {
            ...item,
            aiPrediction: existingLock.aiPrediction,
            lockedPreRelease: existingLock,
          };
        }

        // First time seeing this event: store its initial pre-release prediction
        const newLock: LockedPreReleasePrediction = {
          eventKey: key,
          eventName: item.eventName,
          releaseTime: item.releaseTime,
          consensusForecast: item.forecast,
          previous: item.previous,
          aiPrediction: item.aiPrediction,
          aiConfidence: item.aiConfidence,
          evidenceStrength: item.evidenceStrength,
          keyFactors: item.keyFactors,
          aiAnalysisSummary: item.aiAnalysisSummary,
          xauusdPotentialImpact: item.xauusdImpact,
          reasoning: item.impactReasoning,
          lockedAt: new Date().toISOString(),
          lockedAtWib: item.releaseTimeIso
            ? calculateNotificationWibTime(item.releaseTimeIso, 1).notifyTimeWib
            : item.analyzedTimeWib,
          analyzedDateWib: item.analyzedDateWib,
          analyzedTimeWib: item.analyzedTimeWib,
          lastAnalysisUpdate: item.lastAnalysisUpdate || formatToWIB(new Date()),
        };
        currentVault[key] = newLock;
        updated = true;
        return {
          ...item,
          lockedPreRelease: newLock,
        };
      });

      if (updated) {
        try {
          localStorage.setItem(PRERELEASE_VAULT_KEY, JSON.stringify(currentVault));
          setPreReleaseVault({ ...currentVault });
        } catch {
          // ignore
        }
      }
      return mergedItems;
    },
    [
      notificationSettings.notificationsEnabled,
      notificationSettings.aiPredictionChangedEnabled,
      triggerNotificationAlert,
    ]
  );

  const fetchLatestNews = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsLoading(true);
      }
      setErrorMsg(null);

      try {
        const response = await fetch('/api/news/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ indicatorFilter: 'ALL', searchQuery: '' }),
        });

        const data = await response.json();
        if (!response.ok || data.error) {
          if (!silent) {
            setErrorMsg('LIVE DATA UNAVAILABLE');
          }
          return;
        }

        const lockedItems = mergeAndReassessPreReleasePredictions(data.newsItems || []);
        const newBatch: NewsAnalysisBatch = {
          id: `batch-${Date.now()}`,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
          marketSummary: data.marketSummary,
          dominantBias: data.dominantBias,
          hasMixedSignals: Boolean(data.hasMixedSignals),
          indicatorFilter: 'ALL',
          newsItems: lockedItems,
          groundingSources: data.groundingSources || [],
        };

        setCurrentBatch(newBatch);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([newBatch]));
        } catch {
          // ignore
        }
      } catch {
        if (!silent) {
          setErrorMsg('LIVE DATA UNAVAILABLE');
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [mergeAndReassessPreReleasePredictions]
  );

  // Load cached batch on mount and fetch fresh live data
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: NewsAnalysisBatch[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCurrentBatch(parsed[0]);
        }
      }
    } catch {
      // ignore
    }
    fetchLatestNews(false);
  }, [fetchLatestNews]);

  // 1-second live countdown ticker, Notification Scheduler Check, & UPCOMING -> RELEASED transition
  useEffect(() => {
    const timer = setInterval(() => {
      const currentNow = Date.now();
      setNowMs(currentNow);

      setCurrentBatch((prev) => {
        if (!prev) return prev;
        let changed = false;

        const updatedItems = prev.newsItems.map((item) => {
          const globalImpactAllowed =
            (item.impactLevel === 'High' && notificationSettings.highImpactEnabled) ||
            (item.impactLevel === 'Medium' && notificationSettings.mediumImpactEnabled) ||
            (item.impactLevel === 'Low' && notificationSettings.lowImpactEnabled);

          const override = eventOverrides[item.id];
          const eventNotifyEnabled = override
            ? override.enabled
            : notificationSettings.upcomingNewsEnabled && globalImpactAllowed;
          const leadMins =
            override?.leadTimeMinutes || notificationSettings.notificationLeadTime || 30;

          // 1. Check UPCOMING Pre-Release Reminder Schedule
          if (
            item.status === 'UPCOMING' &&
            item.releaseTimeIso &&
            notificationSettings.notificationsEnabled &&
            eventNotifyEnabled
          ) {
            const schedule = calculateNotificationWibTime(item.releaseTimeIso, leadMins);
            const relMs = new Date(item.releaseTimeIso).getTime();
            const uniqueReminderKey = makeNotificationUniqueId(
              item.id,
              'UPCOMING_REMINDER',
              item.releaseTimeIso
            );

            if (
              schedule.notifyTimestampMs &&
              currentNow >= schedule.notifyTimestampMs &&
              currentNow < relMs &&
              !sentIdsRef.current[uniqueReminderKey]
            ) {
              const remMin = Math.max(1, Math.round((relMs - currentNow) / 60000));
              triggerNotificationAlert({
                id: `toast-rem-${Date.now()}`,
                uniqueKey: uniqueReminderKey,
                type: 'UPCOMING_REMINDER',
                title: '🔔 XAU NEWS AI',
                eventName: item.eventName,
                subtitle: `Releases in ${remMin} minutes`,
                releaseTimeWib: formatWibShortTime(item.releaseTimeIso, item.releaseTime),
                impactLevel: item.impactLevel,
                aiPrediction: item.lockedPreRelease?.aiPrediction || item.aiPrediction,
                xauusdImpact: item.xauusdImpact,
                confidence: item.aiConfidence,
                createdAtWib: formatToWIB(new Date()),
              });
            }
          }

          // 2. Check automatic UPCOMING -> RELEASED transition when releaseTime is reached
          if (item.status === 'UPCOMING' && item.releaseTimeIso) {
            const relMs = new Date(item.releaseTimeIso).getTime();
            if (!isNaN(relMs) && relMs <= currentNow) {
              changed = true;
              return {
                ...item,
                status: 'RELEASED' as const,
                releaseStage: 'POST-NEWS' as const,
                actual: '⏳ WAITING FOR RELEASE',
                actualAvailable: false,
                actualSurprise: 'WAITING FOR RELEASE' as const,
                verificationResult: 'UNABLE TO VERIFY' as const,
              };
            }
          }

          // 3. Check ACTUAL RELEASED Notification (only when official Actual is available & not sent yet)
          if (
            item.status === 'RELEASED' &&
            item.actualAvailable &&
            item.actual &&
            item.actual !== 'Data unavailable' &&
            item.actual !== 'Tidak tersedia' &&
            !item.actual.includes('WAITING') &&
            notificationSettings.notificationsEnabled &&
            notificationSettings.actualReleasedEnabled &&
            globalImpactAllowed
          ) {
            const uniqueActualKey = makeNotificationUniqueId(
              item.id,
              'ACTUAL_RELEASED',
              item.releaseTimeIso || item.releaseTime
            );
            // Only auto-notify for fresh releases within the last 12 hours so historical archive doesn't spam on first load
            const relMs = item.releaseTimeIso
              ? new Date(item.releaseTimeIso).getTime()
              : 0;
            if (
              relMs > 0 &&
              currentNow - relMs < 12 * 3600 * 1000 &&
              !sentIdsRef.current[uniqueActualKey]
            ) {
              triggerNotificationAlert({
                id: `toast-act-${Date.now()}`,
                uniqueKey: uniqueActualKey,
                type: 'ACTUAL_RELEASED',
                title: `🚨 NEWS RELEASED — ${item.eventName}`,
                eventName: item.eventName,
                subtitle: `Actual: ${item.actual} | Forecast: ${item.forecast}`,
                releaseTimeWib: formatWibShortTime(item.releaseTimeIso, item.releaseTime),
                impactLevel: item.impactLevel,
                actual: item.actual,
                forecast: item.forecast,
                actualSurprise: item.actualSurprise,
                xauusdImpact: item.postReleaseImpact || item.xauusdImpact,
                createdAtWib: formatToWIB(new Date()),
              });
            }
          }

          return item;
        });

        if (!changed) return prev;
        return {
          ...prev,
          lastUpdated: new Date().toISOString(),
          newsItems: updatedItems,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [notificationSettings, eventOverrides, triggerNotificationAlert]);

  // Configurable Auto-Refresh Polling
  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const pollTimer = setInterval(() => {
      fetchLatestNews(true);
    }, refreshIntervalSec * 1000);
    return () => clearInterval(pollTimer);
  }, [autoRefreshEnabled, refreshIntervalSec, fetchLatestNews]);

  // Trigger [ TEST NOTIFICATION ] button handler
  const handleSendTestNotification = async () => {
    await requestNotificationPermissionOnce();

    // Also fire backend Web Push test if subscribed
    fetch('/api/notifications/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId,
        subscription: pushSubscriptionRef.current,
        settings: notificationSettings,
      }),
    }).catch(() => {});

    // Show exact requested preview notification
    triggerNotificationAlert(
      {
        id: `test-toast-${Date.now()}`,
        uniqueKey: `test-notification-${Date.now()}`,
        type: 'TEST_NOTIFICATION',
        title: '🔔 XAU NEWS AI',
        eventName: 'US CPI',
        subtitle: 'Releases in 30 minutes',
        releaseTimeWib: '19:30 WIB',
        impactLevel: 'High',
        aiPrediction: 'ABOVE FORECAST',
        xauusdImpact: 'POTENTIALLY NEGATIVE FOR GOLD',
        createdAtWib: formatToWIB(new Date()),
      },
      true
    );
  };

  // Update per-event notification override
  const handleUpdateEventOverride = useCallback(
    (eventId: string, override: EventNotificationOverride) => {
      if (override.enabled) {
        requestNotificationPermissionOnce();
      }
      setEventOverrides((prev) => ({
        ...prev,
        [eventId]: override,
      }));
    },
    [requestNotificationPermissionOnce]
  );

  // Strictly separated UPCOMING (14-Day Forecast) and RELEASED lists
  const upcomingItems = useMemo(() => {
    return (currentBatch?.newsItems || [])
      .filter((i) => i.status === 'UPCOMING')
      .sort((a, b) => {
        const tA = a.releaseTimeIso ? new Date(a.releaseTimeIso).getTime() : Infinity;
        const tB = b.releaseTimeIso ? new Date(b.releaseTimeIso).getTime() : Infinity;
        return tA - tB;
      });
  }, [currentBatch]);

  const filteredUpcomingItems = useMemo(() => {
    if (upcomingImpactFilter === 'ALL') return upcomingItems;
    return upcomingItems.filter((item) => {
      if (upcomingImpactFilter === 'HIGH') return item.impactLevel === 'High';
      if (upcomingImpactFilter === 'MEDIUM') return item.impactLevel === 'Medium';
      if (upcomingImpactFilter === 'LOW') return item.impactLevel === 'Low';
      return true;
    });
  }, [upcomingItems, upcomingImpactFilter]);

  const releasedItems = useMemo(() => {
    return (currentBatch?.newsItems || [])
      .filter((i) => i.status === 'RELEASED')
      .sort((a, b) => {
        const tA = a.releaseTimeIso ? new Date(a.releaseTimeIso).getTime() : 0;
        const tB = b.releaseTimeIso ? new Date(b.releaseTimeIso).getTime() : 0;
        return tB - tA;
      });
  }, [currentBatch]);

  // Next High Impact News for Home Hero Card
  const nextHighImpactEvent = useMemo(() => {
    const high = upcomingItems.find((i) => i.impactLevel === 'High');
    if (high) return high;
    const med = upcomingItems.find((i) => i.impactLevel === 'Medium');
    return med || upcomingItems[0] || null;
  }, [upcomingItems]);

  const upcomingGroups = useMemo(
    () => groupEventsByWibDate(filteredUpcomingItems),
    [filteredUpcomingItems]
  );
  const releasedGroups = useMemo(
    () => groupEventsByWibDate(releasedItems),
    [releasedItems]
  );

  // Accuracy stats from released items
  const accuracyStats = useMemo(() => {
    const correct = releasedItems.filter(
      (i) => i.verificationResult === 'CORRECT DIRECTION'
    ).length;
    const near = releasedItems.filter(
      (i) => i.verificationResult === 'NEAR FORECAST'
    ).length;
    const incorrect = releasedItems.filter(
      (i) => i.verificationResult === 'INCORRECT DIRECTION'
    ).length;
    const pending = releasedItems.filter(
      (i) => !i.verificationResult || i.verificationResult === 'UNABLE TO VERIFY'
    ).length;
    return { correct, near, incorrect, pending };
  }, [releasedItems]);

  const { greeting } = getWibGreeting();
  const formattedLastUpdated = currentBatch?.lastUpdated
    ? formatToWIB(currentBatch.lastUpdated)
    : 'Memuat WIB...';

  const handleNavigate = (tab: ActiveTab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleMasterNotifications = async (enabled: boolean) => {
    if (enabled) {
      await requestNotificationPermissionOnce();
    }
    setNotificationSettings((prev) => ({
      ...prev,
      notificationsEnabled: enabled,
    }));
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] flex justify-center overflow-x-hidden">
      {/* Responsive Container (up to 1100px on desktop when in market tab, 500px for mobile app tabs) */}
      <div
        className={`w-full min-h-screen bg-[var(--bg-primary)] border-x border-[var(--border-subtle)] flex flex-col relative pb-24 transition-all duration-300 ${
          activeTab === 'market' ? 'max-w-[1100px]' : 'max-w-[500px]'
        }`}
      >
        {/* ======================== STICKY HEADER ======================== */}
        <header
          className={`sticky top-0 z-30 h-14 px-4 flex items-center justify-between border-b border-[var(--border-subtle)] backdrop-blur-md w-full transition-all duration-300`}
          style={{ backgroundColor: 'var(--nav-glass)' }}
        >
          {/* Top-Left: Three-Dot Vertical Menu Button (⋮) */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Buka menu navigasi ⋮"
            className="min-h-[44px] min-w-[44px] -ml-2 rounded-xl flex items-center justify-center text-xl font-bold text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
          >
            <span aria-hidden="true" className="text-xl leading-none select-none">
              ⋮
            </span>
          </button>

          {/* Center: XAU NEWS AI */}
          <button
            type="button"
            onClick={() => handleNavigate('home')}
            className="text-base font-extrabold tracking-wider text-[var(--gold-accent)] cursor-pointer whitespace-nowrap"
          >
            XAU NEWS AI
          </button>

          {/* Right: Notification Bell Quick Button + Live Status Indicator (● LIVE) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleNavigate('notifications')}
              aria-label="Pengaturan Notifikasi"
              className="min-h-[36px] min-w-[36px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--gold-accent)] cursor-pointer"
            >
              {notificationSettings.notificationsEnabled ? (
                <Bell className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4 text-[var(--text-secondary)]" />
              )}
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[11px] font-bold tracking-wider text-[#22C55E] whitespace-nowrap">
              <span className="inline-block w-2 h-2 rounded-full bg-[#22C55E] animate-live-dot" />
              <span>LIVE</span>
            </div>
          </div>
        </header>

        {/* ======================== IN-APP NOTIFICATION PREVIEW / PUSH BANNER ======================== */}
        {activeToast && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-[468px] animate-view-enter">
            <div
              role="status"
              className="rounded-2xl bg-[var(--bg-card)] border-2 border-[var(--gold-accent)] p-4 shadow-2xl space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-[var(--gold-accent)]">
                    {activeToast.title}
                  </span>
                  {activeToast.type === 'TEST_NOTIFICATION' && (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--gold-accent)]/15 text-[var(--gold-accent)] text-[10px] font-mono-num font-bold">
                      PREVIEW TEST
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveToast(null)}
                  aria-label="Tutup notifikasi"
                  className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                <div className="text-base font-extrabold text-[var(--text-primary)]">
                  {activeToast.eventName}
                </div>
                <div className="text-xs font-semibold text-[var(--text-secondary)]">
                  {activeToast.subtitle}
                </div>
                <div className="text-xs font-mono-num text-[var(--gold-accent)] font-bold">
                  {activeToast.releaseTimeWib}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="block text-[10px] text-[var(--text-secondary)]">
                    IMPACT
                  </span>
                  <span className="font-bold text-[#EF4444]">
                    🔴 {activeToast.impactLevel.toUpperCase()} IMPACT
                  </span>
                </div>

                {activeToast.aiPrediction && (
                  <div>
                    <span className="block text-[10px] text-[var(--text-secondary)]">
                      AI Prediction:
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">
                      {activeToast.aiPrediction === 'ABOVE FORECAST'
                        ? '⬆️ ABOVE FORECAST'
                        : activeToast.aiPrediction === 'BELOW FORECAST'
                        ? '⬇️ BELOW FORECAST'
                        : activeToast.aiPrediction === 'AROUND FORECAST'
                        ? '➡️ AROUND FORECAST'
                        : '⚪ INSUFFICIENT EVIDENCE'}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-1.5 flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">
                  Potential XAUUSD Impact:
                </span>
                <span
                  className={`font-extrabold ${
                    activeToast.xauusdImpact === 'POTENTIALLY SUPPORTIVE FOR GOLD'
                      ? 'text-[#22C55E]'
                      : activeToast.xauusdImpact === 'POTENTIALLY NEGATIVE FOR GOLD'
                      ? 'text-[#EF4444]'
                      : 'text-[#F59E0B]'
                  }`}
                >
                  {activeToast.xauusdImpact === 'POTENTIALLY SUPPORTIVE FOR GOLD'
                    ? '🟢 SUPPORTIVE'
                    : activeToast.xauusdImpact === 'POTENTIALLY NEGATIVE FOR GOLD'
                    ? '🔴 NEGATIVE'
                    : '🟡 MIXED'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ======================== THREE-DOT SIDE DRAWER ======================== */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setDrawerOpen(false)}
          >
            <aside
              aria-label="Menu Utama XAU NEWS AI"
              className="w-[280px] max-w-[82vw] h-full bg-[var(--bg-secondary)] border-r border-[var(--border-subtle)] p-5 flex flex-col justify-between shadow-2xl animate-view-enter"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <div>
                    <div className="text-base font-extrabold tracking-wider text-[var(--gold-accent)]">
                      XAU NEWS AI
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      14-Day Forecast & Live Alerts · WIB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Tutup menu"
                    className="min-h-[40px] min-w-[40px] rounded-xl bg-[var(--bg-card)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Drawer Navigation Links */}
                <nav className="space-y-1.5">
                  {[
                    { id: 'home' as ActiveTab, label: '🏠 Home' },
                    { id: 'market' as ActiveTab, label: '📈 Live Market Dashboard' },
                    {
                      id: 'upcoming' as ActiveTab,
                      label: '🔮 Upcoming News',
                      badge: upcomingItems.length,
                    },
                    {
                      id: 'released' as ActiveTab,
                      label: '📋 Released News',
                      badge: releasedItems.length,
                    },
                    { id: 'trading_plan' as ActiveTab, label: '🎯 Trading Plan' },
                    { id: 'accuracy' as ActiveTab, label: '📊 Accuracy' },
                    { id: 'settings' as ActiveTab, label: '⚙️ Settings' },
                    {
                      id: 'notifications' as ActiveTab,
                      label: '   └── 🔔 Notifications',
                      badge: notificationSettings.notificationsEnabled ? 'ON' : 'OFF',
                    },
                    { id: 'about' as ActiveTab, label: 'ℹ️ About' },
                  ].map((navItem) => {
                    const isActive = activeTab === navItem.id;
                    return (
                      <button
                        key={navItem.id}
                        type="button"
                        onClick={() => handleNavigate(navItem.id)}
                        className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[var(--gold-accent)] text-[#070A0F] font-bold'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                        }`}
                      >
                        <span className="whitespace-pre">{navItem.label}</span>
                        {navItem.badge !== undefined && (
                          <span
                            className={`text-xs font-mono-num px-2 py-0.5 rounded-md ${
                              isActive
                                ? 'bg-black/20 text-[#070A0F]'
                                : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {navItem.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Drawer Footer */}
              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2 text-[11px] text-[var(--text-secondary)]">
                <div className="font-mono-num">Timezone: Asia/Jakarta (WIB)</div>
                <div className="font-mono-num truncate">
                  Updated: {formattedLastUpdated}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* ======================== MAIN CONTENT AREA ======================== */}
        <main className="flex-1 px-4 pt-5 space-y-6 animate-view-enter">
          {/* Error Banner if Live Data Unavailable */}
          {errorMsg && (
            <div
              role="alert"
              className="rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-[#EF4444]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Data live tidak tersedia saat ini. Aplikasi tidak menampilkan angka palsu.
              </p>
              <button
                type="button"
                onClick={() => fetchLatestNews(false)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#EF4444] text-white text-xs font-bold cursor-pointer"
              >
                🔄 REFRESH NOW
              </button>
            </div>
          )}

          {/* ======================== 1. HOME DASHBOARD ======================== */}
          {activeTab === 'home' && (
            <div className="space-y-6">
              {/* Top Greeting & Refresh Bar */}
              <section className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                    {greeting}
                  </p>
                  <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] mt-0.5">
                    Market News Intelligence
                  </h1>
                  <p className="text-[11px] font-mono-num text-[var(--text-secondary)] mt-1">
                    LAST UPDATED: {formattedLastUpdated}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => fetchLatestNews(false)}
                  aria-label="Refresh News Now"
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--gold-accent)] text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>REFRESH</span>
                </button>
              </section>

              {/* NEXT HIGH IMPACT NEWS HERO CARD */}
              {nextHighImpactEvent && (
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>NEXT HIGH IMPACT NEWS</span>
                    </span>
                    <span className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                      Asia/Jakarta (WIB)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedItem(nextHighImpactEvent)}
                    className="w-full text-left rounded-3xl p-5 border border-[var(--border-gold)] transition-all active:scale-[0.985] cursor-pointer relative overflow-hidden"
                    style={{
                      background:
                        'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
                      boxShadow: '0 12px 32px -10px rgba(212, 175, 55, 0.18)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-wider ${
                          nextHighImpactEvent.impactLevel === 'High'
                            ? 'text-[#EF4444] bg-[#EF4444]/15 border-[#EF4444]/35'
                            : 'text-[#F59E0B] bg-[#F59E0B]/15 border-[#F59E0B]/35'
                        }`}
                      >
                        {nextHighImpactEvent.impactLevel.toUpperCase()} IMPACT
                      </span>

                      <span className="text-xs font-mono-num font-semibold text-[var(--gold-accent)]">
                        {formatWibShortDate(
                          nextHighImpactEvent.releaseTimeIso,
                          nextHighImpactEvent.releaseTime
                        )}{' '}
                        ·{' '}
                        {formatWibShortTime(
                          nextHighImpactEvent.releaseTimeIso,
                          nextHighImpactEvent.releaseTime
                        )}
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-xl font-extrabold text-[var(--text-primary)] leading-snug mb-4">
                      {nextHighImpactEvent.eventName}
                    </h2>

                    {/* Live Countdown Box */}
                    <div className="rounded-2xl bg-[var(--bg-primary)]/70 border border-[var(--border-gold)] p-3.5 mb-3.5 flex items-center justify-between">
                      <div>
                        <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] uppercase">
                          COUNTDOWN MENUJU RILIS
                        </span>
                        <span className="font-mono-num text-xl font-extrabold text-[var(--gold-accent)] tracking-tight">
                          ⏱ {formatCountdown(nextHighImpactEvent.releaseTimeIso, nowMs)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] uppercase">
                          AI PRE-RELEASE
                        </span>
                        <span className="text-xs font-extrabold text-[var(--text-primary)]">
                          {nextHighImpactEvent.aiPrediction === 'ABOVE FORECAST'
                            ? '⬆️ ABOVE FORECAST'
                            : nextHighImpactEvent.aiPrediction === 'BELOW FORECAST'
                            ? '⬇️ BELOW FORECAST'
                            : nextHighImpactEvent.aiPrediction === 'AROUND FORECAST'
                            ? '➡️ AROUND FORECAST'
                            : '⚪ INSUFFICIENT EVIDENCE'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                      <span>
                        Forecast:{' '}
                        <strong className="text-[var(--text-primary)] font-mono-num">
                          {nextHighImpactEvent.forecast}
                        </strong>{' '}
                        · Prev:{' '}
                        <strong className="text-[var(--text-primary)] font-mono-num">
                          {nextHighImpactEvent.previous}
                        </strong>
                      </span>
                      <span className="text-[var(--gold-accent)] font-bold inline-flex items-center gap-1">
                        <span>Detail</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                </section>
              )}

              {/* UPCOMING 14-DAY PREVIEW */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold tracking-wider text-[var(--text-secondary)] uppercase">
                    NEXT 14 DAYS UPCOMING ({upcomingItems.length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleNavigate('upcoming')}
                    className="text-xs font-bold text-[var(--gold-accent)] inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>VIEW 14-DAY FORECAST</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {upcomingItems.slice(0, 3).map((item) => {
                    const uniqueRemKey = makeNotificationUniqueId(
                      item.id,
                      'UPCOMING_REMINDER',
                      item.releaseTimeIso
                    );
                    return (
                      <NewsCard
                        key={item.id}
                        item={item}
                        nowMs={nowMs}
                        notificationSettings={notificationSettings}
                        eventOverride={eventOverrides[item.id]}
                        isNotificationSent={Boolean(sentNotificationIds[uniqueRemKey])}
                        onSelect={setSelectedItem}
                      />
                    );
                  })}
                </div>
              </section>

              {/* RECENTLY RELEASED (Max 3) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold tracking-wider text-[var(--text-secondary)] uppercase">
                    RECENTLY RELEASED
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleNavigate('released')}
                    className="text-xs font-bold text-[var(--gold-accent)] inline-flex items-center gap-1 hover:underline cursor-pointer"
                  >
                    <span>VIEW ALL</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {releasedItems.slice(0, 3).map((item) => (
                    <NewsCard
                      key={item.id}
                      item={item}
                      nowMs={nowMs}
                      notificationSettings={notificationSettings}
                      eventOverride={eventOverrides[item.id]}
                      onSelect={setSelectedItem}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigate('released')}
                  className="w-full min-h-[46px] rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-gold)] text-xs font-bold text-[var(--gold-accent)] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>VIEW ALL RELEASED NEWS ({releasedItems.length})</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </section>
            </div>
          )}

          {/* ======================== LIVE MARKET DASHBOARD ======================== */}
          {activeTab === 'market' && (
            <LiveMarketDashboard
              newsItems={currentBatch?.newsItems || []}
              onSelectNewsItem={(item) => setSelectedItem(item)}
            />
          )}

          {/* ======================== 2. UPCOMING NEWS: 14-DAY ECONOMIC NEWS FORECAST ======================== */}
          {activeTab === 'upcoming' && (
            <div className="space-y-5">
              {/* Header: NEXT 14 DAYS + 🔄 REFRESH FORECAST + LAST UPDATED */}
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-[var(--gold-accent)] text-[#070A0F] text-[10px] font-extrabold tracking-widest uppercase">
                      NEXT 14 DAYS
                    </span>
                    <h1 className="text-xl font-extrabold text-[var(--text-primary)] mt-1.5">
                      🔮 14-Day Economic News Forecast
                    </h1>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      TODAY + 14 hari ke depan · Timezone Asia/Jakarta (WIB)
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => fetchLatestNews(false)}
                    className="min-h-[42px] px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] text-[var(--gold-accent)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>🔄 REFRESH FORECAST</span>
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono-num text-[var(--text-secondary)] pt-2 border-t border-[var(--border-subtle)]">
                  <span>LAST UPDATED: {formattedLastUpdated}</span>
                  <span className="text-[var(--gold-accent)] font-bold">
                    {filteredUpcomingItems.length} Events
                  </span>
                </div>

                {/* Impact Filter Bar: ALL | HIGH IMPACT | MEDIUM | LOW */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { id: 'ALL' as ImpactFilterTab, label: 'ALL' },
                    { id: 'HIGH' as ImpactFilterTab, label: 'HIGH IMPACT' },
                    { id: 'MEDIUM' as ImpactFilterTab, label: 'MEDIUM' },
                    { id: 'LOW' as ImpactFilterTab, label: 'LOW' },
                  ].map((tab) => {
                    const active = upcomingImpactFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setUpcomingImpactFilter(tab.id)}
                        className={`min-h-[38px] px-2 py-1.5 rounded-xl border text-[11px] font-extrabold tracking-wide transition-colors cursor-pointer ${
                          active
                            ? 'bg-[var(--gold-accent)] text-[#070A0F] border-[var(--gold-accent)]'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {upcomingGroups.length === 0 ? (
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-secondary)]">
                  Tidak ada jadwal Upcoming untuk filter ini dalam 14 hari ke depan.
                </div>
              ) : (
                upcomingGroups.map((group) => (
                  <section key={group.dateKey} className="space-y-3">
                    {/* Group By Date Header: TODAY / TOMORROW / THURSDAY + Hari, DD Bulan YYYY */}
                    <div className="sticky top-14 z-10 py-2 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] flex items-center justify-between shadow-md">
                      <div>
                        <div className="text-[10px] font-mono-num font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                          {group.dayBadge}
                        </div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          {group.fullDateId}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono-num px-2.5 py-1 rounded-lg bg-[var(--bg-card)] text-[var(--gold-accent)] font-bold">
                        {group.items.length} Event
                      </span>
                    </div>

                    <div className="space-y-3">
                      {group.items.map((item) => {
                        const uniqueRemKey = makeNotificationUniqueId(
                          item.id,
                          'UPCOMING_REMINDER',
                          item.releaseTimeIso
                        );
                        return (
                          <NewsCard
                            key={item.id}
                            item={item}
                            nowMs={nowMs}
                            notificationSettings={notificationSettings}
                            eventOverride={eventOverrides[item.id]}
                            isNotificationSent={Boolean(sentNotificationIds[uniqueRemKey])}
                            onSelect={setSelectedItem}
                          />
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}

          {/* ======================== 3. RELEASED NEWS (STRICTLY SEPARATED & GROUPED BY WIB DATE) ======================== */}
          {activeTab === 'released' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-extrabold tracking-wider text-[#22C55E] uppercase">
                    REAL-TIME ACTUAL & VERIFICATION
                  </span>
                  <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
                    📋 Released News
                  </h1>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Hanya menampilkan event yang sudah melewati waktu rilis · Dikelompokkan per hari (WIB)
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => fetchLatestNews(false)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--gold-accent)] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>REFRESH</span>
                </button>
              </div>

              {releasedGroups.length === 0 ? (
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 text-center text-sm text-[var(--text-secondary)]">
                  Belum ada rilis berita ekonomi.
                </div>
              ) : (
                releasedGroups.map((group) => (
                  <section key={group.dateKey} className="space-y-3">
                    <div className="sticky top-14 z-10 py-2 px-3.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-mono-num font-extrabold tracking-widest text-[#22C55E] uppercase">
                          {group.dayBadge}
                        </div>
                        <div className="text-xs font-bold text-[var(--text-primary)]">
                          {group.fullDateId}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                        {group.items.length} Event
                      </span>
                    </div>

                    <div className="space-y-3">
                      {group.items.map((item) => (
                        <NewsCard
                          key={item.id}
                          item={item}
                          nowMs={nowMs}
                          notificationSettings={notificationSettings}
                          eventOverride={eventOverrides[item.id]}
                          onSelect={setSelectedItem}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </div>
          )}

          {/* ======================== 4. ACCURACY & PREDICTION VERIFICATION ======================== */}
          {activeTab === 'accuracy' && (
            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                  PRE-RELEASE VS ACTUAL
                </span>
                <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
                  📊 Prediction Accuracy
                </h1>
                <p className="text-xs text-[var(--text-secondary)]">
                  Perbandingan AI Pre-Release Prediction yang dikunci sebelum rilis terhadap realisasi Actual resmi.
                </p>
              </div>

              {/* Summary Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4">
                  <span className="text-[11px] font-bold text-[#22C55E]">
                    ✅ CORRECT DIRECTION
                  </span>
                  <div className="font-mono-num text-2xl font-extrabold mt-1">
                    {accuracyStats.correct}
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4">
                  <span className="text-[11px] font-bold text-[#F59E0B]">
                    ➖ NEAR FORECAST
                  </span>
                  <div className="font-mono-num text-2xl font-extrabold mt-1">
                    {accuracyStats.near}
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4">
                  <span className="text-[11px] font-bold text-[#EF4444]">
                    ❌ INCORRECT DIRECTION
                  </span>
                  <div className="font-mono-num text-2xl font-extrabold mt-1">
                    {accuracyStats.incorrect}
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4">
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                    ⚪ UNABLE TO VERIFY
                  </span>
                  <div className="font-mono-num text-2xl font-extrabold mt-1">
                    {accuracyStats.pending}
                  </div>
                </div>
              </div>

              {/* Locked Pre-Release Vault List */}
              <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--gold-accent)] inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      LOCKED PRE-RELEASE PREDICTIONS ({Object.keys(preReleaseVault).length})
                    </span>
                  </span>
                </div>

                <div className="space-y-2.5">
                  {Object.values(preReleaseVault).map((lp) => (
                    <div
                      key={lp.eventKey}
                      className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 text-xs space-y-1"
                    >
                      <div className="font-bold text-[var(--text-primary)]">
                        {lp.eventName}
                      </div>
                      <div className="font-mono-num text-[11px] text-[var(--text-secondary)]">
                        Release: {lp.releaseTime} · Forecast: {lp.consensusForecast} · Prev:{' '}
                        {lp.previous}
                      </div>
                      <div className="text-[var(--gold-accent)] font-bold">
                        Locked Prediction: {lp.aiPrediction} (Confidence: {lp.aiConfidence})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ======================== TRADING PLAN ======================== */}
          {activeTab === 'trading_plan' && (
            <TradingPlan />
          )}

          {/* ======================== 5. SETTINGS ======================== */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                  PREFERENCES & CONFIGURATION
                </span>
                <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
                  ⚙️ Settings
                </h1>
              </div>

              {/* Submenu Link: ⚙️ SETTINGS └── 🔔 NOTIFICATIONS */}
              <button
                type="button"
                onClick={() => handleNavigate('notifications')}
                className="w-full rounded-2xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-4 flex items-center justify-between text-left transition-transform active:scale-[0.99] cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--gold-accent)]/15 border border-[var(--border-gold)] flex items-center justify-center text-[var(--gold-accent)]">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold text-[var(--text-primary)]">
                      🔔 NOTIFICATIONS
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Push Alerts · {notificationSettings.notificationLeadTime}m before news ·{' '}
                      {notificationSettings.notificationsEnabled ? 'ON' : 'OFF'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[var(--gold-accent)]" />
              </button>

              {/* Central API Configuration & Health Status Card */}
              <ApiStatusCard />

              {/* APPEARANCE -> Theme */}
              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
                <div>
                  <span className="text-[10px] font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                    APPEARANCE
                  </span>
                  <h2 className="text-base font-bold text-[var(--text-primary)] mt-0.5">
                    Theme
                  </h2>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      id: 'dark' as ThemeMode,
                      label: 'Dark',
                      desc: 'Default Premium Dark (#070A0F)',
                    },
                    {
                      id: 'light' as ThemeMode,
                      label: 'Light',
                      desc: 'Premium Financial Light (#F6F7F9)',
                    },
                    {
                      id: 'system' as ThemeMode,
                      label: 'System',
                      desc: 'Ikuti pengaturan perangkat',
                    },
                  ].map((opt) => {
                    const selected = themeMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setThemeMode(opt.id)}
                        className={`w-full min-h-[48px] px-4 py-3 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[var(--bg-secondary)] border-[var(--border-gold)]'
                            : 'bg-[var(--bg-secondary)]/40 border-[var(--border-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold text-[var(--gold-accent)]">
                            {selected ? '●' : '○'}
                          </span>
                          <div>
                            <div className="text-sm font-bold text-[var(--text-primary)]">
                              {opt.label}
                            </div>
                            <div className="text-[11px] text-[var(--text-secondary)]">
                              {opt.desc}
                            </div>
                          </div>
                        </div>
                        {selected && (
                          <CheckCircle2 className="w-4 h-4 text-[var(--gold-accent)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* TIMEZONE & NEWS REFRESH SETTINGS */}
              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
                {/* Timezone */}
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      Timezone
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Zona waktu seluruh jadwal & rilis berita
                    </div>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] text-xs font-mono-num font-bold text-[var(--gold-accent)]">
                    Asia/Jakarta (WIB)
                  </span>
                </div>

                {/* Auto Refresh ON / OFF */}
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      Auto Refresh
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Perbarui status Upcoming & Actual secara otomatis
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setAutoRefreshEnabled(true)}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        autoRefreshEnabled
                          ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoRefreshEnabled(false)}
                      className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        !autoRefreshEnabled
                          ? 'bg-[#EF4444] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>

                {/* News Refresh Interval */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      News Refresh Interval
                    </span>
                    <span className="text-xs font-mono-num text-[var(--gold-accent)]">
                      {refreshIntervalSec === 30
                        ? '30 seconds'
                        : refreshIntervalSec === 60
                        ? '1 minute (Default)'
                        : '5 minutes'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { sec: 30 as RefreshIntervalOption, label: '30 seconds' },
                      { sec: 60 as RefreshIntervalOption, label: '1 minute' },
                      { sec: 300 as RefreshIntervalOption, label: '5 minutes' },
                    ].map((opt) => (
                      <button
                        key={opt.sec}
                        type="button"
                        onClick={() => setRefreshIntervalSec(opt.sec)}
                        className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                          refreshIntervalSec === opt.sec
                            ? 'bg-[var(--gold-accent)] text-[#070A0F] border-[var(--gold-accent)]'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Manual Refresh & Last Updated */}
              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] font-mono-num">
                  <span>LAST UPDATED:</span>
                  <span className="text-[var(--gold-accent)] font-bold">
                    {formattedLastUpdated}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => fetchLatestNews(false)}
                  className="w-full min-h-[48px] rounded-xl bg-[var(--gold-accent)] text-[#070A0F] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>🔄 REFRESH NOW</span>
                </button>
              </section>
            </div>
          )}

          {/* ======================== 6. NOTIFICATIONS SETTINGS SCREEN ======================== */}
          {activeTab === 'notifications' && (
            <div className="space-y-5 animate-view-enter">
              {/* Top Back Header: ← NOTIFICATIONS */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleNavigate('settings')}
                  className="min-h-[42px] px-3 py-1.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] inline-flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-[var(--gold-accent)]" />
                  <span>NOTIFICATIONS</span>
                </button>
                <span className="text-[11px] font-mono-num text-[var(--gold-accent)] font-bold">
                  Asia/Jakarta (WIB)
                </span>
              </div>

              {/* Permission Denied Warning Box (if browser permission is denied) */}
              {browserPermission === 'denied' && (
                <div className="rounded-2xl bg-[#EF4444]/12 border border-[#EF4444]/35 p-4 space-y-3">
                  <div className="flex items-start gap-2.5 text-xs text-[#EF4444] font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Notifications are disabled in your device/browser settings.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPermissionHelpModal(true)}
                    className="w-full min-h-[40px] rounded-xl bg-[#EF4444] text-white text-xs font-bold cursor-pointer"
                  >
                    [ OPEN NOTIFICATION SETTINGS ]
                  </button>
                </div>
              )}

              {/* GENERAL: Push Notifications [ ON / OFF ] */}
              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-5 space-y-4">
                <div className="text-[10px] font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                  GENERAL
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {notificationSettings.notificationsEnabled ? (
                      <Bell className="w-5 h-5 text-[var(--gold-accent)]" />
                    ) : (
                      <BellOff className="w-5 h-5 text-[var(--text-secondary)]" />
                    )}
                    <div>
                      <div className="text-sm font-extrabold text-[var(--text-primary)]">
                        Push Notifications
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {notificationSettings.notificationsEnabled
                          ? '🔔 Notification ON (Active)'
                          : '🔕 Notification OFF (All alerts disabled)'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => handleToggleMasterNotifications(true)}
                      className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        notificationSettings.notificationsEnabled
                          ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      ON
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleMasterNotifications(false)}
                      className={`min-h-[36px] px-3.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        !notificationSettings.notificationsEnabled
                          ? 'bg-[#EF4444] text-white'
                          : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      OFF
                    </button>
                  </div>
                </div>
              </section>

              {/* Show detailed settings only when Push Notifications is ON */}
              {notificationSettings.notificationsEnabled && (
                <>
                  {/* 2. NOTIFY BEFORE NEWS (Radio options: 60, 30 default, 15, 10, 5 minutes) */}
                  <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                          NOTIFY BEFORE NEWS
                        </span>
                        <h2 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                          Waktu Notifikasi Sebelum Rilis (WIB)
                        </h2>
                      </div>
                      <span className="text-xs font-mono-num text-[var(--gold-accent)] font-bold">
                        {notificationSettings.notificationLeadTime}m before
                      </span>
                    </div>

                    <div className="space-y-2">
                      {(
                        [
                          { mins: 60 as NotificationLeadTimeOption, example: '18:30 WIB' },
                          {
                            mins: 30 as NotificationLeadTimeOption,
                            example: '19:00 WIB (Default)',
                          },
                          { mins: 15 as NotificationLeadTimeOption, example: '19:15 WIB' },
                          { mins: 10 as NotificationLeadTimeOption, example: '19:20 WIB' },
                          { mins: 5 as NotificationLeadTimeOption, example: '19:25 WIB' },
                        ] as const
                      ).map((opt) => {
                        const selected =
                          notificationSettings.notificationLeadTime === opt.mins;
                        return (
                          <button
                            key={opt.mins}
                            type="button"
                            onClick={() =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                notificationLeadTime: opt.mins,
                              }))
                            }
                            className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer ${
                              selected
                                ? 'bg-[var(--bg-secondary)] border-[var(--border-gold)]'
                                : 'bg-[var(--bg-secondary)]/40 border-[var(--border-subtle)]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base font-bold text-[var(--gold-accent)]">
                                {selected ? '●' : '○'}
                              </span>
                              <span className="text-sm font-bold text-[var(--text-primary)]">
                                {opt.mins} minutes before
                              </span>
                            </div>
                            <span className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                              e.g. 19:30 → {opt.example}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* 3, 4, 5. NEWS IMPACT (High Impact ON, Medium OFF, Low OFF) */}
                  <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
                    <div className="text-[10px] font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                      NEWS IMPACT
                    </div>

                    {[
                      {
                        key: 'highImpactEnabled' as const,
                        label: 'HIGH IMPACT NEWS',
                        badgeCls: 'text-[#EF4444]',
                        value: notificationSettings.highImpactEnabled,
                      },
                      {
                        key: 'mediumImpactEnabled' as const,
                        label: 'MEDIUM IMPACT NEWS',
                        badgeCls: 'text-[#F59E0B]',
                        value: notificationSettings.mediumImpactEnabled,
                      },
                      {
                        key: 'lowImpactEnabled' as const,
                        label: 'LOW IMPACT NEWS',
                        badgeCls: 'text-[#3B82F6]',
                        value: notificationSettings.lowImpactEnabled,
                      },
                    ].map((row) => (
                      <div
                        key={row.key}
                        className="flex items-center justify-between pb-3 last:pb-0 border-b last:border-b-0 border-[var(--border-subtle)]"
                      >
                        <span className={`text-xs font-extrabold ${row.badgeCls}`}>
                          {row.label}
                        </span>
                        <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
                          <button
                            type="button"
                            onClick={() =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                [row.key]: true,
                              }))
                            }
                            className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                              row.value
                                ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            ON
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setNotificationSettings((prev) => ({
                                ...prev,
                                [row.key]: false,
                              }))
                            }
                            className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                              !row.value
                                ? 'bg-[#EF4444] text-white'
                                : 'text-[var(--text-secondary)]'
                            }`}
                          >
                            OFF
                          </button>
                        </div>
                      </div>
                    ))}
                  </section>

                  {/* 6 & 7. EVENTS: ACTUAL RELEASED & AI PREDICTION UPDATED */}
                  <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
                    <div className="text-[10px] font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                      EVENTS
                    </div>

                    {/* ACTUAL RELEASED */}
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                      <div>
                        <div className="text-xs font-extrabold text-[var(--text-primary)]">
                          ACTUAL RELEASED
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          Kirim notifikasi saat angka Actual resmi tersedia
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              actualReleasedEnabled: true,
                            }))
                          }
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            notificationSettings.actualReleasedEnabled
                              ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          ON
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              actualReleasedEnabled: false,
                            }))
                          }
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            !notificationSettings.actualReleasedEnabled
                              ? 'bg-[#EF4444] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          OFF
                        </button>
                      </div>
                    </div>

                    {/* AI PREDICTION UPDATED */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-extrabold text-[var(--text-primary)]">
                          AI PREDICTION UPDATED
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          Notifikasi jika reassessment mengubah arah prediksi
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              aiPredictionChangedEnabled: true,
                            }))
                          }
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            notificationSettings.aiPredictionChangedEnabled
                              ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          ON
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              aiPredictionChangedEnabled: false,
                            }))
                          }
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            !notificationSettings.aiPredictionChangedEnabled
                              ? 'bg-[#EF4444] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          OFF
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* 10. NOTIFICATION TYPES CHECKBOX MATRIX */}
                  <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3">
                    <div className="text-[10px] font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                      NOTIFICATION TYPES
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        {
                          key: 'upcomingNewsEnabled' as const,
                          label: 'Upcoming News',
                          checked: notificationSettings.upcomingNewsEnabled,
                        },
                        {
                          key: 'actualReleasedEnabled' as const,
                          label: 'Actual Released',
                          checked: notificationSettings.actualReleasedEnabled,
                        },
                        {
                          key: 'aiPredictionChangedEnabled' as const,
                          label: 'AI Prediction Changed',
                          checked: notificationSettings.aiPredictionChangedEnabled,
                        },
                        {
                          key: 'highImpactEnabled' as const,
                          label: 'High Impact',
                          checked: notificationSettings.highImpactEnabled,
                        },
                        {
                          key: 'mediumImpactEnabled' as const,
                          label: 'Medium Impact',
                          checked: notificationSettings.mediumImpactEnabled,
                        },
                        {
                          key: 'lowImpactEnabled' as const,
                          label: 'Low Impact',
                          checked: notificationSettings.lowImpactEnabled,
                        },
                      ].map((box) => (
                        <button
                          key={box.key}
                          type="button"
                          onClick={() =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              [box.key]: !prev[box.key],
                            }))
                          }
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-xs font-bold text-[var(--text-primary)] cursor-pointer"
                        >
                          {box.checked ? (
                            <CheckSquare className="w-4 h-4 text-[var(--gold-accent)] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                          )}
                          <span>{box.label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* 8 & 9. ALERT: VIBRATION & SOUND */}
                  <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
                    <div className="text-[10px] font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
                      ALERT
                    </div>

                    {/* VIBRATION */}
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2.5">
                        <Vibrate className="w-4 h-4 text-[var(--gold-accent)]" />
                        <div>
                          <div className="text-xs font-extrabold text-[var(--text-primary)]">
                            VIBRATION
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            Getar singkat saat notifikasi diterima
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() => {
                            triggerDeviceVibration(true);
                            setNotificationSettings((prev) => ({
                              ...prev,
                              vibrationEnabled: true,
                            }));
                          }}
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            notificationSettings.vibrationEnabled
                              ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          ON
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              vibrationEnabled: false,
                            }))
                          }
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            !notificationSettings.vibrationEnabled
                              ? 'bg-[#EF4444] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          OFF
                        </button>
                      </div>
                    </div>

                    {/* SOUND */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Volume2 className="w-4 h-4 text-[var(--gold-accent)]" />
                        <div>
                          <div className="text-xs font-extrabold text-[var(--text-primary)]">
                            SOUND
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            Suara notifikasi perangkat/browser
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() => {
                            playSubtleNotificationChime();
                            setNotificationSettings((prev) => ({
                              ...prev,
                              soundEnabled: true,
                            }));
                          }}
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            notificationSettings.soundEnabled
                              ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          ON
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setNotificationSettings((prev) => ({
                              ...prev,
                              soundEnabled: false,
                            }))
                          }
                          className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                            !notificationSettings.soundEnabled
                              ? 'bg-[#EF4444] text-white'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          OFF
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* 11. NOTIFICATION PREVIEW: [ TEST NOTIFICATION ] */}
                  <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--gold-accent)]">
                        NOTIFICATION PREVIEW
                      </span>
                      <span className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                        Testing Only
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Tekan tombol di bawah untuk menguji tampilan, suara, dan getaran notifikasi XAU NEWS AI (US CPI · 19:30 WIB).
                    </p>
                    <button
                      type="button"
                      onClick={handleSendTestNotification}
                      className="w-full min-h-[48px] rounded-xl bg-[var(--gold-accent)] text-[#070A0F] font-extrabold text-xs tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-98 cursor-pointer"
                    >
                      <Bell className="w-4 h-4" />
                      <span>[ TEST NOTIFICATION ]</span>
                    </button>
                  </section>
                </>
              )}
            </div>
          )}

          {/* ======================== 7. ABOUT ======================== */}
          {activeTab === 'about' && (
            <div className="space-y-5">
              <div>
                <span className="text-[11px] font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                  SYSTEM INTELLIGENCE & SOURCES
                </span>
                <h1 className="text-xl font-extrabold text-[var(--text-primary)]">
                  ℹ️ About XAU NEWS AI
                </h1>
              </div>

              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3 text-sm text-[var(--text-primary)] leading-relaxed">
                <p>
                  <strong>XAU NEWS AI</strong> adalah aplikasi analisis dampak berita makroekonomi Amerika Serikat terhadap <strong>XAUUSD (Gold)</strong>.
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Aplikasi ini menyediakan jadwal <strong>14-Day Economic News Forecast (UPCOMING)</strong> dan <strong>RELEASED</strong> dalam zona waktu <strong>Asia/Jakarta (WIB)</strong>, lengkap dengan sistem Push Notification otomatis.
                </p>
              </section>

              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3">
                <h2 className="text-sm font-bold text-[var(--gold-accent)]">
                  6 Sumber Resmi & Konteks Berita Utama
                </h2>
                <div className="space-y-2">
                  {VERIFIED_PRIMARY_SOURCES.map((s) => (
                    <a
                      key={s.id}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-[var(--text-primary)]">
                          {s.id}. {s.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)]">
                          {s.desc}
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-[var(--gold-accent)] shrink-0" />
                    </a>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 text-xs text-[var(--text-secondary)] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--gold-accent)] shrink-0 mt-0.5" />
                <span>
                  Aplikasi ini tidak melakukan analisis chart/teknikal dan tidak memberikan sinyal BUY/SELL, ENTRY, STOP LOSS, atau TAKE PROFIT.
                </span>
              </section>
            </div>
          )}
        </main>

        {/* ======================== STICKY BOTTOM NAVIGATION ======================== */}
        <nav
          aria-label="Navigasi Bawah"
          className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full z-30 h-16 px-1 border-t border-[var(--border-subtle)] backdrop-blur-md grid grid-cols-6 items-center transition-all duration-300 ${
            activeTab === 'market' ? 'max-w-[1100px]' : 'max-w-[500px]'
          }`}
          style={{ backgroundColor: 'var(--nav-glass)' }}
        >
          {[
            { id: 'home' as ActiveTab, icon: '🏠', label: 'Home' },
            { id: 'market' as ActiveTab, icon: '📈', label: 'Market' },
            { id: 'upcoming' as ActiveTab, icon: '🔮', label: 'Upcoming' },
            { id: 'released' as ActiveTab, icon: '📋', label: 'Released' },
            { id: 'trading_plan' as ActiveTab, icon: '🎯', label: 'Plan' },
            { id: 'settings' as ActiveTab, icon: '⚙️', label: 'Settings' },
          ].map((tab) => {
            const isActive =
              activeTab === tab.id ||
              (tab.id === 'settings' && activeTab === 'notifications');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleNavigate(tab.id)}
                className={`h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[var(--gold-accent)] font-extrabold'
                    : 'text-[var(--text-secondary)] font-medium'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="text-[10px] tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* ======================== NEWS DETAIL BOTTOM SHEET ======================== */}
        <NewsDetailSheet
          item={selectedItem}
          nowMs={nowMs}
          notificationSettings={notificationSettings}
          eventOverride={selectedItem ? eventOverrides[selectedItem.id] : undefined}
          isNotificationSent={
            selectedItem
              ? Boolean(
                  sentNotificationIds[
                    makeNotificationUniqueId(
                      selectedItem.id,
                      'UPCOMING_REMINDER',
                      selectedItem.releaseTimeIso
                    )
                  ]
                )
              : false
          }
          onUpdateEventOverride={handleUpdateEventOverride}
          onClose={() => setSelectedItem(null)}
        />

        {/* ======================== PERMISSION HELP MODAL ======================== */}
        {showPermissionHelpModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
            onClick={() => setShowPermissionHelpModal(false)}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-5 space-y-3 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-sm font-extrabold text-[var(--gold-accent)]">
                Cara Mengaktifkan Izin Notifikasi Browser/HP
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                1. Ketuk ikon kunci/pengaturan di sebelah kiri address bar browser Anda.
                <br />
                2. Pilih menu <strong>Permissions / Notifications</strong>.
                <br />
                3. Ubah status menjadi <strong>Allow (Izinkan)</strong> lalu muat ulang halaman.
              </p>
              <button
                type="button"
                onClick={() => setShowPermissionHelpModal(false)}
                className="w-full min-h-[40px] rounded-xl bg-[var(--gold-accent)] text-[#070A0F] font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
