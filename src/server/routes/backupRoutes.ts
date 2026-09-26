import { Router } from 'express';
import type { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { pgClient, dbInfo, isStandardPostgres } from '../../db/index.ts';
import { ensureDatabaseSchema } from '../../db/schemaInit.ts';
import { requireAuth, requireAdmin } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';

const router = Router();

// Order of tables for insertion (parent first)
const RESTORE_TABLE_ORDER = [
  'company_settings',
  'users',
  'suppliers',
  'customers',
  'products',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
  'returns',
  'return_items',
  'stock_movements',
];

// All tables available for backup
const ALL_TABLES = [
  'company_settings',
  'users',
  'products',
  'customers',
  'suppliers',
  'purchases',
  'purchase_items',
  'sales',
  'sale_items',
  'returns',
  'return_items',
  'stock_movements',
];

// GET /api/backup/stats - Live row counts & database status
router.get('/stats', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const counts: Record<string, number> = {};
    let totalRecords = 0;

    for (const table of ALL_TABLES) {
      try {
        const queryRes = await pgClient.query<{ count: string }>(`SELECT COUNT(*) as count FROM ${table}`);
        const c = parseInt(queryRes.rows[0]?.count || '0', 10);
        counts[table] = c;
        totalRecords += c;
      } catch (tableErr: any) {
        counts[table] = 0;
      }
    }

    // Get current shop name
    let storeName = 'Shoe Shop POS';
    try {
      const shopRes = await pgClient.query<any>('SELECT name FROM company_settings LIMIT 1');
      if (shopRes.rows.length > 0 && shopRes.rows[0].name) {
        storeName = shopRes.rows[0].name;
      }
    } catch (_) {}

    res.json({
      success: true,
      database: dbInfo.type,
      isStandardPostgres,
      host: dbInfo.host,
      storeName,
      totalRecords,
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Backup stats error:', err);
    res.status(500).json({ error: 'Failed to retrieve database stats: ' + err.message });
  }
});

// GET /api/backup/export - Export all tables as JSON backup file
router.get('/export', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const exportedData: Record<string, any[]> = {};
    const recordCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const table of ALL_TABLES) {
      try {
        const rowsRes = await pgClient.query<any>(`SELECT * FROM ${table} ORDER BY id ASC`);
        exportedData[table] = rowsRes.rows;
        recordCounts[table] = rowsRes.rows.length;
        totalRecords += rowsRes.rows.length;
      } catch (err: any) {
        console.warn(`Export skipping table ${table}:`, err.message);
        exportedData[table] = [];
        recordCounts[table] = 0;
      }
    }

    // Store metadata
    let storeName = 'Shoe Shop POS';
    if (exportedData.company_settings && exportedData.company_settings.length > 0) {
      storeName = exportedData.company_settings[0].name || storeName;
    }

    const backupPayload = {
      meta: {
        format: 'shoepos-backup-v1',
        version: '2.4.0',
        exportedAt: new Date().toISOString(),
        exportedBy: req.user ? `${req.user.name} (${req.user.email})` : 'System Administrator',
        storeName,
        totalRecords,
      },
      counts: recordCounts,
      tables: exportedData,
    };

    const sanitizedStore = storeName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const dateStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
    const filename = `shoepos-backup-${sanitizedStore}-${dateStr}-${timeStr}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(backupPayload);
  } catch (err: any) {
    console.error('Backup export error:', err);
    res.status(500).json({ error: 'Failed to export backup: ' + err.message });
  }
});

// POST /api/backup/restore - Restore all tables from JSON backup file
router.post('/restore', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    let payload = req.body;
    if (payload && payload.backup) {
      payload = payload.backup;
    }

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid backup file format: Payload must be a JSON object.' });
    }

    // Support both direct { tables: { ... } } or { ... tables } format
    const tables: Record<string, any[]> = payload.tables || payload;

    if (!tables || typeof tables !== 'object') {
      return res.status(400).json({ error: 'Invalid backup: Missing tables data object.' });
    }

    // Check that at least products or company_settings or users exist in backup
    const hasCoreData =
      (Array.isArray(tables.products) && tables.products.length > 0) ||
      (Array.isArray(tables.company_settings) && tables.company_settings.length > 0) ||
      (Array.isArray(tables.users) && tables.users.length > 0);

    if (!hasCoreData) {
      return res.status(400).json({
        error: 'Invalid or empty backup file: No core database records (products, store settings, or users) found.',
      });
    }

    // Determine if users table is included in the backup
    const backupUsers: any[] = Array.isArray(tables.users) ? tables.users : [];

    // Save current admin as fail-safe if backup users don't have an admin
    let fallbackAdmin: any = null;
    if (req.user) {
      const currentAdminRes = await pgClient.query<any>('SELECT * FROM users WHERE id = $1', [req.user.id]);
      if (currentAdminRes.rows.length > 0) {
        fallbackAdmin = currentAdminRes.rows[0];
      }
    }

    const restoredCounts: Record<string, number> = {};

    // Execute atomic transaction for safety
    await pgClient.query('BEGIN');

    try {
      // 1. Truncate dependent tables in cascade order
      await pgClient.query(`
        TRUNCATE TABLE 
          password_reset_tokens,
          stock_movements,
          return_items,
          returns,
          sale_items,
          sales,
          purchase_items,
          purchases,
          products,
          customers,
          suppliers,
          company_settings
        CASCADE;
      `);

      // If restoring users, truncate users table too
      if (backupUsers.length > 0) {
        await pgClient.query('TRUNCATE TABLE users CASCADE;');
      }

      // 2. Insert records table by table in dependency order
      for (const tableName of RESTORE_TABLE_ORDER) {
        const rows = tables[tableName];
        if (!Array.isArray(rows) || rows.length === 0) {
          // If users was truncated but backup had no users, restore fallback admin
          if (tableName === 'users' && backupUsers.length === 0 && fallbackAdmin) {
            const keys = Object.keys(fallbackAdmin);
            const cols = keys.map((k) => `"${k}"`).join(', ');
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            await pgClient.query(`INSERT INTO users (${cols}) VALUES (${placeholders})`, Object.values(fallbackAdmin));
            restoredCounts['users'] = 1;
          } else {
            restoredCounts[tableName] = 0;
          }
          continue;
        }

        let insertedCount = 0;
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue;

          // Strip any fields that don't belong to schema if necessary, or sanitize
          const cleanRow = { ...row };
          if (tableName === 'products') {
            if ((cleanRow.cost_price === undefined || cleanRow.cost_price === null) && cleanRow.purchase_price !== undefined) {
              cleanRow.cost_price = cleanRow.purchase_price;
            }
            if (!cleanRow.brand && cleanRow.brand_name) cleanRow.brand = cleanRow.brand_name;
            if (!cleanRow.brand) cleanRow.brand = 'Local';
            if (!cleanRow.category && cleanRow.category_name) cleanRow.category = cleanRow.category_name;
            if (!cleanRow.category) cleanRow.category = 'Casual Shoes';
            delete cleanRow.brand_id;
            delete cleanRow.category_id;
            delete cleanRow.brand_name;
            delete cleanRow.category_name;
            delete cleanRow.purchase_price;
            delete cleanRow.min_sale_price;
            delete cleanRow.max_sale_price;
          }

          // Convert any date strings or nested objects cleanly
          const keys = Object.keys(cleanRow);
          if (keys.length === 0) continue;

          const cols = keys.map((k) => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = Object.values(cleanRow);

          try {
            await pgClient.query(`INSERT INTO ${tableName} (${cols}) VALUES (${placeholders})`, values);
            insertedCount++;
          } catch (rowErr: any) {
            console.warn(`Error inserting row into ${tableName}:`, rowErr.message, cleanRow);
            // Continue with other rows if a single row has non-fatal mismatch
          }
        }

        restoredCounts[tableName] = insertedCount;

        // Reset sequence for auto-increment ID
        try {
          await pgClient.query(`
            SELECT setval(
              pg_get_serial_sequence('${tableName}', 'id'),
              COALESCE((SELECT MAX(id) FROM ${tableName}), 1)
            );
          `);
        } catch (_) {
          // Ignore if table has no serial sequence
        }
      }

      // Safety check: Ensure at least one admin exists in users table after restore
      const adminCheck = await pgClient.query<any>("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
      if (adminCheck.rows.length === 0 && fallbackAdmin) {
        console.log('Restoring fallback admin to prevent lockout...');
        const keys = Object.keys(fallbackAdmin);
        const cols = keys.map((k) => `"${k}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        await pgClient.query(`INSERT INTO users (${cols}) VALUES (${placeholders})`, Object.values(fallbackAdmin));
      }

      // Ensure company_settings exists with valid defaults
      const settingsCheck = await pgClient.query<any>('SELECT id FROM company_settings LIMIT 1');
      if (settingsCheck.rows.length === 0) {
        await pgClient.query(`
          INSERT INTO company_settings (name, is_installed) VALUES ('Shoe Shop POS', true)
        `);
      }

      // Commit transaction
      await pgClient.query('COMMIT');

      let totalRestored = 0;
      Object.values(restoredCounts).forEach((c) => (totalRestored += c));

      res.json({
        success: true,
        message: `Database restored successfully! ${totalRestored} records restored across ${Object.keys(restoredCounts).length} tables.`,
        restoredCounts,
        totalRestored,
        timestamp: new Date().toISOString(),
      });
    } catch (txErr: any) {
      await pgClient.query('ROLLBACK');
      console.error('Restore transaction failed, rolled back:', txErr);
      return res.status(500).json({
        error: 'Database restore transaction failed: ' + txErr.message,
      });
    }
  } catch (err: any) {
    console.error('Backup restore error:', err);
    res.status(500).json({ error: 'Failed to restore backup: ' + err.message });
  }
});

