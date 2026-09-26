import { Router } from 'express';
import type { Response } from 'express';
import { pgClient } from '../../db/index.ts';
import { requireAuth, requireAdmin } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';

const router = Router();

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

// List / Search Suppliers with Purchases, Returns, Payments and Net Payable Balance
router.get('/', requireAuth, async (req, res: Response) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT s.*,
             COALESCE(p_agg.total_purchases, 0)::int as total_purchases,
             COALESCE(p_agg.total_purchased_amount, 0)::numeric as total_purchased_amount,
             p_agg.last_purchase_date as last_purchase_date,
             COALESCE(pr_agg.total_returns, 0)::int as total_returns,
             COALESCE(pr_agg.total_debit_amount, 0)::numeric as total_debit_amount,
             COALESCE(sp_agg.total_paid_amount, 0)::numeric as total_paid_amount,
             (COALESCE(p_agg.total_purchased_amount, 0) - COALESCE(pr_agg.total_debit_amount, 0) - COALESCE(sp_agg.total_paid_amount, 0))::numeric as net_payable_balance
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, COUNT(id) as total_purchases, SUM(total_amount) as total_purchased_amount, MAX(purchase_date) as last_purchase_date
        FROM purchases
        WHERE supplier_id IS NOT NULL
        GROUP BY supplier_id
      ) p_agg ON s.id = p_agg.supplier_id
      LEFT JOIN (
        SELECT supplier_id, COUNT(id) as total_returns, SUM(total_debit_amount) as total_debit_amount
        FROM purchase_returns
        WHERE supplier_id IS NOT NULL
        GROUP BY supplier_id
      ) pr_agg ON s.id = pr_agg.supplier_id
      LEFT JOIN (
        SELECT supplier_id, SUM(amount) as total_paid_amount
        FROM supplier_payments
        WHERE supplier_id IS NOT NULL
        GROUP BY supplier_id
      ) sp_agg ON s.id = sp_agg.supplier_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(s.name) LIKE $${params.length} OR s.phone LIKE $${params.length} OR LOWER(s.email) LIKE $${params.length})`;
    }

    query += ` ORDER BY s.id DESC`;

    const result = await pgClient.query(query, params);
    res.json({ suppliers: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch suppliers: ' + err.message });
  }
});

// Single Supplier with recent purchases, returns, payments, and balance
router.get('/:id', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const supRes = await pgClient.query(
      `SELECT s.*,
              COALESCE(p_agg.total_purchases, 0)::int as total_purchases,
              COALESCE(p_agg.total_purchased_amount, 0)::numeric as total_purchased_amount,
              COALESCE(pr_agg.total_returns, 0)::int as total_returns,
              COALESCE(pr_agg.total_debit_amount, 0)::numeric as total_debit_amount,
              COALESCE(sp_agg.total_paid_amount, 0)::numeric as total_paid_amount,
              (COALESCE(p_agg.total_purchased_amount, 0) - COALESCE(pr_agg.total_debit_amount, 0) - COALESCE(sp_agg.total_paid_amount, 0))::numeric as net_payable_balance
       FROM suppliers s
       LEFT JOIN (
         SELECT supplier_id, COUNT(id) as total_purchases, SUM(total_amount) as total_purchased_amount
         FROM purchases
         WHERE supplier_id = $1
         GROUP BY supplier_id
       ) p_agg ON s.id = p_agg.supplier_id
       LEFT JOIN (
         SELECT supplier_id, COUNT(id) as total_returns, SUM(total_debit_amount) as total_debit_amount
         FROM purchase_returns
         WHERE supplier_id = $1
         GROUP BY supplier_id
       ) pr_agg ON s.id = pr_agg.supplier_id
       LEFT JOIN (
         SELECT supplier_id, SUM(amount) as total_paid_amount
         FROM supplier_payments
         WHERE supplier_id = $1
         GROUP BY supplier_id
       ) sp_agg ON s.id = sp_agg.supplier_id
       WHERE s.id = $1`,
      [id]
    );

    if (supRes.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    const purchasesRes = await pgClient.query(
      `SELECT p.id, p.purchase_number, p.purchase_date, p.total_amount, p.paid_amount, p.payment_status, p.payment_method, p.notes, p.created_at,
              (p.total_amount - COALESCE(p.paid_amount, 0))::numeric as balance_due,
              u.name as created_by_name,
              (SELECT COUNT(*) FROM purchase_items pi WHERE pi.purchase_id = p.id) as item_count
       FROM purchases p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.supplier_id = $1
       ORDER BY p.id DESC
       LIMIT 50`,
      [id]
    );

    const returnsRes = await pgClient.query(
      `SELECT pr.id, pr.return_number, pr.return_date, pr.total_debit_amount, pr.reason, pr.notes, pr.created_at,
              u.name as created_by_name,
              p.purchase_number as original_purchase_number,
              (SELECT COUNT(*) FROM purchase_return_items pri WHERE pri.purchase_return_id = pr.id) as item_count,
              (SELECT COALESCE(SUM(pri.quantity), 0) FROM purchase_return_items pri WHERE pri.purchase_return_id = pr.id)::int as total_pairs
       FROM purchase_returns pr
       LEFT JOIN users u ON pr.created_by = u.id
       LEFT JOIN purchases p ON pr.purchase_id = p.id
       WHERE pr.supplier_id = $1
       ORDER BY pr.id DESC
       LIMIT 50`,
      [id]
    );

    const paymentsRes = await pgClient.query(
      `SELECT sp.*, u.name as created_by_name, p.purchase_number as linked_purchase_number
       FROM supplier_payments sp
       LEFT JOIN users u ON sp.created_by = u.id
       LEFT JOIN purchases p ON sp.purchase_id = p.id
       WHERE sp.supplier_id = $1
       ORDER BY sp.id DESC
       LIMIT 50`,
      [id]
    );

    res.json({
      supplier: supRes.rows[0],
      purchases: purchasesRes.rows,
      returns: returnsRes.rows,
      payments: paymentsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch supplier: ' + err.message });
  }
});

// Full Chronological Supplier Ledger Statement
router.get('/:id/ledger', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const supRes = await pgClient.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (supRes.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    const supplier = supRes.rows[0];

    // Fetch all purchases
    const purchasesRes = await pgClient.query(
      `SELECT id, purchase_number as ref_no, purchase_date as tx_date, total_amount as amount, notes, created_at
       FROM purchases WHERE supplier_id = $1`,
      [id]
    );

    // Fetch all returns
    const returnsRes = await pgClient.query(
      `SELECT id, return_number as ref_no, return_date as tx_date, total_debit_amount as amount, reason as notes, created_at
       FROM purchase_returns WHERE supplier_id = $1`,
      [id]
    );

    // Fetch all payments
    const paymentsRes = await pgClient.query(
      `SELECT id, payment_number as ref_no, payment_date as tx_date, amount, payment_method, reference_number, notes, created_at
       FROM supplier_payments WHERE supplier_id = $1`,
      [id]
    );

    interface LedgerEntry {
      id: number;
      type: 'PURCHASE' | 'RETURN' | 'PAYMENT';
      date: string;
      refNo: string;
      description: string;
      debit: number;   // Reduces what we owe (Payment or Defective Return)
      credit: number;  // Increases what we owe (Purchase bill)
      paymentMethod?: string;
      referenceNumber?: string;
      notes?: string;
      createdAt: string;
      runningBalance?: number;
    }

    const entries: LedgerEntry[] = [];

    for (const p of purchasesRes.rows) {
      entries.push({
        id: p.id,
        type: 'PURCHASE',
        date: p.tx_date,
        refNo: p.ref_no,
        description: `Purchase Inward Bill (${p.ref_no})`,
        credit: parseFloat(p.amount) || 0,
        debit: 0,
        notes: p.notes || '',
        createdAt: p.created_at,
      });
    }

    for (const r of returnsRes.rows) {
      entries.push({
        id: r.id,
        type: 'RETURN',
        date: r.tx_date,
        refNo: r.ref_no,
        description: `Debit Note - Defective Return (${r.ref_no})`,
        credit: 0,
        debit: parseFloat(r.amount) || 0,
        notes: r.notes || '',
        createdAt: r.created_at,
      });
    }

    for (const py of paymentsRes.rows) {
      entries.push({
        id: py.id,
        type: 'PAYMENT',
        date: py.tx_date,
        refNo: py.ref_no,
        description: `Payment to Supplier [${py.payment_method || 'CASH'}]` + (py.reference_number ? ` Ref: ${py.reference_number}` : ''),
        credit: 0,
        debit: parseFloat(py.amount) || 0,
        paymentMethod: py.payment_method,
        referenceNumber: py.reference_number,
        notes: py.notes || '',
        createdAt: py.created_at,
      });
    }

    // Sort chronologically (oldest date/time to newest)
    entries.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Compute running balance
    let currentBalance = 0;
    let totalCredit = 0;
    let totalDebit = 0;

    for (const entry of entries) {
      currentBalance = currentBalance + entry.credit - entry.debit;
      totalCredit += entry.credit;
      totalDebit += entry.debit;
      entry.runningBalance = Math.round(currentBalance * 100) / 100;
    }

    const totalPurchased = totalCredit;
    const totalDebited = totalDebit;
    const netBalance = Math.round(currentBalance * 100) / 100;

    // Return chronological or reversed as requested
    res.json({
      supplier,
      summary: {
        totalPurchasesCount: purchasesRes.rows.length,
        totalReturnsCount: returnsRes.rows.length,
        totalPaymentsCount: paymentsRes.rows.length,
        totalPurchased,
        totalDebitReturned: entries.filter(e => e.type === 'RETURN').reduce((acc, e) => acc + e.debit, 0),
        totalPaymentsPaid: entries.filter(e => e.type === 'PAYMENT').reduce((acc, e) => acc + e.debit, 0),
        totalDebited,
        netBalance,
      },
      transactions: entries,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate supplier ledger: ' + err.message });
  }
});

// Record Payment to Supplier
router.post('/:id/payments', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const supplierId = parseInt(req.params.id, 10);
  const {
    amount,
    paymentDate,
    paymentMethod = 'CASH',
    referenceNumber = '',
    notes = '',
    purchaseId,
  } = req.body;

  const paymentAmount = parseFloat(amount);
  if (isNaN(paymentAmount) || paymentAmount <= 0) {
    return res.status(400).json({ error: 'Valid payment amount greater than zero is required.' });
  }

  const supRes = await pgClient.query('SELECT id, name FROM suppliers WHERE id = $1', [supplierId]);
  if (supRes.rows.length === 0) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }
  const supplier = supRes.rows[0];

  await pgClient.query('BEGIN');

  try {
    const paymentNumber = await generatePaymentNumber();
    const effectiveDate = paymentDate || new Date().toISOString().split('T')[0];

    let linkedPurchaseId: number | null = null;
    if (purchaseId) {
      const pId = parseInt(String(purchaseId), 10);
      if (!isNaN(pId)) {
        linkedPurchaseId = pId;
        // Update purchase record
        const purRes = await pgClient.query<{ id: number; total_amount: string; paid_amount: string }>(
          'SELECT id, total_amount, paid_amount FROM purchases WHERE id = $1 AND supplier_id = $2 FOR UPDATE',
          [pId, supplierId]
        );
        if (purRes.rows.length > 0) {
          const pur = purRes.rows[0];
          const newPaid = Math.round(((parseFloat(pur.paid_amount) || 0) + paymentAmount) * 100) / 100;
          const totalAmt = parseFloat(pur.total_amount) || 0;
          const newStatus = newPaid >= totalAmt ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

          await pgClient.query(
            'UPDATE purchases SET paid_amount = $1, payment_status = $2 WHERE id = $3',
            [newPaid, newStatus, pId]
          );
        }
      }
    }

    const payResult = await pgClient.query(
      `INSERT INTO supplier_payments (
         payment_number, supplier_id, supplier_name, purchase_id, amount, payment_date, payment_method, reference_number, notes, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        paymentNumber,
        supplierId,
        supplier.name,
        linkedPurchaseId,
        paymentAmount,
        effectiveDate,
        paymentMethod.toUpperCase(),
        (referenceNumber || '').trim(),
        (notes || '').trim(),
        req.user!.id,
      ]
    );

    await pgClient.query('COMMIT');

    res.status(201).json({
      message: 'Supplier payment recorded successfully.',
      payment: payResult.rows[0],
    });
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to record supplier payment: ' + err.message });
  }
});

