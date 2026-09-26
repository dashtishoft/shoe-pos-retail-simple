import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Barcode,
  Search,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CreditCard,
  Banknote,
  User,
  ShoppingBag,
  ShieldAlert,
  Printer,
  ScanLine,
  Zap,
  Keyboard,
  Repeat,
  RotateCcw,
  X,
  CheckCircle2,
  Lock,
  ImageIcon,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { playAudioFeedback } from '../../utils/audio.ts';
import { InvoicePrintModal } from './InvoicePrintModal.tsx';
import { ShoeExchangeModal } from './ShoeExchangeModal.tsx';
import { formatStockPrice, cleanStockPriceInput, getProductRetailPrice, getProductMinFloorPrice } from '../../utils/priceFormat.ts';
import type { ActiveExchange } from '../../types.ts';
import { offlineQueueService } from '../../services/offlineQueueService.ts';
import { lookupCachedProductOffline, searchCachedProductsOffline } from '../../utils/offlineDb.ts';
import { useOfflineSync } from '../../utils/useOfflineSync.ts';
import { OfflineSyncModal } from './OfflineSyncModal.tsx';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { CustomerPicker } from './CustomerPicker.tsx';

interface CartItem {
  productId: number;
  article: string;
  name?: string;
  brandName?: string;
  brandLogo?: string;
  sku: string;
  barcode: string;
  totalStock: number;
  costPrice: number;
  pricingPolicy?: 'FIXED' | 'NEGOTIABLE';
  salePrice?: number;
  minSalePrice: number;
  maxSalePrice?: number;
  unitPrice: number;
  quantity: number;
  discount: number;
  subtotal: number;
  isPriceOverridden?: boolean;
  originalPrice?: number;
}