// GET /api/backup/dummy-data-info - Metadata about the 5-Year Dummy Dataset
router.get('/dummy-data-info', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const primaryPath = path.resolve(process.cwd(), 'data/dummy_data_five_years.sql');
    const publicPath = path.resolve(process.cwd(), 'public/dummy_data_five_years.sql');
    const sqlPath = fs.existsSync(primaryPath) ? primaryPath : publicPath;
    const exists = fs.existsSync(sqlPath);
    const stats = exists ? fs.statSync(sqlPath) : null;

    res.json({
      available: exists,
      filename: 'dummy_data_five_years.sql',
      downloadUrl: '/dummy_data_five_years.sql',
      sizeBytes: stats?.size || 0,
      sizeKb: stats ? Math.round(stats.size / 1024) : 0,
      timeSpan: '5 Full Years (September 2021 – September 2026)',
      highlights: {
        salesCount: '1,250+ sales invoices',
        purchasesCount: '85 supplier consignments',
        productsCount: '115+ footwear models',
        returnsCount: '35 customer returns',
        purchaseReturnsCount: '15 supplier returns',
        brandsCount: '18 footwear brands',
        categoriesCount: '12 shoe categories',
        customersCount: '60+ customer profiles',
        suppliersCount: '12 wholesale distributors & tanneries',
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read dummy data info: ' + err.message });
  }
});

// POST /api/backup/load-dummy-data - 1-Click Load 5-Year Dummy Dataset
router.post('/load-dummy-data', requireAuth, requireAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const primaryPath = path.resolve(process.cwd(), 'data/dummy_data_five_years.sql');
    const publicPath = path.resolve(process.cwd(), 'public/dummy_data_five_years.sql');
    const sqlPath = fs.existsSync(primaryPath) ? primaryPath : publicPath;
    if (!fs.existsSync(sqlPath)) {
      return res.status(404).json({ error: 'Dummy data SQL file not found on server.' });
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8');
    await pgClient.waitReady;
    await pgClient.exec(sql);
    await ensureDatabaseSchema();

    const salesCount = await pgClient.query('SELECT COUNT(*) as c FROM sales').catch(() => ({ rows: [{ c: '0' }] }));
    const purCount = await pgClient.query('SELECT COUNT(*) as c FROM purchases').catch(() => ({ rows: [{ c: '0' }] }));
    const prodCount = await pgClient.query('SELECT COUNT(*) as c FROM products').catch(() => ({ rows: [{ c: '0' }] }));
    const retCount = await pgClient.query('SELECT COUNT(*) as c FROM returns').catch(() => ({ rows: [{ c: '0' }] }));
    const custCount = await pgClient.query('SELECT COUNT(*) as c FROM customers').catch(() => ({ rows: [{ c: '0' }] }));
    const brandCount = await pgClient.query('SELECT COUNT(DISTINCT brand) as c FROM products WHERE brand IS NOT NULL AND TRIM(brand) != \'\'').catch(() => ({ rows: [{ c: '0' }] }));
    const catCount = await pgClient.query('SELECT COUNT(DISTINCT category) as c FROM products WHERE category IS NOT NULL AND TRIM(category) != \'\'').catch(() => ({ rows: [{ c: '0' }] }));

    res.json({
      success: true,
      message: '5-Year Comprehensive Historical Dummy Data loaded successfully!',
      counts: {
        sales: parseInt(salesCount.rows[0]?.c || '0', 10),
        purchases: parseInt(purCount.rows[0]?.c || '0', 10),
        products: parseInt(prodCount.rows[0]?.c || '0', 10),
        returns: parseInt(retCount.rows[0]?.c || '0', 10),
        customers: parseInt(custCount.rows[0]?.c || '0', 10),
        brands: parseInt(brandCount.rows[0]?.c || '0', 10),
        categories: parseInt(catCount.rows[0]?.c || '0', 10),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error loading dummy data in backup:', err);
    res.status(500).json({ error: 'Failed to execute dummy data SQL: ' + err.message });
  }
});

// POST /api/backup/import-sql - Execute Arbitrary SQL Script
router.post('/import-sql', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sql = (req.body?.sql || '').toString().trim();
    if (!sql) {
      return res.status(400).json({ error: 'SQL query content is required.' });
    }

    await pgClient.waitReady;
    await pgClient.exec(sql);
    await ensureDatabaseSchema();

    const salesCount = await pgClient.query('SELECT COUNT(*) as c FROM sales').catch(() => ({ rows: [{ c: '0' }] }));
    const purCount = await pgClient.query('SELECT COUNT(*) as c FROM purchases').catch(() => ({ rows: [{ c: '0' }] }));
    const prodCount = await pgClient.query('SELECT COUNT(*) as c FROM products').catch(() => ({ rows: [{ c: '0' }] }));
    const retCount = await pgClient.query('SELECT COUNT(*) as c FROM returns').catch(() => ({ rows: [{ c: '0' }] }));

    res.json({
      success: true,
      message: 'SQL script executed and imported successfully!',
      counts: {
        sales: parseInt(salesCount.rows[0]?.c || '0', 10),
        purchases: parseInt(purCount.rows[0]?.c || '0', 10),
        products: parseInt(prodCount.rows[0]?.c || '0', 10),
        returns: parseInt(retCount.rows[0]?.c || '0', 10),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error importing SQL in backup:', err);
    res.status(500).json({ error: 'Failed to execute SQL script: ' + err.message });
  }
});

export default router;
