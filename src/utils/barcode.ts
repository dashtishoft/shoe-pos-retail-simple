/**
 * AUTOMATIC BARCODE LOGIC (EAN-13 STANDARD)
 *
 * Requirements:
 * 1. Remove Product Variants Completely:
 *    - Each product has exactly: 1 Product, 1 SKU, 1 Barcode.
 *    - No color code, no size code, no variant code.
 * 2. Barcode Prefix Must Come From Settings:
 *    - Prefix must be exactly 7 digits.
 *    - Read the prefix from Settings (company_settings.barcode_prefix).
 *    - Do NOT hardcode the prefix, do NOT generate a new prefix automatically.
 *    - The prefix is placed directly at the beginning of the barcode.
 *    - If prefix is not 7 digits, fail validation.
 * 3. 5-Digit Product ID:
 *    - Product ID portion must ALWAYS be exactly 5 digits (padded with leading zeros, e.g. 00001).
 *    - If Product ID > 99999, show a clear validation error.
 * 4. Check Digit:
 *    - 13th digit is calculated using standard EAN-13 / GTIN-13 Modulo-10 algorithm.
 *    - Formula: 13-Digit Barcode = [Prefix (7)] + [Padded Product ID (5)] + [Check Digit (1)] = 13 digits.
 */

/**
 * Validates whether the given string is a valid 7-digit numeric prefix.
 */
export function validateBarcodePrefix(prefix: string | undefined | null): { isValid: boolean; error?: string } {
  const clean = String(prefix || '').replace(/\D/g, '');
  if (clean.length !== 7) {
    return {
      isValid: false,
      error: `Barcode prefix must be exactly 7 numeric digits (currently ${clean.length} digits). Please configure a 7-digit prefix in Settings.`,
    };
  }
  return { isValid: true };
}

/**
 * Sanitizes and guarantees a 7-digit numeric prefix from Settings.
 */
export function sanitizePrefix(prefix: string | undefined | null, defaultPrefix: string = '0108923'): string {
  const digits = String(prefix || '').replace(/\D/g, '');
  if (digits.length === 7) return digits;
  if (digits.length > 7) return digits.slice(0, 7);
  return (digits + defaultPrefix).slice(0, 7);
}

/**
 * Formats a Product ID into strictly 5 numeric digits with leading zeros (00001 - 99999).
 * If product ID > 99999, throws an explicit validation error.
 */
export function formatProductId(productId: number | string): string {
  const parsed = parseInt(String(productId).replace(/\D/g, ''), 10);
  if (isNaN(parsed) || parsed < 1) {
    return '00001';
  }
  if (parsed > 99999) {
    throw new Error(`Product ID #${parsed} exceeds 99,999 limit for 5-digit barcode encoding.`);
  }
  return String(parsed).padStart(5, '0');
}

/**
 * Calculates standard EAN-13 Modulo-10 check digit for a 12-digit numeric string.
 *
 * Algorithm:
 * 1. Sum the digits at odd positions (1st, 3rd, 5th, 7th, 9th, 11th - indices 0, 2, 4, 6, 8, 10), weight = 1
 * 2. Sum the digits at even positions (2nd, 4th, 6th, 8th, 10th, 12th - indices 1, 3, 5, 7, 9, 11), weight = 3
 * 3. Total = oddSum + (evenSum * 3)
 * 4. Remainder = Total % 10
 * 5. Check Digit = (10 - Remainder) % 10
 */
