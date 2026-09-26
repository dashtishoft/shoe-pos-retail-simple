import React from 'react';

export interface PublicFooterProps {
  storeName?: string;
  subtitle?: string;
}

/**
 * PublicFooter
 * Global footer for public, onboarding, loading, and authentication views.
 */
export const PublicFooter: React.FC<PublicFooterProps> = ({
  storeName = 'Shoe Shop POS',
  subtitle = 'Footwear Retail POS & Inventory Suite',
}) => {
  return (
    <footer
      id="global-public-footer"
      className="relative z-10 w-full px-4 sm:px-8 py-3.5 border border-indigo-500/20 bg-white/95 dark:bg-white/10 backdrop-blur-lg text-xs text-slate-800 dark:text-slate-100 transition-colors duration-500 shadow-lg"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 dark:text-white">
            &copy; {new Date().getFullYear()} {storeName}
          </span>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">{subtitle}</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            PostgreSQL Ready
          </span>
          <span className="text-slate-300 dark:text-slate-600">&bull;</span>
          <span className="text-slate-500 dark:text-slate-400">
            Engineered by{' '}
            <a
              id="sarbaazsoft-credit-link"
              href="https://portpolio-eight-pi.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline font-bold transition"
            >
              SarbaazSoft
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
};
