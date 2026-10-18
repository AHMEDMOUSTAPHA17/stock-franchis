import type { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db } from './db.ts';

export interface AuthUser {
  id: string;
  username: string;
  role: 'founder' | 'admin' | 'user';
  is_active: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionToken?: string;
    }
  }
}

/**
 * Create a secure 192-bit session in database
 */
export function createSession(userId: string): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(24).toString('hex'); // 192-bit
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  db.prepare(`
    INSERT INTO sessions (id, user_id, data, expires_at)
    VALUES (?, ?, '{}', ?)
  `).run(token, userId, expiresAt);

  return { token, expiresAt };
}

/**
 * Destroy a session
 */
export function destroySession(token: string) {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
}

/**
 * Authenticate request via cookie or Bearer token
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.gstock_sid;
  const headerToken = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const token = cookieToken || headerToken;

  if (!token) {
    return next();
  }

  const session = db.prepare(`
    SELECT s.id as token, s.expires_at, u.id, u.username, u.role, u.is_active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(token, Date.now()) as (AuthUser & { token: string; expires_at: number }) | undefined;

  if (session && session.is_active === 1) {
    req.user = {
      id: session.id,
      username: session.username,
      role: session.role,
      is_active: session.is_active,
    };
    req.sessionToken = token;
  }

  next();
}

/**
 * Guard: Require logged in user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'غير مصرح: يجب تسجيل الدخول للوصول لهذه الخدمة' });
  }
  next();
}

/**
 * Guard: Role-based access control
 */
export function requireRole(allowedRoles: ('founder' | 'admin' | 'user')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'غير مصرح: يرجى تسجيل الدخول أولاً' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'عذراً، لا تمتلك الصلاحيات الكافية لتنفيذ هذا الإجراء' });
    }
    next();
  };
}

/**
 * Get the installation secret for price override signing
 */
export function getPriceEditSecret(): string {
  const row = db.prepare('SELECT price_edit_token_secret FROM settings WHERE id = 1').get() as {
    price_edit_token_secret: string;
  } | undefined;
  return row?.price_edit_token_secret || 'default_secret_key';
}

/**
 * Generate temporary signed HMAC token for POS Price Override (TTL = 2 hours)
 */
export function generatePriceOverrideToken(userId: string): string {
  const secret = getPriceEditSecret();
  const payload = {
    userId,
    iat: Date.now(),
    exp: Date.now() + 2 * 60 * 60 * 1000, // 2 hours TTL
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');
  return `${payloadStr}.${signature}`;
}

/**
 * Verify POS Price Override Token
 */
export function verifyPriceOverrideToken(token: string, currentUserId: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadStr, signature] = parts;
  const secret = getPriceEditSecret();
  const expectedSig = crypto.createHmac('sha256', secret).update(payloadStr).digest('base64url');

  if (signature !== expectedSig) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (payload.userId !== currentUserId) return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Log structured audit event
 */
export function logAudit(
  req: Request,
  action: string,
  entity: string,
  entityId: string | null = null,
  details: Record<string, unknown> = {}
) {
  try {
    const userId = req.user?.id || null;
    const username = req.user?.username || 'anonymous';
    const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || '127.0.0.1';

    db.prepare(`
      INSERT INTO audit_log (id, user_id, username, action, entity, entity_id, details, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      username,
      action,
      entity,
      entityId,
      JSON.stringify(details),
      ip
    );
  } catch (err) {
    console.error('Audit log write error:', err);
  }
}

/**
 * Obfuscate cost price and profit margins from normal user / cashier responses
 */
export function maskProduct(prod: any, role?: string) {
  if (role === 'user') {
    const { cost_price, margin, ...rest } = prod;
    return rest;
  }
  return prod;
}
