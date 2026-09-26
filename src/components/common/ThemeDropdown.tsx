import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme, type ThemeMode } from '../../context/ThemeContext.tsx';

export interface ThemeDropdownProps {
  id?: string;
  className?: string;
  dropdownAlign?: 'left' | 'right';
  showLabel?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onThemeSelect?: (mode: ThemeMode) => void;
}

/**
 * ThemeDropdown
 * 3-way dropdown theme preference menu (Light, Dark, System).
 * Extracted as a unified sub-component of the top navbar,
 * reused across Header and PublicHeader (Auth, Installation Wizard, and Loading route).
 */
export const ThemeDropdown: React.FC<ThemeDropdownProps> = ({
  id = 'global-theme-dropdown-trigger',
  className = '',
  dropdownAlign = 'right',
  showLabel = true,
  isOpen: controlledIsOpen,
  onOpenChange,
  onThemeSelect,
}) => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isControlled = typeof controlledIsOpen === 'boolean';
  const open = isControlled ? controlledIsOpen : internalIsOpen;

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalIsOpen(next);
    }
    onOpenChange?.(next);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [open, isControlled]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isControlled]);

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
    setOpen(false);
    onThemeSelect?.(mode);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        className={`h-8 sm:h-8.5 flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-lg transition-all duration-200 cursor-pointer border text-xs ${
          open
            ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white border-purple-400/50 ring-2 ring-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_16px_rgba(147,51,234,0.4)]'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:text-purple-200 dark:hover:text-white dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)]'
        }`}
        title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`}
        aria-label="Theme selection menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <div className="shrink-0 flex items-center justify-center">
          {themeMode === 'light' ? (
            <Sun className="w-3.5 h-3.5 stroke-[2]" />
          ) : themeMode === 'dark' ? (
            <Moon className="w-3.5 h-3.5 stroke-[2]" />
          ) : (
            <Monitor className="w-3.5 h-3.5 stroke-[2]" />
          )}
        </div>
        {showLabel && (
          <span
            className={`hidden sm:inline-block text-xs font-semibold capitalize ${
              open ? 'text-white' : 'text-slate-700 dark:text-purple-200'
            }`}
          >
            {themeMode}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ease-out opacity-75 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu (ul) */}
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, scale: 0.94, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: dropdownAlign === 'right' ? 'top right' : 'top left' }}
            className={`absolute ${
              dropdownAlign === 'right' ? 'right-0 left-auto' : 'left-0 right-auto'
            } top-full mt-2 w-48 sm:w-52 bg-white dark:bg-[#120726] border border-slate-200 dark:border-purple-400/40 rounded-xl shadow-2xl dark:shadow-[0_0_25px_rgba(147,51,234,0.25)] p-1.5 z-50 backdrop-blur-md list-none space-y-0.5`}
            role="menu"
            aria-orientation="vertical"
          >
            <li className="px-2.5 py-1 border-b border-slate-100 dark:border-purple-800/40 mb-0.5 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-purple-100">
                Theme Preference
              </span>
              <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-200 bg-purple-50 dark:bg-purple-500/20 px-1.5 py-0.2 rounded-full border border-purple-200 dark:border-purple-400/40 capitalize">
                {themeMode}
              </span>
            </li>

            {/* Light Option */}
            <li role="none">
              <button
                type="button"
                onClick={() => handleSelect('light')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium transition cursor-pointer rounded-lg ${
                  themeMode === 'light'
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-semibold shadow-md shadow-purple-600/25 border border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)]'
                    : 'text-slate-700 dark:text-purple-200 font-medium hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:text-white dark:hover:text-white dark:hover:bg-purple-500/25 group border border-transparent'
                }`}
                role="menuitemradio"
                aria-checked={themeMode === 'light'}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sun className="w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 text-current opacity-80 group-hover:opacity-100" />
                  <span className="truncate text-xs">Light</span>
                </div>
                {themeMode === 'light' && (
                  <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
                )}
              </button>
            </li>

            {/* Dark Option */}
            <li role="none">
              <button
                type="button"
                onClick={() => handleSelect('dark')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium transition cursor-pointer rounded-lg ${
                  themeMode === 'dark'
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-semibold shadow-md shadow-purple-600/25 border border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)]'
                    : 'text-slate-700 dark:text-purple-200 font-medium hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:text-white dark:hover:text-white dark:hover:bg-purple-500/25 group border border-transparent'
                }`}
                role="menuitemradio"
                aria-checked={themeMode === 'dark'}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Moon className="w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 text-current opacity-80 group-hover:opacity-100" />
                  <span className="truncate text-xs">Dark</span>
                </div>
                {themeMode === 'dark' && (
                  <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
                )}
              </button>
            </li>

            {/* System Option */}
            <li role="none">
              <button
                type="button"
                onClick={() => handleSelect('system')}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium transition cursor-pointer rounded-lg ${
                  themeMode === 'system'
                    ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-semibold shadow-md shadow-purple-600/25 border border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)]'
                    : 'text-slate-700 dark:text-purple-200 font-medium hover:bg-gradient-to-r hover:from-purple-600 hover:via-indigo-600 hover:to-purple-700 hover:text-white dark:hover:text-white dark:hover:bg-purple-500/25 group border border-transparent'
                }`}
                role="menuitemradio"
                aria-checked={themeMode === 'system'}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Monitor className="w-3.5 h-3.5 stroke-[2] transition-colors shrink-0 text-current opacity-80 group-hover:opacity-100" />
                  <span className="truncate text-xs">System</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-normal transition-colors ${
                      themeMode === 'system'
                        ? 'text-white/80'
                        : 'text-slate-400 dark:text-purple-300/70 group-hover:text-white/80'
                    }`}
                  >
                    {theme === 'dark' ? 'Dark' : 'Light'}
                  </span>
                  {themeMode === 'system' && (
                    <Check className="w-3.5 h-3.5 text-white stroke-[2.5] shrink-0" />
                  )}
                </div>
              </button>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};
