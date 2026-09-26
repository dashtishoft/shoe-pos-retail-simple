import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { formatStockPrice, getProductRetailPrice } from './priceFormat.ts';

// Off-screen barcode image generator using JsBarcode on HTML5 canvas
function generateBarcodeDataUrl(value: string): string | null {
  try {
    const clean = String(value).trim();
    const isEan13 = /^\d{13}$/.test(clean);
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, clean, {
      format: isEan13 ? 'EAN13' : 'CODE128',
      width: 2,
      height: 45,
      displayValue: true,
      fontSize: 12,
      margin: 5,
      background: '#ffffff',
      lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
  } catch (e) {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, String(value).trim(), {
        format: 'CODE128',
        width: 2,
        height: 45,
        displayValue: true,
        fontSize: 12,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000',
      });
      return canvas.toDataURL('image/png');
    } catch {
      console.warn('Failed to generate barcode data URL:', e);
      return null;
    }
  }
}

// 1. Export Customer Sale Invoice as PDF (Pure vector, NO html2canvas, NO oklch errors)
export function exportSaleToPdf(
  sale: any,
  companySettings: any,
  format: 'thermal' | 'a4' = 'thermal'
): boolean {
  try {
    const storeName =
      companySettings?.name ||
      companySettings?.company_name ||
      companySettings?.companyName ||
      'Retail Store';
    const storeAddress = companySettings?.address || '';
    const storePhone = companySettings?.phone || '';
    const taxNumber = companySettings?.tax_number || companySettings?.taxNumber || '';
    const footerNote = companySettings?.invoice_footer || companySettings?.invoiceFooter || 'Thank you for your visit!';
    const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

    const items = sale.items || [];
    const totalAmount = formatStockPrice(sale.total_amount || 0);
    const subtotal = formatStockPrice(sale.subtotal || sale.total_amount || 0);
    const discount = parseFloat(sale.discount || 0);
    const cashReceived = formatStockPrice(sale.cash_received || sale.total_amount || 0);
    const changeGiven = formatStockPrice(sale.change_given || 0);

    if (format === 'thermal') {
      // 80mm roll width. Dynamic height based on number of items
      const estimatedHeight = Math.max(140, 100 + items.length * 9);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, estimatedHeight],
      });

      let y = 10;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.text(storeName, 40, y, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);

      if (storeAddress) {
        y += 4;
        pdf.text(storeAddress, 40, y, { align: 'center' });
      }
      if (storePhone) {
        y += 3.5;
        pdf.text(`Tel: ${storePhone}`, 40, y, { align: 'center' });
      }
      if (taxNumber) {
        y += 3.5;
        pdf.text(`STRN / Tax ID: ${taxNumber}`, 40, y, { align: 'center' });
      }

      // Divider
      y += 4;
      pdf.setLineWidth(0.2);
      pdf.setLineDashPattern([1, 1], 0);
      pdf.line(5, y, 75, y);
      pdf.setLineDashPattern([], 0);

      // Metadata
      y += 4.5;
      pdf.text(`Invoice: ${sale.invoice_number}`, 5, y);
      pdf.text(`Date: ${sale.sale_date || ''}`, 75, y, { align: 'right' });

      y += 3.5;
      pdf.text(`Cashier: ${sale.cashier_name || 'Counter'}`, 5, y);
      pdf.text(`Pay: ${sale.payment_method || 'CASH'}`, 75, y, { align: 'right' });

      if (sale.customer_name) {
        y += 3.5;
        pdf.text(`Customer: ${sale.customer_name}`, 5, y);
      }

      // Items Table Header
      y += 4.5;
      pdf.setLineDashPattern([1, 1], 0);
      pdf.line(5, y, 75, y);
      pdf.setLineDashPattern([], 0);

      y += 3.5;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Item Description', 5, y);
      pdf.text('Qty', 48, y, { align: 'center' });
      pdf.text('Total', 75, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');

      y += 2;
      pdf.setLineDashPattern([1, 1], 0);
      pdf.line(5, y, 75, y);
      pdf.setLineDashPattern([], 0);

      // Items List
      items.forEach((item: any) => {
        y += 4.5;
        const name = (item.article || item.product_name || item.name || 'Shoe').substring(0, 24);
        const qty = String(item.quantity || 1);
        const total = `${currency} ${formatStockPrice(item.subtotal)}`;

        pdf.setFont('helvetica', 'bold');
        pdf.text(name, 5, y);
        pdf.setFont('helvetica', 'normal');
        pdf.text(qty, 48, y, { align: 'center' });
        pdf.text(total, 75, y, { align: 'right' });

        y += 3;
        const unitRate = `@ ${currency} ${formatStockPrice(item.unit_price)}`;
        pdf.setFontSize(7);
        pdf.setTextColor(100, 100, 100);
        pdf.text(unitRate, 5, y);
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(8);
      });

      // Totals
      y += 4;
      pdf.setLineDashPattern([1, 1], 0);
      pdf.line(5, y, 75, y);
      pdf.setLineDashPattern([], 0);

      y += 4;
      pdf.text('Subtotal:', 5, y);
      pdf.text(`${currency} ${subtotal}`, 75, y, { align: 'right' });

      if (discount > 0) {
        y += 3.5;
        pdf.text('Discount:', 5, y);
        pdf.text(`-${currency} ${formatStockPrice(discount)}`, 75, y, { align: 'right' });
      }

      y += 4.5;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('TOTAL PAYABLE:', 5, y);
      pdf.text(`${currency} ${totalAmount}`, 75, y, { align: 'right' });
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');

      y += 4;
      pdf.text('Cash Received:', 5, y);
      pdf.text(`${currency} ${cashReceived}`, 75, y, { align: 'right' });

      y += 3.5;
      pdf.text('Change Given:', 5, y);
      pdf.text(`${currency} ${changeGiven}`, 75, y, { align: 'right' });

      // Barcode
      y += 5;
      const barcodeData = generateBarcodeDataUrl(sale.invoice_number);
      if (barcodeData) {
        pdf.addImage(barcodeData, 'PNG', 12, y, 56, 16);
        y += 18;
      }

      // Footer
      pdf.setFontSize(7);
      pdf.text(footerNote, 40, y, { align: 'center' });
      y += 3;
      pdf.text('*** PLEASE KEEP RECEIPT FOR EXCHANGES ***', 40, y, { align: 'center' });

      pdf.save(`Invoice-${sale.invoice_number}.pdf`);
      return true;
    } else {
      // Standard A4 Layout
      const pdf = new jsPDF('p', 'mm', 'a4');
      let y = 20;

      // Header
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text(storeName, 20, y);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      if (storeAddress) {
        y += 5;
        pdf.text(storeAddress, 20, y);
      }
      if (storePhone) {
        y += 4;
        pdf.text(`Phone: ${storePhone}`, 20, y);
      }
      if (taxNumber) {
        y += 4;
        pdf.text(`STRN / Tax ID: ${taxNumber}`, 20, y);
      }

      // Title Right
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text('TAX INVOICE', 190, 20, { align: 'right' });
      pdf.setFontSize(10);
      pdf.text(sale.invoice_number, 190, 26, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Date: ${sale.sale_date || ''}`, 190, 31, { align: 'right' });

      // Divider
      y += 8;
      pdf.setLineWidth(0.4);
      pdf.line(20, y, 190, y);

      // Customer & Cashier info
      y += 8;
      pdf.setFont('helvetica', 'bold');
      pdf.text('BILLED TO:', 20, y);
      pdf.text('PAYMENT DETAILS:', 130, y);
      pdf.setFont('helvetica', 'normal');

      y += 5;
      pdf.text(sale.customer_name || 'Walk-in Customer', 20, y);
      pdf.text(`Method: ${sale.payment_method || 'CASH'}`, 130, y);

      if (sale.customer_phone) {
        y += 4;
        pdf.text(`Contact: ${sale.customer_phone}`, 20, y);
        pdf.text(`Cashier: ${sale.cashier_name || 'Counter'}`, 130, y);
      }

      // Items Table
      y += 10;
      pdf.setFillColor(245, 245, 245);
      pdf.rect(20, y - 4, 170, 7, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.text('#', 22, y);
      pdf.text('Article', 30, y);
      pdf.text('Qty', 110, y, { align: 'center' });
      pdf.text('Unit Price', 140, y, { align: 'right' });
      pdf.text('Total Amount', 188, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');

      items.forEach((item: any, idx: number) => {
        y += 7;
        const name = item.article || item.product_name || item.name || 'Shoe';
        const qty = String(item.quantity || 1);
        const rate = `${currency} ${formatStockPrice(item.unit_price)}`;
        const total = `${currency} ${formatStockPrice(item.subtotal)}`;

        pdf.text(String(idx + 1), 22, y);
        pdf.text(name, 30, y);
        pdf.text(qty, 110, y, { align: 'center' });
        pdf.text(rate, 140, y, { align: 'right' });
        pdf.text(total, 188, y, { align: 'right' });
        pdf.setDrawColor(230, 230, 230);
        pdf.line(20, y + 2, 190, y + 2);
      });

      // Totals Box
      y += 14;
      pdf.text('Subtotal:', 140, y, { align: 'right' });
      pdf.text(`${currency} ${subtotal}`, 188, y, { align: 'right' });

      if (discount > 0) {
        y += 6;
        pdf.text('Discount:', 140, y, { align: 'right' });
        pdf.text(`-${currency} ${formatStockPrice(discount)}`, 188, y, { align: 'right' });
      }

      y += 7;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('NET PAYABLE:', 140, y, { align: 'right' });
      pdf.text(`${currency} ${totalAmount}`, 188, y, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      // Barcode at footer
      y += 20;
      const barcodeData = generateBarcodeDataUrl(sale.invoice_number);
      if (barcodeData) {
        pdf.addImage(barcodeData, 'PNG', 20, y, 60, 18);
      }
      pdf.text(footerNote, 20, y + 23);

      pdf.save(`Tax-Invoice-${sale.invoice_number}.pdf`);
      return true;
    }
  } catch (err) {
    console.error('Vector PDF generation failed:', err);
    throw err;
  }
}

export interface StickerCustomOptions {
  showStore?: boolean;
  showBrand?: boolean;
  showCategory?: boolean;
  showArticle?: boolean;
  showSize?: boolean;
  showSku?: boolean;
  showPrice?: boolean;
  showBarcodeText?: boolean;
  labelSize?: '50x30' | '40x25' | '60x40';
}

// 2. Export Stickers as PDF (Pure vector, thermal rolls: 50x30mm, 40x25mm, or 60x40mm)
export function exportStickersToPdf(
  product: any,
  copies: number,
  companySettings: any,
  options: StickerCustomOptions = {}
): boolean {
  try {
    const store = (
      companySettings?.name ||
      companySettings?.company_name ||
      companySettings?.companyName ||
      'Retail Store'
    ).toUpperCase();
    const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
    const brand = (product.brandName || product.brand_name || '').toUpperCase();
    const category = (product.categoryName || product.category_name || '').toUpperCase();
    const name = String(product.article || product.name || '').substring(0, 26);
    const size = product.size ? String(product.size).trim() : '';
    const sku = String(product.sku || '').substring(0, 18);
    const barcode = String(product.barcode || sku);
    const price = formatStockPrice(getProductRetailPrice(product, companySettings));

    const showStore = options.showStore !== false;
    const showBrand = options.showBrand !== false;
    const showCategory = options.showCategory !== false;
    const showArticle = options.showArticle !== false;
    const showSize = options.showSize !== false;
    const showSku = options.showSku !== false;
    const showPrice = options.showPrice !== false;
    const labelSize = options.labelSize || '50x30';

    let width = 50;
    let height = 30;
    if (labelSize === '40x25') {
      width = 40;
      height = 25;
    } else if (labelSize === '60x40') {
      width = 60;
      height = 40;
    }

    const pdf = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: [height, width],
    });

    const barcodeData = generateBarcodeDataUrl(barcode);
    const centerX = width / 2;

    for (let i = 0; i < copies; i++) {
      if (i > 0) pdf.addPage([height, width], 'l');

      let currentY = labelSize === '40x25' ? 3.5 : 4;

      // Top line: Store, Brand, Category
      const topHeaderParts = [];
      if (showStore) topHeaderParts.push(store);
      if (showBrand && brand) topHeaderParts.push(brand);
      if (showCategory && category && topHeaderParts.length < 2) topHeaderParts.push(category);

      if (topHeaderParts.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(labelSize === '40x25' ? 5.5 : 6.5);
        pdf.text(topHeaderParts.join(' • '), centerX, currentY, { align: 'center' });
        currentY += labelSize === '40x25' ? 3.2 : 4;
      }

      // Article / Product Name
      if (showArticle) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(labelSize === '40x25' ? 6.5 : 7.5);
        pdf.text(name, centerX, currentY, { align: 'center' });
        currentY += labelSize === '40x25' ? 3 : 3.5;
      }

      // SKU and/or Size
      const subInfoParts = [];
      if (showSku) subInfoParts.push(`SKU: ${sku}`);
      if (showSize && size) subInfoParts.push(`SIZE: ${size}`);

      if (subInfoParts.length > 0) {
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(labelSize === '40x25' ? 5.5 : 6);
        pdf.text(subInfoParts.join(' | '), centerX, currentY, { align: 'center' });
        currentY += labelSize === '40x25' ? 2 : 2.5;
      }

      // Barcode
      if (barcodeData) {
        const barcodeW = labelSize === '40x25' ? 32 : labelSize === '60x40' ? 48 : 38;
        const barcodeH = labelSize === '40x25' ? 8 : labelSize === '60x40' ? 14 : 10.5;
        const barcodeX = (width - barcodeW) / 2;
        pdf.addImage(barcodeData, 'PNG', barcodeX, currentY, barcodeW, barcodeH);
        currentY += barcodeH + (labelSize === '40x25' ? 2.5 : 3.5);
      }

      // Price
      if (showPrice) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(labelSize === '40x25' ? 6.5 : 8);
        pdf.text(`PRICE: ${currency} ${price}`, centerX, currentY, { align: 'center' });
      }
    }

    pdf.save(`Stickers-${sku || 'barcode'}.pdf`);
    return true;
  } catch (err) {
    console.error('Stickers PDF failed:', err);
    throw err;
  }
}

// 2b. Export Batch Stickers as PDF (Roll 50x30, Roll 60x40, or A4 24-up sheet)
export function exportBatchStickersToPdf(
  items: Array<{ product: any; copies: number }>,
  companySettings: any,
  labelFormat: 'roll_50x30' | 'roll_60x40' | 'a4_sheet' = 'roll_50x30',
  options: {
    showStore?: boolean;
    showBrand?: boolean;
    showArticle?: boolean;
    showSku?: boolean;
    showPrice?: boolean;
  } = {}
): boolean {
  try {
    const store = (
      companySettings?.name ||
      companySettings?.company_name ||
      companySettings?.companyName ||
      'Retail Store'
    ).toUpperCase();
    const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

    const showStore = options.showStore !== false;
    const showBrand = options.showBrand !== false;
    const showArticle = options.showArticle !== false;
    const showSku = options.showSku !== false;
    const showPrice = options.showPrice !== false;

    // Flatten items by copies
    const flattenedList: any[] = [];
    for (const item of items) {
      const copies = Math.max(1, item.copies || 1);
      for (let c = 0; c < copies; c++) {
        flattenedList.push(item.product);
      }
    }

    if (flattenedList.length === 0) return false;

    if (labelFormat === 'a4_sheet') {
      // Standard A4 Sticker Sheet: 3 columns x 8 rows = 24 labels per page
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const cols = 3;
      const rows = 8;
      const labelsPerPage = cols * rows; // 24
      const labelWidth = 63.5;
      const labelHeight = 33.9;
      const marginLeft = 7.5;
      const marginTop = 12.5;
      const gapX = 2.5;
      const gapY = 0;

      let currentPage = 0;

      flattenedList.forEach((prod, idx) => {
        const pageIdx = Math.floor(idx / labelsPerPage);
        if (pageIdx > currentPage) {
          pdf.addPage('a4', 'p');
          currentPage = pageIdx;
        }

        const slotOnPage = idx % labelsPerPage;
        const col = slotOnPage % cols;
        const row = Math.floor(slotOnPage / cols);

        const x = marginLeft + col * (labelWidth + gapX);
        const y = marginTop + row * (labelHeight + gapY);

        const brand = (prod.brandName || prod.brand_name || 'Shoes').toUpperCase();
        const name = String(prod.article || prod.name || '').substring(0, 22);
        const sku = String(prod.sku || '').substring(0, 18);
        const barcode = String(prod.barcode || sku);
        const price = formatStockPrice(getProductRetailPrice(prod, companySettings));
        const barcodeData = generateBarcodeDataUrl(barcode);

        const centerX = x + labelWidth / 2;

        let curY = y + 4.5;
        if (showStore || showBrand) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(6.5);
          const headerTxt = [showStore ? store : '', showBrand ? brand : ''].filter(Boolean).join(' • ');
          pdf.text(headerTxt, centerX, curY, { align: 'center' });
          curY += 3.5;
        }

        if (showArticle) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          pdf.text(name, centerX, curY, { align: 'center' });
          curY += 3.5;
        }

        if (showSku) {
          pdf.setFont('courier', 'bold');
          pdf.setFontSize(7);
          pdf.text(`SKU: ${sku}`, centerX, curY, { align: 'center' });
          curY += 1.5;
        }

        if (barcodeData) {
          pdf.addImage(barcodeData, 'PNG', x + 5, curY, labelWidth - 10, 12);
          curY += 13.5;
        }

        if (showPrice) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text(`PRICE: ${currency} ${price}`, centerX, curY, { align: 'center' });
        }
      });

      pdf.save(`Barcode-Labels-A4-${new Date().toISOString().slice(0, 10)}.pdf`);
      return true;
    } else {
      // Thermal Roll Label: 50x30mm or 60x40mm
      const is60x40 = labelFormat === 'roll_60x40';
      const width = is60x40 ? 60 : 50;
      const height = is60x40 ? 40 : 30;
      const centerX = width / 2;

      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: [height, width],
      });

      flattenedList.forEach((prod, idx) => {
        if (idx > 0) {
          pdf.addPage([height, width], 'l');
        }

        const brand = (prod.brandName || prod.brand_name || 'Shoes').toUpperCase();
        const name = String(prod.article || prod.name || '').substring(0, 24);
        const sku = String(prod.sku || '').substring(0, 18);
        const barcode = String(prod.barcode || sku);
        const price = formatStockPrice(getProductRetailPrice(prod, companySettings));
        const barcodeData = generateBarcodeDataUrl(barcode);

        let curY = 4;
        if (showStore || showBrand) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(is60x40 ? 8 : 7);
          const headerTxt = [showStore ? store : '', showBrand ? brand : ''].filter(Boolean).join(' • ');
          pdf.text(headerTxt, centerX, curY, { align: 'center' });
          curY += 4;
        }

        if (showArticle) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(is60x40 ? 9 : 8);
          pdf.text(name, centerX, curY, { align: 'center' });
          curY += 3.5;
        }

        if (showSku) {
          pdf.setFont('courier', 'bold');
          pdf.setFontSize(is60x40 ? 7.5 : 6.5);
          pdf.text(`SKU: ${sku}`, centerX, curY, { align: 'center' });
          curY += 1.5;
        }

        if (barcodeData) {
          const barcodeW = width - (is60x40 ? 12 : 8);
          const barcodeH = is60x40 ? 15 : 11;
          pdf.addImage(barcodeData, 'PNG', (width - barcodeW) / 2, curY, barcodeW, barcodeH);
          curY += barcodeH + 3.5;
        }

        if (showPrice) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(is60x40 ? 9 : 8);
          pdf.text(`PRICE: ${currency} ${price}`, centerX, curY, { align: 'center' });
        }
      });

      pdf.save(`Barcode-Labels-Roll-${new Date().toISOString().slice(0, 10)}.pdf`);
      return true;
    }
  } catch (err) {
    console.error('Batch stickers PDF failed:', err);
    throw err;
  }
}

// 3. Export Receipt as Image using Pure 2D HTML5 Canvas (No html2canvas, zero CSS dependency)
export function exportSaleToImage(sale: any, companySettings: any): boolean {
  try {
    const canvas = document.createElement('canvas');
    const width = 450;
    const items = sale.items || [];
    const height = Math.max(700, 480 + items.length * 45);

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const storeName =
      companySettings?.name ||
      companySettings?.company_name ||
      companySettings?.companyName ||
      'Retail Store';
    const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
    const totalAmount = formatStockPrice(sale.total_amount || 0);
    const subtotal = formatStockPrice(sale.subtotal || sale.total_amount || 0);
    const discount = parseFloat(sale.discount || 0);

    // Header
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(storeName, width / 2, 40);

    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#6b7280';
    let y = 65;
    if (companySettings?.address) {
      ctx.fillText(companySettings.address, width / 2, y);
      y += 20;
    }
    if (companySettings?.phone) {
      ctx.fillText(`Tel: ${companySettings.phone}`, width / 2, y);
      y += 20;
    }

    // Dashed Divider
    ctx.strokeStyle = '#d1d5db';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(width - 25, y);
    ctx.stroke();

    // Metadata
    y += 25;
    ctx.setLineDash([]);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 13px monospace';
    ctx.fillText(`Invoice: ${sale.invoice_number}`, 25, y);
    ctx.textAlign = 'right';
    ctx.fillText(`Date: ${sale.sale_date || ''}`, width - 25, y);

    y += 20;
    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Cashier: ${sale.cashier_name || 'Counter'}`, 25, y);
    ctx.textAlign = 'right';
    ctx.fillText(`Pay: ${sale.payment_method || 'CASH'}`, width - 25, y);

    // Table divider
    y += 15;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(width - 25, y);
    ctx.stroke();

    // Items
    y += 20;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Article', 25, y);
    ctx.textAlign = 'center';
    ctx.fillText('Qty', 290, y);
    ctx.textAlign = 'right';
    ctx.fillText('Total', width - 25, y);

    ctx.font = '13px sans-serif';
    items.forEach((item: any) => {
      y += 28;
      const name = item.article || item.product_name || item.name || 'Shoe';
      const qty = String(item.quantity || 1);
      const total = `${currency} ${formatStockPrice(item.subtotal || 0)}`;

      ctx.fillStyle = '#111827';
      ctx.textAlign = 'left';
      ctx.fillText(name.substring(0, 25), 25, y);
      ctx.textAlign = 'center';
      ctx.fillText(qty, 290, y);
      ctx.textAlign = 'right';
      ctx.fillText(total, width - 25, y);
    });

    // Totals
    y += 25;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(25, y);
    ctx.lineTo(width - 25, y);
    ctx.stroke();

    y += 25;
    ctx.setLineDash([]);
    ctx.textAlign = 'left';
    ctx.fillText('Subtotal:', 25, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${currency} ${subtotal}`, width - 25, y);

    if (discount > 0) {
      y += 22;
      ctx.fillStyle = '#047857';
      ctx.textAlign = 'left';
      ctx.fillText('Discount:', 25, y);
      ctx.textAlign = 'right';
      ctx.fillText(`-${currency} ${formatStockPrice(discount)}`, width - 25, y);
      ctx.fillStyle = '#111827';
    }

    y += 30;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TOTAL PAYABLE:', 25, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${currency} ${totalAmount}`, width - 25, y);

    // Save image download
    const link = document.createElement('a');
    link.download = `Invoice-${sale.invoice_number}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Image export error:', err);
    throw err;
  }
}

// 4. Export Sticker as PNG Image using Canvas
export function exportStickersToImage(
  product: any,
  companySettings: any,
  options: StickerCustomOptions = {}
): boolean {
  try {
    const canvas = document.createElement('canvas');
    const width = 380;
    const height = 240;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    const store = (
      companySettings?.name ||
      companySettings?.company_name ||
      companySettings?.companyName ||
      'Retail Store'
    ).toUpperCase();
    const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
    const brand = (product.brandName || product.brand_name || '').toUpperCase();
    const category = (product.categoryName || product.category_name || '').toUpperCase();
    const name = String(product.article || product.name || '').substring(0, 24);
    const sku = String(product.sku || '');
    const barcode = String(product.barcode || sku);
    const price = formatStockPrice(getProductRetailPrice(product, companySettings));

    const showStore = options.showStore !== false;
    const showBrand = options.showBrand !== false;
    const showCategory = options.showCategory !== false;
    const showArticle = options.showArticle !== false;
    const showSize = options.showSize !== false;
    const showSku = options.showSku !== false;
    const showPrice = options.showPrice !== false;
    const showBarcodeText = options.showBarcodeText !== false;

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';

    let currentY = 24;

    // Header (Store & Brand / Category)
    const headerParts: string[] = [];
    if (showStore) headerParts.push(store);
    if (showBrand && brand) headerParts.push(brand);
    if (showCategory && category && headerParts.length < 2) headerParts.push(category);

    if (headerParts.length > 0) {
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(headerParts.join(' • '), width / 2, currentY);
      currentY += 18;
    }

    // Name
    if (showArticle) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(name, width / 2, currentY);
      currentY += 18;
    }

    // SKU & Size
    const subParts: string[] = [];
    if (showSku) subParts.push(`SKU: ${sku}`);
    if (showSize && product.size) subParts.push(`SIZE: ${product.size}`);
    if (subParts.length > 0) {
      ctx.font = 'bold 11px monospace';
      ctx.fillText(subParts.join(' | '), width / 2, currentY);
      currentY += 10;
    }

    // Barcode image via JsBarcode
    const barcodeCanvas = document.createElement('canvas');
    JsBarcode(barcodeCanvas, barcode, {
      format: 'CODE128',
      width: 2,
      height: 40,
      displayValue: showBarcodeText,
      fontSize: 11,
      margin: 2,
      background: '#ffffff',
      lineColor: '#000000',
    });
    ctx.drawImage(barcodeCanvas, (width - 240) / 2, currentY, 240, 65);
    currentY += 75;

    // Price
    if (showPrice) {
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`PRICE: ${currency} ${price}`, width / 2, currentY);
    }

    const link = document.createElement('a');
    link.download = `Sticker-${sku || 'barcode'}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Sticker image export failed:', err);
    throw err;
  }
}

