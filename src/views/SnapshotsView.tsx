import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import {
  HardDriveDownload,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  FileCheck2,
  Lock,
  CheckCircle,
  Database,
  Calendar,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';

export function SnapshotsView() {
  const { user } = useAuth();
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsDir, setBackupsDir] = useState('');
  const [loading, setLoading] = useState(false);

  // Save State State
  const [savePassword, setSavePassword] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Restore State
  const [inspectPath, setInspectPath] = useState('');
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectResult, setInspectResult] = useState<any | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const [restorePassword, setRestorePassword] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSuccessMsg, setRestoreSuccessMsg] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const fetchBackupsList = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/api/system/snapshot/list-local');
      setBackups(data.backups || []);
      setBackupsDir(data.backupsDirectory || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackupsList();
  }, []);

  // Save local snapshot
  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setSaveSuccessMsg(null);
    setSaveError(null);

    try {
      const data = await apiRequest('/api/system/snapshot/save-local', {
        method: 'POST',
        body: JSON.stringify({ password: savePassword }),
      });
      setSaveSuccessMsg(`✓ ${data.message} (بصمة SHA-256: ${data.sha256.slice(0, 16)}...)`);
      setSavePassword('');
      fetchBackupsList();
    } catch (err: any) {
      setSaveError(err.message || 'فشل حفظ النسخة الاحتياطية');
    } finally {
      setSaveLoading(false);
    }
  };

  // Inspect snapshot file
  const handleInspectFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setInspectLoading(true);
    setInspectError(null);
    setInspectResult(null);
    setRestoreSuccessMsg(null);

    try {
      const data = await apiRequest('/api/system/snapshot/inspect-file', {
        method: 'POST',
        body: JSON.stringify({ filePath: inspectPath }),
      });
      setInspectResult(data);
    } catch (err: any) {
      setInspectError(err.message || 'فشل فحص ملف النسخة الاحتياطية');
    } finally {
      setInspectLoading(false);
    }
  };

  // Execute atomic data restore
  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectResult?.previewId) return;

    if (!confirm('تأكيد نهائي: هل أنت متأكد من استبدال البيانات التشغيلية مع الحفاظ على حسابات هذا الجهاز؟')) {
      return;
    }

    setRestoreLoading(true);
    setRestoreError(null);
    setRestoreSuccessMsg(null);

    try {
      const data = await apiRequest('/api/system/snapshot/restore-data', {
        method: 'POST',
        body: JSON.stringify({
          password: restorePassword,
          previewId: inspectResult.previewId,
          filePath: inspectResult.filePath,
        }),
      });

      setRestoreSuccessMsg(data.message);
      setInspectResult(null);
      setRestorePassword('');
      setInspectPath('');
      fetchBackupsList();
    } catch (err: any) {
      setRestoreError(err.message || 'فشلت عملية استعادة البيانات');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Title */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <HardDriveDownload className="w-5 h-5 text-indigo-600" />
          <span>محرك حفظ لقطة حالة النظام محلياً واستعادة البيانات مع حماية حسابات الجهاز</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          (Local State Backup & Isolated Data Restore / Preserve Local Accounts)
        </p>
      </div>

      {/* SECTION A: Save Snapshot to Disk */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
          <Database className="w-4 h-4 text-emerald-600" />
          <h3 className="font-bold text-sm">أ. حفظ نسخة حالة النظام على قرص الحاسوب (Save State Snapshot)</h3>
        </div>

        <p className="text-xs text-slate-500">
          ينشئ هذا الإجراء ملف حزمة بصيغة <code className="font-mono font-bold text-emerald-600">.gstock</code> متضمناً كافة السجلات التشغيلية وبصمة سلامة البيانات الرقمية (SHA-256) ويحفظه مباشرة في مجلد النسخ الاحتياطية المحلي <code className="font-mono text-slate-700 dark:text-slate-300">/backups/</code>.
        </p>

        {saveSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {saveError && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSaveSnapshot} className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <input
              type="password"
              required
              value={savePassword}
              onChange={(e) => setSavePassword(e.target.value)}
              placeholder="أدخل كلمة المرور الحالية لتأكيد الإجراء الأمني..."
              className="w-full py-2 px-3 pr-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>

          <button
            type="submit"
            disabled={saveLoading || !savePassword}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <HardDriveDownload className="w-4 h-4" />
            <span>{saveLoading ? 'جاري تصدير الحزمة...' : 'حفظ النسخة على القرص الآن'}</span>
          </button>
        </form>
      </div>

      {/* Local Backups Directory Files */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <FolderOpen className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm">الملفات المحفوظة في مسار الحاسوب المحلي ({backupsDir})</h3>
          </div>
          <button
            onClick={fetchBackupsList}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {backups.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">لا توجد نسخ احتياطية محفوظة بعد في مسار /backups/</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                    {b.filename}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono-numbers">
                    الحجم: {b.sizeKb} KB • تم التعديل: {new Date(b.modifiedAt).toLocaleString('ar-DZ')}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInspectPath(b.filename);
                    setInspectResult(null);
                    setInspectError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold transition"
                >
                  اختيار للفحص والاستعادة
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION B: Isolated Data Restore / Preserve Local Accounts */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/30 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
          <RotateCcw className="w-4 h-4 text-indigo-600" />
          <h3 className="font-bold text-sm">
            ب. استعادة البيانات مع الحفاظ المطلق على حسابات الجهاز (Data-Only Restore / Preserve Local Accounts)
          </h3>
        </div>

        {/* Protection Invariant Notice */}
        <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-indigo-700 dark:text-indigo-300">
            <ShieldCheck className="w-4 h-4" />
            <span>سياسة العزل الهندسي الصارمة لحماية الحسابات:</span>
          </div>
          <p>
            تستبدل هذه العملية البيانات التشغيلية فقط (الأصناف، المبيعات، المشتريات، الخزينة)، بينما <strong>يُمنع منعاً باتاً مسح أو تعديل جدول المستخدمين (users)</strong>. تظل حسابات هذا الجهاز وكلمات مرورها دون أي تغيير.
          </p>
        </div>

        {restoreSuccessMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{restoreSuccessMsg}</span>
          </div>
        )}

        {/* Stage 1: Inspect File */}
        <div className="space-y-3">
          <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
            المرحلة الأولى: فحص ومعاينة ملف الحالة محلياً (Inspect File)
          </h4>

          {inspectError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs">
              {inspectError}
            </div>
          )}

          <form onSubmit={handleInspectFile} className="flex gap-2">
            <input
              type="text"
              required
              value={inspectPath}
              onChange={(e) => setInspectPath(e.target.value)}
              placeholder="اسم الملف أو مساره، مثلاً: GStock_Snapshot_20261018_153000.gstock"
              dir="ltr"
              className="flex-1 py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
            />
            <button
              type="submit"
              disabled={inspectLoading || !inspectPath.trim()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition disabled:opacity-40"
            >
              {inspectLoading ? 'جاري الفحص...' : 'فحص وسلامة SHA-256'}
            </button>
          </form>
        </div>

        {/* Stage 2: Inspection Result & Atomic Restore Confirmation */}
        {inspectResult && (
          <div className="p-5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-4">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
              <FileCheck2 className="w-4 h-4" />
              <span>نتائج فحص الملف وسلامة البصمة الرقمية:</span>
            </div>

            {/* Warning Banner */}
            <div className="p-3 bg-amber-100 dark:bg-amber-950/80 rounded-xl text-amber-900 dark:text-amber-200 text-xs font-bold border border-amber-300 dark:border-amber-700">
              {inspectResult.warningMessage}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg">
                <span className="text-slate-400 block">إجمالي المنتجات:</span>
                <span className="font-bold font-mono-numbers">{inspectResult.stats.productsCount} صنفاً</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg">
                <span className="text-slate-400 block">فواتير المبيعات:</span>
                <span className="font-bold font-mono-numbers">{inspectResult.stats.salesCount} فاتورة</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg">
                <span className="text-slate-400 block">حركات الخزينة:</span>
                <span className="font-bold font-mono-numbers">{inspectResult.stats.cashTransactionsCount} قيداً</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg">
                <span className="text-slate-400 block">تاريخ النسخة:</span>
                <span className="font-mono-numbers">{new Date(inspectResult.stats.snapshotDate).toLocaleDateString('ar-DZ')}</span>
              </div>
            </div>

            {restoreError && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {restoreError}
              </div>
            )}

            <form onSubmit={handleExecuteRestore} className="pt-3 border-t border-amber-200 dark:border-amber-800/40 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المرحلة الثانية: تأكيد كلمة المرور للمسؤول لتنفيذ الاستعادة الذرية:
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    placeholder="أدخل كلمة المرور لتأكيد الاستعادة الشاملة..."
                    className="w-full py-2 px-3 pr-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInspectResult(null)}
                  className="px-4 py-2 text-xs text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={restoreLoading || !restorePassword}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-600/20 transition disabled:opacity-40 cursor-pointer"
                >
                  {restoreLoading ? 'جاري الاستعادة الذرية...' : 'بدء الاستعادة مع الإبقاء على حسابات الجهاز'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
