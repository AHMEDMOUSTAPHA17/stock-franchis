import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { CashTransaction } from '../types/index.ts';
import { EXPENSE_CATEGORIES } from '../shared/schemas.ts';
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Trash2,
  Lock,
  Search,
  Filter,
  X,
  CreditCard,
  Banknote,
  Receipt,
  AlertCircle,
} from 'lucide-react';

const CATEGORY_ARABIC_NAMES: Record<string, string> = {
  Electricity: 'كهرباء وإنارة',
  Water: 'مياه وري',
  Rent: 'إيجار المحل',
  Transportation: 'نقل وشحن',
  Maintenance: 'صيانة وإصلاحات',
  Supplies: 'مستلزمات ومطبوعات',
  Salaries: 'أجور ورواتب',
  Cleaning: 'نظافة ومواد تعقيم',
  Internet: 'إنترنت واشتراكات',
  Telephone: 'هاتف واتصالات',
  Taxes: 'ضرائب ورسوم',
  Delivery: 'توصيل للعملاء',
  Miscellaneous: 'مصاريف نثرية عامة',
  Capital: 'رأس مال افتتاحي',
  'POS Sale': 'مبيعات نقدية (POS)',
  'Supplier Payment': 'سداد موردين',
};

export function CashView() {
  const { settings, hasRole } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'outflow' as 'inflow' | 'outflow',
    amount: '',
    source: 'Electricity',
    description: '',
    reference: '',
    payment_method: 'cash' as 'cash' | 'check' | 'bank_transfer',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currency = settings?.currency || 'DZD';
  const isAdminOrFounder = hasRole(['founder', 'admin']);

  const fetchCashData = async () => {
    try {
      setLoading(true);
      const [sumData, txData] = await Promise.all([
        apiRequest('/api/cash/summary'),
        apiRequest(`/api/cash/transactions?type=${typeFilter}&category=${categoryFilter}&q=${encodeURIComponent(searchQuery)}`),
      ]);
      setSummary(sumData);
      setTransactions(txData.transactions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashData();
  }, [typeFilter, categoryFilter, searchQuery]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError('المبلغ يجب أن يكون أكبر من الصفر');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/cash/transactions', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          amount: amountNum,
        }),
      });

      setShowAddModal(false);
      setFormData({
        type: 'outflow',
        amount: '',
        source: 'Electricity',
        description: '',
        reference: '',
        payment_method: 'cash',
      });
      fetchCashData();
    } catch (err: any) {
      setFormError(err.message || 'فشل تسجيل الحركة النقدية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, origin: string) => {
    if (origin === 'automatic') {
      alert('لا يمكن حذف القيود التلقائية الناتجة عن فواتير البيع!');
      return;
    }
    if (!confirm('هل أنت متأكد من حذف هذا القيد المالي؟')) return;

    try {
      await apiRequest(`/api/cash/transactions/${id}`, { method: 'DELETE' });
      fetchCashData();
    } catch (err: any) {
      alert(err.message || 'فشل حذف القيد');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <span>دفتر الأستاذ النقدي الفعلي للخزينة (Cash Ledger)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            متابعة السيولة النقدية، تصنيف المصاريف المعيارية وتدفقات المبيعات التلقائية
          </p>
        </div>

        <button
          onClick={() => {
            setFormData({
              type: 'outflow',
              amount: '',
              source: 'Electricity',
              description: '',
              reference: '',
              payment_method: 'cash',
            });
            setFormError(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>تسجيل حركة نقدية (قبض / صرف)</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 block mb-1">الرصيد الافتتاحي</span>
          <span className="font-mono-numbers text-xl font-bold text-slate-700 dark:text-slate-300">
            {Number(summary?.opening_balance || 0).toLocaleString()} {currency}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-emerald-600 block mb-1 font-semibold flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>إجمالي المقبوضات (Inflows)</span>
          </span>
          <span className="font-mono-numbers text-xl font-extrabold text-emerald-600">
            +{Number(summary?.total_inflows || 0).toLocaleString()} {currency}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-red-500 block mb-1 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>إجمالي المصاريف (Outflows)</span>
          </span>
          <span className="font-mono-numbers text-xl font-extrabold text-red-500">
            -{Number(summary?.total_outflows || 0).toLocaleString()} {currency}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 block mb-1 font-semibold">
            الرصيد النهائي الحالي
          </span>
          <span className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
            {Number(summary?.current_balance || 0).toLocaleString()} {currency}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالوصف أو بالمرجع أو بالرقم..."
            className="w-full py-2 px-4 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
        >
          <option value="">كافة أنواع الحركات</option>
          <option value="inflow">مقبوضات واردة فقط (+)</option>
          <option value="outflow">مصاريف خارجة فقط (-)</option>
        </select>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-bold">النوع</th>
                <th className="py-3 px-4 font-bold">المبلغ</th>
                <th className="py-3 px-4 font-bold">الفئة المعيارية / المصدر</th>
                <th className="py-3 px-4 font-bold">البيان والشرح</th>
                <th className="py-3 px-4 font-bold text-center">الصفة والمصدر</th>
                <th className="py-3 px-4 font-bold text-center">التاريخ والمستخدم</th>
                {isAdminOrFounder && <th className="py-3 px-4 font-bold text-center">حذف</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrFounder ? 7 : 6} className="py-12 text-center text-slate-400">
                    لا توجد حركات نقدية مسجلة
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          tx.type === 'inflow'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'
                            : 'bg-red-50 text-red-700 dark:bg-red-950/80 dark:text-red-400'
                        }`}
                      >
                        {tx.type === 'inflow' ? (
                          <>
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>وارد</span>
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3 h-3" />
                            <span>مصروف</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono-numbers font-black text-sm">
                      <span className={tx.type === 'inflow' ? 'text-emerald-600' : 'text-red-600'}>
                        {tx.type === 'inflow' ? '+' : '-'}{tx.amount.toLocaleString()} {currency}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      {CATEGORY_ARABIC_NAMES[tx.source] || tx.source}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {tx.description}
                      {tx.reference && (
                        <span className="block text-[10px] text-slate-400 font-mono">مرجع: {tx.reference}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          tx.origin === 'automatic'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {tx.origin === 'automatic' ? 'تلقائي (فاتورة بيع)' : 'يدوي'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500">
                      <span className="block font-mono-numbers">{new Date(tx.date).toLocaleDateString('ar-DZ')}</span>
                      <span className="text-[10px] text-slate-400">{tx.created_by_name}</span>
                    </td>
                    {isAdminOrFounder && (
                      <td className="py-3.5 px-4 text-center">
                        {tx.origin === 'automatic' ? (
                          <span
                            title="قيد تلقائي محمي من الحذف"
                            className="inline-block p-1 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                          >
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <button
                            onClick={() => handleDelete(tx.id, tx.origin)}
                            title="حذف القيد اليدوي"
                            className="p-1 rounded text-slate-400 hover:text-red-500 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span>تسجيل حركة نقدية في الخزينة</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddTransaction} className="space-y-3.5">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'outflow', source: 'Electricity' })}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${
                    formData.type === 'outflow'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  صرف ومصروفات (-)
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'inflow', source: 'Capital' })}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${
                    formData.type === 'inflow'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  قبض وتدفق وارد (+)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  المبلغ ({currency}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers text-center font-bold text-lg"
                />
              </div>

              {formData.type === 'outflow' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تصنيف المصروف (إلزامي من الفئات الـ 13 المعيارية) *
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  >
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_ARABIC_NAMES[cat] || cat} ({cat})
                      </option>
                    ))}
                    <option value="Supplier Payment">سداد موردين (Supplier Payment)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    مصدر القبض *
                  </label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium"
                  >
                    <option value="Capital">إيداع رأس مال / تمويل</option>
                    <option value="Customer Repayment">سداد عميل / تحصيل ديون</option>
                    <option value="Cash Adjustment">تسوية نقدية واردة</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  البيان والشرح *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. فاتورة سونلغاز لشهر أكتوبر"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  رقم الوصل أو المرجع (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="REC-00129"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-2 text-xs text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                >
                  {isSubmitting ? 'جاري التسجيل...' : 'تسجيل القيد في الخزينة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
