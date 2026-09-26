import { Router } from 'express';
import type { Response } from 'express';
import { pgClient } from '../../db/index.ts';
import { requireAuth } from '../auth.ts';

const router = Router();
export const brandsRouter = Router();
export const categoriesRouter = Router();

// Handlers for Brands: dynamically retrieved from distinct values in products table
const listBrandsHandler = async (_req: any, res: Response) => {
  try {
    const result = await pgClient.query(`
      SELECT p.brand as name,
             COUNT(p.id)::int as product_count,
             COALESCE(SUM(p.total_stock), 0)::int as total_units
      FROM products p
      WHERE p.brand IS NOT NULL AND TRIM(p.brand) != ''
      GROUP BY p.brand
      ORDER BY p.brand ASC
    `);

    let brands = result.rows.map((r: any, idx: number) => ({
      id: idx + 1,
      name: r.name,
      logo: '',
      product_count: r.product_count,
      total_units: r.total_units,
    }));

    // Ensure 'Local' is always available as a suggestion
    if (!brands.some((b: any) => b.name.toLowerCase() === 'local')) {
      brands = [{ id: 0, name: 'Local', logo: '', product_count: 0, total_units: 0 }, ...brands];
    }

    res.json({ brands });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch brands: ' + err.message });
  }
};

const createBrandHandler = async (req: any, res: Response) => {
  const { name } = req.body || {};
  const brandName = (name || '').trim();
  res.status(200).json({
    brand: { id: 1, name: brandName || 'Local' },
    message: 'Brand noted as plain text string.',
  });
};

const updateBrandHandler = async (req: any, res: Response) => {
  const { name } = req.body || {};
  res.json({ brand: { id: 1, name: name || 'Local' }, message: 'Brand updated.' });
};

const deleteBrandHandler = async (_req: any, res: Response) => {
  res.json({ message: 'Brand removed.' });
};

// Handlers for Categories: dynamically retrieved from distinct values in products table
const listCategoriesHandler = async (_req: any, res: Response) => {
  try {
    const result = await pgClient.query(`
      SELECT p.category as name,
             COUNT(p.id)::int as product_count,
             COALESCE(SUM(p.total_stock), 0)::int as total_units
      FROM products p
      WHERE p.category IS NOT NULL AND TRIM(p.category) != ''
      GROUP BY p.category
      ORDER BY p.category ASC
    `);

    let categories = result.rows.map((r: any, idx: number) => ({
      id: idx + 1,
      name: r.name,
      product_count: r.product_count,
      total_units: r.total_units,
    }));

    // Sane default categories if database catalog is fresh
    const defaultCategories = ['Casual Shoes', 'Sports Shoes', 'Formal Shoes', 'Sandals & Chappals', 'Sneakers'];
    for (const def of defaultCategories) {
      if (!categories.some((c: any) => c.name.toLowerCase() === def.toLowerCase())) {
        categories.push({
          id: categories.length + 1,
          name: def,
          product_count: 0,
          total_units: 0,
        });
      }
    }

    res.json({ categories });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch categories: ' + err.message });
  }
};

const createCategoryHandler = async (req: any, res: Response) => {
  const { name } = req.body || {};
  const catName = (name || '').trim();
  res.status(200).json({
    category: { id: 1, name: catName || 'Casual Shoes' },
    message: 'Category noted as plain text string.',
  });
};

const updateCategoryHandler = async (req: any, res: Response) => {
  const { name } = req.body || {};
  res.json({ category: { id: 1, name: name || 'Casual Shoes' }, message: 'Category updated.' });
};

const deleteCategoryHandler = async (_req: any, res: Response) => {
  res.json({ message: 'Category removed.' });
};

// Mount routes
router.get('/brands', requireAuth, listBrandsHandler);
router.post('/brands', requireAuth, createBrandHandler);
router.put('/brands/:id', requireAuth, updateBrandHandler);
router.delete('/brands/:id', requireAuth, deleteBrandHandler);

router.get('/categories', requireAuth, listCategoriesHandler);
router.post('/categories', requireAuth, createCategoryHandler);
router.put('/categories/:id', requireAuth, updateCategoryHandler);
router.delete('/categories/:id', requireAuth, deleteCategoryHandler);

brandsRouter.get('/', requireAuth, listBrandsHandler);
brandsRouter.get('/brands', requireAuth, listBrandsHandler);
brandsRouter.post('/', requireAuth, createBrandHandler);
brandsRouter.post('/brands', requireAuth, createBrandHandler);
brandsRouter.put('/:id', requireAuth, updateBrandHandler);
brandsRouter.delete('/:id', requireAuth, deleteBrandHandler);

categoriesRouter.get('/', requireAuth, listCategoriesHandler);
categoriesRouter.get('/categories', requireAuth, listCategoriesHandler);
categoriesRouter.post('/', requireAuth, createCategoryHandler);
categoriesRouter.post('/categories', requireAuth, createCategoryHandler);
categoriesRouter.put('/:id', requireAuth, updateCategoryHandler);
categoriesRouter.delete('/:id', requireAuth, deleteCategoryHandler);

export default router;
