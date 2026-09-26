import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  AlertTriangle,
  Package,
  Building2,
  Calendar,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import { SupplierPicker } from './SupplierPicker.tsx';

interface ReturnCartonItem {
  productId: number;
  article: string;
  sku?: string;
  barcode?: string;
  currentStock: number;
  purchasedQty?: number;
  alreadyReturnedQty?: number;
  cartonQuantity: number;
  pairsPerCarton: number;
  totalPairs: number;
  unitPurchasePrice: number;
  subtotal: number;
  defectType: string;
}

interface SupplierReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (returnRecord: any) => void;
  companySettings: any;
  preselectedPurchaseNumber?: string;
  preselectedSupplierId?: number;
}

const COMMON_DEFECT_TYPES = [
  'Defective Sole / Cracked Outsole',
  'Sole Separation / Glue Failure',
  'Upper Leather Peeling / Tearing',
  'Broken Stitching / Seam Defect',
  'Color Stain / Dye Bleeding',
  'Mismatched Left & Right Shoe in Box',
  'Wrong Size Assortment in Carton',
  'Damaged / Crushed Carton in Transit',
  'Water Damage / Mold in Carton',
  'Other Manufacturing Defect',
];

const PRESET_CARTON_SIZES = [6, 8, 10, 12, 24];

