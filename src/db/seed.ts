import bcrypt from 'bcryptjs';
import { pgClient } from './index.ts';
import { generateEan13Barcode, sanitizePrefix } from '../utils/barcode.ts';
import { parseBrandPrefix, parseCategoryPrefix, generateSuggestedArticle, generateSku } from '../utils/sku.ts';

export async function initAndSeedDb() {
  console.log('Running PostgreSQL schema migrations and checks...');
  await pgClient.waitReady;

  // Create PostgreSQL tables using DDL with constraints and indexes
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
      low_stock_limit INTEGER NOT NULL DEFAULT 5,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS strn TEXT DEFAULT '';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS tax_id TEXT DEFAULT '';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS currency_name TEXT DEFAULT 'Pakistani Rupee';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS is_installed BOOLEAN DEFAULT false;
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'FIXED';
    ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS pricing_policy_locked BOOLEAN DEFAULT false;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS min_profit_margin;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS max_profit_margin;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS fixed_profit_margin;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS min_profit_amount;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS max_profit_amount;
    ALTER TABLE company_settings DROP COLUMN IF EXISTS fixed_profit_amount;
    UPDATE company_settings SET tax_id = tax_number WHERE (tax_id IS NULL OR tax_id = '') AND (tax_number IS NOT NULL AND tax_number != '');
    UPDATE company_settings SET currency_name = 'Pakistani Rupee' WHERE currency_name IS NULL OR currency_name = '';
    UPDATE company_settings SET barcode_prefix = '0108923' WHERE LENGTH(barcode_prefix) != 7 OR barcode_prefix !~ '^[0-9]{7}$';

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand VARCHAR(100) NOT NULL DEFAULT 'Local',
      category VARCHAR(100) NOT NULL DEFAULT 'Casual Shoes',
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT NOT NULL UNIQUE,
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

    ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100) DEFAULT 'Local';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'Casual Shoes';

    -- Data Migration: Migrate any existing relational brand_id and category_id into plain-text columns
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='brands') THEN
          UPDATE products p 
          SET brand = COALESCE((SELECT b.name FROM brands b WHERE b.id = p.brand_id), 'Local')
          WHERE (p.brand IS NULL OR p.brand = '' OR p.brand = 'Local') AND p.brand_id IS NOT NULL;
        END IF;
        ALTER TABLE products DROP COLUMN IF EXISTS brand_id CASCADE;
      END IF;

      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='categories') THEN
          UPDATE products p 
          SET category = COALESCE((SELECT c.name FROM categories c WHERE c.id = p.category_id), 'Casual Shoes')
          WHERE (p.category IS NULL OR p.category = '' OR p.category = 'Casual Shoes') AND p.category_id IS NOT NULL;
        END IF;
        ALTER TABLE products DROP COLUMN IF EXISTS category_id CASCADE;
      END IF;

      DROP TABLE IF EXISTS brands CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
    END $$;

    CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
    CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
    CREATE INDEX IF NOT EXISTS products_active_idx ON products(active);
    CREATE INDEX IF NOT EXISTS products_brand_idx ON products(brand);
    CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

    -- Clean up legacy variant tables (flat product model: 1 Product = 1 SKU = 1 Barcode)
    DROP TABLE IF EXISTS product_sizes CASCADE;
    DROP TABLE IF EXISTS product_colors CASCADE;

    -- Ensure schema columns exist on existing databases
    ALTER TABLE products ADD COLUMN IF NOT EXISTS article TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS primary_image_url TEXT;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0.00;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS min_price INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN IF NOT EXISTS max_price INTEGER NOT NULL DEFAULT 0;
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='purchase_price') THEN
        UPDATE products SET cost_price = purchase_price WHERE (cost_price IS NULL OR cost_price = 0) AND purchase_price IS NOT NULL;
      END IF;
    END $$;
    ALTER TABLE products DROP COLUMN IF EXISTS purchase_price;
    ALTER TABLE products DROP COLUMN IF EXISTS sale_price;
    ALTER TABLE products DROP COLUMN IF EXISTS min_sale_price;
    ALTER TABLE products DROP COLUMN IF EXISTS max_sale_price;
    ALTER TABLE products DROP COLUMN IF EXISTS margin_type;
    ALTER TABLE products DROP COLUMN IF EXISTS profit_calculation_method;
    ALTER TABLE products DROP COLUMN IF EXISTS profit_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS profit_amount;
    ALTER TABLE products DROP COLUMN IF EXISTS custom_min_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS custom_max_margin;
    ALTER TABLE products DROP COLUMN IF EXISTS size;
    ALTER TABLE products DROP COLUMN IF EXISTS color;

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
      notes TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;

    CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL,
      unit_purchase_price NUMERIC(12, 2) NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL
    );

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
  `);

  // 1. Seed Company Settings
  const settingsCount = await pgClient.query<{ count: string }>('SELECT COUNT(*) as count FROM company_settings');
  if (parseInt(settingsCount.rows[0].count) === 0) {
    await pgClient.query(`
      INSERT INTO company_settings (
        name, logo, address, phone, email, website, tax_number, 
        currency, currency_symbol, invoice_prefix, purchase_prefix, 
        barcode_prefix, invoice_footer, low_stock_limit, is_installed
      ) VALUES (
        'Shoe Shop & Footwear Co.',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=160&auto=format&fit=crop&q=80',
        'Shop #14, Royal Commercial Plaza, Saddar',
        '+92-300-5551234',
        'sales@shoepos.com',
        'www.shoepos.com',
        'STRN-9876543-2',
        'PKR',
        'Rs.',
        'INV-',
        'PUR-',
        '0108923',
        'Exchanges accepted within 7 days with original receipt. Thank you for shopping with us!',
        5,
        true
      );
    `);
    console.log('Company settings initialized.');
  }

  // 2. Seed Users
  const userCount = await pgClient.query<{ count: string }>('SELECT COUNT(*) as count FROM users');
  if (parseInt(userCount.rows[0].count) === 0) {
    const adminPassHash = await bcrypt.hash('admin123', 10);
    const cashierPassHash = await bcrypt.hash('cashier123', 10);

    await pgClient.query(`
      INSERT INTO users (name, email, password_hash, role, status) VALUES
      ('Shoe Shop Owner', 'admin@shoepos.com', $1, 'ADMIN', 'APPROVED'),
      ('Counter Cashier Ali', 'cashier@shoepos.com', $2, 'CASHIER', 'APPROVED'),
      ('Trainee Bilal', 'trainee@shoepos.com', $2, 'CASHIER', 'PENDING');
    `, [adminPassHash, cashierPassHash]);
    console.log('Default users seeded: admin@shoepos.com / admin123 and cashier@shoepos.com / cashier123');
  }

  // 3. (Brands & categories tables removed - plain text fields on products)

  // 3b. Seed Suppliers
  const supplierCount = await pgClient.query<{ count: string }>('SELECT COUNT(*) as count FROM suppliers');
  if (parseInt(supplierCount.rows[0].count) === 0) {
    await pgClient.query(`
      INSERT INTO suppliers (name, phone, email) VALUES 
      ('Nike Wholesale Pakistan', '+92-300-1122334', 'wholesale@nike.pk'),
      ('Metro Footwear Importers', '+92-321-4455667', 'orders@metrofootwear.pk'),
      ('Bata Pakistan Commercial Supply', '+92-333-7788990', 'commercial@bata.com.pk'),
      ('Puma & Sports Footwear Hub', '+92-311-9988776', 'supply@pumasports.pk');
    `);
    console.log('Default suppliers seeded.');
  }

  // 5. Seed Sample Customers
  const custCount = await pgClient.query<{ count: string }>('SELECT COUNT(*) as count FROM customers');
  if (parseInt(custCount.rows[0].count) === 0) {
    await pgClient.query(`
      INSERT INTO customers (name, phone, email, address, notes) VALUES
      ('Walk-in Customer', '03000000000', 'walkin@store.local', 'Counter Sale', 'Regular shop walk-in sales'),
      ('Muhammad Usman', '03214567890', 'usman@gmail.com', 'House 42, Street 7, Clifton', 'Prefers size 42 formal oxfords'),
      ('Fatima Zahra', '03339876543', 'fatima.z@hotmail.com', 'Flat 3B, Falcon Heights', 'VIP member discount eligible');
    `);
    console.log('Sample customers seeded.');
  }

  // 7. Seed Initial Products with plain text brand and category
  const prodCount = await pgClient.query<{ count: string }>('SELECT COUNT(*) as count FROM products');
  if (parseInt(prodCount.rows[0].count) === 0) {
    const adminUser = await pgClient.query<{ id: number }>('SELECT id FROM users WHERE role = $1 LIMIT 1', ['ADMIN']);
    const adminId = adminUser.rows[0]?.id || 1;

    const p1 = await pgClient.query<{ id: number }>(`
      INSERT INTO products (
        name, brand, category, article, sku, barcode, primary_image_url, 
        description, cost_price, selling_price, min_price, max_price, total_stock, low_stock_limit, active
      ) VALUES (
        'Air Zoom Velocity Runner',
        'Nike', 'Casual Shoes', 'SP-0001', 'NIK-SP-0001-1', '01089230001',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80',
        'Breathable mesh running shoes with responsive Zoom air cushioning sole.',
        4200.00, 5500, 5500, 5500, 18, 5, true
      ) RETURNING id;
    `);

    const p1Id = p1.rows[0].id;

    // Stock movement for p1
    await pgClient.query(`
      INSERT INTO stock_movements (product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes)
      VALUES ($1, 18, 0, 18, 'PURCHASE', 'PUR-INITIAL', $2, 'Initial inventory opening balance');
    `, [p1Id, adminId]);

    // Product 2: Formal Oxford
    const p2 = await pgClient.query<{ id: number }>(`
      INSERT INTO products (
        name, brand, category, article, sku, barcode, primary_image_url, 
        description, cost_price, selling_price, min_price, max_price, total_stock, low_stock_limit, active
      ) VALUES (
        'Classic Derby Leather Oxford',
        'Clarks', 'Formal Dress Shoes', 'FO-0002', 'CLA-FO-0002-2', '01089230002',
        '',
        'Handcrafted genuine full-grain leather dress shoes with Goodyear welted leather sole.',
        5500.00, 7200, 7200, 7200, 12, 4, true
      ) RETURNING id;
    `);
    const p2Id = p2.rows[0].id;

    await pgClient.query(`
      INSERT INTO stock_movements (product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes)
      VALUES ($1, 12, 0, 12, 'PURCHASE', 'PUR-INITIAL', $2, 'Initial inventory opening balance');
    `, [p2Id, adminId]);

    // Product 3: Casual White Sneaker
    const p3 = await pgClient.query<{ id: number }>(`
      INSERT INTO products (
        name, brand, category, article, sku, barcode, primary_image_url, 
        description, cost_price, selling_price, min_price, max_price, total_stock, low_stock_limit, active
      ) VALUES (
        'Cloudfoam Lifestyle Retro Sneaker',
        'Adidas', 'Casual Shoes', 'CA-0003', 'ADI-CA-0003-3', '01089230003',
        'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&auto=format&fit=crop&q=80',
        'Minimalist everyday sneakers with cushioned Cloudfoam sockliner for all-day comfort.',
        3100.00, 4000, 4000, 4000, 24, 6, true
      ) RETURNING id;
    `);
    const p3Id = p3.rows[0].id;

    await pgClient.query(`
      INSERT INTO stock_movements (product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes)
      VALUES ($1, 24, 0, 24, 'PURCHASE', 'PUR-INITIAL', $2, 'Initial inventory opening balance');
    `, [p3Id, adminId]);

    // Product 4: Low stock product to showcase alerts
    const p4 = await pgClient.query<{ id: number }>(`
      INSERT INTO products (
        name, brand, category, article, sku, barcode, primary_image_url, 
        description, cost_price, selling_price, min_price, max_price, total_stock, low_stock_limit, active
      ) VALUES (
        'Bata Power Pro Court Trainer',
        'Bata', 'Casual Shoes', 'SP-0004', 'BAT-SP-0004-4', '01089230004',
        'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600&auto=format&fit=crop&q=80',
        'Durable court trainers with non-marking rubber outsole.',
        2200.00, 2900, 2900, 2900, 3, 5, true
      ) RETURNING id;
    `);
    const p4Id = p4.rows[0].id;

    await pgClient.query(`
      INSERT INTO stock_movements (product_id, qty_change, prev_stock, new_stock, movement_type, reference_id, user_id, notes)
      VALUES ($1, 3, 0, 3, 'PURCHASE', 'PUR-INITIAL', $2, 'Initial low-stock test inventory');
    `, [p4Id, adminId]);

    console.log('Sample shoe products seeded successfully.');
  }

  // 8. Migration: Enforce standard 13-digit EAN-13 Modulo-10 Barcodes across all products
  try {
    const sRes = await pgClient.query<{ barcode_prefix: string }>('SELECT barcode_prefix FROM company_settings LIMIT 1');
    const rawPrefix = sRes.rows[0]?.barcode_prefix;
    const prefix = sanitizePrefix(rawPrefix, '0108923');

    const allProds = await pgClient.query<{ id: number; barcode: string }>('SELECT id, barcode FROM products ORDER BY id ASC');
    for (const prod of allProds.rows) {
      if (prod.id <= 99999) {
        const ean = generateEan13Barcode(prefix, prod.id);
        if (prod.barcode !== ean.barcode) {
          await pgClient.query('UPDATE products SET barcode = $1 WHERE id = $2', [ean.barcode, prod.id]);
        }
      }
    }
    console.log('13-digit standard EAN-13 barcodes synchronized for all products.');
  } catch (migErr) {
    console.warn('EAN-13 barcode migration note:', migErr);
  }

  // 9. Synchronize PostgreSQL sequence & SKUs with [Brand Prefix]-[Article]-[Product ID] formula
  try {
    await pgClient.query(`
      SELECT setval('products_id_seq', (SELECT GREATEST(COALESCE(MAX(id), 0), 1) FROM products));
    `);

    const prodsRes = await pgClient.query<{ id: number; name: string; brand: string | null; category: string | null; sku: string; article: string | null }>(`
      SELECT p.id, p.name, p.brand, p.category, p.sku, p.article
      FROM products p
      ORDER BY p.id ASC
    `);

    for (const prod of prodsRes.rows) {
      const brandPrefix = parseBrandPrefix(prod.brand);
      const catPrefix = parseCategoryPrefix(prod.category);
      let article = prod.article && prod.article.trim()
        ? prod.article.trim().toUpperCase()
        : '';
      if (!article || /^[A-Z0-9]{3}\d{4,}$/.test(article) || !article.includes('-')) {
        article = generateSuggestedArticle(catPrefix, prod.id);
      }
      const expectedSku = generateSku(brandPrefix, article, prod.id);

      if (!prod.article || prod.article !== article || prod.sku !== expectedSku) {
        await pgClient.query('UPDATE products SET article = $1, sku = $2 WHERE id = $3', [
          article,
          expectedSku,
          prod.id,
        ]);
      }
    }
    console.log('Product SKUs and Articles synchronized with [Brand Prefix]-[Article]-[Product ID] formula.');
  } catch (skuMigErr) {
    console.warn('SKU synchronization note:', skuMigErr);
  }

  console.log('PostgreSQL database initialization and seeding completed.');
}
