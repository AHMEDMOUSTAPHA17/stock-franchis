import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db } from '../db.ts';
import {
  createSession,
  destroySession,
  generatePriceOverrideToken,
  getPriceEditSecret,
  logAudit,
  requireAuth,
} from '../auth.ts';
import { LoginSchema, PriceOverrideVerifySchema } from '../../shared/schemas.ts';

export const authRouter = Router();

// Rate limit tracker in memory for failed logins
const failedLoginAttempts: Record<string, { count: number; lockedUntil: number }> = {};

authRouter.post('/login', (req: Request, res: Response) => {
  const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();

  const attempt = failedLoginAttempts[ip];
  if (attempt && attempt.lockedUntil > now) {
    const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
    return res.status(429).json({
      error: `تم تجاوز الحد الأقصى للمحاولات الفاشلة. يرجى الانتظار ${remainingSeconds} ثانية.`,
    });
  }

  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { username, password } = parsed.data;

  const user = db.prepare(`
    SELECT id, username, password_hash, role, is_active, must_change_password
    FROM users
    WHERE username = ? COLLATE NOCASE
  `).get(username) as any;

  if (!user || user.is_active === 0 || !bcrypt.compareSync(password, user.password_hash)) {
    const cur = failedLoginAttempts[ip] || { count: 0, lockedUntil: 0 };
    cur.count += 1;
    if (cur.count >= 5) {
      cur.lockedUntil = now + 60 * 1000; // Lock for 1 minute
      cur.count = 0;
    }
    failedLoginAttempts[ip] = cur;

    logAudit(req, 'LOGIN_FAILED', 'users', null, { attempted_username: username, ip });
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب معطل' });
  }

  // Clear failed attempts
  delete failedLoginAttempts[ip];

  // Update last login timestamp
  db.prepare(`
    UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?
  `).run(user.id);

  const { token, expiresAt } = createSession(user.id);

  // Set HTTP-only secure cookie
  res.cookie('gstock_sid', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });

  req.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    is_active: user.is_active,
  };

  logAudit(req, 'LOGIN_SUCCESS', 'users', user.id, { username: user.username, role: user.role });

  return res.json({
    success: true,
    token,
    expiresAt,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      must_change_password: user.must_change_password,
    },
  });
});

authRouter.post('/logout', requireAuth, (req: Request, res: Response) => {
  if (req.sessionToken) {
    destroySession(req.sessionToken);
  }
  res.clearCookie('gstock_sid');
  logAudit(req, 'LOGOUT', 'users', req.user?.id);
  return res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

authRouter.get('/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.json({ authenticated: false, user: null });
  }

  const settings = db.prepare(`
    SELECT store_name, store_phone, store_address, currency,
           markup_cash_percent, markup_installment_percent, rounding_unit,
           low_stock_threshold, language, theme
    FROM settings WHERE id = 1
  `).get() as any;

  return res.json({
    authenticated: true,
    user: req.user,
    settings,
  });
});

authRouter.post('/verify-price-override', requireAuth, (req: Request, res: Response) => {
  const parsed = PriceOverrideVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { code } = parsed.data;
  const secret = getPriceEditSecret();
  const settingsRow = db.prepare('SELECT price_edit_code_hash FROM settings WHERE id = 1').get() as {
    price_edit_code_hash: string;
  };

  const candidateHash = crypto.createHmac('sha256', secret).update(code.trim()).digest('hex');

  if (candidateHash !== settingsRow.price_edit_code_hash) {
    logAudit(req, 'PRICE_OVERRIDE_REJECTED', 'sales', null, { attempted_code_length: code.length });
    return res.status(403).json({ error: 'رمز التفويض غير صحيح! يرجى مراجعة المسؤول' });
  }

  const token = generatePriceOverrideToken(req.user!.id);
  logAudit(req, 'PRICE_OVERRIDE_GRANTED', 'sales', null, { user_id: req.user!.id });

  return res.json({
    success: true,
    token,
    message: 'تم تفويض تعديل السعر بنجاح (صالح لمدة ساعتين)',
  });
});
