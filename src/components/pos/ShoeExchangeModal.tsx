import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  AlertCircle,
  ArrowRight,
  X,
  Repeat,
  Minus,
  Plus,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { playAudioFeedback } from '../../utils/audio.ts';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import type { ActiveExchange, ExchangeItem } from '../../types.ts';

interface ShoeExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyExchange: (exchange: ActiveExchange) => void;
  currencySymbol: string;
}

export const ShoeExchangeModal: React.FC<ShoeExchangeModalProps> = ({
  isOpen,
  onClose,
  onApplyExchange,
  currencySymbol,
}) => {
  const [invoiceInput, setInvoiceInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedSale, setVerifiedSale] = useState<any | null>(null);
  const [selectedQtys, setSelectedQtys] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('Size replacement (e.g. 41 -> 42)');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInvoiceInput('');
      setVerifiedSale(null);
      setSelectedQtys({});
      setReason('Size replacement (e.g. 41 -> 42)');
      setErrorMessage(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const inv = invoiceInput.trim();
    if (!inv) return;

    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await api.returns.verifyInvoice(inv);
      const sale = res.sale;
      const items = res.items || sale?.items || [];
      const saleWithItems = { ...sale, items };
      setVerifiedSale(saleWithItems);

      // Pre-select 1 qty for the first item that has returnable stock
      const initialQtys: Record<number, number> = {};
      let firstSelected = false;
      items.forEach((item: any) => {
        if (!firstSelected && item.returnableQuantity > 0) {
          initialQtys[item.id] = 1;
          firstSelected = true;
        } else {
          initialQtys[item.id] = 0;
        }
      });
      setSelectedQtys(initialQtys);
      playAudioFeedback.barcodeScan();
    } catch (err: any) {
      playAudioFeedback.warning();
      setErrorMessage(err.message || 'Invoice not found or invalid.');
      setVerifiedSale(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQtyChange = (itemId: number, delta: number, maxReturnable: number) => {
    const current = selectedQtys[itemId] || 0;
    const next = Math.max(0, Math.min(current + delta, maxReturnable));
    setSelectedQtys((prev) => ({ ...prev, [itemId]: next }));
  };

  const items = verifiedSale?.items || [];

  // Calculate total exchange credit
  const totalExchangeCredit = items.reduce((acc: number, item: any) => {
    const qty = selectedQtys[item.id] || 0;
    const netUnitPrice =
      item.soldQuantity > 0
        ? (item.subtotal - (item.discount || 0)) / item.soldQuantity
        : item.unitPrice;
    return acc + qty * netUnitPrice;
  }, 0);

  const totalReturnCount = Object.values(selectedQtys).reduce((a: number, b: number) => a + (Number(b) || 0), 0);

  const handleConfirmExchange = () => {
    if (!verifiedSale) return;

    const exchangeItems: ExchangeItem[] = [];
    for (const item of items) {
      const qty = selectedQtys[item.id] || 0;
      if (qty > 0) {
        const netUnitPrice =
          item.soldQuantity > 0
            ? (item.subtotal - (item.discount || 0)) / item.soldQuantity
            : item.unitPrice;
        exchangeItems.push({
          saleItemId: item.id,
          productId: item.productId,
          article: item.article || item.productName || 'Shoe',
          productName: item.productName || item.article || 'Shoe',
          sku: item.sku,
          barcode: item.barcode,
          quantity: qty,
          unitRefundPrice: netUnitPrice,
          subtotal: Math.round(qty * netUnitPrice * 100) / 100,
        });
      }
    }

    if (exchangeItems.length === 0) {
      setErrorMessage('Please select at least 1 shoe item to return/exchange.');
      return;
    }

    const activeExchange: ActiveExchange = {
      originalSaleId: verifiedSale.id,
      originalInvoiceNumber: verifiedSale.invoiceNumber,
      originalSaleDate: verifiedSale.saleDate,
      customerId: verifiedSale.customerId || null,
      customerName: verifiedSale.customerName,
      customerPhone: verifiedSale.customerPhone,
      reason: reason.trim() || 'Direct Shoe Exchange at POS',
      items: exchangeItems,
    };

    playAudioFeedback.barcodeScan();
    onApplyExchange(activeExchange);
    onClose();
  };

  const reasonChips = [
    'Size replacement (e.g. 41 -> 42)',
    'Different style / model',
    'Color change',
    'Fit issue / discomfort',
    'Customer preference',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl app-modal-container flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-900 dark:text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-900/50 rounded-xl shadow-2xs">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <span>Direct Shoe Exchange</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-blue-900/50 rounded-full font-semibold">
                  POS Combined Flow
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Return customer shoe &amp; scan replacement with automatic net difference calculation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Step 1: Invoice Search Bar */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              1. Original Receipt / Invoice Number
            </label>
            <form onSubmit={handleLookup} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan receipt barcode or enter invoice # (e.g. INV-000001)..."
                  value={invoiceInput}
                  onChange={(e) => setInvoiceInput(e.target.value)}
                  className="app-input w-full pl-[2.125rem] pr-8 py-2.5 text-xs font-mono font-bold"
                />
                {invoiceInput && (
                  <button
                    type="button"
                    onClick={() => setInvoiceInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 p-1 cursor-pointer"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={isVerifying || !invoiceInput.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold border border-purple-400/40 dark:border-purple-400/50 flex items-center space-x-1.5 shrink-0 shadow-md shadow-purple-600/25 transition disabled:opacity-50 cursor-pointer active:scale-95"
              >
                <Search className="w-4 h-4" />
                <span>{isVerifying ? 'Verifying...' : 'Look Up Invoice'}</span>
              </button>
            </form>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-center space-x-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Step 2: Invoice Details & Select Shoes to Return */}
          {verifiedSale && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Sale Info Card */}
              <div className="p-3.5 bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Invoice:</span>{' '}
                  <strong className="text-slate-900 dark:text-white font-mono">{verifiedSale.invoiceNumber}</strong>
                  <span className="mx-2 text-slate-300 dark:text-slate-700">|</span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Date:</span>{' '}
                  <span className="text-slate-800 dark:text-slate-200">{verifiedSale.saleDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Customer:</span>{' '}
                  <strong className="text-slate-900 dark:text-white">{verifiedSale.customerName}</strong>
                  {verifiedSale.customerPhone && verifiedSale.customerPhone !== '-' && (
                    <span className="text-slate-500 dark:text-slate-400 font-mono ml-1">({verifiedSale.customerPhone})</span>
                  )}
                </div>
              </div>

              {/* Shoe items table */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  2. Select Shoe(s) Customer is Returning
                </label>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {items.map((item: any) => {
                    const isFullyReturned = item.returnableQuantity <= 0;
                    const qty = selectedQtys[item.id] || 0;
                    const netUnitPrice =
                      item.soldQuantity > 0
                        ? (item.subtotal - (item.discount || 0)) / item.soldQuantity
                        : item.unitPrice;
                    const isSelected = qty > 0;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 flex items-center justify-between gap-3 transition ${
                          isSelected
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-l-4 border-amber-500'
                            : isFullyReturned
                            ? 'bg-slate-50/60 dark:bg-slate-900/40 opacity-60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {item.article || item.productName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex flex-wrap gap-x-3 mt-0.5">
                            {item.barcode && <span>Barcode: {item.barcode}</span>}
                            <span>Sold: {item.soldQuantity}</span>
                            <span>Returned: {item.alreadyReturnedQuantity}</span>
                            <span className={item.returnableQuantity > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}>
                              Returnable: {item.returnableQuantity}
                            </span>
                          </div>
                        </div>

                        {/* Price credit per unit */}
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {currencySymbol} {formatStockPrice(netUnitPrice)}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Credit / Pair</div>
                        </div>

                        {/* Quantity Selector */}
                        <div className="shrink-0">
                          {isFullyReturned ? (
                            <span className="text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-md">
                              Already Returned
                            </span>
                          ) : (
                            <div className="flex items-center space-x-1.5 bg-white dark:bg-[#0A0E1A] border border-slate-200 dark:border-slate-700 rounded-lg p-1 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(item.id, -1, item.returnableQuantity)}
                                disabled={qty === 0}
                                className="p-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center font-bold font-mono text-sm text-slate-900 dark:text-white">
                                {qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQtyChange(item.id, 1, item.returnableQuantity)}
                                disabled={qty >= item.returnableQuantity}
                                className="p-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Reason for Exchange */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  3. Reason for Exchange
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {reasonChips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setReason(chip)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition cursor-pointer ${
                        reason === chip
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 font-bold'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Specify reason (e.g. Size 41 was too tight, exchanging for Size 42)..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0A0E1A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none"
                />
              </div>

              {/* Exchange Credit Banner */}
              <div className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-300/80 dark:border-amber-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase font-extrabold tracking-wider text-amber-800 dark:text-amber-300">
                    Total Return Credit (Deducted from POS Cart)
                  </div>
                  <div className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    {totalReturnCount} shoe {totalReturnCount === 1 ? 'pair' : 'pairs'} selected for return
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-amber-900 dark:text-amber-200">
                  {currencySymbol} {formatStockPrice(totalExchangeCredit)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmExchange}
            disabled={!verifiedSale || totalReturnCount === 0}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold border border-purple-400/40 dark:border-purple-400/50 flex items-center space-x-2 disabled:opacity-50 shadow-md shadow-purple-600/25 transition cursor-pointer active:scale-95"
          >
            <span>Apply Exchange to POS Cart</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
