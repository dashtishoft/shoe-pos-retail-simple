import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Printer,
  X,
  Download,
  Image as ImageIcon,
  Box,
  PenTool,
  RotateCw,
  Check,
  Zap,
} from 'lucide-react';
import { BarcodeSvg } from '../common/BarcodeSvg.tsx';
import { formatStockPrice, getProductRetailPrice } from '../../utils/priceFormat.ts';
import {
  exportSideEndBoxLabelToPdf,
  exportSideEndBoxLabelToImage,
} from '../../utils/pdfExport.ts';
import {
  executePrintStickers,
  getSavedPrinterSettings,
} from '../../utils/printer/printerManager.ts';

interface SideEndBoxLabelModalProps {
  product: any;
  companySettings: any;
  onClose: () => void;
}

export const SideEndBoxLabelModal: React.FC<SideEndBoxLabelModalProps> = ({
  product,
  companySettings,
  onClose,
}) => {
  const [copies, setCopies] = useState<number>(1);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [colorInput, setColorInput] = useState<string>(product?.color || '');
  const [sizeInput, setSizeInput] = useState<string>(product?.size || '');
  const [leaveBlankForMarker, setLeaveBlankForMarker] = useState<boolean>(!product?.color && !product?.size);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [printerSettings] = useState(getSavedPrinterSettings());
  const [isPrintingDirect, setIsPrintingDirect] = useState(false);

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'DWU Retail';
  const brandName = product?.brandName || product?.brand_name || 'DWU Shoes';
  const articleName = product?.article || product?.name || 'Shoe Article';
  const sku = product?.sku || '';
  const barcode = product?.barcode || sku;
  const retailPrice = formatStockPrice(getProductRetailPrice(product, companySettings));

  const activeColor = leaveBlankForMarker ? '' : colorInput;
  const activeSize = leaveBlankForMarker ? '' : sizeInput;

  // 1. Direct Browser Print for 3" x 4" / 76mm x 102mm
  const handlePrintStandard = () => {
    window.print();
  };

  // 2. Direct WebUSB / Silent Print (if configured)
  const handlePrintDirectSilent = async () => {
    setIsPrintingDirect(true);
    setFeedback(null);
    try {
      const res = await executePrintStickers(product, copies, companySettings);
      if (res.modeUsed === 'webusb') {
        setFeedback(`Sent ${copies} side-end box label(s) directly to label printer!`);
      } else if (res.modeUsed === 'local_agent') {
        setFeedback(`Dispatched ${copies} label(s) to Local Print Agent!`);
      } else {
        setFeedback('Printed via system printer.');
      }
    } catch (err: any) {
      setFeedback(err.message || 'Direct print failed, using standard printer dialog.');
      window.print();
    } finally {
      setIsPrintingDirect(false);
    }
  };

  // 3. Export PDF
  const handleDownloadPdf = () => {
    setIsExportingPdf(true);
    setFeedback(null);
    try {
      exportSideEndBoxLabelToPdf(product, copies, companySettings, {
        color: activeColor,
        size: activeSize,
        orientation,
        storeName,
      });
      setFeedback('3x4" Shoe Box Side-End Label PDF downloaded successfully!');
    } catch (err: any) {
      setFeedback('Could not generate PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 4. Export PNG
  const handleDownloadImage = () => {
    setIsExportingImage(true);
    setFeedback(null);
    try {
      exportSideEndBoxLabelToImage(product, companySettings, {
        color: activeColor,
        size: activeSize,
        orientation,
        storeName,
      });
      setFeedback('High-res 300 DPI Side-End Box Label (PNG) saved to device!');
    } catch (err: any) {
      setFeedback('Could not save PNG: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExportingImage(false);
    }
  };

  const copiesArray = Array.from({ length: copies });

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
        className="relative w-full max-w-3xl app-modal-container overflow-hidden flex flex-col max-h-[92vh] no-print"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Purple/Violet theme for Side-End Box Label in Dark Mode, crisp slate styling in Light Mode */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-purple-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-400/30 rounded-xl shadow-2xs">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                  Shoe Box Side-End Label
                </h3>
                <span className="bg-purple-100 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-400/40 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                  Shelf Storage (3&quot; x 4&quot;)
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-purple-200/80 mt-0.5">
                High-visibility label for warehouse &amp; retail shoe rack box ends
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Details Banner */}
        <div className="px-6 py-2.5 bg-purple-50/60 dark:bg-purple-950/40 border-b border-purple-100 dark:border-purple-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-purple-950 dark:text-purple-200 text-sm">{articleName}</span>
            <span className="font-mono text-xs bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-semibold shadow-2xs">
              SKU: {sku}
            </span>
            <span className="text-purple-600 dark:text-purple-400 font-medium">Brand: {brandName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-purple-950 dark:text-purple-200 bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-800 px-2.5 py-0.5 rounded-lg">
              Barcode: {barcode}
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-lg">
              {currencySymbol} {retailPrice}
            </span>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 space-y-3.5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Orientation */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Label Orientation:</span>
              </label>
              <div className="flex rounded-xl p-0.5 bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Portrait (3&quot; x 4&quot; / 76×102mm)
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Landscape (4&quot; x 3&quot; / 102×76mm)
                </button>
              </div>
            </div>

            {/* Copies */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Copies to Print:</label>
              <div className="flex items-center space-x-1.5">
                {[1, 2, 4, 8].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopies(num)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      copies === num
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-16 px-2 py-1 text-center font-bold text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:border-purple-600 focus:ring-1 focus:ring-purple-500/20"
                />
              </div>
            </div>

            {/* Manual Write-in Options */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Manual Write-In Box:</span>
                </label>
                <label className="text-[11px] text-purple-900 dark:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={leaveBlankForMarker}
                    onChange={(e) => setLeaveBlankForMarker(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Blank Marker Lines</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Color (e.g. Black)"
                  value={colorInput}
                  disabled={leaveBlankForMarker}
                  onChange={(e) => setColorInput(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 font-semibold focus:border-purple-600"
                />
                <input
                  type="text"
                  placeholder="Size (e.g. 42)"
                  value={sizeInput}
                  disabled={leaveBlankForMarker}
                  onChange={(e) => setSizeInput(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 font-semibold focus:border-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <div className="text-[11px] text-slate-500 font-medium">
              Target Printer: <strong>3&quot; x 4&quot; / 76mm x 102mm</strong> (Xprinter, Zebra, TSC, Dymo, Gprinter)
            </div>

            <div className="flex items-center gap-2">
              {/* PDF Download */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                title="Download 3x4 inch vector PDF"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>

              {/* PNG Download */}
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isExportingImage}
                className="bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                title="Download 300 DPI PNG image"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>{isExportingImage ? 'Saving...' : 'Download PNG'}</span>
              </button>

              {/* Silent / WebUSB Direct Print (if available) */}
              {printerSettings?.stickerMode === 'webusb' && printerSettings?.stickerDeviceName ? (
                <button
                  type="button"
                  onClick={handlePrintDirectSilent}
                  disabled={isPrintingDirect}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title={`Direct silent print to ${printerSettings.stickerDeviceName}`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>{isPrintingDirect ? 'Printing...' : '⚡ Silent Print'}</span>
                </button>
              ) : null}

              {/* Standard Print Directly */}
              <button
                type="button"
                onClick={handlePrintStandard}
                className="bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md"
                title="Trigger browser print dialog for 3x4 inch label"
              >
                <Printer className="w-4 h-4" />
                <span>Print Directly</span>
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className="px-6 py-2 bg-purple-950 text-purple-200 text-xs flex items-center justify-between border-b border-purple-800">
            <span className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{feedback}</span>
            </span>
            <button
              onClick={() => setFeedback(null)}
              className="text-purple-300 hover:text-white cursor-pointer ml-3 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Interactive Live Label Preview */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-200/80 flex flex-col items-center justify-start">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Real-Scale Preview (3&quot; x 4&quot; / 76mm × 102mm Shelf Box Label)
          </div>

          <div className="flex flex-wrap gap-6 justify-center items-start">
            {copiesArray.map((_, idx) => (
              <div
                key={idx}
                className={`bg-white text-black border-4 border-black rounded-sm shadow-xl p-3 flex flex-col select-none relative ${
                  orientation === 'portrait'
                    ? 'w-[280px] h-[375px] justify-between'
                    : 'w-[375px] h-[280px] justify-between'
                }`}
                style={{
                  boxSizing: 'border-box',
                }}
              >
                {orientation === 'portrait' ? (
                  <>
                    {/* Header: Store / Brand Name */}
                    <div className="bg-black text-white text-center py-1.5 px-2 -mx-3 -mt-3">
                      <h4 className="text-xs font-black uppercase tracking-wider truncate">
                        {storeName} {brandName ? `• ${brandName}` : ''}
                      </h4>
                    </div>

                    {/* Product Title: Article Name & SKU */}
                    <div className="text-center pt-2">
                      <h2 className="text-base sm:text-lg font-black leading-tight tracking-tight text-black line-clamp-2 uppercase">
                        {articleName}
                      </h2>
                      <div className="text-xs font-mono font-black text-gray-800 mt-1">
                        SKU: {sku}
                      </div>
                    </div>

                    <div className="h-0.5 bg-black my-1"></div>

                    {/* Barcode Section */}
                    <div className="flex flex-col items-center justify-center my-0.5">
                      <BarcodeSvg value={barcode} width={1.8} height={46} fontSize={12} />
                    </div>

                    {/* Price Section */}
                    <div className="text-center py-1 bg-gray-100 border-y border-black">
                      <span className="text-[10px] font-extrabold uppercase text-gray-600 mr-1.5">
                        RETAIL PRICE:
                      </span>
                      <span className="text-base font-black text-black font-mono">
                        {currencySymbol} {retailPrice}
                      </span>
                    </div>

                    {/* Manual Write-In Box (For Rack Visibility) */}
                    <div className="border-2 border-black p-2 mt-1 rounded-xs bg-white">
                      <div className="text-[8px] font-black uppercase tracking-wider text-gray-500 text-center mb-1">
                        RACK STORAGE IDENTIFICATION
                      </div>
                      <div className="space-y-1.5 text-xs font-black">
                        <div className="flex items-center">
                          <span className="w-16 shrink-0 tracking-wider">COLOR :</span>
                          {leaveBlankForMarker || !activeColor ? (
                            <div className="flex-1 border-b-2 border-black h-4"></div>
                          ) : (
                            <span className="flex-1 uppercase text-sm font-black tracking-wide text-black pl-1">
                              {activeColor}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center">
                          <span className="w-16 shrink-0 tracking-wider">SIZE   :</span>
                          {leaveBlankForMarker || !activeSize ? (
                            <div className="flex-1 border-b-2 border-black h-4"></div>
                          ) : (
                            <span className="flex-1 uppercase text-base font-black tracking-wide text-black pl-1">
                              {activeSize}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Landscape layout */}
                    <div className="bg-black text-white text-center py-1.5 px-2 -mx-3 -mt-3">
                      <h4 className="text-xs font-black uppercase tracking-wider truncate">
                        {storeName} {brandName ? `• ${brandName}` : ''}
                      </h4>
                    </div>

                    <div className="grid grid-cols-2 gap-2 items-center my-1">
                      <div className="space-y-1">
                        <h2 className="text-sm font-black leading-tight text-black line-clamp-2 uppercase">
                          {articleName}
                        </h2>
                        <div className="text-[11px] font-mono font-black text-gray-800">
                          SKU: {sku}
                        </div>
                        <div className="text-xs font-black text-black">
                          PRICE: {currencySymbol} {retailPrice}
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <BarcodeSvg value={barcode} width={1.5} height={42} fontSize={11} />
                      </div>
                    </div>

                    {/* Manual Write-In Box */}
                    <div className="border-2 border-black p-2 rounded-xs bg-white">
                      <div className="text-[8px] font-black uppercase tracking-wider text-gray-500 text-center mb-1">
                        RACK STORAGE IDENTIFICATION
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs font-black">
                        <div className="flex items-center">
                          <span className="w-14 shrink-0">COLOR :</span>
                          {leaveBlankForMarker || !activeColor ? (
                            <div className="flex-1 border-b-2 border-black h-4"></div>
                          ) : (
                            <span className="flex-1 uppercase text-xs font-black pl-1">{activeColor}</span>
                          )}
                        </div>
                        <div className="flex items-center">
                          <span className="w-14 shrink-0">SIZE   :</span>
                          {leaveBlankForMarker || !activeSize ? (
                            <div className="flex-1 border-b-2 border-black h-4"></div>
                          ) : (
                            <span className="flex-1 uppercase text-sm font-black pl-1">{activeSize}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Previewing {copies} copy/copies • 3&quot; × 4&quot; Shelf Box Format
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
              <Printer className="w-4 h-4" />
              <span>Print Label</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* PRINT-ONLY CONTAINER STYLED DIRECTLY FOR 3x4" / 76mm x 102mm LABEL PRINTERS */}
      <div className="print-only">
        {copiesArray.map((_, i) => (
          <div
            key={i}
            className={
              orientation === 'portrait'
                ? 'print-side-end-label-portrait'
                : 'print-side-end-label-landscape'
            }
            style={{
              width: orientation === 'portrait' ? '76mm' : '102mm',
              height: orientation === 'portrait' ? '102mm' : '76mm',
              padding: '3mm',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              border: '2px solid #000',
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              backgroundColor: '#fff',
              color: '#000',
              pageBreakInside: 'avoid',
              pageBreakAfter: 'always',
              margin: '0 auto',
            }}
          >
            {orientation === 'portrait' ? (
              <>
                {/* Header Banner */}
                <div
                  style={{
                    backgroundColor: '#000',
                    color: '#fff',
                    textAlign: 'center',
                    padding: '1.5mm 1mm',
                    fontSize: '9pt',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    margin: '-3mm -3mm 2mm -3mm',
                  }}
                >
                  {storeName} {brandName ? `• ${brandName}` : ''}
                </div>

                {/* Article Name */}
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '13pt',
                      fontWeight: 900,
                      lineHeight: 1.1,
                      textTransform: 'uppercase',
                      color: '#000',
                    }}
                  >
                    {articleName}
                  </div>
                  <div
                    style={{
                      fontSize: '9pt',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      marginTop: '1mm',
                    }}
                  >
                    SKU: {sku}
                  </div>
                </div>

                <div style={{ height: '0.5mm', backgroundColor: '#000', margin: '1mm 0' }}></div>

                {/* Barcode Section */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '1mm 0' }}>
                  <BarcodeSvg value={barcode} width={1.7} height={40} fontSize={11} />
                </div>

                {/* Price Section */}
                <div
                  style={{
                    textAlign: 'center',
                    padding: '1.5mm 0',
                    backgroundColor: '#f3f4f6',
                    borderTop: '0.5mm solid #000',
                    borderBottom: '0.5mm solid #000',
                    fontSize: '11pt',
                    fontWeight: 900,
                  }}
                >
                  <span style={{ fontSize: '7.5pt', color: '#4b5563', marginRight: '2mm' }}>
                    RETAIL PRICE:
                  </span>
                  <span>
                    {currencySymbol} {retailPrice}
                  </span>
                </div>

                {/* Manual Write-In Box */}
                <div
                  style={{
                    border: '1.5px solid #000',
                    padding: '2mm',
                    marginTop: '1.5mm',
                    backgroundColor: '#fff',
                  }}
                >
                  <div
                    style={{
                      fontSize: '6.5pt',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      color: '#4b5563',
                      textAlign: 'center',
                      marginBottom: '1.5mm',
                    }}
                  >
                    RACK STORAGE IDENTIFICATION
                  </div>
                  <div style={{ fontSize: '9pt', fontWeight: 900, lineHeight: 1.4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5mm' }}>
                      <span style={{ width: '18mm', display: 'inline-block' }}>COLOR :</span>
                      {leaveBlankForMarker || !activeColor ? (
                        <div style={{ flex: 1, borderBottom: '1.5px solid #000', height: '3.5mm' }}></div>
                      ) : (
                        <span style={{ textTransform: 'uppercase', fontSize: '10pt', fontWeight: 900 }}>
                          {activeColor}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ width: '18mm', display: 'inline-block' }}>SIZE   :</span>
                      {leaveBlankForMarker || !activeSize ? (
                        <div style={{ flex: 1, borderBottom: '1.5px solid #000', height: '3.5mm' }}></div>
                      ) : (
                        <span style={{ textTransform: 'uppercase', fontSize: '11pt', fontWeight: 900 }}>
                          {activeSize}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Landscape Print Layout */}
                <div
                  style={{
                    backgroundColor: '#000',
                    color: '#fff',
                    textAlign: 'center',
                    padding: '1.5mm 1mm',
                    fontSize: '9pt',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    margin: '-3mm -3mm 1.5mm -3mm',
                  }}
                >
                  {storeName} {brandName ? `• ${brandName}` : ''}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ maxWidth: '52mm' }}>
                    <div style={{ fontSize: '11pt', fontWeight: 900, textTransform: 'uppercase' }}>
                      {articleName}
                    </div>
                    <div style={{ fontSize: '8pt', fontFamily: 'monospace', fontWeight: 700 }}>
                      SKU: {sku}
                    </div>
                    <div style={{ fontSize: '10pt', fontWeight: 900, marginTop: '1mm' }}>
                      PRICE: {currencySymbol} {retailPrice}
                    </div>
                  </div>
                  <div>
                    <BarcodeSvg value={barcode} width={1.4} height={35} fontSize={10} />
                  </div>
                </div>

                {/* Manual Write-In Box */}
                <div
                  style={{
                    border: '1.5px solid #000',
                    padding: '2mm',
                    marginTop: '1.5mm',
                    backgroundColor: '#fff',
                  }}
                >
                  <div
                    style={{
                      fontSize: '6pt',
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      color: '#4b5563',
                      textAlign: 'center',
                      marginBottom: '1mm',
                    }}
                  >
                    RACK STORAGE IDENTIFICATION
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9pt', fontWeight: 900 }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '48%' }}>
                      <span style={{ width: '16mm' }}>COLOR :</span>
                      {leaveBlankForMarker || !activeColor ? (
                        <div style={{ flex: 1, borderBottom: '1.5px solid #000', height: '3mm' }}></div>
                      ) : (
                        <span style={{ textTransform: 'uppercase', fontWeight: 900 }}>{activeColor}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', width: '48%' }}>
                      <span style={{ width: '16mm' }}>SIZE   :</span>
                      {leaveBlankForMarker || !activeSize ? (
                        <div style={{ flex: 1, borderBottom: '1.5px solid #000', height: '3mm' }}></div>
                      ) : (
                        <span style={{ textTransform: 'uppercase', fontWeight: 900 }}>{activeSize}</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
