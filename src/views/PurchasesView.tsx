import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { Purchase } from '../types/index.ts';
import {
  Truck,
  Plus,
  Trash2,
  FileText,
  Printer,
  X,
  CheckCircle,
  Building2,
  Calendar,
} from 'lucide-react';

export function PurchasesView() {
  const { settings, hasRole } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any | null>(null);

  // Form State
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<Array<{ prd_ref: string; design: string; qty: number; unit_cost: number }>>([
    { prd_ref: '', design: '', qty: 1, unit_cost: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const isAdminOrFounder = hasRole(['founder', 'admin']);
  const currency = settings?.currency || 'DZD';

  const fetchPurchases = async () => {
    if (!isAdminOrFounder) {
      setPurchases([]);
      return;
    }
    try {
      setLoading(true);
      setFetchError(null);
      const data = await apiRequest('/api/purchases');
      setPurchases(data.purchases || []);
    } catch (err: any) {
      console.warn('Purchases fetch warning:', err.message);
      setFetchError(err.message || 'تعذر تحميل فواتير المشتريات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [isAdminOrFounder]);

  const handleAddItemRow = () => {
    setItems((prev) => [...prev, { prd_ref: '', design: '', qty: 1, unit_cost: 0 }]);
  };

  const handleRemoveItemRow = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validItems = items.filter((it) => it.prd_ref.trim() && it.qty > 0);
    if (validItems.length === 0) {
      setFormError('يجب إدخال صنف واحد على الأقل مع تحديد المرجع والكمية');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequest('/api/purchases', {
        method: 'POST',
        body: JSON.stringify({
          supplier: supplier.trim(),
          note: note.trim(),
          items: validItems,
        }),
      });

      setShowAddModal(false);
      setSupplier('');
      setNote('');
      setItems([{ prd_ref: '', design: '', qty: 1, unit_cost: 0 }]);
      fetchPurchases();
    } catch (err: any) {
      setFormError(err.message || 'فشل تسجيل فاتورة المشتريات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    try {
      const data = await apiRequest(`/api/purchases/${id}`);
      setSelectedPurchase(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            <span>إدارة المشتريات والتوريد (Inbound Purchases)</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            تسجيل فواتير الموردين، سندات الاستلام وتحديث أسعار التكلفة ورصيد المخزون
          </p>
        </div>

        {isAdminOrFounder && (
          <button
            onClick={() => {
              setSupplier('');
              setNote('');
              setItems([{ prd_ref: '', design: '', qty: 1, unit_cost: 0 }]);
              setFormError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل فاتورة توريد جديدة</span>
          </button>
        )}
      </div>

      {fetchError && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between">
          <span>{fetchError}</span>
          <button onClick={fetchPurchases} className="underline font-bold cursor-pointer">
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Purchases List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-bold">المورد (Supplier)</th>
                <th className="py-3 px-4 font-bold">البيان والملاحظة</th>
                <th className="py-3 px-4 font-bold text-center">المصدر</th>
                <th className="py-3 px-4 font-bold text-center">عدد الأصناف</th>
                <th className="py-3 px-4 font-bold text-left">إجمالي التكلفة</th>
                <th className="py-3 px-4 font-bold text-center">التاريخ والمستخدم</th>
                <th className="py-3 px-4 font-bold text-center">سند الاستلام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد فواتير توريد مسجلة حالياً
                  </td>
                </tr>
              ) : (
                purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                      {p.supplier}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {p.note || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {p.source}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono-numbers font-semibold">
                      {p.items_count || 1} أصناف
                    </td>
                    <td className="py-3.5 px-4 text-left font-mono-numbers font-bold text-emerald-600 dark:text-emerald-400">
                      {p.total_cost != null ? `${p.total_cost.toLocaleString()} ${currency}` : '— (محجوب)'}
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-500">
                      <span className="block font-mono-numbers">{new Date(p.created_at).toLocaleDateString('ar-DZ')}</span>
                      <span className="text-[10px] text-slate-400">{p.created_by_name}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleViewDetails(p.id)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-[11px] font-semibold transition"
                      >
                        معاينة السند
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Purchase Invoice Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>تسجيل فاتورة توريد مشتريات</span>
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

            <form onSubmit={handleSubmitPurchase} className="flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المورد (Supplier) *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g. شركة التجهيزات الصناعية"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ملاحظات أو رقم وصل التسليم
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="BL-2026/045"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    بنود الفاتورة والأصناف الموردة
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بند</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((it, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                      <input
                        type="text"
                        placeholder="الرمز المرجعي"
                        value={it.prd_ref}
                        onChange={(e) => handleItemChange(idx, 'prd_ref', e.target.value)}
                        dir="ltr"
                        required
                        className="w-28 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono"
                      />
                      <input
                        type="text"
                        placeholder="اسم الصنف"
                        value={it.design}
                        onChange={(e) => handleItemChange(idx, 'design', e.target.value)}
                        required
                        className="flex-1 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="الكمية"
                        value={it.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value, 10) || 1)}
                        className="w-20 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono-numbers text-center"
                      />
                      <input
                        type="number"
                        min="0"
                        placeholder="سعر التكلفة"
                        value={it.unit_cost}
                        onChange={(e) => handleItemChange(idx, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono-numbers text-left"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  الإجمالي المقدر: <span className="font-mono-numbers text-emerald-600">
                    {items.reduce((acc, it) => acc + (it.qty * it.unit_cost), 0).toLocaleString()} {currency}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs text-slate-500"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
                  >
                    {isSubmitting ? 'جاري الحفظ وتحديث المخزون...' : 'حفظ الفاتورة وتثبيت المخزون'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inbound Stock Receipt Modal */}
      {selectedPurchase && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>سند استلام وتوريد مخزون (Inbound Stock Receipt)</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة</span>
                </button>
                <button onClick={() => setSelectedPurchase(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 block">المورد:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPurchase.supplier}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">المستلم:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPurchase.created_by_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">التاريخ:</span>
                  <span className="font-mono-numbers">{new Date(selectedPurchase.created_at).toLocaleString('ar-DZ')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">إجمالي التكلفة:</span>
                  <span className="font-mono-numbers font-bold text-emerald-600">
                    {selectedPurchase.total_cost != null ? `${selectedPurchase.total_cost.toLocaleString()} ${currency}` : '—'}
                  </span>
                </div>
              </div>

              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                    <th className="py-2 px-3">المرجع</th>
                    <th className="py-2 px-3">اسم الصنف</th>
                    <th className="py-2 px-3 text-center">الكمية</th>
                    <th className="py-2 px-3 text-left">التكلفة الفردية</th>
                    <th className="py-2 px-3 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {selectedPurchase.items?.map((item: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 px-3 font-mono text-slate-500">{item.prd_ref}</td>
                      <td className="py-2 px-3 font-semibold">{item.design}</td>
                      <td className="py-2 px-3 text-center font-mono-numbers font-bold">{item.qty}</td>
                      <td className="py-2 px-3 text-left font-mono-numbers">
                        {item.unit_cost != null ? `${item.unit_cost.toLocaleString()} ${currency}` : '—'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono-numbers font-bold">
                        {item.line_total != null ? `${item.line_total.toLocaleString()} ${currency}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