// 5. Generate WhatsApp Receipt Text
export function buildWhatsAppInvoiceText(sale: any, companySettings: any): string {
  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'Retail Store';
  const phone = companySettings?.phone || '';
  const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const footerNote = companySettings?.invoice_footer || companySettings?.invoiceFooter || 'Thank you for shopping with us!';

  const items = sale.items || [];
  const itemsText = items
    .map((item: any) => {
      const name = item.article || item.product_name || item.name;
      const qty = item.quantity;
      const unitPrice = formatStockPrice(item.unit_price || 0);
      const total = formatStockPrice(item.subtotal || 0);
      return `• *${name}* (${qty}x @ ${currency} ${unitPrice}) = *${currency} ${total}*`;
    })
    .join('\n');

  const total = formatStockPrice(sale.total_amount || 0);
  const discount = parseFloat(sale.discount || 0);
  const exchangeCredit = parseFloat(sale.exchange_credit || 0);

  let message = `🛍️ *${storeName}* - Digital Receipt\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🧾 Invoice: *${sale.invoice_number}*\n`;
  message += `📅 Date: ${sale.sale_date || ''}\n`;
  if (sale.customer_name) message += `👤 Customer: *${sale.customer_name}*\n`;
  if (sale.cashier_name) message += `🏷️ Cashier: ${sale.cashier_name}\n`;
  message += `💳 Payment: *${sale.payment_method || 'CASH'}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `*Purchased Footwear:*\n${itemsText}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  if (discount > 0) message += `💰 Discount: -${currency} ${formatStockPrice(discount)}\n`;
  if (exchangeCredit > 0) {
    message += `🔄 Exchange Credit: -${currency} ${formatStockPrice(exchangeCredit)}\n`;
    if (sale.return_number) message += `📑 Exchange Return #: ${sale.return_number}\n`;
  }
  message += `⭐ *TOTAL PAYABLE: ${currency} ${total}*\n`;
  if (parseFloat(sale.cash_received || 0) > 0) {
    message += `💵 Cash Paid: ${currency} ${formatStockPrice(sale.cash_received)}\n`;
    message += `🪙 Change Returned: ${currency} ${formatStockPrice(sale.change_given || 0)}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `${footerNote} 🙏\n`;
  if (phone) message += `📞 Store Contact: ${phone}\n`;

  return message;
}

// 5b. Generate SMS Receipt Text (Concise, high-deliverability format)
export function buildSmsInvoiceText(sale: any, companySettings: any): string {
  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'Retail Store';
  const phone = companySettings?.phone || '';
  const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const footerNote = companySettings?.invoice_footer || companySettings?.invoiceFooter || 'Thank you for shopping with us!';

  const items = sale.items || [];
  const itemsSummary = items
    .map((item: any) => {
      const name = item.article || item.product_name || item.name || 'Shoe';
      const qty = item.quantity;
      const total = formatStockPrice(item.subtotal || 0);
      return `${name} (${qty}x)=${currency}${total}`;
    })
    .join(', ');

  const total = formatStockPrice(sale.total_amount || 0);
  const discount = parseFloat(sale.discount || 0);
  const exchangeCredit = parseFloat(sale.exchange_credit || 0);

  let sms = `${storeName} Receipt\n`;
  sms += `Inv: ${sale.invoice_number} | ${sale.sale_date || ''}\n`;
  if (sale.customer_name) sms += `Cust: ${sale.customer_name}\n`;
  sms += `Items: ${itemsSummary}\n`;
  if (discount > 0) sms += `Disc: -${currency}${formatStockPrice(discount)}\n`;
  if (exchangeCredit > 0) sms += `Exch Credit: -${currency}${formatStockPrice(exchangeCredit)}\n`;
  sms += `Total: ${currency} ${total} (${sale.payment_method || 'CASH'})\n`;
  sms += `${footerNote}`;
  if (phone) sms += ` | Tel: ${phone}`;

  return sms;
}

/**
 * Normalizes phone number for digital messaging.
 * Converts local Pakistani phone numbers (e.g. 03001234567) to international format (923001234567) for WhatsApp.
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('00')) {
    return cleaned.substring(2);
  }
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '92' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Normalizes phone number for SMS URI protocol.
 */
export function formatPhoneForSms(phone: string): string {
  if (!phone) return '';
  return phone.trim().replace(/[\s\-\(\)]/g, '');
}

/**
 * Generates an SMS link compatible with iOS, Android, and desktop messaging clients.
 */
export function buildSmsLink(phone: string, text: string): string {
  const cleanPhone = formatPhoneForSms(phone);
  const isApple = typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
  const separator = isApple ? '&' : '?';
  const encodedText = encodeURIComponent(text);
  return cleanPhone ? `sms:${cleanPhone}${separator}body=${encodedText}` : `sms:${separator}body=${encodedText}`;
}

/**
 * Generates a WhatsApp link compatible with WhatsApp Web and mobile WhatsApp app.
 */
export function buildWhatsAppLink(phone: string, text: string): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}


// 6. Export Side-End Box Label for Shoe Box Shelf Storage as PDF (3"x4" / 76mm x 102mm)
export function exportSideEndBoxLabelToPdf(
  product: any,
  copies: number = 1,
  companySettings: any,
  options: {
    color?: string;
    size?: string;
    orientation?: 'portrait' | 'landscape';
    storeName?: string;
  } = {}
): boolean {
  try {
    const orientation = options.orientation || 'portrait';
    const isPortrait = orientation === 'portrait';
    const width = isPortrait ? 76 : 102;
    const height = isPortrait ? 102 : 76;

    const storeName = (
      options.storeName ||
      companySettings?.name ||
      companySettings?.company_name ||
      companySettings?.companyName ||
      'DWU Retail'
    ).toUpperCase();
    const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
    const brand = (product.brandName || product.brand_name || 'SHOES').toUpperCase();
    const article = String(product.article || product.name || 'Shoe Article').toUpperCase();
    const sku = String(product.sku || '');
    const barcode = String(product.barcode || sku);
    const price = formatStockPrice(getProductRetailPrice(product, companySettings));
    const barcodeData = generateBarcodeDataUrl(barcode);

    const pdf = new jsPDF({
      orientation: isPortrait ? 'p' : 'l',
      unit: 'mm',
      format: [width, height],
    });

    const totalCopies = Math.max(1, copies);
    for (let c = 0; c < totalCopies; c++) {
      if (c > 0) {
        pdf.addPage([width, height], isPortrait ? 'p' : 'l');
      }

      // Outer border for industrial rack storage visibility
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.8);
      pdf.rect(3, 3, width - 6, height - 6);

      if (isPortrait) {
        // --- PORTRAIT LAYOUT (76mm x 102mm) ---
        // Top Header Banner
        pdf.setFillColor(0, 0, 0);
        pdf.rect(3, 3, width - 6, 9.5, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text(`${storeName}${brand ? ' • ' + brand : ''}`, width / 2, 9.5, { align: 'center' });

        // Article Title (Large readable typography)
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(15);
        const splitTitle = pdf.splitTextToSize(article, width - 10);
        let curY = 19;
        pdf.text(splitTitle, width / 2, curY, { align: 'center' });
        curY += splitTitle.length * 5.5 + 1;

        // SKU
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(10.5);
        pdf.text(`SKU: ${sku}`, width / 2, curY, { align: 'center' });
        curY += 3;

        // Divider
        pdf.setLineWidth(0.3);
        pdf.line(5, curY, width - 5, curY);
        curY += 2;

        // Barcode Section
        if (barcodeData) {
          const bcW = 58;
          const bcH = 18;
          pdf.addImage(barcodeData, 'PNG', (width - bcW) / 2, curY, bcW, bcH);
          curY += bcH + 4;
        } else {
          curY += 10;
        }

        // Retail Price Section
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14.5);
        pdf.text(`RETAIL PRICE: ${currency} ${price}`, width / 2, curY, { align: 'center' });
        curY += 5;

        // Manual Write-In Box (For Rack Visibility)
        const boxTop = curY;
        const boxHeight = height - boxTop - 5;
        pdf.setLineWidth(0.6);
        pdf.rect(6, boxTop, width - 12, boxHeight);

        // Rack storage tag
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(90, 90, 90);
        pdf.text('RACK STORAGE IDENTIFICATION', width / 2, boxTop + 4.5, { align: 'center' });

        pdf.setTextColor(0, 0, 0);
        // Color row
        const colorY = boxTop + 13.5;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text('COLOR :', 9, colorY);
        if (options.color && options.color.trim()) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12.5);
          pdf.text(options.color.trim().toUpperCase(), 30, colorY);
        } else {
          pdf.setLineWidth(0.3);
          pdf.line(28, colorY + 1, width - 10, colorY + 1);
        }

        // Size row
        const sizeY = boxTop + 24;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text('SIZE   :', 9, sizeY);
        if (options.size && options.size.trim()) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(13.5);
          pdf.text(options.size.trim().toUpperCase(), 30, sizeY);
        } else {
          pdf.setLineWidth(0.3);
          pdf.line(28, sizeY + 1, width - 10, sizeY + 1);
        }
      } else {
        // --- LANDSCAPE LAYOUT (102mm x 76mm) ---
        // Header
        pdf.setFillColor(0, 0, 0);
        pdf.rect(3, 3, width - 6, 8.5, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text(`${storeName}${brand ? ' • ' + brand : ''}`, width / 2, 9, { align: 'center' });

        pdf.setTextColor(0, 0, 0);
        // Left Column: Title, SKU, Price
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13.5);
        const splitTitle = pdf.splitTextToSize(article, 52);
        pdf.text(splitTitle, 6, 18);
        let leftY = 18 + splitTitle.length * 5;

        pdf.setFont('courier', 'bold');
        pdf.setFontSize(9.5);
        pdf.text(`SKU: ${sku}`, 6, leftY);
        leftY += 5.5;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text(`PRICE: ${currency} ${price}`, 6, leftY);

        // Right Column: Barcode
        if (barcodeData) {
          const bcW = 44;
          const bcH = 20;
          pdf.addImage(barcodeData, 'PNG', 54, 15, bcW, bcH);
        }

        // Manual Write-in Box across bottom
        const boxTop = 38;
        const boxHeight = height - boxTop - 5;
        pdf.setLineWidth(0.6);
        pdf.rect(6, boxTop, width - 12, boxHeight);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(7.5);
        pdf.setTextColor(90, 90, 90);
        pdf.text('RACK STORAGE IDENTIFICATION', width / 2, boxTop + 4.5, { align: 'center' });

        pdf.setTextColor(0, 0, 0);
        const colorY = boxTop + 14;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text('COLOR :', 10, colorY);
        if (options.color && options.color.trim()) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12.5);
          pdf.text(options.color.trim().toUpperCase(), 32, colorY);
        } else {
          pdf.setLineWidth(0.3);
          pdf.line(30, colorY + 1, width - 12, colorY + 1);
        }

        const sizeY = boxTop + 24;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.text('SIZE   :', 10, sizeY);
        if (options.size && options.size.trim()) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(13.5);
          pdf.text(options.size.trim().toUpperCase(), 32, sizeY);
        } else {
          pdf.setLineWidth(0.3);
          pdf.line(30, sizeY + 1, width - 12, sizeY + 1);
        }
      }
    }

    pdf.save(`SideEnd-BoxLabel-${sku || product.id}-${orientation}.pdf`);
    return true;
  } catch (err) {
    console.error('Side-end label PDF export failed:', err);
    throw err;
  }
}

// 7. Export Side-End Box Label for Shoe Box Shelf Storage as PNG Image
export function exportSideEndBoxLabelToImage(
  product: any,
  companySettings: any,
  options: {
    color?: string;
    size?: string;
    orientation?: 'portrait' | 'landscape';
    storeName?: string;
  } = {}
): boolean {
  try {
    const orientation = options.orientation || 'portrait';
    const isPortrait = orientation === 'portrait';
    // 300 DPI high resolution
    const width = isPortrait ? 900 : 1200;
    const height = isPortrait ? 1200 : 900;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Border
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, width - 40, height - 40);

    const storeName = (
      options.storeName ||
      companySettings?.name ||
      companySettings?.company_name ||
      companySettings?.companyName ||
      'DWU Retail'
    ).toUpperCase();
    const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
    const brand = (product.brandName || product.brand_name || 'SHOES').toUpperCase();
    const article = String(product.article || product.name || 'SHOE ARTICLE').toUpperCase();
    const sku = String(product.sku || '');
    const barcode = String(product.barcode || sku);
    const price = formatStockPrice(getProductRetailPrice(product, companySettings));

    if (isPortrait) {
      // Header Banner
      ctx.fillStyle = '#000000';
      ctx.fillRect(20, 20, width - 40, 110);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${storeName}${brand ? ' • ' + brand : ''}`, width / 2, 88);

      // Article Title
      ctx.fillStyle = '#000000';
      ctx.font = '900 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(article.substring(0, 24), width / 2, 210);

      // SKU
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#333333';
      ctx.fillText(`SKU: ${sku}`, width / 2, 275);

      // Barcode
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, barcode, {
        format: 'CODE128',
        width: 3.2,
        height: 140,
        displayValue: true,
        fontSize: 26,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000',
      });
      ctx.drawImage(barcodeCanvas, (width - 700) / 2, 320, 700, 220);

      // Price
      ctx.fillStyle = '#000000';
      ctx.font = '900 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`RETAIL PRICE: ${currency} ${price}`, width / 2, 600);

      // Manual Write-in Box
      const boxX = 60;
      const boxY = 660;
      const boxW = width - 120;
      const boxH = height - boxY - 60;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#555555';
      ctx.fillText('RACK STORAGE IDENTIFICATION', width / 2, boxY + 50);

      // Color line
      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText('COLOR :', boxX + 40, boxY + 160);

      if (options.color && options.color.trim()) {
        ctx.font = '900 48px sans-serif';
        ctx.fillText(options.color.trim().toUpperCase(), boxX + 240, boxY + 160);
      } else {
        ctx.beginPath();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.moveTo(boxX + 230, boxY + 165);
        ctx.lineTo(boxX + boxW - 40, boxY + 165);
        ctx.stroke();
      }

      // Size line
      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText('SIZE   :', boxX + 40, boxY + 300);

      if (options.size && options.size.trim()) {
        ctx.font = '900 56px sans-serif';
        ctx.fillText(options.size.trim().toUpperCase(), boxX + 240, boxY + 300);
      } else {
        ctx.beginPath();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.moveTo(boxX + 230, boxY + 305);
        ctx.lineTo(boxX + boxW - 40, boxY + 305);
        ctx.stroke();
      }
    } else {
      // Landscape Layout (1200 x 900)
      ctx.fillStyle = '#000000';
      ctx.fillRect(20, 20, width - 40, 90);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${storeName}${brand ? ' • ' + brand : ''}`, width / 2, 75);

      // Left column
      ctx.fillStyle = '#000000';
      ctx.font = '900 46px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(article.substring(0, 20), 50, 180);

      ctx.font = 'bold 32px monospace';
      ctx.fillStyle = '#333333';
      ctx.fillText(`SKU: ${sku}`, 50, 240);

      ctx.font = '900 48px sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText(`PRICE: ${currency} ${price}`, 50, 320);

      // Barcode on right
      const barcodeCanvas = document.createElement('canvas');
      JsBarcode(barcodeCanvas, barcode, {
        format: 'CODE128',
        width: 3.0,
        height: 130,
        displayValue: true,
        fontSize: 24,
        margin: 5,
        background: '#ffffff',
        lineColor: '#000000',
      });
      ctx.drawImage(barcodeCanvas, 680, 140, 480, 200);

      // Manual Write-in Box
      const boxX = 50;
      const boxY = 380;
      const boxW = width - 100;
      const boxH = height - boxY - 50;

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.font = 'bold 26px sans-serif';
      ctx.fillStyle = '#555555';
      ctx.textAlign = 'center';
      ctx.fillText('RACK STORAGE IDENTIFICATION', width / 2, boxY + 50);

      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'left';
      ctx.fillText('COLOR :', boxX + 40, boxY + 160);

      if (options.color && options.color.trim()) {
        ctx.font = '900 48px sans-serif';
        ctx.fillText(options.color.trim().toUpperCase(), boxX + 240, boxY + 160);
      } else {
        ctx.beginPath();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.moveTo(boxX + 230, boxY + 165);
        ctx.lineTo(boxX + boxW - 40, boxY + 165);
        ctx.stroke();
      }

      ctx.font = 'bold 40px sans-serif';
      ctx.fillStyle = '#000000';
      ctx.fillText('SIZE   :', boxX + 40, boxY + 300);

      if (options.size && options.size.trim()) {
        ctx.font = '900 56px sans-serif';
        ctx.fillText(options.size.trim().toUpperCase(), boxX + 240, boxY + 300);
      } else {
        ctx.beginPath();
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 4;
        ctx.moveTo(boxX + 230, boxY + 305);
        ctx.lineTo(boxX + boxW - 40, boxY + 305);
        ctx.stroke();
      }
    }

    const link = document.createElement('a');
    link.download = `SideEnd-BoxLabel-${sku || product.id}-${orientation}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (err) {
    console.error('Side-end label image export failed:', err);
    throw err;
  }
}

