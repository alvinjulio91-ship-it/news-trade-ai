import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  BarChart3,
  Landmark,
  ShieldCheck,
} from 'lucide-react';
import { ApiStatusItem, SystemApiStatusReport } from '../types';

export const ApiStatusCard: React.FC = () => {
  const [report, setReport] = useState<SystemApiStatusReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStatus = async (forceRefresh = false) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/system/api-status${forceRefresh ? '?refresh=true' : ''}`);
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      const data: SystemApiStatusReport = await res.json();
      setReport(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memeriksa status API');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(false);
  }, []);

  const renderBadge = (item: ApiStatusItem) => {
    switch (item.status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            <span>CONNECTED</span>
          </span>
        );
      case 'NOT CONFIGURED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 text-[#F59E0B] text-[10px] font-bold">
            <AlertTriangle className="w-3 h-3" />
            <span>NOT CONFIGURED</span>
          </span>
        );
      case 'ERROR':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EF4444]/15 border border-[#EF4444]/30 text-[#EF4444] text-[10px] font-bold">
            <XCircle className="w-3 h-3" />
            <span>ERROR</span>
          </span>
        );
    }
  };

  return (
    <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-[var(--gold-accent)]/15 border border-[var(--border-gold)] flex items-center justify-center text-[var(--gold-accent)]">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
              API CONFIGURATION & SYSTEM STATUS
            </h3>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Status koneksi Gemini, Alpha Vantage, dan FRED API
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchStatus(true)}
          disabled={isLoading}
          title="Periksa Ulang Status API"
          className="p-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--gold-accent)]/15 border border-[var(--border-subtle)] text-[var(--gold-accent)] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 text-xs text-[#EF4444]">
          {errorMsg}
        </div>
      )}

      {/* API Providers Cards */}
      <div className="space-y-2.5">
        {/* 1. GEMINI API */}
        <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[var(--gold-accent)]" />
              <span className="text-xs font-extrabold text-[var(--text-primary)]">
                Gemini AI API
              </span>
            </div>
            {report ? renderBadge(report.gemini) : <span className="text-[10px] text-[var(--text-secondary)]">Memeriksa...</span>}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {report?.gemini?.message || 'Digunakan untuk analisis berita ekonomi, scenario analysis, dan AI Market Intelligence.'}
          </p>
        </div>

        {/* 2. ALPHA VANTAGE API */}
        <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#3B82F6]" />
              <span className="text-xs font-extrabold text-[var(--text-primary)]">
                Alpha Vantage API
              </span>
            </div>
            {report ? renderBadge(report.alphaVantage) : <span className="text-[10px] text-[var(--text-secondary)]">Memeriksa...</span>}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {report?.alphaVantage?.message || 'Digunakan untuk realtime kuotasi Forex, Crypto, Saham, dan indikator finansial.'}
          </p>
        </div>

        {/* 3. FRED API */}
        <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-extrabold text-[var(--text-primary)]">
                FRED API (St. Louis Fed)
              </span>
            </div>
            {report ? renderBadge(report.fred) : <span className="text-[10px] text-[var(--text-secondary)]">Memeriksa...</span>}
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {report?.fred?.message || 'Digunakan untuk rilis data ekonomi AS (CPI, NFP, Suku Bunga, dsb).'}
          </p>
        </div>
      </div>

      {/* Security Note Footer */}
      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
        <span>
          Semua API key aman di server-side environment variables (.env / Secrets Manager). Kredensial tidak pernah diekspos ke browser client.
        </span>
      </div>
    </div>
  );
};
