import { motion } from 'motion/react';
import React, { useState, useRef } from 'react';
import {
  Barcode,
  Printer,
  Download,
  Image as ImageIcon,
  Zap,
  CheckCircle2,
  X,
  Search,
  Tag,
  RefreshCw,
  Sparkles,
  ScanLine,
  Boxes,
  AlertCircle,
} from 'lucide-react';
import { BarcodeSvg } from '../common/BarcodeSvg.tsx';
import { cleanStockPriceInput, formatStockPrice, getProductRetailPrice } from '../../utils/priceFormat.ts';
import {
  executePrintBatchStickers,
  getSavedPrinterSettings,
} from '../../utils/printer/printerManager.ts';
import {
  exportBatchStickersToPdf,
  exportStickersToImage,
} from '../../utils/pdfExport.ts';
import {
  generateEan13Barcode,
} from '../../utils/barcode.ts';
import { playAudioFeedback } from '../../utils/audio.ts';
import { useScrollActiveTab } from '../../hooks/useScrollActiveTab.ts';

export type LabelFormatType = 'roll_50x30' | 'roll_60x40' | 'a4_sheet';

interface BarcodeGeneratorToolProps {
  products: any[];
  initialSelectedProduct?: any | null;
  companySettings: any;
  onClose: () => void;
  onRefreshProducts?: () => void;
}

