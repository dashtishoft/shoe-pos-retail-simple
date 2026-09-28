import { pgTable, serial, text, integer, numeric, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').default(''),
  avatarUrl: text('avatar_url').default(''),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['ADMIN', 'CASHIER'] }).default('CASHIER').notNull(),
  status: text('status', { enum: ['PENDING', 'APPROVED'] }).default('PENDING').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Password Reset Tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Company Settings (StoreSettings)
export const companySettings = pgTable('company_settings', {
  id: serial('id').primaryKey(),
  name: text('name').default('Your Shoe Store').notNull(),
  logo: text('logo').default(''),
  address: text('address').default(''),
  phone: text('phone').default(''),
  email: text('email').default(''),
  website: text('website').default(''),
  strn: text('strn').default(''),
  taxId: text('tax_id').default(''),
  taxNumber: text('tax_number').default(''),
  currency: text('currency').default('PKR').notNull(),
  currencyName: text('currency_name').default('Pakistani Rupee').notNull(),
  currencySymbol: text('currency_symbol').default('Rs.').notNull(),
  invoicePrefix: text('invoice_prefix').default('INV-').notNull(),
  purchasePrefix: text('purchase_prefix').default('PUR-').notNull(),
  barcodePrefix: text('barcode_prefix').default('0108923').notNull(),
  invoiceFooter: text('invoice_footer').default('Thank you for shopping with us!').notNull(),
  showReceiptLogo: boolean('show_receipt_logo').default(false).notNull(),
  receiptLogo: text('receipt_logo').default(''),
  lowStockLimit: integer('low_stock_limit').default(5).notNull(),
  pricingMode: text('pricing_mode').default('FIXED').notNull(),
  pricingPolicyLocked: boolean('pricing_policy_locked').default(false).notNull(),
  isInstalled: boolean('is_installed').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Products (1 Product = 1 SKU = 1 Barcode = Total Stock)
// Refined Pricing Fields: costPrice, sellingPrice (for Fixed), minPrice (for Negotiable), maxPrice (for Negotiable)
export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  brand: text('brand').default('Local').notNull(),
  category: text('category').default('Casual Shoes').notNull(),
  sku: text('sku').notNull().unique(),
  article: text('article').notNull(),
  barcode: text('barcode').notNull().unique(),
  description: text('description').default(''),
  primaryImageUrl: text('primary_image_url').default(''),
  costPrice: numeric('cost_price', { precision: 12, scale: 2 }).notNull(),
  sellingPrice: integer('selling_price').default(0).notNull(),
  minPrice: integer('min_price').default(0).notNull(),
  maxPrice: integer('max_price').default(0).notNull(),
  totalStock: integer('total_stock').default(0).notNull(),
  lowStockLimit: integer('low_stock_limit').default(5).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    barcodeIdx: uniqueIndex('products_barcode_idx').on(table.barcode),
    skuIdx: uniqueIndex('products_sku_idx').on(table.sku),
    articleIdx: index('products_article_idx').on(table.article),
    activeIdx: index('products_active_idx').on(table.active),
    brandIdx: index('products_brand_idx').on(table.brand),
    categoryIdx: index('products_category_idx').on(table.category),
  };
});

// Customers
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  address: text('address'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    phoneIdx: index('customers_phone_idx').on(table.phone),
  };
});

