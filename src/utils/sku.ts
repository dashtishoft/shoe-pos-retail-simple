/**
 * AUTOMATIC SKU & ARTICLE GENERATION LOGIC
 *
 * Formula:
 * - SKU: [Brand Prefix]-[Article]-[Product ID]
 * - Suggested Article: [Category Abbreviation]-[4-digit padded Product ID] (e.g. SN-0001)
 *
 * Prefix parsing logic:
 * - Brand Prefix: 3-character abbreviation parsed from Brand Name
 * - Category Abbreviation: strictly 2 alphabet characters parsed from Category Name
 *   1. For a single word with 2+ letters: take the first 2 letters (e.g., "Sneakers" -> "SN", "Boots" -> "BO", "Casual" -> "CA")
 *   2. For a single word with 1 letter: pad with "X" to 2 characters (e.g., "S" -> "SX")
 *   3. For two or more words: take the first letter of word 1 + first letter of word 2 (e.g., "Men Shoes" -> "MS", "Sports Shoes" -> "SS")
 *
 * Article:
 * - Mandatory field
 * - Auto-suggests as [Category Abbreviation]-[4-digit padded Product ID] (e.g. SN-0001, BO-0007), fully editable
 *
 * Product ID:
 * - Auto-incrementing, non-reusable integer
 */

/**
 * Parses abbreviation prefix from a name (default 3-character for Brand)
 */
export function parsePrefix(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') {
    return 'GEN';
  }

  // Remove non-alphanumeric characters while preserving word boundaries
  const cleaned = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim();

  // Split into words by whitespace
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 'GEN';
  }

  // Single word
  if (words.length === 1) {
    const word = words[0];
    if (word.length >= 3) {
      return word.slice(0, 3);
    } else {
      return word.padEnd(3, 'X');
    }
  }

  // Two words
  if (words.length === 2) {
    const w1 = words[0];
    const w2 = words[1];
    const firstTwo = w1.slice(0, 2);
    const firstOne = w2.slice(0, 1);
    const combined = firstTwo + firstOne;
    return combined.padEnd(3, 'X');
  }

  // Three or more words
  const prefix = words[0].slice(0, 1) + words[1].slice(0, 1) + words[2].slice(0, 1);
  return prefix.padEnd(3, 'X');
}

export const parseBrandPrefix = parsePrefix;

/**
 * Parses a strictly 2-alphabet abbreviation from Category name.
 * 
 * Rules:
 * - Limited strictly to 2 uppercase alphabet characters (A-Z).
 * - Single word with 2+ letters: first 2 letters (e.g. "Sneakers" -> "SN", "Boots" -> "BO", "Casual" -> "CA")
 * - Single letter word: pad with "X" (e.g. "S" -> "SX")
 * - Two or more words: first letter of word 1 + first letter of word 2 (e.g. "Men Shoes" -> "MS", "Sports Shoes" -> "SS")
 * - Fallback: "CA"
 */
export function parseCategoryPrefix(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') {
    return 'CA';
  }

  // Remove apostrophes, then keep only alphabetic characters (A-Z)
  const cleaned = name
    .toUpperCase()
    .replace(/['’]/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .trim();

  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return 'CA';
  }

  if (words.length === 1) {
    const word = words[0];
    if (word.length >= 2) {
      return word.slice(0, 2);
    }
    return word.padEnd(2, 'X');
  }

  // Two or more words: take first letter of word 1 + first letter of word 2
  const firstLetter = words[0].slice(0, 1);
  const secondLetter = words[1].slice(0, 1);
  const combined = `${firstLetter}${secondLetter}`;

  if (combined.length === 2) {
    return combined;
  }
  return combined.padEnd(2, 'X');
}

