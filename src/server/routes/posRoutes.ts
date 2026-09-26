import { Router } from 'express';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { pgClient } from '../../db/index.ts';
import { requireAuth } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';

const router = Router();

// Helper to generate next unique invoice number
async function generateInvoiceNumber(): Promise<string> {
  const settingsRes = await pgClient.query<{ invoice_prefix: string }>(
    'SELECT invoice_prefix FROM company_settings LIMIT 1'
  );
  const prefix = settingsRes.rows[0]?.invoice_prefix || 'INV-';

  const lastSale = await pgClient.query<{ invoice_number: string }>(
    `SELECT invoice_number FROM sales WHERE invoice_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (lastSale.rows.length > 0) {
    const rawNum = lastSale.rows[0].invoice_number.slice(prefix.length);
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  const padded = String(nextNum).padStart(6, '0');
  return `${prefix}${padded}`;
}

// Helper to generate next unique return number
async function generateReturnNumber(): Promise<string> {
  const lastRet = await pgClient.query<{ return_number: string }>(
    "SELECT return_number FROM returns WHERE return_number LIKE 'RET-%' ORDER BY id DESC LIMIT 1"
  );
  let nextNum = 1;
  if (lastRet.rows.length > 0) {
    const rawNum = lastRet.rows[0].return_number.slice(4);
    const parsed = parseInt(rawNum, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }
  const padded = String(nextNum).padStart(6, '0');
  return `RET-${padded}`;
}

// POST /api/pos/checkout - Atomic Sale & Direct Shoe Exchange Processing
router.post('/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const {
    items = [], // [{ productId, quantity, unitPrice, discount }]
    customerId = null,
    paymentMethod = 'CASH',
    cashReceived = 0,
    changeGiven = 0,
    notes = '',
    // Min price override details if applicable
    isMinPriceOverridden = false,
    adminOverrideEmail = null,
    adminOverridePassword = null,
    // Optional Direct Shoe Exchange payload
    exchange = null, // { originalSaleId, originalInvoiceNumber, reason, items: [{ saleItemId, productId, quantity, unitRefundPrice }] }
    // Offline Sync Parameters
    clientTxId = null,
    saleDate = null,
  } = req.body;

  // Check if an offline transaction with this clientTxId was already synced previously (Idempotency)
  if (clientTxId && typeof clientTxId === 'string') {
    const existingSync = await pgClient.query<any>(
      "SELECT id, invoice_number, total_amount FROM sales WHERE notes LIKE $1 LIMIT 1",
      [`%[Offline Tx: ${clientTxId.trim()}]%`]
    );
    if (existingSync.rows.length > 0) {
      const saleRow = existingSync.rows[0];
      return res.status(200).json({
        message: 'Sale previously synchronized.',
        invoiceNumber: saleRow.invoice_number,
        alreadySynced: true,
        sale: saleRow,
      });
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Please add replacement shoes to checkout.' });
  }

  const user = req.user!;
  let verifiedOverrideAdminId: number | null = null;

  // 1. Min Price Validation (Minimum price is automatically calculated in real time: Cost Price + Minimum Profit Margin)
  const settingsRes = await pgClient.query<{ min_profit_margin: string; pricing_mode: string; fixed_profit_margin: string }>(
    'SELECT min_profit_margin, pricing_mode, fixed_profit_margin FROM company_settings LIMIT 1'
  );
  const minMarginPercent = parseFloat(settingsRes.rows[0]?.min_profit_margin ?? '15') || 15;
  const isFixedMode = (settingsRes.rows[0]?.pricing_mode || '').toUpperCase() === 'FIXED';
  const fixedMarginPercent = parseFloat(settingsRes.rows[0]?.fixed_profit_margin ?? '30') || 30;

  for (const item of items) {
    const prodRes = await pgClient.query<{
      cost_price: string;
      name: string;
      article: string;
      sale_price: number | null;
      min_sale_price: number | null;
      max_sale_price: number | null;
      margin_type: string | null;
    }>(
      'SELECT COALESCE(cost_price, 0) as cost_price, name, article, sale_price, min_sale_price, max_sale_price, margin_type FROM products WHERE id = $1',
      [item.productId]
    );

    if (prodRes.rows.length === 0) {
      return res.status(404).json({ error: `Product ID ${item.productId} not found.` });
    }

    const prod = prodRes.rows[0];
    const costPrice = Math.round(parseFloat(prod.cost_price || '0'));
    const prodIdentifier = prod.article || prod.name;
    const effectiveUnitPrice = Math.round(parseFloat(item.unitPrice));
    const productPolicy = String(prod.margin_type || (prod.sale_price ? 'FIXED' : 'NEGOTIABLE')).toUpperCase();
    const isFixedProduct = productPolicy === 'FIXED';

    // Determine min allowed selling price from saved product prices
    let minAllowedPrice = 0;
    if (isFixedProduct) {
      minAllowedPrice = prod.sale_price !== null && prod.sale_price !== undefined
        ? Math.round(Number(prod.sale_price))
        : (costPrice > 0 ? Math.round(costPrice * (1 + fixedMarginPercent / 100)) : 0);
    } else {
      minAllowedPrice = prod.min_sale_price !== null && prod.min_sale_price !== undefined
        ? Math.round(Number(prod.min_sale_price))
        : (costPrice > 0 ? Math.round(costPrice * (1 + minMarginPercent / 100)) : 0);
    }

    if (effectiveUnitPrice < minAllowedPrice) {
      // Sale is below minimum price. Requires Admin role or Admin credentials override.
      if (user.role === 'ADMIN') {
        verifiedOverrideAdminId = user.id;
      } else if (isMinPriceOverridden && adminOverrideEmail && adminOverridePassword) {
        // Validate provided admin credentials
        const adminCheck = await pgClient.query<any>(
          'SELECT id, password_hash, role, status FROM users WHERE LOWER(email) = LOWER($1)',
          [adminOverrideEmail.trim()]
        );
        if (
          adminCheck.rows.length === 0 ||
          adminCheck.rows[0].role !== 'ADMIN' ||
          adminCheck.rows[0].status !== 'APPROVED'
        ) {
          return res.status(403).json({
            error: `Selling "${prodIdentifier}" below minimum price (Rs. ${minAllowedPrice}) is rejected. Invalid Admin credentials.`,
          });
        }
        const isPassValid = await bcrypt.compare(adminOverridePassword, adminCheck.rows[0].password_hash);
        if (!isPassValid) {
          return res.status(403).json({
            error: `Selling "${prodIdentifier}" below minimum price (Rs. ${minAllowedPrice}) is rejected. Incorrect Admin password.`,
          });
        }
        verifiedOverrideAdminId = adminCheck.rows[0].id;
      } else {
        return res.status(400).json({
          error: `Minimum Price Violation: "${prodIdentifier}" cannot be sold below saved minimum price of Rs. ${minAllowedPrice} without Admin authorization.`,
          requiresAdminOverride: true,
          productId: item.productId,
          productName: prodIdentifier,
          minSalePrice: minAllowedPrice,
          attemptedPrice: effectiveUnitPrice,
        });
      }
    }
  }

  // 2. ATOMIC POSTGRESQL TRANSACTION (BEGIN ... COMMIT / ROLLBACK)
  await pgClient.query('BEGIN');

  try {
    const invoiceNumber = await generateInvoiceNumber();
    let calculatedSubtotal = 0;
    let calculatedTotalDiscount = 0;

    // A. Process Exchange Return Items if provided
    let totalExchangeCredit = 0;
    let generatedReturnNumber: string | null = null;
    const validatedReturnItems: Array<{
      saleItemId: number;
      productId: number;
      productName: string;
      quantity: number;
      unitRefundPrice: number;
      subtotal: number;
      prevStock: number;
      newStock: number;
    }> = [];

    let origSale: any = null;
    if (exchange && exchange.originalSaleId && Array.isArray(exchange.items) && exchange.items.length > 0) {
      const origSaleRes = await pgClient.query('SELECT * FROM sales WHERE id = $1', [exchange.originalSaleId]);
      if (origSaleRes.rows.length === 0) {
        throw new Error('Original sale record for exchange not found.');
      }
      origSale = origSaleRes.rows[0];

      for (const rItem of exchange.items) {
        const retQty = parseInt(rItem.quantity, 10);
        const refundPrice = parseFloat(rItem.unitRefundPrice);
        if (isNaN(retQty) || retQty <= 0) continue;

        const siRes = await pgClient.query<{ id: number; product_id: number; product_name: string; quantity: number }>(
          'SELECT id, product_id, product_name, quantity FROM sale_items WHERE id = $1 AND sale_id = $2',
          [rItem.saleItemId, exchange.originalSaleId]
        );
        if (siRes.rows.length === 0) {
          throw new Error(`Sale item ${rItem.saleItemId} does not match original invoice.`);
        }
        const saleItem = siRes.rows[0];

        const prevReturnsRes = await pgClient.query<{ total_returned: string }>(
          'SELECT COALESCE(SUM(quantity), 0) as total_returned FROM return_items WHERE sale_item_id = $1',
          [saleItem.id]
        );
        const alreadyReturned = parseInt(prevReturnsRes.rows[0].total_returned, 10);
        const maxReturnable = saleItem.quantity - alreadyReturned;

        if (retQty > maxReturnable) {
          throw new Error(
            `Cannot exchange ${retQty} of "${saleItem.product_name}". Maximum returnable is ${maxReturnable}.`
          );
        }

        const prodRes = await pgClient.query<{ id: number; total_stock: number }>(
          'SELECT id, total_stock FROM products WHERE id = $1 FOR UPDATE',
          [saleItem.product_id]
        );
        if (prodRes.rows.length === 0) {
          throw new Error(`Product ${saleItem.product_id} not found.`);
        }
        const prevStock = prodRes.rows[0].total_stock;
        const newStock = prevStock + retQty;
        const itemCredit = Math.round(retQty * refundPrice * 100) / 100;
        totalExchangeCredit += itemCredit;

        // Restore returned shoe into product stock
        await pgClient.query('UPDATE products SET total_stock = $1, updated_at = NOW() WHERE id = $2', [
          newStock,
          saleItem.product_id,
        ]);

        validatedReturnItems.push({
          saleItemId: saleItem.id,
          productId: saleItem.product_id,
          productName: saleItem.product_name,
          quantity: retQty,
          unitRefundPrice: refundPrice,
          subtotal: itemCredit,
          prevStock,
          newStock,
        });
      }

      if (validatedReturnItems.length > 0) {
        generatedReturnNumber = await generateReturnNumber();
        const returnRes = await pgClient.query<{ id: number }>(
          `INSERT INTO returns (
            return_number, original_sale_id, customer_id, return_date, 
            total_refund_amount, reason, created_by
          ) VALUES ($1, $2, $3, NOW()::date::text, $4, $5, $6)
          RETURNING id`,
          [
            generatedReturnNumber,
            origSale.id,
            customerId ? parseInt(customerId, 10) : origSale.customer_id,
            totalExchangeCredit,
            (exchange.reason || 'Direct Shoe Exchange at POS').trim(),
            user.id,
          ]
        );
        const returnId = returnRes.rows[0].id;

        for (const v of validatedReturnItems) {
          await pgClient.query(
            `INSERT INTO return_items (return_id, sale_item_id, product_id, quantity, unit_refund_price, subtotal)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [returnId, v.saleItemId, v.productId, v.quantity, v.unitRefundPrice, v.subtotal]
          );

          await pgClient.query(
            `INSERT INTO stock_movements (
              product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes
            ) VALUES ($1, $2, $3, $4, 'SALE_RETURN', $5, $6, $7)`,
            [
              v.productId,
              v.quantity,
              v.prevStock,
              v.newStock,
              generatedReturnNumber,
              user.id,
              `Direct Shoe Exchange for Invoice ${origSale.invoice_number}: ${exchange.reason || 'Size/style exchange'}`,
            ]
          );
        }
      }
    }

    // B. Process New Replacement Shoe Items
    const validatedItems: Array<{
      productId: number;
      productName: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      subtotal: number;
      purchasePrice: number;
      prevStock: number;
      newStock: number;
    }> = [];

    // Lock and check stock for each item
    for (const item of items) {
      const qty = parseInt(item.quantity, 10);
      const unitPrice = parseFloat(item.unitPrice);
      const discount = parseFloat(item.discount || 0);

      if (isNaN(qty) || qty <= 0) {
        throw new Error(`Invalid quantity (${qty}) for item.`);
      }

      // SELECT FOR UPDATE locks row to ensure zero race conditions & negative stock prevention
      const pRes = await pgClient.query<{
        id: number;
        name: string;
        article: string;
        total_stock: number;
        cost_price: string;
      }>('SELECT id, name, article, total_stock, COALESCE(cost_price, 0) as cost_price FROM products WHERE id = $1 FOR UPDATE', [
        item.productId,
      ]);

      if (pRes.rows.length === 0) {
        throw new Error(`Product ID ${item.productId} does not exist.`);
      }

      const product = pRes.rows[0];
      const prodIdentifier = product.article || product.name;
      const prevStock = product.total_stock;

      // Ensure stock never becomes negative
      if (prevStock < qty) {
        throw new Error(
          `Insufficient stock for "${prodIdentifier}". Available: ${prevStock}, Requested: ${qty}.`
        );
      }

      const newStock = prevStock - qty;
      const subtotal = unitPrice * qty - discount;
      calculatedSubtotal += unitPrice * qty;
      calculatedTotalDiscount += discount;

      // Deduct total product stock
      await pgClient.query(
        'UPDATE products SET total_stock = $1, updated_at = NOW() WHERE id = $2',
        [newStock, product.id]
      );

      validatedItems.push({
        productId: product.id,
        productName: prodIdentifier,
        quantity: qty,
        unitPrice,
        discount,
        subtotal,
        purchasePrice: parseFloat(product.cost_price || '0'), // Historical cost at time of sale
        prevStock,
        newStock,
      });
    }

    // C. Calculate Automatic Net Difference
    const netDifference = Math.round((calculatedSubtotal - calculatedTotalDiscount - totalExchangeCredit) * 100) / 100;
    const calculatedTotalAmount = Math.max(0, netDifference);
    const effectiveChangeGiven = netDifference < 0 ? Math.abs(netDifference) : (changeGiven || 0);
    const effectiveCashReceived = netDifference <= 0 ? 0 : (cashReceived || calculatedTotalAmount);

    let exchangeNote: string | null = null;
    if (validatedReturnItems.length > 0) {
      exchangeNote = `Direct Shoe Exchange against ${origSale?.invoice_number || exchange.originalInvoiceNumber} (Return ${generatedReturnNumber}). Returned Credit: Rs. ${Math.round(totalExchangeCredit)}. Net Difference: Rs. ${Math.round(netDifference)}`;
    }
    const offlineNote = clientTxId ? `[Offline Tx: ${clientTxId.trim()}]` : null;
    const finalNotes = [notes?.trim(), exchangeNote, offlineNote].filter(Boolean).join(' | ') || null;

    // Use original transaction date if queued offline, or fallback to current date
    const effectiveSaleDate = saleDate && typeof saleDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(saleDate)
      ? saleDate.slice(0, 10)
      : null;

    // Insert Sale record
    const saleRes = await pgClient.query<{ id: number }>(
      `INSERT INTO sales (
        invoice_number, customer_id, sale_date, subtotal, discount, 
        total_amount, payment_method, cash_received, change_given, 
        created_by, is_min_price_overridden, overridden_by, notes
      ) VALUES ($1, $2, COALESCE($13, NOW()::date::text), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        invoiceNumber,
        customerId ? parseInt(customerId, 10) : (origSale ? origSale.customer_id : null),
        calculatedSubtotal,
        calculatedTotalDiscount,
        calculatedTotalAmount,
        paymentMethod,
        effectiveCashReceived,
        effectiveChangeGiven,
        user.id,
        verifiedOverrideAdminId !== null,
        verifiedOverrideAdminId,
        finalNotes,
        effectiveSaleDate,
      ]
    );

    const saleId = saleRes.rows[0].id;

    // Insert Sale Items & Record Stock Movements in Ledger
    for (const v of validatedItems) {
      await pgClient.query(
        `INSERT INTO sale_items (
          sale_id, product_id, product_name, quantity, unit_price, discount, subtotal, purchase_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [saleId, v.productId, v.productName, v.quantity, v.unitPrice, v.discount, v.subtotal, v.purchasePrice]
      );

      // Record in Stock Movement Ledger
      await pgClient.query(
        `INSERT INTO stock_movements (
          product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes
        ) VALUES ($1, $2, $3, $4, 'SALE', $5, $6, $7)`,
        [
          v.productId,
          -v.quantity,
          v.prevStock,
          v.newStock,
          invoiceNumber,
          user.id,
          `POS Sale Checkout (${invoiceNumber})`,
        ]
      );
    }

    await pgClient.query('COMMIT');

    // Fetch full sale & company settings for invoice printing
    const fullSale = await pgClient.query(
      `SELECT s.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone
       FROM sales s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = $1`,
      [saleId]
    );

    const saleItemsRes = await pgClient.query(
      'SELECT * FROM sale_items WHERE sale_id = $1 ORDER BY id ASC',
      [saleId]
    );

    const settingsRes = await pgClient.query('SELECT * FROM company_settings LIMIT 1');

    res.status(201).json({
      message: validatedReturnItems.length > 0
        ? `Direct Shoe Exchange completed. Return ${generatedReturnNumber} generated.`
        : 'Sale completed successfully.',
      invoiceNumber,
      returnNumber: generatedReturnNumber,
      clientTxId: clientTxId || null,
      netDifference,
      exchangeCredit: totalExchangeCredit,
      sale: {
        ...(fullSale.rows[0] as any),
        items: saleItemsRes.rows,
        returned_items: validatedReturnItems,
        exchange_credit: totalExchangeCredit,
        net_difference: netDifference,
        return_number: generatedReturnNumber,
        original_invoice_number: origSale?.invoice_number || exchange?.originalInvoiceNumber,
      },
      companySettings: settingsRes.rows[0] || null,
    });
  } catch (txErr: any) {
    await pgClient.query('ROLLBACK');
    console.error('POS Checkout Transaction Failed:', txErr);
    res.status(400).json({ error: txErr.message || 'Transaction failed. Stock has been preserved.' });
  }
});

