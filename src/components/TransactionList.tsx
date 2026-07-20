/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {  motion, AnimatePresence } from 'motion/react';
import {  Transaction, TransactionType, ProviderType, User, AppSettings, HistoryFilter, HistoryFilterType } from '../types';
import { copyToClipboard,    formatNaira, getProviderTransactionNumber, getFriendlyTypeLabel, analyzeQuery } from '../utils';
import {  
  Search, 
  Trash2, 
  Download, 
  Filter, 
  Calendar,
  Layers,
  ArrowRightLeft,
  Sparkles,
  DollarSign,
  Pencil,
  FileCheck,
  Settings,
  X,
  CreditCard,
  Info,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Smartphone,
  Play,
  Pause,
  Mic
} from 'lucide-react';

const getBankBadgeStyle = (bankName: string): string => {
  switch (bankName) {
    case 'OPay': return 'bg-emerald-50 text-[#00B87A] border-emerald-200';
    case 'Moniepoint': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'PalmPay': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Access Bank': return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'GTBank': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Zenith Bank': return 'bg-red-50 text-red-700 border-red-200';
    case 'UBA': return 'bg-red-50 text-red-800 border-red-200';
    case 'First Bank': return 'bg-yellow-50 text-amber-800 border-yellow-200';
    case 'Union Bank': return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Fidelity Bank': return 'bg-blue-50 text-blue-900 border-blue-200';
    case 'Sterling Bank': return 'bg-red-50 text-red-600 border-red-200';
    case 'Wema Bank': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Stanbic IBTC': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'EcoBank': return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'FCMB': return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
    case 'Kuda Bank': return 'bg-emerald-50 text-emerald-950 border-emerald-200';
    case 'Keystone Bank': return 'bg-blue-50 text-blue-900 border-blue-200';
    case 'Polaris Bank': return 'bg-indigo-50 text-indigo-900 border-indigo-200';
    case 'Providus Bank': return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    case 'Jaiz Bank': return 'bg-green-50 text-green-800 border-green-200';
    case 'Taj Bank': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'Nomba': return 'bg-zinc-50 text-zinc-800 border-zinc-200';
    case 'MTN': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Airtel': return 'bg-red-50 text-red-700 border-red-200';
    case 'Glo': return 'bg-green-50 text-green-700 border-green-200';
    case '9mobile': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default: return 'bg-neutral-50 text-neutral-700 border-neutral-200';
  }
};

