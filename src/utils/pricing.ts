/**
 * Centralized Pricing Engine & Validation Service
 *
 * Core Rules:
 * 1. Fixed Price Policy:
 *    - sellingPrice = minPrice = maxPrice
 *    - sellingPrice >= costPrice
 *
 * 2. Negotiable Price Policy:
 *    - Requires costPrice, minPrice (Min Selling Price), and maxPrice (Max Selling Price)
 *    - minPrice >= costPrice AND maxPrice >= minPrice
 *    - Initial sellingPrice = maxPrice
 */

export {
  productPricingSchema,
  validateAndNormalizeProductPricing,
  type ValidatedProductPricing,
} from '../schemas/productSchema.ts';

export type PricingMode = 'FIXED' | 'NEGOTIABLE';

export interface PricingSettingsInput {
  pricingPolicy?: PricingMode | string;
  pricing_policy?: PricingMode | string;
  pricingMode?: PricingMode | string;
  pricing_mode?: PricingMode | string;
  currencySymbol?: string;
  currency_symbol?: string;
}

export interface CalculatedProductPricing {
  mode: PricingMode;
  costPrice: number;
  minimumSellingPrice: number;
  maximumSellingPrice: number;
  initialSellingPrice: number;
  sellingPrice: number;
  allowedRangeText: string;
}

/**
 * Standardized currency rounding helper (avoids floating point artifacts).
 */
export function roundToCurrency(val: number): number {
  if (typeof val !== 'number' || isNaN(val) || val <= 0) return 0;
  return Math.round(val);
}

/**
 * Resolves the active store pricing policy ('FIXED' | 'NEGOTIABLE').
 */
export function resolveStorePricingPolicy(settings?: PricingSettingsInput | null): PricingMode {
  const rawMode = String(
    settings?.pricingPolicy ||
    settings?.pricing_policy ||
    settings?.pricingMode ||
    settings?.pricing_mode ||
    'FIXED'
  ).toUpperCase();
  return rawMode === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';
}

/**
 * Centralized function for resolving product pricing across POS cart, catalog, and stickers.
 */
export function calculateProductPricing(
  costPriceOrProduct: number | string | Record<string, any> | undefined | null,
  settings?: PricingSettingsInput | null
): CalculatedProductPricing {
  const mode = resolveStorePricingPolicy(settings);
  const sym = settings?.currencySymbol || settings?.currency_symbol || 'Rs.';

  if (costPriceOrProduct && typeof costPriceOrProduct === 'object') {
    const prod = costPriceOrProduct;
    const cost = roundToCurrency(Number(prod.costPrice ?? prod.cost_price ?? 0));
    const selling = roundToCurrency(Number(prod.sellingPrice ?? prod.selling_price ?? prod.salePrice ?? prod.sale_price ?? cost));
    const min = roundToCurrency(Number(prod.minPrice ?? prod.min_price ?? prod.minSalePrice ?? prod.min_sale_price ?? selling));
    const max = roundToCurrency(Number(prod.maxPrice ?? prod.max_price ?? prod.maxSalePrice ?? prod.max_sale_price ?? selling));

    if (mode === 'FIXED') {
      const finalPrice = selling > 0 ? selling : max > 0 ? max : min > 0 ? min : cost;
      return {
        mode: 'FIXED',
        costPrice: cost,
        minimumSellingPrice: finalPrice,
        maximumSellingPrice: finalPrice,
        initialSellingPrice: finalPrice,
        sellingPrice: finalPrice,
        allowedRangeText: `${sym} ${finalPrice.toLocaleString()}`,
      };
    }

    const finalMin = min > 0 ? min : selling > 0 ? selling : cost;
    const finalMax = Math.max(finalMin, max > 0 ? max : selling > 0 ? selling : finalMin);
    return {
      mode: 'NEGOTIABLE',
      costPrice: cost,
      minimumSellingPrice: finalMin,
      maximumSellingPrice: finalMax,
      initialSellingPrice: finalMax,
      sellingPrice: finalMax,
      allowedRangeText: `${sym} ${finalMin.toLocaleString()} - ${sym} ${finalMax.toLocaleString()}`,
    };
  }

  const cost = roundToCurrency(Number(costPriceOrProduct) || 0);
  return {
    mode,
    costPrice: cost,
    minimumSellingPrice: cost,
    maximumSellingPrice: cost,
    initialSellingPrice: cost,
    sellingPrice: cost,
    allowedRangeText: `${sym} ${cost.toLocaleString()}`,
  };
}

