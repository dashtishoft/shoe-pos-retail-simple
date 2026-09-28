import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Layers,
  Copy,
  SkipForward,
  Trash2,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import {
  DuplicateStrategy,
  ParsedCsvProductRow,
  PRODUCT_CSV_SCHEMA_KEYS,
  generateSampleProductsCsv,
  parseAndValidateProductsCsv,
} from '../../utils/csvImport.ts';
import { formatStockPrice } from '../../utils/priceFormat.ts';

interface CsvImportModalProps {
  existingProducts: any[];
  companySettings: any;
  onClose: () => void;
  onImportSuccess: (toastMessage: string) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  existingProducts,
  companySettings,
  onClose,
  onImportSuccess,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [rawCsvText, setRawCsvText] = useState<string>('');
  const [nextProductId, setNextProductId] = useState<number>(1);
  const [liveSettings, setLiveSettings] = useState<any>(companySettings);

  const [rows, setRows] = useState<ParsedCsvProductRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('MERGE');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSettings = liveSettings || companySettings || {};
  const currencySymbol =
    effectiveSettings?.currency_symbol || effectiveSettings?.currencySymbol || 'Rs.';

  useEffect(() => {
    let mounted = true;
    async function fetchInitData() {
      try {
        const [nextIdRes, settingsRes] = await Promise.all([
          api.products.getNextId().catch(() => ({ nextProductId: existingProducts.length + 1 })),
          api.settings.get().catch(() => null),
        ]);
        if (!mounted) return;
        if (nextIdRes?.nextProductId) {
          setNextProductId(nextIdRes.nextProductId);
        }
        if (settingsRes?.settings) {
          setLiveSettings(settingsRes.settings);
        }
      } catch (_) {}
    }
    fetchInitData();
    return () => {
      mounted = false;
    };
  }, [existingProducts.length]);

  // Re-evaluate rows if rawCsvText, nextProductId, or effectiveSettings changes
  useEffect(() => {
    if (!rawCsvText) return;
    const result = parseAndValidateProductsCsv(
      rawCsvText,
      existingProducts,
      effectiveSettings,
      nextProductId
    );
    if (result.parseError) {
      setParseError(result.parseError);
      setRows([]);
    } else {
      setParseError(null);
      setRows(result.rows);
    }
  }, [rawCsvText, nextProductId, effectiveSettings, existingProducts]);

  const handleDownloadSampleCsv = () => {
    const csvContent = generateSampleProductsCsv(effectiveSettings);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products_import_sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const processUploadedFile = (file: File) => {
    setSubmitError(null);
    setParseError(null);
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a valid .csv file.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || '');
      setRawCsvText(content);
    };
    reader.onerror = () => {
      setParseError('Failed to read the selected CSV file.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processUploadedFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processUploadedFile(selected);
    }
    e.target.value = '';
  };

  const handleRowDuplicateStrategyChange = (rowNumber: number, strategy: DuplicateStrategy) => {
    setRows((prev) =>
      prev.map((r) => (r.rowNumber === rowNumber ? { ...r, duplicateAction: strategy } : r))
    );
  };

