import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sparkles,
  Barcode,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Package,
  ArrowRight,
  ArrowLeft,
  Scan,
  Tag,
  DollarSign,
  Check,
  Info,
  ShieldCheck,
  TrendingUp,
  Building2,
  Boxes,
  RefreshCw,
  Box,
  Sliders,
  RotateCcw,
  Percent,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { playAudioFeedback } from '../../utils/audio.ts';
import { SideEndBoxLabelModal } from './SideEndBoxLabelModal.tsx';
import { BarcodeStickerModal } from './BarcodeStickerModal.tsx';
import {
  generateEan13Barcode,
  validateBarcodePrefix,
  analyzeBarcode,
} from '../../utils/barcode.ts';
import {
  parseBrandPrefix,
  parseCategoryPrefix,
  generateSuggestedArticle,
  generateSku,
} from '../../utils/sku.ts';
import { BarcodeSvg } from '../common/BarcodeSvg.tsx';
import { AiProductSuggester } from './AiProductSuggester.tsx';
import { cleanStockPriceInput, formatStockPrice, getProductRetailPrice, getProductMinFloorPrice } from '../../utils/priceFormat.ts';
import {
  calculateAutomaticPricing,
  smartRoundUp,
  PricingResult,
} from '../../utils/pricing.ts';
import { BrandLogo } from '../common/BrandLogo.tsx';

interface ProductFormModalProps {
  product?: any | null; // If null, adding new product
  currentUser?: any;
  companySettings: any;
  onClose: () => void;
  onSuccess: (savedProduct?: any) => void;
}

type WizardStep = 1 | 2 | 3;

interface BarcodeValidationState {
  status: 'idle' | 'checking' | 'valid' | 'invalid';
  standard?: string;
  standardLabel?: string;
  expectedCheckDigit?: number;
  actualCheckDigit?: number;
  suggestedFix?: string;
  isDuplicate?: boolean;
  existingProduct?: any;
  message?: string;
  error?: string;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  product,
  companySettings,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [liveSettings, setLiveSettings] = useState<any>(companySettings);

  useEffect(() => {
    if (companySettings) {
      setLiveSettings(companySettings);
    }
  }, [companySettings]);

  const effectiveSettings = liveSettings || companySettings || {};

  // 7-digit prefix directly from Settings
  const rawPrefix = effectiveSettings?.barcode_prefix || effectiveSettings?.barcodePrefix || '0108923';
  const prefixValidation = validateBarcodePrefix(rawPrefix);
  const prefix = String(rawPrefix).replace(/\D/g, '');

  // Step 1: Product Classification State
  const [brandId, setBrandId] = useState<number | ''>(product?.brandId || '');
  const [categoryId, setCategoryId] = useState<number | ''>(product?.categoryId || '');
  const [nextProductId, setNextProductId] = useState<number>(product?.id || 1);
  const effectiveProductId = product?.id || nextProductId;

  // Step 2 & 3: Article & SKU (Auto-suggested from classification, fully editable in Step 3 like Barcode)
  const [article, setArticle] = useState<string>(product?.article || '');
  const [isArticleManuallyEdited, setIsArticleManuallyEdited] = useState<boolean>(false);
  const [sku, setSku] = useState<string>(product?.sku || '');
  const [isSideEndLabelOpen, setIsSideEndLabelOpen] = useState(false);
  const [isBarcodeStickerOpen, setIsBarcodeStickerOpen] = useState(false);

  // Inventory & Product info
  const [productName, setProductName] = useState<string>(product?.name || '');
  const [lotSize, setLotSize] = useState<6 | 8>(6);
  const [totalStock, setTotalStock] = useState<number | ''>(
    product?.totalStock !== undefined ? product.totalStock : 0
  );
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string>(product?.primaryImageUrl || '');
  const description = product?.description || '';

  const handleLotSizeChange = (newSize: 6 | 8) => {
    setLotSize(newSize);
    setTotalStock(newSize);
  };

  // Step 2: Pricing Specifications State (Integer values only, no decimals)
  // Uses global pricing policy configured and saved in Settings
  const pricingPolicy: 'FIXED' | 'NEGOTIABLE' = (
    String(effectiveSettings?.pricing_mode || effectiveSettings?.pricingMode || 'NEGOTIABLE').toUpperCase() === 'FIXED'
      ? 'FIXED'
      : 'NEGOTIABLE'
  );

  // Cost Price (strictly whole integer)
  const [costPrice, setCostPrice] = useState<number | ''>(() => {
    const raw = product?.costPrice ?? product?.cost_price;
    if (raw !== undefined && raw !== null && raw !== '') {
      const num = parseInt(cleanStockPriceInput(raw), 10);
      return !isNaN(num) ? num : '';
    }
    return '';
  });

  // Configured default profit margins & amounts from company settings
  const parseSettingNum = (val: any, fallback: number): number => {
    if (typeof val === 'number' && !isNaN(val)) return Math.max(0, Math.round(val));
    if (val !== undefined && val !== null && val !== '') {
      const parsed = parseFloat(String(val));
      if (!isNaN(parsed)) return Math.max(0, Math.round(parsed));
    }
    return fallback;
  };

  const configuredFixedMargin = parseSettingNum(
    effectiveSettings?.fixed_profit_margin ?? effectiveSettings?.fixedProfitMargin,
    30
  );

  const configuredFixedAmount = parseSettingNum(
    effectiveSettings?.fixed_profit_amount ?? effectiveSettings?.fixedProfitAmount,
    0
  );

  const configuredMinMargin = parseSettingNum(
    effectiveSettings?.min_profit_margin ?? effectiveSettings?.minProfitMargin,
    15
  );

  const configuredMinAmount = parseSettingNum(
    effectiveSettings?.min_profit_amount ?? effectiveSettings?.minProfitAmount,
    0
  );

  const configuredMaxMargin = parseSettingNum(
    effectiveSettings?.max_profit_margin ?? effectiveSettings?.maxProfitMargin,
    30
  );

  const configuredMaxAmount = parseSettingNum(
    effectiveSettings?.max_profit_amount ?? effectiveSettings?.maxProfitAmount,
    0
  );

  // Saved product initial cost & sale price
  const initialCostVal = product
    ? Math.max(0, Math.round(Number(product.costPrice ?? product.cost_price ?? 0)))
    : 0;

  const initialSavedSalePrice = product && (product.salePrice !== undefined && product.salePrice !== null || product.sale_price !== undefined && product.sale_price !== null)
    ? Math.round(Number(product.salePrice ?? product.sale_price))
    : 0;

  // Profit Calculation Method Tab State:
  // Default to 'FIXED_AMOUNT' when adding a new product, or use the product's saved method when editing
  const [profitCalcMethod, setProfitCalcMethod] = useState<'FIXED_AMOUNT' | 'PROFIT_MARGIN'>(() => {
    if (product) {
      const savedMethod = String(
        product.profitCalculationMethod || product.profit_calculation_method || ''
      ).toUpperCase();
      if (savedMethod === 'PROFIT_MARGIN') {
        return 'PROFIT_MARGIN';
      }
      if (savedMethod === 'FIXED_AMOUNT') {
        return 'FIXED_AMOUNT';
      }
    }
    return 'FIXED_AMOUNT';
  });

  // Track whether the user has explicitly overridden the default Settings values in this modal
  const hasSavedProductProfitAmount = Boolean(
    product && Number(product.profitAmount ?? product.profit_amount ?? 0) > 0
  );
  const hasSavedProductProfitMargin = Boolean(
    product && Number(product.profitMargin ?? product.profit_margin ?? 0) > 0
  );

  const [isFixedAmountOverridden, setIsFixedAmountOverridden] = useState<boolean>(hasSavedProductProfitAmount);
  const [isFixedMarginOverridden, setIsFixedMarginOverridden] = useState<boolean>(hasSavedProductProfitMargin);
  const [isSalePriceOverridden, setIsSalePriceOverridden] = useState<boolean>(Boolean(product && initialSavedSalePrice > 0));

  // Fixed Pricing State (Taken from Settings unless overridden by user in modal)
  const [fixedMarginPercent, setFixedMarginPercent] = useState<number | ''>(() => {
    if (hasSavedProductProfitMargin) {
      return Math.round(Number(product.profitMargin ?? product.profit_margin));
    }
    if (product && initialSavedSalePrice > 0 && initialCostVal > 0) {
      const profit = initialSavedSalePrice - initialCostVal;
      return Math.round((profit / initialCostVal) * 100);
    }
    return configuredFixedMargin;
  });

  const [fixedProfitAmount, setFixedProfitAmount] = useState<number | ''>(() => {
    if (hasSavedProductProfitAmount) {
      return Math.max(0, Math.round(Number(product.profitAmount ?? product.profit_amount)));
    }
    if (product && initialSavedSalePrice > initialCostVal && configuredFixedAmount === 0) {
      return Math.max(0, initialSavedSalePrice - initialCostVal);
    }
    return configuredFixedAmount;
  });

  const [customFixedSalePrice, setCustomFixedSalePrice] = useState<number | ''>(() => {
    if (initialSavedSalePrice > 0) {
      return initialSavedSalePrice;
    }
    return '';
  });

  // Negotiable Pricing State
  const initialSavedMinPrice = product && (product.minSalePrice !== undefined && product.minSalePrice !== null || product.min_sale_price !== undefined && product.min_sale_price !== null)
    ? Math.round(Number(product.minSalePrice ?? product.min_sale_price))
    : 0;

  const initialSavedMaxPrice = product && (product.maxSalePrice !== undefined && product.maxSalePrice !== null || product.max_sale_price !== undefined && product.max_sale_price !== null)
    ? Math.round(Number(product.maxSalePrice ?? product.max_sale_price))
    : 0;

  const [isMinAmountOverridden, setIsMinAmountOverridden] = useState<boolean>(Boolean(product && initialSavedMinPrice > 0));
  const [isMaxAmountOverridden, setIsMaxAmountOverridden] = useState<boolean>(Boolean(product && initialSavedMaxPrice > 0));
  const [isMinMarginOverridden, setIsMinMarginOverridden] = useState<boolean>(Boolean(product && initialSavedMinPrice > 0));
  const [isMaxMarginOverridden, setIsMaxMarginOverridden] = useState<boolean>(Boolean(product && initialSavedMaxPrice > 0));
  const [isMinPriceOverridden, setIsMinPriceOverridden] = useState<boolean>(Boolean(product && initialSavedMinPrice > 0));
  const [isMaxPriceOverridden, setIsMaxPriceOverridden] = useState<boolean>(Boolean(product && initialSavedMaxPrice > 0));

  const [negotiableMinPrice, setNegotiableMinPrice] = useState<number | ''>(() => {
    return initialSavedMinPrice > 0 ? initialSavedMinPrice : '';
  });

  const [negotiableMinPercent, setNegotiableMinPercent] = useState<number | ''>(() => {
    if (initialSavedMinPrice > 0 && initialCostVal > 0) {
      return Math.round(((initialSavedMinPrice - initialCostVal) / initialCostVal) * 100);
    }
    return configuredMinMargin;
  });

  const [negotiableMinAmount, setNegotiableMinAmount] = useState<number | ''>(() => {
    if (product && initialSavedMinPrice > initialCostVal && configuredMinAmount === 0) {
      return Math.max(0, initialSavedMinPrice - initialCostVal);
    }
    return configuredMinAmount;
  });

  const [negotiableMaxPrice, setNegotiableMaxPrice] = useState<number | ''>(() => {
    return initialSavedMaxPrice > 0 ? initialSavedMaxPrice : '';
  });

