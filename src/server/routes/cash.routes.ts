import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db, dbTransaction } from '../db.ts';
import { requireAuth, requireRole, logAudit } from '../auth.ts';
import { CashTransactionCreateSchema, EXPENSE_CATEGORIES } from '../../shared/schemas.ts';

export const cashRouter = Router();

cashRouter.get('/summary', requireAuth, (req: Request, res: Response) => {
  const inflowsRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE type = 'inflow'
  `).get() as { total: number };

  const outflowsRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE type = 'outflow'
  `).get() as { total: number };

  const todayInflowsRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM cash_transactions
    WHERE type = 'inflow' AND date(date) = date('now', 'localtime')
  `).get() as { total: number };

  const todayOutflowsRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM cash_transactions
    WHERE type = 'outflow' AND date(date) = date('now', 'localtime')
  `).get() as { total: number };

  const openingRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM cash_transactions
    WHERE source = 'Capital' AND type = 'inflow'
  `).get() as { total: number };

  const currentBalance = inflowsRow.total - outflowsRow.total;

  return res.json({
    opening_balance: openingRow.total,
    total_inflows: inflowsRow.total,
    total_outflows: outflowsRow.total,
    current_balance: currentBalance,
    today_inflows: todayInflowsRow.total,
    today_outflows: todayOutflowsRow.total,
  });
});

cashRouter.get('/transactions', requireAuth, (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '30', 10)));
  const offset = (page - 1) * limit;
  const type = req.query.type as string;
  const category = req.query.category as string;
  const q = (req.query.q as string || '').trim();

  let query = `
    SELECT c.*, u.username as created_by_name
    FROM cash_transactions c
    JOIN users u ON u.id = c.created_by
    WHERE 1=1
  `;
  const params: any[] = [];

  if (type === 'inflow' || type === 'outflow') {
    query += ' AND c.type = ?';
    params.push(type);
  }

  if (category) {
    query += ' AND c.source = ?';
    params.push(category);
  }

  if (q) {
    query += ' AND (c.description LIKE ? OR c.reference LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  const countQuery = query.replace(/SELECT c\.\*.*FROM cash_transactions c/s, 'SELECT count(*) as total FROM cash_transactions c');
  const countRow = db.prepare(countQuery).get(...params) as { total: number };

  query += ' ORDER BY c.date DESC, c.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const transactions = db.prepare(query).all(...params);

  return res.json({
    transactions,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit),
    categories: EXPENSE_CATEGORIES,
  });
});

cashRouter.post('/transactions', requireAuth, (req: Request, res: Response) => {
  const parsed = CashTransactionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { type, amount, source, description, reference, payment_method } = parsed.data;

  // Enforce 13 categories for outflows
  if (type === 'outflow') {
    const isStandardCategory = EXPENSE_CATEGORIES.includes(source as any);
    if (!isStandardCategory && source !== 'Supplier Payment') {
      return res.status(400).json({
        error: `تصنيف المصروف غير صالح. يجب اختيار إحدى الفئات الـ 13 المعيارية أو سداد موردين`,
      });
    }
  }

  const id = crypto.randomUUID();

  dbTransaction(() => {
    db.prepare(`
      INSERT INTO cash_transactions (
        id, type, amount, source, description, reference, payment_method, origin, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)
    `).run(
      id,
      type,
      amount,
      source,
      description,
      reference || '',
      payment_method,
      req.user!.id
    );

    logAudit(req, 'CASH_ENTRY_CREATE', 'cash_transactions', id, {
      type,
      amount,
      source,
      description,
    });
  });

  return res.status(201).json({ success: true, id, message: 'تم تسجيل الحركة المالية بنجاح' });
});

cashRouter.delete('/transactions/:id', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const id = req.params.id;
  const current = db.prepare('SELECT * FROM cash_transactions WHERE id = ?').get(id) as any;

  if (!current) {
    return res.status(404).json({ error: 'القيد المالي غير موجود' });
  }

  // Strictly prevent deleting automatic sales entries
  if (current.origin === 'automatic') {
    return res.status(403).json({
      error: 'لا يمكن حذف هذا القيد المالي! تم إنشاؤه تلقائياً ومربوط بفاتورة مبيعات.',
    });
  }

  dbTransaction(() => {
    db.prepare('DELETE FROM cash_transactions WHERE id = ?').run(id);
    logAudit(req, 'CASH_ENTRY_DELETE', 'cash_transactions', id, {
      type: current.type,
      amount: current.amount,
      description: current.description,
    });
  });

  return res.json({ success: true, message: 'تم حذف القيد المالي بنجاح' });
});
