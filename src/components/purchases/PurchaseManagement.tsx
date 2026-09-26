import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Truck,
  Plus,
  Search,
  DollarSign,
  X,
  Trash2,
  CheckCircle2,
  Building2,
  Barcode,
  Globe,
  Phone,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  Table,
  Check,
  Package,
  MapPin,
  Mail,
  RefreshCw,
  Eye,
  AlertCircle,
  AlertTriangle,
  FileText,
  CreditCard,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { playAudioFeedback } from '../../utils/audio.ts';
import { cleanStockPriceInput, formatStockPrice } from '../../utils/priceFormat.ts';
import { ProductFormModal } from '../inventory/ProductFormModal.tsx';
import { SupplierReturnModal } from './SupplierReturnModal.tsx';
import { PurchaseReturnDetailsModal } from './PurchaseReturnDetailsModal.tsx';
import { SupplierPaymentModal } from '../suppliers/SupplierPaymentModal.tsx';
import { SupplierPicker } from './SupplierPicker.tsx';
import { StatCard, triggerStatRecount } from '../common/StatCard.tsx';
import { useScrollActiveTab } from '../../hooks/useScrollActiveTab.ts';

interface PurchaseManagementProps {
  currentUser: any;
  companySettings: any;
  initialSupplierId?: number;
  initialSupplierName?: string;
  onNavigateToSuppliers?: () => void;
}