/**
 * Generates the suggested Article: [2-alphabet Category Abbreviation]-[4-digit padded Product ID]
 * Adds a hyphen (-) in the middle: Abbreviation + '-' + articleid padded with zeros
 * e.g., Category = "Sneakers" ("SN"), Product ID = 1 -> "SN-0001"
 * e.g., Category = "Boots" ("BO"), Product ID = 7 -> "BO-0007"
 * e.g., Category = "Men Shoes" ("MS"), Product ID = 24 -> "MS-0024"
 */
export function generateSuggestedArticle(
  categoryPrefixOrName: string | undefined | null,
  productId: number | string | undefined | null
): string {
  const prefix = parseCategoryPrefix(categoryPrefixOrName);
  const id = parseInt(String(productId ?? '').replace(/\D/g, ''), 10) || 1;
  const paddedId = String(id).padStart(4, '0');
  return `${prefix}-${paddedId}`;
}

/**
 * Generates the automated SKU: [Brand Prefix]-[Article Number]-[Size/Variant]
 * Format: ${brandCode}-${articleNumber}-${size} (e.g., DAF-SF-0012-42)
 */
export function generateSku(
  brandPrefixOrName: string | undefined | null,
  article: string | undefined | null,
  sizeOrVariant?: number | string | null
): string {
  const brandCode = parseBrandPrefix(brandPrefixOrName);
  const articleNumber = (article || 'SF-0001').toUpperCase().trim();
  const rawSize = sizeOrVariant !== undefined && sizeOrVariant !== null ? String(sizeOrVariant).trim().toUpperCase() : '';
  const size = rawSize || '42';

  return `${brandCode}-${articleNumber}-${size}`;
}

export interface SkuComponents {
  brandPrefix: string;
  categoryPrefix?: string;
  article: string;
  size: string;
  productId: number;
  sku: string;
  formula: string;
}

/**
 * Helper to build all components together.
 * Supports:
 * - buildSkuInfo(brandName, categoryName, articleInput, sizeOrProductIdInput)
 */
export function buildSkuInfo(
  brandName: string | undefined | null,
  categoryOrArticle: string | undefined | null,
  articleOrSize?: number | string | null,
  sizeOrProductIdInput?: number | string | undefined | null
): SkuComponents {
  const brandPrefix = parseBrandPrefix(brandName);

  let categoryPrefix = 'CA';
  let article = '';
  let size = '42';
  let productId = 1;

  if (sizeOrProductIdInput !== undefined && sizeOrProductIdInput !== null) {
    categoryPrefix = parseCategoryPrefix(categoryOrArticle);
    const rawVal = String(sizeOrProductIdInput).trim();
    if (/^\d{1,2}$/.test(rawVal)) {
      size = rawVal;
    } else {
      productId = parseInt(rawVal.replace(/\D/g, ''), 10) || 1;
    }
    const artInput = typeof articleOrSize === 'string' ? articleOrSize : '';
    article = artInput && artInput.trim()
      ? artInput.trim().toUpperCase()
      : generateSuggestedArticle(categoryPrefix, productId);
  } else if (
    typeof articleOrSize === 'number' ||
    (typeof articleOrSize === 'string' && /^\d+$/.test(articleOrSize.trim()))
  ) {
    categoryPrefix = parseCategoryPrefix(categoryOrArticle);
    const num = parseInt(String(articleOrSize).replace(/\D/g, ''), 10) || 1;
    if (num >= 20 && num <= 50) {
      size = String(num);
    } else {
      productId = num;
    }
    article = generateSuggestedArticle(categoryPrefix, productId);
  } else {
    article = categoryOrArticle && categoryOrArticle.trim()
      ? categoryOrArticle.trim().toUpperCase()
      : generateSuggestedArticle('CA', 1);
    if (typeof articleOrSize === 'string' && articleOrSize.trim()) {
      size = articleOrSize.trim().toUpperCase();
    }
  }

  const sku = generateSku(brandPrefix, article, size);

  return {
    brandPrefix,
    categoryPrefix,
    article,
    size,
    productId,
    sku,
    formula: `[${brandPrefix}]-[${article}]-[${size}]`,
  };
}
