// Centralized API Service for Shoe Shop POS + Inventory System

const BASE_URL = '/api';

export function getAuthToken(): string | null {
  return localStorage.getItem('pos_auth_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('pos_auth_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('pos_auth_token');
}

// In-flight request deduplication map for idempotent GET operations
const inFlightGetRequests = new Map<string, Promise<any>>();

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isGet = method === 'GET';

  // If this is a GET request and an identical request is already in-flight, return the existing promise
  if (isGet && inFlightGetRequests.has(endpoint)) {
    return inFlightGetRequests.get(endpoint) as Promise<T>;
  }

  const executeRequest = async (): Promise<T> => {
    const token = getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let data: any = {};
    const text = await response.text().catch(() => '');
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text.length > 200 ? text.slice(0, 200) : text };
      }
    }

    if (!response.ok) {
      const errorMsg = data.error || data.message || `Server Error (${response.status})`;

      // Automatically clean up stale or expired tokens on 401 unauthorized
      if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
        removeAuthToken();
        try {
          localStorage.removeItem('pos_current_user');
        } catch {}
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('auth:session-expired', {
              detail: { message: errorMsg },
            })
          );
        }
      }

      throw new Error(errorMsg);
    }

    return data as T;
  };

  if (isGet) {
    const promise = executeRequest();
    inFlightGetRequests.set(endpoint, promise);
    try {
      return await promise;
    } finally {
      inFlightGetRequests.delete(endpoint);
    }
  }

  return executeRequest();
}

