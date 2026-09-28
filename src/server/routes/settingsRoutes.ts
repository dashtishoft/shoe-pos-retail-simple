import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pgClient } from '../../db/index.ts';
import { requireAuth, requireAdmin } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';

const router = Router();

let settingsColumnsVerified = false;

async function ensureSettingsPricingColumns() {
  if (settingsColumnsVerified) return;
  try {
    const reg = await pgClient.query<{ has_settings: boolean }>(
      "SELECT (to_regclass('public.company_settings') IS NOT NULL) as has_settings"
    );
    if (!reg.rows[0]?.has_settings) return;
    await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(30) NOT NULL DEFAULT 'FIXED'");
    await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_policy_locked BOOLEAN NOT NULL DEFAULT false");
    await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS show_receipt_logo BOOLEAN NOT NULL DEFAULT false");
    await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS receipt_logo TEXT DEFAULT ''");
    await pgClient.query("UPDATE company_settings SET pricing_policy_locked = true WHERE is_installed = true");
    settingsColumnsVerified = true;
  } catch (err) {
    console.warn('Could not ensure settings pricing columns:', err);
  }
}

function formatSettingsResponse(s: any) {
  const mode = String(s.pricing_mode || 'FIXED').toUpperCase() === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
  const locked = Boolean(s.pricing_policy_locked || s.is_installed);
  const receiptLogo = s.receipt_logo || s.logo || '';
  const showReceiptLogo = Boolean(s.show_receipt_logo);
  return {
    id: s.id,
    name: s.name,
    companyName: s.name,
    company_name: s.name,
    phone: s.phone || '',
    companyPhone: s.phone || '',
    company_phone: s.phone || '',
    email: s.email || '',
    companyEmail: s.email || '',
    company_email: s.email || '',
    address: s.address || '',
    companyAddress: s.address || '',
    company_address: s.address || '',
    strn: s.strn || '',
    taxId: s.tax_id || s.tax_number || '',
    tax_id: s.tax_id || s.tax_number || '',
    taxNumber: s.tax_number || s.tax_id || '',
    tax_number: s.tax_number || s.tax_id || '',
    website: s.website || '',
    logo: s.logo || '',
    receiptLogo,
    receipt_logo: receiptLogo,
    showReceiptLogo,
    show_receipt_logo: showReceiptLogo,
    currency: s.currency || 'PKR',
    currencyName: s.currency_name || 'Pakistani Rupee',
    currency_name: s.currency_name || 'Pakistani Rupee',
    currencySymbol: s.currency_symbol || 'Rs.',
    currency_symbol: s.currency_symbol || 'Rs.',
    invoicePrefix: s.invoice_prefix || 'INV-',
    invoice_prefix: s.invoice_prefix || 'INV-',
    purchasePrefix: s.purchase_prefix || 'PUR-',
    purchase_prefix: s.purchase_prefix || 'PUR-',
    barcodePrefix: s.barcode_prefix || '0108923',
    barcode_prefix: s.barcode_prefix || '0108923',
    invoiceFooter: s.invoice_footer || '',
    invoice_footer: s.invoice_footer || '',
    lowStockLimit: s.low_stock_limit,
    pricingPolicy: mode,
    pricing_policy: mode,
    pricingMode: mode,
    pricing_mode: mode,
    pricingPolicyLocked: locked,
    pricing_policy_locked: locked,
    isInstalled: Boolean(s.is_installed),
    is_installed: Boolean(s.is_installed),
    updatedAt: s.updated_at,
  };
}

// GET /api/settings - Public or Authenticated to get company settings
router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureSettingsPricingColumns();
    const result = await pgClient.query('SELECT * FROM company_settings LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company settings not initialized.' });
    }
    const s: any = result.rows[0];
    res.json({
      settings: formatSettingsResponse(s),
    });
  } catch (err: any) {
    if (String(err?.message || '').includes('does not exist')) {
      return res.status(200).json({
        settings: {
          id: 0,
          name: 'Shoe Shop POS',
          companyName: 'Shoe Shop POS',
          company_name: 'Shoe Shop POS',
          phone: '',
          companyPhone: '',
          email: '',
          companyEmail: '',
          address: '',
          companyAddress: '',
          currency: 'PKR',
          currencyName: 'Pakistani Rupee',
          currency_name: 'Pakistani Rupee',
          currencySymbol: 'Rs.',
          currency_symbol: 'Rs.',
          invoicePrefix: 'INV-',
          invoice_prefix: 'INV-',
          purchasePrefix: 'PUR-',
          purchase_prefix: 'PUR-',
          barcodePrefix: '0108923',
          barcode_prefix: '0108923',
          pricingPolicy: 'FIXED',
          pricing_policy: 'FIXED',
          pricingMode: 'FIXED',
          pricing_mode: 'FIXED',
          pricingPolicyLocked: false,
          pricing_policy_locked: false,
          isInstalled: false,
          is_installed: false,
        },
      });
    }
    res.status(500).json({ error: 'Failed to load settings: ' + err.message });
  }
});

