import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'Electricity',
  'Water',
  'Rent',
  'Transportation',
  'Maintenance',
  'Supplies',
  'Salaries',
  'Cleaning',
  'Internet',
  'Telephone',
  'Taxes',
  'Delivery',
  'Miscellaneous',
] as const;

export const LoginSchema = z.object({
  username: z.string().min(2, 'اسم المستخدم مطلوب'),
  password: z.string().min(3, 'كلمة المرور مطلوبة'),
});

export const PriceOverrideVerifySchema = z.object({
  code: z.string().min(1, 'رمز التفويض مطلوب'),
});

export const ProductCreateSchema = z.object({
  prd_ref: z.string().min(1, 'الرمز المرجعي مطلوب').trim(),
  design: z.string().min(1, 'اسم الصنف أو التعيين مطلوب').trim(),
  qty: z.coerce.number().int().min(0, 'الكمية يجب أن تكون 0 أو أكثر'),
  cost_price: z.coerce.number().min(0, 'سعر التكلفة يجب أن يكون 0 أو أكثر'),
});

export const ProductUpdateSchema = ProductCreateSchema.partial();

export const ProductAdjustSchema = z.object({
  qty_change: z.coerce.number().int().refine(n => n !== 0, 'يجب تحديد مقدار التغيير'),
  reason: z.string().min(3, 'سبب التعديل إلزامي لتوثيق الحركة'),
});

export const SaleItemInputSchema = z.object({
  product_id: z.string().min(1, 'معرف المنتج مطلوب'),
  qty: z.coerce.number().int().min(1, 'الكمية يجب أن تكون 1 على الأقل'),
  override_price: z.coerce.number().min(0).optional(),
});

export const SaleCreateSchema = z.object({
  customer_name: z.string().default('عميل نقدي'),
  customer_phone: z.string().optional().default(''),
  payment_type: z.enum(['cash', 'installment']),
  installment_months: z.coerce.number().int().min(1).max(12).default(1),
  override_token: z.string().optional(),
  items: z.array(SaleItemInputSchema).min(1, 'يجب إضافة صنف واحد على الأقل للسلة'),
});

export const PurchaseItemInputSchema = z.object({
  product_id: z.string().optional(),
  prd_ref: z.string().min(1, 'الرمز المرجعي مطلوب').trim(),
  design: z.string().min(1, 'اسم الصنف مطلوب').trim(),
  qty: z.coerce.number().int().min(1, 'الكمية يجب أن تكون 1 على الأقل'),
  unit_cost: z.coerce.number().min(0, 'سعر الشراء يجب أن يكون 0 أو أكثر'),
});

export const PurchaseCreateSchema = z.object({
  supplier: z.string().min(1, 'اسم المورد مطلوب').trim(),
  note: z.string().optional().default(''),
  items: z.array(PurchaseItemInputSchema).min(1, 'يجب إضافة صنف واحد على الأقل'),
});

export const CashTransactionCreateSchema = z.object({
  type: z.enum(['inflow', 'outflow']),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من الصفر'),
  source: z.string().min(1, 'فئة العملية أو مصدرها مطلوب'),
  description: z.string().min(1, 'الوصف والبيان مطلوب'),
  reference: z.string().optional().default(''),
  payment_method: z.enum(['cash', 'check', 'bank_transfer']).default('cash'),
});

export const SettingsUpdateSchema = z.object({
  store_name: z.string().min(1).optional(),
  store_phone: z.string().optional(),
  store_address: z.string().optional(),
  currency: z.string().min(1).optional(),
  markup_cash_percent: z.coerce.number().min(0).max(500).optional(),
  markup_installment_percent: z.coerce.number().min(0).max(500).optional(),
  rounding_unit: z.coerce.number().int().positive().optional(),
  low_stock_threshold: z.coerce.number().int().min(0).optional(),
  language: z.enum(['ar', 'en']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  new_price_edit_code: z.string().min(3).optional(),
});

// مخطط طلب حفظ النسخة على قرص الحاسوب
export const SaveLocalSnapshotSchema = z.object({
  password: z.string().min(1, 'كلمة المرور مطلوبة لتأكيد حفظ النسخة الاحتياطية'),
});

// مخطط فحص ملف النسخة من قرص الحاسوب
export const InspectLocalSnapshotSchema = z.object({
  filePath: z.string().min(1, 'مسار الملف على الحاسوب مطلوب'),
});

// مخطط استعادة البيانات مع الحفاظ على مستخدمي الجهاز
export const RestoreDataPreserveAccountsSchema = z.object({
  password: z.string().min(1, 'كلمة المرور مطلوبة لتأكيد الاستعادة'),
  previewId: z.string().min(1, 'معرف المعاينة غير صالح أو منتهي الصلاحية'),
  filePath: z.string().min(1, 'مسار الملف على الحاسوب مطلوب'),
});

export const UserCreateSchema = z.object({
  username: z.string().min(3, 'اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل').trim(),
  password: z.string().min(4, 'كلمة المرور يجب أن تتكون من 4 أحرف على الأقل'),
  role: z.enum(['admin', 'user']),
});

export const UserUpdateSchema = z.object({
  password: z.string().min(4).optional(),
  role: z.enum(['admin', 'user', 'founder']).optional(),
  is_active: z.coerce.number().int().min(0).max(1).optional(),
});