interface TransactionListProps {
  currentUser: User;
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onViewReceipt?: (tx: Transaction) => void;
  onUpdateTransaction?: (tx: Transaction) => void;
  onSplitTransaction?: (tx: Transaction) => void;
  onBulkDeleteTransactions?: (ids: string[]) => void;
  onBulkUpdateTransactions?: (txs: Transaction[]) => void;
  settings?: AppSettings;
  onOpenSettings?: () => void;
  historyFilter: HistoryFilter;
  onSetHistoryFilter: (filter: HistoryFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  typeFilter: string;
  setTypeFilter: (t: string) => void;
  providerFilter: string;
  setProviderFilter: (p: string) => void;
}

export const TransactionList = React.memo(({
  currentUser,
  transactions,
  onDeleteTransaction,
  onEditTransaction,
  onViewReceipt,
  onUpdateTransaction,
  onSplitTransaction,
  onBulkDeleteTransactions,
  onBulkUpdateTransactions,
  settings,
  onOpenSettings,
  historyFilter,
  onSetHistoryFilter,
  searchQuery,
  setSearchQuery,
  typeFilter,
  setTypeFilter,
  providerFilter,
  setProviderFilter
}: TransactionListProps) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [customStart, setCustomStart] = useState<string>(historyFilter?.customStart || new Date().toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState<string>(historyFilter?.customEnd || new Date().toISOString().slice(0, 10));
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  
  // Bulk selection state for managers
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Custom tracking modes for accessibility
  const [viewMode, setViewMode] = useState<'easy' | 'advanced'>('easy');
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>('small');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Employee editing settle state
  const [settlingTx, setSettlingTx] = useState<Transaction | null>(null);
  const [settleFeeInput, setSettleFeeInput] = useState<string>('');
  const [settleFeeMethod, setSettleFeeMethod] = useState<'Cash' | 'CardDebit'>('Cash');
  
  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
      }
    };
  }, [currentAudio]);

  const playAudioNote = (txId: string, base64Audio: string) => {
    if (playingAudioId === txId && currentAudio) {
      currentAudio.pause();
      setPlayingAudioId(null);
      setCurrentAudio(null);
    } else {
      if (currentAudio) {
        currentAudio.pause();
      }
      const audio = new Audio(base64Audio);
      audio.onended = () => {
        setPlayingAudioId(null);
        setCurrentAudio(null);
      };
      audio.onerror = () => {
        setPlayingAudioId(null);
        setCurrentAudio(null);
      };
      audio.play().catch(err => {
        console.error("Audio playback error:", err);
      });
      setPlayingAudioId(txId);
      setCurrentAudio(audio);
    }
  };

  useEffect(() => {
    if (settlingTx) {
      setSettleFeeInput((settlingTx.unpaidFeeAmount ?? settlingTx.customerFee ?? 0).toString());
      setSettleFeeMethod(settlingTx.feeMethod || 'Cash');
    }
  }, [settlingTx]);

  const handleCopy = (id: string) => {
    copyToClipboard(id).catch(() => {});
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // Compute accumulated stats for visual quick-tabs
  const stats = useMemo(() => {
    let withdrawCount = 0;
    let withdrawVol = 0;
    let transferCount = 0;
    let transferVol = 0;
    let depositCount = 0;
    let depositVol = 0;
    let airtimeCount = 0;
    let airtimeVol = 0;

    let opayCount = 0;
    let opayVol = 0;
    let moniepointCount = 0;
    let moniepointVol = 0;
    let palmpayCount = 0;
    let palmpayVol = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'Withdrawal' || tx.type === 'Cash Out (Transfer)') {
        withdrawCount++;
        withdrawVol += tx.amount;
      } else if (tx.type === 'Transfer') {
        transferCount++;
        transferVol += tx.amount;
      } else if (tx.type === 'Deposit') {
        depositCount++;
        depositVol += tx.amount;
      } else if (tx.type === 'Airtime' || tx.type === 'Data') {
        airtimeCount++;
        airtimeVol += tx.amount;
      }

      if (tx.provider === 'OPay') {
        opayCount++;
        opayVol += tx.amount;
      } else if (tx.provider === 'Moniepoint') {
        moniepointCount++;
        moniepointVol += tx.amount;
      } else if (tx.provider === 'PalmPay') {
        palmpayCount++;
        palmpayVol += tx.amount;
      }
    });

    return {
      allCount: transactions.length,
      allVol: transactions.reduce((acc, tx) => acc + tx.amount, 0),
      withdrawCount,
      withdrawVol,
      transferCount,
      transferVol,
      depositCount,
      depositVol,
      airtimeCount,
      airtimeVol,
      opayCount,
      opayVol,
      moniepointCount,
      moniepointVol,
      palmpayCount,
      palmpayVol
    };
  }, [transactions]);

  // Transactions are already filtered in App.tsx (Synchronization Layer)
  const filteredList = transactions;
  
  // Re-run analysis for UI display of filter pills
  const queryAnalysis = useMemo(() => analyzeQuery(searchQuery), [searchQuery]);

  // Financial Summary for filtered transactions
  const financialSummary = useMemo(() => {
    return filteredList.reduce((acc, tx) => {
      acc.totalTransactions++;
      const isSuccess = tx.status === 'Success' || (tx.status || 'Success') === 'Success';
      const isFailed = tx.status === 'Failed';
      const isPending = !isSuccess && !isFailed;

      if (isSuccess) {
        acc.totalSuccessful++;
        acc.totalVolume += tx.amount || 0;
        acc.totalCustomerFees += tx.customerFee || 0;
        acc.totalProviderCharges += tx.providerCharge || 0;
        acc.totalCBNCharges += tx.cbnCharge || 0;
        acc.totalCashback += tx.cashback || 0;
        
        // Use stored profit value as per enterprise requirements
        acc.totalProfit += tx.profit || 0;
      } else if (isFailed) {
        acc.totalFailed++;
      } else if (isPending) {
        acc.totalPending++;
      }
      return acc;
    }, {
      totalTransactions: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalPending: 0,
      totalVolume: 0,
      totalCustomerFees: 0,
      totalProviderCharges: 0,
      totalCBNCharges: 0,
      totalCashback: 0,
      totalProfit: 0
    });
  }, [filteredList]);

  const totalItems = filteredList.length;
  const pageSize = settings?.pageSize || 10;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset page when filters or queries change to avoid blank pages
  React.useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, providerFilter, searchQuery, historyFilter]);

  const displayList = useMemo(() => {
    // Show all transactions, but we'll style 'SplitChild' differently
    // We keep the filter logic for search/type/provider/history
    return filteredList;
  }, [filteredList]);

  const paginatedList = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return displayList.slice(startIdx, startIdx + pageSize);
  }, [displayList, currentPage, pageSize]);

  // Synchronize selection with visible display list to avoid orphaned selections
  React.useEffect(() => {
    setSelectedIds(prev => prev.filter(id => displayList.some(tx => tx.id === id)));
  }, [displayList]);

  const isAllSelected = useMemo(() => {
    if (displayList.length === 0) return false;
    return displayList.every(tx => selectedIds.includes(tx.id));
  }, [displayList, selectedIds]);

  const handleSelectAllToggle = (checked: boolean) => {
    if (checked) {
      const allIds = displayList.map(tx => tx.id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(item => item !== id));
    }
  };

  const handleBulkStatusUpdate = (newStatus: 'Success' | 'Pending' | 'Failed') => {
    const selectedTxs = transactions.filter(t => selectedIds.includes(t.id));
    const updatedTxs = selectedTxs.map(t => ({
      ...t,
      status: newStatus
    }));
    if (onBulkUpdateTransactions) {
      onBulkUpdateTransactions(updatedTxs);
    } else if (onUpdateTransaction) {
      updatedTxs.forEach(tx => onUpdateTransaction(tx));
    }
    setSelectedIds([]);
  };

  const handleBulkDebtUpdate = (newChargesStatus: 'Paid' | 'Unpaid') => {
    const selectedTxs = transactions.filter(t => selectedIds.includes(t.id));
    const updatedTxs = selectedTxs.map(t => {
      const isPaid = newChargesStatus === 'Paid';
      return {
        ...t,
        chargesStatus: newChargesStatus,
        unpaidFeeAmount: isPaid ? 0 : (t.originalFeeAmount ?? t.customerFee),
        chargesPaidAmount: isPaid ? (t.originalFeeAmount ?? t.customerFee) : 0
      };
    });
    if (onBulkUpdateTransactions) {
      onBulkUpdateTransactions(updatedTxs);
    } else if (onUpdateTransaction) {
      updatedTxs.forEach(tx => onUpdateTransaction(tx));
    }
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (confirm(`Are you absolutely sure you want to delete/void the ${selectedIds.length} selected transaction receipts?`)) {
      if (onBulkDeleteTransactions) {
        onBulkDeleteTransactions(selectedIds);
      } else {
        selectedIds.forEach(id => onDeleteTransaction(id));
      }
      setSelectedIds([]);
    }
  };

  // Dynamic ledger size metrics count and volume calculations
  const metrics = useMemo(() => {
    const depositTxs = filteredList.filter(t => t.type === 'Deposit');
    const withdrawalTxs = filteredList.filter(t => t.type === 'Withdrawal');
    const transferTxs = filteredList.filter(t => t.type === 'Transfer');

    const totalDepositAmt = depositTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawalAmt = withdrawalTxs.reduce((sum, t) => sum + t.amount, 0);
    const totalTransferAmt = transferTxs.reduce((sum, t) => sum + t.amount, 0);

    const totalCount = filteredList.length;
    const totalAmount = filteredList.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalCustomerFees = filteredList.reduce((sum, t) => sum + (t.customerCharge || t.customerFee || 0), 0);
    const totalProviderCharges = filteredList.reduce((sum, t) => sum + (t.providerCharge || t.terminalFee || 0), 0);
    const totalCbnCharges = filteredList.reduce((sum, t) => sum + (t.cbnCharge || 0), 0);
    const totalProfit = filteredList.reduce((sum, t) => sum + (t.profit || 0), 0);

    return {
      depositsCount: depositTxs.length,
      depositsAmount: totalDepositAmt,
      withdrawalsCount: withdrawalTxs.length,
      withdrawalsAmount: totalWithdrawalAmt,
      transfersCount: transferTxs.length,
      transfersAmount: totalTransferAmt,
      totalCount,
      totalAmount,
      totalCustomerFees,
      totalProviderCharges,
      totalCbnCharges,
      totalProfit,
    };
  }, [filteredList]);

  const rowPadding = settings?.listDensity === 'compact' ? 'py-1.5 px-2' : 'py-3.5 px-2';

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      alert('No record transactions found to export.');
      return;
    }

    const headers = ['TXID', 'Bank Reference', 'Timestamp', 'Staff Operator', 'Type', 'POS Provider', 'Amount(NGN)', 'Customer FeeCharged', 'Terminal Cost', 'Profit(NGN)', 'Notes', 'Customer Phone'];
    
    const rows = filteredList.map(tx => [
      tx.id,
      getProviderTransactionNumber(tx),
      new Date(tx.timestamp).toLocaleString(),
      tx.employeeName,
      tx.type,
      tx.provider,
      tx.amount.toString(),
      tx.customerFee.toString(),
      tx.terminalFee.toString(),
      tx.profit.toString(),
      tx.notes || '',
      tx.customerPhone || ''
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OPayStyle_ReceiptExport_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-5 space-y-5 shadow-sm max-h-[80vh] overflow-y-auto">
      {/* List Toolbar Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5">
            <Layers className="text-[#00B87A] w-4.5 h-4.5" /> General Ledger Receipts
          </h3>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Displaying {displayList.length} of {transactions.filter(t => t.mode !== 'SplitChild').length} processed receipts.
          </p>
        </div>

        {/* Action Button Container */}
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {currentUser.role === 'Manager' && onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex-1 sm:flex-initial bg-white hover:bg-[#00B87A]/10 border border-[#00B87A]/25 text-[#00B87A] px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-1.5 transition cursor-pointer select-none active:scale-[0.98] shadow-2xs"
              title="Configure receipt branding and baseline commission parameters"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          )}

          {/* CSV Excel Exporter */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 hover:text-neutral-900 px-3.5 py-2 rounded-xl text-xs font-bold font-sans flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV Log
          </button>
        </div>
      </div>

      {/* Visual Tracking Mode & Size Selector */}
      <div className="bg-neutral-50/80 border border-neutral-200/70 p-3.5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-black tracking-widest text-[#00B87A] uppercase flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" /> LEDGER VISUAL SETTINGS:
          </span>
          <p className="text-[11px] text-neutral-500 font-semibold leading-normal">
            Choose display layout and density spacing. Small mode provides a beautiful, high-efficiency compact layout!
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* View Format Selector */}
          <div className="flex bg-neutral-200/50 p-1 rounded-xl self-start lg:self-auto shrink-0 w-full sm:w-auto border border-neutral-200/40">
            <button
              type="button"
              onClick={() => setViewMode('easy')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-black transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'easy'
                  ? 'bg-[#00B87A] text-white shadow-xs border border-[#00B87A]'
                  : 'text-neutral-500 hover:text-neutral-850'
              }`}
            >
              <Layers className="w-3.5 h-3.5 shrink-0" /> Easy Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('advanced')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-black transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'advanced'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-850'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" /> Detailed Table
            </button>
          </div>

          {/* Size Density Selector */}
          <div className="flex bg-neutral-200/50 p-1 rounded-xl self-start lg:self-auto shrink-0 w-full sm:w-auto border border-neutral-200/40">
            <button
              type="button"
              onClick={() => setCardSize('small')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                cardSize === 'small'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-850'
              }`}
              title="Compact high-density layout"
            >
              Small Mode
            </button>
            <button
              type="button"
              onClick={() => setCardSize('medium')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                cardSize === 'medium'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-850'
              }`}
              title="Standard balanced spacing"
            >
              Medium
            </button>
            <button
              type="button"
              onClick={() => setCardSize('large')}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-black transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer ${
                cardSize === 'large'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-850'
              }`}
              title="Large cozy readability layout"
            >
              Large
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Sized Transaction History Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* Metric 1: Number of Transactions */}
        <div className="bg-neutral-50/60 border border-neutral-200/50 p-2.5 rounded-2xl flex items-center gap-2.5 min-w-0 transition-all hover:border-neutral-300 hover:shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-white text-neutral-600 flex items-center justify-center shrink-0 border border-neutral-200/80 shadow-2xs">
            <Receipt className="w-4 h-4 stroke-[2.3]" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-400 uppercase tracking-wider block leading-none">
              Transactions
            </span>
            <div className="text-[12px] font-mono font-black text-neutral-800 mt-1 leading-none">
              {metrics.totalCount} receipts
            </div>
          </div>
        </div>

        {/* Metric 2: Total Transaction Amount */}
        <div className="bg-blue-50/30 border border-blue-100 p-2.5 rounded-2xl flex items-center gap-2.5 min-w-0 transition-all hover:border-blue-200 hover:shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-white text-blue-600 flex items-center justify-center shrink-0 border border-blue-105 shadow-2xs">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-450 uppercase tracking-wider block leading-none">
              Total Amount
            </span>
            <div className="text-[12px] font-mono font-black text-neutral-800 mt-1 leading-none truncate">
              {formatNaira(metrics.totalAmount)}
            </div>
          </div>
        </div>

        {/* Metric 3: Total Customer Fees */}
        <div className="bg-indigo-50/30 border border-indigo-100 p-2.5 rounded-2xl flex items-center gap-2.5 min-w-0 transition-all hover:border-indigo-200 hover:shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-white text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-105 shadow-2xs">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-450 uppercase tracking-wider block leading-none">
              Customer Fees
            </span>
            <div className="text-[12px] font-mono font-black text-neutral-800 mt-1 leading-none truncate">
              {formatNaira(metrics.totalCustomerFees)}
            </div>
          </div>
        </div>

        {/* Metric 4: Total Provider Charges */}
        <div className="bg-orange-50/30 border border-orange-100 p-2.5 rounded-2xl flex items-center gap-2.5 min-w-0 transition-all hover:border-orange-200 hover:shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-white text-orange-600 flex items-center justify-center shrink-0 border border-orange-105 shadow-2xs">
            <CreditCard className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-450 uppercase tracking-wider block leading-none">
              Provider Charges
            </span>
            <div className="text-[12px] font-mono font-black text-neutral-800 mt-1 leading-none truncate">
              {formatNaira(metrics.totalProviderCharges)}
            </div>
          </div>
        </div>

        {/* Metric 5: Total CBN Charges */}
        <div className="bg-red-50/30 border border-red-105 p-2.5 rounded-2xl flex items-center gap-2.5 min-w-0 transition-all hover:border-red-200 hover:shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-white text-red-600 flex items-center justify-center shrink-0 border border-red-105 shadow-2xs">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-neutral-450 uppercase tracking-wider block leading-none">
              CBN Charges
            </span>
            <div className="text-[12px] font-mono font-black text-neutral-800 mt-1 leading-none truncate">
              {formatNaira(metrics.totalCbnCharges)}
            </div>
          </div>
        </div>

        {/* Metric 6: Total Profit */}
        <div className="bg-emerald-50 border border-emerald-250 p-2.5 rounded-2xl flex items-center gap-2.5 min-w-0 transition-all hover:border-emerald-300 hover:shadow-2xs shadow-2xs">
          <div className="w-8 h-8 rounded-xl bg-white text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-150 shadow-2xs">
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-black text-emerald-600 uppercase tracking-wider block leading-none">
              Total Profit
            </span>
            <div className="text-[12px] font-mono font-black text-emerald-900 mt-1 leading-none truncate">
              {formatNaira(metrics.totalProfit)}
            </div>
          </div>
        </div>
      </div>

      {/* General Permission Badge Warning for Managers */}
      {currentUser.role === 'Manager' && (
        <div className="bg-[#00B87A]/5 border border-[#00B87A]/20 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 bg-[#00B87A]/15 text-[#00B87A] rounded-lg font-mono text-[9px] font-black uppercase tracking-wider shrink-0">
              GENERAL AUDITOR VIEW
            </span>
            <p className="text-neutral-600 font-bold leading-normal">
              Manager permissions have bypassed terminal path restrictions to allow viewing and auditing all employee transaction channels. Deleting/voiding or employee modifications are disabled.
            </p>
          </div>
        </div>
      )}

      {/* Intermittent category quick filters */}
      <div className="space-y-4">
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-black tracking-widest text-neutral-400 uppercase block">Category Operation Filters:</span>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { id: 'ALL', label: 'Every Transaction', count: stats.allCount, vol: stats.allVol, color: 'border-neutral-200 text-neutral-600 bg-neutral-50/40', activeColor: 'bg-[#00B87A] border-[#00B87A] text-white shadow-md shadow-emerald-500/10' },
              { id: 'Withdrawal', label: '📥 Withdraw', count: stats.withdrawCount, vol: stats.withdrawVol, color: 'border-orange-100 text-orange-700 bg-orange-50/20', activeColor: 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-500/10' },
              { id: 'Transfer', label: '💸 Bank Transfers', count: stats.transferCount, vol: stats.transferVol, color: 'border-indigo-100 text-indigo-700 bg-indigo-50/20', activeColor: 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/10' },
              { id: 'Deposit', label: '📤 Money Receive', count: stats.depositCount, vol: stats.depositVol, color: 'border-blue-100 text-blue-700 bg-blue-50/20', activeColor: 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/10' },
              { id: 'Airtime', label: '📱 Airtime Sale', count: stats.airtimeCount, vol: stats.airtimeVol, color: 'border-purple-100 text-purple-700 bg-purple-50/20', activeColor: 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/10' }
            ].map((tab) => {
              const isActive = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTypeFilter(tab.id)}
                  className={`flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-98 ${
                    isActive 
                      ? `${tab.activeColor} font-bold scale-[1.01]` 
                      : `${tab.color} hover:bg-neutral-50 hover:border-neutral-300 hover:shadow-2xs`
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1">
                    <span className="text-[11px] font-extrabold tracking-tight truncate">{tab.label}</span>
                    <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {tab.count}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between w-full">
                    <span className={`text-[8px] font-mono uppercase tracking-wider ${isActive ? 'text-white/60' : 'text-neutral-450'}`}>Vol:</span>
                    <span className="text-xs font-black font-mono">
                      {formatNaira(tab.vol)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Separated host network history quick-tabs bar */}
        <div className="space-y-2 border-t border-neutral-100 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-black tracking-widest text-neutral-400 uppercase block">POS Network Split Ledger:</span>
            {providerFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setProviderFilter('ALL')}
                className="text-[10px] font-bold text-[#00B87A] hover:underline cursor-pointer"
              >
                Clear Network Filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'ALL', label: 'All Networks', count: stats.allCount, vol: stats.allVol, color: 'border-neutral-200 text-neutral-600 bg-neutral-50/40', activeColor: 'bg-neutral-800 border-neutral-800 text-white shadow-md' },
              { id: 'OPay', label: 'OPay Logs', count: stats.opayCount, vol: stats.opayVol, color: 'border-emerald-100 text-emerald-700 bg-emerald-50/10', activeColor: 'bg-[#00B87A] border-[#00B87A] text-white shadow-emerald-500/15 shadow-md', indicatorColor: 'bg-[#00B87A]' },
              { id: 'Moniepoint', label: 'Moniepoint Logs', count: stats.moniepointCount, vol: stats.moniepointVol, color: 'border-blue-105 text-blue-600 bg-blue-50/10', activeColor: 'bg-blue-600 border-blue-600 text-white shadow-blue-500/15 shadow-md', indicatorColor: 'bg-blue-500' },
              { id: 'PalmPay', label: 'PalmPay Logs', count: stats.palmpayCount, vol: stats.palmpayVol, color: 'border-orange-100 text-orange-600 bg-orange-50/10', activeColor: 'bg-orange-600 border-orange-600 text-white shadow-orange-500/15 shadow-md', indicatorColor: 'bg-orange-500' }
            ].map((tab) => {
              const isActive = providerFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setProviderFilter(tab.id)}
                  className={`flex flex-col justify-between p-3 rounded-2xl border text-left transition-all duration-150 cursor-pointer active:scale-98 text-xs ${
                    isActive 
                      ? `${tab.activeColor} font-bold scale-[1.01]` 
                      : `${tab.color} hover:bg-neutral-100/60 hover:border-neutral-300 hover:shadow-2xs`
                  }`}
                >
                  <div className="flex items-center justify-between w-full gap-1.5">
                    <span className="text-[10px] font-extrabold tracking-tight truncate flex items-center gap-1.5">
                      {tab.indicatorColor && (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${tab.indicatorColor} opacity-75`}></span>
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${tab.indicatorColor}`}></span>
                        </span>
                      )}
                      {tab.label}
                    </span>
                    <span className={`text-[8px] font-mono font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/25 text-white' : 'bg-neutral-200 text-neutral-700'
                    }`}>
                      {tab.count}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between w-full">
                    <span className={`text-[7px] font-mono uppercase tracking-wider ${isActive ? 'text-white/60' : 'text-neutral-400'}`}>Vol:</span>
                    <span className="text-[10px] font-black font-mono">
                      {formatNaira(tab.vol)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Combined search information guide */}
      <div className="bg-neutral-50 border border-neutral-200/60 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-[#00B87A] tracking-wider uppercase flex items-center gap-1.5 font-mono">
            <Search className="w-3.5 h-3.5 animate-pulse" /> SMART COMBINED SEARCH ASSISTANT
          </span>
          <p className="text-neutral-500 font-semibold leading-normal">
            Type multi-parameters directly into search. E.g. <strong className="text-neutral-700 font-bold bg-[#00B87A]/10 px-1.5 py-0.5 rounded">"opay withdrawal 5000"</strong> or <strong className="text-neutral-700 font-bold bg-[#00B87A]/10 px-1.5 py-0.5 rounded">"moniepoint transfer"</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <span className="text-[9px] text-neutral-400 uppercase font-mono font-bold mr-1">Tweak Demo:</span>
          {[
            { label: 'OPay Withdraw', query: 'OPay Withdrawal' },
            { label: 'Moniepoint Transfer', query: 'Moniepoint Transfer' },
            { label: 'PalmPay Samebank', query: 'PalmPay Samebank' }
          ].map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSearchQuery(item.query);
                setTypeFilter('ALL');
                setProviderFilter('ALL');
              }}
              className="px-2.5 py-1 text-[10px] font-bold bg-white text-neutral-600 hover:text-[#00B87A] border border-neutral-200 hover:border-[#00B87A] rounded-full cursor-pointer transition active:scale-95 shadow-2xs hover:shadow-xs"
            >
              🚀 {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Multi Filtering Input Matrix */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 focus:border-[#00B87A] hover:border-neutral-300 focus:outline-none rounded-xl pl-9 pr-3 py-2.5 text-xs text-neutral-800 transition font-bold"
              placeholder="Type any combined search query..."
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-red-500 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* Categories selector */}
          <div className="flex items-center gap-2">
            <Filter className="text-neutral-400 w-3.5 h-3.5 shrink-0" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 focus:border-[#00B87A] hover:border-neutral-300 focus:outline-none rounded-xl px-2 py-2.5 text-xs text-neutral-700 font-bold"
            >
              <option value="ALL">All Categories</option>
              <option value="Withdrawal">📥 Withdraw Only</option>
              <option value="Deposit">📤 Money Receive Only</option>
              <option value="Transfer">💸 Bank Transfers Only</option>
            </select>
          </div>

          {/* POS Provider selector */}
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="text-neutral-400 w-3.5 h-3.5 shrink-0" />
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="w-full bg-[#00B87A]/5 border border-[#00B87A]/20 focus:border-[#00B87A] hover:border-neutral-300 focus:outline-none rounded-xl px-2 py-2.5 text-xs text-[#00B87A] font-black"
            >
              <option value="ALL" className="text-neutral-700 font-medium">All Networks</option>
              <option value="OPay" className="text-neutral-700 font-medium">OPay Only</option>
              <option value="Moniepoint" className="text-neutral-700 font-medium">Moniepoint Only</option>
              <option value="PalmPay" className="text-neutral-700 font-medium">PalmPay Only</option>
            </select>
          </div>
        </div>

        {/* Unified Transaction History Date Search Panel */}
        <div className="bg-neutral-50/60 border border-neutral-200 p-4 rounded-3xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#00B87A] flex items-center justify-center border border-emerald-100 shrink-0 shadow-2xs">
                <Calendar className="w-4.5 h-4.5 stroke-[2.3]" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-widest block leading-none">
                  Server-Side Date Filtering
                </span>
                <span className="text-xs font-extrabold text-neutral-800 mt-0.5 block">
                  Transaction Audit Logs
                </span>
              </div>
            </div>

            {/* Custom Date Range Picker Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCustomDateOpen(!isCustomDateOpen)}
                className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                  isCustomDateOpen || historyFilter.type === 'CUSTOM'
                    ? 'bg-[#00B87A] border-[#00B87A] text-white shadow-emerald-500/10'
                    : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 hover:border-neutral-300'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                Custom Range
              </button>
            </div>
          </div>

          {/* Custom Date Inputs Panel */}
          <AnimatePresence>
            {(isCustomDateOpen || historyFilter.type === 'CUSTOM') && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-end gap-3 p-3 bg-white border border-neutral-250 rounded-2xl mb-2 shadow-2xs">
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Start Date:</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full text-xs font-bold text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:border-[#00B87A] transition"
                    />
                  </div>
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase">End Date:</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full text-xs font-bold text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:border-[#00B87A] transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSetHistoryFilter({
                        type: 'CUSTOM',
                        customStart: new Date(customStart).toISOString(),
                        customEnd: new Date(customEnd).toISOString()
                      });
                      setIsCustomDateOpen(false);
                    }}
                    className="bg-[#00B87A] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#009664] transition active:scale-95 shadow-sm shadow-emerald-500/10 cursor-pointer"
                  >
                    Apply Range
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Preset Buttons Grid/Scrollbar */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'DAY_1', label: 'Day 1 (Today)' },
              { id: 'DAY_2', label: 'Yesterday' },
              { id: 'DAY_3', label: 'Last 3 Days' },
              { id: 'DAY_4', label: 'Last 4 Days' },
              { id: 'DAY_5', label: 'Last 5 Days' },
              { id: 'DAY_6', label: 'Last 6 Days' },
              { id: 'DAY_7', label: 'Last 7 Days' },
              { id: 'THIS_WEEK', label: 'This Week' },
              { id: 'THIS_MONTH', label: 'This Month' },
              { id: 'THIS_YEAR', label: 'This Year' },
              { id: 'LIFETIME', label: 'Lifetime' }
            ].map((preset) => {
              const isActive = historyFilter.type === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSetHistoryFilter({ type: preset.id as HistoryFilterType });
                    if (preset.id !== 'CUSTOM') setIsCustomDateOpen(false);
                  }}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-full border transition-all cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-neutral-900 border-neutral-900 text-white shadow-2xs'
                      : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 hover:border-neutral-300'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-neutral-500 flex items-center justify-between bg-white px-3.5 py-2 rounded-2xl border border-neutral-200/60 shadow-2xs">
            <span className="font-semibold">
              Audit Scope: <strong className="text-[#00B87A] font-black">{(historyFilter?.type || 'Day 1').replace('_', ' ')}</strong>
            </span>
            <span className="text-[10px] font-mono font-bold text-neutral-400">
              Fetched {transactions?.length || 0} records from Firestore
            </span>
          </div>

          {/* Financial Summary Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-1">
            <div className="bg-white border border-neutral-200 p-3 rounded-2xl shadow-2xs hover:shadow-xs transition duration-150">
              <span className="text-[9px] text-neutral-450 font-mono uppercase font-black block mb-1">Transactions</span>
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black text-neutral-800 font-mono leading-none">{financialSummary.totalTransactions}</span>
                <span className="text-[9px] text-neutral-450 font-bold uppercase">Total</span>
              </div>
              <div className="flex gap-3 mt-2.5 pt-2 border-t border-neutral-100">
                <div className="flex flex-col">
                  <span className="text-[8px] text-emerald-500 font-bold uppercase leading-none">Succ</span>
                  <span className="text-[10px] font-black text-emerald-600 font-mono mt-0.5">{financialSummary.totalSuccessful}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-red-400 font-bold uppercase leading-none">Decl</span>
                  <span className="text-[10px] font-black text-red-500 font-mono mt-0.5">{financialSummary.totalFailed}</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50/20 border border-emerald-100 p-3 rounded-2xl shadow-2xs hover:shadow-xs transition duration-150">
              <span className="text-[9px] text-emerald-600 font-mono uppercase font-black block mb-1">Volume (Succ)</span>
              <span className="text-base font-black text-emerald-700 font-mono leading-none">{formatNaira(financialSummary.totalVolume)}</span>
              <div className="mt-2.5 pt-2 flex items-center gap-1 border-t border-emerald-100/30">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] text-emerald-600 font-bold uppercase">Settled Volume</span>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-3 rounded-2xl shadow-2xs hover:shadow-xs transition duration-150">
              <span className="text-[9px] text-neutral-450 font-mono uppercase font-black block mb-1">Gross Fees</span>
              <span className="text-base font-black text-neutral-800 font-mono leading-none">{formatNaira(financialSummary.totalCustomerFees)}</span>
              <div className="mt-2.5 pt-2 border-t border-neutral-100 flex justify-between items-center">
                <span className="text-[8px] font-bold text-neutral-400 uppercase">Provider Cost</span>
                <span className="text-[10px] font-black text-red-500 font-mono">-{formatNaira(financialSummary.totalProviderCharges)}</span>
              </div>
            </div>

            <div className="bg-white border border-neutral-200 p-3 rounded-2xl shadow-2xs hover:shadow-xs transition duration-150">
              <span className="text-[9px] text-neutral-450 font-mono uppercase font-black block mb-1">CBN & Cashback</span>
              <div className="flex flex-col gap-1.5 mt-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-bold text-neutral-400 uppercase">CBN Cost</span>
                  <span className="text-[10px] font-black text-neutral-800 font-mono">{formatNaira(financialSummary.totalCBNCharges)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-bold text-neutral-400 uppercase">Cashback</span>
                  <span className="text-[10px] font-black text-[#00B87A] font-mono">{formatNaira(financialSummary.totalCashback)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-850 p-3.5 rounded-2xl shadow-md col-span-2 md:col-span-1 flex flex-col justify-between hover:shadow-lg transition duration-150 text-white">
              <div>
                <span className="text-[9px] text-emerald-400 font-mono uppercase font-black block mb-1">Realized Gain</span>
                <span className="text-base font-black text-white font-mono leading-tight">{formatNaira(financialSummary.totalProfit)}</span>
              </div>
              <div className="mt-2 flex items-center gap-1 opacity-90">
                <span className="text-[8px] text-neutral-300 font-bold uppercase tracking-tight">Net Profit after fees</span>
              </div>
            </div>
          </div>
        </div>


        {/* Diagnostic decoded representation layout of active queried parameters */}
        {queryAnalysis.hasQuery && (
          <div className="flex flex-wrap items-center gap-2 bg-neutral-50 border border-neutral-200/60 p-2.5 rounded-2xl text-xs font-mono font-bold text-neutral-600">
            <span className="text-[9px] text-neutral-400 uppercase tracking-widest leading-none mr-1 flex items-center gap-1 font-black">
              🔍 Active Queries:
            </span>
            {queryAnalysis.extractedProviders.map((p) => (
              <span key={p} className="bg-emerald-50 border border-emerald-250 text-emerald-800 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 capitalize font-sans font-bold shadow-xs">
                POS: {p}
                <button 
                  type="button"
                  onClick={() => {
                    const regex = new RegExp(`\\b${p}\\b`, 'gi');
                    setSearchQuery(searchQuery.replace(regex, '').trim().replace(/\s+/g, ' '));
                  }} 
                  className="hover:text-red-500 font-sans font-black leading-none ml-1 text-[11px] cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            {queryAnalysis.extractedTypes.map((t) => (
              <span key={t} className="bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 capitalize font-sans font-bold shadow-xs">
                Type: {t}
                <button 
                  type="button"
                  onClick={() => {
                    const regex = new RegExp(`\\b${t}\\b`, 'gi');
                    setSearchQuery(searchQuery.replace(regex, '').trim().replace(/\s+/g, ' '));
                  }} 
                  className="hover:text-red-500 font-sans font-black leading-none ml-1 text-[11px] cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            {queryAnalysis.textKeywords.map((k) => (
              <span key={k} className="bg-neutral-100 border border-neutral-250 text-neutral-700 px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 font-sans font-bold shadow-xs">
                Match: "{k === 'samebank' ? 'Same Bank' : k === 'otherbank' ? 'Interbank' : k}"
                <button 
                  type="button"
                  onClick={() => {
                    const regex = new RegExp(`\\b${k}\\b`, 'gi');
                    setSearchQuery(searchQuery.replace(regex, '').trim().replace(/\s+/g, ' '));
                  }} 
                  className="hover:text-red-500 font-sans font-black leading-none ml-1 text-[11px] cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            <button 
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[10px] text-red-500 hover:text-red-700 font-sans font-black ml-auto cursor-pointer flex items-center"
            >
              Reset Combined Search
            </button>
          </div>
        )}
      </div>

      {/* Bulk actions manager panel */}
      {currentUser.role === 'Manager' && selectedIds.length > 0 && (
        <div className="bg-neutral-900 border border-neutral-800 text-white p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg animate-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="bg-[#00B87A] text-white w-7 h-7 rounded-full flex items-center justify-center font-black text-xs font-mono">
              {selectedIds.length}
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white">Bulk Operations Active</h4>
              <p className="text-[10px] text-neutral-400 mt-0.5">Selected {selectedIds.length} of {filteredList.length} transactions.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dropdown for bulk status update */}
            <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1.5 rounded-xl border border-neutral-750">
              <span className="text-[10px] text-neutral-400 font-bold uppercase font-mono">Status:</span>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    handleBulkStatusUpdate(val as any);
                    e.target.value = '';
                  }
                }}
                className="bg-transparent border-none text-xs text-[#00B87A] font-black focus:outline-none cursor-pointer outline-none"
              >
                <option value="" className="text-neutral-800">Change...</option>
                <option value="Success" className="text-neutral-800 font-bold">🟢 Success</option>
                <option value="Pending" className="text-neutral-800 font-bold">🟡 Pending</option>
                <option value="Failed" className="text-neutral-800 font-bold">🔴 Decline</option>
              </select>
            </div>

            {/* Dropdown for bulk debt update */}
            <div className="flex items-center gap-1.5 bg-neutral-800 px-2.5 py-1.5 rounded-xl border border-neutral-750">
              <span className="text-[10px] text-neutral-400 font-bold uppercase font-mono">Debt:</span>
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    handleBulkDebtUpdate(val as any);
                    e.target.value = '';
                  }
                }}
                className="bg-transparent border-none text-xs text-amber-400 font-black focus:outline-none cursor-pointer outline-none"
              >
                <option value="" className="text-neutral-800">Change...</option>
                <option value="Paid" className="text-neutral-800 font-bold">🟢 Paid (Settle)</option>
                <option value="Unpaid" className="text-neutral-800 font-bold">🔴 Unpaid (Debt)</option>
              </select>
            </div>

            {/* Bulk Delete Button */}
            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 active:scale-[0.98] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Void {selectedIds.length} Records
            </button>

            {/* Cancel selection */}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              title="Deselect All"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Transaction History log table */}
      <div className="overflow-x-auto w-full pt-2">
        {filteredList.length === 0 ? (
          <div className="text-center py-10 bg-neutral-50 border border-dashed border-neutral-200 rounded-3xl">
            <p className="text-xs text-neutral-505 font-medium">No transactions match your visual filter query.</p>
            <p className="text-[10px] text-neutral-400 mt-1 font-mono">Try adjusting categories or recording a new receipt.</p>
          </div>
        ) : viewMode === 'easy' ? (
          <div className="space-y-2.5">
            {currentUser.role === 'Manager' && filteredList.length > 0 && (
              <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200/50 p-2.5 rounded-xl text-xs text-neutral-600 font-bold mb-1 animate-in fade-in duration-100">
                <div className="flex items-center gap-2">
                  <input
                    id="selectAllCards"
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={(e) => handleSelectAllToggle(e.target.checked)}
                    className="w-4 h-4 rounded border-neutral-300 text-[#00B87A] focus:ring-[#00B87A] cursor-pointer"
                  />
                  <label htmlFor="selectAllCards" className="cursor-pointer select-none">
                    Select All {filteredList.length} Visible Receipts
                  </label>
                </div>
                <span className="text-[10px] text-neutral-400 font-mono font-medium">
                  {selectedIds.length} of {filteredList.length} selected
                </span>
              </div>
            )}
            <div className={cardSize === 'small' ? 'space-y-1.5' : cardSize === 'medium' ? 'space-y-2' : 'space-y-2.5'}>
              <AnimatePresence mode="popLayout">
                {paginatedList.map((tx) => {
                  const serialNumber = transactions.length - transactions.indexOf(tx);
                  const providerTxs = transactions.filter(t => t.provider === tx.provider);
                  const providerIndex = providerTxs.indexOf(tx);
                  const providerSerialNumber = providerTxs.length - providerIndex;
                  const providerTxId = getProviderTransactionNumber(tx);
                  const destBank = tx.destinationBank;
                  const isSameBank = tx.subType === 'SameBank' || (tx.provider && destBank && tx.provider.toLowerCase() === destBank.toLowerCase());
                  const hasBankDetail = tx.type === 'Withdrawal' || tx.type === 'Transfer' || tx.type === 'Deposit' || tx.type === 'Cash Out (Transfer)' || tx.type === 'Airtime';
   
                  // Setup colors and friendly status / label descriptions
                  const cardBorderColor = 
                    tx.provider === 'Moniepoint' 
                      ? 'border-l-blue-500' 
                      : tx.provider === 'OPay' 
                      ? 'border-l-[#00B87A]' 
                      : 'border-l-orange-500';
   
                  // Friendly Operation Header & Colors
                  let easyCategoryTitle = '';
                  let easyCategoryDesc = '';
                  let easyIconBg = '';
                  let easyIconColor = '';
   
                  if (tx.mode === 'SplitSession') {
                    easyCategoryTitle = `🔄 Split Transaction`;
                    easyCategoryDesc = `Unified Multi-Segment POS Receipt`;
                    easyIconBg = 'bg-emerald-600 text-white shadow-lg shadow-emerald-200/50';
                    easyIconColor = 'text-white';
                  } else if (tx.type === 'Withdrawal') {
                    easyCategoryTitle = '📥 Withdraw';
                    easyCategoryDesc = 'Customer swiped card, you gave them paper cash';
                    easyIconBg = 'bg-emerald-50 text-emerald-700 border border-emerald-200/50';
                    easyIconColor = 'text-emerald-600';
                  } else if (tx.type === 'Transfer') {
                    easyCategoryTitle = '💸 Sent Bank Transfer';
                    easyCategoryDesc = 'You sent money to the customer\'s bank account';
                    easyIconBg = 'bg-indigo-50 text-indigo-700 border border-indigo-200/50';
                    easyIconColor = 'text-indigo-600';
                  } else { // Deposit
                    easyCategoryTitle = '📤 Money Receive';
                    easyCategoryDesc = 'Customer gave you cash, you credited their wallet';
                    easyIconBg = 'bg-blue-50 text-blue-700 border border-blue-200/50';
                    easyIconColor = 'text-blue-600';
                  }
   
                  // Friendly relative time calculation
                  const friendlyTime = (timestamp: string) => {
                    const d = new Date(timestamp);
                    const now = new Date();
                    const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    
                    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    if (isToday) return `Today at ${timeStr}`;
                    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
                  };
   
                  const isExpanded = expandedTxId === tx.id;
                  const isChild = tx.mode === 'SplitChild';
                  
                  // SESSION PROFITS FOR SPLIT WITHDRAWALS
                  const sessionChildren = transactions.filter(t => t.parentTransactionId === tx.id);
                  const sessionProfit = tx.profit + sessionChildren.reduce((sum, child) => sum + (child.profit || 0), 0);
                  const sessionTerminalFee = tx.terminalFee + sessionChildren.reduce((sum, child) => sum + (child.terminalFee || 0), 0);
                  const isSplitMode = tx.mode === 'SplitSession';

                  // Dynamic Density Layout Spacing Configurations
                  const cardPadding = 
                    cardSize === 'small' 
                      ? `${isChild ? 'ml-4 sm:ml-6 bg-neutral-50/10' : ''} p-2 rounded-xl border-l-[4px]` 
                      : cardSize === 'medium'
                      ? `${isChild ? 'ml-6 sm:ml-8 bg-neutral-50/20' : ''} p-3 rounded-2xl border-l-[5px]`
                      : `${isChild ? 'ml-8 sm:ml-10 bg-neutral-50/30' : ''} p-4 rounded-3xl border-l-[6px]`;

                  const iconSizeClass = 
                    cardSize === 'small' 
                      ? 'w-7 h-7 rounded-lg' 
                      : cardSize === 'medium'
                      ? 'w-8.5 h-8.5 rounded-xl'
                      : 'w-10 h-10 rounded-2xl';

                  const arrowSizeClass = 
                    cardSize === 'small' 
                      ? 'w-3.5 h-3.5 stroke-[3]' 
                      : cardSize === 'medium'
                      ? 'w-4 h-4 stroke-[3]'
                      : 'w-4.5 h-4.5 stroke-[3]';

                  const titleTextSize = 
                    cardSize === 'small' 
                      ? 'text-[11px] font-black' 
                      : cardSize === 'medium'
                      ? 'text-xs font-black'
                      : 'text-sm font-black';

                  const subTextSize = 
                    cardSize === 'small' 
                      ? 'text-[9px] font-bold' 
                      : cardSize === 'medium'
                      ? 'text-[10px] font-bold'
                      : 'text-[11px] font-bold';

                  const amountTextSize = 
                    cardSize === 'small' 
                      ? 'text-xs font-black' 
                      : cardSize === 'medium'
                      ? 'text-sm font-black'
                      : 'text-base font-black';

                  const statusBadgeTextSize = 
                    cardSize === 'small' 
                      ? 'text-[7px] px-1.5 py-0.2 rounded font-black tracking-wider uppercase' 
                      : cardSize === 'medium'
                      ? 'text-[8px] px-2 py-0.4 rounded font-black tracking-wider uppercase'
                      : 'text-[9px] px-2.5 py-0.6 rounded font-black tracking-wider uppercase';

                  const gapSpacing = 
                    cardSize === 'small' 
                      ? 'gap-3' 
                      : cardSize === 'medium'
                      ? 'gap-3.5'
                      : 'gap-4';

   
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                      className={`bg-white border border-neutral-150/80 shadow-[0_3px_12px_rgba(0,0,0,0.015)] ${cardPadding} ${cardBorderColor} hover:shadow-[0_8px_30px_rgba(0,0,0,0.05)] hover:border-neutral-300 hover:scale-[1.008] active:scale-[0.995] transition-all duration-300 ease-out cursor-pointer relative overflow-visible select-none group`}
                    >
                      {/* Serial Connector Line for Split Children */}
                      {isChild && (
                        <div className="absolute -left-[1.25rem] top-0 bottom-0 flex flex-col items-center">
                           <div className="w-px h-full bg-neutral-200 opacity-50" />
                           <div className="absolute top-1/2 -translate-y-1/2 w-4 h-px bg-neutral-200 opacity-50" />
                           {tx.splitSegmentIndex === 1 && (
                             <div className="absolute -top-3 w-1.5 h-1.5 rounded-full border border-neutral-200 bg-white" />
                           )}
                        </div>
                      )}
                      {/* Collapsed view Header Row */}
                      <div className={`flex items-center justify-between ${gapSpacing}`}>
                        {/* Left side: Type Icon + Labels */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {currentUser.role === 'Manager' && (
                            <div className="shrink-0 mr-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(tx.id)}
                                onChange={(e) => toggleSelect(tx.id, e.target.checked)}
                                className="w-4 h-4 rounded border-neutral-300 text-[#00B87A] focus:ring-[#00B87A] cursor-pointer"
                              />
                            </div>
                          )}
                          <div className={`${iconSizeClass} flex items-center justify-center shrink-0 ${easyIconBg} ${easyIconColor}`}>
                          {(tx.type === 'Withdrawal' || tx.type === 'Cash Out (Transfer)') && <ArrowDownLeft className={arrowSizeClass} />}
                          {tx.type === 'Transfer' && <ArrowRightLeft className={arrowSizeClass} />}
                          {tx.type === 'Deposit' && <ArrowUpRight className={arrowSizeClass} />}
                          {(tx.type === 'Airtime' || tx.type === 'Data') && <Smartphone className={arrowSizeClass} />}
                        </div>
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`${titleTextSize} text-neutral-800 tracking-tight`}>
                              {getFriendlyTypeLabel(tx.type)}
                            </span>
                            {tx.mode === 'SplitChild' && (
                              <span className="bg-blue-50 text-blue-700 text-[6px] font-black px-1 py-0.2 rounded-full uppercase tracking-tighter flex items-center gap-0.5 shadow-sm border border-blue-100">
                                Segment #{tx.splitSegmentIndex || '??'}
                              </span>
                            )}
                            {isSplitMode && (
                              <span className="bg-emerald-600 text-white text-[6px] font-black px-1 py-0.2 rounded-full uppercase tracking-tighter flex items-center gap-0.5 shadow-sm ring-2 ring-emerald-100">
                                <Sparkles className="w-1.5 h-1.5" /> Unified Session
                              </span>
                            )}
                            <span className="text-neutral-300 text-[10px]">•</span>
                            <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-lg border shadow-sm select-none ${
                              tx.provider === 'OPay' 
                                ? 'bg-emerald-50/90 text-[#00B87A] border-emerald-150' 
                                : tx.provider === 'Moniepoint' 
                                ? 'bg-blue-50/90 text-blue-700 border-blue-150' 
                                : 'bg-orange-50/90 text-orange-700 border-orange-150'
                            }`}>
                              {tx.provider}
                            </span>

                            {isSplitMode && tx.distributionProvider && (
                              <>
                                <ArrowRightLeft className="w-2.5 h-2.5 text-neutral-400" />
                                <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded-lg border shadow-sm select-none ${
                                  tx.distributionProvider === 'OPay' 
                                    ? 'bg-emerald-50/90 text-[#00B87A] border-emerald-150' 
                                    : tx.distributionProvider === 'Moniepoint' 
                                    ? 'bg-blue-50/90 text-blue-700 border-blue-150' 
                                    : 'bg-orange-50/90 text-orange-700 border-orange-150'
                                }`}>
                                  {tx.distributionProvider}
                                </span>
                              </>
                            )}

                            {destBank && (
                              <>
                                <span className="text-neutral-300 text-[8px]">➔</span>
                                <span className={`text-[8px] font-mono font-black px-2 py-0.5 rounded-lg border shadow-sm select-none ${getBankBadgeStyle(destBank)}`}>
                                  {destBank}
                                </span>
                              </>
                            )}

                            {hasBankDetail && (
                              <span className={`text-[8px] font-mono font-black px-2 py-0.5 rounded-lg border shadow-sm select-none ${
                                isSameBank
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-150'
                                  : 'bg-neutral-50 text-neutral-500 border-neutral-150'
                              }`}>
                                {isSameBank ? '🔄 Same Bank' : '🌐 Interbank'}
                              </span>
                            )}

                            {tx.audioNote && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playAudioNote(tx.id, tx.audioNote!);
                                }}
                                className={`text-[8.5px] font-mono font-black px-2 py-0.5 rounded-lg border shadow-sm flex items-center gap-1.5 transition-all cursor-pointer select-none ${
                                  playingAudioId === tx.id 
                                    ? 'bg-[#00B87A] text-white border-emerald-600 animate-pulse shadow-md shadow-emerald-100' 
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                                title={playingAudioId === tx.id ? "Pause voice note" : "Play voice note"}
                              >
                                {playingAudioId === tx.id ? (
                                  <>
                                    <Pause className="w-2 h-2 fill-white stroke-[2.5]" />
                                    <span>Playing</span>
                                  </>
                                ) : (
                                  <>
                                    <Mic className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                                    <span>Play Voice</span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                          
                          <div className={`${subTextSize} text-neutral-400 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 select-none`}>
                            <span className="font-mono font-black text-neutral-500 uppercase tracking-tighter">SLIP #{serialNumber}</span>
                            <span className="text-neutral-300">•</span>
                            <span className="tracking-tighter font-medium">{friendlyTime(tx.timestamp)}</span>
                            <span className="text-neutral-300">•</span>
                            <span className="font-sans capitalize font-extrabold text-neutral-500 tracking-tight">By {tx.employeeName}</span>
                          </div>

                          {/* Added financial summary fields for visibility without interaction */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2 select-none">
                            {isSplitMode ? (
                              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                <span className="bg-emerald-50/80 text-emerald-800 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-emerald-150 flex items-center gap-0.5 shadow-sm">
                                  <Sparkles className="w-2 h-2 text-emerald-500 shrink-0" /> 
                                  Profit: <span className="font-black text-emerald-700">{formatNaira(sessionProfit)}</span>
                                </span>
                                {tx.customerFee > 0 && (
                                  <span className="bg-neutral-50/80 text-neutral-600 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-neutral-150 flex items-center gap-0.5 shadow-sm">
                                    Fee: <span className="font-black text-neutral-800">{formatNaira(tx.customerFee)}</span>
                                  </span>
                                )}
                                <span className="bg-rose-50/60 text-rose-700 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-rose-100 flex items-center gap-0.5 shadow-sm">
                                  Cost: <span className="font-black text-rose-600">-{formatNaira(sessionTerminalFee + (tx.cbnCharge || 0))}</span>
                                </span>
                              </div>
                            ) : isChild ? (
                              <div className="flex flex-wrap items-center gap-1 bg-neutral-50/60 px-1.5 py-0.5 rounded-lg border border-neutral-100/80">
                                <span className="text-neutral-500 italic flex items-center gap-1 text-[8px]">
                                  <ArrowRightLeft className="w-2.5 h-2.5 text-neutral-400" />
                                  Distribution Segment
                                </span>
                                {tx.customerFee > 0 && (
                                  <span className="bg-neutral-100/80 text-neutral-600 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-neutral-200/50">
                                    Fee: <span className="text-neutral-800 font-black">{formatNaira(tx.customerFee)}</span>
                                  </span>
                                )}
                                <span className="bg-rose-50/60 text-rose-700 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-rose-100">
                                  Cost: <span className="text-rose-600 font-black">-{formatNaira(tx.terminalFee || 0)}</span>
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                                {tx.customerFee > 0 && (
                                  <span className="bg-neutral-50/80 text-neutral-600 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-neutral-150 flex items-center gap-0.5 shadow-sm">
                                    Fee: <span className="font-black text-neutral-800">{formatNaira(tx.customerFee)}</span>
                                  </span>
                                )}
                                <span className="bg-rose-50/60 text-rose-700 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-rose-100 flex items-center gap-0.5 shadow-sm">
                                  Cost: <span className="font-black text-rose-600">-{formatNaira(tx.terminalFee || 0)}</span>
                                </span>
                                <span className="bg-emerald-50/80 text-emerald-800 text-[8.5px] font-mono font-extrabold px-1.5 py-0.5 rounded-md border border-emerald-150 flex items-center gap-0.5 shadow-sm">
                                  Profit: <span className="font-black text-emerald-700">{formatNaira(tx.profit || 0)}</span>
                                </span>
                              </div>
                            )}
                            { (tx.chargesStatus !== 'Paid') && (
                              <span className={`px-1.5 py-0.5 rounded-md font-black text-[8.5px] uppercase border shadow-sm ${
                                tx.chargesStatus === 'Unpaid' 
                                  ? 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse' 
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {tx.chargesStatus === 'Unpaid' ? 'Debt' : 'Waived'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className={`${amountTextSize} font-mono text-neutral-900 tracking-tighter flex items-center justify-end gap-0.5`}>
                            {(isSplitMode || tx.mode === 'SplitChild') && (
                              <Sparkles className="w-2.5 h-2.5 text-emerald-500 animate-pulse shrink-0" />
                            )}
                            {formatNaira(tx.amount)}
                          </div>
                          
                          <div className="flex items-center justify-end gap-1 mt-1">
                            {tx.chargesStatus === 'Unpaid' ? (
                              <span className={`text-[6.5px] font-black tracking-wider bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md animate-pulse ${((new Date().getTime() - new Date(tx.timestamp).getTime()) > 172800000) ? 'text-red-700' : 'text-red-600'}`}>
                                {((new Date().getTime() - new Date(tx.timestamp).getTime()) > 172800000) ? '⚠️ OVERDUE' : '⚠️ DEBT'}
                              </span>
                            ) : (
                              <span className={`${statusBadgeTextSize} border flex items-center gap-1 select-none shadow-sm ${
                                  tx.status === 'Success' ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                  tx.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-150' : 'bg-rose-50 text-rose-700 border-rose-150'
                                }`}>
                                <span className={`w-1 h-1 ${
                                    tx.status === 'Success' ? 'bg-emerald-500' :
                                    tx.status === 'Pending' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                                  } rounded-full`} /> {tx.status === 'Failed' ? 'DECLINE' : tx.status.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-neutral-450 p-0.5 hover:text-neutral-700 transition">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                    </div>
 
                    {/* Smooth Expandable Content Panel */}
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`border-t border-neutral-100/80 ${cardSize === 'small' ? 'pt-2 mt-2 space-y-2' : 'pt-3 mt-2.5 space-y-3'} text-xs`}
                        onClick={(e) => e.stopPropagation()} // Stop propagation so inner interactions don't trigger parent card toggle
                      >
                        {/* Detailed Stats Grid */}
                        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-neutral-50/80 border border-neutral-100 p-2.5 rounded-lg ${cardSize === 'small' ? 'text-[9px]' : 'text-[10.5px]'}`}>
                          {/* Box 1: Customer Pays */}
                          <div className="px-1">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              💰 Cust. Pays
                            </span>
                            <div className={`font-bold text-neutral-800 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira(tx.totalCustomerCharged || tx.amount)}
                            </div>
                          </div>
 
                          {/* Box 2: Provider Cost */}
                          <div className="border-l border-neutral-200/50 px-2">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              🏢 Prov. Cost
                            </span>
                            <div className={`font-bold text-red-600 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira((tx.providerCharge || tx.terminalFee || 0) + (tx.vatAmount || 0))}
                            </div>
                            <span className="text-[7.5px] text-neutral-400 font-medium block leading-none">
                              Incl. {formatNaira(tx.vatAmount || 0)} VAT
                            </span>
                          </div>

                          {/* Box 3: Cashback */}
                          <div className="border-l border-neutral-200/50 px-2">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              🎁 Cashback
                            </span>
                            <div className={`font-bold text-blue-600 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira(tx.cashback || 0)}
                            </div>
                          </div>

                          {/* Box 4: Net Profit */}
                          <div className="border-l border-neutral-200/50 px-2">
                            <span className="text-[8px] font-mono font-black text-neutral-400 tracking-wider uppercase block">
                              {isSplitMode ? '✨ Session Profit' : '📈 Net Profit'}
                            </span>
                            <div className={`font-black text-emerald-600 font-mono mt-0.5 ${cardSize === 'small' ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                              {formatNaira(isSplitMode ? sessionProfit : tx.profit)}
                            </div>
                          </div>
                        </div>

                        {/* Supplementary metadata & instructions */}
                        <div className={`bg-neutral-50/60 border border-neutral-100 ${cardSize === 'small' ? 'p-1.5 rounded-lg space-y-1' : 'p-2.5 rounded-xl space-y-2'}`}>
                          {/* DEBT ALERT - If Unpaid */}
                          {tx.chargesStatus === 'Unpaid' && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2 animate-pulse">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                              <span className="text-[11px] font-black text-red-700">
                                ACTION REQUIRED: Customer has NOT paid charges of {formatNaira(tx.unpaidFeeAmount || tx.customerFee)}.
                              </span>
                            </div>
                          )}
                          <div className={`grid grid-cols-2 gap-x-4 gap-y-2 ${cardSize === 'small' ? 'text-[9.5px]' : 'text-[11px]'} text-left`}>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                Operator Name
                              </span>
                              <span className="font-bold text-neutral-700 capitalize">{tx.employeeName}</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                POS Station Used
                              </span>
                              <span className="font-bold text-neutral-700">{tx.provider} Station</span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                Action Instruction
                              </span>
                              <span className="font-black text-neutral-700">
                                {tx.type === 'Withdrawal' || tx.type === 'Cash Out (Transfer)' ? (
                                  <span className="text-emerald-700">🟢 Hand CASH bills to Customer</span>
                                ) : tx.type === 'Deposit' ? (
                                  <span className="text-blue-700">📥 Collect CASH bills from Customer</span>
                                ) : (
                                  <span className="text-indigo-700">💸 Sent Bank Transfer</span>
                                )}
                              </span>
                            </div>
                            <div>
                              <span className="text-[8.5px] font-mono font-black text-neutral-400 uppercase tracking-wider block">
                                System Reference ID
                              </span>
                              <div 
                                className="flex items-center gap-1 text-neutral-600 font-mono font-bold select-all cursor-pointer hover:text-neutral-900 transition"
                                onClick={() => handleCopy(providerTxId)}
                                title="Click to copy full reference ID"
                              >
                                <span>...{providerTxId.slice(-8)}</span>
                                {copiedId === providerTxId ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3.5]" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 text-neutral-400" />
                                )}
                              </div>
                            </div>
                          </div>
 
                          {/* Customer Details & Remarks */}
                          {(tx.customerName || tx.customerPhone || tx.customerAccountNumber || tx.notes || tx.audioNote) && (
                            <div className="border-t border-neutral-100 pt-2 flex flex-col gap-2 text-[11px] text-left">
                              {(tx.customerName || tx.customerPhone || tx.customerAccountNumber || tx.notes) && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  {(tx.customerName || tx.customerPhone || tx.customerAccountNumber) && (
                                    <span className="bg-amber-50 border border-amber-100/50 text-neutral-700 px-2.5 py-1 rounded-xl font-bold flex flex-wrap items-center gap-2">
                                      <span>👤 Cust: <strong className="text-neutral-900 font-black">{tx.customerName || 'Customer'}</strong></span>
                                      {tx.customerAccountNumber && (
                                        <span className="bg-amber-100 border border-amber-200 text-amber-900 text-[10px] font-mono px-1.5 py-0.2 rounded font-black">
                                          💳 {tx.customerAccountNumber}
                                        </span>
                                      )}
                                      {tx.customerPhone && (
                                        <span className="text-neutral-500 font-mono text-[10px]">
                                          📞 {tx.customerPhone}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {tx.mode === 'SplitSession' && tx.subTransfers && tx.subTransfers.length > 0 && (
                                <div className="mt-2 bg-emerald-50/40 border border-emerald-100/50 rounded-xl p-2.5 space-y-2">
                                  <div className="flex items-center justify-between border-b border-emerald-100 pb-1 mb-1">
                                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest font-mono flex items-center gap-1">
                                      <ArrowRightLeft className="w-2.5 h-2.5" /> Distribution Ledger
                                    </span>
                                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.2 rounded-full uppercase">
                                      {tx.subTransfers.length} Segments
                                    </span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {tx.subTransfers.map((st, i) => (
                                      <div key={i} className="flex justify-between items-center text-[9px]">
                                        <div className="flex flex-col min-w-0">
                                          <span className="font-black text-neutral-800 truncate">{st.recipientName}</span>
                                        </div>
                                        <span className="font-bold text-emerald-700 font-mono ml-2 shrink-0">{formatNaira(st.amount)}</span>
                                      </div>
                                    ))}
                                    {tx.remainingBalance !== undefined && tx.remainingBalance > 0 && (
                                      <div className="flex justify-between items-center text-neutral-500 pt-1 border-t border-emerald-100/30">
                                        <span className="text-[8px] font-bold uppercase">Cash Balance</span>
                                        <span className="text-[9px] font-bold font-mono">{formatNaira(tx.remainingBalance)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {tx.notes && (
                                    <span className="text-neutral-500 italic">
                                      • "{tx.notes}"
                                    </span>
                                  )}
                                </div>
                              )}
                              
                              {/* Distribution details removed from here as they are now always visible in the main card */}
                              

                              {tx.audioNote && (
                                <div className="mt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-2.5 p-2 bg-emerald-50/75 border border-emerald-100/80 rounded-xl max-w-sm shadow-sm hover:bg-emerald-50 transition-all">
                                    <button
                                      type="button"
                                      onClick={() => playAudioNote(tx.id, tx.audioNote!)}
                                      className="w-8 h-8 rounded-full bg-[#00B87A] hover:bg-emerald-600 flex items-center justify-center text-white cursor-pointer shadow transition active:scale-95 shrink-0"
                                      title={playingAudioId === tx.id ? "Pause voice note" : "Play voice note"}
                                    >
                                      {playingAudioId === tx.id ? (
                                        <Pause className="w-3.5 h-3.5 fill-white stroke-[2.5]" />
                                      ) : (
                                        <Play className="w-3.5 h-3.5 fill-white stroke-[2.5] ml-0.5" />
                                      )}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wide font-mono leading-none">Voice Record Note</span>
                                        {playingAudioId === tx.id && (
                                          <span className="flex items-center gap-0.5">
                                            <span className="w-0.5 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-0.5 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-0.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[9.5px] text-emerald-600 mt-0.5 font-bold leading-none">
                                        {playingAudioId === tx.id ? 'Playing broadcast...' : 'Play cashier audio record'}
                                      </p>
                                    </div>
                                    <div className="shrink-0 text-emerald-450 pr-1">
                                      <Mic className={`w-3.5 h-3.5 ${playingAudioId === tx.id ? 'animate-pulse text-emerald-600' : ''}`} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
 
                        {/* Interactive Settle / View / Edit Buttons */}
                        <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-neutral-100/80">
                          {tx.chargesStatus === 'Unpaid' && onUpdateTransaction && (
                            <button
                              type="button"
                              onClick={() => setSettlingTx(tx)}
                              className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[11px] font-black transition cursor-pointer flex items-center gap-0.5 shadow-sm active:scale-95 animate-pulse"
                            >
                              ✓ Collect Fee
                            </button>
                          )}
 
                          {currentUser.role === 'Manager' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditTransaction(tx)}
                                className="px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded transition font-bold text-[11px] flex items-center gap-0.5 cursor-pointer"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                                Edit Receipt
                              </button>
                              {tx.type === 'Withdrawal' && onSplitTransaction && (
                                <button
                                  type="button"
                                  onClick={() => onSplitTransaction(tx)}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded transition font-black text-[11px] flex items-center gap-1 cursor-pointer"
                                  title="Split this withdrawal into transfers"
                                >
                                  <ArrowRightLeft className="w-3 h-3" />
                                  Split
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete/void this transaction receipt?')) {
                                    onDeleteTransaction(tx.id);
                                  }
                                }}
                                className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 rounded transition cursor-pointer"
                                title="Delete Transaction"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onViewReceipt?.(tx)}
                              className="px-3 py-1.5 bg-[#00B87A] hover:bg-[#00b87a]/90 text-white rounded transition font-black text-[11px] flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              <FileCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                              View Receipt
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-neutral-200 text-neutral-400 text-[10px] font-mono uppercase tracking-wider">
                {currentUser.role === 'Manager' && (
                  <th className="py-3 px-2 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAllToggle(e.target.checked)}
                      className="w-4 h-4 rounded border-neutral-300 text-[#00B87A] focus:ring-[#00B87A] cursor-pointer animate-in fade-in"
                    />
                  </th>
                )}
                <th className="py-3 px-2 font-black">TXID / Timestamp</th>
                <th className="py-3 px-2 font-black hidden md:table-cell">Shift Staff</th>
                <th className="py-3 px-2 font-black text-center w-20">Status</th>
                <th className="py-3 px-2 font-black">Category & POS Channel</th>
                <th className="py-3 px-2 text-right font-black">Amount</th>
                <th className="py-3 px-2 text-right font-black hidden sm:table-cell">Customer Fee</th>
                <th className="py-3 px-2 text-right font-black hidden lg:table-cell">POS Cost</th>
                <th className="py-3 px-2 text-right font-black hidden sm:table-cell">Net Profit</th>
                <th className="py-3 px-2 font-black hidden md:table-cell">Customer / Notes</th>
                <th className="py-3 px-2 font-black text-center w-24 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 text-xs">
              <AnimatePresence mode="popLayout">
              {paginatedList.map((tx) => {
                const isDebit = tx.type === 'Withdrawal';
                
                // Colors representing true providers inside list
                const providerColor = 
                  tx.provider === 'Moniepoint' 
                    ? 'text-blue-600 bg-blue-50 border-blue-100' 
                    : tx.provider === 'OPay' 
                    ? 'text-[#00B87A] bg-emerald-50 border-emerald-100' 
                    : tx.provider === 'PalmPay'
                    ? 'text-orange-600 bg-orange-50 border-orange-100'
                    : 'text-neutral-600 bg-neutral-50 border-neutral-200';

                const serialNumber = transactions.length - transactions.indexOf(tx);

                // Count how many transactions of the same provider were done before or equal to this transaction.
                const providerTxs = transactions.filter(t => t.provider === tx.provider);
                const providerIndex = providerTxs.indexOf(tx);
                const providerSerialNumber = providerTxs.length - providerIndex;
                const providerTxId = getProviderTransactionNumber(tx);
                const destBank = tx.destinationBank;
                const isSameBank = tx.subType === 'SameBank' || (tx.provider && destBank && tx.provider.toLowerCase() === destBank.toLowerCase());
                const hasBankDetail = tx.type === 'Withdrawal' || tx.type === 'Transfer' || tx.type === 'Deposit' || tx.type === 'Cash Out (Transfer)' || tx.type === 'Airtime';

                // Styling for provider serial badges
                const providerBadgeStyle = 
                  tx.provider === 'Moniepoint'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : tx.provider === 'OPay'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                    : 'bg-orange-50 text-orange-700 border-orange-200';

                return (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                    className="hover:bg-neutral-50 transition-all group"
                  >
                    {currentUser.role === 'Manager' && (
                      <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(tx.id)}
                          onChange={(e) => toggleSelect(tx.id, e.target.checked)}
                          className="w-4 h-4 rounded border-neutral-300 text-[#00B87A] focus:ring-[#00B87A] cursor-pointer"
                        />
                      </td>
                    )}
                    {/* ID & Time */}
                    <td className={rowPadding}>
                      <div className="space-y-1">
                        <div className="font-mono text-neutral-700 font-black flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center justify-center bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-md px-1.5 py-0.5 text-[9px] font-black" title="Global System Receipt No.">
                            #{serialNumber}
                          </span>
                          <span className={`inline-flex items-center justify-center border rounded-md px-1.5 py-0.5 text-[9px] font-black ${providerBadgeStyle}`} title={`${tx.provider} Specific Receipt No.`}>
                            {tx.provider === 'OPay' ? 'OP' : tx.provider === 'Moniepoint' ? 'MP' : 'PP'}-{providerSerialNumber}
                          </span>
                          <span className="font-black text-neutral-800 tracking-tight break-all select-all flex items-center gap-1" title="Differentiated Provider Transaction reference / Session ID">
                            <span className="inline md:hidden">ID: ...{providerTxId.slice(-6)}</span>
                            <span className="hidden md:inline">{providerTxId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(providerTxId)}
                              className="text-neutral-400 hover:text-[#00B87A] p-0.5 rounded cursor-pointer transition ml-1 shrink-0"
                            >
                              {copiedId === providerTxId ? (
                                <Check className="w-3 h-3 text-emerald-600 stroke-[3.5]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400 flex items-center gap-1 font-medium pt-0.5">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    </td>

                    {/* Employee Operator */}
                    <td className={`${rowPadding} hidden md:table-cell`}>
                      <span className="font-bold text-neutral-700">{tx.employeeName}</span>
                    </td>

                    {/* Status Badge */}
                    <td className={`${rowPadding} text-center`}>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider font-mono select-none ${
                        (tx.status || 'Success') === 'Success'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                          : (tx.status || 'Success') === 'Pending'
                          ? 'bg-amber-50 text-amber-700 border-amber-150'
                          : 'bg-red-50 text-red-700 border-red-150'
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${
                          (tx.status || 'Success') === 'Success'
                            ? 'bg-emerald-500'
                            : (tx.status || 'Success') === 'Pending'
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`} />
                        {(tx.status || 'Success') === 'Success' ? 'SUCCESS' : (tx.status || 'Success') === 'Pending' ? 'PENDING' : 'DECLINE'}
                      </span>
                    </td>

                    {/* Category & Provider Badges */}
                    <td className={`${rowPadding} font-medium`}>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-bold flex items-center gap-1 ${
                          (tx.type === 'Withdrawal' || tx.type === 'Cash Out (Transfer)')
                            ? 'bg-orange-100 text-orange-750' 
                            : tx.type === 'Deposit' 
                            ? 'bg-blue-100 text-blue-750' 
                            : 'bg-indigo-100 text-indigo-750'
                        }`}>
                          {tx.type === 'Withdrawal' ? '📥 Withdraw (ATM)' : tx.type === 'Cash Out (Transfer)' ? '📲 Money Receive' : tx.type === 'Deposit' ? '📤 Money Receive' : '💸 Send'}
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black border ${providerColor}`}>
                          {tx.provider}
                        </span>

                        {destBank && (
                          <>
                            <span className="text-neutral-400 text-[10px]">➔</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black border ${getBankBadgeStyle(destBank)}`}>
                              {destBank}
                            </span>
                          </>
                        )}

                        {hasBankDetail && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-mono uppercase font-extrabold border ${
                            isSameBank
                              ? 'bg-emerald-100/75 text-emerald-800 border-emerald-250'
                              : 'bg-neutral-100/70 text-neutral-500 border-neutral-200'
                          }`}>
                            {isSameBank ? '🔄 Same Bank' : '🌐 Other Bank'}
                          </span>
                        )}

                        {tx.feeMethod && (
                          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-mono uppercase font-black border hidden sm:inline ${
                            tx.feeMethod === 'CardDebit'
                              ? 'bg-amber-100/75 text-amber-800 border-amber-300'
                              : 'bg-emerald-50 text-emerald-705 border-emerald-150'
                          }`}>
                            {tx.feeMethod === 'CardDebit' ? '💳 Card' : '💵 Cash'}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className={`${rowPadding} text-right font-mono font-extrabold text-neutral-900 text-sm`}>
                      <div>{formatNaira(tx.amount)}</div>
                      {tx.totalCustomerCharged && tx.totalCustomerCharged !== tx.amount && (
                        <div className="text-[9px] text-amber-600 font-sans font-bold mt-0.5 tracking-tight" title="Total customer card swipe/account debit (base + fee)">
                          Charged: {formatNaira(tx.totalCustomerCharged)}
                        </div>
                      )}
                    </td>

                    {/* Client fee */}
                    <td className={`${rowPadding} text-right font-mono text-neutral-600 font-medium hidden sm:table-cell`}>
                      <div>{formatNaira(tx.customerFee)}</div>
                      {tx.chargesStatus === 'Unpaid' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-750 border border-amber-200 mt-1">
                          ⏳ Debt: {formatNaira(tx.unpaidFeeAmount ?? tx.customerFee)}
                        </span>
                      )}
                    </td>

                    {/* Cashout cost */}
                    <td className={`${rowPadding} text-right font-mono font-medium hidden lg:table-cell`}>
                      <div className="text-red-500">-{formatNaira(tx.terminalFee)}</div>
                      {tx.cbnCharge && tx.cbnCharge > 0 ? (
                        <div className="text-[9px] text-red-400 font-sans font-bold mt-0.5 tracking-tight" title="CBN EMTL Charge">
                          CBN: -{formatNaira(tx.cbnCharge)}
                        </div>
                      ) : null}
                    </td>

                    {/* Final profit */}
                    <td className={`${rowPadding} text-right font-mono font-black text-emerald-600 hidden sm:table-cell`}>
                      <div>{formatNaira(tx.profit)}</div>
                    </td>

                    {/* Customer Info & Notes */}
                    <td className={`${rowPadding} max-w-[150px] text-neutral-400 font-medium hidden md:table-cell`} title={`${tx.customerName ? 'Debtor: ' + tx.customerName + '\n' : ''}${tx.customerAccountNumber ? 'Acct: ' + tx.customerAccountNumber + '\n' : ''}${tx.customerPhone ? 'Phone: ' + tx.customerPhone + '\n' : ''}${tx.notes || ''}`}>
                      {tx.customerName && (
                        <div className="text-[10px] text-amber-700 font-black mb-0.5 flex items-center gap-1 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-lg w-max shrink-0">
                          👤 {tx.customerName}
                        </div>
                      )}
                      {tx.customerAccountNumber && (
                        <div className="text-[10px] text-amber-900 font-bold font-mono mb-0.5 flex items-center gap-1 bg-amber-100/60 border border-amber-200/40 px-1.5 py-0.5 rounded-lg w-max shrink-0">
                          💳 {tx.customerAccountNumber}
                        </div>
                      )}
                      {tx.customerPhone && (
                        <div className="text-[10px] text-neutral-600 font-bold mb-0.5">📞 {tx.customerPhone}</div>
                      )}
                      {tx.notes && (
                        <div className="truncate text-xs font-bold text-neutral-500 mb-1">
                          "{tx.notes}"
                        </div>
                      )}
                      {!tx.customerName && !tx.customerPhone && !tx.customerAccountNumber && !tx.notes && !tx.audioNote && (
                        <span className="italic text-neutral-300">No notes</span>
                      )}
                      {tx.audioNote && (
                        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => playAudioNote(tx.id, tx.audioNote!)}
                            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono font-black border transition-all cursor-pointer shadow-sm ${
                              playingAudioId === tx.id
                                ? 'bg-[#00B87A] text-white border-emerald-600 animate-pulse'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {playingAudioId === tx.id ? (
                              <>
                                <Pause className="w-2.5 h-2.5 fill-white stroke-[2.5]" />
                                <span>Playing</span>
                              </>
                            ) : (
                              <>
                                <Mic className="w-2.5 h-2.5 text-[#00B87A] animate-pulse" />
                                <span>Play Voice</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Action controls */}
                    <td className={`${rowPadding} text-right pr-4 shrink-0 font-mono`}>
                      <div className="flex justify-end items-center gap-1.5">
                        {tx.chargesStatus === 'Unpaid' && onUpdateTransaction && (
                          <button
                            type="button"
                            onClick={() => setSettlingTx(tx)}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95 animate-pulse"
                            title="Mark outstanding charges as fully paid"
                          >
                            ✓ Settle Fee
                          </button>
                        )}

                        {currentUser.role === 'Manager' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditTransaction(tx)}
                              className="p-1 px-2.5 bg-neutral-100 hover:bg-[#00B87A]/10 text-neutral-650 hover:text-[#00B87A] rounded-xl transition duration-100 border border-neutral-200 hover:border-[#00B87A]/30 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer"
                              title="Edit transaction parameters (amount or charges)"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            {tx.type === 'Withdrawal' && onSplitTransaction && (
                              <button
                                type="button"
                                onClick={() => onSplitTransaction(tx)}
                                className="p-1 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition duration-100 border border-emerald-200 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                                title="Split this withdrawal into multiple transfers"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                <span>Split</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete/void this transaction receipt?')) {
                                  onDeleteTransaction(tx.id);
                                }
                              }}
                              className="p-1 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                              title="Void / Delete Transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onViewReceipt?.(tx)}
                            className="px-3 py-1.5 border border-[#00B87A]/20 hover:border-emerald-500 bg-[#00B87A]/10 hover:bg-[#00B87A] text-[#00B87A] hover:text-white rounded-xl transition duration-110 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer shadow-xs"
                            title="View receipt slip details"
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            <span>Slip Receipt</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              </AnimatePresence>
            </tbody>
          </table>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="bg-neutral-50 px-4 py-3 border-t border-neutral-100 flex items-center justify-between mt-3 select-none rounded-2xl">
            <div className="text-[10px] text-neutral-500 font-mono">
              Showing <span className="font-bold text-neutral-800">{Math.min(totalItems, (currentPage - 1) * pageSize + 1)}</span> to{' '}
              <span className="font-bold text-neutral-800">{Math.min(totalItems, currentPage * pageSize)}</span> of{' '}
              <span className="font-bold text-neutral-800">{totalItems}</span> transactions
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="py-1 px-3 border border-neutral-200 hover:border-neutral-300 text-[10px] font-bold text-neutral-600 rounded-lg cursor-pointer transition bg-white select-none disabled:opacity-40 disabled:cursor-not-allowed text-center"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                const isCurrent = currentPage === pageNum;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`py-1 px-2.5 text-[10px] font-mono font-bold rounded-lg transition cursor-pointer select-none ${
                      isCurrent
                        ? 'bg-[#00B87A] text-white border border-[#00B87A]'
                        : 'border border-neutral-200 hover:bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="py-1 px-3 border border-neutral-200 hover:border-neutral-300 text-[10px] font-bold text-neutral-600 rounded-lg cursor-pointer transition bg-white select-none disabled:opacity-40 disabled:cursor-not-allowed text-center"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Employee Settle Charges Overlay Modal */}
      {settlingTx && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 relative border border-neutral-100 text-left animate-in slide-in-from-bottom-4 duration-250">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSettlingTx(null)}
              className="absolute right-4.5 top-4.5 p-1.5 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-6">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                Employee Terminal Settle
              </span>
              <h3 className="text-lg font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5 mt-1">
                Settle Deferred Charges
              </h3>
              <p className="text-xs text-neutral-500">
                Edit and add the exact charges before marking the transaction commission as successful.
              </p>
            </div>

            {/* Debtor Snapshot Panel */}
            <div className="bg-neutral-50 border border-neutral-200/60 p-3.5 rounded-2xl space-y-2.5 text-xs text-neutral-700 font-medium">
              <div className="flex justify-between items-center border-b border-neutral-200/50 pb-2">
                <span className="text-neutral-400 uppercase font-mono text-[9px] font-bold">Client / Debtor</span>
                <span className="font-extrabold text-neutral-800">{settlingTx.customerName || 'Walk-in Client'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-neutral-400 uppercase font-mono text-[8px] block font-bold">Transaction Type</span>
                  <span className="font-bold text-neutral-850">{settlingTx.type} ({settlingTx.provider})</span>
                </div>
                <div>
                  <span className="text-neutral-400 uppercase font-mono text-[8px] block font-bold">Transaction Amount</span>
                  <span className="font-bold text-neutral-850 font-mono">{formatNaira(settlingTx.amount)}</span>
                </div>
              </div>
              <div className="text-[10px] text-neutral-400 font-mono pt-1">
                Originally processed by employee <strong>{settlingTx.employeeName}</strong>
              </div>
            </div>

            {/* Edit Settle Fee Field */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="settle-fee-input" className="block text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
                  Employee Adjusted Charge Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-sm">₦</span>
                  <input
                    id="settle-fee-input"
                    type="number"
                    value={settleFeeInput}
                    onChange={(e) => setSettleFeeInput(e.target.value)}
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-3 py-2.5 text-neutral-850 font-mono text-sm font-black focus:outline-none focus:border-emerald-500 focus:bg-white"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Fee Method Toggle option */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                  Collection Method
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleFeeMethod('Cash')}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition cursor-pointer text-center uppercase font-mono ${
                      settleFeeMethod === 'Cash'
                        ? 'bg-neutral-800 border-neutral-800 text-white font-black'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    💵 Cash Collection
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleFeeMethod('CardDebit')}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition cursor-pointer text-center uppercase font-mono ${
                      settleFeeMethod === 'CardDebit'
                        ? 'bg-neutral-800 border-neutral-800 text-white font-black'
                        : 'bg-white border-neutral-200 text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    💳 Card Add-on (Bill Fee)
                  </button>
                </div>
              </div>
            </div>

            {/* Calculations and Profits Preview */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl space-y-2.5">
              <span className="text-[9px] text-emerald-800 font-mono font-black uppercase tracking-wider block">
                🔴 Live Settle Impact Summary
              </span>
              <div className="space-y-1.5 text-xs text-neutral-600 font-medium text-left">
                <div className="flex justify-between">
                  <span>Manager Settle Fee Amount:</span>
                  <span className="font-mono font-bold text-neutral-800">{formatNaira(parseFloat(settleFeeInput) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Terminal Base Commission:</span>
                  <span className="font-mono text-neutral-500">-{formatNaira(settlingTx.terminalFee)}</span>
                </div>
                {settlingTx.cbnCharge ? (
                  <div className="flex justify-between">
                    <span>CBN Duty:</span>
                    <span className="font-mono text-neutral-500">-{formatNaira(settlingTx.cbnCharge)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-neutral-200/50 pt-2 text-sm font-black">
                  <span className="text-emerald-850">Net Commission Profit:</span>
                  <span className="font-mono text-emerald-700">
                    {formatNaira((parseFloat(settleFeeInput) || 0) - settlingTx.terminalFee - (settlingTx.cbnCharge || 0))}
                  </span>
                </div>
              </div>
            </div>

            {/* Confirm Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setSettlingTx(null)}
                className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition cursor-pointer font-mono uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!onUpdateTransaction) return;
                  const feeToSettle = parseFloat(settleFeeInput) || 0;
                  const updatedProfit = feeToSettle - settlingTx.terminalFee - (settlingTx.cbnCharge || 0);
                  const updatedTotalCustomerCharged = settleFeeMethod === 'CardDebit' ? (settlingTx.amount + feeToSettle) : settlingTx.amount;

                  onUpdateTransaction({
                    ...settlingTx,
                    customerFee: feeToSettle,
                    profit: updatedProfit,
                    totalCustomerCharged: updatedTotalCustomerCharged,
                    feeMethod: settleFeeMethod,
                    chargesStatus: 'Paid',
                    unpaidFeeAmount: undefined
                  });

                  // Simple Web Audio API feedback
                  try {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContextClass) {
                      const ctx = new AudioContextClass();
                      const now = ctx.currentTime;
                      const osc = ctx.createOscillator();
                      const gain = ctx.createGain();
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(523.25, now);
                      gain.gain.setValueAtTime(0.12, now);
                      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                      osc.connect(gain);
                      gain.connect(ctx.destination);
                      osc.start(now);
                      osc.stop(now + 0.15);
                    }
                  } catch (e) {}

                  setSettlingTx(null);
                }}
                className="w-full py-2.5 px-4 bg-[#00B87A] hover:bg-emerald-600 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 font-mono uppercase shadow-md active:scale-95"
              >
                ✓ Save & Settle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
