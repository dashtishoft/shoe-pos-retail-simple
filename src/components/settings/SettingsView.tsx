import React, { useState, useEffect, useRef } from 'react';
import {
  Store,
  Users,
  Globe,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Printer,
  Building2,
  Phone,
  Mail,
  MapPin,
  Coins,
  Barcode,
  Hash,
  Receipt,
  Link,
  ShieldCheck,
  Lock,
  Server,
  RefreshCw,
  Sparkles,
  Database,
  Eye,
  EyeOff,
  Unlock,
  Plus,
  UserPlus,
  X,
  KeyRound,
  TrendingUp,
  Sliders,
  Percent,
  Tag,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { PrinterHardwareSettings } from './PrinterHardwareSettings.tsx';
import { DataBackupRestore } from './DataBackupRestore.tsx';
import { UserAvatar } from '../common/UserAvatar.tsx';
import { BarcodeSvg } from '../common/BarcodeSvg.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { CreateStaffModal } from './CreateStaffModal.tsx';
import { useScrollActiveTab } from '../../hooks/useScrollActiveTab.ts';

interface SettingsViewProps {
  currentUser: any;
  companySettings: any;
  onSettingsUpdated: (updatedSettings?: any) => void;
  onOpenInstallWizard?: () => void;
  initialTab?: 'store' | 'users' | 'printers' | 'backup' | 'install';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  companySettings,
  onSettingsUpdated,
  onOpenInstallWizard,
  initialTab,
}) => {
  const [activeTab, setActiveTab] = useState<'store' | 'users' | 'printers' | 'backup' | 'install'>(
    initialTab || 'store'
  );

  const { containerRef: settingsTabContainerRef } = useScrollActiveTab<HTMLDivElement>(activeTab, {
    padding: 16,
    behavior: 'smooth',
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Store Settings Form
  const [formData, setFormData] = useState({
    company_name: companySettings?.company_name || companySettings?.companyName || companySettings?.name || 'T.J Shoes Collection',
    company_phone: companySettings?.company_phone || companySettings?.companyPhone || companySettings?.phone || '+92-321-2257340' || '',
    company_email: companySettings?.company_email || companySettings?.companyEmail || companySettings?.email || 'sale@tjshoes.com',
    company_address: companySettings?.company_address || companySettings?.companyAddress || companySettings?.address || 'Shop #1, Al-Rehman Arcade Oppositer Abdullah Masaala, Jatpat Mkt, Lyari, Khi',
    strn: companySettings?.strn || '',
    tax_id: companySettings?.tax_id || companySettings?.taxId || companySettings?.tax_number || companySettings?.taxNumber || 'NTN-1122',
    website: companySettings?.website || 'www.tjshoes.com',
    logo: companySettings?.logo || '',

    currency_name: companySettings?.currency_name || companySettings?.currencyName || 'Pakistani Rupee',
    currency_symbol: companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.',
    barcode_prefix: companySettings?.barcode_prefix || companySettings?.barcodePrefix || '9861234',
    purchase_prefix: companySettings?.purchase_prefix || companySettings?.purchasePrefix || 'PUR-',
    invoice_prefix: companySettings?.invoice_prefix || companySettings?.invoicePrefix || 'INV-',

    currency: companySettings?.currency || 'PKR',
    invoice_footer: companySettings?.invoice_footer || companySettings?.invoiceFooter || 'Exchanges accepted within 7 days with original sales receipt. Thank you for shopping with us!',
    low_stock_limit: companySettings?.low_stock_limit || companySettings?.lowStockLimit || 5,
    pricing_mode: (companySettings?.pricing_mode || companySettings?.pricingMode || 'NEGOTIABLE').toUpperCase(),
    fixed_profit_margin: companySettings?.fixed_profit_margin !== undefined ? Number(companySettings.fixed_profit_margin) : (companySettings?.fixedProfitMargin !== undefined ? Number(companySettings.fixedProfitMargin) : 30),
    fixed_profit_amount: companySettings?.fixed_profit_amount !== undefined ? Number(companySettings.fixed_profit_amount) : (companySettings?.fixedProfitAmount !== undefined ? Number(companySettings.fixedProfitAmount) : 0),
    min_profit_margin: companySettings?.min_profit_margin !== undefined ? Number(companySettings.min_profit_margin) : (companySettings?.minProfitMargin !== undefined ? Number(companySettings.minProfitMargin) : 15),
    min_profit_amount: companySettings?.min_profit_amount !== undefined ? Number(companySettings.min_profit_amount) : (companySettings?.minProfitAmount !== undefined ? Number(companySettings.minProfitAmount) : 0),
    max_profit_margin: companySettings?.max_profit_margin !== undefined ? Number(companySettings.max_profit_margin) : (companySettings?.maxProfitMargin !== undefined ? Number(companySettings.maxProfitMargin) : 30),
    max_profit_amount: companySettings?.max_profit_amount !== undefined ? Number(companySettings.max_profit_amount) : (companySettings?.maxProfitAmount !== undefined ? Number(companySettings.maxProfitAmount) : 0),
  });

  useEffect(() => {
    let mounted = true;
    api.settings.get().then((res) => {
      if (mounted && res?.settings) {
        const s = res.settings;
        setFormData({
          company_name: s?.company_name || s?.companyName || s?.name || '',
          company_phone: s?.company_phone || s?.companyPhone || s?.phone || '',
          company_email: s?.company_email || s?.companyEmail || s?.email || '',
          company_address: s?.company_address || s?.companyAddress || s?.address || '',
          strn: s?.strn || '',
          tax_id: s?.tax_id || s?.taxId || s?.tax_number || s?.taxNumber || '',
          website: s?.website || '',
          logo: s?.logo || '',

          currency_name: s?.currency_name || s?.currencyName || 'Pakistani Rupee',
          currency_symbol: s?.currency_symbol || s?.currencySymbol || 'Rs.',
          barcode_prefix: s?.barcode_prefix || s?.barcodePrefix || '9861234',
          purchase_prefix: s?.purchase_prefix || s?.purchasePrefix || 'PUR-',
          invoice_prefix: s?.invoice_prefix || s?.invoicePrefix || 'INV-',

          currency: s?.currency || 'PKR',
          invoice_footer: s?.invoice_footer || s?.invoiceFooter || '',
          low_stock_limit: s?.low_stock_limit || s?.lowStockLimit || 5,
          pricing_mode: (s?.pricing_mode || s?.pricingMode || 'NEGOTIABLE').toUpperCase(),
          fixed_profit_margin: s?.fixed_profit_margin !== undefined ? Number(s.fixed_profit_margin) : (s?.fixedProfitMargin !== undefined ? Number(s.fixedProfitMargin) : 30),
          fixed_profit_amount: s?.fixed_profit_amount !== undefined ? Number(s.fixed_profit_amount) : (s?.fixedProfitAmount !== undefined ? Number(s.fixedProfitAmount) : 0),
          min_profit_margin: s?.min_profit_margin !== undefined ? Number(s.min_profit_margin) : (s?.minProfitMargin !== undefined ? Number(s.minProfitMargin) : 15),
          min_profit_amount: s?.min_profit_amount !== undefined ? Number(s.min_profit_amount) : (s?.minProfitAmount !== undefined ? Number(s.minProfitAmount) : 0),
          max_profit_margin: s?.max_profit_margin !== undefined ? Number(s.max_profit_margin) : (s?.maxProfitMargin !== undefined ? Number(s.maxProfitMargin) : 30),
          max_profit_amount: s?.max_profit_amount !== undefined ? Number(s.max_profit_amount) : (s?.maxProfitAmount !== undefined ? Number(s.maxProfitAmount) : 0),
        });
      }
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (companySettings) {
      setFormData({
        company_name: companySettings?.company_name || companySettings?.companyName || companySettings?.name || '',
        company_phone: companySettings?.company_phone || companySettings?.companyPhone || companySettings?.phone || '',
        company_email: companySettings?.company_email || companySettings?.companyEmail || companySettings?.email || '',
        company_address: companySettings?.company_address || companySettings?.companyAddress || companySettings?.address || '',
        strn: companySettings?.strn || '',
        tax_id: companySettings?.tax_id || companySettings?.taxId || companySettings?.tax_number || companySettings?.taxNumber || '',
        website: companySettings?.website || '',
        logo: companySettings?.logo || '',

        currency_name: companySettings?.currency_name || companySettings?.currencyName || 'Pakistani Rupee',
        currency_symbol: companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.',
        barcode_prefix: companySettings?.barcode_prefix || companySettings?.barcodePrefix || '9861234',
        purchase_prefix: companySettings?.purchase_prefix || companySettings?.purchasePrefix || 'PUR-',
        invoice_prefix: companySettings?.invoice_prefix || companySettings?.invoicePrefix || 'INV-',

        currency: companySettings?.currency || 'PKR',
        invoice_footer: companySettings?.invoice_footer || companySettings?.invoiceFooter || '',
        low_stock_limit: companySettings?.low_stock_limit || companySettings?.lowStockLimit || 5,
        pricing_mode: (companySettings?.pricing_mode || companySettings?.pricingMode || 'NEGOTIABLE').toUpperCase(),
        fixed_profit_margin: companySettings?.fixed_profit_margin !== undefined ? Number(companySettings.fixed_profit_margin) : (companySettings?.fixedProfitMargin !== undefined ? Number(companySettings.fixedProfitMargin) : 30),
        fixed_profit_amount: companySettings?.fixed_profit_amount !== undefined ? Number(companySettings.fixed_profit_amount) : (companySettings?.fixedProfitAmount !== undefined ? Number(companySettings.fixedProfitAmount) : 0),
        min_profit_margin: companySettings?.min_profit_margin !== undefined ? Number(companySettings.min_profit_margin) : (companySettings?.minProfitMargin !== undefined ? Number(companySettings.minProfitMargin) : 15),
        min_profit_amount: companySettings?.min_profit_amount !== undefined ? Number(companySettings.min_profit_amount) : (companySettings?.minProfitAmount !== undefined ? Number(companySettings.minProfitAmount) : 0),
        max_profit_margin: companySettings?.max_profit_margin !== undefined ? Number(companySettings.max_profit_margin) : (companySettings?.maxProfitMargin !== undefined ? Number(companySettings.maxProfitMargin) : 30),
        max_profit_amount: companySettings?.max_profit_amount !== undefined ? Number(companySettings.max_profit_amount) : (companySettings?.maxProfitAmount !== undefined ? Number(companySettings.maxProfitAmount) : 0),
      });
    }
  }, [companySettings]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Users Management
  const [usersList, setUsersList] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteUserError, setDeleteUserError] = useState<string | null>(null);

  // Server Installation Status & Lockdown
  const [installStatus, setInstallStatus] = useState<any | null>(null);
  const [isLoadingInstallStatus, setIsLoadingInstallStatus] = useState(false);
  const [resetPasswordInput, setResetPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingInstall, setIsResettingInstall] = useState(false);
  const [isLockingInstall, setIsLockingInstall] = useState(false);
  const [dropTablesOnUnlock, setDropTablesOnUnlock] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Overall settings refresh state & guards
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const isRefreshingAllRef = useRef(false);
  const isRefreshingUsersRef = useRef(false);
  const isRefreshingInstallRef = useRef(false);

  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadInstallStatus();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      loadUsers();
    } else if (activeTab === 'install' && isAdmin) {
      loadInstallStatus();
    }
  }, [activeTab]);

  const loadInstallStatus = async () => {
    if (isRefreshingInstallRef.current) return;
    isRefreshingInstallRef.current = true;
    setIsLoadingInstallStatus(true);
    try {
      const res = await api.install.status();
      setInstallStatus(res);
    } catch (e) {
      console.error(e);
    } finally {
      isRefreshingInstallRef.current = false;
      setIsLoadingInstallStatus(false);
    }
  };

  const handleUnlockInstaller = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassword = resetPasswordInput.trim();
    if (!cleanPassword) return;
    setIsResettingInstall(true);
    setResetMessage(null);
    try {
      const email = currentUser?.email;
      const res = await api.install.reset(cleanPassword, email, dropTablesOnUnlock);
      setResetMessage({ type: 'success', text: res.message });
      setResetPasswordInput('');
      await loadInstallStatus();
      onSettingsUpdated();
    } catch (err: any) {
      setResetMessage({
        type: 'error',
        text: err.message || 'Unlock authorization failed: Invalid admin password.',
      });
    } finally {
      setIsResettingInstall(false);
    }
  };

  const handleDropTablesAndReinstall = async () => {
    const cleanPassword = resetPasswordInput.trim();
    if (!cleanPassword) {
      alert('Please enter your Admin / Store Owner password in the password field first to confirm this action.');
      return;
    }
    if (
      !window.confirm(
        '⚠️ CRITICAL WARNING: This will completely DROP ALL database tables (CASCADE) instead of just clearing row entries!\n\nAll tables, foreign keys, sequences, and schemas will be completely destroyed and recreated from scratch for a pristine reinstall.\n\nAre you sure you want to proceed?'
      )
    ) {
      return;
    }

    setIsResettingInstall(true);
    setResetMessage(null);
    try {
      const res = await api.install.dropTables(cleanPassword);
      setResetMessage({ type: 'success', text: res.message });
      setResetPasswordInput('');
      await loadInstallStatus();
      onSettingsUpdated();
      if (onOpenInstallWizard) {
        onOpenInstallWizard();
      } else {
        window.location.href = '/install';
      }
    } catch (err: any) {
      setResetMessage({
        type: 'error',
        text: err.message || 'Failed to drop tables. Check admin password.',
      });
    } finally {
      setIsResettingInstall(false);
    }
  };

  const handleLockInstaller = async () => {
    setIsLockingInstall(true);
    setResetMessage(null);
    try {
      const res = await api.install.lock();
      setResetMessage({ type: 'success', text: res.message });
      await loadInstallStatus();
      onSettingsUpdated();
    } catch (err: any) {
      setResetMessage({ type: 'error', text: err.message || 'Failed to lock installer route.' });
    } finally {
      setIsLockingInstall(false);
    }
  };

  const loadUsers = async () => {
    if (isRefreshingUsersRef.current) return;
    isRefreshingUsersRef.current = true;
    setIsLoadingUsers(true);
    try {
      const res = await api.settings.getUsers();
      setUsersList(res.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      isRefreshingUsersRef.current = false;
      setIsLoadingUsers(false);
    }
  };

  const handleGlobalRefresh = async () => {
    if (isRefreshingAllRef.current) return;
    isRefreshingAllRef.current = true;
    setIsRefreshingAll(true);
    try {
      const promises: Promise<any>[] = [Promise.resolve(onSettingsUpdated())];
      if (isAdmin) {
        promises.push(loadUsers(), loadInstallStatus());
      }
      await Promise.all(promises);
    } catch (err) {
      console.error('Settings refresh error:', err);
    } finally {
      isRefreshingAllRef.current = false;
      setIsRefreshingAll(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      errors.company_name = 'Company name is required.';
    }
    if (!formData.company_phone.trim()) {
      errors.company_phone = 'Company phone is required.';
    }
    if (formData.company_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.company_email.trim())) {
      errors.company_email = 'Please provide a valid email address (e.g., info@company.com).';
    }
    if (!formData.currency_name.trim()) {
      errors.currency_name = 'Currency name is required (e.g., "Pakistani Rupee", "US Dollar").';
    }
    if (!formData.currency_symbol.trim()) {
      errors.currency_symbol = 'Currency symbol is required (e.g., "Rs.", "$", "PKR").';
    }
    if (!/^\d{7}$/.test(formData.barcode_prefix.trim())) {
      errors.barcode_prefix = 'Barcode prefix must be strictly 7 numeric digits (e.g., 0108923 or 2000001).';
    }
    if (!formData.purchase_prefix.trim()) {
      errors.purchase_prefix = 'Purchase prefix is required (e.g., "PUR-").';
    }
    if (!formData.invoice_prefix.trim()) {
      errors.invoice_prefix = 'Invoice prefix is required (e.g., "INV-").';
    }
    if (formData.pricing_mode === 'FIXED') {
      if (formData.fixed_profit_margin === undefined || formData.fixed_profit_margin < 0) {
        errors.fixed_profit_margin = 'Fixed profit margin percentage cannot be negative.';
      }
      if (formData.fixed_profit_amount === undefined || formData.fixed_profit_amount < 0) {
        errors.fixed_profit_amount = 'Fixed profit margin amount cannot be negative.';
      }
    } else {
      if (formData.min_profit_margin === undefined || formData.min_profit_margin < 0) {
        errors.min_profit_margin = 'Minimum price margin cannot be negative.';
      }
      if (formData.max_profit_margin === undefined || formData.max_profit_margin < 0) {
        errors.max_profit_margin = 'Maximum price margin cannot be negative.';
      } else if (formData.max_profit_margin < formData.min_profit_margin) {
        errors.max_profit_margin = 'Maximum price margin cannot be less than minimum price margin.';
      }
      if (formData.min_profit_amount !== undefined && formData.min_profit_amount < 0) {
        errors.min_profit_amount = 'Minimum profit amount cannot be negative.';
      }
      if (formData.max_profit_amount !== undefined && formData.max_profit_amount < 0) {
        errors.max_profit_amount = 'Maximum profit amount cannot be negative.';
      } else if (
        formData.max_profit_amount !== undefined &&
        formData.min_profit_amount !== undefined &&
        formData.max_profit_amount > 0 &&
        formData.max_profit_amount < formData.min_profit_amount
      ) {
        errors.max_profit_amount = 'Maximum profit amount cannot be less than minimum profit amount.';
      }
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsSavingSettings(true);
    setSettingsSuccess(false);
    try {
      const updateRes = await api.settings.update(formData);
      setSettingsSuccess(true);
      await Promise.resolve(onSettingsUpdated(updateRes?.settings));
      setTimeout(() => setSettingsSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleUpdateUserStatus = async (id: number, status: 'APPROVED' | 'PENDING') => {
    try {
      await api.settings.updateUserStatus(id, status);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleUpdateUserRole = async (id: number, role: 'ADMIN' | 'CASHIER') => {
    try {
      await api.settings.updateUserRole(id, role);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    }
  };

  const handleOpenAddUserModal = () => {
    setIsAddUserModalOpen(true);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setDeleteUserError(null);
    try {
      await api.settings.deleteUser(userToDelete.id);
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      setDeleteUserError(err.message || 'Failed to delete staff account.');
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {/* Top Banner & Actions matching Product Management */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-purple-800/80 shadow-sm transition-colors dark:text-white"
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            System Settings &amp; Store Configuration
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/80 font-medium mt-0.5">
            Store profile, cashier staff access, receipt &amp; label printers, database backup, and server installer
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-purple-950/60 border border-slate-200 dark:border-purple-800/70 text-xs font-semibold text-slate-700 dark:text-purple-200 shadow-2xs">
            <Database className="w-3.5 h-3.5 text-blue-600 dark:text-purple-300" />
            <span className="font-mono text-xs">PostgreSQL 16 &bull;</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Online
            </span>
          </div>

          <button
            type="button"
            onClick={handleGlobalRefresh}
            disabled={isRefreshingAll}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            title={isRefreshingAll ? "Reloading settings..." : "Reload settings from database"}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-purple-300 ${isRefreshingAll ? 'animate-spin' : ''}`} />
            <span>{isRefreshingAll ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </motion.div>

      {/* Settings Tab Menu - Responsive Scrollable Underline Navigation */}
      <motion.div
        ref={settingsTabContainerRef}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        className="bg-white dark:bg-[#131B2E] px-3 sm:px-5 rounded-2xl border border-slate-200 dark:border-purple-900/60 shadow-sm transition-colors flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar scrollbar-none tab-scrollbar-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-thumb]:hidden [&::-webkit-scrollbar-track]:hidden border-b border-b-slate-200/90 dark:border-b-purple-900/80"
      >
        <button
          id="settings-tab-store"
          type="button"
          data-active={activeTab === 'store'}
          data-tab="store"
          onClick={() => setActiveTab('store')}
          className={`tab-underline-link relative px-3.5 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center space-x-2 whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'store'
              ? 'active text-purple-600 dark:text-purple-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
          }`}
        >
          <Store className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'store' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>Shop &amp; Invoice Settings</span>
          {activeTab === 'store' && (
            <motion.div
              layoutId="settingsActiveUnderline"
              className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            />
          )}
        </button>

        {isAdmin && (
          <button
            id="settings-tab-users"
            type="button"
            data-active={activeTab === 'users'}
            data-tab="users"
            onClick={() => setActiveTab('users')}
            className={`tab-underline-link relative px-3.5 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center space-x-2 whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'users'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <Users className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'users' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Cashier Approvals &amp; Staff</span>
            {usersList.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-colors duration-200 ${
                activeTab === 'users'
                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {usersList.length}
              </span>
            )}
            {activeTab === 'users' && (
              <motion.div
                layoutId="settingsActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>
        )}

        <button
          id="settings-tab-printers"
          type="button"
          data-active={activeTab === 'printers'}
          data-tab="printers"
          onClick={() => setActiveTab('printers')}
          className={`tab-underline-link relative px-3.5 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center space-x-2 whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'printers'
              ? 'active text-purple-600 dark:text-purple-400 font-bold'
              : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
          }`}
        >
          <Printer className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'printers' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>Hardware &amp; Printers</span>
          {activeTab === 'printers' && (
            <motion.div
              layoutId="settingsActiveUnderline"
              className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            />
          )}
        </button>

        {isAdmin && (
          <button
            id="settings-tab-backup"
            type="button"
            data-active={activeTab === 'backup'}
            data-tab="backup"
            onClick={() => setActiveTab('backup')}
            className={`tab-underline-link relative px-3.5 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center space-x-2 whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'backup'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <Database className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'backup' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Data Backup &amp; Restore</span>
            {activeTab === 'backup' && (
              <motion.div
                layoutId="settingsActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>
        )}

        {isAdmin && (
          <button
            id="settings-tab-install"
            type="button"
            data-active={activeTab === 'install'}
            data-tab="install"
            onClick={() => setActiveTab('install')}
            className={`tab-underline-link relative px-3.5 sm:px-4 py-3.5 text-xs sm:text-sm font-semibold transition-colors duration-300 flex items-center space-x-2 whitespace-nowrap cursor-pointer shrink-0 ${
              activeTab === 'install'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'install' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Server Installer &amp; Security</span>
            {activeTab === 'install' && (
              <motion.div
                layoutId="settingsActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>
        )}

        {/* Scroll End Buffer Spacer: Ensures the last tab is 100% visible and never clipped or flush against right edge */}
        <div className="tab-end-spacer shrink-0 w-8 sm:w-10 h-1 pointer-events-none self-stretch" aria-hidden="true" role="presentation" />
      </motion.div>

      {/* TAB 1: STORE & INVOICE SETTINGS */}
      {activeTab === 'store' && (
        <form onSubmit={handleSaveSettings} className="space-y-5">
          {settingsSuccess && (
            <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center space-x-3 shadow-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <span className="font-bold text-xs">Settings Saved Successfully!</span>
                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                  Company profile and store prefixes have been updated in PostgreSQL.
                </p>
              </div>
            </div>
          )}

          {Object.keys(formErrors).length > 0 && (
            <div className="p-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-start space-x-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold">Please fix the following issues:</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-rose-600/90 dark:text-rose-400/90">
                  {Object.values(formErrors).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* CARD 1: COMPANY PROFILE */}
          <div className="bg-white dark:bg-[#131B2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-purple-800/60 shadow-sm transition-colors">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-purple-900/40">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/20 border border-blue-100 dark:border-purple-400/30 text-blue-600 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Company Profile</h3>
                  <p className="text-xs text-slate-500 dark:text-purple-200/70 mt-0.5 font-normal">
                    Official business details, contact coordinates, and tax registrations
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-slate-100 dark:bg-purple-950/60 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60">
                Business Identity
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* company_name (Text, Required) */}
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Company Name <span className="text-rose-500 font-bold">*</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal text-[11px] ml-1.5">(company_name)</span>
                  </span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => {
                      setFormData({ ...formData, company_name: e.target.value });
                      if (formErrors.company_name) {
                        setFormErrors({ ...formErrors, company_name: '' });
                      }
                    }}
                    placeholder="e.g., TJ Shoes Collection"
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 font-bold text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formErrors.company_name
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    required
                  />
                </div>
                {formErrors.company_name && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.company_name}</p>
                )}
              </div>

              {/* company_phone (Text, Required) */}
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Company Phone <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.company_phone}
                    onChange={(e) => {
                      setFormData({ ...formData, company_phone: e.target.value });
                      if (formErrors.company_phone) {
                        setFormErrors({ ...formErrors, company_phone: '' });
                      }
                    }}
                    placeholder="e.g., +92-321-2257340"
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formErrors.company_phone
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    required
                  />
                </div>
                {formErrors.company_phone && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.company_phone}</p>
                )}
              </div>

              {/* company_email (Email format) */}
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Company Email
                 </span>
                 <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="email"
                    value={formData.company_email}
                    onChange={(e) => {
                      setFormData({ ...formData, company_email: e.target.value });
                      if (formErrors.company_email) {
                        setFormErrors({ ...formErrors, company_email: '' });
                      }
                    }}
                    placeholder="e.g., sale@tjshoes.com"
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formErrors.company_email
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>
                {formErrors.company_email && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.company_email}</p>
                )}
              </div>

              {/* strn (Text, Optional - Sales Tax Registration Number) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    STRN 
                  </label>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.strn}
                    onChange={(e) => setFormData({ ...formData, strn: e.target.value })}
                    placeholder="e.g., STRN-9876543-2"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#060B18]/90 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Sales Tax Registration across POS receipts</p>
              </div>

              {/* tax_id (Text, Optional - NTN / Tax ID) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Tax ID / NTN 
                  </label>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder="e.g., NTN-1234567-8"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#060B18]/90 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">National Tax Number / Business Tax ID</p>
              </div>

              {/* website (URL, Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Website
                  </label>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="e.g., https://www.shoepos.com"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#060B18]/90 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Logo URL */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Company Brand Logo URL
                  </label>
                 <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 rounded-full">
                    Optional
                  </span>
                </div>
                <div className="relative">
                  <Link className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    placeholder="https://images.unsplash.com/... or /logo.png"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#060B18]/90 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* company_address (Text) */}
              <div className="md:col-span-3">
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Company Address 
                  </span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.company_address}
                    onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                    placeholder="e.g., Shop #14, Royal Commercial Plaza, Saddar, Karachi"
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#060B18]/90 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: STORE PREFIXES & CURRENCY SETTINGS */}
          <div className="bg-white dark:bg-[#131B2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-purple-800/60 shadow-sm transition-colors">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-purple-900/40">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/20 border border-blue-100 dark:border-purple-400/30 text-blue-600 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Store Prefixes &amp; Currency Settings</h3>
                  <p className="text-xs text-slate-500 dark:text-purple-200/70 mt-0.5 font-normal">
                    System identifiers, currency parameters, and 7-digit barcode standards
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-slate-100 dark:bg-purple-950/60 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60">
                System Formats
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {/* currency_name (Text, Required) */}
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Currency Name <span className="text-rose-500 font-bold">*</span>
                 
                  </span>
                </label>
                <div className="relative">
                  <Coins className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.currency_name}
                    onChange={(e) => {
                      setFormData({ ...formData, currency_name: e.target.value });
                      if (formErrors.currency_name) {
                        setFormErrors({ ...formErrors, currency_name: '' });
                      }
                    }}
                    placeholder='e.g., "Pakistani Rupee", "US Dollar"'
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 font-medium text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formErrors.currency_name
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    required
                  />
                </div>
                {formErrors.currency_name && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.currency_name}</p>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Full title for reports &amp; vouchers</p>
              </div>

              {/* currency_symbol (Text, Required) */}
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Currency Symbol <span className="text-rose-500 font-bold">*</span>
                 
                  </span>
                </label>
                <div className="relative">
                  <span className="font-bold text-slate-400 absolute left-3.5 top-3 text-xs pointer-events-none">₨</span>
                  <input
                    type="text"
                    value={formData.currency_symbol}
                    onChange={(e) => {
                      setFormData({ ...formData, currency_symbol: e.target.value });
                      if (formErrors.currency_symbol) {
                        setFormErrors({ ...formErrors, currency_symbol: '' });
                      }
                    }}
                    placeholder='e.g., "Rs.", "$", "PKR"'
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 font-bold font-mono text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formErrors.currency_symbol
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    required
                  />
                </div>
                {formErrors.currency_symbol && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.currency_symbol}</p>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Printed on POS receipts &amp; invoice totals</p>
              </div>

              {/* barcode_prefix (Strictly 7 Digits with Live Barcode SVG Visual) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Barcode Prefix <span className="text-rose-500 font-bold">*</span>
                 
                  </label>
                  <span
                    className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      formData.barcode_prefix.length === 7
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60'
                        : 'bg-amber-950/80 text-amber-400 border-amber-800/60'
                    }`}
                  >
                    {formData.barcode_prefix.length} / 7 digits
                  </span>
                </div>
                <div className="relative flex items-center">
                  <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none z-10" />
                  <input
                    type="text"
                    value={formData.barcode_prefix}
                    maxLength={7}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 7);
                      setFormData({ ...formData, barcode_prefix: digitsOnly });
                      if (formErrors.barcode_prefix && digitsOnly.length === 7) {
                        setFormErrors({ ...formErrors, barcode_prefix: '' });
                      }
                    }}
                    placeholder="8961234"
                    className={`w-full h-11 pl-10 pr-24 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 font-mono font-bold tracking-wider text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formData.barcode_prefix.length === 7
                        ? 'border-emerald-600/80 dark:border-emerald-500/70 focus:ring-2 focus:ring-emerald-500/20'
                        : formErrors.barcode_prefix
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500'
                    }`}
                    required
                  />
                  {formData.barcode_prefix.length === 7 && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none opacity-85 overflow-hidden max-w-[85px]">
                      <BarcodeSvg
                        value={`${formData.barcode_prefix}`}
                        format="CODE128"
                        width={1}
                        height={24}
                        displayValue={false}
                      />
                    </div>
                  )}
                </div>
                {formErrors.barcode_prefix ? (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5 font-medium">{formErrors.barcode_prefix}</p>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                    Strictly 7 prefix. 13-digit barcode format:{' '}
                    <span className="font-mono font-bold text-blue-500 dark:text-blue-400">{formData.barcode_prefix || '9861234'}</span>{' '}
                    (7D) + <span className="font-mono font-bold text-slate-700 dark:text-slate-300">9861234</span> (5D) +{' '}
                    <span className="font-mono font-bold text-emerald-500 dark:text-emerald-400">Check Digit</span>
                  </p>
                )}
              </div>

              {/* purchase_prefix (Text, Required) */}
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Purchase Order Prefix <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <div className="relative">
                  <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.purchase_prefix}
                    onChange={(e) => {
                      setFormData({ ...formData, purchase_prefix: e.target.value });
                      if (formErrors.purchase_prefix) {
                        setFormErrors({ ...formErrors, purchase_prefix: '' });
                      }
                    }}
                    placeholder='e.g., "PUR-"'
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 font-mono font-bold text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formErrors.purchase_prefix
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    required
                  />
                </div>
                {formErrors.purchase_prefix && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.purchase_prefix}</p>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">e.g., {formData.purchase_prefix || 'PUR-'}2026-0001</p>
              </div>

              {/* invoice_prefix (Text, Required) */}
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>
                    Sales Invoice Prefix <span className="text-rose-500 font-bold">*</span>
                  </span>
                </label>
                <div className="relative">
                  <Receipt className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.invoice_prefix}
                    onChange={(e) => {
                      setFormData({ ...formData, invoice_prefix: e.target.value });
                      if (formErrors.invoice_prefix) {
                        setFormErrors({ ...formErrors, invoice_prefix: '' });
                      }
                    }}
                    placeholder='e.g., "INV-", "REC-" '
                    className={`w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 font-mono font-bold text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all ${
                      formErrors.invoice_prefix
                        ? 'border-rose-400 ring-2 ring-rose-500/20 bg-rose-50/10'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                    required
                  />
                </div>
                {formErrors.invoice_prefix && (
                  <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.invoice_prefix}</p>
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">e.g., {formData.invoice_prefix || 'INV-'}9861234</p>
              </div>

              {/* Low Stock Limit */}
              <div>
                <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>Low Stock Threshold</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.low_stock_limit}
                  onChange={(e) => setFormData({ ...formData, low_stock_limit: parseInt(e.target.value, 10) || 1 })}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#060B18]/90 text-xs font-bold font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">Alerts POS when quantity falls at or below this limit</p>
              </div>
            </div>

            {/* Receipt Footer Note */}
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-purple-900/40">
              <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                <span>Receipt &amp; Invoice Footer Terms / Return Policy</span>
              </label>
              <textarea
                rows={3}
                value={formData.invoice_footer}
                onChange={(e) => setFormData({ ...formData, invoice_footer: e.target.value })}
                placeholder="Exchanges accepted within 7 days with original sales slip..."
                className="w-full p-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#060B18]/90 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 outline-none transition-all focus:border-blue-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-purple-500/20"
              />
            </div>
          </div>

          {/* CARD 3: PRICING POLICY (Fixed Price vs. Negotiable Price) */}
          <div className="bg-white dark:bg-[#131B2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-purple-800/60 shadow-sm transition-colors">
            {/* Card Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 dark:border-purple-900/40 gap-3">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/20 border border-purple-100 dark:border-purple-400/30 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-2xs">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Pricing Policy</h3>
                  <p className="text-xs text-slate-500 dark:text-purple-200/70 mt-0.5 font-normal">
                    Select your retail pricing rule to calculate barcode tag prices and POS checkout limits
                  </p>
                </div>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-xl border ${
                formData.pricing_mode === 'FIXED'
                  ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60'
              }`}>
                Active Policy: {formData.pricing_mode === 'FIXED' ? 'Fixed Price' : 'Negotiable Price'}
              </span>
            </div>

            {/* TWO TABS BELOW CARD HEADER */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-[#0A0F1E] rounded-xl border border-slate-200 dark:border-slate-800 mb-6 max-w-md">
              <button
                type="button"
                id="pricing-policy-tab-fixed"
                onClick={() => setFormData({ ...formData, pricing_mode: 'FIXED' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  formData.pricing_mode === 'FIXED'
                    ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>1 Fixed Price</span>
              </button>

              <button
                type="button"
                id="pricing-policy-tab-negotiable"
                onClick={() => setFormData({ ...formData, pricing_mode: 'NEGOTIABLE' })}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  formData.pricing_mode === 'NEGOTIABLE'
                    ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>2 Negotiable Price</span>
              </button>
            </div>

            {/* TAB 1 CONTENT: FIXED PRICING (PERCENTAGE + FIXED AMOUNT PROFIT MARGIN) */}
            {formData.pricing_mode === 'FIXED' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
                  {/* Input 1: Profit Margin (%) */}
                  <div>
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                      <span>
                        Default Profit Margin (%) <span className="text-rose-500 font-bold">*</span>
                      </span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium font-mono">
                        Cost + {formData.fixed_profit_margin}%
                      </span>
                    </label>
                    <div className="relative">
                      <Percent className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                      <input
                        id="setting-fixed-profit-margin"
                        type="number"
                        min="0"
                        max="1000"
                        step="1"
                        value={formData.fixed_profit_margin}
                        onChange={(e) => {
                          const val = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
                          setFormData({ ...formData, fixed_profit_margin: val });
                          if (formErrors.fixed_profit_margin) {
                            setFormErrors({ ...formErrors, fixed_profit_margin: '' });
                          }
                        }}
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 text-xs font-bold font-mono text-slate-900 dark:text-white outline-none transition-all border-slate-300 dark:border-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                        placeholder="e.g. 30"
                      />
                    </div>
                    {formErrors.fixed_profit_margin && (
                      <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.fixed_profit_margin}</p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                      Percentage markup applied on procurement cost.
                    </p>
                  </div>

                  {/* Input 2: Fixed Amount Profit Margin */}
                  <div>
                    <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                      <span>
                        Default Fixed Profit Amount ({formData.currency_symbol}) <span className="text-rose-500 font-bold">*</span>
                      </span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium font-mono">
                        +{formData.currency_symbol} {formData.fixed_profit_amount || 0}
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3.5 text-xs font-bold text-slate-400 font-mono">
                        {formData.currency_symbol}
                      </span>
                      <input
                        id="setting-fixed-profit-amount"
                        type="number"
                        min="0"
                        step="1"
                        value={formData.fixed_profit_amount}
                        onChange={(e) => {
                          const val = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
                          setFormData({ ...formData, fixed_profit_amount: val });
                          if (formErrors.fixed_profit_amount) {
                            setFormErrors({ ...formErrors, fixed_profit_amount: '' });
                          }
                        }}
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl border bg-slate-50 dark:bg-[#060B18]/90 text-xs font-bold font-mono text-slate-900 dark:text-white outline-none transition-all border-slate-300 dark:border-slate-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                        placeholder="e.g. 300"
                      />
                    </div>
                    {formErrors.fixed_profit_amount && (
                      <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.fixed_profit_amount}</p>
                    )}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                      Fixed cash margin amount per shoe pair (e.g., flat {formData.currency_symbol} 300 profit).
                    </p>
                  </div>
                </div>

                {/* Calculation Rule & Live Preview */}
                <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Automated Fixed Pricing &amp; Product Overrides</span>
                  </div>
                  <p className="text-[11.5px] text-purple-800/90 dark:text-purple-300/90 leading-relaxed">
                    When adding or editing a product, entering the Cost Price automatically calculates both the <strong>Profit Margin (%)</strong> and <strong>Fixed Profit Amount</strong> based on your store defaults. Users can freely override either the percentage, fixed amount, or final selling price for any individual shoe.
                  </p>
                  <div className="mt-2 pt-2 border-t border-purple-200/80 dark:border-purple-800/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-purple-950 dark:text-purple-200">
                    <div className="bg-white dark:bg-purple-900/60 p-2 rounded-lg border border-purple-200 dark:border-purple-700/80">
                      <span className="text-[10px] block font-bold text-purple-700 dark:text-purple-300 uppercase">Via Margin Percentage:</span>
                      <span>Cost 1,000 + {formData.fixed_profit_margin}% = </span>
                      <strong className="text-purple-900 dark:text-purple-100">{formData.currency_symbol} {Math.round(1000 * (1 + (formData.fixed_profit_margin || 0) / 100)).toLocaleString()}</strong>
                    </div>
                    <div className="bg-white dark:bg-purple-900/60 p-2 rounded-lg border border-purple-200 dark:border-purple-700/80">
                      <span className="text-[10px] block font-bold text-purple-700 dark:text-purple-300 uppercase">Via Fixed Profit Amount:</span>
                      <span>Cost 1,000 + {formData.currency_symbol}{formData.fixed_profit_amount || 0} = </span>
                      <strong className="text-purple-900 dark:text-purple-100">{formData.currency_symbol} {Math.round(1000 + (formData.fixed_profit_amount || 0)).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2 CONTENT: NEGOTIABLE PRICING (MIN/MAX PERCENTAGE + MIN/MAX FIXED AMOUNT) */}
            {formData.pricing_mode === 'NEGOTIABLE' && (
              <div className="space-y-5">
                {/* 1. Floor Pricing Limits */}
                <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-200/60 dark:border-amber-800/40">
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span>1. Minimum Sale Price (POS Floor Checkout Limits)</span>
                    </span>
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono font-bold">
                      Cashier Floor Negotiation Limit
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Minimum Profit Margin (%) */}
                    <div>
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                        <span>
                          Default Min Profit Margin (%) <span className="text-rose-500 font-bold">*</span>
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium font-mono">
                          Cost + {formData.min_profit_margin}%
                        </span>
                      </label>
                      <div className="relative">
                        <Percent className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                        <input
                          id="setting-min-profit-margin"
                          type="number"
                          min="0"
                          max="1000"
                          step="1"
                          value={formData.min_profit_margin}
                          onChange={(e) => {
                            const val = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
                            setFormData({ ...formData, min_profit_margin: val });
                            if (formErrors.min_profit_margin) {
                              setFormErrors({ ...formErrors, min_profit_margin: '' });
                            }
                          }}
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border bg-white dark:bg-[#060B18]/90 text-xs font-bold font-mono text-slate-900 dark:text-white outline-none transition-all border-slate-300 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                          placeholder="e.g. 15"
                        />
                      </div>
                      {formErrors.min_profit_margin && (
                        <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.min_profit_margin}</p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        Minimum markup floor allowed during POS cart negotiation.
                      </p>
                    </div>

                    {/* Minimum Fixed Profit Amount */}
                    <div>
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                        <span>
                          Default Min Fixed Profit Amount ({formData.currency_symbol}) <span className="text-rose-500 font-bold">*</span>
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium font-mono">
                          +{formData.currency_symbol} {formData.min_profit_amount || 0}
                        </span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3.5 text-xs font-bold text-slate-400 font-mono">
                          {formData.currency_symbol}
                        </span>
                        <input
                          id="setting-min-profit-amount"
                          type="number"
                          min="0"
                          step="1"
                          value={formData.min_profit_amount}
                          onChange={(e) => {
                            const val = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
                            setFormData({ ...formData, min_profit_amount: val });
                            if (formErrors.min_profit_amount) {
                              setFormErrors({ ...formErrors, min_profit_amount: '' });
                            }
                          }}
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border bg-white dark:bg-[#060B18]/90 text-xs font-bold font-mono text-slate-900 dark:text-white outline-none transition-all border-slate-300 dark:border-slate-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                          placeholder="e.g. 150"
                        />
                      </div>
                      {formErrors.min_profit_amount && (
                        <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.min_profit_amount}</p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        Minimum cash margin floor (e.g. at least {formData.currency_symbol} 150 net profit per pair).
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Maximum Sticker MRP Pricing Limits */}
                <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/50 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60 dark:border-indigo-800/40">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span>2. Maximum Sale Price (Sticker Tag M.R.P. &amp; Starting Price)</span>
                    </span>
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-mono font-bold">
                      Tag MRP Printed on Barcode Label
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Maximum Profit Margin (%) */}
                    <div>
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                        <span>
                          Default Max Profit Margin (%) <span className="text-rose-500 font-bold">*</span>
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium font-mono">
                          Tag: Cost + {formData.max_profit_margin}%
                        </span>
                      </label>
                      <div className="relative">
                        <Percent className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                        <input
                          id="setting-max-profit-margin"
                          type="number"
                          min="0"
                          max="1000"
                          step="1"
                          value={formData.max_profit_margin}
                          onChange={(e) => {
                            const val = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
                            setFormData({ ...formData, max_profit_margin: val });
                            if (formErrors.max_profit_margin) {
                              setFormErrors({ ...formErrors, max_profit_margin: '' });
                            }
                          }}
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border bg-white dark:bg-[#060B18]/90 text-xs font-bold font-mono text-slate-900 dark:text-white outline-none transition-all border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="e.g. 30"
                        />
                      </div>
                      {formErrors.max_profit_margin && (
                        <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.max_profit_margin}</p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        Tag price markup printed on barcode stickers: Cost Price + Maximum Profit Margin.
                      </p>
                    </div>

                    {/* Maximum Fixed Profit Amount */}
                    <div>
                      <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                        <span>
                          Default Max Fixed Profit Amount ({formData.currency_symbol}) <span className="text-rose-500 font-bold">*</span>
                        </span>
                        <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium font-mono">
                          +{formData.currency_symbol} {formData.max_profit_amount || 0}
                        </span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-3.5 text-xs font-bold text-slate-400 font-mono">
                          {formData.currency_symbol}
                        </span>
                        <input
                          id="setting-max-profit-amount"
                          type="number"
                          min="0"
                          step="1"
                          value={formData.max_profit_amount}
                          onChange={(e) => {
                            const val = Math.max(0, Math.round(parseFloat(e.target.value) || 0));
                            setFormData({ ...formData, max_profit_amount: val });
                            if (formErrors.max_profit_amount) {
                              setFormErrors({ ...formErrors, max_profit_amount: '' });
                            }
                          }}
                          className="w-full h-11 pl-10 pr-3.5 rounded-xl border bg-white dark:bg-[#060B18]/90 text-xs font-bold font-mono text-slate-900 dark:text-white outline-none transition-all border-slate-300 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                          placeholder="e.g. 500"
                        />
                      </div>
                      {formErrors.max_profit_amount && (
                        <p className="text-rose-600 dark:text-rose-400 text-[11px] mt-1.5">{formErrors.max_profit_amount}</p>
                      )}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
                        Maximum cash margin for sticker tag (e.g. flat +{formData.currency_symbol} 500 profit).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Calculation Rule & Live Preview */}
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span>Automated Negotiable Pricing &amp; Range Overrides</span>
                  </div>
                  <p className="text-[11.5px] text-indigo-800/90 dark:text-indigo-300/90 leading-relaxed">
                    When Negotiable Price policy is selected, new products calculate their default floor and maximum sticker price based on either margins or fixed cash profit amounts. Cashiers negotiate within the product's saved range at checkout, and users can override either the percentage, fixed amount, or final min/max prices when adding or editing products.
                  </p>
                  <div className="mt-2 pt-2 border-t border-indigo-200/80 dark:border-indigo-800/40 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-indigo-950 dark:text-indigo-200">
                    <div className="bg-white dark:bg-indigo-900/60 p-2 rounded-lg border border-indigo-200 dark:border-indigo-700/80">
                      <span className="text-[10px] block font-bold text-indigo-700 dark:text-indigo-300 uppercase">Via Margin Percentages:</span>
                      <div>Cost 1,000 &rarr; Floor: <strong>{formData.currency_symbol} {Math.round(1000 * (1 + (formData.min_profit_margin || 0) / 100)).toLocaleString()}</strong></div>
                      <div>Cost 1,000 &rarr; Tag MRP: <strong>{formData.currency_symbol} {Math.round(1000 * (1 + (formData.max_profit_margin || 0) / 100)).toLocaleString()}</strong></div>
                    </div>
                    <div className="bg-white dark:bg-indigo-900/60 p-2 rounded-lg border border-indigo-200 dark:border-indigo-700/80">
                      <span className="text-[10px] block font-bold text-indigo-700 dark:text-indigo-300 uppercase">Via Fixed Profit Amounts:</span>
                      <div>Cost 1,000 &rarr; Floor: <strong>{formData.currency_symbol} {Math.round(1000 + (formData.min_profit_amount || 0)).toLocaleString()}</strong></div>
                      <div>Cost 1,000 &rarr; Tag MRP: <strong>{formData.currency_symbol} {Math.round(1000 + (formData.max_profit_amount || 0)).toLocaleString()}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
              <span>Fields marked with</span>
              <span className="text-rose-500 font-bold">*</span>
              <span>are strictly required before saving.</span>
            </div>
            <button
              type="submit"
              disabled={isSavingSettings}
              className="w-full sm:w-auto bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 dark:from-purple-600 dark:to-indigo-600 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] font-bold text-xs px-6 py-2.5 rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition-all disabled:opacity-50 active:scale-95"
            >
              {isSavingSettings ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Company &amp; Prefix Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: USERS & CASHIER APPROVALS */}
      {activeTab === 'users' && isAdmin && (
        <div className="bg-white dark:bg-[#131B2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-purple-800/60 shadow-sm space-y-5 transition-colors">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 dark:border-purple-900/40 gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-100 dark:border-purple-400/30 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Staff &amp; Cashier Authorizations</h3>
                <p className="text-slate-500 dark:text-purple-200/70 text-xs mt-0.5">
                  Authorized Administrators can create and provision cashier or admin accounts directly, and manage active staff permissions.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                id="create-staff-user-btn"
                onClick={handleOpenAddUserModal}
                className="btn-pure-white px-3.5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white font-bold rounded-xl text-xs cursor-pointer transition shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] border border-purple-400/40 flex items-center space-x-1.5"
                style={{ color: '#ffffff' }}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Create Cashier / Admin</span>
              </button>
              <button
                type="button"
                onClick={loadUsers}
                disabled={isLoadingUsers}
                title={isLoadingUsers ? "Refreshing users..." : "Refresh List"}
                className="px-3.5 py-2.5 bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center space-x-1.5 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 dark:text-purple-300 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                <span>Refresh List</span>
              </button>
            </div>
          </div>

          <div className="border border-slate-200 dark:border-purple-800/60 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 text-slate-700 dark:text-white font-bold border-b border-slate-200 dark:border-purple-800/80 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Staff Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Access Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {isLoadingUsers ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                        <p className="font-medium text-xs">Loading staff accounts...</p>
                      </div>
                    </td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      No staff accounts found.
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => {
                  const isPending = u.status === 'PENDING';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-purple-950/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center space-x-2.5">
                          <UserAvatar
                            name={u.name}
                            avatarUrl={u.avatarUrl || u.avatar_url}
                            role={u.role}
                            size="sm"
                          />
                          <span className="truncate">{u.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-purple-200/80">{u.email}</td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-mono text-xs">{u.phone || '-'}</td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value as any)}
                          className="px-2.5 py-1.5 bg-slate-50 dark:bg-purple-500/20 border border-slate-300 dark:border-purple-400/40 text-slate-900 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] rounded-lg font-semibold text-xs focus:border-blue-500 dark:focus:border-purple-400 outline-none cursor-pointer"
                        >
                          <option value="CASHIER" className="dark:bg-[#120726] dark:text-purple-100">CASHIER</option>
                          <option value="ADMIN" className="dark:bg-[#120726] dark:text-purple-100">ADMIN</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] ${
                            isPending
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {isPending ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateUserStatus(u.id, 'APPROVED')}
                              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 px-3 py-1.5 font-bold rounded-lg cursor-pointer text-xs shadow-md shadow-purple-600/25 dark:shadow-[0_0_12px_rgba(147,51,234,0.3)] transition-all hover:scale-105 active:scale-95"
                            >
                              Approve
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpdateUserStatus(u.id, 'PENDING')}
                              className="bg-slate-100 hover:bg-slate-200 dark:bg-purple-950/40 text-slate-700 dark:text-purple-200 hover:text-slate-900 border border-slate-200 dark:border-purple-800/60 px-3 py-1.5 font-semibold rounded-lg cursor-pointer text-xs transition-colors"
                            >
                              Suspend
                            </button>
                          )}

                          {(() => {
                            const isSelf =
                              (currentUser?.id && u.id && Number(currentUser.id) === Number(u.id)) ||
                              (currentUser?.email && u.email && currentUser.email.trim().toLowerCase() === u.email.trim().toLowerCase());

                            return isSelf ? (
                              <button
                                type="button"
                                disabled
                                title="You cannot delete your own active logged-in administrator account"
                                className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteUserError(null);
                                  setUserToDelete(u);
                                }}
                                title={`Delete account for ${u.name}`}
                                className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/60 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>

          {/* Add Staff / Cashier Modal */}
          <AnimatePresence>
            {isAddUserModalOpen && (
              <CreateStaffModal
                isOpen={isAddUserModalOpen}
                onClose={() => setIsAddUserModalOpen(false)}
                onUserCreated={loadUsers}
              />
            )}
          </AnimatePresence>

          {/* Delete Staff / Cashier / Admin Confirmation Modal */}
          <AnimatePresence>
            {userToDelete && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
                onClick={() => !isDeletingUser && setUserToDelete(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 16 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl border border-slate-200 dark:border-purple-800/80 w-full max-w-md overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 border-b border-slate-200 dark:border-purple-800/80 text-slate-800 dark:text-white px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:bg-purple-500/20 dark:text-purple-300 border border-blue-500/20 dark:border-purple-400/30 flex items-center justify-center font-bold shadow-2xs">
                        <Trash2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">Delete Staff Account</h3>
                        <p className="text-xs text-slate-500 dark:text-purple-200/80">Permanent removal of staff member access</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => !isDeletingUser && setUserToDelete(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:text-purple-300 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="p-5 space-y-4 text-xs">
                    {deleteUserError && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>{deleteUserError}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-3 p-3 bg-slate-50 dark:bg-purple-950/20 border border-slate-200 dark:border-purple-900/40 rounded-xl">
                      <UserAvatar
                        name={userToDelete.name}
                        avatarUrl={userToDelete.avatarUrl || userToDelete.avatar_url}
                        role={userToDelete.role}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {userToDelete.name}
                        </h4>
                        <p className="text-slate-500 dark:text-purple-200/70 font-mono text-[11px] truncate">
                          {userToDelete.email}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          userToDelete.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {userToDelete.role}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                      Are you sure you want to permanently delete this account for{' '}
                      <strong className="text-slate-900 dark:text-white font-bold">"{userToDelete.name}"</strong>?
                      This user will immediately lose access to the system and POS register.
                    </p>

                    {userToDelete.role === 'ADMIN' && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                        <span>
                          <strong>Administrator Account Notice:</strong> Ensure at least one other active Administrator account remains in the system to prevent administrative lockout.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3.5 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-100 dark:border-purple-800/80 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => setUserToDelete(null)}
                      disabled={isDeletingUser}
                      className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteUser}
                      disabled={isDeletingUser}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white text-xs font-bold shadow-xs shadow-rose-500/25 transition cursor-pointer disabled:opacity-50"
                    >
                      {isDeletingUser ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Deleting Account...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Confirm Delete</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 3: HARDWARE & PRINTERS */}
      {activeTab === 'printers' && (
        <div className="bg-white dark:bg-[#131B2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-purple-800/60 shadow-sm transition-colors">
          <PrinterHardwareSettings />
        </div>
      )}

      {/* TAB: DATABASE BACKUP & SAFETY RESTORE */}
      {activeTab === 'backup' && isAdmin && (
        <DataBackupRestore
          currentUser={currentUser}
          companySettings={companySettings}
          onDataRestored={onSettingsUpdated}
        />
      )}

      {/* TAB 5: SERVER INSTALLER & ROUTE LOCKDOWN */}
      {activeTab === 'install' && (
        <div className="bg-white dark:bg-[#131B2E] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-purple-800/60 shadow-sm space-y-6 transition-colors">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-purple-900/40 pb-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-100 dark:border-purple-400/30 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Server Commissioning &amp; Route Lockout Security</h3>
                <p className="text-slate-500 dark:text-purple-200/70 text-xs mt-0.5">
                  Manage first-time setup installer state, route lockdown guard, and retail recommissioning.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadInstallStatus}
              disabled={isLoadingInstallStatus}
              title={isLoadingInstallStatus ? "Refreshing status..." : "Refresh Status"}
              className="px-3.5 py-2.5 bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInstallStatus ? 'animate-spin text-blue-600 dark:text-purple-300' : 'text-blue-600 dark:text-purple-300'}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Security Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl border space-y-1.5 ${
              installStatus?.isInstalled
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/60'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                installStatus?.isInstalled ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'
              }`}>
                Installer Route Guard
              </span>
              <div className="flex items-center gap-2">
                {installStatus?.isInstalled ? (
                  <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                )}
                <span className={`font-bold text-xs ${
                  installStatus?.isInstalled ? 'text-emerald-950 dark:text-emerald-100' : 'text-amber-950 dark:text-amber-100'
                }`}>
                  {installStatus?.isInstalled ? 'SECURELY LOCKED (403)' : 'UNLOCKED (Setup Ready)'}
                </span>
              </div>
              <p className={`text-[11px] ${
                installStatus?.isInstalled ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
              }`}>
                {installStatus?.isInstalled
                  ? 'Setup endpoint /api/install/setup is protected against unauthorized re-initialization.'
                  : 'Installer is currently unlocked and ready for execution.'}
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-slate-50 dark:bg-purple-950/30 border-slate-200 dark:border-purple-800/60 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-600 dark:text-purple-300 uppercase tracking-wider block">Database Health</span>
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600 dark:text-purple-400" />
                <span className="font-bold text-slate-900 dark:text-white text-xs">
                  {installStatus?.isStandardPostgres ? 'PostgreSQL Server (Standard)' : (installStatus?.dbType || 'PostgreSQL Connected')}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-purple-200/70 truncate" title={installStatus?.dbHost}>
                {installStatus?.dbHost ? `${installStatus.dbHost} (${installStatus.dbName || 'neondb'})` : `Active admin accounts: ${installStatus?.adminCount || 1}`}
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-slate-50 dark:bg-purple-950/30 border-slate-200 dark:border-purple-800/60 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-600 dark:text-purple-300 uppercase tracking-wider block">Provisioned Store</span>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-blue-600 dark:text-purple-400" />
                <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                  {installStatus?.storeName || companySettings?.name || 'Shoe Shop POS'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-purple-200/70">
                Currency: {companySettings?.currency || 'PKR'} ({companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.'})
              </p>
            </div>
          </div>

          {/* Quick Action: Open Install Wizard Preview */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-purple-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs border border-slate-200 dark:border-purple-800/60">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-purple-300" />
                <span className="font-bold text-xs text-slate-900 dark:text-white">Setup Wizard Interface</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-purple-200/70">
                Launch the setup wizard interface to preview the first-time setup flow or re-verify store profile steps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onOpenInstallWizard) {
                  onOpenInstallWizard();
                } else {
                  window.location.href = '/install';
                }
              }}
              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 font-bold text-xs py-2.5 px-4 rounded-xl shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] transition-all shrink-0 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <span>Open Setup Wizard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Recommissioning & Unlock Installer Form */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-purple-800/60 bg-slate-50 dark:bg-purple-950/20 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-100 dark:border-purple-400/30 flex items-center justify-center font-bold shrink-0 mt-0.5">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Server Recommissioning &amp; Installer Lockout</h4>
                  <p className="text-xs text-slate-600 dark:text-purple-200/70 mt-0.5">
                    Unlock the installation wizard to reconfigure store defaults or migrate to a new branch.
                    Requires verification using an approved Administrator or Store Owner password.
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                  installStatus?.isInstalled
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse'
                }`}
              >
                {installStatus?.isInstalled ? 'Guard: Locked' : 'Guard: Unlocked'}
              </span>
            </div>

            {resetMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  resetMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}
              >
                {resetMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{resetMessage.text}</span>
              </div>
            )}

            {!installStatus?.isInstalled ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>The Setup Wizard is currently UNLOCKED and ready to run!</span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300">
                  You can now re-run the setup wizard, change shop currency, create cashiers, or update branch details.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenInstallWizard) {
                        onOpenInstallWizard();
                      } else {
                        window.location.href = '/install';
                      }
                    }}
                    className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/25 active:scale-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Setup Wizard Now</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDropTablesAndReinstall}
                    disabled={isResettingInstall}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Drop Tables &amp; Fresh Reinstall</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLockInstaller}
                    disabled={isLockingInstall}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isLockingInstall ? 'Securing...' : 'Re-Lock Route (Production Mode)'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUnlockInstaller} className="space-y-3 max-w-xl">
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>Authorizing account:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {currentUser?.email || 'Store Owner (admin@shoepos.com)'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type={showResetPassword ? 'text' : 'password'}
                      placeholder="Enter Store Owner / Admin password"
                      value={resetPasswordInput}
                      onChange={(e) => setResetPasswordInput(e.target.value)}
                      className="w-full h-11 pl-3.5 pr-9 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isResettingInstall || !resetPasswordInput}
                    className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 font-bold px-5 h-11 rounded-xl text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] shrink-0 active:scale-95"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>{isResettingInstall ? 'Verifying...' : 'Unlock Install Wizard'}</span>
                  </button>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800/80">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dropTablesOnUnlock}
                      onChange={(e) => setDropTablesOnUnlock(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 border-slate-300 dark:border-slate-700 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1 font-medium">
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      Also DROP ALL tables on unlock (Clean wipe)
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleDropTablesAndReinstall}
                    disabled={isResettingInstall || !resetPasswordInput}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-500 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Direct Drop &amp; Reinstall</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
