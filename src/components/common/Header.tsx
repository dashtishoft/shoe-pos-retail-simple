import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Bell,
  Settings,
  ChevronDown,
  Menu,
  Sun,
  Moon,
  Monitor,
  UserCog,
  LogOut,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ShoppingBag,
  ArrowLeftRight,
  Truck,
  Database,
  RefreshCw,
  CheckCheck,
  Check,
  Boxes,
  Users,
  X,
  ShieldCheck,
  User,
  ShoppingCart,
  Tag,
  Layers,
  BookOpen,
  Building2,
  RotateCcw,
  TrendingUp,
  Copy,
  Coins,
  Loader2,
  ImageIcon,
  Edit3,
  PackagePlus,
  Printer,
  Barcode,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar.tsx';
import { ThemeDropdown } from './ThemeDropdown.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { api } from '../../services/api.ts';
import { getProductRetailPrice, getProductMinFloorPrice } from '../../utils/priceFormat.ts';

interface HeaderProps {
  currentTab: string;
  onTabChange?: (tab: string) => void;
  currentUser: any;
  companySettings: any;
  onLogout: () => void;
  onToggleMobileMenu: () => void;
  onOpenProfile?: () => void;
  onSwitchRole?: (role: 'ADMIN' | 'CASHIER') => void;
}

/**
 * Component to display a product thumbnail in quick price search suggestions.
 * If an image exists and loads successfully, displays the image.
 * If no image exists or fails to load, displays an animated skeleton placeholder.
 */
interface QuickSearchProductImageProps {
  prod: {
    primaryImageUrl?: string | null;
    primary_image_url?: string | null;
    imageUrl?: string | null;
    image?: string | null;
    article?: string;
    name?: string;
  };
}

