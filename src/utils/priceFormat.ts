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
 * Returns the effective retail selling price (M.R.P. / Maximum Sale Price) for a product.
 * In the new pricing architecture:
 * 1. For Fixed Pricing: uses product's saved sale_price directly.
 * 2. For Negotiable Pricing: uses product's saved max_sale_price directly.
 * 3. Fallback: only if product has no saved price fields, calculates initial default from cost + margin settings.
 */
export function getProductRetailPrice(product: any, companySettings?: any): number {
  if (!product) return 0;

  const rawMarginType = String(product.marginType || product.margin_type || '').toUpperCase();
  const isExplicitFixed = rawMarginType === 'FIXED';
  const isExplicitNegotiable = rawMarginType === 'NEGOTIABLE';

  // 1. Direct saved values based on policy
  if (isExplicitFixed) {
    const rawSale = product.salePrice ?? product.sale_price;
    const sale = Number(rawSale);
    if (!isNaN(sale) && sale > 0) return Math.round(sale);
  } else if (isExplicitNegotiable) {
    const rawMax = product.maxSalePrice ?? product.max_sale_price;
    const max = Number(rawMax);
    if (!isNaN(max) && max > 0) return Math.round(max);
  }

  // 2. Check saved fields regardless of explicit marginType flag
  const directSale = Number(product.salePrice ?? product.sale_price);
  const directMax = Number(product.maxSalePrice ?? product.max_sale_price);
  const directMin = Number(product.minSalePrice ?? product.min_sale_price);

  if (!isNaN(directMax) && directMax > 0) {
    return Math.round(directMax);
  }
  if (!isNaN(directSale) && directSale > 0) {
    return Math.round(directSale);
  }
  if (!isNaN(directMin) && directMin > 0) {
    return Math.round(directMin);
  }

  // 3. Fallback: Default/Automatic calculation from Cost Price + Company Settings only if no saved price exists
  const cost = Number(
    product.costPrice !== undefined && product.costPrice !== null
      ? product.costPrice
      : product.cost_price !== undefined && product.cost_price !== null
      ? product.cost_price
      : 0
  );

  if (cost > 0) {
    const rawMode = String(companySettings?.pricing_mode || companySettings?.pricingMode || 'FIXED').toUpperCase();
    if (rawMode === 'FIXED') {
      const fixedMargin =
        typeof companySettings?.fixed_profit_margin === 'number'
          ? companySettings.fixed_profit_margin
          : typeof companySettings?.fixedProfitMargin === 'number'
          ? companySettings.fixedProfitMargin
          : parseFloat(companySettings?.fixed_profit_margin || companySettings?.fixedProfitMargin || '30') || 30;
      return Math.round(cost * (1 + fixedMargin / 100));
    } else {
      const maxMargin =
        typeof companySettings?.max_profit_margin === 'number'
          ? companySettings.max_profit_margin
          : typeof companySettings?.maxProfitMargin === 'number'
          ? companySettings.maxProfitMargin
          : parseFloat(companySettings?.max_profit_margin || companySettings?.maxProfitMargin || '30') || 30;
      return Math.round(cost * (1 + maxMargin / 100));
    }
  }

  return 0;
}

/**
 * Returns the minimum floor selling price for a product.
 * In the new pricing architecture:
 * 1. For Fixed Pricing: equal to the saved sale_price.
 * 2. For Negotiable Pricing: uses product's saved min_sale_price directly.
 * 3. Fallback: calculates from cost + min margin settings only if no saved price exists.
 */
export function getProductMinFloorPrice(product: any, companySettings?: any): number {
  if (!product) return 0;

  const rawMarginType = String(product.marginType || product.margin_type || '').toUpperCase();
  const isExplicitFixed = rawMarginType === 'FIXED';
  const isExplicitNegotiable = rawMarginType === 'NEGOTIABLE';

  if (isExplicitFixed) {
    const rawSale = product.salePrice ?? product.sale_price;
    const sale = Number(rawSale);
    if (!isNaN(sale) && sale > 0) return Math.round(sale);
  } else if (isExplicitNegotiable) {
    const rawMin = product.minSalePrice ?? product.min_sale_price;
    const min = Number(rawMin);
    if (!isNaN(min) && min > 0) return Math.round(min);
  }

  const directMin = Number(product.minSalePrice ?? product.min_sale_price);
  if (!isNaN(directMin) && directMin > 0) {
    return Math.round(directMin);
  }
  const directSale = Number(product.salePrice ?? product.sale_price);
  if (!isNaN(directSale) && directSale > 0) {
    return Math.round(directSale);
  }
  const directMax = Number(product.maxSalePrice ?? product.max_sale_price);
  if (!isNaN(directMax) && directMax > 0) {
    return Math.round(directMax);
  }

  // Fallback only if no saved price exists
  const cost = Number(
    product.costPrice !== undefined && product.costPrice !== null
      ? product.costPrice
      : product.cost_price !== undefined && product.cost_price !== null
      ? product.cost_price
      : 0
  );

  if (cost > 0) {
    const rawMode = String(companySettings?.pricing_mode || companySettings?.pricingMode || 'FIXED').toUpperCase();
    if (rawMode === 'FIXED') {
      const fixedMargin =
        typeof companySettings?.fixed_profit_margin === 'number'
          ? companySettings.fixed_profit_margin
          : typeof companySettings?.fixedProfitMargin === 'number'
          ? companySettings.fixedProfitMargin
          : parseFloat(companySettings?.fixed_profit_margin || companySettings?.fixedProfitMargin || '30') || 30;
      return Math.round(cost * (1 + fixedMargin / 100));
    } else {
      const minMargin =
        typeof companySettings?.min_profit_margin === 'number'
          ? companySettings.min_profit_margin
          : typeof companySettings?.minProfitMargin === 'number'
          ? companySettings.minProfitMargin
          : parseFloat(companySettings?.min_profit_margin || companySettings?.minProfitMargin || '15') || 15;
      return Math.round(cost * (1 + minMargin / 100));
    }
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
  const rawMode = String(product?.marginType || product?.margin_type || companySettings?.pricing_mode || companySettings?.pricingMode || 'FIXED').toUpperCase();
  const isFixed = rawMode === 'FIXED';

  return {
    costPrice: cost,
    retailPrice,
    minFloorPrice,
    sellingPrice: retailPrice,
    isFixed,
  };
}

