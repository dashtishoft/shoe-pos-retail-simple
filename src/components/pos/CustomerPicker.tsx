import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  User,
  UserCheck,
  UserPlus,
  Phone,
  X,
  Check,
  Award,
  Calendar,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Users,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import type { Customer } from '../../types.ts';

interface CustomerPickerProps {
  customers: Customer[];
  selectedCustomerId: number | null;
  onSelectCustomer: (customerId: number | null) => void;
  onCustomerCreated: (newCustomer: Customer) => void;
  currencySymbol: string;
  onModalOpenChange?: (isOpen: boolean) => void;
}

interface IndexedCustomer {
  raw: Customer;
  idStr: string;
  codeStr: string;
  displayCode: string;
  nameLower: string;
  phoneClean: string;
  phoneLower: string;
  loyaltyPoints: number;
  totalSpent: number;
  totalOrders: number;
  balance: number;
  lastVisit: string | null;
  searchBlob: string;
}

const MAX_DROPDOWN_MATCHES = 10;
const INITIAL_MODAL_RENDER_LIMIT = 100;

function formatCustomerCode(id: number | string, code?: string): string {
  if (code && code.trim()) return code.trim();
  const num = Number(id);
  if (!Number.isNaN(num) && num > 0) {
    return `CUST-${String(num).padStart(4, '0')}`;
  }
  return `#${id}`;
}