  const [negotiableMaxPercent, setNegotiableMaxPercent] = useState<number | ''>(() => {
    if (initialSavedMaxPrice > 0 && initialCostVal > 0) {
      return Math.round(((initialSavedMaxPrice - initialCostVal) / initialCostVal) * 100);
    }
    return configuredMaxMargin;
  });

  const [negotiableMaxAmount, setNegotiableMaxAmount] = useState<number | ''>(() => {
    if (product && initialSavedMaxPrice > initialCostVal && configuredMaxAmount === 0) {
      return Math.max(0, initialSavedMaxPrice - initialCostVal);
    }
    return configuredMaxAmount;
  });

  // Automatically sync profit amounts & margins from Settings unless user has overridden them in this modal
  useEffect(() => {
    if (!isFixedAmountOverridden) {
      setFixedProfitAmount(configuredFixedAmount);
    }
    if (!isFixedMarginOverridden) {
      setFixedMarginPercent(configuredFixedMargin);
    }
    if (!isMinAmountOverridden) {
      setNegotiableMinAmount(configuredMinAmount);
    }
    if (!isMaxAmountOverridden) {
      setNegotiableMaxAmount(configuredMaxAmount);
    }
    if (!isMinMarginOverridden) {
      setNegotiableMinPercent(configuredMinMargin);
    }
    if (!isMaxMarginOverridden) {
      setNegotiableMaxPercent(configuredMaxMargin);
    }
  }, [
    configuredFixedAmount,
    configuredFixedMargin,
    configuredMinAmount,
    configuredMaxAmount,
    configuredMinMargin,
    configuredMaxMargin,
    isFixedAmountOverridden,
    isFixedMarginOverridden,
    isMinAmountOverridden,
    isMaxAmountOverridden,
    isMinMarginOverridden,
    isMaxMarginOverridden,
  ]);

  const [recalcNotice, setRecalcNotice] = useState<string | null>(null);

