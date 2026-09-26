import { Router } from 'express';
import type { Response } from 'express';
import { pgClient } from '../../db/index.ts';
import { requireAuth } from '../auth.ts';

const router = Router();

// GET /api/reports/dashboard - Overview KPIs
router.get('/dashboard', requireAuth, async (_req, res: Response) => {
  try {
    // Today's Date
    const today = new Date().toISOString().split('T')[0];

    // Today's Sales Summary
    const todaySales = await pgClient.query<{
      count: string;
      total_sales: string;
      total_discount: string;
    }>(
      `SELECT COUNT(*) as count,
              COALESCE(SUM(total_amount), 0) as total_sales,
              COALESCE(SUM(discount), 0) as total_discount
       FROM sales WHERE sale_date = $1`,
      [today]
    );

    // Today's Profit Calculation:
    // Profit = SUM(si.unit_price * si.quantity - si.discount) - SUM(si.purchase_price * si.quantity)
    const todayProfitRes = await pgClient.query<{ profit: string; revenue: string; cost: string }>(
      `SELECT 
         COALESCE(SUM((si.unit_price * si.quantity) - si.discount), 0) as revenue,
         COALESCE(SUM(si.purchase_price * si.quantity), 0) as cost,
         COALESCE(SUM((si.unit_price * si.quantity) - si.discount - (si.purchase_price * si.quantity)), 0) as profit
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE s.sale_date = $1`,
      [today]
    );

    // All-time Sales & Profit
    const allTimeRes = await pgClient.query<{ total_revenue: string; total_profit: string; total_sales_count: string }>(
      `SELECT 
         COALESCE(SUM((si.unit_price * si.quantity) - si.discount), 0) as total_revenue,
         COALESCE(SUM((si.unit_price * si.quantity) - si.discount - (si.purchase_price * si.quantity)), 0) as total_profit,
         COUNT(DISTINCT s.id) as total_sales_count
       FROM sales s
       LEFT JOIN sale_items si ON s.id = si.sale_id`
    );

    // Customer KPI
    const customerRes = await pgClient.query<{ count: string }>('SELECT COUNT(*) as count FROM customers');

    // Purchases KPI
    const purchaseRes = await pgClient.query<{ count: string; total: string }>(
      'SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total FROM purchases'
    );

    // 7-day sales trend for Sales Overview Chart
    const sevenDaysRes = await pgClient.query<{ date: string; label: string; amount: string }>(`
      SELECT 
        TO_CHAR(d, 'YYYY-MM-DD') as date,
        TO_CHAR(d, 'Mon DD') as label,
        COALESCE(SUM(s.total_amount), 0) as amount
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'::interval) d
      LEFT JOIN sales s ON s.sale_date = TO_CHAR(d, 'YYYY-MM-DD')
      GROUP BY d
      ORDER BY d ASC
    `);

    // Combined recent transactions (Sales, Purchases, Returns)
    const recentTxRes = await pgClient.query(`
      (
        SELECT 'Sale' as type, s.invoice_number as reference, s.total_amount as amount, 
               'Completed' as status, s.created_at
        FROM sales s
        ORDER BY s.id DESC LIMIT 4
      )
      UNION ALL
      (
        SELECT 'Purchase' as type, p.purchase_number as reference, p.total_amount as amount,
               'Completed' as status, p.created_at
        FROM purchases p
        ORDER BY p.id DESC LIMIT 3
      )
      UNION ALL
      (
        SELECT 'Return' as type, r.return_number as reference, r.total_refund_amount as amount,
               'Completed' as status, r.created_at
        FROM returns r
        ORDER BY r.id DESC LIMIT 3
      )
      ORDER BY created_at DESC LIMIT 6
    `);

    // Top Selling Products (Top 5)
    const topSellingRes = await pgClient.query(`
      SELECT 
        si.product_id,
        COALESCE(p.article, si.product_name) as name,
        p.sku,
        COALESCE(p.total_stock, 0) as stock,
        p.primary_image_url,
        COALESCE(p.brand, 'Local') as brand_name,
        '' as brand_logo,
        COALESCE(p.category, 'Casual Shoes') as category_name,
        SUM(si.quantity)::int as units_sold
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      GROUP BY si.product_id, p.article, si.product_name, p.sku, p.total_stock, p.primary_image_url, p.brand, p.category
      ORDER BY units_sold DESC
      LIMIT 5
    `);

    // Product and Inventory KPIs
    const inventoryRes = await pgClient.query<{
      total_products: string;
      total_stock_units: string;
      low_stock_count: string;
      out_of_stock_count: string;
    }>(
      `SELECT 
         COUNT(*) as total_products,
         COALESCE(SUM(p.total_stock), 0) as total_stock_units,
         COUNT(CASE WHEN p.total_stock <= COALESCE(p.low_stock_limit, 5) AND p.total_stock > 0 THEN 1 END) as low_stock_count,
         COUNT(CASE WHEN p.total_stock <= 0 THEN 1 END) as out_of_stock_count
       FROM products p
       WHERE p.active = true`
    );

    // Recent Sales (Last 5)
    const recentSales = await pgClient.query(
      `SELECT s.id, s.invoice_number, s.sale_date, s.total_amount, s.payment_method, 
              u.name as cashier_name, c.name as customer_name, s.created_at
       FROM sales s
       LEFT JOIN users u ON s.created_by = u.id
       LEFT JOIN customers c ON s.customer_id = c.id
       ORDER BY s.id DESC LIMIT 5`
    );

    // Low Stock Alert Products (Top 5)
    const lowStockProducts = await pgClient.query(
      `SELECT p.id, COALESCE(p.article, p.name) as article, COALESCE(p.article, p.name) as name, 
              p.sku, p.barcode, p.total_stock, 
              COALESCE(p.low_stock_limit, 5) as low_stock_limit, 
              p.primary_image_url
       FROM products p
       WHERE p.active = true AND p.total_stock <= COALESCE(p.low_stock_limit, 5)
       ORDER BY p.total_stock ASC LIMIT 5`
    );

    // Top Selling Brands: directly grouped by product.brand text field
    const topBrandsRes = await pgClient.query(`
      SELECT 
        p.brand as name,
        COALESCE(SUM(si.quantity), 0)::int as sold_count,
        COALESCE(SUM((si.unit_price * si.quantity) - si.discount), 0)::numeric as sales_volume
      FROM products p
      JOIN sale_items si ON si.product_id = p.id
      WHERE p.brand IS NOT NULL AND TRIM(p.brand) != ''
      GROUP BY p.brand
      ORDER BY sold_count DESC
      LIMIT 4
    `);

    let topBrandsData = topBrandsRes.rows.map((row: any, idx: number) => ({
      id: idx + 1,
      name: row.name,
      logo: '',
      soldCount: parseInt(row.sold_count, 10) || 0,
      salesVolume: parseFloat(row.sales_volume) || 0,
      percentage: 0,
      subtitle: `Sales ${row.sold_count} units`,
    }));

    const totalTopSold = topBrandsData.reduce((acc, b) => acc + b.soldCount, 0);
    if (totalTopSold > 0) {
      topBrandsData = topBrandsData.map((b) => ({
        ...b,
        percentage: Math.min(100, Math.round((b.soldCount / totalTopSold) * 100)),
        subtitle: `Sales ${b.soldCount} units`,
      }));
    }

    if (topBrandsData.length === 0) {
      const fallbackBrandsRes = await pgClient.query(`
        SELECT p.brand as name, COALESCE(SUM(p.total_stock), 0)::int as stock_count
        FROM products p
        WHERE p.active = true AND p.brand IS NOT NULL AND TRIM(p.brand) != ''
        GROUP BY p.brand
        HAVING COALESCE(SUM(p.total_stock), 0) > 0
        ORDER BY stock_count DESC, p.brand ASC
        LIMIT 4
      `);
      topBrandsData = fallbackBrandsRes.rows.map((row: any, idx: number) => ({
        id: idx + 1,
        name: row.name,
        logo: '',
        soldCount: 0,
        salesVolume: 0,
        percentage: 0,
        subtitle: `${row.stock_count} units in stock`,
      }));
    }

    res.json({
      today: {
        invoiceCount: parseInt(todaySales.rows[0].count, 10),
        totalSales: parseFloat(todaySales.rows[0].total_sales),
        totalDiscount: parseFloat(todaySales.rows[0].total_discount),
        profit: parseFloat(todayProfitRes.rows[0].profit),
        cost: parseFloat(todayProfitRes.rows[0].cost),
      },
      allTime: {
        totalRevenue: parseFloat(allTimeRes.rows[0].total_revenue),
        totalProfit: parseFloat(allTimeRes.rows[0].total_profit),
        salesCount: parseInt(allTimeRes.rows[0].total_sales_count, 10),
      },
      inventory: {
        totalProducts: parseInt(inventoryRes.rows[0].total_products, 10),
        totalStockUnits: parseInt(inventoryRes.rows[0].total_stock_units, 10),
        lowStockCount: parseInt(inventoryRes.rows[0].low_stock_count, 10),
        outOfStockCount: parseInt(inventoryRes.rows[0].out_of_stock_count, 10),
      },
      customers: {
        totalCount: parseInt(customerRes.rows[0].count, 10),
      },
      purchases: {
        totalPurchases: parseInt(purchaseRes.rows[0].count, 10),
        totalAmount: parseFloat(purchaseRes.rows[0].total),
      },
      sevenDaysSales: sevenDaysRes.rows.map((r) => ({
        date: r.date,
        label: r.label,
        amount: parseFloat(r.amount) || 0,
      })),
      recentTransactions: recentTxRes.rows.map((r) => ({
        type: r.type,
        reference: r.reference,
        amount: parseFloat(r.amount) || 0,
        status: r.status,
        date: r.created_at,
      })),
      topSelling: topSellingRes.rows.map((r) => ({
        productId: r.product_id,
        name: r.name,
        sku: r.sku || '',
        categoryName: r.category_name || '',
        stock: r.stock !== undefined ? parseInt(r.stock, 10) : 0,
        brandName: r.brand_name || 'Unbranded',
        brandLogo: r.brand_logo || '',
        imageUrl: r.primary_image_url,
        unitsSold: parseInt(r.units_sold, 10) || 0,
      })),
      recentSales: recentSales.rows,
      lowStockAlerts: lowStockProducts.rows,
      topBrands: topBrandsData,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load dashboard metrics: ' + err.message });
  }
});

// GET /api/reports/profit-loss - Detailed Profit & Loss Report
router.get('/profit-loss', requireAuth, async (req, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    let query = `
      SELECT 
        s.sale_date,
        s.invoice_number,
        COALESCE(p.article, si.product_name) as article,
        COALESCE(p.article, si.product_name) as product_name,
        si.quantity,
        si.unit_price,
        si.discount,
        si.purchase_price,
        ((si.unit_price * si.quantity) - si.discount) as net_revenue,
        (si.purchase_price * si.quantity) as total_cost,
        (((si.unit_price * si.quantity) - si.discount) - (si.purchase_price * si.quantity)) as item_profit
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      LEFT JOIN products p ON si.product_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate && typeof startDate === 'string') {
      params.push(startDate);
      query += ` AND s.sale_date >= $${params.length}`;
    }
    if (endDate && typeof endDate === 'string') {
      params.push(endDate);
      query += ` AND s.sale_date <= $${params.length}`;
    }

    query += ` ORDER BY s.id DESC LIMIT 200`;

    const result = await pgClient.query(query, params);

    let totalRevenue = 0;
    let totalCost = 0;
    let totalProfit = 0;

    const rows = result.rows.map((r: any) => {
      const rev = parseFloat(r.net_revenue);
      const cost = parseFloat(r.total_cost);
      const profit = parseFloat(r.item_profit);
      totalRevenue += rev;
      totalCost += cost;
      totalProfit += profit;

      return {
        saleDate: r.sale_date,
        invoiceNumber: r.invoice_number,
        article: r.article || r.product_name,
        productName: r.article || r.product_name,
        quantity: r.quantity,
        unitPrice: parseFloat(r.unit_price),
        discount: parseFloat(r.discount),
        purchasePrice: parseFloat(r.purchase_price),
        netRevenue: rev,
        totalCost: cost,
        profit: profit,
        marginPercent: rev > 0 ? Math.round((profit / rev) * 100).toString() : '0',
      };
    });

    res.json({
      summary: {
        totalRevenue: Math.round(totalRevenue),
        totalCost: Math.round(totalCost),
        totalProfit: Math.round(totalProfit),
        profitMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) + '%' : '0%',
      },
      details: rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to calculate profit report: ' + err.message });
  }
});

// GET /api/reports/top-selling - Best Selling Shoes
router.get('/top-selling', requireAuth, async (_req, res: Response) => {
  try {
    const result = await pgClient.query(`
      SELECT 
        si.product_id,
        COALESCE(p.article, si.product_name) as article,
        COALESCE(p.article, si.product_name) as product_name,
        p.sku,
        p.barcode,
        p.primary_image_url,
        SUM(si.quantity)::int as total_units_sold,
        SUM((si.unit_price * si.quantity) - si.discount)::numeric as total_revenue,
        SUM(((si.unit_price * si.quantity) - si.discount) - (si.purchase_price * si.quantity))::numeric as total_profit
      FROM sale_items si
      LEFT JOIN products p ON si.product_id = p.id
      GROUP BY si.product_id, p.article, si.product_name, p.sku, p.barcode, p.primary_image_url
      ORDER BY total_units_sold DESC
      LIMIT 10
    `);

    res.json({ topSelling: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load top selling shoes: ' + err.message });
  }
});

export default router;
