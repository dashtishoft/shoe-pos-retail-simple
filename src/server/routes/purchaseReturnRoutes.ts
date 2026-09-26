import { Router } from 'express';
import type { Response } from 'express';
import { pgClient } from '../../db/index.ts';
import { requireAuth, requireAdmin } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';

const router = Router();

// Helper to generate unique purchase return / debit note number
async function generatePurchaseReturnNumber(): Promise<string> {
  const prefix = 'PR-';

  const lastRet = await pgClient.query<{ return_number: string }>(
    `SELECT return_number FROM purchase_returns WHERE return_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (lastRet.rows.length > 0) {
    const rawNum = lastRet.rows[0].return_number.slice(prefix.length);
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const padded = String(nextNum).padStart(6, '0');
  return `${prefix}${padded}`;
}

// Verify Purchase Invoice for Supplier Return
// Returns purchase details with items, already returned quantities, and available inventory
router.get('/verify-purchase/:purchaseNumber', requireAuth, requireAdmin, async (req, res: Response) => {
  try {
    const purchaseNumber = req.params.purchaseNumber.trim();

    const purRes = await pgClient.query(
      `SELECT p.*, s.name as supplier_official_name, s.phone as supplier_phone,
              s.email as supplier_email, s.balance as supplier_balance
       FROM purchases p
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE UPPER(p.purchase_number) = UPPER($1)`,
      [purchaseNumber]
    );

    if (purRes.rows.length === 0) {
      return res.status(404).json({ error: `Purchase invoice "${purchaseNumber}" not found.` });
    }

    const purchase: any = purRes.rows[0];

    // Fetch purchase items with already returned quantities and current stock
    const itemsRes = await pgClient.query(
      `SELECT pi.*, 
              COALESCE(pr.article, pr.name) as article,
              COALESCE(pr.article, pr.name) as product_name,
              pr.sku,
              pr.barcode,
              pr.total_stock as current_stock,
              COALESCE(
                (SELECT SUM(pri.quantity)
                 FROM purchase_return_items pri
                 JOIN purchase_returns pr_ret ON pri.purchase_return_id = pr_ret.id
                 WHERE pr_ret.purchase_id = pi.purchase_id AND pri.product_id = pi.product_id), 0
              )::int as already_returned_quantity
       FROM purchase_items pi
       JOIN products pr ON pi.product_id = pr.id
       WHERE pi.purchase_id = $1
       ORDER BY pi.id ASC`,
      [purchase.id]
    );

    const items = itemsRes.rows.map((item: any) => {
      const purchasedQty = parseInt(item.quantity, 10);
      const returnedQty = parseInt(item.already_returned_quantity, 10);
      const returnableQty = Math.max(0, purchasedQty - returnedQty);
      const currentStock = parseInt(item.current_stock, 10);

      return {
        id: item.id,
        productId: item.product_id,
        article: item.article || item.product_name,
        productName: item.article || item.product_name,
        sku: item.sku,
        barcode: item.barcode,
        purchasedQuantity: purchasedQty,
        alreadyReturnedQuantity: returnedQty,
        returnableQuantity: returnableQty,
        currentStock,
        unitPurchasePrice: parseFloat(item.unit_purchase_price),
        subtotal: parseFloat(item.subtotal),
      };
    });

    res.json({
      purchase: {
        id: purchase.id,
        purchaseNumber: purchase.purchase_number,
        purchaseDate: purchase.purchase_date,
        totalAmount: parseFloat(purchase.total_amount),
        supplierId: purchase.supplier_id,
        supplierName: purchase.supplier_official_name || purchase.supplier_name,
        supplierPhone: purchase.supplier_phone || '',
        supplierEmail: purchase.supplier_email || '',
        supplierBalance: parseFloat(purchase.supplier_balance || '0'),
        items,
      },
      items,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify purchase invoice: ' + err.message });
  }
});

// List Purchase Returns (Supplier Debit Notes)
router.get('/', requireAuth, requireAdmin, async (req, res: Response) => {
  try {
    const { search, supplierId } = req.query;
    let query = `
      SELECT pr.*, 
             u.name as created_by_name,
             s.phone as supplier_phone,
             s.email as supplier_email,
             s.balance as supplier_balance,
             p.purchase_number as original_purchase_number,
             (SELECT COUNT(*) FROM purchase_return_items pri WHERE pri.purchase_return_id = pr.id)::int as item_count,
             (SELECT COALESCE(SUM(pri.carton_quantity), 0) FROM purchase_return_items pri WHERE pri.purchase_return_id = pr.id)::int as total_cartons,
             (SELECT COALESCE(SUM(pri.quantity), 0) FROM purchase_return_items pri WHERE pri.purchase_return_id = pr.id)::int as total_pairs
      FROM purchase_returns pr
      LEFT JOIN users u ON pr.created_by = u.id
      LEFT JOIN suppliers s ON pr.supplier_id = s.id
      LEFT JOIN purchases p ON pr.purchase_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(pr.return_number) LIKE $${params.length} OR LOWER(pr.supplier_name) LIKE $${params.length} OR LOWER(COALESCE(p.purchase_number, '')) LIKE $${params.length} OR LOWER(pr.reason) LIKE $${params.length})`;
    }

    if (supplierId) {
      const parsedSupId = parseInt(String(supplierId), 10);
      if (!isNaN(parsedSupId)) {
        params.push(parsedSupId);
        query += ` AND pr.supplier_id = $${params.length}`;
      }
    }

    query += ` ORDER BY pr.id DESC`;

    const result = await pgClient.query(query, params);
    res.json({ returns: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch purchase returns: ' + err.message });
  }
});

// Single Purchase Return Details (Debit Note)
router.get('/:id', requireAuth, requireAdmin, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const retRes = await pgClient.query(
      `SELECT pr.*, 
              u.name as created_by_name,
              s.phone as supplier_phone,
              s.email as supplier_email,
              s.balance as supplier_balance,
              p.purchase_number as original_purchase_number,
              p.purchase_date as original_purchase_date
       FROM purchase_returns pr
       LEFT JOIN users u ON pr.created_by = u.id
       LEFT JOIN suppliers s ON pr.supplier_id = s.id
       LEFT JOIN purchases p ON pr.purchase_id = p.id
       WHERE pr.id = $1`,
      [id]
    );

    if (retRes.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase return record not found.' });
    }

    const itemsRes = await pgClient.query(
      `SELECT pri.*, 
              COALESCE(p.article, p.name) as article,
              COALESCE(p.article, p.name) as product_name,
              p.sku,
              p.barcode,
              p.total_stock as current_stock
       FROM purchase_return_items pri
       JOIN products p ON pri.product_id = p.id
       WHERE pri.purchase_return_id = $1
       ORDER BY pri.id ASC`,
      [id]
    );

    res.json({
      returnRecord: {
        ...(retRes.rows[0] as any),
        items: itemsRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch purchase return details: ' + err.message });
  }
});

// Process Supplier Purchase Return (Defective Shoe Cartons)
// Decrements Inventory, Records 'PURCHASE_RETURN' in Stock Ledger, and Debits Supplier Account
router.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const {
    supplierId,
    supplierName,
    purchaseId,
    purchaseNumber,
    returnDate,
    reason,
    notes = '',
    items = [], // [{ productId, cartonQuantity, pairsPerCarton, quantity, unitPurchasePrice, defectType }]
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

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Return / defect reason is required.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one defective shoe item/carton must be specified.' });
  }

  let resolvedPurchaseId: number | null = null;
  if (purchaseId) {
    const pId = parseInt(String(purchaseId), 10);
    if (!isNaN(pId) && pId > 0) {
      resolvedPurchaseId = pId;
    }
  } else if (purchaseNumber && typeof purchaseNumber === 'string' && purchaseNumber.trim()) {
    const pRes = await pgClient.query<{ id: number }>(
      'SELECT id FROM purchases WHERE UPPER(purchase_number) = UPPER($1)',
      [purchaseNumber.trim()]
    );
    if (pRes.rows.length > 0) {
      resolvedPurchaseId = pRes.rows[0].id;
    }
  }

  await pgClient.query('BEGIN');

  try {
    const returnNumber = await generatePurchaseReturnNumber();
    let totalDebitAmount = 0;

    const validatedItems: Array<{
      productId: number;
      productName: string;
      cartonQuantity: number;
      pairsPerCarton: number;
      quantity: number;
      unitPurchasePrice: number;
      subtotal: number;
      defectType: string;
      prevStock: number;
      newStock: number;
    }> = [];

    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const cartonQty = Math.max(1, parseInt(item.cartonQuantity ?? 1, 10) || 1);
      const pairsPerCarton = Math.max(1, parseInt(item.pairsPerCarton ?? 1, 10) || 1);
      
      // If quantity is explicitly provided, use it; otherwise compute cartonQuantity * pairsPerCarton
      const totalPairs = item.quantity !== undefined && item.quantity !== null
        ? parseInt(item.quantity, 10)
        : cartonQty * pairsPerCarton;

      const rawPrice =
        item.unitPurchasePrice !== undefined && item.unitPurchasePrice !== null && item.unitPurchasePrice !== ''
          ? item.unitPurchasePrice
          : item.unitCost !== undefined && item.unitCost !== null && item.unitCost !== ''
          ? item.unitCost
          : item.price;
      const unitPrice = parseFloat(rawPrice);

      if (isNaN(productId) || productId <= 0) {
        throw new Error('Invalid product ID in return item.');
      }
      if (isNaN(totalPairs) || totalPairs <= 0) {
        throw new Error(`Invalid return quantity (${totalPairs}) for product ID ${productId}.`);
      }
      if (isNaN(unitPrice) || unitPrice < 0) {
        throw new Error(`Invalid unit cost price for product ID ${productId}.`);
      }

      // Lock product row
      const prodRes = await pgClient.query<{ id: number; name: string; article: string; total_stock: number }>(
        'SELECT id, name, article, total_stock FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );

      if (prodRes.rows.length === 0) {
        throw new Error(`Product ID ${productId} not found in catalog.`);
      }

      const prod = prodRes.rows[0];
      const prevStock = prod.total_stock;

      if (prevStock < totalPairs) {
        throw new Error(
          `Cannot return ${totalPairs} pair(s) of "${prod.article || prod.name}". Current available inventory is only ${prevStock} pair(s).`
        );
      }

      const newStock = prevStock - totalPairs;
      const subtotal = Math.round(totalPairs * unitPrice * 100) / 100;
      totalDebitAmount = Math.round((totalDebitAmount + subtotal) * 100) / 100;

      // Deduct stock from product
      await pgClient.query(
        'UPDATE products SET total_stock = $1, updated_at = NOW() WHERE id = $2',
        [newStock, prod.id]
      );

      validatedItems.push({
        productId: prod.id,
        productName: prod.article || prod.name,
        cartonQuantity: cartonQty,
        pairsPerCarton,
        quantity: totalPairs,
        unitPurchasePrice: unitPrice,
        subtotal,
        defectType: (item.defectType || 'DEFECTIVE_CARTON').trim(),
        prevStock,
        newStock,
      });
    }

    if (validatedItems.length === 0) {
      throw new Error('No valid items to return.');
    }

    // Insert purchase_returns header
    const returnRes = await pgClient.query<{ id: number }>(
      `INSERT INTO purchase_returns (
        return_number, purchase_id, supplier_id, supplier_name, return_date,
        total_debit_amount, reason, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        returnNumber,
        resolvedPurchaseId,
        resolvedSupplierId,
        resolvedSupplierName,
        returnDate || new Date().toISOString().split('T')[0],
        totalDebitAmount,
        reason.trim(),
        notes ? notes.trim() : null,
        req.user!.id,
      ]
    );

    const returnId = returnRes.rows[0].id;

    for (const v of validatedItems) {
      // Insert item
      await pgClient.query(
        `INSERT INTO purchase_return_items (
          purchase_return_id, product_id, carton_quantity, pairs_per_carton,
          quantity, unit_purchase_price, subtotal, defect_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          returnId,
          v.productId,
          v.cartonQuantity,
          v.pairsPerCarton,
          v.quantity,
          v.unitPurchasePrice,
          v.subtotal,
          v.defectType,
        ]
      );

      // Record in Stock Movement Ledger with movement_type 'PURCHASE_RETURN'
      await pgClient.query(
        `INSERT INTO stock_movements (
          product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes
        ) VALUES ($1, $2, $3, $4, 'PURCHASE_RETURN', $5, $6, $7)`,
        [
          v.productId,
          -v.quantity, // Negative quantity change
          v.prevStock,
          v.newStock,
          returnNumber,
          req.user!.id,
          `Supplier Return (Debit Note) to ${resolvedSupplierName}: ${v.cartonQuantity} carton(s) [${v.quantity} pairs] - ${v.defectType} (${reason.trim()})`,
        ]
      );
    }

    // Debit supplier account: Reduce supplier payable balance
    if (resolvedSupplierId) {
      await pgClient.query(
        `UPDATE suppliers 
         SET balance = COALESCE(balance, 0) - $1, updated_at = NOW() 
         WHERE id = $2`,
        [totalDebitAmount, resolvedSupplierId]
      );
    }

    await pgClient.query('COMMIT');

    res.status(201).json({
      message: `Purchase return ${returnNumber} processed. ${totalDebitAmount} debited to supplier ${resolvedSupplierName}.`,
      returnNumber,
      returnId,
      totalDebitAmount,
      supplierName: resolvedSupplierName,
      supplierId: resolvedSupplierId,
    });
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    console.error('Purchase return transaction error:', err);
    res.status(400).json({ error: err.message || 'Failed to process supplier return.' });
  }
});

export default router;