// GET /api/pos/sales - List sales with pagination & search
router.get('/sales', requireAuth, async (req, res: Response) => {
  try {
    const { search, limit = 50 } = req.query;
    let query = `
      SELECT s.id, s.invoice_number, s.customer_id, c.name as customer_name, 
             s.sale_date, s.subtotal, s.discount, s.total_amount, 
             s.payment_method, s.cash_received, s.change_given, 
             s.created_by, u.name as cashier_name, s.is_min_price_overridden,
             s.notes, s.created_at
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string') {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(s.invoice_number) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length} OR c.phone LIKE $${params.length})`;
    }

    query += ` ORDER BY s.id DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(String(limit), 10) || 50);

    const result = await pgClient.query(query, params);

    res.json({ sales: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sales: ' + err.message });
  }
});

// GET /api/pos/sales/:id - Single Sale Details with items for invoice reprint
router.get('/sales/:id', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const saleRes = await pgClient.query(
      `SELECT s.*, u.name as cashier_name, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
       FROM sales s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       WHERE s.id = $1`,
      [id]
    );

    if (saleRes.rows.length === 0) {
      return res.status(404).json({ error: 'Sale record not found.' });
    }

    const itemsRes = await pgClient.query(
      `SELECT si.id, si.product_id, COALESCE(p.article, si.product_name) as article, COALESCE(p.article, si.product_name) as product_name, si.quantity, si.unit_price, si.discount, si.subtotal, si.purchase_price 
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1 ORDER BY si.id ASC`,
      [id]
    );

    const settingsRes = await pgClient.query('SELECT * FROM company_settings LIMIT 1');

    res.json({
      sale: {
        ...(saleRes.rows[0] as any),
        items: itemsRes.rows,
      },
      companySettings: settingsRes.rows[0] || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sale details: ' + err.message });
  }
});

export default router;
