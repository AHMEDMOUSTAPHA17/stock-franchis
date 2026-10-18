import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  Boxes,
  AlertTriangle,
  Coins,
  ArrowUpRight,
  ShoppingCart,
  Calendar,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { TabId } from '../components/Sidebar.tsx';

interface DashboardProps {
  onNavigate: (tab: TabId) => void;
}

export function DashboardView({ onNavigate }: DashboardProps) {
  const { user, settings } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest('/api/dashboard/stats');
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'فشل تحميل بيانات لوحة القيادة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const currency = settings?.currency || 'DZD';
  const isNormalUser = user?.role === 'user';

  if (loading && !stats) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-slate-500">جاري تحميل المؤشرات الحية من قاعدة البيانات...</p>
        </div>
      </div>
    );
  }

  const today = stats?.today || {};
  const month = stats?.month || {};
  const inventory = stats?.inventory || {};
  const lowStockItems = stats?.low_stock_items || [];
  const topProducts = stats?.top_products || [];
  const salesTrend = stats?.sales_trend || [];

  const maxTrendTotal = Math.max(1, ...salesTrend.map((d: any) => d.total));

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              مرحباً بك، {user?.username}
            </h2>
            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              بيانات حية 100%
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            مؤشرات الأداء، رصيد الخزينة، والمخزون الحرج لمحطة {settings?.store_name || 'G.STOCK'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>فتح نقطة البيع (POS)</span>
          </button>
          <button
            onClick={fetchStats}
            title="تحديث البيانات"
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-3">
            <span className="font-medium">مبيعات اليوم</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
            {Number(today.total_amount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>عدد الفواتير: <strong className="text-slate-800 dark:text-slate-200">{today.sales_count || 0}</strong></span>
            <span>نقداً: <strong className="text-emerald-600">{Number(today.cash_amount || 0).toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Month's Sales */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-3">
            <span className="font-medium">مبيعات الشهر الحالي</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
            {Number(month.total_amount || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>تقسيط: <strong className="text-amber-600">{Number(month.installment_amount || 0).toLocaleString()}</strong></span>
            <span>فواتير: <strong className="text-slate-800 dark:text-slate-200">{month.sales_count || 0}</strong></span>
          </div>
        </div>

        {/* Cash Ledger Balance */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-3">
            <span className="font-medium">رصيد الخزينة الفعلي</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
            {Number(stats?.cash_balance || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">الحالة النقدية:</span>
            <span className="font-semibold text-emerald-600">متطابق مع السجلات</span>
          </div>
        </div>

        {/* Inventory Valuation */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs mb-3">
            <span className="font-medium">تقييم المخزون المالي</span>
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
            {Number(inventory.total_retail_value || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>الأصناف: <strong className="text-slate-800 dark:text-slate-200">{inventory.total_products || 0}</strong></span>
            {!isNormalUser && inventory.total_cost_value !== null ? (
              <span>سعر التكلفة: <strong className="font-mono-numbers">{Number(inventory.total_cost_value).toLocaleString()}</strong></span>
            ) : (
              <span className="text-slate-400">سعر البيع المقترح</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Charts & Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 14-Day Sales Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>المنحنى البياني للمبيعات (آخر 14 يوماً)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">توزيع حجم الإيرادات اليومية بالدينار الجزائري</p>
            </div>
            <span className="text-xs font-mono font-medium text-slate-400">
              أعلى يوم: {maxTrendTotal.toLocaleString()} {currency}
            </span>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-48 flex items-end gap-2 pt-6">
            {salesTrend.map((day: any) => {
              const heightPercent = maxTrendTotal > 0 ? Math.round((day.total / maxTrendTotal) * 100) : 0;
              const dateLabel = day.date ? day.date.slice(5) : '';
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] rounded px-2 py-1 pointer-events-none whitespace-nowrap z-10 shadow-lg font-mono-numbers">
                    {day.total.toLocaleString()} {currency} ({day.count} فواتير)
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md h-36 flex items-end overflow-hidden">
                    <div
                      style={{ height: `${Math.max(4, heightPercent)}%` }}
                      className={`w-full rounded-t-md transition-all duration-500 ${
                        day.total > 0
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400 group-hover:from-emerald-500 group-hover:to-teal-300'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    ></div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono transform -rotate-45 sm:rotate-0 mt-1">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>تنبيهات المخزون الحرج</span>
            </h3>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs text-emerald-600 hover:underline flex items-center gap-0.5"
            >
              <span>عرض الكل</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto">
            {lowStockItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 py-8">
                لا توجد أصناف مشرفة على النفاد حالياً ✓
              </div>
            ) : (
              lowStockItems.map((item: any) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.design}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">{item.prd_ref}</div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-mono font-bold shrink-0 ${
                      item.qty === 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400'
                    }`}
                  >
                    {item.qty === 0 ? 'منتهي (0)' : `متبقي: ${item.qty}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>المنتجات الأكثر مبيعاً والأعلى طلباً</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <th className="py-2.5 px-3">الرمز المرجعي</th>
                <th className="py-2.5 px-3">اسم الصنف</th>
                <th className="py-2.5 px-3 text-center">الكمية المباعة</th>
                <th className="py-2.5 px-3 text-left">إجمالي الإيراد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {topProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    لم تسجل مبيعات كافية بعد لإظهار الترتيب
                  </td>
                </tr>
              ) : (
                topProducts.map((p: any) => (
                  <tr key={p.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-medium text-slate-700 dark:text-slate-300">
                      {p.prd_ref}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                      {p.design}
                    </td>
                    <td className="py-3 px-3 text-center font-mono-numbers font-bold text-emerald-600">
                      {p.total_sold_qty} وحدة
                    </td>
                    <td className="py-3 px-3 text-left font-mono-numbers font-bold text-slate-900 dark:text-white">
                      {Number(p.total_revenue || 0).toLocaleString()} {currency}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
