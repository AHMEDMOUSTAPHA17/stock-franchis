import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, dbTransaction } from '../db.ts';
import { requireAuth, requireRole, logAudit } from '../auth.ts';
import { PurchaseCreateSchema } from '../../shared/schemas.ts';

export const purchasesRouter = Router();

purchasesRouter.post('/', requireAuth, requireRole(['founder', 'admin', 'user']), (req: Request, res: Response) => {
  const parsed = PurchaseCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { supplier, note, items } = parsed.data;

  try {
    const purchaseResult = dbTransaction(() => {
      const purchaseId = crypto.randomUUID();
      let totalCost = 0;
      const processedItems: any[] = [];

      // 1. Calculate totalCost first and prepare items
      for (const item of items) {
        totalCost += Math.round(item.unit_cost * item.qty * 100) / 100;
      }

      // 2. Insert purchase header FIRST to satisfy foreign key constraint
      db.prepare(`
        INSERT INTO purchases (id, supplier, note, source, total_cost, created_by)
        VALUES (?, ?, ?, 'manual', ?, ?)
      `).run(purchaseId, supplier, note || '', totalCost, req.user!.id);

      // 3. Process items and insert into purchase_items
      for (const item of items) {
        const lineTotal = Math.round(item.unit_cost * item.qty * 100) / 100;

        // Check if product exists by ref
        let product = db.prepare('SELECT * FROM products WHERE prd_ref = ? COLLATE NOCASE').get(item.prd_ref) as any;
        let productId = product?.id;

        if (product) {
          // Update existing product stock and cost
          db.prepare(`
            UPDATE products
            SET qty = qty + ?, cost_price = ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(item.qty, item.unit_cost, product.id);
        } else {
          // Create new product
          productId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO products (id, prd_ref, design, qty, cost_price)
            VALUES (?, ?, ?, ?, ?)
          `).run(productId, item.prd_ref, item.design, item.qty, item.unit_cost);
        }

        const purchaseItemId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO purchase_items (id, purchase_id, product_id, prd_ref, design, qty, unit_cost, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          purchaseItemId,
          purchaseId,
          productId,
          item.prd_ref,
          item.design,
          item.qty,
          item.unit_cost,
          lineTotal
        );

        // Record movement
        db.prepare(`
          INSERT INTO inventory_movements (id, product_id, qty_change, type, ref_type, ref_id, created_by)
          VALUES (?, ?, ?, 'purchase', 'purchase_invoice', ?, ?)
        `).run(
          crypto.randomUUID(),
          productId,
          item.qty,
          purchaseId,
          req.user!.id
        );

        processedItems.push({
          id: purchaseItemId,
          product_id: productId,
          prd_ref: item.prd_ref,
          design: item.design,
          qty: item.qty,
          unit_cost: item.unit_cost,
          line_total: lineTotal,
        });
      }

      logAudit(req, 'PURCHASE_CREATE', 'purchases', purchaseId, {
        supplier,
        itemsCount: items.length,
        total_cost: totalCost,
      });

      return {
        id: purchaseId,
        supplier,
        note,
        source: 'manual',
        total_cost: totalCost,
        items: processedItems,
        created_at: new Date().toISOString(),
        created_by_name: req.user!.username,
      };
    });

    return res.status(201).json({
      success: true,
      message: 'تم تسجيل فاتورة التوريد وتحديث المخزون بنجاح',
      purchase: purchaseResult,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشلت معالجة فاتورة المشتريات' });
  }
});

purchasesRouter.get('/', requireAuth, requireRole(['founder', 'admin', 'user']), (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
  const offset = (page - 1) * limit;

  const countRow = db.prepare('SELECT count(*) as total FROM purchases').get() as { total: number };

  const rawPurchases = db.prepare(`
    SELECT p.*, u.username as created_by_name,
           (SELECT count(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as items_count
    FROM purchases p
    JOIN users u ON u.id = p.created_by
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as any[];

  // Strict Invariant #4: Mask cost details for normal cashier/user
  const isCashier = req.user?.role === 'user';
  const purchases = rawPurchases.map((p) => {
    if (isCashier) {
      const { total_cost, ...rest } = p;
      return rest;
    }
    return p;
  });

  return res.json({
    purchases,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit),
  });
});

purchasesRouter.get('/:id', requireAuth, requireRole(['founder', 'admin', 'user']), (req: Request, res: Response) => {
  const purchase = db.prepare(`
    SELECT p.*, u.username as created_by_name
    FROM purchases p
    JOIN users u ON u.id = p.created_by
    WHERE p.id = ?
  `).get(req.params.id) as any;

  if (!purchase) {
    return res.status(404).json({ error: 'فاتورة التوريد غير موجودة' });
  }

  const rawItems = db.prepare(`
    SELECT * FROM purchase_items WHERE purchase_id = ?
  `).all(purchase.id) as any[];

  // Strict Invariant #4: Mask cost details for normal cashier/user
  const isCashier = req.user?.role === 'user';
  const items = rawItems.map((item) => {
    if (isCashier) {
      const { unit_cost, line_total, ...rest } = item;
      return rest;
    }
    return item;
  });

  const sanitizedPurchase = isCashier
    ? (({ total_cost, ...rest }) => rest)(purchase)
    : purchase;

  return res.json({
    ...sanitizedPurchase,
    items,
  });
});
