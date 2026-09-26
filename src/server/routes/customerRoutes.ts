import { Router } from 'express';
import type { Response } from 'express';
import { pgClient } from '../../db/index.ts';
import { requireAuth } from '../auth.ts';

const router = Router();

// List / Search Customers
router.get('/', requireAuth, async (req, res: Response) => {
  try {
    const { search } = req.query;
    let query = `
      SELECT c.*,
             COUNT(s.id)::int as total_orders,
             COALESCE(SUM(s.total_amount), 0)::numeric as total_spent,
             FLOOR(COALESCE(SUM(s.total_amount), 0) / 100)::int as loyalty_points,
             MAX(s.sale_date) as last_visit,
             MAX(s.created_at) as last_sale_at
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string') {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(c.name) LIKE $${params.length} OR LOWER(c.phone) LIKE $${params.length} OR LOWER(COALESCE(c.email, '')) LIKE $${params.length} OR CAST(c.id AS TEXT) LIKE $${params.length})`;
    }

    query += ` GROUP BY c.id ORDER BY c.id DESC`;

    const result = await pgClient.query(query, params);
    res.json({ customers: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch customers: ' + err.message });
  }
});

// Single Customer with recent purchase history
router.get('/:id', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const custRes = await pgClient.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (custRes.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    const salesRes = await pgClient.query(
      'SELECT id, invoice_number, sale_date, total_amount, payment_method, created_at FROM sales WHERE customer_id = $1 ORDER BY id DESC LIMIT 20',
      [id]
    );

    res.json({
      customer: custRes.rows[0],
      sales: salesRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch customer: ' + err.message });
  }
});

// Create Customer
router.post('/', requireAuth, async (req, res: Response) => {
  try {
    const { name, phone, email = '', address = '', notes = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Customer phone number is required.' });
    }

    const result = await pgClient.query(
      `INSERT INTO customers (name, phone, email, address, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), phone.trim(), email.trim() || null, address.trim() || null, notes.trim() || null]
    );

    res.status(201).json({ customer: result.rows[0], message: 'Customer created successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create customer: ' + err.message });
  }
});

// Update Customer
router.put('/:id', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, phone, email = '', address = '', notes = '' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Customer phone is required.' });
    }

    const result = await pgClient.query(
      `UPDATE customers SET 
         name = $1, phone = $2, email = $3, address = $4, notes = $5
       WHERE id = $6
       RETURNING *`,
      [name.trim(), phone.trim(), email.trim() || null, address.trim() || null, notes.trim() || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    res.json({ customer: result.rows[0], message: 'Customer updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update customer: ' + err.message });
  }
});

// Delete Customer
router.delete('/:id', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    // Disassociate past sales so historical records are retained
    await pgClient.query('UPDATE sales SET customer_id = NULL WHERE customer_id = $1', [id]);
    const result = await pgClient.query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found.' });
    }
    res.json({ message: 'Customer deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete customer: ' + err.message });
  }
});

export default router;