// Delete Payment (Admin only)
router.delete('/payments/:paymentId', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const paymentId = parseInt(req.params.paymentId, 10);
  if (isNaN(paymentId)) {
    return res.status(400).json({ error: 'Invalid payment ID.' });
  }

  await pgClient.query('BEGIN');
  try {
    const payRes = await pgClient.query<{ id: number; purchase_id: number | null; amount: string }>(
      'SELECT id, purchase_id, amount FROM supplier_payments WHERE id = $1 FOR UPDATE',
      [paymentId]
    );

    if (payRes.rows.length === 0) {
      await pgClient.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment voucher not found.' });
    }

    const payment = payRes.rows[0];
    const amountToRevert = parseFloat(payment.amount) || 0;

    // If linked to a purchase, revert the paid_amount on that purchase
    if (payment.purchase_id) {
      const purRes = await pgClient.query<{ id: number; total_amount: string; paid_amount: string }>(
        'SELECT id, total_amount, paid_amount FROM purchases WHERE id = $1 FOR UPDATE',
        [payment.purchase_id]
      );
      if (purRes.rows.length > 0) {
        const pur = purRes.rows[0];
        const newPaid = Math.max(0, Math.round(((parseFloat(pur.paid_amount) || 0) - amountToRevert) * 100) / 100);
        const totalAmt = parseFloat(pur.total_amount) || 0;
        const newStatus = newPaid >= totalAmt ? 'PAID' : newPaid > 0 ? 'PARTIAL' : 'UNPAID';

        await pgClient.query(
          'UPDATE purchases SET paid_amount = $1, payment_status = $2 WHERE id = $3',
          [newPaid, newStatus, payment.purchase_id]
        );
      }
    }

    await pgClient.query('DELETE FROM supplier_payments WHERE id = $1', [paymentId]);

    await pgClient.query('COMMIT');
    res.json({ message: 'Supplier payment deleted successfully.' });
  } catch (err: any) {
    await pgClient.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to delete payment: ' + err.message });
  }
});

