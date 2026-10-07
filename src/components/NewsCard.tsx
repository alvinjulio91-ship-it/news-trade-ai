import React from 'react';
import { ChevronRight } from 'lucide-react';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  EconomicNewsItem,
  EventNotificationOverride,
  formatWibShortTime,
  NotificationSettings,
} from '../types';

interface NewsCardProps {
  item: EconomicNewsItem;
  nowMs: number;
  notificationSettings?: NotificationSettings;
  eventOverride?: EventNotificationOverride;
  isNotificationSent?: boolean;
  onSelect: (item: EconomicNewsItem) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  item,
  nowMs,
  notificationSettings = DEFAULT_NOTIFICATION_SETTINGS,
  eventOverride,
  isNotificationSent,
  onSelect,
}) => {
  const isUpcoming = item.status === 'UPCOMING';

  // Impact Indicator (HIGH: #EF4444, MEDIUM: #F59E0B, LOW: #3B82F6)
  const getImpactIndicator = (level: EconomicNewsItem['impactLevel']) => {
    if (level === 'High') {
      return {
        dot: '🔴',
        label: 'HIGH IMPACT',
        cls: 'text-[#EF4444] bg-[#EF4444]/12 border-[#EF4444]/30',
      };
    }
    if (level === 'Medium') {
      return {
        dot: '🟡',
        label: 'MEDIUM IMPACT',
        cls: 'text-[#F59E0B] bg-[#F59E0B]/12 border-[#F59E0B]/30',
      };
    }
    return {
      dot: '🔵',
      label: 'LOW IMPACT',
      cls: 'text-[#3B82F6] bg-[#3B82F6]/12 border-[#3B82F6]/30',
    };
  };

  // Notification Status for Bubble
  const globalImpactAllowed =
    (item.impactLevel === 'High' && notificationSettings.highImpactEnabled) ||
    (item.impactLevel === 'Medium' && notificationSettings.mediumImpactEnabled) ||
    (item.impactLevel === 'Low' && notificationSettings.lowImpactEnabled);

  const isAlertActive =
    notificationSettings.notificationsEnabled &&
    notificationSettings.upcomingNewsEnabled &&
    (eventOverride ? eventOverride.enabled : globalImpactAllowed);

  const activeLeadMinutes =
    eventOverride?.leadTimeMinutes || notificationSettings.notificationLeadTime || 30;

  // Check if event is releasing soon (within 60 minutes)
  const relMs = item.releaseTimeIso ? new Date(item.releaseTimeIso).getTime() : 0;
  const diffMins = relMs > nowMs ? Math.max(1, Math.ceil((relMs - nowMs) / 60000)) : 0;
  const isReleasingSoon = isUpcoming && diffMins > 0 && diffMins <= 60;

  const impact = getImpactIndicator(item.impactLevel);
  const shortTimeWib = formatWibShortTime(item.releaseTimeIso, item.releaseTime);

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full min-h-[66px] text-left rounded-2xl bg-[var(--bg-card)]/95 backdrop-blur-xs border border-[var(--border-subtle)] hover:border-[var(--border-gold)] px-4 py-3.5 transition-all duration-200 active:scale-[0.98] cursor-pointer flex items-center justify-between gap-3"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Left: Country Flag + Event Name + Release Time WIB + Small Status */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none shrink-0" aria-label="United States">
            🇺🇸
          </span>
          <h3 className="text-sm sm:text-[15px] font-bold text-[var(--text-primary)] truncate">
            {item.eventName}
          </h3>
        </div>

        <div className="flex items-center gap-2 pl-6 text-xs font-mono-num text-[var(--text-secondary)] flex-wrap">
          <span className="font-semibold text-[var(--text-primary)]/90">
            {shortTimeWib}
          </span>
          <span aria-hidden="true">·</span>

          {/* Small Status on Bubble:
              - Released: ✓ RELEASED
              - Releasing soon (<= 60m): ⏱ 10m
              - Upcoming Alert active: 🔔 Alert 30m
              - Upcoming Alert off: 🔕 Alerts Off
          */}
          {!isUpcoming ? (
            <span className="text-[11px] font-bold text-[#22C55E]">
              ✓ RELEASED
            </span>
          ) : isReleasingSoon ? (
            <span className="text-[11px] font-bold text-[var(--gold-accent)]">
              ⏱ {diffMins}m
            </span>
          ) : isNotificationSent ? (
            <span className="text-[11px] font-bold text-[#22C55E]">
              🔔 Notified
            </span>
          ) : isAlertActive ? (
            <span className="text-[11px] font-semibold text-[var(--gold-accent)]">
              🔔 Alert {activeLeadMinutes}m
            </span>
          ) : (
            <span className="text-[11px] text-[var(--text-secondary)]">
              🔕 Alerts Off
            </span>
          )}
        </div>
      </div>

      {/* Right: Impact Indicator + Subtle Chevron */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`px-2.5 py-1 rounded-xl border text-[10px] font-extrabold tracking-wider inline-flex items-center gap-1.5 ${impact.cls}`}
        >
          <span>{impact.dot}</span>
          <span>{impact.label}</span>
        </span>
        <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
      </div>
    </button>
  );
};
