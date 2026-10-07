import React, { useState, useRef } from 'react';
import {
  X,
  ExternalLink,
  Clock,
  ShieldCheck,
  Lock,
  Hourglass,
  Database,
  Bell,
  BellOff,
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import {
  ActualSurpriseDirection,
  calculateNotificationWibTime,
  DEFAULT_NOTIFICATION_SETTINGS,
  EconomicNewsItem,
  EvidenceStrengthLevel,
  EventNotificationOverride,
  formatCountdown,
  formatWibDateGroupParts,
  formatWibShortTime,
  GroundingSource,
  KeyFactorItem,
  NotificationLeadTimeOption,
  NotificationSettings,
  SurprisePredictionDirection,
} from '../types';

interface NewsDetailSheetProps {
  item: EconomicNewsItem | null;
  nowMs: number;
  notificationSettings?: NotificationSettings;
  eventOverride?: EventNotificationOverride;
  isNotificationSent?: boolean;
  onUpdateEventOverride?: (
    eventId: string,
    override: EventNotificationOverride
  ) => void;
  onClose: () => void;
}

const LEAD_TIME_OPTIONS: NotificationLeadTimeOption[] = [60, 30, 15, 10, 5];

export const NewsDetailSheet: React.FC<NewsDetailSheetProps> = ({
  item,
  nowMs,
  notificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  eventOverride,
  isNotificationSent,
  onUpdateEventOverride,
  onClose,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [selectedSourceIdx, setSelectedSourceIdx] = useState<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  if (!item) return null;

  const triggerSmoothClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setAnalysisExpanded(false);
      setSelectedSourceIdx(null);
      onClose();
    }, 210);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (deltaY > 75) {
      triggerSmoothClose();
    }
    touchStartYRef.current = null;
  };

  const isUpcoming = item.status === 'UPCOMING';
  const isReleased = item.status === 'RELEASED';
  const hasActual =
    isReleased &&
    item.actualAvailable &&
    item.actual !== 'Tidak tersedia' &&
    item.actual !== 'Data unavailable' &&
    !item.actual.includes('WAITING');

  // Determine per-event notification state
  const globalImpactAllowed =
    (item.impactLevel === 'High' && notificationSettings.highImpactEnabled) ||
    (item.impactLevel === 'Medium' && notificationSettings.mediumImpactEnabled) ||
    (item.impactLevel === 'Low' && notificationSettings.lowImpactEnabled);

  const notifyMeEnabled = eventOverride
    ? eventOverride.enabled
    : notificationSettings.notificationsEnabled &&
      notificationSettings.upcomingNewsEnabled &&
      globalImpactAllowed;

  const activeLeadTime: NotificationLeadTimeOption =
    eventOverride?.leadTimeMinutes || notificationSettings.notificationLeadTime || 30;

  const scheduleCalc = calculateNotificationWibTime(
    item.releaseTimeIso,
    activeLeadTime
  );

  const dateParts = formatWibDateGroupParts(item.releaseTimeIso);
  const shortTimeWib = formatWibShortTime(item.releaseTimeIso, item.releaseTime);

  const getImpactStyle = (level: EconomicNewsItem['impactLevel']) => {
    if (level === 'High') {
      return {
        label: '🔴 HIGH IMPACT',
        cls: 'text-[#EF4444] bg-[#EF4444]/12 border-[#EF4444]/30',
      };
    }
    if (level === 'Medium') {
      return {
        label: '🟡 MEDIUM IMPACT',
        cls: 'text-[#F59E0B] bg-[#F59E0B]/12 border-[#F59E0B]/30',
      };
    }
    return {
      label: '🔵 LOW IMPACT',
      cls: 'text-[#3B82F6] bg-[#3B82F6]/12 border-[#3B82F6]/30',
    };
  };

  const getPredictionLabel = (
    pred?: SurprisePredictionDirection | ActualSurpriseDirection
  ) => {
    switch (pred) {
      case 'ABOVE FORECAST':
        return '⬆️ ABOVE FORECAST';
      case 'AROUND FORECAST':
        return '➡️ AROUND FORECAST';
      case 'BELOW FORECAST':
        return '⬇️ BELOW FORECAST';
      case 'WAITING FOR RELEASE':
        return '⏳ WAITING FOR RELEASE';
      default:
        return '⚪ INSUFFICIENT EVIDENCE';
    }
  };

  const getEvidenceStrengthDisplay = (strength?: EvidenceStrengthLevel) => {
    switch (strength) {
      case 'STRONG':
        return {
          text: '🟢 STRONG',
          cls: 'text-[#22C55E] bg-[#22C55E]/12 border-[#22C55E]/30',
        };
      case 'MODERATE':
        return {
          text: '🟡 MODERATE',
          cls: 'text-[#F59E0B] bg-[#F59E0B]/12 border-[#F59E0B]/30',
        };
      default:
        return {
          text: '🔴 WEAK',
          cls: 'text-[#EF4444] bg-[#EF4444]/12 border-[#EF4444]/30',
        };
    }
  };

  const getFactorDot = (sig: KeyFactorItem['signal']) => {
    if (sig === 'POSITIVE') return '🟢';
    if (sig === 'NEGATIVE') return '🔴';
    return '🟡';
  };

  const getXauBadge = (
    impact: EconomicNewsItem['xauusdImpact'],
    releasedLayout = false
  ) => {
    switch (impact) {
      case 'POTENTIALLY SUPPORTIVE FOR GOLD':
        return {
          text: releasedLayout ? '🟢 SUPPORTIVE' : '🟢 POTENTIALLY SUPPORTIVE',
          cls: 'text-[#22C55E] bg-[#22C55E]/12 border-[#22C55E]/30',
        };
      case 'POTENTIALLY NEGATIVE FOR GOLD':
        return {
          text: releasedLayout ? '🔴 NEGATIVE' : '🔴 POTENTIALLY NEGATIVE',
          cls: 'text-[#EF4444] bg-[#EF4444]/12 border-[#EF4444]/30',
        };
      default:
        return {
          text: releasedLayout ? '🟡 MIXED' : '🟡 NEUTRAL / MIXED',
          cls: 'text-[#F59E0B] bg-[#F59E0B]/12 border-[#F59E0B]/30',
        };
    }
  };

  const getVerifText = (res?: EconomicNewsItem['verificationResult']) => {
    if (res === 'CORRECT DIRECTION') return '✅ CORRECT DIRECTION';
    if (res === 'INCORRECT DIRECTION') return '❌ INCORRECT DIRECTION';
    if (res === 'NEAR FORECAST') return '➖ NEAR FORECAST';
    return '⚪ UNABLE TO VERIFY';
  };

  const impactStyle = getImpactStyle(item.impactLevel);
  const activeImpact =
    isReleased && hasActual && item.postReleaseImpact
      ? item.postReleaseImpact
      : item.xauusdImpact;
  const xauBadge = getXauBadge(activeImpact, isReleased);

  const lockedPrediction = item.lockedPreRelease?.aiPrediction || item.aiPrediction;
  const prevPredictionBeforeUpdate =
    item.lockedPreRelease?.previousPredictionBeforeReassessment ||
    item.previousAiPrediction;
  const reassessmentReasonText =
    item.lockedPreRelease?.reassessmentReason ||
    item.reassessmentReason ||
    'Updated based on latest consensus forecast and related macroeconomic release data.';

  const evidenceStrengthObj = getEvidenceStrengthDisplay(
    item.lockedPreRelease?.evidenceStrength || item.evidenceStrength
  );
  const keyFactorsList: KeyFactorItem[] =
    item.lockedPreRelease?.keyFactors || item.keyFactors || [];
  const conciseSummary =
    item.lockedPreRelease?.aiAnalysisSummary ||
    item.aiAnalysisSummary ||
    item.impactReasoning;

  const analyzedDate =
    item.lockedPreRelease?.analyzedDateWib ||
    item.analyzedDateWib ||
    dateParts.fullDateId;
  const analyzedTime =
    item.lockedPreRelease?.analyzedTimeWib ||
    item.analyzedTimeWib ||
    shortTimeWib;
  const lastUpdatedTime =
    item.lockedPreRelease?.lastAnalysisUpdate ||
    item.lastAnalysisUpdate ||
    analyzedTime;
  const lockedTimeWib =
    item.lockedPreRelease?.lockedAtWib ||
    (item.releaseTimeIso
      ? calculateNotificationWibTime(item.releaseTimeIso, 1).notifyTimeWib
      : shortTimeWib);

  const actualSourceUrl = item.actualSourceUrl || item.sourceUrl;
  const actualSourceName = item.actualSourceName || item.sourceName;
  const usedSourcesList: GroundingSource[] =
    item.relatedSources && item.relatedSources.length > 0
      ? item.relatedSources
      : [
          {
            title: actualSourceName,
            uri: actualSourceUrl,
            sourceType: item.sourceType,
            publicationDate: item.releaseTime,
            lastUpdated: item.sourceUpdated || lastUpdatedTime,
          },
        ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-xs transition-opacity duration-200"
      onClick={triggerSmoothClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.eventName}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-t-3xl bg-[var(--bg-card)] border-t border-[var(--border-gold)] p-5 sm:p-6 space-y-5 text-[var(--text-primary)] ${
          isClosing ? 'animate-sheet-down' : 'animate-sheet-up'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Swipe Pill & Header Bar */}
        <div className="space-y-3">
          <div className="w-12 h-1.5 rounded-full bg-[var(--text-secondary)]/30 mx-auto" />

          <div className="flex items-center justify-between">
            <span
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono-num font-extrabold ${
                isReleased
                  ? 'text-[#EF4444] bg-[#EF4444]/12 border-[#EF4444]/30'
                  : 'text-[var(--gold-accent)] bg-[var(--bg-secondary)] border-[var(--border-gold)]'
              }`}
            >
              {isReleased ? 'STATUS: 🔴 RELEASED' : 'UPCOMING NEWS DETAIL'}
            </span>

            <button
              type="button"
              onClick={triggerSmoothClose}
              aria-label="Close detail (X)"
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Country, Event Name, Full Event Name / Category, & Impact */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <span className="text-base">🇺🇸</span>
              <span>{item.country}</span>
              <span className="text-[var(--text-secondary)]">·</span>
              <span className="text-[var(--gold-accent)]">{item.categoryTag}</span>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-lg border text-[10px] font-extrabold tracking-wider ${impactStyle.cls}`}
            >
              {impactStyle.label}
            </span>
          </div>

          <h2 className="text-xl font-extrabold leading-snug text-[var(--text-primary)]">
            {item.eventName}
          </h2>
        </div>

        {/* RELEASE SCHEDULE: Day, Date, Time WIB, & Countdown */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--gold-accent)] inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>RELEASE SCHEDULE (WIB)</span>
            </span>
            <span className="font-mono-num text-[var(--text-secondary)]">
              {dateParts.dayBadge}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="block text-[10px] text-[var(--text-secondary)] uppercase">
                DAY & DATE
              </span>
              <span className="font-bold text-[var(--text-primary)]">
                {dateParts.fullDateId}
              </span>
            </div>
            <div className="border-l border-[var(--border-subtle)] pl-3">
              <span className="block text-[10px] text-[var(--text-secondary)] uppercase">
                TIME WIB
              </span>
              <span className="font-mono-num text-sm font-extrabold text-[var(--gold-accent)]">
                {shortTimeWib}
              </span>
            </div>
          </div>

          {isUpcoming && (
            <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[11px] font-mono-num text-[var(--text-secondary)] uppercase">
                COUNTDOWN
              </span>
              <span className="font-mono-num text-base font-extrabold text-[var(--gold-accent)]">
                ⏱ {formatCountdown(item.releaseTimeIso, nowMs)}
              </span>
            </div>
          )}
        </div>

        {/* ======================== UPCOMING vs RELEASED DATA FIGURES ======================== */}
        {isUpcoming ? (
          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] mb-1 uppercase">
                  FORECAST
                </span>
                <span className="font-mono-num text-base font-extrabold text-[var(--gold-accent)]">
                  {item.forecast}
                </span>
              </div>
              <div className="border-l border-[var(--border-subtle)] pl-3">
                <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] mb-1 uppercase">
                  PREVIOUS
                </span>
                <span className="font-mono-num text-base font-bold text-[var(--text-primary)]">
                  {item.previous}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* POST-RELEASE ACTUAL vs FORECAST & SURPRISE */
          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <span className="block text-[10px] font-mono-num text-[#22C55E] font-bold mb-1">
                  ACTUAL
                </span>
                {hasActual ? (
                  <span className="font-mono-num text-base font-extrabold text-[var(--text-primary)]">
                    {item.actual}
                  </span>
                ) : (
                  <span className="font-mono-num text-xs font-bold text-[#F59E0B] inline-flex items-center gap-1">
                    <Hourglass className="w-3.5 h-3.5 animate-pulse" />
                    <span>⏳ WAITING</span>
                  </span>
                )}
              </div>

              <div className="border-l border-[var(--border-subtle)] pl-2.5">
                <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] mb-1">
                  FORECAST
                </span>
                <span className="font-mono-num text-base font-bold text-[var(--text-primary)]">
                  {item.forecast}
                </span>
              </div>

              <div className="border-l border-[var(--border-subtle)] pl-2.5">
                <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] mb-1">
                  PREVIOUS
                </span>
                <span className="font-mono-num text-base font-semibold text-[var(--text-secondary)]">
                  {item.previous}
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)] font-mono-num font-bold">
                SURPRISE
              </span>
              <span className="font-extrabold text-[var(--gold-accent)]">
                {hasActual
                  ? getPredictionLabel(item.actualSurprise)
                  : '⏳ WAITING FOR RELEASE'}
              </span>
            </div>
          </div>
        )}

        {/* ======================== AI PREDICTION & [ WHY THIS PREDICTION? ] ======================== */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] p-4 space-y-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-[var(--gold-accent)] inline-flex items-center gap-1.5">
              {isReleased ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>🔒 PRE-RELEASE PREDICTION</span>
                </>
              ) : (
                <span>AI PREDICTION</span>
              )}
            </span>

            <span className="font-mono-num text-[var(--text-secondary)]">
              Confidence:{' '}
              <strong className="text-[var(--gold-accent)]">
                {item.aiConfidence.toUpperCase()}
              </strong>
            </span>
          </div>

          <div className="text-lg font-extrabold tracking-tight text-[var(--text-primary)]">
            {getPredictionLabel(lockedPrediction)}
          </div>

          {/* If Released: Show Prediction Locked time & Prediction Result */}
          {isReleased && (
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
              <div className="flex items-center justify-between font-mono-num text-[var(--text-secondary)]">
                <span>ORIGINAL AI PREDICTION:</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {getPredictionLabel(lockedPrediction)}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono-num text-[var(--text-secondary)]">
                <span>Prediction locked:</span>
                <span className="text-[var(--gold-accent)] font-bold">
                  {lockedTimeWib}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[var(--text-secondary)] font-bold">
                  PREDICTION RESULT
                </span>
                <span className="font-extrabold">
                  {getVerifText(item.verificationResult)}
                </span>
              </div>
            </div>
          )}

          {/* If Prediction Updated (Live Reassessment before release) */}
          {prevPredictionBeforeUpdate &&
            prevPredictionBeforeUpdate !== lockedPrediction && (
              <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-3 text-xs space-y-1.5">
                <div className="font-extrabold text-[var(--gold-accent)] inline-flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>🔄 PREDICTION UPDATED</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono-num text-[11px]">
                  <div>
                    <span className="text-[var(--text-secondary)] block">
                      Previous:
                    </span>
                    <span className="font-bold">
                      {getPredictionLabel(prevPredictionBeforeUpdate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-secondary)] block">
                      Current:
                    </span>
                    <span className="font-bold text-[var(--gold-accent)]">
                      {getPredictionLabel(lockedPrediction)}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] font-mono-num text-[var(--text-secondary)]">
                  Updated: {lastUpdatedTime}
                </div>
                <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">
                  {reassessmentReasonText}
                </p>
              </div>
            )}

          {/* Expandable Trigger Button: [ WHY THIS PREDICTION? ] (Default COLLAPSED) */}
          <button
            type="button"
            onClick={() => setAnalysisExpanded((prev) => !prev)}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--border-gold)] text-[var(--gold-accent)] font-extrabold text-xs tracking-wider flex items-center justify-between transition-colors hover:bg-[var(--gold-accent)]/10 cursor-pointer"
          >
            <span>[ WHY THIS PREDICTION? ]</span>
            {analysisExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* ======================== EXPANDABLE AI ANALYSIS & SOURCE TRANSPARENCY CARD ======================== */}
          {analysisExpanded && (
            <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 space-y-4 animate-view-enter">
              {/* 1. AI ANALYSIS CONCISE SUMMARY */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                  AI ANALYSIS
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-primary)]">
                  {conciseSummary}
                </p>
              </div>

              {/* 2. EVIDENCE STRENGTH */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-extrabold tracking-wider text-[var(--text-secondary)] uppercase">
                    EVIDENCE STRENGTH
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Kekuatan bukti pendukung (bukan probabilitas)
                  </span>
                </div>
                <span
                  className={`px-3 py-1 rounded-lg border text-xs font-extrabold ${evidenceStrengthObj.cls}`}
                >
                  {evidenceStrengthObj.text}
                </span>
              </div>

              {/* 3. KEY FACTORS */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <div className="text-[11px] font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                  KEY FACTORS
                </div>

                {keyFactorsList.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)] italic">
                    Not enough evidence
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {keyFactorsList.map((kf, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl bg-[var(--bg-secondary)] px-3 py-2 border border-[var(--border-subtle)] flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="flex items-start gap-2">
                          <span>{getFactorDot(kf.signal)}</span>
                          <span className="font-bold text-[var(--text-primary)]">
                            {kf.label}
                          </span>
                        </div>
                        {kf.detail && (
                          <span className="font-mono-num text-[11px] text-[var(--text-secondary)] text-right">
                            {kf.detail}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 4. SOURCES USED (Interactive — tap each source to inspect details) */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                    SOURCES USED
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    Ketuk sumber untuk detail
                  </span>
                </div>

                <div className="space-y-2">
                  {usedSourcesList.map((src, idx) => {
                    const isSelected = selectedSourceIdx === idx;
                    return (
                      <div
                        key={`${src.uri}-${idx}`}
                        className="rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSourceIdx(isSelected ? null : idx)
                          }
                          className="w-full min-h-[44px] px-3.5 py-2.5 text-left flex items-center justify-between gap-2 text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-card)]/50 cursor-pointer"
                        >
                          <span className="inline-flex items-center gap-2 truncate">
                            <span className="text-[#22C55E] font-extrabold">✓</span>
                            <span className="truncate">{src.title}</span>
                          </span>
                          {isSelected ? (
                            <ChevronUp className="w-4 h-4 text-[var(--gold-accent)] shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                          )}
                        </button>

                        {isSelected && (
                          <div className="px-3.5 pb-3.5 pt-2 border-t border-[var(--border-subtle)] space-y-2 text-xs bg-[var(--bg-card)]/60">
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-[var(--text-secondary)] block">
                                  Source Name:
                                </span>
                                <span className="font-bold text-[var(--text-primary)]">
                                  {src.title}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-secondary)] block">
                                  Source Type:
                                </span>
                                <span className="font-mono-num font-bold text-[var(--gold-accent)]">
                                  {src.sourceType || item.sourceType}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-secondary)] block">
                                  Publication / Release Date:
                                </span>
                                <span className="font-mono-num text-[var(--text-primary)]">
                                  {src.publicationDate || item.releaseTime}
                                </span>
                              </div>
                              <div>
                                <span className="text-[var(--text-secondary)] block">
                                  Last Updated:
                                </span>
                                <span className="font-mono-num text-[var(--text-primary)]">
                                  {src.lastUpdated || item.sourceUpdated || lastUpdatedTime}
                                </span>
                              </div>
                            </div>

                            {src.uri && (
                              <a
                                href={src.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[var(--gold-accent)] text-[#070A0F] font-extrabold text-xs flex items-center justify-center gap-1.5"
                              >
                                <span>[ OPEN SOURCE ]</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. ANALYSIS TIME (WIB) */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1.5 text-xs font-mono-num">
                <div className="text-[10px] font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
                  ANALYSIS TIME (Asia/Jakarta · WIB)
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">Analyzed:</span>
                  <span className="font-bold text-[var(--text-primary)]">
                    {analyzedDate} · {analyzedTime}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)]">Last Updated:</span>
                  <span className="font-bold text-[var(--gold-accent)]">
                    {lastUpdatedTime}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================== XAUUSD IMPACT EXPLANATION (WHY?) ======================== */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[var(--gold-accent)]">
              XAUUSD IMPACT
            </span>
            <span
              className={`px-3 py-1 rounded-lg border text-xs font-extrabold ${xauBadge.cls}`}
            >
              {xauBadge.text}
            </span>
          </div>

          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
            <div className="text-xs font-extrabold text-[var(--gold-accent)] inline-flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>WHY?</span>
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-primary)]">
              {isReleased && item.postReleaseReasoning
                ? item.postReleaseReasoning
                : item.impactReasoning}
            </p>
          </div>
        </div>

        {/* ======================== NOTIFICATION PER EVENT (FOR UPCOMING) ======================== */}
        {isUpcoming && (
          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {notifyMeEnabled ? (
                  <Bell className="w-4 h-4 text-[var(--gold-accent)]" />
                ) : (
                  <BellOff className="w-4 h-4 text-[var(--text-secondary)]" />
                )}
                <div>
                  <div className="text-xs font-extrabold tracking-wide text-[var(--text-primary)]">
                    🔔 NOTIFY ME
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {isNotificationSent ? (
                      <span className="text-[#22C55E] font-bold inline-flex items-center gap-1">
                        <Check className="w-3 h-3" /> Notified
                      </span>
                    ) : notifyMeEnabled ? (
                      `Notify: ${activeLeadTime}m before (${scheduleCalc.notifyTimeWib})`
                    ) : (
                      'Alerts Off for this event'
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[var(--bg-card)] p-1 rounded-xl border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateEventOverride?.(item.id, {
                      enabled: true,
                      leadTimeMinutes: activeLeadTime,
                    })
                  }
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    notifyMeEnabled
                      ? 'bg-[var(--gold-accent)] text-[#070A0F]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  ON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateEventOverride?.(item.id, {
                      enabled: false,
                      leadTimeMinutes: activeLeadTime,
                    })
                  }
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    !notifyMeEnabled
                      ? 'bg-[#EF4444] text-white'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  OFF
                </button>
              </div>
            </div>

            {notifyMeEnabled && (
              <div className="space-y-1.5 pt-1">
                <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] uppercase">
                  Notify:
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {LEAD_TIME_OPTIONS.map((mins) => {
                    const selected = activeLeadTime === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() =>
                          onUpdateEventOverride?.(item.id, {
                            enabled: true,
                            leadTimeMinutes: mins,
                          })
                        }
                        className={`min-h-[38px] rounded-xl border font-mono-num text-xs font-bold transition-colors cursor-pointer ${
                          selected
                            ? 'bg-[var(--gold-accent)] text-[#070A0F] border-[var(--gold-accent)]'
                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {mins}m
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================== PRIMARY SOURCE QUICK LINK ======================== */}
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-[var(--gold-accent)] inline-flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span>SOURCES</span>
            </span>
            <span className="text-[11px] font-mono-num text-[var(--text-secondary)]">
              {actualSourceName}
            </span>
          </div>

          {actualSourceUrl && (
            <a
              href={actualSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[var(--gold-accent)] text-[#070A0F] font-extrabold text-xs tracking-wider flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            >
              <span>[ OPEN SOURCE ]</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Educational Disclaimer */}
        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed flex items-start gap-1.5 pb-2">
          <ShieldCheck className="w-4 h-4 text-[var(--gold-accent)] shrink-0 mt-0.5" />
          <span>
            Informasi ini adalah analisis edukatif dan bukan nasihat keuangan atau jaminan arah harga XAUUSD. Tidak memuat sinyal BUY/SELL atau analisis chart.
          </span>
        </p>
      </div>
    </div>
  );
};
