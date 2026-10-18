import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import {
  Sliders,
  Store,
  Percent,
  Coins,
  KeyRound,
  CheckCircle,
  AlertCircle,
  Save,
  Calculator,
} from 'lucide-react';

export function SettingsView() {
  const { settings, updateSettings } = useAuth();
  const [formData, setFormData] = useState({
    store_name: '',
    store_phone: '',
    store_address: '',
    currency: 'DZD',
    markup_cash_percent: 20,
    markup_installment_percent: 40,
    rounding_unit: 100,
    low_stock_threshold: 5,
    new_price_edit_code: '',
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData((prev) => ({
        ...prev,
        store_name: settings.store_name || '',
        store_phone: settings.store_phone || '',
        store_address: settings.store_address || '',
        currency: settings.currency || 'DZD',
        markup_cash_percent: settings.markup_cash_percent ?? 20,
        markup_installment_percent: settings.markup_installment_percent ?? 40,
        rounding_unit: settings.rounding_unit ?? 100,
        low_stock_threshold: settings.low_stock_threshold ?? 5,
      }));
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiRequest('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      updateSettings(formData);
      setSuccessMsg('تم حفظ وتحديث الإعدادات ومحرك التسعير بنجاح!');
      setFormData((prev) => ({ ...prev, new_price_edit_code: '' }));
    } catch (err: any) {
      setError(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
          <Sliders className="w-5 h-5 text-emerald-600" />
          <span>إعدادات النظام ومحرك التسعير القياسي (Pricing Engine)</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          تعديل نسب الهامش التجاري، وحدة التقريب الإجباري للأعلى، وتفويضات الأسعار
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Store Branding */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
            <Store className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm">بيانات المتجر والترويسة الرسمية</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                اسم المؤسسة أو المحل التجاري *
              </label>
              <input
                type="text"
                required
                value={formData.store_name}
                onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                رمز العملة المعتمد
              </label>
              <input
                type="text"
                required
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                رقم الهاتف
              </label>
              <input
                type="text"
                value={formData.store_phone}
                onChange={(e) => setFormData({ ...formData, store_phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                العنوان
              </label>
              <input
                type="text"
                value={formData.store_address}
                onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Canonical Pricing Engine */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
            <Calculator className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm">محرك التسعير وهوامش الربح الحسابية</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نسبة هامش البيع نقداً (%) *
              </label>
              <input
                type="number"
                min="0"
                max="300"
                step="0.5"
                required
                value={formData.markup_cash_percent}
                onChange={(e) => setFormData({ ...formData, markup_cash_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">الافتراضي: 20% فوق التكلفة</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نسبة هامش البيع بالتقسيط (12ش) (%) *
              </label>
              <input
                type="number"
                min="0"
                max="300"
                step="0.5"
                required
                value={formData.markup_installment_percent}
                onChange={(e) => setFormData({ ...formData, markup_installment_percent: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">الافتراضي: 40% فوق التكلفة</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                وحدة التقريب للأعلى (Rounding Unit) *
              </label>
              <select
                value={formData.rounding_unit}
                onChange={(e) => setFormData({ ...formData, rounding_unit: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers"
              >
                <option value={10}>10 دج (أقرب عشرة)</option>
                <option value={50}>50 دج (أقرب خمسين)</option>
                <option value={100}>100 دج (أقرب مئة - الموصى به)</option>
                <option value={500}>500 دج (أقرب خمسمئة)</option>
                <option value={1000}>1000 دج (أقرب ألف)</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">تقريب إجباري للأعلى دائماً</span>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              عتبة تنبيه المخزون الحرج (Low Stock Threshold)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={formData.low_stock_threshold}
              onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value, 10) || 5 })}
              className="w-48 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">تنبيه عند انخفاض الكمية إلى هذه العتبة أو أقل (الافتراضي: 5)</span>
          </div>
        </div>

        {/* Section 3: POS Price Override Code */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-slate-900 dark:text-white">
            <KeyRound className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm">رمز تفويض تعديل الأسعار بنقطة البيع (POS Price Override)</h3>
          </div>

          <p className="text-xs text-slate-500">
            الرمز الافتراضي الأولي هو <code className="font-mono font-bold text-amber-600">1997</code>. يمكنك تعيين رمز سري جديد؛ سيقوم الخادم بتجزئته وتوقيع رموز مؤقتة صالحة لمدة ساعتين.
          </p>

          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              تعيين رمز سري جديد (اتركه فارغاً للإبقاء على الرمز الحالي)
            </label>
            <input
              type="password"
              placeholder="••••"
              value={formData.new_price_edit_code}
              onChange={(e) => setFormData({ ...formData, new_price_edit_code: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'جاري الحفظ...' : 'حفظ كافة الإعدادات وتطبيق التسعير'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
