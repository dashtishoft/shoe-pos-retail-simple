// TSPL Command Generator for Thermal Barcode Sticker Printers (TSC, Xprinter, Gprinter, etc.)
import { formatStockPrice, getProductRetailPrice } from '../priceFormat.ts';

export interface TsplStickerOptions {
  widthMm?: number;  // default 50mm
  heightMm?: number; // default 30mm
  gapMm?: number;    // default 2mm
  currencySymbol?: string;
  storeName?: string;
}

export function generateShoeStickerTspl(
  product: any,
  copies: number = 1,
  options: TsplStickerOptions = {}
): Uint8Array {
  const width = options.widthMm || 50;
  const height = options.heightMm || 30;
  const gap = options.gapMm || 2;
  const currency = options.currencySymbol || 'Rs.';
  const store = (options.storeName || 'RETAIL POS').toUpperCase();

  const brand = (product.brandName || product.brand_name || 'Shoes').toUpperCase();
  const article = String(product.article || product.name || '').substring(0, 22);
  const sku = String(product.sku || '').substring(0, 18);
  const barcode = String(product.barcode || sku || '00000000');
  const price = formatStockPrice(getProductRetailPrice(product));
  const rawPolicy = String(
    product.pricingPolicy ||
    product.pricing_mode ||
    product.pricing_policy ||
    'FIXED'
  ).toUpperCase();
  const isFixed = rawPolicy === 'FIXED';
  const pricePrefix = isFixed ? 'Fixed Price :' : 'Price :';

  // TSPL commands in ASCII lines
  // DPI standard is 203 DPI (8 dots per mm) -> 50mm = 400 dots, 30mm = 240 dots
  const commands: string[] = [
    `SIZE ${width} mm, ${height} mm`,
    `GAP ${gap} mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    // Header store name
    `TEXT 20, 15, "2", 0, 1, 1, "${store} - ${brand}"`,
    // Shoe Article
    `TEXT 20, 40, "3", 0, 1, 1, "${article}"`,
    // SKU
    `TEXT 20, 75, "2", 0, 1, 1, "SKU: ${sku}"`,
    // 1D Code 128 Barcode: BARCODE X, Y, "CodeType", height, humanReadable, rotation, narrow, wide, "content"
    `BARCODE 20, 105, "128", 55, 1, 0, 2, 2, "${barcode}"`,
    // Price
    `TEXT 20, 185, "3", 0, 1, 1, "${pricePrefix} ${currency} ${price}"`,
    // Print command
    `PRINT ${Math.max(1, copies)}, 1`,
    ``,
  ];

  const script = commands.join('\r\n');
  return new TextEncoder().encode(script);
}

// Test sticker for label printer
export function generateTestStickerTspl(options: TsplStickerOptions = {}): Uint8Array {
  const width = options.widthMm || 50;
  const height = options.heightMm || 30;
  const gap = options.gapMm || 2;

  const commands: string[] = [
    `SIZE ${width} mm, ${height} mm`,
    `GAP ${gap} mm, 0 mm`,
    `DIRECTION 1`,
    `CLS`,
    `TEXT 20, 20, "3", 0, 1, 1, "TEST STICKER PASS"`,
    `TEXT 20, 55, "2", 0, 1, 1, "50x30mm TSPL Ready"`,
    `BARCODE 20, 85, "128", 55, 1, 0, 2, 2, "TEST-12345"`,
    `TEXT 20, 165, "3", 0, 1, 1, "STATUS: OK"`,
    `PRINT 1, 1`,
    ``,
  ];

  return new TextEncoder().encode(commands.join('\r\n'));
}