export const SupplierReturnModal: React.FC<SupplierReturnModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companySettings,
  preselectedPurchaseNumber,
  preselectedSupplierId,
}) => {
  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

  // Mode: 'invoice' (from original purchase) or 'direct' (direct defective stock return)
  const [returnMode, setReturnMode] = useState<'invoice' | 'direct'>('invoice');

  // Supplier state
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>(preselectedSupplierId || '');
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierBalance, setSupplierBalance] = useState<number>(0);

  // Purchase invoice lookup state
  const [purchaseNumberInput, setPurchaseNumberInput] = useState<string>(preselectedPurchaseNumber || '');
  const [isVerifyingPurchase, setIsVerifyingPurchase] = useState<boolean>(false);
  const [verifiedPurchase, setVerifiedPurchase] = useState<any | null>(null);
  const [purchaseVerifyError, setPurchaseVerifyError] = useState<string>('');

  // General fields
  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState<string>('Defective shoe cartons returned to manufacturer/supplier');
  const [notes, setNotes] = useState<string>('');

  // Return items list
  const [returnItems, setReturnItems] = useState<ReturnCartonItem[]>([]);

  // Product catalog search for direct return
  const [productSearch, setProductSearch] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Form submitting state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Fetch suppliers list
  useEffect(() => {
    if (!isOpen) return;
    api.suppliers
      .list()
      .then((res) => {
        const list = res.suppliers || [];
        setSuppliers(list);

        if (preselectedSupplierId) {
          const match = list.find((s: any) => s.id === preselectedSupplierId);
          if (match) {
            setSelectedSupplierId(match.id);
            setSupplierName(match.name);
            setSupplierBalance(parseFloat(match.net_payable_balance ?? match.balance ?? '0'));
          }
        }
      })
      .catch((err) => console.error('Failed to load suppliers:', err));
  }, [isOpen, preselectedSupplierId]);

  // If preselectedPurchaseNumber provided, automatically verify it
  useEffect(() => {
    if (isOpen && preselectedPurchaseNumber) {
      setReturnMode('invoice');
      setPurchaseNumberInput(preselectedPurchaseNumber);
      handleVerifyPurchase(preselectedPurchaseNumber);
    }
  }, [isOpen, preselectedPurchaseNumber]);

  // Reset form when modal opens fresh
  useEffect(() => {
    if (isOpen && !preselectedPurchaseNumber && !preselectedSupplierId) {
      setReturnItems([]);
      setVerifiedPurchase(null);
      setPurchaseVerifyError('');
      setFormError('');
    }
  }, [isOpen]);

  const handleSupplierChange = (supId: number | '') => {
    setSelectedSupplierId(supId);
    if (!supId) {
      setSupplierName('');
      setSupplierBalance(0);
      return;
    }
    const sup = suppliers.find((s) => s.id === supId);
    if (sup) {
      setSupplierName(sup.name);
      setSupplierBalance(parseFloat(sup.net_payable_balance ?? sup.balance ?? '0'));
    }
  };

  const handleVerifyPurchase = async (invoiceNo?: string) => {
    const num = (invoiceNo || purchaseNumberInput).trim();
    if (!num) {
      setPurchaseVerifyError('Please enter a purchase number (e.g. PUR-000001).');
      return;
    }

    setIsVerifyingPurchase(true);
    setPurchaseVerifyError('');
    try {
      const res = await api.purchaseReturns.verifyPurchase(num);
      if (res.purchase) {
        setVerifiedPurchase(res.purchase);
        if (res.purchase.supplierId) {
          setSelectedSupplierId(res.purchase.supplierId);
        }
        setSupplierName(res.purchase.supplierName || '');
        setSupplierBalance(res.purchase.supplierBalance || 0);

        // Pre-populate return items candidate list
        const initialReturnItems: ReturnCartonItem[] = (res.items || [])
          .filter((item: any) => item.returnableQuantity > 0)
          .map((item: any) => {
            const defaultPairsPerCarton = item.returnableQuantity >= 12 ? 12 : item.returnableQuantity >= 6 ? 6 : item.returnableQuantity;
            const defaultCartons = 1;
            const totalPairs = Math.min(item.returnableQuantity, defaultCartons * defaultPairsPerCarton);

            return {
              productId: item.productId,
              article: item.article || item.productName,
              sku: item.sku,
              barcode: item.barcode,
              currentStock: item.currentStock,
              purchasedQty: item.purchasedQuantity,
              alreadyReturnedQty: item.alreadyReturnedQuantity,
              cartonQuantity: defaultCartons,
              pairsPerCarton: defaultPairsPerCarton,
              totalPairs: totalPairs,
              unitPurchasePrice: item.unitPurchasePrice,
              subtotal: Math.round(totalPairs * item.unitPurchasePrice * 100) / 100,
              defectType: 'Defective Sole / Cracked Outsole',
            };
          });

        // Only add the first item by default, or empty if user wants to pick
        setReturnItems(initialReturnItems.slice(0, 1));
      }
    } catch (err: any) {
      setPurchaseVerifyError(err.message || 'Purchase invoice not found or could not be verified.');
      setVerifiedPurchase(null);
    } finally {
      setIsVerifyingPurchase(false);
    }
  };

  // Search products for direct return mode
  useEffect(() => {
    if (returnMode !== 'direct' || !productSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.products.list({ search: productSearch.trim() });
        setSearchResults((res.products || []).slice(0, 10));
      } catch (err) {
        console.error('Failed to search products:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [productSearch, returnMode]);

  const addDirectProduct = (product: any) => {
    // Check if already in list
    const exists = returnItems.some((item) => item.productId === product.id);
    if (exists) {
      setProductSearch('');
      setSearchResults([]);
      return;
    }

    const unitPrice = parseFloat(String(product.costPrice ?? product.cost_price ?? '0'));
    const defaultPairsPerCarton = 12;
    const defaultCartonQty = 1;
    const totalPairs = defaultCartonQty * defaultPairsPerCarton;
    const availStock = product.totalStock ?? product.total_stock ?? 0;

    const newItem: ReturnCartonItem = {
      productId: product.id,
      article: product.article || product.name,
      sku: product.sku,
      barcode: product.barcode,
      currentStock: availStock,
      cartonQuantity: defaultCartonQty,
      pairsPerCarton: defaultPairsPerCarton,
      totalPairs: Math.min(availStock, totalPairs),
      unitPurchasePrice: unitPrice,
      subtotal: Math.round(Math.min(availStock, totalPairs) * unitPrice * 100) / 100,
      defectType: 'Defective Sole / Cracked Outsole',
    };

    setReturnItems((prev) => [...prev, newItem]);
    setProductSearch('');
    setSearchResults([]);
  };

  const updateItem = (index: number, updates: Partial<ReturnCartonItem>) => {
    setReturnItems((prev) => {
      const copy = [...prev];
      const current = { ...copy[index], ...updates };

      // Recalculate total pairs if cartonQuantity or pairsPerCarton changed
      if (updates.cartonQuantity !== undefined || updates.pairsPerCarton !== undefined) {
        const cQty = Math.max(1, current.cartonQuantity || 1);
        const pQty = Math.max(1, current.pairsPerCarton || 1);
        current.totalPairs = cQty * pQty;
      }

      // Recalculate subtotal
      const pairs = current.totalPairs || 0;
      const price = current.unitPurchasePrice || 0;
      current.subtotal = Math.round(pairs * price * 100) / 100;

      copy[index] = current;
      return copy;
    });
  };

  const removeItem = (index: number) => {
    setReturnItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalReturnDebit = returnItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const totalCartons = returnItems.reduce((sum, item) => sum + (item.cartonQuantity || 1), 0);
  const totalPairs = returnItems.reduce((sum, item) => sum + (item.totalPairs || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!supplierName.trim()) {
      setFormError('Please select or specify a supplier to debit.');
      return;
    }

    if (returnItems.length === 0) {
      setFormError('Please add at least one defective shoe carton to return.');
      return;
    }

    // Check stock for all items
    for (const item of returnItems) {
      if (item.totalPairs <= 0) {
        setFormError(`Please enter a valid quantity of pairs for "${item.article}".`);
        return;
      }
      if (item.totalPairs > item.currentStock) {
        setFormError(
          `Cannot return ${item.totalPairs} pairs of "${item.article}". Current inventory is only ${item.currentStock} pairs.`
        );
        return;
      }
      if (item.unitPurchasePrice < 0) {
        setFormError(`Unit purchase price for "${item.article}" cannot be negative.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload = {
        supplierId: selectedSupplierId || null,
        supplierName: supplierName.trim(),
        purchaseId: verifiedPurchase ? verifiedPurchase.id : null,
        purchaseNumber: verifiedPurchase ? verifiedPurchase.purchaseNumber : null,
        returnDate,
        reason: reason.trim(),
        notes: notes.trim(),
        items: returnItems.map((item) => ({
          productId: item.productId,
          cartonQuantity: item.cartonQuantity,
          pairsPerCarton: item.pairsPerCarton,
          quantity: item.totalPairs,
          unitPurchasePrice: item.unitPurchasePrice,
          defectType: item.defectType,
        })),
      };

      const res = await api.purchaseReturns.create(payload);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit supplier purchase return.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-purple-800/80 w-full max-w-4xl overflow-hidden my-4">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-purple-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/50 shadow-2xs">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Return Defective Shoe Cartons to Supplier
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Issue Supplier Debit Note & deduct defective pairs from inventory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-purple-900/30 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {formError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Return Mode Selection */}
          <div className="p-1 bg-slate-100 dark:bg-[#0B1120] rounded-xl flex max-w-md border border-slate-200 dark:border-[#1A263D]">
            <button
              type="button"
              onClick={() => setReturnMode('invoice')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                returnMode === 'invoice'
                  ? 'bg-white dark:bg-[#131D33] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Return from Purchase Invoice</span>
            </button>
            <button
              type="button"
              onClick={() => setReturnMode('direct')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                returnMode === 'direct'
                  ? 'bg-white dark:bg-[#131D33] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Direct Defective Stock Return</span>
            </button>
          </div>

          {/* Top Section: Supplier & Purchase Invoice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier Selector */}
            <div className="space-y-1.5 relative z-20">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Supplier / Manufacturer *</span>
              </label>
              <SupplierPicker
                suppliers={suppliers}
                selectedSupplierId={selectedSupplierId}
                supplierName={supplierName}
                onSelectSupplier={(supId, supName) => {
                  if (supId) {
                    handleSupplierChange(supId);
                  } else {
                    setSelectedSupplierId('');
                    setSupplierName(supName);
                    setSupplierBalance(0);
                  }
                }}
                onSupplierCreated={(newSup) => {
                  setSuppliers((prev) => [newSup, ...prev]);
                  setSelectedSupplierId(newSup.id);
                  setSupplierName(newSup.name);
                  setSupplierBalance(0);
                }}
                currencySymbol={currencySymbol}
                placeholder="Search Supplier to Debit (Type name, phone, #ID...)"
              />
              {selectedSupplierId && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                  <span>Current Payable Balance:</span>
                  <span className="font-bold text-rose-700 dark:text-rose-400">
                    {currencySymbol} {formatStockPrice(supplierBalance)}
                  </span>
                </p>
              )}
            </div>

            {/* If mode is invoice: Purchase Number Search */}
            {returnMode === 'invoice' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Original Purchase Invoice #</span>
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. PUR-000001"
                    value={purchaseNumberInput}
                    onChange={(e) => setPurchaseNumberInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleVerifyPurchase();
                      }
                    }}
                    className="flex-1 text-xs border border-slate-300 dark:border-[#1A263D] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-3 py-2.5 uppercase font-mono focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleVerifyPurchase()}
                    disabled={isVerifyingPurchase}
                    className="px-4 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 transition disabled:opacity-50 cursor-pointer active:scale-95"
                  >
                    {isVerifyingPurchase ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {purchaseVerifyError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">{purchaseVerifyError}</p>
                )}
                {verifiedPurchase && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                      Verified: {verifiedPurchase.purchaseNumber} ({verifiedPurchase.purchaseDate}) -{' '}
                      {verifiedPurchase.items?.length || 0} items
                    </span>
                  </p>
                )}
              </div>
            ) : (
              /* If direct mode: Return Date */
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>Return Date</span>
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-[#1A263D] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>
            )}
          </div>

          {/* If verified purchase has items, show quick picker to add more items from that invoice */}
          {returnMode === 'invoice' && verifiedPurchase && verifiedPurchase.items && (
            <div className="p-3 bg-slate-50 dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-[#1A263D]">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider block mb-2">
                Available items from Purchase #{verifiedPurchase.purchaseNumber}:
              </span>
              <div className="flex flex-wrap gap-2">
                {verifiedPurchase.items.map((pi: any) => {
                  const isAdded = returnItems.some((ri) => ri.productId === pi.productId);
                  return (
                    <button
                      key={pi.productId}
                      type="button"
                      disabled={isAdded || pi.returnableQuantity <= 0}
                      onClick={() => {
                        const defaultCartons = 1;
                        const defaultPairsPerCarton = pi.returnableQuantity >= 12 ? 12 : pi.returnableQuantity >= 6 ? 6 : pi.returnableQuantity;
                        const totalPairs = Math.min(pi.returnableQuantity, defaultCartons * defaultPairsPerCarton);

                        setReturnItems((prev) => [
                          ...prev,
                          {
                            productId: pi.productId,
                            article: pi.article,
                            sku: pi.sku,
                            barcode: pi.barcode,
                            currentStock: pi.currentStock,
                            purchasedQty: pi.purchasedQuantity,
                            alreadyReturnedQty: pi.alreadyReturnedQuantity,
                            cartonQuantity: defaultCartons,
                            pairsPerCarton: defaultPairsPerCarton,
                            totalPairs: totalPairs,
                            unitPurchasePrice: pi.unitPurchasePrice,
                            subtotal: Math.round(totalPairs * pi.unitPurchasePrice * 100) / 100,
                            defectType: 'Defective Sole / Cracked Outsole',
                          },
                        ]);
                      }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center space-x-1.5 transition ${
                        isAdded
                          ? 'bg-slate-200 dark:bg-[#131D33] text-slate-500 dark:text-slate-500 border-slate-300 dark:border-[#1A263D] opacity-60 cursor-not-allowed'
                          : pi.returnableQuantity <= 0
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-400 border-rose-200 dark:border-rose-900/40 opacity-60 cursor-not-allowed'
                          : 'bg-white dark:bg-[#0E1628] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-[#1A263D] hover:border-rose-300 cursor-pointer shadow-xs'
                      }`}
                    >
                      <Plus className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                      <span className="font-semibold">{pi.article}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        (Avail: {pi.returnableQuantity} prs / Cost: {currencySymbol} {formatStockPrice(pi.unitPurchasePrice)})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Direct Product Catalog Search Bar (when in direct mode) */}
          {returnMode === 'direct' && (
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Search Shoes from Catalog to Return</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type Shoe Article name, SKU, or scan barcode..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full text-xs border border-slate-300 dark:border-[#1A263D] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>

              {/* Search dropdown results */}
              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -6 }}
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: 'top center' }}
                    className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-[#0E1628] border border-slate-200 dark:border-[#1A263D] rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1A263D]"
                  >
                    {searchResults.map((prod) => (
                      <div
                        key={prod.id}
                        onClick={() => addDirectProduct(prod)}
                        className="p-2.5 hover:bg-rose-50 dark:hover:bg-[#131D33] cursor-pointer flex items-center justify-between transition text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{prod.article || prod.name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {prod.sku ? `SKU: ${prod.sku}` : ''} | Barcode: {prod.barcode || '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#131D33] font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold block">
                            Stock: {prod.totalStock ?? prod.total_stock ?? 0} prs
                          </span>
                          <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 font-mono">
                            Cost: {currencySymbol} {formatStockPrice(prod.costPrice ?? prod.cost_price ?? 0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Return Items List Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                <Package className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>Defective Carton Items for Return ({returnItems.length})</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Total Pairs to Deduct: <strong className="text-slate-900 dark:text-white">{totalPairs}</strong>
              </span>
            </div>

            {returnItems.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-[#1A263D] rounded-xl bg-slate-50 dark:bg-[#0B1120] text-slate-500 dark:text-slate-400 text-xs">
                <Package className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No defective shoe items added yet.</p>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {returnMode === 'invoice'
                    ? 'Verify a purchase invoice above to select items to return.'
                    : 'Search and select shoe models from the catalog above.'}
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-[#1A263D] rounded-xl overflow-hidden shadow-xs divide-y divide-slate-200 dark:divide-[#1A263D]">
                {returnItems.map((item, idx) => {
                  const isStockInsufficient = item.totalPairs > item.currentStock;

                  return (
                    <div key={idx} className="p-3.5 bg-white dark:bg-[#0E1628] hover:bg-slate-50/70 dark:hover:bg-[#131D33]/60 transition space-y-3">
                      {/* Item Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{item.article}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isStockInsufficient
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                                  : 'bg-slate-100 dark:bg-[#131D33] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#1A263D]'
                              }`}
                            >
                              In Stock: {item.currentStock} pairs
                            </span>
                          </div>
                          {(item.sku || item.barcode) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {item.sku ? `SKU: ${item.sku}` : ''}{' '}
                              {item.barcode ? `| Barcode: ${item.barcode}` : ''}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md transition cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Carton & Pairs Inputs */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                        {/* Carton Quantity */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Carton Count
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.cartonQuantity}
                            onChange={(e) =>
                              updateItem(idx, { cartonQuantity: parseInt(e.target.value, 10) || 1 })
                            }
                            className="w-full font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-[#1A263D] rounded-lg px-2.5 py-1.5 text-center focus:ring-1 focus:ring-rose-500"
                          />
                        </div>

                        {/* Pairs Per Carton */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Pairs / Carton
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.pairsPerCarton}
                            onChange={(e) =>
                              updateItem(idx, { pairsPerCarton: parseInt(e.target.value, 10) || 1 })
                            }
                            className="w-full font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-[#1A263D] rounded-lg px-2.5 py-1.5 text-center focus:ring-1 focus:ring-rose-500"
                          />
                          {/* Quick presets */}
                          <div className="flex space-x-1 mt-1">
                            {PRESET_CARTON_SIZES.map((size) => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => updateItem(idx, { pairsPerCarton: size })}
                                className={`text-[9px] px-1 py-0.5 rounded border ${
                                  item.pairsPerCarton === size
                                    ? 'bg-rose-500 text-white border-rose-600 font-bold'
                                    : 'bg-slate-100 dark:bg-[#131D33] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#1A263D] hover:bg-slate-200 dark:hover:bg-[#1A263D]'
                                }`}
                              >
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Total Pairs */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Total Pairs Out
                          </label>
                          <input
                            type="number"
                            min="1"
                            max={item.currentStock}
                            value={item.totalPairs}
                            onChange={(e) =>
                              updateItem(idx, { totalPairs: parseInt(e.target.value, 10) || 1 })
                            }
                            className={`w-full font-black rounded-lg px-2.5 py-1.5 text-center border ${
                              isStockInsufficient
                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                                : 'bg-slate-50 dark:bg-[#0B1120] border-slate-300 dark:border-[#1A263D] text-slate-900 dark:text-slate-100'
                            }`}
                          />
                        </div>

                        {/* Unit Purchase Price */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Unit Cost ({currencySymbol})
                          </label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            value={item.unitPurchasePrice}
                            onChange={(e) =>
                              updateItem(idx, {
                                unitPurchasePrice: Math.round(parseFloat(e.target.value) || 0),
                              })
                            }
                            className="w-full font-mono text-slate-800 dark:text-slate-200 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-[#1A263D] rounded-lg px-2.5 py-1.5 text-right focus:ring-1 focus:ring-rose-500"
                          />
                        </div>

                        {/* Subtotal Debit */}
                        <div className="text-right flex flex-col justify-end">
                          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                            Debit Subtotal
                          </label>
                          <p className="font-mono font-black text-sm text-rose-700 dark:text-rose-400 py-1.5">
                            {currencySymbol} {formatStockPrice(item.subtotal)}
                          </p>
                        </div>
                      </div>

                      {/* Defect Type Dropdown */}
                      <div className="flex items-center space-x-2 pt-1 border-t border-slate-100 dark:border-[#1A263D]">
                        <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-400 shrink-0">
                          Defect Classification:
                        </span>
                        <select
                          value={item.defectType}
                          onChange={(e) => updateItem(idx, { defectType: e.target.value })}
                          className="flex-1 text-xs border border-slate-200 dark:border-purple-400/40 rounded-md px-2 py-1 bg-white dark:bg-purple-500/20 text-slate-700 dark:text-purple-200 hover:bg-slate-50 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] focus:ring-1 focus:ring-purple-500 cursor-pointer"
                        >
                          {COMMON_DEFECT_TYPES.map((d) => (
                            <option key={d} value={d} className="dark:bg-[#120726] dark:text-purple-100">
                              {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      {isStockInsufficient && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold flex items-center space-x-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            Warning: Return quantity ({item.totalPairs} pairs) exceeds current inventory (
                            {item.currentStock} pairs).
                          </span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason & General Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Return Reason / Defect Summary *</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Sole separation and cracked sole on delivery"
                className="w-full text-xs border border-slate-300 dark:border-[#1A263D] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Internal Audit Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Batch inspected by Q.C. team, carton handed back to delivery driver"
                className="w-full text-xs border border-slate-300 dark:border-[#1A263D] bg-white dark:bg-[#0B1120] text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Financial & Inventory Impact Preview Card */}
          <div className="p-4.5 bg-slate-50 dark:bg-[#0B1120] rounded-2xl border border-rose-200/90 dark:border-rose-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-rose-900 dark:text-rose-300 block">
                  Supplier Account Debit Impact
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Debits supplier ledger, generates Debit Note, and restores accurate inventory.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold block">Total Debit Amount</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
                  {currencySymbol} {formatStockPrice(totalReturnDebit)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-rose-200/60 dark:border-rose-900/40 text-xs">
              <div className="p-2.5 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-[#1A263D]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Defective Shoe Units</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {totalCartons} Cartons ({totalPairs} Pairs)
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-[#1A263D]">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Current Supplier Payable</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">
                  {currencySymbol} {formatStockPrice(supplierBalance)}
                </span>
              </div>
              <div className="p-2.5 bg-white dark:bg-[#0E1628] rounded-xl border border-rose-200 dark:border-rose-900/60">
                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold block">
                  Net Balance after Debit
                </span>
                <span className="font-black text-rose-700 dark:text-rose-400 font-mono">
                  {currencySymbol} {formatStockPrice(Math.max(0, supplierBalance - totalReturnDebit))}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="px-6 py-4 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 mt-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || returnItems.length === 0}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-lg shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Processing Debit Note...</span>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>
                    Issue Debit Note ({currencySymbol} {formatStockPrice(totalReturnDebit)})
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
