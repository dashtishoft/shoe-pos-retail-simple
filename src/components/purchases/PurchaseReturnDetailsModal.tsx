import React from 'react';
import { X, Printer, Building2, Package, AlertTriangle, Calendar, User, FileText, CheckCircle2 } from 'lucide-react';
import { formatStockPrice } from '../../utils/priceFormat.ts';

interface PurchaseReturnDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  returnRecord: any;
  companySettings: any;
}

export const PurchaseReturnDetailsModal: React.FC<PurchaseReturnDetailsModalProps> = ({
  isOpen,
  onClose,
  returnRecord,
  companySettings,
}) => {
  if (!isOpen || !returnRecord) return null;

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const storeName = companySettings?.name || companySettings?.company_name || 'Shoe Store POS';
  const storeAddress = companySettings?.address || '';
  const storePhone = companySettings?.phone || '';

  const handlePrint = () => {
    window.print();
  };

  const totalPairs = (returnRecord.items || []).reduce(
    (sum: number, item: any) => sum + (parseInt(item.quantity, 10) || 0),
    0
  );
  const totalCartons = (returnRecord.items || []).reduce(
    (sum: number, item: any) => sum + (parseInt(item.carton_quantity, 10) || 1),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-purple-800/80 w-full max-w-3xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-purple-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/50 shadow-2xs">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                  Supplier Debit Note / Purchase Return
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60">
                  {returnRecord.return_number || returnRecord.returnNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Defective Shoe Cartons Return Voucher & Supplier Account Debit
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-purple-900/30 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable / Viewable Voucher Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-slate-800 dark:text-slate-200">
          {/* Top Info Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-[#0B1120] rounded-xl border border-slate-200 dark:border-purple-800/80 text-xs">
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Issuing Store
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{storeName}</p>
              {storeAddress && <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">{storeAddress}</p>}
              {storePhone && <p className="text-slate-600 dark:text-slate-400 text-[11px]">Phone: {storePhone}</p>}
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                Supplier / Vendor (Debited Account)
              </span>
              <p className="text-sm font-black text-rose-900 dark:text-rose-400 mt-0.5 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-rose-600 dark:text-rose-400 inline" />
                <span>{returnRecord.supplier_name || returnRecord.supplierName}</span>
              </p>
              {returnRecord.supplier_phone && (
                <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">Phone: {returnRecord.supplier_phone}</p>
              )}
            </div>
          </div>

          {/* Metadata Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-purple-800/80">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Return Date</span>
              </span>
              <p className="font-bold text-slate-900 dark:text-white mt-1">
                {returnRecord.return_date || returnRecord.returnDate || '-'}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-purple-800/80">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block flex items-center space-x-1">
                <FileText className="w-3 h-3 text-slate-400" />
                <span>Original Purchase</span>
              </span>
              <p className="font-bold text-slate-900 dark:text-white mt-1">
                {returnRecord.original_purchase_number || returnRecord.purchaseNumber || 'General Stock'}
              </p>
            </div>

            <div className="p-3 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-purple-800/80">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block flex items-center space-x-1">
                <Package className="w-3 h-3 text-slate-400" />
                <span>Defective Units</span>
              </span>
              <p className="font-bold text-slate-900 dark:text-white mt-1">
                {totalCartons} Cartons ({totalPairs} Pairs)
              </p>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/60">
              <span className="text-[11px] text-rose-700 dark:text-rose-400 font-semibold block flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                <span>Debit Amount</span>
              </span>
              <p className="font-black text-rose-700 dark:text-rose-400 text-sm mt-1">
                {currencySymbol} {formatStockPrice(returnRecord.total_debit_amount || returnRecord.totalDebitAmount || 0)}
              </p>
            </div>
          </div>

          {/* Defect Reason Notice */}
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50 text-xs">
            <span className="font-bold text-amber-900 dark:text-amber-300 block flex items-center space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Primary Reason for Supplier Return:</span>
            </span>
            <p className="text-amber-800 dark:text-amber-200 mt-1 font-medium">{returnRecord.reason || 'Defective carton batch'}</p>
            {returnRecord.notes && (
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-1.5 italic">
                Notes: {returnRecord.notes}
              </p>
            )}
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
              <Package className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Returned Defective Shoe Items</span>
            </h4>
            <div className="border border-slate-200 dark:border-purple-800/80 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-700 dark:text-white font-bold border-b border-slate-200 dark:border-purple-800/80">
                  <tr>
                    <th className="p-2.5">Shoe Article / Item</th>
                    <th className="p-2.5 text-center">Cartons</th>
                    <th className="p-2.5 text-center">Total Pairs</th>
                    <th className="p-2.5">Defect Classification</th>
                    <th className="p-2.5 text-right">Unit Cost</th>
                    <th className="p-2.5 text-right">Debit Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1A263D] bg-white dark:bg-[#0E1628]">
                  {(returnRecord.items || []).map((item: any, idx: number) => {
                    const cartonQty = item.carton_quantity || item.cartonQuantity || 1;
                    const pairs = item.quantity || 0;
                    const unitPrice = parseFloat(item.unit_purchase_price || item.unitPurchasePrice || 0);
                    const subtotal = parseFloat(item.subtotal || 0);
                    const defect = item.defect_type || item.defectType || 'Defective Carton';

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#131D33]/60 transition">
                        <td className="p-2.5">
                          <p className="font-bold text-slate-900 dark:text-white">{item.article || item.product_name || item.productName}</p>
                          {(item.sku || item.barcode) && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {item.sku ? `SKU: ${item.sku}` : ''} {item.barcode ? `| Barcode: ${item.barcode}` : ''}
                            </p>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-700 dark:text-slate-300">
                          {cartonQty} ctn
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-900 dark:text-white">
                          {pairs} prs
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-md border border-rose-200 dark:border-rose-900/60 text-[11px] font-semibold">
                            {defect.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {currencySymbol} {formatStockPrice(unitPrice)}
                        </td>
                        <td className="p-2.5 text-right font-bold font-mono text-rose-700 dark:text-rose-400">
                          {currencySymbol} {formatStockPrice(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-purple-800/80">
                  <tr>
                    <td colSpan={2} className="p-2.5 text-right text-xs uppercase text-slate-600 dark:text-slate-400">
                      Total Units:
                    </td>
                    <td className="p-2.5 text-center text-xs font-black text-slate-900 dark:text-white">
                      {totalPairs} Pairs
                    </td>
                    <td colSpan={2} className="p-2.5 text-right text-xs uppercase text-slate-600 dark:text-slate-400">
                      Total Account Debit:
                    </td>
                    <td className="p-2.5 text-right text-sm font-black font-mono text-rose-700 dark:text-rose-400">
                      {currencySymbol} {formatStockPrice(returnRecord.total_debit_amount || returnRecord.totalDebitAmount || 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Supplier Account Debit Statement */}
          <div className="p-4 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start space-x-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-rose-900 dark:text-rose-300">Supplier Ledger Debit Notice</h5>
              <p className="text-rose-800 dark:text-rose-200 text-[11px] mt-0.5">
                The total amount of <strong>{currencySymbol} {formatStockPrice(returnRecord.total_debit_amount || returnRecord.totalDebitAmount || 0)}</strong> has been debited to supplier account <strong>{returnRecord.supplier_name || returnRecord.supplierName}</strong>. 
                Inventory stock counts for all listed defective pairs have been deducted with stock ledger entry <code>PURCHASE_RETURN</code>.
              </p>
            </div>
          </div>

          {/* Signatures for formal voucher */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 dark:border-purple-800/80 text-xs">
            <div className="text-center pt-8 border-t border-slate-300 dark:border-purple-800/80">
              <p className="font-bold text-slate-800 dark:text-slate-200">Authorized Store Officer</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Shoe Store Quality Inspection</p>
            </div>
            <div className="text-center pt-8 border-t border-slate-300 dark:border-purple-800/80">
              <p className="font-bold text-slate-800 dark:text-slate-200">Supplier / Vendor Representative</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Defective Carton Pickup Acknowledgment</p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Issued by: {returnRecord.created_by_name || returnRecord.createdByName || 'Admin'}</span>
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-secondary px-3 py-1.5 text-xs font-semibold cursor-pointer flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Debit Note</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-primary px-4 py-1.5 text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
