import { Router } from 'express';
import type { Response } from 'express';
import { pgClient } from '../../db/index.ts';
import { requireAuth, requireAdmin } from '../auth.ts';
import type { AuthenticatedRequest } from '../auth.ts';
import {
  generateEan13Barcode,
  validateBarcodePrefix,
  sanitizePrefix,
  analyzeBarcode,
} from '../../utils/barcode.ts';
import {
  parseBrandPrefix,
  generateSku,
  buildSkuInfo,
} from '../../utils/sku.ts';
import { analyzeProductImageWithGemini } from '../gemini.ts';
import { calculateAutomaticPricing, smartRoundUp } from '../../utils/pricing.ts';

const router = Router();

// Helper to get next auto-incrementing, non-reusable product ID from PostgreSQL
export async function getNextProductId(): Promise<number> {
  let seqNext = 1;
  try {
    const seqRes = await pgClient.query<{ last_value: string; is_called: boolean }>(
      'SELECT last_value, is_called FROM products_id_seq'
    );
    if (seqRes.rows.length > 0) {
      const last = parseInt(seqRes.rows[0].last_value, 10);
      seqNext = seqRes.rows[0].is_called ? last + 1 : last;
    }
  } catch (_) {}

  const maxRes = await pgClient.query<{ max_id: string }>(
    'SELECT COALESCE(MAX(id), 0) + 1 AS max_id FROM products'
  );
  const maxId = parseInt(maxRes.rows[0]?.max_id || '1', 10);
  return Math.max(seqNext, maxId);
}

/**
 * Returns the company's minimum profit margin percentage (default 10%).
 */
export async function getMinProfitMarginPercent(): Promise<number> {
  try {
    const settingsRes = await pgClient.query<{ min_profit_margin: string }>(
      'SELECT min_profit_margin FROM company_settings LIMIT 1'
    );
    return parseFloat(settingsRes.rows[0]?.min_profit_margin ?? '10') || 10;
  } catch {
    return 10;
  }
}

/**
 * Returns the company's maximum profit margin percentage (default 30%).
 */
export async function getMaxProfitMarginPercent(): Promise<number> {
  try {
    const settingsRes = await pgClient.query<{ max_profit_margin: string }>(
      'SELECT max_profit_margin FROM company_settings LIMIT 1'
    );
    return parseFloat(settingsRes.rows[0]?.max_profit_margin ?? '30') || 30;
  } catch {
    return 30;
  }
}

/**
 * Generates official 13-digit EAN-13 barcode:
 * Format: [7-digit prefix from Settings] + [5-digit Product ID] + [1 Check Digit]
 * Total: 13 digits.
 * No colors, sizes, or variants.
 */
export async function generateProductEan13(
  productId?: number | string
): Promise<{
  barcode: string;
  prefix: string;
  paddedProductId: string;
  checkDigit: number;
  formula: string;
}> {
  // 1. Get prefix from company_settings (strictly 7 numeric digits)
  const settingsRes = await pgClient.query<{ barcode_prefix: string }>(
    'SELECT barcode_prefix FROM company_settings LIMIT 1'
  );
  const rawPrefix = settingsRes.rows[0]?.barcode_prefix;
  const prefixValidation = validateBarcodePrefix(rawPrefix);
  if (!prefixValidation.isValid) {
    throw new Error(prefixValidation.error || 'Barcode prefix must be exactly 7 numeric digits. Please configure in Settings.');
  }
  const prefix = sanitizePrefix(rawPrefix);

  // 2. Determine Product ID
  let targetProductId = productId ? parseInt(String(productId).replace(/\D/g, ''), 10) : 0;
  if (!targetProductId || isNaN(targetProductId)) {
    targetProductId = await getNextProductId();
  }

  // 3. Enforce 5-digit limit (1 to 99999)
  if (targetProductId > 99999) {
    throw new Error(`Product ID #${targetProductId} exceeds 99,999 limit for 5-digit barcode format.`);
  }

  // 4. Generate standard 13-digit barcode, guaranteeing no collision with existing products
  let candidate = generateEan13Barcode(prefix, targetProductId);
  let attempts = 0;
  while (attempts < 1000) {
    const existing = await pgClient.query('SELECT id FROM products WHERE barcode = $1', [candidate.barcode]);
    if (existing.rows.length === 0) {
      return candidate;
    }
    targetProductId++;
    if (targetProductId > 99999) {
      throw new Error('Product barcode range exceeded 99,999.');
    }
    candidate = generateEan13Barcode(prefix, targetProductId);
    attempts++;
  }
  return candidate;
}

// Backward compatibility alias
export async function generateNumericBarcode(productId?: number | string): Promise<string> {
  const res = await generateProductEan13(productId);
  return res.barcode;
}

// Generate new unique EAN-13 barcode API
// Query params optional: ?productId=1
router.get('/generate-barcode', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId } = req.query;
    const result = await generateProductEan13(
      productId ? String(productId) : undefined
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to generate barcode' });
  }
});

// Get next auto-incrementing, non-reusable product ID API
router.get('/next-id', requireAuth, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const nextProductId = await getNextProductId();
    res.json({ nextProductId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve next product ID: ' + err.message });
  }
});

// Calculate Brand Prefix, Category Prefix, Suggested Article & SKU API
// Query params: ?brand=Nike&category=Shoes&article=SH-0001&productId=1
router.get('/suggest-sku', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { brand, brandId, brandName, category, categoryId, categoryName, article, productId } = req.query;

    const targetBrandName = String(brand || brandName || brandId || '').trim();
    const targetCategoryName = String(category || categoryName || categoryId || '').trim();

    let targetProductId = productId ? parseInt(String(productId).replace(/\D/g, ''), 10) : 0;
    if (!targetProductId || isNaN(targetProductId)) {
      targetProductId = await getNextProductId();
    }

    const skuInfo = buildSkuInfo(
      targetBrandName,
      targetCategoryName,
      article ? String(article) : undefined,
      targetProductId
    );

    res.json(skuInfo);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to suggest SKU: ' + err.message });
  }
});

