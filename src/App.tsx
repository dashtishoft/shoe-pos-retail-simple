import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { api, getAuthToken, removeAuthToken } from './services/api.ts';
import { Header } from './components/common/Header.tsx';
import { Sidebar } from './components/common/Sidebar.tsx';
import { PosTerminal } from './components/pos/PosTerminal.tsx';
import { ProductManagement } from './components/inventory/ProductManagement.tsx';
import { StockLedgerView } from './components/inventory/StockLedgerView.tsx';
import { PurchaseManagement } from './components/purchases/PurchaseManagement.tsx';
import { SalesReturnView } from './components/returns/SalesReturnView.tsx';
import { CustomerManagement } from './components/customers/CustomerManagement.tsx';
import { ReportsDashboard } from './components/reports/ReportsDashboard.tsx';
import { SettingsView } from './components/settings/SettingsView.tsx';
import { SupplierManagement } from './components/suppliers/SupplierManagement.tsx';
import { DashboardOverview } from './components/dashboard/DashboardOverview.tsx';
import { AuthModal } from './components/auth/AuthModal.tsx';
import { UserProfileModal } from './components/auth/UserProfileModal.tsx';
import { InstallWizard } from './components/install/InstallWizard.tsx';
import { OfflineToastNotification } from './components/common/OfflineToastNotification.tsx';
import { PublicLayout } from './components/common/PublicLayout.tsx';
import { SammiAssistantView } from './components/chat/SammiAssistantView.tsx';
import type { ActiveExchange } from './types.ts';

