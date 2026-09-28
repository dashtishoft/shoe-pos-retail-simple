import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  RotateCcw,
  Users,
  TrendingUp,
  Settings,
  Printer,
  BookOpen,
  X,
  Tag,
  Layers,
  Building2,
  Check,
  Database,
  Keyboard,
  Sun,
  Moon,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Bot,
} from 'lucide-react';
import { UserAvatar } from './UserAvatar.tsx';
import { useTheme } from '../../context/ThemeContext.tsx';
import { InstallAppModal } from './InstallAppModal.tsx';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  currentUser: any;
  companySettings: any;
  onLogout?: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenProfile?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
}

interface NavSection {
  header: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  currentUser,
  companySettings,
  onLogout: _onLogout,
  mobileOpen,
  onCloseMobile,
  onOpenProfile,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pos_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('pos_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const storeName =
    companySettings?.name ||
    companySettings?.company_name ||
    companySettings?.companyName ||
    'DWU Shoes';

  const userRole = (currentUser?.role || '').toLowerCase();
  const isCashier = userRole === 'cashier';

  // Flat navigation sections
  const rawSections: NavSection[] = [
    {
      header: 'COUNTER & INVENTORY',
      items: [
        { id: 'pos', label: 'POS Terminal', icon: ShoppingCart, shortcut: 'F1' },
        { id: 'inventory', label: 'Shoe Catalog', icon: Boxes, shortcut: 'F2' },
        { id: 'ledger', label: 'Stock Ledger', icon: BookOpen },
      ],
    },
    {
      header: 'SALES & PURCHASES',
      items: [
        { id: 'purchases', label: 'Purchases', icon: Truck, shortcut: 'F3' },
        { id: 'suppliers', label: 'Suppliers', icon: Building2 },
        { id: 'returns', label: 'Returns', icon: RotateCcw, shortcut: 'F4' },
        { id: 'customers', label: 'Customers', icon: Users, shortcut: 'F5' },
      ],
    },
    {
      header: isCashier ? 'HARDWARE & SYSTEM' : 'ADMINISTRATION',
      items: [
        { id: 'reports', label: 'Reports', icon: TrendingUp, shortcut: 'F6' },
        {
          id: 'settings',
          label: isCashier ? 'Printer & Hardware' : 'Settings',
          icon: isCashier ? Printer : Settings,
          shortcut: 'F7',
        },
      ],
    },
    {
      header: 'HELP & SUPPORT',
      items: [
        { id: 'assistant', label: 'Sammi AI Assistant', icon: Sparkles },
      ],
    },
  ];

  const sections: NavSection[] = rawSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (isCashier && item.id === 'purchases') {
          return false;
        }
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  const handleItemClick = (tabId: string) => {
    onTabChange(tabId);
    onCloseMobile();
  };

  const renderSidebar = (isMobile: boolean = false) => {
    const collapsed = !isMobile && isCollapsed;

    return (
      <div
        className={`w-full h-full max-h-screen flex flex-col bg-white/95 dark:bg-[#0D1322] backdrop-blur-lg text-slate-700 dark:text-slate-100 select-none border-r border-indigo-500/20 shadow-lg rounded-none overflow-y-auto overflow-x-hidden sidebar-scrollbar transition-colors ${
          collapsed ? 'px-2' : ''
        }`}
      >
        {/* TOP: Store Brand Header aligned with top Header bar (exact h-[3.6rem] with matching border-b) */}
        <div
          className={`h-[3.6rem] flex items-center justify-between border-b border-indigo-500/20 shrink-0 ${
            collapsed ? 'px-2 justify-center' : 'px-3.5 sm:px-4'
          }`}
        >
          {/* Brand Banner */}
          <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center w-full' : ''}`}>
            {companySettings?.logo ? (
              <img
                src={companySettings.logo}
                alt="Logo"
                className="w-8 h-8 rounded-lg object-cover bg-white p-0.5 border border-indigo-500/20 shrink-0 shadow-xs"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm border border-purple-400/30">
                👟
              </div>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <h1 className="text-xs font-bold text-slate-900 dark:text-white truncate tracking-tight leading-tight">
                  {storeName}
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-indigo-200/70 font-medium truncate mt-0.5">
                  Retail Management System
                </p>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          {isMobile && (
            <button
              id="sidebar-close-mobile-btn"
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
              aria-label="Close Mobile Navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Desktop Collapse / Expand Toggle Button */}
          {!isMobile && !collapsed && (
            <button
              id="sidebar-collapse-toggle-btn"
              type="button"
              onClick={toggleCollapse}
              className="p-1.5 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-white/10 transition cursor-pointer"
              title="Collapse sidebar (Ctrl+B)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}

          {/* Collapsed Expand Toggle Button */}
          {!isMobile && collapsed && (
            <button
              id="sidebar-expand-toggle-btn"
              type="button"
              onClick={toggleCollapse}
              className="p-1 text-slate-400 hover:text-purple-600 dark:hover:text-purple-300 rounded-lg hover:bg-purple-50 dark:hover:bg-white/10 transition cursor-pointer"
              title="Expand sidebar (Ctrl+B)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* TOP ITEM: Dashboard Quick Navigation */}
        <div className={`pt-2.5 pb-1 ${collapsed ? 'px-1' : 'px-3'}`}>
          <div className="relative">
            <motion.button
              type="button"
              id="sidebar-nav-dashboard"
              onClick={() => handleItemClick('dashboard')}
              whileTap={{ scale: 0.98 }}
              className={`relative w-full flex items-center ${
                collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
              } rounded-xl text-xs font-semibold cursor-pointer group transition-colors duration-150 ${
                currentTab === 'dashboard'
                  ? 'text-white font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50/70 dark:hover:bg-purple-950/30'
              }`}
            >
              {/* Animated Floating Active Pill */}
              {currentTab === 'dashboard' && (
                <motion.div
                  layoutId="activeNavPill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 dark:from-purple-600 dark:to-indigo-600 border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.35)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}

              <div className="relative z-10 flex items-center gap-3">
                <LayoutDashboard
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                    currentTab === 'dashboard'
                      ? 'text-white'
                      : 'text-slate-500 dark:text-slate-400 group-hover:scale-110'
                  }`}
                />
                {!collapsed && <span>Dashboard</span>}
              </div>

              {/* Floating Tooltip in Collapsed Mode */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold whitespace-nowrap shadow-xl z-50 pointer-events-none border border-slate-700/50 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 flex items-center gap-1.5">
                  <span>Dashboard</span>
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 border-l border-b border-slate-700/50" />
                </div>
              )}
            </motion.button>
          </div>
        </div>

        {/* MIDDLE: Navigation Sections */}
        <div className={`py-1 space-y-2.5 ${collapsed ? 'px-1' : 'px-3'}`}>
          {sections.map((section) => (
            <div key={section.header} className="space-y-1">
              {!collapsed ? (
                <div className="text-[10px] font-bold text-slate-400 dark:text-indigo-300/70 uppercase tracking-wider px-2 py-0.5">
                  {section.header}
                </div>
              ) : (
                <div className="w-8 h-px bg-indigo-500/20 mx-auto my-2" />
              )}

              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <div key={item.id} className="relative">
                      <motion.button
                        type="button"
                        id={`sidebar-nav-${item.id}`}
                        onClick={() => handleItemClick(item.id)}
                        whileTap={{ scale: 0.98 }}
                        className={`relative w-full flex items-center ${
                          collapsed ? 'justify-center p-2.5' : 'justify-between px-3 py-2'
                        } rounded-xl text-xs font-medium cursor-pointer group transition-colors duration-150 ${
                          isActive
                            ? 'text-white font-bold'
                            : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-purple-50/70 dark:hover:bg-purple-950/30'
                        }`}
                      >
                        {/* Animated Floating Active Pill */}
                        {isActive && (
                          <motion.div
                            layoutId="activeNavPill"
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 dark:from-purple-600 dark:to-indigo-600 border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.35)]"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}

                        <div className="relative z-10 flex items-center gap-3 truncate">
                          <ItemIcon
                            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                              isActive
                                ? 'text-white'
                                : 'text-slate-500 dark:text-slate-400 group-hover:translate-x-0.5'
                            }`}
                          />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {!collapsed && item.shortcut && (
                          <kbd
                            className={`relative z-10 text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded-md transition ${
                              isActive
                                ? 'bg-white/20 text-white border border-white/30'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-indigo-500/20'
                            }`}
                          >
                            {item.shortcut}
                          </kbd>
                        )}

                        {/* Floating Tooltip in Collapsed Mode */}
                        {collapsed && (
                          <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold whitespace-nowrap shadow-xl z-50 pointer-events-none border border-slate-700/50 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 flex items-center gap-2">
                            <span>{item.label}</span>
                            {item.shortcut && (
                              <span className="text-[10px] font-mono bg-white/20 px-1 py-0.5 rounded text-white font-bold">
                                {item.shortcut}
                              </span>
                            )}
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 border-l border-b border-slate-700/50" />
                          </div>
                        )}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* BOTTOM: User Profile, Database Status, Shortcuts & App Version */}
        <div
          className={`border-t border-indigo-500/20 space-y-2 bg-slate-50/40 dark:bg-[#090E18] backdrop-blur-md mt-auto transition-colors ${
            collapsed ? 'p-2 pt-3' : 'p-3.5 pt-3'
          }`}
        >
          {/* User Card */}
          <div
            id="sidebar-user-card"
            onClick={() => {
              onOpenProfile?.();
              if (isMobile) onCloseMobile();
            }}
            className={`flex items-center rounded-xl bg-white/80 hover:bg-white dark:bg-[#131B2E] dark:hover:bg-[#1A263D] border border-indigo-500/20 cursor-pointer transition group shadow-xs ${
              collapsed ? 'justify-center p-2 relative' : 'justify-between p-2'
            }`}
            title={collapsed ? `${currentUser?.name || 'Admin'} • Profile` : 'Click to view & edit your profile'}
          >
            <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? 'justify-center' : ''}`}>
              <div className="relative shrink-0">
                <UserAvatar
                  name={currentUser?.name}
                  avatarUrl={currentUser?.avatarUrl || currentUser?.avatar_url}
                  role={currentUser?.role}
                  size="sm"
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0D1322]" />
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-300 transition">
                    {currentUser?.name || 'Admin'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser?.role === 'ADMIN' ? 'Administrator' : 'Staff Cashier'}
                  </div>
                </div>
              )}
            </div>

            {!collapsed && (
              <div className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white transition">
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              </div>
            )}

            {collapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold whitespace-nowrap shadow-xl z-50 pointer-events-none border border-slate-700/50 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 flex items-center gap-1.5">
                <span>{currentUser?.name || 'Admin'} (Profile)</span>
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 border-l border-b border-slate-700/50" />
              </div>
            )}
          </div>

          {/* Install Button under User Profile */}
          <button
            id="sidebar-install-app-btn"
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className={`w-full flex items-center rounded-xl bg-indigo-50/60 hover:bg-indigo-100/80 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 transition cursor-pointer group shadow-xs ${
              collapsed ? 'justify-center p-2 relative' : 'justify-between px-2.5 py-1.5'
            }`}
            title="Install Android APK, iOS Safari PWA, or Windows .EXE"
          >
            <div className="flex items-center gap-2">
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition shrink-0" />
              {!collapsed && <span className="text-[11px] font-bold">Install App (APK / PWA)</span>}
            </div>
            {!collapsed && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-[#070B14] text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                APK • iOS • PC
              </span>
            )}
            {collapsed && (
              <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold whitespace-nowrap shadow-xl z-50 pointer-events-none border border-slate-700/50 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 flex items-center gap-1.5">
                <span>Install App (APK / PWA)</span>
                <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 border-l border-b border-slate-700/50" />
              </div>
            )}
          </button>

          {/* Database Status & Shortcuts Bar */}
          <div className="space-y-1.5 pt-1">
            {/* Quick Theme Toggle Button */}
            <button
              id="sidebar-theme-toggle-btn"
              type="button"
              onClick={toggleTheme}
              className={`w-full flex items-center rounded-lg bg-slate-100/80 hover:bg-slate-200/80 dark:bg-[#0E1628] dark:hover:bg-[#131D33] border border-indigo-500/20 text-[11px] text-slate-700 dark:text-slate-200 transition cursor-pointer ${
                collapsed ? 'justify-center p-2 relative group' : 'justify-between px-2 py-1.5'
              }`}
              title={`Current theme: ${theme}. Click to toggle`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                {theme === 'dark' ? (
                  <Moon className="w-3 h-3 text-purple-400 dark:text-purple-300 shrink-0 stroke-[2]" />
                ) : (
                  <Sun className="w-3 h-3 text-purple-600 dark:text-purple-300 shrink-0 stroke-[2]" />
                )}
                {!collapsed && <span>Theme</span>}
              </div>
              {!collapsed && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-white dark:bg-[#070B14] text-slate-600 dark:text-cyan-300 border border-indigo-500/20">
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold whitespace-nowrap shadow-xl z-50 pointer-events-none border border-slate-700/50 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 flex items-center gap-1.5">
                  <span>Theme ({theme === 'dark' ? 'Dark' : 'Light'})</span>
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 border-l border-b border-slate-700/50" />
                </div>
              )}
            </button>

            {/* Database Connected Status */}
            <div
              className={`flex items-center rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-500/20 text-[10.5px] ${
                collapsed ? 'justify-center p-2 relative group' : 'justify-between px-2 py-1'
              }`}
            >
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                {!collapsed && (
                  <span className="flex items-center gap-1 truncate">
                    <Database className="w-3 h-3 shrink-0" />
                    Database: Connected
                  </span>
                )}
              </div>
              {!collapsed && (
                <span className="text-[9.5px] font-mono text-emerald-600 dark:text-emerald-400">PostgreSQL</span>
              )}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold whitespace-nowrap shadow-xl z-50 pointer-events-none border border-slate-700/50 opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0 transition-all duration-150 flex items-center gap-1.5">
                  <span>PostgreSQL Connected</span>
                  <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900/95 dark:bg-slate-800/95 rotate-45 border-l border-b border-slate-700/50" />
                </div>
              )}
            </div>

            {/* Shortcuts Info */}
            {!collapsed && (
              <div className="flex items-center justify-between px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Keyboard className="w-3 h-3 text-slate-400" />
                  <span>Shortcuts:</span>
                </div>
                <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">F1 - F7 • Ctrl+B</span>
              </div>
            )}

            {/* Version */}
            {!collapsed && (
              <div className="px-2 pt-1 border-t border-indigo-500/15 flex items-center justify-between text-[9.5px] text-slate-400 dark:text-slate-500">
                <span>Retail Shoe POS</span>
                <span className="font-mono">v1.0.0</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* DESKTOP FIXED SIDEBAR WITH SMOOTH SPRING WIDTH TRANSITION */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 72 : 256 }}
        transition={{ type: 'spring', stiffness: 350, damping: 32 }}
        className="hidden lg:flex shrink-0 h-screen sticky top-0 z-30 no-print overflow-hidden rounded-none shadow-lg border-r border-indigo-500/20"
      >
        {renderSidebar(false)}
      </motion.aside>

      {/* MOBILE DRAWER WITH FLUID ANIMATEPRESENCE ENTRY & EXIT */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex no-print">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
              onClick={onCloseMobile}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="relative w-72 max-w-[85vw] h-full max-h-screen shadow-2xl z-10 overflow-hidden rounded-none border-r border-indigo-500/20"
            >
              {renderSidebar(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PWA & EXE INSTALLATION MODAL */}
      <InstallAppModal
        isOpen={isInstallModalOpen}
        onClose={() => setIsInstallModalOpen(false)}
        storeName={companySettings?.name || companySettings?.company_name || companySettings?.companyName}
      />
    </>
  );
};