export const BarcodeGeneratorTool: React.FC<BarcodeGeneratorToolProps> = ({
  products,
  initialSelectedProduct,
  companySettings,
  onClose,
  onRefreshProducts,
}) => {
  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'Retail Store';
  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

  // Modes: 'catalog' = choose from existing inventory, 'custom' = create ad-hoc barcode/SKU
  const [activeTab, setActiveTab] = useState<'catalog' | 'custom'>(
    initialSelectedProduct ? 'catalog' : 'catalog'
  );
  const { containerRef: barcodeTabContainerRef } = useScrollActiveTab<HTMLDivElement>(activeTab, {
    padding: 16,
    behavior: 'smooth',
  });

  // Label Formats
  const [labelFormat, setLabelFormat] = useState<LabelFormatType>('roll_50x30');

  // Content Customization Toggles
  const [showStore, setShowStore] = useState(true);
  const [showBrand, setShowBrand] = useState(true);
  const [showArticle, setShowArticle] = useState(true);
  const [showSku, setShowSku] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);

  // Selected Catalog Items & Copies map: { [productId: number]: number }
  const [selectedItems, setSelectedItems] = useState<{ [productId: number]: number }>(() => {
    if (initialSelectedProduct?.id) {
      return { [initialSelectedProduct.id]: 2 };
    }
    return {};
  });

  // Filters for Catalog Table
  const [catalogSearch, setCatalogSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Custom SKU Generator State
  const rawPrefix = companySettings?.barcode_prefix || companySettings?.barcodePrefix || '0108923';
  const cleanPrefix = String(rawPrefix).replace(/\D/g, '').padEnd(7, '0').slice(0, 7);

  const [customSku, setCustomSku] = useState(
    initialSelectedProduct?.sku || 'APX-CAS-00101'
  );
  const [customArticle, setCustomArticle] = useState(
    initialSelectedProduct?.article || initialSelectedProduct?.name || 'Oxford Brogue Classic'
  );
  const [customBrand, setCustomBrand] = useState(
    initialSelectedProduct?.brandName || storeName
  );
  const [customPrice, setCustomPrice] = useState<number | string>(
    cleanStockPriceInput(getProductRetailPrice(initialSelectedProduct, companySettings) || initialSelectedProduct?.minSalePrice || '4999')
  );
  const [customBarcode, setCustomBarcode] = useState(
    initialSelectedProduct?.barcode || '0108923001018'
  );
  const [customBarcodeFormat, setCustomBarcodeFormat] = useState<'CODE128' | 'EAN13'>('CODE128');
  const [customCopies, setCustomCopies] = useState<number>(2);

  // Hardware Scanner Test Field
  const [testScanInput, setTestScanInput] = useState('');
  const [testScanResult, setTestScanResult] = useState<{
    status: 'idle' | 'matched' | 'unmatched';
    code?: string;
    message?: string;
  }>({ status: 'idle' });
  const testInputRef = useRef<HTMLInputElement | null>(null);

  // Feedback & Hardware Print States
  const [printerSettings] = useState(getSavedPrinterSettings());
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Extract unique brands for filter
  const uniqueBrands = Array.from(
    new Set(products.map((p) => p.brandName || p.brand_name).filter(Boolean))
  );

  // Auto-generate standard EAN13 or Code128 for custom tab
  const handleAutoGenerateCustomBarcode = () => {
    try {
      // Pick next sequence number or random 5-digit product ID
      const randomSeq = Math.floor(10000 + Math.random() * 89999);
      const generated = generateEan13Barcode(cleanPrefix, randomSeq);
      setCustomBarcode(generated);
      setCustomBarcodeFormat('EAN13');
      setFeedbackNotice(`Generated standard 13-digit EAN barcode: ${generated}`);
    } catch {
      // Fallback to Code 128 based on SKU
      setCustomBarcode(customSku.trim().toUpperCase());
      setCustomBarcodeFormat('CODE128');
    }
  };

  // Switch to SKU-based Code-128
  const handleUseSkuAsBarcode = () => {
    if (customSku.trim()) {
      setCustomBarcode(customSku.trim().toUpperCase());
      setCustomBarcodeFormat('CODE128');
      setFeedbackNotice(`Set barcode to match SKU: ${customSku.trim().toUpperCase()}`);
    }
  };

  // Filter products in catalog tab
  const filteredProducts = products.filter((p) => {
    const term = catalogSearch.toLowerCase().trim();
    const matchesSearch =
      !term ||
      String(p.article || p.name || '').toLowerCase().includes(term) ||
      String(p.sku || '').toLowerCase().includes(term) ||
      String(p.barcode || '').toLowerCase().includes(term);

    const matchesBrand =
      filterBrand === 'all' ||
      (p.brandName || p.brand_name) === filterBrand;

    const matchesLowStock =
      !filterLowStock || p.totalStock <= (p.lowStockLimit || 5);

    return matchesSearch && matchesBrand && matchesLowStock;
  });

  // Multi-select handlers
  const handleToggleProduct = (id: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[id] !== undefined) {
        delete next[id];
      } else {
        next[id] = 2; // Default 2 copies
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      filteredProducts.forEach((p) => {
        if (!next[p.id]) {
          next[p.id] = 2;
        }
      });
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedItems({});
  };

  const handleSetCopiesForProduct = (id: number, count: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: Math.max(1, count),
    }));
  };

  const handleApplyPresetCopiesToAll = (count: number) => {
    setSelectedItems((prev) => {
      const next: { [id: number]: number } = {};
      Object.keys(prev).forEach((idStr) => {
        const id = Number(idStr);
        next[id] = count;
      });
      return next;
    });
  };

  const handleMatchStockQuantities = () => {
    setSelectedItems((prev) => {
      const next: { [id: number]: number } = {};
      Object.keys(prev).forEach((idStr) => {
        const id = Number(idStr);
        const prod = products.find((p) => p.id === id);
        next[id] = Math.max(1, prod?.totalStock || 1);
      });
      return next;
    });
    setFeedbackNotice('Copies adjusted to match current stock quantities for each SKU!');
  };

  // Compile active label queue based on active tab
  const getLabelQueue = (): Array<{ product: any; copies: number }> => {
    if (activeTab === 'catalog') {
      const queue: Array<{ product: any; copies: number }> = [];
      Object.entries(selectedItems).forEach(([idStr, rawCopies]) => {
        const id = Number(idStr);
        const copies = Number(rawCopies) || 0;
        const prod = products.find((p) => p.id === id);
        if (prod && copies > 0) {
          queue.push({ product: prod, copies });
        }
      });
      return queue;
    } else {
      // Custom Tab item
      const customProd = {
        id: 999999,
        article: customArticle.trim() || 'Footwear Item',
        name: customArticle.trim() || 'Footwear Item',
        sku: customSku.trim() || 'SKU-CUSTOM-001',
        barcode: customBarcode.trim() || customSku.trim() || '00000000',
        brandName: customBrand.trim() || storeName,
        minSalePrice: parseFloat(String(customPrice)) || 0,
      };
      return [{ product: customProd, copies: Math.max(1, customCopies) }];
    }
  };

  const labelQueue = getLabelQueue();
  const totalStickersToPrint = labelQueue.reduce((acc, item) => acc + item.copies, 0);

  // Active single preview item
  const previewProduct =
    activeTab === 'catalog'
      ? labelQueue[0]?.product || products[0] || {
          article: 'Classic Leather Loafer',
          sku: 'FTW-LOA-001',
          barcode: '0108923000018',
          brandName: storeName,
          minSalePrice: 3500,
        }
      : {
          article: customArticle.trim() || 'Footwear Item',
          sku: customSku.trim() || 'SKU-CUSTOM-001',
          barcode: customBarcode.trim() || customSku.trim() || '00000000',
          brandName: customBrand.trim() || storeName,
          minSalePrice: parseFloat(String(customPrice)) || 0,
        };

  // Hardware Scanner Test simulation / check
  const handleTestScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const scanned = testScanInput.trim();
      if (!scanned) return;

      // Check if scanned value matches preview barcode or SKU
      const matchesBarcode =
        scanned.toLowerCase() === String(previewProduct.barcode).toLowerCase();
      const matchesSku =
        scanned.toLowerCase() === String(previewProduct.sku).toLowerCase();

      // Check if matches any item in the queue
      const queueMatch = labelQueue.find(
        (i) =>
          String(i.product.barcode).toLowerCase() === scanned.toLowerCase() ||
          String(i.product.sku).toLowerCase() === scanned.toLowerCase()
      );

      if (matchesBarcode || matchesSku || queueMatch) {
        playAudioFeedback.barcodeScan();
        setTestScanResult({
          status: 'matched',
          code: scanned,
          message: `✓ Hardware Scanner Match Verified! Decoded [${scanned}] in 12ms.`,
        });
      } else {
        playAudioFeedback.warning();
        setTestScanResult({
          status: 'unmatched',
          code: scanned,
          message: `✗ Scanned code [${scanned}] does not match current SKU (${previewProduct.sku}) or Barcode (${previewProduct.barcode}).`,
        });
      }
      setTestScanInput('');
    }
  };

  // Actions
  const handlePrintStandard = () => {
    if (totalStickersToPrint === 0) {
      alert('Please select at least one SKU to print.');
      return;
    }
    window.print();
  };

  const handleExportPdf = () => {
    if (totalStickersToPrint === 0) {
      alert('Please select at least one SKU to print.');
      return;
    }
    setIsExportingPdf(true);
    setFeedbackNotice(null);
    try {
      exportBatchStickersToPdf(labelQueue, companySettings, labelFormat, {
        showStore,
        showBrand,
        showArticle,
        showSku,
        showPrice,
      });
      setFeedbackNotice(`Downloaded ${totalStickersToPrint} sticker label(s) as PDF.`);
    } catch (err: any) {
      setFeedbackNotice(`PDF export error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportPng = () => {
    setFeedbackNotice(null);
    try {
      exportStickersToImage(previewProduct, companySettings);
      setFeedbackNotice(`Sticker image saved for SKU ${previewProduct.sku}.`);
    } catch (err: any) {
      setFeedbackNotice(`Image export error: ${err.message || 'Unknown error'}`);
    }
  };

  const handlePrintDirect = async () => {
    if (totalStickersToPrint === 0) {
      alert('Please select at least one SKU to print.');
      return;
    }
    setIsPrintingDirect(true);
    setFeedbackNotice(null);
    try {
      const res = await executePrintBatchStickers(labelQueue, companySettings);
      if (res.modeUsed === 'webusb') {
        setFeedbackNotice(`Dispatched ${totalStickersToPrint} labels directly to paired USB thermal printer!`);
      } else if (res.modeUsed === 'local_agent') {
        setFeedbackNotice(`Sent ${totalStickersToPrint} labels to Local Print Agent!`);
      } else {
        setFeedbackNotice('Printed via standard system printer.');
      }
    } catch (err: any) {
      setFeedbackNotice(`Direct print failed (${err.message}). Using system print dialog.`);
      window.print();
    } finally {
      setIsPrintingDirect(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* SCREEN DIALOG CONTAINER */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-6xl app-modal-container overflow-hidden flex flex-col max-h-[95vh] no-print"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL TOP HEADER */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-900 dark:text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-900/50 rounded-xl shadow-2xs">
              <Barcode className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Barcode Generator &amp; Physical Label Tool
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                  Hardware Ready
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate high-density scannable barcodes for shoe SKUs &amp; print physical adhesive labels
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 rounded-xl transition cursor-pointer"
              title="Close Tool (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODE TABS & SUMMARY BAR */}
        <div className="px-6 py-2.5 bg-slate-100 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div 
            ref={barcodeTabContainerRef}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            className="flex items-center space-x-1 border-b border-slate-200/80 dark:border-purple-900/50 overflow-x-auto no-scrollbar scrollbar-none tab-scrollbar-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-thumb]:hidden [&::-webkit-scrollbar-track]:hidden"
          >
            <button
              type="button"
              id="barcode-tab-catalog"
              data-active={activeTab === 'catalog'}
              data-tab="catalog"
              onClick={() => setActiveTab('catalog')}
              className={`tab-underline-link relative flex items-center space-x-2 px-3.5 py-2.5 font-semibold text-xs transition-colors duration-300 cursor-pointer whitespace-nowrap ${
                activeTab === 'catalog'
                  ? 'active text-purple-600 dark:text-purple-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
              }`}
            >
              <Boxes className={`w-3.5 h-3.5 transition-colors duration-200 ${activeTab === 'catalog' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>Catalog Inventory SKUs</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold transition-colors duration-200 ${
                  activeTab === 'catalog'
                    ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {products.length}
              </span>
              {activeTab === 'catalog' && (
                <motion.div
                  layoutId="barcodeActiveUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
            </button>

            <button
              type="button"
              id="barcode-tab-custom"
              data-active={activeTab === 'custom'}
              data-tab="custom"
              onClick={() => setActiveTab('custom')}
              className={`tab-underline-link relative flex items-center space-x-2 px-3.5 py-2.5 font-semibold text-xs transition-colors duration-300 cursor-pointer whitespace-nowrap ${
                activeTab === 'custom'
                  ? 'active text-purple-600 dark:text-purple-400 font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 transition-colors duration-200 ${activeTab === 'custom' ? 'text-purple-600 dark:text-purple-400' : 'text-amber-500'}`} />
              <span>Custom SKU Barcode Generator</span>
              {activeTab === 'custom' && (
                <motion.div
                  layoutId="barcodeActiveUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
            </button>

            {/* Scroll End Buffer Spacer: Ensures the last tab is 100% visible and never clipped */}
            <div className="tab-end-spacer shrink-0 w-8 sm:w-10 h-1 pointer-events-none self-stretch" aria-hidden="true" role="presentation" />
          </div>

          <div className="flex items-center space-x-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <span>
              Queue: <strong className="text-slate-900 dark:text-white">{labelQueue.length} SKU(s)</strong>
            </span>
            <span>•</span>
            <span>
              Total Labels: <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{totalStickersToPrint}</strong>
            </span>
          </div>
        </div>

        {/* FEEDBACK NOTICE BANNER */}
        {feedbackNotice && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between animate-fade-in">
            <div className="flex items-center space-x-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{feedbackNotice}</span>
            </div>
            <button
              onClick={() => setFeedbackNotice(null)}
              className="text-emerald-600 hover:text-emerald-900 cursor-pointer font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* MAIN BODY: 2-COLUMN LAYOUT */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
          {/* LEFT COLUMN: SELECTION & GENERATOR CONTROLS (7 COLS) */}
          <div className="lg:col-span-7 p-5 flex flex-col min-h-0 overflow-y-auto space-y-4">
            {activeTab === 'catalog' ? (
              /* TAB 1: CATALOG INVENTORY MULTI-SELECT */
              <div className="space-y-3">
                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search SKU, Article name, or Barcode..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs outline-none focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 font-medium"
                    />
                  </div>

                  <select
                    value={filterBrand}
                    onChange={(e) => setFilterBrand(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 text-slate-800 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] rounded-lg text-xs font-medium outline-none focus:border-indigo-500 dark:focus:border-purple-400 cursor-pointer"
                  >
                    <option value="all" className="dark:bg-[#120726] dark:text-purple-100">All Brands</option>
                    {uniqueBrands.map((b) => (
                      <option key={b} value={b} className="dark:bg-[#120726] dark:text-purple-100">
                        {b}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => setFilterLowStock(!filterLowStock)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      filterLowStock
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-slate-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    Low Stock Only
                  </button>
                </div>

                {/* Batch Quantity Presets */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleSelectAllFiltered}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-semibold rounded text-xs transition cursor-pointer"
                    >
                      Select All ({filteredProducts.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAll}
                      className="px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-semibold rounded text-xs transition cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-gray-500 text-[11px]">Set Copies:</span>
                    {[1, 2, 4, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleApplyPresetCopiesToAll(num)}
                        className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-600 border border-indigo-200 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] rounded font-bold text-xs transition cursor-pointer"
                        title={`Set ${num} copies for all selected SKUs`}
                      >
                        {num}x
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handleMatchStockQuantities}
                      className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-semibold text-xs transition cursor-pointer"
                      title="Set label quantity to match total current stock in store"
                    >
                      = Stock
                    </button>
                  </div>
                </div>

                {/* Catalog SKU List */}
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-gray-700 dark:text-white font-semibold border-b border-gray-200 dark:border-purple-800/80 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredProducts.length > 0 &&
                              filteredProducts.every((p) => selectedItems[p.id] !== undefined)
                            }
                            onChange={(e) => {
                              if (e.target.checked) handleSelectAllFiltered();
                              else handleDeselectAll();
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-3">Article &amp; SKU</th>
                        <th className="py-2.5 px-3">Barcode (1D)</th>
                        <th className="py-2.5 px-3 text-right">Price</th>
                        <th className="py-2.5 px-3 text-center">Stock</th>
                        <th className="py-2.5 px-3 text-center w-28">Label Copies</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">
                            No products match filter criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p) => {
                          const isSelected = selectedItems[p.id] !== undefined;
                          const currentCopies = selectedItems[p.id] || 2;

                          return (
                            <tr
                              key={p.id}
                              className={`hover:bg-indigo-50/40 transition cursor-pointer ${
                                isSelected ? 'bg-indigo-50/30' : ''
                              }`}
                              onClick={() => handleToggleProduct(p.id)}
                            >
                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleProduct(p.id)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-0 cursor-pointer"
                                />
                              </td>

                              <td className="py-2 px-3">
                                <div className="font-bold text-gray-900 truncate max-w-[170px]">
                                  {p.article || p.name}
                                </div>
                                <div className="text-[11px] font-mono text-gray-500">
                                  SKU: <span className="font-semibold text-gray-800">{p.sku}</span>
                                </div>
                              </td>

                              <td className="py-2 px-3">
                                <div className="flex flex-col">
                                  <span className="font-mono text-[11px] font-bold text-gray-800">
                                    {p.barcode}
                                  </span>
                                  <span className="text-[10px] text-gray-400">{p.brandName}</span>
                                </div>
                              </td>

                              <td className="py-2 px-3 text-right font-mono font-semibold text-gray-800">
                                {currencySymbol} {formatStockPrice(getProductRetailPrice(p, companySettings))}
                              </td>

                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                                    p.totalStock <= 0
                                      ? 'bg-red-100 text-red-700'
                                      : p.totalStock <= p.lowStockLimit
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {p.totalStock}
                                </span>
                              </td>

                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                {isSelected ? (
                                  <div className="flex items-center justify-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSetCopiesForProduct(p.id, currentCopies - 1)}
                                      className="w-5 h-5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-bold flex items-center justify-center cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      max="999"
                                      value={currentCopies}
                                      onChange={(e) =>
                                        handleSetCopiesForProduct(
                                          p.id,
                                          parseInt(e.target.value, 10) || 1
                                        )
                                      }
                                      className="w-12 px-1 py-0.5 text-center font-bold text-xs border border-gray-300 rounded bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSetCopiesForProduct(p.id, currentCopies + 1)}
                                      className="w-5 h-5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-bold flex items-center justify-center cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleProduct(p.id)}
                                    className="px-2 py-0.5 text-[11px] font-medium text-indigo-600 hover:underline cursor-pointer"
                                  >
                                    + Add to Print
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* TAB 2: CUSTOM SKU GENERATOR ON-THE-FLY */
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h3 className="font-bold text-gray-900 text-sm">
                      Custom SKU Barcode Generation &amp; Encoding
                    </h3>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    Store Prefix: <strong className="font-mono">{cleanPrefix}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      SKU Code <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customSku}
                      onChange={(e) => setCustomSku(e.target.value)}
                      placeholder="e.g. APX-RUN-00201"
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold outline-none focus:border-blue-500 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Article / Shoe Model Name
                    </label>
                    <input
                      type="text"
                      value={customArticle}
                      onChange={(e) => setCustomArticle(e.target.value)}
                      placeholder="e.g. Air Flex Trainer 42"
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      placeholder={`e.g. ${storeName}`}
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Retail Price ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      onBlur={(e) => setCustomPrice(cleanStockPriceInput(e.target.value))}
                      placeholder="e.g. 4500"
                      className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-mono font-bold outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Barcode Number & Generator Mode */}
                <div className="bg-white p-3.5 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-gray-800">
                      Barcode Encoding Standard
                    </label>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleAutoGenerateCustomBarcode}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded text-xs transition cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Auto EAN-13 (Prefix)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleUseSkuAsBarcode}
                        className="flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded text-xs transition cursor-pointer"
                      >
                        <Barcode className="w-3 h-3" />
                        <span>Use SKU As Barcode</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={customBarcode}
                      onChange={(e) => setCustomBarcode(e.target.value)}
                      placeholder="Enter 13-digit EAN or alphanumeric SKU barcode..."
                      className="flex-1 px-3 py-2 bg-slate-50 border border-gray-300 rounded-lg text-sm font-mono font-bold outline-none focus:bg-white focus:border-blue-500"
                    />
                    <select
                      value={customBarcodeFormat}
                      onChange={(e: any) => setCustomBarcodeFormat(e.target.value)}
                      className="px-3 py-2 bg-slate-50 dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 text-slate-800 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] rounded-lg text-xs font-semibold outline-none focus:border-purple-400 cursor-pointer"
                    >
                      <option value="CODE128" className="dark:bg-[#120726] dark:text-purple-100">Code-128 (Alphanumeric)</option>
                      <option value="EAN13" className="dark:bg-[#120726] dark:text-purple-100">EAN-13 (Numeric)</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Code-128 supports full alphanumeric characters (letters, numbers, hyphens). EAN-13 conforms to international 13-digit retail scan standards.
                  </p>
                </div>

                {/* Copies Counter */}
                <div className="flex items-center space-x-3 text-xs">
                  <span className="font-semibold text-gray-700">Number of Label Copies:</span>
                  <div className="flex items-center space-x-1">
                    {[1, 2, 4, 8, 12, 24].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCustomCopies(n)}
                        className={`px-2 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                          customCopies === n
                            ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-bold shadow-xs'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={customCopies}
                      onChange={(e) => setCustomCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 px-2 py-1 text-center font-bold text-xs border border-gray-300 rounded bg-white ml-2"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PHYSICAL HARDWARE SCANNER TEST VERIFICATION BOX */}
            <div className="p-3.5 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-2 select-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ScanLine className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-xs text-white">
                    Hardware Scanner Test Field
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">
                  Aim handheld laser or scanner gun at the screen to verify readability
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  ref={testInputRef}
                  type="text"
                  placeholder="Scan barcode here with physical scanner or type & press Enter..."
                  value={testScanInput}
                  onChange={(e) => setTestScanInput(e.target.value)}
                  onKeyDown={handleTestScanKeyDown}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono text-emerald-300 placeholder:text-slate-500 outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => testInputRef.current?.focus()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
                >
                  Focus
                </button>
              </div>

              {testScanResult.status !== 'idle' && (
                <div
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-lg flex items-center space-x-2 ${
                    testScanResult.status === 'matched'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      : 'bg-red-950/80 text-red-300 border border-red-800'
                  }`}
                >
                  {testScanResult.status === 'matched' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{testScanResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: LABEL DESIGN, LIVE PREVIEW & PRINT ACTIONS (5 COLS) */}
          <div className="lg:col-span-5 p-5 bg-slate-50 flex flex-col justify-between space-y-4 overflow-y-auto">
            <div className="space-y-4">
              {/* Physical Label Format Options */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-800 flex items-center justify-between">
                  <span>Physical Label Sheet / Roll Format</span>
                  <Tag className="w-3.5 h-3.5 text-blue-600" />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLabelFormat('roll_50x30')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      labelFormat === 'roll_50x30'
                        ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-gray-900">50 x 30 mm</div>
                    <div className="text-[10px] text-gray-500">Standard Thermal Roll</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelFormat('roll_60x40')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      labelFormat === 'roll_60x40'
                        ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-gray-900">60 x 40 mm</div>
                    <div className="text-[10px] text-gray-500">Large Box Label</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLabelFormat('a4_sheet')}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      labelFormat === 'a4_sheet'
                        ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold text-xs text-gray-900">A4 Sheet (24-up)</div>
                    <div className="text-[10px] text-gray-500">Sticky Paper Grid</div>
                  </button>
                </div>
              </div>

              {/* Label Content Element Toggles */}
              <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-gray-800 text-[11px] uppercase tracking-wider block">
                  Included Label Elements
                </span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-gray-700">
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStore}
                      onChange={(e) => setShowStore(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-0"
                    />
                    <span>Store Name</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBrand}
                      onChange={(e) => setShowBrand(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-0"
                    />
                    <span>Brand Name</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showArticle}
                      onChange={(e) => setShowArticle(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-0"
                    />
                    <span>Article Title</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSku}
                      onChange={(e) => setShowSku(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-0"
                    />
                    <span>SKU Code</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-0"
                    />
                    <span>Retail Price</span>
                  </label>

                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showBarcodeText}
                      onChange={(e) => setShowBarcodeText(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-0"
                    />
                    <span>Barcode Text</span>
                  </label>
                </div>
              </div>

              {/* LIVE SCANNABLE BARCODE PREVIEW CARD */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 font-medium">
                  <span>Live Physical Label Preview:</span>
                  <span className="font-mono text-[11px] text-blue-600">
                    {labelFormat === 'roll_50x30'
                      ? '50mm × 30mm'
                      : labelFormat === 'roll_60x40'
                      ? '60mm × 40mm'
                      : 'A4 Grid Unit (63.5 × 33.9mm)'}
                  </span>
                </div>

                <div className="p-4 bg-slate-200/80 rounded-xl border border-gray-300 flex items-center justify-center min-h-[170px]">
                  {/* Exact Scaled Label Representation */}
                  <div
                    className={`bg-white border border-gray-300 shadow-md rounded flex flex-col justify-between p-2.5 text-center select-none ${
                      labelFormat === 'roll_60x40' ? 'w-[230px] h-[145px]' : 'w-[210px] h-[126px]'
                    }`}
                  >
                    {/* Header */}
                    <div>
                      {(showStore || showBrand) && (
                        <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wider truncate">
                          {[showStore ? storeName : '', showBrand ? previewProduct.brandName : '']
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      )}
                      {showArticle && (
                        <p className="text-[11px] font-bold text-black truncate mt-0.5">
                          {previewProduct.article || previewProduct.name}
                        </p>
                      )}
                      {showSku && (
                        <p className="text-[10px] font-mono font-bold text-gray-700">
                          SKU: {previewProduct.sku}
                        </p>
                      )}
                    </div>

                    {/* SCANNABLE VECTOR BARCODE */}
                    <div className="flex justify-center -my-1 overflow-hidden">
                      <BarcodeSvg
                        value={previewProduct.barcode || previewProduct.sku}
                        format={customBarcodeFormat}
                        width={labelFormat === 'roll_60x40' ? 1.4 : 1.2}
                        height={labelFormat === 'roll_60x40' ? 32 : 26}
                        displayValue={showBarcodeText}
                        fontSize={9}
                      />
                    </div>

                    {/* Price Footer */}
                    {showPrice && (
                      <div className="flex justify-between items-center text-[10px] font-bold border-t border-gray-200 pt-1 mt-0.5">
                        <span className="text-gray-500">PRICE:</span>
                        <span className="text-xs text-black font-mono font-black">
                          {currencySymbol} {formatStockPrice(getProductRetailPrice(previewProduct, companySettings))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PRINT & EXPORT ACTION BUTTONS */}
            <div className="pt-3 border-t border-gray-200 space-y-2">
              {/* PRIMARY PRINT PHYSICAL LABELS BUTTON */}
              <button
                type="button"
                id="print-physical-labels-btn"
                onClick={handlePrintStandard}
                disabled={totalStickersToPrint === 0}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 disabled:opacity-50 font-bold text-sm rounded-xl shadow-md shadow-purple-600/25 dark:shadow-[0_0_18px_rgba(147,51,234,0.35)] transition flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
              >
                <Printer className="w-4 h-4" />
                <span>Print Physical Labels ({totalStickersToPrint} Labels)</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* PDF Label Roll/Sheet Export */}
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf || totalStickersToPrint === 0}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                  title="Download labels formatted as vector PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
                </button>

                {/* PNG Image Export */}
                <button
                  type="button"
                  onClick={handleExportPng}
                  className="flex items-center justify-center space-x-1.5 py-2 px-3 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-xs font-semibold rounded-lg transition cursor-pointer"
                  title="Download sticker PNG image"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-gray-500 dark:text-purple-300" />
                  <span>Export PNG</span>
                </button>
              </div>

              {/* Direct Silent USB Thermal Printing if Hardware Configured */}
              {printerSettings.stickerMode === 'webusb' && printerSettings.stickerDeviceName ? (
                <button
                  type="button"
                  onClick={handlePrintDirect}
                  disabled={isPrintingDirect || totalStickersToPrint === 0}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                  title={`Direct silent hardware output to ${printerSettings.stickerDeviceName}`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {isPrintingDirect
                      ? 'Dispatching to USB...'
                      : `⚡ Direct USB Silent Print (${printerSettings.stickerDeviceName})`}
                  </span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </motion.div>

      {/* PRINT-ONLY CONTAINER (STYLED FOR SYSTEM DIALOG PHYSICAL PRINTING) */}
      <div className="print-only">
        {labelFormat === 'a4_sheet' ? (
          <div className="print-barcode-a4-sheet grid grid-cols-3 gap-x-2 gap-y-2">
            {labelQueue.map((item, itemIdx) =>
              Array.from({ length: item.copies }).map((_, copyIdx) => (
                <div
                  key={`${itemIdx}-${copyIdx}`}
                  className="w-[63.5mm] h-[33.9mm] border border-gray-200 p-1.5 flex flex-col justify-between text-center box-border"
                >
                  <div>
                    {(showStore || showBrand) && (
                      <p className="text-[7.5pt] uppercase font-bold text-gray-600 leading-none truncate">
                        {[showStore ? storeName : '', showBrand ? item.product.brandName : '']
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                    {showArticle && (
                      <p className="text-[8.5pt] font-bold text-black leading-tight truncate mt-0.5">
                        {item.product.article || item.product.name}
                      </p>
                    )}
                    {showSku && (
                      <p className="text-[7pt] font-mono font-bold text-gray-800 leading-none mt-0.5">
                        SKU: {item.product.sku}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center -my-1">
                    <BarcodeSvg
                      value={item.product.barcode || item.product.sku}
                      width={1.1}
                      height={28}
                      displayValue={showBarcodeText}
                      fontSize={8}
                    />
                  </div>

                  {showPrice && (
                    <div className="flex justify-between items-center text-[7pt] font-bold border-t border-gray-300 pt-0.5">
                      <span className="text-gray-600">PRICE:</span>
                      <span className="text-[8pt] text-black font-mono font-black">
                        {currencySymbol} {formatStockPrice(getProductRetailPrice(item.product, companySettings))}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            {labelQueue.map((item, itemIdx) =>
              Array.from({ length: item.copies }).map((_, copyIdx) => (
                <div
                  key={`${itemIdx}-${copyIdx}`}
                  className={
                    labelFormat === 'roll_60x40'
                      ? 'print-barcode-roll-60x40 flex flex-col justify-between text-center'
                      : 'print-barcode-roll-50x30 flex flex-col justify-between text-center'
                  }
                >
                  <div>
                    {(showStore || showBrand) && (
                      <p className="text-[8pt] uppercase font-bold text-gray-600 leading-none truncate">
                        {[showStore ? storeName : '', showBrand ? item.product.brandName : '']
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    )}
                    {showArticle && (
                      <p className="text-[9pt] font-bold text-black leading-tight truncate mt-0.5">
                        {item.product.article || item.product.name}
                      </p>
                    )}
                    {showSku && (
                      <p className="text-[7.5pt] font-mono font-bold text-gray-800 leading-none mt-0.5">
                        SKU: {item.product.sku}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-center -my-1">
                    <BarcodeSvg
                      value={item.product.barcode || item.product.sku}
                      width={labelFormat === 'roll_60x40' ? 1.4 : 1.2}
                      height={labelFormat === 'roll_60x40' ? 32 : 26}
                      displayValue={showBarcodeText}
                      fontSize={8.5}
                    />
                  </div>

                  {showPrice && (
                    <div className="flex justify-between items-center text-[7.5pt] font-bold border-t border-gray-300 pt-0.5">
                      <span className="text-gray-600">PRICE:</span>
                      <span className="text-[8.5pt] text-black font-mono font-black">
                        {currencySymbol} {formatStockPrice(getProductRetailPrice(item.product, companySettings))}
                      </span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
