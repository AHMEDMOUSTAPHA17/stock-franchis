import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, dbTransaction } from '../db.ts';
import { requireAuth, requireRole, logAudit, maskProduct } from '../auth.ts';
import { ProductCreateSchema, ProductUpdateSchema, ProductAdjustSchema } from '../../shared/schemas.ts';
import { calculateCashPrice, calculateInstallment12mPrice } from '../../shared/pricing.ts';

export const inventoryRouter = Router();

inventoryRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim();
  const lowStockOnly = req.query.lowStock === '1' || req.query.lowStock === 'true';
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '50', 10)));
  const offset = (page - 1) * limit;

  const settings = db.prepare(`
    SELECT markup_cash_percent, markup_installment_percent, rounding_unit, low_stock_threshold
    FROM settings WHERE id = 1
  `).get() as any;

  let query = 'SELECT * FROM products WHERE 1=1';
  const params: any[] = [];

  if (q) {
    query += ' AND (prd_ref LIKE ? OR design LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  if (lowStockOnly) {
    query += ' AND qty <= ?';
    params.push(settings.low_stock_threshold);
  }

  const countQuery = query.replace('SELECT *', 'SELECT count(*) as total');
  const countRow = db.prepare(countQuery).get(...params) as { total: number };

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const rawProducts = db.prepare(query).all(...params) as any[];

  // Augment with dynamic pricing and mask cost if cashier/user
  const products = rawProducts.map((p) => {
    const cashPrice = calculateCashPrice(p.cost_price, settings.markup_cash_percent, settings.rounding_unit);
    const installment12mPrice = calculateInstallment12mPrice(
      p.cost_price,
      settings.markup_installment_percent,
      settings.rounding_unit
    );

    const isLowStock = p.qty <= settings.low_stock_threshold;
    const isOutOfStock = p.qty === 0;

    const enriched = {
      ...p,
      cash_price: cashPrice,
      installment_12m_price: installment12mPrice,
      is_low_stock: isLowStock,
      is_out_of_stock: isOutOfStock,
    };

    return maskProduct(enriched, req.user?.role);
  });

  return res.json({
    products,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit),
    threshold: settings.low_stock_threshold,
  });
});

inventoryRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
  if (!p) {
    return res.status(404).json({ error: 'المنتج غير موجود' });
  }

  const settings = db.prepare(`
    SELECT markup_cash_percent, markup_installment_percent, rounding_unit
    FROM settings WHERE id = 1
  `).get() as any;

  const enriched = {
    ...p,
    cash_price: calculateCashPrice(p.cost_price, settings.markup_cash_percent, settings.rounding_unit),
    installment_12m_price: calculateInstallment12mPrice(
      p.cost_price,
      settings.markup_installment_percent,
      settings.rounding_unit
    ),
  };

  return res.json(maskProduct(enriched, req.user?.role));
});

inventoryRouter.post('/', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const parsed = ProductCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { prd_ref, design, qty, cost_price } = parsed.data;

  // Check unique ref
  const existing = db.prepare('SELECT id FROM products WHERE prd_ref = ? COLLATE NOCASE').get(prd_ref);
  if (existing) {
    return res.status(400).json({ error: `الرمز المرجعي (${prd_ref}) مستخدم بالفعل لمنتج آخر` });
  }

  const id = crypto.randomUUID();

  dbTransaction(() => {
    db.prepare(`
      INSERT INTO products (id, prd_ref, design, qty, cost_price)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, prd_ref, design, qty, cost_price);

    if (qty > 0) {
      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, qty_change, type, ref_type, ref_id, created_by)
        VALUES (?, ?, ?, 'import', 'manual_create', ?, ?)
      `).run(crypto.randomUUID(), id, qty, id, req.user!.id);
    }

    logAudit(req, 'PRODUCT_CREATE', 'products', id, { prd_ref, design, qty, cost_price });
  });

  return res.status(201).json({ success: true, id, message: 'تمت إضافة المنتج بنجاح' });
});

inventoryRouter.put('/:id', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const id = req.params.id;
  const parsed = ProductUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!current) {
    return res.status(404).json({ error: 'المنتج غير موجود' });
  }

  const prd_ref = parsed.data.prd_ref ?? current.prd_ref;
  const design = parsed.data.design ?? current.design;
  const cost_price = parsed.data.cost_price ?? current.cost_price;

  // Verify unique ref if changed
  if (prd_ref.toLowerCase() !== current.prd_ref.toLowerCase()) {
    const existing = db.prepare('SELECT id FROM products WHERE prd_ref = ? COLLATE NOCASE AND id != ?').get(prd_ref, id);
    if (existing) {
      return res.status(400).json({ error: `الرمز المرجعي (${prd_ref}) مستخدم بالفعل لمنتج آخر` });
    }
  }

  dbTransaction(() => {
    db.prepare(`
      UPDATE products
      SET prd_ref = ?, design = ?, cost_price = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(prd_ref, design, cost_price, id);

    logAudit(req, 'PRODUCT_UPDATE', 'products', id, {
      old: { prd_ref: current.prd_ref, design: current.design, cost_price: current.cost_price },
      new: { prd_ref, design, cost_price },
    });
  });

  return res.json({ success: true, message: 'تم تحديث بيانات الصنف بنجاح' });
});

inventoryRouter.post('/:id/adjust', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const id = req.params.id;
  const parsed = ProductAdjustSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { qty_change, reason } = parsed.data;

  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!current) {
    return res.status(404).json({ error: 'المنتج غير موجود' });
  }

  if (current.qty + qty_change < 0) {
    return res.status(400).json({ error: 'لا يمكن أن تصبح الكمية سالبة بعد التصحيح' });
  }

  dbTransaction(() => {
    db.prepare(`
      UPDATE products
      SET qty = qty + ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(qty_change, id);

    const movId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO inventory_movements (id, product_id, qty_change, type, ref_type, ref_id, created_by)
      VALUES (?, ?, ?, 'adjustment', ?, ?, ?)
    `).run(movId, id, qty_change, reason, id, req.user!.id);

    logAudit(req, 'INVENTORY_ADJUST', 'products', id, {
      product: current.design,
      old_qty: current.qty,
      new_qty: current.qty + qty_change,
      qty_change,
      reason,
    });
  });

  return res.json({
    success: true,
    message: 'تم تصحيح رصيد المخزون بنجاح وتوثيق الحركة وسجل التدقيق',
    new_qty: current.qty + qty_change,
  });
});

inventoryRouter.get('/:id/movements', requireAuth, (req: Request, res: Response) => {
  const id = req.params.id;
  const movements = db.prepare(`
    SELECT m.*, u.username as created_by_name
    FROM inventory_movements m
    JOIN users u ON u.id = m.created_by
    WHERE m.product_id = ?
    ORDER BY m.created_at DESC
    LIMIT 100
  `).all(id);

  return res.json(movements);
});
