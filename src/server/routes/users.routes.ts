import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../db.ts';
import { requireAuth, requireRole, logAudit } from '../auth.ts';
import { UserCreateSchema, UserUpdateSchema } from '../../shared/schemas.ts';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const users = db.prepare(`
    SELECT id, username, role, is_active, must_change_password, created_at, last_login_at
    FROM users
    ORDER BY created_at ASC
  `).all();

  return res.json(users);
});

usersRouter.post('/', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const parsed = UserCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { username, password, role } = parsed.data;

  // Only founder can create other admins
  if (role === 'admin' && req.user?.role !== 'founder') {
    return res.status(403).json({ error: 'حساب المؤسس فقط هو المخول بإنشاء حسابات إدارية (Admins)' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE').get(username);
  if (existing) {
    return res.status(400).json({ error: 'اسم المستخدم محجوز بالفعل' });
  }

  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, is_active, must_change_password)
    VALUES (?, ?, ?, ?, 1, 0)
  `).run(id, username, hash, role);

  logAudit(req, 'USER_CREATE', 'users', id, { username, role });

  return res.status(201).json({ success: true, message: 'تم إنشاء المستخدم بنجاح', id });
});

usersRouter.put('/:id', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const id = req.params.id;
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;

  if (!targetUser) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  // Prevent modifying founder role unless you are the founder
  if (targetUser.role === 'founder' && req.user?.role !== 'founder') {
    return res.status(403).json({ error: 'لا يمكن تعديل حساب المؤسس إلا بواسطة المؤسس نفسه' });
  }

  const parsed = UserUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const updates: string[] = [];
  const params: any[] = [];

  if (parsed.data.password) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(parsed.data.password, 10));
  }

  if (parsed.data.role && req.user?.role === 'founder') {
    updates.push('role = ?');
    params.push(parsed.data.role);
  }

  if (parsed.data.is_active !== undefined) {
    if (targetUser.role === 'founder' && parsed.data.is_active === 0) {
      return res.status(400).json({ error: 'لا يمكن تعطيل حساب المؤسس' });
    }
    updates.push('is_active = ?');
    params.push(parsed.data.is_active);
  }

  if (updates.length > 0) {
    params.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    logAudit(req, 'USER_UPDATE', 'users', id, { username: targetUser.username });
  }

  return res.json({ success: true, message: 'تم تحديث بيانات المستخدم بنجاح' });
});

usersRouter.delete('/:id', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const id = req.params.id;
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;

  if (!targetUser) {
    return res.status(404).json({ error: 'المستخدم غير موجود' });
  }

  // Strict invariant: Founder account can NEVER be deleted!
  if (targetUser.role === 'founder') {
    return res.status(403).json({ error: 'حظر أمني صارم: يُمنع منعاً باتاً حذف حساب المؤسس' });
  }

  // Cannot delete yourself
  if (targetUser.id === req.user?.id) {
    return res.status(400).json({ error: 'لا يمكنك حذف حسابك الحالي أثناء تسجيل الدخول به' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  logAudit(req, 'USER_DELETE', 'users', id, { username: targetUser.username, role: targetUser.role });

  return res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
});
