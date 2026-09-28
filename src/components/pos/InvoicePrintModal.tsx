import React, { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  X,
  FileText,
  Receipt,
  CheckCircle,
  Zap,
  Check,
  Download,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Phone,
  Copy,
  ExternalLink,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import {
  executePrintReceipt,
  getSavedPrinterSettings,
} from '../../utils/printer/printerManager.ts';
import {
  exportSaleToPdf,
  exportSaleToImage,
  buildWhatsAppInvoiceText,
  buildSmsInvoiceText,
  buildWhatsAppLink,
  buildSmsLink,
} from '../../utils/pdfExport.ts';

interface InvoicePrintModalProps {
  sale: any;
  companySettings: any;
  onClose: () => void;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  sale,
  companySettings,
  onClose,
}) => {
  const [printFormat, setPrintFormat] = useState<'thermal' | 'a4'>('thermal');
  const [printerSettings] = useState(getSavedPrinterSettings());
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [directFeedback, setDirectFeedback] = useState<string | null>(null);

  // Digital Receipt State (SMS & WhatsApp)
  const [recipientPhone, setRecipientPhone] = useState<string>(sale.customer_phone || '');
  const [customNote, setCustomNote] = useState<string>('');
  const [showPreviewDrawer, setShowPreviewDrawer] = useState<boolean>(false);
  const [previewType, setPreviewType] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [copiedType, setCopiedType] = useState<'whatsapp' | 'sms' | null>(null);

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'Retail Store';
  const storeAddress = companySettings?.address || '';
  const storePhone = companySettings?.phone || '';
  const storeEmail = companySettings?.email || '';
  const taxNumber = companySettings?.tax_number || companySettings?.taxNumber || '';
  const invoiceFooter = companySettings?.invoice_footer || companySettings?.invoiceFooter || 'Thank you for your visit!';
  const showReceiptLogo = Boolean(
    companySettings?.show_receipt_logo ?? companySettings?.showReceiptLogo ?? false
  );
  const receiptLogo =
    companySettings?.receipt_logo ||
    companySettings?.receiptLogo ||
    companySettings?.logo ||
    '';

  const items = sale.items || [];
  const totalAmount = parseFloat(sale.total_amount || 0);
  const subtotal = parseFloat(sale.subtotal || totalAmount);
  const discount = parseFloat(sale.discount || 0);
  const cashReceived = parseFloat(sale.cash_received || totalAmount);
  const changeGiven = parseFloat(sale.change_given || 0);

  // Generate WhatsApp & SMS text dynamically with optional custom note
  const whatsAppText = useMemo(() => {
    let text = buildWhatsAppInvoiceText(sale, companySettings);
    if (customNote.trim()) {
      text += `\n📝 *Note:* ${customNote.trim()}\n`;
    }
    return text;
  }, [sale, companySettings, customNote]);

  const smsText = useMemo(() => {
    let text = buildSmsInvoiceText(sale, companySettings);
    if (customNote.trim()) {
      text += `\nNote: ${customNote.trim()}`;
    }
    return text;
  }, [sale, companySettings, customNote]);

  const whatsAppUrl = useMemo(() => {
    return buildWhatsAppLink(recipientPhone, whatsAppText);
  }, [recipientPhone, whatsAppText]);

  const smsUrl = useMemo(() => {
    return buildSmsLink(recipientPhone, smsText);
  }, [recipientPhone, smsText]);

  const handlePrintStandard = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    setIsExportingPdf(true);
    setDirectFeedback(null);
    try {
      exportSaleToPdf(sale, companySettings, printFormat);
      setDirectFeedback('PDF downloaded successfully to your device!');
    } catch (err: any) {
      setDirectFeedback('Could not generate PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadImage = () => {
    setDirectFeedback(null);
    try {
      exportSaleToImage(sale, companySettings);
      setDirectFeedback('Receipt image (PNG) downloaded to your photos/gallery!');
    } catch (err: any) {
      setDirectFeedback('Could not save image: ' + (err.message || 'Unknown error'));
    }
  };

  const handleWhatsAppShare = () => {
    setDirectFeedback(`Opening WhatsApp receipt${recipientPhone ? ` for ${recipientPhone}` : ''}...`);
    try {
      const link = document.createElement('a');
      link.href = whatsAppUrl;
      link.target = '_blank';
      link.rel = 'noopener,noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Fallback
    }
  };

  const handleSmsShare = () => {
    setDirectFeedback(`Opening SMS messenger${recipientPhone ? ` for ${recipientPhone}` : ''}...`);
    try {
      // Trigger native SMS client
      const tempLink = document.createElement('a');
      tempLink.href = smsUrl;
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
    } catch {
      window.location.href = smsUrl;
    }
  };

  const handleCopyReceipt = (type: 'whatsapp' | 'sms') => {
    const textToCopy = type === 'whatsapp' ? whatsAppText : smsText;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopiedType(type);
        setDirectFeedback(`${type === 'whatsapp' ? 'WhatsApp' : 'SMS'} receipt text copied to clipboard!`);
        setTimeout(() => setCopiedType(null), 2500);
      }).catch(() => {
        setDirectFeedback('Could not copy text to clipboard.');
      });
    } else {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedType(type);
      setDirectFeedback('Receipt text copied to clipboard!');
      setTimeout(() => setCopiedType(null), 2500);
    }
  };

  const handlePrintDirect = async () => {
    setIsPrintingDirect(true);
    setDirectFeedback(null);
    try {
      const res = await executePrintReceipt(sale, companySettings);
      if (res.modeUsed === 'webusb') {
        setDirectFeedback('Receipt sent directly to USB printer without dialog!');
      } else if (res.modeUsed === 'local_agent') {
        setDirectFeedback('Receipt sent to Local Print Agent!');
      } else {
        setDirectFeedback('Printed via system printer.');
      }
    } catch (err: any) {
      setDirectFeedback(err.message || 'Direct print error, fallback to system dialog.');
      window.print();
    } finally {
      setIsPrintingDirect(false);
    }
  };

  const triggerPrintReceipt = () => {
    if (printerSettings.receiptMode === 'webusb' && printerSettings.receiptDeviceName) {
      handlePrintDirect();
    } else {
      handlePrintStandard();
    }
  };

  // Listen for F9 (Print Receipt) and F8/Escape (Dismiss)
  useEffect(() => {
    const handleInvoicePrintEvent = () => {
      triggerPrintReceipt();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        e.stopPropagation();
        triggerPrintReceipt();
      } else if (e.key === 'F8' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('invoice:print', handleInvoicePrintEvent);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('invoice:print', handleInvoicePrintEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [printerSettings, sale, companySettings, recipientPhone, whatsAppUrl, smsUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto print:static print:bg-white print:p-0 print:overflow-visible print:block">
      {/* Screen Container */}
      <div className="relative w-full max-w-3xl app-modal-container overflow-hidden flex flex-col max-h-[92vh] no-print">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-purple-800/80 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 rounded-xl shadow-2xs">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sale Completed — Invoice {sale.invoice_number}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Transaction recorded in PostgreSQL database & stock ledger updated</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
          <div className="flex space-x-1.5 sm:space-x-2">
            <button
              onClick={() => setPrintFormat('thermal')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                printFormat === 'thermal'
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 shadow-md shadow-purple-600/25 dark:border-purple-400/50 dark:shadow-[0_0_12px_rgba(147,51,234,0.3)]'
                  : 'bg-white dark:bg-purple-500/20 text-slate-700 dark:text-purple-200 hover:bg-slate-50 dark:hover:bg-purple-500/30 dark:hover:text-white border border-slate-300 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Thermal (80mm)</span>
            </button>
            <button
              onClick={() => setPrintFormat('a4')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
                printFormat === 'a4'
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 shadow-md shadow-purple-600/25 dark:border-purple-400/50 dark:shadow-[0_0_12px_rgba(147,51,234,0.3)]'
                  : 'bg-white dark:bg-purple-500/20 text-slate-700 dark:text-purple-200 hover:bg-slate-50 dark:hover:bg-purple-500/30 dark:hover:text-white border border-slate-300 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Invoice</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Direct PDF Download Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="flex items-center space-x-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
              title="Download clean PDF directly to your device storage"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingPdf ? 'Saving...' : 'Save PDF'}</span>
            </button>

            {/* PNG Image Download */}
            <button
              onClick={handleDownloadImage}
              className="hidden sm:flex items-center space-x-1 px-2.5 py-2 bg-white dark:bg-purple-500/20 hover:bg-slate-50 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-300 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-xs font-semibold rounded-lg transition cursor-pointer"
              title="Save as PNG image"
            >
              <ImageIcon className="w-3.5 h-3.5 text-slate-500 dark:text-purple-300" />
              <span>Image</span>
            </button>

            {/* Quick WhatsApp Share Button */}
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center space-x-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
              title="Share formatted digital receipt via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {/* Quick SMS Share Button */}
            <button
              onClick={handleSmsShare}
              className="flex items-center space-x-1 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
              title="Send digital receipt via SMS"
            >
              <Send className="w-3.5 h-3.5" />
              <span>SMS</span>
            </button>

            {/* Direct USB Silent Print if hardware paired */}
            {printerSettings.receiptMode === 'webusb' && printerSettings.receiptDeviceName ? (
              <button
                onClick={handlePrintDirect}
                disabled={isPrintingDirect}
                className="flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 font-bold text-xs rounded-lg shadow-md shadow-purple-600/25 transition cursor-pointer active:scale-95"
                title={`Direct silent print to ${printerSettings.receiptDeviceName} (F9)`}
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>{isPrintingDirect ? 'Printing...' : '⚡ Silent'}</span>
                <kbd className="text-[10px] bg-blue-800 px-1 rounded font-mono text-blue-200">F9</kbd>
              </button>
            ) : null}

            {/* Standard Browser Print */}
            <button
              onClick={handlePrintStandard}
              className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-medium text-xs rounded-lg shadow-xs transition cursor-pointer"
              title="Open browser print dialog (F9)"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
              <kbd className="text-[10px] bg-slate-700 px-1.5 py-0.2 rounded font-mono text-slate-300">F9</kbd>
            </button>

            <button
              onClick={onClose}
              className="px-2.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* CUSTOMER DIGITAL RECEIPTS (SMS & WhatsApp Direct Links) */}
        <div className="px-4 sm:px-6 py-3 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-sky-50/90 dark:from-emerald-950/40 dark:via-[#0E2030] dark:to-sky-950/40 border-b border-emerald-200/80 dark:border-emerald-800/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Label & Customer Identification */}
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Digital Receipt</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    WhatsApp &amp; SMS
                  </span>
                  {sale.customer_name && (
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate font-medium">
                      • {sale.customer_name}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Instant paperless receipt sent directly to customer mobile phone
                </p>
              </div>
            </div>

            {/* Phone Input & Quick Link Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="tel"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="Mobile / WhatsApp # (e.g. 03001234567)"
                  className="pl-8 pr-2.5 py-1.5 text-xs bg-white dark:bg-[#0A0E1A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg shadow-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 w-52 sm:w-60 outline-none"
                />
              </div>

              {/* Direct WhatsApp Link */}
              <a
                href={whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setDirectFeedback(`Opening WhatsApp receipt${recipientPhone ? ` for ${recipientPhone}` : ''}...`)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition"
                title="Send digital receipt directly via WhatsApp link"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
                <ExternalLink className="w-3 h-3 text-emerald-200" />
              </a>

              {/* Direct SMS Link */}
              <a
                href={smsUrl}
                onClick={() => setDirectFeedback(`Opening SMS messenger${recipientPhone ? ` for ${recipientPhone}` : ''}...`)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs rounded-lg shadow-xs transition"
                title="Send digital receipt directly via SMS link"
              >
                <Send className="w-3.5 h-3.5" />
                <span>SMS</span>
                <ExternalLink className="w-3 h-3 text-sky-200" />
              </a>

              {/* Quick Copy Text */}
              <button
                type="button"
                onClick={() => handleCopyReceipt('whatsapp')}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white dark:bg-purple-500/20 hover:bg-slate-50 dark:hover:bg-purple-500/30 border border-slate-300 dark:border-purple-400/40 text-slate-700 dark:text-purple-200 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-semibold text-xs rounded-lg shadow-xs transition cursor-pointer"
                title="Copy receipt text to clipboard"
              >
                {copiedType ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                )}
                <span>{copiedType ? 'Copied!' : 'Copy'}</span>
              </button>

              {/* Preview & Custom Note Drawer Toggle */}
              <button
                type="button"
                onClick={() => setShowPreviewDrawer(!showPreviewDrawer)}
                className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-200 flex items-center space-x-1 px-2 py-1.5 rounded-lg hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 transition cursor-pointer"
                title="View formatted message or add custom note"
              >
                <span>{showPreviewDrawer ? 'Hide Preview' : 'Preview / Note'}</span>
                {showPreviewDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Expandable Digital Receipt Message Preview Drawer */}
          {showPreviewDrawer && (
            <div className="mt-3 pt-3 border-t border-emerald-200/80 dark:border-emerald-800/60 space-y-2.5 bg-white/90 dark:bg-[#0A0E1A] p-3 rounded-lg border border-emerald-200/60 dark:border-emerald-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Format tab selector for message */}
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[11px]">
                  <button
                    type="button"
                    onClick={() => setPreviewType('whatsapp')}
                    className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                      previewType === 'whatsapp'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    WhatsApp Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewType('sms')}
                    className={`px-2.5 py-1 rounded font-medium transition cursor-pointer ${
                      previewType === 'sms'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    SMS Preview
                  </button>
                </div>

                <div className="flex items-center space-x-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleCopyReceipt(previewType)}
                    className="flex items-center space-x-1 text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy this message</span>
                  </button>
                </div>
              </div>

              {/* Message Textarea Preview */}
              <div className="relative">
                <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-[11px] leading-relaxed rounded-lg max-h-48 overflow-y-auto whitespace-pre-wrap border border-slate-700 select-all">
                  {previewType === 'whatsapp' ? whatsAppText : smsText}
                </pre>
              </div>

              {/* Add Custom Note input */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <div className="flex-1 flex items-center space-x-1.5">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">Append Note:</span>
                  <input
                    type="text"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="e.g. Shoes valid for 7 days exchange with original box"
                    className="flex-1 px-2.5 py-1 text-xs bg-white dark:bg-[#0E1628] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-md focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                  {customNote && (
                    <button
                      type="button"
                      onClick={() => setCustomNote('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <a
                    href={previewType === 'whatsapp' ? whatsAppUrl : smsUrl}
                    target={previewType === 'whatsapp' ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className={`px-3 py-1 text-white font-bold text-xs rounded-md shadow-xs transition flex items-center space-x-1 ${
                      previewType === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'
                    }`}
                  >
                    {previewType === 'whatsapp' ? <MessageCircle className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send {previewType === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        {directFeedback && (
          <div className="px-6 py-2.5 bg-slate-900 text-emerald-300 text-xs flex items-center justify-between">
            <span className="font-medium">{directFeedback}</span>
            <button onClick={() => setDirectFeedback(null)} className="text-slate-400 hover:text-white ml-2 cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Interactive Preview Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-[#080D1A] flex justify-center items-start">
          {printFormat === 'thermal' ? (
            /* THERMAL RECEIPT PREVIEW (80mm) */
            <div className="invoice-preview-receipt w-[320px] h-fit shrink-0 bg-white p-5 shadow-md border border-gray-200 font-mono text-xs text-gray-800 leading-tight">
              <div className="text-center pb-3 border-b border-dashed border-gray-400">
                {showReceiptLogo && receiptLogo && (
                  <div className="flex justify-center mb-2">
                    <img
                      src={receiptLogo}
                      alt={storeName}
                      className="max-h-12 max-w-[120px] object-contain mx-auto"
                    />
                  </div>
                )}
                <h3 className="invoice-store-name font-bold text-base uppercase tracking-wider text-black dark:text-white">{storeName}</h3>
                {storeAddress && <p className="text-[11px] text-gray-600 mt-1">{storeAddress}</p>}
                {storePhone && <p className="text-[11px] text-gray-600">Tel: {storePhone}</p>}
                {taxNumber && <p className="text-[11px] text-gray-600">Tax Reg: {taxNumber}</p>}
              </div>

              <div className="py-2 border-b border-dashed border-gray-400 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Invoice:</span>
                  <span className="font-bold">{sale.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{sale.sale_date}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{sale.cashier_name || 'Counter'}</span>
                </div>
                {sale.customer_name && (
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span>{sale.customer_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Payment:</span>
                  <span className="font-semibold">{sale.payment_method}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="py-2 border-b border-dashed border-gray-400">
                <div className="grid grid-cols-12 font-bold pb-1 text-[11px] border-b border-gray-200">
                  <span className="col-span-6">Item</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-4 text-right">Total</span>
                </div>
                {items.map((item: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 py-1 text-[11px]">
                    <div className="col-span-6">
                      <p className="invoice-item-article font-semibold text-black dark:text-white truncate">{item.article || item.product_name || item.name}</p>
                      <p className="invoice-item-price text-[10px] text-gray-500 dark:text-white">
                        {currencySymbol} {formatStockPrice(item.unit_price)}
                      </p>
                    </div>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-4 text-right font-medium">
                      {currencySymbol} {formatStockPrice(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-gray-400">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{currencySymbol} {formatStockPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span>-{currencySymbol} {formatStockPrice(discount)}</span>
                  </div>
                )}
                <div className="invoice-total-payable flex justify-between font-bold text-sm text-black dark:text-white pt-1 border-t border-gray-300">
                  <span>TOTAL PAYABLE:</span>
                  <span>{currencySymbol} {formatStockPrice(totalAmount)}</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>Cash Received:</span>
                  <span>{currencySymbol} {formatStockPrice(cashReceived)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Change Given:</span>
                  <span>{currencySymbol} {formatStockPrice(changeGiven)}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-3 text-center space-y-1.5">
                <p className="text-[10px] text-gray-600 italic px-2">{invoiceFooter}</p>
                <p className="text-[9px] text-gray-400">*** KEEP THIS RECEIPT FOR RETURNS ***</p>
              </div>
            </div>
          ) : (
            /* A4 INVOICE PREVIEW */
            <div className="invoice-preview-receipt w-full max-w-[650px] h-fit shrink-0 bg-white p-8 shadow-md border border-gray-200 text-gray-800 text-xs">
              {/* Header */}
              <div className="flex justify-between items-start pb-6 border-b border-gray-300">
                <div className="flex items-start gap-3">
                  {showReceiptLogo && receiptLogo && (
                    <img
                      src={receiptLogo}
                      alt={storeName}
                      className="max-h-14 max-w-[100px] object-contain shrink-0"
                    />
                  )}
                  <div>
                    <h1 className="invoice-store-name text-xl font-bold text-gray-900 dark:text-white tracking-tight">{storeName}</h1>
                    <p className="text-gray-600 mt-1">{storeAddress}</p>
                    <p className="text-gray-600">Phone: {storePhone} | Email: {storeEmail}</p>
                    {taxNumber && <p className="text-gray-600 font-medium">STRN / Tax ID: {taxNumber}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 font-bold text-sm tracking-wider uppercase rounded-sm border border-slate-300">
                    TAX INVOICE
                  </span>
                  <p className="text-gray-900 font-bold mt-2 text-sm">{sale.invoice_number}</p>
                  <p className="text-gray-500 text-xs mt-0.5">Date: {sale.sale_date}</p>
                </div>
              </div>

              {/* Bill to & Sale details */}
              <div className="grid grid-cols-2 gap-4 py-4 border-b border-gray-200 text-xs">
                <div>
                  <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">BILLED TO:</span>
                  <p className="font-bold text-gray-900 mt-0.5">{sale.customer_name || 'Walk-in Customer'}</p>
                  {sale.customer_phone && <p className="text-gray-600">Contact: {sale.customer_phone}</p>}
                  {sale.customer_address && <p className="text-gray-600">{sale.customer_address}</p>}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">PAYMENT DETAILS:</span>
                  <p className="text-gray-800 mt-0.5"><span className="font-medium">Method:</span> {sale.payment_method}</p>
                  <p className="text-gray-800"><span className="font-medium">Cashier:</span> {sale.cashier_name || 'Counter Operator'}</p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full mt-4 border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-y border-gray-300 text-gray-700">
                    <th className="py-2 px-3 text-left font-semibold">#</th>
                    <th className="py-2 px-3 text-left font-semibold">Article</th>
                    <th className="py-2 px-3 text-center font-semibold">Qty</th>
                    <th className="py-2 px-3 text-right font-semibold">Unit Price</th>
                    <th className="py-2 px-3 text-right font-semibold">Discount</th>
                    <th className="py-2 px-3 text-right font-semibold">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                      <td className="invoice-item-article py-2.5 px-3 font-medium text-gray-900 dark:text-white">{item.article || item.product_name || item.name}</td>
                      <td className="py-2.5 px-3 text-center text-gray-800">{item.quantity}</td>
                      <td className="invoice-item-price py-2.5 px-3 text-right text-gray-700 dark:text-white">
                        {currencySymbol} {formatStockPrice(item.unit_price)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-500">
                        {parseFloat(item.discount || 0) > 0 ? `${currencySymbol} ${formatStockPrice(item.discount)}` : '-'}
                      </td>
                      <td className="invoice-item-price py-2.5 px-3 text-right font-semibold text-gray-900 dark:text-white">
                        {currencySymbol} {formatStockPrice(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary calculations */}
              <div className="flex justify-end mt-4 pt-3 border-t border-gray-300">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>{currencySymbol} {formatStockPrice(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Total Discount:</span>
                      <span>-{currencySymbol} {formatStockPrice(discount)}</span>
                    </div>
                  )}
                  <div className="invoice-total-payable flex justify-between font-bold text-sm text-gray-900 dark:text-white border-t border-gray-300 pt-1.5">
                    <span>NET PAYABLE:</span>
                    <span>{currencySymbol} {formatStockPrice(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600 pt-1">
                    <span>Cash Received:</span>
                    <span>{currencySymbol} {formatStockPrice(cashReceived)}</span>
                  </div>
                  <div className="flex justify-between text-gray-800 font-medium">
                    <span>Change Given:</span>
                    <span>{currencySymbol} {formatStockPrice(changeGiven)}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-end">
                <div>
                  <p className="text-[10px] text-gray-500 max-w-sm">{invoiceFooter}</p>
                </div>
                <div className="text-center">
                  <div className="w-36 border-b border-gray-400 pb-1 mb-1"></div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Authorized Signature</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY CONTAINER (This gets output by the physical printer - strictly aligned with Light Mode) */}
      <div className="print-only">
        {printFormat === 'thermal' ? (
          <div className="print-thermal-receipt" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            <div style={{ textAlign: 'center', paddingBottom: '8px', borderBottom: '1px dashed #666' }}>
              {showReceiptLogo && receiptLogo && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                  <img
                    src={receiptLogo}
                    alt={storeName}
                    style={{ maxHeight: '44px', maxWidth: '110px', objectFit: 'contain' }}
                  />
                </div>
              )}
              <div style={{ fontWeight: 'bold', fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#000000' }}>
                {storeName}
              </div>
              {storeAddress && <div style={{ fontSize: '11px', color: '#333333', marginTop: '2px' }}>{storeAddress}</div>}
              {storePhone && <div style={{ fontSize: '11px', color: '#333333' }}>Tel: {storePhone}</div>}
              {taxNumber && <div style={{ fontSize: '11px', color: '#333333' }}>Tax Reg: {taxNumber}</div>}
            </div>

            <div style={{ padding: '6px 0', borderBottom: '1px dashed #666', fontSize: '11px', color: '#000000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Invoice:</span>
                <strong>{sale.invoice_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Date:</span>
                <span>{sale.sale_date}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <span>Cashier:</span>
                <span>{sale.cashier_name || 'Counter'}</span>
              </div>
              {sale.customer_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Customer:</span>
                  <span>{sale.customer_name}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Payment:</span>
                <strong>{sale.payment_method}</strong>
              </div>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '1px dashed #666', color: '#000000' }}>
              <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse', color: '#000000' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ccc' }}>
                    <th style={{ width: '50%', paddingBottom: '4px', fontWeight: 'bold' }}>Item</th>
                    <th style={{ width: '16%', paddingBottom: '4px', textAlign: 'center', fontWeight: 'bold' }}>Qty</th>
                    <th style={{ width: '34%', paddingBottom: '4px', textAlign: 'right', fontWeight: 'bold' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ paddingTop: '4px', paddingBottom: '2px' }}>
                        <div style={{ fontWeight: 'bold', color: '#000000' }}>{item.article || item.product_name || item.name}</div>
                        <div style={{ fontSize: '10px', color: '#555555' }}>
                          {currencySymbol} {formatStockPrice(item.unit_price)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '4px', color: '#000000' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: '4px', fontWeight: 600, color: '#000000' }}>
                        {currencySymbol} {formatStockPrice(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '6px 0', borderBottom: '1px dashed #666', fontSize: '11px', color: '#000000' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span>Subtotal:</span>
                <span>{currencySymbol} {formatStockPrice(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>Discount:</span>
                  <span>-{currencySymbol} {formatStockPrice(discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '4px', paddingTop: '4px', borderTop: '1px solid #ccc', color: '#000000' }}>
                <span>TOTAL PAYABLE:</span>
                <span>{currencySymbol} {formatStockPrice(totalAmount)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span>Cash Received:</span>
                <span>{currencySymbol} {formatStockPrice(cashReceived)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '2px' }}>
                <span>Change Given:</span>
                <span>{currencySymbol} {formatStockPrice(changeGiven)}</span>
              </div>
            </div>

            <div style={{ textAlign: 'center', paddingTop: '8px', color: '#000000' }}>
              <div style={{ fontSize: '10px', fontStyle: 'italic', color: '#333333' }}>{invoiceFooter}</div>
              <div style={{ fontSize: '9px', color: '#666666', marginTop: '4px' }}>*** KEEP THIS RECEIPT FOR RETURNS ***</div>
            </div>
          </div>
        ) : (
          <div className="print-a4-invoice" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            {/* Standard A4 Formal Print */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {showReceiptLogo && receiptLogo && (
                  <img
                    src={receiptLogo}
                    alt={storeName}
                    style={{ maxHeight: '52px', maxWidth: '100px', objectFit: 'contain' }}
                  />
                )}
                <div>
                  <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#000000' }}>{storeName}</h1>
                  <p style={{ margin: '3px 0', color: '#333333' }}>{storeAddress}</p>
                  <p style={{ margin: '3px 0', color: '#333333' }}>Phone: {storePhone} | Email: {storeEmail}</p>
                  {taxNumber && <p style={{ margin: '3px 0', fontWeight: 'bold', color: '#000000' }}>Tax ID: {taxNumber}</p>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#000000' }}>TAX INVOICE</h2>
                <p style={{ margin: '4px 0', fontWeight: 'bold', color: '#000000' }}>{sale.invoice_number}</p>
                <p style={{ margin: '2px 0', color: '#444444' }}>Date: {sale.sale_date}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', color: '#000000' }}>
              <div>
                <strong style={{ fontSize: '11px', textTransform: 'uppercase' }}>Billed To:</strong>
                <div>{sale.customer_name || 'Walk-in Customer'}</div>
                {sale.customer_phone && <div>Contact: {sale.customer_phone}</div>}
                {sale.customer_address && <div>{sale.customer_address}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div><strong>Payment:</strong> {sale.payment_method}</div>
                <div><strong>Cashier:</strong> {sale.cashier_name || 'Counter Operator'}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', color: '#000000' }}>
              <thead>
                <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid #000' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Article</th>
                  <th style={{ padding: '6px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Unit Price</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Discount</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '6px' }}>{idx + 1}</td>
                    <td style={{ padding: '6px' }}><strong>{item.article || item.product_name || item.name}</strong></td>
                    <td style={{ padding: '6px', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{currencySymbol} {formatStockPrice(item.unit_price)}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>
                      {parseFloat(item.discount || 0) > 0 ? `${currencySymbol} ${formatStockPrice(item.discount)}` : '-'}
                    </td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>{currencySymbol} {formatStockPrice(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', color: '#000000' }}>
              <div style={{ width: '240px', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{currencySymbol} {formatStockPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>-{currencySymbol} {formatStockPrice(discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000', paddingTop: '4px' }}>
                  <span>Net Payable:</span>
                  <span>{currencySymbol} {formatStockPrice(totalAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash Paid:</span>
                  <span>{currencySymbol} {formatStockPrice(cashReceived)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Change Given:</span>
                  <span>{currencySymbol} {formatStockPrice(changeGiven)}</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', color: '#000000' }}>
              <div>
                <div style={{ fontSize: '10px' }}>{invoiceFooter}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '150px', borderBottom: '1px solid #000', marginBottom: '4px' }}></div>
                <div style={{ fontSize: '10px' }}>Authorized Signature</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