// Real-time Barcode Validation & Uniqueness Check API
router.get('/validate-barcode', requireAuth, async (req, res: Response) => {
  try {
    const rawBarcode = req.query.barcode ? String(req.query.barcode).trim() : '';
    const excludeId = req.query.excludeId ? parseInt(String(req.query.excludeId), 10) : null;

    if (!rawBarcode) {
      return res.json({
        valid: false,
        error: 'Barcode is required.',
      });
    }

    const prefixRes = await pgClient.query<any>('SELECT barcode_prefix FROM company_settings LIMIT 1');
    const prefix = prefixRes.rows[0]?.barcode_prefix || '0108923';

    const analysis = analyzeBarcode(rawBarcode, prefix);

    if (!analysis.isValid) {
      return res.json({
        valid: false,
        isDuplicate: false,
        standard: analysis.standard,
        standardLabel: analysis.standardLabel,
        expectedCheckDigit: analysis.expectedCheckDigit,
        actualCheckDigit: analysis.actualCheckDigit,
        suggestedFix: analysis.suggestedFix,
        error: analysis.error,
      });
    }

    // Check duplicate in database
    const duplicateRes = await pgClient.query<any>(
      'SELECT id, name, sku, article FROM products WHERE barcode = $1 AND ($2::int IS NULL OR id != $2)',
      [rawBarcode, excludeId]
    );

    if (duplicateRes.rows.length > 0) {
      const existing = duplicateRes.rows[0];
      return res.json({
        valid: false,
        isDuplicate: true,
        standard: analysis.standard,
        standardLabel: analysis.standardLabel,
        existingProduct: {
          id: existing.id,
          name: existing.name,
          sku: existing.sku,
          article: existing.article,
        },
        error: `Barcode is already in use by product: "${existing.name}" (${existing.sku})`,
      });
    }

    return res.json({
      valid: true,
      isDuplicate: false,
      standard: analysis.standard,
      standardLabel: analysis.standardLabel,
      suggestedFix: analysis.suggestedFix,
      message: `Valid ${analysis.standardLabel} and available for use.`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to validate barcode: ' + err.message });
  }
});

// AI Product Suggestion from Image (multimodal Gemini analysis)
router.post('/ai-suggest', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { image } = req.body;
    if (!image || typeof image !== 'string' || !image.trim()) {
      return res.status(400).json({ error: 'Please upload or provide a product image to analyze.' });
    }

    // Retrieve current list of existing brands and categories from database products
    const [brandsRes, categoriesRes] = await Promise.all([
      pgClient.query<{ name: string }>(
        "SELECT DISTINCT brand as name FROM products WHERE brand IS NOT NULL AND TRIM(brand) != '' ORDER BY brand ASC"
      ),
      pgClient.query<{ name: string }>(
        "SELECT DISTINCT category as name FROM products WHERE category IS NOT NULL AND TRIM(category) != '' ORDER BY category ASC"
      ),
    ]);

    const result = await analyzeProductImageWithGemini(
      image,
      brandsRes.rows || [],
      categoriesRes.rows || []
    );

    res.json({
      success: true,
      suggestion: result,
    });
  } catch (err: any) {
    let errMsg = err?.message || 'Failed to analyze product image with AI. Please try again.';
    console.error('AI Product Suggestion error:', errMsg);

    // If errMsg contains serialized JSON from GoogleGenAI
    if (errMsg.includes('"code":429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
      errMsg = 'Gemini AI rate limit or quota exceeded. Please wait a moment and try again.';
    }

    const isFootwearAlert =
      errMsg.includes('not a valid footwear image') || errMsg.startsWith('Alert:');

    res.status(isFootwearAlert ? 422 : 500).json({
      error: errMsg,
      isFootwearAlert,
    });
  }
});

let productColumnsVerified = false;

async function ensureProductAndSettingsColumns() {
  if (productColumnsVerified) return;
  try {
    const reg = await pgClient.query<{ has_products: boolean; has_settings: boolean }>(
      "SELECT (to_regclass('public.products') IS NOT NULL) as has_products, (to_regclass('public.company_settings') IS NOT NULL) as has_settings"
    );
    if (reg.rows[0]?.has_settings) {
      await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(30) NOT NULL DEFAULT 'NEGOTIABLE'");
      await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS fixed_profit_margin NUMERIC(5, 2) NOT NULL DEFAULT 30.00");
      await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS fixed_profit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0");
      await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS min_profit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0");
      await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS max_profit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0");
    }
    if (reg.rows[0]?.has_products) {
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS size VARCHAR(30) DEFAULT '42'");
      await pgClient.query("CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku)");
      await pgClient.query("CREATE INDEX IF NOT EXISTS products_article_idx ON products(article)");
      await pgClient.query("CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode)");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS margin_type VARCHAR(30) NOT NULL DEFAULT 'FIXED'");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS profit_calculation_method VARCHAR(30) NOT NULL DEFAULT 'FIXED_AMOUNT'");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS profit_margin NUMERIC(5, 2) DEFAULT 30.00");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS profit_amount NUMERIC(12, 2) DEFAULT 0");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_min_margin NUMERIC(5, 2)");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS custom_max_margin NUMERIC(5, 2)");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2)");
    }
    if (reg.rows[0]?.has_settings && reg.rows[0]?.has_products) {
      productColumnsVerified = true;
    }
  } catch (_) {}
}

