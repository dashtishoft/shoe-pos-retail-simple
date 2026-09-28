// ESC/POS Command Generator for 80mm & 58mm Thermal Receipt Printers
import { formatStockPrice } from '../priceFormat.ts';

export interface EscPosOptions {
  paperWidth?: 80 | 58; // 80mm = ~48 chars per line, 58mm = ~32 chars per line
  autoCut?: boolean;
  openCashDrawer?: boolean;
  currencySymbol?: string;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private cols: number;

  constructor(paperWidth: 80 | 58 = 80) {
    this.cols = paperWidth === 58 ? 32 : 48;
    this.init();
  }

  // Initialize printer
  init(): this {
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  // Set alignment: 0=Left, 1=Center, 2=Right
  align(alignment: 'left' | 'center' | 'right'): this {
    const code = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, code);
    return this;
  }

  // Set bold
  bold(enable: boolean = true): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  // Set double size
  doubleSize(enable: boolean = true): this {
    this.buffer.push(0x1d, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  // Feed and new line
  newLine(count: number = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  // Add plain ASCII text
  text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    for (let i = 0; i < bytes.length; i++) {
      this.buffer.push(bytes[i]);
    }
    return this;
  }

  textLine(str: string): this {
    this.text(str);
    this.newLine();
    return this;
  }

  // Dashed or solid line across the width
  divider(char: string = '-'): this {
    this.align('left');
    this.textLine(char.repeat(this.cols));
    return this;
  }

  // Two columns justified (Left text, Right text)
  justify(left: string, right: string): this {
    this.align('left');
    const spaceCount = Math.max(1, this.cols - left.length - right.length);
    const line = left + ' '.repeat(spaceCount) + right;
    this.textLine(line);
    return this;
  }

  // Table row for items
  itemRow(name: string, qty: string, price: string, total: string): this {
    this.align('left');
    if (this.cols === 32) {
      // 58mm compact layout
      this.textLine(name.substring(0, 32));
      const details = ` ${qty} x ${price}`;
      const spaces = Math.max(1, 32 - details.length - total.length);
      this.textLine(details + ' '.repeat(spaces) + total);
    } else {
      // 80mm layout (48 chars: Name 24, Qty 6, Price 9, Total 9)
      const colName = name.substring(0, 22).padEnd(23, ' ');
      const colQty = qty.padStart(5, ' ') + ' ';
      const colPrice = price.padStart(9, ' ') + ' ';
      const colTotal = total.padStart(9, ' ');
      this.textLine(colName + colQty + colPrice + colTotal);
    }
    return this;
  }

  // Feed and partial cut paper
  cut(): this {
    this.newLine(3);
    this.buffer.push(0x1d, 0x56, 0x41, 0x03);
    return this;
  }

  // Pulse to kick open cash drawer (Pin 2, 25ms pulse)
  pulseCashDrawer(): this {
    this.buffer.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
    return this;
  }

  // Build final Uint8Array
  toBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

// Helper to format full sale invoice in ESC/POS
export function generateSaleEscPos(
  sale: any,
  companySettings: any,
  options: EscPosOptions = {}
): Uint8Array {
  const width = options.paperWidth || 80;
  const builder = new EscPosBuilder(width);

  const currency = options.currencySymbol || companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'Retail POS';
  const storeAddress = companySettings?.address || '';
  const storePhone = companySettings?.phone || '';
  const taxNumber = companySettings?.tax_number || companySettings?.taxNumber || '';
  const footerNote = companySettings?.invoice_footer || companySettings?.invoiceFooter || 'Thank you for shopping with us!';

  // Kick cash drawer first if enabled
  if (options.openCashDrawer) {
    builder.pulseCashDrawer();
  }

  // Header
  builder.align('center').bold(true).doubleSize(true).textLine(storeName);
  builder.bold(false).doubleSize(false);

  if (storeAddress) builder.textLine(storeAddress);
  if (storePhone) builder.textLine(`Phone: ${storePhone}`);
  if (taxNumber) builder.textLine(`Tax ID / STRN: ${taxNumber}`);

  builder.newLine();
  builder.divider('=');

  // Metadata
  builder.align('left');
  builder.justify(`Invoice: ${sale.invoice_number}`, `Date: ${sale.sale_date || ''}`);
  if (sale.cashier_name) builder.textLine(`Cashier: ${sale.cashier_name}`);
  if (sale.customer_name) builder.textLine(`Customer: ${sale.customer_name}`);
  builder.textLine(`Payment: ${sale.payment_method || 'CASH'}`);
  builder.divider('-');

  // Item Table Headers
  if (width === 58) {
    builder.justify('Article', 'Qty x Rate   Total');
  } else {
    builder.textLine('Article                Qty      Rate     Total');
  }
  builder.divider('-');

  // Items
  const items = sale.items || [];
  items.forEach((item: any) => {
    const name = item.article || item.product_name || item.name || 'Shoe';
    const qty = String(item.quantity || 1);
    const rate = formatStockPrice(item.unit_price || 0);
    const total = formatStockPrice(item.subtotal || 0);
    builder.itemRow(name, qty, rate, total);
  });

  builder.divider('-');

  // Totals
  const totalAmount = formatStockPrice(sale.total_amount || 0);
  const subtotal = formatStockPrice(sale.subtotal || sale.total_amount || 0);
  const discount = parseFloat(sale.discount || 0);
  const cashReceived = formatStockPrice(sale.cash_received || sale.total_amount || 0);
  const changeGiven = formatStockPrice(sale.change_given || 0);

  builder.justify('Subtotal:', `${currency} ${subtotal}`);
  if (discount > 0) {
    builder.justify('Discount:', `-${currency} ${formatStockPrice(discount)}`);
  }

  builder.bold(true).doubleSize(true);
  builder.justify('NET TOTAL:', `${currency} ${totalAmount}`);
  builder.bold(false).doubleSize(false);

  builder.justify('Cash Paid:', `${currency} ${cashReceived}`);
  builder.justify('Change Given:', `${currency} ${changeGiven}`);

  builder.divider('=');

  // Footer
  builder.align('center');
  builder.textLine(footerNote);
  builder.textLine('*** PLEASE KEEP RECEIPT FOR EXCHANGES ***');

  // Cut Paper
  if (options.autoCut !== false) {
    builder.cut();
  } else {
    builder.newLine(3);
  }

  return builder.toBytes();
}

// Test receipt for hardware verification
export function generateTestReceiptEscPos(paperWidth: 80 | 58 = 80): Uint8Array {
  const builder = new EscPosBuilder(paperWidth);
  builder.align('center').bold(true).doubleSize(true).textLine('PRINTER TEST PASS');
  builder.bold(false).doubleSize(false);
  builder.divider('=');
  builder.textLine(`Paper Width: ${paperWidth}mm Mode`);
  builder.textLine(`Device: Direct Thermal ESC/POS`);
  builder.textLine(`Timestamp: ${new Date().toLocaleString()}`);
  builder.divider('-');
  builder.align('left');
  builder.justify('Test Item 1', '1 x 1500');
  builder.justify('Test Item 2', '1 x 2500');
  builder.divider('-');
  builder.bold(true).justify('TEST TOTAL:', 'Rs. 4000').bold(false);
  builder.divider('=');
  builder.align('center');
  builder.textLine('Hardware connection verified!');
  builder.cut();
  return builder.toBytes();
}
