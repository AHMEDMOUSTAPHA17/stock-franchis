/**
 * G.STOCK-Franchise ERP CLI Administration Tool
 * Direct database management commands
 */
import { initDatabase, db } from './db.ts';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

initDatabase();

const [,, command, ...args] = process.argv;

function printUsage() {
  console.log(`
=====================================================
  G.STOCK-Franchise ERP v3.0.0 - أداة الإدارة المحلية
=====================================================
الاستخدام:
  npm run setup list-users
  npm run setup create-founder <username> <password>
  npm run setup create-user <username> <password> <role: admin|user>
  npm run setup reset-password <username> <new_password>
=====================================================
`);
}

switch (command) {
  case 'list-users': {
    const users = db.prepare('SELECT id, username, role, is_active, created_at, last_login_at FROM users').all();
    console.table(users);
    break;
  }
  case 'create-founder': {
    const [username, password] = args;
    if (!username || !password) {
      console.error('خطأ: يرجى تحديد اسم المستخدم وكلمة المرور');
      process.exit(1);
    }
    const hash = bcrypt.hashSync(password, 10);
    const id = crypto.randomUUID();
    try {
      db.prepare(`
        INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
        VALUES (?, ?, ?, 'founder', 1, 0)
      `).run(id, username, hash);
      console.log(`✓ تم إنشاء حساب المؤسس (${username}) بنجاح.`);
    } catch (err: any) {
      console.error('فشل إنشاء الحساب:', err.message);
    }
    break;
  }
  case 'create-user': {
    const [username, password, role = 'user'] = args;
    if (!username || !password) {
      console.error('خطأ: يرجى تحديد اسم المستخدم وكلمة المرور والرتبة (admin أو user)');
      process.exit(1);
    }
    if (!['admin', 'user'].includes(role)) {
      console.error('خطأ: الرتبة يجب أن تكون إما admin أو user');
      process.exit(1);
    }
    const hash = bcrypt.hashSync(password, 10);
    const id = crypto.randomUUID();
    try {
      db.prepare(`
        INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
        VALUES (?, ?, ?, ?, 1, 0)
      `).run(id, username, hash, role);
      console.log(`✓ تم إنشاء المستخدم (${username}) برتبة [${role}] بنجاح.`);
    } catch (err: any) {
      console.error('فشل إنشاء الحساب:', err.message);
    }
    break;
  }
  case 'reset-password': {
    const [username, newPassword] = args;
    if (!username || !newPassword) {
      console.error('خطأ: يرجى تحديد اسم المستخدم وكلمة المرور الجديدة');
      process.exit(1);
    }
    const user = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
    if (!user) {
      console.error(`خطأ: المستخدم (${username}) غير موجود`);
      process.exit(1);
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE username = ? COLLATE NOCASE').run(hash, username);
    console.log(`✓ تم تعيين كلمة المرور الجديدة للمستخدم (${username}) بنجاح.`);
    break;
  }
  default:
    printUsage();
    break;
}
