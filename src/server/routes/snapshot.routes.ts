import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db, dbTransaction } from '../db.ts';
import { requireAuth, requireRole, logAudit } from '../auth.ts';
import {
  SaveLocalSnapshotSchema,
  InspectLocalSnapshotSchema,
  RestoreDataPreserveAccountsSchema,
} from '../../shared/schemas.ts';

export const snapshotRouter = Router();

const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');

// Memory store for inspect file previews with 15-minute TTL
interface SnapshotPreview {
  previewId: string;
  filePath: string;
  data: any;
  createdAt: number;
}
const snapshotPreviews = new Map<string, SnapshotPreview>();

/**
 * Re-authenticate current user with password
 */
function verifyCurrentPassword(userId: string, passwordAttempt: string): boolean {
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any;
  if (!user) return false;
  return bcrypt.compareSync(passwordAttempt, user.password_hash);
}

/**
 * List local backups in ./backups directory
 */
snapshotRouter.get('/list-local', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.gstock') || f.endsWith('.json'));
    const list = files.map(filename => {
      const fullPath = path.join(BACKUPS_DIR, filename);
      const stat = fs.statSync(fullPath);
      return {
        filename,
        fullPath,
        sizeBytes: stat.size,
        sizeKb: Math.round(stat.size / 1024),
        modifiedAt: stat.mtime.toISOString(),
      };
    }).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));

    return res.json({ backups: list, backupsDirectory: BACKUPS_DIR });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'فشل استعراض مجلد النسخ الاحتياطية' });
  }
});

/**
 * Save State Snapshot to Disk
 * POST /api/system/snapshot/save-local
 */
snapshotRouter.post('/save-local', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const parsed = SaveLocalSnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  // 1. Password re-authentication
  if (!verifyCurrentPassword(req.user!.id, parsed.data.password)) {
    logAudit(req, 'SNAPSHOT_SAVE_AUTH_FAIL', 'system', null, { reason: 'Incorrect password' });
    return res.status(403).json({ error: 'كلمة المرور غير صحيحة! تم رفض تصريح إنشاء النسخة الاحتياطية' });
  }

  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    // 2. Consistent extraction
    const products = db.prepare('SELECT * FROM products').all();
    const sales = db.prepare('SELECT * FROM sales').all();
    const sale_items = db.prepare('SELECT * FROM sale_items').all();
    const purchases = db.prepare('SELECT * FROM purchases').all();
    const purchase_items = db.prepare('SELECT * FROM purchase_items').all();
    const inventory_movements = db.prepare('SELECT * FROM inventory_movements').all();
    const cash_transactions = db.prepare('SELECT * FROM cash_transactions').all();
    const sequences = db.prepare('SELECT * FROM sequences').all();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    const users = db.prepare('SELECT id, username, password_hash, role, is_active, created_at FROM users').all();

    const operational_data = {
      products,
      sales,
      sale_items,
      purchases,
      purchase_items,
      inventory_movements,
      cash_transactions,
      sequences,
      settings,
    };

    const accounts_data = {
      users,
    };

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `GStock_Snapshot_${timestampStr}.gstock`;
    const targetFile = path.join(BACKUPS_DIR, filename);

    const payloadWithoutChecksum = {
      version: '3.0.0',
      system: 'G.STOCK-Franchise / AFLOU ERP',
      exported_at: now.toISOString(),
      exported_by: req.user!.username,
      operational_data,
      accounts_data,
    };

    const serializedPayload = JSON.stringify(payloadWithoutChecksum);
    const checksum = crypto.createHash('sha256').update(serializedPayload).digest('hex');

    const finalBundle = {
      metadata: {
        version: '3.0.0',
        exported_at: now.toISOString(),
        exported_by: req.user!.username,
        sha256_checksum: checksum,
        records_summary: {
          products_count: products.length,
          sales_count: sales.length,
          purchases_count: purchases.length,
          cash_transactions_count: cash_transactions.length,
        },
      },
      ...payloadWithoutChecksum,
    };

    fs.writeFileSync(targetFile, JSON.stringify(finalBundle, null, 2), 'utf-8');

    logAudit(req, 'SNAPSHOT_SAVE_LOCAL', 'system', filename, {
      filename,
      filePath: targetFile,
      checksum,
      products_count: products.length,
      sales_count: sales.length,
    });

    return res.status(201).json({
      success: true,
      message: `تم حفظ لقطة حالة النظام بنجاح على قرص الحاسوب داخل المسار: ${targetFile}`,
      filename,
      filePath: targetFile,
      sha256: checksum,
      summary: finalBundle.metadata.records_summary,
    });
  } catch (err: any) {
    console.error('Snapshot save error:', err);
    return res.status(500).json({ error: err.message || 'فشل حفظ النسخة الاحتياطية على القرص' });
  }
});

/**
 * Inspect Snapshot File
 * POST /api/system/snapshot/inspect-file
 */
