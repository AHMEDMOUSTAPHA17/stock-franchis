import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { calculateCashPrice } from '../../shared/pricing.ts';

export const dashboardRouter = Router();

dashboardRouter.get('/stats', requireAuth, (req: Request, res: Response) => {
  const isNormalUser = req.user?.role === 'user';

  const settings = db.prepare(`
    SELECT markup_cash_percent, rounding_unit, low_stock_threshold, currency
    FROM settings WHERE id = 1
  `).get() as any;

  // 1. Today's sales
  const todaySales = db.prepare(`
    SELECT
      count(*) as sales_count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0) as cash_amount,
      COALESCE(SUM(CASE WHEN payment_type = 'installment' THEN total_amount ELSE 0 END), 0) as installment_amount
    FROM sales
    WHERE date(created_at) = date('now', 'localtime')
  `).get() as any;

  // 2. Current Month's sales
  const monthSales = db.prepare(`
    SELECT
      count(*) as sales_count,
      COALESCE(SUM(total_amount), 0) as total_amount,
      COALESCE(SUM(CASE WHEN payment_type = 'cash' THEN total_amount ELSE 0 END), 0) as cash_amount,
      COALESCE(SUM(CASE WHEN payment_type = 'installment' THEN total_amount ELSE 0 END), 0) as installment_amount
    FROM sales
    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
  `).get() as any;

  // 3. Inventory valuation
  const inventorySummary = db.prepare(`
    SELECT
      count(*) as total_products,
      COALESCE(SUM(qty), 0) as total_units,
      COALESCE(SUM(qty * cost_price), 0) as total_cost_value
    FROM products
  `).get() as any;

  // Calculate retail valuation across products
  const productsList = db.prepare('SELECT cost_price, qty FROM products WHERE qty > 0').all() as any[];
  let totalRetailValue = 0;
  for (const p of productsList) {
    const unitRetail = calculateCashPrice(p.cost_price, settings.markup_cash_percent, settings.rounding_unit);
    totalRetailValue += unitRetail * p.qty;
  }

  // 4. Low stock items
  const lowStockItems = db.prepare(`
    SELECT id, prd_ref, design, qty
    FROM products
    WHERE qty <= ?
    ORDER BY qty ASC
    LIMIT 8
  `).all(settings.low_stock_threshold);

  // 5. 14-day sales trend
  const trendDays = db.prepare(`
    WITH RECURSIVE dates(date_val) AS (
      SELECT date('now', 'localtime', '-13 days')
      UNION ALL
      SELECT date(date_val, '+1 day')
      FROM dates
      WHERE date_val < date('now', 'localtime')
    )
    SELECT
      d.date_val as date,
      COALESCE(SUM(s.total_amount), 0) as total,
      COALESCE(SUM(CASE WHEN s.payment_type = 'cash' THEN s.total_amount ELSE 0 END), 0) as cash,
      COALESCE(SUM(CASE WHEN s.payment_type = 'installment' THEN s.total_amount ELSE 0 END), 0) as installment,
      COUNT(s.id) as count
    FROM dates d
    LEFT JOIN sales s ON date(s.created_at) = d.date_val
    GROUP BY d.date_val
    ORDER BY d.date_val ASC
  `).all() as any[];

  // 6. Top selling products
  const topProducts = db.prepare(`
    SELECT
      si.product_id,
      si.prd_ref,
      si.design,
      SUM(si.qty) as total_sold_qty,
      SUM(si.line_total) as total_revenue
    FROM sale_items si
    GROUP BY si.product_id
    ORDER BY total_sold_qty DESC
    LIMIT 5
  `).all();

  // 7. Cash balance
  const cashBalance = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'inflow' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'outflow' THEN amount ELSE 0 END), 0) as current_balance
    FROM cash_transactions
  `).get() as any;

  return res.json({
    today: todaySales,
    month: monthSales,
    inventory: {
      total_products: inventorySummary.total_products,
      total_units: inventorySummary.total_units,
      // Hide cost value from normal users
      total_cost_value: isNormalUser ? null : inventorySummary.total_cost_value,
      total_retail_value: totalRetailValue,
    },
    cash_balance: cashBalance.current_balance,
    low_stock_items: lowStockItems,
    sales_trend: trendDays,
    top_products: topProducts,
    currency: settings.currency,
  });
});
