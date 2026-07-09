/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, User } from '../types';
import { formatNaira, calculateTerminalFee, calculateCBNCharge, generateId } from '../utils';
import { 
  AlertTriangle, 
  Search, 
  Check, 
  MessageSquare, 
  Copy, 
  Clock, 
  User as UserIcon, 
  Calendar,
  Layers,
  ArrowRight,
  Info,
  X,
  CreditCard,
  DollarSign,
  Plus,
  ArrowDownRight,
  ArrowUpLeft,
  FolderOpen,
  ChevronRight,
  Trash2,
  ListFilter
} from 'lucide-react';

interface UnpaidChargesLedgerProps {
  transactions: Transaction[];
  onUpdateTransaction: (tx: Transaction) => void;
  onAddTransaction?: (tx: Transaction) => void;
  currentUser?: User;
}

export function UnpaidChargesLedger({
  transactions,
  onUpdateTransaction,
  onAddTransaction,
  currentUser
}: UnpaidChargesLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [timePeriod, setTimePeriod] = useState<'all' | 'today' | 'weekly' | 'monthly' | 'yearly'>('all');

  // Employee editing settle state
  const [settlingTx, setSettlingTx] = useState<Transaction | null>(null);
  const [settleFeeInput, setSettleFeeInput] = useState<string>('');
  const [settleAmountPaid, setSettleAmountPaid] = useState<string>('');
  const [settlePaymentDate, setSettlePaymentDate] = useState<string>('');
  const [settlePaymentNote, setSettlePaymentNote] = useState<string>('Partial payment');
  const [settleFeeMethod, setSettleFeeMethod] = useState<'Cash' | 'CardDebit'>('Cash');

  // New Grouped/Gathered Debtors view state
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');
  const [editingCustomerName, setEditingCustomerName] = useState<string | null>(null);
  const [portfolioTxs, setPortfolioTxs] = useState<Transaction[]>([]);
  const [showAddTxForm, setShowAddTxForm] = useState(false);
  const [bulkFeeInput, setBulkFeeInput] = useState('');

  // Add New Deferred Transaction internal form inside grouped account
  const [newTxType, setNewTxType] = useState<'Withdrawal' | 'Transfer' | 'Deposit'>('Withdrawal');
  const [newTxProvider, setNewTxProvider] = useState<'OPay' | 'Moniepoint' | 'PalmPay'>('OPay');
  const [newTxAmount, setNewTxAmount] = useState('10000');
  const [newTxFee, setNewTxFee] = useState('200');
  const [newTxFeeMethod, setNewTxFeeMethod] = useState<'Cash' | 'CardDebit'>('Cash');
  const [newTxNotes, setNewTxNotes] = useState('');

  // Filter transactions with unpaid charges (including partially paid)
  const unpaidTransactions = useMemo(() => {
    return transactions.filter(
      (tx) => (tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid') && (tx.status || 'Success') !== 'Failed'
    );
  }, [transactions]);

  useEffect(() => {
    if (settlingTx) {
      const remaining = settlingTx.unpaidFeeAmount !== undefined ? settlingTx.unpaidFeeAmount : (settlingTx.customerFee || 200);
      setSettleFeeInput(remaining.toString());
      setSettleAmountPaid(remaining.toString());
      setSettleFeeMethod(settlingTx.feeMethod || 'Cash');
      
      const tzOffset = new Date().getTimezoneOffset() * 60000;
      const localISOTime = new Date(Date.now() - tzOffset).toISOString().slice(0, 16);
      setSettlePaymentDate(localISOTime);
      setSettlePaymentNote('Partial payment');
    }
  }, [settlingTx]);

  // Sync portfolioTxs when editingCustomerName or unpaidTransactions shifts
  useEffect(() => {
    if (editingCustomerName) {
      const matches = unpaidTransactions.filter(
        tx => (tx.customerName || 'Walk-in Client').toLowerCase().trim() === editingCustomerName.toLowerCase().trim()
      );
      
      setPortfolioTxs((prev) => {
        return matches.map((match) => {
          const existing = prev.find(p => p.id === match.id);
          if (existing) {
            return {
              ...match,
              unpaidFeeAmount: existing.unpaidFeeAmount,
              feeMethod: existing.feeMethod
            };
          }
          return match;
        });
      });
    } else {
      setPortfolioTxs([]);
      setShowAddTxForm(false);
      setBulkFeeInput('');
    }
  }, [editingCustomerName, unpaidTransactions]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalDebt = unpaidTransactions.reduce((sum, tx) => sum + (tx.unpaidFeeAmount ?? tx.customerFee ?? 0), 0);
    const debtorCount = unpaidTransactions.length;
    
    // Group by unique customerName
    const uniqueDebtors = new Set(unpaidTransactions.map(tx => tx.customerName?.toLowerCase().trim()).filter(Boolean));
    
    return {
      totalDebt,
      debtorCount,
      uniqueDebtorsCount: uniqueDebtors.size
    };
  }, [unpaidTransactions]);

  // Calculate stats by period
  const timeStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    let todaySum = 0;
    let todayCount = 0;
    let weeklySum = 0;
    let weeklyCount = 0;
    let monthlySum = 0;
    let monthlyCount = 0;
    let yearlySum = 0;
    let yearlyCount = 0;

    unpaidTransactions.forEach((tx) => {
      const amt = tx.unpaidFeeAmount ?? tx.customerFee ?? 0;
      const t = new Date(tx.timestamp).getTime();

      if (t >= todayStart) {
        todaySum += amt;
        todayCount++;
      }
      if (t >= sevenDaysAgo) {
        weeklySum += amt;
        weeklyCount++;
      }
      if (t >= startOfMonth) {
        monthlySum += amt;
        monthlyCount++;
      }
      if (t >= startOfYear) {
        yearlySum += amt;
        yearlyCount++;
      }
    });

    return {
      today: { sum: todaySum, count: todayCount },
      weekly: { sum: weeklySum, count: weeklyCount },
      monthly: { sum: monthlySum, count: monthlyCount },
      yearly: { sum: yearlySum, count: yearlyCount }
    };
  }, [unpaidTransactions]);

  // Search and timeperiod filter
  const filteredUnpaid = useMemo(() => {
    let list = unpaidTransactions;

    if (timePeriod !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

      list = list.filter((tx) => {
        const t = new Date(tx.timestamp).getTime();
        if (timePeriod === 'today') return t >= todayStart;
        if (timePeriod === 'weekly') return t >= sevenDaysAgo;
        if (timePeriod === 'monthly') return t >= startOfMonth;
        if (timePeriod === 'yearly') return t >= startOfYear;
        return true;
      });
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;

    return list.filter((tx) => {
      return (
        tx.customerName?.toLowerCase().includes(q) ||
        tx.customerPhone?.toLowerCase().includes(q) ||
        tx.notes?.toLowerCase().includes(q) ||
        tx.id.toLowerCase().includes(q) ||
        tx.employeeName.toLowerCase().includes(q)
      );
    });
  }, [unpaidTransactions, timePeriod, searchQuery]);

  // Grouped customer debts (Accounts)
  const groupedAccounts = useMemo(() => {
    const groups: Record<string, {
      customerName: string;
      customerPhone?: string;
      transactions: Transaction[];
      totalDebt: number;
      lastActivity: string;
    }> = {};

    filteredUnpaid.forEach((tx) => {
      const name = (tx.customerName || 'Walk-in Client').trim();
      const key = name.toLowerCase();
      
      if (!groups[key]) {
        groups[key] = {
          customerName: name,
          customerPhone: tx.customerPhone,
          transactions: [],
          totalDebt: 0,
          lastActivity: tx.timestamp
        };
      }
      
      groups[key].transactions.push(tx);
      groups[key].totalDebt += (tx.unpaidFeeAmount ?? tx.customerFee ?? 0);
      
      if (new Date(tx.timestamp).getTime() > new Date(groups[key].lastActivity).getTime()) {
        groups[key].lastActivity = tx.timestamp;
        if (tx.customerPhone) {
          groups[key].customerPhone = tx.customerPhone;
        }
      }
    });

    return Object.values(groups).sort((a, b) => b.totalDebt - a.totalDebt);
  }, [filteredUnpaid]);

  // Settle single transaction charges - open editing modal
  const handleSettleDebt = (tx: Transaction) => {
    setSettlingTx(tx);
  };

  // Settle all debts for a customer
  const handleSettleAllForCustomer = (customerName: string) => {
    const customerTxs = unpaidTransactions.filter(
      tx => tx.customerName?.toLowerCase().trim() === customerName.toLowerCase().trim()
    );

    if (customerTxs.length === 0) return;

    const totalDue = customerTxs.reduce((sum, t) => sum + (t.unpaidFeeAmount ?? t.customerFee ?? 0), 0);
    if (confirm(`Mark all ${customerTxs.length} unpaid transaction charges (${formatNaira(totalDue)}) as Paid for ${customerName}?`)) {
      customerTxs.forEach((tx) => {
        const feeToSettle = tx.unpaidFeeAmount ?? tx.customerFee ?? 0;
        const updatedProfit = feeToSettle - tx.terminalFee - (tx.cbnCharge || 0);
        const updatedTotalCustomerCharged = tx.feeMethod === 'CardDebit' ? (tx.amount + feeToSettle) : tx.amount;

        onUpdateTransaction({
          ...tx,
          customerFee: feeToSettle,
          profit: updatedProfit,
          totalCustomerCharged: updatedTotalCustomerCharged,
          chargesStatus: 'Paid',
          unpaidFeeAmount: undefined
        });
      });
      alert(`Successfully settled all outstanding charges for ${customerName}!`);
    }
  };

  const [skippedTxIds, setSkippedTxIds] = useState<Set<string>>(new Set());

  const handleSettlePortfolio = () => {
    if (!editingCustomerName || portfolioTxs.length === 0) return;

    const txsToSettle = portfolioTxs.filter(tx => !skippedTxIds.has(tx.id));
    
    if (txsToSettle.length === 0) {
      alert('No transactions selected for settlement.');
      return;
    }

    const totalPaidSum = txsToSettle.reduce((sum, tx) => sum + (tx.unpaidFeeAmount ?? tx.customerFee ?? 0), 0);

    txsToSettle.forEach((tx) => {
      const finalFee = tx.unpaidFeeAmount ?? tx.customerFee ?? 0;
      const finalProfit = finalFee - tx.terminalFee - (tx.cbnCharge || 0);
      const finalTotalCharged = tx.feeMethod === 'CardDebit' ? (tx.amount + finalFee) : tx.amount;

      onUpdateTransaction({
        ...tx,
        customerFee: finalFee,
        profit: finalProfit,
        totalCustomerCharged: finalTotalCharged,
        chargesStatus: 'Paid',
        unpaidFeeAmount: undefined
      });
    });

    // Success sound
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now); // C5
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5
        gain2.gain.setValueAtTime(0.12, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.35);
      }
    } catch (e) {}

    alert(`Successfully saved and settled ${txsToSettle.length} outstanding transactions for ${editingCustomerName}! Settled charges total: ${formatNaira(totalPaidSum)}`);
    setEditingCustomerName(null);
    setSkippedTxIds(new Set());
  };

  const applyBulkFeeToPortfolio = () => {
    const feeVal = parseFloat(bulkFeeInput);
    if (isNaN(feeVal) || feeVal < 0) {
      alert('Please enter a valid positive fee.');
      return;
    }
    setPortfolioTxs((prev) => 
      prev.map(tx => ({
        ...tx,
        unpaidFeeAmount: feeVal
      }))
    );
    setBulkFeeInput('');
  };

  const handleAddTransactionToGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerName) return;

    const amountNum = parseFloat(newTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    let feeNum = parseFloat(newTxFee);
    if (isNaN(feeNum) || feeNum < 0) {
      feeNum = 0;
    }

    const terminalFee = calculateTerminalFee(amountNum, newTxType, newTxProvider, 0.5, 'OtherBank');
    const cbnCharge = calculateCBNCharge(amountNum, newTxType);
    const id = generateId();

    const newTx: Transaction = {
      id,
      employeeId: currentUser?.id || 'manual_added',
      employeeName: currentUser?.name || 'Manual Admin',
      type: newTxType,
      provider: newTxProvider,
      subType: 'OtherBank',
      amount: amountNum,
      customerFee: 0,
      unpaidFeeAmount: feeNum,
      terminalFee,
      cbnCharge,
      profit: -terminalFee - cbnCharge,
      feeMethod: newTxFeeMethod,
      totalCustomerCharged: newTxFeeMethod === 'CardDebit' ? (amountNum + feeNum) : amountNum,
      timestamp: new Date().toISOString(),
      notes: newTxNotes.trim() ? `[Group Added] ${newTxNotes}` : '[Group Added]',
      customerPhone: groupedAccounts.find(g => g.customerName.toLowerCase() === editingCustomerName.toLowerCase())?.customerPhone,
      status: 'Success',
      chargesStatus: 'Unpaid',
      customerName: editingCustomerName
    };

    if (onAddTransaction) {
      onAddTransaction(newTx);
    } else {
      onUpdateTransaction(newTx);
    }

    setNewTxAmount('10000');
    setNewTxFee('200');
    setNewTxNotes('');
    setShowAddTxForm(false);
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {}
  };

  // Generate friendly reminder message
  const handleCopyReminder = (tx: Transaction) => {
    const dateStr = new Date(tx.timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
    const feeToSettle = tx.unpaidFeeAmount ?? tx.customerFee ?? 0;
    const businessName = "Dan Godal POS Hub";
    const msg = `Hello ${tx.customerName || 'Customer'}, this is a friendly reminder from ${businessName} regarding your outstanding transaction fee of ${formatNaira(feeToSettle)} for your ${tx.type} transaction on ${dateStr}. Kindly drop it by the counter when you pass. Thank you!`;
    
    navigator.clipboard.writeText(msg);
    setCopiedId(tx.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div id="unpaid-charges-ledger" className="bg-white border border-neutral-200 rounded-3xl p-5 space-y-5 shadow-sm">
      {/* Header and Visual Warning alert */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-2">
              Outstanding Charges Reminders Hub
              {stats.debtorCount > 0 && (
                <span className="bg-red-100 text-red-700 text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none">
                  ⚠️ Active Alerts
                </span>
              )}
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5 font-medium">
              Track and remind clients who defer paying transaction commissions.
            </p>
          </div>
        </div>
      </div>

      {/* Debt Alert Summary Card */}
      {stats.debtorCount > 0 ? (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-lg pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
            <div className="space-y-1">
              <span className="text-[10px] text-orange-100 font-mono font-bold uppercase tracking-widest block">
                Total Uncollected Commissions Debt
              </span>
              <h2 className="text-3xl font-black font-mono">
                {formatNaira(stats.totalDebt)}
              </h2>
              <p className="text-xs text-orange-50 font-medium">
                Accumulated from <strong className="font-extrabold">{stats.debtorCount}</strong> deferred transactions by <strong className="font-extrabold">{stats.uniqueDebtorsCount}</strong> customers.
              </p>
            </div>

            <div className="bg-white/15 backdrop-blur-sm border border-white/10 p-3 rounded-xl text-xs space-y-1 w-full md:w-auto min-w-[200px]">
              <span className="text-[9px] text-orange-200 font-mono uppercase block font-bold tracking-wider">Quick Action Notice:</span>
              <p className="font-bold leading-normal">
                Employees should kindly request these settled amounts whenever these clients visit today.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3 text-xs">
          <div className="w-8 h-8 bg-emerald-100 text-[#00B87A] rounded-full flex items-center justify-center font-bold font-mono">
            ✓
          </div>
          <div className="space-y-0.5">
            <span className="font-extrabold text-emerald-800 block">All Commissions Settled!</span>
            <p className="text-emerald-600 font-semibold">
              Great job! There are currently no outstanding unpaid transaction charges recorded.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Period Breakdown Grid/Tabs */}
      {stats.debtorCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-neutral-400 uppercase font-mono tracking-wider">
              📊 Select Period to Filter List
            </span>
            {timePeriod !== 'all' && (
              <button
                type="button"
                onClick={() => setTimePeriod('all')}
                className="text-[10px] font-black text-amber-600 hover:text-amber-800 uppercase font-mono tracking-wider cursor-pointer flex items-center gap-1 active:scale-95 transition"
              >
                Reset Filter ×
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 select-none">
            {/* All Debts Card */}
            <button
              type="button"
              onClick={() => setTimePeriod('all')}
              className={`p-3 rounded-xl border text-left transition duration-200 relative overflow-hidden cursor-pointer active:scale-[0.98] ${
                timePeriod === 'all'
                  ? 'bg-neutral-900 border-neutral-900 text-white shadow-md'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider block opacity-85 truncate">All Debts</span>
                <span className={`text-[8.5px] font-black font-mono px-1.5 py-0.5 rounded-md ${timePeriod === 'all' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                  {stats.debtorCount}
                </span>
              </div>
              <div className="font-mono font-black text-sm mt-1.5 tracking-tight">
                {formatNaira(stats.totalDebt)}
              </div>
            </button>

            {/* Daily (Today) Card */}
            <button
              type="button"
              onClick={() => setTimePeriod('today')}
              className={`p-3 rounded-xl border text-left transition duration-200 relative overflow-hidden cursor-pointer active:scale-[0.98] ${
                timePeriod === 'today'
                  ? 'bg-[#00B87A] border-[#00B87A] text-white shadow-md ring-2 ring-emerald-500/20'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider block opacity-85 truncate">Daily (Today)</span>
                <span className={`text-[8.5px] font-black font-mono px-1.5 py-0.5 rounded-md ${timePeriod === 'today' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                  {timeStats.today.count}
                </span>
              </div>
              <div className="font-mono font-black text-sm mt-1.5 tracking-tight">
                {formatNaira(timeStats.today.sum)}
              </div>
            </button>

            {/* Weekly Card */}
            <button
              type="button"
              onClick={() => setTimePeriod('weekly')}
              className={`p-3 rounded-xl border text-left transition duration-200 relative overflow-hidden cursor-pointer active:scale-[0.98] ${
                timePeriod === 'weekly'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-md ring-2 ring-amber-500/20'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider block opacity-85 truncate">Weekly (7D)</span>
                <span className={`text-[8.5px] font-black font-mono px-1.5 py-0.5 rounded-md ${timePeriod === 'weekly' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                  {timeStats.weekly.count}
                </span>
              </div>
              <div className="font-mono font-black text-sm mt-1.5 tracking-tight">
                {formatNaira(timeStats.weekly.sum)}
              </div>
            </button>

            {/* Monthly Card */}
            <button
              type="button"
              onClick={() => setTimePeriod('monthly')}
              className={`p-3 rounded-xl border text-left transition duration-200 relative overflow-hidden cursor-pointer active:scale-[0.98] ${
                timePeriod === 'monthly'
                  ? 'bg-orange-500 border-orange-500 text-white shadow-md ring-2 ring-orange-500/20'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider block opacity-85 truncate">Monthly (30D)</span>
                <span className={`text-[8.5px] font-black font-mono px-1.5 py-0.5 rounded-md ${timePeriod === 'monthly' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                  {timeStats.monthly.count}
                </span>
              </div>
              <div className="font-mono font-black text-sm mt-1.5 tracking-tight">
                {formatNaira(timeStats.monthly.sum)}
              </div>
            </button>

            {/* Yearly Card */}
            <button
              type="button"
              onClick={() => setTimePeriod('yearly')}
              className={`p-3 rounded-xl border text-left transition duration-200 relative overflow-hidden cursor-pointer active:scale-[0.98] ${
                timePeriod === 'yearly'
                  ? 'bg-red-500 border-red-500 text-white shadow-md ring-2 ring-red-500/20'
                  : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider block opacity-85 truncate">Yearly (365D)</span>
                <span className={`text-[8.5px] font-black font-mono px-1.5 py-0.5 rounded-md ${timePeriod === 'yearly' ? 'bg-white/20 text-white' : 'bg-neutral-200 text-neutral-700'}`}>
                  {timeStats.yearly.count}
                </span>
              </div>
              <div className="font-mono font-black text-sm mt-1.5 tracking-tight">
                {formatNaira(timeStats.yearly.sum)}
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      {stats.debtorCount > 0 && (
        <div className="space-y-4">
          <div className="flex bg-neutral-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white text-neutral-850 shadow-sm font-black'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <FolderOpen className="w-4 h-4 text-amber-500" />
              <span>Gathered Accounts ({groupedAccounts.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('individual')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                viewMode === 'individual'
                  ? 'bg-white text-neutral-850 shadow-sm font-black'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <ListFilter className="w-4 h-4 text-neutral-500" />
              <span>Individual Debts ({filteredUnpaid.length})</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
            <span>
              Showing <strong className="font-extrabold text-neutral-800 font-mono">
                {viewMode === 'grouped' ? groupedAccounts.length : filteredUnpaid.length}
              </strong> {viewMode === 'grouped' ? 'gathered customer account' : 'transaction'}{viewMode === 'grouped' ? (groupedAccounts.length === 1 ? '' : 's') : (filteredUnpaid.length === 1 ? '' : 's')}{' '}
              {timePeriod !== 'all' ? (
                <span>for the <strong className="text-amber-600 capitalize">{timePeriod}</strong> period</span>
              ) : (
                'in total'
              )}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 focus:border-amber-500 hover:border-neutral-300 focus:outline-none rounded-xl pl-9 pr-3 py-2.5 text-xs text-neutral-850 font-bold transition-all"
              placeholder={viewMode === 'grouped' ? "Search folders by Customer Name or Phone..." : "Search outstanding debts by Customer Name, Phone, or Employee..."}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-red-500 hover:text-red-700 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {viewMode === 'grouped' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
              {groupedAccounts.map((account) => {
                const types = Array.from(new Set(account.transactions.map(t => t.type)));

                return (
                  <div 
                    key={account.customerName}
                    className="flex flex-col justify-between p-4 bg-neutral-50 hover:bg-amber-50/20 border border-neutral-200 hover:border-amber-300 rounded-2xl transition duration-200 shadow-sm gap-3 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-extrabold text-xs sm:text-sm text-neutral-850 block truncate">
                          {account.customerName}
                        </span>
                        {account.customerPhone && (
                          <span className="text-[10px] text-neutral-500 font-mono font-bold block mt-0.5">
                            📞 {account.customerPhone}
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className="bg-amber-100 text-amber-800 text-[8.5px] font-mono font-black uppercase px-2 py-0.5 rounded-md">
                            {account.transactions.length} Debts
                          </span>
                          {types.map(t => (
                            <span key={t} className="bg-neutral-200 text-neutral-700 text-[8.5px] font-bold px-1.5 py-0.5 rounded-md uppercase font-mono">
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-200/60 pt-3 mt-1">
                      <div>
                        <span className="text-[8.5px] text-neutral-400 font-mono block uppercase">Total Balance</span>
                        <span className="font-mono font-black text-amber-600 text-sm sm:text-base">
                          {formatNaira(account.totalDebt)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomerName(account.customerName);
                        }}
                        className="px-3.5 py-2 bg-neutral-900 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition active:scale-95 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Manage & Settle</span>
                        <ChevronRight className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {groupedAccounts.length === 0 && (
                <div className="col-span-full text-center py-8 text-xs text-neutral-400 font-bold bg-neutral-50 border border-dashed rounded-2xl">
                  No gathered customer accounts found.
                </div>
              )}
            </div>
          ) : (
            /* Unpaid Debt List Rows */
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {filteredUnpaid.map((tx) => {
                const txDate = new Date(tx.timestamp).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div 
                    key={tx.id} 
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 bg-neutral-50 hover:bg-amber-50/20 border border-neutral-200 rounded-2xl transition duration-150 gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center shrink-0">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-neutral-800">
                            {tx.customerName || 'Unknown Customer'}
                          </span>
                          {tx.customerPhone && (
                            <span className="text-[10px] text-neutral-500 font-mono font-bold">
                              📞 {tx.customerPhone}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] uppercase font-bold bg-amber-100 text-amber-800 font-mono">
                            {tx.type} ({tx.provider})
                          </span>
                          {tx.chargesStatus === 'PartiallyPaid' ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] uppercase font-black bg-orange-100 text-orange-700 font-mono border border-orange-200">
                              ⏳ Partially Paid: {formatNaira(tx.chargesPaidAmount || 0)} Paid
                            </span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded-full text-[8px] uppercase font-black font-mono border ${((new Date().getTime() - new Date(tx.timestamp).getTime()) > 172800000) ? 'bg-red-600 text-white animate-pulse' : 'bg-red-100 text-red-700'} border-red-200`}>
                              {((new Date().getTime() - new Date(tx.timestamp).getTime()) > 172800000) ? '🚨 CRITICAL' : '🛑 No Payment Received'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-1 flex-wrap">
                          <span>TXID: <strong className="text-neutral-500 font-black">{tx.id}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {txDate}</span>
                          <span>•</span>
                          <span className="bg-neutral-200/50 text-neutral-600 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                            by Employee {tx.employeeName}
                          </span>
                        </div>
                        
                        {tx.notes && (
                          <p className="text-[10px] text-neutral-500 italic mt-1 bg-white border border-neutral-100 p-1 px-2 rounded-lg truncate max-w-xs">
                            📝 {tx.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between w-full sm:w-auto shrink-0 gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-200">
                      <div className="text-right">
                        <span className="text-[9px] text-neutral-400 font-mono block uppercase">Deferred Fee</span>
                        <span className="font-mono font-black text-amber-600 text-sm">
                          {formatNaira(tx.unpaidFeeAmount ?? tx.customerFee)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Remind Whatsapp/Sms */}
                        <button
                          type="button"
                          onClick={() => handleCopyReminder(tx)}
                          className={`p-1.5 rounded-lg border transition flex items-center justify-center gap-1 text-[11px] font-bold ${
                            copiedId === tx.id
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                              : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-500 hover:text-neutral-700'
                          }`}
                          title="Copy a beautiful, friendly reminder message to clipboard"
                        >
                          {copiedId === tx.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Copied Reminder!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Remind Copy</span>
                            </>
                          )}
                        </button>

                        {/* Settle Debt Button */}
                        <button
                          type="button"
                          onClick={() => handleSettleDebt(tx)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold transition active:scale-95 shadow-sm flex items-center gap-1 cursor-pointer"
                          title="Mark charges as paid now"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Settle Fee</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredUnpaid.length === 0 && (
                <div className="text-center py-6 text-xs text-neutral-400 font-bold bg-neutral-50 border border-dashed rounded-2xl">
                  No unpaid charges match your search query.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Employee Settle Charges Overlay Modal */}
      {settlingTx && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 relative border border-neutral-100 animate-in slide-in-from-bottom-4 duration-250">
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
            <div className="space-y-4">
              {/* Prior Payment History of this transaction if any exists */}
              {settlingTx.chargePayments && settlingTx.chargePayments.length > 0 && (
                <div className="bg-neutral-50/50 border border-neutral-150 p-3 rounded-2xl space-y-2">
                  <span className="text-[9px] text-neutral-400 font-mono font-bold uppercase tracking-wider block">
                    📊 Prior Partial Payments Logs
                  </span>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {settlingTx.chargePayments.map((pay, pIdx) => (
                      <div key={pay.id || pIdx} className="flex justify-between items-center bg-white p-2 rounded-xl border border-neutral-150 text-xs">
                        <div className="flex flex-col">
                          <span className="font-extrabold text-neutral-800">{formatNaira(pay.amount)}</span>
                          <span className="text-[9px] text-neutral-400 font-mono">
                            {new Date(pay.date).toLocaleString()} ({pay.collectorName})
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-medium italic bg-neutral-100 px-2 py-0.5 rounded-lg truncate max-w-[130px]">
                          {pay.note || 'Partial pay'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-medium font-mono text-right">
                    Total Paid So Far: <strong className="text-emerald-600 font-black">{formatNaira(settlingTx.chargesPaidAmount || 0)}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Total Adjusted Fee Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="settle-fee-input" className="block text-xs font-bold uppercase tracking-wider text-neutral-450 font-mono">
                      Original Total Fee (₦)
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">₦</span>
                    <input
                      id="settle-fee-input"
                      type="number"
                      value={settleFeeInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettleFeeInput(val);
                        setSettleAmountPaid(val);
                      }}
                      className="w-full bg-neutral-100 border border-neutral-200 rounded-xl pl-7 pr-3 py-2 text-neutral-850 font-mono text-xs font-bold focus:outline-none"
                      placeholder="e.g. 200"
                    />
                  </div>
                </div>

                {/* Amount Paid Today */}
                <div className="space-y-1.5">
                  <label htmlFor="settle-amount-paid-input" className="block text-xs font-bold uppercase tracking-wider text-neutral-800 font-mono">
                    💵 Amount Paid Today (₦)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-mono text-xs">₦</span>
                    <input
                      id="settle-amount-paid-input"
                      type="number"
                      value={settleAmountPaid}
                      onChange={(e) => setSettleAmountPaid(e.target.value)}
                      className="w-full bg-white border border-[#00B87A] focus:border-emerald-600 rounded-xl pl-7 pr-3 py-2 text-neutral-850 font-mono text-xs font-black focus:outline-none"
                      placeholder="Enter amount customer is paying now"
                      max={parseFloat(settleFeeInput) || undefined}
                    />
                  </div>
                </div>
              </div>

              {/* Outstanding payment calculations preview badge */}
              {(() => {
                const totalTarget = parseFloat(settleFeeInput) || 0;
                const paidAmt = parseFloat(settleAmountPaid) || 0;
                const prevPaid = settlingTx.chargesPaidAmount || 0;
                const finalOutstanding = Math.max(0, totalTarget - prevPaid - paidAmt);
                const isCompleted = finalOutstanding <= 0.01;

                return (
                  <div className={`p-2.5 rounded-xl border text-xs flex justify-between items-center font-bold ${
                    isCompleted
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <span>Payment Outcome:</span>
                    <span className="font-mono text-[11px] font-extrabold uppercase">
                      {isCompleted ? (
                        '🎉 Charges Fully Completed (No Remaining)'
                      ) : (
                        `🛑 Charges Incomplete: Remaining ${formatNaira(finalOutstanding)}`
                      )}
                    </span>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Custom Payment Date */}
                <div className="space-y-1.5">
                  <label htmlFor="settle-payment-date" className="block text-xs font-bold uppercase tracking-wider text-neutral-450 font-mono">
                    📅 Date & Time Paid (Exactly)
                  </label>
                  <input
                    id="settle-payment-date"
                    type="datetime-local"
                    value={settlePaymentDate}
                    onChange={(e) => setSettlePaymentDate(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-mono text-xs font-medium focus:outline-none"
                  />
                </div>

                {/* Custom Payment Notes */}
                <div className="space-y-1.5">
                  <label htmlFor="settle-payment-note" className="block text-xs font-bold uppercase tracking-wider text-neutral-450 font-mono">
                    📝 Payment Note
                  </label>
                  <input
                    id="settle-payment-note"
                    type="text"
                    value={settlePaymentNote}
                    onChange={(e) => setSettlePaymentNote(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-800 text-xs font-medium focus:outline-none"
                    placeholder="e.g. Paid cash balance, or Part payment"
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
              <div className="space-y-1.5 text-xs text-neutral-600 font-medium">
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
                  const adjustedTotalTarget = parseFloat(settleFeeInput) || 0;
                  const currentPayment = parseFloat(settleAmountPaid) || 0;
                  
                  const originalFee = settlingTx.originalFeeAmount !== undefined ? settlingTx.originalFeeAmount : (settlingTx.unpaidFeeAmount !== undefined ? settlingTx.unpaidFeeAmount : settlingTx.customerFee);
                  const prevPaid = settlingTx.chargesPaidAmount || 0;
                  const totalPaidSoFar = prevPaid + currentPayment;
                  
                  const remainingOutstanding = Math.max(0, adjustedTotalTarget - totalPaidSoFar);
                  const isFullyCompleted = remainingOutstanding <= 0.01;

                  const newPaymentRecord = {
                    id: generateId(),
                    date: settlePaymentDate ? new Date(settlePaymentDate).toISOString() : new Date().toISOString(),
                    amount: currentPayment,
                    collectorName: currentUser.name,
                    note: settlePaymentNote.trim() || 'Partial payment'
                  };

                  const updatedPayments = [...(settlingTx.chargePayments || []), newPaymentRecord];

                  const finalCustomerFee = totalPaidSoFar;
                  const updatedProfit = finalCustomerFee - settlingTx.terminalFee - (settlingTx.cbnCharge || 0);
                  const updatedTotalCustomerCharged = settleFeeMethod === 'CardDebit' ? (settlingTx.amount + finalCustomerFee) : settlingTx.amount;

                  onUpdateTransaction({
                    ...settlingTx,
                    customerFee: finalCustomerFee,
                    profit: updatedProfit,
                    totalCustomerCharged: updatedTotalCustomerCharged,
                    feeMethod: settleFeeMethod,
                    chargesStatus: isFullyCompleted ? 'Paid' : 'PartiallyPaid',
                    unpaidFeeAmount: isFullyCompleted ? undefined : remainingOutstanding,
                    originalFeeAmount: originalFee,
                    chargesPaidAmount: totalPaidSoFar,
                    chargePayments: updatedPayments
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

      {/* Grouped Account Portfolio Settle Modal */}
      {editingCustomerName && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-6 relative border border-neutral-100 animate-in slide-in-from-bottom-4 duration-250">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setEditingCustomerName(null);
                setSkippedTxIds(new Set());
              }}
              className="absolute right-4.5 top-4.5 p-1.5 rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="space-y-1 pr-6">
              <span className="text-[10px] bg-amber-100 text-amber-800 font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                Gathered Customer Ledger
              </span>
              <h3 className="text-xl font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5 mt-1">
                Account: {editingCustomerName}
              </h3>
              <p className="text-xs text-neutral-500">
                Manage, edit, or add withdrawal, transfer, and deposit transactions to gather his whole week or monthly activities, then settle them altogether.
              </p>
            </div>

            {/* Quick Bulk Adjustment Fee */}
            <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-2xl space-y-2">
              <span className="text-[10px] text-neutral-500 font-mono font-bold uppercase tracking-wider block">
                ⚡ Quick Bulk Fee Adjustment
              </span>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">₦</span>
                  <input
                    type="number"
                    value={bulkFeeInput}
                    onChange={(e) => setBulkFeeInput(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-lg pl-6 pr-3 py-1.5 text-xs text-neutral-850 font-mono focus:outline-none"
                    placeholder="E.g. 200"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyBulkFeeToPortfolio}
                  className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-900 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Apply to All
                </button>
              </div>
            </div>

            {/* Expandable Add New Transaction Form inside Account Portfolio */}
            <div className="border border-neutral-200 rounded-2xl overflow-hidden bg-neutral-50/40">
              <button
                type="button"
                onClick={() => setShowAddTxForm(!showAddTxForm)}
                className="w-full px-4 py-3 bg-neutral-50 border-b border-neutral-200/60 flex justify-between items-center text-xs font-bold text-neutral-800 hover:bg-neutral-100 transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-emerald-500 stroke-[3]" />
                  Add New Deferred Transaction to this Account
                </span>
                <span className="text-[10px] font-mono text-neutral-400 font-medium">
                  {showAddTxForm ? 'Collapse [−]' : 'Expand [+]'}
                </span>
              </button>

              {showAddTxForm && (
                <form onSubmit={handleAddTransactionToGroup} className="p-4 space-y-3.5 bg-white border-t border-neutral-100 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Type Selector */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Type</label>
                      <select
                        value={newTxType}
                        onChange={(e) => setNewTxType(e.target.value as any)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value="Withdrawal">Withdrawal</option>
                        <option value="Transfer">Transfer</option>
                        <option value="Deposit">Deposit</option>
                      </select>
                    </div>

                    {/* Provider Selector */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Terminal Provider</label>
                      <select
                        value={newTxProvider}
                        onChange={(e) => setNewTxProvider(e.target.value as any)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value="OPay">OPay</option>
                        <option value="Moniepoint">Moniepoint</option>
                        <option value="PalmPay">PalmPay</option>
                      </select>
                    </div>

                    {/* Fee Method */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Fee Method</label>
                      <select
                        value={newTxFeeMethod}
                        onChange={(e) => setNewTxFeeMethod(e.target.value as any)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                      >
                        <option value="Cash">Cash Collection</option>
                        <option value="CardDebit">Card Add-on</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Amount */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Transaction Amount (₦)</label>
                      <input
                        type="number"
                        value={newTxAmount}
                        onChange={(e) => setNewTxAmount(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                        placeholder="10000"
                        required
                      />
                    </div>

                    {/* Deferred Fee */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Unpaid Fee (₦)</label>
                      <input
                        type="number"
                        value={newTxFee}
                        onChange={(e) => setNewTxFee(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                        placeholder="200"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Internal Notes</label>
                    <input
                      type="text"
                      value={newTxNotes}
                      onChange={(e) => setNewTxNotes(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-amber-500"
                      placeholder="e.g. customer skipped daily charges, will pay weekend"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-neutral-100 mt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddTxForm(false)}
                      className="px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-lg text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      ➕ Record & Add
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* List of Portfolio Transactions */}
            <div className="space-y-3">
              <span className="text-[10px] text-neutral-400 font-mono font-black uppercase tracking-wider block">
                Deferred Transactions List ({portfolioTxs.length})
              </span>
              
              <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                {portfolioTxs.map((tx, index) => {
                  const isSkipped = skippedTxIds.has(tx.id);
                  const txDate = new Date(tx.timestamp).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div
                      key={tx.id}
                      className={`p-3 bg-neutral-50 border rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition duration-150 ${
                        isSkipped
                          ? 'opacity-40 bg-neutral-100 border-neutral-200 line-through'
                          : 'border-neutral-200/80 hover:border-amber-200'
                      }`}
                    >
                      {/* Left: Metadata */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-black text-neutral-700 bg-neutral-200 px-1.5 py-0.5 rounded-md uppercase">
                            {tx.type}
                          </span>
                          <span className="text-xs font-extrabold text-neutral-800">
                            {formatNaira(tx.amount)}
                          </span>
                          <span className="text-[9.5px] font-mono text-neutral-400 font-bold">
                            ({tx.provider})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-1 flex-wrap">
                          <span>{txDate}</span>
                          <span>•</span>
                          <span>by {tx.employeeName}</span>
                        </div>
                        {tx.notes && (
                          <span className="text-[9px] text-neutral-500 italic block truncate mt-0.5">
                            📝 {tx.notes}
                          </span>
                        )}
                        {tx.chargesStatus === 'PartiallyPaid' && (
                          <span className="text-[9px] text-orange-600 font-mono font-bold block mt-1 animate-pulse">
                            ⏳ Partially Paid: {formatNaira(tx.chargesPaidAmount || 0)} Paid so far ({formatNaira(tx.unpaidFeeAmount ?? 0)} remaining)
                          </span>
                        )}
                      </div>

                      {/* Right: Interactive Controls */}
                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-200/50">
                        {/* Skip / Include toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            setSkippedTxIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(tx.id)) {
                                next.delete(tx.id);
                              } else {
                                next.add(tx.id);
                              }
                              return next;
                            });
                          }}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                            isSkipped
                              ? 'bg-amber-100 border-amber-200 text-amber-800'
                              : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-400'
                          }`}
                        >
                          {isSkipped ? 'Include' : 'Skip'}
                        </button>

                        {!isSkipped && (
                          <div className="flex items-center gap-1.5">
                            {/* Adjusted Fee Input */}
                            <div className="relative w-20">
                              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9.5px] text-neutral-400 font-mono">₦</span>
                              <input
                                type="number"
                                value={tx.unpaidFeeAmount ?? 0}
                                onChange={(e) => {
                                  const newVal = parseFloat(e.target.value) || 0;
                                  setPortfolioTxs((prev) =>
                                    prev.map((p, idx) => idx === index ? { ...p, unpaidFeeAmount: newVal } : p)
                                  );
                                }}
                                className="w-full bg-white border border-neutral-200 rounded-lg pl-4.5 pr-1 py-1 text-[11.5px] font-mono font-bold text-neutral-850 focus:outline-none focus:border-amber-500"
                                placeholder="Fee"
                              />
                            </div>

                            {/* Method Toggle Selector */}
                            <button
                              type="button"
                              onClick={() => {
                                const nextMethod = tx.feeMethod === 'CardDebit' ? 'Cash' : 'CardDebit';
                                setPortfolioTxs((prev) =>
                                  prev.map((p, idx) => idx === index ? { ...p, feeMethod: nextMethod } : p)
                                );
                              }}
                              className="p-1 px-1.5 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-lg text-[9.5px] font-bold font-mono text-neutral-600 transition uppercase cursor-pointer"
                              title="Toggle charge collection method between Cash and Card add-on"
                            >
                              {tx.feeMethod === 'CardDebit' ? '💳 Card' : '💵 Cash'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calculations and Live Summary Impact Card */}
            {(() => {
              const activeTxs = portfolioTxs.filter(tx => !skippedTxIds.has(tx.id));
              const grossFees = activeTxs.reduce((sum, tx) => sum + (tx.unpaidFeeAmount ?? 0), 0);
              const totalTerminalFees = activeTxs.reduce((sum, tx) => sum + tx.terminalFee, 0);
              const totalCbnCharges = activeTxs.reduce((sum, tx) => sum + (tx.cbnCharge || 0), 0);
              const netProfit = grossFees - totalTerminalFees - totalCbnCharges;

              return (
                <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-emerald-800 font-mono font-black uppercase tracking-wider block">
                      🔴 Cumulative Settle Financial Impact
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-black px-2 py-0.5 rounded-full">
                      {activeTxs.length} of {portfolioTxs.length} Active
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-neutral-600 font-medium">
                    <div className="flex justify-between">
                      <span>Gross Customer Fees to Collect:</span>
                      <span className="font-mono font-bold text-neutral-850">{formatNaira(grossFees)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Terminal Base Cost:</span>
                      <span className="font-mono text-neutral-400">-{formatNaira(totalTerminalFees)}</span>
                    </div>
                    {totalCbnCharges > 0 && (
                      <div className="flex justify-between">
                        <span>Total CBN Duty Charges:</span>
                        <span className="font-mono text-neutral-400">-{formatNaira(totalCbnCharges)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-neutral-200/50 pt-2 text-sm font-black">
                      <span className="text-emerald-850">Net Retained Commission Profit:</span>
                      <span className="font-mono text-emerald-700">
                        {formatNaira(netProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Confirm Actions */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditingCustomerName(null);
                  setSkippedTxIds(new Set());
                }}
                className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold rounded-xl text-xs transition cursor-pointer font-mono uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSettlePortfolio}
                className="w-full py-2.5 px-4 bg-[#00B87A] hover:bg-emerald-600 text-white font-black rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 font-mono uppercase shadow-md active:scale-95"
              >
                ✓ Settle Active Charges
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
