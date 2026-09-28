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
import { validateAndNormalizeProductPricing } from '../../schemas/productSchema.ts';

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
      await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_mode VARCHAR(30) NOT NULL DEFAULT 'FIXED'");
      await pgClient.query("ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_policy_locked BOOLEAN NOT NULL DEFAULT false");
      await pgClient.query("UPDATE company_settings SET pricing_policy_locked = true WHERE is_installed = true");
    }
    if (reg.rows[0]?.has_products) {
      await pgClient.query("ALTER TABLE products DROP COLUMN IF EXISTS size");
      await pgClient.query("ALTER TABLE products DROP COLUMN IF EXISTS color");
      await pgClient.query("CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku)");
      await pgClient.query("CREATE INDEX IF NOT EXISTS products_article_idx ON products(article)");
      await pgClient.query("CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode)");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price INTEGER NOT NULL DEFAULT 0");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price INTEGER NOT NULL DEFAULT 0");
      await pgClient.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS max_price INTEGER NOT NULL DEFAULT 0");
    }
    if (reg.rows[0]?.has_settings && reg.rows[0]?.has_products) {
      productColumnsVerified = true;
    }
  } catch (_) {}
}

// Company pricing settings helper
export async function getCompanyPricingSettings(): Promise<{
  pricingMode: 'FIXED' | 'NEGOTIABLE';
  pricingPolicy: 'FIXED' | 'NEGOTIABLE';
  pricingPolicyLocked: boolean;
  currencySymbol: string;
}> {
  try {
    await ensureProductAndSettingsColumns();
    const res = await pgClient.query<any>(
      'SELECT pricing_mode, pricing_policy_locked, is_installed, currency_symbol FROM company_settings LIMIT 1'
    );
    const row = res.rows[0];
    const mode = String(row?.pricing_mode || 'FIXED').toUpperCase() === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
    return {
      pricingMode: mode,
      pricingPolicy: mode,
      pricingPolicyLocked: Boolean(row?.pricing_policy_locked || row?.is_installed),
      currencySymbol: row?.currency_symbol || 'Rs.',
    };
  } catch {
    return {
      pricingMode: 'FIXED',
      pricingPolicy: 'FIXED',
      pricingPolicyLocked: false,
      currencySymbol: 'Rs.',
    };
  }
}

