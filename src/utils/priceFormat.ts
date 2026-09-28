/**
 * Price Formatting Rule & Decimal Removal Utilities
 *
 * Rule:
 * Remove decimal price rule totally. Never show prices with decimals (e.g. convert 1250.00 or 1250.50 to 1250).
 * All retail shoe prices, subtotals, tender amounts, and inventory costs are displayed as whole integers.
 */

/**
 * Cleans decimal representation for price input fields.
 * Strips all decimals and returns a clean whole integer string.
 */
export function cleanStockPriceInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const s = String(value).replace(/,/g, '').replace(/^[^\d-]+/, '').trim();
  if (!s) return '';
  const n = parseFloat(s);
  if (isNaN(n)) return '';
  return Math.round(n).toString();
}

/**
 * Formats a price or monetary amount for display without any decimals.
 * - Always returns whole number (e.g. "1250", "45", "0").
 * - Decimals like .00, .50, etc. are completely removed.
 */
export function formatStockPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  if (typeof value === 'number') {
    if (isNaN(value)) return '0';
    return Math.round(value).toString();
  }
  const cleanStr = String(value).replace(/,/g, '').replace(/^[^\d-]+/, '').trim();
  const n = parseFloat(cleanStr);
  if (isNaN(n)) return '0';
  return Math.round(n).toString();
}

/**
 * Helper to display price with currency symbol without decimals.
 */
export function formatStockPriceWithCurrency(
  value: number | string | null | undefined,
  currencySymbol: string = 'Rs.'
): string {
  return `${currencySymbol} ${formatStockPrice(value)}`;
}

/**
 * Standard formatCurrency alias complying with zero-decimal integer rule.
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currencySymbol: string = 'Rs.'
): string {
  return `${currencySymbol} ${formatStockPrice(value)}`;
}

/**
 * Returns the effective retail selling price (M.R.P. / Tag Price) for a product.
 * In the consolidated pricing architecture:
 * 1. For Fixed Pricing: uses product's saved `sellingPrice` (where sellingPrice = minPrice = maxPrice).
 * 2. For Negotiable Pricing: uses product's saved `maxPrice` (or `sellingPrice`).
 */
export function getProductRetailPrice(product: any, companySettings?: any): number {
  if (!product) return 0;

  const rawPolicy = String(
    companySettings?.pricingPolicy ||
    companySettings?.pricing_policy ||
    companySettings?.pricingMode ||
    companySettings?.pricing_mode ||
    product?.pricingPolicy ||
    product?.pricing_mode ||
    'FIXED'
  ).toUpperCase();
  const isFixed = rawPolicy === 'FIXED';

  const selling = Number(product.sellingPrice ?? product.selling_price ?? product.salePrice ?? product.sale_price);
  const max = Number(product.maxPrice ?? product.max_price ?? product.maxSalePrice ?? product.max_sale_price);
  const min = Number(product.minPrice ?? product.min_price ?? product.minSalePrice ?? product.min_sale_price);
  const cost = Number(product.costPrice ?? product.cost_price ?? 0);

  if (isFixed) {
    if (!isNaN(selling) && selling > 0) return Math.round(selling);
    if (!isNaN(max) && max > 0) return Math.round(max);
    if (!isNaN(min) && min > 0) return Math.round(min);
  } else {
    if (!isNaN(max) && max > 0) return Math.round(max);
    if (!isNaN(selling) && selling > 0) return Math.round(selling);
    if (!isNaN(min) && min > 0) return Math.round(min);
  }

  if (!isNaN(cost) && cost > 0) {
    return Math.round(cost);
  }

  return 0;
}

/**
 * Returns the minimum floor selling price for a product.
 * In the consolidated pricing architecture:
 * 1. For Fixed Pricing: equal to `sellingPrice` (since sellingPrice = minPrice = maxPrice).
 * 2. For Negotiable Pricing: equal to `minPrice`.
 */
export function getProductMinFloorPrice(product: any, companySettings?: any): number {
  if (!product) return 0;

  const rawPolicy = String(
    companySettings?.pricingPolicy ||
    companySettings?.pricing_policy ||
    companySettings?.pricingMode ||
    companySettings?.pricing_mode ||
    product?.pricingPolicy ||
    product?.pricing_mode ||
    'FIXED'
  ).toUpperCase();
  const isFixed = rawPolicy === 'FIXED';

  const selling = Number(product.sellingPrice ?? product.selling_price ?? product.salePrice ?? product.sale_price);
  const min = Number(product.minPrice ?? product.min_price ?? product.minSalePrice ?? product.min_sale_price);
  const max = Number(product.maxPrice ?? product.max_price ?? product.maxSalePrice ?? product.max_sale_price);
  const cost = Number(product.costPrice ?? product.cost_price ?? 0);

  if (isFixed) {
    if (!isNaN(selling) && selling > 0) return Math.round(selling);
    if (!isNaN(min) && min > 0) return Math.round(min);
    if (!isNaN(max) && max > 0) return Math.round(max);
  } else {
    if (!isNaN(min) && min > 0) return Math.round(min);
    if (!isNaN(selling) && selling > 0) return Math.round(selling);
    if (!isNaN(max) && max > 0) return Math.round(max);
  }

  if (!isNaN(cost) && cost > 0) {
    return Math.round(cost);
  }

  return 0;
}

/**
 * Returns a comprehensive pricing breakdown for a product based on its saved prices.
 */
export function getProductRealtimePricing(product: any, companySettings?: any) {
  const cost = Number(
    product?.costPrice !== undefined && product?.costPrice !== null
      ? product.costPrice
      : product?.cost_price !== undefined && product?.cost_price !== null
      ? product.cost_price
      : 0
  );
  const retailPrice = getProductRetailPrice(product, companySettings);
  const minFloorPrice = getProductMinFloorPrice(product, companySettings);
  const rawMode = String(
    companySettings?.pricingPolicy ||
    companySettings?.pricing_policy ||
    companySettings?.pricing_mode ||
    companySettings?.pricingMode ||
    'FIXED'
  ).toUpperCase();
  const isFixed = rawMode === 'FIXED';

  return {
    costPrice: cost,
    retailPrice,
    minFloorPrice,
    sellingPrice: retailPrice,
    minPrice: minFloorPrice,
    maxPrice: retailPrice,
    isFixed,
  };
}

