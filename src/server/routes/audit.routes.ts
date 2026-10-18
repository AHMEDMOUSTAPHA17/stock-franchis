import { Router, Request, Response } from 'express';
import { db } from '../db.ts';
import { requireAuth, requireRole } from '../auth.ts';

export const auditRouter = Router();

// Strict Invariant: Only 'founder' role is authorized to read audit logs!
auditRouter.get('/', requireAuth, requireRole(['founder']), (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '30', 10)));
  const offset = (page - 1) * limit;
  const action = (req.query.action as string || '').trim();
  const entity = (req.query.entity as string || '').trim();

  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params: any[] = [];

  if (action) {
    query += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }

  if (entity) {
    query += ' AND entity = ?';
    params.push(entity);
  }

  const countQuery = query.replace('SELECT *', 'SELECT count(*) as total');
  const countRow = db.prepare(countQuery).get(...params) as { total: number };

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const logs = db.prepare(query).all(...params);

  return res.json({
    logs,
    total: countRow.total,
    page,
    limit,
    totalPages: Math.ceil(countRow.total / limit),
  });
});
