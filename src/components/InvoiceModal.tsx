import React from 'react';
import { Sale, StoreSettings } from '../types/index.ts';
import { Printer, X, CheckCircle } from 'lucide-react';

interface InvoiceModalProps {
  sale: Sale;
  settings?: StoreSettings | null;
  onClose: () => void;
}

export function InvoiceModal({ sale, settings, onClose }: InvoiceModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const currency = settings?.currency || 'DZD';
  const isInstallment = sale.payment_type === 'installment';
  const monthlyShare = isInstallment && sale.installment_months > 0
    ? Math.round((sale.total_amount / sale.installment_months) * 100) / 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Actions - Hidden during print */}
        <div className="no-print p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
            <CheckCircle className="w-5 h-5" />
            <span>تم إصدار الفاتورة وتثبيتها بالخزينة والمخزون بنجاح</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فورية (A4)</span>
            </button>
            <button
              onClick={onClose}
              aria-label="إغلاق نافذة الفاتورة"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable A4 Invoice Document */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white text-slate-900" id="printable-invoice">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {settings?.store_name || 'G.STOCK Franchise'}
              </h2>
              <p className="text-xs text-slate-600 mt-1">تجارة العتاد، الأدوات الصناعية ومواد البناء</p>
              <p className="text-xs text-slate-600">
                {settings?.store_address || 'حي النصر، آفلو، ولاية الأغواط'} | هاتف: {settings?.store_phone || '029 00 11 22'}
              </p>
            </div>
            <div className="text-left">
              <span className="inline-block px-3 py-1 bg-slate-900 text-white font-mono font-bold text-sm rounded">
                فاتورة بيع
              </span>
              <p className="font-mono-numbers text-xs font-bold text-slate-800 mt-2">
                {sale.invoice_number}
              </p>
              <p className="text-[11px] text-slate-500 font-mono-numbers">
                {new Date(sale.created_at).toLocaleString('ar-DZ')}
              </p>
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-lg text-xs mb-6 border border-slate-200">
            <div>
              <span className="text-slate-500 block">اسم العميل:</span>
              <span className="font-semibold text-slate-800">{sale.customer_name || 'عميل نقدي مباشر'}</span>
              {sale.customer_phone && (
                <span className="text-slate-600 block font-mono-numbers">{sale.customer_phone}</span>
              )}
            </div>
            <div>
              <span className="text-slate-500 block">طريقة السداد:</span>
              <span className="font-semibold text-slate-800">
                {isInstallment
                  ? `بيع بالتقسيط (${sale.installment_months} أشهر)`
                  : 'دفع نقدي فوري (Cash)'}
              </span>
              <span className="text-slate-500 block mt-1">البائع: {sale.created_by_name || 'الكاشير'}</span>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-xs text-right border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-slate-900 bg-slate-100">
                <th className="py-2 px-2 font-bold text-slate-700">#</th>
                <th className="py-2 px-2 font-bold text-slate-700">المرجع</th>
                <th className="py-2 px-2 font-bold text-slate-700">البيان والصنف</th>
                <th className="py-2 px-2 font-bold text-slate-700 text-center">الكمية</th>
                <th className="py-2 px-2 font-bold text-slate-700 text-left">سعر الوحدة</th>
                <th className="py-2 px-2 font-bold text-slate-700 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sale.items?.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-slate-50">
                  <td className="py-2 px-2 text-slate-400 font-mono-numbers">{idx + 1}</td>
                  <td className="py-2 px-2 font-mono font-medium text-slate-700">{item.prd_ref}</td>
                  <td className="py-2 px-2 font-medium text-slate-900">{item.design}</td>
                  <td className="py-2 px-2 text-center font-mono-numbers font-semibold">{item.qty}</td>
                  <td className="py-2 px-2 text-left font-mono-numbers">
                    {item.unit_price.toLocaleString()} {currency}
                  </td>
                  <td className="py-2 px-2 text-left font-mono-numbers font-bold text-slate-900">
                    {item.line_total.toLocaleString()} {currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Summary */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200 text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-mono-numbers font-medium">{sale.subtotal.toLocaleString()} {currency}</span>
              </div>
              <div className="flex justify-between py-1 text-sm font-bold text-slate-900 border-b-2 border-slate-900">
                <span>المبلغ الإجمالي المستحق:</span>
                <span className="font-mono-numbers text-base text-emerald-700">
                  {sale.total_amount.toLocaleString()} {currency}
                </span>
              </div>
              {isInstallment && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[11px]">
                  <div className="flex justify-between font-semibold">
                    <span>القسط الشهري ({sale.installment_months} أشهر):</span>
                    <span className="font-mono-numbers">{monthlyShare.toLocaleString()} {currency}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Terms */}
          <div className="border-t border-slate-200 pt-3 text-[10px] text-slate-500 text-center">
            <p>شكراً لتعاملكم معنا. البضاعة المباعة ترد أو تستبدل خلال 48 ساعة بشرط سلامتها مع إحضار الفاتورة الأصلية.</p>
            <p className="mt-0.5 font-mono">طبع بواسطة نظام G.STOCK-Franchise v3.0.0</p>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="no-print p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            إغلاق ومتابعة البيع
          </button>
        </div>
      </div>
    </div>
  );
}
