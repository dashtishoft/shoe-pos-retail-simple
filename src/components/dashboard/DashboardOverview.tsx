import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Boxes,
  Users,
  AlertTriangle,
  Calendar,
  ChevronDown,
  Truck,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { formatCurrency } from '../../utils/priceFormat.ts';
import { BrandLogo } from '../common/BrandLogo.tsx';
import { StatCard, triggerStatRecount } from '../common/StatCard.tsx';

interface DashboardOverviewProps {
  currentUser: any;
  companySettings: any;
  onNavigate: (tab: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentUser,
  companySettings,
  onNavigate,
}) => {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'7days' | 'month' | 'year'>('7days');
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  // Initial data accurately reflecting metrics from reference design with dynamic fallback
  const [dashboardData, setDashboardData] = useState<{
    todaySales: number;
    totalProducts: number;
    totalCustomers: number;
    lowStockCount: number;
    totalPurchases: number;
    sevenDaySales: { date: string; label: string; amount: number; txCount: number }[];
    recentTransactions: {
      type: string;
      reference: string;
      customerName: string;
      amount: number;
      status: string;
      date: string;
      timeString?: string;
    }[];
    topSelling: {
      productId: number;
      name: string;
      sku?: string;
      categoryName?: string;
      brandName?: string;
      brandLogo?: string;
      imageUrl?: string;
      stock: number;
      unitsSold: number;
    }[];
    topBrands: {
      id?: number;
      name: string;
      logo?: string;
      soldCount: number;
      percentage: number;
      subtitle: string;
    }[];
  }>({
    todaySales: 0,
    totalProducts: 0,
    totalCustomers: 0,
    lowStockCount: 0,
    totalPurchases: 0,
    sevenDaySales: [],
    recentTransactions: [],
    topSelling: [],
    topBrands: [],
  });

  const currency =
    companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';

  const isRefreshingRef = useRef(false);

  const loadData = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      setLoading(true);
      const res = await api.reports.getDashboard();
      if (res) {
        setDashboardData({
          todaySales: Number(res.today?.totalSales) || 0,
          totalProducts: Number(res.inventory?.totalProducts) || 0,
          totalCustomers: Number(res.customers?.totalCount) || 0,
          lowStockCount: Number(res.inventory?.lowStockCount) || 0,
          totalPurchases: Number(res.purchases?.totalPurchases) || 0,
          sevenDaySales: Array.isArray(res.sevenDaysSales)
            ? res.sevenDaysSales.map((d: any, idx: number) => ({
                date: d.date || '',
                label: d.label || `Day ${idx + 1}`,
                amount: Number(d.amount) || 0,
                txCount: Number(d.count || d.txCount) || 0,
              }))
            : [],
          recentTransactions: Array.isArray(res.recentTransactions)
            ? res.recentTransactions.map((tx: any) => ({
                type: tx.type || 'Sale',
                reference: tx.reference || '',
                customerName: tx.customerName || tx.customer_name || 'Walk-in Customer',
                amount: Number(tx.amount) || 0,
                status: tx.status || 'Completed',
                date: tx.date || new Date().toISOString(),
                timeString: tx.timeString || '',
              }))
            : [],
          topSelling: Array.isArray(res.topSelling)
            ? res.topSelling.map((prod: any) => ({
                productId: prod.productId || prod.id,
                name: prod.name || '',
                sku: prod.sku || '',
                categoryName: prod.categoryName || '',
                brandName: prod.brandName || '',
                brandLogo: prod.brandLogo || '',
                stock: prod.stock !== undefined ? Number(prod.stock) : 0,
                unitsSold: Number(prod.unitsSold || prod.sold || 0),
                imageUrl: prod.imageUrl || '',
              }))
            : [],
          topBrands: Array.isArray(res.topBrands)
            ? res.topBrands.map((b: any) => ({
                id: b.id,
                name: b.name || 'Brand',
                logo: b.logo || '',
                soldCount: Number(b.soldCount) || 0,
                percentage: Number(b.percentage) || 0,
                subtitle: b.subtitle || `${b.soldCount || 0} units`,
              }))
            : [],
        });
      }
    } catch (err) {
      console.warn('Dashboard metrics fetch notice:', err);
    } finally {
      isRefreshingRef.current = false;
      setLoading(false);
      triggerStatRecount();
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate coordinates for dual-spline Sales & Transactions chart
  const chartWidth = 560;
  const chartHeight = 200;
  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const points = dashboardData.sevenDaySales.map((d, index) => {
    const denom = Math.max(1, dashboardData.sevenDaySales.length - 1);
    const x = paddingLeft + (index / denom) * innerWidth;
    // Scale against highest value or min 100
    const maxVal = Math.max(
      100,
      ...dashboardData.sevenDaySales.map((s) => Math.max(s.amount || 0, s.txCount || 0))
    );
    const ySales = paddingTop + innerHeight - ((d.amount || 0) / maxVal) * innerHeight;
    const yTx = paddingTop + innerHeight - ((d.txCount || 0) / maxVal) * innerHeight;
    return { x, ySales, yTx, ...d };
  });

  // Helper function to build smooth cubic Bezier splines
  const buildSplinePath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 5;
      const cp1y = p1.y + (p2.y - p0.y) / 5;
      const cp2x = p2.x - (p3.x - p1.x) / 5;
      const cp2y = p2.y - (p3.y - p1.y) / 5;
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
  };

  const salesLinePath = buildSplinePath(points.map((p) => ({ x: p.x, y: p.ySales })));
  const txLinePath = buildSplinePath(points.map((p) => ({ x: p.x, y: p.yTx })));

  const baselineY = paddingTop + innerHeight;
  const lastX = points.length > 0 ? points[points.length - 1].x : innerWidth;
  const firstX = points.length > 0 ? points[0].x : paddingLeft;

  const salesAreaPath = points.length > 0 && salesLinePath ? `${salesLinePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z` : '';
  const txAreaPath = points.length > 0 && txLinePath ? `${txLinePath} L ${lastX},${baselineY} L ${firstX},${baselineY} Z` : '';

  return (
    <div className="p-4 sm:p-6 lg:p-7 space-y-6 max-w-7xl mx-auto select-none bg-[#F8FAFC] dark:bg-[#0A0E1A] min-h-screen text-slate-800 dark:text-slate-100 transition-colors">
      {/* DASHBOARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Welcome back, {currentUser?.name || 'Store Owner'}! Here's what's happening with your store today.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#0E1628] border border-slate-200/90 dark:border-[#1A263D] text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{formattedDate}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            title={loading ? "Refreshing metrics..." : "Refresh metrics & recount stats"}
            className="p-1.5 rounded-xl bg-white hover:text-blue-600 border border-slate-200/90 shadow-2xs dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] text-slate-500 cursor-pointer transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600 dark:text-purple-300' : 'text-slate-500 dark:text-purple-300'}`} />
          </button>
        </div>
      </div>

      {/* ROW 1: 5 KPI METRIC CARDS WITH ANIMATED COUNTER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Today's Sales */}
        <StatCard
          id="stat-today-sales"
          title="Today's Sales"
          value={dashboardData.todaySales}
          prefix={`${currency} `}
          icon={ShoppingCart}
          iconColor="blue"
          sparkline="blue"
          trendIndicator={
            dashboardData.todaySales > 0
              ? { value: 'Active', direction: 'up', label: 'today' }
              : undefined
          }
          loading={loading}
          delay={0}
          duration={1200}
        />

        {/* Card 2: Total Products */}
        <StatCard
          id="stat-total-products"
          title="Total Products"
          value={dashboardData.totalProducts}
          icon={Boxes}
          iconColor="purple"
          sparkline="purple"
          trendIndicator={
            dashboardData.totalProducts > 0
              ? { value: `${dashboardData.totalProducts}`, direction: 'up', label: 'in inventory' }
              : undefined
          }
          loading={loading}
          delay={0}
          duration={1200}
        />

        {/* Card 3: Total Customers */}
        <StatCard
          id="stat-total-customers"
          title="Total Customers"
          value={dashboardData.totalCustomers}
          icon={Users}
          iconColor="cyan"
          sparkline="cyan"
          trendIndicator={
            dashboardData.totalCustomers > 0
              ? { value: `${dashboardData.totalCustomers}`, direction: 'up', label: 'registered' }
              : undefined
          }
          loading={loading}
          delay={0}
          duration={1200}
        />

        {/* Card 4: Low Stock Items */}
        <StatCard
          id="stat-low-stock"
          title="Low Stock Items"
          value={dashboardData.lowStockCount}
          icon={AlertTriangle}
          iconColor="rose"
          sparkline="rose"
          valueClassName="text-rose-600 dark:text-rose-400"
          trendIndicator={
            dashboardData.lowStockCount > 0
              ? { value: `${dashboardData.lowStockCount}`, direction: 'down', label: 'restock needed' }
              : undefined
          }
          loading={loading}
          delay={0}
          duration={1200}
        />

        {/* Card 5: Total Purchases */}
        <StatCard
          id="stat-total-purchases"
          title="Total Purchases"
          value={dashboardData.totalPurchases}
          prefix={`${currency} `}
          icon={Truck}
          iconColor="sky"
          sparkline="sky"
          trendIndicator={
            dashboardData.totalPurchases > 0
              ? { value: `${dashboardData.totalPurchases}`, direction: 'up', label: 'orders' }
              : undefined
          }
          loading={loading}
          delay={0}
          duration={1200}
        />
      </div>

      {/* ROW 2: 3 CARDS (Sales Overview + Best Selling Brands + Best Selling Products) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        {/* Card 1: Sales Overview (Full on md/lg, span 5 on xl) */}
        <div className="md:col-span-2 lg:col-span-12 xl:col-span-5 app-card p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Sales Overview
            </h2>

            <div className="flex items-center gap-3">
              {/* Chart Legend */}
              <div className="flex items-center gap-2.5 text-[11px]">
                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-[#3B82F6] dark:shadow-[0_0_6px_#3B82F6]" />
                  <span>Sales Amount</span>
                </div>
                <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-[#06B6D4] dark:shadow-[0_0_6px_#06B6D4]" />
                  <span>Transactions</span>
                </div>
              </div>

              {/* Timeframe selector */}
              <div className="relative">
                <select
                  value={timeframe}
                  onChange={(e: any) => setTimeframe(e.target.value)}
                  className="appearance-none bg-slate-50 dark:bg-purple-500/20 border border-slate-200 dark:border-purple-400/40 text-[11px] font-medium text-slate-700 dark:text-purple-200 py-1 pl-2.5 pr-6 rounded-lg outline-none cursor-pointer hover:border-blue-400 dark:hover:bg-purple-500/30 dark:hover:text-white dark:hover:border-purple-400/60 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] transition"
                >
                  <option value="7days" className="dark:bg-[#120726] dark:text-purple-100">Last 7 Days</option>
                  <option value="month" className="dark:bg-[#120726] dark:text-purple-100">This Month</option>
                  <option value="year" className="dark:bg-[#120726] dark:text-purple-100">This Year</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 dark:text-purple-300 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Dual Spline Chart Canvas */}
          <div className="relative w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-48 overflow-visible"
            >
              <defs>
                {/* Sales Area Gradient */}
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
                </linearGradient>

                {/* Transactions Area Gradient */}
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Dotted Horizontal Grid lines */}
              {[100, 80, 60, 40, 20, 0].map((val) => {
                const y = paddingTop + innerHeight - (val / 100) * innerHeight;
                return (
                  <g key={val}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={paddingLeft + innerWidth}
                      y2={y}
                      stroke="currentColor"
                      className="text-slate-100 dark:text-[#1A263D] stroke-1"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3}
                      textAnchor="end"
                      className="text-[9.5px] font-mono fill-slate-400 dark:fill-slate-500"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Sales Area Fill */}
              <path d={salesAreaPath} fill="url(#salesGrad)" />

              {/* Transactions Area Fill */}
              <path d={txAreaPath} fill="url(#txGrad)" />

              {/* Sales Spline Curve */}
              <path
                d={salesLinePath}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="neon-glow-blue"
              />

              {/* Transactions Spline Curve */}
              <path
                d={txLinePath}
                fill="none"
                stroke="#06B6D4"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="neon-glow-cyan"
              />

              {/* Point Markers and Tooltips */}
              {points.map((p, i) => {
                const isHovered = hoveredPoint === i;
                return (
                  <g
                    key={`point-${p.label}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  >
                    {/* Sales Node Circle */}
                    <circle
                      cx={p.x}
                      cy={p.ySales}
                      r={isHovered ? 5.5 : 3.5}
                      className="fill-white dark:fill-[#0A0E1A] stroke-[#3B82F6] transition-all"
                      strokeWidth="2.5"
                    />

                    {/* Tx Node Circle */}
                    <circle
                      cx={p.x}
                      cy={p.yTx}
                      r={isHovered ? 5 : 3}
                      className="fill-white dark:fill-[#0A0E1A] stroke-[#06B6D4] transition-all"
                      strokeWidth="2"
                    />

                    {/* X-Axis Day Labels */}
                    <text
                      x={p.x}
                      y={chartHeight - 8}
                      textAnchor="middle"
                      className="text-[10px] font-medium fill-slate-500 dark:fill-slate-400"
                    >
                      {p.label}
                    </text>

                    {/* Interactive Tooltip Bubble on Hover */}
                    {isHovered && (
                      <g className="pointer-events-none">
                        <rect
                          x={Math.max(paddingLeft, Math.min(p.x - 55, chartWidth - 120))}
                          y={Math.min(p.ySales, p.yTx) - 44}
                          width="110"
                          height="36"
                          rx="8"
                          className="fill-slate-900 dark:fill-[#131F37] stroke stroke-slate-700 dark:stroke-[#1E2D4A] shadow-xl"
                        />
                        <text
                          x={Math.max(paddingLeft + 55, Math.min(p.x, chartWidth - 65))}
                          y={Math.min(p.ySales, p.yTx) - 28}
                          textAnchor="middle"
                          className="text-[9.5px] font-bold fill-white font-mono"
                        >
                          Sales: {p.amount}
                        </text>
                        <text
                          x={Math.max(paddingLeft + 55, Math.min(p.x, chartWidth - 65))}
                          y={Math.min(p.ySales, p.yTx) - 15}
                          textAnchor="middle"
                          className="text-[9px] font-medium fill-cyan-400 font-mono"
                        >
                          {p.txCount} Transactions
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Card 2: Best Selling Brands (Span 1 on md, 6 on lg, 4 on xl) */}
        <div className="md:col-span-1 lg:col-span-6 xl:col-span-4 app-card p-5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Best Selling Brands
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              View Catalog
            </button>
          </div>

          {/* Circular Donut Gauges with Brand Logos / Placeholders */}
          {dashboardData.topBrands.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              No brand performance data yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 py-2 my-auto min-w-0">
              {dashboardData.topBrands.slice(0, 2).map((brand, idx) => {
                const pct = brand.percentage || 0;
                const circumference = 238.76;
                const strokeColor = idx === 0 ? '#3B82F6' : '#8B5CF6';

                return (
                  <div key={brand.id || idx} className="flex flex-col items-center text-center min-w-0">
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 max-w-full flex items-center justify-center shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        {/* Track */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          className="text-slate-100 dark:text-slate-800 stroke-current"
                          strokeWidth="7"
                          fill="none"
                        />
                        {/* Progress Arc */}
                        <circle
                          cx="50"
                          cy="50"
                          r="38"
                          stroke={strokeColor}
                          strokeWidth="7"
                          strokeLinecap="round"
                          fill="none"
                          strokeDasharray={circumference}
                          strokeDashoffset={circumference * (1 - pct / 100)}
                          className={`transition-all duration-500 ${idx === 0 ? 'neon-glow-blue' : ''}`}
                        />
                      </svg>
                      {/* Brand Logo or Placeholder in center of ring */}
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                        <BrandLogo
                          logo={brand.logo}
                          name={brand.name}
                          size="sm"
                          className="pointer-events-none"
                        />
                      </div>
                    </div>
                    <div className="mt-2.5 w-full min-w-0 px-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {brand.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                        {brand.subtitle}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 3: Best Selling Products (Span 1 on md, 6 on lg, 3 on xl) */}
        <div className="md:col-span-1 lg:col-span-6 xl:col-span-3 app-card p-5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Best Selling Products
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {dashboardData.topSelling.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              No product sales recorded yet.
            </div>
          ) : (
            <div className="space-y-3 my-auto min-w-0">
              {dashboardData.topSelling.slice(0, 3).map((prod, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition min-w-0"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 dark:bg-slate-950/60 overflow-hidden shrink-0 border border-slate-200/60 dark:border-slate-800">
                      <img
                        src={
                          prod.imageUrl ||
                          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop&q=80'
                        }
                        alt={prod.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {prod.name}
                      </div>
                      <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 flex-wrap">
                        {prod.categoryName && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border border-blue-200/80 dark:border-cyan-500/30 whitespace-nowrap">
                            {prod.categoryName}
                          </span>
                        )}
                        {prod.brandName && (
                          <div className="inline-flex items-center gap-1 min-w-0">
                            <BrandLogo logo={prod.brandLogo} name={prod.brandName} size="xs" />
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate max-w-[80px]">
                              {prod.brandName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 ml-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      Stock: {prod.stock}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 whitespace-nowrap">
                      Sold: {prod.unitsSold}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ROW 3: LATEST TRANSACTIONS & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Latest Transactions (Span 7) */}
        <div className="lg:col-span-7 app-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Latest Transactions
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-bold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900">
                <tr className="border-b border-slate-100 dark:border-purple-800/80 text-slate-400 dark:text-white font-semibold">
                  <th className="py-2.5 px-3 font-semibold">Transaction ID #</th>
                  <th className="py-2.5 px-3 font-semibold">Customer Name</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Time</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                        <p className="font-medium text-xs">Loading recent transactions...</p>
                      </div>
                    </td>
                  </tr>
                ) : dashboardData.recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  dashboardData.recentTransactions.map((tx, idx) => (
                  <tr
                    key={idx}
                    className="table-row-hover"
                  >
                    <td className="py-3 font-semibold text-blue-600 dark:text-cyan-400 cursor-pointer hover:underline">
                      {tx.reference}
                    </td>
                    <td className="py-3 text-slate-800 dark:text-slate-200 font-medium">
                      {tx.customerName}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold ${
                          idx % 2 === 1
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {tx.timeString || (tx.date ? new Date(tx.date).toLocaleDateString() : '—')}
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatCurrency(tx.amount, currency)}
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick Actions (Span 5) */}
        <div className="lg:col-span-5 app-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Quick Actions
            </h2>
            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Shortcuts F1–F4
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 flex-1">
            {/* Action 1: New Sale (F1) */}
            <button
              type="button"
              onClick={() => onNavigate('pos')}
              className="quick-action-btn p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 hover:bg-gradient-to-r hover:from-[#9333ea] hover:via-[#4f46e5] hover:to-[#7e22ce] dark:hover:from-[#9333ea] dark:hover:via-[#4f46e5] dark:hover:to-[#7e22ce] hover:border-purple-400/80 dark:hover:border-purple-400/80 hover:shadow-lg hover:shadow-purple-600/25 dark:hover:shadow-[0_0_24px_rgba(147,51,234,0.4)] text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition shadow-2xs backdrop-blur-xs">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition backdrop-blur-xs">
                  F1
                </kbd>
              </div>
              <div className="mt-3.5 sm:mt-4">
                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-white transition">
                  New Sale
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-purple-100 mt-0.5 transition">
                  Counter POS
                </div>
              </div>
            </button>

            {/* Action 2: Add Product (F2) */}
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="quick-action-btn p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 hover:bg-gradient-to-r hover:from-[#9333ea] hover:via-[#4f46e5] hover:to-[#7e22ce] dark:hover:from-[#9333ea] dark:hover:via-[#4f46e5] dark:hover:to-[#7e22ce] hover:border-purple-400/80 dark:hover:border-purple-400/80 hover:shadow-lg hover:shadow-purple-600/25 dark:hover:shadow-[0_0_24px_rgba(147,51,234,0.4)] text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition shadow-2xs backdrop-blur-xs">
                  <Boxes className="w-5 h-5" />
                </div>
                <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition backdrop-blur-xs">
                  F2
                </kbd>
              </div>
              <div className="mt-3.5 sm:mt-4">
                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-white transition">
                  Add Product
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-purple-100 mt-0.5 transition">
                  Shoe Catalog
                </div>
              </div>
            </button>

            {/* Action 3: New Purchase (F3) */}
            <button
              type="button"
              onClick={() => onNavigate('purchases')}
              className="quick-action-btn p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 hover:bg-gradient-to-r hover:from-[#9333ea] hover:via-[#4f46e5] hover:to-[#7e22ce] dark:hover:from-[#9333ea] dark:hover:via-[#4f46e5] dark:hover:to-[#7e22ce] hover:border-purple-400/80 dark:hover:border-purple-400/80 hover:shadow-lg hover:shadow-purple-600/25 dark:hover:shadow-[0_0_24px_rgba(147,51,234,0.4)] text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition shadow-2xs backdrop-blur-xs">
                  <Truck className="w-5 h-5" />
                </div>
                <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition backdrop-blur-xs">
                  F3
                </kbd>
              </div>
              <div className="mt-3.5 sm:mt-4">
                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-white transition">
                  New Purchase
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-purple-100 mt-0.5 transition">
                  Stock Receiving
                </div>
              </div>
            </button>

            {/* Action 4: Sales Return (F4) */}
            <button
              type="button"
              onClick={() => onNavigate('returns')}
              className="quick-action-btn p-3.5 sm:p-4 rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-slate-50/70 dark:bg-slate-950/50 hover:bg-gradient-to-r hover:from-[#9333ea] hover:via-[#4f46e5] hover:to-[#7e22ce] dark:hover:from-[#9333ea] dark:hover:via-[#4f46e5] dark:hover:to-[#7e22ce] hover:border-purple-400/80 dark:hover:border-purple-400/80 hover:shadow-lg hover:shadow-purple-600/25 dark:hover:shadow-[0_0_24px_rgba(147,51,234,0.4)] text-left transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-2xs overflow-hidden"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition shadow-2xs backdrop-blur-xs">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <kbd className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 group-hover:bg-white/20 group-hover:border-white/35 group-hover:text-white transition backdrop-blur-xs">
                  F4
                </kbd>
              </div>
              <div className="mt-3.5 sm:mt-4">
                <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-white transition">
                  Sales Return
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-purple-100 mt-0.5 transition">
                  Shoe Exchange
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="pt-6 pb-2 text-center text-xs text-slate-400 dark:text-slate-500 transition-colors">
        Designed &amp; Developed by <span className="font-semibold text-slate-600 dark:text-slate-300">SarbaazSoft</span> &copy; 2026
      </footer>
    </div>
  );
};