function formatLastVisitDate(rawDate?: string | null): string {
  if (!rawDate) return 'No prior visits';
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

export const CustomerPicker: React.FC<CustomerPickerProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onCustomerCreated,
  currencySymbol,
  onModalOpenChange,
}) => {
  // Combobox autocomplete state — suggestions only open when typing (searchQuery.trim().length > 0)
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  // Find Customer Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [debouncedModalQuery, setDebouncedModalQuery] = useState('');
  const [modalHighlightedIndex, setModalHighlightedIndex] = useState<number>(0);
  const [modalRenderLimit, setModalRenderLimit] = useState<number>(INITIAL_MODAL_RENDER_LIMIT);
  const [modalSortBy, setModalSortBy] = useState<'recent' | 'name' | 'loyalty' | 'visit'>('recent');

  // Quick-Add New Customer state (shared between inline card & modal)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddInModal, setQuickAddInModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const comboboxInputRef = useRef<HTMLInputElement | null>(null);
  const modalSearchInputRef = useRef<HTMLInputElement | null>(null);
  const modalTableBodyRef = useRef<HTMLTableSectionElement | null>(null);
  const dropdownListRef = useRef<HTMLDivElement | null>(null);

  // Notify parent when modal or quick-add open state changes so global POS barcode shortcuts pause
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

  // Debounce modal search query (120ms for thousands of customer rows)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedModalQuery(modalSearchQuery.trim());
      setModalRenderLimit(INITIAL_MODAL_RENDER_LIMIT);
    }, 120);
    return () => clearTimeout(timer);
  }, [modalSearchQuery]);

  // Pre-index all customers once when `customers` array changes for fast normalized string matching
  const indexedCustomers = useMemo<IndexedCustomer[]>(() => {
    return (customers || []).map((c: any) => {
      const idStr = String(c.id ?? '');
      const displayCode = formatCustomerCode(c.id, c.code);
      const codeStr = displayCode.toLowerCase();
      const nameLower = String(c.name ?? '').toLowerCase();
      const phoneLower = String(c.phone ?? '').toLowerCase();
      const phoneClean = phoneLower.replace(/[\s\-()+]/g, '');
      const totalSpent = parseFloat(c.total_spent ?? c.totalSpent ?? c.totalPurchases ?? 0) || 0;
      const totalOrders = parseInt(c.total_orders ?? c.totalOrders ?? 0, 10) || 0;
      const loyaltyPoints =
        c.loyalty_points !== undefined && c.loyalty_points !== null
          ? Number(c.loyalty_points)
          : c.loyaltyPoints !== undefined && c.loyaltyPoints !== null
          ? Number(c.loyaltyPoints)
          : Math.floor(totalSpent / 100);
      const balance = parseFloat(c.balance ?? 0) || 0;
      const lastVisit = c.last_visit || c.lastVisit || c.last_sale_at || null;

      return {
        raw: c,
        idStr,
        codeStr,
        displayCode,
        nameLower,
        phoneClean,
        phoneLower,
        loyaltyPoints,
        totalSpent,
        totalOrders,
        balance,
        lastVisit,
        searchBlob: `${nameLower} ${phoneLower} ${phoneClean} #${idStr} ${idStr} ${codeStr}`,
      };
    });
  }, [customers]);

  // Currently selected customer object
  const selectedCustomer = useMemo<IndexedCustomer | null>(() => {
    if (selectedCustomerId === null) return null;
    return indexedCustomers.find((item) => item.raw.id === selectedCustomerId) || null;
  }, [indexedCustomers, selectedCustomerId]);

  // Helper to filter indexed customers by a query string
  const filterCustomersByQuery = useCallback(
    (rawQuery: string): IndexedCustomer[] => {
      if (!rawQuery) return indexedCustomers;
      const q = rawQuery.toLowerCase().trim();
      const qDigits = q.replace(/[\s\-()+]/g, '');

      const matches: { item: IndexedCustomer; score: number }[] = [];

      for (let i = 0; i < indexedCustomers.length; i++) {
        const item = indexedCustomers[i];
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
        } else if (item.phoneLower.includes(q) || (qDigits.length >= 2 && item.phoneClean.includes(qDigits))) {
          score = 55;
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
    [indexedCustomers]
  );

  // Combobox filtered matches (limited to top 10 for dropdown speed)
  const comboboxAllMatches = useMemo(() => {
    const activeQuery = debouncedQuery || searchQuery.trim();
    if (!activeQuery) return [];
    return filterCustomersByQuery(activeQuery);
  }, [filterCustomersByQuery, debouncedQuery, searchQuery]);

  const comboboxTopMatches = useMemo(() => {
    return comboboxAllMatches.slice(0, MAX_DROPDOWN_MATCHES);
  }, [comboboxAllMatches]);

  // Modal filtered & sorted matches
  const modalFilteredMatches = useMemo(() => {
    const filtered = filterCustomersByQuery(debouncedModalQuery);
    if (debouncedModalQuery && modalSortBy === 'recent') {
      return filtered;
    }

    const copy = [...filtered];
    copy.sort((a, b) => {
      if (modalSortBy === 'name') {
        return (a.raw.name || '').localeCompare(b.raw.name || '');
      }
      if (modalSortBy === 'loyalty') {
        return b.loyaltyPoints - a.loyaltyPoints || b.totalSpent - a.totalSpent;
      }
      if (modalSortBy === 'visit') {
        const aDate = a.lastVisit ? new Date(a.lastVisit).getTime() || 0 : 0;
        const bDate = b.lastVisit ? new Date(b.lastVisit).getTime() || 0 : 0;
        return bDate - aDate || b.raw.id - a.raw.id;
      }
      return (b.raw.id || 0) - (a.raw.id || 0);
    });
    return copy;
  }, [filterCustomersByQuery, debouncedModalQuery, modalSortBy]);

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
      `[data-modal-customer-idx="${modalHighlightedIndex}"]`
    ) as HTMLElement | null;
    if (row) {
      row.scrollIntoView({ block: 'nearest' });
    }
  }, [modalHighlightedIndex, isModalOpen]);

  // Scroll highlighted item into view in floating suggestion dropdown
  useEffect(() => {
    if (!isDropdownOpen || !dropdownListRef.current) return;
    const item = dropdownListRef.current.querySelector(
      `[data-dropdown-customer-idx="${highlightedIndex}"]`
    ) as HTMLElement | null;
    if (item) {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isDropdownOpen]);

  const handleChooseCustomer = (customerId: number | null) => {
    onSelectCustomer(customerId);
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
    onSelectCustomer(null);
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
        setNewCustomerPhone(clean);
        setNewCustomerName('');
      } else {
        setNewCustomerName(clean);
        setNewCustomerPhone('');
      }
    } else {
      setNewCustomerName('');
      setNewCustomerPhone('');
    }
    setNewCustomerAddress('');
    if (inModal) {
      setQuickAddInModal(true);
    } else {
      setIsQuickAddOpen(true);
      setIsDropdownOpen(false);
    }
  };

  const handleCreateNewCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!newCustomerName.trim()) {
      setCreateError('Customer name is required.');
      return;
    }
    if (!newCustomerPhone.trim()) {
      setCreateError('Customer phone number is required.');
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const res = await api.customers.create({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim(),
        address: newCustomerAddress.trim() || 'Walk-in Counter',
      });
      const created: Customer = {
        ...res.customer,
        total_orders: 0,
        total_spent: 0,
        loyalty_points: 0,
        last_visit: null,
      };
      onCustomerCreated(created);
      onSelectCustomer(created.id);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerAddress('');
      setIsQuickAddOpen(false);
      setQuickAddInModal(false);
      setIsModalOpen(false);
      setIsDropdownOpen(false);
      setIsInputFocused(false);
      setSearchQuery('');
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to register customer.');
    } finally {
      setIsCreatingCustomer(false);
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
          handleChooseCustomer(target.raw.id);
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

  // Keyboard navigation for Find Customer Modal
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
          handleChooseCustomer(chosen.raw.id);
        }
      }
    }
  };

  const openFindCustomerModal = () => {
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

  return (
    <div ref={containerRef} className="relative">
      {/* Inline Quick-Add Form when toggled */}
      {isQuickAddOpen ? (
        <form onSubmit={handleCreateNewCustomer} className="space-y-2 text-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
              <span>Register New Customer</span>
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
          <input
            type="text"
            placeholder="Customer Name *"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            className="app-input w-full px-3 py-2 text-xs"
            autoFocus
            required
          />
          <input
            type="tel"
            placeholder="Mobile / Phone *"
            value={newCustomerPhone}
            onChange={(e) => setNewCustomerPhone(e.target.value)}
            className="app-input w-full px-3 py-2 text-xs font-mono"
            required
          />
          <input
            type="text"
            placeholder="Address / Area (optional)"
            value={newCustomerAddress}
            onChange={(e) => setNewCustomerAddress(e.target.value)}
            className="app-input w-full px-3 py-1.5 text-xs"
          />
          <button
            type="submit"
            disabled={isCreatingCustomer}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {isCreatingCustomer ? 'Saving Customer...' : 'Save & Add Customer'}
          </button>
        </form>
      ) : (
        <>
          {/* Searchable Combobox + Find Customer Modal Button + Quick Add Button */}
          <div className="flex items-stretch gap-1.5">
            <div className="relative flex-1 min-w-0">
              {/* Left Integrated Search / Customer Status Icon */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                {selectedCustomer && !isInputFocused && !searchQuery ? (
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Search className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                )}
              </div>

              <input
                ref={comboboxInputRef}
                type="text"
                id="pos-customer-search-input"
                role="combobox"
                aria-expanded={showSuggestionsPopup}
                aria-autocomplete="list"
                aria-controls="pos-customer-listbox"
                value={
                  isInputFocused
                    ? searchQuery
                    : selectedCustomer
                    ? `${selectedCustomer.raw.name} (${selectedCustomer.raw.phone})`
                    : searchQuery
                }
                placeholder={
                  selectedCustomer
                    ? `${selectedCustomer.raw.name} (${selectedCustomer.raw.phone}) — Type to change...`
                    : 'Walk-in / Cash Customer (Type name, phone, #ID...)'
                }
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
                  selectedCustomer && !isInputFocused && !searchQuery
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/70 text-emerald-950 dark:text-emerald-200 focus:bg-white dark:focus:bg-slate-900/80 focus:border-indigo-500'
                    : 'bg-slate-50/90 dark:bg-slate-900/60 border-slate-200/90 dark:border-indigo-500/20 text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20'
                }`}
              />

              {/* Clear ('×') Button when a customer is selected or search query is typed */}
              {(selectedCustomer !== null || searchQuery.length > 0) && (
                <button
                  type="button"
                  id="pos-customer-clear-btn"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClearSelection}
                  title="Clear & reset to Walk-in / Cash Customer"
                  aria-label="Clear selected customer"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/70 dark:hover:bg-white/10 transition cursor-pointer font-bold text-sm leading-none"
                >
                  ×
                </button>
              )}
            </div>

            {/* Dedicated Magnifying Glass Button to open "Find Customer" Modal */}
            <button
              type="button"
              id="pos-find-customer-modal-btn"
              onClick={openFindCustomerModal}
              title="Find Customer (Lookup Modal)"
              aria-label="Open Find Customer Modal"
              className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 border border-slate-200/90 dark:border-indigo-500/20 shadow-2xs transition cursor-pointer active:scale-95 flex items-center justify-center shrink-0"
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Quick "+ New Customer" Button */}
            <button
              type="button"
              id="pos-quick-new-customer-btn"
              onClick={() => openQuickAdd(false, searchQuery)}
              title="Register New Customer"
              aria-label="Register New Customer"
              className="px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 text-xs font-bold shadow-2xs transition cursor-pointer active:scale-95 flex items-center gap-1 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New</span>
            </button>
          </div>

          {/* Floating Customer Suggestions Card — ONLY shown when typing, NO header, aligned with Quick Price Retrieval */}
          <AnimatePresence>
            {showSuggestionsPopup && (
              <motion.div
                id="pos-customer-listbox"
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
                      const isSelected = item.raw.id === selectedCustomerId;
                      const initials = (item.raw.name || 'C')
                        .split(' ')
                        .map((w: string) => w[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();

                      return (
                        <div
                          key={item.raw.id}
                          data-dropdown-customer-idx={idx}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onClick={() => handleChooseCustomer(item.raw.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isHighlighted
                              ? 'border-indigo-400 dark:border-indigo-500/60 bg-indigo-50/40 dark:bg-[#16203A]'
                              : 'border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#121A2F] hover:border-indigo-400 dark:hover:border-indigo-500/50'
                          }`}
                        >
                          {/* Top Row: Avatar + Customer Name & Code + Orders Status Badge */}
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
                                  <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                                    <span>Phone: {item.raw.phone}</span>
                                    {item.lastVisit && (
                                      <span>• Last: {formatLastVisitDate(item.lastVisit)}</span>
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
                                      : `${item.totalOrders} ${item.totalOrders === 1 ? 'order' : 'orders'}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Metrics Grid (Aligned with Quick Price Retrieval 2-col / 3-col cards) */}
                          <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800/80 grid grid-cols-2 gap-1.5">
                            <div className="p-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/50 text-center">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                                Loyalty Points
                              </div>
                              <div className="text-xs font-mono font-extrabold text-amber-800 dark:text-amber-200 mt-0.5">
                                {item.loyaltyPoints} pts
                              </div>
                            </div>

                            <div className="p-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-700/50 text-center">
                              <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                Total Spent
                              </div>
                              <div className="text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5">
                                {currencySymbol} {formatStockPrice(item.totalSpent)}
                              </div>
                            </div>
                          </div>

                          {/* Action Button (Aligned with Quick Price Retrieval "Add to Cart" action) */}
                          <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleChooseCustomer(item.raw.id);
                              }}
                              className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isSelected ? 'Selected for Sale' : 'Add to Sale'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty State when no customer matches typed query */
                  <div className="py-4 px-2 text-center space-y-2.5">
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      No customer found for "{searchQuery}"
                    </div>
                    <button
                      type="button"
                      onClick={() => openQuickAdd(false, searchQuery)}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>+ Add "{searchQuery.slice(0, 22)}" as New Customer</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* DEDICATED "FIND CUSTOMER" LOOKUP MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-3 sm:p-4"
          onKeyDown={handleModalKeyDown}
        >
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-purple-800/80 overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-purple-500/20 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center text-blue-600 dark:text-purple-300 shadow-2xs">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight">
                      Find Customer
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 dark:bg-purple-950/80 text-blue-700 dark:text-purple-300 border border-blue-200 dark:border-purple-700/70">
                      {indexedCustomers.length} Registered
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-purple-200/80">
                    Search by Name, Phone Number, or Customer Code/ID • Use ↑↓ and Enter to select
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleChooseCustomer(null)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    selectedCustomerId === null
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                      : 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  Walk-in / Cash Customer
                </button>

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
                  <span>{quickAddInModal ? 'Back to Customer List' : '+ New Customer'}</span>
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

            {/* Quick-Add New Customer Sub-Panel inside Modal */}
            {quickAddInModal ? (
              <form onSubmit={handleCreateNewCustomer} className="p-6 space-y-4 text-xs flex-1 overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-purple-800/60 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      Quick Register New Customer
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Automatically links to current POS checkout
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
                      Customer Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      placeholder="e.g. Tariq Mehmood"
                      autoFocus
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white border border-slate-200 dark:border-purple-800/60 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-medium text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Phone / Mobile Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      placeholder="e.g. 0300-1234567"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-white border border-slate-200 dark:border-purple-800/60 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-mono font-medium text-xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Address / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      placeholder="e.g. Gulberg III, Lahore / VIP Member"
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
                    type="submit"
                    disabled={isCreatingCustomer}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer"
                  >
                    {isCreatingCustomer ? 'Creating Customer...' : 'Save & Select for Sale'}
                  </button>
                </div>
              </form>
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
                      placeholder="Type customer Name, Phone (0300...), or Customer Code/ID (#12, CUST-0012)..."
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
                        { id: 'loyalty', label: 'Top Loyalty / Spend' },
                        { id: 'visit', label: 'Last Visit' },
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

                {/* Searchable Customer Table */}
                <div className="flex-1 overflow-y-auto min-h-[280px] max-h-[52vh]">
                  {modalVisibleRows.length === 0 ? (
                    <div className="p-12 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-purple-950/50 border border-blue-100 dark:border-purple-800/60 flex items-center justify-center text-blue-600 dark:text-purple-400 mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          No matching customers found
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {modalSearchQuery
                            ? `No customer matches "${modalSearchQuery}". You can register them right now.`
                            : 'No registered customers yet.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openQuickAdd(true, modalSearchQuery)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/25 cursor-pointer"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>+ New Customer</span>
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#0D1425]/95 backdrop-blur-xs text-slate-600 dark:text-purple-200 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-purple-800/80">
                        <tr>
                          <th className="py-3 px-4">Name &amp; Code</th>
                          <th className="py-3 px-4">Phone</th>
                          <th className="py-3 px-4 text-right">Loyalty Points / Balance</th>
                          <th className="py-3 px-4">Last Visit</th>
                          <th className="py-3 px-4 text-right w-28">Action</th>
                        </tr>
                      </thead>
                      <tbody
                        ref={modalTableBodyRef}
                        className="divide-y divide-slate-100 dark:divide-purple-900/30"
                      >
                        {modalVisibleRows.map((item, idx) => {
                          const isHighlighted = idx === modalHighlightedIndex;
                          const isSelected = item.raw.id === selectedCustomerId;
                          const initials = (item.raw.name || 'C')
                            .split(' ')
                            .map((w: string) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();

                          return (
                            <tr
                              key={item.raw.id}
                              data-modal-customer-idx={idx}
                              onMouseEnter={() => setModalHighlightedIndex(idx)}
                              onClick={() => handleChooseCustomer(item.raw.id)}
                              className={`transition cursor-pointer ${
                                isHighlighted
                                  ? 'bg-blue-50/90 dark:bg-purple-900/45'
                                  : isSelected
                                  ? 'bg-emerald-50/60 dark:bg-emerald-950/25'
                                  : 'hover:bg-slate-50 dark:hover:bg-purple-950/20'
                              }`}
                            >
                              {/* Column 1: Name & Customer Code/ID */}
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
                                    {item.raw.address && (
                                      <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-xs">
                                        {item.raw.address}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Column 2: Phone */}
                              <td className="py-3 px-4 font-mono text-slate-800 dark:text-slate-200">
                                <div className="inline-flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{item.raw.phone}</span>
                                </div>
                              </td>

                              {/* Column 3: Loyalty Points / Balance */}
                              <td className="py-3 px-4 text-right">
                                <div className="flex flex-col items-end">
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60">
                                    <Award className="w-3 h-3 text-amber-500" />
                                    <span>{item.loyaltyPoints} pts</span>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                                    Spent:{' '}
                                    <strong className="text-slate-900 dark:text-white">
                                      {currencySymbol} {formatStockPrice(item.totalSpent)}
                                    </strong>
                                    <span className="text-[10px] text-slate-400 ml-1">
                                      ({item.totalOrders} {item.totalOrders === 1 ? 'order' : 'orders'})
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Column 4: Last Visit */}
                              <td className="py-3 px-4">
                                <div className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className={item.lastVisit ? 'font-medium' : 'text-slate-400 dark:text-slate-500 italic'}>
                                    {formatLastVisitDate(item.lastVisit)}
                                  </span>
                                </div>
                              </td>

                              {/* Column 5: Select Action */}
                              <td className="py-3 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChooseCustomer(item.raw.id);
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
                        Show More Customers ({modalFilteredMatches.length - modalRenderLimit} remaining)
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
                      <span>Select Customer</span>
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