// PUT /api/settings - Update Company Settings (Admin Only)
router.put('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureSettingsPricingColumns();
    const companyName = (req.body.company_name || req.body.companyName || req.body.name || '').trim();
    const companyPhone = (req.body.company_phone || req.body.companyPhone || req.body.phone || '').trim();
    const companyEmail = (req.body.company_email || req.body.companyEmail || req.body.email || '').trim();
    const companyAddress = (req.body.company_address || req.body.companyAddress || req.body.address || '').trim();
    const strn = (req.body.strn || '').trim();
    const taxId = (req.body.tax_id || req.body.taxId || req.body.taxNumber || req.body.tax_number || '').trim();
    const website = (req.body.website || '').trim();

    const currencyName = (req.body.currency_name || req.body.currencyName || 'Pakistani Rupee').trim();
    const currencySymbol = (req.body.currency_symbol || req.body.currencySymbol || 'Rs.').trim();
    const barcodePrefix = (req.body.barcode_prefix || req.body.barcodePrefix || '').trim();
    const purchasePrefix = (req.body.purchase_prefix || req.body.purchasePrefix || 'PO-').trim();
    const invoicePrefix = (req.body.invoice_prefix || req.body.invoicePrefix || 'INV-').trim();

    const logo = req.body.logo || '';
    const receiptLogo = req.body.receipt_logo ?? req.body.receiptLogo ?? logo;
    const showReceiptLogo = Boolean(req.body.show_receipt_logo ?? req.body.showReceiptLogo ?? false);
    const invoiceFooter = req.body.invoice_footer || req.body.invoiceFooter || '';
    const lowStockLimit = parseInt(req.body.low_stock_limit || req.body.lowStockLimit, 10) || 5;

    // Retrieve current settings to enforce the Lock mechanism on Pricing Policy once initialized
    const currentSettingsRes = await pgClient.query<{
      is_installed: boolean;
      pricing_policy_locked: boolean;
      pricing_mode: string;
    }>('SELECT is_installed, pricing_policy_locked, pricing_mode FROM company_settings LIMIT 1');

    const currentRow = currentSettingsRes.rows[0];
    const isPolicyLocked = Boolean(currentRow?.is_installed || currentRow?.pricing_policy_locked);
    let pricingMode = String(currentRow?.pricing_mode || 'FIXED').toUpperCase() === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';

    // Only allow setting pricingMode if the store is NOT yet initialized/locked
    if (!isPolicyLocked) {
      const requestedMode = String(
        req.body.pricingPolicy || req.body.pricing_policy || req.body.pricing_mode || req.body.pricingMode || pricingMode
      ).toUpperCase();
      pricingMode = requestedMode === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
    }

    const currencyCode = req.body.currency || 'PKR';

    // 1. Validations: Company Profile
    if (!companyName) {
      return res.status(400).json({ error: 'company_name is required.' });
    }
    if (!companyPhone) {
      return res.status(400).json({ error: 'company_phone is required.' });
    }
    if (companyEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(companyEmail)) {
        return res.status(400).json({ error: 'company_email must be in a valid email format (e.g., info@company.com).' });
      }
    }

    // 2. Validations: Store Prefixes & Currency Settings
    if (!currencyName) {
      return res.status(400).json({ error: 'currency_name is required (e.g., "Pakistani Rupee", "US Dollar").' });
    }
    if (!currencySymbol) {
      return res.status(400).json({ error: 'currency_symbol is required (e.g., "Rs.", "$", "PKR").' });
    }
    // barcode_prefix: Strictly 7 Numeric Digits
    if (!/^\d{7}$/.test(barcodePrefix)) {
      return res.status(400).json({
        error: 'barcode_prefix must be strictly 7 numeric digits (e.g., 0108923 or 2000001).',
      });
    }
    if (!purchasePrefix) {
      return res.status(400).json({ error: 'purchase_prefix is required (e.g., "PO-").' });
    }
    if (!invoicePrefix) {
      return res.status(400).json({ error: 'invoice_prefix is required (e.g., "INV-").' });
    }

    const updateRes = await pgClient.query(
      `UPDATE company_settings SET
         name = $1, phone = $2, email = $3, address = $4,
         strn = $5, tax_id = $6, tax_number = $6, website = $7, logo = $8,
         currency_name = $9, currency = $10, currency_symbol = $11,
         barcode_prefix = $12, purchase_prefix = $13, invoice_prefix = $14,
         invoice_footer = $15, low_stock_limit = $16,
         pricing_mode = $17, show_receipt_logo = $18, receipt_logo = $19, updated_at = NOW()
       WHERE id = (SELECT id FROM company_settings LIMIT 1)
       RETURNING *`,
      [
        companyName,
        companyPhone,
        companyEmail,
        companyAddress,
        strn,
        taxId,
        website,
        logo,
        currencyName,
        currencyCode,
        currencySymbol,
        barcodePrefix,
        purchasePrefix,
        invoicePrefix,
        invoiceFooter,
        lowStockLimit,
        pricingMode,
        showReceiptLogo,
        receiptLogo,
      ]
    );

    const s: any = updateRes.rows[0];
    res.json({
      message: 'Company settings updated successfully.',
      settings: formatSettingsResponse(s),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings: ' + err.message });
  }
});