// Create Supplier
router.post('/', requireAuth, async (req, res: Response) => {
  try {
    const { name, phone = '', email = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required.' });
    }

    const result = await pgClient.query(
      `INSERT INTO suppliers (name, phone, email, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [
        name.trim(),
        phone.trim(),
        email.trim(),
      ]
    );

    res.status(201).json({ supplier: result.rows[0], message: 'Supplier created successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create supplier: ' + err.message });
  }
});

// Update Supplier
router.put('/:id', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone = '', email = '' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Supplier name is required.' });
    }

    const result = await pgClient.query(
      `UPDATE suppliers SET 
         name = $1, phone = $2, email = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        name.trim(),
        phone.trim(),
        email.trim(),
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    res.json({ supplier: result.rows[0], message: 'Supplier updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update supplier: ' + err.message });
  }
});

// Delete Supplier
router.delete('/:id', requireAuth, requireAdmin, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Check if supplier has linked purchases
    const countRes = await pgClient.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM purchases WHERE supplier_id = $1',
      [id]
    );
    const count = parseInt(countRes.rows[0].count, 10);

    if (count > 0) {
      // Unlink supplier from purchases so historic purchase records remain intact
      await pgClient.query('UPDATE purchases SET supplier_id = NULL WHERE supplier_id = $1', [id]);
    }

    const result = await pgClient.query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found.' });
    }

    res.json({ message: 'Supplier removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete supplier: ' + err.message });
  }
});

export default router;
