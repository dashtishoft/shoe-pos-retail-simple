import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Filter, ArrowUpRight, ArrowDownLeft, RotateCcw, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { api } from '../../services/api.ts';

export const StockLedgerView: React.FC = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | ''>('');
  const [movementType, setMovementType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadLedger();
  }, [selectedProduct, movementType]);

  const loadProducts = async () => {
    try {
      const res = await api.products.list();
      setProducts(res.products || []);
    } catch (e) {
      console.error(e);
    }
  };

  const isRefreshingRef = useRef(false);

  const loadLedger = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsLoading(true);
    try {
      const res = await api.inventory.ledger({
        productId: selectedProduct || undefined,
        movementType: movementType || undefined,
        limit: 100,
      });
      setMovements(res.movements || []);
    } catch (e) {
      console.error(e);
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
    }
  };

  const getBadge = (type: string) => {
    switch (type) {
      case 'SALE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <ArrowDownLeft className="w-3 h-3" />
            <span>POS SALE</span>
          </span>
        );
      case 'PURCHASE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <ArrowUpRight className="w-3 h-3" />
            <span>PURCHASE</span>
          </span>
        );
      case 'SALE_RETURN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-cyan-400 border border-blue-200 dark:border-cyan-500/40">
            <RotateCcw className="w-3 h-3" />
            <span>RETURN</span>
          </span>
        );
      case 'ADJUSTMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <SlidersHorizontal className="w-3 h-3" />
            <span>ADJUSTMENT</span>
          </span>
        );
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{type}</span>;
    }
  };

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-purple-800/80 shadow-xs dark:text-white transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-200 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-2xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Inventory Stock Audit Ledger
              </h2>
              <span className="bg-blue-100 dark:bg-purple-500/30 text-blue-700 dark:text-purple-200 border border-blue-200 dark:border-purple-400/40 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wide">
                Stock Movements &amp; Logs
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/80 mt-0.5">
              Immutable log of all stock movements (Sales, Purchases, Returns, Adjustments)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadLedger}
          disabled={isLoading}
          title={isLoading ? "Refreshing ledger..." : "Refresh Ledger"}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-xs font-semibold active:scale-[0.98] self-start sm:self-auto cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-purple-300 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 flex flex-wrap gap-3 items-center text-xs bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border border-slate-200/90 dark:border-purple-800/80 shadow-xs rounded-2xl transition-colors dark:text-white">
        <div className="flex items-center space-x-2 text-slate-700 dark:text-purple-200 font-bold">
          <div className="p-1.5 bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-100 dark:border-purple-400/30 rounded-lg shadow-2xs">
            <Filter className="w-3.5 h-3.5" />
          </div>
          <span className="uppercase tracking-wider text-[11px]">Filters:</span>
        </div>

        <select
          value={selectedProduct}
          onChange={(e) => setSelectedProduct(e.target.value ? Number(e.target.value) : '')}
          className="px-3.5 py-2 bg-slate-50 dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 rounded-xl text-xs font-medium text-slate-800 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] focus:border-blue-600 dark:focus:border-purple-400 cursor-pointer transition shadow-2xs"
        >
          <option value="" className="dark:bg-[#120726] dark:text-purple-100">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id} className="dark:bg-[#120726] dark:text-purple-100">
              {p.article || p.name} {p.barcode ? `(${p.barcode})` : ''}
            </option>
          ))}
        </select>

        <select
          value={movementType}
          onChange={(e) => setMovementType(e.target.value)}
          className="px-3.5 py-2 bg-slate-50 dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 rounded-xl text-xs font-medium text-slate-800 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] focus:border-blue-600 dark:focus:border-purple-400 cursor-pointer transition shadow-2xs"
        >
          <option value="" className="dark:bg-[#120726] dark:text-purple-100">All Movement Types</option>
          <option value="SALE" className="dark:bg-[#120726] dark:text-purple-100">POS Sales</option>
          <option value="PURCHASE" className="dark:bg-[#120726] dark:text-purple-100">Stock Purchases</option>
          <option value="SALE_RETURN" className="dark:bg-[#120726] dark:text-purple-100">Customer Returns</option>
          <option value="ADJUSTMENT" className="dark:bg-[#120726] dark:text-purple-100">Physical Adjustments</option>
        </select>

        {(selectedProduct !== '' || movementType !== '') && (
          <button
            type="button"
            onClick={() => {
              setSelectedProduct('');
              setMovementType('');
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:border dark:border-purple-400/40 transition cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-[#0E1628] rounded-2xl border border-slate-200/90 dark:border-purple-800/60 shadow-xs overflow-hidden transition-colors">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-purple-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-200 dark:border-purple-400/30 rounded-xl shadow-2xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-white uppercase tracking-wider">
                Audit Records
              </span>
              <span className="bg-slate-200/80 dark:bg-purple-500/30 text-slate-700 dark:text-purple-200 border border-slate-300 dark:border-purple-400/40 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                {movements.length}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-purple-200/70 font-medium">
            Immutable physical inventory transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-700 dark:text-white font-bold border-b border-slate-200 dark:border-purple-800/80 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Article</th>
                <th className="py-3.5 px-3">Movement Type</th>
                <th className="py-3.5 px-3 text-center">Prev Stock</th>
                <th className="py-3.5 px-3 text-center">Quantity Delta</th>
                <th className="py-3.5 px-3 text-center">New Stock</th>
                <th className="py-3.5 px-3">Reference / Order</th>
                <th className="py-3.5 px-3">Recorded By</th>
                <th className="py-3.5 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                      <p className="font-medium text-xs">Loading stock movements...</p>
                    </div>
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No movements recorded yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isPositive = m.quantityDelta > 0;

                  return (
                    <tr key={m.id} className="table-row-hover">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{m.article || m.productName}</div>
                      </td>

                      <td className="py-3.5 px-3">{getBadge(m.movementType)}</td>

                      <td className="py-3.5 px-3 text-center font-mono text-slate-600 dark:text-slate-300">
                        {m.previousStock}
                      </td>

                      <td className="py-3.5 px-3 text-center font-mono font-bold">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            isPositive
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                          }`}
                        >
                          {isPositive ? `+${m.quantityDelta}` : m.quantityDelta}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                        {m.newStock}
                      </td>

                      <td className="py-3.5 px-3 font-mono font-semibold text-blue-600 dark:text-purple-300">
                        {m.referenceNumber || '-'}
                      </td>

                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                        {m.userName || 'System'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 italic max-w-xs truncate">
                        {m.notes || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