function mapProductRow(row: any, settings: { pricingMode: 'FIXED' | 'NEGOTIABLE' }) {
  const costPrice = Math.round(parseFloat(row.cost_price) || 0);
  const rawSelling = Math.round(Number(row.selling_price ?? 0));
  const rawMin = Math.round(Number(row.min_price ?? 0));
  const rawMax = Math.round(Number(row.max_price ?? 0));

  let sellingPrice: number;
  let minPrice: number;
  let maxPrice: number;

  if (settings.pricingMode === 'FIXED') {
    const resolvedFixed = rawSelling > 0 ? rawSelling : rawMax > 0 ? rawMax : rawMin > 0 ? rawMin : costPrice;
    sellingPrice = resolvedFixed;
    minPrice = resolvedFixed;
    maxPrice = resolvedFixed;
  } else {
    minPrice = rawMin > 0 ? rawMin : rawSelling > 0 ? rawSelling : costPrice;
    maxPrice = Math.max(minPrice, rawMax > 0 ? rawMax : rawSelling > 0 ? rawSelling : minPrice);
    sellingPrice = maxPrice;
  }

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
    barcode: row.barcode,
    primaryImageUrl: row.primary_image_url,
    description: row.description,
    costPrice,
    sellingPrice,
    minPrice,
    maxPrice,
    pricingPolicy: settings.pricingMode,
    pricing_mode: settings.pricingMode,
    // Backward-compatible aliases for POS / Sticker / Catalog components
    salePrice: sellingPrice,
    minSalePrice: minPrice,
    maxSalePrice: maxPrice,
    totalStock: row.total_stock,
    lowStockLimit: row.low_stock_limit,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Fast POS Scanner Lookup by Barcode (matches product barcode directly)
router.get('/lookup/:barcode', requireAuth, async (req, res: Response) => {
  try {
    await ensureProductAndSettingsColumns();
    const barcode = req.params.barcode.trim();
    const [result, settings] = await Promise.all([
      pgClient.query(
        `SELECT p.id, p.name, p.brand, p.category, p.sku, p.article, p.barcode,
                p.primary_image_url, p.description, COALESCE(p.cost_price, 0) as cost_price,
                COALESCE(p.selling_price, 0) as selling_price,
                COALESCE(p.min_price, 0) as min_price,
                COALESCE(p.max_price, 0) as max_price,
                p.total_stock, COALESCE(p.low_stock_limit, 5) as low_stock_limit, p.active, p.created_at, p.updated_at
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

    const product = mapProductRow(result.rows[0], settings);
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
      SELECT p.id, p.name, p.brand, p.category, p.sku, p.article, p.barcode,
             p.primary_image_url, p.description, COALESCE(p.cost_price, 0) as cost_price,
             COALESCE(p.selling_price, 0) as selling_price,
             COALESCE(p.min_price, 0) as min_price,
             COALESCE(p.max_price, 0) as max_price,
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

    const products = result.rows.map((row: any) => mapProductRow(row, settings));
    res.json({ products });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// Single Product Details
router.get('/:id', requireAuth, async (req, res: Response) => {
  try {
    await ensureProductAndSettingsColumns();
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

    res.json({
      product: mapProductRow(result.rows[0], settings),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch product: ' + err.message });
  }
});

// Create Product (Admin Only) - 1 Product = 1 SKU = 1 Barcode
router.post('/', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await ensureProductAndSettingsColumns();
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
      sellingPrice,
      selling_price,
      salePrice,
      sale_price,
      minPrice,
      min_price,
      minSalePrice,
      min_sale_price,
      maxPrice,
      max_price,
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

    const settings = await getCompanyPricingSettings();

    const rawCost = costPrice ?? cost_price;
    const rawSelling = sellingPrice ?? selling_price ?? salePrice ?? sale_price;
    const rawMin = minPrice ?? min_price ?? minSalePrice ?? min_sale_price;
    const rawMax = maxPrice ?? max_price ?? maxSalePrice ?? max_sale_price;

    // Validate with strict Zod schema based on store's locked pricing policy
    const validation = validateAndNormalizeProductPricing({
      pricingPolicy: settings.pricingPolicy,
      costPrice: rawCost,
      sellingPrice: rawSelling,
      minPrice: rawMin,
      maxPrice: rawMax,
    });

    if (!validation.success || !validation.data) {
      return res.status(400).json({
        error: validation.errors.general || 'Invalid product pricing.',
        fieldErrors: validation.errors,
      });
    }

    const {
      costPrice: finalCostPrice,
      sellingPrice: finalSellingPrice,
      minPrice: finalMinPrice,
      maxPrice: finalMaxPrice,
    } = validation.data;

    // Brand and Category strings
    const finalBrand = (brand || brandName || (typeof brandId === 'string' ? brandId : '') || '').trim() || 'Local';
    const finalCategory = (category || categoryName || (typeof categoryId === 'string' ? categoryId : '') || '').trim() || 'Casual Shoes';
    const brandPrefix = parseBrandPrefix(finalBrand);

    // Get next product ID (auto-incrementing, non-reusable integer from PostgreSQL)
    const predictedId = await getNextProductId();
    if (predictedId > 99999) {
      return res.status(400).json({ error: 'Product ID limit of 99,999 reached for 5-digit barcode generation.' });
    }

    // Automated SKU Backend Handling:
    // Format: ${brandCode}-${articleNumber}-${predictedId}
    const autoSku = generateSku(brandPrefix, cleanArticle, predictedId);
    let finalSku = (sku && sku.trim()) ? sku.trim().toUpperCase() : autoSku;

    // Check SKU uniqueness; if auto-generated collision occurs, append product ID for safe isolation
    const skuCheck = await pgClient.query('SELECT id FROM products WHERE LOWER(sku) = LOWER($1)', [finalSku]);
    if (skuCheck.rows.length > 0) {
      if (!sku || !sku.trim()) {
        finalSku = `${brandPrefix}-${cleanArticle}-${predictedId}`;
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

    // ATOMIC TRANSACTION: Create product with refined pricing fields and initial stock movement
    await pgClient.query('BEGIN');
    try {
      const productRes = await pgClient.query<{ id: number }>(
        `INSERT INTO products (
          name, brand, category, sku, article, barcode, primary_image_url,
          description, cost_price, selling_price, min_price, max_price,
          total_stock, low_stock_limit, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
        RETURNING id`,
        [
          cleanName,
          finalBrand,
          finalCategory,
          finalSku,
          cleanArticle,
          finalBarcode,
          primaryImageUrl || '',
          description || '',
          finalCostPrice,
          finalSellingPrice,
          finalMinPrice,
          finalMaxPrice,
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
    await ensureProductAndSettingsColumns();
    const id = parseInt(req.params.id, 10);
    const {
      name,
      brand,
      category,
      brandName,
      categoryName,
      article,
      sku,
      barcode,
      primaryImageUrl,
      description,
      costPrice,
      cost_price,
      sellingPrice,
      selling_price,
      salePrice,
      sale_price,
      minPrice,
      min_price,
      minSalePrice,
      min_sale_price,
      maxPrice,
      max_price,
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
    const settings = await getCompanyPricingSettings();

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

    const rawCost = costPrice ?? cost_price ?? current.cost_price ?? 0;
    const rawSelling = sellingPrice ?? selling_price ?? salePrice ?? sale_price ?? current.selling_price ?? 0;
    const rawMin = minPrice ?? min_price ?? minSalePrice ?? min_sale_price ?? current.min_price ?? rawSelling;
    const rawMax = maxPrice ?? max_price ?? maxSalePrice ?? max_sale_price ?? current.max_price ?? rawSelling;

    // Validate with strict Zod schema based on store's locked pricing policy
    const validation = validateAndNormalizeProductPricing({
      pricingPolicy: settings.pricingPolicy,
      costPrice: rawCost,
      sellingPrice: rawSelling,
      minPrice: rawMin,
      maxPrice: rawMax,
    });

    if (!validation.success || !validation.data) {
      return res.status(400).json({
        error: validation.errors.general || 'Invalid product pricing.',
        fieldErrors: validation.errors,
      });
    }

    const {
      costPrice: finalCostPrice,
      sellingPrice: finalSellingPrice,
      minPrice: finalMinPrice,
      maxPrice: finalMaxPrice,
    } = validation.data;

    await pgClient.query(
      `UPDATE products SET
        name = $1, brand = $2, category = $3, sku = $4, article = $5, barcode = $6,
        primary_image_url = $7, description = $8, cost_price = $9, total_stock = $10,
        low_stock_limit = $11, active = $12,
        selling_price = $13, min_price = $14, max_price = $15,
        updated_at = NOW()
      WHERE id = $16`,
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
        finalSellingPrice,
        finalMinPrice,
        finalMaxPrice,
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
