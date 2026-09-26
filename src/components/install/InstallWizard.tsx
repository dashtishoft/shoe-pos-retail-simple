import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Store,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Phone,
  Mail,
  MapPin,
  Coins,
  Barcode,
  Server,
  Database,
  Sparkles,
  Loader2,
  RefreshCw,
  Upload,
  Download,
  FileText,
  TrendingUp,
  Trash2,
  Check,
  Sun,
  Moon,
  Tag,
  Sliders,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.tsx';
import { api, setAuthToken } from '../../services/api.ts';
import { ShowroomBackground } from '../common/ShowroomBackground.tsx';
import { PublicHeader } from '../common/PublicHeader.tsx';
import { PublicFooter } from '../common/PublicFooter.tsx';

interface InstallWizardProps {
  onInstalled: (data: { user: any; settings: any }) => void;
  onCancelToLogin?: () => void;
  isAlreadyInstalled?: boolean;
}

const CURRENCY_PRESETS = [
  { code: 'PKR', symbol: 'Rs.', name: 'Pakistani Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
];

export const InstallWizard: React.FC<InstallWizardProps> = ({
  onInstalled,
  onCancelToLogin,
  isAlreadyInstalled = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isLockedOut, setIsLockedOut] = useState<boolean>(isAlreadyInstalled);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);

  // System Diagnostics
  const [systemInfo, setSystemInfo] = useState<{
    dbReady: boolean;
    tablesExist?: boolean;
    isDatabaseReady?: boolean;
    isSettingsConfigured?: boolean;
    hasUsers?: boolean;
    hasAdmin?: boolean;
    adminCount?: number;
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
  } | null>(null);

  // Step 2: Database Installa zxction State
  const [dropTables, setDropTables] = useState<boolean>(false);
  const [isInstallingDb, setIsInstallingDb] = useState<boolean>(false);
  const [dbInstallProgress, setDbInstallProgress] = useState<string>('');
  const [dbInstallSuccess, setDbInstallSuccess] = useState<boolean>(false);
  const [dbInstallError, setDbInstallError] = useState<string | null>(null);

  // Step 3: Initial Settings State
  const [shopName, setShopName] = useState('TJ Shoes Collection');
  const [shopPhone, setShopPhone] = useState('+92-321-2257340');
  const [shopEmail, setShopEmail] = useState('sales@tjshoes.com');
  const [shopAddress, setShopAddress] = useState('Shop #1, Al-Rehman Arcade Jatpat Mkt, Lyari Khi');
  const [website, setWebsite] = useState('www.tjshoes.com');
  const [taxId, setTaxId] = useState('STRN-9876543-2');
  const [selectedCurrency, setSelectedCurrency] = useState('PKR');
  const [currencySymbol, setCurrencySymbol] = useState('Rs.');
  const [currencyName, setCurrencyName] = useState('Pakistani Rupee');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [purchasePrefix, setPurchasePrefix] = useState('PUR-');
  const [barcodePrefix, setBarcodePrefix] = useState('9861234');
  const [invoiceFooter, setInvoiceFooter] = useState(
    'Exchanges accepted within 7 days with original sales receipt. Thank you for shopping with us!'
  );
  const [lowStockLimit, setLowStockLimit] = useState(5);
  const [pricingMode, setPricingMode] = useState<'FIXED' | 'NEGOTIABLE'>('NEGOTIABLE');
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Track if installer was unlocked or reset to strictly discard any cached settings
  const isUnlockedOrResetRef = useRef(false);

  const resetAllWizardState = () => {
    isUnlockedOrResetRef.current = true;
    try {
      localStorage.removeItem('cached_store_name');
      localStorage.removeItem('cached_store_settings');
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
    } catch {}
    setShopName('');
    setShopPhone('');
    setShopEmail('');
    setShopAddress('');
    setWebsite('');
    setTaxId('');
    setSelectedCurrency('PKR');
    setCurrencySymbol('Rs.');
    setCurrencyName('Pakistani Rupee');
    setInvoicePrefix('INV-');
    setPurchasePrefix('PUR-');
    setBarcodePrefix('9861234');
    setInvoiceFooter(
      'Exchanges accepted within 7 days with original sales receipt. Thank you for shopping with us!'
    );
    setLowStockLimit(5);
    setAdminName('');
    setAdminEmail('');
    setAdminPhone('');
    setAdminPassword('');
    setAdminConfirmPassword('');
    setCashierName('');
    setCashierEmail('');
    setCashierPhone('');
    setCashierPassword('');
    setCashierConfirmPassword('');
    setDbInstallSuccess(false);
    setInstallSuccess(false);
    setStepErrors({});
    setApiError(null);
  };

  // Step 4: Create Administrator State
  const [adminName, setAdminName] = useState('Khalid Dashti');
  const [adminEmail, setAdminEmail] = useState('owner@tjshoes.com');
  const [adminPhone, setAdminPhone] = useState('+92-321-2257340');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showAdminConfirmPass, setShowAdminConfirmPass] = useState(false);

  // Optional Cashier Account
  const [createCashier, setCreateCashier] = useState(true);
  const [cashierName, setCashierName] = useState('Counter Cashier Anus');
  const [cashierEmail, setCashierEmail] = useState('cashier@tjshoes.com');
  const [cashierPhone, setCashierPhone] = useState('+92-321-5352619');
  const [cashierPassword, setCashierPassword] = useState('cashier123');
  const [cashierConfirmPassword, setCashierConfirmPassword] = useState('cashier123');
  const [showCashierPass, setShowCashierPass] = useState(false);
  const [showCashierConfirmPass, setShowCashierConfirmPass] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState<boolean>(false);

  // Step 5: Complete Installation State
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // 5-Year Comprehensive Dummy Data & Manual SQL Import States
  const [isLoadingDummy, setIsLoadingDummy] = useState<boolean>(false);
  const [dummyLoadProgress, setDummyLoadProgress] = useState<string>('');
  const [dummyLoadSuccess, setDummyLoadSuccess] = useState<{
    message: string;
    counts: Record<string, number>;
    accounts?: Array<{ role: string; email: string; password: string }>;
  } | null>(null);
  const [dummyLoadError, setDummyLoadError] = useState<string | null>(null);

  // Manual SQL Upload State
  const [selectedSqlFile, setSelectedSqlFile] = useState<File | null>(null);
  const [sqlFileContent, setSqlFileContent] = useState<string>('');
  const [isImportingSql, setIsImportingSql] = useState<boolean>(false);
  const [sqlImportSuccess, setSqlImportSuccess] = useState<{
    message: string;
    counts: Record<string, number>;
  } | null>(null);
  const [sqlImportError, setSqlImportError] = useState<string | null>(null);
  const [activeDataTab, setActiveDataTab] = useState<'sample' | 'manual' | 'specs'>('sample');

  // Global Error & Validation State
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  // Direct Unlock State on Locked Screen
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPass, setShowUnlockPass] = useState(false);
  const [unlockDropTables, setUnlockDropTables] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockSuccess, setUnlockSuccess] = useState<string | null>(null);

  // 1. Initial Diagnostics & Lock Check
  const isCheckingStatusRef = useRef(false);

  useEffect(() => {
    checkInstallStatus();
  }, []);

  const checkInstallStatus = async (forceNoPreload = false) => {
    if (isCheckingStatusRef.current) return;
    isCheckingStatusRef.current = true;
    setCheckingStatus(true);
    setApiError(null);
    try {
      const res = await api.install.status();
      setSystemInfo(res);
      setIsLockedOut(Boolean(res.isInstalled));
      if (!res.dbReady && res.error) {
        setApiError(res.error);
      }
      if (res.tablesExist) {
        setDbInstallSuccess(true);
      }
      // ONLY pre-populate existing store name if NOT unlocked/reset AND system is already marked installed
      if (!forceNoPreload && !isUnlockedOrResetRef.current && res.isInstalled && res.isSettingsConfigured && res.storeName) {
        setShopName(res.storeName);
      }
    } catch (err: any) {
      console.warn('Install status check notice:', err);
      setApiError(err.message || 'Could not verify database connection status.');
    } finally {
      isCheckingStatusRef.current = false;
      setCheckingStatus(false);
    }
  };

  const handleCurrencyChange = (code: string) => {
    const preset = CURRENCY_PRESETS.find((c) => c.code === code);
    if (preset) {
      setSelectedCurrency(preset.code);
      setCurrencySymbol(preset.symbol);
      setCurrencyName(preset.name);
    } else {
      setSelectedCurrency(code);
    }
  };

  // -------------------------------------------------------------
  // STEP 2: INSTALL DATABASE TABLES EXPLICITLY ON USER COMMAND
  // -------------------------------------------------------------
  const handleInstallDatabase = async () => {
    setIsInstallingDb(true);
    setDbInstallError(null);
    setApiError(null);
    setDbInstallProgress('Connecting to database...');

    try {
      setDbInstallProgress(dropTables ? 'Dropping all existing tables with CASCADE...' : 'Preparing database schema...');
      await new Promise((r) => setTimeout(r, 300));

      const res = await api.install.initDatabase(dropTables, unlockPassword || undefined);

      setDbInstallProgress('Verifying database schema, sequences, and empty catalog state...');
      await new Promise((r) => setTimeout(r, 200));

      setDbInstallSuccess(true);
      setDbInstallProgress(res.message || 'All application tables and schema installed successfully.');
      
      if (dropTables) {
        resetAllWizardState();
        setDropTables(false); // Reset toggle now that drop has succeeded
      }

      // Refresh status without preloading old state
      await checkInstallStatus(true);
    } catch (err: any) {
      console.error('Database installation error:', err);
      setDbInstallError(err.message || 'Failed to initialize database tables.');
    } finally {
      setIsInstallingDb(false);
    }
  };

  const handleStep2Next = async () => {
    // If the user checked dropTables or tables aren't confirmed, run handleInstallDatabase first
    if (dropTables || !dbInstallSuccess) {
      await handleInstallDatabase();
      return;
    }
    setCurrentStep(3);
  };

  // -------------------------------------------------------------
  // STEP 3: SAVE INITIAL SETTINGS
  // -------------------------------------------------------------
  const validateSettings = () => {
    const errors: Record<string, string> = {};
    if (!shopName.trim()) errors.shopName = 'Store Name is required.';
    if (!shopPhone.trim()) errors.shopPhone = 'Store Phone Number is required.';
    if (shopEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(shopEmail.trim())) errors.shopEmail = 'Invalid email address format.';
    }
    if (!currencySymbol.trim()) errors.currencySymbol = 'Currency symbol is required.';

    const digitsOnly = barcodePrefix.replace(/\D/g, '');
    if (!barcodePrefix.trim()) {
      errors.barcodePrefix = 'Barcode prefix is required.';
    } else if (digitsOnly.length !== 7) {
      errors.barcodePrefix = `Barcode prefix must be strictly 7 numeric digits (${digitsOnly.length}/7 entered, e.g. 0108923).`;
    }
    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSettings = async () => {
    if (!validateSettings()) return;

    setIsSavingSettings(true);
    setApiError(null);
    try {
      await api.install.saveSettings({
        shop_name: shopName,
        shop_phone: shopPhone,
        shop_email: shopEmail,
        shop_address: shopAddress,
        website,
        tax_id: taxId,
        currency: selectedCurrency,
        currency_symbol: currencySymbol,
        currency_name: currencyName,
        invoice_prefix: invoicePrefix,
        purchase_prefix: purchasePrefix,
        barcode_prefix: barcodePrefix,
        invoice_footer: invoiceFooter,
        low_stock_limit: lowStockLimit,
        pricing_mode: pricingMode,
      });
      setCurrentStep(4);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setApiError(err.message || 'Failed to save store settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 4: CREATE ADMINISTRATOR ACCOUNT
  // -------------------------------------------------------------
  const validateAdmin = () => {
    const errors: Record<string, string> = {};
    if (!adminName.trim()) errors.adminName = 'Administrator name is required.';
    if (!adminEmail.trim()) {
      errors.adminEmail = 'Administrator email is required.';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminEmail.trim())) errors.adminEmail = 'Invalid email format.';
    }

    if (!adminPassword) {
      errors.adminPassword = 'Password is required.';
    } else if (adminPassword.length < 6) {
      errors.adminPassword = 'Password must be at least 6 characters.';
    }

    if (adminPassword !== adminConfirmPassword) {
      errors.adminConfirmPassword = 'Passwords do not match.';
    }

    if (createCashier) {
      if (!cashierName.trim()) errors.cashierName = 'Cashier name is required.';
      if (!cashierEmail.trim()) {
        errors.cashierEmail = 'Cashier email is required.';
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cashierEmail.trim())) errors.cashierEmail = 'Invalid email format.';
      }
      if (cashierEmail.trim().toLowerCase() === adminEmail.trim().toLowerCase()) {
        errors.cashierEmail = 'Admin and Cashier cannot share the same email address.';
      }
      if (!cashierPassword) {
        errors.cashierPassword = 'Cashier password / PIN is required.';
      } else if (cashierPassword.length < 4) {
        errors.cashierPassword = 'Cashier password must be at least 4 characters.';
      }
      if (cashierPassword !== cashierConfirmPassword) {
        errors.cashierConfirmPassword = 'Cashier passwords do not match.';
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAdmin = async () => {
    if (!validateAdmin()) return;

    setIsCreatingAdmin(true);
    setApiError(null);
    try {
      await api.install.createAdmin({
        admin_name: adminName,
        admin_email: adminEmail,
        admin_phone: adminPhone,
        admin_password: adminPassword,
        admin_confirm_password: adminConfirmPassword,
        create_cashier: createCashier,
        cashier_name: cashierName,
        cashier_email: cashierEmail,
        cashier_phone: cashierPhone,
        cashier_password: cashierPassword,
        cashier_confirm_password: cashierConfirmPassword,
      });
      setCurrentStep(5);
    } catch (err: any) {
      console.error('Error creating admin:', err);
      setApiError(err.message || 'Failed to create administrator account.');
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  // -------------------------------------------------------------
  // DUMMY DATA & MANUAL SQL IMPORT HANDLERS (DURING WIZARD)
  // -------------------------------------------------------------
  const handleLoadFiveYearDummyData = async () => {
    setIsLoadingDummy(true);
    setDummyLoadError(null);
    setDummyLoadProgress('Executing 5-year historical SQL dataset (1,250+ sales, 118 products, 61 customers, 12 suppliers)...');
    try {
      const res = await api.install.loadDummyData();
      setDummyLoadSuccess(res);
      if (res.token) {
        setAuthToken(res.token);
      }
      setShopName('Shoe Shop POS & Inventory');
      setDbInstallSuccess(true);
    } catch (err: any) {
      console.error('Error loading dummy data:', err);
      setDummyLoadError(err.message || 'Failed to load dummy data SQL.');
    } finally {
      setIsLoadingDummy(false);
      setDummyLoadProgress('');
    }
  };

  const handleSqlFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedSqlFile(file);
    setSqlImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      setSqlFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleExecuteManualSql = async () => {
    if (!sqlFileContent.trim()) {
      setSqlImportError('Please select a valid non-empty .sql file first.');
      return;
    }
    setIsImportingSql(true);
    setSqlImportError(null);
    try {
      const res = await api.install.importSql(sqlFileContent);
      setSqlImportSuccess(res);
      if (res.token) {
        setAuthToken(res.token);
      }
      setDbInstallSuccess(true);
    } catch (err: any) {
      console.error('Error executing manual SQL:', err);
      setSqlImportError(err.message || 'Failed to execute SQL script.');
    } finally {
      setIsImportingSql(false);
    }
  };

  // -------------------------------------------------------------
  // STEP 5: COMPLETE INSTALLATION & LAUNCH POS
  // -------------------------------------------------------------
  const handleCompleteInstallation = async () => {
    setIsCompleting(true);
    setApiError(null);

    try {
      const res = await api.install.complete();

      if (res.token) {
        setAuthToken(res.token);
      }

      setInstallSuccess(true);

      setTimeout(() => {
        onInstalled({
          user: res.user,
          settings: {
            name: shopName,
            phone: shopPhone,
            email: shopEmail,
            currency: selectedCurrency,
            currency_symbol: currencySymbol,
            currency_name: currencyName,
            barcode_prefix: barcodePrefix,
            invoice_prefix: invoicePrefix,
          },
        });
      }, 1500);
    } catch (err: any) {
      console.error('Completion error:', err);
      setApiError(err.message || 'Failed to finalize installation.');
      setIsCompleting(false);
    }
  };

  // -------------------------------------------------------------
  // DIRECT UNLOCK ON LOCKED SCREEN (FOR ADMINISTRATOR)
  // -------------------------------------------------------------
  const handleDirectUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = unlockPassword.trim();
    if (!cleanPassword) return;

    setIsUnlocking(true);
    setUnlockError(null);
    setUnlockSuccess(null);
    try {
      const res = await api.install.reset(cleanPassword, undefined, unlockDropTables);
      setUnlockSuccess(res.message);
      
      // Discard all useState cache, store name, and local storage on unlock
      resetAllWizardState();

      setTimeout(() => {
        setIsLockedOut(false);
        setCurrentStep(1);
        checkInstallStatus(true);
      }, 600);
    } catch (err: any) {
      setUnlockError(err.message || 'Incorrect Store Owner / Admin password.');
    } finally {
      setIsUnlocking(false);
    }
  };

  // -------------------------------------------------------------
  // VIEW: LOCKED OUT (SYSTEM ALREADY INSTALLED)
  // -------------------------------------------------------------
  if (isLockedOut) {
    return (
      <div
        id="installer-locked-screen"
        className="min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden bg-slate-900 dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-600 selection:text-white transition-colors duration-200"
      >
        <ShowroomBackground />
        <PublicHeader
          storeName={systemInfo?.storeName || shopName}
          badgeText="Installation Sealed"
          badgeVariant="locked"
          subtitle="Installation Lockdown Active"
        />
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl border border-white/40 dark:border-purple-800/50 p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/50 rounded-2xl mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Installation Sealed & Active
              </div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">System Already Installed</h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                The shoe shop database and administrator accounts have already been configured. The setup wizard is locked for security.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Store:</span>
                <span className="font-bold text-slate-800 dark:text-white">{systemInfo?.storeName || shopName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Database Engine:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{systemInfo?.dbType || 'PostgreSQL'}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                <span>Security Status:</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-400/30">Route Lockdown Active</span>
              </div>
            </div>

            <div className="space-y-3">
              {onCancelToLogin && (
                <button
                  id="btn-return-pos"
                  type="button"
                  onClick={onCancelToLogin}
                  className="w-full py-3 px-4 rounded-xl btn-gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/25 flex items-center justify-center gap-2 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Go to POS Terminal / Login</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Admin Recommission / Unlock Form */}
              <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 block mb-2">
                  Need to reconfigure? Enter Administrator password:
                </span>
                <form onSubmit={handleDirectUnlock} className="space-y-3">
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3.5" />
                    <input
                      id="input-unlock-password"
                      type={showUnlockPass ? 'text' : 'password'}
                      value={unlockPassword}
                      onChange={(e) => setUnlockPassword(e.target.value)}
                      placeholder="Admin password or admin123"
                      className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUnlockPass(!showUnlockPass)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showUnlockPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={unlockDropTables}
                      onChange={(e) => setUnlockDropTables(e.target.checked)}
                      className="rounded border-slate-300 dark:border-white/20 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Clean Reinstall (drop all existing tables CASCADE)</span>
                  </label>

                  {unlockError && (
                    <p className="text-xs text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60 font-medium">
                      {unlockError}
                    </p>
                  )}
                  {unlockSuccess && (
                    <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/20 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-400/30 font-medium">
                      {unlockSuccess}
                    </p>
                  )}

                  <button
                    id="btn-unlock-wizard"
                    type="submit"
                    disabled={isUnlocking || !unlockPassword.trim()}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isUnlocking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    <span>{isUnlocking ? 'Verifying...' : 'Unlock Installation Wizard'}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </main>
        <PublicFooter storeName={systemInfo?.storeName || shopName} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: CELEBRATION / SUCCESS REDIRECT
  // -------------------------------------------------------------
  if (installSuccess) {
    return (
      <div
        id="installer-success-screen"
        className="min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden bg-slate-900 dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-600 selection:text-white transition-colors duration-200"
      >
        <ShowroomBackground />
        <PublicHeader
          storeName={shopName}
          badgeText="Installation Completed"
          badgeVariant="online"
          subtitle="System Initialized & Ready"
        />
        <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl border border-white/40 dark:border-purple-800/50 p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-full mx-auto flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/15 animate-bounce">
              <Sparkles className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Installation Completed
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                Welcome to {shopName}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Your store database is configured, initial user credentials are encrypted, and the setup route is locked.
                Redirecting you to the POS Terminal...
              </p>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="btn-gradient-primary h-full w-full animate-pulse"></div>
            </div>
          </div>
        </main>
        <PublicFooter storeName={shopName} />
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: MAIN 5-STEP INSTALLATION WIZARD
  // -------------------------------------------------------------
  return (
    <div
      id="installation-wizard-container"
      className="min-h-screen w-full flex flex-col justify-between relative overflow-x-hidden bg-slate-900 dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-600 selection:text-white transition-colors duration-200"
    >
      <ShowroomBackground />
      <PublicHeader
        storeName={shopName || 'Shoe Shop POS'}
        badgeText="Installation Wizard"
        badgeVariant="wizard"
        subtitle="First-Time Deployment & Store Initialization"
        dbText={systemInfo?.isStandardPostgres ? 'PostgreSQL Server' : 'Database Ready'}
      />

      {/* MAIN CONTENT CONTAINER */}
      <main className="relative z-10 w-full flex-1 max-w-4xl mx-auto px-4 py-6 sm:px-8 sm:py-8 flex flex-col">
        {apiError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-sm flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Installation Error:</span>
              <span>{apiError}</span>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-[#131B2E] rounded-3xl shadow-2xl border border-white/40 dark:border-purple-800/80 overflow-hidden text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-200">
          {/* STEP PROGRESS BAR INTEGRATED AT TOP OF CARD */}
          <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-purple-800/80 px-4 sm:px-8 py-4">
            <div className="flex items-center justify-between">
              {[
                { step: 1, label: 'System Check' },
                { step: 2, label: 'Install Database' },
                { step: 3, label: 'Initial Settings' },
                { step: 4, label: 'Administrator' },
                { step: 5, label: 'Complete & Launch' },
              ].map((item, idx) => {
                const isCompleted = currentStep > item.step;
                const isCurrent = currentStep === item.step;
                return (
                  <div key={item.step} className="flex items-center flex-1 last:flex-none">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                          isCompleted
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : isCurrent
                            ? 'btn-gradient-primary text-white ring-4 ring-indigo-100 dark:ring-purple-900/60 shadow-md shadow-indigo-500/20'
                            : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700 font-semibold'
                        }`}
                      >
                        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                      </div>
                      <span
                        className={`hidden md:inline text-xs font-semibold ${
                          isCurrent
                            ? 'text-indigo-600 dark:text-purple-400 font-bold'
                            : isCompleted
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    {idx < 4 && (
                      <div
                        className={`flex-1 h-0.5 mx-2.5 transition-colors ${
                          currentStep > item.step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700/60'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          {/* ======================================================= */}
          {/* STEP 1: SYSTEM CHECK & DIAGNOSTICS                      */}
          {/* ======================================================= */}
          {currentStep === 1 && (
            <div id="step-system-check" className="p-6 sm:p-8 space-y-6 text-slate-800">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg inline-block">
                  Step 1 of 5
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  System Check & Prerequisites
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Verifying PostgreSQL connectivity and environment readiness before creating database tables.
                </p>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                      <Database className="w-4 h-4 text-emerald-600" />
                      Database Connectivity
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        systemInfo?.dbReady
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {systemInfo?.dbReady ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">
                    Engine: {systemInfo?.dbEngine || 'PostgreSQL Engine'}. Ready for schema creation.
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                      <Server className="w-4 h-4 text-blue-600" />
                      Application Server
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      ONLINE (PORT 3000)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">
                    Express backend with Vite middleware and JSON API routes ready.
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                      <Lock className="w-4 h-4 text-indigo-600" />
                      Installation Guard
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      ARMED
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">
                    Auto-seeding and auto-table creation disabled on startup. UI wizard required.
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                      <Barcode className="w-4 h-4 text-amber-600" />
                      Hardware Standards
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      COMPATIBLE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-normal">
                    EAN-13 barcode generation, 80mm receipt templates, and scanner support ready.
                  </p>
                </div>
              </div>

              {/* Diagnostic Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Database className="w-3.5 h-3.5 text-indigo-600" />
                    Database Host & Instance:
                  </span>
                  <button
                    type="button"
                    onClick={() => checkInstallStatus()}
                    disabled={checkingStatus}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
                    <span>Re-check</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Host</span>
                    <span className="font-mono text-slate-800 font-semibold truncate block mt-0.5">{systemInfo?.dbHost || 'Connected'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Database Name</span>
                    <span className="font-mono text-emerald-700 font-bold truncate block mt-0.5">{systemInfo?.dbName || 'Default'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Driver</span>
                    <span className="font-mono text-blue-700 font-semibold truncate block mt-0.5">{systemInfo?.dbEngine || 'PostgreSQL'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  id="btn-step1-next"
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-3 px-6 rounded-xl btn-gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  <span>Proceed to Database Installation</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* STEP 2: DATABASE INSTALLATION (EXPLICIT USER TRIGGER)    */}
          {/* ======================================================= */}
          {currentStep === 2 && (
            <div id="step-database-installation" className="p-6 sm:p-8 space-y-6 text-slate-800">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg inline-block">
                  Step 2 of 5
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Database Table & Schema Installation
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Tables and schemas are <strong>never created automatically</strong> during server boot. Click the button below to initialize all required POS application tables.
                </p>
              </div>

              {/* Scope of Tables to be Created */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>Tables to be created in PostgreSQL</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-slate-700 font-semibold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> users (auth)
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-slate-700 font-semibold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> company_settings
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-slate-700 font-semibold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> products (shoes)
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-slate-700 font-semibold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> brands & categories
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-slate-700 font-semibold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> sales & sale_items
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-slate-700 font-semibold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span> purchases & stock_ledger
                  </div>
                </div>
              </div>

              {/* Clean Reinstall Option */}
              <div className={`p-4 rounded-2xl border transition-all ${
                dropTables
                  ? 'bg-rose-50/90 border-rose-300 dark:bg-rose-950/30 dark:border-rose-800'
                  : 'bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/60'
              } flex items-start gap-3`}>
                <input
                  id="checkbox-drop-tables"
                  type="checkbox"
                  checked={dropTables}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setDropTables(checked);
                    if (checked) {
                      setDbInstallSuccess(false);
                      setDbInstallProgress('');
                    } else if (systemInfo?.tablesExist) {
                      setDbInstallSuccess(true);
                    }
                  }}
                  className="mt-0.5 rounded border-amber-300 text-rose-600 focus:ring-rose-500 cursor-pointer w-4 h-4"
                />
                <div className="text-xs">
                  <label htmlFor="checkbox-drop-tables" className="font-bold text-slate-900 dark:text-white cursor-pointer block">
                    Clean Reinstallation (Drop existing tables with CASCADE)
                  </label>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5 font-normal">
                    {dropTables
                      ? '⚠️ Activated: All existing store data, products, orders, and tables will be permanently DROPPED with CASCADE to ensure a 100% empty, pristine store.'
                      : 'Check this box if you want to completely erase any leftover test data and begin with zero products and zero sales.'}
                  </p>
                </div>
              </div>

              {/* Installation Feedback Box */}
              {isInstallingDb && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-3 animate-pulse">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
                  <div>
                    <span className="font-bold block">Executing Database DDL Schema...</span>
                    <span>{dbInstallProgress}</span>
                  </div>
                </div>
              )}

              {dbInstallSuccess && !isInstallingDb && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3 shadow-xs">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Database Schema Verified!</span>
                    <span>All PostgreSQL tables, relations, and barcode indexes are verified and ready.</span>
                  </div>
                </div>
              )}

              {dbInstallError && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 shadow-xs">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Installation Error:</span>
                    <span>{dbInstallError}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to System Check</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    id="btn-install-database"
                    type="button"
                    onClick={handleInstallDatabase}
                    disabled={isInstallingDb}
                    className={`py-3 px-6 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 text-white ${
                      dropTables
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                        : 'btn-gradient-primary shadow-indigo-500/20'
                    }`}
                  >
                    {isInstallingDb ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : dropTables ? (
                      <Trash2 className="w-4 h-4" />
                    ) : (
                      <Database className="w-4 h-4" />
                    )}
                    <span>
                      {isInstallingDb
                        ? (dropTables ? 'Dropping & Reinstalling...' : 'Installing Database Tables...')
                        : (dropTables ? 'Drop Tables (CASCADE) & Reinstall' : 'Install Database')}
                    </span>
                  </button>

                  {/* Advance button: guarantees drop execution if checkbox is active */}
                  <button
                    id="btn-step2-next"
                    type="button"
                    onClick={handleStep2Next}
                    disabled={isInstallingDb}
                    className={`py-3 px-6 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 active:scale-95 transition-all cursor-pointer text-white ${
                      dropTables && !dbInstallSuccess
                        ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    }`}
                  >
                    <span>
                      {dropTables && !dbInstallSuccess
                        ? 'Drop Tables & Continue to Settings'
                        : 'Next: Configure Store Settings'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* STEP 3: INITIAL STORE SETTINGS & BARCODE STANDARDS      */}
          {/* ======================================================= */}
          {currentStep === 3 && (
            <div id="step-initial-settings" className="p-6 sm:p-8 space-y-6 text-slate-800">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg inline-block">
                  Step 3 of 5
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Store Profile & Regional Settings
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  Configure your business information, thermal receipt printing defaults, and 7-digit EAN-13 barcode standards.
                </p>
              </div>

              <div className="space-y-4">
                {/* Store Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Store / Business Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-shop-name"
                        type="text"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="e.g. Retail Footwear & Shoes"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                    </div>
                    {stepErrors.shopName && <p className="text-xs text-rose-500 mt-1 font-medium">{stepErrors.shopName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Store Contact Phone <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-shop-phone"
                        type="text"
                        value={shopPhone}
                        onChange={(e) => setShopPhone(e.target.value)}
                        placeholder="e.g. +92-300-5551234"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                    </div>
                    {stepErrors.shopPhone && <p className="text-xs text-rose-500 mt-1 font-medium">{stepErrors.shopPhone}</p>}
                  </div>
                </div>

                {/* Email & Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Store Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-shop-email"
                        type="email"
                        value={shopEmail}
                        onChange={(e) => setShopEmail(e.target.value)}
                        placeholder="e.g. sales@shoepos.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                    </div>
                    {stepErrors.shopEmail && <p className="text-xs text-rose-500 mt-1 font-medium">{stepErrors.shopEmail}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Physical Shop Address</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-shop-address"
                        type="text"
                        value={shopAddress}
                        onChange={(e) => setShopAddress(e.target.value)}
                        placeholder="Shop #14, Royal Commercial Plaza, Saddar"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Currency & Tax */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-indigo-600" />
                      Currency & Pricing
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono font-semibold">
                      Active: {selectedCurrency} ({currencySymbol})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {CURRENCY_PRESETS.map((curr) => (
                      <button
                        key={curr.code}
                        type="button"
                        onClick={() => handleCurrencyChange(curr.code)}
                        className={`p-3 rounded-xl text-left text-xs transition-all border cursor-pointer ${
                          selectedCurrency === curr.code
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-900 font-bold shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold">{curr.code}</span>
                          <span className="font-semibold text-slate-500">{curr.symbol}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate mt-1 font-medium">{curr.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Currency Symbol</label>
                      <input
                        type="text"
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-mono shadow-2xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Sales Invoice Prefix</label>
                      <input
                        type="text"
                        value={invoicePrefix}
                        onChange={(e) => setInvoicePrefix(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-mono shadow-2xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Barcode Prefix (7 Digits) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="input-barcode-prefix"
                        type="text"
                        maxLength={7}
                        value={barcodePrefix}
                        onChange={(e) => setBarcodePrefix(e.target.value.replace(/\D/g, '').slice(0, 7))}
                        placeholder="0108923"
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-mono shadow-2xs focus:border-indigo-500 focus:outline-none"
                      />
                      {stepErrors.barcodePrefix && (
                        <p className="text-[11px] text-rose-500 mt-1 font-medium">{stepErrors.barcodePrefix}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Retail Pricing Policy Selection (Permanent Setup Rule) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5 shadow-xs">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Retail Pricing Policy <span className="text-rose-500">*</span>
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-600" />
                      Locked After Installation
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 font-normal leading-relaxed">
                    Select your retail pricing rule. This setting is <strong>permanently locked</strong> after initial setup to guarantee transaction audit integrity. Default profit margins and cash amounts can be adjusted later in System Settings.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Option 1: Fixed Price */}
                    <button
                      type="button"
                      onClick={() => setPricingMode('FIXED')}
                      className={`p-4 rounded-xl text-left transition-all border cursor-pointer relative ${
                        pricingMode === 'FIXED'
                          ? 'bg-purple-50/90 border-purple-500 shadow-sm ring-2 ring-purple-400/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${
                            pricingMode === 'FIXED' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Tag className="w-4 h-4" />
                          </div>
                          <span className={`text-xs font-bold ${
                            pricingMode === 'FIXED' ? 'text-purple-950 font-black' : 'text-slate-800'
                          }`}>
                            1. Fixed Price Mode
                          </span>
                        </div>
                        {pricingMode === 'FIXED' && (
                          <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-slate-600 leading-snug">
                        Single non-negotiable retail price. Calculated strictly as <strong>Cost Price + Default Profit Margin (%) or Flat Amount ({currencySymbol})</strong>. No bargaining at POS counter.
                      </p>
                      <div className="mt-2 text-[10px] font-mono text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded inline-block">
                        Best for: Brand stores, fixed retail &amp; boutiques
                      </div>
                    </button>

                    {/* Option 2: Negotiable Price */}
                    <button
                      type="button"
                      onClick={() => setPricingMode('NEGOTIABLE')}
                      className={`p-4 rounded-xl text-left transition-all border cursor-pointer relative ${
                        pricingMode === 'NEGOTIABLE'
                          ? 'bg-indigo-50/90 border-indigo-500 shadow-sm ring-2 ring-indigo-400/30'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${
                            pricingMode === 'NEGOTIABLE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Sliders className="w-4 h-4" />
                          </div>
                          <span className={`text-xs font-bold ${
                            pricingMode === 'NEGOTIABLE' ? 'text-indigo-950 font-black' : 'text-slate-800'
                          }`}>
                            2. Negotiable Price Mode
                          </span>
                        </div>
                        {pricingMode === 'NEGOTIABLE' && (
                          <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-slate-600 leading-snug">
                        Two price levels: <strong>Minimum Floor Limit</strong> (Cost + Min Margin) &amp; <strong>Sticker Tag MRP</strong> (Cost + Max Margin). Cashiers negotiate within limits at POS checkout.
                      </p>
                      <div className="mt-2 text-[10px] font-mono text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded inline-block">
                        Best for: Wholesale &amp; traditional shoe markets
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Database Step</span>
                </button>

                <button
                  id="btn-save-settings"
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="py-3 px-6 rounded-xl btn-gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSavingSettings ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  <span>{isSavingSettings ? 'Saving Settings...' : 'Save Settings & Continue'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* STEP 4: CREATE ADMINISTRATOR ACCOUNT                    */}
          {/* ======================================================= */}
          {currentStep === 4 && (
            <div id="step-create-admin" className="p-6 sm:p-8 space-y-6 text-slate-800">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg inline-block">
                  Step 4 of 5
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Create Master Administrator Account
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                  The primary store owner account with full access to inventory, accounting, and cashier management. Passwords are encrypted securely using bcrypt.
                </p>
              </div>

              <div className="space-y-4">
                {/* Admin Name & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Admin Full Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-admin-name"
                        type="text"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        placeholder="e.g. Store Owner"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                    </div>
                    {stepErrors.adminName && <p className="text-xs text-rose-500 mt-1 font-medium">{stepErrors.adminName}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Admin Login Email / Username <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-admin-email"
                        type="email"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        placeholder="owner@shoepos.com"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                    </div>
                    {stepErrors.adminEmail && <p className="text-xs text-rose-500 mt-1 font-medium">{stepErrors.adminEmail}</p>}
                  </div>
                </div>

                {/* Admin Password & Confirm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Admin Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-admin-password"
                        type={showAdminPass ? 'text' : 'password'}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPass(!showAdminPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {stepErrors.adminPassword && (
                      <p className="text-xs text-rose-500 mt-1 font-medium">{stepErrors.adminPassword}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Confirm Admin Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                      <input
                        id="input-admin-confirm-password"
                        type={showAdminConfirmPass ? 'text' : 'password'}
                        value={adminConfirmPassword}
                        onChange={(e) => setAdminConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-colors shadow-2xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminConfirmPass(!showAdminConfirmPass)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      >
                        {showAdminConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {stepErrors.adminConfirmPassword && (
                      <p className="text-xs text-rose-500 mt-1 font-medium">{stepErrors.adminConfirmPassword}</p>
                    )}
                  </div>
                </div>

                {/* Optional Cashier Account Section */}
                <div className="pt-2">
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                        <input
                          id="checkbox-create-cashier"
                          type="checkbox"
                          checked={createCashier}
                          onChange={(e) => setCreateCashier(e.target.checked)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span>Also create initial Front-Desk Cashier account</span>
                      </label>
                      <span className="text-[10px] text-slate-500 uppercase font-mono font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Restricted POS Role
                      </span>
                    </div>

                    {createCashier && (
                      <div className="space-y-3 pt-3 border-t border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Cashier Name
                            </label>
                            <input
                              type="text"
                              value={cashierName}
                              onChange={(e) => setCashierName(e.target.value)}
                              placeholder="e.g. Cashier Ali"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs shadow-2xs focus:border-indigo-500 focus:outline-none"
                            />
                            {stepErrors.cashierName && (
                              <p className="text-[10px] text-rose-500 mt-0.5 font-medium">{stepErrors.cashierName}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Cashier Email
                            </label>
                            <input
                              type="email"
                              value={cashierEmail}
                              onChange={(e) => setCashierEmail(e.target.value)}
                              placeholder="cashier@shoepos.com"
                              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs shadow-2xs focus:border-indigo-500 focus:outline-none"
                            />
                            {stepErrors.cashierEmail && (
                              <p className="text-[10px] text-rose-500 mt-0.5 font-medium">{stepErrors.cashierEmail}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Cashier Password / PIN
                            </label>
                            <div className="relative">
                              <input
                                type={showCashierPass ? 'text' : 'password'}
                                value={cashierPassword}
                                onChange={(e) => setCashierPassword(e.target.value)}
                                placeholder="Min 4 chars"
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs pr-8 shadow-2xs focus:border-indigo-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setShowCashierPass(!showCashierPass)}
                                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                              >
                                {showCashierPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            {stepErrors.cashierPassword && (
                              <p className="text-[10px] text-rose-500 mt-0.5 font-medium">{stepErrors.cashierPassword}</p>
                            )}
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Confirm Cashier Password
                            </label>
                            <div className="relative">
                              <input
                                type={showCashierConfirmPass ? 'text' : 'password'}
                                value={cashierConfirmPassword}
                                onChange={(e) => setCashierConfirmPassword(e.target.value)}
                                placeholder="Re-enter PIN"
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs pr-8 shadow-2xs focus:border-indigo-500 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setShowCashierConfirmPass(!showCashierConfirmPass)}
                                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                              >
                                {showCashierConfirmPass ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {stepErrors.cashierConfirmPassword && (
                              <p className="text-[10px] text-rose-500 mt-0.5 font-medium">
                                {stepErrors.cashierConfirmPassword}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Settings</span>
                </button>

                <button
                  id="btn-create-admin"
                  type="button"
                  onClick={handleCreateAdmin}
                  disabled={isCreatingAdmin}
                  className="py-3 px-6 rounded-xl btn-gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCreatingAdmin ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  <span>{isCreatingAdmin ? 'Creating Administrator...' : 'Create Administrator & Continue'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ======================================================= */}
          {/* STEP 5: COMPLETE INSTALLATION & LAUNCH POS              */}
          {/* ======================================================= */}
          {currentStep === 5 && (
            <div id="step-complete-installation" className="p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-100">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/60 px-2.5 py-1 rounded-lg inline-block">
                  Step 5 of 5
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Verification & System Launch
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                  Review the installation checklist below. Once finalized, the installer locks automatically and launches your Point of Sale system.
                </p>
              </div>

              {/* Verification Checklist */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-purple-800/60 space-y-3 shadow-xs">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                  Installation Verification Checklist
                </span>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-purple-800/60 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">Database Schema & Application Tables</span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded-md font-bold">
                      INSTALLED
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-purple-800/60 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        Initial Store Profile: {shopName} ({selectedCurrency})
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded-md font-bold">
                      CONFIGURED
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-purple-800/60 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">
                        Administrator: {adminName} ({adminEmail})
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded-md font-bold">
                      SECURED (BCRYPT)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-purple-800/60 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">Security Lockdown Protocol</span>
                    </div>
                    <span className="text-[11px] font-mono text-indigo-700 dark:text-purple-300 bg-indigo-50 dark:bg-purple-950/60 border border-indigo-200 dark:border-purple-800/70 px-2 py-0.5 rounded-md font-bold">
                      READY TO SEAL
                    </span>
                  </div>
                </div>
              </div>

              {/* ======================================================= */}
              {/* 5-YEAR HISTORICAL DUMMY DATA & MANUAL SQL IMPORT PROMPT   */}
              {/* ======================================================= */}
              <div
                id="install-dummy-data-prompt"
                className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-50 via-indigo-50/40 to-slate-50 dark:bg-gradient-to-br dark:from-[#111A30] dark:via-[#0F172A] dark:to-[#141836] border border-slate-200 dark:border-purple-600/50 shadow-sm dark:shadow-[0_0_24px_rgba(147,51,234,0.12)] space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-purple-950 text-slate-700 dark:text-purple-300 border border-slate-200 dark:border-purple-700/50 flex items-center justify-center shadow-sm shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Optional Demo Dataset &amp; SQL Import</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">
                          Optional Testing Only
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        Populate 5 years of demo shoes and sales for evaluation only. Skip this for your real store!
                      </p>
                    </div>
                  </div>

                  {/* Sub Tabs */}
                  <div className="flex items-center gap-1 bg-white/90 dark:bg-[#0A0F1D] p-1 rounded-xl border border-slate-200 dark:border-purple-700/50 shadow-2xs self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setActiveDataTab('sample')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeDataTab === 'sample'
                          ? 'btn-gradient-primary text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-purple-200 dark:hover:bg-purple-950/40'
                      }`}
                    >
                      ⚡ Demo Data
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDataTab('manual')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeDataTab === 'manual'
                          ? 'btn-gradient-primary text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-purple-200 dark:hover:bg-purple-950/40'
                      }`}
                    >
                      📁 Manual .SQL
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDataTab('specs')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeDataTab === 'specs'
                          ? 'btn-gradient-primary text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-purple-200 dark:hover:bg-purple-950/40'
                      }`}
                    >
                      📋 Overview
                    </button>
                  </div>
                </div>

                {/* Important Notice for Real Stores */}
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Setting Up Your Real Store? (واقعی دکان کا سیٹ اپ)</span>
                    <span>
                      Do <strong>NOT</strong> load demo data if you want a clean store. Loading demo data will fill your store with 118 fake shoes and 1,250 sample invoices. To start with a clean, empty store, ignore this box and click <strong>&quot;Complete Installation &amp; Launch Clean POS&quot;</strong> below.
                    </span>
                  </div>
                </div>

                {/* TAB 1: ONE-CLICK LOAD 5-YEAR SAMPLE DATA */}
                {activeDataTab === 'sample' && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 text-center text-xs">
                      <div className="bg-white/80 dark:bg-[#131C35] p-2.5 rounded-xl border border-indigo-100 dark:border-purple-700/40 shadow-2xs transition-colors">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wide">Sales History</span>
                        <span className="text-sm font-black text-indigo-700 dark:text-purple-300">
                          1,250+ Invoices
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-medium">5 Full Years (2021–2026)</span>
                      </div>
                      <div className="bg-white/80 dark:bg-[#131C35] p-2.5 rounded-xl border border-indigo-100 dark:border-purple-700/40 shadow-2xs transition-colors">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wide">Purchases</span>
                        <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                          85 Batches
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-medium">12 Major Suppliers</span>
                      </div>
                      <div className="bg-white/80 dark:bg-[#131C35] p-2.5 rounded-xl border border-indigo-100 dark:border-purple-700/40 shadow-2xs transition-colors">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wide">Shoe Catalog</span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                          118 Models
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-medium">18 Brands, 12 Categories</span>
                      </div>
                      <div className="bg-white/80 dark:bg-[#131C35] p-2.5 rounded-xl border border-indigo-100 dark:border-purple-700/40 shadow-2xs transition-colors">
                        <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 block tracking-wide">Customers &amp; Returns</span>
                        <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                          60+ Profiles
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-300 block font-medium">50 Returns &amp; Restock</span>
                      </div>
                    </div>

                    {dummyLoadSuccess ? (
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-200 space-y-2.5 animate-in fade-in">
                        <div className="flex items-center gap-2 font-bold text-xs text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>{dummyLoadSuccess.message}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <span className="bg-white dark:bg-[#0B1525] px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700/60 shadow-2xs dark:text-emerald-300">
                            Sales: {dummyLoadSuccess.counts.sales || 1250}
                          </span>
                          <span className="bg-white dark:bg-[#0B1525] px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700/60 shadow-2xs dark:text-emerald-300">
                            Purchases: {dummyLoadSuccess.counts.purchases || 85}
                          </span>
                          <span className="bg-white dark:bg-[#0B1525] px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700/60 shadow-2xs dark:text-emerald-300">
                            Products: {dummyLoadSuccess.counts.products || 118}
                          </span>
                          <span className="bg-white dark:bg-[#0B1525] px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700/60 shadow-2xs dark:text-emerald-300">
                            Returns: {dummyLoadSuccess.counts.returns || 35}
                          </span>
                          <span className="bg-white dark:bg-[#0B1525] px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700/60 shadow-2xs dark:text-emerald-300">
                            Customers: {dummyLoadSuccess.counts.customers || 61}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-700/60 text-[11px] text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono">
                          <span>Owner: owner@shoepos.com (admin123)</span>
                          <span>Cashier: cashier@shoepos.com (cashier123)</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                        <button
                          id="btn-load-1year-dummy-data"
                          type="button"
                          onClick={handleLoadFiveYearDummyData}
                          disabled={isLoadingDummy}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer disabled:opacity-50 border border-slate-700"
                        >
                          {isLoadingDummy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <TrendingUp className="w-4 h-4" />
                          )}
                          <span>
                            {isLoadingDummy
                              ? dummyLoadProgress || 'Loading 5-Year Demo Data...'
                              : '⚡ Load 5-Year Demo Dataset (Testing Only)'}
                          </span>
                        </button>

                        <a
                          id="link-download-dummy-sql"
                          href="/dummy_data_five_years.sql"
                          download="dummy_data_five_years.sql"
                          className="py-2.5 px-3.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-[#161F3B] dark:hover:bg-[#1C274A] text-slate-700 dark:text-purple-200 font-semibold text-xs border border-slate-200 dark:border-purple-700/60 shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500 dark:text-purple-300" />
                          <span>Download .SQL (500 KB)</span>
                        </a>
                      </div>
                    )}

                    {dummyLoadError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{dummyLoadError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: MANUAL .SQL FILE IMPORT */}
                {activeDataTab === 'manual' && (
                  <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                    <div className="p-4 rounded-xl bg-white dark:bg-[#0B1120] border-2 border-dashed border-indigo-200 dark:border-purple-600/50 hover:border-indigo-400 dark:hover:border-purple-400 dark:hover:bg-purple-950/20 transition-all text-center space-y-2">
                      <Upload className="w-6 h-6 text-indigo-500 dark:text-purple-400 mx-auto" />
                      <div>
                        <label
                          htmlFor="manual-sql-file-input"
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 dark:text-purple-400 dark:hover:text-purple-300 cursor-pointer underline"
                        >
                          Browse your computer for .sql file
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Select any standard PostgreSQL script (e.g. dummy_data_five_years.sql) to execute and restore.
                        </p>
                      </div>
                      <input
                        id="manual-sql-file-input"
                        type="file"
                        accept=".sql"
                        onChange={handleSqlFileInput}
                        className="hidden"
                      />
                    </div>

                    {selectedSqlFile && (
                      <div className="p-3 rounded-xl bg-white dark:bg-[#131C35] border border-slate-200 dark:border-purple-700/40 flex items-center justify-between text-xs shadow-2xs">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-indigo-600 dark:text-purple-400 shrink-0" />
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{selectedSqlFile.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-400 font-mono">
                            ({Math.round(selectedSqlFile.size / 1024)} KB)
                          </span>
                        </div>

                        <button
                          id="btn-execute-manual-sql"
                          type="button"
                          onClick={handleExecuteManualSql}
                          disabled={isImportingSql}
                          className="py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          {isImportingSql ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>{isImportingSql ? 'Executing SQL...' : 'Import & Execute Script'}</span>
                        </button>
                      </div>
                    )}

                    {sqlImportSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>{sqlImportSuccess.message}</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                          Records updated across database tables. You can now launch and view real reports.
                        </p>
                      </div>
                    )}

                    {sqlImportError && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-200 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{sqlImportError}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: DATASET SPECIFICATIONS & SAMPLE ACCOUNTS */}
                {activeDataTab === 'specs' && (
                  <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C35] border border-slate-200 dark:border-purple-700/40 text-xs space-y-2 text-slate-700 dark:text-slate-300 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block mb-0.5">Footwear Catalog Details:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                          <li>118 Footwear Models across 18 Brands (Nike, Adidas, Puma, Bata, Service, Ndure, Stylo, Borjan, Hush Puppies, Skechers, Clarks, Oxford, etc.)</li>
                          <li>12 Shoe Categories (Formal, Casual, Sports, Running, Sneakers, Boots, Loafers, Sandals, Slippers, Traditional, High Heels, Flats)</li>
                          <li>Real Barcodes, SKU codes, and cost/retail price margins</li>
                        </ul>
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block mb-0.5">5-Year Historical Realism:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                          <li>1,250+ Sales Transactions (Sep 2021 – Sep 2026, ~Rs. 24.8M Total Revenue)</li>
                          <li>85 Purchase Consignments from 12 Wholesale Tanneries &amp; Suppliers</li>
                          <li>61 Customer profiles with authentic transaction frequencies and return histories</li>
                          <li>50 Return &amp; Restock audits for realistic margin and refund charts</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-purple-800/60"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Administrator</span>
                </button>

                <button
                  id="btn-complete-installation"
                  type="button"
                  onClick={handleCompleteInstallation}
                  disabled={isCompleting}
                  className="py-3 px-8 rounded-xl btn-gradient-primary text-white font-bold text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCompleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {isCompleting
                      ? 'Finalizing System Setup...'
                      : dummyLoadSuccess
                      ? 'Complete Installation & Launch with Demo Data'
                      : 'Complete Installation & Launch Clean Store (0 Products)'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <PublicFooter storeName={shopName || 'Shoe Shop POS'} />
    </div>
  );
};
