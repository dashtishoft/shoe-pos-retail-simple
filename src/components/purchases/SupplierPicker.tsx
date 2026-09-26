import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Building2,
  UserCheck,
  UserPlus,
  Phone,
  Mail,
  X,
  Check,
  Calendar,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlertCircle,
  Wallet,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import type { Supplier } from '../../types.ts';

interface SupplierPickerProps {
  suppliers: Supplier[];
  selectedSupplierId: number | '' | null;
  supplierName: string;
  onSelectSupplier: (supplierId: number | '', supplierName: string) => void;
  onSupplierCreated: (newSupplier: Supplier) => void;
  currencySymbol: string;
  onModalOpenChange?: (isOpen: boolean) => void;
  allowCustomSupplier?: boolean;
  placeholder?: string;
}

interface IndexedSupplier {
  raw: Supplier & Record<string, any>;
  idStr: string;
  codeStr: string;
  displayCode: string;
  nameLower: string;
  phoneClean: string;
  phoneLower: string;
  emailLower: string;
  totalPurchases: number;
  totalPurchasedAmount: number;
  payableBalance: number;
  lastPurchaseDate: string | null;
  searchBlob: string;
}

const MAX_DROPDOWN_MATCHES = 10;
const INITIAL_MODAL_RENDER_LIMIT = 100;

function formatSupplierCode(id: number | string, code?: string): string {
  if (code && code.trim()) return code.trim();
  const num = Number(id);
  if (!Number.isNaN(num) && num > 0) {
    return `SUP-${String(num).padStart(4, '0')}`;
  }
  return `#${id}`;
}

function formatLastPurchaseDate(rawDate?: string | null): string {
  if (!rawDate) return 'No prior orders';
  try {
    const clean = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      if (!Number.isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
    }
    const parsed = new Date(clean);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
    return clean;
  } catch {
    return String(rawDate);
  }
}

