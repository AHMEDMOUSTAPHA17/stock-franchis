import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'gstock.db');
export const db = new DatabaseSync(DB_FILE);

// Set strict PRAGMAs per specification
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
`);

/**
 * Execute a callback within an ACID transaction
 */
export function dbTransaction<T>(callback: () => T): T {
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    const result = callback();
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback failure if already rolled back
    }
    throw err;
  }
}

/**
 * Initialize 12 tables and seed default state if first run
 */
export function initDatabase() {
  db.exec(`
    -- 1. جدول المستخدمين والمصادقة
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE COLLATE NOCASE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT CHECK(role IN ('founder', 'admin', 'user')) NOT NULL,
        is_active INTEGER DEFAULT 1,
        must_change_password INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        last_login_at TEXT
    );

    -- 2. جدول الإعدادات العامة ومحرك التسعير (سطر فردي دائم id=1)
    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        store_name TEXT NOT NULL DEFAULT 'G.STOCK Franchise - AFLOU',
        store_phone TEXT DEFAULT '029 00 11 22',
        store_address TEXT DEFAULT 'حي النصر، آفلو، الأغواط',
        currency TEXT DEFAULT 'DZD',
        markup_cash_percent REAL DEFAULT 20.0,
        markup_installment_percent REAL DEFAULT 40.0,
        rounding_unit INTEGER DEFAULT 100,
        low_stock_threshold INTEGER DEFAULT 5,
        language TEXT DEFAULT 'ar',
        theme TEXT DEFAULT 'light',
        price_edit_code_hash TEXT NOT NULL,
        price_edit_token_secret TEXT NOT NULL
    );

    -- 3. جدول بطاقات الأصناف والكميات
    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        prd_ref TEXT UNIQUE COLLATE NOCASE NOT NULL,
        design TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK(qty >= 0) DEFAULT 0,
        cost_price REAL NOT NULL CHECK(cost_price >= 0) DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_products_ref ON products(prd_ref);
    CREATE INDEX IF NOT EXISTS idx_products_design ON products(design);

    -- 4. جدول رؤوس فواتير المبيعات
    CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        invoice_number TEXT UNIQUE NOT NULL,
        customer_name TEXT DEFAULT '',
        customer_phone TEXT DEFAULT '',
        payment_type TEXT CHECK(payment_type IN ('cash', 'installment')) NOT NULL,
        installment_months INTEGER DEFAULT 1,
        subtotal REAL NOT NULL,
        total_amount REAL NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

    -- 5. جدول تفاصيل وبنود فواتير المبيعات
    CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        prd_ref TEXT NOT NULL,
        design TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK(qty > 0),
        unit_price REAL NOT NULL CHECK(unit_price >= 0),
        line_total REAL NOT NULL CHECK(line_total >= 0)
    );

    -- 6. جدول رؤوس فواتير المشتريات والتوريد
    CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY,
        supplier TEXT NOT NULL,
        note TEXT DEFAULT '',
        source TEXT CHECK(source IN ('flb', 'excel', 'manual')) NOT NULL,
        total_cost REAL NOT NULL,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    -- 7. جدول تفاصيل وبنود فواتير المشتريات
    CREATE TABLE IF NOT EXISTS purchase_items (
        id TEXT PRIMARY KEY,
        purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id),
        prd_ref TEXT NOT NULL,
        design TEXT NOT NULL,
        qty INTEGER NOT NULL CHECK(qty > 0),
        unit_cost REAL NOT NULL CHECK(unit_cost >= 0),
        line_total REAL NOT NULL CHECK(line_total >= 0)
    );

    -- 8. جدول السجل التراكمي لحركات المخزون
    CREATE TABLE IF NOT EXISTS inventory_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id),
        qty_change INTEGER NOT NULL,
        type TEXT CHECK(type IN ('import', 'purchase', 'sale', 'adjustment', 'reset')) NOT NULL,
        ref_type TEXT NOT NULL,
        ref_id TEXT,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_movements_product ON inventory_movements(product_id);

    -- 9. جدول دفتر الأستاذ النقدي الفعلي للخزينة
    CREATE TABLE IF NOT EXISTS cash_transactions (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('inflow', 'outflow')) NOT NULL,
        amount REAL NOT NULL CHECK(amount > 0),
        date TEXT DEFAULT (datetime('now', 'localtime')),
        source TEXT NOT NULL,
        description TEXT NOT NULL,
        reference TEXT DEFAULT '',
        payment_method TEXT DEFAULT 'cash',
        origin TEXT CHECK(origin IN ('automatic', 'manual')) NOT NULL,
        sale_id TEXT UNIQUE REFERENCES sales(id) ON DELETE SET NULL,
        created_by TEXT NOT NULL REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_cash_date ON cash_transactions(date);

    -- 10. جدول سجل التدقيق الجنائي للأحداث (Founder Only)
    CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT,
        details TEXT,
        ip TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

    -- 11. جدول جلسات المستخدمين المفهرسة
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data TEXT,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

    -- 12. جدول عدادات الترقيم الآلي المتسلسل
    CREATE TABLE IF NOT EXISTS sequences (
        name TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
    );
  `);

  // Ensure default sequences exist
  const seqSales = db.prepare('SELECT value FROM sequences WHERE name = ?').get('sales');
  if (!seqSales) {
    db.prepare('INSERT INTO sequences (name, value) VALUES (?, ?)').run('sales', 100);
  }

  // Ensure settings row exists
  const settingsRow = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  let tokenSecret = '';
  if (!settingsRow) {
    tokenSecret = crypto.randomBytes(32).toString('hex');
    const defaultCodeHash = crypto.createHmac('sha256', tokenSecret).update('1997').digest('hex');
    
    db.prepare(`
      INSERT INTO settings (
        id, store_name, store_phone, store_address, currency,
        markup_cash_percent, markup_installment_percent, rounding_unit,
        low_stock_threshold, language, theme, price_edit_code_hash, price_edit_token_secret
      ) VALUES (
        1, 'G.STOCK Franchise - AFLOU', '029 00 11 22', 'حي النصر، آفلو، الأغواط', 'DZD',
        20.0, 40.0, 100, 5, 'ar', 'light', ?, ?
      )
    `).run(defaultCodeHash, tokenSecret);
  }

  // Ensure default users exist
  const founderUser = db.prepare('SELECT id FROM users WHERE username = ?').get('founder');
  let founderId = '';
  if (!founderUser) {
    founderId = crypto.randomUUID();
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
      VALUES (?, 'founder', ?, 'founder', 1, 0)
    `).run(founderId, hash);
  } else {
    founderId = (founderUser as { id: string }).id;
  }

  const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminUser) {
    const adminId = crypto.randomUUID();
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
      VALUES (?, 'admin', ?, 'admin', 1, 0)
    `).run(adminId, hash);
  }

  const cashierUser = db.prepare('SELECT id FROM users WHERE username = ?').get('cashier');
  if (!cashierUser) {
    const cashierId = crypto.randomUUID();
    const hash = bcrypt.hashSync('user123', 10);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
      VALUES (?, 'cashier', ?, 'user', 1, 0)
    `).run(cashierId, hash);
  }

  // Seed sample products if table is empty
  const countRow = db.prepare('SELECT count(*) as count FROM products').get() as { count: number };
  if (countRow.count === 0) {
    seedDemoData(founderId);
  }
}

