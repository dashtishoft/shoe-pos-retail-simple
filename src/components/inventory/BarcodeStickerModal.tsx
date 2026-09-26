import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Printer,
  X,
  Tag,
  Zap,
  Download,
  Image as ImageIcon,
  Layers,
  CheckSquare,
  Square,
  Minus,
  Plus,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { BarcodeSvg } from '../common/BarcodeSvg.tsx';
import { formatStockPrice, getProductRetailPrice } from '../../utils/priceFormat.ts';
import {
  executePrintStickers,
  getSavedPrinterSettings,
} from '../../utils/printer/printerManager.ts';
import {
  exportStickersToPdf,
  exportStickersToImage,
  StickerCustomOptions,
} from '../../utils/pdfExport.ts';

interface BarcodeStickerModalProps {
  product: any;
  companySettings: any;
  onClose: () => void;
}

type TagSize = '50x30' | '40x25' | '60x40';

export const BarcodeStickerModal: React.FC<BarcodeStickerModalProps> = ({
  product,
  companySettings,
  onClose,
}) => {
  // Stock on hand
  const currentStock = Math.max(0, Number(product?.totalStock) || 0);

  // Default copies: if product has positive stock, default to stock quantity or 2
  const [copies, setCopies] = useState<number>(() => {
    return currentStock > 0 ? currentStock : 2;
  });

  // Label size: 50x30mm (standard shoe price tag roll)
  const [tagSize, setTagSize] = useState<TagSize>('50x30');

  // Load saved customization options from localStorage
  const [options, setOptions] = useState<StickerCustomOptions>(() => {
    try {
      const saved = localStorage.getItem('pos_barcode_tag_options');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      showStore: true,
      showBrand: true,
      showCategory: true,
      showArticle: true,
      showPrice: true,
      showSku: true,
      showBarcodeText: true,
      labelSize: '50x30',
    };
  });

  // Save options changes to localStorage
  const handleToggleOption = (key: keyof StickerCustomOptions) => {
    setOptions((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('pos_barcode_tag_options', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const [printerSettings] = useState(getSavedPrinterSettings());
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [directFeedback, setDirectFeedback] = useState<string | null>(null);
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'Retail Store';

  const brandName = product.brandName || product.brand_name || '';
  const categoryName = product.categoryName || product.category_name || '';
  const articleName = product.article || product.name || 'Shoe';
  const retailPrice = formatStockPrice(getProductRetailPrice(product, companySettings));

  const handleMatchStockQuantity = () => {
    const targetCopies = currentStock > 0 ? currentStock : 1;
    setCopies(targetCopies);
    setDirectFeedback(`Set copies to match current inventory stock: ${targetCopies} tag(s).`);
  };

  const handlePrintStandard = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    setIsExportingPdf(true);
    setDirectFeedback(null);
    try {
      exportStickersToPdf(product, copies, companySettings, {
        ...options,
        labelSize: tagSize,
      });
      setDirectFeedback(`Downloaded PDF for ${copies} thermal tag(s)!`);
    } catch (err: any) {
      setDirectFeedback('Could not export PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleDownloadImage = () => {
    setDirectFeedback(null);
    try {
      exportStickersToImage(product, companySettings, {
        ...options,
        labelSize: tagSize,
      });
      setDirectFeedback('Tag sticker image (PNG) saved to your device!');
    } catch (err: any) {
      setDirectFeedback('Could not save image: ' + (err.message || 'Unknown error'));
    }
  };

  const handlePrintDirect = async () => {
    setIsPrintingDirect(true);
    setDirectFeedback(null);
    try {
      const res = await executePrintStickers(product, copies, companySettings);
      if (res.modeUsed === 'webusb') {
        setDirectFeedback(`Sent ${copies} thermal tag(s) directly to label printer!`);
      } else if (res.modeUsed === 'local_agent') {
        setDirectFeedback(`Dispatched ${copies} thermal tag(s) to Local Print Agent!`);
      } else {
        setDirectFeedback('Printed via system printer.');
      }
    } catch (err: any) {
      setDirectFeedback(err.message || 'Direct print failed, using standard dialog.');
      window.print();
    } finally {
      setIsPrintingDirect(false);
    }
  };

  const stickersArray = Array.from({ length: copies });

  // Tag styling dimensions for preview
  const previewDimensions = {
    '50x30': { widthClass: 'w-[230px]', heightClass: 'min-h-[140px]', label: '50 × 30 mm (Standard)' },
    '40x25': { widthClass: 'w-[190px]', heightClass: 'min-h-[120px]', label: '40 × 25 mm (Compact)' },
    '60x40': { widthClass: 'w-[270px]', heightClass: 'min-h-[170px]', label: '60 × 40 mm (Large)' },
  }[tagSize];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl app-modal-container overflow-hidden flex flex-col max-h-[92vh] no-print"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-200 dark:border-purple-400/30 rounded-xl shadow-2xs">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Print Barcode Price Tag</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-purple-500/30 text-blue-600 dark:text-purple-200 border border-blue-200 dark:border-purple-400/40 px-2 py-0.5 rounded-full">
                  Thermal Roll
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-purple-200/80">
                Direct scannable POS barcode tag &amp; price sticker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Details Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-blue-50/50 dark:bg-slate-900/60 border-b border-blue-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white text-sm">{articleName}</span>
            {brandName && (
              <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                {brandName}
              </span>
            )}
            {categoryName && (
              <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]">
                {categoryName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-600 dark:text-slate-400 text-[11px]">
              Stock on hand:{' '}
              <strong className={`font-mono ${currentStock > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {currentStock} pairs
              </strong>
            </span>
            <span className="font-mono font-bold text-blue-900 dark:text-cyan-300 bg-blue-100 dark:bg-blue-950/60 border border-blue-200 dark:border-cyan-500/40 px-2.5 py-0.5 rounded-lg text-xs">
              {currencySymbol} {retailPrice}
            </span>
          </div>
        </div>

        {/* Action Controls & Stock Match Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex flex-col gap-3">
          
          {/* Top Row: Copies and Instant Stock Level Button */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            
            {/* Copies Counter & Quick Presets */}
            <div className="flex items-center flex-wrap gap-2 text-sm">
              <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">Print Copies:</label>
              
              <div className="inline-flex items-center border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setCopies(Math.max(1, copies - 1))}
                  className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 transition cursor-pointer"
                  title="Decrease copies"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-14 text-center font-bold text-xs text-slate-900 dark:text-white bg-transparent border-x border-slate-200 dark:border-slate-700 focus:outline-hidden py-1"
                />
                <button
                  type="button"
                  onClick={() => setCopies(copies + 1)}
                  className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 transition cursor-pointer"
                  title="Increase copies"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1">
                {[1, 2, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopies(num)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      copies === num
                        ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Instant Match Stock Button */}
              <button
                type="button"
                id="match-stock-level-btn"
                onClick={handleMatchStockQuantity}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all cursor-pointer active:scale-95"
                title={`Instantly set print copies to match current inventory (${currentStock} pairs)`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>⚡ Match Stock ({currentStock} Tags)</span>
              </button>
            </div>

            {/* Customization Toggle Button & Roll Size */}
            <div className="flex items-center gap-2">
              <select
                value={tagSize}
                onChange={(e) => setTagSize(e.target.value as TagSize)}
                className="text-xs font-semibold bg-white dark:bg-purple-500/20 border border-slate-300 dark:border-purple-400/40 rounded-xl px-2.5 py-1.5 text-slate-700 dark:text-purple-200 hover:bg-slate-50 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] shadow-2xs focus:ring-1 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
                title="Select thermal label size"
              >
                <option value="50x30" className="dark:bg-[#120726] dark:text-purple-100">50 × 30 mm (Standard Shoe Tag)</option>
                <option value="40x25" className="dark:bg-[#120726] dark:text-purple-100">40 × 25 mm (Compact Tag)</option>
                <option value="60x40" className="dark:bg-[#120726] dark:text-purple-100">60 × 40 mm (Large Tag)</option>
              </select>

              <button
                type="button"
                onClick={() => setShowOptionsPanel(!showOptionsPanel)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                  showOptionsPanel
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-cyan-400'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Tag Fields {showOptionsPanel ? '▲' : '▼'}</span>
              </button>
            </div>
          </div>

          {/* Expandable Field Selection Panel (What to Include on Tag) */}
          {showOptionsPanel && (
            <div className="p-3.5 bg-white rounded-xl border border-indigo-100 shadow-2xs animate-fadeIn">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  Select What to Print on Tag:
                </span>
                <span className="text-[10px] text-slate-400">Settings auto-saved for next time</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[
                  { key: 'showStore', label: 'Store Name' },
                  { key: 'showBrand', label: 'Brand' },
                  { key: 'showCategory', label: 'Category' },
                  { key: 'showArticle', label: 'Article / Model' },
                  { key: 'showPrice', label: 'Price / M.R.P.' },
                  { key: 'showSku', label: 'SKU Code' },
                  { key: 'showBarcodeText', label: 'Barcode Digits' },
                ].map((item) => {
                  const isChecked = options[item.key as keyof StickerCustomOptions] !== false;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleToggleOption(item.key as keyof StickerCustomOptions)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-left transition cursor-pointer border ${
                        isChecked
                          ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bottom Row: Output Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
            <span className="text-xs text-slate-500">
              Total to print: <strong className="text-slate-900">{copies}</strong> thermal sticker{copies > 1 ? 's' : ''} ({tagSize} mm)
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {/* PDF Download */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="btn-secondary flex items-center space-x-1.5 px-3 py-1.5 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer hover:bg-slate-100"
                title="Download thermal roll as vector PDF"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>{isExportingPdf ? 'Exporting...' : 'Save PDF'}</span>
              </button>

              {/* PNG Image Download */}
              <button
                type="button"
                onClick={handleDownloadImage}
                className="btn-secondary flex items-center space-x-1.5 px-3 py-1.5 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer hover:bg-slate-100"
                title="Download sticker image (PNG)"
              >
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Image</span>
              </button>

              {/* Silent WebUSB Thermal Print */}
              {printerSettings.stickerMode === 'webusb' && printerSettings.stickerDeviceName ? (
                <button
                  type="button"
                  onClick={handlePrintDirect}
                  disabled={isPrintingDirect}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                  title={`Direct silent print to ${printerSettings.stickerDeviceName}`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isPrintingDirect ? 'Printing...' : '⚡ Silent Print'}</span>
                </button>
              ) : null}

              {/* Standard Print */}
              <button
                type="button"
                id="standard-print-tags-btn"
                onClick={handlePrintStandard}
                className="btn-primary flex items-center space-x-1.5 px-4 py-1.5 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Tags ({copies})</span>
              </button>
            </div>
          </div>
        </div>

        {directFeedback && (
          <div className="px-5 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/60">
            <span>{directFeedback}</span>
            <button
              onClick={() => setDirectFeedback(null)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Live Tag Preview (Thermal Roll Visualizer) */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-100 flex flex-col items-center justify-start gap-4">
          <div className="text-center">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Live Thermal Tag Preview ({previewDimensions.label})
            </span>
          </div>

          <div className="flex flex-wrap gap-4 justify-center items-start">
            {/* Show 1st tag live representation */}
            <div
              className={`${previewDimensions.widthClass} ${previewDimensions.heightClass} bg-white border-2 border-dashed border-slate-300 rounded-lg shadow-sm p-3 flex flex-col justify-between text-center select-none relative transition-all duration-200`}
            >
              {/* Header: Store Name, Brand, Category */}
              <div className="leading-tight">
                {(options.showStore || options.showBrand || options.showCategory) && (
                  <p className="text-[10px] uppercase font-bold text-slate-700 tracking-wider truncate">
                    {[
                      options.showStore ? storeName : null,
                      options.showBrand && brandName ? brandName : null,
                      options.showCategory && categoryName ? categoryName : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}

                {/* Article Name */}
                {options.showArticle && (
                  <p className="text-xs font-black text-black truncate mt-0.5">{articleName}</p>
                )}

                {/* SKU */}
                {options.showSku && (
                  <div className="flex items-center justify-center mt-0.5">
                    <span className="text-[9.5px] font-mono text-slate-600">SKU: {product.sku}</span>
                  </div>
                )}
              </div>

              {/* Barcode */}
              <div className="flex justify-center -my-0.5">
                <BarcodeSvg
                  value={product.barcode || product.sku}
                  width={tagSize === '40x25' ? 1.0 : tagSize === '60x40' ? 1.4 : 1.2}
                  height={tagSize === '40x25' ? 22 : tagSize === '60x40' ? 34 : 28}
                  fontSize={options.showBarcodeText ? 9 : 0}
                  displayValue={Boolean(options.showBarcodeText)}
                />
              </div>

              {/* Price / MRP */}
              {options.showPrice && (
                <div className="flex justify-between items-center text-[10px] font-bold border-t border-slate-200 pt-1 mt-0.5">
                  <span className="text-slate-500 font-bold text-[9px] uppercase">M.R.P. / Price:</span>
                  <span className="text-xs text-black font-black font-mono">
                    {currencySymbol} {retailPrice}
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center max-w-md">
            The barcode will print at high contrast 203 DPI standard for immediate reading by POS laser &amp; 2D CCD scanners.
          </p>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Thermal Label Roll • Size: {tagSize} mm
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrintStandard}
              className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tags ({copies})</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* PRINT-ONLY CSS CONTAINER FOR THERMAL ROLL PRINTER */}
      <div className="print-only">
        {stickersArray.map((_, i) => (
          <div
            key={i}
            className="print-barcode-sticker"
            style={{
              width: tagSize === '40x25' ? '40mm' : tagSize === '60x40' ? '60mm' : '50mm',
              height: tagSize === '40x25' ? '25mm' : tagSize === '60x40' ? '40mm' : '30mm',
              padding: '1.5mm',
              boxSizing: 'border-box',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              pageBreakInside: 'avoid',
              pageBreakAfter: 'always',
              margin: '0 auto',
            }}
          >
            {/* Store & Brand */}
            {(options.showStore || options.showBrand || options.showCategory) && (
              <div style={{ fontSize: '7.5px', fontWeight: 'bold', textTransform: 'uppercase', lineHeight: 1.1 }}>
                {[
                  options.showStore ? storeName : null,
                  options.showBrand && brandName ? brandName : null,
                  options.showCategory && categoryName ? categoryName : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </div>
            )}

            {/* Article */}
            {options.showArticle && (
              <div style={{ fontSize: '8.5px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1.1 }}>
                {articleName}
              </div>
            )}

            {/* SKU */}
            {options.showSku && (
              <div style={{ fontSize: '7.5px', fontFamily: 'monospace', textAlign: 'center' }}>
                <span>SKU: {product.sku}</span>
              </div>
            )}

            {/* Barcode */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <BarcodeSvg
                value={product.barcode || product.sku}
                width={tagSize === '40x25' ? 0.95 : tagSize === '60x40' ? 1.3 : 1.1}
                height={tagSize === '40x25' ? 20 : tagSize === '60x40' ? 30 : 24}
                fontSize={options.showBarcodeText ? 8 : 0}
                displayValue={Boolean(options.showBarcodeText)}
              />
            </div>

            {/* Price */}
            {options.showPrice && (
              <div style={{ fontSize: '9px', fontWeight: 'bold', lineHeight: 1.1 }}>
                PRICE: {currencySymbol} {retailPrice}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
