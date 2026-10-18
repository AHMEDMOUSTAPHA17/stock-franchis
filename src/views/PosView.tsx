import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import { Product, Sale } from '../types/index.ts';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  Banknote,
  KeyRound,
  FileText,
  User,
  Phone,
  Printer,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { InvoiceModal } from '../components/InvoiceModal.tsx';
import { calculateInstallmentMonthPrice, calculateMonthlyPayment } from '../shared/pricing.ts';

interface CartItem {
  product: Product;
  qty: number;
  overridePrice?: number;
}

export function PosView() {
  const { user, settings, priceOverrideToken, setPriceOverrideToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentType, setPaymentType] = useState<'cash' | 'installment'>('cash');
  const [installmentMonths, setInstallmentMonths] = useState<number>(6);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideItemIndex, setOverrideItemIndex] = useState<number | null>(null);
  const [overrideCode, setOverrideCode] = useState('1997');
  const [overrideCustomPrice, setOverrideCustomPrice] = useState<string>('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Finished Sale for Invoice Modal
  const [finishedSale, setFinishedSale] = useState<Sale | null>(null);

  const currency = settings?.currency || 'DZD';

  const fetchProducts = async (q = '') => {
    try {
      setLoading(true);
      const data = await apiRequest(`/api/inventory?q=${encodeURIComponent(q)}&limit=50`);
      setProducts(data.products || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(searchQuery);
  }, [searchQuery]);

  const addToCart = (product: Product) => {
    if (product.qty <= 0) {
      setError(`المنتج (${product.design}) نافد تماماً من المخزون!`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex >= 0) {
        const currentQty = prev[existingIndex].qty;
        if (currentQty + 1 > product.qty) {
          setError(`لا يمكن بيع كمية تتجاوز المتوفر بالمخزون (${product.qty})`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], qty: currentQty + 1 };
        return updated;
      } else {
        return [...prev, { product, qty: 1 }];
      }
    });
    setError(null);
  };

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const nextQty = item.qty + delta;

      if (nextQty <= 0) {
        return updated.filter((_, idx) => idx !== index);
      }
      if (nextQty > item.product.qty) {
        setError(`الكمية المتاحة في المخزون هي ${item.product.qty} فقط`);
        return prev;
      }
      updated[index] = { ...item, qty: nextQty };
      return updated;
    });
    setError(null);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, idx) => idx !== index));
  };

  const clearCart = () => {
    setCart([]);
    setError(null);
  };

  // Compute unit price for cart item based on current payment type & months
  const getItemUnitPrice = (item: CartItem): number => {
    if (item.overridePrice !== undefined) {
      return item.overridePrice;
    }
    if (paymentType === 'cash') {
      return item.product.cash_price;
    } else {
      // If cost_price is available on product object (for admin/founder) calculate exact,
      // otherwise use 12m installment price as base ceiling
      if (item.product.cost_price && settings) {
        return calculateInstallmentMonthPrice(
          item.product.cost_price,
          settings.markup_installment_percent,
          installmentMonths,
          settings.rounding_unit
        );
      }
      return item.product.installment_12m_price;
    }
  };

  const subtotal = cart.reduce((acc, item) => acc + getItemUnitPrice(item) * item.qty, 0);
  const monthlyShare = paymentType === 'installment' && installmentMonths > 0
    ? calculateMonthlyPayment(subtotal, installmentMonths)
    : 0;

  // Open price override dialog
  const handleOpenOverride = (index: number) => {
    const item = cart[index];
    setOverrideItemIndex(index);
    setOverrideCustomPrice(String(getItemUnitPrice(item)));
    setOverrideError(null);
    setShowOverrideModal(true);
  };

  // Submit price override with code 1997
  const handleSubmitOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overrideItemIndex === null) return;
    setOverrideLoading(true);
    setOverrideError(null);

    const priceNum = parseFloat(overrideCustomPrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setOverrideError('السعر المدخل غير صالح');
      setOverrideLoading(false);
      return;
    }

    try {
      // If we don't have a valid override token yet, request one using secret code
      let token = priceOverrideToken;
      if (!token) {
        const res = await apiRequest<{ success: boolean; token: string }>('/api/auth/verify-price-override', {
          method: 'POST',
          body: JSON.stringify({ code: overrideCode }),
        });
        token = res.token;
        setPriceOverrideToken(token);
      }

      setCart((prev) => {
        const updated = [...prev];
        updated[overrideItemIndex] = {
          ...updated[overrideItemIndex],
          overridePrice: priceNum,
        };
        return updated;
      });

      setShowOverrideModal(false);
    } catch (err: any) {
      setOverrideError(err.message || 'فشل التحقق من رمز التفويض');
    } finally {
      setOverrideLoading(false);
    }
  };

  // Complete checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);

    const payload = {
      customer_name: customerName.trim() || 'عميل نقدي',
      customer_phone: customerPhone.trim() || '',
      payment_type: paymentType,
      installment_months: paymentType === 'installment' ? installmentMonths : 1,
      override_token: priceOverrideToken || undefined,
      items: cart.map((item) => ({
        product_id: item.product.id,
        qty: item.qty,
        override_price: item.overridePrice,
      })),
    };

    try {
      const res = await apiRequest<{ success: boolean; sale: Sale }>('/api/sales', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setFinishedSale(res.sale);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      fetchProducts(searchQuery);
    } catch (err: any) {
      setError(err.message || 'فشلت معالجة عملية البيع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Finished Invoice Modal */}
      {finishedSale && (
        <InvoiceModal
          sale={finishedSale}
          settings={settings}
          onClose={() => setFinishedSale(null)}
        />
      )}

      {/* Price Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <KeyRound className="w-5 h-5" />
              <span>تفويض تعديل سعر الوحدة (Override)</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              يتطلب تعديل السعر المباشر في نقطة البيع إدخال الرمز السري للمسؤول (الرمز الافتراضي: 1997)
            </p>

            {overrideError && (
              <div className="p-3 mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs">
                {overrideError}
              </div>
            )}

            <form onSubmit={handleSubmitOverride} className="space-y-3.5">
              {!priceOverrideToken && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    رمز التفويض السري (Default: 1997)
                  </label>
                  <input
                    type="password"
                    value={overrideCode}
                    onChange={(e) => setOverrideCode(e.target.value)}
                    dir="ltr"
                    required
                    placeholder="1997"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  السعر الاستثنائي الجديد ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={overrideCustomPrice}
                  onChange={(e) => setOverrideCustomPrice(e.target.value)}
                  dir="ltr"
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-mono-numbers focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={overrideLoading}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition disabled:opacity-50"
                >
                  {overrideLoading ? 'جاري التحقق...' : 'تأكيد السعر الجديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Left/Main Column: Product Catalog & Search */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Search & Filter Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو بالرمز المرجعي أو امسح الباركود..."
              className="w-full py-2.5 px-4 pr-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          </div>

          <button
            onClick={() => fetchProducts(searchQuery)}
            title="تحديث قائمة الأصناف"
            className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Product Catalog Grid */}
        <div className="flex-1 overflow-y-auto pr-1 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {products.map((p) => {
              const inStock = p.qty > 0;
              const displayPrice = paymentType === 'cash' ? p.cash_price : p.installment_12m_price;

              return (
                <div
                  key={p.id}
                  onClick={() => inStock && addToCart(p)}
                  className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border transition-all text-right flex flex-col justify-between ${
                    inStock
                      ? 'border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-600 hover:shadow-md cursor-pointer'
                      : 'border-slate-200/50 dark:border-slate-800/50 opacity-60 cursor-not-allowed bg-slate-50/50'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-mono text-slate-400 font-medium">{p.prd_ref}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-mono-numbers font-semibold ${
                          p.qty === 0
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-400'
                            : p.is_low_stock
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400'
                        }`}
                      >
                        {p.qty === 0 ? 'نافد (0)' : `المخزون: ${p.qty}`}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 leading-snug">
                      {p.design}
                    </h4>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {paymentType === 'cash' ? 'سعر البيع نقداً' : 'سعر التقسيط (مرجعي)'}
                      </span>
                      <span className="font-mono-numbers text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        {displayPrice.toLocaleString()} {currency}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!inStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (inStock) addToCart(p);
                      }}
                      className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white transition disabled:opacity-30 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: POS Cart & Checkout Terminal */}
      <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 shadow-lg z-10">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">سلة الفاتورة الحالية</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono-numbers bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
              {cart.reduce((sum, item) => sum + item.qty, 0)}
            </span>
          </div>

          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-red-500 hover:text-red-700 transition"
            >
              تفريغ
            </button>
          )}
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingCart className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-medium">السلة فارغة حالياً</p>
              <p className="text-[11px] text-slate-400 mt-1">اختر الأصناف من القائمة للبدء بعملية البيع</p>
            </div>
          ) : (
            cart.map((item, index) => {
              const unitPrice = getItemUnitPrice(item);
              const lineTotal = unitPrice * item.qty;

              return (
                <div
                  key={item.product.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="truncate pr-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {item.product.design}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.product.prd_ref}</div>
                    </div>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-slate-400 hover:text-red-500 p-1 transition"
                      title="حذف من السلة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {/* Qty controls */}
                    <div className="flex items-center gap-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                      <button
                        onClick={() => updateQty(index, -1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center font-mono-numbers text-xs font-bold">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(index, 1)}
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Price and Line Total */}
                    <div className="text-left">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="font-mono-numbers text-xs font-extrabold text-slate-900 dark:text-white">
                          {lineTotal.toLocaleString()} {currency}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[10px] text-slate-400 font-mono-numbers">
                          ({unitPrice.toLocaleString()} / وحدة)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenOverride(index)}
                          title="تعديل السعر المباشر استثنائياً"
                          className="text-[10px] text-amber-600 hover:underline flex items-center gap-0.5"
                        >
                          <KeyRound className="w-2.5 h-2.5" />
                          <span>تعديل</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Customer Info & Payment Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
          {/* Customer input */}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="اسم العميل (اختياري)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full py-1.5 px-2.5 pr-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <User className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2" />
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="الهاتف"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                dir="ltr"
                className="w-full py-1.5 px-2.5 pl-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
            </div>
          </div>

          {/* Payment Type Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-200/80 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setPaymentType('cash')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                paymentType === 'cash'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>دفع نقدي (Cash)</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentType('installment')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                paymentType === 'installment'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>بيع بالتقسيط</span>
            </button>
          </div>

          {/* Installment Months Selector */}
          {paymentType === 'installment' && (
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold">مدة التقسيط:</span>
                <span className="font-mono-numbers font-bold">{installmentMonths} أشهر</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={installmentMonths}
                onChange={(e) => setInstallmentMonths(parseInt(e.target.value, 10))}
                className="w-full accent-amber-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-semibold text-amber-900 dark:text-amber-200 pt-1 border-t border-amber-200 dark:border-amber-900/40">
                <span>القسط الشهري المقدر:</span>
                <span className="font-mono-numbers">{monthlyShare.toLocaleString()} {currency} / شهر</span>
              </div>
            </div>
          )}

          {/* Total & Checkout Button */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500">المبلغ الإجمالي المستحق:</span>
              <span className="font-mono-numbers text-xl font-black text-slate-900 dark:text-white">
                {subtotal.toLocaleString()} <span className="text-xs font-normal text-slate-500">{currency}</span>
              </span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0 || loading}
              onClick={handleCheckout}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{loading ? 'جاري معالجة الفاتورة...' : 'إتمام البيع وطباعة الفاتورة (A4)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
