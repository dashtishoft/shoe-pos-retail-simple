/**
 * Centralized Pricing Engine & Calculation Service
 *
 * Core Rules:
 * 1. Fixed Price Mode:
 *    Selling Price = Cost Price * (1 + Fixed Profit% / 100)
 *    Initial = Minimum = Maximum = Fixed Selling Price.
 *
 * 2. Negotiable Price Mode:
 *    Minimum Selling Price = Cost Price * (1 + Minimum Profit% / 100)
 *    Maximum Selling Price = Cost Price * (1 + Maximum Profit% / 100)
 *    Initial Selling Price = Maximum Selling Price.
 *    Cashier can negotiate down to Minimum Selling Price, but never below Min or above Max.
 *
 * 3. Cost Price is the sole active stored price for products.
 *    All selling prices and margins are calculated dynamically in real-time from
 *    Cost Price + current company pricing settings.
 */

export type PricingMode = 'FIXED' | 'NEGOTIABLE';

export interface PricingSettingsInput {
  pricingMode?: PricingMode | string;
  pricing_mode?: PricingMode | string;
  fixedProfitMargin?: number | string;
  fixed_profit_margin?: number | string;
  fixedProfitAmount?: number | string;
  fixed_profit_amount?: number | string;
  minProfitMargin?: number | string;
  min_profit_margin?: number | string;
  minProfitAmount?: number | string;
  min_profit_amount?: number | string;
  maxProfitMargin?: number | string;
  max_profit_margin?: number | string;
  maxProfitAmount?: number | string;
  max_profit_amount?: number | string;
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
  fixedProfitPercent: number;
  minProfitPercent: number;
  maxProfitPercent: number;
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
 * Centralized master function for all product pricing across the app:
 * POS cart, product details, catalog, barcode stickers, and checkout validation.
 */
export function calculateProductPricing(
  costPrice: number | string | undefined | null,
  settings?: PricingSettingsInput | null
): CalculatedProductPricing {
  const cost = Math.max(0, Number(costPrice) || 0);

  // Normalize pricing mode
  const rawMode = String(settings?.pricingMode || settings?.pricing_mode || 'NEGOTIABLE').toUpperCase();
  const mode: PricingMode = rawMode === 'FIXED' ? 'FIXED' : 'NEGOTIABLE';

  // Fixed profit percent (default 30%)
  const rawFixed = settings?.fixedProfitMargin ?? settings?.fixed_profit_margin ?? 30;
  const fixedProfitPercent = Math.max(0, Number(rawFixed) || 0);

  // Min profit percent (default 15%)
  const rawMin = settings?.minProfitMargin ?? settings?.min_profit_margin ?? 15;
  const minProfitPercent = Math.max(0, Number(rawMin) || 0);

  // Max profit percent (default 30%, ensure >= minProfitPercent)
  const rawMax = settings?.maxProfitMargin ?? settings?.max_profit_margin ?? 30;
  const parsedMax = Math.max(0, Number(rawMax) || 0);
  const maxProfitPercent = Math.max(minProfitPercent, parsedMax);

  const sym = settings?.currencySymbol || settings?.currency_symbol || 'Rs.';

  if (mode === 'FIXED') {
    // Selling Price = Cost Price * (1 + Fixed Profit% / 100)
    const rawPrice = cost > 0 ? cost * (1 + fixedProfitPercent / 100) : 0;
    const finalPrice = roundToCurrency(rawPrice);

    return {
      mode: 'FIXED',
      costPrice: cost,
      minimumSellingPrice: finalPrice,
      maximumSellingPrice: finalPrice,
      initialSellingPrice: finalPrice,
      sellingPrice: finalPrice,
      fixedProfitPercent,
      minProfitPercent,
      maxProfitPercent,
      allowedRangeText: `${sym} ${finalPrice.toLocaleString()}`,
    };
  }

  // NEGOTIABLE MODE:
  // Minimum Selling Price = Cost Price * (1 + Minimum Profit% / 100)
  // Maximum Selling Price = Cost Price * (1 + Maximum Profit% / 100)
  const rawMinPrice = cost > 0 ? cost * (1 + minProfitPercent / 100) : 0;
  const rawMaxPrice = cost > 0 ? cost * (1 + maxProfitPercent / 100) : 0;

  const minimumSellingPrice = roundToCurrency(rawMinPrice);
  const maximumSellingPrice = roundToCurrency(rawMaxPrice);
  const initialSellingPrice = maximumSellingPrice;

  return {
    mode: 'NEGOTIABLE',
    costPrice: cost,
    minimumSellingPrice,
    maximumSellingPrice,
    initialSellingPrice,
    sellingPrice: initialSellingPrice,
    fixedProfitPercent,
    minProfitPercent,
    maxProfitPercent,
    allowedRangeText: `${sym} ${minimumSellingPrice.toLocaleString()} - ${sym} ${maximumSellingPrice.toLocaleString()}`,
  };
}

export interface PricingCalculationOptions {
  lowRangeStep?: 10 | 50;
  midRangeStep?: 100 | 250;
  marginType?: 'percent' | 'fixed';
  roundCost?: boolean;
}

export interface PricingCalculationParams {
  costPrice: number;
  minProfitMargin: number;
  maxProfitMargin: number;
  options?: PricingCalculationOptions;
}

export interface PricingResult {
  // Cost prices
  costPrice: number;
  roundedCostPrice: number;