  // Step 4: Barcode (Fully editable for imported / external manufacturer box barcodes or store EAN-13)
  const [barcode, setBarcode] = useState<string>(product?.barcode || '');
  const [barcodeValidation, setBarcodeValidation] = useState<BarcodeValidationState>({ status: 'idle' });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currencySymbol = effectiveSettings?.currency_symbol || effectiveSettings?.currencySymbol || 'Rs.';
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);
  const articleInputRef = useRef<HTMLInputElement | null>(null);

  // Cost and price integer calculations
  const costVal = typeof costPrice === 'number' && !isNaN(costPrice) ? Math.max(0, Math.round(costPrice)) : 0;

  // Effective profit values: taken from Settings unless overridden by user in this modal
  const activeFixedProfitAmount = isFixedAmountOverridden
    ? (fixedProfitAmount !== '' ? Math.round(Number(fixedProfitAmount)) : 0)
    : configuredFixedAmount;

  const activeFixedMarginPercent = isFixedMarginOverridden
    ? (fixedMarginPercent !== '' ? Number(fixedMarginPercent) : 0)
    : configuredFixedMargin;

  const activeMinProfitAmount = isMinAmountOverridden
    ? (negotiableMinAmount !== '' ? Math.round(Number(negotiableMinAmount)) : 0)
    : configuredMinAmount;

  const activeMaxProfitAmount = isMaxAmountOverridden
    ? (negotiableMaxAmount !== '' ? Math.round(Number(negotiableMaxAmount)) : 0)
    : configuredMaxAmount;

  const activeMinMarginPercent = isMinMarginOverridden
    ? (negotiableMinPercent !== '' ? Number(negotiableMinPercent) : 0)
    : configuredMinMargin;

  const activeMaxMarginPercent = isMaxMarginOverridden
    ? (negotiableMaxPercent !== '' ? Number(negotiableMaxPercent) : 0)
    : configuredMaxMargin;

  // 1. Fixed Pricing: Default auto-calculation and final price based on selected tab (profitCalcMethod)
  const autoCalculatedSalePrice = costVal > 0
    ? (profitCalcMethod === 'FIXED_AMOUNT'
        ? costVal + activeFixedProfitAmount
        : Math.round(costVal * (1 + activeFixedMarginPercent / 100)))
    : 0;

  let finalFixedSalePrice = autoCalculatedSalePrice;
  if (isSalePriceOverridden && customFixedSalePrice !== '' && Number(customFixedSalePrice) > 0) {
    finalFixedSalePrice = Math.round(Number(customFixedSalePrice));
  } else if (costVal > 0) {
    finalFixedSalePrice = autoCalculatedSalePrice;
  } else if (customFixedSalePrice !== '' && Number(customFixedSalePrice) > 0) {
    finalFixedSalePrice = Math.round(Number(customFixedSalePrice));
  }

  // 2. Negotiable Pricing: Default auto-calculations based on selected tab (profitCalcMethod)
  const autoCalculatedMinPrice = costVal > 0
    ? (profitCalcMethod === 'FIXED_AMOUNT'
        ? costVal + activeMinProfitAmount
        : Math.round(costVal * (1 + activeMinMarginPercent / 100)))
    : 0;

  const autoCalculatedMaxPrice = costVal > 0
    ? (profitCalcMethod === 'FIXED_AMOUNT'
        ? costVal + activeMaxProfitAmount
        : Math.round(costVal * (1 + activeMaxMarginPercent / 100)))
    : 0;

  let finalNegotiableMinPrice = autoCalculatedMinPrice;
  if (isMinPriceOverridden && negotiableMinPrice !== '' && Number(negotiableMinPrice) > 0) {
    finalNegotiableMinPrice = Math.round(Number(negotiableMinPrice));
  } else if (costVal > 0) {
    finalNegotiableMinPrice = autoCalculatedMinPrice;
  } else if (negotiableMinPrice !== '' && Number(negotiableMinPrice) > 0) {
    finalNegotiableMinPrice = Math.round(Number(negotiableMinPrice));
  }

  let finalNegotiableMaxPrice = autoCalculatedMaxPrice;
  if (isMaxPriceOverridden && negotiableMaxPrice !== '' && Number(negotiableMaxPrice) > 0) {
    finalNegotiableMaxPrice = Math.round(Number(negotiableMaxPrice));
  } else if (costVal > 0) {
    finalNegotiableMaxPrice = autoCalculatedMaxPrice;
  } else if (negotiableMaxPrice !== '' && Number(negotiableMaxPrice) > 0) {
    finalNegotiableMaxPrice = Math.round(Number(negotiableMaxPrice));
  }

  // Switch between Fixed Amount and Profit Margin % calculation tabs
  const handleProfitCalcMethodChange = (method: 'FIXED_AMOUNT' | 'PROFIT_MARGIN') => {
    setProfitCalcMethod(method);
    setIsSalePriceOverridden(false);
    setIsMinPriceOverridden(false);
    setIsMaxPriceOverridden(false);
    if (costVal > 0) {
      if (pricingPolicy === 'FIXED') {
        if (method === 'FIXED_AMOUNT') {
          setCustomFixedSalePrice(costVal + activeFixedProfitAmount);
        } else {
          const profit = Math.round(costVal * (activeFixedMarginPercent / 100));
          setCustomFixedSalePrice(costVal + profit);
        }
      } else {
        if (method === 'FIXED_AMOUNT') {
          setNegotiableMinPrice(costVal + activeMinProfitAmount);
          setNegotiableMaxPrice(costVal + activeMaxProfitAmount);
        } else {
          const minProfit = Math.round(costVal * (activeMinMarginPercent / 100));
          const maxProfit = Math.round(costVal * (activeMaxMarginPercent / 100));
          setNegotiableMinPrice(costVal + minProfit);
          setNegotiableMaxPrice(costVal + maxProfit);
        }
      }
    }
  };

  // Margin % input handler (user override in Profit Margin % tab)
  const handleMarginPercentChange = (val: string) => {
    setIsFixedMarginOverridden(true);
    setIsSalePriceOverridden(false);
    if (val === '') {
      setFixedMarginPercent('');
      return;
    }
    const pct = Math.max(0, Math.round(parseFloat(val) || 0));
    setFixedMarginPercent(pct);
    if (costVal > 0) {
      const profit = Math.round(costVal * (pct / 100));
      setCustomFixedSalePrice(costVal + profit);
    }
  };

  // Fixed profit amount input handler (user override in Fixed Amount tab)
  const handleProfitAmountChange = (val: string) => {
    setIsFixedAmountOverridden(true);
    setIsSalePriceOverridden(false);
    if (val === '') {
      setFixedProfitAmount('');
      return;
    }
    const cleaned = val.replace(/[^0-9]/g, '');
    const amt = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setFixedProfitAmount(amt);
    if (costVal > 0) {
      setCustomFixedSalePrice(costVal + amt);
    }
  };

  // Final sale price direct override handler
  const handleSalePriceChange = (val: string) => {
    if (val === '') {
      setIsSalePriceOverridden(false);
      setCustomFixedSalePrice('');
      return;
    }
    setIsSalePriceOverridden(true);
    const cleaned = val.replace(/[^0-9]/g, '');
    const sp = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setCustomFixedSalePrice(sp);
    if (costVal > 0) {
      const profit = Math.max(0, sp - costVal);
      if (profitCalcMethod === 'FIXED_AMOUNT') {
        setIsFixedAmountOverridden(true);
        setFixedProfitAmount(profit);
      } else {
        setIsFixedMarginOverridden(true);
        setFixedMarginPercent(Math.round((profit / costVal) * 100));
      }
    }
  };

  // Negotiable Floor Margin % handler
  const handleNegotiableMinPercentChange = (val: string) => {
    setIsMinMarginOverridden(true);
    setIsMinPriceOverridden(false);
    if (val === '') {
      setNegotiableMinPercent('');
      return;
    }
    const pct = Math.max(0, Math.round(parseFloat(val) || 0));
    setNegotiableMinPercent(pct);
    if (costVal > 0) {
      const profit = Math.round(costVal * (pct / 100));
      setNegotiableMinPrice(costVal + profit);
    }
  };

  // Negotiable Floor Fixed Profit Amount handler
  const handleNegotiableMinAmountChange = (val: string) => {
    setIsMinAmountOverridden(true);
    setIsMinPriceOverridden(false);
    if (val === '') {
      setNegotiableMinAmount('');
      return;
    }
    const cleaned = val.replace(/[^0-9]/g, '');
    const amt = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setNegotiableMinAmount(amt);
    if (costVal > 0) {
      setNegotiableMinPrice(costVal + amt);
    }
  };

  // Negotiable Floor Price direct override handler
  const handleNegotiableMinPriceChange = (val: string) => {
    if (val === '') {
      setIsMinPriceOverridden(false);
      setNegotiableMinPrice('');
      return;
    }
    setIsMinPriceOverridden(true);
    const cleaned = val.replace(/[^0-9]/g, '');
    const sp = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setNegotiableMinPrice(sp);
    if (costVal > 0) {
      const profit = Math.max(0, sp - costVal);
      if (profitCalcMethod === 'FIXED_AMOUNT') {
        setIsMinAmountOverridden(true);
        setNegotiableMinAmount(profit);
      } else {
        setIsMinMarginOverridden(true);
        setNegotiableMinPercent(Math.round((profit / costVal) * 100));
      }
    }
  };

  // Negotiable Tag Max Margin % handler
  const handleNegotiableMaxPercentChange = (val: string) => {
    setIsMaxMarginOverridden(true);
    setIsMaxPriceOverridden(false);
    if (val === '') {
      setNegotiableMaxPercent('');
      return;
    }
    const pct = Math.max(0, Math.round(parseFloat(val) || 0));
    setNegotiableMaxPercent(pct);
    if (costVal > 0) {
      const profit = Math.round(costVal * (pct / 100));
      setNegotiableMaxPrice(costVal + profit);
    }
  };

  // Negotiable Tag Max Fixed Profit Amount handler
  const handleNegotiableMaxAmountChange = (val: string) => {
    setIsMaxAmountOverridden(true);
    setIsMaxPriceOverridden(false);
    if (val === '') {
      setNegotiableMaxAmount('');
      return;
    }
    const cleaned = val.replace(/[^0-9]/g, '');
    const amt = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setNegotiableMaxAmount(amt);
    if (costVal > 0) {
      setNegotiableMaxPrice(costVal + amt);
    }
  };

  // Negotiable Tag Max Price direct override handler
  const handleNegotiableMaxPriceChange = (val: string) => {
    if (val === '') {
      setIsMaxPriceOverridden(false);
      setNegotiableMaxPrice('');
      return;
    }
    setIsMaxPriceOverridden(true);
    const cleaned = val.replace(/[^0-9]/g, '');
    const sp = cleaned === '' ? 0 : parseInt(cleaned, 10);
    setNegotiableMaxPrice(sp);
    if (costVal > 0) {
      const profit = Math.max(0, sp - costVal);
      if (profitCalcMethod === 'FIXED_AMOUNT') {
        setIsMaxAmountOverridden(true);
        setNegotiableMaxAmount(profit);
      } else {
        setIsMaxMarginOverridden(true);
        setNegotiableMaxPercent(Math.round((profit / costVal) * 100));
      }
    }
  };

  // Cost price change handlers: uses Settings default unless user overridden in this modal
  const handleCostPriceChange = (val: string) => {
    const cleaned = cleanStockPriceInput(val);
    if (cleaned === '') {
      setCostPrice('');
      if (!product) {
        setCustomFixedSalePrice('');
        setNegotiableMinPrice('');
        setNegotiableMaxPrice('');
      }
      return;
    }
    const num = parseInt(cleaned, 10);
    if (!isNaN(num)) {
      setCostPrice(num);
      setIsSalePriceOverridden(false);
      setIsMinPriceOverridden(false);
      setIsMaxPriceOverridden(false);
      if (pricingPolicy === 'FIXED') {
        if (profitCalcMethod === 'FIXED_AMOUNT') {
          setCustomFixedSalePrice(num + activeFixedProfitAmount);
        } else {
          const profit = Math.round(num * (activeFixedMarginPercent / 100));
          setCustomFixedSalePrice(num + profit);
        }
      } else {
        // For a product in Negotiable mode
        if (profitCalcMethod === 'FIXED_AMOUNT') {
          setNegotiableMinPrice(num + activeMinProfitAmount);
          setNegotiableMaxPrice(num + activeMaxProfitAmount);
        } else {
          const minProfit = Math.round(num * (activeMinMarginPercent / 100));
          const maxProfit = Math.round(num * (activeMaxMarginPercent / 100));
          setNegotiableMinPrice(num + minProfit);
          setNegotiableMaxPrice(num + maxProfit);
        }
      }
    }
  };

  const handleCostPriceBlur = (val: string) => {
    const cleaned = cleanStockPriceInput(val);
    if (cleaned === '') {
      setCostPrice('');
    } else {
      const num = parseInt(cleaned, 10);
      setCostPrice(!isNaN(num) ? num : '');
    }
  };

  // Recalculate Default Prices explicitly from company margin settings using active tab method
  const handleRecalculateDefaults = () => {
    setIsFixedAmountOverridden(false);
    setIsFixedMarginOverridden(false);
    setIsMinAmountOverridden(false);
    setIsMaxAmountOverridden(false);
    setIsMinMarginOverridden(false);
    setIsMaxMarginOverridden(false);
    setIsSalePriceOverridden(false);
    setIsMinPriceOverridden(false);
    setIsMaxPriceOverridden(false);

    setFixedProfitAmount(configuredFixedAmount);
    setFixedMarginPercent(configuredFixedMargin);
    setNegotiableMinAmount(configuredMinAmount);
    setNegotiableMaxAmount(configuredMaxAmount);
    setNegotiableMinPercent(configuredMinMargin);
    setNegotiableMaxPercent(configuredMaxMargin);

    if (costVal <= 0) {
      setRecalcNotice(`Reset to Settings defaults (${profitCalcMethod === 'FIXED_AMOUNT' ? `+${currencySymbol} ${configuredFixedAmount}` : `+${configuredFixedMargin}%`}). Enter a Cost Price to calculate Final Sale Price.`);
      setTimeout(() => setRecalcNotice(null), 3500);
      return;
    }
    if (pricingPolicy === 'FIXED') {
      if (profitCalcMethod === 'FIXED_AMOUNT') {
        setCustomFixedSalePrice(costVal + configuredFixedAmount);
        setRecalcNotice(`Recalculated from Settings (Fixed Amount): Cost ${currencySymbol} ${costVal} + ${currencySymbol} ${configuredFixedAmount} -> Sale Price ${currencySymbol} ${costVal + configuredFixedAmount}.`);
      } else {
        const profit = Math.round(costVal * (configuredFixedMargin / 100));
        setCustomFixedSalePrice(costVal + profit);
        setRecalcNotice(`Recalculated from Settings (Profit Margin %): Cost ${currencySymbol} ${costVal} + ${configuredFixedMargin}% (+${currencySymbol} ${profit}) -> Sale Price ${currencySymbol} ${costVal + profit}.`);
      }
    } else {
      if (profitCalcMethod === 'FIXED_AMOUNT') {
        setNegotiableMinPrice(costVal + configuredMinAmount);
        setNegotiableMaxPrice(costVal + configuredMaxAmount);
        setRecalcNotice(`Recalculated from Settings (Fixed Amount): Floor ${currencySymbol} ${costVal + configuredMinAmount} - Tag MRP ${currencySymbol} ${costVal + configuredMaxAmount}.`);
      } else {
        const minProfit = Math.round(costVal * (configuredMinMargin / 100));
        const maxProfit = Math.round(costVal * (configuredMaxMargin / 100));
        setNegotiableMinPrice(costVal + minProfit);
        setNegotiableMaxPrice(costVal + maxProfit);
        setRecalcNotice(`Recalculated from Settings (Profit Margin %): Floor ${currencySymbol} ${costVal + minProfit} - Tag MRP ${currencySymbol} ${costVal + maxProfit}.`);
      }
    }
    playAudioFeedback.saleSuccess();
    setTimeout(() => setRecalcNotice(null), 4000);
  };

  // Derived current brand and category details
  const localBrand = brands.find((b) => b.name?.trim().toLowerCase() === 'local');
  const selectedBrand = brands.find((b) => b.id === brandId) || localBrand;
  const currentBrandName = selectedBrand?.name || product?.brandName || 'Local';
  const currentBrandPrefix = parseBrandPrefix(currentBrandName);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const currentCategoryName = selectedCategory?.name || product?.categoryName || '';
  const currentCategoryPrefix = currentCategoryName ? parseCategoryPrefix(currentCategoryName) : '';

  // Helper to recompute article and SKU based on classification (respects manual article edit if set)
  const updateClassificationCodes = (
    bId: number | '',
    cId: number | '',
    pId: number,
    bList = brands,
    cList = categories,
    forceResetArticle = false
  ) => {
    const chosenBrand = bList.find((b) => b.id === bId) || bList.find((b) => b.name?.trim().toLowerCase() === 'local');
    const chosenCat = cList.find((c: any) => c.id === cId);
    const brandPfx = parseBrandPrefix(chosenBrand?.name || 'Local');

    if (chosenCat) {
      const catPfx = parseCategoryPrefix(chosenCat.name);
      const designedArticle =
        !forceResetArticle && isArticleManuallyEdited && article.trim()
          ? article.trim().toUpperCase()
          : generateSuggestedArticle(catPfx, pId);
      const designedSku = generateSku(brandPfx, designedArticle, pId);

      setArticle(designedArticle);
      setSku(designedSku);
      if (!productName || productName.toUpperCase() === article.toUpperCase()) {
        setProductName(designedArticle);
      }
    } else if (!isArticleManuallyEdited || forceResetArticle) {
      setArticle('');
      setSku('');
    }
  };

  const handleArticleChange = (rawVal: string) => {
    const nextArticle = rawVal.toUpperCase();
    const prevArticle = article;
    setIsArticleManuallyEdited(true);
    setArticle(nextArticle);
    const cleanNext = nextArticle.trim();
    const nextSku = cleanNext
      ? generateSku(currentBrandPrefix || 'LOC', cleanNext, effectiveProductId)
      : '';
    setSku(nextSku);
    if (!productName || productName.trim().toUpperCase() === prevArticle.trim().toUpperCase()) {
      setProductName(cleanNext);
    }
  };

  const handleResetStoreArticle = () => {
    setErrorMessage(null);
    setIsArticleManuallyEdited(false);
    const catPfx = currentCategoryPrefix || 'CA';
    const designedArticle = generateSuggestedArticle(catPfx, effectiveProductId);
    const designedSku = generateSku(currentBrandPrefix || 'LOC', designedArticle, effectiveProductId);
    const prevArticle = article;
    setArticle(designedArticle);
    setSku(designedSku);
    if (!productName || productName.trim().toUpperCase() === prevArticle.trim().toUpperCase()) {
      setProductName(designedArticle);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function initializeModal() {
      try {
        // Fetch latest company settings from server so Default Fixed Profit Amount & Margins are always up-to-date
        try {
          const freshSettingsRes = await api.settings.get();
          if (freshSettingsRes?.settings && isMounted) {
            setLiveSettings(freshSettingsRes.settings);
            try {
              localStorage.setItem('cached_company_settings', JSON.stringify(freshSettingsRes.settings));
            } catch {}
          }
        } catch (_) {}

        let currentId = product?.id || 1;

        // Fetch next product sequence ID if adding new product
        if (!product) {
          try {
            const nextIdRes = await api.products.getNextId();
            if (nextIdRes?.nextProductId) {
              currentId = nextIdRes.nextProductId;
              if (isMounted) setNextProductId(currentId);
            }
          } catch (e) {
            console.error('Failed to fetch next product ID:', e);
          }
        }

        // Fetch brands and categories
        const [bRes, cRes] = await Promise.all([
          api.brandCategory.getBrands(),
          api.brandCategory.getCategories(),
        ]);
        let brandList = bRes.brands || [];
        const catList = cRes.categories || [];

        // Ensure 'Local' brand exists in the list
        let foundLocalBrand = brandList.find((b: any) => b.name?.trim().toLowerCase() === 'local');
        if (!foundLocalBrand) {
          try {
            const createRes = await api.brandCategory.createBrand('Local');
            if (createRes?.brand) {
              brandList = [createRes.brand, ...brandList];
              foundLocalBrand = createRes.brand;
            }
          } catch (e) {
            console.warn('Could not auto-create Local brand:', e);
          }
        }

        if (isMounted) {
          setBrands(brandList);
          setCategories(catList);
        }

        let activeBrandId = brandId;
        if (!activeBrandId && brandList.length > 0) {
          // Default to 'Local' brand per requirement
          const localBrand = foundLocalBrand || brandList.find((b: any) => b.name?.trim().toLowerCase() === 'local');
          activeBrandId = localBrand ? localBrand.id : brandList[0].id;
          if (isMounted) setBrandId(activeBrandId);
        }

        // Category is required and should NOT default to 'Local'!
        // Keep categoryId as set by product or empty if creating new product
        let activeCategoryId = categoryId;
        if (product?.categoryId) {
          activeCategoryId = product.categoryId;
          if (isMounted) setCategoryId(activeCategoryId);
        }

        if (!product && isMounted) {
          updateClassificationCodes(activeBrandId, activeCategoryId, currentId, brandList, catList);

          // Pre-fill the barcode input with the designed store standard EAN-13 barcode
          try {
            const barcodeRes = await api.products.generateBarcode(currentId);
            if (barcodeRes?.barcode && isMounted) {
              setBarcode(barcodeRes.barcode);
            }
          } catch (err) {
            if (prefixValidation.isValid && currentId <= 99999 && isMounted) {
              try {
                const gen = generateEan13Barcode(prefix, currentId);
                setBarcode(gen.barcode);
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.error('Failed to initialize product modal:', err);
      }
    }

    initializeModal();

    return () => {
      isMounted = false;
    };
  }, []);

  // Autofocus barcode input when navigating to step 3
  useEffect(() => {
    if (currentStep === 3) {
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 120);
    }
  }, [currentStep]);

  // Real-time Barcode Validation effect (Format, Checksum, and DB Duplicate Check)
  useEffect(() => {
    const clean = barcode.trim();
    if (!clean) {
      setBarcodeValidation({ status: 'idle' });
      return;
    }

    // Step 1: Instant local format & checksum validation
    const local = analyzeBarcode(clean, prefix);
    if (!local.isValid) {
      setBarcodeValidation({
        status: 'invalid',
        standard: local.standard,
        standardLabel: local.standardLabel,
        expectedCheckDigit: local.expectedCheckDigit,
        actualCheckDigit: local.actualCheckDigit,
        suggestedFix: local.suggestedFix,
        error: local.error,
      });
      return;
    }

    // Step 2: Debounced server verification (checks duplicate in catalog)
    setBarcodeValidation({
      status: 'checking',
      standard: local.standard,
      standardLabel: local.standardLabel,
      suggestedFix: local.suggestedFix,
      message: 'Validating format & checking catalog uniqueness...',
    });

    const timer = setTimeout(async () => {
      try {
        const res = await api.products.validateBarcode(clean, product?.id);
        if (!res.valid) {
          setBarcodeValidation({
            status: 'invalid',
            isDuplicate: res.isDuplicate,
            standard: res.standard,
            standardLabel: res.standardLabel,
            expectedCheckDigit: res.expectedCheckDigit,
            actualCheckDigit: res.actualCheckDigit,
            existingProduct: res.existingProduct,
            suggestedFix: res.suggestedFix,
            error: res.error || 'Barcode validation failed.',
          });
        } else {
          setBarcodeValidation({
            status: 'valid',
            standard: res.standard,
            standardLabel: res.standardLabel,
            suggestedFix: res.suggestedFix,
            message: res.message || `${res.standardLabel || 'Barcode'} is valid and ready.`,
          });
        }
      } catch (err: any) {
        // If network issue, accept local validation if format is valid
        setBarcodeValidation({
          status: 'valid',
          standard: local.standard,
          standardLabel: local.standardLabel,
          message: `${local.standardLabel} format verified.`,
        });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [barcode, prefix, product?.id]);

  const handleBrandSelect = (newBrandId: number | '') => {
    setBrandId(newBrandId);
    if (!product) {
      updateClassificationCodes(newBrandId, categoryId, effectiveProductId);
    } else {
      const chosenBrand = brands.find((b) => b.id === newBrandId);
      const brandPfx = parseBrandPrefix(chosenBrand?.name || '');
      setSku(generateSku(brandPfx, article, effectiveProductId));
    }
  };

  const handleCategorySelect = (newCategoryId: number | '') => {
    setCategoryId(newCategoryId);
    if (!product) {
      updateClassificationCodes(brandId, newCategoryId, effectiveProductId);
    } else {
      const chosenCat = categories.find((c) => c.id === newCategoryId);
      const catPfx = parseCategoryPrefix(chosenCat?.name || '');
      const designedArticle =
        isArticleManuallyEdited && article.trim()
          ? article.trim().toUpperCase()
          : generateSuggestedArticle(catPfx, effectiveProductId);
      setArticle(designedArticle);
      setSku(generateSku(currentBrandPrefix, designedArticle, effectiveProductId));
    }
  };

  const handleGenerateStoreBarcode = async () => {
    try {
      setErrorMessage(null);
      const res = await api.products.generateBarcode(effectiveProductId);
      if (res?.barcode) {
        setBarcode(res.barcode);
      } else {
        const gen = generateEan13Barcode(prefix, effectiveProductId);
        setBarcode(gen.barcode);
      }
    } catch (err: any) {
      try {
        const fallback = await api.products.generateBarcode();
        if (fallback?.barcode) {
          setBarcode(fallback.barcode);
          return;
        }
      } catch (_) {}
      try {
        const gen = generateEan13Barcode(prefix, effectiveProductId);
        setBarcode(gen.barcode);
      } catch (e: any) {
        setErrorMessage('Could not generate store EAN-13 barcode: ' + (err.message || 'Please check barcode settings.'));
      }
    }
  };

  // STEP VALIDATION
  const validateStep1 = (): boolean => {
    setErrorMessage(null);
    let effectiveBrandId = brandId;
    if (!effectiveBrandId) {
      const localBrand = brands.find((b) => b.name?.trim().toLowerCase() === 'local');
      effectiveBrandId = localBrand ? localBrand.id : (brands[0]?.id || '');
      if (effectiveBrandId) {
        setBrandId(effectiveBrandId);
      }
    }
    if (!effectiveBrandId) {
      setErrorMessage('Please select a Brand / Manufacturer to classify the product.');
      return false;
    }

    if (!categoryId) {
      setErrorMessage('Please select a Shoe Category to classify the product.');
      return false;
    }
    if (totalStock === '' || Number(totalStock) < 0) {
      setErrorMessage('Total initial stock quantity must be 0 or greater.');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    setErrorMessage(null);
    if (costPrice === '' || Number(costPrice) < 0) {
      setErrorMessage('Please enter a valid Cost Price (0 or greater).');
      return false;
    }
    if (pricingPolicy === 'FIXED') {
      if (finalFixedSalePrice <= 0) {
        setErrorMessage('Final Sale Price must be greater than 0.');
        return false;
      }
    } else {
      if (finalNegotiableMinPrice <= 0) {
        setErrorMessage('Minimum Sale Price must be greater than 0.');
        return false;
      }
      if (finalNegotiableMaxPrice < finalNegotiableMinPrice) {
        setErrorMessage('Maximum Sale Price cannot be less than Minimum Sale Price.');
        return false;
      }
    }
    return true;
  };

  const validateStep3 = (): boolean => {
    setErrorMessage(null);
    if (!article.trim()) {
      setErrorMessage('Please enter an Article code/name, or click "Reset to Store Article".');
      articleInputRef.current?.focus();
      return false;
    }
    const clean = barcode.trim();
    if (!clean) {
      setErrorMessage('Please enter or scan a barcode, or click "Reset to Store EAN-13".');
      return false;
    }
    const local = analyzeBarcode(clean, prefix);
    if (!local.isValid) {
      setErrorMessage(local.error || 'Barcode validation failed.');
      return false;
    }
    if (barcodeValidation.status === 'invalid') {
      setErrorMessage(barcodeValidation.error || 'Barcode is invalid or already in use.');
      return false;
    }
    return true;
  };

  const goToNextStep = () => {
    setErrorMessage(null);
    if (currentStep === 1) {
      if (validateStep1()) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (validateStep2()) setCurrentStep(3);
    }
  };

  const goToPrevStep = () => {
    setErrorMessage(null);
    if (currentStep === 2) setCurrentStep(1);
    if (currentStep === 3) setCurrentStep(2);
  };

  // Explicit confirmation submit handler — forced stop, no auto-submission!
  const handleConfirmAndSave = async () => {
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }
    if (!validateStep3()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let cleanArticle = article.trim().toUpperCase();
      let cleanSku = sku.trim().toUpperCase();

      // Ensure category is resolved (defaults to Local)
      let finalCategoryId = categoryId;
      if (!finalCategoryId) {
        const localCat = categories.find((c) => c.name?.trim().toLowerCase() === 'local');
        finalCategoryId = localCat ? localCat.id : (categories[0]?.id || null);
      }

      // Ensure brand is resolved (defaults to Local)
      let finalBrandId = brandId;
      if (!finalBrandId) {
        const localBrand = brands.find((b) => b.name?.trim().toLowerCase() === 'local');
        finalBrandId = localBrand ? localBrand.id : (brands[0]?.id || null);
      }

      // Ensure article is generated if not yet set
      if (!cleanArticle) {
        const chosenCat = categories.find((c) => c.id === finalCategoryId);
        const catPfx = parseCategoryPrefix(chosenCat?.name || '');
        cleanArticle = generateSuggestedArticle(catPfx, effectiveProductId).toUpperCase();
      }

      // Ensure SKU is generated if not yet set
      if (!cleanSku) {
        const chosenBrand = brands.find((b) => b.id === finalBrandId);
        const brandPfx = parseBrandPrefix(chosenBrand?.name || '');
        cleanSku = generateSku(brandPfx, cleanArticle, effectiveProductId).toUpperCase();
      }

      const finalBarcodeToSave = barcode.trim();
      const costNum = Math.max(0, Math.round(Number(costPrice)));

      const finalSavedSalePrice = pricingPolicy === 'FIXED'
        ? finalFixedSalePrice
        : finalNegotiableMaxPrice;
      const finalSavedMinPrice = pricingPolicy === 'NEGOTIABLE'
        ? finalNegotiableMinPrice
        : finalFixedSalePrice;
      const finalSavedMaxPrice = pricingPolicy === 'NEGOTIABLE'
        ? finalNegotiableMaxPrice
        : finalFixedSalePrice;

      const payload = {
        name: productName.trim() || cleanArticle,
        brandId: finalBrandId || null,
        categoryId: finalCategoryId || null,
        article: cleanArticle,
        sku: cleanSku,
        barcode: finalBarcodeToSave,
        primaryImageUrl: primaryImageUrl.trim(),
        description: description.trim(),
        costPrice: costNum,
        marginType: pricingPolicy,
        profitCalculationMethod: profitCalcMethod,
        profit_calculation_method: profitCalcMethod,
        profitMargin: pricingPolicy === 'FIXED'
          ? activeFixedMarginPercent
          : activeMaxMarginPercent,
        profitAmount: pricingPolicy === 'FIXED'
          ? activeFixedProfitAmount
          : activeMaxProfitAmount,
        customMinMargin: pricingPolicy === 'NEGOTIABLE'
          ? activeMinMarginPercent
          : null,
        customMaxMargin: pricingPolicy === 'NEGOTIABLE'
          ? activeMaxMarginPercent
          : null,
        salePrice: finalSavedSalePrice,
        minSalePrice: finalSavedMinPrice,
        maxSalePrice: finalSavedMaxPrice,
        totalStock: totalStock === '' ? 0 : Math.round(Number(totalStock)),
        lowStockLimit: product?.lowStockLimit !== undefined ? product.lowStockLimit : 5,
      };

      let savedProduct: any = null;
      if (product) {
        const res = await api.products.update(product.id, payload);
        savedProduct = (res as any)?.product || { ...product, ...payload, id: product.id };
      } else {
        const res = await api.products.create(payload);
        savedProduct = (res as any)?.product || {
          ...payload,
          id: (res as any)?.productId || effectiveProductId,
          barcode: (res as any)?.barcode || finalBarcodeToSave,
          sku: (res as any)?.sku || cleanSku,
        };
      }

      onSuccess(savedProduct);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Pricing Margin Calculations (Without decimals)
  const effectiveMaxSale = pricingPolicy === 'FIXED' ? finalFixedSalePrice : finalNegotiableMaxPrice;
  const effectiveMinSale = pricingPolicy === 'FIXED' ? finalFixedSalePrice : finalNegotiableMinPrice;

  const grossProfit = effectiveMaxSale - costVal;
  const markupPercent = costVal > 0 ? String(Math.round((grossProfit / costVal) * 100)) : '0';
  const marginPercent = effectiveMaxSale > 0 ? String(Math.round((grossProfit / effectiveMaxSale) * 100)) : '0';
  const isLoss = effectiveMaxSale > 0 && costVal > 0 && effectiveMaxSale < costVal;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] border border-slate-200 dark:border-purple-800/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER & 3-STEP WIZARD STEPPER */}
        <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-purple-500/20 dark:text-purple-300 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-2xs">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  {product ? `Edit Product: ${product.article || product.sku}` : 'Add Product Wizard'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-purple-200/80">
                  Step {currentStep} of 3 • 1 Product = 1 SKU = 1 Barcode = Inventory Count
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {product && (
                <button
                  type="button"
                  title="Print high-visibility 3x4 inch shoe box side-end label for rack storage"
                  onClick={() => setIsSideEndLabelOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-400/40 bg-purple-50 dark:bg-purple-500/30 text-purple-700 dark:text-purple-200 hover:bg-purple-600 hover:text-white transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>Side-End Label</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 3-Step Stepper Navigation */}
          <div className="grid grid-cols-3 gap-2">
            {/* Step 1 Tab */}
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className={`flex items-center gap-1.5 p-2 rounded-xl text-left transition cursor-pointer border ${
                currentStep === 1
                  ? 'btn-primary text-white shadow-xs font-semibold border-transparent'
                  : currentStep > 1
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/50'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  currentStep === 1
                    ? 'bg-white text-blue-600'
                    : currentStep > 1
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600 dark:bg-purple-900/60 dark:text-purple-200'
                }`}
              >
                {currentStep > 1 ? <Check className="w-3 h-3 stroke-[3]" /> : '1'}
              </div>
              <div className="truncate">
                <span className="block text-[9px] uppercase font-bold tracking-wider opacity-75">Step 1</span>
                <span className="block text-xs font-semibold truncate">Classification</span>
              </div>
            </button>

            {/* Step 2 Tab: Pricing Specs */}
            <button
              type="button"
              onClick={() => {
                if (validateStep1()) setCurrentStep(2);
              }}
              className={`flex items-center gap-1.5 p-2 rounded-xl text-left transition cursor-pointer border ${
                currentStep === 2
                  ? 'btn-primary text-white shadow-xs font-semibold border-transparent'
                  : currentStep > 2
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/50'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  currentStep === 2
                    ? 'bg-white text-blue-600'
                    : currentStep > 2
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-600 dark:bg-purple-900/60 dark:text-purple-200'
                }`}
              >
                {currentStep > 2 ? <Check className="w-3 h-3 stroke-[3]" /> : '2'}
              </div>
              <div className="truncate">
                <span className="block text-[9px] uppercase font-bold tracking-wider opacity-75">Step 2</span>
                <span className="block text-xs font-semibold truncate">Pricing</span>
              </div>
            </button>

            {/* Step 3 Tab: Barcode & Review */}
            <button
              type="button"
              onClick={() => {
                if (validateStep1() && validateStep2()) setCurrentStep(3);
              }}
              className={`flex items-center gap-1.5 p-2 rounded-xl text-left transition cursor-pointer border ${
                currentStep === 3
                  ? 'btn-primary text-white shadow-xs font-semibold border-transparent'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/50'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  currentStep === 3
                    ? 'bg-white text-blue-600'
                    : 'bg-slate-200 text-slate-600 dark:bg-purple-900/60 dark:text-purple-200'
                }`}
              >
                3
              </div>
              <div className="truncate">
                <span className="block text-[9px] uppercase font-bold tracking-wider opacity-75">Step 3</span>
                <span className="block text-xs font-semibold truncate">Barcode &amp; Review</span>
              </div>
            </button>
          </div>
        </div>

        {/* WIZARD FORM CONTENT */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Force stop at last step: do not auto-submit from form submit events
            if (currentStep < 3) {
              goToNextStep();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const target = e.target as HTMLElement;
              if (target && target.tagName === 'INPUT') {
                if (currentStep < 3) {
                  goToNextStep();
                } else if (target === articleInputRef.current) {
                  barcodeInputRef.current?.focus();
                } else if (target === barcodeInputRef.current) {
                  barcodeInputRef.current?.blur();
                }
              }
            }
          }}
          className="flex-1 overflow-y-auto p-6 space-y-6 text-xs bg-slate-50/50 dark:bg-[#070B14]"
        >
          {errorMessage && (
            <div className="alert-danger flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="text-xs">{errorMessage}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: PRODUCT CLASSIFICATION & VISUAL AI                */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* AI Visual Suggester & Product Image */}
              <AiProductSuggester
                imageUrl={primaryImageUrl}
                onImageUrlChange={(url) => setPrimaryImageUrl(url)}
                brands={brands}
                categories={categories}
                onSelectBrand={(id) => handleBrandSelect(id)}
                onSelectCategory={(id) => handleCategorySelect(id)}
                onSetTitle={(title) => setProductName(title)}
                onBrandsUpdated={(newBrands) => setBrands(newBrands)}
                onCategoriesUpdated={(newCats) => setCategories(newCats)}
              />

              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
                  <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    <span>1. Product Classification</span>
                  </h5>
                  <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">Step 1 of 3</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Brand Selector */}
                  <div>
                    <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                      Brand / Manufacturer <span className="text-red-500 dark:text-pink-400">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={brandId || localBrand?.id || ''}
                        onChange={(e) => handleBrandSelect(e.target.value ? Number(e.target.value) : (localBrand?.id || ''))}
                        className="flex-1 px-3 py-2 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-medium text-gray-900 dark:text-purple-200 hover:bg-slate-50 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] outline-none focus:border-indigo-600 dark:focus:border-purple-400 cursor-pointer transition"
                      >
                        {!brands.some((b) => b.name?.trim().toLowerCase() === 'local') && (
                          <option value="" className="dark:bg-[#120726] dark:text-purple-100">Local (Default)</option>
                        )}
                        {brands.map((b) => {
                          const isLocal = b.name?.trim().toLowerCase() === 'local';
                          return (
                            <option key={b.id} value={b.id} className="dark:bg-[#120726] dark:text-purple-100">
                              {b.name} {isLocal ? '(Default)' : ''}
                            </option>
                          );
                        })}
                      </select>
                      {(() => {
                        const curBrand = brands.find((b) => b.id === (brandId || localBrand?.id));
                        return (
                          <div title={`Selected Brand: ${curBrand?.name || 'Local'}`} className="shrink-0">
                            <BrandLogo logo={curBrand?.logo} name={curBrand?.name || 'Local'} size="md" />
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Brand Prefix (3-char):</span>
                      <span className="font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                        {currentBrandPrefix || 'LOC'}
                      </span>
                    </div>
                  </div>

                  {/* Category Selector */}
                  <div>
                    <label className="block font-bold text-gray-800 dark:text-slate-200 text-xs mb-1.5">
                      Shoe Category <span className="text-red-500 dark:text-pink-400">*</span>
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => handleCategorySelect(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-white dark:bg-purple-500/20 border border-gray-300 dark:border-purple-400/40 rounded-xl text-xs font-medium text-gray-900 dark:text-purple-200 hover:bg-slate-50 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] outline-none focus:border-indigo-600 dark:focus:border-purple-400 cursor-pointer transition"
                    >
                      <option value="" className="dark:bg-[#120726] dark:text-purple-100">Select Shoe Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="dark:bg-[#120726] dark:text-purple-100">
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">Article Prefix (2-char):</span>
                      <span className="font-mono font-bold text-[11px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                        {currentCategoryPrefix || '--'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PHYSICAL INVENTORY & DETAILS */}
              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                  <Package className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Physical Inventory &amp; Basic Specs</span>
                </h5>

                {/* Stock Quantity */}
                <div className="p-3.5 bg-indigo-50/70 dark:bg-gradient-to-br dark:from-slate-900 dark:via-indigo-950 dark:to-purple-950 border border-indigo-200/80 dark:border-indigo-600/40 rounded-xl space-y-2.5 shadow-sm">
                  <label className="block font-bold text-indigo-950 dark:text-white text-xs">
                    Total Available Stock Quantity (Pairs) <span className="text-red-500 dark:text-pink-400">*</span>
                  </label>
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setTotalStock((prev) => Math.max(0, (typeof prev === 'number' ? prev : 0) - lotSize))}
                      className="w-8 h-8 rounded-lg border border-indigo-200 dark:border-indigo-400/40 bg-white dark:bg-white/10 hover:bg-indigo-100 dark:hover:bg-white/20 flex items-center justify-center font-bold text-indigo-950 dark:text-white text-sm transition active:scale-95 shadow-2xs cursor-pointer"
                      title={`Decrease ${lotSize} pairs (1 Lot)`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      required
                      value={totalStock}
                      onChange={(e) => setTotalStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="0"
                      className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-950/80 border border-indigo-200 dark:border-indigo-400/40 rounded-lg font-mono font-bold text-center text-sm text-indigo-950 dark:text-white placeholder-indigo-300 dark:placeholder-white/40 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-400/30 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => setTotalStock((prev) => (typeof prev === 'number' ? prev : 0) + lotSize)}
                      className="w-8 h-8 rounded-lg border border-indigo-200 dark:border-indigo-400/40 bg-white dark:bg-white/10 hover:bg-indigo-100 dark:hover:bg-white/20 flex items-center justify-center font-bold text-indigo-950 dark:text-white text-sm transition active:scale-95 shadow-2xs cursor-pointer"
                      title={`Increase ${lotSize} pairs (1 Lot)`}
                    >
                      +
                    </button>
                  </div>

                  {/* Lot Size Selector & Dynamic Quick Chips */}
                  <div className="pt-2 border-t border-indigo-200/60 dark:border-white/10">
                    {/* Lot Option Toggle / Radio Group */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-indigo-900/80 dark:text-white uppercase tracking-wider">
                        Lot Size
                      </span>
                      <div
                        className="inline-flex p-0.5 bg-white/90 dark:bg-slate-950/70 border border-indigo-200 dark:border-indigo-400/30 rounded-lg"
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
                              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-indigo-500/30 font-extrabold border border-white/20'
                              : 'text-slate-600 dark:text-white/80 hover:text-indigo-600 dark:hover:text-white border border-transparent'
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
                              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-md shadow-indigo-500/30 font-extrabold border border-white/20'
                              : 'text-slate-600 dark:text-white/80 hover:text-indigo-600 dark:hover:text-white border border-transparent'
                          }`}
                        >
                          Lot 8
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Quantity Chips */}
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
                          onClick={() => setTotalStock(chip.value)}
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border transition active:scale-95 cursor-pointer ${
                            totalStock === chip.value
                              ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border-transparent shadow-md shadow-indigo-500/40 font-extrabold ring-2 ring-indigo-400 dark:ring-white/80'
                              : 'bg-gradient-to-r from-purple-600/90 via-indigo-600/90 to-purple-700/90 hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 text-white border-purple-300/40 dark:border-indigo-400/40 shadow-xs font-bold'
                          }`}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-indigo-200/60 dark:border-white/10">
                    <p className="text-[10px] text-indigo-900/70 dark:text-white/80 font-medium">
                      Direct physical shoe pair count for this product.
                    </p>
                  </div>
                </div>

                {/* Product Title / Display Name */}
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">
                    Product Title / Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. ${currentBrandName ? currentBrandName + ' ' : ''}${article || 'Air Runner Shoes'}`}
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 bg-white dark:bg-[#070B14] text-gray-900 dark:text-white"
                  />
                </div>

                {/* Auto-Assigned Standard Codes Summary */}
                {(article || sku) && (
                  <div className="p-3 bg-slate-100/80 dark:bg-[#070B14] border border-slate-200 dark:border-[#1A263D] rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span className="text-gray-600 dark:text-slate-400 font-medium">Standard Codes:</span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white bg-white dark:bg-[#131B2E] px-2 py-0.5 rounded border border-gray-200 dark:border-[#1A263D]">
                        Article: {article || '---'}
                      </span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60">
                        SKU: {sku || '---'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 dark:text-slate-400">Auto-generated from classification</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: PRICING SPECIFICATIONS (FIXED / NEGOTIABLE)       */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Main Pricing Policy & Specifications Card */}
              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800 gap-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-indigo-600 dark:text-blue-400" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">Product Pricing</h4>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                      pricingPolicy === 'FIXED'
                        ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                        : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
                    }`}>
                      {pricingPolicy === 'FIXED' ? 'Fixed Price Policy (from Settings)' : 'Negotiable Price Policy (from Settings)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRecalculateDefaults}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1 cursor-pointer"
                      title="Recalculate prices from global store margin settings"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Recalculate from Settings</span>
                    </button>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500 font-medium">Step 2 of 3</span>
                  </div>
                </div>

                {recalcNotice && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                    <span>{recalcNotice}</span>
                    <button type="button" onClick={() => setRecalcNotice(null)} className="text-emerald-600 font-bold ml-2 cursor-pointer">×</button>
                  </div>
                )}

                {/* Cost Price Input (Integer) */}
                <div className="p-4 bg-slate-50 dark:bg-[#070B14] border border-gray-200 dark:border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-gray-900 dark:text-slate-200 text-xs">
                      Cost Price (Whole Integer) <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] font-mono text-gray-500 dark:text-slate-400">
                      Standard whole number (no decimals)
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Procurement cost per shoe pair paid to supplier or factory. Initial selling prices are calculated from this cost price.
                  </p>
                  <div className="relative max-w-md">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400 font-mono font-bold text-base">
                      {currencySymbol}
                    </span>
                    <input
                      id="product-cost-price-input"
                      type="number"
                      min="0"
                      step="1"
                      required
                      autoFocus
                      placeholder="0"
                      value={costPrice}
                      onChange={(e) => handleCostPriceChange(e.target.value)}
                      onBlur={(e) => handleCostPriceBlur(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white dark:bg-[#0B101D] border-2 border-indigo-200 dark:border-indigo-800/80 rounded-xl font-mono font-black text-lg text-gray-950 dark:text-white outline-none focus:border-indigo-600 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 shadow-xs"
                    />
                  </div>
                </div>

                {/* 2-TAB SELECTOR: FIXED AMOUNT vs PROFIT MARGIN % */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                      Select Profit Calculation Method
                    </label>
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                      {profitCalcMethod === 'FIXED_AMOUNT'
                        ? `Active: Fixed Amount (${currencySymbol})`
                        : 'Active: Profit Margin (%)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-[#0A0F1E] rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      id="product-calc-tab-fixed-amount"
                      onClick={() => handleProfitCalcMethodChange('FIXED_AMOUNT')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        profitCalcMethod === 'FIXED_AMOUNT'
                          ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs border border-purple-200 dark:border-purple-500'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Fixed Amount ({currencySymbol})</span>
                    </button>

                    <button
                      type="button"
                      id="product-calc-tab-profit-margin"
                      onClick={() => handleProfitCalcMethodChange('PROFIT_MARGIN')}
                      className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        profitCalcMethod === 'PROFIT_MARGIN'
                          ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs border border-purple-200 dark:border-purple-500'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent'
                      }`}
                    >
                      <Percent className="w-3.5 h-3.5" />
                      <span>Profit Margin (%)</span>
                    </button>
                  </div>
                </div>

                {/* FIXED PRICING UI: Single active method tab (Fixed Amount OR Profit Margin %) */}
                {pricingPolicy === 'FIXED' && (
                  <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-2xl space-y-4">
                    <div className="flex flex-wrap items-center justify-between border-b border-purple-100 dark:border-purple-900/60 pb-2 gap-2">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>
                          {profitCalcMethod === 'FIXED_AMOUNT'
                            ? `Fixed Amount Profit Calculation (${currencySymbol})`
                            : 'Profit Margin (%) Calculation'}
                        </span>
                      </span>
                      <span className="text-[11px] text-purple-700 dark:text-purple-400 font-mono">
                        {profitCalcMethod === 'FIXED_AMOUNT'
                          ? `Settings Default: +${currencySymbol} ${configuredFixedAmount}`
                          : `Settings Default: +${configuredFixedMargin}%`}
                      </span>
                    </div>

                    {/* 2-Column Linked Grid: Selected Calculation Input + Final Sale Price */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {profitCalcMethod === 'FIXED_AMOUNT' ? (
                        /* TAB 1: Default Fixed Profit Amount (Rs.) * */
                        <div className="p-3 bg-white dark:bg-[#070B14] rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                              Default Fixed Profit Amount ({currencySymbol}) <span className="text-rose-500 font-bold">*</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                              {isFixedAmountOverridden && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsFixedAmountOverridden(false);
                                    setIsSalePriceOverridden(false);
                                    setFixedProfitAmount(configuredFixedAmount);
                                    if (costVal > 0) {
                                      setCustomFixedSalePrice(costVal + configuredFixedAmount);
                                    }
                                  }}
                                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                  title="Reset to default Fixed Profit Amount from Settings"
                                >
                                  Use Settings ({currencySymbol} {configuredFixedAmount})
                                </button>
                              )}
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold">
                                {isFixedAmountOverridden ? 'Override' : 'From Settings'}: +{currencySymbol} {activeFixedProfitAmount}
                              </span>
                            </div>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-500">
                              {currencySymbol}
                            </span>
                            <input
                              id="product-fixed-amount-input"
                              type="number"
                              min="0"
                              step="1"
                              placeholder={String(configuredFixedAmount)}
                              value={isFixedAmountOverridden ? fixedProfitAmount : configuredFixedAmount}
                              onChange={(e) => handleProfitAmountChange(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg font-mono font-bold text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-400"
                            />
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-slate-400">
                            Automatically taken from Settings (+{currencySymbol} {configuredFixedAmount}) unless overridden here
                          </p>
                        </div>
                      ) : (
                        /* TAB 2: Default Profit Margin (%) * */
                        <div className="p-3 bg-white dark:bg-[#070B14] rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                              Default Profit Margin (%) <span className="text-rose-500 font-bold">*</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                              {isFixedMarginOverridden && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsFixedMarginOverridden(false);
                                    setIsSalePriceOverridden(false);
                                    setFixedMarginPercent(configuredFixedMargin);
                                    if (costVal > 0) {
                                      setCustomFixedSalePrice(costVal + Math.round(costVal * (configuredFixedMargin / 100)));
                                    }
                                  }}
                                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                  title="Reset to default Profit Margin (%) from Settings"
                                >
                                  Use Settings ({configuredFixedMargin}%)
                                </button>
                              )}
                              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-bold">
                                {isFixedMarginOverridden ? 'Override' : 'From Settings'}: Cost + {activeFixedMarginPercent}%
                              </span>
                            </div>
                          </div>
                          <div className="relative">
                            <input
                              id="product-margin-percent-input"
                              type="number"
                              min="0"
                              max="1000"
                              step="1"
                              placeholder={String(configuredFixedMargin)}
                              value={isFixedMarginOverridden ? fixedMarginPercent : configuredFixedMargin}
                              onChange={(e) => handleMarginPercentChange(e.target.value)}
                              className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-purple-300 dark:border-purple-700 rounded-lg font-mono font-bold text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-400"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400">
                              %
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-slate-400">
                            Automatically taken from Settings (+{configuredFixedMargin}%) unless overridden here
                          </p>
                        </div>
                      )}

                      {/* Final Sale Price (Saved to DB & Barcode) */}
                      <div className="p-3 bg-purple-600/10 dark:bg-purple-900/30 rounded-xl border-2 border-purple-400 dark:border-purple-600 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-purple-900 dark:text-purple-200">
                            Final Sale Price
                          </label>
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 font-mono font-bold">
                            Barcode / POS
                          </span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-purple-700 dark:text-purple-300">
                            {currencySymbol}
                          </span>
                          <input
                            id="product-final-sale-price-input"
                            type="number"
                            min="0"
                            step="1"
                            placeholder={String(costVal)}
                            value={customFixedSalePrice !== '' ? customFixedSalePrice : (finalFixedSalePrice > 0 ? finalFixedSalePrice : '')}
                            onChange={(e) => handleSalePriceChange(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#070B14] border-2 border-purple-500 dark:border-purple-400 rounded-lg font-mono font-black text-lg text-purple-950 dark:text-purple-100 outline-none focus:ring-2 focus:ring-purple-400 shadow-xs"
                          />
                        </div>
                        <p className="text-[10px] text-purple-700 dark:text-purple-300 font-medium font-mono">
                          sale_price = {finalFixedSalePrice}
                        </p>
                      </div>
                    </div>

                    {/* Live Calculation Banner Based on Active Tab Only */}
                    <div className="p-3 bg-white dark:bg-[#070B14] rounded-xl border border-purple-100 dark:border-purple-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-slate-300 font-medium">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        {profitCalcMethod === 'FIXED_AMOUNT' ? (
                          <span>
                            Fixed Amount Calculation: Cost <strong>{currencySymbol} {costVal}</strong> + Fixed Profit <strong>{currencySymbol} {activeFixedProfitAmount}</strong> ({isFixedAmountOverridden ? 'User Override' : 'From Settings'}) = Final Price: <strong>{currencySymbol} {finalFixedSalePrice}</strong>
                          </span>
                        ) : (
                          <span>
                            Profit Margin (%) Calculation: Cost <strong>{currencySymbol} {costVal}</strong> + Margin <strong>{activeFixedMarginPercent}%</strong> (+{currencySymbol} {Math.round(costVal * (activeFixedMarginPercent / 100))}) = Final Price: <strong>{currencySymbol} {finalFixedSalePrice}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* NEGOTIABLE PRICING UI: Single active method tab (Fixed Amount OR Profit Margin %) */}
                {pricingPolicy === 'NEGOTIABLE' && (
                  <div className="space-y-4">
                    {/* TIER 1: MINIMUM SALE PRICE (POS FLOOR) */}
                    <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between border-b border-amber-200/70 dark:border-amber-900/60 pb-2 gap-2">
                        <span className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                          <span>1. Minimum Sale Price (POS Floor Negotiation Limit)</span>
                        </span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono">
                          {profitCalcMethod === 'FIXED_AMOUNT'
                            ? `Settings Default: +${currencySymbol} ${configuredMinAmount}`
                            : `Settings Default: +${configuredMinMargin}%`}
                        </span>
                      </div>

                      {/* 2-Column Linked Inputs Grid for Floor */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {profitCalcMethod === 'FIXED_AMOUNT' ? (
                          /* Floor Fixed Profit Amount */
                          <div className="p-3 bg-white dark:bg-[#070B14] rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                Default Min Fixed Profit Amount ({currencySymbol}) <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                                {isMinAmountOverridden ? 'Override' : 'From Settings'}: +{currencySymbol} {activeMinProfitAmount}
                              </span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-500">
                                {currencySymbol}
                              </span>
                              <input
                                id="product-min-fixed-amount-input"
                                type="number"
                                min="0"
                                step="1"
                                placeholder={String(configuredMinAmount)}
                                value={isMinAmountOverridden ? negotiableMinAmount : configuredMinAmount}
                                onChange={(e) => handleNegotiableMinAmountChange(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg font-mono font-bold text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
                              />
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-slate-400">
                              Taken from Settings (+{currencySymbol} {configuredMinAmount}) unless overridden here
                            </p>
                          </div>
                        ) : (
                          /* Floor Profit Margin (%) */
                          <div className="p-3 bg-white dark:bg-[#070B14] rounded-xl border border-amber-200 dark:border-amber-900/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                Default Min Profit Margin (%) <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                                {isMinMarginOverridden ? 'Override' : 'From Settings'}: Cost + {activeMinMarginPercent}%
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                id="product-min-margin-percent-input"
                                type="number"
                                min="0"
                                max="1000"
                                step="1"
                                placeholder={String(configuredMinMargin)}
                                value={isMinMarginOverridden ? negotiableMinPercent : configuredMinMargin}
                                onChange={(e) => handleNegotiableMinPercentChange(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg font-mono font-bold text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-400"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400">
                                %
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-slate-400">
                              Taken from Settings (+{configuredMinMargin}%) unless overridden here
                            </p>
                          </div>
                        )}

                        {/* Final Minimum Sale Price (POS Floor) */}
                        <div className="p-3 bg-amber-500/10 dark:bg-amber-900/30 rounded-xl border-2 border-amber-400 dark:border-amber-600 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                              Minimum Sale Price
                            </label>
                            <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono font-bold">
                              POS Floor Limit
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-amber-700 dark:text-amber-300">
                              {currencySymbol}
                            </span>
                            <input
                              id="product-min-sale-price-input"
                              type="number"
                              min="0"
                              step="1"
                              placeholder={String(autoCalculatedMinPrice)}
                              value={negotiableMinPrice !== '' ? negotiableMinPrice : (finalNegotiableMinPrice > 0 ? finalNegotiableMinPrice : '')}
                              onChange={(e) => handleNegotiableMinPriceChange(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#070B14] border-2 border-amber-500 dark:border-amber-400 rounded-lg font-mono font-black text-lg text-amber-950 dark:text-amber-100 outline-none focus:ring-2 focus:ring-amber-400 shadow-xs"
                            />
                          </div>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium font-mono">
                            min_sale_price = {finalNegotiableMinPrice}
                          </p>
                        </div>
                      </div>

                      {/* Floor Summary Banner Based on Active Tab Only */}
                      <div className="p-2.5 bg-white dark:bg-[#070B14] rounded-lg border border-amber-100 dark:border-amber-900/40 text-xs font-medium text-amber-900 dark:text-amber-300 flex items-center justify-between">
                        {profitCalcMethod === 'FIXED_AMOUNT' ? (
                          <span>
                            Floor Calculation (Fixed Amount): Cost {currencySymbol} {costVal} + Fixed Profit {currencySymbol} {negotiableMinAmount || 0} &rarr; Min POS Checkout: <strong>{currencySymbol} {finalNegotiableMinPrice}</strong>
                          </span>
                        ) : (
                          <span>
                            Floor Calculation (Profit Margin %): Cost {currencySymbol} {costVal} + {negotiableMinPercent || 0}% (+{currencySymbol} {Math.round(costVal * ((Number(negotiableMinPercent) || 0) / 100))}) &rarr; Min POS Checkout: <strong>{currencySymbol} {finalNegotiableMinPrice}</strong>
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500 dark:text-slate-400">Cashier cannot sell below this</span>
                      </div>
                    </div>

                    {/* TIER 2: MAXIMUM SALE PRICE (STICKER TAG M.R.P.) */}
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl space-y-3">
                      <div className="flex flex-wrap items-center justify-between border-b border-indigo-200/70 dark:border-indigo-900/60 pb-2 gap-2">
                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span>2. Maximum Sale Price (Sticker Tag M.R.P. &amp; Starting Price)</span>
                        </span>
                        <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-mono">
                          {profitCalcMethod === 'FIXED_AMOUNT'
                            ? `Settings Default: +${currencySymbol} ${configuredMaxAmount}`
                            : `Settings Default: +${configuredMaxMargin}%`}
                        </span>
                      </div>

                      {/* 2-Column Linked Inputs Grid for Sticker MRP */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {profitCalcMethod === 'FIXED_AMOUNT' ? (
                          /* Tag Fixed Profit Amount */
                          <div className="p-3 bg-white dark:bg-[#070B14] rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                Default Max Fixed Profit Amount ({currencySymbol}) <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                {isMaxAmountOverridden ? 'Override' : 'From Settings'}: +{currencySymbol} {activeMaxProfitAmount}
                              </span>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-500">
                                {currencySymbol}
                              </span>
                              <input
                                id="product-max-fixed-amount-input"
                                type="number"
                                min="0"
                                step="1"
                                placeholder={String(configuredMaxAmount)}
                                value={isMaxAmountOverridden ? negotiableMaxAmount : configuredMaxAmount}
                                onChange={(e) => handleNegotiableMaxAmountChange(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg font-mono font-bold text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-slate-400">
                              Taken from Settings (+{currencySymbol} {configuredMaxAmount}) unless overridden here
                            </p>
                          </div>
                        ) : (
                          /* Tag Profit Margin (%) */
                          <div className="p-3 bg-white dark:bg-[#070B14] rounded-xl border border-indigo-200 dark:border-indigo-900/50 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-gray-800 dark:text-slate-200">
                                Default Max Profit Margin (%) <span className="text-rose-500 font-bold">*</span>
                              </label>
                              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                {isMaxMarginOverridden ? 'Override' : 'From Settings'}: Cost + {activeMaxMarginPercent}%
                              </span>
                            </div>
                            <div className="relative">
                              <input
                                id="product-max-margin-percent-input"
                                type="number"
                                min="0"
                                max="1000"
                                step="1"
                                placeholder={String(configuredMaxMargin)}
                                value={isMaxMarginOverridden ? negotiableMaxPercent : configuredMaxMargin}
                                onChange={(e) => handleNegotiableMaxPercentChange(e.target.value)}
                                className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-lg font-mono font-bold text-base text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-400"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400">
                                %
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-slate-400">
                              Taken from Settings (+{configuredMaxMargin}%) unless overridden here
                            </p>
                          </div>
                        )}

                        {/* Final Maximum Sale Price (Sticker MRP) */}
                        <div className="p-3 bg-indigo-500/10 dark:bg-indigo-900/30 rounded-xl border-2 border-indigo-400 dark:border-indigo-600 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                              Maximum Sale Price
                            </label>
                            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                              Barcode / Label MRP
                            </span>
                          </div>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-black text-indigo-700 dark:text-indigo-300">
                              {currencySymbol}
                            </span>
                            <input
                              id="product-max-sale-price-input"
                              type="number"
                              min="0"
                              step="1"
                              placeholder={String(autoCalculatedMaxPrice)}
                              value={negotiableMaxPrice !== '' ? negotiableMaxPrice : (finalNegotiableMaxPrice > 0 ? finalNegotiableMaxPrice : '')}
                              onChange={(e) => handleNegotiableMaxPriceChange(e.target.value)}
                              className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#070B14] border-2 border-indigo-500 dark:border-indigo-400 rounded-lg font-mono font-black text-lg text-indigo-950 dark:text-indigo-100 outline-none focus:ring-2 focus:ring-indigo-400 shadow-xs"
                            />
                          </div>
                          <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium font-mono">
                            max_sale_price = {finalNegotiableMaxPrice}
                          </p>
                        </div>
                      </div>

                      {/* Tag MRP Summary Banner Based on Active Tab Only */}
                      <div className="p-2.5 bg-white dark:bg-[#070B14] rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-xs font-medium text-indigo-900 dark:text-indigo-300 flex items-center justify-between">
                        {profitCalcMethod === 'FIXED_AMOUNT' ? (
                          <span>
                            Tag MRP Calculation (Fixed Amount): Cost {currencySymbol} {costVal} + Fixed Profit {currencySymbol} {negotiableMaxAmount || 0} &rarr; Sticker Price: <strong>{currencySymbol} {finalNegotiableMaxPrice}</strong>
                          </span>
                        ) : (
                          <span>
                            Tag MRP Calculation (Profit Margin %): Cost {currencySymbol} {costVal} + {negotiableMaxPercent || 0}% (+{currencySymbol} {Math.round(costVal * ((Number(negotiableMaxPercent) || 0) / 100))}) &rarr; Sticker Price: <strong>{currencySymbol} {finalNegotiableMaxPrice}</strong>
                          </span>
                        )}
                        <span className="text-[10px] text-gray-500 dark:text-slate-400">Printed on barcode sticker</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Important Pricing Rule Note */}
                <div className="p-3 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 text-xs flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    <strong>Saved Price Guarantee:</strong> The prices configured above are saved permanently to this product ({pricingPolicy === 'FIXED' ? `sale_price: ${finalFixedSalePrice}` : `range: ${finalNegotiableMinPrice} - ${finalNegotiableMaxPrice}`}). Changing global store margins in Settings will <em>not</em> overwrite this product's price unless you explicitly click <strong>Recalculate from Settings</strong>.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: BARCODE & IDENTIFICATION (VALIDATED & EDITABLE)   */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-indigo-600 dark:text-blue-400" />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">3. Article &amp; Barcode Identification</h4>
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-slate-500">Step 3 of 3</span>
                </div>

                {/* EDITABLE ARTICLE SECTION (ALIGNED WITH BARCODE INPUT) */}
                <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="font-bold text-gray-900 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        <span>Article Input (Editable Store or Box Article)</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Pre-filled with designed store article ({generateSuggestedArticle(currentCategoryPrefix || 'CA', effectiveProductId)}). You can keep it, or type a manufacturer box article code.
                      </p>
                    </div>

                    {/* Fast Action Buttons for Article */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleResetStoreArticle}
                        className="px-2.5 py-1.5 bg-indigo-50 dark:bg-blue-950/50 hover:bg-indigo-100 dark:hover:bg-blue-900/60 text-indigo-600 dark:text-blue-400 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-blue-800/60"
                        title="Reset to auto-generated store standard article code"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400" />
                        <span>Reset to Store Article</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleArticleChange('');
                          setTimeout(() => articleInputRef.current?.focus(), 50);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#070B14] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer border border-slate-300 dark:border-slate-700"
                        title="Clear and focus to enter custom or box article code"
                      >
                        <Tag className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        <span>Enter Box Article</span>
                      </button>
                    </div>
                  </div>

                  {/* Editable Article Input with Dynamic Border & Linked SKU State */}
                  <div className="relative">
                    <input
                      ref={articleInputRef}
                      id="product-article-step3-input"
                      type="text"
                      required
                      placeholder={`Type article code or box article (e.g. ${generateSuggestedArticle(currentCategoryPrefix || 'CA', effectiveProductId)} or ART-905)...`}
                      value={article}
                      onChange={(e) => handleArticleChange(e.target.value)}
                      className={`w-full pl-10 pr-28 py-3 bg-white dark:bg-[#070B14] border-2 rounded-xl font-mono font-bold text-base text-gray-900 dark:text-white outline-none transition shadow-xs uppercase ${
                        article.trim().length > 0
                          ? 'border-emerald-400 dark:border-emerald-500 focus:border-emerald-600 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950'
                          : 'border-red-400 dark:border-red-500 focus:border-red-600 dark:focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950'
                      }`}
                    />
                    <Tag className="w-5 h-5 text-indigo-600 dark:text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {article && (
                        <button
                          type="button"
                          onClick={() => {
                            handleArticleChange('');
                            articleInputRef.current?.focus();
                          }}
                          className="px-2 py-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded text-[10px] font-semibold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <span className="font-mono text-[10px] font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                        {article.trim().length} chars
                      </span>
                    </div>
                  </div>

                  {/* REAL-TIME ARTICLE & LINKED SKU FEEDBACK */}
                  {article.trim().length > 0 ? (
                    <div className="alert-success flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
                      <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-300 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold text-emerald-900 dark:text-emerald-300 font-mono">
                            {article.trim().toUpperCase()}
                          </span>
                          <span className="mx-1.5 opacity-40">|</span>
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Linked SKU: <strong className="font-mono">{sku || '---'}</strong>
                          </span>
                        </div>
                      </div>
                      <span className="badge-success uppercase text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>{isArticleManuallyEdited ? 'Custom Article' : 'Store Article'}</span>
                      </span>
                    </div>
                  ) : (
                    <div className="alert-danger flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
                      <div className="flex items-center gap-2 text-red-800 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                        <span>Article code is required for product identification and box labels.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetStoreArticle}
                        className="btn-danger px-2.5 py-1 text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Restore Store Article</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* EDITABLE BARCODE SECTION WITH REAL-TIME VALIDATION */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label className="font-bold text-gray-900 dark:text-slate-200 text-xs flex items-center gap-1.5">
                        <span>Barcode Input (Validated &amp; Scannable)</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">
                        Pre-filled with designed store standard EAN-13. You can keep it, or scan/type an external manufacturer box barcode.
                      </p>
                    </div>

                    {/* Fast Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleGenerateStoreBarcode}
                        className="px-2.5 py-1.5 bg-indigo-50 dark:bg-blue-950/50 hover:bg-indigo-100 dark:hover:bg-blue-900/60 text-indigo-600 dark:text-blue-400 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-blue-800/60"
                        title="Auto-generate standard 13-digit EAN-13 using your store prefix"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-blue-400" />
                        <span>Reset to Store EAN-13</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setBarcode('');
                          setTimeout(() => barcodeInputRef.current?.focus(), 50);
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#070B14] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer border border-slate-300 dark:border-slate-700"
                        title="Clear and focus to scan box barcode with gun or type manual barcode"
                      >
                        <Scan className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                        <span>Scan / Enter Box Barcode</span>
                      </button>
                    </div>
                  </div>

                  {/* Editable Barcode Input with Dynamic Border & Validation State */}
                  <div className="relative">
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      required
                      placeholder="Scan box barcode with gun or type (e.g. 045242500123 or 0108923000018)..."
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value.trim())}
                      className={`w-full pl-10 pr-28 py-3 bg-white dark:bg-[#070B14] border-2 rounded-xl font-mono font-bold text-base text-gray-900 dark:text-white outline-none transition shadow-xs ${
                        barcodeValidation.status === 'valid'
                          ? 'border-emerald-400 dark:border-emerald-500 focus:border-emerald-600 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950'
                          : barcodeValidation.status === 'invalid'
                          ? 'border-red-400 dark:border-red-500 focus:border-red-600 dark:focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-950'
                          : barcodeValidation.status === 'checking'
                          ? 'border-amber-400 dark:border-amber-500 focus:border-amber-600 dark:focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:focus:ring-amber-950'
                          : 'border-indigo-300 dark:border-blue-700/60 focus:border-indigo-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-blue-950'
                      }`}
                    />
                    <Barcode className="w-5 h-5 text-indigo-600 dark:text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {barcode && (
                        <button
                          type="button"
                          onClick={() => setBarcode('')}
                          className="px-2 py-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded text-[10px] font-semibold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                      <span className="font-mono text-[10px] font-bold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                        {barcode.length} chars
                      </span>
                    </div>
                  </div>

                  {/* REAL-TIME VALIDATION STATUS FEEDBACK */}
                  {barcodeValidation.status === 'checking' && (
                    <div className="alert-warning flex items-center gap-2.5 text-xs animate-in fade-in">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>{barcodeValidation.message || 'Validating barcode format & checking catalog uniqueness...'}</span>
                    </div>
                  )}

                  {barcodeValidation.status === 'valid' && (
                    <div className="alert-success flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
                      <div className="flex items-center gap-2 text-emerald-950 dark:text-emerald-300 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <span className="font-bold text-emerald-900 dark:text-emerald-300">{barcodeValidation.standardLabel || 'Barcode'}</span>
                          <span className="mx-1.5 opacity-40">|</span>
                          <span className="text-emerald-700 dark:text-emerald-400">Checksum verified &amp; available in catalog</span>
                        </div>
                      </div>
                      <span className="badge-success uppercase text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Validated</span>
                      </span>
                    </div>
                  )}

                  {barcodeValidation.status === 'invalid' && (
                    <div className="alert-danger space-y-2.5 text-xs animate-in fade-in">
                      <div className="flex items-start gap-2.5 text-red-800 dark:text-red-300">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <span className="font-bold block text-red-950 dark:text-red-200 text-xs">
                            {barcodeValidation.isDuplicate
                              ? 'Duplicate Barcode Conflict'
                              : 'Barcode Validation Failed'}
                          </span>
                          <p className="text-red-700 dark:text-red-300 text-[11px] mt-0.5 leading-relaxed">
                            {barcodeValidation.error}
                          </p>
                        </div>
                      </div>

                      {/* Auto-fix suggested check digit button */}
                      {barcodeValidation.suggestedFix && (
                        <div className="pt-2 border-t border-red-200 dark:border-red-800/60 flex flex-wrap items-center justify-between gap-2">
                          <div className="text-[11px] text-red-900 dark:text-red-300 font-mono">
                            Correct checksum code:{' '}
                            <span className="font-bold underline">{barcodeValidation.suggestedFix}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBarcode(barcodeValidation.suggestedFix!)}
                            className="btn-danger px-3 py-1 text-[11px] flex items-center gap-1.5 shadow-2xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Auto-Fix Check Digit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Standard Guidelines Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-gray-500 dark:text-slate-400">
                    <span>
                      Supported: Store EAN-13, International EAN-13, UPC-A (12D), EAN-8, and Code-128 box codes.
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      Auto-validated on type/scan
                    </span>
                  </div>
                </div>

                {/* LIVE VISUAL BARCODE PREVIEW */}
                {barcode && (
                  <div className="p-4 bg-slate-50 dark:bg-[#070B14] border border-gray-200 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                      Live Scannable Barcode Preview
                    </span>
                    <div className="bg-white p-3 rounded-lg border border-gray-200 dark:border-slate-700 shadow-2xs">
                      <BarcodeSvg
                        value={barcode}
                        width={1.7}
                        height={46}
                        fontSize={12}
                        className="max-w-full h-auto"
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400 text-center">
                      Cashier barcode guns will read this code at checkout to look up: <span className="font-semibold text-gray-800 dark:text-slate-200">{productName || article || 'Product'}</span>
                    </p>

                    {/* Quick Label & Sticker Actions */}
                    <div className="pt-2 border-t border-gray-200 dark:border-slate-800 w-full flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        title="Print retail barcode sticker (50x30mm)"
                        onClick={() => setIsBarcodeStickerOpen(true)}
                        className="px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-gradient-to-r hover:from-purple-600 hover:to-indigo-600 hover:text-white dark:hover:from-purple-600 dark:hover:to-indigo-600 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-bold active:scale-95"
                      >
                        <Barcode className="w-3.5 h-3.5" />
                        <span>Print Barcode Sticker (50x30mm)</span>
                      </button>

                      <button
                        type="button"
                        title="Print high-visibility 3x4 inch shoe box side-end label for rack storage"
                        onClick={() => setIsSideEndLabelOpen(true)}
                        className="px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 hover:bg-purple-600 hover:text-white dark:hover:bg-purple-600 transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>Print Side-End Box Label (3&quot; x 4&quot;)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* FINAL REVIEW SUMMARY CARD */}
              <div className="bg-white dark:bg-gradient-to-b dark:from-[#131B2E]/90 dark:to-[#0A0E1A]/80 p-5 rounded-2xl border border-gray-200 dark:border-[#1A263D] shadow-xs dark:shadow-[0_0_20px_rgba(59,130,246,0.05)] space-y-3">
                <h5 className="font-bold text-gray-800 dark:text-white text-xs uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Product Review Summary Before Saving</span>
                </h5>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-gray-100 dark:border-slate-800">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Brand &amp; Category</span>
                    <span className="font-bold text-gray-900 dark:text-white truncate block">
                      {currentBrandName || '---'} / {currentCategoryName || '---'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-gray-100 dark:border-slate-800">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Article / SKU</span>
                    <span className="font-mono font-bold text-indigo-600 dark:text-blue-400 truncate block">
                      {article || '---'} <span className="text-gray-400 dark:text-slate-500 font-normal">({sku || '---'})</span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-gray-100 dark:border-slate-800">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Cost / Max Sale Price</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 truncate block">
                      {currencySymbol} {formatStockPrice(costPrice)} / {currencySymbol} {formatStockPrice(effectiveMaxSale)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#070B14] border border-gray-100 dark:border-slate-800">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500 block">Total Stock</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white truncate block">
                      {totalStock === '' ? 0 : totalStock} Pairs
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* FOOTER NAVIGATION & ACTION BUTTONS                        */}
          {/* ========================================================= */}
          <div className="pt-4 -mx-6 -mb-6 p-6 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-gray-200 dark:border-purple-800/80 flex items-center justify-between">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={goToPrevStep}
                  className="btn-secondary px-4 py-2.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs font-bold"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary px-4 py-2.5 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="btn-primary px-5 py-2.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-sm font-bold"
                >
                  <span>
                    {currentStep === 1
                      ? 'Next: Pricing Specifications'
                      : 'Next: Barcode & Identification'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConfirmAndSave}
                  disabled={isSubmitting || barcodeValidation.status === 'invalid' || !article.trim()}
                  className="btn-primary px-6 py-2.5 text-xs flex items-center gap-1.5 cursor-pointer shadow-md font-bold disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmitting ? 'Saving Product...' : product ? 'Confirm & Update Product' : 'Confirm & Create Product'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </motion.div>

      <AnimatePresence>
        {isSideEndLabelOpen && (
          <SideEndBoxLabelModal
            product={
              product || {
                id: effectiveProductId,
                article: article || productName || 'Shoe Article',
                name: productName || article,
                sku: sku,
                barcode: barcode || sku,
                costPrice: costVal || 0,
                salePrice: pricingPolicy === 'FIXED' ? finalFixedSalePrice : effectiveMaxSale,
                minSalePrice: effectiveMinSale || 0,
                maxSalePrice: effectiveMaxSale || 0,
                marginType: pricingPolicy,
                brandName: currentBrandName,
                categoryName: currentCategoryName,
              }
            }
            companySettings={companySettings}
            onClose={() => setIsSideEndLabelOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBarcodeStickerOpen && (
          <BarcodeStickerModal
            product={
              product || {
                id: effectiveProductId,
                article: article || productName || 'Shoe Article',
                name: productName || article,
                sku: sku,
                barcode: barcode || sku,
                costPrice: costVal || 0,
                salePrice: pricingPolicy === 'FIXED' ? finalFixedSalePrice : effectiveMaxSale,
                minSalePrice: effectiveMinSale || 0,
                maxSalePrice: effectiveMaxSale || 0,
                marginType: pricingPolicy,
                brandName: currentBrandName,
                categoryName: currentCategoryName,
              }
            }
            companySettings={companySettings}
            onClose={() => setIsBarcodeStickerOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