// Company pricing settings helper
export async function getCompanyPricingSettings(): Promise<{
  pricingMode: string;
  minProfitMargin: number;
  minProfitAmount: number;
  maxProfitMargin: number;
  maxProfitAmount: number;
  fixedProfitMargin: number;
  fixedProfitAmount: number;
  currencySymbol: string;
}> {
  try {
    await ensureProductAndSettingsColumns();
    const res = await pgClient.query<any>(
      'SELECT pricing_mode, min_profit_margin, min_profit_amount, max_profit_margin, max_profit_amount, fixed_profit_margin, fixed_profit_amount, currency_symbol FROM company_settings LIMIT 1'
    );
    const row = res.rows[0];
    return {
      pricingMode: (row?.pricing_mode || 'NEGOTIABLE').toUpperCase(),
      minProfitMargin: parseFloat(row?.min_profit_margin ?? '15') || 15,
      minProfitAmount: parseFloat(row?.min_profit_amount ?? '0') || 0,
      maxProfitMargin: parseFloat(row?.max_profit_margin ?? '30') || 30,
      maxProfitAmount: parseFloat(row?.max_profit_amount ?? '0') || 0,
      fixedProfitMargin: parseFloat(row?.fixed_profit_margin ?? '30') || 30,
      fixedProfitAmount: parseFloat(row?.fixed_profit_amount ?? '0') || 0,
      currencySymbol: row?.currency_symbol || 'Rs.',
    };
  } catch {
    return {
      pricingMode: 'NEGOTIABLE',
      minProfitMargin: 15,
      minProfitAmount: 0,
      maxProfitMargin: 30,
      maxProfitAmount: 0,
      fixedProfitMargin: 30,
      fixedProfitAmount: 0,
      currencySymbol: 'Rs.',
    };
  }
}

// Real-time dynamic calculation of the 2 selling prices (minSalePrice & maxSalePrice)
export function computeRealtimeSellingPrices(
  costPrice: number,
  settings: { pricingMode: string; minProfitMargin: number; maxProfitMargin: number; fixedProfitMargin: number }
): { minSalePrice: number; maxSalePrice: number } {
  const cost = Math.max(0, Number(costPrice) || 0);
  if (cost <= 0) {
    return { minSalePrice: 0, maxSalePrice: 0 };
  }
  if (settings.pricingMode === 'FIXED') {
    const fixedPrice = Math.round(cost * (1 + settings.fixedProfitMargin / 100));
    return { minSalePrice: fixedPrice, maxSalePrice: fixedPrice };
  }
  const minPrice = Math.round(cost * (1 + settings.minProfitMargin / 100));
  const maxPrice = Math.round(cost * (1 + settings.maxProfitMargin / 100));
  return {
    minSalePrice: minPrice,
    maxSalePrice: Math.max(minPrice, maxPrice),
  };
}