function resolveTargetTab(requestedTab: string | undefined | null, user: any): string {
  const role = (user?.role || '').toLowerCase();
  const isCashier = role === 'cashier';
  const clean = (requestedTab || '').toLowerCase().trim();

  if (isCashier) {
    if (!clean || clean === 'dashboard' || clean === 'purchases' || clean === 'settings') {
      return 'pos';
    }
    return clean;
  }

  if (!clean || clean === 'dashboard') {
    return 'dashboard';
  }
  return clean;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<any | null>(() => {
    try {
      const token = localStorage.getItem('pos_auth_token');
      if (!token || token === 'null' || token === 'undefined') {
        localStorage.removeItem('pos_current_user');
        localStorage.removeItem('pos_auth_token');
        return null;
      }
      const stored = localStorage.getItem('pos_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [companySettings, setCompanySettings] = useState<any | null>(() => {
    try {
      const stored = localStorage.getItem('cached_company_settings');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [cachedStoreName, setCachedStoreName] = useState<string>(() => {
    try {
      return localStorage.getItem('cached_store_name') || '';
    } catch {
      return '';
    }
  });
  const [currentTab, setCurrentTab] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('pos_current_user');
      const user = stored ? JSON.parse(stored) : null;
      const pathname = window.location.pathname.replace(/^\//, '');
      const searchTab = new URLSearchParams(window.location.search).get('tab');
      return resolveTargetTab(searchTab || pathname, user);
    } catch {
      return 'dashboard';
    }
  });
  const [activeExchangeForPos, setActiveExchangeForPos] = useState<ActiveExchange | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedSupplierForPurchase, setSelectedSupplierForPurchase] = useState<{ id?: number; name?: string } | null>(null);

  const handleTabChange = (targetTab: string) => {
    const valid = resolveTargetTab(targetTab, currentUser);
    setCurrentTab(valid);
    const isSpecialUrl =
      window.location.pathname === '/installationWizard' ||
      window.location.pathname === '/install';
    if (!isSpecialUrl) {
      window.history.replaceState({}, '', `/${valid}`);
    }
  };

  // Route Guard: enforce immediate redirection away from purchases or dashboard for cashiers
  useEffect(() => {
    const role = (currentUser?.role || '').toLowerCase();
    const isCashier = role === 'cashier';
    if (isCashier) {
      if (currentTab === 'purchases' || currentTab === 'settings' || currentTab === 'dashboard') {
        setCurrentTab('pos');
        if (window.location.pathname !== '/installationWizard' && window.location.pathname !== '/install') {
          window.history.replaceState({}, '', '/pos');
        }
      }
    }
  }, [currentUser, currentTab]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname.replace(/^\//, '');
      const searchTab = new URLSearchParams(window.location.search).get('tab');
      const valid = resolveTargetTab(searchTab || pathname, currentUser);
      setCurrentTab(valid);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  // Server installation & commissioning state (persisted locally so offline reloads know the system was already installed)
  const [isInstalled, setIsInstalled] = useState<boolean | null>(() => {
    try {
      const cachedInstalled = localStorage.getItem('pos_is_installed');
      if (cachedInstalled !== null) {
        return cachedInstalled === 'true';
      }
      return null;
    } catch {
      return null;
    }
  });
  const [showInstallWizard, setShowInstallWizard] = useState(false);

  const effectiveStoreName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    cachedStoreName ||
    'TJ Shoes';

  const pwaAppName = `${effectiveStoreName} By SarbaazSoft`;

  // Keep document title and PWA installation meta synced with storeName + By SarbaazSoft
  useEffect(() => {
    if (pwaAppName) {
      document.title = pwaAppName;

      // Update mobile web app and PWA titles
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (appleTitle) {
        appleTitle.setAttribute('content', pwaAppName);
      }
      const appNameMeta = document.querySelector('meta[name="application-name"]');
      if (appNameMeta) {
        appNameMeta.setAttribute('content', pwaAppName);
      }

      // Update PWA manifest link with store name param to prompt browser to load updated manifest
      const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
      if (manifestLink) {
        manifestLink.setAttribute('href', `/manifest.webmanifest?store=${encodeURIComponent(effectiveStoreName)}`);
      }
    }
  }, [pwaAppName, effectiveStoreName]);

  // Initialize Auth & Settings
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    setIsInitializing(true);
    try {
      // 1. Check Server Installation Status and fetch Company Settings in parallel
      const [statusRes, settingsRes] = await Promise.all([
        api.install.status().catch(() => null),
        api.settings.get().catch(() => null),
      ]);

      // Determine installation status:
      // If network failed (statusRes is null), rely on navigator.onLine and cached local status
      let installed = false;
      if (statusRes !== null) {
        installed = Boolean(statusRes.isInstalled);
        try {
          localStorage.setItem('pos_is_installed', String(installed));
        } catch {}
      } else {
        const cachedInstalled = localStorage.getItem('pos_is_installed');
        if (cachedInstalled !== null) {
          installed = cachedInstalled === 'true';
        } else if (!navigator.onLine) {
          // If browser is offline and no explicit cache, assume already installed if auth token exists
          installed = Boolean(getAuthToken());
        }
      }
      setIsInstalled(installed);

      if (settingsRes?.settings) {
        setCompanySettings(settingsRes.settings);
        try {
          localStorage.setItem('cached_company_settings', JSON.stringify(settingsRes.settings));
        } catch {}
        const resolvedName =
          settingsRes.settings.name ||
          settingsRes.settings.company_name ||
          settingsRes.settings.companyName;
        if (resolvedName) {
          setCachedStoreName(resolvedName);
          try {
            localStorage.setItem('cached_store_name', resolvedName);
          } catch {}
        }
      } else if (statusRes?.storeName) {
        setCachedStoreName(statusRes.storeName);
        try {
          localStorage.setItem('cached_store_name', statusRes.storeName);
        } catch {}
      }

      const isInstallUrl =
        window.location.pathname === '/installationWizard' ||
        window.location.pathname === '/install' ||
        window.location.search.includes('install=true');

      // Do NOT force the installation wizard if the device is offline or already marked installed
      if (!installed && navigator.onLine) {
        setShowInstallWizard(true);
        if (window.location.pathname !== '/installationWizard') {
          window.history.replaceState({}, '', '/installationWizard');
        }
      } else if (isInstallUrl) {
        setShowInstallWizard(true);
      } else {
        setShowInstallWizard(false);
      }

      // If application is installed, verify existing JWT token
      if (installed) {
        const token = getAuthToken();
        if (!token || token === 'null' || token === 'undefined') {
          setCurrentUser(null);
          try {
            localStorage.removeItem('pos_current_user');
            localStorage.removeItem('pos_auth_token');
          } catch {}
        } else {
          const userRes = await api.auth.me().catch(() => null);
          if (userRes?.user) {
            const dbRole = (userRes.user.role || '').toUpperCase();
            if (dbRole === 'CASHIER') {
              // Account is genuine cashier: strictly Cashier mode, no privilege escalation
              const cashierUser = {
                ...userRes.user,
                role: 'CASHIER',
                originalRole: 'CASHIER',
                isSimulatedCashier: false,
              };
              setCurrentUser(cashierUser);
              try {
                localStorage.setItem('pos_current_user', JSON.stringify(cashierUser));
              } catch {}
              setCurrentTab((prevTab) => {
                const target = resolveTargetTab(prevTab, cashierUser);
                if (window.location.pathname !== '/installationWizard' && window.location.pathname !== '/install') {
                  window.history.replaceState({}, '', `/${target}`);
                }
                return target;
              });
            } else {
              // Account is Administrator: preserve simulated cashier browsing if active
              setCurrentUser((prev: any) => {
                const isBrowsingAsCashier =
                  prev?.role === 'CASHIER' && Boolean(prev?.isSimulatedCashier || prev?.originalRole === 'ADMIN');
                const adminUser = {
                  ...userRes.user,
                  role: isBrowsingAsCashier ? 'CASHIER' : 'ADMIN',
                  originalRole: 'ADMIN',
                  isSimulatedCashier: isBrowsingAsCashier,
                };
                try {
                  localStorage.setItem('pos_current_user', JSON.stringify(adminUser));
                } catch {}
                return adminUser;
              });
            }
          } else if (navigator.onLine) {
            // Only clear token if server actually responded online with an invalid/expired token
            removeAuthToken();
            try {
              localStorage.removeItem('pos_current_user');
            } catch {}
            setCurrentUser(null);
          }
          // If offline, keep the cached currentUser in state so POS remains fully operational
        }
      }
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    try {
      localStorage.removeItem('pos_current_user');
    } catch {}
    setCurrentUser(null);
    setCurrentTab('dashboard');
    window.history.replaceState({}, '', '/');
  };

  const handleSwitchRole = (newRole: 'ADMIN' | 'CASHIER') => {
    setCurrentUser((prev: any) => {
      if (!prev) return prev;
      const trueRole = (prev.originalRole || prev.role || '').toUpperCase();
      // Regular cashiers cannot switch roles or escalate privileges
      if (trueRole !== 'ADMIN') {
        return prev;
      }
      const updated = {
        ...prev,
        role: newRole,
        originalRole: 'ADMIN',
        isSimulatedCashier: newRole === 'CASHIER',
      };
      try {
        localStorage.setItem('pos_current_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (newRole === 'CASHIER') {
      setCurrentTab('pos');
      window.history.replaceState({}, '', '/pos');
    } else {
      setCurrentTab('dashboard');
      window.history.replaceState({}, '', '/dashboard');
    }
  };

  const handleSettingsUpdated = async (updatedSettings?: any) => {
    try {
      if (updatedSettings) {
        setCompanySettings(updatedSettings);
        try {
          localStorage.setItem('cached_company_settings', JSON.stringify(updatedSettings));
        } catch {}
      }
      const [settingsRes, statusRes] = await Promise.all([
        api.settings.get().catch(() => null),
        api.install.status().catch(() => null),
      ]);
      if (settingsRes?.settings) {
        setCompanySettings(settingsRes.settings);
        try {
          localStorage.setItem('cached_company_settings', JSON.stringify(settingsRes.settings));
        } catch {}
        const resolvedName =
          settingsRes.settings.name ||
          settingsRes.settings.company_name ||
          settingsRes.settings.companyName;
        if (resolvedName) {
          setCachedStoreName(resolvedName);
          try {
            localStorage.setItem('cached_store_name', resolvedName);
          } catch {}
        }
      }
      if (statusRes) {
        setIsInstalled(statusRes.isInstalled);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Keyboard Shortcuts for Physical Counter Navigation & POS Operations
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
      // Prevent browser default behavior for counter function keys (F1-F9)
      if (['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'].includes(e.key)) {
        e.preventDefault();
      }

      const role = (currentUser?.role || '').toLowerCase();
      const isCashier = role === 'cashier';

      switch (e.key) {
        case 'F1':
          handleTabChange('pos');
          break;
        case 'F2':
          handleTabChange('inventory');
          break;
        case 'F3':
          if (!isCashier) {
            handleTabChange('purchases');
          }
          break;
        case 'F4':
          handleTabChange('returns');
          break;
        case 'F5':
          handleTabChange('customers');
          break;
        case 'F6':
          handleTabChange('reports');
          break;
        case 'F7':
          if (!isCashier) {
            handleTabChange('settings');
          }
          break;
        case 'F8':
          // Shortcut for 'Delete Sale' (Clears active cart / cancels sale transaction)
          handleTabChange('pos');
          window.dispatchEvent(new CustomEvent('pos:delete-sale'));
          break;
        case 'F9':
          // Shortcut for 'Print Receipt' (Completes checkout & prints receipt, or prints active invoice)
          handleTabChange('pos');
          window.dispatchEvent(new CustomEvent('pos:print-receipt'));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [currentUser]);

  // Listen for session expiry from API service
  useEffect(() => {
    const handleSessionExpired = () => {
      removeAuthToken();
      try {
        localStorage.removeItem('pos_current_user');
      } catch {}
      setCurrentUser(null);
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  if (isInitializing) {
    return (
      <PublicLayout
        storeName={effectiveStoreName}
        badgeText="Connecting..."
        badgeVariant="connecting"
        subtitle="Footwear Retail POS & Inventory Suite"
        dbText="PostgreSQL • Initializing"
      >
        <div
          id="app-initial-loading-card"
          className="bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/30 dark:border-purple-800/60 flex flex-col items-center max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-purple-600/30 ring-2 ring-indigo-400/30">
            <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            {effectiveStoreName}
          </h2>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
            Connecting to PostgreSQL Database...
          </p>
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-5 overflow-hidden">
            <div className="gradient-primary h-full w-2/3 rounded-full animate-pulse" />
          </div>
        </div>
      </PublicLayout>
    );
  }

  // DEDICATED INSTALLATION WIZARD VIEW
  if (showInstallWizard) {
    return (
      <InstallWizard
        isAlreadyInstalled={Boolean(isInstalled)}
        onInstalled={({ user, settings }) => {
          if (user) {
            const dbRole = (user?.role || 'ADMIN').toUpperCase();
            const normalizedUser = {
              ...user,
              role: dbRole,
              originalRole: dbRole,
              isSimulatedCashier: false,
            };
            setCurrentUser(normalizedUser);
            try {
              localStorage.setItem('pos_current_user', JSON.stringify(normalizedUser));
            } catch {}
          }
          if (settings) {
            setCompanySettings(settings);
            try {
              localStorage.setItem('cached_company_settings', JSON.stringify(settings));
            } catch {}
          }
          setIsInstalled(true);
          try {
            localStorage.setItem('pos_is_installed', 'true');
          } catch {}
          setShowInstallWizard(false);
          window.history.replaceState({}, '', '/');
          initializeApp();
        }}
        onCancelToLogin={() => {
          setShowInstallWizard(false);
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-100 dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100 font-sans antialiased transition-colors duration-200">
      {/* AUTH CHECK OR MAIN APPLICATION */}
      {!currentUser ? (
        <AuthModal
          companySettings={companySettings}
          onSuccess={(user) => {
            const dbRole = (user?.role || 'ADMIN').toUpperCase();
            const normalizedUser = {
              ...user,
              role: dbRole,
              originalRole: dbRole,
              isSimulatedCashier: false,
            };
            setCurrentUser(normalizedUser);
            try {
              localStorage.setItem('pos_current_user', JSON.stringify(normalizedUser));
              localStorage.setItem('pos_is_installed', 'true');
            } catch {}
            if (dbRole.toLowerCase() === 'cashier') {
              setCurrentTab('pos');
              window.history.replaceState({}, '', '/pos');
            } else {
              setCurrentTab('dashboard');
              window.history.replaceState({}, '', '/dashboard');
            }
            initializeApp();
          }}
        />
      ) : (
        <div className="flex w-full min-h-screen bg-[#F8FAFC] dark:bg-[#0A0E1A] text-slate-900 dark:text-slate-100 transition-colors">
          {/* SIDER: Stays open permanently on large display (laptop/desktop) */}
          <Sidebar
            currentTab={currentTab}
            onTabChange={(tab) => handleTabChange(tab)}
            currentUser={currentUser}
            companySettings={companySettings}
            onLogout={handleLogout}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            onOpenProfile={() => setIsProfileModalOpen(true)}
          />

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto bg-[#F8FAFC] dark:bg-[#0A0E1A]">
            {/* TOP BAR: Breadcrumbs & status on desktop, mobile bar with menu button on smaller screens */}
            <Header
              currentTab={currentTab}
              onTabChange={(tab) => handleTabChange(tab)}
              currentUser={currentUser}
              companySettings={companySettings}
              onLogout={handleLogout}
              onToggleMobileMenu={() => setMobileMenuOpen(true)}
              onOpenProfile={() => setIsProfileModalOpen(true)}
              onSwitchRole={handleSwitchRole}
            />

            {/* MAIN VIEWPORT */}
            <main className="flex-1 min-w-0 overflow-x-hidden bg-[#F8FAFC] dark:bg-[#0A0E1A] transition-colors">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTab}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="w-full h-full"
                >
                  {currentTab === 'dashboard' && (
                    (currentUser?.role || '').toLowerCase() === 'cashier' ? (
                      <PosTerminal
                        currentUser={currentUser}
                        companySettings={companySettings}
                        initialExchange={activeExchangeForPos}
                        onClearInitialExchange={() => setActiveExchangeForPos(null)}
                      />
                    ) : (
                      <DashboardOverview
                        currentUser={currentUser}
                        companySettings={companySettings}
                        onNavigate={(tab) => handleTabChange(tab)}
                      />
                    )
                  )}

                  {currentTab === 'pos' && (
                    <PosTerminal
                      currentUser={currentUser}
                      companySettings={companySettings}
                      initialExchange={activeExchangeForPos}
                      onClearInitialExchange={() => setActiveExchangeForPos(null)}
                    />
                  )}

                  {currentTab === 'inventory' && (
                    <ProductManagement
                      currentUser={currentUser}
                      companySettings={companySettings}
                    />
                  )}

                  {currentTab === 'ledger' && <StockLedgerView />}

                  {currentTab === 'purchases' && (
                    (currentUser?.role || '').toLowerCase() === 'cashier' ? (
                      <PosTerminal
                        currentUser={currentUser}
                        companySettings={companySettings}
                        initialExchange={activeExchangeForPos}
                        onClearInitialExchange={() => setActiveExchangeForPos(null)}
                      />
                    ) : (
                      <PurchaseManagement
                        currentUser={currentUser}
                        companySettings={companySettings}
                        initialSupplierId={selectedSupplierForPurchase?.id}
                        initialSupplierName={selectedSupplierForPurchase?.name}
                        onNavigateToSuppliers={() => handleTabChange('suppliers')}
                      />
                    )
                  )}

                  {currentTab === 'suppliers' && (
                    <SupplierManagement
                      currentUser={currentUser}
                      companySettings={companySettings}
                      onNavigateToPurchase={(supId, supName) => {
                        if ((currentUser?.role || '').toLowerCase() !== 'cashier') {
                          setSelectedSupplierForPurchase(supId || supName ? { id: supId, name: supName } : null);
                          handleTabChange('purchases');
                        }
                      }}
                    />
                  )}

                  {currentTab === 'returns' && (
                    <SalesReturnView
                      currentUser={currentUser}
                      companySettings={companySettings}
                      onStartExchange={(exchange) => {
                        setActiveExchangeForPos(exchange);
                        handleTabChange('pos');
                      }}
                    />
                  )}

                  {currentTab === 'customers' && (
                    <CustomerManagement companySettings={companySettings} />
                  )}

                  {currentTab === 'reports' && (
                    <ReportsDashboard
                      currentUser={currentUser}
                      companySettings={companySettings}
                    />
                  )}

                  {currentTab === 'settings' && (
                    (currentUser?.role || '').toLowerCase() === 'cashier' ? (
                      <PosTerminal
                        currentUser={currentUser}
                        companySettings={companySettings}
                        initialExchange={activeExchangeForPos}
                        onClearInitialExchange={() => setActiveExchangeForPos(null)}
                      />
                    ) : (
                      <SettingsView
                        currentUser={currentUser}
                        companySettings={companySettings}
                        onSettingsUpdated={handleSettingsUpdated}
                        onOpenInstallWizard={async () => {
                          const statusRes = await api.install.status().catch(() => null);
                          if (statusRes) {
                            setIsInstalled(statusRes.isInstalled);
                          }
                          setShowInstallWizard(true);
                        }}
                      />
                    )
                  )}

                  {currentTab === 'assistant' && (
                    <SammiAssistantView
                      storeName={effectiveStoreName}
                      currentUser={currentUser}
                      companySettings={companySettings}
                      onNavigateTab={(tab) => handleTabChange(tab)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* APPLICATION FOOTER */}
            <footer className="px-4 py-2.5 border border-indigo-500/20 bg-white/95 dark:bg-white/10 backdrop-blur-lg shadow-lg transition-colors duration-500 text-center text-xs font-medium text-slate-800 dark:text-slate-100 tracking-wide shrink-0 no-print select-none">
              Designed & Developed by{' '}
              <a
                href="https://portpolio-eight-pi.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-slate-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline transition-colors"
              >
                SarbaazSoft
              </a>{' '}
              © 2026
            </footer>
          </div>
        </div>
      )}

      {/* User Profile & Password Modal (Accessible to Owner and Salesperson) */}
      {currentUser && (
        <UserProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          storeName={effectiveStoreName}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
        />
      )}

      {/* Persistent Offline Toast Notification: only displays when navigator.onLine is false */}
      <OfflineToastNotification
        currencySymbol={companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.'}
      />
    </div>
  );
}
