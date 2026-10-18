import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiRequest } from '../services/api.ts';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export function ImportView() {
  const { settings } = useAuth();
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [sourceType, setSourceType] = useState<'excel' | 'flb'>('excel');
  const [rawText, setRawText] = useState('');
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Staging Preview Data
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [sampleItems, setSampleItems] = useState<any[]>([]);

  // Commit result
  const [commitResult, setCommitResult] = useState<any>(null);

  const currency = settings?.currency || 'DZD';

  // Quick Sample Generator for immediate zero-friction testing
  const loadSampleData = () => {
    const sample = `ref,design,qty,cost_price
REF-DWT-20,مثقاب ديوالت شحن احترافي 18 فولت (DeWalt DCD771),10,16500
REF-STN-21,مفتاح ربط قابل للتعديل 10 إنش ستانلي (Stanley),25,1850
REF-KLN-22,زرادية قطع كابلات كهربائية معزولة 1000 فولت,15,2200
REF-MKT-01,مثقاب كهربائي ماكيتا 710 واط (Makita HP1630),5,8600
REF-BSH-02,صاروخ جلخ بوش 115 ملم 750 واط (Bosch GWS 750),8,7300`;
    setRawText(sample);
    setFileName('sample_hardware_stock.csv');
    setSourceType('excel');
    setError(null);
  };

  const loadFlbSampleData = () => {
    const flbSample = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<Bon>
  <Product>
    <PrdRef>TEL/2778</PrdRef>
    <OrgDesign>TEL PORTABLE SAMSUNG A16 4/128GB</OrgDesign>
    <Design>TEL PORTABLE SAMSUNG A16 4/128GB</Design>
    <Qts>2</Qts>
    <Remise>0.00</Remise>
    <PrixVente>36380.00</PrixVente>
    <MottantHt>72760.00</MottantHt>
    <TVA>0</TVA>
    <TauxTVA>0.00</TauxTVA>
    <Mottant>72760.00</Mottant>
  </Product>
  <Product>
    <PrdRef>TEL/3062</PrdRef>
    <OrgDesign>TEL PORTABLE HONOR X6C 6/128GB</OrgDesign>
    <Design>TEL PORTABLE HONOR X6C 6/128GB</Design>
    <Qts>2</Qts>
    <Remise>0.00</Remise>
    <PrixVente>37 450.00</PrixVente>
    <MottantHt>74 900.00</MottantHt>
    <TVA>0</TVA>
    <TauxTVA>0.00</TauxTVA>
    <Mottant>74 900.00</Mottant>
  </Product>
  <Product>
    <PrdRef>PC-LAP/1018</PrdRef>
    <OrgDesign>PC LENOVO V15 G2 11(G) INTEL CELE N4500 8/256GB</OrgDesign>
    <Design>PC LENOVO V15 G2 11(G) INTEL CELE N4500 8/256GB</Design>
    <Qts>1</Qts>
    <Remise>0.00</Remise>
    <PrixVente>65 270.00</PrixVente>
    <MottantHt>65 270.00</MottantHt>
    <TVA>0</TVA>
    <TauxTVA>0.00</TauxTVA>
    <Mottant>65 270.00</Mottant>
  </Product>
</Bon>`;
    setRawText(flbSample);
    setFileName('sample_bon_livraison.flb');
    setSourceType('flb');
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xml') || lowerName.endsWith('.flb')) {
      setSourceType('flb');
    } else {
      setSourceType('excel');
    }

    reader.onload = (event) => {
      const result = event.target?.result as string;
      // Extract base64 without prefix
      const base64 = result.split(',')[1] || result;
      setFileBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Step 1 -> Step 2: Parse, Normalize & Stage
  const handleStagePreview = async () => {
    if (!fileBase64 && !rawText.trim()) {
      setError('يرجى اختيار ملف Excel أو FLB/XML أو لصق بيانات نصية أولاً');
      return;
    }

    setLoading(true);
    setError(null);

    const effectiveSource = (fileBase64 && (fileName.toLowerCase().endsWith('.xml') || fileName.toLowerCase().endsWith('.flb')))
      || (rawText.trim().startsWith('<') || rawText.includes('<Product>') || rawText.includes('<Bon>'))
      ? 'flb'
      : sourceType;

    try {
      const data = await apiRequest('/api/import/stage', {
        method: 'POST',
        body: JSON.stringify({
          fileData: fileBase64,
          fileName,
          rawText: rawText.trim() || undefined,
          sourceType: effectiveSource,
        }),
      });

      setPreviewId(data.previewId);
      setStats(data.stats);
      setSampleItems(data.sampleItems || []);
      setActiveStep(2);
    } catch (err: any) {
      setError(err.message || 'فشلت معالجة ملف الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> Step 3: Atomic Commit
  const handleCommit = async () => {
    if (!previewId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiRequest('/api/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          previewId,
          supplier: `توريد واستيراد (${fileName || 'بيانات نصية'})`,
        }),
      });

      setCommitResult(data.result);
      setActiveStep(3);
    } catch (err: any) {
      setError(err.message || 'فشلت عملية تثبيت الاستيراد');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(1);
    setFileName('');
    setRawText('');
    setFileBase64(null);
    setPreviewId(null);
    setStats(null);
    setCommitResult(null);
    setError(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Title & 3-Step Wizard Progress */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>محرك استيراد الملفات الآمن ثلاثي المراحل (Safe 3-Step Import)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              معالجة آمنة لملفات Excel ومنظومة FLB/XML القديمة مع دمج تراكمي ومعاملة ذرية محمية
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadFlbSampleData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>تجربة ملف FLB حقيقي (Bon/XML)</span>
            </button>

            <button
              type="button"
              onClick={loadSampleData}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>تجربة عينة CSV/Excel</span>
            </button>
          </div>
        </div>

        {/* Step indicators */}
        <div className="grid grid-cols-3 gap-2 text-xs font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
          <div
            className={`p-3 rounded-xl flex items-center gap-2.5 ${
              activeStep === 1
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                : 'text-slate-400 bg-slate-50 dark:bg-slate-800/40'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
              1
            </span>
            <span>المرحلة 1: القراءة وتوحيد البنية</span>
          </div>

          <div
            className={`p-3 rounded-xl flex items-center gap-2.5 ${
              activeStep === 2
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                : 'text-slate-400 bg-slate-50 dark:bg-slate-800/40'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-slate-600 text-white flex items-center justify-center text-xs">
              2
            </span>
            <span>المرحلة 2: المعاينة والإحصاء (Staging)</span>
          </div>

          <div
            className={`p-3 rounded-xl flex items-center gap-2.5 ${
              activeStep === 3
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700'
                : 'text-slate-400 bg-slate-50 dark:bg-slate-800/40'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-slate-600 text-white flex items-center justify-center text-xs">
              3
            </span>
            <span>المرحلة 3: التثبيت الذري (Commit)</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Upload & Input */}
      {activeStep === 1 && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Drag/Drop */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-emerald-500 transition flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-800/30">
              <Upload className="w-10 h-10 text-slate-400 mb-3" />
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">
                رفع ملف Excel أو FLB/XML
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                يدعم صيغ .xlsx, .xls, .xml, .flb
              </p>

              <label className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer shadow-sm transition">
                <span>استعراض الملفات من الحاسوب</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.xml,.flb,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fileName && (
                <div className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 text-xs font-mono font-medium">
                  الملف المختار: {fileName}
                </div>
              )}
            </div>

            {/* Paste Data directly */}
            <div className="flex flex-col">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                أو لصق بيانات نصية مباشرة (محتوى ملف FLB المفتوح عبر المفكرة Bloc-notes / XML أو CSV):
              </label>
              <textarea
                rows={7}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setError(null);
                  if (e.target.value.trim().startsWith('<') || e.target.value.includes('<Bon>') || e.target.value.includes('<Product>')) {
                    setSourceType('flb');
                  }
                }}
                dir="ltr"
                placeholder={`<?xml version="1.0" encoding="utf-8"?>\n<Bon>\n  <Product>\n    <PrdRef>TEL/2778</PrdRef>\n    <Design>TEL PORTABLE SAMSUNG A16 4/128GB</Design>\n    <Qts>2</Qts>\n    <PrixVente>36380.00</PrixVente>\n  </Product>\n</Bon>`}
                className="w-full flex-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleStagePreview}
              disabled={loading || (!fileBase64 && !rawText.trim())}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <span>{loading ? 'جاري الفحص والتحليل...' : 'الانتقال إلى المعاينة والإحصاء (المرحلة 2)'}</span>
              <ArrowRight className="w-4 h-4 transform rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Staging Preview */}
      {activeStep === 2 && stats && (
        <div className="space-y-6">
          {/* Statistics Summary Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 block mb-1">إجمالي الأصناف المعالجة</span>
              <span className="font-mono-numbers text-xl font-black text-slate-900 dark:text-white">
                {stats.totalItems}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-1 font-semibold">
                أصناف جديدة تضاف للمخزون
              </span>
              <span className="font-mono-numbers text-xl font-black text-emerald-600">
                +{stats.newCount}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 block mb-1 font-semibold">
                أصناف مسبقة تدمج تراكمياً
              </span>
              <span className="font-mono-numbers text-xl font-black text-indigo-600">
                ~{stats.updatedCount}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-xs text-slate-500 block mb-1">قيمة الشراء الإجمالية</span>
              <span className="font-mono-numbers text-lg font-black text-slate-900 dark:text-white">
                {Number(stats.totalCost || 0).toLocaleString()} {currency}
              </span>
            </div>
          </div>

          {/* Staged Items Preview Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                  معاينة بنود الاستيراد المؤقتة (عينة من 50 صنفاً)
                </h4>
              </div>
              <span className="text-[11px] text-amber-600 font-medium">
                معرف المعاينة صالح لـ 30 دقيقة
              </span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-right">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">الرمز المرجعي</th>
                    <th className="py-2.5 px-4 font-bold">اسم وتعيين الصنف</th>
                    <th className="py-2.5 px-4 font-bold text-center">الكمية الواردة</th>
                    <th className="py-2.5 px-4 font-bold text-left">سعر التكلفة</th>
                    <th className="py-2.5 px-4 font-bold text-center">حالة الصنف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sampleItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-4 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {item.prd_ref}
                      </td>
                      <td className="py-2 px-4 font-semibold text-slate-900 dark:text-white">
                        {item.design}
                      </td>
                      <td className="py-2 px-4 text-center font-mono-numbers font-bold text-emerald-600">
                        +{item.qty}
                      </td>
                      <td className="py-2 px-4 text-left font-mono-numbers">
                        {item.cost_price.toLocaleString()} {currency}
                      </td>
                      <td className="py-2 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.is_new
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                          }`}
                        >
                          {item.is_new ? 'جديد' : `تحديث (المخزون الحالي: ${item.existing_qty})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action Bar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition"
              >
                إلغاء وإعادة الرفع
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleCommit}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                <Database className="w-4 h-4" />
                <span>{loading ? 'جاري التنفيذ الذري...' : 'تثبيت الاستيراد وتحديث المخزون الآن (المرحلة 3)'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Commit Success */}
      {activeStep === 3 && commitResult && (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">
            تم تثبيت الاستيراد الذري بنجاح تام!
          </h3>
          <p className="text-xs text-slate-500">
            تم تحديث المخزون، ودمج الكميات التراكمية، وتسجيل فاتورة مشتريات وتوثيق سجل الحركات وسجل التدقيق الأمني.
          </p>

          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-2 text-right border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">الأصناف المحدثة:</span>
              <span className="font-bold font-mono-numbers">{commitResult.committedCount} صنفاً</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">إجمالي الكميات المضافة:</span>
              <span className="font-bold font-mono-numbers">+{commitResult.stats?.totalQty} وحدة</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">إجمالي القيمة:</span>
              <span className="font-bold font-mono-numbers text-emerald-600">{commitResult.stats?.totalCost.toLocaleString()} {currency}</span>
            </div>
          </div>

          <button
            onClick={handleReset}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition"
          >
            استيراد ملف آخر
          </button>
        </div>
      )}
    </div>
  );
}