// --- USER MANAGEMENT (Admin Only) ---

// List Users
router.get('/users', requireAuth, requireAdmin, async (_req, res: Response) => {
  try {
    const result = await pgClient.query(
      'SELECT id, name, email, phone, avatar_url, role, status, created_at, updated_at FROM users ORDER BY id ASC'
    );
    res.json({ users: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch users: ' + err.message });
  }
});

// Approve or Reject User Status
router.put('/users/:id/status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['APPROVED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be APPROVED or PENDING.' });
    }

    // Prevent self-deactivation if last admin
    if (targetUserId === req.user!.id && status === 'PENDING') {
      return res.status(400).json({ error: 'You cannot revoke your own account approval.' });
    }

    const result = await pgClient.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, status',
      [status, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser: any = result.rows[0];

    res.json({
      message: `User ${updatedUser.name} has been ${status === 'APPROVED' ? 'APPROVED' : 'marked PENDING'}.`,
      user: updatedUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user status: ' + err.message });
  }
});

// Change User Role
router.put('/users/:id/role', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!['ADMIN', 'CASHIER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be ADMIN or CASHIER.' });
    }

    // Prevent self-demotion if the current user is admin
    if (targetUserId === req.user!.id && role !== 'ADMIN') {
      return res.status(400).json({ error: 'You cannot remove your own Admin permissions.' });
    }

    const result = await pgClient.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, status',
      [role, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      message: `User role updated to ${role}.`,
      user: result.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user role: ' + err.message });
  }
});

// Create User (Cashier or Admin) - Admin Only
router.post('/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, phone, role, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const confirmPassword = req.body.confirmPassword || req.body.confirm_password;
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const assignedRole = (role || 'CASHIER').toUpperCase();
    if (!['ADMIN', 'CASHIER'].includes(assignedRole)) {
      return res.status(400).json({ error: 'Invalid role. Must be ADMIN or CASHIER.' });
    }

    const initialStatus = (status || 'APPROVED').toUpperCase();
    if (!['APPROVED', 'PENDING'].includes(initialStatus)) {
      return res.status(400).json({ error: 'Invalid status. Must be APPROVED or PENDING.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await pgClient.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';

    const result = await pgClient.query(
      `INSERT INTO users (name, email, phone, password_hash, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, name, email, phone, avatar_url, role, status, created_at, updated_at`,
      [name.trim(), cleanEmail, cleanPhone, passwordHash, assignedRole, initialStatus]
    );

    res.status(201).json({
      message: `${assignedRole === 'ADMIN' ? 'Administrator' : 'Cashier'} account created successfully.`,
      user: result.rows[0],
    });
  } catch (err: any) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

// Delete User - Admin Only
router.delete('/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (!targetUserId || isNaN(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    if (targetUserId === req.user!.id) {
      return res.status(400).json({ error: 'You cannot delete your own active administrator account.' });
    }

    const targetUserRes = await pgClient.query('SELECT id, name, role FROM users WHERE id = $1', [targetUserId]);
    if (targetUserRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const targetUser: any = targetUserRes.rows[0];
    if (targetUser.role === 'ADMIN') {
      const adminCountRes = await pgClient.query("SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'");
      const adminCount = parseInt(adminCountRes.rows[0]?.count || '0', 10);
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the only remaining Administrator account in the system.' });
      }
    }

    const currentAdminId = req.user!.id;
    // Safely reassign foreign key references to the current active admin
    // so historical sales, purchases, and audit logs are safely preserved
    try {
      await pgClient.query('UPDATE sales SET created_by = $1 WHERE created_by = $2', [currentAdminId, targetUserId]);
      await pgClient.query('UPDATE sales SET overridden_by = NULL WHERE overridden_by = $1', [targetUserId]);
      await pgClient.query('UPDATE purchases SET created_by = $1 WHERE created_by = $2', [currentAdminId, targetUserId]);
      await pgClient.query('UPDATE supplier_payments SET created_by = $1 WHERE created_by = $2', [currentAdminId, targetUserId]);
      await pgClient.query('UPDATE purchase_returns SET created_by = $1 WHERE created_by = $2', [currentAdminId, targetUserId]);
      await pgClient.query('UPDATE returns SET created_by = $1 WHERE created_by = $2', [currentAdminId, targetUserId]);
      await pgClient.query('UPDATE stock_movements SET user_id = $1 WHERE user_id = $2', [currentAdminId, targetUserId]);
      await pgClient.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [targetUserId]);
    } catch (reassignErr) {
      console.warn('Reassignment notice on user deletion:', reassignErr);
    }

    await pgClient.query('DELETE FROM users WHERE id = $1', [targetUserId]);

    res.json({
      message: `User account "${targetUser.name}" has been deleted successfully.`,
    });
  } catch (err: any) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Failed to delete user: ' + err.message });
  }
});

export default router;