export const SupplierPicker: React.FC<SupplierPickerProps> = ({
  suppliers,
  selectedSupplierId,
  supplierName,
  onSelectSupplier,
  onSupplierCreated,
  currencySymbol,
  onModalOpenChange,
  allowCustomSupplier = true,
  placeholder,
}) => {
  // Combobox autocomplete state — suggestions only open when typing (searchQuery.trim().length > 0)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  // Find Supplier Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [debouncedModalQuery, setDebouncedModalQuery] = useState('');
  const [modalHighlightedIndex, setModalHighlightedIndex] = useState<number>(0);
  const [modalRenderLimit, setModalRenderLimit] = useState<number>(INITIAL_MODAL_RENDER_LIMIT);
  const [modalSortBy, setModalSortBy] = useState<'recent' | 'name' | 'balance' | 'orders'>('recent');

  // Quick-Add New Supplier state (shared between inline card & modal)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInModal, setQuickAddInModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const comboboxInputRef = useRef<HTMLInputElement | null>(null);
  const modalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const modalTableBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const dropdownListRef = useRef<HTMLDivElement | null>(null);

  // Notify parent when modal or quick-add open state changes so global barcode shortcuts pause
  useEffect(() => {
    onModalOpenChange?.(isModalOpen || isQuickAddOpen);
  }, [isModalOpen, isQuickAddOpen, onModalOpenChange]);

  // Debounce combobox search query (90ms for instant, non-blocking filtering)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 90);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce modal search query (120ms for thousands of supplier rows)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedModalQuery(modalSearchQuery.trim());
      setModalRenderLimit(INITIAL_MODAL_RENDER_LIMIT);
    }, 120);
    return () => clearTimeout(timer);
  }, [modalSearchQuery]);

  // Pre-index all suppliers once when `suppliers` array changes for fast normalized string matching
  const indexedSuppliers = useMemo<IndexedSupplier[]>(() => {
    return (suppliers || []).map((s: any) => {
      const idStr = String(s.id ?? '');
      const displayCode = formatSupplierCode(s.id, s.code);
      const codeStr = displayCode.toLowerCase();
      const nameLower = String(s.name ?? '').toLowerCase();
      const phoneLower = String(s.phone ?? '').toLowerCase();
      const phoneClean = phoneLower.replace(/[\s\-()+]/g, '');
      const emailLower = String(s.email ?? '').toLowerCase();
      const totalPurchases = parseInt(s.total_purchases ?? s.totalPurchases ?? 0, 10) || 0;
      const totalPurchasedAmount =
        parseFloat(s.total_purchased_amount ?? s.totalPurchasedAmount ?? 0) || 0;
      const payableBalance =
        parseFloat(s.net_payable_balance ?? s.balance ?? 0) || 0;
      const lastPurchaseDate = s.last_purchase_date || s.lastPurchaseDate || null;

      return {
        raw: s,
        idStr,
        codeStr,
        displayCode,
        nameLower,
        phoneClean,
        phoneLower,
        emailLower,
        totalPurchases,
        totalPurchasedAmount,
        payableBalance,
        lastPurchaseDate,
        searchBlob: `${nameLower} ${phoneLower} ${phoneClean} ${emailLower} #${idStr} ${idStr} ${codeStr}`,
      };
    });
  }, [suppliers]);

  // Currently selected registered supplier object
  const selectedSupplier = useMemo<IndexedSupplier | null>(() => {
    if (!selectedSupplierId) return null;
    const numId = Number(selectedSupplierId);
    return indexedSuppliers.find((item) => item.raw.id === numId) || null;
  }, [indexedSuppliers, selectedSupplierId]);

  const hasAnySelection = Boolean(selectedSupplier || (allowCustomSupplier && supplierName.trim()));

  // Helper to filter indexed suppliers by a query string
  const filterSuppliersByQuery = useCallback(
    (rawQuery: string): IndexedSupplier[] => {
      if (!rawQuery) return indexedSuppliers;
      const q = rawQuery.toLowerCase().trim();
      const qDigits = q.replace(/[\s\-()+]/g, '');

      const matches: { item: IndexedSupplier; score: number }[] = [];

      for (let i = 0; i < indexedSuppliers.length; i++) {
        const item = indexedSuppliers[i];
        let score = 0;

        if (item.idStr === q || `#${item.idStr}` === q || item.codeStr === q) {
          score = 100;
        } else if (item.nameLower.startsWith(q)) {
          score = 85;
        } else if (item.phoneClean.startsWith(qDigits) && qDigits.length >= 2) {
          score = 80;
        } else if (item.codeStr.includes(q) || `#${item.idStr}`.includes(q)) {
          score = 70;
        } else if (item.nameLower.includes(q)) {
          score = 60;
        } else if (
          item.phoneLower.includes(q) ||
          (qDigits.length >= 2 && item.phoneClean.includes(qDigits))
        ) {
          score = 55;
        } else if (item.emailLower.includes(q)) {
          score = 50;
        } else if (item.searchBlob.includes(q)) {
          score = 40;
        }

        if (score > 0) {
          matches.push({ item, score });
        }
      }

      matches.sort((a, b) => b.score - a.score || b.item.raw.id - a.item.raw.id);
      return matches.map((m) => m.item);
    },
    [indexedSuppliers]
  );

  // Combobox filtered matches (limited to top 10 for dropdown speed)
  const comboboxAllMatches = useMemo(() => {
    const activeQuery = debouncedQuery || searchQuery.trim();
    if (!activeQuery) return [];
    return filterSuppliersByQuery(activeQuery);
  }, [filterSuppliersByQuery, debouncedQuery, searchQuery]);

  const comboboxTopMatches = useMemo(() => {
    return comboboxAllMatches.slice(0, MAX_DROPDOWN_MATCHES);
  }, [comboboxAllMatches]);

  // Modal filtered & sorted matches
  const modalFilteredMatches = useMemo(() => {
    const filtered = filterSuppliersByQuery(debouncedModalQuery);
    if (debouncedModalQuery && modalSortBy === 'recent') {
      return filtered;
    }

    const copy = [...filtered];
    copy.sort((a, b) => {
      if (modalSortBy === 'name') {
        return (a.raw.name || '').localeCompare(b.raw.name || '');
      }
      if (modalSortBy === 'balance') {
        return b.payableBalance - a.payableBalance || b.totalPurchasedAmount - a.totalPurchasedAmount;
      }
      if (modalSortBy === 'orders') {
        return b.totalPurchases - a.totalPurchases || b.totalPurchasedAmount - a.totalPurchasedAmount;
      }
      return (b.raw.id || 0) - (a.raw.id || 0);
    });
    return copy;
  }, [filterSuppliersByQuery, debouncedModalQuery, modalSortBy]);

  const modalVisibleRows = useMemo(() => {
    return modalFilteredMatches.slice(0, modalRenderLimit);
  }, [modalFilteredMatches, modalRenderLimit]);

  // Reset highlight index when combobox results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [debouncedQuery, searchQuery]);

  // Reset modal highlight index when modal results change
  useEffect(() => {
    setModalHighlightedIndex(0);
  }, [debouncedModalQuery, modalSortBy, isModalOpen]);

  // Close combobox dropdown on outside click & fallback cleanly
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        setIsInputFocused(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Scroll highlighted row into view in modal
  useEffect(() => {
    if (!isModalOpen || !modalTableBodyRef.current) return;
    const row = modalTableBodyRef.current.querySelector(
      `[data-modal-supplier-idx="${modalHighlightedIndex}"]`
    ) as HTMLElement | null;
    if (row) {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [modalHighlightedIndex, isModalOpen]);

  // Scroll highlighted item into view in floating suggestion dropdown
  useEffect(() => {
    if (!isDropdownOpen || !dropdownListRef.current) return;
    const item = dropdownListRef.current.querySelector(
      `[data-dropdown-supplier-idx="${highlightedIndex}"]`
    ) as HTMLElement | null;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isDropdownOpen]);

  const handleChooseSupplier = (sup: Supplier | null, customName = '') => {
    if (sup) {
      onSelectSupplier(sup.id, sup.name);
    } else if (customName.trim()) {
      onSelectSupplier('', customName.trim());
    } else {
      onSelectSupplier('', '');
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
    setIsInputFocused(false);
    setIsModalOpen(false);
    setQuickAddInModal(false);
    setIsQuickAddOpen(false);
  };

  const handleClearSelection = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    onSelectSupplier('', '');
    setSearchQuery('');
    setIsDropdownOpen(false);
    setIsInputFocused(false);
  };

  const openQuickAdd = (inModal = false, prefillText = '') => {
    setCreateError(null);
    const clean = prefillText.trim();
    if (clean) {
      const isMostlyDigits = /^[0-9+\-\s()]{4,}$/.test(clean);
      if (isMostlyDigits) {
        setNewSupplierPhone(clean);
        setNewSupplierName('');
      } else {
        setNewSupplierName(clean);
        setNewSupplierPhone('');
      }
    } else {
      setNewSupplierName('');
      setNewSupplierPhone('');
    }
    setNewSupplierEmail('');
    if (inModal) {
      setQuickAddInModal(true);
    } else {
      setIsQuickAddOpen(true);
      setIsDropdownOpen(false);
    }
  };

  const handleCreateNewSupplier = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setCreateError(null);

    if (!newSupplierName.trim()) {
      setCreateError('Supplier / Vendor name is required.');
      return;
    }

    setIsCreatingSupplier(true);
    try {
      const res = await api.suppliers.create({
        name: newSupplierName.trim(),
        phone: newSupplierPhone.trim(),
        email: newSupplierEmail.trim(),
      });
      const created: Supplier = {
        ...res.supplier,
        total_purchases: 0,
        total_purchased_amount: 0,
        net_payable_balance: 0,
      };
      onSupplierCreated(created);
      onSelectSupplier(created.id, created.name);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setNewSupplierEmail('');
      setIsQuickAddOpen(false);
      setQuickAddInModal(false);
      setIsModalOpen(false);
      setIsDropdownOpen(false);
      setIsInputFocused(false);
      setSearchQuery('');
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to register supplier.');
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Keyboard navigation for Combobox input (only navigates when suggestions are visible via typing)
  const handleComboboxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hasTypedQuery = searchQuery.trim().length > 0;

    if (e.key === 'ArrowDown') {
      if (!hasTypedQuery) return;
      e.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        setHighlightedIndex(0);
        return;
      }
      const maxIdx = Math.max(0, comboboxTopMatches.length - 1);
      setHighlightedIndex((prev) => (prev < maxIdx ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      if (!hasTypedQuery) return;
      e.preventDefault();
      if (!isDropdownOpen) {
        setIsDropdownOpen(true);
        return;
      }
      const maxIdx = Math.max(0, comboboxTopMatches.length - 1);
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : maxIdx));
    } else if (e.key === 'Enter') {
      if (!hasTypedQuery) return;
      e.preventDefault();
      e.stopPropagation();
      if (comboboxTopMatches.length > 0) {
        const target = comboboxTopMatches[highlightedIndex] || comboboxTopMatches[0];
        if (target) {
          handleChooseSupplier(target.raw);
        }
      } else {
        openQuickAdd(false, searchQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsDropdownOpen(false);
      setIsInputFocused(false);
      setSearchQuery('');
      comboboxInputRef.current?.blur();
    }
  };

  // Keyboard navigation for Find Supplier Modal
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (quickAddInModal) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setQuickAddInModal(false);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsModalOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const maxIdx = Math.max(0, modalVisibleRows.length - 1);
      setModalHighlightedIndex((prev) => (prev < maxIdx ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const maxIdx = Math.max(0, modalVisibleRows.length - 1);
      setModalHighlightedIndex((prev) => (prev > 0 ? prev - 1 : maxIdx));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (modalVisibleRows.length > 0) {
        const chosen = modalVisibleRows[modalHighlightedIndex] || modalVisibleRows[0];
        if (chosen) {
          handleChooseSupplier(chosen.raw);
        }
      }
    }
  };

  const openFindSupplierModal = () => {
    setIsDropdownOpen(false);
    setIsInputFocused(false);
    setModalSearchQuery(searchQuery.trim());
    setDebouncedModalQuery(searchQuery.trim());
    setQuickAddInModal(false);
    setIsModalOpen(true);
    setTimeout(() => {
      modalSearchInputRef.current?.focus();
    }, 30);
  };

  // Suggestions ONLY appear when user is actively typing in the input (never on empty focus)
  const showSuggestionsPopup = isDropdownOpen && searchQuery.trim().length > 0;

  // Compute displayed input value when not actively typing
  const displayedValue = useMemo(() => {
    if (isInputFocused) return searchQuery;
    if (selectedSupplier) {
      const phonePart = selectedSupplier.raw.phone ? ` (${selectedSupplier.raw.phone})` : '';
      return `${selectedSupplier.raw.name}${phonePart}`;
    }
    if (allowCustomSupplier && supplierName.trim()) {
      return `${supplierName.trim()} (Custom Vendor)`;
    }
    return searchQuery;
  }, [isInputFocused, searchQuery, selectedSupplier, allowCustomSupplier, supplierName]);

  const inputPlaceholder = useMemo(() => {
    if (selectedSupplier) {
      const phonePart = selectedSupplier.raw.phone ? ` (${selectedSupplier.raw.phone})` : '';
      return `${selectedSupplier.raw.name}${phonePart} — Type to change...`;
    }
    if (allowCustomSupplier && supplierName.trim()) {
      return `${supplierName.trim()} — Type to change...`;
    }
    return placeholder || 'Search Supplier / Vendor (Type name, phone, #ID...)';
  }, [selectedSupplier, allowCustomSupplier, supplierName, placeholder]);

  return (
    <div ref={containerRef} className="relative">
      {/* Inline Quick-Add Form when toggled */}
      {isQuickAddOpen ? (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleCreateNewSupplier(e);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setIsQuickAddOpen(false);
            }
          }}
          className="space-y-2 text-xs animate-in fade-in duration-150 p-3 rounded-xl bg-white dark:bg-[#0E1628] border border-indigo-200 dark:border-purple-800/60 shadow-xs"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
              <span>Register New Supplier / Vendor</span>
            </span>
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {createError && (
            <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-lg text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{createError}</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Supplier / Vendor Name *"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              className="app-input w-full px-3 py-2 text-xs"
              autoFocus
            />
            <input
              type="tel"
              placeholder="Mobile / Phone (optional)"
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
              className="app-input w-full px-3 py-2 text-xs font-mono"
            />
            <input
              type="email"
              placeholder="Email Address (optional)"
              value={newSupplierEmail}
              onChange={(e) => setNewSupplierEmail(e.target.value)}
              className="app-input w-full px-3 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateNewSupplier}
            disabled={isCreatingSupplier}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isCreatingSupplier ? 'Saving Supplier...' : 'Save & Select Supplier'}
          </button>
        </div>
      ) : (
        <>
          {/* Searchable Combobox + Find Supplier Modal Button + Quick Add Button */}
          <div className="flex items-stretch gap-1.5">
            <div className="relative flex-1 min-w-0">
              {/* Left Integrated Search / Supplier Status Icon */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                {hasAnySelection && !isInputFocused && !searchQuery ? (
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Search className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                )}
              </div>

              <input
                ref={comboboxInputRef}
                type="text"
                id="purchase-supplier-search-input"
                role="combobox"
                aria-expanded={showSuggestionsPopup}
                aria-autocomplete="list"
                aria-controls="purchase-supplier-listbox"
                value={displayedValue}
                placeholder={inputPlaceholder}
                onFocus={() => {
                  setIsInputFocused(true);
                  // Do NOT open dropdown on focus alone; only open if there is already typed text
                  if (searchQuery.trim().length > 0) {
                    setIsDropdownOpen(true);
                  }
                }}
                onBlur={() => {
                  // Delay slightly so clicks on suggestion cards register cleanly
                  setTimeout(() => {
                    if (
                      containerRef.current &&
                      !containerRef.current.contains(document.activeElement)
                    ) {
                      setIsInputFocused(false);
                      setIsDropdownOpen(false);
                      setSearchQuery('');
                    }
                  }, 150);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  setIsDropdownOpen(val.trim().length > 0);
                }}
                onKeyDown={handleComboboxKeyDown}
                className={`w-full pl-9 pr-8 py-2 rounded-xl text-xs font-semibold outline-none transition border ${
                  hasAnySelection && !isInputFocused && !searchQuery
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/70 text-emerald-950 dark:text-emerald-200 focus:bg-white dark:focus:bg-slate-900/80 focus:border-indigo-500'
                    : 'bg-slate-50/90 dark:bg-slate-900/60 border-slate-200/90 dark:border-indigo-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20'
                }`}
              />

              {/* Clear ('×') Button when a supplier is selected or search query is typed */}
              {(hasAnySelection || searchQuery.length > 0) && (
                <button
                  type="button"
                  id="purchase-supplier-clear-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClearSelection}
                  title="Clear selected supplier"
                  aria-label="Clear selected supplier"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-white/10 transition cursor-pointer font-bold text-sm leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {/* Dedicated Magnifying Glass Button to open "Find Supplier" Modal */}
            <button
              type="button"
              id="purchase-find-supplier-modal-btn"
              onClick={openFindSupplierModal}
              title="Find Supplier (Lookup Modal)"
              aria-label="Open Find Supplier Modal"
              className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/90 dark:border-indigo-500/20 shadow-2xs transition cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Quick "+ New Supplier" Button */}
            <button
              type="button"
              id="purchase-quick-new-supplier-btn"
              onClick={() => openQuickAdd(false, searchQuery)}
              title="Register New Supplier"
              aria-label="Register New Supplier"
              className="px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>

          {/* Floating Supplier Suggestions Card — ONLY shown when typing, NO header, aligned with CustomerPicker & Quick Price Retrieval */}
          <AnimatePresence>
            {showSuggestionsPopup && (
              <motion.div
                id="purchase-supplier-listbox"
                role="listbox"
                ref={dropdownListRef}
                initial={{ opacity: 0, scale: 0.97, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'top left' }}
                className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-indigo-500/30 rounded-2xl shadow-2xl p-2.5 z-50 max-h-[26rem] overflow-y-auto space-y-2 backdrop-blur-md"
              >
                {comboboxTopMatches.length > 0 ? (
                  <div className="space-y-2">
                    {comboboxTopMatches.map((item, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      const isSelected = Number(selectedSupplierId) === item.raw.id;
                      const initials = (item.raw.name || 'S')
                        .split(' ')
                        .map((w: string) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <div
                          key={item.raw.id}
                          data-dropdown-supplier-idx={idx}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onClick={() => handleChooseSupplier(item.raw)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isHighlighted
                              ? 'border-indigo-400 dark:border-indigo-500/60 bg-indigo-50/40 dark:bg-[#16203A]'
                              : 'border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#121A2F] hover:border-indigo-400 dark:hover:border-indigo-500/50'
                          }`}
                        >
                          {/* Top Row: Avatar + Supplier Name & Code + Orders Status Badge */}
                          <div className="flex items-start gap-2.5">
                            <div className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#0A0E1A] flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 shadow-2xs select-none">
                              {initials}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1.5">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                      {item.raw.name}
                                    </span>
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 font-mono">
                                      {item.displayCode}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400 font-mono flex-wrap">
                                    <span>Phone: {item.raw.phone || 'N/A'}</span>
                                    {item.lastPurchaseDate && (
                                      <span>• Last: {formatLastPurchaseDate(item.lastPurchaseDate)}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 text-right">
                                  <span
                                    className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      isSelected
                                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                                    }`}
                                  >
                                    {isSelected
                                      ? 'Selected'
                                      : `${item.totalPurchases} ${item.totalPurchases === 1 ? 'order' : 'orders'}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Metrics Grid (Aligned with CustomerPicker & Quick Price Retrieval 2-col cards) */}
                          <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 grid grid-cols-2 gap-1.5">
                            <div className="p-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/50 text-center">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                Payable Balance
                              </div>
                              <div className="text-xs font-mono font-extrabold text-amber-800 dark:text-amber-200 mt-0.5">
                                {currencySymbol} {formatStockPrice(item.payableBalance)}
                              </div>
                            </div>

                            <div className="p-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-700/50 text-center">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                Total Purchased
                              </div>
                              <div className="text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5">
                                {currencySymbol} {formatStockPrice(item.totalPurchasedAmount)}
                              </div>
                            </div>
                          </div>

                          {/* Action Button (Aligned with CustomerPicker "Add to Sale" action) */}
                          <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleChooseSupplier(item.raw);
                              }}
                              className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isSelected ? 'Selected for Purchase' : 'Select for Purchase'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty State when no supplier matches typed query */
                  <div className="py-4 px-2 text-center space-y-2">
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      No registered supplier found for "{searchQuery}"
                    </div>
                    <button
                      type="button"
                      onClick={() => openQuickAdd(false, searchQuery)}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Add "{searchQuery.slice(0, 22)}" as New Supplier</span>
                    </button>
                    {allowCustomSupplier && (
                      <button
                        type="button"
                        onClick={() => handleChooseSupplier(null, searchQuery)}
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Use "{searchQuery.slice(0, 22)}" as Direct / Custom Vendor</span>
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* DEDICATED "FIND SUPPLIER" LOOKUP MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4"
          onKeyDown={handleModalKeyDown}
        >
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-purple-800/80 overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-purple-500/20 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center text-blue-600 dark:text-purple-300 shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight">
                      Find Supplier / Vendor
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 dark:bg-purple-950/80 text-blue-700 dark:text-purple-300 border border-blue-200 dark:border-purple-700/70">
                      {indexedSuppliers.length} Registered
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-purple-200/80">
                    Search by Name, Phone, Email, or Supplier Code/ID • Use ↑↓ and Enter to select
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (quickAddInModal) {
                      setQuickAddInModal(false);
                    } else {
                      openQuickAdd(true, modalSearchQuery);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 text-xs font-bold shadow-sm shadow-purple-600/25 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{quickAddInModal ? 'Back to Supplier List' : '+ New Supplier'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick-Add New Supplier Sub-Panel inside Modal */}
            {quickAddInModal ? (
              <div
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateNewSupplier(e);
                  }
                }}
                className="p-6 space-y-4 text-xs flex-1 overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-purple-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Quick Register New Supplier / Vendor
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Automatically links to current purchase order
                  </span>
                </div>

                {createError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Supplier / Vendor Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder="e.g. Metro Footwear Wholesale Co."
                      autoFocus
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white border border-slate-200 dark:border-purple-800/60 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-medium text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Phone / Mobile Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={newSupplierPhone}
                      onChange={(e) => setNewSupplierPhone(e.target.value)}
                      placeholder="e.g. +92 300 1234567"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white border border-slate-200 dark:border-purple-800/60 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-mono font-medium text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Email Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={newSupplierEmail}
                      onChange={(e) => setNewSupplierEmail(e.target.value)}
                      placeholder="e.g. orders@metrofootwear.com"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white border border-slate-200 dark:border-purple-800/60 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-purple-800/60">
                  <button
                    type="button"
                    onClick={() => setQuickAddInModal(false)}
                    className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateNewSupplier}
                    disabled={isCreatingSupplier}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer"
                  >
                    {isCreatingSupplier ? 'Creating Supplier...' : 'Save & Select for Purchase'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search & Sort Controls Bar */}
                <div className="p-4 bg-white dark:bg-[#0F172A] border-b border-slate-200 dark:border-purple-900/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={modalSearchInputRef}
                      type="text"
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                      placeholder="Type supplier Name, Phone, Email, or Supplier Code/ID (#4, SUP-0004)..."
                      className="w-full pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-[#090E1A] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-purple-300/50 border border-slate-200 dark:border-purple-800/70 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition"
                    />
                    {modalSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalSearchQuery('');
                          modalSearchInputRef.current?.focus();
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white cursor-pointer"
                        title="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Quick Sort Pills */}
                  <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                    <span className="text-slate-400 dark:text-slate-500 font-semibold mr-1 hidden md:inline">
                      Sort:
                    </span>
                    {(
                      [
                        { id: 'recent', label: 'Recent ID' },
                        { id: 'name', label: 'Name A-Z' },
                        { id: 'balance', label: 'Payable Balance' },
                        { id: 'orders', label: 'Top Orders' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setModalSortBy(tab.id)}
                        className={`px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer border ${
                          modalSortBy === tab.id
                            ? 'bg-blue-50 dark:bg-purple-900/60 text-blue-600 dark:text-purple-200 border-blue-200 dark:border-purple-600'
                            : 'bg-slate-50 dark:bg-[#0B1120] text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-purple-900/40 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Searchable Supplier Table */}
                <div className="flex-1 overflow-y-auto min-h-[280px] max-h-[52vh]">
                  {modalVisibleRows.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-purple-950/50 border border-blue-100 dark:border-purple-800/60 flex items-center justify-center text-blue-600 dark:text-purple-400 mx-auto">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          No matching suppliers found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {modalSearchQuery
                            ? `No registered supplier matches "${modalSearchQuery}". You can register them right now.`
                            : 'No registered suppliers yet.'}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openQuickAdd(true, modalSearchQuery)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/25 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>+ New Supplier</span>
                        </button>
                        {allowCustomSupplier && modalSearchQuery.trim() && (
                          <button
                            type="button"
                            onClick={() => handleChooseSupplier(null, modalSearchQuery)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                          >
                            <Building2 className="w-4 h-4" />
                            <span>Use "{modalSearchQuery.trim().slice(0, 20)}" as Direct Vendor</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#0D1425]/95 backdrop-blur-xs text-slate-600 dark:text-purple-200 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-purple-800/80">
                        <tr>
                          <th className="py-3 px-4">Supplier Name &amp; Code</th>
                          <th className="py-3 px-4">Phone &amp; Email</th>
                          <th className="py-3 px-4 text-right">Payable Balance / Purchased</th>
                          <th className="py-3 px-4">Last Order</th>
                          <th className="py-3 px-4 text-right w-28">Action</th>
                        </tr>
                      </thead>
                      <tbody
                        ref={modalTableBodyRef}
                        className="divide-y divide-slate-100 dark:divide-purple-900/30"
                      >
                        {modalVisibleRows.map((item, idx) => {
                          const isHighlighted = idx === modalHighlightedIndex;
                          const isSelected = Number(selectedSupplierId) === item.raw.id;
                          const initials = (item.raw.name || 'S')
                            .split(' ')
                            .map((w: string) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();

                          return (
                            <tr
                              key={item.raw.id}
                              data-modal-supplier-idx={idx}
                              onMouseEnter={() => setModalHighlightedIndex(idx)}
                              onClick={() => handleChooseSupplier(item.raw)}
                              className={`transition cursor-pointer ${
                                isHighlighted
                                  ? 'bg-blue-50/90 dark:bg-purple-900/45'
                                  : isSelected
                                  ? 'bg-emerald-50/60 dark:bg-emerald-950/25'
                                  : 'hover:bg-slate-50 dark:hover:bg-purple-950/20'
                              }`}
                            >
                              {/* Column 1: Name & Supplier Code/ID */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-purple-950/70 border border-blue-200/80 dark:border-purple-800/70 flex items-center justify-center text-blue-600 dark:text-purple-300 font-bold text-xs shrink-0">
                                    {initials}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-900 dark:text-white truncate">
                                        {item.raw.name}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-purple-950/80 text-blue-600 dark:text-purple-300 border border-slate-200 dark:border-purple-800/60">
                                        {item.displayCode}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Column 2: Phone & Email */}
                              <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200">
                                <div className="flex flex-col gap-0.5">
                                  {item.raw.phone ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{item.raw.phone}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-600">-</span>
                                  )}
                                  {item.raw.email && (
                                    <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                      <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate max-w-[180px]">{item.raw.email}</span>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Column 3: Payable Balance / Total Purchased */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex flex-col items-end">
                                  <div
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                                      item.payableBalance > 0
                                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
                                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
                                    }`}
                                  >
                                    <Wallet className="w-3 h-3" />
                                    <span>
                                      {item.payableBalance > 0
                                        ? `Due: ${currencySymbol} ${formatStockPrice(item.payableBalance)}`
                                        : 'Settled'}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                    Purchased:{' '}
                                    <strong className="text-slate-900 dark:text-white">
                                      {currencySymbol} {formatStockPrice(item.totalPurchasedAmount)}
                                    </strong>
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      ({item.totalPurchases} {item.totalPurchases === 1 ? 'order' : 'orders'})
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Column 4: Last Purchase */}
                              <td className="py-3 px-4">
                                <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span
                                    className={
                                      item.lastPurchaseDate
                                        ? 'font-medium'
                                        : 'text-slate-400 dark:text-slate-500 italic'
                                    }
                                  >
                                    {formatLastPurchaseDate(item.lastPurchaseDate)}
                                  </span>
                                </div>
                              </td>

                              {/* Column 5: Select Action */}
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChooseSupplier(item.raw);
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                                    isSelected
                                      ? 'bg-emerald-600 text-white'
                                      : isHighlighted
                                      ? 'bg-blue-600 dark:bg-purple-600 text-white shadow-xs'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white'
                                  }`}
                                >
                                  {isSelected ? (
                                    <>
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Selected</span>
                                    </>
                                  ) : (
                                    <span>Select</span>
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Load More Button if results exceed initial render window */}
                  {modalFilteredMatches.length > modalRenderLimit && (
                    <div className="p-3 text-center bg-slate-50/70 dark:bg-[#0B1120] border-t border-slate-200 dark:border-purple-900/50">
                      <button
                        type="button"
                        onClick={() => setModalRenderLimit((prev) => prev + 100)}
                        className="px-4 py-1.5 rounded-xl bg-blue-50 dark:bg-purple-900/50 text-blue-600 dark:text-purple-200 font-bold text-xs hover:bg-blue-100 dark:hover:bg-purple-800/60 transition cursor-pointer"
                      >
                        Show More Suppliers ({modalFilteredMatches.length - modalRenderLimit} remaining)
                      </button>
                    </div>
                  )}
                </div>

                {/* Modal Footer with Keyboard Hints */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-purple-200/80">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-[10px] inline-flex items-center">
                        <ArrowUp className="w-2.5 h-2.5" />
                        <ArrowDown className="w-2.5 h-2.5" />
                      </kbd>
                      <span>Navigate</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-[10px] inline-flex items-center gap-0.5">
                        <CornerDownLeft className="w-2.5 h-2.5" /> Enter
                      </kbd>
                      <span>Select Supplier</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-[10px]">
                        Esc
                      </kbd>
                      <span>Close</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span>
                      Showing <strong>{modalVisibleRows.length}</strong> of{' '}
                      <strong>{modalFilteredMatches.length}</strong> matches
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn-secondary px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
