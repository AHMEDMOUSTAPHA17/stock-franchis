import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.ts';
import { requireAuth, requireRole, logAudit, getPriceEditSecret } from '../auth.ts';
import { SettingsUpdateSchema } from '../../shared/schemas.ts';

export const settingsRouter = Router();

settingsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const settings = db.prepare(`
    SELECT store_name, store_phone, store_address, currency,
           markup_cash_percent, markup_installment_percent, rounding_unit,
           low_stock_threshold, language, theme
    FROM settings WHERE id = 1
  `).get();

  return res.json(settings);
});

settingsRouter.put('/', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const parsed = SettingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const current = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;

  const store_name = parsed.data.store_name ?? current.store_name;
  const store_phone = parsed.data.store_phone ?? current.store_phone;
  const store_address = parsed.data.store_address ?? current.store_address;
  const currency = parsed.data.currency ?? current.currency;
  const markup_cash_percent = parsed.data.markup_cash_percent ?? current.markup_cash_percent;
  const markup_installment_percent = parsed.data.markup_installment_percent ?? current.markup_installment_percent;
  const rounding_unit = parsed.data.rounding_unit ?? current.rounding_unit;
  const low_stock_threshold = parsed.data.low_stock_threshold ?? current.low_stock_threshold;
  const language = parsed.data.language ?? current.language;
  const theme = parsed.data.theme ?? current.theme;

  let price_edit_code_hash = current.price_edit_code_hash;
  if (parsed.data.new_price_edit_code) {
    const secret = getPriceEditSecret();
    price_edit_code_hash = crypto
      .createHmac('sha256', secret)
      .update(parsed.data.new_price_edit_code.trim())
      .digest('hex');
  }

  db.prepare(`
    UPDATE settings
    SET store_name = ?, store_phone = ?, store_address = ?, currency = ?,
        markup_cash_percent = ?, markup_installment_percent = ?, rounding_unit = ?,
        low_stock_threshold = ?, language = ?, theme = ?, price_edit_code_hash = ?
    WHERE id = 1
  `).run(
    store_name,
    store_phone,
    store_address,
    currency,
    markup_cash_percent,
    markup_installment_percent,
    rounding_unit,
    low_stock_threshold,
    language,
    theme,
    price_edit_code_hash
  );

  logAudit(req, 'SETTINGS_UPDATE', 'settings', '1', {
    store_name,
    markup_cash_percent,
    markup_installment_percent,
    rounding_unit,
    code_updated: Boolean(parsed.data.new_price_edit_code),
  });

  return res.json({ success: true, message: 'تم حفظ وتحديث الإعدادات بنجاح' });
});