const QuickSearchProductImage: React.FC<QuickSearchProductImageProps> = ({ prod }) => {
  const imageUrl = (prod.primaryImageUrl || prod.primary_image_url || prod.imageUrl || prod.image || '').trim();
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // If no image exists or image URL fails to load, show skeleton placeholder
  if (!imageUrl || imageError) {
    return (
      <div
        className="w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-200/70 dark:bg-slate-800/60 animate-pulse flex flex-col items-center justify-center p-1.5 relative overflow-hidden shadow-2xs select-none"
        title="No image - placeholder skeleton"
        aria-label="Product image skeleton"
      >
        <div className="w-6 h-6 rounded-lg bg-slate-300/80 dark:bg-slate-700/80 flex items-center justify-center shadow-2xs">
          <ImageIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="w-7 h-1 bg-slate-300/60 dark:bg-slate-700/60 rounded-full mt-1.5" />
      </div>
    );
  }

  return (
    <div className="relative w-13 h-13 sm:w-14 sm:h-14 shrink-0 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#0A0E1A] overflow-hidden p-0.5 shadow-2xs flex items-center justify-center select-none">
      {!imageLoaded && (
        <div className="absolute inset-0 w-full h-full bg-slate-200/70 dark:bg-slate-800/60 animate-pulse flex flex-col items-center justify-center">
          <div className="w-6 h-6 rounded-lg bg-slate-300/80 dark:bg-slate-700/80 flex items-center justify-center">
            <ImageIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="w-7 h-1 bg-slate-300/60 dark:bg-slate-700/60 rounded-full mt-1.5" />
        </div>
      )}
      <img
        src={imageUrl}
        alt={prod.article || prod.name || 'Shoe product'}
        className={`w-full h-full object-cover rounded-lg transition-opacity duration-200 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        loading="lazy"
      />
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  companySettings,
  onLogout,
  onToggleMobileMenu,
  onOpenProfile,
  onSwitchRole,
}) => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [priceSearchResults, setPriceSearchResults] = useState<any[]>([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const currency = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

  const formatPrice = (val: number | string | undefined | null) => {
    const n = Number(val);
    if (isNaN(n)) return `${currency} 0`;
    return `${currency} ${n.toLocaleString()}`;
  };

  const copyPriceValue = (e: React.MouseEvent, priceValue: number | string | undefined, label: string) => {
    e.stopPropagation();
    try {
      const textToCopy = String(priceValue ?? 0);
      navigator.clipboard.writeText(textToCopy);
      setCopiedNotification(label);
      setTimeout(() => setCopiedNotification(null), 1800);
    } catch {}
  };

  // Quick Action Handlers for retrieved product in Quick Price check
  const handleAddToCart = (e: React.MouseEvent, prod: any) => {
    e.stopPropagation();
    setIsSearching(false);
    sessionStorage.setItem('pending_pos_product', JSON.stringify(prod));
    window.dispatchEvent(new CustomEvent('pos:add-to-cart', { detail: { product: prod } }));
    onTabChange?.('pos');
  };

  const handleEditProduct = (e: React.MouseEvent, prod: any) => {
    e.stopPropagation();
    setIsSearching(false);
    sessionStorage.setItem('pending_edit_product', JSON.stringify(prod));
    window.dispatchEvent(new CustomEvent('product:edit', { detail: { product: prod } }));
    onTabChange?.('inventory');
  };

  const handleAddPurchase = (e: React.MouseEvent, prod: any) => {
    e.stopPropagation();
    setIsSearching(false);
    sessionStorage.setItem('pending_purchase_product', JSON.stringify(prod));
    window.dispatchEvent(new CustomEvent('purchase:new-entry', { detail: { product: prod } }));
    onTabChange?.('purchases');
  };

  const handlePrintBarcode = (e: React.MouseEvent, prod: any) => {
    e.stopPropagation();
    setIsSearching(false);
    sessionStorage.setItem('pending_barcode_product', JSON.stringify(prod));
    window.dispatchEvent(new CustomEvent('inventory:print-barcode', { detail: { product: prod } }));
    onTabChange?.('inventory');
  };

  // Close dropdowns on outside click or touch
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearching(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Quick price search - does NOT change routes, directly retrieves single product price suggestions
  const searchTimeoutRef = useRef<any>(null);

  const executeSingleProductPriceSearch = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) {
      setPriceSearchResults([]);
      setIsLoadingSearch(false);
      return;
    }

    setIsLoadingSearch(true);
    try {
      let singleProduct: any = null;
      const lowerQ = q.toLowerCase();

      // 1. Fetch matching products from API
      const prodRes = await api.products.list({ search: q, limit: 30 }).catch(() => ({ products: [] }));
      const list = prodRes?.products || [];

      if (list.length > 0) {
        // TOP PRIORITY: Exact match on product article (case-insensitive)
        const exactArticle = list.find(
          (p: any) => p.article && p.article.trim().toLowerCase() === lowerQ
        );

        // SECOND PRIORITY: Exact match on SKU or Barcode
        const exactSkuOrBarcode = list.find(
          (p: any) =>
            (p.sku && p.sku.trim().toLowerCase() === lowerQ) ||
            (p.barcode && p.barcode.trim().toLowerCase() === lowerQ)
        );

        // THIRD PRIORITY: Article starts with search query
        const startsArticle = list.find(
          (p: any) => p.article && p.article.trim().toLowerCase().startsWith(lowerQ)
        );

        // FOURTH PRIORITY: SKU starts with search query
        const startsSku = list.find(
          (p: any) => p.sku && p.sku.trim().toLowerCase().startsWith(lowerQ)
        );

        singleProduct = exactArticle || exactSkuOrBarcode || startsArticle || startsSku || list[0];
      }

      // 2. If not found in product list, try direct scanner lookup endpoint as fallback
      if (!singleProduct) {
        try {
          const directLookup = await api.products.lookupBarcode(q);
          if (directLookup?.product) {
            singleProduct = directLookup.product;
          }
        } catch {
          // not found
        }
      }

      // Always return ONLY the single matching product
      setPriceSearchResults(singleProduct ? [singleProduct] : []);
    } catch {
      setPriceSearchResults([]);
    } finally {
      setIsLoadingSearch(false);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setPriceSearchResults([]);
      setIsLoadingSearch(false);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsLoadingSearch(true);
    searchTimeoutRef.current = setTimeout(() => {
      executeSingleProductPriceSearch(searchQuery);
    }, 180);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Real-time system notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pos_read_notifications');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const isFetchingNotifsRef = useRef(false);

  const fetchLiveNotifications = async () => {
    if (isFetchingNotifsRef.current) return;
    isFetchingNotifsRef.current = true;
    try {
      setIsLoadingNotifs(true);
      const res = await api.notifications.list();
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      console.warn('Could not fetch real-time notifications:', err);
    } finally {
      isFetchingNotifsRef.current = false;
      setIsLoadingNotifs(false);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();

    // Periodic live sync every 30 seconds
    const interval = setInterval(fetchLiveNotifications, 30000);

    // Event listeners for POS sales, returns, purchases, and inventory adjustments
    const handleLiveEvent = () => {
      fetchLiveNotifications();
    };

    window.addEventListener('pos:sale-completed', handleLiveEvent);
    window.addEventListener('inventory:updated', handleLiveEvent);
    window.addEventListener('pos:return-completed', handleLiveEvent);
    window.addEventListener('pos:purchase-completed', handleLiveEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('pos:sale-completed', handleLiveEvent);
      window.removeEventListener('inventory:updated', handleLiveEvent);
      window.removeEventListener('pos:return-completed', handleLiveEvent);
      window.removeEventListener('pos:purchase-completed', handleLiveEvent);
    };
  }, []);

  const markAsRead = (id: string) => {
    setReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem('pos_read_notifications', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotifIds((prev) => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('pos_read_notifications', JSON.stringify(merged));
      } catch {}
      return merged;
    });
  };

  const unreadCount = notifications.filter((n) => !readNotifIds.includes(n.id)).length;

  const renderNotificationIcon = (iconName: string) => {
    switch (iconName) {
      case 'boxes':
        return <Boxes className="w-3 h-3 text-purple-600 dark:text-purple-300 stroke-[2]" />;
      case 'alert-circle':
        return <AlertCircle className="w-3 h-3 text-rose-500 stroke-[2]" />;
      case 'alert-triangle':
        return <AlertTriangle className="w-3 h-3 text-amber-500 stroke-[2]" />;
      case 'shopping-bag':
        return <ShoppingBag className="w-3 h-3 text-purple-600 dark:text-purple-300 stroke-[2]" />;
      case 'check-circle':
        return <CheckCircle2 className="w-3 h-3 text-emerald-500 stroke-[2]" />;
      case 'arrow-left-right':
        return <ArrowLeftRight className="w-3 h-3 text-indigo-500 stroke-[2]" />;
      case 'truck':
        return <Truck className="w-3 h-3 text-cyan-500 stroke-[2]" />;
      case 'database':
        return <Database className="w-3 h-3 text-purple-600 dark:text-purple-300 stroke-[2]" />;
      default:
        return <Bell className="w-3 h-3 text-purple-600 dark:text-purple-300 stroke-[2]" />;
    }
  };

  return (
    <header className="px-4 border border-indigo-500/20 bg-white/95 dark:bg-white/10 backdrop-blur-lg shadow-lg transition-colors duration-500 sticky top-0 z-30 select-none text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2.5 sm:gap-4 min-h-[3.6rem] py-1.5 no-print">
      {/* LEFT: Mobile Menu Toggle Button & Global Search Bar close to hamburger menu */}
      <div className="flex items-center gap-2 sm:gap-2.5 pl-0.5 sm:pl-1 min-w-0">
        {/* Mobile Menu Toggle Button (< lg) */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="lg:hidden h-8.5 w-8.5 flex items-center justify-center p-1.5 rounded-lg border border-slate-200 dark:border-purple-400/40 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-purple-500/20 dark:text-purple-200 dark:hover:bg-purple-500/30 dark:hover:text-white cursor-pointer shrink-0 shadow-2xs transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* Quick Price Retrieval Search Bar */}
        <div ref={searchRef} className="relative w-44 sm:w-56 md:w-68 lg:w-80 min-w-0">
          <div className="relative flex items-center">
            <Coins className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(true);
              }}
              onFocus={() => {
                setIsSearching(true);
                setShowNotifications(false);
                setShowUserDropdown(false);
                setShowThemeDropdown(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
                  executeSingleProductPriceSearch(searchQuery);
                }
              }}
              placeholder="Quick price check (Article, Barcode, SKU)..."
              className="h-8 sm:h-8.5 uppercase w-full bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/90 dark:border-indigo-500/20 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 pl-8 pr-7 py-1 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all font-medium"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsSearching(false);
                }}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Price Retrieval Suggestions Dropdown (Single Product Price Display) */}
          <AnimatePresence>
            {isSearching && searchQuery.trim().length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'top left' }}
                className="fixed left-2 right-2 top-[3.8rem] sm:absolute sm:left-0 sm:right-auto sm:top-full sm:mt-2 sm:w-96 md:w-[440px] max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] bg-white dark:bg-[#0D1322] border border-slate-200 dark:border-indigo-500/30 rounded-2xl shadow-2xl p-3 z-50 max-h-[calc(100dvh-4.6rem)] sm:max-h-[30rem] overflow-y-auto space-y-2 backdrop-blur-md"
              >
                {copiedNotification && (
                  <div className="px-2.5 py-1 text-center text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                    ✓ {copiedNotification} copied to clipboard
                  </div>
                )}

                {/* Loading state with skeleton cards */}
                {isLoadingSearch && (
                  <div className="space-y-2 py-1">
                    <div className="py-2 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      <span>Searching price details...</span>
                    </div>
                    {[1, 2].map((idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-50/50 dark:bg-[#121A2F]/50 animate-pulse space-y-2.5"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded w-3/5" />
                            <div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded w-2/5" />
                          </div>
                          <div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0" />
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                          <div className="h-8 bg-slate-200/70 dark:bg-slate-800/60 rounded-lg" />
                          <div className="h-8 bg-slate-200/70 dark:bg-slate-800/60 rounded-lg" />
                          <div className="h-8 bg-slate-200/70 dark:bg-slate-800/60 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions list (First Layout) */}
                {!isLoadingSearch && priceSearchResults.length > 0 && (
                  <div className="space-y-2">
                    {priceSearchResults.slice(0, 10).map((prod) => (
                      <div
                        key={prod.id}
                        className="p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#121A2F] hover:border-indigo-400 dark:hover:border-indigo-500/50 transition-all select-text cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Title, Product Image (or Skeleton) & Metadata */}
                        <div className="flex items-start gap-2.5">
                          {/* Product Image if exists, else Skeleton */}
                          <QuickSearchProductImage prod={prod} />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                    {prod.article || prod.name}
                                  </span>
                                  {prod.brandName && prod.brandName !== 'Unbranded' && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50">
                                      {prod.brandName}
                                    </span>
                                  )}
                                  {prod.categoryName && prod.categoryName !== 'Uncategorized' && (
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                      • {prod.categoryName}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400 font-mono">
                                  <span>SKU: {prod.sku || '—'}</span>
                                  {prod.barcode && <span>• Barcode: {prod.barcode}</span>}
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  (prod.totalStock ?? 0) > 0 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                                }`}>
                                  {prod.totalStock ?? 0} in stock
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Pricing Grid: Respects Fixed vs Negotiable Policy and Admin vs Cashier Authority */}
                        {(() => {
                          const rawPricingMode = String(
                            prod.marginType ||
                            prod.margin_type ||
                            (prod.salePrice !== undefined && prod.salePrice !== null ? 'FIXED' : (companySettings?.pricing_mode || companySettings?.pricingMode || 'FIXED'))
                          ).toUpperCase();
                          const isFixedPolicy = rawPricingMode === 'FIXED';
                          const isOwnerOrAdmin = String(currentUser?.role || '').toUpperCase() === 'ADMIN';

                          const fixedSalePrice = getProductRetailPrice(prod, companySettings) || prod.maxSalePrice || prod.costPrice || 0;
                          const minSalePrice = getProductMinFloorPrice(prod, companySettings) || prod.minSalePrice || 0;
                          const maxSalePrice = getProductRetailPrice(prod, companySettings) || prod.maxSalePrice || 0;
                          const costPrice = prod.costPrice ?? prod.cost_price ?? 0;

                          if (isFixedPolicy) {
                            // FIXED PRICING MODE: Single Fixed Sale Price (no min/max negotiation)
                            return (
                              <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                                {isOwnerOrAdmin ? (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {/* Cost Price - Visible ONLY to Owner/Admin */}
                                    <div className="p-2 rounded-lg bg-white dark:bg-[#090D18] border border-slate-200 dark:border-slate-800 text-center">
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                        Cost Price (Admin)
                                      </div>
                                      <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                                        {formatPrice(costPrice)}
                                      </div>
                                    </div>

                                    {/* Fixed Sale Price */}
                                    <div
                                      onClick={(e) => copyPriceValue(e, fixedSalePrice, `Fixed price (${formatPrice(fixedSalePrice)})`)}
                                      className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-center cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition group/fixed"
                                      title="Click to copy Fixed Sale Price"
                                    >
                                      <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                                        <span>Fixed Sale Price</span>
                                        <Copy className="w-2.5 h-2.5 opacity-60 group-hover/fixed:opacity-100" />
                                      </div>
                                      <div className="text-sm font-mono font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5">
                                        {formatPrice(fixedSalePrice)}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  /* Cashier View in Fixed Mode: Solely the Fixed Sale Price (Cost Price is hidden) */
                                  <div
                                    onClick={(e) => copyPriceValue(e, fixedSalePrice, `Fixed price (${formatPrice(fixedSalePrice)})`)}
                                    className="p-2.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-center cursor-pointer hover:bg-emerald-100/80 transition group/cashierfixed"
                                    title="Click to copy Fixed Sale Price"
                                  >
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                                      <span>Fixed Sale Price</span>
                                      <span className="text-[9px] font-normal normal-case opacity-75">(Fixed Policy • No Bargaining)</span>
                                      <Copy className="w-3 h-3 opacity-60 group-hover/cashierfixed:opacity-100" />
                                    </div>
                                    <div className="text-lg font-mono font-black text-emerald-900 dark:text-emerald-100 mt-0.5">
                                      {formatPrice(fixedSalePrice)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          // NEGOTIABLE PRICING MODE:
                          return (
                            <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                              {isOwnerOrAdmin ? (
                                /* Owner/Admin View in Negotiable Mode: Cost Price, Min Sale Price, Max Sale Price */
                                <div className="grid grid-cols-3 gap-1.5">
                                  {/* Cost Price - Visible ONLY to Owner/Admin */}
                                  <div className="p-1.5 rounded-lg bg-white dark:bg-[#090D18] border border-slate-200 dark:border-slate-800 text-center">
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                      Cost Price (Admin)
                                    </div>
                                    <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                                      {formatPrice(costPrice)}
                                    </div>
                                  </div>

                                  {/* Min Sale Price (Floor) */}
                                  <div
                                    onClick={(e) => copyPriceValue(e, minSalePrice, `Min price (${formatPrice(minSalePrice)})`)}
                                    className="p-1.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/50 text-center cursor-pointer hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition group/min"
                                    title="Click to copy Minimum Sale Price"
                                  >
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                                      <span>Min Sale</span>
                                      <Copy className="w-2.5 h-2.5 opacity-60 group-hover/min:opacity-100" />
                                    </div>
                                    <div className="text-xs font-mono font-extrabold text-amber-800 dark:text-amber-200 mt-0.5">
                                      {formatPrice(minSalePrice)}
                                    </div>
                                  </div>

                                  {/* Max Sale Price (Retail) */}
                                  <div
                                    onClick={(e) => copyPriceValue(e, maxSalePrice, `Max price (${formatPrice(maxSalePrice)})`)}
                                    className="p-1.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-700/50 text-center cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition group/max"
                                    title="Click to copy Maximum Sale Price"
                                  >
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                                      <span>Max Sale</span>
                                      <Copy className="w-2.5 h-2.5 opacity-60 group-hover/max:opacity-100" />
                                    </div>
                                    <div className="text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5">
                                      {formatPrice(maxSalePrice)}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                /* Cashier View in Negotiable Mode: Min Sale & Max Sale ONLY (Cost is hidden) */
                                <div className="grid grid-cols-2 gap-1.5">
                                  {/* Min Sale Price (Floor) */}
                                  <div
                                    onClick={(e) => copyPriceValue(e, minSalePrice, `Min price (${formatPrice(minSalePrice)})`)}
                                    className="p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/50 text-center cursor-pointer hover:bg-amber-100/80 dark:hover:bg-amber-900/40 transition group/min"
                                    title="Click to copy Minimum Sale Price"
                                  >
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                                      <span>Min Sale (Floor)</span>
                                      <Copy className="w-2.5 h-2.5 opacity-60 group-hover/min:opacity-100" />
                                    </div>
                                    <div className="text-sm font-mono font-extrabold text-amber-800 dark:text-amber-200 mt-0.5">
                                      {formatPrice(minSalePrice)}
                                    </div>
                                  </div>

                                  {/* Max Sale Price (Retail) */}
                                  <div
                                    onClick={(e) => copyPriceValue(e, maxSalePrice, `Max price (${formatPrice(maxSalePrice)})`)}
                                    className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-700/50 text-center cursor-pointer hover:bg-emerald-100/80 dark:hover:bg-emerald-900/40 transition group/max"
                                    title="Click to copy Maximum Sale Price"
                                  >
                                    <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
                                      <span>Max Sale (Retail)</span>
                                      <Copy className="w-2.5 h-2.5 opacity-60 group-hover/max:opacity-100" />
                                    </div>
                                    <div className="text-sm font-mono font-extrabold text-emerald-800 dark:text-emerald-200 mt-0.5">
                                      {formatPrice(maxSalePrice)}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Quick Action Buttons: Tailored to Respective Authority (Admin vs Cashier) */}
                        <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 flex items-center justify-between">
                            <span>Quick Actions</span>
                            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">
                              {(currentUser?.role || '').toUpperCase() === 'ADMIN' ? 'Owner / Admin Authority' : 'Cashier Authority'}
                            </span>
                          </div>

                          {(currentUser?.role || '').toUpperCase() === 'ADMIN' ? (
                            /* Owner / Admin Authority Actions: 4 buttons divided into 2 rows (2x2 grid) for clean, readable labels */
                            <div className="grid grid-cols-2 gap-1.5">
                              {/* Row 1, Col 1: Add to POS Cart */}
                              <button
                                type="button"
                                onClick={(e) => handleAddToCart(e, prod)}
                                className="py-2 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer group/btn whitespace-nowrap"
                                title="Add product directly to POS sale"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                <span>Add to Cart</span>
                              </button>

                              {/* Row 1, Col 2: Edit Product */}
                              <button
                                type="button"
                                onClick={(e) => handleEditProduct(e, prod)}
                                className="py-2 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer group/btn whitespace-nowrap"
                                title="Edit product details, pricing, and stock limits"
                              >
                                <Edit3 className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                <span>Edit Product</span>
                              </button>

                              {/* Row 2, Col 1: Add Purchase */}
                              <button
                                type="button"
                                onClick={(e) => handleAddPurchase(e, prod)}
                                className="py-2 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer group/btn whitespace-nowrap"
                                title="Create new inward purchase entry for this shoe"
                              >
                                <PackagePlus className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                <span>Add Purchase</span>
                              </button>

                              {/* Row 2, Col 2: Print Barcode Label */}
                              <button
                                type="button"
                                onClick={(e) => handlePrintBarcode(e, prod)}
                                className="py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer group/btn whitespace-nowrap"
                                title="Generate and print barcode label for this shoe"
                              >
                                <Printer className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                <span>Barcode</span>
                              </button>
                            </div>
                          ) : (
                            /* Cashier Authority Actions: Add to Cart and Barcode only */
                            <div className="grid grid-cols-2 gap-1.5">
                              {/* Add to POS Cart */}
                              <button
                                type="button"
                                onClick={(e) => handleAddToCart(e, prod)}
                                className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs cursor-pointer group/btn"
                                title="Add product directly to POS sale"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                <span>Add to Cart</span>
                              </button>

                              {/* Print Barcode Label */}
                              <button
                                type="button"
                                onClick={(e) => handlePrintBarcode(e, prod)}
                                className="py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer group/btn"
                                title="Generate and print barcode label for this shoe"
                              >
                                <Printer className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                <span>Barcode</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Empty State */}
                {!isLoadingSearch && priceSearchResults.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    No footwear product found for "{searchQuery}"
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT: Notifications, Theme Dropdown, and User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto pl-1">

        {/* Real-time Notifications Menu */}
        <div ref={notifRef} className="relative">
          <button
            id="header-notifications-trigger"
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowUserDropdown(false);
              setShowThemeDropdown(false);
              setIsSearching(false);
              if (!showNotifications) {
                fetchLiveNotifications();
              }
            }}
            className={`h-8 sm:h-8.5 flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer border text-xs ${
              showNotifications
                ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border-purple-400/50 ring-2 ring-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.4)]'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:text-purple-200 dark:hover:text-white dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]'
            }`}
            title="System Notifications"
            aria-label="View system notifications"
            aria-expanded={showNotifications}
            aria-haspopup="true"
          >
            <div className="relative shrink-0 flex items-center justify-center">
              <Bell className="w-3.5 h-3.5 stroke-[2]" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3 px-0.5 rounded-full bg-rose-500 text-white font-bold text-[8px] flex items-center justify-center ring-1 ring-white dark:ring-[#120726]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <span
              className={`hidden sm:inline-block text-xs font-semibold ${
                showNotifications ? 'text-white' : 'text-slate-700 dark:text-purple-200'
              }`}
            >
              Alerts
            </span>
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ease-out hidden sm:inline-block opacity-75 ${
                showNotifications ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Notifications Dropdown Menu */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-2 right-2 top-[3.8rem] sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 md:w-96 max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] bg-white dark:bg-[#120726] border border-slate-200 dark:border-purple-400/40 rounded-xl shadow-2xl dark:shadow-[0_0_25px_rgba(147,51,234,0.25)] p-2 z-50 backdrop-blur-md origin-top sm:origin-top-right max-h-[calc(100dvh-4.6rem)] overflow-y-auto"
              >
                {/* Header */}
                <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-purple-800/40 mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 dark:text-purple-100">Live System Alerts</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {unreadCount > 0 ? (
                      <span className="text-[9px] font-semibold text-purple-600 dark:text-purple-200 bg-purple-50 dark:bg-purple-500/20 px-1.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-400/40">
                        {unreadCount} New
                      </span>
                    ) : (
                      <span className="text-[9px] font-medium text-slate-400 dark:text-purple-300/70 bg-slate-100 dark:bg-purple-500/10 px-1.5 py-0.5 rounded-full">
                        All Caught Up
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchLiveNotifications();
                      }}
                      disabled={isLoadingNotifs}
                      className="p-1 rounded-md text-slate-400 hover:text-purple-600 dark:text-purple-200 dark:hover:text-white hover:bg-purple-50/40 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:border dark:border-purple-400/40 dark:shadow-[0_0_10px_rgba(147,51,234,0.2)] transition cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                      title="Refresh notifications"
                      aria-label="Refresh notifications"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isLoadingNotifs ? 'animate-spin text-purple-600 dark:text-purple-200' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-[300px] overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 dark:text-purple-300/60">
                      <Bell className="w-4 h-4 mx-auto mb-1.5 opacity-40 stroke-[1.8] dark:text-purple-300" />
                      <p className="text-xs font-medium dark:text-purple-200">No system notifications</p>
                      <p className="text-[10px] mt-0.5 dark:text-purple-300/60">Database and registers operating normally</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const isRead = readNotifIds.includes(n.id);
                      return (
                        <div
                          key={n.id}
                          onClick={() => {
                            markAsRead(n.id);
                            onTabChange?.(n.actionTab);
                            setShowNotifications(false);
                          }}
                          className={`w-full flex items-start gap-2 px-2 py-1.5 text-xs rounded-lg transition cursor-pointer ${
                            isRead
                              ? 'opacity-70 hover:opacity-100 hover:bg-purple-50/40 dark:hover:bg-purple-500/20'
                              : 'bg-slate-50/80 dark:bg-purple-950/20 hover:bg-purple-50/40 dark:hover:bg-purple-500/25 border border-transparent dark:border-purple-800/30'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-md shrink-0 flex items-center justify-center shadow-2xs ${n.color.includes('border') ? n.color : `${n.color} border border-purple-100 dark:border-purple-400/40`}`}>
                            {renderNotificationIcon(n.icon)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className={`text-[11px] font-semibold ${isRead ? 'text-slate-700 dark:text-purple-200/80' : 'text-slate-900 dark:text-purple-100'}`}>
                                {n.title}
                              </span>
                              <span className="text-[9px] text-slate-400 dark:text-purple-300/70 shrink-0 font-normal">
                                {n.time}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 dark:text-purple-300/80 mt-0.5 line-clamp-2 leading-tight">
                              {n.message}
                            </p>
                          </div>
                          {!isRead && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 dark:bg-purple-400 dark:shadow-[0_0_8px_rgba(192,132,252,0.8)] mt-1.5 shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="px-2.5 py-1 border-t border-slate-100 dark:border-purple-800/40 mt-1 flex items-center justify-between text-[11px]">
                  {unreadCount > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAllAsRead();
                      }}
                      className="text-purple-600 dark:text-purple-200 hover:text-purple-700 dark:hover:text-white hover:bg-purple-50/40 dark:hover:bg-purple-500/25 px-1.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer font-medium transition-colors text-[10px]"
                    >
                      <CheckCheck className="w-2.5 h-2.5" />
                      Mark all as read
                    </button>
                  ) : (
                    <span className="text-slate-400 dark:text-purple-300/70 text-[9px]">Real-time live sync</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onTabChange?.('inventory');
                      setShowNotifications(false);
                    }}
                    className="text-slate-500 dark:text-purple-300 hover:text-slate-800 dark:hover:text-purple-100 cursor-pointer font-medium text-[10px]"
                  >
                    View Stock &rarr;
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
          {/* Three-Way Theme Dropdown Sub-Component */}
          <ThemeDropdown
            id="header-theme-dropdown-trigger"
            isOpen={showThemeDropdown}
            onOpenChange={(open) => {
              setShowThemeDropdown(open);
              if (open) {
                setShowUserDropdown(false);
                setShowNotifications(false);
              }
            }}
          />

          {/* User Avatar + Name + Dropdown Chevron */}
          <div ref={userRef} className="relative">
            <button
              id="header-user-menu-trigger"
              type="button"
              onClick={() => {
                setShowUserDropdown((prev) => !prev);
                setShowThemeDropdown(false);
                setShowNotifications(false);
              }}
              className={`h-8 sm:h-8.5 flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer border text-xs ${
                showUserDropdown
                  ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border-purple-400/50 ring-2 ring-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.4)]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:text-purple-200 dark:hover:text-white dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]'
              }`}
              aria-label="User menu"
              aria-expanded={showUserDropdown}
              aria-haspopup="true"
            >
              <User className="w-3.5 h-3.5 stroke-[2] shrink-0 text-current opacity-90" />
              <span
                className={`hidden sm:inline-block text-xs font-bold max-w-[120px] truncate ${
                  showUserDropdown ? 'text-white' : 'text-slate-800 dark:text-purple-200'
                }`}
              >
                {currentUser?.name || 'Admin'}
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform duration-200 ease-out opacity-75 ${
                  showUserDropdown ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* User Profile Dropdown Menu */}
            <AnimatePresence>
              {showUserDropdown && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -8 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'top right' }}
                  className="absolute right-0 left-auto top-full mt-2 w-68 sm:w-76 bg-white dark:bg-[#120726] border border-slate-200 dark:border-purple-400/40 rounded-xl shadow-2xl dark:shadow-[0_0_25px_rgba(147,51,234,0.25)] p-2.5 z-50 backdrop-blur-md space-y-1.5"
                >
                  {/* Unified Identity & Role Card: User info DP + Role card wrapped in one card with dark mode gradient */}
                  <div className="p-2.5 rounded-lg bg-slate-50/80 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border border-slate-100 dark:border-purple-800/80 dark:text-white transition-colors mb-0.5 space-y-2">
                    {/* Row 1: Enlarged circular DP on Left, Name and Email on Right */}
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={currentUser?.name}
                        avatarUrl={currentUser?.avatarUrl || currentUser?.avatar_url}
                        role={currentUser?.role}
                        size="lg"
                        className="shrink-0 rounded-full ring-2 ring-purple-500/40 shadow-md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate leading-tight">
                          {currentUser?.name || 'Admin'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-purple-200/80 truncate leading-tight mt-0.5">
                          {currentUser?.email || 'admin@store.com'}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Role Card with Login as Cashier / Return to Admin Button */}
                    {(() => {
                      const isRealAdmin =
                        (currentUser?.originalRole || '').toUpperCase() === 'ADMIN' ||
                        ((currentUser?.role || '').toUpperCase() === 'ADMIN' &&
                          (currentUser?.originalRole || '').toUpperCase() !== 'CASHIER');
                      const isAdminMode = (currentUser?.role || 'ADMIN').toUpperCase() === 'ADMIN';

                      if (isAdminMode) {
                        return (
                          <div className="p-2 rounded-lg bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 space-y-1.5 dark:shadow-[0_0_10px_rgba(16,185,129,0.15)] backdrop-blur-xs">
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="text-[10px] font-bold tracking-wide uppercase truncate">
                                  Role: Admin
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950 uppercase tracking-wider shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-emerald-950 animate-pulse" />
                                Verified
                              </span>
                            </div>

                            {/* Action button in role admin badge: Browse as Cashier */}
                            <button
                              type="button"
                              id="header-browse-as-cashier-btn"
                              onClick={() => {
                                setShowUserDropdown(false);
                                if (onSwitchRole) {
                                  onSwitchRole('CASHIER');
                                } else {
                                  try {
                                    const cached = localStorage.getItem('pos_current_user');
                                    if (cached) {
                                      const u = JSON.parse(cached);
                                      if ((u.originalRole || u.role || '').toUpperCase() === 'ADMIN') {
                                        u.role = 'CASHIER';
                                        u.originalRole = 'ADMIN';
                                        u.isSimulatedCashier = true;
                                        localStorage.setItem('pos_current_user', JSON.stringify(u));
                                      }
                                    }
                                  } catch {}
                                }
                                onTabChange?.('pos');
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
                              title="Browse as cashier to operate POS terminal"
                            >
                              <ShoppingCart className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                              <span>Browse as Cashier</span>
                            </button>
                          </div>
                        );
                      }

                      // User is in Cashier mode (currentUser.role === 'CASHIER')
                      return (
                        <div
                          className={`p-2 rounded-lg bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300 dark:shadow-[0_0_10px_rgba(59,130,246,0.15)] backdrop-blur-xs ${
                            isRealAdmin ? 'space-y-1.5' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ShoppingCart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span className="text-[10px] font-bold tracking-wide uppercase truncate">
                                Role: Cashier Mode
                              </span>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-bold bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950 uppercase tracking-wider shrink-0">
                              POS Terminal
                            </span>
                          </div>

                          {/* Action button in role cashier badge: Browse as Admin (ONLY for Admins browsing as Cashier) */}
                          {isRealAdmin && (
                            <button
                              type="button"
                              id="header-browse-as-admin-btn"
                              onClick={() => {
                                setShowUserDropdown(false);
                                if (onSwitchRole) {
                                  onSwitchRole('ADMIN');
                                } else {
                                  try {
                                    const cached = localStorage.getItem('pos_current_user');
                                    if (cached) {
                                      const u = JSON.parse(cached);
                                      if ((u.originalRole || '').toUpperCase() === 'ADMIN') {
                                        u.role = 'ADMIN';
                                        u.isSimulatedCashier = false;
                                        localStorage.setItem('pos_current_user', JSON.stringify(u));
                                      }
                                    }
                                  } catch {}
                                }
                              }}
                              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold transition shadow-2xs cursor-pointer"
                              title="Browse as full Store Administrator"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 stroke-[2] shrink-0" />
                              <span>Browse as Admin</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Profile & Security Item */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenProfile?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer text-slate-700 dark:text-purple-200 hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:text-white dark:hover:text-white dark:hover:bg-purple-500/25 group border border-transparent"
                  >
                    <UserCog className="w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 text-current opacity-80 group-hover:opacity-100" />
                    <span className="truncate text-xs">Profile & Security</span>
                  </button>

                  {/* Theme Switcher Quick Row */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      setShowThemeDropdown(true);
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg transition cursor-pointer text-slate-700 dark:text-purple-200 hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:text-white dark:hover:text-white dark:hover:bg-purple-500/25 group border border-transparent"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {themeMode === 'dark' ? (
                        <Moon className="w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 text-current opacity-80 group-hover:opacity-100" />
                      ) : themeMode === 'light' ? (
                        <Sun className="w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 text-current opacity-80 group-hover:opacity-100" />
                      ) : (
                        <Monitor className="w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 text-current opacity-80 group-hover:opacity-100" />
                      )}
                      <span className="capitalize truncate text-xs">Theme: {themeMode}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-200 group-hover:text-white group-hover:bg-white/20 group-hover:border-white/30 bg-purple-50 dark:bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-400/40 transition-colors shrink-0">
                      Change
                    </span>
                  </button>

                  {/* System Settings Item (Active when currentTab === 'settings') */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onTabChange?.('settings');
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs transition cursor-pointer rounded-lg ${
                      currentTab === 'settings'
                        ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-semibold shadow-md shadow-purple-600/25 border border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)]'
                        : 'text-slate-700 dark:text-purple-200 font-medium hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:text-white dark:hover:text-white dark:hover:bg-purple-500/25 group border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Settings
                        className={`w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 ${
                          currentTab === 'settings'
                            ? 'text-white'
                            : 'text-current opacity-80 group-hover:opacity-100'
                        }`}
                      />
                      <span className="truncate text-xs">System Settings</span>
                    </div>
                    {currentTab === 'settings' && (
                      <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
                    )}
                  </button>

                  {/* Log Out Option */}
                  <div className="pt-1 border-t border-slate-100 dark:border-purple-800/40">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 stroke-[2.2] shrink-0" />
                      <span className="truncate text-xs">Log Out / Switch</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
    </header>
  );
};