// Suppliers
export const suppliers = pgTable('suppliers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').default(''),
  email: text('email').default(''),
  balance: numeric('balance', { precision: 12, scale: 2 }).default('0.00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Purchases
export const purchases = pgTable('purchases', {
  id: serial('id').primaryKey(),
  purchaseNumber: text('purchase_number').notNull().unique(),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  supplierName: text('supplier_name').notNull(),
  purchaseDate: text('purchase_date').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: numeric('paid_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  paymentStatus: text('payment_status', { enum: ['UNPAID', 'PARTIAL', 'PAID'] }).default('UNPAID').notNull(),
  paymentMethod: text('payment_method').default('CASH'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Supplier Payments (Payments made to suppliers on-account or for specific purchases)
export const supplierPayments = pgTable('supplier_payments', {
  id: serial('id').primaryKey(),
  paymentNumber: text('payment_number').notNull().unique(),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'cascade' }).notNull(),
  supplierName: text('supplier_name').notNull(),
  purchaseId: integer('purchase_id').references(() => purchases.id, { onDelete: 'set null' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentDate: text('payment_date').notNull(),
  paymentMethod: text('payment_method').default('CASH').notNull(),
  referenceNumber: text('reference_number').default(''),
  notes: text('notes').default(''),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    paymentNumberIdx: uniqueIndex('supplier_payments_number_idx').on(table.paymentNumber),
    supplierIdx: index('supplier_payments_supplier_idx').on(table.supplierId),
    dateIdx: index('supplier_payments_date_idx').on(table.paymentDate),
  };
});

// Purchase Items
export const purchaseItems = pgTable('purchase_items', {
  id: serial('id').primaryKey(),
  purchaseId: integer('purchase_id').references(() => purchases.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPurchasePrice: numeric('unit_purchase_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
});

// Purchase Returns (Supplier Debit Notes for Defective Footwear)
export const purchaseReturns = pgTable('purchase_returns', {
  id: serial('id').primaryKey(),
  returnNumber: text('return_number').notNull().unique(),
  purchaseId: integer('purchase_id').references(() => purchases.id, { onDelete: 'set null' }),
  supplierId: integer('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
  supplierName: text('supplier_name').notNull(),
  returnDate: text('return_date').notNull(),
  totalDebitAmount: numeric('total_debit_amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    returnNumberIdx: uniqueIndex('purchase_returns_number_idx').on(table.returnNumber),
  };
});

// Purchase Return Items
export const purchaseReturnItems = pgTable('purchase_return_items', {
  id: serial('id').primaryKey(),
  purchaseReturnId: integer('purchase_return_id').references(() => purchaseReturns.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPurchasePrice: numeric('unit_purchase_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  defectType: text('defect_type').default('MANUFACTURING_DEFECT'),
});

// Sales
export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  invoiceNumber: text('invoice_number').notNull().unique(),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  saleDate: text('sale_date').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method', { enum: ['CASH', 'CARD', 'SPLIT'] }).default('CASH').notNull(),
  cashReceived: numeric('cash_received', { precision: 12, scale: 2 }).default('0.00').notNull(),
  changeGiven: numeric('change_given', { precision: 12, scale: 2 }).default('0.00').notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  isMinPriceOverridden: boolean('is_min_price_overridden').default(false).notNull(),
  overriddenBy: integer('overridden_by').references(() => users.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    invoiceIdx: uniqueIndex('sales_invoice_number_idx').on(table.invoiceNumber),
  };
});

// Sale Items (MUST record purchase_price at time of sale for profit tracking)
export const saleItems = pgTable('sale_items', {
  id: serial('id').primaryKey(),
  saleId: integer('sale_id').references(() => sales.id, { onDelete: 'cascade' }).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2 }).notNull(),
  discount: numeric('discount', { precision: 12, scale: 2 }).default('0.00').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
  purchasePrice: numeric('purchase_price', { precision: 12, scale: 2 }).notNull(), // historical cost
});

// Returns
export const returns = pgTable('returns', {
  id: serial('id').primaryKey(),
  returnNumber: text('return_number').notNull().unique(),
  originalSaleId: integer('original_sale_id').references(() => sales.id).notNull(),
  customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  returnDate: text('return_date').notNull(),
  totalRefundAmount: numeric('total_refund_amount', { precision: 12, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  createdBy: integer('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Return Items
export const returnItems = pgTable('return_items', {
  id: serial('id').primaryKey(),
  returnId: integer('return_id').references(() => returns.id, { onDelete: 'cascade' }).notNull(),
  saleItemId: integer('sale_item_id').references(() => saleItems.id).notNull(),
  productId: integer('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitRefundPrice: numeric('unit_refund_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2 }).notNull(),
});

// Stock Movements (Stock Ledger)
export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id).notNull(),
  qtyChange: integer('qty_change').notNull(), // e.g. +5 or -2
  prevStock: integer('prev_stock').notNull(),
  newStock: integer('new_stock').notNull(),
  movementType: text('movement_type', {
    enum: ['PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT'],
  }).notNull(),
  referenceId: text('reference_id'),
  userId: integer('user_id').references(() => users.id).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    productMovementIdx: index('stock_movements_product_idx').on(table.productId),
    createdAtIdx: index('stock_movements_created_at_idx').on(table.createdAt),
  };
});

// Relations
export const productsRelations = relations(products, ({ many }) => ({
  stockMovements: many(stockMovements),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, { fields: [sales.customerId], references: [customers.id] }),
  user: one(users, { fields: [sales.createdBy], references: [users.id] }),
  items: many(saleItems),
}));
