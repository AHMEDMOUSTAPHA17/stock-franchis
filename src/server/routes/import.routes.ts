import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { XMLParser } from 'fast-xml-parser';
import { db, dbTransaction } from '../db.ts';
import { requireAuth, requireRole, logAudit } from '../auth.ts';

export const importRouter = express.Router();

// Staging cache for preview with 30-minute TTL
interface StagingBatch {
  previewId: string;
  sourceType: 'excel' | 'flb';
  createdAt: number;
  items: Array<{
    prd_ref: string;
    design: string;
    qty: number;
    cost_price: number;
    is_new: boolean;
    existing_qty?: number;
  }>;
  stats: {
    totalItems: number;
    newCount: number;
    updatedCount: number;
    totalQty: number;
    totalCost: number;
  };
}

const stagingCache = new Map<string, StagingBatch>();

// Robust helper to parse numbers formatted with spaces (e.g. '37 450.00'), non-breaking spaces (\u00A0), or comma decimals
export function cleanNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val)
    .replace(/[\s\u00A0\u202F\u2007]+/g, '')
    .replace(/,/g, '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Case-insensitive & normalized field reader from any record (XML object or CSV/Excel row)
export function getField(obj: any, candidates: string[]): any {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const c of candidates) {
    if (obj[c] !== undefined && obj[c] !== null && obj[c] !== '') return obj[c];
  }
  const cleanMap = new Map<string, any>();
  for (const [k, v] of Object.entries(obj)) {
    const cleanKey = k.toLowerCase().replace(/[\s_\-\.\/]+/g, '');
    if (!cleanMap.has(cleanKey)) cleanMap.set(cleanKey, v);
  }
  for (const c of candidates) {
    const cleanC = c.toLowerCase().replace(/[\s_\-\.\/]+/g, '');
    if (cleanMap.has(cleanC)) {
      const val = cleanMap.get(cleanC);
      if (val !== undefined && val !== null && val !== '') return val;
    }
  }
  return undefined;
}

// Helper to recursively extract array of item records from XML trees
export function extractXmlRecords(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) {
    if (node.length > 0 && typeof node[0] === 'object') {
      // Check if this array is wrapping a sub-collection (e.g. [ { product: [...] } ])
      for (const itemKey of ['product', 'produit', 'article', 'item', 'row', 'ligne']) {
        for (const k of Object.keys(node[0])) {
          if (k.toLowerCase() === itemKey) {
            const sub = extractXmlRecords(node[0][k]);
            if (sub.length > 0) return sub;
          }
        }
      }
    }
    return node;
  }

  // Check known collection & document property names (item keys first, then container keys)
  const candidateKeys = [
    'product', 'produit', 'article', 'item', 'row', 'ligne',
    'products', 'produits', 'articles', 'items', 'rows', 'lignes',
    'bon', 'bonlivraison', 'bondelivraison', 'bonreception', 'flb_database', 'flb',
    'stock', 'records', 'data', 'articles_list', 'table'
  ];
  for (const k of candidateKeys) {
    for (const actualKey of Object.keys(node)) {
      if (actualKey.toLowerCase() === k) {
        const val = node[actualKey];
        if (Array.isArray(val)) return extractXmlRecords(val);
        if (typeof val === 'object') {
          const sub = extractXmlRecords(val);
          if (sub.length > 0) return sub;
          return [val];
        }
      }
    }
  }

  // Check any property of node that is an array of objects
  for (const val of Object.values(node)) {
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
      return extractXmlRecords(val);
    }
    if (typeof val === 'object') {
      const sub = extractXmlRecords(val);
      if (sub.length > 0) return sub;
    }
  }

  return [node];
}

function parseXmlTextToRecords(xmlText: string): any[] {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
      isArray: (name) => [
        'product', 'produit', 'article', 'item', 'row', 'ligne'
      ].includes(name.toLowerCase()),
    });
    const parsed = parser.parse(xmlText);
    return extractXmlRecords(parsed);
  } catch (e) {
    console.warn('XML parse error:', e);
    return [];
  }
}