interface PosTerminalProps {
  currentUser: any;
  companySettings: any;
  initialExchange?: ActiveExchange | null;
  onClearInitialExchange?: () => void;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  currentUser,
  companySettings,
  initialExchange,
  onClearInitialExchange,
}) => {
  // Input Mode: 'SCANNER' (Physical Hardware Scanner listening for Enter) vs 'MANUAL' (Catalog Text Search)
  const [inputMode, setInputMode] = useState<'SCANNER' | 'MANUAL'>('SCANNER');
  // Continuous Scanning Mode: Retains scanned barcode in input field without clearing between scans
  const [continuousScan, setContinuousScan] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Focus scanner input and optionally select existing text for seamless continuous hardware/manual scanning
  const focusScannerInput = (selectText = continuousScan) => {
    const applyFocus = () => {
      const el = barcodeInputRef.current;
      if (!el) return;
      el.focus();
      if (selectText && el.value) {
        el.select();
      }
    };

    // Immediate attempt
    applyFocus();

    // Async fallback to ensure focus is restored after React re-renders or DOM mutations
    requestAnimationFrame(() => {
      applyFocus();
    });
    setTimeout(() => {
      applyFocus();
    }, 40);
  };

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Direct Shoe Exchange State
  const [activeExchange, setActiveExchange] = useState<ActiveExchange | null>(initialExchange || null);
  const [isExchangeModalOpen, setIsExchangeModalOpen] = useState(false);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE'>('CASH');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Admin Override Modal State
  const [showAdminOverrideModal, setShowAdminOverrideModal] = useState(false);
  const [overrideAdminEmail, setOverrideAdminEmail] = useState('');
  const [overrideAdminPassword, setOverrideAdminPassword] = useState('');
  const [overridePendingItem, setOverridePendingItem] = useState<{
    name: string;
    minPrice: number;
    attemptedPrice: number;
  } | null>(null);

  // Completed Invoice & Print Modal
  const [completedSale, setCompletedSale] = useState<any | null>(null);

  // Floor protection notice for clamped prices in cart
  const [cartFloorNotice, setCartFloorNotice] = useState<{ productId: number; message: string } | null>(null);

  // Price pop animation trigger state for visual feedback when items are added or quantities adjusted
  const [pricePopTrigger, setPricePopTrigger] = useState(0);
  const prevCartSummaryRef = useRef<string | null>(null);

  // Trigger subtle pop animation on total price display and auto-refocus search input whenever items/quantities change
  useEffect(() => {
    // Generate a signature of items and their quantities in the cart
    const currentSummary = cart.map((i) => `${i.productId}:${i.quantity}:${i.unitPrice}:${i.discount}`).join('|');
    // Skip initial render, trigger on subsequent additions or quantity adjustments
    if (prevCartSummaryRef.current !== null && prevCartSummaryRef.current !== currentSummary) {
      setPricePopTrigger((prev) => prev + 1);

      // Automatically regain focus on search input after adding product, enabling continuous scanning
      const activeEl = document.activeElement;
      const isOtherInputField =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT') &&
        activeEl !== barcodeInputRef.current;

      if (!isOtherInputField && !showAdminOverrideModal && !completedSale) {
        focusScannerInput(continuousScan);
      }
    }
    prevCartSummaryRef.current = currentSummary;
  }, [cart, continuousScan, showAdminOverrideModal, completedSale]);

  // Product Search / Catalog quick picker
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<{
    message: string;
    article: string;
    sku: string;
  } | null>(null);

  const isFindingProductRef = useRef<boolean>(false);
  const lastKeyTimeRef = useRef<number>(0);
  const scanBurstCountRef = useRef<number>(0);
  const autoLookupTimerRef = useRef<any>(null);

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const rawPricingMode = String(companySettings?.pricing_mode || companySettings?.pricingMode || 'NEGOTIABLE').toUpperCase();
  const isFixedPolicy = rawPricingMode === 'FIXED';
  const fixedProfitMarginSetting =
    typeof companySettings?.fixed_profit_margin === 'number'
      ? companySettings.fixed_profit_margin
      : typeof companySettings?.fixedProfitMargin === 'number'
      ? companySettings.fixedProfitMargin
      : parseFloat(companySettings?.fixed_profit_margin || companySettings?.fixedProfitMargin || '30') || 30;

  // Offline Persistence & Background Synchronization Hook
  const { isOnline, pendingCount } = useOfflineSync();
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  // Load Customers
  useEffect(() => {
    loadCustomers();
    // Auto-focus scanner on mount
    focusScannerInput();

    const handleWindowFocus = () => {
      focusScannerInput();
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, []);

  // Sync initial exchange from parent / Returns view
  useEffect(() => {
    if (initialExchange) {
      setActiveExchange(initialExchange);
      if (initialExchange.customerId) {
        setSelectedCustomerId(initialExchange.customerId);
      }
    }
  }, [initialExchange]);

  const loadCustomers = async () => {
    try {
      const res = await api.customers.list();
      setCustomers(res.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  // Action: Delete Sale / Clear Active Cart (Shortcut: F8)
  const handleDeleteSale = () => {
    if (showAdminOverrideModal) {
      setShowAdminOverrideModal(false);
      setOverridePendingItem(null);
      focusScannerInput();
      return;
    }

    if (completedSale) {
      setCompletedSale(null);
      focusScannerInput();
      return;
    }

    if (cart.length === 0 && !activeExchange) {
      playAudioFeedback.warning();
      setErrorMessage('No active sale to delete.');
      setTimeout(() => setErrorMessage(null), 2500);
      focusScannerInput();
      return;
    }

    // Reset and clear active sale & exchange
    setCart([]);
    setActiveExchange(null);
    onClearInitialExchange?.();
    setCashReceived('');
    setNotes('');
    setSelectedCustomerId(null);
    playAudioFeedback.warning();
    setErrorMessage('Sale deleted and counter reset.');
    setTimeout(() => setErrorMessage(null), 3000);
    focusScannerInput();
  };

  // Action: Print Receipt / Complete Sale (Shortcut: F9)
  const handlePrintReceiptAction = () => {
    if (completedSale) {
      // Completed invoice modal is displayed, trigger print
      window.dispatchEvent(new CustomEvent('invoice:print'));
      return;
    }

    if (cart.length > 0 && !isSubmitting) {
      handleCheckout();
    } else if (cart.length === 0) {
      playAudioFeedback.warning();
      setErrorMessage('Cannot print receipt: cart is empty. Scan product SKUs first.');
      setTimeout(() => setErrorMessage(null), 3000);
      focusScannerInput();
    }
  };

  // Keyboard shortcut listener & Smart Scanner Global Focus Redirect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Global shortcut for 'Delete Sale' (F8)
      if (e.key === 'F8') {
        e.preventDefault();
        handleDeleteSale();
        return;
      }

      // Global shortcut for 'Print Receipt' / 'Complete Checkout' (F9)
      if (e.key === 'F9') {
        e.preventDefault();
        handlePrintReceiptAction();
        return;
      }

      // Global shortcut for 'Direct Shoe Exchange' (F4 or Ctrl+E)
      if (e.key === 'F4' || (e.ctrlKey && e.key.toLowerCase() === 'e')) {
        e.preventDefault();
        setIsExchangeModalOpen((prev) => !prev);
        return;
      }

      if (showAdminOverrideModal || completedSale || isCustomerModalOpen) return;

      if (e.key === 'F2' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        focusScannerInput();
        return;
      } else if (e.key === 'F3') {
        e.preventDefault();
        setInputMode((prev) => (prev === 'SCANNER' ? 'MANUAL' : 'SCANNER'));
        focusScannerInput();
        return;
      }

      // If user is editing another input/textarea, do not intercept
      const activeEl = document.activeElement;
      const isEditingOtherInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT') &&
        activeEl !== barcodeInputRef.current;

      if (isEditingOtherInput) {
        return;
      }

      // If focus was lost outside inputs and user scans/types, immediately focus barcode input
      if (activeEl !== barcodeInputRef.current && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeInputRef.current?.focus();
      } else if (activeEl !== barcodeInputRef.current && e.key === 'Enter' && barcodeInput.trim()) {
        // Physical scanner sent Enter while focus was slightly displaced
        e.preventDefault();
        const raw = barcodeInput.trim();
        if (!continuousScan) {
          setBarcodeInput('');
        }
        triggerFindAndAddProduct(raw);
      }
    };

    // Custom event handlers dispatched by App.tsx global listener
    const onPosDeleteSaleEvent = () => {
      handleDeleteSale();
    };
    const onPosPrintReceiptEvent = () => {
      handlePrintReceiptAction();
    };
    const onPosShoeExchangeEvent = () => {
      setIsExchangeModalOpen(true);
    };
    const onPosAddToCartEvent = (e: any) => {
      const product = e.detail?.product;
      if (product) {
        addProductToCart(product);
        playAudioFeedback.barcodeScan();
        playAudioFeedback.invoiceItemAdded();
        setLastScannedFeedback({
          message: 'Product added to invoice',
          article: product.article || product.name,
          sku: product.sku,
        });
        setTimeout(() => setLastScannedFeedback(null), 3200);
      }
    };

    // Check for pending product added from Quick Price search bar
    const pendingProductStr = sessionStorage.getItem('pending_pos_product');
    if (pendingProductStr) {
      try {
        const prod = JSON.parse(pendingProductStr);
        sessionStorage.removeItem('pending_pos_product');
        addProductToCart(prod);
        playAudioFeedback.barcodeScan();
        playAudioFeedback.invoiceItemAdded();
        setLastScannedFeedback({
          message: 'Product added to invoice',
          article: prod.article || prod.name,
          sku: prod.sku,
        });
        setTimeout(() => setLastScannedFeedback(null), 3200);
      } catch {}
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pos:delete-sale', onPosDeleteSaleEvent);
    window.addEventListener('pos:print-receipt', onPosPrintReceiptEvent);
    window.addEventListener('pos:shoe-exchange', onPosShoeExchangeEvent);
    window.addEventListener('pos:add-to-cart', onPosAddToCartEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pos:delete-sale', onPosDeleteSaleEvent);
      window.removeEventListener('pos:print-receipt', onPosPrintReceiptEvent);
      window.removeEventListener('pos:shoe-exchange', onPosShoeExchangeEvent);
      window.removeEventListener('pos:add-to-cart', onPosAddToCartEvent);
    };
  }, [cart, isSubmitting, showAdminOverrideModal, completedSale, isCustomerModalOpen, barcodeInput, inputMode, continuousScan, activeExchange]);

  // Core 'Find Product' Event: Triggered immediately when barcode or SKU is scanned or entered
  const triggerFindAndAddProduct = async (rawCode: string) => {
    const query = rawCode.trim();
    if (!query || isFindingProductRef.current) return;

    isFindingProductRef.current = true;
    setErrorMessage(null);

    try {
      // 1. Direct fast lookup by Barcode or SKU
      const res = await api.products.lookupBarcode(query).catch(() => null);
      let matchedProduct = res?.product;

      // 2. If not found by direct lookup, search catalog list (SKU, barcode, or article name)
      if (!matchedProduct) {
        const searchRes = await api.products.list({ search: query }).catch(() => ({ products: [] }));
        if (searchRes.products && searchRes.products.length > 0) {
          matchedProduct =
            searchRes.products.find(
              (p: any) =>
                (p.sku && p.sku.toLowerCase() === query.toLowerCase()) ||
                (p.barcode && p.barcode.toLowerCase() === query.toLowerCase()) ||
                (p.article && p.article.toLowerCase() === query.toLowerCase())
            ) || searchRes.products[0];
        }
      }

      // 3. OFFLINE FALLBACK: If network failed or server unreachable, lookup from browser IndexedDB
      if (!matchedProduct) {
        const cached = await lookupCachedProductOffline(query).catch(() => null);
        if (cached) {
          matchedProduct = {
            ...cached,
            totalStock: cached.totalStock ?? cached.total_stock ?? 999,
            costPrice: parseFloat(cached.costPrice || cached.cost_price || 0),
            minSalePrice: parseFloat(cached.minSalePrice || cached.min_sale_price || 0),
            maxSalePrice: parseFloat(cached.maxSalePrice || cached.max_sale_price || 0),
            salePrice: parseFloat(cached.salePrice || cached.sale_price || 0),
          };
        }
      }

      if (!matchedProduct) {
        playAudioFeedback.warning();
        setErrorMessage(`No product found matching SKU or Barcode "${query}".`);
        return;
      }

      // Stock check
      if (matchedProduct.totalStock <= 0) {
        playAudioFeedback.warning();
        setErrorMessage(`Product "${matchedProduct.article || matchedProduct.name}" (${matchedProduct.sku}) is OUT OF STOCK (0 pairs available).`);
        return;
      }

      // Barcode / SKU accepted and added to invoice: play confirmation beeps!
      playAudioFeedback.barcodeScan();
      playAudioFeedback.invoiceItemAdded();

      addProductToCart(matchedProduct);

      // Flash brief confirmation badge
      setLastScannedFeedback({
        message: 'Product SKU scanned & added to invoice',
        article: matchedProduct.article || matchedProduct.name,
        sku: matchedProduct.sku,
      });
      setTimeout(() => setLastScannedFeedback(null), 3200);

      // Continuous scanning: Retain barcode input in the field without clearing it
      if (!continuousScan) {
        setBarcodeInput('');
      }
      setSearchResults([]);
    } catch (err: any) {
      playAudioFeedback.warning();
      setErrorMessage(err.message || 'Product lookup error.');
    } finally {
      isFindingProductRef.current = false;
      // Re-focus and select all text so next scan replaces it seamlessly without needing manual clearing
      focusScannerInput(continuousScan);
    }
  };

  // Dedicated Enter Key listener for physical barcode scanners and rapid keyboard entry
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setBarcodeInput('');
      setSearchResults([]);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const raw = barcodeInput.trim();
      if (raw) {
        // Continuous scan: do not clear the input field
        if (!continuousScan) {
          setBarcodeInput('');
        }
        triggerFindAndAddProduct(raw);
      }
    }
  };

  // Handle USB Barcode Scan or Form Submit
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = barcodeInput.trim();
    if (raw) {
      if (!continuousScan) {
        setBarcodeInput('');
      }
      triggerFindAndAddProduct(raw);
    }
  };

  // Live input & hardware scanner stream detection
  const handleSearchChange = async (val: string) => {
    setBarcodeInput(val);

    // In Barcode Scanner mode, suppress live search dropdown for raw hardware speed and clean Enter listening
    if (inputMode === 'SCANNER') {
      setSearchResults([]);

      const now = performance.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Detect hardware barcode scanner (very rapid key intervals < 45ms)
      if (interval < 45) {
        scanBurstCountRef.current += 1;
      } else {
        scanBurstCountRef.current = 1;
      }

      if (autoLookupTimerRef.current) {
        clearTimeout(autoLookupTimerRef.current);
      }

      // Fallback for hardware scanners that do not send an Enter suffix (5+ keys in rapid burst)
      if (scanBurstCountRef.current >= 4 && val.trim().length >= 6) {
        autoLookupTimerRef.current = setTimeout(() => {
          const query = val.trim();
          if (!continuousScan) {
            setBarcodeInput('');
          }
          triggerFindAndAddProduct(query);
        }, 65);
      }
      return;
    }

    // Manual typing search
    if (val.trim().length >= 2) {
      try {
        const res = await api.products.list({ search: val.trim() });
        const list = res.products || [];
        setSearchResults(list);

        // If exact barcode or SKU match is encountered, auto-trigger immediately
        const exactBarcodeMatch = list.find(
          (p: any) =>
            p.barcode && p.barcode.toLowerCase() === val.trim().toLowerCase()
        );
        if (exactBarcodeMatch && val.trim().length >= 6) {
          triggerFindAndAddProduct(val);
        }
      } catch {
        // Fallback to local IndexedDB product search
        const offlineResults = await searchCachedProductsOffline(val.trim()).catch(() => []);
        setSearchResults(offlineResults);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Add product to POS Cart - Uses product's actual saved selling price and policy
  const addProductToCart = (product: any) => {
    const prodIdentifier = product.article || product.name || 'Shoe';
    const cost = Math.max(0, Math.round(Number(
      product.costPrice !== undefined && product.costPrice !== null
        ? product.costPrice
        : product.cost_price !== undefined && product.cost_price !== null
        ? product.cost_price
        : 0
    )));

    const itemPolicy: 'FIXED' | 'NEGOTIABLE' = String(
      product.marginType ||
      product.margin_type ||
      (product.salePrice !== undefined && product.salePrice !== null ? 'FIXED' : (companySettings?.pricing_mode || 'FIXED'))
    ).toUpperCase() === 'NEGOTIABLE' ? 'NEGOTIABLE' : 'FIXED';

    const isItemFixed = itemPolicy === 'FIXED';

    let itemSalePrice: number = 0;
    let itemMinSalePrice: number = 0;
    let itemMaxSalePrice: number = 0;

    if (isItemFixed) {
      const rawSale = product.salePrice !== undefined && product.salePrice !== null ? product.salePrice : product.sale_price;
      itemSalePrice = rawSale !== undefined && rawSale !== null && rawSale !== ''
        ? Math.round(Number(rawSale))
        : (cost > 0 ? Math.round(cost * (1 + (companySettings?.fixed_profit_margin || companySettings?.fixedProfitMargin || 30) / 100)) : 0);
      itemMinSalePrice = itemSalePrice;
      itemMaxSalePrice = itemSalePrice;
    } else {
      const rawMin = product.minSalePrice !== undefined && product.minSalePrice !== null ? product.minSalePrice : product.min_sale_price;
      const rawMax = product.maxSalePrice !== undefined && product.maxSalePrice !== null ? product.maxSalePrice : product.max_sale_price;

      itemMinSalePrice = rawMin !== undefined && rawMin !== null && rawMin !== ''
        ? Math.round(Number(rawMin))
        : (cost > 0 ? Math.round(cost * (1 + (companySettings?.min_profit_margin || companySettings?.minProfitMargin || 15) / 100)) : 0);

      itemMaxSalePrice = rawMax !== undefined && rawMax !== null && rawMax !== ''
        ? Math.max(itemMinSalePrice, Math.round(Number(rawMax)))
        : (cost > 0 ? Math.max(itemMinSalePrice, Math.round(cost * (1 + (companySettings?.max_profit_margin || companySettings?.maxProfitMargin || 30) / 100))) : itemMinSalePrice);

      itemSalePrice = itemMaxSalePrice;
    }

    // Initial unit price in cart:
    // Fixed: saved sale_price
    // Negotiable: saved max_sale_price (the sticker M.R.P.)
    const startingUnitPrice = isItemFixed ? itemSalePrice : itemMaxSalePrice;

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((item) => item.productId === product.id);

      if (existingIdx >= 0) {
        // Increase quantity of existing row
        const existing = prevCart[existingIdx];
        const newQty = existing.quantity + 1;

        if (newQty > product.totalStock) {
          playAudioFeedback.warning();
          setErrorMessage(`Cannot add more. Stock limit for "${prodIdentifier}" is ${product.totalStock}.`);
          return prevCart;
        }

        const updated = [...prevCart];
        const subtotal = newQty * existing.unitPrice - existing.discount;
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          subtotal: Math.max(0, subtotal),
        };
        return updated;
      } else {
        // New item in cart
        if (product.totalStock <= 0) {
          playAudioFeedback.warning();
          setErrorMessage(`Product "${prodIdentifier}" is OUT OF STOCK (0 pairs available).`);
          return prevCart;
        }

        const item: CartItem = {
          productId: product.id,
          article: prodIdentifier,
          name: prodIdentifier,
          brandName: product.brandName || product.brand_name || '',
          brandLogo: product.brandLogo || product.brand_logo || '',
          sku: product.sku,
          barcode: product.barcode,
          totalStock: product.totalStock,
          costPrice: cost,
          pricingPolicy: itemPolicy,
          salePrice: itemSalePrice,
          minSalePrice: itemMinSalePrice,
          maxSalePrice: itemMaxSalePrice,
          unitPrice: startingUnitPrice,
          quantity: 1,
          discount: 0,
          subtotal: startingUnitPrice,
          isPriceOverridden: false,
          originalPrice: startingUnitPrice,
        };
        return [item, ...prevCart];
      }
    });

    setErrorMessage(null);
    // Automatically regain focus on search input after adding product, enabling continuous scanning
    focusScannerInput(continuousScan);
  };

  // Update Cart Item Quantity
  const updateQuantity = (productId: number, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > item.totalStock) {
              setErrorMessage(`Cannot exceed available stock of ${item.totalStock} for "${item.article || item.name}".`);
              return item;
            }
            const subtotal = nextQty * item.unitPrice - item.discount;
            return {
              ...item,
              quantity: nextQty,
              subtotal: Math.max(0, subtotal),
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
    // Regain focus on search input so cashier can continue scanning seamlessly
    focusScannerInput(continuousScan);
  };

  // Update Cart Item Price (Directly editable in cart)
  const updateUnitPrice = (productId: number, newPrice: number) => {
    const cleanPrice = Math.max(0, newPrice);
    setCart((prevCart) =>
      prevCart.map((i) => {
        if (i.productId === productId) {
          const subtotal = i.quantity * cleanPrice - i.discount;
          const isOverridden = cleanPrice !== (i.originalPrice ?? i.maxSalePrice ?? i.minSalePrice);
          return {
            ...i,
            unitPrice: cleanPrice,
            subtotal: Math.max(0, subtotal),
            isPriceOverridden: isOverridden,
          };
        }
        return i;
      })
    );
  };

  // Price Policy Protection in Cart: safely enforce fixed price or negotiable range [min, max]
  const handleCartPriceBlur = (productId: number, rawPrice: number) => {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    const isItemFixed = (item.pricingPolicy || (isFixedPolicy ? 'FIXED' : 'NEGOTIABLE')) === 'FIXED';
    const targetFixedPrice = Math.round(item.salePrice || item.minSalePrice || item.unitPrice);

    if (isItemFixed) {
      if (rawPrice !== targetFixedPrice) {
        playAudioFeedback.warning();
        updateUnitPrice(productId, targetFixedPrice);
        setCartFloorNotice({
          productId,
          message: `Fixed Price Item: Unit price is fixed at ${currencySymbol} ${formatStockPrice(targetFixedPrice)}.`,
        });
        setTimeout(() => {
          setCartFloorNotice((prev) => (prev?.productId === productId ? null : prev));
        }, 4500);
      }
      return;
    }

    // Negotiable product: range is [minSalePrice, maxSalePrice]
    const minFloor = Math.round(item.minSalePrice || 0);
    const maxCeiling = Math.round(item.maxSalePrice || item.unitPrice || 0);

    if (minFloor > 0 && rawPrice < minFloor) {
      playAudioFeedback.warning();
      updateUnitPrice(productId, minFloor);
      setCartFloorNotice({
        productId,
        message: `Unit price for "${item.article || item.name}" cannot be below minimum floor (${currencySymbol} ${formatStockPrice(minFloor)}).`,
      });
      setTimeout(() => {
        setCartFloorNotice((prev) => (prev?.productId === productId ? null : prev));
      }, 4500);
    } else if (maxCeiling > 0 && rawPrice > maxCeiling) {
      playAudioFeedback.warning();
      updateUnitPrice(productId, maxCeiling);
      setCartFloorNotice({
        productId,
        message: `Unit price for "${item.article || item.name}" cannot exceed maximum sale price (${currencySymbol} ${formatStockPrice(maxCeiling)}).`,
      });
      setTimeout(() => {
        setCartFloorNotice((prev) => (prev?.productId === productId ? null : prev));
      }, 4500);
    } else {
      updateUnitPrice(productId, Math.round(rawPrice));
    }
  };

  // Remove Item
  const removeFromCart = (productId: number) => {
    setCart((prevCart) => prevCart.filter((i) => i.productId !== productId));
    focusScannerInput(continuousScan);
  };

  // Totals calculations
  const totalItemsCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const grossSubtotal = cart.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0);
  const totalDiscounts = cart.reduce((acc, i) => acc + i.discount, 0);
  const newSaleTotal = Math.max(0, grossSubtotal - totalDiscounts);

  // Direct Exchange calculations
  const totalExchangeCredit = (activeExchange?.items || []).reduce(
    (acc, item) => acc + (item.subtotal || item.quantity * item.unitRefundPrice),
    0
  );
  const netDifference = newSaleTotal - totalExchangeCredit;
  const isEvenExchange = Boolean(activeExchange && Math.abs(netDifference) < 0.01);
  const isCustomerRefund = Boolean(activeExchange && netDifference < -0.01);
  const customerRefundAmount = isCustomerRefund ? Math.abs(netDifference) : 0;
  const netTotalPayable = Math.max(0, netDifference);

  const effectiveCashReceived =
    paymentMethod === 'CASH'
      ? isEvenExchange
        ? 0
        : cashReceived === ''
        ? netTotalPayable
        : cashReceived
      : 0;
  const changeDue =
    paymentMethod === 'CASH'
      ? isCustomerRefund
        ? customerRefundAmount
        : Math.max(0, (typeof effectiveCashReceived === 'number' ? effectiveCashReceived : 0) - netTotalPayable)
      : 0;

  // Quick Cash buttons handler
  const setExactCash = () => setCashReceived(netTotalPayable);
  const addQuickCash = (amount: number) => {
    setCashReceived((prev) => (typeof prev === 'number' ? prev + amount : amount));
  };

  // Handle Checkout
  const handleCheckout = async (adminOverrideCreds?: { email: string; pass: string }) => {
    if (cart.length === 0) return;

    setErrorMessage(null);
    setOfflineNotice(null);
    setIsSubmitting(true);

    const payload: any = {
      items: cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
      })),
      customerId: selectedCustomerId,
      paymentMethod,
      cashReceived: effectiveCashReceived,
      changeGiven: changeDue,
      notes,
      isMinPriceOverridden: Boolean(adminOverrideCreds || currentUser.role === 'ADMIN'),
      adminOverrideEmail: adminOverrideCreds?.email || null,
      adminOverridePassword: adminOverrideCreds?.pass || null,
    };

    if (activeExchange) {
      payload.exchange = activeExchange;
    }

    // Check if offline or network failure occurs
    if (!navigator.onLine) {
      try {
        const queued = await offlineQueueService.enqueueSale({
          items: cart.map((i) => ({
            productId: i.productId,
            name: i.name,
            article: i.article,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
          })),
          customerId: selectedCustomerId,
          customerName: customers.find((c: any) => c.id === selectedCustomerId)?.name || undefined,
          paymentMethod,
          cashReceived: Number(effectiveCashReceived) || 0,
          changeGiven: Number(changeDue) || 0,
          notes,
          totalAmount: netTotalPayable,
        });

        playAudioFeedback.saleSuccess();

        // Create an offline invoice representation so the cashier can still print receipt immediately
        const offlineSaleObj = {
          id: -Date.now(),
          invoiceNumber: `${queued.clientTxId} (OFFLINE)`,
          totalAmount: netTotalPayable,
          paymentMethod,
          cashReceived: Number(effectiveCashReceived) || 0,
          changeGiven: Number(changeDue) || 0,
          notes: notes ? `${notes} [Offline Transaction]` : '[Offline Transaction]',
          createdAt: queued.createdAt,
          items: cart.map((i) => ({
            ...i,
            product: { article: i.article, name: i.name, sku: i.sku },
          })),
          customer: customers.find((c: any) => c.id === selectedCustomerId),
        };

        setCompletedSale(offlineSaleObj);
        setOfflineNotice(
          `Offline Mode: Transaction ${queued.clientTxId} saved to browser storage. It will automatically synchronize to PostgreSQL once internet is restored.`
        );

        // Reset cart & exchange state
        setCart([]);
        setActiveExchange(null);
        onClearInitialExchange?.();
        setCashReceived('');
        setNotes('');
        setSelectedCustomerId(null);
        setShowAdminOverrideModal(false);
        setOverridePendingItem(null);
        return;
      } catch (err: any) {
        console.error('Failed to queue offline sale:', err);
        playAudioFeedback.warning();
        setErrorMessage(`Could not save offline sale: ${err?.message || 'IndexedDB error'}`);
        return;
      } finally {
        setIsSubmitting(false);
        focusScannerInput();
      }
    }

    try {
      const res = await api.pos.checkout(payload);

      // Play success chime
      playAudioFeedback.saleSuccess();

      // Set completed sale to show print receipt modal
      setCompletedSale(res.sale);

      // Reset cart & exchange state
      setCart([]);
      setActiveExchange(null);
      onClearInitialExchange?.();
      setCashReceived('');
      setNotes('');
      setSelectedCustomerId(null);
      setShowAdminOverrideModal(false);
      setOverridePendingItem(null);
      loadCustomers();
    } catch (err: any) {
      // If server unreachable or connection dropped mid-call, gracefully offer offline queuing
      const isNetError =
        err?.message &&
        (err.message.includes('Failed to fetch') ||
          err.message.includes('NetworkError') ||
          err.message.includes('Network request failed') ||
          err.message.includes('502') ||
          err.message.includes('503'));

      if (isNetError) {
        try {
          const queued = await offlineQueueService.enqueueSale({
            items: cart.map((i) => ({
              productId: i.productId,
              name: i.name,
              article: i.article,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
            })),
            customerId: selectedCustomerId,
            customerName: customers.find((c: any) => c.id === selectedCustomerId)?.name || undefined,
            paymentMethod,
            cashReceived: Number(effectiveCashReceived) || 0,
            changeGiven: Number(changeDue) || 0,
            notes,
            totalAmount: netTotalPayable,
          });

          playAudioFeedback.saleSuccess();

          const offlineSaleObj = {
            id: -Date.now(),
            invoiceNumber: `${queued.clientTxId} (OFFLINE)`,
            totalAmount: netTotalPayable,
            paymentMethod,
            cashReceived: Number(effectiveCashReceived) || 0,
            changeGiven: Number(changeDue) || 0,
            notes: notes ? `${notes} [Offline Transaction]` : '[Offline Transaction]',
            createdAt: queued.createdAt,
            items: cart.map((i) => ({
              ...i,
              product: { article: i.article, name: i.name, sku: i.sku },
            })),
            customer: customers.find((c: any) => c.id === selectedCustomerId),
          };

          setCompletedSale(offlineSaleObj);
          setOfflineNotice(
            `Connection interrupted: Saved to local offline queue (${queued.clientTxId}). Will auto-sync when online.`
          );

          setCart([]);
          setActiveExchange(null);
          onClearInitialExchange?.();
          setCashReceived('');
          setNotes('');
          setSelectedCustomerId(null);
          setShowAdminOverrideModal(false);
          setOverridePendingItem(null);
          return;
        } catch (queueErr: any) {
          playAudioFeedback.warning();
          setErrorMessage(`Connection failed and local queueing failed: ${queueErr.message}`);
          return;
        }
      }

      playAudioFeedback.warning();
      if (err.message && err.message.includes('Minimum Sale Price Violation')) {
        setShowAdminOverrideModal(true);
      }
      setErrorMessage(err.message || 'Checkout failed. Stock has been preserved.');
    } finally {
      setIsSubmitting(false);
      focusScannerInput();
    }
  };

  return (
    <div className="flex flex-col min-h-0 bg-[#F8FAFC] dark:bg-[#0B0F17] gap-4 p-4 no-print transition-colors">
      <div className="flex flex-col xl:flex-row min-h-0 gap-4 flex-1">
        {/* LEFT COLUMN: Physical Scanner & Cart Table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 flex flex-col app-card overflow-hidden transition-colors"
        >
          {/* Scanner & Quick Search Top Bar */}
          <div className="p-4 border-b border-slate-200/90 dark:border-purple-800/80 bg-slate-50/70 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white transition-colors">
            {/* Mode Switcher and Hardware Scanner Status Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="inline-flex items-center p-1 bg-slate-200/70 dark:bg-slate-950/80 rounded-xl border border-slate-300/70 dark:border-slate-800 transition-colors">
                <button
                  type="button"
                  id="pos-mode-scanner-btn"
                  onClick={() => {
                    setInputMode('SCANNER');
                    setSearchResults([]);
                    focusScannerInput();
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputMode === 'SCANNER'
                      ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border border-purple-400/40 shadow-sm shadow-purple-600/25 dark:from-purple-600 dark:to-indigo-600 dark:border-purple-400/50 dark:shadow-[0_0_14px_rgba(147,51,234,0.35)]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span>Barcode Scanner</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    inputMode === 'SCANNER' ? 'bg-white/20 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                  }`}>Enter Mode</span>
                </button>

                <button
                  type="button"
                  id="pos-mode-manual-btn"
                  onClick={() => {
                    setInputMode('MANUAL');
                    focusScannerInput();
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    inputMode === 'MANUAL'
                      ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border border-purple-400/40 shadow-sm shadow-purple-600/25 dark:from-purple-600 dark:to-indigo-600 dark:border-purple-400/50 dark:shadow-[0_0_14px_rgba(147,51,234,0.35)]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300/40 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Manual Search</span>
                </button>
              </div>

              {/* Direct Shoe Exchange & Continuous Scan / Hardware Status */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="pos-direct-exchange-btn"
                  onClick={() => setIsExchangeModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    activeExchange
                      ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                      : 'bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-900 dark:text-amber-300 border-amber-300/80 dark:border-amber-500/30 shadow-2xs'
                  }`}
                  title="Direct Shoe Return & Exchange (F4 or Ctrl+E)"
                >
                  <Repeat className={`w-3.5 h-3.5 ${activeExchange ? 'text-slate-950 animate-spin' : 'text-amber-700 dark:text-amber-400'}`} style={{ animationDuration: '6s' }} />
                  <span>Shoe Exchange</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-slate-900 dark:text-amber-200">F4</span>
                  {activeExchange && (
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                  )}
                </button>

                {/* Offline Queue Indicator Button */}
                <button
                  type="button"
                  id="pos-offline-queue-btn"
                  onClick={() => setIsOfflineModalOpen(true)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition border cursor-pointer ${
                    !isOnline
                      ? 'bg-amber-100 dark:bg-amber-950/40 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-300 animate-pulse'
                      : pendingCount > 0
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300'
                      : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                  }`}
                  title="View Offline Sales Queue & Local IndexedDB Sync"
                >
                  {!isOnline ? (
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 dark:shadow-[0_0_8px_rgba(16,185,129,0.7)]"></span>
                  )}
                  <span>{pendingCount > 0 ? `Offline Queue (${pendingCount})` : !isOnline ? 'Offline POS' : 'Offline Ready'}</span>
                </button>

                <button
                  type="button"
                  id="pos-continuous-scan-toggle"
                  onClick={() => setContinuousScan((prev) => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition border ${
                    continuousScan
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                  title="When ON, scanned barcodes remain in the input field without clearing between scans"
                >
                  <span className={`w-2 h-2 rounded-full ${continuousScan ? 'bg-emerald-500 animate-pulse dark:shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-slate-400'}`}></span>
                  <span>Continuous Scan: {continuousScan ? 'Active' : 'Off'}</span>
                </button>

                {inputMode === 'SCANNER' ? (
                  <div className="hidden lg:flex items-center gap-2 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 px-3 py-1 rounded-full text-indigo-800 dark:text-indigo-300 text-[11px] font-semibold shadow-2xs">
                    <span>Hardware Ready • Enter to add</span>
                  </div>
                ) : (
                  <div className="hidden lg:flex items-center gap-1.5 bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-3 py-1 rounded-full text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                    <Keyboard className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Manual typing & catalog search</span>
                  </div>
                )}
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0E1628] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 hidden sm:inline-block">
                  [F3: Mode]
                </span>
              </div>
            </div>

            <form onSubmit={handleBarcodeSubmit} className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-purple-600 dark:text-purple-400">
                  {inputMode === 'SCANNER' ? <ScanLine className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                </div>
                <input
                  ref={barcodeInputRef}
                  id="pos-barcode-scanner-input"
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onFocus={(e) => {
                    if (continuousScan) {
                      e.target.select();
                    }
                  }}
                  placeholder={
                    inputMode === 'SCANNER'
                      ? continuousScan
                        ? 'Continuous scan active: Scan barcode or SKU (retains code without clearing)...'
                        : 'Scan product SKU or Barcode with physical scanner (Press Enter to add)...'
                      : 'Search products by Article name, SKU, or category...'
                  }
                  className="w-full pl-[2.125rem] pr-40 py-3 bg-white dark:bg-[#0A0E1A] border-2 border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all focus:border-purple-600 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-950/40 font-mono"
                  autoComplete="off"
                  autoFocus
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {barcodeInput && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setBarcodeInput('');
                        setSearchResults([]);
                        focusScannerInput(false);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs cursor-pointer"
                      title="Clear input (Esc)"
                    >
                      ✕
                    </button>
                  )}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1 border text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60 uppercase select-none">
                    {inputMode === 'SCANNER' ? (
                      <>
                        <Zap className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>{continuousScan ? 'Continuous' : 'Enter Mode'}</span>
                      </>
                    ) : (
                      <span>Catalog Search</span>
                    )}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                id="pos-scanner-submit-btn"
                onMouseDown={(e) => e.preventDefault()}
                style={{ color: '#ffffff' }}
                className="btn-pure-white px-6 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 active:from-purple-800 active:to-indigo-800 dark:from-purple-600 dark:to-indigo-600 !text-white text-white font-bold text-sm rounded-xl border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_18px_rgba(147,51,234,0.35)] transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
              >
                {inputMode === 'SCANNER' ? (
                  <>
                    <Barcode className="w-4 h-4 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                    <span className="!text-white font-bold text-white" style={{ color: '#ffffff' }}>Add SKU (Enter)</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                    <span className="!text-white font-bold text-white" style={{ color: '#ffffff' }}>Lookup</span>
                  </>
                )}
              </button>
            </form>

            {/* Live Search Dropdown */}
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -6 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'top center' }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-6 right-6 z-40 mt-1 max-h-64 overflow-y-auto bg-white dark:bg-[#0E1628] border border-slate-200 dark:border-[#1A263D] rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800"
                >
                {searchResults.map((prod) => (
                  <div
                    key={prod.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (prod.totalStock <= 0) {
                        playAudioFeedback.warning();
                        setErrorMessage(`Product "${prod.article || prod.name}" is OUT OF STOCK.`);
                        focusScannerInput(false);
                        return;
                      }
                      addProductToCart(prod);
                      playAudioFeedback.barcodeScan();
                      playAudioFeedback.invoiceItemAdded();
                      setLastScannedFeedback({
                        message: 'Product accepted & added to invoice',
                        article: prod.article || prod.name,
                        sku: prod.sku,
                      });
                      setTimeout(() => setLastScannedFeedback(null), 3200);
                      setBarcodeInput('');
                      setSearchResults([]);
                      focusScannerInput(false);
                    }}
                    className="p-3 flex items-center justify-between hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition"
                  >
                    <div className="flex items-center space-x-3">
                      {prod.primaryImageUrl ? (
                        <div className="relative w-10 h-10 shrink-0 rounded border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                          <img
                            src={prod.primaryImageUrl}
                            alt={prod.article || prod.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const skeleton = e.currentTarget.nextElementSibling;
                              if (skeleton) skeleton.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden absolute inset-0 w-full h-full bg-slate-200/80 dark:bg-slate-800/80 animate-pulse flex flex-col items-center justify-center">
                            <ImageIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          </div>
                        </div>
                      ) : (
                        <div
                          className="w-10 h-10 shrink-0 rounded border border-slate-200/80 dark:border-slate-800 bg-slate-200/80 dark:bg-slate-800/80 animate-pulse flex flex-col items-center justify-center p-1"
                          title="No image - skeleton placeholder"
                          aria-label="Product image skeleton"
                        >
                          <div className="w-4 h-4 rounded bg-slate-300/80 dark:bg-slate-700/80 flex items-center justify-center">
                            <ImageIcon className="w-2.5 h-2.5 text-slate-400 dark:text-slate-500" />
                          </div>
                          <div className="w-5 h-1 bg-slate-300/70 dark:bg-slate-700/70 rounded-full mt-1" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{prod.article || prod.name}</p>
                          {(prod.brandName || prod.brand_name) && (
                            <div className="inline-flex items-center gap-1">
                              <BrandLogo
                                logo={prod.brandLogo || prod.brand_logo}
                                name={prod.brandName || prod.brand_name}
                                size="xs"
                              />
                              <span className="text-[10.5px] font-semibold text-slate-500 dark:text-slate-400">
                                {prod.brandName || prod.brand_name}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          SKU: {prod.sku} | Barcode: {prod.barcode}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-sm text-slate-900 dark:text-white">
                        {currencySymbol} {formatStockPrice(getProductRetailPrice(prod))}
                      </p>
                      <p className={`text-xs ${prod.totalStock <= prod.lowStockLimit ? 'text-amber-600 font-semibold' : 'text-emerald-600'}`}>
                        In Stock: {prod.totalStock}
                      </p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

            {offlineNotice && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-xl flex items-center justify-between shadow-xs text-amber-900 dark:text-amber-200 text-xs animate-in fade-in duration-200">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">{offlineNotice}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsOfflineModalOpen(true)}
                    className="underline font-bold hover:text-amber-950 dark:hover:text-amber-100 cursor-pointer"
                  >
                    View Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setOfflineNotice(null)}
                    className="text-amber-700 hover:text-amber-950 dark:hover:text-amber-100 font-bold ml-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {lastScannedFeedback && (
              <div className="mt-3 p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center justify-between shadow-xs animate-in fade-in duration-200" role="alert">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span className="font-bold">{lastScannedFeedback.message}:</span>
                  <span className="font-extrabold text-slate-900 dark:text-white">{lastScannedFeedback.article}</span>
                  <span className="text-[11px] font-mono opacity-90">({lastScannedFeedback.sku})</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                  Beep ✓ Added
                </span>
              </div>
            )}

            {errorMessage && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 rounded-xl flex items-center justify-between" role="alert">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-rose-700 dark:text-rose-300 hover:text-rose-950 dark:hover:text-white font-bold ml-2 cursor-pointer">
                  ✕
                </button>
              </div>
            )}

            {/* ACTIVE SHOE EXCHANGE BANNER */}
            {activeExchange && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-200 dark:bg-amber-900/60 rounded-lg text-amber-900 dark:text-amber-200">
                    <Repeat className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-xs text-amber-950 dark:text-amber-200">SHOE EXCHANGE IN PROGRESS</span>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/80 text-[10px] font-mono font-bold text-amber-900 dark:text-amber-200">
                        Orig Inv: #{activeExchange.originalInvoiceNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      Returning {activeExchange.items.reduce((s, i) => s + i.quantity, 0)} shoe(s) • Exchange Credit:{' '}
                      <strong className="font-mono text-slate-950 dark:text-white font-black">
                        {currencySymbol} {formatStockPrice(totalExchangeCredit)}
                      </strong>
                      {activeExchange.customerName && ` • Customer: ${activeExchange.customerName}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExchangeModalOpen(true)}
                    className="px-2.5 py-1 bg-white dark:bg-[#0E1628] hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    Adjust Return
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveExchange(null);
                      onClearInitialExchange?.();
                    }}
                    className="px-2 py-1 bg-amber-200/60 dark:bg-amber-900/40 hover:bg-red-100 dark:hover:bg-red-950/60 text-slate-700 dark:text-slate-300 hover:text-red-700 dark:hover:text-red-300 rounded-lg text-xs font-semibold transition cursor-pointer"
                    title="Cancel this exchange and restore regular POS sale"
                  >
                    Cancel Exchange
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* CART TABLE (STRICT SPEC: Product, Quantity, Unit Price, Discount, Total) */}
        <div className="flex-1 overflow-auto">
          {cart.length === 0 && !activeExchange ? (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 text-center select-none">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-[#131B2E] flex items-center justify-center mb-4 border border-slate-200/80 dark:border-slate-800 shadow-inner">
                <Barcode className="w-10 h-10 text-slate-400 dark:text-blue-400/70 stroke-[1.4]" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">POS Cart is Empty</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed">
                Scan shoes using a physical Barcode Scanner or type SKU/Article in the top input to begin checkout.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 justify-center text-[11px]">
                <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-full font-mono font-semibold shadow-2xs">
                  F2: Focus Scanner
                </span>
                <span className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-full font-mono font-semibold shadow-2xs">
                  F3: Scanner / Search Mode
                </span>
                <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full font-mono font-semibold shadow-2xs">
                  F4: Shoe Exchange
                </span>
                <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3 py-1 rounded-full font-mono font-semibold shadow-2xs">
                  Enter: Rapid Add SKU
                </span>
                <span className="bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-3 py-1 rounded-full font-mono font-semibold shadow-2xs">
                  F8: Delete Sale
                </span>
                <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-3 py-1 rounded-full font-mono font-semibold shadow-2xs">
                  F9: Print Receipt
                </span>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-600 dark:text-white font-semibold border-b border-slate-200 dark:border-purple-800/80 z-10 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Article</th>
                  <th className="py-2.5 px-3 text-center w-28">Quantity</th>
                  <th className="py-2.5 px-3 text-right w-44">
                    Unit Price {isFixedPolicy ? '(Fixed Policy)' : '(MRP / Floor)'}
                  </th>
                  <th className="py-2.5 px-4 text-right w-32">Total</th>
                  <th className="py-2.5 px-3 text-center w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#1A263D]">
                {/* RETURNED ITEMS FOR DIRECT EXCHANGE (CREDIT ROWS) */}
                {activeExchange &&
                  activeExchange.items.map((retItem, idx) => (
                    <tr key={`exchange-ret-${retItem.saleItemId || idx}`} className="bg-amber-50/60 dark:bg-amber-950/20 text-amber-950 dark:text-amber-200 border-b border-amber-200/60 dark:border-amber-900/40">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-300 dark:bg-amber-900/80 text-slate-900 dark:text-amber-200 border border-amber-400 dark:border-amber-700">
                            EXCHANGE RETURN
                          </span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white line-through opacity-85">{retItem.productName}</span>
                        </div>
                        <div className="text-[11px] text-amber-800 dark:text-amber-400 font-mono mt-0.5">
                          Inv: #{activeExchange.originalInvoiceNumber} • SKU: {retItem.sku}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-amber-900 dark:text-amber-300">
                        -{retItem.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-900 dark:text-amber-300">
                        {currencySymbol} {formatStockPrice(retItem.unitRefundPrice)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                        -{currencySymbol} {formatStockPrice(retItem.subtotal)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveExchange(null);
                            onClearInitialExchange?.();
                          }}
                          className="p-1 text-amber-700 dark:text-amber-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded cursor-pointer transition"
                          title="Remove Exchange Credit"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                {cart.map((item) => {
                  const isItemFixed = (item.pricingPolicy || (isFixedPolicy ? 'FIXED' : 'NEGOTIABLE')) === 'FIXED';
                  const cost = item.costPrice || 0;
                  const itemMinFloor = Math.round(item.minSalePrice || (isItemFixed ? item.unitPrice : 0));
                  const itemMaxPrice = Math.round(item.maxSalePrice || item.unitPrice || 0);

                  // Effective sale price per unit
                  const effectiveUnitPrice = item.unitPrice;
                  const unitProfit = effectiveUnitPrice - cost;
                  const currentMargin =
                    effectiveUnitPrice > 0
                      ? (unitProfit / effectiveUnitPrice) * 100
                      : cost > 0
                      ? -100
                      : 0;

                  const isBelowFloor = !isItemFixed && itemMinFloor > 0 && item.unitPrice < itemMinFloor;
                  const isAboveMax = !isItemFixed && itemMaxPrice > 0 && item.unitPrice > itemMaxPrice;
                  const isLoss = cost > 0 && effectiveUnitPrice < cost;

                  return (
                    <tr
                      key={item.productId}
                      id={`cart-row-${item.productId}`}
                      className={`transition ${
                        isBelowFloor || isAboveMax
                          ? 'bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-50/80 dark:hover:bg-rose-950/30 border-l-4 border-l-rose-500'
                          : 'hover:bg-slate-50/80 dark:hover:bg-[#131E35]/60'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-900 dark:text-white text-sm">{item.article || item.name}</span>
                          {item.brandName && (
                            <div className="inline-flex items-center gap-1">
                              <BrandLogo
                                logo={item.brandLogo}
                                name={item.brandName}
                                size="xs"
                              />
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                                {item.brandName}
                              </span>
                            </div>
                          )}
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isItemFixed
                              ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                              : 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                          }`}>
                            {isItemFixed ? 'Fixed' : 'Negotiable'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          SKU: {item.sku} | Barcode: {item.barcode}
                        </div>

                        {/* Visual Warning: Price below configured minimum profit margin */}
                        {isBelowFloor && (
                          <div
                            id={`cart-row-margin-warning-${item.productId}`}
                            className="inline-flex items-center gap-1.5 text-[10px] text-rose-700 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded font-semibold mt-1 shadow-2xs"
                            title={`Cost: ${currencySymbol} ${formatStockPrice(cost)} | Effective: ${currencySymbol} ${formatStockPrice(effectiveUnitPrice)} | Margin: ${Math.round(currentMargin)}% | Floor: ${currencySymbol} ${formatStockPrice(itemMinFloor)}`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>
                              {isLoss ? 'Selling at Loss!' : 'Below Negotiable Floor!'}{' '}
                              <strong className="font-mono">{currencySymbol} {formatStockPrice(item.unitPrice)}</strong>{' '}
                              <span className="text-rose-600 dark:text-rose-400 font-normal">(Min allowed: {currencySymbol} {formatStockPrice(itemMinFloor)})</span>
                            </span>
                          </div>
                        )}
                        {isAboveMax && (
                          <div
                            className="inline-flex items-center gap-1.5 text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded font-semibold mt-1 shadow-2xs"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>
                              Exceeds Maximum Price! (Max: {currencySymbol} {formatStockPrice(itemMaxPrice)})
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Quantity Controls */}
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center space-x-1">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="p-1 rounded bg-slate-100 dark:bg-[#131B2E] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 transition border border-slate-200/60 dark:border-slate-700 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-bold text-slate-900 dark:text-white text-sm">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, 1)}
                            disabled={item.quantity >= item.totalStock}
                            className="p-1 rounded bg-slate-100 dark:bg-[#131B2E] hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 active:scale-95 disabled:opacity-40 transition border border-slate-200/60 dark:border-slate-700 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Unit Price (Directly Editable in Negotiable Mode, Fixed in Fixed Mode) */}
                      <td className="py-3 px-3 text-right align-top">
                        <div className="flex flex-col items-end">
                          <div className="inline-flex items-center justify-end space-x-1">
                            <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">{currencySymbol}</span>
                            {isItemFixed ? (
                              <input
                                type="number"
                                readOnly
                                disabled
                                value={item.unitPrice}
                                className="w-24 text-right px-2 py-1 rounded-lg border font-mono text-xs font-bold bg-slate-100 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border-purple-200 dark:border-purple-800 cursor-not-allowed select-none"
                                title={`Fixed Price Item: ${currencySymbol} ${formatStockPrice(item.unitPrice)}. Non-negotiable.`}
                              />
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.unitPrice}
                                onChange={(e) => {
                                  const val = Math.round(parseFloat(cleanStockPriceInput(e.target.value)) || 0);
                                  updateUnitPrice(item.productId, val);
                                }}
                                onBlur={(e) => {
                                  const val = Math.round(parseFloat(cleanStockPriceInput(e.target.value)) || 0);
                                  handleCartPriceBlur(item.productId, val);
                                }}
                                className={`w-24 text-right px-2 py-1 rounded-lg border font-mono text-xs font-bold outline-none transition focus:ring-2 ${
                                  isBelowFloor || isAboveMax
                                    ? 'border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200 ring-1 ring-rose-300 dark:ring-rose-800 focus:border-rose-600 focus:ring-rose-200'
                                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0A0E1A] text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-950/50'
                                }`}
                                title={`Cost: ${currencySymbol} ${formatStockPrice(cost)} | Max: ${currencySymbol} ${formatStockPrice(itemMaxPrice)} | Floor: ${currencySymbol} ${formatStockPrice(itemMinFloor)}`}
                              />
                            )}
                          </div>

                          {/* Reference: Fixed Policy vs Negotiable Range */}
                          {isItemFixed ? (
                            <div className="text-[10px] text-purple-700 dark:text-purple-400 font-mono mt-1 space-y-0.5 text-right flex items-center justify-end gap-1">
                              <Lock className="w-3 h-3 text-purple-500 shrink-0" />
                              <span>Fixed ({currencySymbol} {formatStockPrice(item.unitPrice)})</span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-1 space-y-0.5 text-right">
                              <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                                Max: <strong className="font-bold">{currencySymbol} {formatStockPrice(itemMaxPrice)}</strong>
                              </div>
                              <div className="text-amber-700 dark:text-amber-400">
                                Floor: <strong className="font-semibold">{currencySymbol} {formatStockPrice(itemMinFloor)}</strong>
                              </div>
                            </div>
                          )}

                          {/* Notice when auto-clamped upon blur */}
                          {cartFloorNotice?.productId === item.productId && (
                            <div className="mt-1 p-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-right text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold animate-in fade-in duration-150">
                              Clamped ({currencySymbol} {formatStockPrice(item.unitPrice)})
                            </div>
                          )}

                          {/* Floor Protection Alert with One-Click Fix Action */}
                          {isBelowFloor && (
                            <div
                              id={`cart-floor-alert-${item.productId}`}
                              className="mt-1.5 p-1.5 bg-rose-100/90 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-lg text-right max-w-[200px] shadow-2xs animate-in fade-in duration-150"
                            >
                              <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                                <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                <span>{isLoss ? 'Selling at Loss!' : 'Below Negotiable Floor!'}</span>
                              </div>
                              <p className="text-[9px] text-rose-600 dark:text-rose-400 mt-0.5">
                                Min required: {currencySymbol} {formatStockPrice(itemMinFloor)}
                              </p>
                              <div className="mt-1 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    updateUnitPrice(item.productId, itemMinFloor);
                                    playAudioFeedback.barcodeScan();
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold hover:bg-rose-700 transition cursor-pointer"
                                >
                                  Set to Min Floor
                                </button>
                              </div>
                            </div>
                          )}
                          {isAboveMax && (
                            <div
                              className="mt-1.5 p-1.5 bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-lg text-right max-w-[200px] shadow-2xs animate-in fade-in duration-150"
                            >
                              <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>Above Max Price!</span>
                              </div>
                              <p className="text-[9px] text-amber-700 dark:text-amber-400 mt-0.5">
                                Max allowed: {currencySymbol} {formatStockPrice(itemMaxPrice)}
                              </p>
                              <div className="mt-1 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    updateUnitPrice(item.productId, itemMaxPrice);
                                    playAudioFeedback.barcodeScan();
                                  }}
                                  className="px-2 py-0.5 bg-amber-600 text-white rounded text-[10px] font-bold hover:bg-amber-700 transition cursor-pointer"
                                >
                                  Set to Max Price
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Line Total */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white text-sm font-mono">
                        {currencySymbol} {formatStockPrice(item.subtotal)}
                      </td>

                      {/* Remove Button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Cart Bottom Bar */}
        {cart.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-white">
            <div className="flex space-x-4">
              <span>Rows: <strong className="text-slate-900 dark:text-white">{cart.length}</strong></span>
              <span>Total Shoes: <strong className="text-slate-900 dark:text-white">{totalItemsCount} pairs</strong></span>
            </div>
            <button
              id="pos-delete-sale-cart-btn"
              type="button"
              onClick={handleDeleteSale}
              className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white rounded-lg font-bold flex items-center space-x-1.5 shadow-xs transition active:scale-95 cursor-pointer"
              title="Delete active sale / clear cart (F8)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Sale</span>
              <kbd className="text-[10px] bg-white/20 text-white px-1 py-0.2 rounded font-mono">F8</kbd>
            </button>
          </div>
        )}
      </motion.div>

      {/* RIGHT COLUMN: Customer, Payment, Cash Tender & Checkout */}
      <div className="w-full xl:w-96 shrink-0 flex flex-col gap-4">
        {/* Customer Selector Card (High-Volume Searchable Combobox & Find Customer Modal) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="app-card p-4 transition-colors relative z-20"
        >
          <CustomerPicker
            customers={customers}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={(customerId) => {
              setSelectedCustomerId(customerId);
              focusScannerInput(continuousScan);
            }}
            onCustomerCreated={(newCustomer) => {
              setCustomers((prev) => [newCustomer, ...prev]);
              setSelectedCustomerId(newCustomer.id);
            }}
            currencySymbol={currencySymbol}
            onModalOpenChange={setIsCustomerModalOpen}
          />
        </motion.div>

        {/* Payment Calculation & Tender Box */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="app-card p-4 flex-1 flex flex-col justify-between transition-colors"
        >
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold text-blue-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-cyan-400"></span>
                <span>Payment Summary</span>
              </h3>
              <motion.span
                key={`cart-item-count-${pricePopTrigger}`}
                id="pos-cart-item-count"
                initial={pricePopTrigger > 0 ? { scale: 1.15 } : false}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-mono inline-block"
              >
                {totalItemsCount} item{totalItemsCount === 1 ? '' : 's'}
              </motion.span>
            </div>

            {/* Subtotal & Discounts */}
            <div className="space-y-1.5 text-xs border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium items-center">
                <span>Gross Subtotal:</span>
                <motion.span
                  key={`gross-subtotal-${pricePopTrigger}`}
                  id="pos-cart-gross-subtotal"
                  initial={pricePopTrigger > 0 ? { scale: 1.08 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className="font-mono font-bold text-slate-900 dark:text-white inline-block"
                >
                  {currencySymbol} {formatStockPrice(grossSubtotal)}
                </motion.span>
              </div>
              {totalDiscounts > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>Total Discount:</span>
                  <span className="font-mono">-{currencySymbol} {formatStockPrice(totalDiscounts)}</span>
                </div>
              )}
              {activeExchange && (
                <div className="flex justify-between text-amber-900 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200 dark:border-amber-800/60">
                  <span className="flex items-center gap-1">
                    <RotateCcw className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                    <span>Shoe Exchange Credit:</span>
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">-{currencySymbol} {formatStockPrice(totalExchangeCredit)}</span>
                </div>
              )}
            </div>

            {/* BIG TOTAL PAYABLE / NET EXCHANGE STATUS BOX WITH TACTILE POP ANIMATION */}
            <div
              className={`p-4 rounded-2xl text-center shadow-md relative overflow-hidden transition-colors duration-300 ${
                isEvenExchange
                  ? 'bg-[#0f2e24] border border-emerald-600/80 shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                  : isCustomerRefund
                  ? 'bg-[#2b1807] border border-amber-600/80 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                  : 'bg-[#0A1224] dark:bg-[#080D1A] border border-blue-900/60 dark:border-blue-900/40 shadow-md shadow-blue-950/20'
              }`}
            >
              {/* Subtle visual ripple feedback when total price updates */}
              <AnimatePresence>
                {pricePopTrigger > 0 && (
                  <motion.div
                    key={`pop-glow-${pricePopTrigger}`}
                    initial={{ opacity: 0.35, scale: 0.85 }}
                    animate={{ opacity: 0, scale: 1.35 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className={`absolute inset-0 pointer-events-none rounded-2xl ${
                      isEvenExchange
                        ? 'bg-emerald-400/20'
                        : isCustomerRefund
                        ? 'bg-amber-400/20'
                        : 'bg-blue-400/25'
                    }`}
                  />
                )}
              </AnimatePresence>

              <div className="flex items-center justify-center gap-1.5 mb-1 relative z-10">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    isEvenExchange
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : isCustomerRefund
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {isEvenExchange
                    ? 'EVEN SHOE EXCHANGE'
                    : isCustomerRefund
                    ? 'REFUND DUE TO CUSTOMER'
                    : activeExchange
                    ? 'NET PAYABLE AFTER EXCHANGE'
                    : 'TOTAL PAYABLE'}
                </span>
              </div>

              {/* Total Price Display with subtle Pop Animation */}
              <div className="relative z-10 flex items-center justify-center py-0.5">
                <motion.div
                  key={`total-price-pop-${pricePopTrigger}`}
                  id="pos-cart-total-price-display"
                  initial={
                    pricePopTrigger > 0
                      ? { scale: 1.14, filter: 'brightness(1.2)' }
                      : false
                  }
                  animate={{ scale: 1, filter: 'brightness(1)' }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 22,
                    mass: 0.6,
                  }}
                  className="text-3xl font-black text-white font-mono tracking-tight select-none inline-flex items-center gap-1.5"
                >
                  <span>{currencySymbol}</span>
                  <span>{formatStockPrice(isCustomerRefund ? customerRefundAmount : netTotalPayable)}</span>
                </motion.div>
              </div>

              {activeExchange && (
                <p className="text-[11px] text-slate-300 mt-1 relative z-10">
                  {isEvenExchange
                    ? 'Equal value swap • Zero balance required'
                    : isCustomerRefund
                    ? `Returned shoes exceed replacement by ${currencySymbol} ${formatStockPrice(customerRefundAmount)}`
                    : `Replacement shoes exceed return by ${currencySymbol} ${formatStockPrice(netTotalPayable)}`}
                </p>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2.5 px-3 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                    paymentMethod === method
                      ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.35)]'
                      : 'bg-slate-100 dark:bg-[#131B2E] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-800 font-semibold'
                  }`}
                >
                  {method === 'CASH' && <Banknote className="w-3.5 h-3.5" />}
                  {method === 'CARD' && <CreditCard className="w-3.5 h-3.5" />}
                  <span>{method === 'BANK_TRANSFER' ? 'Transfer' : method}</span>
                </button>
              ))}
            </div>

            {/* Cash Received Tender & Quick Cash Buttons */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                {isEvenExchange ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-900 dark:text-emerald-200 text-center">
                    ✓ Even shoe exchange: No cash collection or refund needed.
                  </div>
                ) : isCustomerRefund ? (
                  <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-950 dark:text-amber-200">
                    <span>Cash Refund to Customer:</span>
                    <span className="font-mono text-base font-black text-amber-700 dark:text-amber-400">
                      {currencySymbol} {formatStockPrice(customerRefundAmount)}
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Cash Tendered:</span>
                      <div className="relative w-36">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-mono text-xs">
                          {currencySymbol}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder={formatStockPrice(netTotalPayable)}
                          value={cashReceived}
                          onChange={(e) => setCashReceived(e.target.value === '' ? '' : Math.round(parseFloat(e.target.value)))}
                          className="w-full pl-8 pr-2 py-1.5 text-right font-mono font-bold text-sm bg-white dark:bg-[#0A0E1A] border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Add Buttons */}
                    <div className="grid grid-cols-4 gap-1.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={setExactCash}
                        className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-xs active:scale-95 transition cursor-pointer"
                      >
                        Exact
                      </button>
                      <button
                        type="button"
                        onClick={() => addQuickCash(500)}
                        className="px-2 py-1.5 bg-slate-100 dark:bg-[#131B2E] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-800 rounded-lg font-bold shadow-2xs active:scale-95 transition cursor-pointer"
                      >
                        +500
                      </button>
                      <button
                        type="button"
                        onClick={() => addQuickCash(1000)}
                        className="px-2 py-1.5 bg-slate-100 dark:bg-[#131B2E] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-800 rounded-lg font-bold shadow-2xs active:scale-95 transition cursor-pointer"
                      >
                        +1,000
                      </button>
                      <button
                        type="button"
                        onClick={() => addQuickCash(5000)}
                        className="px-2 py-1.5 bg-slate-100 dark:bg-[#131B2E] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-800 rounded-lg font-bold shadow-2xs active:scale-95 transition cursor-pointer"
                      >
                        +5,000
                      </button>
                    </div>

                    {/* Real-time Change Due */}
                    <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-bold text-emerald-950 dark:text-emerald-200">
                      <span>Change Given:</span>
                      <span className="font-mono text-base font-black">
                        {currencySymbol} {formatStockPrice(changeDue)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Counter Notes */}
            <input
              type="text"
              placeholder="Sale notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0A0E1A] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40"
            />
          </div>

          {/* CHECKOUT BUTTON (F9) & DELETE SALE (F8) */}
          <div className="pt-4 mt-2 space-y-2">
            <button
              type="button"
              id="pos-print-receipt-btn"
              onClick={() => handlePrintReceiptAction()}
              disabled={cart.length === 0 || isSubmitting}
              className={`w-full py-3.5 text-base font-extrabold rounded-xl shadow-lg flex items-center justify-center space-x-2 cursor-pointer active:scale-[0.98] disabled:opacity-50 transition-all ${
                activeExchange
                  ? 'bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black shadow-amber-500/25'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 active:from-purple-800 active:to-indigo-800 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_24px_rgba(147,51,234,0.4)]'
              }`}
            >
              {activeExchange ? <Repeat className="w-5 h-5" /> : <Printer className="w-5 h-5" />}
              <span>
                {isSubmitting
                  ? 'Recording Transaction...'
                  : isEvenExchange
                  ? 'Complete Even Shoe Exchange (F9)'
                  : isCustomerRefund
                  ? 'Authorize Exchange & Refund Difference (F9)'
                  : activeExchange
                  ? 'Authorize Exchange & Print Receipt (F9)'
                  : 'Print Receipt & Complete (F9)'}
              </span>
            </button>

            {(cart.length > 0 || activeExchange) && (
              <button
                type="button"
                id="pos-delete-sale-btn"
                onClick={handleDeleteSale}
                className="w-full py-2 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300/80 dark:border-rose-800/60 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-98 cursor-pointer"
                title="Delete active sale / cancel transaction (F8)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Active Sale / Cancel Exchange</span>
                <kbd className="text-[10px] bg-rose-200/80 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 px-1.5 py-0.2 rounded font-mono">F8</kbd>
              </button>
            )}

            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-1">
              Atomic PostgreSQL update • Real-time stock reduction
            </p>
          </div>
        </motion.div>
      </div>
    </div>

    {/* Dedicated Footer Branding */}
    <div className="text-center py-2 text-[11px] text-slate-400 dark:text-slate-500 select-none">
      Designed &amp; Developed by <span className="text-slate-700 dark:text-slate-200 font-semibold">SarbaazSoft</span> © 2026
    </div>

      {/* ADMIN OVERRIDE MODAL FOR MIN SALE PRICE VIOLATION */}
      {showAdminOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-purple-800/80 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white">
              <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400">
                <div className="p-2 bg-amber-100 dark:bg-amber-950/60 rounded-xl">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Admin Authorization</h3>
                  <p className="text-xs text-slate-500 dark:text-purple-200/80">Price Floor Override</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdminOverrideModal(false);
                  setOverridePendingItem(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCheckout({
                  email: overrideAdminEmail,
                  pass: overrideAdminPassword,
                });
              }}
              className="flex flex-col"
            >
              <div className="p-6 space-y-3 text-xs">
                {overridePendingItem && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs space-y-1 text-amber-900 dark:text-amber-200">
                    <p><strong>Item:</strong> {overridePendingItem.name}</p>
                    <p><strong>Minimum Allowed Price:</strong> {currencySymbol} {formatStockPrice(overridePendingItem.minPrice)}</p>
                    <p><strong>Attempted Sale Price:</strong> {currencySymbol} {formatStockPrice(overridePendingItem.attemptedPrice)}</p>
                  </div>
                )}

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Shop policy strictly prohibits selling below the minimum price. Please enter Shop Owner or Admin credentials to authorize this discount.
                </p>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Admin Email</label>
                  <input
                    type="email"
                    value={overrideAdminEmail}
                    onChange={(e) => setOverrideAdminEmail(e.target.value)}
                    placeholder="admin@shoepos.com"
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0E1A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-blue-600 dark:focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Admin Password</label>
                  <input
                    type="password"
                    value={overrideAdminPassword}
                    onChange={(e) => setOverrideAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0A0E1A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl outline-none focus:border-blue-600 dark:focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminOverrideModal(false);
                    setOverridePendingItem(null);
                  }}
                  className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancel Sale
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 rounded-xl text-xs font-bold shadow-md shadow-purple-600/25 transition cursor-pointer"
                >
                  {isSubmitting ? 'Authorizing...' : 'Authorize & Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPLETED INVOICE PRINT MODAL */}
      {completedSale && (
        <InvoicePrintModal
          sale={completedSale}
          companySettings={companySettings}
          onClose={() => {
            setCompletedSale(null);
            focusScannerInput();
          }}
        />
      )}

      {/* DIRECT SHOE EXCHANGE MODAL */}
      {isExchangeModalOpen && (
        <ShoeExchangeModal
          companySettings={companySettings}
          onClose={() => setIsExchangeModalOpen(false)}
          onApplyExchange={(exchange) => {
            setActiveExchange(exchange);
            if (exchange.customerId) {
              setSelectedCustomerId(exchange.customerId);
            }
            setIsExchangeModalOpen(false);
            focusScannerInput();
          }}
        />
      )}
      {/* OFFLINE SALES QUEUE & SYNC MODAL */}
      <OfflineSyncModal
        isOpen={isOfflineModalOpen}
        onClose={() => {
          setIsOfflineModalOpen(false);
          focusScannerInput();
        }}
        currencySymbol={currencySymbol}
      />
    </div>
  );
};
