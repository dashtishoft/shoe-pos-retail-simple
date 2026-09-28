import { pgClient } from './index.ts';

/**
 * Ensures that all database tables, columns, constraints, and indexes exist.
 * This is 100% idempotent and DOES NOT seed any dummy users or fake demo products.
 */
export async function ensureDatabaseSchema(): Promise<void> {
  await pgClient.waitReady;

  await pgClient.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CASHIER',
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS company_settings (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Your Shoe Store',
      logo TEXT DEFAULT '',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      website TEXT DEFAULT '',
      strn TEXT DEFAULT '',
      tax_id TEXT DEFAULT '',
      tax_number TEXT DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'PKR',
      currency_name TEXT NOT NULL DEFAULT 'Pakistani Rupee',
      currency_symbol TEXT NOT NULL DEFAULT 'Rs.',
      invoice_prefix TEXT NOT NULL DEFAULT 'INV-',
      purchase_prefix TEXT NOT NULL DEFAULT 'PUR-',
      barcode_prefix TEXT NOT NULL DEFAULT '0108923',
      invoice_footer TEXT NOT NULL DEFAULT 'Thank you for shopping with us!',
      show_receipt_logo BOOLEAN NOT NULL DEFAULT false,
      receipt_logo TEXT DEFAULT '',
      low_stock_limit INTEGER NOT NULL DEFAULT 5,
      pricing_mode TEXT NOT NULL DEFAULT 'FIXED',
      pricing_policy_locked BOOLEAN NOT NULL DEFAULT false,
      is_installed BOOLEAN DEFAULT false,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS strn TEXT DEFAULT '';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS tax_id TEXT DEFAULT '';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS currency_name TEXT DEFAULT 'Pakistani Rupee';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS is_installed BOOLEAN DEFAULT false;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'FIXED';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_policy_locked BOOLEAN DEFAULT false;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS show_receipt_logo BOOLEAN DEFAULT false;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS receipt_logo TEXT DEFAULT '';

    -- Lock pricing_policy if the store is already installed
    UPDATE company_settings SET pricing_policy_locked = true WHERE is_installed = true;

    -- Permanently remove redundant margin calculation columns from company_settings
    ALTER TABLE company_settings DROP COLUMN IF EXISTS fixed_profit_margin;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS fixed_profit_amount;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS min_profit_margin;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS min_profit_amount;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS max_profit_margin;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS max_profit_amount;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS default_profit_margin;

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand VARCHAR(100) NOT NULL DEFAULT 'Local',
      category VARCHAR(100) NOT NULL DEFAULT 'Casual Shoes',
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT NOT NULL UNIQUE,
      article TEXT DEFAULT '',
      primary_image_url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      selling_price INTEGER NOT NULL DEFAULT 0,
      min_price INTEGER NOT NULL DEFAULT 0,
      max_price INTEGER NOT NULL DEFAULT 0,
      total_stock INTEGER NOT NULL DEFAULT 0,
      low_stock_limit INTEGER NOT NULL DEFAULT 5,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Ensure brand and category text columns exist on products
    ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100) DEFAULT 'Local';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Casual Shoes';

    -- Data Migration: Migrate any existing relational brand_id and category_id into plain-text columns
    DO $$
    BEGIN
      -- Migrate brand from brands table if brand_id column exists
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='brands') THEN
          UPDATE products p 
          SET brand = COALESCE((SELECT b.name FROM brands b WHERE b.id = p.brand_id), 'Local')
          WHERE (p.brand IS NULL OR p.brand = '' OR p.brand = 'Local') AND p.brand_id IS NOT NULL;
        END IF;
        ALTER TABLE products DROP COLUMN IF EXISTS brand_id CASCADE;
      END IF;

      -- Migrate category from categories table if category_id column exists
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='categories') THEN
          UPDATE products p 
          SET category = COALESCE((SELECT c.name FROM categories c WHERE c.id = p.category_id), 'Casual Shoes')
          WHERE (p.category IS NULL OR p.category = '' OR p.category = 'Casual Shoes') AND p.category_id IS NOT NULL;
        END IF;
        ALTER TABLE products DROP COLUMN IF EXISTS category_id CASCADE;
      END IF;

      -- Set sane defaults for any null or empty strings
      UPDATE products SET brand = 'Local' WHERE brand IS NULL OR TRIM(brand) = '';
      UPDATE products SET category = 'Casual Shoes' WHERE category IS NULL OR TRIM(category) = '';

      -- Completely remove legacy brands and categories tables
      DROP TABLE IF EXISTS brands CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
    END $$;

    CREATE INDEX IF NOT EXISTS products_brand_idx ON products(brand);
    CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

    ALTER TABLE products ADD COLUMN IF NOT EXISTS article TEXT DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_image_url TEXT DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0.00;
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='purchase_price') THEN
        UPDATE products SET cost_price = purchase_price WHERE (cost_price IS NULL OR cost_price = 0) AND purchase_price IS NOT NULL;
      END IF;
    END $$;
    ALTER TABLE products DROP COLUMN IF EXISTS purchase_price;

    ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price INTEGER DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS max_price INTEGER DEFAULT 0;

    -- Data Migration: Migrate legacy sale_price, min_sale_price, max_sale_price into selling_price, min_price, max_price
    DO $$
    DECLARE
      v_pricing_mode TEXT;
    BEGIN
      SELECT COALESCE(pricing_mode, 'FIXED')
      INTO v_pricing_mode
      FROM company_settings
      LIMIT 1;

      IF v_pricing_mode IS NULL THEN v_pricing_mode := 'FIXED'; END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price') THEN
        UPDATE products
        SET
          selling_price = COALESCE(NULLIF(selling_price, 0), sale_price, max_sale_price, min_sale_price, ROUND(cost_price)::INTEGER, 0),
          min_price = COALESCE(NULLIF(min_price, 0), min_sale_price, sale_price, ROUND(cost_price)::INTEGER, 0),
          max_price = COALESCE(NULLIF(max_price, 0), max_sale_price, sale_price, min_sale_price, ROUND(cost_price)::INTEGER, 0);
      END IF;

      -- Ensure FIXED policy rule: selling_price = min_price = max_price when store is FIXED
      IF UPPER(v_pricing_mode) = 'FIXED' THEN
        UPDATE products
        SET
          selling_price = GREATEST(COALESCE(NULLIF(selling_price, 0), max_price, min_price, ROUND(cost_price)::INTEGER, 0), ROUND(cost_price)::INTEGER),
          min_price = GREATEST(COALESCE(NULLIF(selling_price, 0), max_price, min_price, ROUND(cost_price)::INTEGER, 0), ROUND(cost_price)::INTEGER),
          max_price = GREATEST(COALESCE(NULLIF(selling_price, 0), max_price, min_price, ROUND(cost_price)::INTEGER, 0), ROUND(cost_price)::INTEGER);
      ELSE
        UPDATE products
        SET
          min_price = GREATEST(COALESCE(NULLIF(min_price, 0), selling_price, ROUND(cost_price)::INTEGER, 0), ROUND(cost_price)::INTEGER),
          max_price = GREATEST(COALESCE(NULLIF(max_price, 0), selling_price, min_price, ROUND(cost_price)::INTEGER, 0), COALESCE(NULLIF(min_price, 0), ROUND(cost_price)::INTEGER, 0)),
          selling_price = GREATEST(COALESCE(NULLIF(max_price, 0), selling_price, min_price, ROUND(cost_price)::INTEGER, 0), COALESCE(NULLIF(min_price, 0), ROUND(cost_price)::INTEGER, 0));
      END IF;
    END $$;

    -- Permanently drop all legacy margin and old price columns from products
    ALTER TABLE products DROP COLUMN IF EXISTS margin_type;
    ALTER TABLE products DROP COLUMN IF EXISTS profit_calculation_method;
    ALTER TABLE products DROP COLUMN IF EXISTS profit_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS profit_amount;
    ALTER TABLE products DROP COLUMN IF EXISTS custom_min_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS custom_max_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS max_profit_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS min_profit_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS fixed_amount_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS sale_price;
    ALTER TABLE products DROP COLUMN IF EXISTS min_sale_price;
    ALTER TABLE products DROP COLUMN IF EXISTS max_sale_price;
    ALTER TABLE products DROP COLUMN IF EXISTS size;
    ALTER TABLE products DROP COLUMN IF EXISTS color;
    DROP TABLE IF EXISTS product_sizes CASCADE;
    DROP TABLE IF EXISTS product_colors CASCADE;

    CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
    CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
    CREATE INDEX IF NOT EXISTS products_article_idx ON products(article);
    CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);

    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      balance NUMERIC(12, 2) DEFAULT 0.00,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) DEFAULT 0.00;
    ALTER TABLE suppliers DROP COLUMN IF EXISTS address;
    ALTER TABLE suppliers DROP COLUMN IF EXISTS url;
    ALTER TABLE suppliers DROP COLUMN IF EXISTS notes;

    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      purchase_number TEXT NOT NULL UNIQUE,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      supplier_name TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      total_amount NUMERIC(12, 2) NOT NULL,
      paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      payment_status TEXT NOT NULL DEFAULT 'UNPAID',
      payment_method TEXT DEFAULT 'CASH',
      notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID';
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'CASH';

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id SERIAL PRIMARY KEY,
      payment_number TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      supplier_name TEXT NOT NULL,
      purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
      amount NUMERIC(12, 2) NOT NULL,
      payment_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      reference_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS supplier_payments_supplier_idx ON supplier_payments(supplier_id);
    CREATE INDEX IF NOT EXISTS supplier_payments_date_idx ON supplier_payments(payment_date);
    CREATE INDEX IF NOT EXISTS supplier_payments_number_idx ON supplier_payments(payment_number);

    CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_purchase_price NUMERIC(12, 2) NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_returns (
      id SERIAL PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      supplier_name TEXT NOT NULL,
      return_date TEXT NOT NULL,
      total_debit_amount NUMERIC(12, 2) NOT NULL,
      reason TEXT NOT NULL,
      notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS purchase_returns_number_idx ON purchase_returns(return_number);
    CREATE INDEX IF NOT EXISTS purchase_returns_supplier_idx ON purchase_returns(supplier_id);

    CREATE TABLE IF NOT EXISTS purchase_return_items (
      id SERIAL PRIMARY KEY,
      purchase_return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_purchase_price NUMERIC(12, 2) NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL,
      defect_type TEXT DEFAULT 'MANUFACTURING_DEFECT'
    );
    ALTER TABLE purchase_return_items
      DROP COLUMN IF EXISTS carton_quantity,
      DROP COLUMN IF EXISTS pairs_per_carton;
    CREATE INDEX IF NOT EXISTS purchase_return_items_return_idx ON purchase_return_items(purchase_return_id);
    CREATE INDEX IF NOT EXISTS purchase_return_items_product_idx ON purchase_return_items(product_id);

    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      sale_date TEXT NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL,
      discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      total_amount NUMERIC(12, 2) NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'CASH',
      cash_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      change_given NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      created_by INTEGER NOT NULL REFERENCES users(id),
      is_min_price_overridden BOOLEAN NOT NULL DEFAULT false,
      overridden_by INTEGER REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS sales_invoice_idx ON sales(invoice_number);

    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12, 2) NOT NULL,
      discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      subtotal NUMERIC(12, 2) NOT NULL,
      purchase_price NUMERIC(12, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
      id SERIAL PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      original_sale_id INTEGER NOT NULL REFERENCES sales(id),
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      return_date TEXT NOT NULL,
      total_refund_amount NUMERIC(12, 2) NOT NULL,
      reason TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id SERIAL PRIMARY KEY,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_refund_price NUMERIC(12, 2) NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id SERIAL PRIMARY KEY,
      product_id INTEGER NOT NULL REFERENCES products(id),
      qty_change INTEGER NOT NULL,
      prev_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      reference_id TEXT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      notes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS stock_movements_created_at_idx ON stock_movements(created_at);

    -- Permanently remove obsolete carton_packs table if present
    DROP TABLE IF EXISTS carton_packs CASCADE;
  `);
}

/**
 * Drops all tables and relations in the public database schema with CASCADE.
 * Guarantees that reinstallation performs a complete DROP TABLE instead of merely
 * deleting row entries, giving a 100% fresh, clean database state.
 */
export async function dropAllTables(): Promise<void> {
  await pgClient.waitReady;

  // 1. Explicitly drop all known application tables with CASCADE
  await pgClient.exec(`
    DROP TABLE IF EXISTS 
      password_reset_tokens,
      stock_movements,
      return_items,
      returns,
      sale_items,
      sales,
      purchase_return_items,
      purchase_returns,
      supplier_payments,
      purchase_items,
      purchases,
      products,
      customers,
      suppliers,
      categories,
      brands,
      api_tokens,
      company_settings,
      users
    CASCADE;
  `);

  // 2. Query for any remaining base tables in the public schema and drop them dynamically
  try {
    const remainingTables = await pgClient.query<{ tablename: string }>(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    for (const row of remainingTables.rows) {
      await pgClient.exec(`DROP TABLE IF EXISTS "${row.tablename}" CASCADE;`);
    }
  } catch (err: any) {
    console.warn('Notice during dynamic table drop:', err.message);
  }

  console.log('🗑️ All database tables successfully dropped with CASCADE.');
}

