import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Globe,
  Truck,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  FileText,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { formatStockPrice } from '../../utils/priceFormat.ts';
import { SupplierReturnModal } from '../purchases/SupplierReturnModal.tsx';
import { PurchaseReturnDetailsModal } from '../purchases/PurchaseReturnDetailsModal.tsx';
import { SupplierPaymentModal } from './SupplierPaymentModal.tsx';
import { SupplierLedgerModal } from './SupplierLedgerModal.tsx';
import { StatCard, triggerStatRecount } from '../common/StatCard.tsx';

interface SupplierManagementProps {
  currentUser: any;
  companySettings: any;
  onNavigateToPurchase?: (supplierId?: number, supplierName?: string) => void;
}

export const SupplierManagement: React.FC<SupplierManagementProps> = ({
  currentUser,
  companySettings,
  onNavigateToPurchase,
}) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View Supplier Details & Purchase History Modal
  const [viewSupplierModalOpen, setViewSupplierModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [supplierPurchases, setSupplierPurchases] = useState<any[]>([]);
  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [supplierModalTab, setSupplierModalTab] = useState<'purchases' | 'returns'>('purchases');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Supplier Returns & Debit Note Modals
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnSupplierId, setReturnSupplierId] = useState<number | undefined>();
  const [selectedReturnRecord, setSelectedReturnRecord] = useState<any | null>(null);
  const [isReturnDetailsModalOpen, setIsReturnDetailsModalOpen] = useState(false);

  // Supplier Payment & Complete Ledger Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentModalSupplier, setPaymentModalSupplier] = useState<any | null>(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [ledgerModalSupplierId, setLedgerModalSupplierId] = useState<number | null>(null);

  // Delete Confirmation
  const [deletingSupplierId, setDeletingSupplierId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const currencySymbol = companySettings?.currency_symbol || companySettings?.currencySymbol || 'Rs.';
  const isAdmin = currentUser?.role === 'ADMIN';

  const isRefreshingRef = useRef(false);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async (query?: string) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setIsLoading(true);
    try {
      const res = await api.suppliers.list(query !== undefined ? query : searchTerm.trim() || undefined);
      setSuppliers(res.suppliers || []);
    } catch (e) {
      console.error('Failed to load suppliers:', e);
    } finally {
      isRefreshingRef.current = false;
      setIsLoading(false);
      triggerStatRecount();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSuppliers(searchTerm.trim());
  };

  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setEmail('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sup: any) => {
    setEditingSupplier(sup);
    setName(sup.name || '');
    setPhone(sup.phone || '');
    setEmail(sup.email || '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      };

      if (editingSupplier) {
        await api.suppliers.update(editingSupplier.id, payload);
      } else {
        await api.suppliers.create(payload);
      }

      setIsModalOpen(false);
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || 'Failed to save supplier record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewSupplierHistory = async (sup: any) => {
    setSelectedSupplier(sup);
    setViewSupplierModalOpen(true);
    setSupplierModalTab('purchases');
    setIsLoadingHistory(true);
    try {
      const res = await api.suppliers.get(sup.id);
      setSelectedSupplier(res.supplier);
      setSupplierPurchases(res.purchases || []);
      setSupplierReturns(res.returns || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteSupplier = async (id: number) => {
    setIsDeleting(true);
    try {
      await api.suppliers.delete(id);
      setDeletingSupplierId(null);
      loadSuppliers();
    } catch (e: any) {
      alert(e.message || 'Failed to delete supplier');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalSuppliersCount = suppliers.length;
  const totalPurchasedAmount = suppliers.reduce((acc, s) => acc + (parseFloat(s.total_purchased_amount || 0) || 0), 0);
  const totalPaidAmount = suppliers.reduce((acc, s) => acc + (parseFloat(s.total_paid_amount || 0) || 0), 0);
  const totalNetPayable = suppliers.reduce((acc, s) => {
    const net = parseFloat(s.net_payable_balance ?? s.balance ?? 0);
    return acc + (isNaN(net) ? 0 : net);
  }, 0);

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto text-xs">
      {/* Top Header Card */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-purple-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 dark:text-white transition-colors"
      >
        <div>
          <div className="flex items-center space-x-3 text-slate-900 dark:text-white">
            <span className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-purple-500/20 border border-blue-100 dark:border-purple-400/30 flex items-center justify-center text-blue-600 dark:text-purple-300 shrink-0 shadow-2xs">
              <Building2 className="w-5 h-5 stroke-[2.2]" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Supplier & Vendor Management</h2>
                <span className="bg-blue-100 dark:bg-purple-500/30 text-blue-700 dark:text-purple-200 border border-blue-200 dark:border-purple-400/40 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full tracking-wide">
                  {suppliers.length} Registered
                </span>
              </div>
              <p className="text-slate-500 dark:text-purple-200/80 text-xs sm:text-sm mt-0.5">
                Maintain footwear manufacturers, vendor catalogs, payments, and complete account khata ledgers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {suppliers.length > 0 && (
            <button
              onClick={() => {
                const supWithBalance =
                  suppliers.find((s) => {
                    const p = parseFloat(s.total_purchased_amount || 0);
                    const r = parseFloat(s.total_returns_amount || 0);
                    const paid = parseFloat(s.total_paid_amount || 0);
                    return p - r - paid > 0;
                  }) || suppliers[0];
                setPaymentModalSupplier(supWithBalance);
                setIsPaymentModalOpen(true);
              }}
              style={{ color: '#ffffff' }}
              className="btn-pure-white supplier-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 !text-white text-white shadow-md shadow-emerald-600/25 active:scale-95 transition cursor-pointer"
              title="Record payment voucher to supplier"
            >
              <CreditCard className="w-4 h-4 stroke-[2.2] !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
              <span className="!text-white font-bold text-white" style={{ color: '#ffffff' }}>Record Payment</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => loadSuppliers(searchTerm)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] active:scale-[0.98] transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
            title={isLoading ? "Refreshing suppliers..." : "Refresh suppliers & recount metrics"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600 dark:text-purple-400' : ''}`} />
            <span>Refresh</span>
          </button>

          {onNavigateToPurchase && (
            <button
              onClick={() => onNavigateToPurchase()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] active:scale-[0.98] transition cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Purchases List</span>
            </button>
          )}

          <button
            onClick={handleOpenAddModal}
            style={{ color: '#ffffff' }}
            className="btn-pure-white supplier-btn inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 !text-white text-white rounded-xl text-xs font-bold border border-purple-400/40 shadow-md shadow-purple-600/25 dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-500 dark:hover:to-indigo-500 dark:border-purple-400/50 dark:shadow-[0_0_18px_rgba(147,51,234,0.35)] transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
            <span className="!text-white font-bold text-white" style={{ color: '#ffffff' }}>Add New Supplier</span>
          </button>
        </div>
      </motion.div>

      {/* KPI Stats Banner with Animated Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          id="stat-registered-vendors"
          layout="horizontal"
          title="Registered Vendors"
          value={totalSuppliersCount}
          icon={Building2}
          iconColor="blue"
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        <StatCard
          id="stat-total-procured"
          layout="horizontal"
          title="Total Procured"
          value={totalPurchasedAmount}
          prefix={`${currencySymbol} `}
          icon={Truck}
          iconColor="purple"
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        <StatCard
          id="stat-total-paid-vendors"
          layout="horizontal"
          title="Total Paid to Vendors"
          value={totalPaidAmount}
          prefix={`${currencySymbol} `}
          icon={CreditCard}
          iconColor="emerald"
          valueClassName="text-emerald-600 dark:text-emerald-400 font-mono"
          loading={isLoading}
          delay={0}
          duration={1200}
        />

        <StatCard
          id="stat-net-balance-payable"
          layout="horizontal"
          title="Net Balance Payable"
          value={totalNetPayable}
          prefix={`${currencySymbol} `}
          icon={DollarSign}
          iconColor="amber"
          valueClassName="text-amber-600 dark:text-amber-300 font-mono"
          loading={isLoading}
          delay={0}
          duration={1200}
        />
      </div>

      {/* Filter and Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="bg-white dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900 p-3 rounded-2xl border border-slate-200/90 dark:border-purple-800/80 shadow-xs flex flex-col sm:flex-row gap-3 transition-colors dark:text-white"
      >
        <form onSubmit={handleSearchSubmit} className="relative flex-1 flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-slate-400 dark:text-purple-300/70" />
          <input
            type="text"
            placeholder="Search suppliers by company name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-24 py-2 text-xs bg-white dark:bg-purple-950/40 text-slate-900 dark:text-purple-100 placeholder-slate-400 dark:placeholder-purple-300/50 border border-slate-200 dark:border-purple-700/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-purple-500/40 focus:border-blue-500 dark:focus:border-purple-400 font-medium transition shadow-2xs"
          />
          <button
            type="submit"
            style={{ color: '#ffffff' }}
            className="btn-pure-white supplier-btn absolute right-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 !text-white text-white border border-purple-400/40 shadow-sm shadow-purple-600/25 dark:from-purple-600 dark:to-indigo-600 dark:border-purple-400/50 transition cursor-pointer active:scale-95"
          >
            <span className="!text-white font-semibold text-white" style={{ color: '#ffffff' }}>Search</span>
          </button>
        </form>

        <button
          onClick={() => {
            setSearchTerm('');
            loadSuppliers('');
            triggerStatRecount();
          }}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs dark:bg-purple-500/20 dark:hover:bg-purple-500/30 dark:text-purple-200 dark:hover:text-white dark:border-purple-400/40 dark:shadow-[0_0_14px_rgba(147,51,234,0.2)] active:scale-[0.98] transition shrink-0 cursor-pointer"
        >
          Reset Filter
        </button>
      </motion.div>

      {/* Suppliers Table */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16 }}
        className="bg-white dark:bg-[#0E1628] rounded-2xl border border-slate-200/90 dark:border-purple-800/60 shadow-xs overflow-hidden transition-colors"
      >
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-purple-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 border border-blue-200 dark:border-purple-400/30 rounded-xl shadow-2xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-white uppercase tracking-wider">
                All Registered Suppliers
              </span>
              <span className="bg-slate-200/80 dark:bg-purple-500/30 text-slate-700 dark:text-purple-200 border border-slate-300 dark:border-purple-400/40 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                {suppliers.length}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-purple-200/70 font-medium">
            Direct contacts, payment ledgers &amp; shipment history
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50/90 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-600 dark:text-white font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-purple-800/80">
              <tr>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Phone Contact</th>
                <th className="py-3 px-4">Email Address</th>
                <th className="py-3 px-3 text-center">Purchases</th>
                <th className="py-3 px-3 text-center">Returns</th>
                <th className="py-3 px-3 text-right">Total Purchased</th>
                <th className="py-3 px-3 text-right">Total Paid</th>
                <th className="py-3 px-3 text-right">Net Payable</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-purple-900/30">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                      <p className="font-medium text-xs">Loading suppliers directory...</p>
                    </div>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    {searchTerm ? 'No suppliers match your search filter.' : 'No suppliers registered yet. Click "Add New Supplier" to get started.'}
                  </td>
                </tr>
              ) : (
                suppliers.map((sup) => {
                  const totalPurchases = parseInt(sup.total_purchases || 0, 10);
                  const totalAmount = parseFloat(sup.total_purchased_amount || 0);
                  const totalPaid = parseFloat(sup.total_paid_amount || 0);
                  const totalReturns = parseInt(sup.total_returns || 0, 10);
                  const totalDebit = parseFloat(sup.total_debit_amount || 0);
                  const netPayable = parseFloat(sup.net_payable_balance ?? sup.balance ?? (totalAmount - totalDebit - totalPaid));

                  return (
                    <tr key={sup.id} className="hover:bg-blue-50/30 dark:hover:bg-purple-950/30 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-purple-500/20 border border-blue-200 dark:border-purple-400/30 text-blue-600 dark:text-purple-300 flex items-center justify-center shrink-0 font-bold text-xs shadow-2xs">
                            {sup.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">{sup.name}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono">
                        {sup.phone ? (
                          <a
                            href={`tel:${sup.phone}`}
                            className="inline-flex items-center text-slate-700 dark:text-purple-200 hover:text-blue-600 dark:hover:text-purple-300 font-medium transition"
                          >
                            <Phone className="w-3 h-3 mr-1 text-slate-400 dark:text-purple-300/60" />
                            {sup.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {sup.email ? (
                          <a
                            href={`mailto:${sup.email}`}
                            className="inline-flex items-center text-slate-600 dark:text-purple-300 hover:text-blue-600 dark:hover:text-purple-200 font-mono text-xs transition"
                          >
                            <Mail className="w-3 h-3 mr-1 text-slate-400 dark:text-purple-300/60" />
                            {sup.email}
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleViewSupplierHistory(sup)}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-purple-500/30 text-blue-700 dark:text-purple-200 border border-blue-200/80 dark:border-purple-400/40 hover:border-blue-400 dark:hover:border-purple-300 transition cursor-pointer"
                        >
                          <span>{totalPurchases} orders</span>
                        </button>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {totalReturns > 0 ? (
                          <button
                            onClick={() => {
                              handleViewSupplierHistory(sup);
                              setSupplierModalTab('returns');
                            }}
                            className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60 rounded-full text-[11px] font-bold cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
                            title={`Total Debited: ${currencySymbol} ${formatStockPrice(totalDebit)}`}
                          >
                            {totalReturns} returns
                          </button>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">-</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {currencySymbol} {formatStockPrice(totalAmount)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {currencySymbol} {formatStockPrice(totalPaid)}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-black">
                        <span className={netPayable > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {currencySymbol} {formatStockPrice(netPayable)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5 flex-wrap gap-y-1">
                          <button
                            onClick={() => {
                              setPaymentModalSupplier(sup);
                              setIsPaymentModalOpen(true);
                            }}
                            title="Record Payment to Supplier"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay</span>
                          </button>

                          <button
                            onClick={() => {
                              setLedgerModalSupplierId(sup.id);
                              setIsLedgerModalOpen(true);
                            }}
                            title="View Complete Supplier Ledger Statement & Khata"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Ledger</span>
                          </button>

                          {onNavigateToPurchase && (
                            <button
                              onClick={() => onNavigateToPurchase(sup.id, sup.name)}
                              title="Record New Purchase from this Supplier"
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-500/20 dark:text-purple-300 dark:hover:text-purple-100 dark:border-purple-800/60 transition cursor-pointer"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setReturnSupplierId(sup.id);
                              setIsReturnModalOpen(true);
                            }}
                            title="Return Defective Cartons to Supplier"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-400 dark:border-rose-900/60 transition cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          </button>

                          <button
                            onClick={() => handleOpenEditModal(sup)}
                            title="Edit Supplier Info"
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 dark:bg-purple-950/40 dark:hover:bg-purple-500/20 dark:text-purple-300 dark:hover:text-purple-100 dark:border-purple-800/60 transition cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => setDeletingSupplierId(sup.id)}
                              title="Delete Supplier"
                              className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 dark:bg-purple-950/40 dark:hover:bg-rose-950/50 dark:text-purple-300 dark:hover:text-rose-400 dark:border-purple-800/60 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ADD / EDIT SUPPLIER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-purple-800/80">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-purple-800/80 bg-slate-50/70 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 bg-blue-500/10 dark:bg-purple-500/20 text-blue-600 dark:text-purple-300 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {editingSupplier ? 'Edit Supplier Information' : 'Register New Footwear Supplier'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:text-purple-300/70 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-center space-x-2 text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span className="font-bold">{error}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-purple-200 mb-1">
                  Supplier / Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nike Wholesale Distribution Pakistan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-purple-800/60 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/40 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-purple-500/30 focus:border-blue-500 dark:focus:border-purple-400 font-medium text-xs transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-purple-200 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +92 300 1122334"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-purple-800/60 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/40 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-purple-500/30 focus:border-blue-500 dark:focus:border-purple-400 font-mono text-xs transition"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-purple-200 mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="e.g. wholesale@nike.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-purple-800/60 bg-white dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-purple-300/40 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/30 dark:focus:ring-purple-500/30 focus:border-blue-500 dark:focus:border-purple-400 font-mono text-xs transition"
                  />
                </div>
              </div>

              <div className="px-6 py-4 -mx-6 -mb-6 mt-4 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-purple-950/40 hover:bg-slate-200 dark:hover:bg-purple-900/50 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ color: '#ffffff' }}
                  className="btn-pure-white supplier-btn px-4 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 !text-white text-white border border-purple-400/40 shadow-md shadow-purple-600/25 dark:from-purple-600 dark:to-indigo-600 dark:hover:from-purple-500 dark:hover:to-indigo-500 dark:border-purple-400/50 transition cursor-pointer active:scale-95"
                >
                  <span className="!text-white font-bold text-white" style={{ color: '#ffffff' }}>
                    {isSubmitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Create Supplier'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SUPPLIER PURCHASES HISTORY MODAL */}
      {viewSupplierModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white dark:bg-[#131B2E] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-purple-800/80">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-purple-800/80 bg-slate-50/70 dark:bg-gradient-to-r dark:from-purple-900 dark:via-indigo-950 dark:to-slate-900">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-purple-500/20 border border-blue-200 dark:border-purple-400/30 flex items-center justify-center text-blue-600 dark:text-purple-300 font-bold text-sm shadow-2xs">
                  {selectedSupplier.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{selectedSupplier.name}</h3>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 dark:text-purple-200/70 mt-0.5">
                    {selectedSupplier.phone && <span>📞 {selectedSupplier.phone}</span>}
                    {selectedSupplier.email && <span>✉️ {selectedSupplier.email}</span>}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setViewSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:text-purple-300/70 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Financial Balance Breakdown */}
              {(() => {
                const totalPurchasesAmount = supplierPurchases.reduce((acc, p) => acc + parseFloat(p.total_amount || 0), 0);
                const totalReturnsAmount = supplierReturns.reduce((acc, r) => acc + parseFloat(r.total_debit_amount || 0), 0);
                const totalPaidAmount = parseFloat(selectedSupplier.total_paid_amount || 0);
                const netPayable = parseFloat(selectedSupplier.net_payable_balance ?? selectedSupplier.balance ?? (totalPurchasesAmount - totalReturnsAmount - totalPaidAmount));

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-purple-950/30 border border-slate-200 dark:border-purple-800/60 rounded-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-purple-300/80">Gross Procured</div>
                      <div className="text-base font-black text-slate-900 dark:text-white mt-1 font-mono">
                        {currencySymbol} {formatStockPrice(totalPurchasesAmount)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-purple-300/70 mt-0.5">{supplierPurchases.length} purchase orders</div>
                    </div>

                    <div className="p-3 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Returns & Debits</div>
                      <div className="text-base font-black text-rose-700 dark:text-rose-300 mt-1 font-mono">
                        - {currencySymbol} {formatStockPrice(totalReturnsAmount)}
                      </div>
                      <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">{supplierReturns.length} return slips</div>
                    </div>

                    <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Paid</div>
                      <div className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                        - {currencySymbol} {formatStockPrice(totalPaidAmount)}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Cleared via payments</div>
                    </div>

                    <div className="p-3 bg-amber-50/70 dark:bg-purple-900/40 border border-amber-200 dark:border-purple-500/40 rounded-xl">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-purple-300">Net Khata Balance</div>
                      <div className="text-base font-black text-amber-700 dark:text-purple-100 mt-1 font-mono">
                        {currencySymbol} {formatStockPrice(netPayable)}
                      </div>
                      <div className="text-[10px] text-amber-600 dark:text-purple-300/80 mt-0.5">Purchases - Returns - Paid</div>
                    </div>
                  </div>
                );
              })()}

              {/* Actions & Tab Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-purple-800/60">
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-purple-950/40 p-1 rounded-xl border border-slate-200 dark:border-purple-800/60">
                  <button
                    onClick={() => setSupplierModalTab('purchases')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      supplierModalTab === 'purchases'
                        ? 'bg-white dark:bg-purple-900/60 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-purple-300/70 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Purchases ({supplierPurchases.length})</span>
                  </button>
                  <button
                    onClick={() => setSupplierModalTab('returns')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                      supplierModalTab === 'returns'
                        ? 'bg-white dark:bg-purple-900/60 text-rose-700 dark:text-rose-400 shadow-xs'
                        : 'text-slate-600 dark:text-purple-300/70 hover:text-rose-700 dark:hover:text-rose-400'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Returns & Debit Notes ({supplierReturns.length})</span>
                  </button>
                </div>

                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <button
                    onClick={() => {
                      setPaymentModalSupplier(selectedSupplier);
                      setIsPaymentModalOpen(true);
                    }}
                    style={{ color: '#ffffff' }}
                    className="btn-pure-white supplier-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 !text-white text-white font-bold cursor-pointer transition text-xs shadow-md shadow-emerald-600/20 active:scale-95"
                  >
                    <CreditCard className="w-3.5 h-3.5 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                    <span className="!text-white font-bold text-white" style={{ color: '#ffffff' }}>Record Payment</span>
                  </button>

                  <button
                    onClick={() => {
                      setLedgerModalSupplierId(selectedSupplier.id);
                      setIsLedgerModalOpen(true);
                    }}
                    style={{ color: '#ffffff' }}
                    className="btn-pure-white supplier-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 !text-white text-white font-bold cursor-pointer transition text-xs shadow-md shadow-purple-600/20 active:scale-95"
                  >
                    <FileText className="w-3.5 h-3.5 !text-white" style={{ color: '#ffffff', stroke: '#ffffff' }} />
                    <span className="!text-white font-bold text-white" style={{ color: '#ffffff' }}>View Ledger</span>
                  </button>

                  <button
                    onClick={() => {
                      setReturnSupplierId(selectedSupplier.id);
                      setIsReturnModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900/60 font-semibold cursor-pointer transition text-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Issue Return</span>
                  </button>

                  {onNavigateToPurchase && (
                    <button
                      onClick={() => {
                        setViewSupplierModalOpen(false);
                        onNavigateToPurchase(selectedSupplier.id, selectedSupplier.name);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-700 hover:via-indigo-700 hover:to-purple-800 text-white font-bold cursor-pointer transition text-xs border border-purple-400/40 shadow-md shadow-purple-600/25 dark:from-purple-600 dark:to-indigo-600 dark:border-purple-400/50 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Purchase</span>
                    </button>
                  )}
                </div>
              </div>

              {isLoadingHistory ? (
                <div className="py-12 text-center text-slate-400 dark:text-purple-300/60 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 dark:text-purple-400 mx-auto" />
                  <p className="font-medium text-xs">Loading history records...</p>
                </div>
              ) : supplierModalTab === 'purchases' ? (
                supplierPurchases.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-purple-300/60 border border-dashed border-slate-200 dark:border-purple-800/60 rounded-xl bg-slate-50/50 dark:bg-purple-950/20">
                    No purchases recorded yet for {selectedSupplier.name}.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-purple-800/60 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50/90 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-600 dark:text-white font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-purple-800/80">
                        <tr>
                          <th className="py-2.5 px-3">Purchase #</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-center">Items</th>
                          <th className="py-2.5 px-3 text-right">Total Amount</th>
                          <th className="py-2.5 px-3">Recorded By</th>
                          <th className="py-2.5 px-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-purple-900/40">
                        {supplierPurchases.map((p) => (
                          <tr key={p.id} className="hover:bg-blue-50/30 dark:hover:bg-purple-950/30 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-purple-300">
                              {p.purchase_number}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-purple-200/80">{p.purchase_date}</td>
                            <td className="py-2.5 px-3 text-center font-medium">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-purple-500/20 text-blue-700 dark:text-purple-300 border border-blue-200/80 dark:border-purple-400/30">
                                {p.item_count} items
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {currencySymbol} {formatStockPrice(p.total_amount || 0)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-purple-200/80">{p.created_by_name || 'Admin'}</td>
                            <td className="py-2.5 px-3 text-slate-500 dark:text-purple-300/60 italic max-w-xs truncate">
                              {p.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                supplierReturns.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-purple-300/60 border border-dashed border-slate-200 dark:border-purple-800/60 rounded-xl bg-slate-50/50 dark:bg-purple-950/20">
                    No returns or debit notes recorded for {selectedSupplier.name}.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-purple-800/60 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-rose-50/50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 text-slate-700 dark:text-white font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-purple-800/80">
                        <tr>
                          <th className="py-2.5 px-3">Debit Note #</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Original Purchase</th>
                          <th className="py-2.5 px-3 text-center">Returned Qty</th>
                          <th className="py-2.5 px-3 text-right">Debited Amount</th>
                          <th className="py-2.5 px-3">Reason</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-purple-900/40">
                        {supplierReturns.map((r) => (
                          <tr key={r.id} className="hover:bg-rose-50/20 dark:hover:bg-rose-950/20 transition">
                            <td className="py-2.5 px-3 font-mono font-bold text-rose-700 dark:text-rose-400">
                              {r.return_number}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-purple-200/80">{r.return_date}</td>
                            <td className="py-2.5 px-3 font-mono text-blue-600 dark:text-purple-300">
                              {r.original_purchase_number || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-purple-200">
                              {r.total_cartons_returned > 0 && `${r.total_cartons_returned} ctn `}
                              {r.total_pairs_returned > 0 ? `${r.total_pairs_returned} pairs` : ''}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-black text-rose-700 dark:text-rose-400">
                              {currencySymbol} {formatStockPrice(r.total_debit_amount)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-purple-200/80 max-w-xs truncate">
                              {r.reason || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await api.purchaseReturns.get(r.id);
                                    setSelectedReturnRecord(res.purchase_return);
                                    setIsReturnDetailsModalOpen(true);
                                  } catch (e: any) {
                                    alert(e.message || 'Failed to fetch return details');
                                  }
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-purple-950/40 hover:bg-slate-200 dark:hover:bg-purple-900/50 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 transition cursor-pointer"
                              >
                                View Note
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 dark:bg-gradient-to-r dark:from-purple-900/90 dark:via-indigo-950/85 dark:to-slate-900 border-t border-slate-200 dark:border-purple-800/80 flex justify-end">
              <button
                onClick={() => setViewSupplierModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-purple-950/40 hover:bg-slate-200 dark:hover:bg-purple-900/50 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deletingSupplierId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 dark:border-purple-800/80">
            <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>Confirm Supplier Deletion</span>
            </div>
            <p className="text-slate-600 dark:text-purple-200 text-xs leading-relaxed">
              Are you sure you want to delete this supplier? Past purchase records linked to this supplier will be preserved with the supplier's name retained in purchase history.
            </p>
            <div className="flex justify-end space-x-2.5 pt-2">
              <button
                onClick={() => setDeletingSupplierId(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-purple-950/40 hover:bg-slate-200 dark:hover:bg-purple-900/50 text-slate-700 dark:text-purple-200 border border-slate-200 dark:border-purple-800/60 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSupplier(deletingSupplierId)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                {isDeleting ? 'Deleting...' : 'Delete Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER RETURN / DEBIT NOTE MODAL */}
      <SupplierReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        onSuccess={() => {
          setIsReturnModalOpen(false);
          loadSuppliers();
          if (selectedSupplier) {
            api.suppliers.get(selectedSupplier.id).then((res) => {
              setSelectedSupplier(res.supplier);
              setSupplierPurchases(res.purchases || []);
              setSupplierReturns(res.returns || []);
            });
          }
        }}
        currentUser={currentUser}
        companySettings={companySettings}
        preselectedSupplierId={returnSupplierId}
      />

      {/* PURCHASE RETURN / DEBIT NOTE DETAILS MODAL */}
      <PurchaseReturnDetailsModal
        isOpen={isReturnDetailsModalOpen}
        onClose={() => {
          setIsReturnDetailsModalOpen(false);
          setSelectedReturnRecord(null);
        }}
        purchaseReturn={selectedReturnRecord}
        companySettings={companySettings}
      />

      {/* SUPPLIER PAYMENT VOUCHER MODAL */}
      {isPaymentModalOpen && paymentModalSupplier && (
        <SupplierPaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setPaymentModalSupplier(null);
          }}
          supplier={paymentModalSupplier}
          suppliersList={suppliers}
          currencySymbol={currencySymbol}
          onSuccess={() => {
            loadSuppliers();
            if (selectedSupplier) {
              api.suppliers.get(selectedSupplier.id).then((res) => {
                setSelectedSupplier(res.supplier);
                setSupplierPurchases(res.purchases || []);
                setSupplierReturns(res.returns || []);
              });
            }
          }}
        />
      )}

      {/* SUPPLIER ACCOUNT LEDGER & STATEMENT MODAL */}
      {isLedgerModalOpen && ledgerModalSupplierId && (
        <SupplierLedgerModal
          isOpen={isLedgerModalOpen}
          onClose={() => {
            setIsLedgerModalOpen(false);
            setLedgerModalSupplierId(null);
          }}
          supplierId={ledgerModalSupplierId}
          currencySymbol={currencySymbol}
          companySettings={companySettings}
          isAdmin={isAdmin}
          onPaymentRecorded={() => {
            loadSuppliers();
            if (selectedSupplier) {
              api.suppliers.get(selectedSupplier.id).then((res) => {
                setSelectedSupplier(res.supplier);
                setSupplierPurchases(res.purchases || []);
                setSupplierReturns(res.returns || []);
              });
            }
          }}
        />
      )}
    </div>
  );
};
