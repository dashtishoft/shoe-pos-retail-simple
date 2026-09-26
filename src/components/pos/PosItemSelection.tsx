import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Boxes,
  Plus,
  Minus,
  Check,
  AlertTriangle,
  ShoppingCart,
  X,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import { BrandLogo } from '../common/BrandLogo.tsx';
import type { CartonPack, PosAddToCartPayload } from '../../types.ts';

/**
 * =========================================================================================
 * CHIP GENERATION RULE & LOGIC (RELATIVE MULTIPLIER SPECIFICATION):
 * 
 * 1. DYNAMIC IN-CODE DERIVATION:
 *    Rather than hardcoding static pair counts in database records, quantity chips are
 *    derived dynamically in application code relative to whichever carton pack is active.
 * 
 * 2. MULTIPLIER ARRAY RULE:
 *    The chip multiplier array must strictly follow this relative rule for any active pack:
 *    CARTON_MULTIPLIERS = [0.5, 1, 2, 5, 10]
 * 
 * 3. DYNAMIC CALCULATION & DISPLAY:
 *    For any active pack with `pairs_per_carton`:
 *      - Multiplier label: multiplier === 1 ? "1 Carton" : `${multiplier} Cartons`
 *      - Total pairs for chip: chipPairs = multiplier * pairs_per_carton
 *      - Chip badge label: `${multiplier} ${multiplier === 1 ? 'Carton' : 'Cartons'} (${chipPairs} ${chipPairs === 1 ? 'Pair' : 'Pairs'})`
 * 
 *    Examples:
 *      * 12-Pair Pack:
 *        - 0.5 -> "0.5 Carton (6 Pairs)"
 *        - 1   -> "1 Carton (12 Pairs)"
 *        - 2   -> "2 Cartons (24 Pairs)"
 *        - 5   -> "5 Cartons (60 Pairs)"
 *        - 10  -> "10 Cartons (120 Pairs)"
 * 
 *      * 24-Pair Wholesale Pack:
 *        - 0.5 -> "0.5 Carton (12 Pairs)"
 *        - 1   -> "1 Carton (24 Pairs)"
 *        - 2   -> "2 Cartons (48 Pairs)"
 *        - 5   -> "5 Cartons (120 Pairs)"
 *        - 10  -> "10 Cartons (240 Pairs)"
 * 
 * 4. LIVE CALCULATIONS:
 *    - Clicking a chip immediately sets `selectedCartons` to that multiplier.
 *    - Manual decimal input allows precision cartons (step="0.5", min="0.5").
 *    - Total Pairs = selectedCartons * pairs_per_carton
 *    - Total Price = selectedCartons * price_per_carton
 *                  = selectedCartons * (pairs_per_carton * unit_price)
 * 
 * 5. EXPECTED PAYLOAD PASSED ON ADD TO ORDER / CART:
 *    { productId, cartonPackId, cartons, totalPairs, totalPrice }
 * =========================================================================================
 */

// Relative carton multipliers strictly adhering to prompt specification [0.5, 1, 2, 5, 10]
export const CARTON_MULTIPLIERS = [0.5, 1, 2, 5, 10] as const;

// Default standard packing configurations if database has no custom configs yet
export const DEFAULT_CARTON_PACKS: CartonPack[] = [
  { id: 1, pack_name: 'Half Carton (6 Pairs)', pairs_per_carton: 6, is_default: false },
  { id: 2, pack_name: 'Standard Carton (12 Pairs)', pairs_per_carton: 12, is_default: true },
  { id: 3, pack_name: 'Wholesale Pack (24 Pairs)', pairs_per_carton: 24, is_default: false },
  { id: 4, pack_name: 'Master Carton (36 Pairs)', pairs_per_carton: 36, is_default: false },
];

export interface PosItemSelectionProps {
  /** Selected shoe product record from POS catalog/lookup */
  product: any | null;
  /** Carton packing configurations from carton_packs table/API */
  cartonPacks?: CartonPack[];
  /** Modal open state when used as overlay dialog */
  isOpen?: boolean;
  /** Close handler when modal is dismissed */
  onClose?: () => void;
  /** Callback passing the exact expected payload { productId, cartonPackId, cartons, totalPairs, totalPrice } */
  onAddToCart?: (payload: PosAddToCartPayload) => void;
  /** Alias callback for onAddToCart for compatibility */
  onAddToOrder?: (payload: PosAddToCartPayload) => void;
  /** Active currency symbol (e.g. Rs., $, AED) */
  currencySymbol?: string;
  /** If true, renders inline without modal container */
  inline?: boolean;
  /** Optional custom title */
  title?: string;
}

