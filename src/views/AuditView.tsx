import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api.ts';
import { AuditLog } from '../types/index.ts';
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Clock,
  Terminal,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export function AuditView() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: String(page),
        limit: '30',
        action: actionFilter,
        entity: entityFilter,
      });
      const data = await apiRequest(`/api/audit?${queryParams.toString()}`);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, entityFilter]);

  const toggleExpand = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  const parseDetails = (detailsStr?: string) => {
    if (!detailsStr) return null;
    try {
      return JSON.parse(detailsStr);
    } catch {
      return detailsStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <span>سجل التدقيق الجنائي للأحداث (Forensic Audit Log)</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
              حساب المؤسس حصراً (Founder Only)
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            توثيق غير قابل للتحريف لكافة العمليات الحساسة، تسجيل الدخول، المبيعات، الاستيراد، وحفظ واستعادة الحالة
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative">
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            placeholder="تصفية حسب نوع الإجراء (e.g. LOGIN, SALE, RESTORE)..."
            className="w-full py-2 px-3 pr-9 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
        </div>

        <select
          value={entityFilter}
          onChange={(e) => {
            setEntityFilter(e.target.value);
            setPage(1);
          }}
          className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
        >
          <option value="">كافة الكيانات (All Entities)</option>
          <option value="users">المستخدمين (users)</option>
          <option value="sales">المبيعات (sales)</option>
          <option value="products">المنتجات والمخزون (products)</option>
          <option value="purchases">المشتريات والتوريد (purchases)</option>
          <option value="cash_transactions">الخزينة (cash_transactions)</option>
          <option value="system">النظام والنسخ (system)</option>
          <option value="settings">الإعدادات (settings)</option>
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-bold">التوقيت المحلي</th>
                <th className="py-3 px-4 font-bold">المستخدم</th>
                <th className="py-3 px-4 font-bold">نوع الإجراء (Action)</th>
                <th className="py-3 px-4 font-bold">الكيان (Entity)</th>
                <th className="py-3 px-4 font-bold text-center">عنوان IP</th>
                <th className="py-3 px-4 font-bold text-center">التفاصيل (Payload)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    لا توجد أحداث مطابقة للبحث
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedRowId === log.id;
                  const detailsObj = parseDetails(log.details);

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono-numbers text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('ar-DZ')}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {log.username}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {log.entity}
                          {log.entity_id && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">
                              {log.entity_id}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                          {log.ip || '127.0.0.1'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {log.details ? (
                            <button
                              onClick={() => toggleExpand(log.id)}
                              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 text-[11px] font-mono flex items-center gap-1 mx-auto transition"
                            >
                              <span>JSON</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded JSON details */}
                      {isExpanded && detailsObj && (
                        <tr className="bg-slate-950 text-slate-100">
                          <td colSpan={6} className="p-4 font-mono text-[11px] overflow-x-auto">
                            <pre className="whitespace-pre-wrap leading-relaxed text-emerald-400">
                              {JSON.stringify(detailsObj, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              إجمالي السجلات: {total} • الصفحة {page} من {totalPages}
            </span>
            <div className="flex gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
              >
                السابق
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