  const handleRemoveRow = (rowNumber: number) => {
    setRows((prev) => prev.filter((r) => r.rowNumber !== rowNumber));
  };

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);
  const duplicateRows = rows.filter((r) => r.isDuplicate);
  const autoGenCount = rows.reduce((sum, r) => sum + r.autoGeneratedFields.length, 0);

  const handleImportNow = async () => {
    setSubmitError(null);
    if (validRows.length === 0) {
      setSubmitError('No valid product rows to import. Please fix the validation errors first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payloadItems = validRows.map((r) => ({
        article: r.article,
        name: r.name,
        brand: r.brand,
        category: r.category,
        sku: r.sku,
        barcode: r.barcode,
        cost_price: r.cost_price,
        selling_price: r.selling_price,
        min_price: r.min_price,
        max_price: r.max_price,
        total_stock: r.total_stock,
        low_stock_limit: r.low_stock_limit,
        primary_image_url: r.primary_image_url,
        description: r.description,
        duplicateAction: r.duplicateAction || duplicateStrategy,
      }));

      const res = await api.products.bulkImport({
        items: payloadItems,
        duplicateStrategy,
      });

      onImportSuccess(
        res.message ||
          `Imported ${res.summary?.totalProcessed || validRows.length} products successfully.`
      );
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to import CSV rows.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderAutoBadge = (row: ParsedCsvProductRow, field: string) => {
    if (!row.autoGeneratedFields.includes(field)) return null;
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-500/40 ml-1.5 shrink-0"
        title={`Auto-generated using store settings & AddProductFormModal logic`}
      >
        Auto-Generated
      </span>
    );
  };

  const renderFieldError = (row: ParsedCsvProductRow, field: string) => {
    const err = row.validationErrors[field];
    if (!err) return null;
    return (
      <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>{err}</span>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-6xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-purple-800/80 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-purple-500/20 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center text-blue-600 dark:text-purple-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                Bulk CSV Inventory Import
              </h3>
              <p className="text-xs text-slate-500 dark:text-purple-200/80">
                Upload shoe inventory CSV • Blank fields auto-populate using store prefixes &amp; pricing policy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadSampleCsv}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-purple-500/20 hover:bg-slate-100 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-400/40 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-purple-300" />
              <span>Download Sample CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Schema Keys Reference & Drag-and-Drop Upload Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`lg:col-span-2 border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/70 dark:border-purple-400 dark:bg-purple-900/30'
                  : 'border-slate-300 dark:border-purple-700/60 bg-slate-50/70 dark:bg-[#0E1628]/70 hover:border-blue-500 dark:hover:border-purple-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 flex items-center justify-center mb-2">
                <Upload className="w-5 h-5" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                {fileName ? `Loaded: ${fileName}` : 'Drag & drop your CSV file here, or click to browse'}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
                Supports exact <code className="font-mono text-slate-700 dark:text-purple-300">products</code> table columns:{' '}
                <span className="font-mono text-[10px]">
                  {PRODUCT_CSV_SCHEMA_KEYS.join(', ')}
                </span>
              </p>
            </div>

            {/* Duplicate Strategy Control */}
            <div className="rounded-2xl border border-slate-200 dark:border-purple-800/60 bg-slate-50/80 dark:bg-[#0E1628]/80 p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    Duplicate Handling Strategy
                  </span>
                  {duplicateRows.length > 0 && (
                    <span className="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400">
                      {duplicateRows.length} match{duplicateRows.length === 1 ? '' : 'es'} found
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  Action when a CSV row matches an existing database barcode, article, or SKU:
                </p>

                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('MERGE')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      duplicateStrategy === 'MERGE'
                        ? 'bg-blue-600 text-white border-blue-600 dark:bg-purple-600 dark:border-purple-500'
                        : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Merge / Add Stock</span>
                    </span>
                    <span className="text-[10px] opacity-85">Adds to total_stock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('OVERWRITE')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      duplicateStrategy === 'OVERWRITE'
                        ? 'bg-blue-600 text-white border-blue-600 dark:bg-purple-600 dark:border-purple-500'
                        : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Copy className="w-3.5 h-3.5" />
                      <span>Overwrite Record</span>
                    </span>
                    <span className="text-[10px] opacity-85">Replaces fields &amp; stock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('SKIP')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      duplicateStrategy === 'SKIP'
                        ? 'bg-blue-600 text-white border-blue-600 dark:bg-purple-600 dark:border-purple-500'
                        : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Skip Duplicates</span>
                    </span>
                    <span className="text-[10px] opacity-85">Keeps existing untouched</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {(parseError || submitError) && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/70 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{parseError || submitError}</span>
            </div>
          )}

          {/* Summary Bar & Preview Table */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Preview ({rows.length} rows)
                  </span>
                  <span>·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {validRows.length} Valid
                  </span>
                  <span>·</span>
                  <span
                    className={
                      invalidRows.length > 0
                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                        : 'text-slate-400'
                    }
                  >
                    {invalidRows.length} Validation Error{invalidRows.length === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    {autoGenCount} Auto-Generated Field{autoGenCount === 1 ? '' : 's'}
                  </span>
                  {duplicateRows.length > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-blue-600 dark:text-purple-300 font-semibold">
                        {duplicateRows.length} Existing Match{duplicateRows.length === 1 ? '' : 'es'}
                      </span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRows([]);
                    setRawCsvText('');
                    setFileName('');
                  }}
                  className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-semibold cursor-pointer"
                >
                  Clear Preview
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-purple-800/60 overflow-hidden bg-white dark:bg-[#0E1628]">
                <div className="overflow-x-auto max-h-[44vh]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-purple-800/60 text-[11px] sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Status / Match</th>
                        <th className="py-2.5 px-3">article &amp; name</th>
                        <th className="py-2.5 px-3">brand &amp; category</th>
                        <th className="py-2.5 px-3">barcode &amp; sku</th>
                        <th className="py-2.5 px-3 text-right">cost_price</th>
                        <th className="py-2.5 px-3 text-right">
                          selling_price / min / max
                        </th>
                        <th className="py-2.5 px-3 text-center">total_stock</th>
                        <th className="py-2.5 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {rows.map((r) => {
                        const effectiveRowStrategy = r.duplicateAction || duplicateStrategy;
                        return (
                          <tr
                            key={r.rowNumber}
                            className={
                              !r.isValid
                                ? 'bg-rose-50/50 dark:bg-rose-950/20'
                                : r.isDuplicate
                                ? 'bg-blue-50/30 dark:bg-purple-950/20'
                                : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                            }
                          >
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {r.rowNumber}
                            </td>

                            {/* Status & Duplicate Action */}
                            <td className="py-2.5 px-3">
                              {!r.isValid ? (
                                <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>Invalid Data</span>
                                </div>
                              ) : r.isDuplicate ? (
                                <div className="space-y-1">
                                  <div className="text-[11px] font-bold text-blue-700 dark:text-purple-300">
                                    Matches existing {r.duplicateMatchType}
                                  </div>
                                  <select
                                    value={effectiveRowStrategy}
                                    onChange={(e) =>
                                      handleRowDuplicateStrategyChange(
                                        r.rowNumber,
                                        e.target.value as DuplicateStrategy
                                      )
                                    }
                                    className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-purple-700 text-slate-800 dark:text-white cursor-pointer"
                                  >
                                    <option value="MERGE">
                                      Merge (+{r.total_stock} to {r.existingProduct?.totalStock ?? 0})
                                    </option>
                                    <option value="OVERWRITE">Overwrite Record</option>
                                    <option value="SKIP">Skip Duplicate</option>
                                  </select>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>New Product</span>
                                </div>
                              )}
                            </td>

                            {/* article & name */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center flex-wrap">
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                  {r.article}
                                </span>
                                {renderAutoBadge(r, 'article')}
                              </div>
                              <div className="flex items-center flex-wrap text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span>{r.name}</span>
                                {renderAutoBadge(r, 'name')}
                              </div>
                              {renderFieldError(r, 'article')}
                            </td>

                            {/* brand & category */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center flex-wrap">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {r.brand}
                                </span>
                                {renderAutoBadge(r, 'brand')}
                              </div>
                              <div className="flex items-center flex-wrap text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span>{r.category}</span>
                                {renderAutoBadge(r, 'category')}
                              </div>
                            </td>

                            {/* barcode & sku */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center flex-wrap">
                                <span className="font-mono text-slate-900 dark:text-white">
                                  {r.barcode}
                                </span>
                                {renderAutoBadge(r, 'barcode')}
                              </div>
                              <div className="flex items-center flex-wrap text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                <span>{r.sku}</span>
                                {renderAutoBadge(r, 'sku')}
                              </div>
                              {renderFieldError(r, 'barcode')}
                            </td>

                            {/* cost_price */}
                            <td className="py-2.5 px-3 text-right font-mono">
                              <div className="flex items-center justify-end flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {currencySymbol} {formatStockPrice(r.cost_price)}
                                </span>
                                {renderAutoBadge(r, 'cost_price')}
                              </div>
                              {renderFieldError(r, 'cost_price')}
                            </td>

                            {/* selling_price / min_price / max_price */}
                            <td className="py-2.5 px-3 text-right font-mono">
                              <div className="flex items-center justify-end flex-wrap">
                                <span className="font-bold text-blue-600 dark:text-purple-300">
                                  {currencySymbol} {formatStockPrice(r.selling_price)}
                                </span>
                                {renderAutoBadge(r, 'selling_price')}
                              </div>
                              <div className="flex items-center justify-end flex-wrap text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                <span>
                                  Min: {formatStockPrice(r.min_price)} / Max:{' '}
                                  {formatStockPrice(r.max_price)}
                                </span>
                                {(r.autoGeneratedFields.includes('min_price') ||
                                  r.autoGeneratedFields.includes('max_price')) &&
                                  renderAutoBadge(
                                    r,
                                    r.autoGeneratedFields.includes('min_price')
                                      ? 'min_price'
                                      : 'max_price'
                                  )}
                              </div>
                              {renderFieldError(r, 'selling_price')}
                              {renderFieldError(r, 'min_price')}
                              {renderFieldError(r, 'max_price')}
                            </td>

                            {/* total_stock & low_stock_limit */}
                            <td className="py-2.5 px-3 text-center font-mono">
                              <div className="flex items-center justify-center flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {r.total_stock} pairs
                                </span>
                                {renderAutoBadge(r, 'total_stock')}
                              </div>
                              <div className="flex items-center justify-center flex-wrap text-[10px] text-slate-400 mt-0.5">
                                <span>Low limit: {r.low_stock_limit}</span>
                                {renderAutoBadge(r, 'low_stock_limit')}
                              </div>
                              {renderFieldError(r, 'total_stock')}
                              {renderFieldError(r, 'low_stock_limit')}
                            </td>

                            {/* Remove row */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(r.rowNumber)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Remove row from import"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-purple-800/80">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {rows.length > 0 ? (
              <span>
                Ready to commit <strong className="text-slate-900 dark:text-white">{validRows.length}</strong> valid product row{validRows.length === 1 ? '' : 's'}
                {invalidRows.length > 0 && (
                  <span className="text-rose-600 dark:text-rose-400 ml-1">
                    ({invalidRows.length} invalid row{invalidRows.length === 1 ? '' : 's'} will be excluded)
                  </span>
                )}
              </span>
            ) : (
              <span>Upload a CSV file or download the sample template to get started.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={validRows.length === 0 || isSubmitting}
              onClick={handleImportNow}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-purple-600/25 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Import Now ({validRows.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
