import { Router } from 'express';
import type { Response } from 'express';
import { pgClient } from '../../db/index.ts';
import { requireAuth, requireAdmin, forbidCashier } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';
import { calculateAutomaticPricing } from '../../utils/pricing.ts';

const router = Router();

// Helper to generate unique purchase number
async function generatePurchaseNumber(): Promise<string> {
  const settingsRes = await pgClient.query<{ purchase_prefix: string }>(
    'SELECT purchase_prefix FROM company_settings LIMIT 1'
  );
  const prefix = settingsRes.rows[0]?.purchase_prefix || 'PUR-';

  const lastPur = await pgClient.query<{ purchase_number: string }>(
    `SELECT purchase_number FROM purchases WHERE purchase_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (lastPur.rows.length > 0) {
    const rawNum = lastPur.rows[0].purchase_number.slice(prefix.length);
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const padded = String(nextNum).padStart(6, '0');
  return `${prefix}${padded}`;
}

// Helper to generate unique supplier payment voucher number
async function generatePaymentNumber(): Promise<string> {
  const lastPay = await pgClient.query<{ payment_number: string }>(
    `SELECT payment_number FROM supplier_payments WHERE payment_number LIKE 'SPAY-%' ORDER BY id DESC LIMIT 1`
  );
  let nextNum = 1;
  if (lastPay.rows.length > 0) {
    const rawNum = lastPay.rows[0].payment_number.slice(5);
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed)) nextNum = parsed + 1;
  }
  return `SPAY-${String(nextNum).padStart(6, '0')}`;
}

// List Purchases (Forbidden for Cashiers)
router.get('/', requireAuth, forbidCashier, requireAdmin, async (req, res: Response) => {
  try {
    const { search, supplierId } = req.query;
    let query = `
      SELECT p.*,
             (p.total_amount - COALESCE(p.paid_amount, 0))::numeric as balance_due,
             u.name as created_by_name,
             s.name as supplier_official_name, s.phone as supplier_phone, s.email as supplier_email,
             (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count
      FROM purchases p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(p.purchase_number) LIKE $${params.length} OR LOWER(p.supplier_name) LIKE $${params.length} OR LOWER(COALESCE(s.name, '')) LIKE $${params.length})`;
    }

    if (supplierId) {
      const parsedSupId = parseInt(String(supplierId), 10);
      if (!isNaN(parsedSupId)) {
        params.push(parsedSupId);
        query += ` AND p.supplier_id = $${params.length}`;
      }
    }

    query += ` ORDER BY p.id DESC`;

    const result = await pgClient.query(query, params);
    res.json({ purchases: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch purchases: ' + err.message });
  }
});

// Single Purchase with items (Forbidden for Cashiers)
router.get('/:id', requireAuth, forbidCashier, requireAdmin, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const purRes = await pgClient.query(
      `SELECT p.*,
              (p.total_amount - COALESCE(p.paid_amount, 0))::numeric as balance_due,
              u.name as created_by_name,
              s.name as supplier_official_name, s.phone as supplier_phone, s.email as supplier_email
       FROM purchases p
       LEFT JOIN users u ON p.created_by = u.id
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = $1`,
      [id]
    );

    if (purRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase record not found.' });
    }

    const itemsRes = await pgClient.query(
      `SELECT pi.*, COALESCE(pr.article, pr.name) as article, COALESCE(pr.article, pr.name) as product_name, pr.sku, pr.barcode
       FROM purchase_items pi
       JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = $1`,
      [id]
    );

    // Fetch payments specifically linked to this purchase
    const paymentsRes = await pgClient.query(
      `SELECT sp.*, u.name as created_by_name
       FROM supplier_payments sp
       LEFT JOIN users u ON sp.created_by = u.id
       WHERE sp.purchase_id = $1
       ORDER BY sp.id DESC`,
      [id]
    );

    res.json({
      purchase: {
        ...(purRes.rows[0] as any),
        items: itemsRes.rows,
        payments: paymentsRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch purchase details: ' + err.message });
  }
});

// Create Purchase (Atomic Stock Increment + Ledger Recording - Forbidden for Cashiers)
router.post('/', requireAuth, forbidCashier, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const {
    supplierId,
    supplierName,
    purchaseDate,
    notes = '',
    items = [], // [{ productId, quantity, unitPurchasePrice }]
    paidAmount = 0,
    paymentMethod = 'CASH',
    paymentReference = '',
    paymentNotes = '',
  } = req.body;

  let resolvedSupplierName = (supplierName || '').trim();
  let resolvedSupplierId: number | null = null;

  if (supplierId) {
    const parsedId = parseInt(String(supplierId), 10);
    if (!isNaN(parsedId)) {
      resolvedSupplierId = parsedId;
      const supCheck = await pgClient.query<{ id: number; name: string }>(
        'SELECT id, name FROM suppliers WHERE id = $1',
        [parsedId]
      );
      if (supCheck.rows.length > 0) {
        if (!resolvedSupplierName) {
          resolvedSupplierName = supCheck.rows[0].name;
        }
      }
    }
  }

  if (!resolvedSupplierName) {
    return res.status(400).json({ error: 'Supplier selection or supplier name is required.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one purchase item is required.' });
  }

  await pgClient.query('BEGIN');

  try {
    const purchaseNumber = await generatePurchaseNumber();
    let totalAmount = 0;

    const setRes = await pgClient.query<{ min_profit_margin: string; max_profit_margin: string }>(
      'SELECT min_profit_margin, max_profit_margin FROM company_settings LIMIT 1'
    );
    const minMargin = parseFloat(setRes.rows[0]?.min_profit_margin ?? '10') || 10;
    const maxMargin = parseFloat(setRes.rows[0]?.max_profit_margin ?? '30') || 30;

    const validatedItems: Array<{
      productId: number;
      productName: string;
      quantity: number;
      unitPurchasePrice: number;
      subtotal: number;
      prevStock: number;
      newStock: number;
    }> = [];

    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const qty = parseInt(item.quantity ?? item.qty, 10);

      // Support unitPurchasePrice, unitCost, unit_purchase_price, or price
      const rawPrice =
        item.unitPurchasePrice !== undefined && item.unitPurchasePrice !== null && item.unitPurchasePrice !== ''
          ? item.unitPurchasePrice
          : item.unitCost !== undefined && item.unitCost !== null && item.unitCost !== ''
          ? item.unitCost
          : item.unit_purchase_price !== undefined && item.unit_purchase_price !== null && item.unit_purchase_price !== ''
          ? item.unit_purchase_price
          : item.price;
      const unitPrice = parseFloat(rawPrice);

      if (isNaN(productId) || productId <= 0) {
        throw new Error(`Invalid product ID in purchase item.`);
      }
      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid quantity (${item.quantity}) in purchase item.`);
      }
      if (isNaN(unitPrice) || unitPrice < 0) {
        throw new Error(`Invalid unit price in purchase item.`);
      }

      const pRes = await pgClient.query<{ id: number; name: string; article: string; total_stock: number }>(
        'SELECT id, name, article, total_stock FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (pRes.rows.length === 0) {
        throw new Error(`Product ID ${productId} not found.`);
      }

      const prod = pRes.rows[0];
      const prevStock = prod.total_stock;
      const newStock = prevStock + qty;
      const subtotal = Math.round(qty * unitPrice * 100) / 100;
      totalAmount = Math.round((totalAmount + subtotal) * 100) / 100;

      // Update product stock and procurement cost price (Selling prices are auto-calculated dynamically in real time)
      await pgClient.query(
        'UPDATE products SET total_stock = $1, cost_price = $2, updated_at = NOW() WHERE id = $3',
        [newStock, unitPrice, prod.id]
      );

      validatedItems.push({
        productId: prod.id,
        productName: prod.article || prod.name,
        quantity: qty,
        unitPurchasePrice: unitPrice,
        subtotal,
        prevStock,
        newStock,
      });
    }

    const rawPaid = parseFloat(String(paidAmount ?? 0));
    const actualPaid = !isNaN(rawPaid) && rawPaid > 0 ? Math.min(totalAmount, Math.round(rawPaid * 100) / 100) : 0;
    const paymentStatus = actualPaid >= totalAmount ? 'PAID' : actualPaid > 0 ? 'PARTIAL' : 'UNPAID';
    const chosenPaymentMethod = (paymentMethod || 'CASH').toUpperCase();

    const purRes = await pgClient.query<{ id: number }>(
      `INSERT INTO purchases (
         purchase_number, supplier_id, supplier_name, purchase_date, total_amount, paid_amount, payment_status, payment_method, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        purchaseNumber,
        resolvedSupplierId,
        resolvedSupplierName,
        purchaseDate || new Date().toISOString().split('T')[0],
        totalAmount,
        actualPaid,
        paymentStatus,
        chosenPaymentMethod,
        notes || null,
        req.user!.id,
      ]
    );

    const purchaseId = purRes.rows[0].id;

    // If an initial payment was paid during purchase creation, automatically record into supplier_payments
    if (actualPaid > 0 && resolvedSupplierId) {
      const payNumber = await generatePaymentNumber();
      await pgClient.query(
        `INSERT INTO supplier_payments (
           payment_number, supplier_id, supplier_name, purchase_id, amount, payment_date, payment_method, reference_number, notes, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          payNumber,
          resolvedSupplierId,
          resolvedSupplierName,
          purchaseId,
          actualPaid,
          purchaseDate || new Date().toISOString().split('T')[0],
          chosenPaymentMethod,
          (paymentReference || '').trim(),
          (paymentNotes || `Paid upon purchase order ${purchaseNumber}`).trim(),
          req.user!.id,
        ]
      );
    }

    for (const v of validatedItems) {
      await pgClient.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_purchase_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [purchaseId, v.productId, v.quantity, v.unitPurchasePrice, v.subtotal]
      );

      // Record in Stock Movement Ledger
      await pgClient.query(
        `INSERT INTO stock_movements (
          product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes
        ) VALUES ($1, $2, $3, $4, 'PURCHASE', $5, $6, $7)`,
        [
          v.productId,
          v.quantity,
          v.prevStock,
          v.newStock,
          purchaseNumber,
          req.user!.id,
          `Stock received from ${supplierName.trim()}`,
        ]
      );
    }

    await pgClient.query('COMMIT');

    res.status(201).json({
      message: 'Purchase recorded and stock updated atomically.',
      purchaseNumber,
      purchaseId,
      totalAmount,
      paidAmount: actualPaid,
      balanceDue: Math.round((totalAmount - actualPaid) * 100) / 100,
      paymentStatus,
    });
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    console.error('Purchase transaction failed:', err);
    res.status(400).json({ error: err.message || 'Failed to record purchase.' });
  }
});

// Update Purchase (Forbidden for Cashiers)
router.put('/:id', requireAuth, forbidCashier, requireAdmin, async (_req, res: Response) => {
  return res.status(403).json({ error: 'Direct modification of historical purchases is restricted.' });
});

// Delete Purchase (Forbidden for Cashiers)
router.delete('/:id', requireAuth, forbidCashier, requireAdmin, async (_req, res: Response) => {
  return res.status(403).json({ error: 'Deleting historical purchase records is restricted.' });
});

export default router;