export const PurchaseManagement: React.FC<PurchaseManagementProps> = ({
  currentUser,
  companySettings,
  initialSupplierId,
  initialSupplierName,
  onNavigateToSuppliers,
}) => {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(true);

  // Initial Payment in Purchase Creation Modal (Optional)
  const [initialPaidAmount, setInitialPaidAmount] = useState<string>('');
  const [initialPaymentMethod, setInitialPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'ONLINE'>('CASH');
  const [initialPaymentRef, setInitialPaymentRef] = useState<string>('');

  // Payment Modal from Purchases List / Details
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalSupplier, setPaymentModalSupplier] = useState<any | null>(null);
  const [paymentModalPurchaseId, setPaymentModalPurchaseId] = useState<number | undefined>();
  const [paymentModalPurchaseNumber, setPaymentModalPurchaseNumber] = useState<string | undefined>();
  const [paymentModalDefaultAmount, setPaymentModalDefaultAmount] = useState<number | undefined>();

  // Tab View: Purchases (Inward) vs Supplier Returns & Debit Notes (Defective Cartons)
  const [activeTab, setActiveTab] = useState<'purchases' | 'returns'>('purchases');
  const { containerRef: purchaseTabContainerRef } = useScrollActiveTab<HTMLDivElement>(activeTab, {
    padding: 16,
    behavior: 'smooth',
  });
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnModalPurchaseNumber, setReturnModalPurchaseNumber] = useState<string | undefined>();
  const [returnModalSupplierId, setReturnModalSupplierId] = useState<number | undefined>();
  const [selectedReturnRecord, setSelectedReturnRecord] = useState<any | null>(null);
  const [isReturnDetailsModalOpen, setIsReturnDetailsModalOpen] = useState(false);

  // View Past Purchase Details Modal
  const [viewPurchaseModalOpen, setViewPurchaseModalOpen] = useState(false);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<any | null>(null);
  const [isLoadingPurchaseDetails, setIsLoadingPurchaseDetails] = useState(false);

  // Suppliers State
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>(initialSupplierId || '');
  const [supplierName, setSupplierName] = useState(initialSupplierName || '');
  const [supplierInvoice, setSupplierInvoice] = useState('');
  const [notes, setNotes] = useState('');

  // Supplier Table Modal (Select Supplier from Table)
  const [isSupplierTableModalOpen, setIsSupplierTableModalOpen] = useState(false);
  const [supplierSearchInModal, setSupplierSearchInModal] = useState('');
  const [isSupplierPickerModalOpen, setIsSupplierPickerModalOpen] = useState(false);

  // Quick Add Supplier Modal
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierEmail, setQuickSupplierEmail] = useState('');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Products & Product Selection
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [lotSize, setLotSize] = useState<6 | 8>(6);
  const [itemQty, setItemQty] = useState<number>(6);
  const [itemUnitCost, setItemUnitCost] = useState<number | ''>('');

  const handleLotSizeChange = (newSize: 6 | 8) => {
    setLotSize(newSize);
    setItemQty(newSize);
  };

  // Catalog Products Table Modal (Browse and select from table)
  const [isProductCatalogModalOpen, setIsProductCatalogModalOpen] = useState(false);
  const [catalogModalSearch, setCatalogModalSearch] = useState('');
  const [catalogModalBrand, setCatalogModalBrand] = useState<string>('ALL');
  const [catalogModalCategory, setCatalogModalCategory] = useState<string>('ALL');

  // Direct product creation modal from within purchase management
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);

  // Items in current purchase order
  const [items, setItems] = useState<
    Array<{
      productId: number;
      article: string;
      name?: string;
      sku: string;
      barcode?: string;
      brandName?: string;
      categoryName?: string;
      primaryImageUrl?: string;
      quantity: number;
      unitCost: number;
    }>
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [purchaseScanFeedback, setPurchaseScanFeedback] = useState<string | null>(null);

  // Refs for auto-focus navigation and barcode scanner stream timing
  const productInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const costInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const step3EnteredTimeRef = useRef<number>(0);
  const isFindingProductRef = useRef<boolean>(false);
  const lastKeyTimeRef = useRef<number>(0);
  const scanBurstCountRef = useRef<number>(0);
  const autoScanTimerRef = useRef<any>(null);

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

  const focusProductInput = () => {
    setTimeout(() => {
      productInputRef.current?.focus();
    }, 60);
  };

  // Auto-focus product input whenever the Add Purchase modal opens
  useEffect(() => {
    if (isModalOpen) {
      focusProductInput();
    }
  }, [isModalOpen]);

  // Global key navigation & auto-focus for barcode scanning inside the purchase modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen || isProductCatalogModalOpen || isSupplierTableModalOpen || isSupplierPickerModalOpen) return;

      if (e.key === 'F2' || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        focusProductInput();
        return;
      }

      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');

      // If user scans or types while not focused in any input, automatically transfer focus to the product scanner input
      if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        productInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isModalOpen, isProductCatalogModalOpen, isSupplierTableModalOpen, isSupplierPickerModalOpen]);

  useEffect(() => {
    loadPurchases();
    loadPurchaseReturns();
    loadProducts();
    loadSuppliers();
    loadBrandsAndCategories();

    // Check for pending purchase entry from Quick Price search bar
    const handleNewPurchaseEvent = (e: any) => {
      const product = e.detail?.product;
      if (product) {
        setIsModalOpen(true);
        setModalStep(1);
        handleSelectProduct(product);
      }
    };

    window.addEventListener('purchase:new-entry', handleNewPurchaseEvent);

    const pendingPurchaseStr = sessionStorage.getItem('pending_purchase_product');
    if (pendingPurchaseStr) {
      try {
        const prod = JSON.parse(pendingPurchaseStr);
        sessionStorage.removeItem('pending_purchase_product');
        setIsModalOpen(true);
        setModalStep(1);
        handleSelectProduct(prod);
      } catch {}
    }

    return () => {
      window.removeEventListener('purchase:new-entry', handleNewPurchaseEvent);
    };
  }, []);

  useEffect(() => {
    if (initialSupplierId) {
      setSelectedSupplierId(initialSupplierId);
      setIsModalOpen(true);
      setModalStep(1);
    }
    if (initialSupplierName) {
      setSupplierName(initialSupplierName);
    }
  }, [initialSupplierId, initialSupplierName]);

  // Close product search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        productInputRef.current &&
        !productInputRef.current.contains(e.target as Node)
      ) {
        setIsSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isRefreshingPurchasesRef = useRef(false);
  const isRefreshingReturnsRef = useRef(false);

  const loadPurchases = async () => {
    if (isRefreshingPurchasesRef.current) return;
    isRefreshingPurchasesRef.current = true;
    setIsLoading(true);
    try {
      const res = await api.purchases.list({ search: searchTerm.trim() || undefined });
      setPurchases(res.purchases || []);
    } catch (e) {
      console.error('Failed to load purchases:', e);
    } finally {
      isRefreshingPurchasesRef.current = false;
      setIsLoading(false);
      triggerStatRecount();
    }
  };

  const loadPurchaseReturns = async () => {
    if (isRefreshingReturnsRef.current) return;
    isRefreshingReturnsRef.current = true;
    setIsLoadingReturns(true);
    try {
      const res = await api.purchaseReturns.list({ search: searchTerm.trim() || undefined });
      setPurchaseReturns(res.returns || []);
    } catch (e) {
      console.error('Failed to load purchase returns:', e);
    } finally {
      isRefreshingReturnsRef.current = false;
      setIsLoadingReturns(false);
    }
  };

  const handleRefreshAll = async () => {
    await Promise.all([loadPurchases(), loadPurchaseReturns()]);
  };

  const handleViewReturnDetails = async (returnId: number) => {
    try {
      const res = await api.purchaseReturns.get(returnId);
      if (res.returnRecord) {
        setSelectedReturnRecord(res.returnRecord);
        setIsReturnDetailsModalOpen(true);
      }
    } catch (e: any) {
      console.error('Failed to load purchase return details:', e);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await api.products.list();
      setProducts(res.products || []);
    } catch (e) {
      console.error('Failed to load products:', e);
    }
  };

  const loadBrandsAndCategories = async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        api.brandCategory.getBrands().catch(() => ({ brands: [] })),
        api.brandCategory.getCategories().catch(() => ({ categories: [] })),
      ]);
      let brandList = bRes.brands || [];
      if (!brandList.some((b: any) => b.name?.trim().toLowerCase() === 'local')) {
        try {
          const createRes = await api.brandCategory.createBrand('Local');
          if (createRes?.brand) {
            brandList = [createRes.brand, ...brandList];
          }
        } catch (_) {}
      }
      setBrands(brandList);
      setCategories(cRes.categories || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await api.suppliers.list();
      const list = res.suppliers || [];
      setSuppliers(list);

      // If initialSupplierId was provided, match and set supplierName
      if (initialSupplierId) {
        const found = list.find((s: any) => s.id === initialSupplierId);
        if (found) {
          setSupplierName(found.name);
        }
      }
    } catch (e) {
      console.error('Failed to load suppliers:', e);
    }
  };

  const handleSupplierSelect = (idStr: string) => {
    if (!idStr) {
      setSelectedSupplierId('');
      setSupplierName('');
      return;
    }
    const id = parseInt(idStr, 10);
    setSelectedSupplierId(id);
    const sup = suppliers.find((s) => s.id === id);
    if (sup) {
      setSupplierName(sup.name);
    }
  };

  const handleSelectSupplierFromTable = (sup: any) => {
    setSelectedSupplierId(sup.id);
    setSupplierName(sup.name);
    setIsSupplierTableModalOpen(false);
  };

  // Filter products by Barcode, Article name, or SKU (Universal: all products available)
  const matchingProducts = products.filter((p) => {
    if (!productQuery.trim()) return false;
    const q = productQuery.trim().toLowerCase();
    const barcodeMatch = p.barcode && p.barcode.toLowerCase().includes(q);
    const articleMatch = (p.article || p.name || '').toLowerCase().includes(q);
    const skuMatch = p.sku && p.sku.toLowerCase().includes(q);
    const brandMatch = (p.brand_name || p.brandName || '').toLowerCase().includes(q);
    return barcodeMatch || articleMatch || skuMatch || brandMatch;
  });

  const handleSelectProduct = (prod: any, isBarcode = false) => {
    setSelectedProduct(prod);
    setProductQuery('');
    setIsSuggestionsOpen(false);

    // Beep sound on barcode/product accepted!
    playAudioFeedback.barcodeScan();

    // Pre-fill cost with product's registered cost price
    const rawCost =
      prod.costPrice !== undefined && prod.costPrice !== null
        ? prod.costPrice
        : prod.cost_price !== undefined && prod.cost_price !== null
        ? prod.cost_price
        : 0;
    const defaultCost = parseFloat(cleanStockPriceInput(rawCost)) || 0;
    setItemUnitCost(defaultCost);

    // Auto-focus quantity field for rapid data entry
    setTimeout(() => {
      quantityInputRef.current?.focus();
      quantityInputRef.current?.select();
    }, 60);
  };

  // Immediate 'Find Product' Event: Triggered on barcode scan or Enter
  const triggerFindProduct = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed || isFindingProductRef.current) return;

    isFindingProductRef.current = true;
    setErrorMessage(null);

    try {
      // 1. Check local loaded products for exact barcode match
      let match = products.find(
        (p) => p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()
      );

      // 2. Check exact SKU match
      if (!match) {
        match = products.find(
          (p) => p.sku && p.sku.toLowerCase() === trimmed.toLowerCase()
        );
      }

      // 3. Check exact Article name match
      if (!match) {
        match = products.find(
          (p) => (p.article || p.name || '').toLowerCase() === trimmed.toLowerCase()
        );
      }

      // 4. If not found in loaded list, perform backend lookup
      if (!match) {
        const barcodeRes = await api.products.lookupBarcode(trimmed).catch(() => null);
        if (barcodeRes?.product) {
          match = barcodeRes.product;
        } else {
          const searchRes = await api.products.list({ search: trimmed }).catch(() => ({ products: [] }));
          if (searchRes.products && searchRes.products.length > 0) {
            match =
              searchRes.products.find(
                (p: any) =>
                  (p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) ||
                  (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase())
              ) || searchRes.products[0];
          }
        }
      }

      // 5. If matching list has matches, pick top match
      if (!match && matchingProducts.length > 0) {
        match = matchingProducts[0];
      }

      if (match) {
        handleSelectProduct(match, true);
        setPurchaseScanFeedback(`✓ Barcode accepted: ${match.article || match.name}`);
        setTimeout(() => setPurchaseScanFeedback(null), 3200);
      } else {
        playAudioFeedback.warning();
        setErrorMessage(`No product found matching barcode/SKU "${trimmed}".`);
        productInputRef.current?.select();
      }
    } catch (err: any) {
      playAudioFeedback.warning();
      setErrorMessage(err.message || 'Product lookup failed.');
    } finally {
      isFindingProductRef.current = false;
    }
  };

  // Live input & hardware scanner stream detection
  const handleProductInputChange = (val: string) => {
    setProductQuery(val);
    setIsSuggestionsOpen(true);

    const now = performance.now();
    const interval = now - lastKeyTimeRef.current;
    lastKeyTimeRef.current = now;

    // Detect hardware barcode scanner (very rapid key intervals < 45ms)
    if (interval < 45) {
      scanBurstCountRef.current += 1;
    } else {
      scanBurstCountRef.current = 1;
    }

    if (autoScanTimerRef.current) {
      clearTimeout(autoScanTimerRef.current);
    }

    // If hardware scanner burst detected (4+ rapid characters, length >= 6)
    if (scanBurstCountRef.current >= 4 && val.trim().length >= 6) {
      autoScanTimerRef.current = setTimeout(() => {
        triggerFindProduct(val);
      }, 50);
      return;
    }

    // If exact barcode match is typed/scanned in memory
    const exactBarcodeMatch = products.find(
      (p) => p.barcode && p.barcode.toLowerCase() === val.trim().toLowerCase()
    );
    if (exactBarcodeMatch && val.trim().length >= 5) {
      triggerFindProduct(val);
    }
  };

  // Keyboard navigation & Barcode scanner Enter handler
  const handleProductInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (productQuery.trim()) {
        triggerFindProduct(productQuery);
      }
    }
  };

  const handleAddItem = () => {
    const costNum = typeof itemUnitCost === 'number' ? itemUnitCost : parseFloat(String(itemUnitCost));
    if (!selectedProduct || !itemQty || itemQty <= 0 || isNaN(costNum) || costNum < 0) return;

    // Beep sound: Item accepted and added to invoice/order!
    playAudioFeedback.invoiceItemAdded();

    setItems((prev) => {
      // If product already exists in current order, increment quantity
      const existingIndex = prev.findIndex((i) => i.productId === selectedProduct.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += itemQty;
        updated[existingIndex].unitCost = costNum; // update to latest cost
        return updated;
      }

      return [
        ...prev,
        {
          productId: selectedProduct.id,
          article: selectedProduct.article || selectedProduct.name,
          name: selectedProduct.article || selectedProduct.name,
          sku: selectedProduct.sku,
          barcode: selectedProduct.barcode,
          brandName: selectedProduct.brand_name || selectedProduct.brandName || 'Local',
          categoryName: selectedProduct.category_name || selectedProduct.categoryName || 'Local',
          primaryImageUrl: selectedProduct.primaryImageUrl || selectedProduct.primary_image_url,
          quantity: itemQty,
          unitCost: costNum,
        },
      ];
    });

    const addedName = selectedProduct.article || selectedProduct.name;
    setPurchaseScanFeedback(`✓ Added ${itemQty} prs of "${addedName}" to Purchase Order`);
    setTimeout(() => setPurchaseScanFeedback(null), 3200);

    // Reset picker
    setSelectedProduct(null);
    setProductQuery('');
    setItemQty(lotSize);
    setItemUnitCost('');

    // Re-focus search input immediately so user can continuously scan consecutive items
    focusProductInput();
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleUpdateItemQuantity = (idx: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((it, i) => {
          if (i === idx) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter(Boolean) as any
    );
  };

  const totalPurchaseCost = items.reduce((acc, i) => acc + i.quantity * i.unitCost, 0);
  const totalPairsCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const validateStep1 = (): boolean => {
    setErrorMessage(null);
    if (!supplierName.trim()) {
      setErrorMessage('Please select or specify a supplier to continue.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    setErrorMessage(null);
    if (items.length === 0) {
      setErrorMessage('Please add at least one footwear item to the purchase order before proceeding.');
      return false;
    }
    return true;
  };

  const goToNextStep = () => {
    setErrorMessage(null);
    if (modalStep === 1) {
      if (validateStep1()) setModalStep(2);
    } else if (modalStep === 2) {
      if (validateStep2()) {
        step3EnteredTimeRef.current = Date.now();
        setModalStep(3);
      }
    }
  };

  const goToPrevStep = () => {
    setErrorMessage(null);
    if (modalStep === 2) setModalStep(1);
    if (modalStep === 3) setModalStep(2);
  };

  const handleSubmitPurchase = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // STRICT CHECK: Never submit unless actively on Step 3 (Review & Receive)
    if (modalStep !== 3) {
      goToNextStep();
      return;
    }

    // Double-click / Click-bleed prevention: Ignore submission if Step 3 was entered less than 450ms ago
    if (Date.now() - step3EnteredTimeRef.current < 450) {
      return;
    }

    if (!validateStep1()) {
      setModalStep(1);
      return;
    }
    if (!validateStep2()) {
      setModalStep(2);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const numPaid = parseFloat(cleanStockPriceInput(initialPaidAmount));
      await api.purchases.create({
        supplierId: selectedSupplierId ? Number(selectedSupplierId) : null,
        supplierName: supplierName.trim(),
        supplierInvoice: supplierInvoice.trim(),
        notes: notes.trim(),
        paidAmount: !isNaN(numPaid) && numPaid > 0 ? numPaid : 0,
        paymentMethod: initialPaymentMethod,
        paymentReference: initialPaymentRef.trim(),
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost,
          unitPurchasePrice: i.unitCost,
        })),
      });

      setIsModalOpen(false);
      setModalStep(1);
      setSelectedSupplierId('');
      setSupplierName('');
      setSupplierInvoice('');
      setNotes('');
      setInitialPaidAmount('');
      setInitialPaymentMethod('CASH');
      setInitialPaymentRef('');
      setItems([]);
      setSelectedProduct(null);
      setProductQuery('');
      loadPurchases();
      loadProducts(); // refresh inventory stock counts
      loadSuppliers(); // refresh supplier balances
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record purchase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPurchasePayment = (p: any) => {
    const supId = p.supplier_id || p.supplierId;
    const sName = p.supplier_official_name || p.supplierName || p.supplier_name;
    const sPhone = p.supplier_phone || p.supplierPhone;
    const tAmt = parseFloat(p.totalAmount || p.total_amount || 0);
    const paidAmt = parseFloat(p.paidAmount || p.paid_amount || 0);
    const remaining = Math.max(0, tAmt - paidAmt);

    const foundSup = suppliers.find((s) => s.id === supId) || {
      id: supId,
      name: sName,
      phone: sPhone,
      net_payable_balance: remaining,
    };

    setPaymentModalSupplier(foundSup);
    setPaymentModalPurchaseId(p.id);
    setPaymentModalPurchaseNumber(p.purchaseNumber || p.purchase_number);
    setPaymentModalDefaultAmount(remaining);
    setIsPaymentModalOpen(true);
  };

  const handleQuickSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) return;

    setIsSavingSupplier(true);
    try {
      const res = await api.suppliers.create({
        name: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim(),
        email: quickSupplierEmail.trim(),
      });

      // Reload suppliers list and immediately select the new supplier
      await loadSuppliers();
      if (res?.supplier?.id) {
        setSelectedSupplierId(res.supplier.id);
        setSupplierName(res.supplier.name);
      }

      setIsQuickSupplierModalOpen(false);
      setQuickSupplierName('');
      setQuickSupplierPhone('');
      setQuickSupplierEmail('');
    } catch (err: any) {
      alert(err.message || 'Failed to add supplier');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleViewPurchaseDetails = async (id: number) => {
    setViewPurchaseModalOpen(true);
    setIsLoadingPurchaseDetails(true);
    try {
      const res = await api.purchases.get(id);
      setSelectedPurchaseDetails(res.purchase);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingPurchaseDetails(false);
    }
  };

  const selectedSupplierObj = suppliers.find((s) => s.id === selectedSupplierId);

  // Filter for Supplier Table Modal
  const modalFilteredSuppliers = suppliers.filter((s) => {
    if (!supplierSearchInModal.trim()) return true;
    const q = supplierSearchInModal.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  // Filter for Product Catalog Modal
  const modalFilteredProducts = products.filter((p) => {
    const q = catalogModalSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.article || p.name || '').toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand_name && p.brand_name.toLowerCase().includes(q));

    const matchesBrand =
      catalogModalBrand === 'ALL' ||
      String(p.brandId || p.brand_id) === String(catalogModalBrand);

    const matchesCategory =
      catalogModalCategory === 'ALL' ||
      String(p.categoryId || p.category_id) === String(catalogModalCategory);

    return matchesSearch && matchesBrand && matchesCategory;
  });

  const totalPurchasesCount = purchases.length;
  const totalInwardValue = purchases.reduce(
    (sum, p) => sum + parseFloat(p.totalAmount || p.total_amount || 0),
    0
  );
  const totalReturnsCount = purchaseReturns.length;
  const totalDebitAmount = purchaseReturns.reduce(
    (sum, pr) => sum + parseFloat(pr.total_debit_amount || pr.totalDebitAmount || 0),
    0
  );

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto text-xs">
      {/* Top Banner & Action Controls */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-purple-800/80 shadow-sm transition-colors dark:text-white"
      >
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-purple-500/20 dark:text-purple-300 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-2xs">
              <Truck className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Stock Purchases &amp; Supplier Shipments
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 border border-blue-200/80 dark:border-purple-500/30">
              {purchases.length} Recorded
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/80 font-medium mt-1">
            Receive incoming footwear shipments from suppliers, increment product inventory, and maintain purchase ledgers
          </p>
        </div>

        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          {onNavigateToSuppliers && (
            <button
              type="button"
              onClick={onNavigateToSuppliers}
              className="bg-slate-100 hover:bg-slate-200 dark:bg-purple-500/20 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-400/40 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Manage Suppliers</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isLoading || isLoadingReturns}
            title={isLoading || isLoadingReturns ? "Refreshing purchases & returns..." : "Refresh purchases, returns & recount metrics"}
            className="bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isLoadingReturns ? 'animate-spin text-blue-600 dark:text-purple-300' : 'text-blue-600 dark:text-purple-300'}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReturnModalPurchaseNumber(undefined);
              setReturnModalSupplierId(undefined);
              setIsReturnModalOpen(true);
            }}
            className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>Return Defective Cartons</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsModalOpen(true);
              setModalStep(1);
            }}
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 dark:from-purple-600 dark:to-indigo-600 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record New Purchase</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Summary Cards with Animated Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <StatCard
          id="stat-inward-purchases"
          title="Total Inward Purchases"
          value={totalPurchasesCount}
          icon={Truck}
          iconColor="blue"
          valueClassName="font-mono text-slate-900 dark:text-white"
          subtext={<span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Inward shipments recorded</span>}
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        <StatCard
          id="stat-inward-valuation"
          title="Inward Valuation"
          value={totalInwardValue}
          prefix={`${currencySymbol} `}
          icon={DollarSign}
          iconColor="purple"
          valueClassName="font-mono text-slate-900 dark:text-white"
          subtext={<span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Cumulative purchase cost</span>}
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        <StatCard
          id="stat-received-pairs"
          title="Received Footwear Pairs"
          value={purchases.reduce((sum, p) => sum + (parseInt(p.total_pairs || p.totalPairs || p.item_count || 0, 10) || 0), 0)}
          suffix=" pairs"
          icon={Package}
          iconColor="cyan"
          valueClassName="font-mono text-cyan-600 dark:text-cyan-300"
          subtext={<span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">Physical pairs added to stock</span>}
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        <StatCard
          id="stat-supplier-returns"
          title="Supplier Returns & Debits"
          value={totalReturnsCount}
          icon={AlertTriangle}
          iconColor="rose"
          valueClassName="font-mono text-slate-900 dark:text-white"
          subtext={
            <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium font-mono">
              {currencySymbol} {formatStockPrice(totalDebitAmount)} debit total
            </span>
          }
          loading={isLoading}
          delay={0}
          duration={1200}
        />
      </div>

      {/* Filter and Search Bar aligned with ProductManagement */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="app-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs transition-colors dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 dark:border-purple-800/80 dark:text-white"
      >
        {/* Left: View Tabs - Responsive Scrollable Underline Navigation */}
        <div 
          ref={purchaseTabContainerRef}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-0 no-scrollbar scrollbar-none tab-scrollbar-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-thumb]:hidden [&::-webkit-scrollbar-track]:hidden border-b border-slate-200/80 dark:border-purple-900/50"
        >
          <button
            type="button"
            id="purchases-tab-purchases"
            data-active={activeTab === 'purchases'}
            data-tab="purchases"
            onClick={() => setActiveTab('purchases')}
            className={`tab-underline-link relative px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 cursor-pointer flex items-center space-x-2 shrink-0 whitespace-nowrap ${
              activeTab === 'purchases'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <Truck className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'purchases' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Inward Stock Purchases</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors duration-200 ${
                activeTab === 'purchases'
                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {purchases.length}
            </span>
            {activeTab === 'purchases' && (
              <motion.div
                layoutId="purchasesActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>

          <button
            type="button"
            id="purchases-tab-returns"
            data-active={activeTab === 'returns'}
            data-tab="returns"
            onClick={() => setActiveTab('returns')}
            className={`tab-underline-link relative px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 cursor-pointer flex items-center space-x-2 shrink-0 whitespace-nowrap ${
              activeTab === 'returns'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'returns' ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Supplier Returns &amp; Debit Notes</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors duration-200 ${
                activeTab === 'returns'
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {purchaseReturns.length}
            </span>
            {activeTab === 'returns' && (
              <motion.div
                layoutId="purchasesActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>

          {/* Scroll End Buffer Spacer: Ensures the last tab is 100% visible and never clipped */}
          <div className="tab-end-spacer shrink-0 w-8 sm:w-10 h-1 pointer-events-none self-stretch" aria-hidden="true" role="presentation" />
        </div>

        {/* Right: Search Input & Refresh button */}
        <div className="flex items-center space-x-2.5 flex-1 sm:flex-initial justify-end">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={
                activeTab === 'purchases'
                  ? 'Search supplier name, purchase order #...'
                  : 'Search debit note #, supplier, reason...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (activeTab === 'purchases') loadPurchases();
                  else loadPurchaseReturns();
                }
              }}
              className="app-input w-full pl-[2.125rem] pr-8 py-2 text-xs font-medium dark:bg-slate-900/80 dark:border-purple-800/60 dark:text-white dark:placeholder-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  if (activeTab === 'purchases') loadPurchases();
                  else loadPurchaseReturns();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 p-1 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'purchases') loadPurchases();
              else loadPurchaseReturns();
            }}
            title={isLoading || isLoadingReturns ? "Refreshing list..." : "Refresh list"}
            disabled={isLoading || isLoadingReturns}
            className="px-3.5 py-2 bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none shrink-0 flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-purple-300 ${isLoading || isLoadingReturns ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </motion.div>

      {/* Main Table Container matching ProductManagement */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.3 }}
        className="app-card overflow-hidden transition-colors dark:border-purple-800/60"
      >

        {/* TAB 1: PURCHASES TABLE */}
        {activeTab === 'purchases' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-700 dark:text-white font-bold border-b border-slate-200 dark:border-purple-800/80 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Purchase #</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Supplier / Vendor</th>
                  <th className="py-3.5 px-3 text-center">Articles</th>
                  <th className="py-3.5 px-3 text-right">Total Bill</th>
                  <th className="py-3.5 px-3 text-right">Paid</th>
                  <th className="py-3.5 px-3 text-right">Balance Due</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-3">Created By</th>
                  <th className="py-3.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                        <p className="font-medium text-xs">Loading purchases...</p>
                      </div>
                    </td>
                  </tr>
                ) : purchases.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      No supplier purchases recorded yet. Click "Record New Purchase" to start.
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => {
                    const pNum = p.purchaseNumber || p.purchase_number;
                    const pDate = p.purchaseDate || p.purchase_date;
                    const sName = p.supplier_official_name || p.supplierName || p.supplier_name;
                    const tAmt = parseFloat(p.totalAmount || p.total_amount || 0);
                    const paidAmt = parseFloat(p.paidAmount || p.paid_amount || 0);
                    const balanceDue = Math.max(0, tAmt - paidAmt);
                    const status = p.payment_status || (paidAmt >= tAmt && tAmt > 0 ? 'PAID' : paidAmt > 0 ? 'PARTIAL' : 'UNPAID');
                    const uName = p.created_by_name || p.createdByName || 'Admin';
                    const itemCount = p.item_count || 1;

                    return (
                      <tr
                        key={p.id}
                        className="table-row-hover border-b border-slate-100 dark:border-slate-800/80 cursor-pointer"
                        onClick={() => handleViewPurchaseDetails(p.id)}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-cyan-400">
                          {pNum}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{pDate}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-cyan-400 shrink-0" />
                            <span>{sName}</span>
                          </div>
                          <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {p.supplier_phone && (
                              <span className="flex items-center">
                                <Phone className="w-2.5 h-2.5 mr-0.5 text-slate-400" />
                                {p.supplier_phone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200/80 dark:border-cyan-500/30">
                            {itemCount} articles
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {formatStockPrice(tAmt)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {formatStockPrice(paidAmt)}
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500'}`}>
                          {currencySymbol} {formatStockPrice(balanceDue)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-block ${
                              status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                : status === 'PARTIAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{uName}</td>
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-1.5">
                            {balanceDue > 0 && (
                              <button
                                onClick={() => handleOpenPurchasePayment(p)}
                                className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer font-bold text-[11px] flex items-center space-x-1 shadow-2xs"
                                title={`Record payment voucher for ${pNum}`}
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pay</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleViewPurchaseDetails(p.id)}
                              className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#0B1120] hover:bg-blue-50 dark:hover:bg-[#131D33] text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400 border border-slate-200 dark:border-[#1A263D] transition cursor-pointer"
                              title="View order details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setReturnModalPurchaseNumber(pNum);
                                setSelectedSupplierId(p.supplier_id || '');
                                setIsReturnModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-50 dark:bg-[#0B1120] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-[#1A263D] transition cursor-pointer"
                              title="Return Defective Cartons to Supplier"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* TAB 2: SUPPLIER RETURNS & DEBIT NOTES TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-700 dark:text-white font-bold border-b border-slate-200 dark:border-purple-800/80 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Debit Note #</th>
                  <th className="py-3.5 px-4">Return Date</th>
                  <th className="py-3.5 px-4">Debited Supplier</th>
                  <th className="py-3.5 px-4">Original Purchase</th>
                  <th className="py-3.5 px-4">Defect Classification</th>
                  <th className="py-3.5 px-3 text-center">Cartons / Pairs</th>
                  <th className="py-3.5 px-3 text-right">Debit Amount</th>
                  <th className="py-3.5 px-3">Issued By</th>
                  <th className="py-3.5 px-3 text-center">Voucher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {isLoadingReturns ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                        <p className="font-medium text-xs">Loading supplier returns & debit notes...</p>
                      </div>
                    </td>
                  </tr>
                ) : purchaseReturns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="max-w-md mx-auto space-y-2">
                        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                        <p className="font-bold text-slate-700 dark:text-slate-200">No Supplier Returns Issued Yet</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">
                          When defective shoe cartons arrive or develop manufacturing faults, return them to debit the supplier account and correct store stock.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setReturnModalPurchaseNumber(undefined);
                            setReturnModalSupplierId(undefined);
                            setIsReturnModalOpen(true);
                          }}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs mt-2 inline-flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Return Defective Cartons</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  purchaseReturns.map((pr) => {
                    const rNum = pr.return_number || pr.returnNumber;
                    const rDate = pr.return_date || pr.returnDate;
                    const sName = pr.supplier_name || pr.supplierName;
                    const dAmt = parseFloat(pr.total_debit_amount || pr.totalDebitAmount || 0);
                    const uName = pr.created_by_name || pr.createdByName || 'Admin';
                    const origPur = pr.original_purchase_number || pr.purchase_number || 'Direct Stock';
                    const cartons = pr.total_cartons ?? 1;
                    const pairs = pr.total_pairs ?? pr.quantity ?? '-';

                    return (
                      <tr
                        key={pr.id}
                        className="table-row-hover border-b border-slate-100 dark:border-slate-800/80 cursor-pointer"
                        onClick={() => handleViewReturnDetails(pr.id)}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-rose-700 dark:text-rose-300">
                          <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 rounded-md">
                            {rNum}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{rDate}</td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                            <span>{sName}</span>
                          </div>
                          {pr.supplier_phone && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {pr.supplier_phone}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                          {origPur}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          <span className="font-medium">{pr.reason || 'Defective Cartons'}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {cartons} ctn ({pairs} prs)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-rose-700 dark:text-rose-400">
                          - {currencySymbol} {formatStockPrice(dAmt)}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">{uName}</td>
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewReturnDetails(pr.id)}
                            className="px-2.5 py-1 bg-white dark:bg-[#0B1120] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 mx-auto cursor-pointer shadow-2xs"
                            title="View / Print Debit Note"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Debit Note</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* RECORD NEW PURCHASE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 dark:border-purple-800/80">
            {/* Modal Header & 3-Step Wizard Stepper matching ProductFormModal */}
            <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-purple-500/20 dark:text-purple-300 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-2xs">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                      Record Stock Purchase Order
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-purple-200/80">
                      Step {modalStep} of 3 • Receive inventory shipments &amp; update product stock ledgers
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 3-Step Stepper Navigation */}
              <div className="grid grid-cols-3 gap-2">
                {/* Step 1 Tab */}
                <button
                  type="button"
                  onClick={() => setModalStep(1)}
                  className={`flex items-center gap-1.5 p-2 rounded-xl text-left transition cursor-pointer border ${
                    modalStep === 1
                      ? 'btn-primary text-white shadow-xs font-semibold border-transparent'
                      : modalStep > 1
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      modalStep === 1
                        ? 'bg-white text-blue-600'
                        : modalStep > 1
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-purple-900/60 dark:text-purple-200'
                    }`}
                  >
                    {modalStep > 1 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
                  </div>
                  <div className="truncate">
                    <span className="block text-[9px] uppercase font-bold tracking-wider opacity-75">Step 1</span>
                    <span className="block text-xs font-semibold truncate">Supplier &amp; Consignment</span>
                  </div>
                </button>

                {/* Step 2 Tab */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1()) setModalStep(2);
                  }}
                  className={`flex items-center gap-1.5 p-2 rounded-xl text-left transition cursor-pointer border ${
                    modalStep === 2
                      ? 'btn-primary text-white shadow-xs font-semibold border-transparent'
                      : modalStep > 2
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      modalStep === 2
                        ? 'bg-white text-blue-600'
                        : modalStep > 2
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600 dark:bg-purple-900/60 dark:text-purple-200'
                    }`}
                  >
                    {modalStep > 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
                  </div>
                  <div className="truncate">
                    <span className="block text-[9px] uppercase font-bold tracking-wider opacity-75">Step 2</span>
                    <span className="block text-xs font-semibold truncate">Articles &amp; Quantities</span>
                  </div>
                </button>

                {/* Step 3 Tab */}
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep1() && validateStep2()) {
                      step3EnteredTimeRef.current = Date.now();
                      setModalStep(3);
                    }
                  }}
                  className={`flex items-center gap-1.5 p-2 rounded-xl text-left transition cursor-pointer border ${
                    modalStep === 3
                      ? 'btn-primary text-white shadow-xs font-semibold border-transparent'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/50'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      modalStep === 3
                        ? 'bg-white text-blue-600'
                        : 'bg-slate-200 text-slate-600 dark:bg-purple-900/60 dark:text-purple-200'
                    }`}
                  >
                    3
                  </div>
                  <div className="truncate">
                    <span className="block text-[9px] uppercase font-bold tracking-wider opacity-75">Step 3</span>
                    <span className="block text-xs font-semibold truncate">Review &amp; Receive</span>
                  </div>
                </button>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'INPUT') {
                    // Prevent accidental form submission on Enter in any input field
                    e.preventDefault();
                  }
                }
              }}
              className="flex-1 overflow-y-auto p-6 space-y-4 text-xs"
            >
              {errorMessage && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* STEP 1: SUPPLIER & ORDER INFORMATION */}
              {modalStep === 1 && (
                <div className="space-y-4">
                  {/* Supplier Selection Container (Aligned with POS Terminal CustomerPicker) */}
                  <div className="p-4 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/50 rounded-2xl space-y-3 relative z-20">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                        <span>Select Supplier / Vendor *</span>
                      </label>

                      {selectedSupplierObj ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                          SUP-{String(selectedSupplierObj.id).padStart(4, '0')}
                        </span>
                      ) : supplierName.trim() ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/60">
                          Custom Vendor
                        </span>
                      ) : null}
                    </div>

                    {/* POS-Aligned Searchable Supplier Combobox + Find Modal + Quick New Supplier */}
                    <SupplierPicker
                      suppliers={suppliers}
                      selectedSupplierId={selectedSupplierId}
                      supplierName={supplierName}
                      onSelectSupplier={(supId, supName) => {
                        setSelectedSupplierId(supId);
                        setSupplierName(supName);
                        setErrorMessage(null);
                      }}
                      onSupplierCreated={(newSupplier) => {
                        setSuppliers((prev) => [newSupplier, ...prev]);
                        setSelectedSupplierId(newSupplier.id);
                        setSupplierName(newSupplier.name);
                        setErrorMessage(null);
                      }}
                      currencySymbol={currencySymbol}
                      onModalOpenChange={setIsSupplierPickerModalOpen}
                      placeholder="Search Supplier / Vendor (Type name, phone, #ID...)"
                    />

                    {/* Selected Supplier Card Preview */}
                    {selectedSupplierObj ? (
                      <div className="p-3 bg-white dark:bg-[#0E1628] border border-blue-200 dark:border-purple-800/60 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                        <div className="flex items-start space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 font-bold flex items-center justify-center text-xs shrink-0 shadow-xs border border-blue-200/80 dark:border-purple-500/30">
                            {selectedSupplierObj.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedSupplierObj.name}</span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                                Registered Vendor #{selectedSupplierObj.id}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              {selectedSupplierObj.phone && (
                                <a href={`tel:${selectedSupplierObj.phone}`} className="flex items-center text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400">
                                  <Phone className="w-3 h-3 mr-1 text-slate-400" />
                                  <span>{selectedSupplierObj.phone}</span>
                                </a>
                              )}
                              {selectedSupplierObj.email && (
                                <a href={`mailto:${selectedSupplierObj.email}`} className="flex items-center text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-cyan-400">
                                  <Mail className="w-3 h-3 mr-1 text-slate-400" />
                                  <span>{selectedSupplierObj.email}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSupplierId('');
                              setSupplierName('');
                            }}
                            className="px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded font-medium transition cursor-pointer"
                          >
                            Change Supplier
                          </button>
                        </div>
                      </div>
                    ) : supplierName.trim() ? (
                      <div className="p-2.5 bg-white dark:bg-[#0E1628] border border-indigo-200 dark:border-purple-800/60 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-indigo-600 dark:text-purple-400 shrink-0" />
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {supplierName.trim()}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                            Direct / Custom Supplier
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupplierId('');
                            setSupplierName('');
                          }}
                          className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-semibold cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {/* Supplier Invoice & Shipment Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Supplier Invoice / Consignment #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. NW-INV-8492"
                        value={supplierInvoice}
                        onChange={(e) => setSupplierInvoice(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/60 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 font-mono text-xs placeholder-slate-400 dark:placeholder-slate-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Shipment Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Received via Cargo Freight, Lot #42"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/60 text-slate-900 dark:text-white rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-xs placeholder-slate-400 dark:placeholder-slate-500"
                      />
                    </div>
                  </div>

                  {/* Step 1 Quick Info / Guidance Card */}
                  <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-purple-950/30 border border-blue-200/80 dark:border-purple-800/50 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <Package className="w-4 h-4 text-blue-600 dark:text-purple-300 shrink-0" />
                      <span className="text-slate-700 dark:text-purple-200 text-xs">
                        {supplierName.trim()
                          ? `Selected supplier "${supplierName}". Click Next to scan or select footwear articles.`
                          : 'Please specify or select a supplier to proceed to adding shipment articles.'}
                      </span>
                    </div>
                    {supplierName.trim() && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                        Ready ✓
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: FOOTWEAR ARTICLES & SHIPMENT ITEMS */}
              {modalStep === 2 && (
                <div className="space-y-4">
                  {/* Product Input Barcode/SKU/Article */}
                  <div className="p-4 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/50 rounded-2xl space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider flex items-center space-x-1.5">
                          <Barcode className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                          <span>Product Input (Barcode, Article Name, or SKU)</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200/80 dark:border-cyan-500/30">
                          Universal Supply
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => setIsAddProductModalOpen(true)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A263D] text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ New Product</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsProductCatalogModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0E1628] hover:bg-slate-50 dark:hover:bg-[#131D33] border border-slate-200/90 dark:border-purple-800/60 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs cursor-pointer transition"
                        >
                          <Table className="w-3.5 h-3.5" />
                          <span>Browse Catalog Table</span>
                        </button>
                      </div>
                    </div>

                    {/* Input Field: Accepts Barcode, Article, or SKU */}
                    <div className="relative">
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        Scan Barcode or Search Article Name / SKU:
                      </label>

                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                          <Barcode className="w-4 h-4" />
                        </div>

                        <input
                          ref={productInputRef}
                          type="text"
                          placeholder="Scan Barcode or search Article / SKU (F2 to focus)..."
                          value={productQuery}
                          onChange={(e) => handleProductInputChange(e.target.value)}
                          onFocus={() => {
                            if (productQuery.trim()) {
                              setIsSuggestionsOpen(true);
                            }
                          }}
                          onKeyDown={handleProductInputKeyDown}
                          className="w-full pl-9 pr-28 py-2.5 bg-white dark:bg-[#0E1628] border-2 border-blue-400 dark:border-purple-500/50 focus:border-blue-600 dark:focus:border-purple-400 focus:ring-2 focus:ring-blue-500/20 rounded-xl outline-none font-medium text-xs shadow-2xs transition text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                          autoComplete="off"
                        />

                        <span className="absolute right-9 top-1/2 -translate-y-1/2 text-[10px] uppercase font-bold text-blue-700 dark:text-purple-300 bg-blue-50 dark:bg-purple-950/80 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-purple-500/30 pointer-events-none font-mono">
                          Scanner Ready
                        </span>

                        {productQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setProductQuery('');
                              setIsSuggestionsOpen(false);
                              productInputRef.current?.focus();
                            }}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                            title="Clear input"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Feedback on barcode scan acceptance or item addition */}
                      {purchaseScanFeedback && (
                        <div className="mt-2 p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span className="font-semibold text-emerald-800 dark:text-emerald-300">{purchaseScanFeedback}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                            Beep ✓
                          </span>
                        </div>
                      )}

                      {/* Live Suggestions Autocomplete Dropdown */}
                      <AnimatePresence>
                        {isSuggestionsOpen && matchingProducts.length > 0 && !selectedProduct && (
                          <motion.div
                            ref={suggestionsRef}
                            initial={{ opacity: 0, scale: 0.97, y: -6 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: -6 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            style={{ transformOrigin: 'top center' }}
                            className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-[#0E1628] border border-slate-200 dark:border-purple-800/60 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80"
                          >
                            <div className="px-3 py-1.5 bg-slate-50 dark:bg-[#0B1120] text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                              <span>Matching Articles ({matchingProducts.length})</span>
                              <span className="text-slate-400 dark:text-slate-500">Press Enter or click to select</span>
                            </div>
                            {matchingProducts.map((prod) => (
                              <div
                                key={prod.id}
                                onClick={() => handleSelectProduct(prod)}
                                className="p-2.5 hover:bg-blue-50/50 dark:hover:bg-[#131D33] cursor-pointer flex items-center justify-between text-xs transition"
                              >
                                <div className="flex items-center space-x-3">
                                  {prod.primary_image_url || prod.primaryImageUrl ? (
                                    <img
                                      src={prod.primary_image_url || prod.primaryImageUrl}
                                      alt="Shoe"
                                      className="w-9 h-9 rounded object-cover border border-slate-200 dark:border-purple-800/60 shrink-0 bg-white"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded bg-slate-100 dark:bg-[#131D33] flex items-center justify-center text-base shrink-0">
                                      👟
                                    </div>
                                  )}

                                  <div>
                                    <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                                      <span>{prod.article || prod.name}</span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 border border-blue-100 dark:border-purple-800/50">
                                        {prod.brand_name || prod.brandName || 'Local'}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-[#1A263D] text-slate-600 dark:text-slate-300">
                                        {prod.category_name || prod.categoryName || 'Local'}
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                      <span>SKU: {prod.sku}</span>
                                      {prod.barcode && (
                                        <span className="flex items-center text-blue-600 dark:text-cyan-400 font-medium">
                                          <Barcode className="w-3 h-3 mr-0.5" />
                                          {prod.barcode}
                                        </span>
                                      )}
                                      <span className="text-slate-600 dark:text-slate-400">
                                        In Stock: <strong className="text-slate-900 dark:text-white">{prod.total_stock ?? prod.totalStock ?? 0}</strong> pairs
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="font-mono font-bold text-slate-900 dark:text-white">
                                    {currencySymbol} {formatStockPrice(prod.costPrice ?? prod.cost_price ?? 0)}
                                  </div>
                                  <span className="text-[10px] text-blue-600 dark:text-purple-400 font-bold hover:underline">Select Article →</span>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Selected Product Configuration Card */}
                    {selectedProduct && (
                      <div className="p-3.5 bg-blue-50/40 dark:bg-[#0B1120] border border-blue-200 dark:border-purple-800/60 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {selectedProduct.primary_image_url || selectedProduct.primaryImageUrl ? (
                              <img
                                src={selectedProduct.primary_image_url || selectedProduct.primaryImageUrl}
                                alt="Shoe"
                                className="w-11 h-11 rounded-lg object-cover border border-blue-200 dark:border-purple-800 bg-white shadow-2xs"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-blue-600 dark:bg-purple-700 text-white flex items-center justify-center text-xl shadow-2xs">
                                👟
                              </div>
                            )}

                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {selectedProduct.article || selectedProduct.name}
                                </span>
                                {(selectedProduct.brand_name || selectedProduct.brandName) && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 dark:bg-purple-950/70 text-blue-700 dark:text-purple-300 border border-blue-200 dark:border-purple-800/60">
                                    {selectedProduct.brand_name || selectedProduct.brandName}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                                <span>SKU: {selectedProduct.sku}</span>
                                {selectedProduct.barcode && <span>Barcode: {selectedProduct.barcode}</span>}
                                <span>Current Stock: {selectedProduct.total_stock ?? selectedProduct.totalStock ?? 0} pairs</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProduct(null);
                              setProductQuery('');
                              setItemUnitCost('');
                              productInputRef.current?.focus();
                            }}
                            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-semibold underline cursor-pointer"
                          >
                            Cancel Selection
                          </button>
                        </div>

                        {/* Quantity, Cost & Add Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1 bg-white dark:bg-[#0E1628] p-3.5 rounded-xl border border-slate-200 dark:border-purple-800/50 shadow-2xs">
                          {/* Column 1: Received Quantity with Lot Size & Steppers */}
                          <div className="sm:col-span-4">
                            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-xs">
                              Received Quantity (Pairs)
                            </label>
                            <div className="flex items-center space-x-1">
                              <button
                                type="button"
                                onClick={() =>
                                  setItemQty((prev) => (prev > lotSize ? prev - lotSize : Math.max(1, prev - lotSize > 0 ? prev - lotSize : lotSize)))
                                }
                                className="w-8 h-8 rounded-lg border border-slate-300 dark:border-purple-800/60 bg-slate-50 dark:bg-[#0B1120] hover:bg-slate-100 dark:hover:bg-[#131D33] flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm transition active:scale-95 shadow-2xs cursor-pointer"
                                title={`Decrease ${lotSize} pairs (1 Lot)`}
                              >
                                -
                              </button>
                              <input
                                ref={quantityInputRef}
                                type="number"
                                min="1"
                                value={itemQty}
                                onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                                className="flex-1 py-1.5 px-2 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-purple-800/60 rounded-lg font-bold font-mono text-center outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-2xs text-slate-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => setItemQty((prev) => prev + lotSize)}
                                className="w-8 h-8 rounded-lg border border-slate-300 dark:border-purple-800/60 bg-slate-50 dark:bg-[#0B1120] hover:bg-slate-100 dark:hover:bg-[#131D33] flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-sm transition active:scale-95 shadow-2xs cursor-pointer"
                                title={`Increase ${lotSize} pairs (1 Lot)`}
                              >
                                +
                              </button>
                            </div>

                            {/* Lot Size Selector & Dynamic Quick Chips */}
                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  Lot Size
                                </span>
                                <div
                                  className="inline-flex p-0.5 bg-slate-100 dark:bg-[#0B1120] border border-slate-200/90 dark:border-purple-800/60 rounded-lg"
                                  role="radiogroup"
                                  aria-label="Lot Size Selector"
                                >
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={lotSize === 6}
                                    onClick={() => handleLotSizeChange(6)}
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      lotSize === 6
                                        ? 'bg-white dark:bg-[#0E1628] text-blue-600 dark:text-purple-300 shadow-2xs border border-slate-200 dark:border-purple-800/60 font-extrabold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                                    }`}
                                  >
                                    Lot 6
                                  </button>
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={lotSize === 8}
                                    onClick={() => handleLotSizeChange(8)}
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      lotSize === 8
                                        ? 'bg-white dark:bg-[#0E1628] text-blue-600 dark:text-purple-300 shadow-2xs border border-slate-200 dark:border-purple-800/60 font-extrabold'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                                    }`}
                                  >
                                    Lot 8
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1">
                                {(lotSize === 6
                                  ? [
                                      { value: 6, label: '6', note: '1 Lot (6 pairs / ½ Dozen)' },
                                      { value: 12, label: '12', note: '2 Lots (12 pairs / 1 Dozen)' },
                                      { value: 24, label: '24', note: '4 Lots (24 pairs / 2 Dozens)' },
                                      { value: 60, label: '60', note: '10 Lots (60 pairs / 5 Dozens)' },
                                      { value: 120, label: '120', note: '20 Lots (120 pairs / 10 Dozens)' },
                                    ]
                                  : [
                                      { value: 8, label: '8', note: '1 Lot (8 pairs)' },
                                      { value: 16, label: '16', note: '2 Lots (16 pairs)' },
                                      { value: 32, label: '32', note: '4 Lots (32 pairs)' },
                                      { value: 40, label: '40', note: '5 Lots (40 pairs)' },
                                      { value: 80, label: '80', note: '10 Lots (80 pairs)' },
                                    ]
                                ).map((chip) => (
                                  <button
                                    key={chip.value}
                                    type="button"
                                    title={chip.note}
                                    onClick={() => setItemQty(chip.value)}
                                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border transition active:scale-95 cursor-pointer ${
                                      itemQty === chip.value
                                        ? 'bg-blue-600 dark:bg-purple-600 text-white border-blue-600 dark:border-purple-600 shadow-2xs font-extrabold'
                                        : 'bg-slate-100 hover:bg-slate-200 dark:bg-[#0B1120] dark:hover:bg-[#131D33] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-purple-800/60'
                                    }`}
                                  >
                                    {chip.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Column 2: Editable Unit Purchase Price */}
                          <div className="sm:col-span-4">
                            {(() => {
                              const defaultCost = parseFloat(
                                String(selectedProduct.costPrice ?? selectedProduct.cost_price ?? 0)
                              );
                              const retail = parseFloat(
                                String(selectedProduct.minSalePrice ?? selectedProduct.min_sale_price ?? 0)
                              );
                              const currentCost =
                                typeof itemUnitCost === 'number'
                                  ? itemUnitCost
                                  : parseFloat(String(itemUnitCost)) || 0;
                              const estMargin =
                                currentCost > 0 && retail > currentCost
                                  ? Math.round(((retail - currentCost) / currentCost) * 100).toString()
                                  : null;

                              return (
                                <>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs">
                                      Unit Purchase Cost ({currencySymbol})
                                    </label>
                                    {defaultCost > 0 && currentCost !== defaultCost && (
                                      <button
                                        type="button"
                                        onClick={() => setItemUnitCost(defaultCost)}
                                        className="text-[10px] text-blue-600 dark:text-purple-400 hover:underline font-medium cursor-pointer"
                                      >
                                        Reset to {currencySymbol} {formatStockPrice(defaultCost)}
                                      </button>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-mono text-xs font-semibold">
                                      {currencySymbol}
                                    </span>
                                    <input
                                      ref={costInputRef}
                                      type="number"
                                      min="0"
                                      step="1"
                                      placeholder="0"
                                      value={itemUnitCost}
                                      onChange={(e) =>
                                        setItemUnitCost(e.target.value === '' ? '' : Math.round(parseFloat(e.target.value)))
                                      }
                                      onBlur={(e) => {
                                        const cleaned = cleanStockPriceInput(e.target.value);
                                        if (cleaned === '') {
                                          setItemUnitCost('');
                                        } else {
                                          const parsed = parseFloat(cleaned);
                                          setItemUnitCost(isNaN(parsed) ? '' : Math.round(parsed));
                                        }
                                      }}
                                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddItem())}
                                      className="w-full py-1.5 pl-8 pr-3 bg-white dark:bg-[#0B1120] border border-slate-300 dark:border-purple-800/60 rounded-lg font-bold font-mono text-right outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm shadow-2xs text-slate-900 dark:text-white"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                                    <span>Catalog: {currencySymbol} {formatStockPrice(defaultCost)}</span>
                                    {estMargin && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                                        +{estMargin}% Markup
                                      </span>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          {/* Column 3: Real-Time Subtotal Calculations & Add to Order */}
                          <div className="sm:col-span-4 flex flex-col justify-end">
                            {(() => {
                              const currentCost =
                                typeof itemUnitCost === 'number'
                                  ? itemUnitCost
                                  : parseFloat(String(itemUnitCost)) || 0;
                              const lineSubtotal = itemQty * currentCost;

                              return (
                                <>
                                  <div className="bg-slate-50 dark:bg-[#0B1120] p-2 rounded-lg border border-slate-200 dark:border-purple-800/60 mb-1.5 flex items-center justify-between">
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      <div>Calculation</div>
                                      <div className="font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                                        {itemQty} prs × {currencySymbol} {formatStockPrice(currentCost)}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold block">
                                        Subtotal
                                      </span>
                                      <span className="text-base font-extrabold font-mono text-blue-600 dark:text-purple-300">
                                        {currencySymbol} {formatStockPrice(lineSubtotal)}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleAddItem}
                                    disabled={
                                      itemUnitCost === '' ||
                                      isNaN(Number(itemUnitCost)) ||
                                      Number(itemUnitCost) < 0
                                    }
                                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-500 dark:hover:to-indigo-500 disabled:opacity-40 font-bold flex items-center justify-center space-x-1.5 cursor-pointer transition active:scale-95"
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span>Add to Order (Enter)</span>
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Shipment Articles List Table */}
                  <div className="border border-slate-200 dark:border-purple-800/60 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 px-4 py-2.5 border-b border-slate-200 dark:border-purple-800/80 flex items-center justify-between text-slate-800 dark:text-white">
                      <span className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider">
                        Shipment Articles List ({items.length} unique items)
                      </span>
                      <span className="text-slate-500 dark:text-purple-200 font-semibold text-xs">
                        Total: <strong className="text-slate-900 dark:text-white font-mono">{totalPairsCount}</strong> pairs
                      </span>
                    </div>

                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-white dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-600 dark:text-white font-semibold border-b border-slate-200 dark:border-purple-800/80">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Article & SKU</th>
                          <th className="py-2.5 px-3 text-center">Quantity (Pairs)</th>
                          <th className="py-2.5 px-3 text-right">Unit Cost</th>
                          <th className="py-2.5 px-3 text-right">Subtotal</th>
                          <th className="py-2.5 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                              No footwear items added yet. Scan barcode or search article/SKU above to add.
                            </td>
                          </tr>
                        ) : (
                          items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#131D33] transition">
                              <td className="py-2.5 px-3 text-slate-400 dark:text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900 dark:text-white">{item.article}</div>
                                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                  SKU: {item.sku} {item.barcode ? `| Barcode: ${item.barcode}` : ''}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="inline-flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(idx, -1)}
                                    className="w-5 h-5 rounded bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A263D] text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="w-10 text-center font-bold font-mono text-slate-900 dark:text-white">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateItemQuantity(idx, 1)}
                                    className="w-5 h-5 rounded bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A263D] text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                {currencySymbol} {formatStockPrice(item.unitCost)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {currencySymbol} {formatStockPrice(item.quantity * item.unitCost)}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 cursor-pointer"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {items.length > 0 && (
                        <tfoot className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 font-bold border-t border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white">
                          <tr>
                            <td colSpan={2} className="py-3 px-3">
                              Total Order Summary:
                            </td>
                            <td className="py-3 px-3 text-center text-blue-600 dark:text-purple-300 font-mono">
                              {totalPairsCount} pairs
                            </td>
                            <td></td>
                            <td className="py-3 px-3 text-right font-mono text-blue-600 dark:text-purple-300 text-sm">
                              {currencySymbol} {formatStockPrice(totalPurchaseCost)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & RECEIVE SHIPMENT */}
              {modalStep === 3 && (
                <div className="space-y-4">
                  {/* Supplier & Consignment Summary Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <Building2 className="w-4 h-4 text-blue-600 dark:text-purple-300" />
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          Target Supplier &amp; Invoice
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalStep(1)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-purple-300 hover:underline cursor-pointer"
                      >
                        Edit Supplier →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="p-3 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-purple-800/40">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Vendor Name</span>
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{supplierName || 'Not specified'}</span>
                        {selectedSupplierObj?.phone && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">{selectedSupplierObj.phone}</span>
                        )}
                      </div>

                      <div className="p-3 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-purple-800/40">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Invoice / Consignment #</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-white text-xs">{supplierInvoice || 'Direct Inward'}</span>
                      </div>

                      <div className="p-3 bg-white dark:bg-[#0E1628] rounded-xl border border-slate-200 dark:border-purple-800/40">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Shipment Notes</span>
                        <span className="text-slate-700 dark:text-slate-300 text-xs italic">{notes || 'Standard purchase shipment'}</span>
                      </div>
                    </div>
                  </div>

                  {/* High-Level Order Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/60">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Articles</span>
                      <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">{items.length}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/60">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Pairs</span>
                      <span className="text-xl font-bold font-mono text-blue-600 dark:text-purple-300">{totalPairsCount}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/60">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Avg Cost / Pair</span>
                      <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                        {currencySymbol} {totalPairsCount > 0 ? formatStockPrice(totalPurchaseCost / totalPairsCount) : '0'}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50 dark:bg-purple-950/50 border border-blue-200 dark:border-purple-800">
                      <span className="text-[10px] font-bold text-blue-700 dark:text-purple-300 uppercase tracking-wider block">Order Total</span>
                      <span className="text-xl font-black font-mono text-blue-600 dark:text-purple-300">
                        {currencySymbol} {formatStockPrice(totalPurchaseCost)}
                      </span>
                    </div>
                  </div>

                  {/* Articles Verification Table */}
                  <div className="border border-slate-200 dark:border-purple-800/60 rounded-xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 px-4 py-2 border-b border-slate-200 dark:border-purple-800/80 flex items-center justify-between text-slate-800 dark:text-white">
                      <span className="font-bold text-xs text-slate-800 dark:text-white uppercase tracking-wider">
                        Shipment Verification ({items.length} Articles)
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalStep(2)}
                        className="text-[11px] font-semibold text-blue-600 dark:text-purple-300 hover:underline cursor-pointer"
                      >
                        Edit Articles →
                      </button>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-white dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-500 dark:text-white font-semibold border-b border-slate-200 dark:border-purple-800/80 text-[11px]">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Article & SKU</th>
                          <th className="py-2 px-3 text-center">Pairs</th>
                          <th className="py-2 px-3 text-right">Unit Price</th>
                          <th className="py-2 px-3 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#131D33]">
                            <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <span className="font-bold text-slate-900 dark:text-white">{item.article}</span>
                              <span className="ml-2 font-mono text-[10px] text-slate-500 dark:text-slate-400">({item.sku})</span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-slate-900 dark:text-white">
                              {item.quantity}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                              {currencySymbol} {formatStockPrice(item.unitCost)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {currencySymbol} {formatStockPrice(item.quantity * item.unitCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Step 3 Optional Initial Supplier Payment Option */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                          <CreditCard className="w-4 h-4 stroke-[2.2]" />
                        </span>
                        <div>
                          <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 block">
                            Payment Option (Initial Upfront Payment)
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Did you pay the supplier upfront or on delivery? Record payment voucher now or pay later anytime.
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setInitialPaidAmount(String(totalPurchaseCost))}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold cursor-pointer transition"
                        >
                          Pay Full ({currencySymbol} {formatStockPrice(totalPurchaseCost)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setInitialPaidAmount('')}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold cursor-pointer transition"
                        >
                          Full Credit (Pay Later)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
                      <div className="sm:col-span-5">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Amount Paid Now ({currencySymbol})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0 (e.g. 120,000)"
                          value={initialPaidAmount}
                          onChange={(e) => setInitialPaidAmount(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#0E1628] border border-slate-200 dark:border-purple-800/60 rounded-xl font-mono font-bold text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs"
                        />
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Payment Mode
                        </label>
                        <select
                          value={initialPaymentMethod}
                          onChange={(e: any) => setInitialPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 rounded-xl font-medium text-xs text-slate-900 dark:text-purple-200 hover:bg-slate-50 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] outline-none focus:ring-2 focus:ring-purple-500/30 shadow-2xs cursor-pointer"
                        >
                          <option value="CASH">Cash in Hand</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="CHEQUE">Bank Cheque</option>
                          <option value="ONLINE">Online / Digital</option>
                        </select>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Reference / Cheque #
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Chq #0921 or Trx ID"
                          value={initialPaymentRef}
                          onChange={(e) => setInitialPaymentRef(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-[#0E1628] border border-slate-200 dark:border-purple-800/60 rounded-xl font-mono text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/30 shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Calculated Balance Preview */}
                    {(() => {
                      const numPaid = parseFloat(cleanStockPriceInput(initialPaidAmount)) || 0;
                      const remaining = Math.max(0, totalPurchaseCost - numPaid);
                      return (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-purple-800/40 text-xs">
                          <span className="text-slate-600 dark:text-slate-400">
                            Payment Status Preview:{' '}
                            <strong className={numPaid >= totalPurchaseCost && totalPurchaseCost > 0 ? 'text-emerald-600 dark:text-emerald-400' : numPaid > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}>
                              {numPaid >= totalPurchaseCost && totalPurchaseCost > 0 ? 'Fully Paid' : numPaid > 0 ? 'Partially Paid' : 'Unpaid (On Credit - Due Later)'}
                            </strong>
                          </span>
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            Payable Remaining:{' '}
                            <strong className="text-amber-600 dark:text-amber-400 font-bold">
                              {currencySymbol} {formatStockPrice(remaining)}
                            </strong>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Impact Notice */}
                  <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start space-x-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-900 dark:text-emerald-200">
                      <strong className="block">Warehouse Stock Ledger Confirmation</strong>
                      <span>
                        Confirming will increment store stock by <strong className="font-mono">{totalPairsCount} pairs</strong>, record a purchase transaction under {supplierName}, and update FIFO valuation ledgers.
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer with Stepper Controls matching ProductFormModal */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-purple-800/80 mt-4">
                <div className="flex items-center gap-2">
                  {modalStep > 1 ? (
                    <button
                      type="button"
                      onClick={goToPrevStep}
                      className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs font-bold"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="hidden sm:flex items-center space-x-3 text-right">
                  <div className="text-right">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                      Order Summary ({items.length} articles • {totalPairsCount} pairs)
                    </span>
                    <span className="text-base font-black font-mono text-slate-900 dark:text-white">
                      {currencySymbol} {formatStockPrice(totalPurchaseCost)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {modalStep < 3 ? (
                    <button
                      type="button"
                      onClick={goToNextStep}
                      className="btn-primary px-5 py-2 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm font-bold"
                    >
                      <span>
                        {modalStep === 1
                          ? 'Next: Add Footwear Articles'
                          : 'Next: Review & Confirm'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSubmitPurchase()}
                      disabled={isSubmitting || items.length === 0}
                      className="btn-primary px-6 py-2 text-xs flex items-center gap-1.5 cursor-pointer shadow-md font-bold disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isSubmitting ? 'Saving Order...' : 'Confirm & Receive Shipment'}</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPPLIER TABLE MODAL (SELECT SUPPLIER DIRECTLY FROM TABLE) */}
      {isSupplierTableModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[88vh] overflow-hidden border border-slate-200 dark:border-purple-800/80">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-purple-800/80 bg-slate-50/70 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <span className="p-2.5 bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 rounded-xl border border-blue-100 dark:border-purple-800/60 shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">Supplier Directory &amp; Selection Table</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">{suppliers.length} Registered Vendors Available</p>
                </div>
              </div>
              <button
                onClick={() => setIsSupplierTableModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-purple-900/30 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search & Filter */}
            <div className="p-4 border-b border-slate-200 dark:border-purple-800/80 bg-white dark:bg-[#0E1628] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter suppliers by name, phone, or email..."
                  value={supplierSearchInModal}
                  onChange={(e) => setSupplierSearchInModal(e.target.value)}
                  className="w-full pl-[2.125rem] pr-8 py-2 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/80 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 dark:focus:border-purple-500 font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs shadow-2xs"
                />
                {supplierSearchInModal && (
                  <button
                    type="button"
                    onClick={() => setSupplierSearchInModal('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 p-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSupplierTableModalOpen(false);
                  setIsQuickSupplierModalOpen(true);
                }}
                className="btn-primary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer shrink-0 font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>+ Register New Supplier</span>
              </button>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto p-4 text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-700 dark:text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-purple-800/80 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Supplier / Vendor</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3 text-center">Past Orders</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                  {modalFilteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                        No suppliers match your search filter.
                      </td>
                    </tr>
                  ) : (
                    modalFilteredSuppliers.map((sup) => {
                      const isSelected = selectedSupplierId === sup.id;
                      const orderCount = parseInt(sup.total_purchases || sup.totalPurchases || 0, 10);

                      return (
                        <tr
                          key={sup.id}
                          className={`table-row-hover transition ${
                            isSelected ? 'bg-blue-50/60 dark:bg-purple-950/40 font-bold' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center space-x-1.5">
                              <span>{sup.name}</span>
                              {isSelected && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 border border-blue-200 dark:border-purple-800/60">
                                  Current
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-800 dark:text-slate-200">
                            {sup.phone || <span className="text-slate-400 dark:text-slate-600">-</span>}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {sup.email || <span className="text-slate-400 dark:text-slate-600">-</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-purple-950/50 rounded text-slate-700 dark:text-purple-200 font-semibold font-mono border border-slate-200 dark:border-purple-900/50">
                              {orderCount}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleSelectSupplierFromTable(sup)}
                              className="btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer"
                            >
                              Select Supplier
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-purple-800/80 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSupplierTableModalOpen(false)}
                className="btn-secondary px-4 py-1.5 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATALOG PRODUCTS TABLE MODAL (BROWSE FULL CATALOG AND SELECT ARTICLE) */}
      {isProductCatalogModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-purple-800/80">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-purple-800/80 bg-slate-50/70 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <span className="p-2.5 bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 rounded-xl border border-blue-100 dark:border-purple-800/60 shadow-2xs">
                  <Package className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">Footwear Catalog Directory (Universal Supply)</h3>
                  <p className="text-slate-500 dark:text-purple-200 text-xs">{products.length} Articles in Database</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddProductModalOpen(true)}
                  className="btn-secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Product</span>
                </button>
                <button
                  onClick={() => setIsProductCatalogModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-purple-900/30 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-purple-800/80 bg-white dark:bg-[#0E1628] grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
              <div className="sm:col-span-6 relative">
                <Search className="w-4 h-4 text-purple-600 dark:text-purple-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search footwear by article, barcode, or SKU..."
                  value={catalogModalSearch}
                  onChange={(e) => setCatalogModalSearch(e.target.value)}
                  className="w-full pl-[2.125rem] pr-8 py-2 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/80 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 dark:focus:border-purple-500 font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-xs shadow-2xs"
                />
                {catalogModalSearch && (
                  <button
                    type="button"
                    onClick={() => setCatalogModalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200 p-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="sm:col-span-3">
                <select
                  value={catalogModalBrand}
                  onChange={(e) => setCatalogModalBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-medium text-slate-900 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-xs shadow-2xs cursor-pointer"
                >
                  <option value="ALL" className="dark:bg-[#120726] dark:text-purple-100">All Brands</option>
                  {brands.map((b) => {
                    const isLocal = b.name?.trim().toLowerCase() === 'local';
                    return (
                      <option key={b.id} value={b.id} className="dark:bg-[#120726] dark:text-purple-100">
                        {b.name} {isLocal ? '(Default)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={catalogModalCategory}
                  onChange={(e) => setCatalogModalCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 rounded-xl outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 font-medium text-slate-900 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-xs shadow-2xs cursor-pointer"
                >
                  <option value="ALL" className="dark:bg-[#120726] dark:text-purple-100">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-[#120726] dark:text-purple-100">
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto p-4 text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-700 dark:text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-purple-800/80 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Article / Shoe</th>
                    <th className="py-2.5 px-3">Brand & Category</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Barcode</th>
                    <th className="py-2.5 px-3 text-center">In Store</th>
                    <th className="py-2.5 px-3 text-right">Standard Cost</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                  {modalFilteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                        No products match your catalog filter.
                      </td>
                    </tr>
                  ) : (
                    modalFilteredProducts.map((prod) => (
                      <tr key={prod.id} className="table-row-hover transition">
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2.5">
                            {prod.primary_image_url || prod.primaryImageUrl ? (
                              <img
                                src={prod.primary_image_url || prod.primaryImageUrl}
                                alt="Shoe"
                                className="w-8 h-8 rounded object-cover border border-slate-200 dark:border-purple-800/60 shrink-0 bg-white"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-slate-100 dark:bg-purple-950/40 flex items-center justify-center text-sm shrink-0 border border-slate-200 dark:border-purple-900/50">
                                👟
                              </div>
                            )}
                            <span className="font-bold text-slate-900 dark:text-white">{prod.article || prod.name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {prod.brand_name || prod.brandName || 'Local'}
                            </span>
                            <span className="text-slate-400 dark:text-slate-600">•</span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {prod.category_name || prod.categoryName || 'Local'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">{prod.sku}</td>
                        <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-purple-300 font-semibold">{prod.barcode}</td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-800 dark:text-slate-200">
                          {prod.total_stock ?? prod.totalStock ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {formatStockPrice(prod.costPrice ?? prod.cost_price ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              handleSelectProduct(prod);
                              setIsProductCatalogModalOpen(false);
                            }}
                            className="btn-primary px-3 py-1.5 text-xs font-semibold cursor-pointer"
                          >
                            Select Article
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-purple-800/80 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 flex justify-end">
              <button
                type="button"
                onClick={() => setIsProductCatalogModalOpen(false)}
                className="btn-secondary px-4 py-1.5 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD SUPPLIER INLINE MODAL */}
      {isQuickSupplierModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-purple-800/80">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-purple-800/80 bg-slate-50/70 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white">
              <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 dark:text-white">
                <span className="p-2 bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 rounded-xl border border-blue-100 dark:border-purple-800/60 shadow-2xs">
                  <Building2 className="w-4 h-4" />
                </span>
                <span>Register New Supplier</span>
              </div>
              <button
                onClick={() => setIsQuickSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-purple-900/30 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickSaveSupplier} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metro Footwear Wholesale Co."
                  value={quickSupplierName}
                  onChange={(e) => setQuickSupplierName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-purple-500 font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="+92 300 1234567"
                    value={quickSupplierPhone}
                    onChange={(e) => setQuickSupplierPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-purple-500 font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="sales@vendor.com"
                    value={quickSupplierEmail}
                    onChange={(e) => setQuickSupplierEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/80 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 dark:focus:border-purple-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-2xs"
                  />
                </div>
              </div>

              <div className="px-5 py-3.5 -mx-5 -mb-5 mt-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierModalOpen(false)}
                  className="btn-secondary px-4 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="btn-primary px-4 py-1.5 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSavingSupplier ? 'Saving...' : 'Save & Select Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PAST PURCHASE DETAILS MODAL */}
      {viewPurchaseModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-purple-800/80">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-purple-800/80 bg-slate-50/70 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-900 dark:text-white">
              <div className="flex items-center space-x-2.5">
                <span className="p-2.5 bg-blue-50 dark:bg-purple-950/60 text-blue-600 dark:text-purple-300 rounded-xl border border-blue-100 dark:border-purple-800/60 shadow-2xs">
                  <Truck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                    Purchase Order #{selectedPurchaseDetails?.purchase_number || selectedPurchaseDetails?.purchaseNumber}
                  </h3>
                  <p className="text-slate-500 dark:text-purple-200 text-xs">Shipment Breakdown and Invoiced Articles</p>
                </div>
              </div>
              <button
                onClick={() => setViewPurchaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-purple-900/30 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {isLoadingPurchaseDetails ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                  <p className="font-medium text-xs">Loading purchase details...</p>
                </div>
              ) : selectedPurchaseDetails ? (
                <>
                  {/* Supplier Summary Card */}
                  <div className="p-4 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/80 rounded-xl">
                    <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] block mb-1">
                      Supplier / Consignment Info
                    </span>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {selectedPurchaseDetails.supplier_official_name || selectedPurchaseDetails.supplier_name || selectedPurchaseDetails.supplierName}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-slate-600 dark:text-slate-400 text-[11px]">
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300">Date:</strong> {selectedPurchaseDetails.purchase_date || selectedPurchaseDetails.purchaseDate}
                      </div>
                      <div>
                        <strong className="text-slate-700 dark:text-slate-300">Recorded By:</strong> {selectedPurchaseDetails.created_by_name || 'Admin'}
                      </div>
                      {selectedPurchaseDetails.supplier_phone && (
                        <div>
                          <strong className="text-slate-700 dark:text-slate-300">Phone:</strong> {selectedPurchaseDetails.supplier_phone}
                        </div>
                      )}
                    </div>
                    {selectedPurchaseDetails.notes && (
                      <div className="mt-2 text-slate-600 dark:text-slate-300 italic bg-white dark:bg-[#0E1628] p-2.5 rounded-lg border border-slate-200 dark:border-purple-800/80">
                        {selectedPurchaseDetails.notes}
                      </div>
                    )}
                  </div>

                  {/* Financial & Payment Status Card */}
                  {(() => {
                    const tAmt = parseFloat(selectedPurchaseDetails.total_amount || selectedPurchaseDetails.totalAmount || 0);
                    const paidAmt = parseFloat(selectedPurchaseDetails.paid_amount || selectedPurchaseDetails.paidAmount || 0);
                    const balanceDue = Math.max(0, tAmt - paidAmt);
                    const status = selectedPurchaseDetails.payment_status || (paidAmt >= tAmt && tAmt > 0 ? 'PAID' : paidAmt > 0 ? 'PARTIAL' : 'UNPAID');

                    return (
                      <div className="p-4 bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-purple-800/80 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                              <CreditCard className="w-3.5 h-3.5 stroke-[2.2]" />
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
                              Invoice Payment &amp; Ledger Status
                            </span>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                : status === 'PARTIAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900'
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2.5 bg-white dark:bg-[#0E1628] rounded-lg border border-slate-200 dark:border-purple-800/60">
                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Total Invoiced</span>
                            <span className="text-sm font-black font-mono text-slate-900 dark:text-white">
                              {currencySymbol} {formatStockPrice(tAmt)}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white dark:bg-[#0E1628] rounded-lg border border-slate-200 dark:border-purple-800/60">
                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Paid Amount</span>
                            <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                              {currencySymbol} {formatStockPrice(paidAmt)}
                            </span>
                          </div>
                          <div className="p-2.5 bg-white dark:bg-[#0E1628] rounded-lg border border-slate-200 dark:border-purple-800/60">
                            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Remaining Due</span>
                            <span className={`text-sm font-black font-mono ${balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                              {currencySymbol} {formatStockPrice(balanceDue)}
                            </span>
                          </div>
                        </div>

                        {balanceDue > 0 && (
                          <div className="flex justify-end pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                handleOpenPurchasePayment(selectedPurchaseDetails);
                              }}
                              className="btn-primary px-3 py-1.5 text-xs font-bold flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Record Payment Voucher ({currencySymbol} {formatStockPrice(balanceDue)} due)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Items List */}
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-2 uppercase tracking-wider text-xs">Received Articles</h4>
                    <div className="border border-slate-200 dark:border-purple-800/80 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-700 dark:text-white font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-purple-800/80">
                          <tr>
                            <th className="py-2 px-3">Article</th>
                            <th className="py-2 px-3">SKU / Barcode</th>
                            <th className="py-2 px-3 text-center">Pairs</th>
                            <th className="py-2 px-3 text-right">Unit Price</th>
                            <th className="py-2 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
                          {(selectedPurchaseDetails.items || []).map((it: any, i: number) => (
                            <tr key={i} className="table-row-hover">
                              <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">
                                {it.article || it.product_name}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {it.sku}
                              </td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                                {it.quantity}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                                {currencySymbol} {formatStockPrice(it.unit_purchase_price || it.unitPurchasePrice || 0)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                {currencySymbol} {formatStockPrice(it.subtotal || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 font-bold border-t border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white">
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 text-slate-800 dark:text-white">Total Amount:</td>
                            <td className="py-2.5 px-3 text-center font-mono text-blue-600 dark:text-purple-300">
                              {(selectedPurchaseDetails.items || []).reduce(
                                (acc: number, item: any) => acc + (item.quantity || 0),
                                0
                              )}{' '}
                              pairs
                            </td>
                            <td></td>
                            <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-purple-300 text-sm font-bold">
                              {currencySymbol}{' '}
                              {formatStockPrice(selectedPurchaseDetails.total_amount || selectedPurchaseDetails.totalAmount || 0)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 dark:border-purple-800/80 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setViewPurchaseModalOpen(false);
                  setReturnModalPurchaseNumber(
                    selectedPurchaseDetails?.purchase_number || selectedPurchaseDetails?.purchaseNumber
                  );
                  setReturnModalSupplierId(selectedPurchaseDetails?.supplier_id || undefined);
                  setIsReturnModalOpen(true);
                }}
                className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Return Defective Cartons</span>
              </button>

              <button
                type="button"
                onClick={() => setViewPurchaseModalOpen(false)}
                className="btn-secondary px-4 py-1.5 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD PRODUCT FORM MODAL */}
      {isAddProductModalOpen && (
        <ProductFormModal
          currentUser={currentUser}
          companySettings={companySettings}
          onClose={() => setIsAddProductModalOpen(false)}
          onSuccess={async (newProduct) => {
            setIsAddProductModalOpen(false);
            await loadProducts();
            if (newProduct) {
              handleSelectProduct(newProduct, true);
              setPurchaseScanFeedback(`✓ Product created & selected: ${newProduct.article || newProduct.name}`);
              setTimeout(() => setPurchaseScanFeedback(null), 3200);
            }
          }}
        />
      )}

      {/* SUPPLIER PURCHASE RETURN MODAL (DEFECTIVE CARTONS) */}
      {isReturnModalOpen && (
        <SupplierReturnModal
          isOpen={isReturnModalOpen}
          onClose={() => {
            setIsReturnModalOpen(false);
            setReturnModalPurchaseNumber(undefined);
            setReturnModalSupplierId(undefined);
          }}
          onSuccess={(returnResult) => {
            loadPurchases();
            loadPurchaseReturns();
            loadProducts();
            loadSuppliers();
            playAudioFeedback.saleSuccess();
            if (returnResult?.returnId) {
              handleViewReturnDetails(returnResult.returnId);
            }
          }}
          companySettings={companySettings}
          preselectedPurchaseNumber={returnModalPurchaseNumber}
          preselectedSupplierId={returnModalSupplierId}
        />
      )}

      {/* PURCHASE RETURN / DEBIT NOTE DETAILS MODAL */}
      {isReturnDetailsModalOpen && (
        <PurchaseReturnDetailsModal
          isOpen={isReturnDetailsModalOpen}
          onClose={() => {
            setIsReturnDetailsModalOpen(false);
            setSelectedReturnRecord(null);
          }}
          returnRecord={selectedReturnRecord}
          companySettings={companySettings}
        />
      )}

      {/* SUPPLIER PAYMENT MODAL */}
      {isPaymentModalOpen && paymentModalSupplier && (
        <SupplierPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPaymentModalSupplier(null);
            setPaymentModalPurchaseId(undefined);
            setPaymentModalPurchaseNumber(undefined);
            setPaymentModalDefaultAmount(undefined);
          }}
          supplier={paymentModalSupplier}
          currencySymbol={currencySymbol}
          purchaseId={paymentModalPurchaseId}
          purchaseNumber={paymentModalPurchaseNumber}
          defaultAmount={paymentModalDefaultAmount}
          onSuccess={() => {
            loadPurchases();
            loadSuppliers();
            if (selectedPurchaseDetails?.id) {
              handleViewPurchaseDetails(selectedPurchaseDetails.id);
            }
          }}
        />
      )}
    </div>
  );
};