function parseCsvTextToRecords(trimmed: string): any[] {
  const records: any[] = [];
  const lines = trimmed.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
  if (lines.length > 1) {
    const delimiter = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const headers = lines[0].split(delimiter).map((h: string) => h.trim().replace(/^["']|["']$/g, ''));
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c: string) => c.trim().replace(/^["']|["']$/g, ''));
      const row: any = {};
      headers.forEach((h: string, idx: number) => {
        row[h] = cols[idx] !== undefined ? cols[idx] : '';
      });
      records.push(row);
    }
  }
  return records;
}

/**
 * Step 1 & 2: Parse, Normalize & Stage Preview
 */
importRouter.post('/stage', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  try {
    const { fileData, fileName, rawText, sourceType = 'excel' } = req.body;
    let rawRecords: any[] = [];

    if (fileData) {
      // Base64 file provided (Excel or XML/FLB)
      const buffer = Buffer.from(fileData, 'base64');
      const lowerName = (fileName || '').toLowerCase();
      const textHead = buffer.subarray(0, 500).toString('utf-8').trim();
      const isXml = lowerName.endsWith('.xml') || lowerName.endsWith('.flb') || sourceType === 'flb' || textHead.startsWith('<') || textHead.includes('<Product>') || textHead.includes('<Bon>');

      if (isXml) {
        const xmlText = buffer.toString('utf-8');
        rawRecords = parseXmlTextToRecords(xmlText);
      } else {
        // Attempt Excel parsing safely
        try {
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          if (workbook && Array.isArray(workbook.SheetNames) && workbook.SheetNames.length > 0) {
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            if (sheet) {
              rawRecords = XLSX.utils.sheet_to_json(sheet);
            }
          }
        } catch (excelErr: any) {
          // If XLSX.read threw (e.g. XML file misidentified or CSV in binary buffer), fallback to text parsing
          console.warn('XLSX.read failed, attempting fallback text parser:', excelErr.message);
          const asText = buffer.toString('utf-8').trim();
          if (asText.startsWith('<') || asText.includes('<Product>') || asText.includes('<Bon>')) {
            rawRecords = parseXmlTextToRecords(asText);
          } else {
            rawRecords = parseCsvTextToRecords(asText);
          }
        }
      }
    } else if (rawText) {
      // Support pasted XML (from Notepad / Bloc-Notes), CSV, TSV or JSON
      const trimmed = rawText.trim();
      if (trimmed.startsWith('<') || trimmed.includes('<Product>') || trimmed.includes('<Bon>')) {
        rawRecords = parseXmlTextToRecords(trimmed);
      } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          rawRecords = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          rawRecords = parseCsvTextToRecords(trimmed);
        }
      } else {
        rawRecords = parseCsvTextToRecords(trimmed);
      }
    } else {
      return res.status(400).json({ error: 'لم يتم توفير ملف أو بيانات للاستيراد' });
    }

    if (!rawRecords || rawRecords.length === 0) {
      return res.status(400).json({ error: 'لم يتم العثور على أي سجلات صالحة في الملف المدخل' });
    }

    // Normalize and merge duplicates
    const mergedMap = new Map<string, { prd_ref: string; design: string; qty: number; cost_price: number }>();

    for (const raw of rawRecords) {
      // Extract reference / barcode
      const rawRef = getField(raw, [
        'PrdRef', 'prd_ref', 'prdref', 'Ref', 'ref', 'Reference', 'reference',
        'Code', 'code', 'CodeBarre', 'codebarre', 'Barcode', 'barcode',
        'Art_Ref', 'art_ref', 'ArtRef', 'artref', 'RefArticle', 'refarticle',
        'الرمز', 'رمز', 'المرجع', 'مرجع'
      ]);
      const ref = String(rawRef || '').trim();
      if (!ref) continue;

      // Extract product designation / name
      const rawDesign = getField(raw, [
        'Design', 'design', 'OrgDesign', 'orgdesign', 'Designation', 'designation',
        'Libelle', 'libelle', 'Name', 'name', 'Nom', 'nom', 'Description', 'description',
        'Produit', 'produit', 'Article', 'article', 'اسم', 'الاسم', 'تعيين', 'التعيين', 'صنف', 'الصنف'
      ]);
      const design = String(rawDesign || ref).trim();

      // Extract quantity (supports Qts, Qty, Qte, Quantite, كمية, etc.)
      const rawQty = getField(raw, [
        'Qts', 'qts', 'Qty', 'qty', 'Qte', 'qte', 'Quantite', 'quantite',
        'Stock', 'stock', 'QteStock', 'qtestock', 'Nombre', 'nombre',
        'كمية', 'الكمية', 'عدد', 'العدد'
      ]);
      const qty = Math.max(0, Math.round(cleanNumber(rawQty)));

      // Extract cost price:
      // 1. Direct purchase cost (PrixAchat, Cost, PA, UnitCost)
      // 2. Bon supplier price (PrixVente, PV, Prix, PU, Price)
      // 3. Fallback: Subtotal MottantHt/MontantHt divided by qty
      let rawCost = getField(raw, [
        'PrixAchat', 'prixachat', 'prix_achat', 'CostPrice', 'costprice', 'cost_price',
        'Cost', 'cost', 'PA', 'pa', 'PAchat', 'pachat', 'UnitCost', 'unitcost', 'unit_cost',
        'سعرالشراء', 'سعر الشراء', 'تكلفة', 'التكلفة', 'سعرالتكلفة', 'سعر التكلفة', 'شراء'
      ]);

      if (rawCost === undefined || rawCost === null || rawCost === '') {
        rawCost = getField(raw, [
          'PrixVente', 'prixvente', 'prix_vente', 'PV', 'pv', 'Prix', 'prix', 'Price', 'price',
          'PU', 'pu', 'PrixUnitaire', 'prixunitaire', 'prix_unitaire',
          'سعر', 'السعر', 'سعرالبيع', 'سعر البيع'
        ]);
      }

      let cost_price = Math.max(0, cleanNumber(rawCost));

      // If unit price was 0 or not found, but total Montant/MottantHt exists and qty > 0:
      if (cost_price === 0 && qty > 0) {
        const rawTotal = getField(raw, [
          'MottantHt', 'mottantht', 'MontantHt', 'montantht', 'mottant_ht', 'montant_ht',
          'Mottant', 'mottant', 'Montant', 'montant', 'TotalHt', 'totalht', 'Total', 'total'
        ]);
        const totalAmount = cleanNumber(rawTotal);
        if (totalAmount > 0) {
          cost_price = Math.round((totalAmount / qty) * 100) / 100;
        }
      }

      const key = ref.toLowerCase();
      if (mergedMap.has(key)) {
        const cur = mergedMap.get(key)!;
        cur.qty += qty;
        if (cost_price > 0) cur.cost_price = cost_price;
        if (design && (!cur.design || cur.design === cur.prd_ref)) cur.design = design;
      } else {
        mergedMap.set(key, { prd_ref: ref, design: design || ref, qty, cost_price });
      }
    }

    if (mergedMap.size === 0) {
      return res.status(400).json({ error: 'لم يتم التعرف على أعمدة الرمز المرجعي أو الكميات في السجلات' });
    }

    // Check with existing database products
    let newCount = 0;
    let updatedCount = 0;
    let totalQty = 0;
    let totalCost = 0;

    const stagedItems: StagingBatch['items'] = [];

    for (const item of mergedMap.values()) {
      const existing = db.prepare('SELECT id, qty, cost_price FROM products WHERE prd_ref = ? COLLATE NOCASE').get(item.prd_ref) as any;
      const isNew = !existing;

      if (isNew) {
        newCount++;
      } else {
        updatedCount++;
      }

      totalQty += item.qty;
      totalCost += item.qty * item.cost_price;

      stagedItems.push({
        ...item,
        is_new: isNew,
        existing_qty: existing ? existing.qty : 0,
      });
    }

    const previewId = crypto.randomUUID();
    const stats = {
      totalItems: stagedItems.length,
      newCount,
      updatedCount,
      totalQty,
      totalCost,
    };

    stagingCache.set(previewId, {
      previewId,
      sourceType: (sourceType as any) || 'excel',
      createdAt: Date.now(),
      items: stagedItems,
      stats,
    });

    // Auto cleanup old previews > 30 mins
    const now = Date.now();
    for (const [id, batch] of stagingCache.entries()) {
      if (now - batch.createdAt > 30 * 60 * 1000) {
        stagingCache.delete(id);
      }
    }

    return res.json({
      previewId,
      stats,
      sampleItems: stagedItems.slice(0, 50),
      expiresInMinutes: 30,
    });
  } catch (err: any) {
    console.error('Import staging error:', err);
    return res.status(500).json({ error: err.message || 'حدث خطأ أثناء معالجة وقراءة الملف' });
  }
});