export function calculateEan13CheckDigit(twelveDigits: string): number {
  const cleanDigits = String(twelveDigits).replace(/\D/g, '').slice(0, 12);
  if (cleanDigits.length !== 12) {
    throw new Error(`EAN-13 check digit requires exactly 12 numeric digits, got "${twelveDigits}" (${cleanDigits.length} digits).`);
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(cleanDigits[i], 10);
    // Index 0 is 1st position (odd, weight 1), Index 1 is 2nd position (even, weight 3)
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const remainder = sum % 10;
  return (10 - remainder) % 10;
}

export interface Ean13BarcodeResult {
  barcode: string;           // 13-digit full EAN-13 barcode
  prefix: string;            // 7-digit prefix from Settings
  paddedProductId: string;   // 5-digit zero-padded product ID (e.g. 00001, 00012, 00111)
  checkDigit: number;        // 1-digit Modulo-10 check digit
  formula: string;           // Visual breakdown: e.g. "0108923-00001-8"
}

/**
 * Generates an automatic 13-digit EAN-13 barcode:
 * Formula: [Prefix from Settings (7)] + [Padded Product ID (5)] + [Check Digit (1)] = 13 Digits
 *
 * @param prefix 7-digit prefix from Settings
 * @param productId Product ID integer (1 to 99999)
 */
export function generateEan13Barcode(
  prefix: string | undefined | null,
  productId: number | string
): Ean13BarcodeResult {
  const cleanPrefix = String(prefix || '').replace(/\D/g, '');
  if (cleanPrefix.length !== 7) {
    throw new Error(
      `Barcode prefix must be exactly 7 digits. Got "${cleanPrefix}" (${cleanPrefix.length} digits). Please configure your 7-digit prefix in Settings.`
    );
  }

  const prodIdNum = parseInt(String(productId).replace(/\D/g, ''), 10);
  if (isNaN(prodIdNum) || prodIdNum < 1) {
    throw new Error('Valid positive Product ID is required to generate barcode.');
  }
  if (prodIdNum > 99999) {
    throw new Error(
      `Product ID #${prodIdNum} exceeds 99,999. The system supports 5-digit product barcodes up to ID 99999.`
    );
  }

  const paddedProductId = String(prodIdNum).padStart(5, '0');
  const first12 = `${cleanPrefix}${paddedProductId}`;
  const checkDigit = calculateEan13CheckDigit(first12);
  const barcode = `${first12}${checkDigit}`;

  return {
    barcode,
    prefix: cleanPrefix,
    paddedProductId,
    checkDigit,
    formula: `${cleanPrefix}-${paddedProductId}-${checkDigit}`,
  };
}

/**
 * Validates whether a barcode is a valid 13-digit EAN-13 with matching Modulo-10 check digit.
 */
export function validateEan13(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') return false;
  const cleaned = barcode.trim().replace(/\D/g, '');
  if (cleaned.length !== 13) return false;

  const first12 = cleaned.slice(0, 12);
  const checkDigit = parseInt(cleaned[12], 10);
  try {
    return calculateEan13CheckDigit(first12) === checkDigit;
  } catch {
    return false;
  }
}

/**
 * Parses an EAN-13 barcode into its constituent components:
 * Prefix (7), Product ID (5), Check Digit (1).
 */
export function parseEan13Barcode(barcode: string): {
  isValid: boolean;
  prefix: string;
  productId: number;
  paddedProductId: string;
  checkDigit: number;
} | null {
  if (!barcode) return null;
  const clean = String(barcode).trim().replace(/\D/g, '');
  if (clean.length !== 13) return null;

  const prefix = clean.slice(0, 7);
  const paddedProductId = clean.slice(7, 12);
  const checkDigit = parseInt(clean[12], 10);
  const isValid = validateEan13(clean);

  return {
    isValid,
    prefix,
    productId: parseInt(paddedProductId, 10),
    paddedProductId,
    checkDigit,
  };
}

/**
 * Calculates standard UPC-A Modulo-10 check digit for an 11-digit numeric string.
 */
export function calculateUpcACheckDigit(elevenDigits: string): number {
  const clean = String(elevenDigits).replace(/\D/g, '').slice(0, 11);
  if (clean.length !== 11) {
    throw new Error(`UPC-A check digit requires 11 digits, got ${clean.length}.`);
  }
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(clean[i], 10);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  const remainder = sum % 10;
  return (10 - remainder) % 10;
}

/**
 * Calculates standard EAN-8 Modulo-10 check digit for a 7-digit numeric string.
 */
export function calculateEan8CheckDigit(sevenDigits: string): number {
  const clean = String(sevenDigits).replace(/\D/g, '').slice(0, 7);
  if (clean.length !== 7) {
    throw new Error(`EAN-8 check digit requires 7 digits, got ${clean.length}.`);
  }
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(clean[i], 10);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }
  const remainder = sum % 10;
  return (10 - remainder) % 10;
}

export interface BarcodeAnalysis {
  isValid: boolean;
  standard: 'STORE_EAN13' | 'EAN13' | 'UPCA' | 'EAN8' | 'CODE128' | 'INVALID';
  standardLabel: string;
  expectedCheckDigit?: number;
  actualCheckDigit?: number;
  suggestedFix?: string;
  error?: string;
}

/**
 * Analyzes any scanned or entered barcode string, identifies standard,
 * calculates expected checksums for retail codes, and checks validity.
 */
