import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  X,
  Target,
  BarChart3,
  FileText,
  Clock,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import {
  MonthlyTradingPlanData,
  TradingPlanRecord,
  TradingPlanStore,
  formatMonthNameIndonesian,
  formatRecordDateIndonesian,
  formatRupiah,
  getCurrentMonthKey,
} from '../types';

export const TRADING_PLAN_STORAGE_KEY = 'xau_news_ai_trading_plan';
export const TRADING_PLAN_ACTIVE_MONTH_KEY = 'xau_news_ai_trading_plan_active_month';

// Fallback seed when completely empty for initial smooth demo
const INITIAL_DEFAULT_STORE: TradingPlanStore = {
  '2026-10': {
    target: 5000000,
    review: 'Fokus eksekusi sesuai berita ekonomi utama tanpa overtrading.',
    records: [
      {
        id: 'record-seed-1',
        date: '2026-10-07',
        type: 'profit',
        amount: 300000,
        note: 'Evaluasi berita ekonomi',
      },
      {
        id: 'record-seed-2',
        date: '2026-10-06',
        type: 'loss',
        amount: 100000,
        note: 'Tidak mengikuti trading plan',
      },
    ],
  },
  '2026-09': {
    target: 4000000,
    review: 'Pencapaian bagus saat rilis NFP dan FOMC rate cut.',
    records: [
      {
        id: 'record-seed-sep-1',
        date: '2026-09-25',
        type: 'profit',
        amount: 3200000,
        note: 'Profit konsisten akhir bulan',
      },
    ],
  },
};