/**
 * Step 3: Atomic Commit
 */
importRouter.post('/commit', requireAuth, requireRole(['founder', 'admin']), (req: Request, res: Response) => {
  const { previewId, supplier = 'استيراد مجمّع تلقائي' } = req.body;

  if (!previewId || !stagingCache.has(previewId)) {
    return res.status(400).json({ error: 'جلسة المعاينة منتهية الصلاحية أو غير صالحة. يرجى إعادة رفع الملف.' });
  }

  const batch = stagingCache.get(previewId)!;

  try {
    const result = dbTransaction(() => {
      const purchaseId = crypto.randomUUID();
      // 1. Record purchase header FIRST to satisfy foreign key constraint
      db.prepare(`
        INSERT INTO purchases (id, supplier, note, source, total_cost, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        purchaseId,
        supplier,
        `استيراد مجمّع (${batch.sourceType.toUpperCase()} Import) - عدد الأصناف: ${batch.items.length}`,
        batch.sourceType,
        batch.stats.totalCost,
        req.user!.id
      );

      // 2. Insert items and movements
      let committedCount = 0;
      for (const item of batch.items) {
        const existing = db.prepare('SELECT id, qty FROM products WHERE prd_ref = ? COLLATE NOCASE').get(item.prd_ref) as any;
        let productId = existing?.id;

        if (existing) {
          // Cumulative Qty: Qty_new = Qty_current + Qty_inbound, update cost price
          db.prepare(`
            UPDATE products
            SET qty = qty + ?, cost_price = ?, updated_at = datetime('now', 'localtime')
            WHERE id = ?
          `).run(item.qty, item.cost_price, existing.id);
        } else {
          productId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO products (id, prd_ref, design, qty, cost_price)
            VALUES (?, ?, ?, ?, ?)
          `).run(productId, item.prd_ref, item.design, item.qty, item.cost_price);
        }

        // Record inventory movement
        db.prepare(`
          INSERT INTO inventory_movements (id, product_id, qty_change, type, ref_type, ref_id, created_by)
          VALUES (?, ?, ?, 'import', 'bulk_import', ?, ?)
        `).run(
          crypto.randomUUID(),
          productId,
          item.qty,
          purchaseId,
          req.user!.id
        );

        // Record purchase item
        db.prepare(`
          INSERT INTO purchase_items (id, purchase_id, product_id, prd_ref, design, qty, unit_cost, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          purchaseId,
          productId,
          item.prd_ref,
          item.design,
          item.qty,
          item.cost_price,
          item.qty * item.cost_price
        );

        committedCount++;
      }

      logAudit(req, 'BULK_IMPORT_COMMIT', 'products', purchaseId, {
        sourceType: batch.sourceType,
        totalItems: batch.stats.totalItems,
        newCount: batch.stats.newCount,
        updatedCount: batch.stats.updatedCount,
        totalQty: batch.stats.totalQty,
        totalCost: batch.stats.totalCost,
      });

      return {
        purchaseId,
        committedCount,
        stats: batch.stats,
      };
    });

    // Remove from staging
    stagingCache.delete(previewId);

    return res.json({
      success: true,
      message: `تم تثبيت الاستيراد بنجاح! تمت إضافة وتحديث ${result.committedCount} صنفاً بالمخزون.`,
      result,
    });
  } catch (err: any) {
    console.error('Commit error:', err);
    return res.status(500).json({ error: err.message || 'فشلت عملية تثبيت الاستيراد' });
  }
});