export const api = {
  // System Health & Connection Verification
  health: () =>
    request<{
      status: string;
      service?: string;
      database?: string;
      dbConnected?: boolean;
      isInstalled?: boolean;
      timestamp?: string;
    }>('/health'),

  // Auth
  auth: {
    login: (body: any) => request<any>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body: any) => request<any>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request<any>('/auth/me'),
    updateProfile: (body: { name: string; phone?: string; avatarUrl?: string }) =>
      request<{ message: string; user: any; token: string }>('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    forgotPassword: (body: any) => request<any>('/auth/forgot-password', { method: 'POST', body: JSON.stringify(body) }),
    resetPassword: (body: any) => request<any>('/auth/reset-password', { method: 'POST', body: JSON.stringify(body) }),
  },

  // Products
  products: {
    list: (params?: { search?: string; brand?: string; category?: string; brandId?: any; categoryId?: any; lowStockOnly?: boolean; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.brand) q.set('brand', params.brand);
      else if (params?.brandId) q.set('brand', String(params.brandId));
      if (params?.category) q.set('category', params.category);
      else if (params?.categoryId) q.set('category', String(params.categoryId));
      if (params?.lowStockOnly) q.set('lowStockOnly', 'true');
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ products: any[] }>(`/products?${q.toString()}`);
    },
    get: (id: number) => request<{ product: any }>(`/products/${id}`),
    lookupBarcode: (barcode: string) => request<{ product: any }>(`/products/lookup/${encodeURIComponent(barcode)}`),
    validateBarcode: (barcode: string, excludeId?: number) => {
      const q = new URLSearchParams();
      q.set('barcode', barcode);
      if (excludeId !== undefined) q.set('excludeId', String(excludeId));
      return request<{
        valid: boolean;
        isDuplicate?: boolean;
        standard?: string;
        standardLabel?: string;
        expectedCheckDigit?: number;
        actualCheckDigit?: number;
        suggestedFix?: string;
        existingProduct?: any;
        error?: string;
        message?: string;
      }>(`/products/validate-barcode?${q.toString()}`);
    },
    create: (body: any) => request<any>('/products', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<any>(`/products/${id}`, { method: 'DELETE' }),
    generateBarcode: (productId?: number | string, colorId?: number | string) => {
      const q = new URLSearchParams();
      if (productId !== undefined) q.set('productId', String(productId));
      if (colorId !== undefined) q.set('colorId', String(colorId));
      const query = q.toString() ? `?${q.toString()}` : '';
      return request<{
        barcode: string;
        prefix: string;
        paddedProductId: string;
        paddedColorId: string;
        checkDigit: number;
        formula: string;
      }>(`/products/generate-barcode${query}`);
    },
    getNextId: () => request<{ nextProductId: number }>('/products/next-id'),
    suggestSku: (params?: { brand?: string; category?: string; brandId?: any; brandName?: string; categoryId?: any; categoryName?: string; article?: string; productId?: number }) => {
      const q = new URLSearchParams();
      const b = params?.brand || params?.brandName || (params?.brandId ? String(params.brandId) : '');
      const c = params?.category || params?.categoryName || (params?.categoryId ? String(params.categoryId) : '');
      if (b) q.set('brand', b);
      if (c) q.set('category', c);
      if (params?.article !== undefined) q.set('article', params.article);
      if (params?.productId !== undefined) q.set('productId', String(params.productId));
      const query = q.toString() ? `?${q.toString()}` : '';
      return request<{
        brandPrefix: string;
        article: string;
        productId: number;
        sku: string;
        formula: string;
      }>(`/products/suggest-sku${query}`);
    },
    aiSuggest: (image: string) =>
      request<{ success: boolean; suggestion: any }>('/products/ai-suggest', {
        method: 'POST',
        body: JSON.stringify({ image }),
      }),
  },

  // POS
  pos: {
    checkout: (body: any) => request<any>('/pos/checkout', { method: 'POST', body: JSON.stringify(body) }),
    getCartonPacks: () => request<{ cartonPacks: any[] }>('/pos/carton-packs'),
    listSales: (params?: { search?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ sales: any[] }>(`/pos/sales?${q.toString()}`);
    },
    getSale: (id: number) => request<any>(`/pos/sales/${id}`),
  },

  cartonPacks: {
    list: () => request<{ cartonPacks: any[] }>('/pos/carton-packs'),
  },

  // Purchases
  purchases: {
    list: (params?: { search?: string }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      return request<{ purchases: any[] }>(`/purchases?${q.toString()}`);
    },
    get: (id: number) => request<any>(`/purchases/${id}`),
    create: (body: any) => request<any>('/purchases', { method: 'POST', body: JSON.stringify(body) }),
  },

  // Purchase Returns (Supplier Debit Notes)
  purchaseReturns: {
    verifyPurchase: (purchaseNumber: string) =>
      request<any>(`/purchase-returns/verify-purchase/${encodeURIComponent(purchaseNumber)}`),
    create: (body: any) => request<any>('/purchase-returns', { method: 'POST', body: JSON.stringify(body) }),
    list: (params?: { search?: string; supplierId?: number }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      if (params?.supplierId) q.set('supplierId', String(params.supplierId));
      const queryString = q.toString() ? `?${q.toString()}` : '';
      return request<{ returns: any[] }>(`/purchase-returns${queryString}`);
    },
    get: (id: number) => request<any>(`/purchase-returns/${id}`),
  },

  // Returns
  returns: {
    verifyInvoice: (invoiceNumber: string) =>
      request<any>(`/returns/verify-invoice/${encodeURIComponent(invoiceNumber)}`),
    create: (body: any) => request<any>('/returns', { method: 'POST', body: JSON.stringify(body) }),
    list: (params?: { search?: string }) => {
      const q = new URLSearchParams();
      if (params?.search) q.set('search', params.search);
      return request<{ returns: any[] }>(`/returns?${q.toString()}`);
    },
    get: (id: number) => request<any>(`/returns/${id}`),
  },

  // Customers
  customers: {
    list: (search?: string) => {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return request<{ customers: any[] }>(`/customers${q}`);
    },
    get: (id: number) => request<any>(`/customers/${id}`),
    create: (body: any) => request<any>('/customers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<any>(`/customers/${id}`, { method: 'DELETE' }),
  },

  // Suppliers
  suppliers: {
    list: (search?: string) => {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return request<{ suppliers: any[] }>(`/suppliers${q}`);
    },
    get: (id: number) => request<any>(`/suppliers/${id}`),
    create: (body: any) => request<any>('/suppliers', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: number, body: any) => request<any>(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: number) => request<any>(`/suppliers/${id}`, { method: 'DELETE' }),
    recordPayment: (
      supplierId: number,
      body: {
        amount: number;
        paymentDate?: string;
        paymentMethod: string;
        referenceNumber?: string;
        notes?: string;
        purchaseId?: number;
      }
    ) =>
      request<{ message: string; payment: any }>(`/suppliers/${supplierId}/payments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getLedger: (supplierId: number) =>
      request<{
        supplier: any;
        summary: {
          totalPurchasesCount: number;
          totalReturnsCount: number;
          totalPaymentsCount: number;
          totalPurchased: number;
          totalDebitReturned: number;
          totalPaymentsPaid: number;
          totalDebited: number;
          netBalance: number;
        };
        transactions: any[];
      }>(`/suppliers/${supplierId}/ledger`),
    deletePayment: (paymentId: number) =>
      request<any>(`/suppliers/payments/${paymentId}`, { method: 'DELETE' }),
  },

  // Inventory
  inventory: {
    ledger: (params?: { productId?: number; movementType?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.productId) q.set('productId', String(params.productId));
      if (params?.movementType) q.set('movementType', params.movementType);
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ movements: any[] }>(`/inventory/ledger?${q.toString()}`);
    },
    adjust: (body: any) => request<any>('/inventory/adjust', { method: 'POST', body: JSON.stringify(body) }),
  },

  // Brands & Categories
  brandCategory: {
    getBrands: () => request<{ brands: any[] }>('/brands-categories/brands'),
    createBrand: (name: string, logo?: string) =>
      request<any>('/brands-categories/brands', { method: 'POST', body: JSON.stringify({ name, logo }) }),
    updateBrand: (id: number, name: string, logo?: string) =>
      request<any>(`/brands-categories/brands/${id}`, { method: 'PUT', body: JSON.stringify({ name, logo }) }),
    deleteBrand: (id: number) => request<any>(`/brands-categories/brands/${id}`, { method: 'DELETE' }),

    getCategories: () => request<{ categories: any[] }>('/brands-categories/categories'),
    createCategory: (name: string, lowStockLimit?: number | null) =>
      request<any>('/brands-categories/categories', {
        method: 'POST',
        body: JSON.stringify({ name, low_stock_limit: lowStockLimit }),
      }),
    updateCategory: (id: number, name: string, lowStockLimit?: number | null) =>
      request<any>(`/brands-categories/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, low_stock_limit: lowStockLimit }),
      }),
    deleteCategory: (id: number) => request<any>(`/brands-categories/categories/${id}`, { method: 'DELETE' }),
  },

  // Reports
  reports: {
    getDashboard: () => request<any>('/reports/dashboard'),
    getProfitLoss: (params?: { startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      if (params?.startDate) q.set('startDate', params.startDate);
      if (params?.endDate) q.set('endDate', params.endDate);
      return request<any>(`/reports/profit-loss?${q.toString()}`);
    },
    getTopSelling: () => request<{ topSelling: any[] }>('/reports/top-selling'),
  },

  // Live System Notifications
  notifications: {
    list: () =>
      request<{
        success: boolean;
        notifications: Array<{
          id: string;
          type: 'danger' | 'warning' | 'success' | 'info' | 'system';
          title: string;
          message: string;
          icon: string;
          color: string;
          badgeColor: string;
          actionTab: string;
          time: string;
          timestamp: string;
        }>;
        count: number;
        timestamp: string;
      }>('/notifications'),
  },

  // Settings
  settings: {
    get: () => request<{ settings: any }>('/settings'),
    update: (body: any) => request<any>('/settings', { method: 'PUT', body: JSON.stringify(body) }),

    getUsers: () => request<{ users: any[] }>('/settings/users'),
    createUser: (body: {
      name: string;
      email: string;
      password: string;
      confirmPassword?: string;
      phone?: string;
      role?: 'ADMIN' | 'CASHIER';
      status?: 'APPROVED' | 'PENDING';
    }) => request<{ message: string; user: any }>('/settings/users', { method: 'POST', body: JSON.stringify(body) }),
    updateUserStatus: (id: number, status: 'APPROVED' | 'PENDING') =>
      request<any>(`/settings/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    updateUserRole: (id: number, role: 'ADMIN' | 'CASHIER') =>
      request<any>(`/settings/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    deleteUser: (id: number) =>
      request<{ message: string }>(`/settings/users/${id}`, { method: 'DELETE' }),
  },

  // First-Time Server Installation & Setup Wizard
  install: {
    status: () =>
      request<{
        dbReady: boolean;
        tablesExist: boolean;
        isDatabaseReady: boolean;
        isSettingsConfigured: boolean;
        hasUsers: boolean;
        hasAdmin: boolean;
        adminCount: number;
        isInstalled: boolean;
        storeName?: string;
        version: string;
        dbType?: string;
        isStandardPostgres?: boolean;
        dbEngine?: string;
        dbHost?: string;
        dbPort?: number;
        dbName?: string;
        dbUser?: string;
        maskedUrl?: string;
        error?: string;
      }>('/install/status'),
    initDatabase: (dropTables?: boolean, password?: string) =>
      request<{
        success: boolean;
        message: string;
        isDatabaseReady: boolean;
        tablesExist: boolean;
      }>('/install/init-database', {
        method: 'POST',
        body: JSON.stringify({ drop_tables: dropTables, password }),
      }),
    saveSettings: (body: any) =>
      request<{
        success: boolean;
        message: string;
      }>('/install/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    createAdmin: (body: any) =>
      request<{
        success: boolean;
        message: string;
        adminEmail?: string;
        adminName?: string;
        cashierCreated?: boolean;
      }>('/install/admin', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    complete: (body?: { load_sample_catalog?: boolean }) =>
      request<{
        success: boolean;
        isInstalled: boolean;
        message: string;
        token: string;
        user: any;
      }>('/install/complete', {
        method: 'POST',
        body: JSON.stringify(body || {}),
      }),
    seedCategories: () =>
      request<{
        success: boolean;
        message: string;
        categories: string[];
        totalCategories: number;
        totalBrands: number;
      }>('/install/seed-categories', {
        method: 'POST',
      }),
    setup: (body: any) =>
      request<{
        success: boolean;
        message: string;
        token: string;
        user: any;
        cashierCreated?: boolean;
      }>('/install/setup', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    reset: (password: string, email?: string, dropTables?: boolean) =>
      request<{
        success: boolean;
        message: string;
        isInstalled: boolean;
        tablesDropped?: boolean;
      }>('/install/reset', {
        method: 'POST',
        body: JSON.stringify({ password, email, drop_tables: dropTables }),
      }),
    dropTables: (password?: string) =>
      request<{
        success: boolean;
        message: string;
        isInstalled: boolean;
        tablesDropped: boolean;
      }>('/install/drop-tables', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    lock: () =>
      request<{
        success: boolean;
        message: string;
        isInstalled: boolean;
      }>('/install/lock', {
        method: 'POST',
      }),
    getDummyInfo: () =>
      request<{
        available: boolean;
        filename: string;
        downloadUrl: string;
        sizeBytes: number;
        sizeKb: number;
        timeSpan: string;
        highlights: {
          salesCount: string;
          purchasesCount: string;
          productsCount: string;
          returnsCount: string;
          purchaseReturnsCount: string;
          brandsCount: string;
          categoriesCount: string;
          customersCount: string;
          suppliersCount: string;
          sampleAccounts: Array<{ role: string; email: string; password: string }>;
        };
      }>('/install/dummy-data-info'),
    loadDummyData: () =>
      request<{
        success: boolean;
        message: string;
        token?: string;
        counts: Record<string, number>;
        accounts?: Array<{ role: string; email: string; password: string }>;
      }>('/install/load-dummy-data', {
        method: 'POST',
      }),
    importSql: (sql: string) =>
      request<{
        success: boolean;
        message: string;
        token?: string;
        counts: Record<string, number>;
      }>('/install/import-sql', {
        method: 'POST',
        body: JSON.stringify({ sql }),
      }),
  },

  // Database Backup & Restore (JSON Export / Import & Direct SQL Import)
  backup: {
    stats: () =>
      request<{
        success: boolean;
        database: string;
        storeName: string;
        totalRecords: number;
        counts: Record<string, number>;
        timestamp: string;
      }>('/backup/stats'),
    export: () =>
      request<{
        meta: {
          format: string;
          version: string;
          exportedAt: string;
          exportedBy: string;
          storeName: string;
          totalRecords: number;
        };
        counts: Record<string, number>;
        tables: Record<string, any[]>;
      }>('/backup/export'),
    restore: (payload: any) =>
      request<{
        success: boolean;
        message: string;
        restoredCounts: Record<string, number>;
        totalRestored: number;
        timestamp: string;
      }>('/backup/restore', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getDummyInfo: () =>
      request<{
        available: boolean;
        filename: string;
        downloadUrl: string;
        sizeBytes: number;
        sizeKb: number;
        timeSpan: string;
        highlights: Record<string, string>;
      }>('/backup/dummy-data-info'),
    loadDummyData: () =>
      request<{
        success: boolean;
        message: string;
        counts: Record<string, number>;
      }>('/backup/load-dummy-data', {
        method: 'POST',
      }),
    importSql: (sql: string) =>
      request<{
        success: boolean;
        message: string;
        counts: Record<string, number>;
      }>('/backup/import-sql', {
        method: 'POST',
        body: JSON.stringify({ sql }),
      }),
  },
};
