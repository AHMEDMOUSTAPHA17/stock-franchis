import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, dbTransaction } from '../db.ts';
import { requireAuth, logAudit, verifyPriceOverrideToken } from '../auth.ts';
import { SaleCreateSchema } from '../../shared/schemas.ts';
import { calculateCashPrice, calculateInstallmentMonthPrice } from '../../shared/pricing.ts';

export const salesRouter = Router();

salesRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const parsed = SaleCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { customer_name, customer_phone, payment_type, installment_months, override_token, items } = parsed.data;

  // Retrieve current pricing settings
  const settings = db.prepare(`
    SELECT markup_cash_percent, markup_installment_percent, rounding_unit, currency
    FROM settings WHERE id = 1
  `).get() as any;

  try {
    const saleResult = dbTransaction(() => {
      // 1. Validate override token if any item has override_price
      const hasOverride = items.some(it => it.override_price !== undefined && it.override_price !== null);
      if (hasOverride) {
        if (!override_token || !verifyPriceOverrideToken(override_token, req.user!.id)) {
          throw new Error('رمز تفويض تعديل السعر غير صالح أو منتهي الصلاحية');
        }
      }

      // 2. Compute sequence for invoice number INV-YYYY-XXXXX
      db.prepare('UPDATE sequences SET value = value + 1 WHERE name = ?').run('sales');
      const seqRow = db.prepare('SELECT value FROM sequences WHERE name = ?').get('sales') as { value: number };
      const currentYear = new Date().getFullYear();
      const invoiceNumber = `INV-${currentYear}-${String(seqRow.value).padStart(5, '0')}`;

      const saleId = crypto.randomUUID();
      let calculatedTotal = 0;
      const processedItems: any[] = [];

      // 3. First compute items, validate stock, and deduct atomically
      const itemsToInsert: any[] = [];
      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
        if (!product) {
          throw new Error(`المنتج بالمعرف ${item.product_id} غير متوفر في النظام`);
        }

        // Atomic anti-concurrency stock deduction
        const deductResult = db.prepare(`
          UPDATE products
          SET qty = qty - ?, updated_at = datetime('now', 'localtime')
          WHERE id = ? AND qty >= ?
        `).run(item.qty, item.product_id, item.qty);

        if (deductResult.changes === 0) {
          throw new Error(`الكمية المطلوبة من الصنف (${product.design}) غير متوفرة بالمخزون (المتبقي: ${product.qty})`);
        }

        // Determine unit price server-authoritatively
        let unitPrice = 0;
        if (item.override_price !== undefined && item.override_price !== null) {
          unitPrice = item.override_price;
        } else if (payment_type === 'cash') {
          unitPrice = calculateCashPrice(
            product.cost_price,
            settings.markup_cash_percent,
            settings.rounding_unit
          );
        } else {
          unitPrice = calculateInstallmentMonthPrice(
            product.cost_price,
            settings.markup_installment_percent,
            installment_months,
            settings.rounding_unit
          );
        }

        const lineTotal = Math.round(unitPrice * item.qty * 100) / 100;
        calculatedTotal += lineTotal;

        itemsToInsert.push({
          product,
          qty: item.qty,
          unitPrice,
          lineTotal,
        });
      }

      // 4. Insert sales master record FIRST to satisfy foreign key constraint
      db.prepare(`
        INSERT INTO sales (
          id, invoice_number, customer_name, customer_phone, payment_type,
          installment_months, subtotal, total_amount, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleId,
        invoiceNumber,
        customer_name || 'عميل نقدي',
        customer_phone || '',
        payment_type,
        payment_type === 'installment' ? installment_months : 1,
        calculatedTotal,
        calculatedTotal,
        req.user!.id
      );

      // 5. Insert sale_items and inventory movements
      for (const it of itemsToInsert) {
        const saleItemId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO sale_items (id, sale_id, product_id, prd_ref, design, qty, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleItemId,
          saleId,
          it.product.id,
          it.product.prd_ref,
          it.product.design,
          it.qty,
          it.unitPrice,
          it.lineTotal
        );

        // Record inventory movement
        db.prepare(`
          INSERT INTO inventory_movements (id, product_id, qty_change, type, ref_type, ref_id, created_by)
          VALUES (?, ?, ?, 'sale', 'sale_invoice', ?, ?)
        `).run(
          crypto.randomUUID(),
          it.product.id,
          -it.qty,
          saleId,
          req.user!.id
        );

        processedItems.push({
          id: saleItemId,
          product_id: it.product.id,
          prd_ref: it.product.prd_ref,
          design: it.product.design,
          qty: it.qty,
          unit_price: it.unitPrice,
          line_total: it.lineTotal,
        });
      }

      // 5. Automatic Cash Inflow if cash payment
      if (payment_type === 'cash') {
        db.prepare(`
          INSERT INTO cash_transactions (
            id, type, amount, source, description, reference, payment_method, origin, sale_id, created_by
          ) VALUES (?, 'inflow', ?, 'POS Sale', ?, ?, 'cash', 'automatic', ?, ?)
        `).run(
          crypto.randomUUID(),
          calculatedTotal,
          `مبيعات نقدية - فاتورة رقم ${invoiceNumber}`,
          invoiceNumber,
          saleId,
          req.user!.id
        );
      }

      logAudit(req, 'SALE_CREATE', 'sales', saleId, {
        invoiceNumber,
        payment_type,
        installment_months,
        itemsCount: items.length,
        total_amount: calculatedTotal,
      });

      return {
        id: saleId,
        invoice_number: invoiceNumber,
        customer_name: customer_name || 'عميل نقدي',
        customer_phone: customer_phone || '',
        payment_type,
        installment_months: payment_type === 'installment' ? installment_months : 1,
        subtotal: calculatedTotal,
        total_amount: calculatedTotal,
        items: processedItems,
        created_at: new Date().toISOString(),
        created_by_name: req.user!.username,
      };
    });

    return res.status(201).json({
      success: true,
      message: 'تم إتمام عملية البيع وخصم المخزون بنجاح',
      sale: saleResult,
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'فشلت معالجة عملية البيع' });
  }
});

salesRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
  const offset = (page - 1) * limit;
  const q = (req.query.q as string || '').trim();
  const paymentType = req.query.payment_type as string;

  let query = `
    SELECT s.*, u.username as created_by_name,
           (SELECT count(*) FROM sale_items si WHERE si.sale_id = s.id) as items_count
    FROM sales s
    JOIN users u ON u.id = s.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  if (q) {
    query += ' AND (s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.customer_phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (paymentType && (paymentType === 'cash' || paymentType === 'installment')) {
    query += ' AND s.payment_type = ?';
    params.push(paymentType);
  }

  const countQuery = query.replace(/SELECT s\.\*.*FROM sales s/s, 'SELECT count(*) as total FROM sales s');
  const countRow = db.prepare(countQuery).get(...params) as { total: number };

  query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const sales = db.prepare(query).all(...params);

  return res.json({
    sales,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit),
  });
});

salesRouter.get('/:id', requireAuth, (req: Request, res: Response) => {
  const sale = db.prepare(`
    SELECT s.*, u.username as created_by_name
    FROM sales s
    JOIN users u ON u.id = s.created_by
    WHERE s.id = ?
  `).get(req.params.id) as any;

  if (!sale) {
    return res.status(404).json({ error: 'الفاتورة غير موجودة' });
  }

  const items = db.prepare(`
    SELECT * FROM sale_items WHERE sale_id = ?
  `).all(sale.id);

  return res.json({
    ...sale,
    items,
  });
});
