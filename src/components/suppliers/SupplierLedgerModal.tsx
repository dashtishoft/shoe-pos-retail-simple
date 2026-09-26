import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  CreditCard,
  Truck,
  AlertTriangle,
  Printer,
  RefreshCw,
  X,
  Trash2,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import { SupplierPaymentModal } from './SupplierPaymentModal.tsx';
import { useScrollActiveTab } from '../../hooks/useScrollActiveTab.ts';

interface SupplierLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: number | null;
  currencySymbol: string;
  companySettings?: any;
  isAdmin: boolean;
  onPaymentRecorded?: () => void;
}

export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({
  isOpen,
  onClose,
  supplierId,
  currencySymbol,
  companySettings: _companySettings,
  isAdmin,
  onPaymentRecorded,
}) => {
  const [activeTab, setActiveTab] = useState<'statement' | 'payments' | 'purchases' | 'returns'>('statement');
  const { containerRef: supplierTabContainerRef } = useScrollActiveTab<HTMLDivElement>(activeTab, {
    padding: 16,
    behavior: 'smooth',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [ledgerData, setLedgerData] = useState<{
    supplier: any;
    summary: any;
    transactions: any[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Quick Pay Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && supplierId) {
      loadLedger();
    }
  }, [isOpen, supplierId]);

  const loadLedger = async () => {
    if (!supplierId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.suppliers.getLedger(supplierId);
      setLedgerData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier ledger.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm('Are you sure you want to delete this payment voucher? This will increase the supplier payable balance accordingly.')) {
      return;
    }

    setDeletingPaymentId(paymentId);
    try {
      await api.suppliers.deletePayment(paymentId);
      await loadLedger();
      if (onPaymentRecorded) onPaymentRecorded();
    } catch (err: any) {
      alert(err.message || 'Failed to delete payment voucher.');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handlePrintStatement = () => {
    window.print();
  };

  if (!isOpen) return null;

  const supplier = ledgerData?.supplier;
  const summary = ledgerData?.summary || {
    totalPurchasesCount: 0,
    totalReturnsCount: 0,
    totalPaymentsCount: 0,
    totalPurchased: 0,
    totalDebitReturned: 0,
    totalPaymentsPaid: 0,
    totalDebited: 0,
    netBalance: 0,
  };
  const transactions = ledgerData?.transactions || [];

  const paymentsOnly = transactions.filter((t) => t.type === 'PAYMENT');
  const purchasesOnly = transactions.filter((t) => t.type === 'PURCHASE');
  const returnsOnly = transactions.filter((t) => t.type === 'RETURN');

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-purple-900/60 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col my-6 max-h-[92vh]"
        >
          {/* Top Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-purple-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-purple-950/20">
            <div className="flex items-start space-x-3">
              <span className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/50 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {supplier?.name || 'Supplier'} — Account Ledger
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wide px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    Vendor Khata
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                  {supplier?.phone && (
                    <span className="flex items-center">
                      <Phone className="w-3 h-3 mr-1" />
                      {supplier.phone}
                    </span>
                  )}
                  {supplier?.email && (
                    <span className="flex items-center">
                      <Mail className="w-3 h-3 mr-1" />
                      {supplier.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-center">
              <button
                onClick={handlePrintStatement}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-purple-400/40 bg-white dark:bg-purple-500/20 text-slate-700 dark:text-purple-200 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-purple-500/30 text-xs font-semibold shadow-2xs dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] transition cursor-pointer"
                title="Print Vendor Statement"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print Statement</span>
              </button>

              <button
                onClick={() => setIsPayModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer active:scale-95"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Record Payment</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-purple-900/30">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-purple-900/40">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Purchases (+ Credit)
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {currencySymbol} {formatStockPrice(summary.totalPurchased)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {summary.totalPurchasesCount} orders received
              </div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
              <div className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                Total Returns (- Debit)
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-rose-700 dark:text-rose-400 mt-0.5">
                {currencySymbol} {formatStockPrice(summary.totalDebitReturned)}
              </div>
              <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                {summary.totalReturnsCount} debit returns
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Total Paid (- Debit)
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">
                {currencySymbol} {formatStockPrice(summary.totalPaymentsPaid)}
              </div>
              <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                {summary.totalPaymentsCount} payment vouchers
              </div>
            </div>

            <div className={`p-3 rounded-xl border ${summary.netBalance > 0 ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60' : 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Net Balance Payable
              </div>
              <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${summary.netBalance > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {currencySymbol} {formatStockPrice(summary.netBalance)}
              </div>
              <div className="text-[11px] font-semibold mt-0.5">
                {summary.netBalance > 0 ? (
                  <span className="text-amber-700 dark:text-amber-400">Amount owed to supplier</span>
                ) : (
                  <span className="text-emerald-700 dark:text-emerald-400">Account 100% Cleared ✓</span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Tabs - Responsive Scrollable Underline Navigation */}
          <div 
            ref={supplierTabContainerRef}
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            className="px-5 border-b border-slate-200 dark:border-purple-900/40 flex items-center space-x-2 overflow-x-auto no-scrollbar scrollbar-none tab-scrollbar-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-thumb]:hidden [&::-webkit-scrollbar-track]:hidden bg-slate-50/50 dark:bg-slate-900"
          >
            {[
              { id: 'statement', label: 'All Transactions (Ledger)', count: transactions.length },
              { id: 'payments', label: 'Payments Made', count: paymentsOnly.length },
              { id: 'purchases', label: 'Purchases (Bills)', count: purchasesOnly.length },
              { id: 'returns', label: 'Returns (Debit Notes)', count: returnsOnly.length },
            ].map((tab) => (
              <button
                key={tab.id}
                id={`supplier-ledger-tab-${tab.id}`}
                data-active={activeTab === tab.id}
                data-tab={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`tab-underline-link relative py-3.5 px-4 text-xs font-semibold transition-colors duration-300 flex items-center space-x-1.5 whitespace-nowrap cursor-pointer shrink-0 ${
                  activeTab === tab.id
                    ? 'active text-purple-600 dark:text-purple-400 font-bold'
                    : 'text-slate-500 hover:text-purple-600 dark:text-slate-400 dark:hover:text-purple-300'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-colors duration-200 ${
                  activeTab === tab.id
                    ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {tab.count}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="supplierLedgerActiveUnderline"
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                )}
              </button>
            ))}

            {/* Scroll End Buffer Spacer: Ensures the last tab is 100% visible and never clipped */}
            <div className="tab-end-spacer shrink-0 w-8 sm:w-10 h-1 pointer-events-none self-stretch" aria-hidden="true" role="presentation" />
          </div>

          {/* Tab Content Table */}
          <div className="p-4 sm:p-5 flex-1 overflow-y-auto min-h-[280px]">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-purple-500 mb-2" />
                <p className="text-xs font-medium">Loading ledger statement...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-xs">
                {error}
              </div>
            ) : activeTab === 'statement' ? (
              /* All Transactions Chronological Statement */
              <div className="overflow-x-auto border border-slate-200 dark:border-purple-900/40 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-purple-950/40 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-purple-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Voucher / Ref #</th>
                      <th className="py-2.5 px-3">Particulars &amp; Remarks</th>
                      <th className="py-2.5 px-3 text-right">Debit (- Reduce)</th>
                      <th className="py-2.5 px-3 text-right">Credit (+ Bill)</th>
                      <th className="py-2.5 px-3 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          No transactions found for this supplier.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-purple-950/20 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {tx.type === 'PURCHASE' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
                                <Truck className="w-2.5 h-2.5" /> Purchase
                              </span>
                            ) : tx.type === 'PAYMENT' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
                                <CreditCard className="w-2.5 h-2.5" /> Payment
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
                                <AlertTriangle className="w-2.5 h-2.5" /> Return
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {tx.refNo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            <div>{tx.description}</div>
                            {tx.notes && <div className="text-[11px] text-slate-400 italic">{tx.notes}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {tx.debit > 0 ? `${currencySymbol} ${formatStockPrice(tx.debit)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {tx.credit > 0 ? `${currencySymbol} ${formatStockPrice(tx.credit)}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {currencySymbol} {formatStockPrice(tx.runningBalance ?? 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === 'payments' ? (
              /* Payments Only List */
              <div className="overflow-x-auto border border-slate-200 dark:border-purple-900/40 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-purple-950/40 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-purple-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Voucher #</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference / Cheque #</th>
                      <th className="py-2.5 px-3">Remarks</th>
                      <th className="py-2.5 px-3 text-right">Amount Paid</th>
                      {isAdmin && <th className="py-2.5 px-3 text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                    {paymentsOnly.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          No payment vouchers recorded for this supplier yet. Click "Record Payment" to log a voucher.
                        </td>
                      </tr>
                    ) : (
                      paymentsOnly.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-purple-950/20 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {p.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {p.refNo}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {p.paymentMethod || 'CASH'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {p.referenceNumber || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {p.notes || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {currencySymbol} {formatStockPrice(p.debit)}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleDeletePayment(p.id)}
                                disabled={deletingPaymentId === p.id}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                title="Delete payment voucher"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === 'purchases' ? (
              /* Purchases Only List */
              <div className="overflow-x-auto border border-slate-200 dark:border-purple-900/40 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-purple-950/40 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-purple-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Purchase Number</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-right">Invoice Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                    {purchasesOnly.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400">
                          No purchases on record for this supplier.
                        </td>
                      </tr>
                    ) : (
                      purchasesOnly.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-purple-950/20 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {p.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            {p.refNo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {p.notes || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                            {currencySymbol} {formatStockPrice(p.credit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Returns Only List */
              <div className="overflow-x-auto border border-slate-200 dark:border-purple-900/40 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 dark:bg-purple-950/40 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-purple-900/40">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Return / Debit Note #</th>
                      <th className="py-2.5 px-3">Defect Reason</th>
                      <th className="py-2.5 px-3 text-right">Debit Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                    {returnsOnly.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-slate-400">
                          No defective carton returns on record for this supplier.
                        </td>
                      </tr>
                    ) : (
                      returnsOnly.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-purple-950/20 transition">
                          <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {r.date}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {r.refNo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {r.notes || 'Defective footwear shipment return'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {currencySymbol} {formatStockPrice(r.debit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 border-t border-slate-200 dark:border-purple-900/40 bg-slate-50 dark:bg-purple-950/20 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing statement transactions for <span className="font-bold text-slate-800 dark:text-white">{supplier?.name}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close Ledger
            </button>
          </div>
        </motion.div>
      </div>

      {/* Record Payment Child Modal */}
      {isPayModalOpen && supplier && (
        <SupplierPaymentModal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          supplier={supplier}
          currencySymbol={currencySymbol}
          onSuccess={() => {
            loadLedger();
            if (onPaymentRecorded) onPaymentRecorded();
          }}
        />
      )}
    </AnimatePresence>
  );
};