// Fast POS Scanner Lookup by Barcode (matches product barcode directly)
router.get('/lookup/:barcode', requireAuth, async (req, res: Response) => {
  try {
    const barcode = req.params.barcode.trim();
    const [result, settings] = await Promise.all([
      pgClient.query(
        `SELECT p.id, p.name, p.brand, p.category, p.sku, p.article, p.barcode, COALESCE(p.size, '42') as size,
                p.primary_image_url, p.description, COALESCE(p.cost_price, 0) as cost_price, 
                p.margin_type, p.profit_calculation_method, p.profit_margin, p.profit_amount,
                p.custom_min_margin, p.custom_max_margin,
                p.sale_price, p.min_sale_price, p.max_sale_price,
                p.total_stock, COALESCE(p.low_stock_limit, 5) as low_stock_limit, p.active
         FROM products p
         WHERE (p.barcode = $1 OR LOWER(p.sku) = LOWER($1) OR LOWER(COALESCE(p.article, '')) = LOWER($1)) AND p.active = true
         LIMIT 1`,
        [barcode]
      ),
      getCompanyPricingSettings(),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Product with barcode or SKU "${barcode}" not found.` });
    }

    const row: any = result.rows[0];
    const costPrice = Math.round(parseFloat(row.cost_price) || 0);
    const marginType = (row.margin_type || 'FIXED').toUpperCase();
    const isFixed = marginType === 'FIXED';

    // Prioritize saved product prices. Only calculate default if not yet saved in database.
    const salePrice = row.sale_price !== null && row.sale_price !== undefined
      ? Math.round(Number(row.sale_price))
      : (isFixed ? Math.round(costPrice * (1 + settings.fixedProfitMargin / 100)) : null);

    const minSalePrice = row.min_sale_price !== null && row.min_sale_price !== undefined
      ? Math.round(Number(row.min_sale_price))
      : (isFixed ? (salePrice || costPrice) : Math.round(costPrice * (1 + settings.minProfitMargin / 100)));

    const maxSalePrice = row.max_sale_price !== null && row.max_sale_price !== undefined
      ? Math.round(Number(row.max_sale_price))
      : (isFixed ? (salePrice || costPrice) : Math.round(costPrice * (1 + settings.maxProfitMargin / 100)));

    const product = {
      id: row.id,
      name: row.name,
      brand: row.brand || 'Local',
      brandName: row.brand || 'Local',
      brandLogo: '',
      category: row.category || 'Casual Shoes',
      categoryName: row.category || 'Casual Shoes',
      sku: row.sku,
      article: row.article || '',
      size: row.size || '42',
      barcode: row.barcode,
      primaryImageUrl: row.primary_image_url,
      description: row.description,
      costPrice,
      marginType,
      profitCalculationMethod: (row.profit_calculation_method || 'FIXED_AMOUNT').toUpperCase(),
      profit_calculation_method: (row.profit_calculation_method || 'FIXED_AMOUNT').toUpperCase(),
      profitMargin: row.profit_margin !== null && row.profit_margin !== undefined ? parseFloat(row.profit_margin) : null,
      profitAmount: row.profit_amount !== null && row.profit_amount !== undefined ? parseFloat(row.profit_amount) : null,
      customMinMargin: row.custom_min_margin ? parseFloat(row.custom_min_margin) : null,
      customMaxMargin: row.custom_max_margin ? parseFloat(row.custom_max_margin) : null,
      salePrice,
      maxSalePrice,
      minSalePrice,
      totalStock: row.total_stock,
      lowStockLimit: row.low_stock_limit,
      active: row.active,
      sizes: [],
      colors: [],
    };

    res.json({ product });
  } catch (err: any) {
    res.status(500).json({ error: 'Lookup failed: ' + err.message });
  }
});

// List Products
router.get('/', requireAuth, async (req, res: Response) => {
  try {
    await ensureProductAndSettingsColumns();
    const { search, brand, category, brandId, categoryId, lowStockOnly, limit } = req.query;

    let query = `
      SELECT p.id, p.name, p.brand, p.category, p.sku, p.article, p.barcode, COALESCE(p.size, '42') as size,
             p.primary_image_url, p.description, COALESCE(p.cost_price, 0) as cost_price, 
             p.margin_type, p.profit_calculation_method, p.profit_margin, p.profit_amount,
             p.custom_min_margin, p.custom_max_margin,
             p.sale_price, p.min_sale_price, p.max_sale_price,
             p.total_stock, COALESCE(p.low_stock_limit, 5) as low_stock_limit, p.active, p.created_at, p.updated_at
      FROM products p
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && typeof search === 'string') {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(COALESCE(p.article, '')) LIKE $${params.length} OR LOWER(p.sku) LIKE $${params.length} OR p.barcode LIKE $${params.length} OR LOWER(p.name) LIKE $${params.length} OR LOWER(p.brand) LIKE $${params.length} OR LOWER(p.category) LIKE $${params.length})`;
    }

    const brandFilter = (brand || brandId) ? String(brand || brandId).trim() : '';
    if (brandFilter) {
      params.push(brandFilter.toLowerCase());
      query += ` AND LOWER(p.brand) = $${params.length}`;
    }

    const catFilter = (category || categoryId) ? String(category || categoryId).trim() : '';
    if (catFilter) {
      params.push(catFilter.toLowerCase());
      query += ` AND LOWER(p.category) = $${params.length}`;
    }

    if (lowStockOnly === 'true') {
      query += ` AND p.total_stock <= COALESCE(p.low_stock_limit, 5)`;
    }

    query += ` ORDER BY p.id DESC`;

    if (limit && !isNaN(Number(limit))) {
      query += ` LIMIT ${Math.max(1, Number(limit))}`;
    }

    const [result, settings] = await Promise.all([
      pgClient.query(query, params),
      getCompanyPricingSettings(),
    ]);

    const products = result.rows.map((row: any) => {
      const cost = Math.round(parseFloat(row.cost_price) || 0);
      const marginType = (row.margin_type || 'FIXED').toUpperCase();
      const isFixed = marginType === 'FIXED';

      const salePrice = row.sale_price !== null && row.sale_price !== undefined
        ? Math.round(Number(row.sale_price))
        : (isFixed ? Math.round(cost * (1 + settings.fixedProfitMargin / 100)) : null);

      const minSalePrice = row.min_sale_price !== null && row.min_sale_price !== undefined
        ? Math.round(Number(row.min_sale_price))
        : (isFixed ? (salePrice || cost) : Math.round(cost * (1 + settings.minProfitMargin / 100)));

      const maxSalePrice = row.max_sale_price !== null && row.max_sale_price !== undefined
        ? Math.round(Number(row.max_sale_price))
        : (isFixed ? (salePrice || cost) : Math.round(cost * (1 + settings.maxProfitMargin / 100)));

      return {
        id: row.id,
        name: row.name,
        brand: row.brand || 'Local',
        brandName: row.brand || 'Local',
        brandLogo: '',
        category: row.category || 'Casual Shoes',
        categoryName: row.category || 'Casual Shoes',
        sku: row.sku,
        article: row.article || '',
        size: row.size || '42',
        barcode: row.barcode,
        primaryImageUrl: row.primary_image_url,
        description: row.description,
        costPrice: cost,
        marginType,
        profitCalculationMethod: (row.profit_calculation_method || 'FIXED_AMOUNT').toUpperCase(),
        profit_calculation_method: (row.profit_calculation_method || 'FIXED_AMOUNT').toUpperCase(),
        profitMargin: row.profit_margin !== null && row.profit_margin !== undefined ? parseFloat(row.profit_margin) : null,
        profitAmount: row.profit_amount !== null && row.profit_amount !== undefined ? parseFloat(row.profit_amount) : null,
        customMinMargin: row.custom_min_margin ? parseFloat(row.custom_min_margin) : null,
        customMaxMargin: row.custom_max_margin ? parseFloat(row.custom_max_margin) : null,
        salePrice,
        maxSalePrice,
        minSalePrice,
        totalStock: row.total_stock,
        lowStockLimit: row.low_stock_limit,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sizes: [],
        colors: [],
      };
    });

    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// Single Product Details
router.get('/:id', requireAuth, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [result, settings] = await Promise.all([
      pgClient.query(
        `SELECT p.*, COALESCE(p.cost_price, 0) as cost_price
         FROM products p
         WHERE p.id = $1`,
        [id]
      ),
      getCompanyPricingSettings(),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const row: any = result.rows[0];
    const cost = Math.round(parseFloat(row.cost_price) || 0);
    const marginType = (row.margin_type || 'FIXED').toUpperCase();
    const isFixed = marginType === 'FIXED';

    const salePrice = row.sale_price !== null && row.sale_price !== undefined
      ? Math.round(Number(row.sale_price))
      : (isFixed ? Math.round(cost * (1 + settings.fixedProfitMargin / 100)) : null);

    const minSalePrice = row.min_sale_price !== null && row.min_sale_price !== undefined
      ? Math.round(Number(row.min_sale_price))
      : (isFixed ? (salePrice || cost) : Math.round(cost * (1 + settings.minProfitMargin / 100)));

    const maxSalePrice = row.max_sale_price !== null && row.max_sale_price !== undefined
      ? Math.round(Number(row.max_sale_price))
      : (isFixed ? (salePrice || cost) : Math.round(cost * (1 + settings.maxProfitMargin / 100)));

    res.json({
      product: {
        id: row.id,
        name: row.name,
        brand: row.brand || 'Local',
        brandName: row.brand || 'Local',
        brandLogo: '',
        category: row.category || 'Casual Shoes',
        categoryName: row.category || 'Casual Shoes',
        sku: row.sku,
        article: row.article || '',
        size: row.size || '42',
        barcode: row.barcode,
        primaryImageUrl: row.primary_image_url,
        description: row.description,
        costPrice: cost,
        marginType,
        profitCalculationMethod: (row.profit_calculation_method || 'FIXED_AMOUNT').toUpperCase(),
        profit_calculation_method: (row.profit_calculation_method || 'FIXED_AMOUNT').toUpperCase(),
        profitMargin: row.profit_margin !== null && row.profit_margin !== undefined ? parseFloat(row.profit_margin) : null,
        profitAmount: row.profit_amount !== null && row.profit_amount !== undefined ? parseFloat(row.profit_amount) : null,
        customMinMargin: row.custom_min_margin ? parseFloat(row.custom_min_margin) : null,
        customMaxMargin: row.custom_max_margin ? parseFloat(row.custom_max_margin) : null,
        salePrice,
        maxSalePrice,
        minSalePrice,
        totalStock: row.total_stock,
        lowStockLimit: row.low_stock_limit,
        active: row.active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sizes: [],
        colors: [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch product: ' + err.message });
  }
});

// Create Product (Admin Only) - 1 Product = 1 SKU = 1 Barcode
router.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      name,
      brand,
      category,
      brandName,
      categoryName,
      brandId,
      categoryId,
      article,
      sku,
      barcode,
      primaryImageUrl,
      description,
      costPrice,
      cost_price,
      marginType,
      margin_type,
      profitCalculationMethod,
      profit_calculation_method,
      profitMargin,
      profit_margin,
      profitAmount,
      profit_amount,
      customMinMargin,
      custom_min_margin,
      customMaxMargin,
      custom_max_margin,
      salePrice,
      sale_price,
      minSalePrice,
      min_sale_price,
      maxSalePrice,
      max_sale_price,
      totalStock = 0,
      initialStock,
      lowStockLimit,
    } = req.body;

    if (!article || !article.trim()) {
      return res.status(400).json({ error: 'Article is a mandatory field.' });
    }
    const cleanArticle = article.trim().toUpperCase();
    const cleanName = (name && name.trim()) ? name.trim() : cleanArticle;

    const rawCost = costPrice !== undefined && costPrice !== null && costPrice !== ''
      ? costPrice
      : cost_price;

    if (rawCost === undefined || rawCost === '' || Number(rawCost) < 0) {
      return res.status(400).json({ error: 'Valid cost price is required.' });
    }
    const finalCostPrice = Math.round(Number(rawCost));

    const [settings] = await Promise.all([
      getCompanyPricingSettings(),
    ]);

    // Pricing policy & integer price handling
    const rawMarginType = String(marginType || margin_type || (settings.pricingMode === 'FIXED' ? 'FIXED' : 'NEGOTIABLE')).toUpperCase();
    const finalMarginType = rawMarginType === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
    const rawCalcMethod = String(profitCalculationMethod || profit_calculation_method || 'FIXED_AMOUNT').toUpperCase();
    const finalCalcMethod = rawCalcMethod === 'PROFIT_MARGIN' ? 'PROFIT_MARGIN' : 'FIXED_AMOUNT';
    const finalProfitMargin = profitMargin !== undefined && profitMargin !== null && profitMargin !== ''
      ? parseFloat(String(profitMargin))
      : (profit_margin !== undefined && profit_margin !== null && profit_margin !== '' ? parseFloat(String(profit_margin)) : null);
    const finalProfitAmount = profitAmount !== undefined && profitAmount !== null && profitAmount !== ''
      ? parseFloat(String(profitAmount))
      : (profit_amount !== undefined && profit_amount !== null && profit_amount !== '' ? parseFloat(String(profit_amount)) : null);
    const finalCustomMinMargin = customMinMargin !== undefined && customMinMargin !== null && customMinMargin !== ''
      ? parseFloat(String(customMinMargin))
      : (custom_min_margin ? parseFloat(String(custom_min_margin)) : null);
    const finalCustomMaxMargin = customMaxMargin !== undefined && customMaxMargin !== null && customMaxMargin !== ''
      ? parseFloat(String(customMaxMargin))
      : (custom_max_margin ? parseFloat(String(custom_max_margin)) : null);

    let finalSalePrice: number = 0;
    let finalMinSalePrice: number = 0;
    let finalMaxSalePrice: number = 0;

    if (finalMarginType === 'FIXED') {
      const rawSale = salePrice !== undefined && salePrice !== null && salePrice !== '' ? salePrice : sale_price;
      finalSalePrice = rawSale !== undefined && rawSale !== null && rawSale !== ''
        ? Math.max(0, Math.round(Number(rawSale)))
        : Math.max(0, Math.round(finalCostPrice * (1 + (settings.fixedProfitMargin || 30) / 100)));
      finalMinSalePrice = finalSalePrice;
      finalMaxSalePrice = finalSalePrice;
    } else {
      const rawMin = minSalePrice !== undefined && minSalePrice !== null && minSalePrice !== '' ? minSalePrice : min_sale_price;
      const rawMax = maxSalePrice !== undefined && maxSalePrice !== null && maxSalePrice !== '' ? maxSalePrice : max_sale_price;
      const parsedMin = rawMin !== undefined && rawMin !== null && rawMin !== ''
        ? Math.max(0, Math.round(Number(rawMin)))
        : Math.max(0, Math.round(finalCostPrice * (1 + (finalCustomMinMargin ?? settings.minProfitMargin ?? 15) / 100)));
      const parsedMax = rawMax !== undefined && rawMax !== null && rawMax !== ''
        ? Math.max(parsedMin, Math.round(Number(rawMax)))
        : Math.max(parsedMin, Math.round(finalCostPrice * (1 + (finalCustomMaxMargin ?? settings.maxProfitMargin ?? 30) / 100)));
      finalMinSalePrice = parsedMin;
      finalMaxSalePrice = parsedMax;
      finalSalePrice = parsedMax;
    }

    // Brand and Category strings
    const finalBrand = (brand || brandName || (typeof brandId === 'string' ? brandId : '') || '').trim() || 'Local';
    const finalCategory = (category || categoryName || (typeof categoryId === 'string' ? categoryId : '') || '').trim() || 'Casual Shoes';
    const brandPrefix = parseBrandPrefix(finalBrand);

    // Get next product ID (auto-incrementing, non-reusable integer from PostgreSQL)
    const predictedId = await getNextProductId();
    if (predictedId > 99999) {
      return res.status(400).json({ error: 'Product ID limit of 99,999 reached for 5-digit barcode generation.' });
    }

    // Size / variant handling (e.g., '42', '40', '41', etc.)
    const rawSize = req.body.size || req.body.sizeVariant || req.body.variant || '42';
    const cleanSize = String(rawSize).trim().toUpperCase();

    // Automated SKU Backend Handling:
    // Format: ${brandCode}-${articleNumber}-${size} (e.g., DAF-SF-0012-42)
    const autoSku = generateSku(brandPrefix, cleanArticle, cleanSize);
    let finalSku = (sku && sku.trim()) ? sku.trim().toUpperCase() : autoSku;

    // Check SKU uniqueness; if auto-generated collision occurs, append product ID for safe isolation
    const skuCheck = await pgClient.query('SELECT id FROM products WHERE LOWER(sku) = LOWER($1)', [finalSku]);
    if (skuCheck.rows.length > 0) {
      if (!sku || !sku.trim()) {
        finalSku = `${brandPrefix}-${cleanArticle}-${cleanSize}-${predictedId}`;
      } else {
        return res.status(400).json({ error: `A product with SKU "${finalSku}" already exists.` });
      }
    }

    // Get company prefix from settings (strictly 7 digits)
    const settingsRes = await pgClient.query<{ barcode_prefix: string }>('SELECT barcode_prefix FROM company_settings LIMIT 1');
    const rawPrefix = settingsRes.rows[0]?.barcode_prefix;
    const prefixCheck = validateBarcodePrefix(rawPrefix);
    if (!prefixCheck.isValid) {
      return res.status(400).json({ error: prefixCheck.error || 'Barcode prefix must be exactly 7 digits in Settings.' });
    }
    const prefix = sanitizePrefix(rawPrefix);

    // Barcode: Internal Store EAN-13 or External Manufacturer Box Barcode
    let finalBarcode = barcode ? barcode.trim() : '';
    if (!finalBarcode) {
      const generated = await generateProductEan13(predictedId);
      finalBarcode = generated.barcode;
    } else {
      const analysis = analyzeBarcode(finalBarcode, prefix);
      if (!analysis.isValid) {
        return res.status(400).json({ error: analysis.error || 'Barcode validation failed.' });
      }
    }

    // Check barcode uniqueness
    const barcodeCheck = await pgClient.query<any>(
      'SELECT id, name, sku FROM products WHERE barcode = $1',
      [finalBarcode]
    );
    if (barcodeCheck.rows.length > 0) {
      const existing = barcodeCheck.rows[0];
      return res.status(400).json({
        error: `A product with Barcode "${finalBarcode}" already exists: "${existing.name}" (${existing.sku}).`,
      });
    }

    const physicalStock = parseInt(String(totalStock ?? initialStock ?? 0), 10) || 0;

    // Calculate low stock limit
    let finalLowStockLimit: number = 5;
    if (lowStockLimit !== undefined && lowStockLimit !== null && lowStockLimit !== '') {
      const parsed = parseInt(String(lowStockLimit), 10);
      if (!isNaN(parsed) && parsed > 0) finalLowStockLimit = parsed;
    } else {
      const setRes = await pgClient.query<{ low_stock_limit: number }>('SELECT low_stock_limit FROM company_settings LIMIT 1');
      finalLowStockLimit = setRes.rows[0]?.low_stock_limit || 5;
    }

    // ATOMIC TRANSACTION: Create product with single cost_price and initial stock movement
    await pgClient.query('BEGIN');
    try {
      const productRes = await pgClient.query<{ id: number }>(
        `INSERT INTO products (
          name, brand, category, sku, article, size, barcode, primary_image_url, 
          description, cost_price, margin_type, profit_calculation_method, profit_margin, profit_amount,
          custom_min_margin, custom_max_margin,
          sale_price, min_sale_price, max_sale_price, total_stock, low_stock_limit, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, true)
        RETURNING id`,
        [
          cleanName,
          finalBrand,
          finalCategory,
          finalSku,
          cleanArticle,
          cleanSize,
          finalBarcode,
          primaryImageUrl || '',
          description || '',
          finalCostPrice,
          finalMarginType,
          finalCalcMethod,
          finalProfitMargin,
          finalProfitAmount,
          finalCustomMinMargin,
          finalCustomMaxMargin,
          finalSalePrice,
          finalMinSalePrice,
          finalMaxSalePrice,
          physicalStock,
          finalLowStockLimit,
        ]
      );

      const productId = productRes.rows[0].id;

      // If predictedId differed from actual assigned ID and no custom/external barcode was specified, update to assigned ID
      if (productId !== predictedId && !barcode) {
        const correctBarcode = generateEan13Barcode(prefix, productId).barcode;
        await pgClient.query('UPDATE products SET barcode = $1 WHERE id = $2', [correctBarcode, productId]);
        finalBarcode = correctBarcode;
      }

      // Log stock movement if initial stock > 0
      if (physicalStock > 0) {
        await pgClient.query(
          `INSERT INTO stock_movements (
            product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes
          ) VALUES ($1, $2, 0, $2, 'PURCHASE', 'INITIAL-STOCK', $3, 'Initial product inventory creation')`,
          [productId, physicalStock, req.user!.id]
        );
      }

      await pgClient.query('COMMIT');
      try {
        await pgClient.query("SELECT setval('products_id_seq', (SELECT GREATEST(MAX(id), 1) FROM products))");
      } catch (_) {}

      res.status(201).json({
        message: 'Product created successfully.',
        productId,
        barcode: finalBarcode,
        sku: finalSku,
      });
    } catch (txErr: any) {
      await pgClient.query('ROLLBACK');
      throw txErr;
    }
  } catch (err: any) {
    console.error('Error creating product:', err);
    res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

// Update Product (Admin Only)
router.put('/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      name,
      brand,
      category,
      brandName,
      categoryName,
      brandId,
      categoryId,
      article,
      sku,
      barcode,
      primaryImageUrl,
      description,
      costPrice,
      cost_price,
      marginType,
      margin_type,
      profitCalculationMethod,
      profit_calculation_method,
      profitMargin,
      profit_margin,
      profitAmount,
      profit_amount,
      customMinMargin,
      custom_min_margin,
      customMaxMargin,
      custom_max_margin,
      salePrice,
      sale_price,
      minSalePrice,
      min_sale_price,
      maxSalePrice,
      max_sale_price,
      totalStock,
      lowStockLimit,
      active,
    } = req.body;

    const currentRes = await pgClient.query('SELECT * FROM products WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }
    const current: any = currentRes.rows[0];

    const finalBrand = brand !== undefined
      ? (String(brand).trim() || 'Local')
      : (brandName !== undefined ? (String(brandName).trim() || 'Local') : (current.brand || 'Local'));
    const finalCategory = category !== undefined
      ? (String(category).trim() || 'Casual Shoes')
      : (categoryName !== undefined ? (String(categoryName).trim() || 'Casual Shoes') : (current.category || 'Casual Shoes'));

    if (article !== undefined && !article.trim()) {
      return res.status(400).json({ error: 'Article is a mandatory field.' });
    }
    const finalArticle = article !== undefined && article.trim()
      ? article.trim().toUpperCase()
      : (current.article || '');
    const finalName = name !== undefined && name.trim()
      ? name.trim()
      : (article !== undefined && article.trim() ? article.trim().toUpperCase() : current.name);

    // Check SKU conflict
    if (sku && sku.trim().toUpperCase() !== current.sku) {
      const skuCheck = await pgClient.query('SELECT id FROM products WHERE LOWER(sku) = LOWER($1) AND id != $2', [
        sku.trim(),
        id,
      ]);
      if (skuCheck.rows.length > 0) {
        return res.status(400).json({ error: `SKU "${sku}" is already in use by another product.` });
      }
    }

    // Check barcode conflict & validation
    let finalBarcode = current.barcode;
    if (barcode && barcode.trim() !== current.barcode) {
      const cleanBarcode = barcode.trim();
      const prefixRes = await pgClient.query<any>('SELECT barcode_prefix FROM company_settings LIMIT 1');
      const prefix = prefixRes.rows[0]?.barcode_prefix || '0108923';
      const analysis = analyzeBarcode(cleanBarcode, prefix);
      if (!analysis.isValid) {
        return res.status(400).json({ error: analysis.error || 'Barcode validation failed.' });
      }
      const barcodeCheck = await pgClient.query<any>(
        'SELECT id, name, sku FROM products WHERE barcode = $1 AND id != $2',
        [cleanBarcode, id]
      );
      if (barcodeCheck.rows.length > 0) {
        const existing = barcodeCheck.rows[0];
        return res.status(400).json({
          error: `Barcode "${cleanBarcode}" is already in use by product: "${existing.name}" (${existing.sku}).`,
        });
      }
      finalBarcode = cleanBarcode;
    }

    const updatedStock = totalStock !== undefined ? parseInt(String(totalStock), 10) : current.total_stock;
    const rawCost = costPrice !== undefined && costPrice !== null && costPrice !== ''
      ? costPrice
      : cost_price;

    const finalCostPrice = rawCost !== undefined && rawCost !== ''
      ? Math.round(Number(rawCost))
      : Math.round(Number(current.cost_price || 0));

    // Pricing policy & integer price handling
    const rawMarginType = marginType !== undefined ? marginType : (margin_type !== undefined ? margin_type : current.margin_type);
    const finalMarginType = String(rawMarginType || 'FIXED').toUpperCase() === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';

    const rawCalcMethod = profitCalculationMethod !== undefined
      ? profitCalculationMethod
      : (profit_calculation_method !== undefined ? profit_calculation_method : current.profit_calculation_method);
    const finalCalcMethod = String(rawCalcMethod || 'FIXED_AMOUNT').toUpperCase() === 'PROFIT_MARGIN' ? 'PROFIT_MARGIN' : 'FIXED_AMOUNT';

    const finalProfitMargin = profitMargin !== undefined
      ? (profitMargin !== null && profitMargin !== '' ? parseFloat(String(profitMargin)) : null)
      : (profit_margin !== undefined ? (profit_margin !== null && profit_margin !== '' ? parseFloat(String(profit_margin)) : null) : current.profit_margin);

    const finalProfitAmount = profitAmount !== undefined
      ? (profitAmount !== null && profitAmount !== '' ? parseFloat(String(profitAmount)) : null)
      : (profit_amount !== undefined ? (profit_amount !== null && profit_amount !== '' ? parseFloat(String(profit_amount)) : null) : current.profit_amount);

    const finalCustomMinMargin = customMinMargin !== undefined
      ? (customMinMargin !== null && customMinMargin !== '' ? parseFloat(String(customMinMargin)) : null)
      : (custom_min_margin !== undefined ? (custom_min_margin !== null && custom_min_margin !== '' ? parseFloat(String(custom_min_margin)) : null) : current.custom_min_margin);

    const finalCustomMaxMargin = customMaxMargin !== undefined
      ? (customMaxMargin !== null && customMaxMargin !== '' ? parseFloat(String(customMaxMargin)) : null)
      : (custom_max_margin !== undefined ? (custom_max_margin !== null && custom_max_margin !== '' ? parseFloat(String(custom_max_margin)) : null) : current.custom_max_margin);

    let finalSalePrice: number | null = current.sale_price !== null ? Math.round(Number(current.sale_price)) : null;
    let finalMinSalePrice: number | null = current.min_sale_price !== null ? Math.round(Number(current.min_sale_price)) : null;
    let finalMaxSalePrice: number | null = current.max_sale_price !== null ? Math.round(Number(current.max_sale_price)) : null;

    if (finalMarginType === 'FIXED') {
      const rawSale = salePrice !== undefined && salePrice !== null && salePrice !== ''
        ? salePrice
        : (sale_price !== undefined && sale_price !== null && sale_price !== '' ? sale_price : finalSalePrice);
      if (rawSale !== undefined && rawSale !== null && rawSale !== '') {
        finalSalePrice = Math.max(0, Math.round(Number(rawSale)));
        finalMinSalePrice = finalSalePrice;
        finalMaxSalePrice = finalSalePrice;
      }
    } else {
      const rawMin = minSalePrice !== undefined && minSalePrice !== null && minSalePrice !== ''
        ? minSalePrice
        : (min_sale_price !== undefined && min_sale_price !== null && min_sale_price !== '' ? min_sale_price : finalMinSalePrice);
      const rawMax = maxSalePrice !== undefined && maxSalePrice !== null && maxSalePrice !== ''
        ? maxSalePrice
        : (max_sale_price !== undefined && max_sale_price !== null && max_sale_price !== '' ? max_sale_price : finalMaxSalePrice);

      if (rawMin !== undefined && rawMin !== null && rawMin !== '') {
        finalMinSalePrice = Math.max(0, Math.round(Number(rawMin)));
      }
      if (rawMax !== undefined && rawMax !== null && rawMax !== '') {
        finalMaxSalePrice = Math.max(finalMinSalePrice || 0, Math.round(Number(rawMax)));
      }
      finalSalePrice = finalMaxSalePrice;
    }

    await pgClient.query(
      `UPDATE products SET 
        name = $1, brand = $2, category = $3, sku = $4, article = $5, barcode = $6,
        primary_image_url = $7, description = $8, cost_price = $9, total_stock = $10,
        low_stock_limit = $11, active = $12, margin_type = $13, custom_min_margin = $14,
        custom_max_margin = $15, sale_price = $16, min_sale_price = $17, max_sale_price = $18,
        profit_calculation_method = $19, profit_margin = $20, profit_amount = $21,
        updated_at = NOW()
      WHERE id = $22`,
      [
        finalName,
        finalBrand,
        finalCategory,
        sku ? sku.trim().toUpperCase() : current.sku,
        finalArticle,
        finalBarcode,
        primaryImageUrl !== undefined ? primaryImageUrl : current.primary_image_url,
        description !== undefined ? description : current.description,
        finalCostPrice,
        updatedStock,
        lowStockLimit !== undefined ? parseInt(lowStockLimit, 10) : current.low_stock_limit,
        active !== undefined ? Boolean(active) : current.active,
        finalMarginType,
        finalCustomMinMargin,
        finalCustomMaxMargin,
        finalSalePrice,
        finalMinSalePrice,
        finalMaxSalePrice,
        finalCalcMethod,
        finalProfitMargin,
        finalProfitAmount,
        id,
      ]
    );

    res.json({ message: 'Product updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

// Delete Product (Admin Only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    // Check if product is referenced in sales
    const salesCheck = await pgClient.query('SELECT id FROM sale_items WHERE product_id = $1 LIMIT 1', [id]);
    if (salesCheck.rows.length > 0) {
      // Soft-delete (deactivate) to preserve financial and audit history
      await pgClient.query('UPDATE products SET active = false, updated_at = NOW() WHERE id = $1', [id]);
      return res.json({ message: 'Product has historic sales records; it has been deactivated instead of deleted.' });
    }

    await pgClient.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ message: 'Product deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
});

export default router;
