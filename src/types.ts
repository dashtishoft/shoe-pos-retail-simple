export type UserRole = 'ADMIN' | 'CASHIER' | 'MANAGER' | string;
export type UserStatus = 'PENDING' | 'APPROVED';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  id: number;
  name: string;
  companyName?: string;
  company_name?: string;
  logo: string;
  address: string;
  companyAddress?: string;
  company_address?: string;
  phone: string;
  companyPhone?: string;
  company_phone?: string;
  email: string;
  companyEmail?: string;
  company_email?: string;
  website: string;
  strn: string;
  taxId: string;
  tax_id?: string;
  taxNumber: string;
  currency: string;
  currencyName: string;
  currency_name?: string;
  currencySymbol: string;
  currency_symbol?: string;
  invoicePrefix: string;
  invoice_prefix?: string;
  purchasePrefix: string;
  purchase_prefix?: string;
  barcodePrefix: string;
  barcode_prefix?: string;
  invoiceFooter: string;
  invoice_footer?: string;
  lowStockLimit: number;
  pricingMode?: 'FIXED' | 'NEGOTIABLE';
  pricing_mode?: 'FIXED' | 'NEGOTIABLE';
  fixedProfitMargin?: number;
  fixed_profit_margin?: number;
  fixedProfitAmount?: number;
  fixed_profit_amount?: number;
  minProfitMargin?: number;
  min_profit_margin?: number;
  minProfitAmount?: number;
  min_profit_amount?: number;
  maxProfitMargin?: number;
  max_profit_margin?: number;
  maxProfitAmount?: number;
  max_profit_amount?: number;
  updatedAt: string;
}

export interface Brand {
  name: string;
  logo?: string;
  product_count?: number;
  total_units?: number;
}

export interface Category {
  name: string;
  product_count?: number;
  total_units?: number;
}

export interface ProductSize {
  id?: number;
  productId?: number;
  sizeLabel: string;
  quantity: number;
}

export interface ProductColor {
  id?: number;
  productId?: number;
  colorCode: string; // Strictly 2 digits (01 to 99)
  colorName: string;
  barcode?: string;  // 13-digit EAN-13 barcode
  imageUrl?: string | null;
}

export type AiConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AiBrandSuggestion {
  suggestedName: string;
  confidence: AiConfidenceLevel;
  isUnknown: boolean;
}

export interface AiCategorySuggestion {
  suggestedName: string;
  confidence: AiConfidenceLevel;
}

export interface AiProductSuggestionResult {
  brand: AiBrandSuggestion;
  category: AiCategorySuggestion;
  title: string;
  confidence: AiConfidenceLevel;
  visualClues: string[];
  observations?: string;
  formattedOutput?: string;
  rawOutput?: string;
  isValidFootwear?: boolean;
}

export interface Product {
  id: number;
  article: string;
  name?: string;
  brand: string;
  brandName?: string;
  brandLogo?: string;
  category: string;
  categoryName?: string;
  sku: string;
  barcode: string;
  primaryImageUrl: string;
  description?: string;
  costPrice: number;
  cost_price?: number;
  marginType?: 'FIXED' | 'NEGOTIABLE';
  margin_type?: 'FIXED' | 'NEGOTIABLE';
  profitCalculationMethod?: 'FIXED_AMOUNT' | 'PROFIT_MARGIN';
  profit_calculation_method?: 'FIXED_AMOUNT' | 'PROFIT_MARGIN';
  profitMargin?: number | null;
  profit_margin?: number | null;
  profitAmount?: number | null;
  profit_amount?: number | null;
  customMinMargin?: number | null;
  custom_min_margin?: number | null;
  customMaxMargin?: number | null;
  custom_max_margin?: number | null;
  salePrice?: number | null;
  sale_price?: number | null;
  minSalePrice?: number | null;
  min_sale_price?: number | null;
  maxSalePrice?: number | null;
  max_sale_price?: number | null;
  totalStock: number;
  lowStockLimit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  sizes?: ProductSize[];
  colors?: ProductColor[];
}

