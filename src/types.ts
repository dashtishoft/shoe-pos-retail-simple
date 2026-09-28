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

export type PricingPolicy = 'FIXED' | 'NEGOTIABLE';

export interface CompanySettings {
  id: number;
  name: string;
  companyName?: string;
  company_name?: string;
  logo: string;
  showReceiptLogo?: boolean;
  show_receipt_logo?: boolean;
  receiptLogo?: string;
  receipt_logo?: string;
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
  pricingPolicy?: PricingPolicy;
  pricing_policy?: PricingPolicy;
  pricingMode?: PricingPolicy;
  pricing_mode?: PricingPolicy;
  pricingPolicyLocked?: boolean;
  pricing_policy_locked?: boolean;
  isInstalled?: boolean;
  is_installed?: boolean;
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
  sellingPrice: number;
  selling_price?: number;
  minPrice: number;
  min_price?: number;
  maxPrice: number;
  max_price?: number;
  // Backward-compatible aliases for display/cart components
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
  name?: string;
  productName?: string;
  brandName?: string;
  brandLogo?: string;
  sku: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  pricingPolicy?: 'FIXED' | 'NEGOTIABLE';
  sellingPrice?: number;
  minPrice?: number;
  maxPrice?: number;
  salePrice?: number;
  minSalePrice: number;
  maxSalePrice?: number;
  costPrice: number;
  discount: number;
  subtotal?: number;
  total?: number;
  totalStock: number;
  isPriceOverridden?: boolean;
  originalPrice?: number;
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