export const TradingPlan: React.FC = () => {
  // 1. Storage & Active Month State (Auto Load & Fallback)
  const [store, setStore] = useState<TradingPlanStore>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(TRADING_PLAN_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback if localStorage access fails
    }
    return INITIAL_DEFAULT_STORE;
  });

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const savedMonth = window.localStorage.getItem(TRADING_PLAN_ACTIVE_MONTH_KEY);
        if (savedMonth && /^\d{4}-\d{2}$/.test(savedMonth)) {
          return savedMonth;
        }
      }
    } catch {
      // ignore
    }
    return getCurrentMonthKey();
  });

  // Toast / notification state
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form Modal State (Add / Edit)
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<TradingPlanRecord | null>(null);
  const [formData, setFormData] = useState<{
    date: string;
    type: 'profit' | 'loss';
    amount: string;
    note: string;
  }>({
    date: new Date().toISOString().slice(0, 10),
    type: 'profit',
    amount: '',
    note: '',
  });

  // Target Editing State
  const [isEditingTarget, setIsEditingTarget] = useState<boolean>(false);
  const [targetInput, setTargetInput] = useState<string>('');

  // Delete Confirmation Dialog State
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // Reset Month Confirmation Dialog State
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);

  // File Input Ref for Import Backup
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 2. Auto Save to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TRADING_PLAN_STORAGE_KEY, JSON.stringify(store));
      }
    } catch {
      // handle quota or restriction safely
    }
  }, [store]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(TRADING_PLAN_ACTIVE_MONTH_KEY, selectedMonth);
      }
    } catch {
      // ignore
    }
  }, [selectedMonth]);

  // Flash toast helper
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2800);
  };

  // Get current active month data safely
  const currentMonthData: MonthlyTradingPlanData = useMemo(() => {
    const existing = store[selectedMonth];
    if (existing) {
      return existing;
    }
    return {
      target: 5000000,
      review: '',
      records: [],
    };
  }, [store, selectedMonth]);

  // 3. Auto Calculation:
  // Total Profit, Total Loss, Net Result, Win Rate, Progress, Remaining Target
  const calculations = useMemo(() => {
    const records = currentMonthData.records || [];
    let totalProfit = 0;
    let totalLoss = 0;
    let profitCount = 0;
    let lossCount = 0;

    for (const r of records) {
      const amt = Number(r.amount) || 0;
      if (r.type === 'profit') {
        totalProfit += amt;
        profitCount += 1;
      } else if (r.type === 'loss') {
        totalLoss += amt;
        lossCount += 1;
      }
    }

    const netResult = totalProfit - totalLoss;
    const target = currentMonthData.target > 0 ? currentMonthData.target : 0;

    let progressPercent = 0;
    if (target > 0) {
      progressPercent = (netResult / target) * 100;
    }

    // Display progress clamped for progress bar (0% to 100%), but show true percentage in text
    const displayBarPercent = Math.max(0, Math.min(100, progressPercent));

    // Remaining target
    const remaining = Math.max(0, target - netResult);

    // Win Rate / Rasio hasil positif
    const winRate = records.length > 0 ? (profitCount / records.length) * 100 : 0;

    return {
      totalProfit,
      totalLoss,
      netResult,
      target,
      progressPercent,
      displayBarPercent,
      remaining,
      recordCount: records.length,
      profitCount,
      lossCount,
      winRate,
    };
  }, [currentMonthData]);

  // Sorted records by date desc (latest first)
  const sortedRecords = useMemo(() => {
    const list = [...(currentMonthData.records || [])];
    return list.sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [currentMonthData.records]);

  // All available months sorted descending for Monthly History
  const allMonthsList = useMemo(() => {
    const keys = Array.from(new Set([...Object.keys(store), selectedMonth, getCurrentMonthKey()]));
    return keys.sort().reverse();
  }, [store, selectedMonth]);

  // Handler: Change Month
  const handleSelectMonth = (monthKey: string) => {
    setSelectedMonth(monthKey);
    // If not in store yet, initialize entry
    if (!store[monthKey]) {
      setStore((prev) => ({
        ...prev,
        [monthKey]: {
          target: 5000000,
          review: '',
          records: [],
        },
      }));
    }
  };

  // Handler: Open Add Record Modal
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    // Default date to today or matching selected month
    const today = new Date().toISOString().slice(0, 10);
    const defaultDate = today.startsWith(selectedMonth) ? today : `${selectedMonth}-01`;
    setFormData({
      date: defaultDate,
      type: 'profit',
      amount: '',
      note: '',
    });
    setModalOpen(true);
  };

  // Handler: Open Edit Record Modal
  const handleOpenEditModal = (rec: TradingPlanRecord) => {
    setEditingRecord(rec);
    setFormData({
      date: rec.date,
      type: rec.type,
      amount: String(rec.amount),
      note: rec.note,
    });
    setModalOpen(true);
  };

  // Handler: Save Record (Add or Update)
  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = parseInt(formData.amount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      alert('Harap masukkan nominal angka yang valid!');
      return;
    }

    if (!formData.date) {
      alert('Harap pilih tanggal record!');
      return;
    }

    // Determine target month from record date (e.g., '2026-10-07' -> '2026-10')
    const targetMonthKey = formData.date.slice(0, 7);

    setStore((prev) => {
      const nextStore = { ...prev };
      const monthData: MonthlyTradingPlanData = nextStore[targetMonthKey] || {
        target: 5000000,
        review: '',
        records: [],
      };

      if (editingRecord) {
        // If date changed to another month, remove from old month and add to target month
        const oldMonthKey = editingRecord.date.slice(0, 7);
        if (oldMonthKey !== targetMonthKey && nextStore[oldMonthKey]) {
          nextStore[oldMonthKey] = {
            ...nextStore[oldMonthKey],
            records: nextStore[oldMonthKey].records.filter((r) => r.id !== editingRecord.id),
          };
        }

        const updatedRecord: TradingPlanRecord = {
          ...editingRecord,
          date: formData.date,
          type: formData.type,
          amount: cleanAmount,
          note: formData.note.trim(),
        };

        const existingRecords = nextStore[targetMonthKey]?.records || [];
        const recordIndex = existingRecords.findIndex((r) => r.id === editingRecord.id);

        if (recordIndex >= 0) {
          const newRecords = [...existingRecords];
          newRecords[recordIndex] = updatedRecord;
          nextStore[targetMonthKey] = {
            ...monthData,
            records: newRecords,
          };
        } else {
          nextStore[targetMonthKey] = {
            ...monthData,
            records: [updatedRecord, ...existingRecords],
          };
        }
      } else {
        // Add new record with unique ID
        const newRecord: TradingPlanRecord = {
          id: `tp-record-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: formData.date,
          type: formData.type,
          amount: cleanAmount,
          note: formData.note.trim(),
        };

        nextStore[targetMonthKey] = {
          ...monthData,
          records: [newRecord, ...monthData.records],
        };
      }

      return nextStore;
    });

    setModalOpen(false);
    showToast('Data tersimpan');
  };

  // Handler: Delete Record
  const handleConfirmDelete = () => {
    if (!deletingRecordId) return;

    setStore((prev) => {
      const currentMonthRecords = prev[selectedMonth]?.records || [];
      return {
        ...prev,
        [selectedMonth]: {
          ...currentMonthData,
          records: currentMonthRecords.filter((r) => r.id !== deletingRecordId),
        },
      };
    });

    setDeletingRecordId(null);
    showToast('Record berhasil dihapus');
  };

  // Handler: Save Monthly Target
  const handleSaveTarget = () => {
    const parsedTarget = parseInt(targetInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(parsedTarget) || parsedTarget < 0) {
      alert('Nominal target tidak valid');
      return;
    }

    setStore((prev) => ({
      ...prev,
      [selectedMonth]: {
        ...currentMonthData,
        target: parsedTarget,
      },
    }));

    setIsEditingTarget(false);
    showToast('Target bulanan diperbarui');
  };

  // Handler: Save Review Textarea (Auto Save on change/blur)
  const handleReviewChange = (text: string) => {
    setStore((prev) => ({
      ...prev,
      [selectedMonth]: {
        ...currentMonthData,
        review: text,
      },
    }));
  };

  // Handler: Reset Current Month Data
  const handleConfirmResetMonth = () => {
    setStore((prev) => ({
      ...prev,
      [selectedMonth]: {
        target: currentMonthData.target,
        review: '',
        records: [],
      },
    }));
    setResetConfirmOpen(false);
    showToast(`Data bulan ${formatMonthNameIndonesian(selectedMonth)} direset`);
  };

  // Handler: Export Backup JSON
  const handleExportBackup = () => {
    try {
      const jsonStr = JSON.stringify(store, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `xau_news_ai_trading_plan_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Backup berhasil diekspor');
    } catch {
      alert('Gagal mengekspor file backup');
    }
  };

  // Handler: Import Backup JSON
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        // Validation format
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Format JSON tidak sesuai');
        }

        // Validate structure of at least one key
        for (const [key, val] of Object.entries(parsed)) {
          if (!/^\d{4}-\d{2}$/.test(key)) {
            throw new Error(`Format key bulan tidak valid: ${key}`);
          }
          const m = val as any;
          if (typeof m !== 'object' || !Array.isArray(m.records)) {
            throw new Error(`Struktur data bulan ${key} tidak valid`);
          }
        }

        // Apply imported store safely
        setStore(parsed);
        showToast('Data backup berhasil diimpor & dipulihkan!');
      } catch (err: any) {
        alert(`File backup tidak valid: ${err?.message || 'Format salah'}`);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="space-y-6 pb-6 animate-view-enter">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-[var(--gold-accent)] text-[#070A0F] text-xs font-extrabold shadow-2xl flex items-center gap-2 animate-view-enter">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <section className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-widest text-[var(--gold-accent)] uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PERSONAL JOURNAL</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] mt-0.5">
            Trading Plan
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Target, hasil & history performa bulanan pribadi (Tanpa sinyal)
          </p>
        </div>

        {/* Quick Month Selector */}
        <div className="flex items-center gap-1.5 bg-[var(--bg-card)] px-3 py-2 rounded-2xl border border-[var(--border-subtle)]">
          <Calendar className="w-4 h-4 text-[var(--gold-accent)] shrink-0" />
          <select
            value={selectedMonth}
            onChange={(e) => handleSelectMonth(e.target.value)}
            aria-label="Pilih Bulan Trading Plan"
            className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
          >
            {allMonthsList.map((m) => (
              <option key={m} value={m} className="bg-[#111821] text-white">
                {formatMonthNameIndonesian(m)}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* FITUR 1: MONTHLY TARGET HERO CARD */}
      <section
        className="rounded-3xl p-5 border border-[var(--border-gold)] relative overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
          boxShadow: '0 12px 32px -10px rgba(212, 175, 55, 0.15)',
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[var(--gold-accent)]" />
            <span className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
              MONTHLY TARGET · {formatMonthNameIndonesian(selectedMonth)}
            </span>
          </div>

          {!isEditingTarget ? (
            <button
              type="button"
              onClick={() => {
                setTargetInput(String(currentMonthData.target));
                setIsEditingTarget(true);
              }}
              className="text-[11px] font-bold text-[var(--gold-accent)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              <span>Edit Target</span>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSaveTarget}
                className="px-2 py-0.5 rounded-lg bg-[var(--gold-accent)] text-[#070A0F] text-[10px] font-extrabold cursor-pointer"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTarget(false)}
                className="px-2 py-0.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-[10px] cursor-pointer"
              >
                Batal
              </button>
            </div>
          )}
        </div>

        {/* Target vs Hasil Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-2xl bg-[var(--bg-primary)]/70 p-3.5 border border-[var(--border-subtle)]">
            <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] uppercase">
              TARGET BULANAN
            </span>
            {isEditingTarget ? (
              <input
                type="text"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="5000000"
                className="w-full mt-1 bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-lg px-2 py-1 text-sm font-extrabold text-[var(--gold-accent)] focus:outline-none"
              />
            ) : (
              <span className="font-mono-num text-lg font-extrabold text-[var(--text-primary)]">
                {formatRupiah(calculations.target)}
              </span>
            )}
          </div>

          <div className="rounded-2xl bg-[var(--bg-primary)]/70 p-3.5 border border-[var(--border-subtle)]">
            <span className="block text-[10px] font-mono-num text-[var(--text-secondary)] uppercase">
              TOTAL HASIL (NET)
            </span>
            <span
              className={`font-mono-num text-lg font-extrabold ${
                calculations.netResult >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}
            >
              {formatRupiah(calculations.netResult)}
            </span>
          </div>
        </div>

        {/* Progress Bar & Sisa Target */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--text-secondary)]">Pencapaian Target:</span>
            <span className="font-mono-num font-extrabold text-[var(--gold-accent)]">
              {calculations.progressPercent.toFixed(1)}%
            </span>
          </div>

          {/* Bar track */}
          <div className="w-full h-3 rounded-full bg-[var(--bg-primary)] overflow-hidden border border-[var(--border-subtle)] p-0.5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${calculations.displayBarPercent}%`,
                background:
                  calculations.netResult < 0
                    ? '#EF4444'
                    : 'linear-gradient(90deg, #D4AF37 0%, #22C55E 100%)',
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono-num text-[var(--text-secondary)] pt-1">
            <span>Sisa Target:</span>
            <span className="font-bold text-[var(--text-primary)]">
              {formatRupiah(calculations.remaining)}
            </span>
          </div>
        </div>
      </section>

      {/* FITUR 4: PERFORMA BULANAN */}
      <section className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[var(--gold-accent)]" />
            <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
              PERFORMA BULANAN · {formatMonthNameIndonesian(selectedMonth)}
            </h2>
          </div>
          <span className="text-[10px] font-mono-num text-[var(--text-secondary)]">
            {calculations.recordCount} Total Record
          </span>
        </div>

        {/* Ringkasan: Total Profit, Total Loss, Net Result, Win Rate, Total Record */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-[#22C55E]">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>TOTAL PROFIT</span>
            </div>
            <div className="font-mono-num text-base font-extrabold text-[#22C55E] truncate">
              +{formatRupiah(calculations.totalProfit)}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] font-mono-num">
              {calculations.profitCount} transaksi profit
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-bold text-[#EF4444]">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>TOTAL LOSS</span>
            </div>
            <div className="font-mono-num text-base font-extrabold text-[#EF4444] truncate">
              -{formatRupiah(calculations.totalLoss)}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] font-mono-num">
              {calculations.lossCount} transaksi loss
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 space-y-1">
            <span className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase">
              NET RESULT
            </span>
            <div
              className={`font-mono-num text-base font-extrabold truncate ${
                calculations.netResult >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
              }`}
            >
              {formatRupiah(calculations.netResult)}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] font-mono-num">
              {calculations.netResult >= 0 ? 'Surplus bulanan' : 'Defisit bulanan'}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 space-y-1">
            <span className="block text-[10px] font-bold text-[var(--gold-accent)] uppercase">
              WIN RATE / RASIO POSITIF
            </span>
            <div className="font-mono-num text-base font-extrabold text-[var(--gold-accent)] truncate">
              {calculations.winRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] font-mono-num">
              {calculations.profitCount} dari {calculations.recordCount} record
            </div>
          </div>
        </div>

        {/* Baris Total Record & Target Summary */}
        <div className="rounded-xl bg-[var(--bg-primary)]/80 border border-[var(--border-subtle)] px-3.5 py-2.5 flex items-center justify-between text-xs">
          <span className="text-[var(--text-secondary)]">Total Record Bulan Ini:</span>
          <span className="font-mono-num font-extrabold text-[var(--text-primary)]">
            {calculations.recordCount} Catatan Transaksi
          </span>
        </div>
      </section>

      {/* FITUR 2 & 3: TAMBAH CATATAN HASIL & HISTORY */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
              RECORD HISTORY ({sortedRecords.length})
            </h2>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Urutan berdasarkan tanggal terbaru
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="min-h-[42px] px-3.5 py-2 rounded-2xl bg-[var(--gold-accent)] text-[#070A0F] font-extrabold text-xs inline-flex items-center gap-1.5 shadow-lg active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Record</span>
          </button>
        </div>

        {/* Record List */}
        {sortedRecords.length === 0 ? (
          <div className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-8 text-center space-y-2">
            <FileText className="w-8 h-8 text-[var(--text-secondary)]/40 mx-auto" />
            <div className="text-sm font-bold text-[var(--text-primary)]">
              Belum ada catatan bulan ini.
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Tambahkan record pertama Anda untuk mulai memantau hasil trading.
            </p>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] text-xs font-bold text-[var(--gold-accent)] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tambah Record Pertama</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedRecords.map((item) => {
              const isProfit = item.type === 'profit';
              return (
                <div
                  key={item.id}
                  className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] hover:border-[var(--border-gold)] p-3.5 transition-colors flex items-center justify-between gap-3"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono-num text-[var(--text-secondary)]">
                        {formatRecordDateIndonesian(item.date)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider uppercase ${
                          isProfit
                            ? 'bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30'
                            : 'bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30'
                        }`}
                      >
                        {isProfit ? 'PROFIT' : 'LOSS'}
                      </span>
                    </div>

                    <div
                      className={`text-base font-extrabold font-mono-num ${
                        isProfit ? 'text-[#22C55E]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isProfit ? '+' : '-'} {formatRupiah(item.amount)}
                    </div>

                    {item.note && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        Catatan: <span className="text-[var(--text-primary)]">{item.note}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      aria-label="Edit Record"
                      className="min-h-[38px] min-w-[38px] rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--gold-accent)] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingRecordId(item.id)}
                      aria-label="Hapus Record"
                      className="min-h-[38px] min-w-[38px] rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[#EF4444] transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FITUR 5: EVALUASI & REVIEW BULANAN */}
      <section className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--gold-accent)]" />
            <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
              EVALUASI & REVIEW BULANAN · {formatMonthNameIndonesian(selectedMonth)}
            </h2>
          </div>
          <span className="text-[10px] font-mono-num text-[var(--text-secondary)]">
            Review Catatan Pribadi
          </span>
        </div>

        {/* Textarea Evaluasi Bulanan */}
        <div className="space-y-2">
          <label
            htmlFor="monthly-review-notes"
            className="block text-[11px] font-bold text-[var(--text-primary)]"
          >
            Catatan Evaluasi Akhir Bulan:
          </label>
          <textarea
            id="monthly-review-notes"
            rows={4}
            value={currentMonthData.review || ''}
            onChange={(e) => handleReviewChange(e.target.value)}
            placeholder="Tuliskan evaluasi kedisiplinan trading, pengelolaan resiko, emosi, atau respon terhadap berita ekonomi bulan ini... Dapat diedit sewaktu-waktu."
            className="w-full rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--border-gold)] p-3.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-none resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[10px] text-[var(--text-secondary)]">
              💡 Tip: Catat apakah eksekusi mematuhi rencana tanpa overtrading.
            </span>
            <button
              type="button"
              onClick={() => showToast('Catatan evaluasi tersimpan')}
              className="px-3 py-1 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--gold-accent)]/15 border border-[var(--border-gold)] text-[10px] font-extrabold text-[var(--gold-accent)] cursor-pointer"
            >
              Simpan Catatan
            </button>
          </div>
        </div>
      </section>

      {/* FITUR 7: MONTHLY HISTORY LIST */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
            MONTHLY HISTORY SUMMARY
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)]">
            Pilih bulan untuk melihat rincian detail tanpa mencampur data antarbulan
          </p>
        </div>

        <div className="space-y-2.5">
          {allMonthsList.map((mKey) => {
            const mData = store[mKey] || { target: 0, review: '', records: [] };
            const mProfit = mData.records.reduce(
              (acc, r) => (r.type === 'profit' ? acc + r.amount : acc),
              0
            );
            const mLoss = mData.records.reduce(
              (acc, r) => (r.type === 'loss' ? acc + r.amount : acc),
              0
            );
            const mNet = mProfit - mLoss;
            const mTarget = mData.target || 0;
            const mProgress = mTarget > 0 ? (mNet / mTarget) * 100 : 0;
            const isSelected = selectedMonth === mKey;

            return (
              <button
                key={mKey}
                type="button"
                onClick={() => handleSelectMonth(mKey)}
                className={`w-full text-left rounded-2xl p-4 border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[var(--bg-secondary)] border-[var(--border-gold)]'
                    : 'bg-[var(--bg-card)] border-[var(--border-subtle)] hover:border-[var(--border-gold)]/60'
                }`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-[var(--text-primary)]">
                      {formatMonthNameIndonesian(mKey)}
                    </span>
                    {isSelected && (
                      <span className="px-2 py-0.5 rounded-md bg-[var(--gold-accent)] text-[#070A0F] text-[10px] font-extrabold">
                        AKTIF
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono-num text-[var(--text-secondary)]">
                    Target: {formatRupiah(mTarget)} · Net:{' '}
                    <strong className={mNet >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                      {formatRupiah(mNet)}
                    </strong>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <span className="block text-[10px] text-[var(--text-secondary)] uppercase">
                      Progress
                    </span>
                    <span className="font-mono-num font-extrabold text-xs text-[var(--gold-accent)]">
                      {mProgress.toFixed(0)}%
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* FITUR 9 & 10: BACKUP DATA & RESET */}
      <section className="rounded-3xl bg-[var(--bg-card)] border border-[var(--border-subtle)] p-5 space-y-4">
        <div>
          <h2 className="text-xs font-extrabold tracking-wider text-[var(--gold-accent)] uppercase">
            DATA MANAGEMENT & BACKUP
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            Ekspor seluruh riwayat ke file JSON, pulihkan backup, atau reset data bulan aktif
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleExportBackup}
            className="min-h-[44px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-gold)] text-[var(--gold-accent)] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors hover:bg-[var(--gold-accent)]/15 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Backup</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-gold)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Backup</span>
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {/* Reset Current Month Button */}
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="w-full min-h-[42px] rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 hover:bg-[#EF4444]/20 text-[#EF4444] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Data Bulan Ini ({formatMonthNameIndonesian(selectedMonth)})</span>
          </button>
        </div>
      </section>

      {/* ======================== MODAL: ADD / EDIT RECORD ======================== */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-view-enter"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[var(--border-gold)] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
              <div className="text-sm font-extrabold text-[var(--gold-accent)] uppercase">
                {editingRecord ? 'Edit Record' : '+ Tambah Record Hasil'}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="space-y-3.5 text-xs">
              {/* Tanggal */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                  Tanggal
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--border-gold)] px-3 py-2 text-xs font-mono-num text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              {/* Tipe: Profit / Loss */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                  Tipe Hasil
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'profit' })}
                    className={`min-h-[38px] rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      formData.type === 'profit'
                        ? 'bg-[#22C55E] text-[#070A0F] border-[#22C55E]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    <span>+ Profit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'loss' })}
                    className={`min-h-[38px] rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      formData.type === 'loss'
                        ? 'bg-[#EF4444] text-white border-[#EF4444]'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    <span>- Loss</span>
                  </button>
                </div>
              </div>

              {/* Nominal */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                  Nominal (Rupiah)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 300000"
                  value={formData.amount}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setFormData({ ...formData, amount: raw });
                  }}
                  className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--border-gold)] px-3 py-2 text-sm font-extrabold font-mono-num text-[var(--gold-accent)] focus:outline-none"
                />
                {formData.amount && (
                  <span className="block text-[10px] font-mono-num text-[var(--text-secondary)]">
                    Pratinjau: {formatRupiah(parseInt(formData.amount, 10) || 0)}
                  </span>
                )}
              </div>

              {/* Catatan */}
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-[var(--text-primary)]">
                  Catatan
                </label>
                <input
                  type="text"
                  placeholder="e.g. Evaluasi berita ekonomi"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus:border-[var(--border-gold)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[42px] rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold text-xs cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] rounded-xl bg-[var(--gold-accent)] text-[#070A0F] font-extrabold text-xs cursor-pointer"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== CONFIRMATION: DELETE RECORD ======================== */}
      {deletingRecordId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-view-enter"
          onClick={() => setDeletingRecordId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[#EF4444]/40 p-5 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#EF4444]">
              <AlertTriangle className="w-5 h-5" />
              <span>Konfirmasi Hapus</span>
            </div>
            <p className="text-[var(--text-primary)] leading-relaxed">
              Apakah Anda yakin ingin menghapus record ini?
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecordId(null)}
                className="min-h-[40px] rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="min-h-[40px] rounded-xl bg-[#EF4444] text-white font-extrabold cursor-pointer"
              >
                Yes, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================== CONFIRMATION: RESET MONTH DATA ======================== */}
      {resetConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-view-enter"
          onClick={() => setResetConfirmOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[var(--bg-card)] border border-[#EF4444]/40 p-5 space-y-4 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-sm font-extrabold text-[#EF4444]">
              <AlertTriangle className="w-5 h-5" />
              <span>Reset Data Bulan Ini</span>
            </div>
            <p className="text-[var(--text-primary)] leading-relaxed">
              Apakah Anda yakin ingin mereset seluruh record dan review untuk bulan{' '}
              <strong>{formatMonthNameIndonesian(selectedMonth)}</strong>?
              <br />
              <span className="text-[var(--text-secondary)]">
                (Bulan lainnya tidak akan terpengaruh).
              </span>
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="min-h-[40px] rounded-xl bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResetMonth}
                className="min-h-[40px] rounded-xl bg-[#EF4444] text-white font-extrabold cursor-pointer"
              >
                Reset Bulan Ini
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
