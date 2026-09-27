import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.ts';

interface StockAdjustModalProps {
  product: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const StockAdjustModal: React.FC<StockAdjustModalProps> = ({
  product,
  onClose,
  onSuccess,
}) => {
  const [newTotalStock, setNewTotalStock] = useState<number>(product.totalStock);
  const [reason, setReason] = useState('Stock audit discrepancy');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const diff = newTotalStock - product.totalStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      return setError('Reason is mandatory for inventory audit trail.');
    }
    if (diff === 0) {
      return setError('New stock matches current stock. No change needed.');
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.inventory.adjust({
        productId: product.id,
        newStock: newTotalStock,
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to adjust stock.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md app-modal-container overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-900 dark:text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-200 dark:border-purple-400/30 rounded-xl shadow-2xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">Adjust Physical Stock</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white cursor-pointer transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-400 rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="font-bold text-sm text-slate-900 dark:text-white">{product.article || product.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Barcode: {product.barcode}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Current Stock</span>
              <div className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200 mt-1">
                {product.totalStock} pairs
              </div>
            </div>

            <div className="p-3 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200 dark:border-cyan-500/30 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-cyan-400">Stock Difference</span>
              <div
                className={`text-xl font-bold font-mono mt-1 ${
                  diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {diff > 0 ? `+${diff}` : diff}
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">New Total Count *</label>
            <input
              type="number"
              min="0"
              required
              value={newTotalStock}
              onChange={(e) => setNewTotalStock(parseInt(e.target.value, 10) || 0)}
              className="app-input w-full px-3 py-2 text-sm font-bold font-mono text-center"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Audit Reason / Investigation Notes *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Physical inventory count correction, damaged pair found, sample write-off..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="app-input w-full px-3 py-2 text-xs"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              This adjustment will be permanently recorded with your admin ID in the stock movements ledger.
            </p>
          </div>

          <div className="px-6 py-4 -mx-6 -mb-6 mt-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2 text-xs font-bold rounded-xl flex items-center space-x-2 text-white cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <span>{isSubmitting ? 'Recording...' : 'Commit Adjustment'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};