export function analyzeBarcode(barcodeRaw: string, storePrefix?: string): BarcodeAnalysis {
  const raw = String(barcodeRaw || '').trim();
  if (!raw) {
    return {
      isValid: false,
      standard: 'INVALID',
      standardLabel: 'Empty Barcode',
      error: 'Barcode cannot be blank.',
    };
  }

  if (raw.length < 3 || raw.length > 64) {
    return {
      isValid: false,
      standard: 'INVALID',
      standardLabel: 'Invalid Length',
      error: `Barcode length must be 3 to 64 characters (currently ${raw.length}).`,
    };
  }

  if (/[\r\n\t]/.test(raw)) {
    return {
      isValid: false,
      standard: 'INVALID',
      standardLabel: 'Invalid Format',
      error: 'Barcode contains whitespace or newline characters.',
    };
  }

  const cleanDigits = raw.replace(/\D/g, '');
  const isPureNumeric = cleanDigits.length === raw.length;
  const cleanPrefix = storePrefix ? String(storePrefix).replace(/\D/g, '') : '';

  // 13-digit EAN-13
  if (isPureNumeric && raw.length === 13) {
    const first12 = raw.slice(0, 12);
    const actual = parseInt(raw[12], 10);
    const expected = calculateEan13CheckDigit(first12);
    const matches = actual === expected;
    const isStore = cleanPrefix && raw.startsWith(cleanPrefix);

    if (matches) {
      return {
        isValid: true,
        standard: isStore ? 'STORE_EAN13' : 'EAN13',
        standardLabel: isStore ? `Store Standard EAN-13 (${cleanPrefix})` : 'International EAN-13 (Standard Retail)',
        expectedCheckDigit: expected,
        actualCheckDigit: actual,
      };
    } else {
      const fixedCode = `${first12}${expected}`;
      return {
        isValid: false,
        standard: 'EAN13',
        standardLabel: 'EAN-13 Check Digit Mismatch',
        expectedCheckDigit: expected,
        actualCheckDigit: actual,
        suggestedFix: fixedCode,
        error: `Invalid EAN-13 check digit: Expected "${expected}", but got "${actual}".`,
      };
    }
  }

  // 12-digit UPC-A (Standard US / Imported boxes)
  if (isPureNumeric && raw.length === 12) {
    const first11 = raw.slice(0, 11);
    const actual = parseInt(raw[11], 10);
    const expected = calculateUpcACheckDigit(first11);
    const matches = actual === expected;

    if (matches) {
      return {
        isValid: true,
        standard: 'UPCA',
        standardLabel: 'UPC-A (12-Digit Retail Standard)',
        expectedCheckDigit: expected,
        actualCheckDigit: actual,
      };
    } else {
      const fixedCode = `${first11}${expected}`;
      return {
        isValid: false,
        standard: 'UPCA',
        standardLabel: 'UPC-A Check Digit Mismatch',
        expectedCheckDigit: expected,
        actualCheckDigit: actual,
        suggestedFix: fixedCode,
        error: `Invalid UPC-A check digit: Expected "${expected}", but got "${actual}".`,
      };
    }
  }

  // 8-digit EAN-8
  if (isPureNumeric && raw.length === 8) {
    const first7 = raw.slice(0, 7);
    const actual = parseInt(raw[7], 10);
    const expected = calculateEan8CheckDigit(first7);
    const matches = actual === expected;

    if (matches) {
      return {
        isValid: true,
        standard: 'EAN8',
        standardLabel: 'EAN-8 (Compact Retail Barcode)',
        expectedCheckDigit: expected,
        actualCheckDigit: actual,
      };
    } else {
      const fixedCode = `${first7}${expected}`;
      return {
        isValid: false,
        standard: 'EAN8',
        standardLabel: 'EAN-8 Check Digit Mismatch',
        expectedCheckDigit: expected,
        actualCheckDigit: actual,
        suggestedFix: fixedCode,
        error: `Invalid EAN-8 check digit: Expected "${expected}", but got "${actual}".`,
      };
    }
  }

  // Code-128 / Alphanumeric manufacturer box code
  if (/^[A-Za-z0-9_\-\.\:\/\#\s]+$/.test(raw)) {
    return {
      isValid: true,
      standard: 'CODE128',
      standardLabel: 'Manufacturer / Box Code (Code-128)',
    };
  }

  return {
    isValid: false,
    standard: 'INVALID',
    standardLabel: 'Invalid Characters',
    error: 'Barcode contains unsupported special characters.',
  };
}