export const PosItemSelection: React.FC<PosItemSelectionProps> = ({
  product,
  cartonPacks = DEFAULT_CARTON_PACKS,
  isOpen = true,
  onClose,
  onAddToCart,
  onAddToOrder,
  currencySymbol = 'Rs.',
  inline = false,
  title = 'Select Carton Pack & Quantity',
}) => {
  // Normalize carton packs list and ensure fallback
  const resolvedPacks: CartonPack[] = useMemo(() => {
    if (cartonPacks && cartonPacks.length > 0) {
      return cartonPacks;
    }
    return DEFAULT_CARTON_PACKS;
  }, [cartonPacks]);

  // Find initial default pack (is_default === true, or first in list)
  const defaultPack = useMemo(() => {
    return resolvedPacks.find((p) => p.is_default || (p as any).isDefault) || resolvedPacks[0] || DEFAULT_CARTON_PACKS[1];
  }, [resolvedPacks]);

  // Selected pack state
  const [selectedPackId, setSelectedPackId] = useState<number>(defaultPack.id);

  // Selected cartons state: strictly defaults to 1 Carton
  const [selectedCartons, setSelectedCartons] = useState<number>(1);
  const [cartonsInput, setCartonsInput] = useState<string>('1');

  // Reset pack selection and default active quantity to 1 Carton when product changes
  useEffect(() => {
    if (product) {
      setSelectedPackId(defaultPack.id);
      setSelectedCartons(1);
      setCartonsInput('1');
    }
  }, [product, defaultPack]);

  // Active carton pack record
  const activePack: CartonPack = useMemo(() => {
    return resolvedPacks.find((p) => p.id === selectedPackId) || defaultPack;
  }, [resolvedPacks, selectedPackId, defaultPack]);

  const pairsPerCarton = activePack.pairs_per_carton || (activePack as any).pairsPerCarton || 12;

  /**
   * 1. Dynamic Chip Generation Rule:
   * Generate quantity chips dynamically relative to activePack.pairs_per_carton
   * using the multiplier rule [0.5, 1, 2, 5, 10].
   */
  const dynamicChips = useMemo(() => {
    return CARTON_MULTIPLIERS.map((multiplier) => {
      const calculatedPairs = Math.round(multiplier * pairsPerCarton * 10) / 10;
      const cartonLabel = multiplier === 1 ? '1 Carton' : `${multiplier} Cartons`;
      const pairsLabel = `${calculatedPairs} ${calculatedPairs === 1 ? 'Pair' : 'Pairs'}`;
      const displayText = `${cartonLabel} (${pairsLabel})`;

      return {
        multiplier,
        calculatedPairs,
        cartonLabel,
        pairsLabel,
        displayText,
      };
    });
  }, [pairsPerCarton]);

  // Calculate product unit selling price per single pair
  const unitPrice: number = useMemo(() => {
    if (!product) return 0;
    const rawSale =
      product.salePrice !== undefined && product.salePrice !== null
        ? product.salePrice
        : product.sale_price !== undefined && product.sale_price !== null
        ? product.sale_price
        : product.maxSalePrice !== undefined && product.maxSalePrice !== null
        ? product.maxSalePrice
        : product.max_sale_price !== undefined && product.max_sale_price !== null
        ? product.max_sale_price
        : product.unitPrice || 0;

    return Math.max(0, Math.round(Number(rawSale)));
  }, [product]);

  // Price per carton = pairs_per_carton * unitPrice
  const pricePerCarton: number = useMemo(() => {
    return pairsPerCarton * unitPrice;
  }, [pairsPerCarton, unitPrice]);

  // Live Calculations:
  // Total Pairs = selectedCartons * pairs_per_carton
  const totalPairs: number = useMemo(() => {
    const raw = selectedCartons * pairsPerCarton;
    // Round to avoid IEEE 754 floating point inaccuracies for 0.5 cartons
    return Math.round(raw * 10) / 10;
  }, [selectedCartons, pairsPerCarton]);

  // Total Price = selectedCartons * price_per_carton
  const totalPrice: number = useMemo(() => {
    return Math.round(selectedCartons * pricePerCarton);
  }, [selectedCartons, pricePerCarton]);

  // Stock availability check
  const availableStock = product?.totalStock ?? product?.total_stock ?? 999;
  const isStockInsufficient = availableStock < totalPairs;

  // Handle selecting a dynamic multiplier chip
  const handleChipClick = (multiplier: number) => {
    setSelectedCartons(multiplier);
    setCartonsInput(String(multiplier));
  };

  // Handle changing active pack via selector / dropdown
  const handlePackChange = (newPackId: number) => {
    setSelectedPackId(newPackId);
    // When changing pack, retain or re-validate selected cartons
  };

  // Handle manual decimal carton input (allows step="0.5")
  const handleCartonInputChange = (val: string) => {
    setCartonsInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setSelectedCartons(parsed);
    }
  };

  const handleCartonInputBlur = () => {
    const parsed = parseFloat(cartonsInput);
    if (isNaN(parsed) || parsed <= 0) {
      setSelectedCartons(1);
      setCartonsInput('1');
    } else {
      // Clean decimal to nearest 0.5 step if desired or keep clean input
      const rounded = Math.round(parsed * 2) / 2;
      const finalVal = Math.max(0.5, rounded);
      setSelectedCartons(finalVal);
      setCartonsInput(String(finalVal));
    }
  };

  // Step increment / decrement by 0.5 cartons
  const adjustCartons = (delta: number) => {
    const current = selectedCartons || 1;
    const next = Math.max(0.5, Math.round((current + delta) * 2) / 2);
    setSelectedCartons(next);
    setCartonsInput(String(next));
  };

  // 4. Expected Component Payload on Submit
  const handleAddToCart = () => {
    if (!product || selectedCartons <= 0) return;

    const payload: PosAddToCartPayload = {
      productId: Number(product.id),
      cartonPackId: Number(activePack.id),
      cartons: Number(selectedCartons),
      totalPairs: Number(totalPairs),
      totalPrice: Number(totalPrice),
      // Extra contextual fields for seamless POS checkout display
      unitPrice,
      pricePerCarton,
      packName: activePack.pack_name,
      pairsPerCarton,
      product,
    };

    if (onAddToCart) {
      onAddToCart(payload);
    }
    if (onAddToOrder) {
      onAddToOrder(payload);
    }
    if (onClose) {
      onClose();
    }
  };

  if (!product && !inline) return null;
  if (!isOpen && !inline) return null;

  const content = (
    <div className="space-y-5">
      {/* Product Summary Banner */}
      {product && (
        <div className="p-4 bg-gradient-to-r from-purple-50 via-slate-50 to-indigo-50 dark:from-purple-950/30 dark:via-[#131B2E] dark:to-indigo-950/30 border border-purple-200/80 dark:border-purple-800/50 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            {product.primaryImageUrl ? (
              <img
                src={product.primaryImageUrl}
                alt={product.article || product.name}
                className="w-14 h-14 object-cover rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xs"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300">
                <Package className="w-7 h-7" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {product.article || product.name || 'Shoe Item'}
                </h4>
                {(product.brandName || product.brand) && (
                  <div className="inline-flex items-center gap-1">
                    <BrandLogo
                      logo={product.brandLogo}
                      name={product.brandName || product.brand}
                      size="xs"
                    />
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {product.brandName || product.brand}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Article: {product.article || product.name} | Size: {product.size || (product.sku ? product.sku.split('-').pop() : '42')} {product.barcode && `| Barcode: ${product.barcode}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              Unit Rate (Pair)
            </span>
            <span className="text-lg font-black text-purple-700 dark:text-purple-300 font-mono">
              {currencySymbol} {formatStockPrice(unitPrice)}
            </span>
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Available: <strong className="font-mono text-slate-900 dark:text-white">{availableStock}</strong> pairs
            </div>
          </div>
        </div>
      )}

      {/* 2. Pack Selection (carton_packs) */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
          <Boxes className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Select Active Carton Pack</span>
          <span className="text-[11px] font-normal text-slate-400">(carton_packs configuration)</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {resolvedPacks.map((pack) => {
            const isSelected = pack.id === selectedPackId;
            const pCount = pack.pairs_per_carton || (pack as any).pairsPerCarton || 12;
            return (
              <button
                key={pack.id}
                type="button"
                onClick={() => handlePackChange(pack.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/20 shadow-md shadow-purple-500/10'
                    : 'bg-white dark:bg-[#131B2E] border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {pack.pack_name}
                </div>
                <div className="text-[11px] font-mono text-purple-700 dark:text-purple-300 font-bold mt-1">
                  {pCount} Pairs / Ctn
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {currencySymbol} {formatStockPrice(pCount * unitPrice)} / ctn
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Dynamic Quantity Chips ([0.5, 1, 2, 5, 10] Multiplier Rule) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Quick Quantity Chips</span>
            <span className="text-[11px] font-normal text-slate-400">(Relative Multiplier: [0.5, 1, 2, 5, 10])</span>
          </label>
          <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
            Based on {pairsPerCarton} pairs/carton
          </span>
        </div>

        {/* Chips list */}
        <div className="flex flex-wrap gap-2">
          {dynamicChips.map((chip) => {
            const isChipSelected = selectedCartons === chip.multiplier;
            return (
              <button
                key={chip.multiplier}
                type="button"
                onClick={() => handleChipClick(chip.multiplier)}
                className={`group px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 select-none ${
                  isChipSelected
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-purple-500 shadow-md shadow-purple-600/25 ring-2 ring-purple-400/40 scale-102'
                    : 'bg-white dark:bg-[#131B2E] text-slate-800 dark:text-slate-200 border-purple-200/90 dark:border-purple-800/80 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:border-purple-400'
                }`}
              >
                <span>{chip.cartonLabel}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-mono font-extrabold ${
                    isChipSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 group-hover:bg-purple-200'
                  }`}
                >
                  {chip.calculatedPairs} {chip.calculatedPairs === 1 ? 'Pair' : 'Pairs'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Custom Decimal Carton Input (step="0.5") & Steppers */}
      <div className="p-4 bg-slate-50 dark:bg-[#0E1628] border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Custom Carton Quantity
            </label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Type decimal cartons (e.g. 0.5, 1.5, 3.5) or adjust with steppers (step="0.5")
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => adjustCartons(-0.5)}
              disabled={selectedCartons <= 0.5}
              className="w-10 h-10 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-[#131B2E] text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center font-black cursor-pointer transition shadow-2xs"
              title="Decrease by 0.5 Carton"
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={cartonsInput}
                onChange={(e) => handleCartonInputChange(e.target.value)}
                onBlur={handleCartonInputBlur}
                className="w-28 text-center font-mono font-black text-lg py-2 px-3 bg-white dark:bg-[#131B2E] text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 shadow-inner"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none uppercase">
                ctn
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustCartons(0.5)}
              className="w-10 h-10 rounded-xl border border-purple-300 dark:border-purple-700 bg-white dark:bg-[#131B2E] text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/60 flex items-center justify-center font-black cursor-pointer transition shadow-2xs"
              title="Increase by 0.5 Carton"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Live Calculations Display */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-br from-purple-900/10 via-indigo-900/5 to-slate-900/10 dark:from-purple-950/40 dark:via-indigo-950/30 dark:to-slate-900/40 border border-purple-300/80 dark:border-purple-800/80 rounded-2xl">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Selected Cartons
          </span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
            {selectedCartons} {selectedCartons === 1 ? 'Carton' : 'Cartons'}
          </span>
          <span className="text-[10px] text-slate-400 block">
            @ {pairsPerCarton} prs/ctn
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Total Pairs (Pairs)
          </span>
          <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
            {totalPairs} Pairs
          </span>
          <span className="text-[10px] text-slate-400 block">
            {selectedCartons} × {pairsPerCarton}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
            Price per Carton
          </span>
          <span className="text-base font-bold text-slate-800 dark:text-slate-200 font-mono">
            {currencySymbol} {formatStockPrice(pricePerCarton)}
          </span>
          <span className="text-[10px] text-slate-400 block">
            {pairsPerCarton} × {currencySymbol} {formatStockPrice(unitPrice)}
          </span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
            Total Order Price
          </span>
          <span className="text-lg font-black text-purple-700 dark:text-purple-300 font-mono">
            {currencySymbol} {formatStockPrice(totalPrice)}
          </span>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 block">
            {selectedCartons} ctn × {currencySymbol} {formatStockPrice(pricePerCarton)}
          </span>
        </div>
      </div>

      {/* Stock warning if ordered pairs exceed available stock */}
      {isStockInsufficient && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-300 font-semibold">
          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>
            Requested {totalPairs} pairs exceeds available store stock of {availableStock} pairs.
          </span>
        </div>
      )}

      {/* 4. Action Buttons passing { productId, cartonPackId, cartons, totalPairs, totalPrice } */}
      <div className="flex items-center justify-end space-x-3 pt-2">
        {onClose && !inline && (
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer transition"
          >
            Cancel
          </button>
        )}

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!product || selectedCartons <= 0}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 active:scale-97 text-white font-black text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-4 h-4 text-white" />
          <span>Add to Order / Cart ({totalPairs} Pairs • {currencySymbol} {formatStockPrice(totalPrice)})</span>
          <ArrowRight className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  );

  // If rendered inline, return content directly
  if (inline) {
    return (
      <div className="p-5 bg-white dark:bg-[#0E1628] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span>{title}</span>
        </h3>
        {content}
      </div>
    );
  }

  // Otherwise, render inside animated modal overlay
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl bg-white dark:bg-[#0E1628] border border-purple-200 dark:border-purple-900/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-500/5 via-indigo-500/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {title}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Configure carton packing and dynamically calculated quantities
                  </p>
                </div>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {content}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