  // Raw calculated prices before rounding
  rawMinPrice: number;
  rawMaxPrice: number;

  // Final smart-rounded prices (always rounded upward)
  minProfitPrice: number;
  maxProfitPrice: number;

  // Actual realized profit amounts
  actualMinProfit: number;
  actualMaxProfit: number;

  // Actual realized margin percentages
  actualMinMarginPercent: number;
  actualMaxMarginPercent: number;

  // Adaptive rounding steps applied
  costStep: number;
  minPriceStep: number;
  maxPriceStep: number;

  // Margin type used
  marginType: 'percent' | 'fixed';
}

/**
 * Returns the adaptive rounding step for a given price point.
 * Adaptive Scale:
 * - < 1,000:
 *     < 250 -> 10 (or options.lowRangeStep)
 *     250–999 -> 50 (or options.lowRangeStep)
 * - 1,000–4,999 -> 50
 * - 5,000–9,999 -> 100 (or options.midRangeStep)
 * - 10,000–49,999 -> 500
 * - 50,000+ -> 1,000
 */
export function getSmartRoundingStep(
  price: number,
  options?: PricingCalculationOptions
): number {
  const p = Math.max(0, price);
  if (p < 250) {
    return options?.lowRangeStep ?? 10;
  }
  if (p < 1000) {
    return options?.lowRangeStep === 10 ? 10 : 50;
  }
  if (p < 5000) {
    return 50;
  }
  if (p < 10000) {
    return options?.midRangeStep ?? 100;
  }
  if (p < 50000) {
    return 500;
  }
  return 1000;
}

/**
 * Automatically rounds a price UPWARD to the nearest clean price point according to adaptive scale.
 * Never rounds downward.
 */
export function smartRoundUp(
  price: number,
  options?: PricingCalculationOptions
): number {
  if (typeof price !== 'number' || isNaN(price) || price <= 0) {
    return 0;
  }
  const step = getSmartRoundingStep(price, options);
  return Math.ceil(price / step) * step;
}

/**
 * Returns the next valid clean price point strictly greater than the input price.
 * Used when rounding or margin collisions occur to preserve Cost <= Min <= Max.
 */
export function getNextCleanPrice(
  price: number,
  options?: PricingCalculationOptions
): number {
  const current = smartRoundUp(price, options);
  const step = getSmartRoundingStep(current + 1, options);
  return current + step;
}

/**
 * Comprehensive Pricing Calculation:
 * Raw Calculation -> Smart Upward Rounding -> Margin Validation -> Final Price
 */
export function calculateAutomaticPricing(
  params: PricingCalculationParams
): PricingResult {
  const { costPrice, minProfitMargin, maxProfitMargin, options = {} } = params;
  const marginType = options.marginType ?? 'percent';

  const rawCost = Math.max(0, Number(costPrice) || 0);
  const rawMinMargin = Math.max(0, Number(minProfitMargin) || 0);
  // Ensure maxProfitMargin is at least minProfitMargin
  const rawMaxMargin = Math.max(rawMinMargin, Number(maxProfitMargin) || 0);

  // 1. Raw Calculations
  let rawMinPrice = 0;
  let rawMaxPrice = 0;

  if (rawCost > 0) {
    if (marginType === 'fixed') {
      rawMinPrice = rawCost + rawMinMargin;
      rawMaxPrice = rawCost + rawMaxMargin;
    } else {
      rawMinPrice = rawCost * (1 + rawMinMargin / 100);
      rawMaxPrice = rawCost * (1 + rawMaxMargin / 100);
    }
  }

  // 2. Smart Upward Rounding
  const roundedCostPrice = rawCost > 0 ? smartRoundUp(rawCost, options) : 0;
  let finalMinPrice = rawMinPrice > 0 ? smartRoundUp(rawMinPrice, options) : 0;
  let finalMaxPrice = rawMaxPrice > 0 ? smartRoundUp(rawMaxPrice, options) : 0;

  // 3. Margin & Relationship Validation
  // Rule A: Never round downward - final prices must be >= raw prices
  if (finalMinPrice < rawMinPrice) {
    finalMinPrice = smartRoundUp(rawMinPrice, options);
  }
  if (finalMaxPrice < rawMaxPrice) {
    finalMaxPrice = smartRoundUp(rawMaxPrice, options);
  }

  // Rule B: Never allow Minimum Profit Price to fall below CostPrice
  if (rawCost > 0) {
    if (finalMinPrice < rawCost) {
      finalMinPrice = smartRoundUp(rawCost, options);
    }
  }

  // Rule C: Ensure CostPrice <= MinimumProfitPrice <= MaximumProfitPrice
  if (finalMaxPrice < finalMinPrice) {
    finalMaxPrice = finalMinPrice;
  }

  // Rule D: If max margin was configured strictly higher than min margin,
  // ensure finalMaxPrice is at least the next clean price point if rounding collided
  if (rawMaxMargin > rawMinMargin && finalMaxPrice === finalMinPrice && finalMinPrice > 0) {
    finalMaxPrice = getNextCleanPrice(finalMinPrice, options);
  }

  // 4. Recalculate Actual Profit and Margin Percentages after rounding
  const actualMinProfit = rawCost > 0 ? Math.max(0, finalMinPrice - rawCost) : 0;
  const actualMaxProfit = rawCost > 0 ? Math.max(0, finalMaxPrice - rawCost) : 0;

  const actualMinMarginPercent =
    rawCost > 0 ? (actualMinProfit / rawCost) * 100 : 0;
  const actualMaxMarginPercent =
    rawCost > 0 ? (actualMaxProfit / rawCost) * 100 : 0;

  return {
    costPrice: rawCost,
    roundedCostPrice,
    rawMinPrice: Math.round(rawMinPrice * 100) / 100,
    rawMaxPrice: Math.round(rawMaxPrice * 100) / 100,
    minProfitPrice: finalMinPrice,
    maxProfitPrice: finalMaxPrice,
    actualMinProfit: Math.round(actualMinProfit * 100) / 100,
    actualMaxProfit: Math.round(actualMaxProfit * 100) / 100,
    actualMinMarginPercent: Math.round(actualMinMarginPercent * 100) / 100,
    actualMaxMarginPercent: Math.round(actualMaxMarginPercent * 100) / 100,
    costStep: getSmartRoundingStep(rawCost, options),
    minPriceStep: getSmartRoundingStep(rawMinPrice, options),
    maxPriceStep: getSmartRoundingStep(rawMaxPrice, options),
    marginType,
  };
}
