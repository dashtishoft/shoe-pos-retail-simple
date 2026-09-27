import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  AlertTriangle,
  Award,
  Printer,
  Receipt,
  RotateCw,
  RefreshCw,
  Search,
  X,
  Download,
  LayoutDashboard,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { InvoicePrintModal } from '../pos/InvoicePrintModal.tsx';
import { FinancialSummaryPrintModal } from './FinancialSummaryPrintModal.tsx';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import { StatCard, triggerStatRecount } from '../common/StatCard.tsx';
import { useScrollActiveTab } from '../../hooks/useScrollActiveTab.ts';

interface ReportsDashboardProps {
  currentUser: any;
  companySettings: any;
}

type TabType = 'overview' | 'sales_ledger' | 'profit_loss' | 'stock_alerts';

export const ReportsDashboard: React.FC<ReportsDashboardProps> = ({
  currentUser,
  companySettings,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { containerRef: reportsTabContainerRef } = useScrollActiveTab<HTMLDivElement>(activeTab, {
    padding: 16,
    behavior: 'smooth',
  });
  const [dashboardData, setDashboardData] = useState<any | null>(null);
  const [topSelling, setTopSelling] = useState<any[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [profitLossData, setProfitLossData] = useState<any | null>(null);

  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<any | null>(null);
  const [isPrintSummaryOpen, setIsPrintSummaryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPL, setIsLoadingPL] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('today');
  const [customStartDate] = useState('');
  const [customEndDate] = useState('');

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

  const isRefreshingRef = useRef(false);
  const isRefreshingPLRef = useRef(false);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (activeTab === 'profit_loss') {
      loadProfitLoss();
    }
  }, [activeTab, dateRange, customStartDate, customEndDate]);

  const loadReports = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsLoading(true);
    try {
      const [dRes, topRes, sRes] = await Promise.all([
        api.reports.getDashboard(),
        api.reports.getTopSelling(),
        api.pos.listSales({ limit: 50 }),
      ]);
      setDashboardData(dRes);
      setTopSelling(topRes.topSelling || []);
      setSalesHistory(sRes.sales || []);
    } catch (e) {
      console.error('Failed to load reports:', e);
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
      triggerStatRecount();
    }
  };

  const loadProfitLoss = async () => {
    if (isRefreshingPLRef.current) return;
    isRefreshingPLRef.current = true;
    setIsLoadingPL(true);
    try {
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      const now = new Date();
      if (dateRange === 'today') {
        startDate = now.toISOString().split('T')[0];
        endDate = startDate;
      } else if (dateRange === '7days') {
        const past = new Date();
        past.setDate(now.getDate() - 7);
        startDate = past.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (dateRange === '30days') {
        const past = new Date();
        past.setDate(now.getDate() - 30);
        startDate = past.toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
      } else if (customStartDate && customEndDate) {
        startDate = customStartDate;
        endDate = customEndDate;
      }

      const plRes = await api.reports.getProfitLoss({ startDate, endDate });
      setProfitLossData(plRes);
    } catch (e) {
      console.error('Failed to load profit loss report:', e);
    } finally {
      isRefreshingPLRef.current = false;
      setIsLoadingPL(false);
      triggerStatRecount();
    }
  };

  const handleRefresh = async () => {
    if (activeTab === 'profit_loss') {
      await Promise.all([loadReports(), loadProfitLoss()]);
    } else {
      await loadReports();
    }
  };

  const handlePrintPastSale = async (saleId: number) => {
    try {
      const res = await api.pos.getSale(saleId);
      setSelectedSaleForPrint(res.sale);
    } catch (e) {
      console.error('Failed to fetch sale details:', e);
    }
  };

  // Safe KPI calculations
  const today = dashboardData?.today || {};
  const todayRevenue = parseFloat(today.totalSales ?? today.revenue ?? 0);
  const todayProfit = parseFloat(today.profit ?? 0);
  const todayCount = today.invoiceCount ?? today.salesCount ?? 0;
  const profitMarginPercent =
    todayRevenue > 0 ? Math.round((todayProfit / todayRevenue) * 100).toString() : '0';

  const allTimeRevenue = parseFloat(dashboardData?.allTime?.totalRevenue || 0);
  const allTimeSalesCount = parseInt(dashboardData?.allTime?.salesCount || 0, 10);
  const lowStockCount =
    dashboardData?.inventory?.lowStockCount ??
    dashboardData?.lowStockAlerts?.length ??
    dashboardData?.lowStockProducts?.length ??
    0;

  // Filtered Sales History
  const filteredSales = useMemo(() => {
    return salesHistory.filter((s) => {
      const matchesSearch =
        !searchQuery ||
        (s.invoice_number && s.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.cashier_name && s.cashier_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPayment =
        paymentFilter === 'ALL' ||
        (s.payment_method && s.payment_method.toUpperCase() === paymentFilter.toUpperCase());

      return matchesSearch && matchesPayment;
    });
  }, [salesHistory, searchQuery, paymentFilter]);

  // Total amount of filtered sales
  const filteredSalesTotal = useMemo(() => {
    return filteredSales.reduce((acc, s) => acc + parseFloat(s.total_amount || 0), 0);
  }, [filteredSales]);

  // Filtered Low Stock Products
  const lowStockList = useMemo(() => {
    const list = dashboardData?.lowStockAlerts || dashboardData?.lowStockProducts || [];
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (p: any) =>
        (p.article && p.article.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [dashboardData, searchQuery]);

  // Export Sales Ledger to CSV
  const handleExportSalesCsv = () => {
    if (filteredSales.length === 0) return;
    const headers = ['Invoice Number', 'Date', 'Customer', 'Cashier', 'Payment Method', 'Total Amount'];
    const rows = filteredSales.map((s) => [
      s.invoice_number,
      s.sale_date,
      `"${(s.customer_name || 'Walk-in').replace(/"/g, '""')}"`,
      `"${(s.cashier_name || 'Counter').replace(/"/g, '""')}"`,
      s.payment_method || 'CASH',
      parseFloat(s.total_amount || 0) > 0 ? String(Math.round(parseFloat(s.total_amount))) : '0',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sales_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Profit & Loss to CSV
  const handleExportPLCsv = () => {
    if (!profitLossData?.details || profitLossData.details.length === 0) return;
    const headers = ['Date', 'Invoice', 'Article', 'Quantity', 'Unit Price', 'Cost Price', 'Discount', 'Net Revenue', 'Gross Profit', 'Margin %'];
    const rows = profitLossData.details.map((d: any) => [
      d.saleDate,
      d.invoiceNumber,
      `"${(d.article || d.productName).replace(/"/g, '""')}"`,
      d.quantity,
      Math.round(d.unitPrice).toString(),
      Math.round(d.purchasePrice).toString(),
      Math.round(d.discount).toString(),
      Math.round(d.netRevenue).toString(),
      Math.round(d.profit).toString(),
      d.marginPercent + '%',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Profit_Loss_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto text-xs">
      {/* Top Banner & Action */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-purple-800/80 shadow-sm transition-colors dark:text-white"
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Financial Reports &amp; Analytics
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-purple-200/80 font-medium mt-0.5">
            Real-time gross margins, daily counter sales volume, and inventory re-order alerts
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || (activeTab === 'profit_loss' && isLoadingPL)}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-purple-500/20 hover:bg-slate-200 dark:hover:bg-purple-500/30 text-slate-700 dark:text-purple-200 dark:hover:text-white border border-slate-200 dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] font-bold rounded-xl transition cursor-pointer text-xs flex items-center space-x-1.5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            title={isLoading || (activeTab === 'profit_loss' && isLoadingPL) ? "Refreshing database records..." : "Refresh database records & recount metrics"}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading || (activeTab === 'profit_loss' && isLoadingPL) ? 'animate-spin text-blue-600 dark:text-purple-300' : 'text-blue-600 dark:text-purple-300'}`} />
            <span>Refresh</span>
          </button>

          <button
            id="print-financial-summary-btn"
            type="button"
            onClick={() => setIsPrintSummaryOpen(true)}
            className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white border border-purple-400/40 dark:border-purple-400/50 shadow-md shadow-purple-600/25 dark:shadow-[0_0_14px_rgba(147,51,234,0.3)] font-bold px-4 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer active:scale-95"
            title="Print Financial Closing Slip / Z-Report"
          >
            <Printer className="w-4 h-4" />
            <span>Print Financial Summary</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Cards (4-Column Bento Grid) with Animated Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* CARD 1: TODAY'S REVENUE */}
        <StatCard
          id="stat-reports-today-revenue"
          title="Today's Revenue"
          value={todayRevenue}
          prefix={`${currencySymbol} `}
          icon={DollarSign}
          iconColor="emerald"
          valueClassName="font-mono text-slate-900 dark:text-white"
          subtext={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Gross sales collected</span>
              <span className="text-slate-400 dark:text-slate-400 font-mono font-medium">{todayCount} checkouts</span>
            </div>
          }
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        {/* CARD 2: GROSS PROFIT & MARGIN */}
        <StatCard
          id="stat-reports-gross-profit"
          title="Gross Profit (COGS)"
          value={todayProfit}
          prefix={`${currencySymbol} `}
          icon={TrendingUp}
          iconColor="blue"
          valueClassName="font-mono text-blue-700 dark:text-cyan-400"
          subtext={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Margin Realized</span>
              <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-cyan-300 border border-blue-100 dark:border-blue-500/30">
                {profitMarginPercent}%
              </span>
            </div>
          }
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        {/* CARD 3: ALL-TIME SALES VOLUME */}
        <StatCard
          id="stat-reports-alltime-revenue"
          title="All-Time Revenue"
          value={allTimeRevenue}
          prefix={`${currencySymbol} `}
          icon={ShoppingBag}
          iconColor="purple"
          valueClassName="font-mono text-purple-700 dark:text-purple-400"
          subtext={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 dark:text-slate-400 font-medium">Cumulative POS volume</span>
              <span className="text-slate-500 dark:text-slate-400 font-mono font-medium">{allTimeSalesCount} total</span>
            </div>
          }
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        {/* CARD 4: CRITICAL STOCK ALERT ITEMS */}
        <StatCard
          id="stat-reports-critical-reorders"
          title="Critical Re-orders"
          value={lowStockCount}
          suffix=" models"
          icon={AlertTriangle}
          iconColor="amber"
          valueClassName="font-mono text-amber-600 dark:text-amber-400"
          subtext={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-700 dark:text-amber-400 font-semibold">Below safety threshold</span>
              <button
                type="button"
                onClick={() => setActiveTab('stock_alerts')}
                className="text-blue-600 dark:text-purple-300 hover:underline font-bold text-[10.5px] cursor-pointer"
              >
                View list &rarr;
              </button>
            </div>
          }
          loading={isLoading}
          delay={0}
          duration={1200}
        />
      </div>

      {/* Filter and Tab Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.25 }}
        className="app-card p-4 flex flex-wrap items-center justify-between gap-3 text-xs transition-colors dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 dark:border-purple-800/80 dark:text-white"
      >
        {/* Tab Buttons - Responsive Scrollable Underline Navigation */}
        <div 
          ref={reportsTabContainerRef}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-0 no-scrollbar scrollbar-none tab-scrollbar-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-thumb]:hidden [&::-webkit-scrollbar-track]:hidden border-b border-slate-200/80 dark:border-purple-900/50"
        >
          <button
            id="reports-tab-overview"
            onClick={() => setActiveTab('overview')}
            data-active={activeTab === 'overview'}
            data-tab="overview"
            className={`tab-underline-link relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'overview'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'overview' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Overview</span>
            {activeTab === 'overview' && (
              <motion.div
                layoutId="reportsActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>

          <button
            id="reports-tab-sales-ledger"
            onClick={() => setActiveTab('sales_ledger')}
            data-active={activeTab === 'sales_ledger'}
            data-tab="sales_ledger"
            className={`tab-underline-link relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'sales_ledger'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <Receipt className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'sales_ledger' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Sales Ledger</span>
            <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono transition-colors duration-200 ${
              activeTab === 'sales_ledger'
                ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {salesHistory.length}
            </span>
            {activeTab === 'sales_ledger' && (
              <motion.div
                layoutId="reportsActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>

          <button
            id="reports-tab-profit-loss"
            onClick={() => setActiveTab('profit_loss')}
            data-active={activeTab === 'profit_loss'}
            data-tab="profit_loss"
            className={`tab-underline-link relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'profit_loss'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <BarChart3 className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'profit_loss' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Profit &amp; Loss (P&amp;L)</span>
            {activeTab === 'profit_loss' && (
              <motion.div
                layoutId="reportsActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>

          <button
            id="reports-tab-stock-alerts"
            onClick={() => setActiveTab('stock_alerts')}
            data-active={activeTab === 'stock_alerts'}
            data-tab="stock_alerts"
            className={`tab-underline-link relative inline-flex items-center gap-2 px-3.5 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-colors duration-300 cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === 'stock_alerts'
                ? 'active text-purple-600 dark:text-purple-400 font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 transition-colors duration-200 ${activeTab === 'stock_alerts' ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`} />
            <span>Re-order Alerts</span>
            {lowStockCount > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors duration-200 ${
                activeTab === 'stock_alerts'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                {lowStockCount}
              </span>
            )}
            {activeTab === 'stock_alerts' && (
              <motion.div
                layoutId="reportsActiveUnderline"
                className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 shadow-[0_2px_8px_rgba(147,51,234,0.45)] pointer-events-none z-10"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
          </button>

          {/* Scroll End Buffer Spacer: Ensures the last tab is 100% visible and never clipped */}
          <div className="tab-end-spacer shrink-0 w-8 sm:w-10 h-1 pointer-events-none self-stretch" aria-hidden="true" role="presentation" />
        </div>

        {/* Tab Context Search & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {(activeTab === 'sales_ledger' || activeTab === 'stock_alerts') && (
            <div className="relative flex-1 sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-purple-300" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === 'sales_ledger'
                    ? 'Search invoice, customer...'
                    : 'Search article or barcode...'
                }
                className="app-input w-full pl-9 pr-8 py-2 text-xs font-medium dark:bg-slate-900/80 dark:border-purple-800/60 dark:text-white dark:placeholder-slate-400 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {activeTab === 'sales_ledger' && (
            <>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="px-3.5 py-2 bg-slate-50 dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 text-slate-800 dark:text-purple-200 hover:bg-slate-100 dark:hover:bg-purple-500/30 dark:hover:text-white dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] rounded-xl outline-none font-medium focus:border-blue-500 dark:focus:border-purple-400 cursor-pointer transition text-xs"
              >
                <option value="ALL" className="dark:bg-[#120726] dark:text-purple-100">All Payments</option>
                <option value="CASH" className="dark:bg-[#120726] dark:text-purple-100">Cash Only</option>
                <option value="CARD" className="dark:bg-[#120726] dark:text-purple-100">Card Only</option>
                <option value="ONLINE" className="dark:bg-[#120726] dark:text-purple-100">Online/UPI</option>
              </select>

              <button
                onClick={handleExportSalesCsv}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-purple-900/30 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 text-xs"
                title="Export Sales Ledger as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </>
          )}

          {activeTab === 'profit_loss' && (
            <>
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-purple-800/60 p-1 rounded-xl">
                <button
                  onClick={() => setDateRange('today')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    dateRange === 'today'
                      ? 'bg-white dark:bg-purple-600 text-blue-600 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-purple-200/80 dark:hover:text-white'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setDateRange('7days')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    dateRange === '7days'
                      ? 'bg-white dark:bg-purple-600 text-blue-600 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-purple-200/80 dark:hover:text-white'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setDateRange('30days')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                    dateRange === '30days'
                      ? 'bg-white dark:bg-purple-600 text-blue-600 dark:text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900 dark:text-purple-200/80 dark:hover:text-white'
                  }`}
                >
                  30 Days
                </button>
              </div>

              <button
                onClick={handleExportPLCsv}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-purple-900/30 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 font-bold rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 text-xs"
                title="Export P&L Report as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* TAB CONTENT: 1. EXECUTIVE OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 7-Day Sales Trend Bar Visualizer */}
          {dashboardData?.sevenDaysSales && dashboardData.sevenDaysSales.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="app-card p-5 space-y-3 transition-colors dark:border-purple-800/60"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-slate-900 dark:text-white">
                  <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-bold text-sm">7-Day Sales Revenue Trend</h3>
                </div>
                <span className="text-[11px] font-medium text-slate-400 dark:text-purple-300/70">Past week activity</span>
              </div>

              {/* Chart Visualizer */}
              {(() => {
                const maxVal = Math.max(
                  ...dashboardData.sevenDaysSales.map((d: any) => d.amount || 0),
                  100
                );
                return (
                  <div className="grid grid-cols-7 gap-2 pt-4 items-end h-40">
                    {dashboardData.sevenDaysSales.map((item: any, idx: number) => {
                      const heightPercent =
                        (item.amount || 0) > 0
                          ? Math.max(8, Math.round(((item.amount || 0) / maxVal) * 100))
                          : 0;
                      const isToday = idx === dashboardData.sevenDaysSales.length - 1;
                      return (
                        <div key={idx} className="flex flex-col items-center h-full justify-end group">
                          {/* Bar Tooltip / Amount */}
                          <div
                            className={`text-[10px] font-mono font-bold mb-1 transition ${
                              isToday
                                ? 'text-purple-700 dark:text-purple-300 font-extrabold'
                                : 'text-slate-500 dark:text-purple-200/70 group-hover:text-purple-600 dark:group-hover:text-purple-300'
                            }`}
                          >
                            {currencySymbol} {formatStockPrice(item.amount || 0)}
                          </div>
                          {/* Animated Bar */}
                          <div className="w-full max-w-[3.5rem] bg-slate-100 dark:bg-purple-950/30 border border-slate-200/50 dark:border-purple-900/40 rounded-t-lg overflow-hidden flex flex-col justify-end h-28">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${heightPercent}%` }}
                              transition={{ duration: 0.5, delay: idx * 0.05 }}
                              className={`w-full rounded-t-lg transition-all ${
                                isToday
                                  ? 'bg-gradient-to-t from-purple-700 via-indigo-600 to-purple-500 shadow-md shadow-purple-600/30 dark:shadow-[0_0_14px_rgba(147,51,234,0.45)] ring-1 ring-purple-400/40'
                                  : 'bg-gradient-to-t from-indigo-700/80 via-purple-600/85 to-indigo-500/80 hover:from-purple-700 hover:via-indigo-600 hover:to-purple-500 group-hover:from-purple-700 group-hover:via-indigo-600 group-hover:to-purple-500 group-hover:shadow-md group-hover:shadow-purple-600/25'
                              }`}
                            />
                          </div>
                          {/* Date Label */}
                          <div
                            className={`mt-2 text-[10px] text-center truncate w-full ${
                              isToday
                                ? 'font-bold text-purple-700 dark:text-purple-300'
                                : 'font-semibold text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {item.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* 2-Column Grid: Top Selling & Critical Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Selling Products */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="app-card p-5 space-y-4 transition-colors dark:border-purple-800/60"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-slate-900 dark:text-white">
                  <Award className="w-4 h-4 text-blue-600 dark:text-purple-400" />
                  <h3 className="font-bold text-sm">Best Selling Footwear Models</h3>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-purple-300/70 font-mono">Top Movers</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-purple-800/60 shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 font-semibold text-slate-700 dark:text-white text-[11px] border-b border-slate-200 dark:border-purple-800/80">
                    <tr>
                      <th className="py-2.5 px-3">Rank &amp; Article</th>
                      <th className="py-2.5 px-3 text-center">Pairs Sold</th>
                      <th className="py-2.5 px-3 text-right">Revenue</th>
                      <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-slate-500">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                            <p className="font-medium text-xs">Loading sales rankings...</p>
                          </div>
                        </td>
                      </tr>
                    ) : topSelling.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-slate-500">
                          No product sales recorded yet.
                        </td>
                      </tr>
                    ) : (
                      topSelling.slice(0, 6).map((ts, idx) => (
                        <tr key={idx} className="table-row-hover border-b border-slate-100 dark:border-slate-800/80">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                                  idx === 0
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                                    : idx === 1
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                    : idx === 2
                                    ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-800 dark:text-amber-400'
                                    : 'text-slate-400 font-normal'
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {ts.article || ts.productName || ts.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900 dark:text-white">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px]">
                              {ts.totalQuantitySold || ts.unitsSold || 0} pairs
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {currencySymbol} {formatStockPrice(ts.totalRevenue || 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol} {formatStockPrice(ts.totalProfit || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Low Stock Re-order Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="app-card p-5 space-y-4 transition-colors dark:border-purple-800/60"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-2 text-slate-900 dark:text-white">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <h3 className="font-bold text-sm">Low Stock Re-order Alerts</h3>
                </div>
                <button
                  onClick={() => setActiveTab('stock_alerts')}
                  className="text-xs font-bold text-blue-600 dark:text-purple-300 hover:underline cursor-pointer"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-purple-800/60 shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 font-semibold text-slate-700 dark:text-white text-[11px] border-b border-slate-200 dark:border-purple-800/80">
                    <tr>
                      <th className="py-2.5 px-3">Article</th>
                      <th className="py-2.5 px-3 text-center">In Stock</th>
                      <th className="py-2.5 px-3 text-center">Safety Limit</th>
                      <th className="py-2.5 px-3 text-right">Min Retail Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                    {lowStockList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                          All shoe articles are currently above minimum stock thresholds!
                        </td>
                      </tr>
                    ) : (
                      lowStockList.slice(0, 6).map((p: any) => (
                        <tr key={p.id} className="table-row-hover border-b border-slate-100 dark:border-slate-800/80">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">{p.article || p.name}</div>
                            {p.barcode && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                Barcode: {p.barcode}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                p.total_stock <= 0 || p.totalStock <= 0
                                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                                  : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                              }`}
                            >
                              {p.total_stock ?? p.totalStock ?? 0} pairs
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400">
                            {p.low_stock_limit ?? p.lowStockLimit ?? 5}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {currencySymbol} {formatStockPrice(p.minSalePrice || p.min_sale_price || 0)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>

          {/* Recent POS Counter Sales Activity */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="app-card p-5 space-y-4 transition-colors dark:border-purple-800/60"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-slate-900 dark:text-white">
                <Receipt className="w-4 h-4 text-blue-600 dark:text-purple-400" />
                <h3 className="font-bold text-sm">Recent POS Counter Sales Activity</h3>
              </div>
              <button
                onClick={() => setActiveTab('sales_ledger')}
                className="text-xs font-bold text-blue-600 dark:text-purple-300 hover:underline cursor-pointer"
              >
                Full Sales Ledger ({salesHistory.length}) &rarr;
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-purple-800/60 shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 font-semibold text-slate-700 dark:text-white text-[11px] border-b border-slate-200 dark:border-purple-800/80">
                  <tr>
                    <th className="py-2.5 px-3">Invoice Number</th>
                    <th className="py-2.5 px-3">Date &amp; Time</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Cashier</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3 text-right">Total Payable</th>
                    <th className="py-2.5 px-3 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                          <p className="font-medium text-xs">Loading sales history...</p>
                        </div>
                      </td>
                    </tr>
                  ) : salesHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                        No sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    salesHistory.slice(0, 10).map((s) => (
                      <tr key={s.id} className="table-row-hover border-b border-slate-100 dark:border-slate-800/80">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-purple-400">
                          {s.invoice_number}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{s.sale_date}</td>
                        <td className="py-2.5 px-3 text-slate-900 dark:text-white font-semibold">
                          {s.customer_name || 'Walk-in'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{s.cashier_name || 'Counter'}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800">
                            {s.payment_method || 'Cash'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {formatStockPrice(s.total_amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handlePrintPastSale(s.id)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 font-semibold rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-purple-900/30 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 transition cursor-pointer"
                          >
                            <Printer className="w-3 h-3 text-blue-600 dark:text-purple-400" />
                            <span>Re-Print</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>
      )}

      {/* TAB CONTENT: 2. SALES LEDGER */}
      {activeTab === 'sales_ledger' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-card p-5 space-y-4 transition-colors dark:border-purple-800/60"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Complete POS Sales Ledger</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Filtered records: <span className="font-bold text-slate-900 dark:text-white">{filteredSales.length}</span> invoices
                {filteredSales.length > 0 && (
                  <span className="ml-2">
                    • Cumulative Total:{' '}
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {currencySymbol} {formatStockPrice(filteredSalesTotal)}
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-purple-800/60 shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 font-semibold text-slate-700 dark:text-white text-[11px] border-b border-slate-200 dark:border-purple-800/80">
                <tr>
                  <th className="py-2.5 px-3">Invoice Number</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Cashier</th>
                  <th className="py-2.5 px-3">Tender Type</th>
                  <th className="py-2.5 px-3 text-right">Subtotal</th>
                  <th className="py-2.5 px-3 text-right">Discount</th>
                  <th className="py-2.5 px-3 text-right">Net Payable</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                        <p className="font-medium text-xs">Loading sales invoices...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      No invoices found matching current search or filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map((s) => (
                    <tr key={s.id} className="table-row-hover border-b border-slate-100 dark:border-slate-800/80">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-purple-400">
                        {s.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{s.sale_date}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {s.customer_name || 'Walk-in Customer'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{s.cashier_name || 'Counter'}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {s.payment_method || 'Cash'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                        {currencySymbol} {formatStockPrice(s.subtotal || s.total_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                        {parseFloat(s.discount || 0) > 0 ? `-${currencySymbol} ${formatStockPrice(s.discount)}` : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {currencySymbol} {formatStockPrice(s.total_amount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handlePrintPastSale(s.id)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 font-semibold rounded-lg bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-purple-900/30 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 transition cursor-pointer"
                        >
                          <Printer className="w-3 h-3 text-blue-600 dark:text-purple-400" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* TAB CONTENT: 3. PROFIT & LOSS BREAKDOWN */}
      {activeTab === 'profit_loss' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* P&L Financial Cards with Animated Counters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            <StatCard
              id="stat-pl-revenue"
              title="Net Sales Revenue"
              value={parseFloat(profitLossData?.summary?.totalRevenue || 0)}
              prefix={`${currencySymbol} `}
              iconColor="blue"
              valueClassName="font-mono text-slate-900 dark:text-white"
              loading={isLoadingPL}
              delay={0}
              duration={1200}
            />
            <StatCard
              id="stat-pl-cogs"
              title="Cost of Goods (COGS)"
              value={parseFloat(profitLossData?.summary?.totalCost || 0)}
              prefix={`${currencySymbol} `}
              iconColor="slate"
              valueClassName="font-mono text-slate-600 dark:text-slate-400"
              loading={isLoadingPL}
              delay={0}
              duration={1200}
            />
            <StatCard
              id="stat-pl-profit"
              title="Realized Gross Profit"
              value={parseFloat(profitLossData?.summary?.totalProfit || 0)}
              prefix={`${currencySymbol} `}
              iconColor="emerald"
              valueClassName="font-mono text-emerald-600 dark:text-emerald-400"
              loading={isLoadingPL}
              delay={0}
              duration={1200}
            />
            <StatCard
              id="stat-pl-margin"
              title="Overall Gross Margin"
              value={profitLossData?.summary?.profitMargin || '0%'}
              iconColor="purple"
              valueClassName="font-mono text-blue-600 dark:text-purple-400"
              loading={isLoadingPL}
              delay={0}
              duration={1200}
            />
          </div>

          {/* Itemized P&L Table */}
          <div className="app-card p-5 space-y-4 transition-colors dark:border-purple-800/60">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Product-by-Product Profit Analysis</h3>
              {isLoadingPL && (
                <span className="text-xs text-blue-600 dark:text-purple-400 font-medium animate-pulse">
                  Calculating P&amp;L margins...
                </span>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-purple-800/60 shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 font-semibold text-slate-700 dark:text-white text-[11px] border-b border-slate-200 dark:border-purple-800/80">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Footwear Article</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Selling Price</th>
                    <th className="py-2.5 px-3 text-right">Cost Price</th>
                    <th className="py-2.5 px-3 text-right">Net Revenue</th>
                    <th className="py-2.5 px-3 text-right">Profit</th>
                    <th className="py-2.5 px-3 text-center">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                  {isLoadingPL ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        <div className="flex flex-col items-center justify-center space-y-2">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                          <p className="font-medium text-xs">Loading Profit & Loss data...</p>
                        </div>
                      </td>
                    </tr>
                  ) : (!profitLossData?.details || profitLossData.details.length === 0) ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                        No sales records found for selected period.
                      </td>
                    </tr>
                  ) : (
                    profitLossData.details.map((row: any, idx: number) => (
                      <tr key={idx} className="table-row-hover border-b border-slate-100 dark:border-slate-800/80">
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{row.saleDate}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-purple-400">
                          {row.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {row.article || row.productName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">{row.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800 dark:text-slate-200">
                          {currencySymbol} {formatStockPrice(row.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                          {currencySymbol} {formatStockPrice(row.purchasePrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {formatStockPrice(row.netRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {currencySymbol} {formatStockPrice(row.profit)}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              parseFloat(row.marginPercent) >= 20
                                ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                            }`}
                          >
                            {Math.round(parseFloat(row.marginPercent || 0))}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB CONTENT: 4. STOCK RE-ORDER ALERTS */}
      {activeTab === 'stock_alerts' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="app-card p-5 space-y-4 transition-colors dark:border-purple-800/60"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">Critical Stock Re-order Directory</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Shoe models requiring supplier purchase replenishment based on safety thresholds
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-purple-800/60 shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 font-semibold text-slate-700 dark:text-white text-[11px] border-b border-slate-200 dark:border-purple-800/80">
                <tr>
                  <th className="py-2.5 px-3">Article &amp; Model</th>
                  <th className="py-2.5 px-3">Barcode</th>
                  <th className="py-2.5 px-3 text-center">Remaining Stock</th>
                  <th className="py-2.5 px-3 text-center">Re-order Limit</th>
                  <th className="py-2.5 px-3 text-right">Floor Min Sale Price</th>
                  <th className="py-2.5 px-3 text-center">Replenishment Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                        <p className="font-medium text-xs">Loading stock alerts...</p>
                      </div>
                    </td>
                  </tr>
                ) : lowStockList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                      All inventory articles are stocked above safety limits!
                    </td>
                  </tr>
                ) : (
                  lowStockList.map((p: any) => {
                    const remaining = p.total_stock ?? p.totalStock ?? 0;
                    const limit = p.low_stock_limit ?? p.lowStockLimit ?? 5;
                    const isOut = remaining <= 0;
                    return (
                      <tr key={p.id} className="table-row-hover border-b border-slate-100 dark:border-slate-800/80">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-white">{p.article || p.name}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.brandName || 'Brand'}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {p.barcode ? (
                            <div className="text-slate-700 dark:text-slate-300 font-semibold">{p.barcode}</div>
                          ) : (
                            <span className="text-slate-400">---</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold font-mono">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                              isOut
                                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            {remaining} pairs
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 dark:text-slate-400">
                          {limit} pairs
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {currencySymbol} {formatStockPrice(p.minSalePrice || p.min_sale_price || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isOut
                                ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300'
                                : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {isOut ? 'Out of Stock' : 'Re-order Urgently'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Invoice Print Modal for Past Receipts */}
      {selectedSaleForPrint && (
        <InvoicePrintModal
          sale={selectedSaleForPrint}
          companySettings={companySettings}
          onClose={() => setSelectedSaleForPrint(null)}
        />
      )}

      {/* Financial Summary Print Modal / Z-Report Closing Slip */}
      {isPrintSummaryOpen && (
        <FinancialSummaryPrintModal
          dashboardData={dashboardData}
          salesHistory={salesHistory}
          topSelling={topSelling}
          companySettings={companySettings}
          currentUser={currentUser}
          onClose={() => setIsPrintSummaryOpen(false)}
        />
      )}
    </div>
  );
};