/**
 * Seed initial sample hardware retail items for G.STOCK Franchise
 */
function seedDemoData(creatorId: string) {
  const initialProducts = [
    { ref: 'REF-MKT-01', name: 'مثقاب كهربائي ماكيتا 710 واط (Makita HP1630)', qty: 14, cost: 8500 },
    { ref: 'REF-BSH-02', name: 'صاروخ جلخ بوش 115 ملم 750 واط (Bosch GWS 750)', qty: 18, cost: 7200 },
    { ref: 'REF-STN-03', name: 'شريط قياس ستانلي 5 متر مغناطيسي (Stanley)', qty: 45, cost: 650 },
    { ref: 'REF-TTL-04', name: 'طقم مفاتيح وحبات توتال 142 قطعة كروم (Total Tools)', qty: 8, cost: 14800 },
    { ref: 'REF-ING-05', name: 'مفك براغي لاسلكي إنجكو 20 فولت بطاريتين (Ingco)', qty: 12, cost: 9400 },
    { ref: 'REF-SCH-06', name: 'قاطع تيار كهربائي تفاضلي شنايدر 40 أمبير (Schneider)', qty: 30, cost: 3100 },
    { ref: 'REF-LEP-07', name: 'ميزان مائي ألومنيوم مغناطيسي 60 سم احترافي', qty: 22, cost: 1200 },
    { ref: 'REF-WLD-08', name: 'آلة لحام إنفرتر إلكترونية 200 أمبير محمولة', qty: 4, cost: 18500 }, // Low stock!
    { ref: 'REF-CLP-09', name: 'كماشة فك وتثبيت احترافية مقاس 8 إنش معزولة', qty: 3, cost: 850 }, // Low stock!
    { ref: 'REF-LGT-10', name: 'كشاف ليد ورشات عمل 50 واط مضاد للغبار IP65', qty: 25, cost: 2400 },
    { ref: 'REF-PVC-11', name: 'أنبوب بي في سي مقوى رمادي قطر 110 ملم (4 أمتار)', qty: 50, cost: 1600 },
    { ref: 'REF-SLN-12', name: 'مسدس سيليكون هيكل معدني ثقيل مضاد للانزلاق', qty: 1, cost: 750 }, // Critical stock!
  ];

  dbTransaction(() => {
    for (const p of initialProducts) {
      const pid = crypto.randomUUID();
      db.prepare(`
        INSERT INTO products (id, prd_ref, design, qty, cost_price)
        VALUES (?, ?, ?, ?, ?)
      `).run(pid, p.ref, p.name, p.qty, p.cost);

      db.prepare(`
        INSERT INTO inventory_movements (id, product_id, qty_change, type, ref_type, ref_id, created_by)
        VALUES (?, ?, ?, 'import', 'initial_seed', 'SEED-001', ?)
      `).run(crypto.randomUUID(), pid, p.qty, creatorId);
    }

    // Seed initial cash transaction (Opening balance)
    db.prepare(`
      INSERT INTO cash_transactions (
        id, type, amount, source, description, reference, origin, created_by
      ) VALUES (
        ?, 'inflow', 250000.0, 'Capital', 'الرصيد الافتتاحي لصندوق الخزينة الرئيسي', 'INIT-CASH-001', 'manual', ?
      )
    `).run(crypto.randomUUID(), creatorId);

    // Initial audit log
    db.prepare(`
      INSERT INTO audit_log (id, user_id, username, action, entity, details, ip)
      VALUES (?, ?, 'founder', 'SYSTEM_INIT', 'database', '{"message": "تهيئة النظام بنجاح وتوليد الأصناف الافتتاحية"}', '127.0.0.1')
    `).run(crypto.randomUUID(), creatorId);
  });
}