export interface Customer {
  id: number;
  code?: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  notes?: string;
  totalPurchases?: number;
  total_orders?: number;
  totalOrders?: number;
  total_spent?: number | string;
  totalSpent?: number;
  loyalty_points?: number;
  loyaltyPoints?: number;
  balance?: number | string;
  last_visit?: string | null;
  lastVisit?: string | null;
  createdAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  balance?: number | string;
  net_payable_balance?: number | string;
  total_purchases?: number;
  totalPurchases?: number;
  total_purchased_amount?: number | string;
  totalPurchasedAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  productId: number;
  article?: string;
  productName?: string;
  sku: string;
  barcode: string;
  colorName?: string;
  colorCode?: string;
  colorBarcode?: string;
  quantity: number;
  unitPrice: number;
  pricingPolicy?: 'FIXED' | 'NEGOTIABLE';
  salePrice?: number;
  minSalePrice: number;
  maxSalePrice?: number;
  costPrice: number;
  discount: number;
  total: number;
  totalStock: number;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  article?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
  purchasePrice: number; // Historical purchase price at time of sale
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string;
  saleDate: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'SPLIT';
  cashReceived: number;
  changeGiven: number;
  createdBy: number;
  createdByName?: string;
  isMinPriceOverridden: boolean;
  overriddenBy?: number | null;
  notes?: string;
  createdAt: string;
  items?: SaleItem[];
}

export interface PurchaseItem {
  id?: number;
  purchaseId?: number;
  productId: number;
  article?: string;
  productName?: string;
  quantity: number;
  unitPurchasePrice: number;
  subtotal: number;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierName: string;
  purchaseDate: string;
  totalAmount: number;
  notes?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  items?: PurchaseItem[];
}

export interface PurchaseReturnItem {
  id?: number;
  purchaseReturnId?: number;
  productId: number;
  article?: string;
  productName?: string;
  sku?: string;
  barcode?: string;
  cartonQuantity?: number;
  pairsPerCarton?: number;
  quantity: number;
  unitPurchasePrice: number;
  subtotal: number;
  defectType?: string;
}

export interface PurchaseReturn {
  id: number;
  returnNumber: string;
  purchaseId?: number | null;
  purchaseNumber?: string | null;
  supplierId?: number | null;
  supplierName: string;
  supplierPhone?: string;
  returnDate: string;
  totalDebitAmount: number;
  reason: string;
  notes?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  items?: PurchaseReturnItem[];
}

export interface ReturnItem {
  id: number;
  returnId: number;
  saleItemId: number;
  productId: number;
  article?: string;
  productName?: string;
  quantity: number;
  unitRefundPrice: number;
  subtotal: number;
}

export interface ReturnRecord {
  id: number;
  returnNumber: string;
  originalSaleId: number;
  invoiceNumber?: string;
  customerId?: number | null;
  customerName?: string;
  returnDate: string;
  totalRefundAmount: number;
  reason: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  items?: ReturnItem[];
}

export interface ExchangeItem {
  saleItemId: number;
  productId: number;
  article: string;
  productName: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unitRefundPrice: number;
  subtotal: number;
}

export interface ActiveExchange {
  originalSaleId: number;
  originalInvoiceNumber: string;
  originalSaleDate?: string;
  customerId?: number | null;
  customerName?: string;
  customerPhone?: string;
  reason: string;
  items: ExchangeItem[];
}

export type MovementType = 'PURCHASE' | 'SALE' | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'ADJUSTMENT';

export interface StockMovement {
  id: number;
  productId: number;
  article?: string;
  productName?: string;
  sku?: string;
  qtyChange: number;
  prevStock: number;
  newStock: number;
  movementType: MovementType;
  referenceId?: string;
  userId: number;
  userName?: string;
  notes?: string;
  createdAt: string;
}

export interface ApiToken {
  id: number;
  name: string;
  token: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt?: string | null;
}

// Carton Packing Configuration
export interface CartonPack {
  id: number;
  pack_name: string;
  packName?: string;
  pairs_per_carton: number;
  pairsPerCarton?: number;
  is_default?: boolean;
  isDefault?: boolean;
}

// Payload expected when adding an item from the POS item selection module
export interface PosAddToCartPayload {
  productId: number;
  cartonPackId: number;
  cartons: number;
  totalPairs: number;
  totalPrice: number;
  unitPrice?: number;
  pricePerCarton?: number;
  packName?: string;
  pairsPerCarton?: number;
  product?: any;
}