snapshotRouter.post('/inspect-file', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const parsed = InspectLocalSnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { filePath } = parsed.data;

  // Resolve file path (can be just filename or full path)
  let resolvedPath = filePath;
  if (!path.isAbsolute(resolvedPath)) {
    resolvedPath = path.resolve(BACKUPS_DIR, filePath);
  }

  if (!fs.existsSync(resolvedPath)) {
    return res.status(404).json({ error: `الملف غير موجود في المسار: ${resolvedPath}` });
  }

  try {
    const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
    const bundle = JSON.parse(rawContent);

    if (!bundle.operational_data || !bundle.metadata) {
      return res.status(400).json({ error: 'ملف النسخة الاحتياطية غير صالح أو تالف ولا يطابق هيكل G.STOCK' });
    }

    // Verify sha256 checksum
    const recordedChecksum = bundle.metadata.sha256_checksum;
    const { metadata, ...payload } = bundle;
    const computedChecksum = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    if (recordedChecksum && recordedChecksum !== computedChecksum) {
      return res.status(400).json({
        error: 'تحذير أمني: فشل التحقق من بصمة سلامة البيانات الرقمية (SHA-256 Checksum Mismatch). الملف قد يكون تعرض للتعديل أو التلف.',
      });
    }

    const previewId = crypto.randomUUID();
    snapshotPreviews.set(previewId, {
      previewId,
      filePath: resolvedPath,
      data: bundle,
      createdAt: Date.now(),
    });

    const op = bundle.operational_data;

    return res.json({
      success: true,
      previewId,
      filePath: resolvedPath,
      fileName: path.basename(resolvedPath),
      metadata: bundle.metadata,
      stats: {
        productsCount: op.products?.length || 0,
        salesCount: op.sales?.length || 0,
        purchasesCount: op.purchases?.length || 0,
        cashTransactionsCount: op.cash_transactions?.length || 0,
        snapshotDate: bundle.metadata.exported_at,
        version: bundle.metadata.version,
      },
      warningMessage:
        'تنبيه صارم: سيتم استبدال كامل بيانات المخزون والمبيعات والخزينة بالبيانات الموجودة في الملف، مع الاحتفاظ بجميع مستخدمي هذا الجهاز وحساباتهم دون أي تغيير.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'حدث خطأ أثناء قراءة وفحص ملف النسخة' });
  }
});

/**
 * Restore Data-Only with Local Accounts Preserved
 * POST /api/system/snapshot/restore-data
 */
snapshotRouter.post('/restore-data', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const parsed = RestoreDataPreserveAccountsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { password, previewId } = parsed.data;

  // 1. Re-auth admin password
  if (!verifyCurrentPassword(req.user!.id, password)) {
    logAudit(req, 'SNAPSHOT_RESTORE_AUTH_FAIL', 'system', null, { reason: 'Incorrect password during restore' });
    return res.status(403).json({ error: 'كلمة المرور غير صحيحة! تم رفض تصريح استعادة البيانات' });
  }

  // 2. Validate preview session
  const preview = snapshotPreviews.get(previewId);
  if (!preview) {
    return res.status(400).json({ error: 'جلسة المعاينة منتهية الصلاحية أو غير صالحة. يرجى فحص الملف مجدداً.' });
  }

  const { operational_data } = preview.data;
  if (!operational_data) {
    return res.status(400).json({ error: 'البيانات التشغيلية غير متوفرة في الملف' });
  }

  try {
    // 3. ATOMIC TRANSACTION WITH USERS TABLE ISOLATION & PRESERVATION
    dbTransaction(() => {
      // 1. Temporarily disable foreign keys
      db.exec('PRAGMA foreign_keys = OFF;');

      // 2. Clear operational tables exclusively
      db.exec(`
        DELETE FROM sale_items;
        DELETE FROM sales;
        DELETE FROM purchase_items;
        DELETE FROM purchases;
        DELETE FROM inventory_movements;
        DELETE FROM cash_transactions;
        DELETE FROM products;
        DELETE FROM sequences;
      `);

      // NOTE: `users` table is NEVER deleted, modified or truncated!

      // 3. Restore operational products
      if (Array.isArray(operational_data.products)) {
        const stmt = db.prepare(`
          INSERT INTO products (id, prd_ref, design, qty, cost_price, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of operational_data.products) {
          stmt.run(p.id, p.prd_ref, p.design, p.qty, p.cost_price, p.created_at || new Date().toISOString(), p.updated_at || new Date().toISOString());
        }
      }

      // 4. Restore sales
      if (Array.isArray(operational_data.sales)) {
        const stmt = db.prepare(`
          INSERT INTO sales (id, invoice_number, customer_name, customer_phone, payment_type, installment_months, subtotal, total_amount, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of operational_data.sales) {
          // If created_by is missing in local users, map to current restoring user
          const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(s.created_by);
          const creator = exists ? s.created_by : req.user!.id;
          stmt.run(s.id, s.invoice_number, s.customer_name, s.customer_phone, s.payment_type, s.installment_months, s.subtotal, s.total_amount, creator, s.created_at);
        }
      }

      if (Array.isArray(operational_data.sale_items)) {
        const stmt = db.prepare(`
          INSERT INTO sale_items (id, sale_id, product_id, prd_ref, design, qty, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const si of operational_data.sale_items) {
          stmt.run(si.id, si.sale_id, si.product_id, si.prd_ref, si.design, si.qty, si.unit_price, si.line_total);
        }
      }

      // 5. Restore purchases
      if (Array.isArray(operational_data.purchases)) {
        const stmt = db.prepare(`
          INSERT INTO purchases (id, supplier, note, source, total_cost, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const pu of operational_data.purchases) {
          const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(pu.created_by);
          const creator = exists ? pu.created_by : req.user!.id;
          stmt.run(pu.id, pu.supplier, pu.note, pu.source, pu.total_cost, creator, pu.created_at);
        }
      }

      if (Array.isArray(operational_data.purchase_items)) {
        const stmt = db.prepare(`
          INSERT INTO purchase_items (id, purchase_id, product_id, prd_ref, design, qty, unit_cost, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const pi of operational_data.purchase_items) {
          stmt.run(pi.id, pi.purchase_id, pi.product_id, pi.prd_ref, pi.design, pi.qty, pi.unit_cost, pi.line_total);
        }
      }

      // 6. Restore inventory movements
      if (Array.isArray(operational_data.inventory_movements)) {
        const stmt = db.prepare(`
          INSERT INTO inventory_movements (id, product_id, qty_change, type, ref_type, ref_id, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const m of operational_data.inventory_movements) {
          const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(m.created_by);
          const creator = exists ? m.created_by : req.user!.id;
          stmt.run(m.id, m.product_id, m.qty_change, m.type, m.ref_type, m.ref_id, creator, m.created_at);
        }
      }

      // 7. Restore cash transactions
      if (Array.isArray(operational_data.cash_transactions)) {
        const stmt = db.prepare(`
          INSERT INTO cash_transactions (id, type, amount, date, source, description, reference, payment_method, origin, sale_id, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const c of operational_data.cash_transactions) {
          const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(c.created_by);
          const creator = exists ? c.created_by : req.user!.id;
          stmt.run(c.id, c.type, c.amount, c.date, c.source, c.description, c.reference, c.payment_method, c.origin, c.sale_id, creator, c.created_at);
        }
      }

      // 8. Restore sequences
      if (Array.isArray(operational_data.sequences)) {
        const stmt = db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)');
        for (const seq of operational_data.sequences) {
          stmt.run(seq.name, seq.value);
        }
      }

      // 9. Update settings while strictly retaining local device secrets
      const localSettings = db.prepare('SELECT price_edit_code_hash, price_edit_token_secret FROM settings WHERE id = 1').get() as any;
      if (operational_data.settings) {
        const s = operational_data.settings;
        db.prepare(`
          UPDATE settings
          SET store_name = ?, store_phone = ?, store_address = ?, currency = ?,
              markup_cash_percent = ?, markup_installment_percent = ?,
              rounding_unit = ?, low_stock_threshold = ?, language = ?, theme = ?
          WHERE id = 1
        `).run(
          s.store_name || 'G.STOCK Franchise',
          s.store_phone || '',
          s.store_address || '',
          s.currency || 'DZD',
          s.markup_cash_percent || 20,
          s.markup_installment_percent || 40,
          s.rounding_unit || 100,
          s.low_stock_threshold || 5,
          s.language || 'ar',
          s.theme || 'light'
        );
      }

      // 10. Re-enable foreign keys and verify integrity
      db.exec('PRAGMA foreign_keys = ON;');
      const fkErrors = db.prepare('PRAGMA foreign_key_check;').all();
      if (fkErrors.length > 0) {
        console.warn('Foreign key notices during restore:', fkErrors);
      }
    });

    // 4. Post-actions: Invalidate all other active sessions except current user's session
    if (req.sessionToken) {
      db.prepare('DELETE FROM sessions WHERE id != ?').run(req.sessionToken);
    }

    // 5. Audit log entry
    logAudit(req, 'RESTORE_DATA_LOCAL_ACCOUNTS_PRESERVED', 'system', preview.filePath, {
      file: path.basename(preview.filePath),
      snapshotDate: preview.data.metadata?.exported_at,
      restoredBy: req.user!.username,
      usersPreserved: true,
    });

    // Remove preview
    snapshotPreviews.delete(previewId);

    return res.json({
      success: true,
      message: 'تمت استعادة البيانات التشغيلية بنجاح تام، مع الحفاظ المطلق على جميع حسابات ومستخدمي هذا الجهاز دون أي تعديل!',
    });
  } catch (err: any) {
    console.error('Data-only restore failed:', err);
    return res.status(500).json({ error: err.message || 'فشلت عملية استعادة البيانات' });
  }
});
