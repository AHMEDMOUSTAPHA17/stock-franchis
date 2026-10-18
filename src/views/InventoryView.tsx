import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { Product } from '../types/index.ts';
import {
  Search,
  Plus,
  Edit2,
  SlidersHorizontal,
  History,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  RefreshCw,
  X,
  FileText,
} from 'lucide-react';

export function InventoryView() {
  const { user, settings, hasRole } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    prd_ref: '',
    design: '',
    qty: 0,
    cost_price: 0,
  });
  const [adjustData, setAdjustData] = useState({
    qty_change: 0,
    reason: '',
  });
  const [movements, setMovements] = useState<any[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminOrFounder = hasRole(['founder', 'admin']);
  const currency = settings?.currency || 'DZD';

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        q: searchQuery,
        lowStock: lowStockOnly ? '1' : '0',
        page: String(page),
        limit: '25',
      });
      const data = await apiRequest(`/api/inventory?${queryParams.toString()}`);
      setProducts(data.products || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [searchQuery, lowStockOnly, page]);

  // Handle Add Product
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiRequest('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setShowAddModal(false);
      setFormData({ prd_ref: '', design: '', qty: 0, cost_price: 0 });
      fetchInventory();
    } catch (err: any) {
      setModalError(err.message || 'فشلت إضافة المنتج');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Product
  const handleEditProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiRequest(`/api/inventory/${selectedProduct.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          prd_ref: formData.prd_ref,
          design: formData.design,
          cost_price: formData.cost_price,
        }),
      });
      setShowEditModal(false);
      fetchInventory();
    } catch (err: any) {
      setModalError(err.message || 'فشل تحديث بيانات الصنف');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Manual Stock Adjustment
  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await apiRequest(`/api/inventory/${selectedProduct.id}/adjust`, {
        method: 'POST',
        body: JSON.stringify(adjustData),
      });
      setShowAdjustModal(false);
      setAdjustData({ qty_change: 0, reason: '' });
      fetchInventory();
    } catch (err: any) {
      setModalError(err.message || 'فشل تصحيح رصيد المخزون');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open History modal
  const handleOpenHistory = async (prod: Product) => {
    setSelectedProduct(prod);
    setShowHistoryModal(true);
    try {
      const data = await apiRequest(`/api/inventory/${prod.id}/movements`);
      setMovements(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-emerald-600" />
            <span>إدارة المخزون وبطاقات الأصناف</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            إجمالي الأصناف المسجلة: <strong className="font-mono-numbers">{totalCount}</strong> صنفاً
          </p>
        </div>

        {isAdminOrFounder && (
          <button
            onClick={() => {
              setFormData({ prd_ref: '', design: '', qty: 0, cost_price: 0 });
              setModalError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف جديد</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="بحث بالرمز المرجعي أو اسم الصنف أو المواصفة..."
            className="w-full py-2 px-4 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
        </div>

        <button
          onClick={() => {
            setLowStockOnly(!lowStockOnly);
            setPage(1);
          }}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer whitespace-nowrap ${
            lowStockOnly
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-700'
              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span>المخزون الحرج فقط</span>
        </button>

        <button
          onClick={fetchInventory}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition"
          title="تحديث"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4 font-bold">الرمز المرجعي</th>
                <th className="py-3 px-4 font-bold">اسم وتعيين الصنف</th>
                <th className="py-3 px-4 font-bold text-center">الكمية المتوفرة</th>
                <th className="py-3 px-4 font-bold text-center">حالة المخزون</th>
                {isAdminOrFounder && <th className="py-3 px-4 font-bold text-left">سعر التكلفة</th>}
                <th className="py-3 px-4 font-bold text-left">سعر البيع نقداً</th>
                <th className="py-3 px-4 font-bold text-left">سعر التقسيط (12ش)</th>
                <th className="py-3 px-4 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrFounder ? 8 : 7} className="py-12 text-center text-slate-400">
                    لا توجد أصناف مطابقة للبحث
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                      {p.prd_ref}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                      {p.design}
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono-numbers font-extrabold text-sm text-slate-800 dark:text-slate-200">
                      {p.qty}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          p.qty === 0
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400'
                            : p.is_low_stock
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'
                        }`}
                      >
                        {p.qty === 0 ? 'نافد' : p.is_low_stock ? 'حرج' : 'متوفر'}
                      </span>
                    </td>
                    {isAdminOrFounder && (
                      <td className="py-3.5 px-4 text-left font-mono-numbers text-slate-500">
                        {p.cost_price?.toLocaleString()} {currency}
                      </td>
                    )}
                    <td className="py-3.5 px-4 text-left font-mono-numbers font-bold text-emerald-600 dark:text-emerald-400">
                      {p.cash_price.toLocaleString()} {currency}
                    </td>
                    <td className="py-3.5 px-4 text-left font-mono-numbers font-medium text-amber-600 dark:text-amber-400">
                      {p.installment_12m_price.toLocaleString()} {currency}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isAdminOrFounder && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setFormData({
                                  prd_ref: p.prd_ref,
                                  design: p.design,
                                  qty: p.qty,
                                  cost_price: p.cost_price || 0,
                                });
                                setModalError(null);
                                setShowEditModal(true);
                              }}
                              title="تعديل بيانات الصنف"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setAdjustData({ qty_change: 0, reason: '' });
                                setModalError(null);
                                setShowAdjustModal(true);
                              }}
                              title="تصحيح رصيد المخزون"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded transition"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleOpenHistory(p)}
                          title="سجل الحركات التاريخية"
                          className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded transition"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              الصفحة {page} من {totalPages}
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>إضافة صنف جديد إلى المخزون</span>
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الرمز المرجعي (Reference)
                </label>
                <input
                  type="text"
                  required
                  value={formData.prd_ref}
                  onChange={(e) => setFormData({ ...formData, prd_ref: e.target.value })}
                  placeholder="e.g. REF-009"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم وتعيين الصنف (Designation)
                </label>
                <input
                  type="text"
                  required
                  value={formData.design}
                  onChange={(e) => setFormData({ ...formData, design: e.target.value })}
                  placeholder="e.g. مثقاب بوش 750 واط"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    الكمية الافتتاحية
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.qty}
                    onChange={(e) => setFormData({ ...formData, qty: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    سعر التكلفة ({currency})
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers"
                  />
                </div>
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
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ الصنف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-600" />
                <span>تعديل بيانات الصنف</span>
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEditProduct} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  الرمز المرجعي (Reference)
                </label>
                <input
                  type="text"
                  required
                  value={formData.prd_ref}
                  onChange={(e) => setFormData({ ...formData, prd_ref: e.target.value })}
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  اسم وتعيين الصنف
                </label>
                <input
                  type="text"
                  required
                  value={formData.design}
                  onChange={(e) => setFormData({ ...formData, design: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سعر التكلفة ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.cost_price}
                  onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-2 text-xs text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'تحديث البيانات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <span>تصحيح رصيد المخزون اليدوي</span>
              </h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-3">
              الصنف: <strong className="text-slate-900 dark:text-white">{selectedProduct.design}</strong> (المخزون الحالي: {selectedProduct.qty})
            </p>

            {modalError && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAdjustStock} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  مقدار التغيير (موجب للإضافة أو سالب للخصم)
                </label>
                <input
                  type="number"
                  required
                  value={adjustData.qty_change}
                  onChange={(e) => setAdjustData({ ...adjustData, qty_change: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono-numbers text-center font-bold text-lg"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  الرصيد بعد التصحيح سيكون: {selectedProduct.qty + adjustData.qty_change}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سبب التصحيح الإلزامي (Reason)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. جرد دوري، تلف، إرجاع بضاعة"
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-3 py-2 text-xs text-slate-500"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || adjustData.qty_change === 0}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold"
                >
                  {isSubmitting ? 'جاري التعديل...' : 'تأكيد تصحيح الرصيد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Movements History Modal */}
      {showHistoryModal && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-xl w-full border border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>سجل الحركات لمخزون: {selectedProduct.design}</span>
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {movements.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">لا توجد حركات مسجلة</p>
              ) : (
                movements.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                        {m.type === 'sale'
                          ? 'عملية بيع'
                          : m.type === 'purchase'
                          ? 'فاتورة توريد'
                          : m.type === 'adjustment'
                          ? 'تصحيح يدوي'
                          : 'استيراد رصيد'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {m.ref_type}: {m.ref_id} • بواسطة {m.created_by_name}
                      </span>
                    </div>
                    <div className="text-left">
                      <span
                        className={`font-mono-numbers font-bold text-sm ${
                          m.qty_change > 0 ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {m.qty_change > 0 ? `+${m.qty_change}` : m.qty_change}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono-numbers">
                        {new Date(m.created_at).toLocaleString('ar-DZ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
