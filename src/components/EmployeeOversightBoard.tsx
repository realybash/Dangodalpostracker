/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { User, Transaction, PosTerminal, AppSettings, BorrowKeepTransaction } from '../types';
import { formatNaira, getProviderTransactionNumber } from '../utils';
import { PosReconciliationTool } from './PosReconciliationTool';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { 
  Users, 
  Activity, 
  ShieldCheck, 
  Search, 
  Filter, 
  ArrowUpRight, 
  Eye,
  Zap,
  CreditCard,
  MapPin,
  TrendingUp,
  Award,
  Lock,
  Unlock,
  AlertCircle,
  Wallet,
  Clock,
  ArrowDownLeft,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface EmployeeOversightBoardProps {
  currentUser: User;
  registeredUsers: User[];
  transactions: Transaction[];
  posTerminals: PosTerminal[];
  settings?: AppSettings;
  activeTimeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  selectedEmployeeFilter: string;
  onSetEmployeeFilter: (id: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onViewReceipt?: (tx: Transaction) => void;
  onAddTransaction: (tx: Transaction) => Promise<void>;
  onSwitchToCashier?: (userId: string) => void;
  onEditEmployee?: (user: User) => void;
  syncOwnerId?: string | null;
}

export function EmployeeOversightBoard({
  currentUser,
  registeredUsers,
  transactions,
  posTerminals = [],
  settings,
  activeTimeframe,
  selectedEmployeeFilter,
  onSetEmployeeFilter,
  onViewReceipt,
  onAddTransaction,
  onSwitchToCashier,
  onEditEmployee,
  syncOwnerId
}: EmployeeOversightBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all');
  const [debtSearchQuery, setDebtSearchQuery] = useState('');
  const [borrowKeepTransactions, setBorrowKeepTransactions] = useState<BorrowKeepTransaction[]>([]);
  const [expandedCashierId, setExpandedCashierId] = useState<string | null>(null);
  const [debtSubTab, setDebtSubTab] = useState<'outstanding' | 'all'>('outstanding');

  useEffect(() => {
    const isCloudMode = !!syncOwnerId;
    if (isCloudMode && syncOwnerId) {
      const q = query(collection(db, 'borrowKeep'), where('ownerId', '==', syncOwnerId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BorrowKeepTransaction));
        setBorrowKeepTransactions(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'borrowKeep');
      });
      return () => unsubscribe();
    } else {
      const saved = localStorage.getItem('OPay_BorrowKeep_Transactions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as BorrowKeepTransaction[];
          setBorrowKeepTransactions(parsed);
        } catch (err) {
          console.warn("EmployeeOversightBoard: local state recovery failed", err);
          setBorrowKeepTransactions([]);
        }
      } else {
        setBorrowKeepTransactions([]);
      }
    }
  }, [syncOwnerId]);

  // Filter only employees (role === 'Employee')
  const employees = useMemo(() => {
    return registeredUsers.filter((u) => u.role === 'Employee');
  }, [registeredUsers]);

  // Compute total volume flow across all employees combined to calculate contribution
  const totalEmployeesTimeframeVolume = useMemo(() => {
    const now = new Date();
    return transactions
      .filter((tx) => {
        // Must be an employee's transaction
        const isEmployeeTx = employees.some(e => e.id === tx.employeeId);
        if (!isEmployeeTx) return false;

        const txDate = new Date(tx.timestamp);
        if (activeTimeframe === 'Daily') {
          return txDate.toDateString() === now.toDateString();
        }
        if (activeTimeframe === 'Weekly') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);
          return txDate >= oneWeekAgo;
        }
        if (activeTimeframe === 'Monthly') {
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        }
        // Yearly
        return txDate.getFullYear() === now.getFullYear();
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions, employees, activeTimeframe]);

  // Compute stats for each employee
  const employeeStats = useMemo(() => {
    return employees.map((employee) => {
      // Filter transactions for this employee
      const employeeTxs = transactions.filter((tx) => tx.employeeId === employee.id);

      // Filter by timeframe
      const now = new Date();
      const timeframeTxs = employeeTxs.filter((tx) => {
        const txDate = new Date(tx.timestamp);
        if (activeTimeframe === 'Daily') {
          return txDate.toDateString() === now.toDateString();
        }
        if (activeTimeframe === 'Weekly') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);
          return txDate >= oneWeekAgo;
        }
        if (activeTimeframe === 'Monthly') {
          return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        }
        // Yearly
        return txDate.getFullYear() === now.getFullYear();
      });

      const volume = timeframeTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const count = timeframeTxs.length;
      const grossFees = timeframeTxs.reduce((sum, tx) => sum + tx.customerFee, 0);
      const terminalFees = timeframeTxs.reduce((sum, tx) => sum + tx.terminalFee, 0);
      const cbnCharges = timeframeTxs.reduce((sum, tx) => sum + (tx.cbnCharge || 0), 0);
      // Use stored profit to respect "never decrease" business rule
      const profit = timeframeTxs.reduce((sum, tx) => sum + (tx.profit || 0), 0);

      const unpaidFees = employeeTxs
        .filter((tx) => tx.chargesStatus === 'Unpaid' && (tx.status || 'Success') !== 'Failed')
        .reduce((sum, tx) => sum + (tx.unpaidFeeAmount ?? tx.customerFee ?? 0), 0);

      // Last 3 transactions
      const recentTxs = [...employeeTxs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 3);

      // Map terminal details
      const mappedTerminal = posTerminals.find(
        (t) => t.employeeId === employee.id ||
               (t.cashierName && t.cashierName.toLowerCase().trim() === employee.name.toLowerCase().trim())
      );

      const contributionPercent = totalEmployeesTimeframeVolume > 0 
        ? (volume / totalEmployeesTimeframeVolume) * 100 
        : 0;

      return {
        employee,
        volume,
        count,
        profit,
        unpaidFees,
        recentTxs,
        mappedTerminal,
        contributionPercent,
        totalTxsAllTime: employeeTxs.length
      };
    });
  }, [employees, transactions, activeTimeframe, posTerminals, totalEmployeesTimeframeVolume]);

  // Filter based on search query and tab
  const filteredEmployeeStats = useMemo(() => {
    return employeeStats.filter((item) => {
      const nameMatches = item.employee.name.toLowerCase().includes(searchQuery.toLowerCase());
      const emailMatches = item.employee.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false;
      const matchesSearch = nameMatches || emailMatches;

      if (activeTab === 'active') {
        return matchesSearch && item.employee.activated !== false;
      }
      if (activeTab === 'inactive') {
        return matchesSearch && item.employee.activated === false;
      }
      return matchesSearch;
    });
  }, [employeeStats, searchQuery, activeTab]);

  // Unified Live Feed: Latest 5 transactions across ALL employees
  const unifiedLiveFeed = useMemo(() => {
    return [...transactions]
      .filter((tx) => tx.employeeId !== currentUser.id) // Only show employee transactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [transactions, currentUser]);

  const totalEmployeeVolume = useMemo(() => {
    return employeeStats.reduce((sum, item) => sum + item.volume, 0);
  }, [employeeStats]);

  const totalEmployeeProfit = useMemo(() => {
    return employeeStats.reduce((sum, item) => sum + item.profit, 0);
  }, [employeeStats]);

  const cashierDebts = useMemo(() => {
    const cashierMap: Record<string, {
      employeeId: string;
      employeeName: string;
      totalLoansGiven: number;
      totalLoansRepaid: number;
      totalMoneyKept: number;
      totalMoneyReturned: number;
      outstandingLoan: number;
      outstandingKept: number;
      transactions: BorrowKeepTransaction[];
    }> = {};

    employees.forEach(emp => {
      cashierMap[emp.id] = {
        employeeId: emp.id,
        employeeName: emp.name,
        totalLoansGiven: 0,
        totalLoansRepaid: 0,
        totalMoneyKept: 0,
        totalMoneyReturned: 0,
        outstandingLoan: 0,
        outstandingKept: 0,
        transactions: []
      };
    });

    borrowKeepTransactions.forEach(t => {
      const empId = t.employeeId || 'unknown';
      const empName = t.employeeName || 'Unknown Cashier';
      
      if (!cashierMap[empId]) {
        cashierMap[empId] = {
          employeeId: empId,
          employeeName: empName,
          totalLoansGiven: 0,
          totalLoansRepaid: 0,
          totalMoneyKept: 0,
          totalMoneyReturned: 0,
          outstandingLoan: 0,
          outstandingKept: 0,
          transactions: []
        };
      }

      cashierMap[empId].transactions.push(t);

      // Skip rejected or pending items for active liability calculations
      if (t.approvalStatus === 'rejected') return;

      if (t.type === 'loan_given') {
        cashierMap[empId].totalLoansGiven += t.amount;
        const outstanding = t.amount - (t.repaidAmount || 0);
        if (t.status !== 'settled' && outstanding > 0) {
          cashierMap[empId].outstandingLoan += outstanding;
        }
      } else if (t.type === 'loan_repaid') {
        if (t.approvalStatus !== 'pending') {
          cashierMap[empId].totalLoansRepaid += t.amount;
        }
      } else if (t.type === 'money_kept') {
        cashierMap[empId].totalMoneyKept += t.amount;
        const outstanding = t.amount - (t.repaidAmount || 0);
        if (t.status !== 'settled' && outstanding > 0) {
          cashierMap[empId].outstandingKept += outstanding;
        }
      } else if (t.type === 'money_returned') {
        if (t.approvalStatus !== 'pending') {
          cashierMap[empId].totalMoneyReturned += t.amount;
        }
      }
    });

    Object.values(cashierMap).forEach(c => {
      c.transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    return Object.values(cashierMap);
  }, [employees, borrowKeepTransactions]);

  const activeOversightDebts = useMemo(() => {
    return borrowKeepTransactions.filter(tx => {
      if (tx.approvalStatus === 'rejected') return false;
      if (tx.type === 'loan_given') {
        const repaid = tx.repaidAmount || 0;
        return repaid < tx.amount && tx.status !== 'settled';
      }
      if (tx.type === 'money_kept') {
        const returned = tx.repaidAmount || 0;
        return returned < tx.amount && tx.status !== 'settled';
      }
      return false;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [borrowKeepTransactions]);

  const filteredOversightDebts = useMemo(() => {
    return activeOversightDebts.filter(tx => {
      const q = debtSearchQuery.toLowerCase().trim();
      if (!q) return true;
      const customerMatches = tx.name.toLowerCase().includes(q);
      const cashierMatches = (tx.employeeName || '').toLowerCase().includes(q);
      const notesMatches = (tx.notes || '').toLowerCase().includes(q);
      return customerMatches || cashierMatches || notesMatches;
    });
  }, [activeOversightDebts, debtSearchQuery]);

  const totalOutstandingLoans = useMemo(() => {
    return activeOversightDebts
      .filter(tx => tx.type === 'loan_given')
      .reduce((sum, tx) => sum + (tx.amount - (tx.repaidAmount || 0)), 0);
  }, [activeOversightDebts]);

  const totalOutstandingKept = useMemo(() => {
    return activeOversightDebts
      .filter(tx => tx.type === 'money_kept')
      .reduce((sum, tx) => sum + (tx.amount - (tx.repaidAmount || 0)), 0);
  }, [activeOversightDebts]);

  const pendingApprovals = useMemo(() => {
    return borrowKeepTransactions.filter(tx => tx.approvalStatus === 'pending');
  }, [borrowKeepTransactions]);

  const handleApproveTransaction = async (tx: BorrowKeepTransaction) => {
    const isCloudMode = !!syncOwnerId;
    if (isCloudMode) {
      try {
        // 1. Update status to approved
        await setDoc(doc(db, 'borrowKeep', tx.id), {
          ...tx,
          approvalStatus: 'approved',
          approvedBy: currentUser.name,
          approvedAt: new Date().toISOString()
        }, { merge: true });

        // 2. Update the original linked document
        if (tx.linkedTransactionId) {
          const originalDoc = borrowKeepTransactions.find(t => t.id === tx.linkedTransactionId);
          if (originalDoc) {
            const prevRepaid = originalDoc.repaidAmount || 0;
            const nextRepaid = prevRepaid + tx.amount;
            const isSettled = nextRepaid >= originalDoc.amount;
            await setDoc(doc(db, 'borrowKeep', tx.linkedTransactionId), {
              ...originalDoc,
              repaidAmount: nextRepaid,
              status: isSettled ? 'settled' : 'partial'
            }, { merge: true });
          }
        }
        alert(`🎉 Repayment for ${tx.name} approved successfully!`);
      } catch (error) {
        console.error("Error approving transaction in Firestore:", error);
        alert("Failed to approve transaction.");
      }
    } else {
      const saved = localStorage.getItem('OPay_BorrowKeep_Transactions');
      if (saved) {
        try {
          let list = JSON.parse(saved) as BorrowKeepTransaction[];
          list = list.map(item => {
            if (item.id === tx.id) {
              return {
                ...item,
                approvalStatus: 'approved',
                approvedBy: currentUser.name,
                approvedAt: new Date().toISOString()
              };
            }
            return item;
          });

          if (tx.linkedTransactionId) {
            list = list.map(item => {
              if (item.id === tx.linkedTransactionId) {
                const prevRepaid = item.repaidAmount || 0;
                const nextRepaid = prevRepaid + tx.amount;
                const isSettled = nextRepaid >= item.amount;
                return {
                  ...item,
                  repaidAmount: nextRepaid,
                  status: isSettled ? 'settled' : 'partial' as const
                };
              }
              return item;
            });
          }

          localStorage.setItem('OPay_BorrowKeep_Transactions', JSON.stringify(list));
          setBorrowKeepTransactions(list);
          alert(`🎉 Repayment for ${tx.name} approved successfully locally!`);
        } catch (err) {
          console.error("Error saving local approval:", err);
        }
      }
    }
  };

  const handleRejectTransaction = async (tx: BorrowKeepTransaction) => {
    const isCloudMode = !!syncOwnerId;
    const confirmReject = window.confirm(`Are you sure you want to REJECT this repayment of ${formatNaira(tx.amount)} from ${tx.name}?`);
    if (!confirmReject) return;

    if (isCloudMode) {
      try {
        await setDoc(doc(db, 'borrowKeep', tx.id), {
          ...tx,
          approvalStatus: 'rejected',
          approvedBy: currentUser.name,
          approvedAt: new Date().toISOString()
        }, { merge: true });
        alert(`❌ Repayment rejected and flagged.`);
      } catch (error) {
        console.error("Error rejecting transaction:", error);
      }
    } else {
      const saved = localStorage.getItem('OPay_BorrowKeep_Transactions');
      if (saved) {
        try {
          let list = JSON.parse(saved) as BorrowKeepTransaction[];
          list = list.map(item => {
            if (item.id === tx.id) {
              return {
                ...item,
                approvalStatus: 'rejected',
                approvedBy: currentUser.name,
                approvedAt: new Date().toISOString()
              };
            }
            return item;
          });
          localStorage.setItem('OPay_BorrowKeep_Transactions', JSON.stringify(list));
          setBorrowKeepTransactions(list);
          alert(`❌ Repayment rejected locally.`);
        } catch (err) {
          console.error("Error saving local rejection:", err);
        }
      }
    }
  };

  if (currentUser.role !== 'Manager') {
    return null;
  }

  return (
    <div id="employee-oversight-section" className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6">
      
      {/* SECTION HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neutral-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-[10px] bg-emerald-50 border border-emerald-200 text-[#00B87A] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A] animate-ping" />
              100% ROOT OVERSIGHT DIRECTORY
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-neutral-100 text-neutral-600 font-mono font-bold px-2.5 py-1 rounded-full border border-neutral-200">
              <ShieldCheck className="w-3.5 h-3.5 text-[#00B87A]" />
              Superuser Root Live Access
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-neutral-800 tracking-tight flex items-center gap-2 mt-1">
            <Users className="w-5 h-5 text-[#00B87A]" />
            Staff & Cashier real-time Monitoring Console
          </h3>
          <p className="text-xs text-neutral-500 font-medium">
            You have Hundreds Percentage (100%) absolute visibility of all cashier transactions, shifts, operator keys, and terminal locations without needing to log in to separate accounts.
          </p>
        </div>

        {/* Oversight Overview Stats */}
        <div className="flex gap-4 p-3 bg-neutral-50 border border-neutral-200 rounded-2xl shrink-0 w-full md:w-auto">
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono font-extrabold text-neutral-400 uppercase tracking-wider block">
              Staff Volume ({activeTimeframe})
            </span>
            <span className="text-sm font-black font-mono text-neutral-800">
              {formatNaira(totalEmployeeVolume)}
            </span>
          </div>
          <div className="w-[1px] bg-neutral-200 self-stretch" />
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono font-extrabold text-neutral-400 uppercase tracking-wider block">
              Staff Net Retained Commission
            </span>
            <span className="text-sm font-black font-mono text-emerald-600">
              {formatNaira(totalEmployeeProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* POS STATEMENT OCR RECONCILIATION & DISCREPANCY AUDITOR */}
      <PosReconciliationTool 
        transactions={transactions}
        registeredUsers={registeredUsers}
        settings={settings}
        onAddTransaction={onAddTransaction}
        activeTimeframe={activeTimeframe}
      />

      {/* SEARCH AND QUICK TABS */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-neutral-50 p-2.5 rounded-2xl">
        <div className="flex bg-white border border-neutral-200 p-1 rounded-xl w-full sm:w-auto">
          {(['all', 'active', 'inactive'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-[11px] font-extrabold rounded-lg transition-all uppercase font-mono cursor-pointer ${
                activeTab === tab
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {tab} ({tab === 'all' ? employees.length : tab === 'active' ? employees.filter(c => c.activated !== false).length : employees.filter(c => c.activated === false).length})
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="Search operator name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-1.5 text-xs text-neutral-850 font-medium placeholder:text-neutral-400 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A]"
          />
        </div>
      </div>

      {/* CONSOLIDATED CASHIER DEBTS SECTION */}
      <div id="consolidated-cashier-debts-ledger" className="border border-neutral-200 bg-white rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-neutral-100">
          <div className="space-y-0.5">
            <h4 className="text-sm font-black text-neutral-800 tracking-tight flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500" />
              Consolidated Cashier Debts & Held Balances
            </h4>
            <p className="text-[11px] text-neutral-500 font-medium">
              A single unified ledger showing outstanding credit and cashier-held balances for every active operator.
            </p>
          </div>
          <div className="bg-neutral-50 border border-neutral-150 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold text-neutral-600">
            Total Liability: <span className="text-amber-600 font-black font-mono">{formatNaira(totalOutstandingLoans + totalOutstandingKept)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cashierDebts.map((debt) => {
            const hasOutstanding = debt.outstandingLoan > 0 || debt.outstandingKept > 0;
            const totalHeld = debt.outstandingLoan + debt.outstandingKept;
            const isCurrentlyExpanded = expandedCashierId === debt.employeeId;
            
            return (
              <div 
                key={debt.employeeId}
                className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-3 ${
                  hasOutstanding 
                    ? 'border-amber-100/80 bg-amber-50/5 hover:border-amber-300 hover:shadow-xs' 
                    : 'border-neutral-150 bg-neutral-50/20 hover:border-neutral-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black font-mono shrink-0 ${
                        hasOutstanding ? 'bg-amber-100 text-amber-800' : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {debt.employeeName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-neutral-800 block truncate" title={debt.employeeName}>
                          {debt.employeeName}
                        </span>
                        <span className="text-[9px] text-neutral-450 font-bold uppercase font-mono block">
                          ID: {debt.employeeId.slice(0, 6)}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-md border tracking-wide uppercase shrink-0 ${
                      hasOutstanding 
                        ? 'bg-amber-50 text-amber-700 border-amber-200/50' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200/50'
                    }`}>
                      {hasOutstanding ? 'Outstanding' : 'Balanced'}
                    </span>
                  </div>

                  <div className="bg-neutral-50/80 border border-neutral-100 rounded-xl p-2.5 space-y-2 mb-3">
                    <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
                      <span className="flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />
                        Unpaid Loans:
                      </span>
                      <span className="font-mono font-extrabold text-neutral-800">
                        {formatNaira(debt.outstandingLoan)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
                      <span className="flex items-center gap-1">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-500" />
                        Held Cash Keeping:
                      </span>
                      <span className="font-mono font-extrabold text-neutral-800">
                        {formatNaira(debt.outstandingKept)}
                      </span>
                    </div>

                    <div className="border-t border-neutral-200/60 my-1 pt-1.5 flex items-center justify-between text-xs font-bold text-neutral-700">
                      <span>Total Held Balance:</span>
                      <span className={`font-mono font-black ${hasOutstanding ? 'text-amber-600' : 'text-neutral-700'}`}>
                        {formatNaira(totalHeld)}
                      </span>
                    </div>
                  </div>

                  {/* Expandable transaction logs list */}
                  {isCurrentlyExpanded && (
                    <div className="border-t border-dashed border-neutral-200 pt-3 mt-3 space-y-2.5 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-neutral-400" />
                          Ledger Entries
                        </span>
                        {/* Tab Switcher */}
                        <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-250">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDebtSubTab('outstanding');
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition ${
                              debtSubTab === 'outstanding'
                                ? 'bg-white text-neutral-800 shadow-xs'
                                : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                          >
                            Unpaid ({
                              debt.transactions.filter(t => {
                                const outstanding = t.amount - (t.repaidAmount || 0);
                                return t.status !== 'settled' && outstanding > 0 && (t.type === 'loan_given' || t.type === 'money_kept');
                              }).length
                            })
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDebtSubTab('all');
                            }}
                            className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition ${
                              debtSubTab === 'all'
                                ? 'bg-white text-neutral-800 shadow-xs'
                                : 'text-neutral-500 hover:text-neutral-700'
                            }`}
                          >
                            All ({debt.transactions.length})
                          </button>
                        </div>
                      </div>

                      <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                        {(() => {
                          const list = debtSubTab === 'outstanding'
                            ? debt.transactions.filter(t => {
                                const outstanding = t.amount - (t.repaidAmount || 0);
                                return t.status !== 'settled' && outstanding > 0 && (t.type === 'loan_given' || t.type === 'money_kept');
                              })
                            : debt.transactions;

                          if (list.length === 0) {
                            return (
                              <div className="text-center py-6 text-[10px] text-neutral-400 italic font-medium">
                                No {debtSubTab === 'outstanding' ? 'outstanding' : 'recorded'} ledger entries.
                              </div>
                            );
                          }

                          return list.map((tx) => {
                            const isLoan = tx.type === 'loan_given';
                            const isRepaid = tx.type === 'loan_repaid';
                            const isKept = tx.type === 'money_kept';
                            const isReturned = tx.type === 'money_returned';

                            const activeOutstanding = (isLoan || isKept) ? tx.amount - (tx.repaidAmount || 0) : 0;
                            const txDate = new Date(tx.timestamp).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                            });
                            const txTime = new Date(tx.timestamp).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit'
                            });

                            let typeLabel = '';
                            let typeStyle = 'border-l-3 border-l-neutral-300';
                            let badgeStyle = 'bg-neutral-100 text-neutral-750';

                            if (isLoan) {
                              typeLabel = 'Loan Given';
                              typeStyle = 'border-l-3 border-l-blue-500 bg-blue-50/5';
                              badgeStyle = 'bg-blue-100 text-blue-800 border border-blue-200/50';
                            } else if (isKept) {
                              typeLabel = 'Kept Cash';
                              typeStyle = 'border-l-3 border-l-indigo-500 bg-indigo-50/5';
                              badgeStyle = 'bg-indigo-100 text-indigo-800 border border-indigo-200/50';
                            } else if (isRepaid) {
                              typeLabel = 'Loan Repaid';
                              typeStyle = 'border-l-3 border-l-emerald-500 bg-emerald-50/10';
                              badgeStyle = 'bg-emerald-100 text-emerald-800 border border-emerald-200/50';
                            } else if (isReturned) {
                              typeLabel = 'Cash Returned';
                              typeStyle = 'border-l-3 border-l-teal-500 bg-teal-50/10';
                              badgeStyle = 'bg-teal-100 text-teal-800 border border-teal-200/50';
                            }

                            return (
                              <div 
                                key={tx.id} 
                                className={`p-2 rounded-xl border border-neutral-150 text-[10px] space-y-1 transition-all ${typeStyle}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${badgeStyle}`}>
                                      {typeLabel}
                                    </span>
                                    {tx.approvalStatus === 'pending' && (
                                      <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1 py-0.5 rounded border border-amber-200 animate-pulse font-mono font-black">
                                        ⏳ PENDING
                                      </span>
                                    )}
                                    {tx.approvalStatus === 'rejected' && (
                                      <span className="bg-red-100 text-red-800 text-[8px] font-black px-1 py-0.5 rounded border border-red-200 font-mono font-black">
                                        ❌ REJECTED
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-neutral-400 font-bold font-mono">
                                    {txDate} • {txTime}
                                  </span>
                                </div>
 
                                <div className="space-y-0.5 font-semibold text-neutral-550">
                                  <div className="flex items-center justify-between">
                                    <span>Client / Source:</span>
                                    <strong className="text-neutral-800">👤 {tx.name}</strong>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Amount:</span>
                                    <strong className="text-neutral-700 font-mono">{formatNaira(tx.amount)}</strong>
                                  </div>
                                  {(isLoan || isKept) && (
                                    <>
                                      {tx.repaidAmount && tx.repaidAmount > 0 ? (
                                        <div className="flex items-center justify-between text-emerald-600">
                                          <span>Paid Back:</span>
                                          <span className="font-mono font-bold">-{formatNaira(tx.repaidAmount)}</span>
                                        </div>
                                      ) : null}
                                      {tx.status === 'settled' ? (
                                        <div className="flex items-center justify-between text-emerald-600 font-bold text-[9px] uppercase tracking-wide">
                                          <span>Status:</span>
                                          <span className="flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Settled
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-between pt-0.5 border-t border-dashed border-neutral-200 text-[11px] font-black">
                                          <span className="text-neutral-700">Unpaid Bal:</span>
                                          <span className="text-amber-600 font-mono">{formatNaira(activeOutstanding)}</span>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
 
                                {tx.notes && (
                                  <p className="text-[9.5px] text-neutral-500 italic bg-white p-1 rounded border border-neutral-100 max-w-full truncate" title={tx.notes}>
                                    📝 {tx.notes}
                                  </p>
                                )}

                                {tx.approvalStatus === 'pending' && (
                                  <div className="flex justify-end gap-1.5 pt-1.5 border-t border-dashed border-neutral-200">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRejectTransaction(tx);
                                      }}
                                      className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md cursor-pointer transition-all active:scale-95 font-mono"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleApproveTransaction(tx);
                                      }}
                                      className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-extrabold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded-md cursor-pointer transition-all active:scale-95 font-mono"
                                    >
                                      Approve
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (expandedCashierId === debt.employeeId) {
                          setExpandedCashierId(null);
                        } else {
                          setExpandedCashierId(debt.employeeId);
                          setDebtSubTab('outstanding');
                        }
                      }}
                      className={`w-full py-1.5 rounded-xl text-[10px] font-extrabold transition uppercase font-mono cursor-pointer flex items-center justify-center gap-1 border ${
                        isCurrentlyExpanded
                          ? 'bg-amber-100/80 text-amber-900 border-amber-300'
                          : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100 border-neutral-200'
                      }`}
                    >
                      {isCurrentlyExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5 text-amber-700" />
                          Hide Ledger Details
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
                          View Ledger Entries ({debt.transactions.length})
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDebtSearchQuery(debt.employeeName)}
                      className="w-full bg-white border border-neutral-200 hover:border-amber-300 hover:bg-amber-50/20 text-neutral-600 hover:text-amber-700 py-1 rounded-xl text-[10px] font-extrabold transition uppercase font-mono cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Search className="w-3 h-3" />
                      Filter Activity Logs Below
                    </button>
                    {debtSearchQuery === debt.employeeName && (
                      <button
                        type="button"
                        onClick={() => setDebtSearchQuery('')}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-500 p-1 rounded-xl text-[10px] font-extrabold transition cursor-pointer"
                        title="Clear filter"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EMPLOYEES GRID */}
      {filteredEmployeeStats.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-neutral-200 rounded-3xl">
          <div className="w-12 h-12 rounded-full bg-neutral-50 text-neutral-400 flex items-center justify-center mx-auto mb-3 border border-neutral-100">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-neutral-700">No matching cashier profiles found</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">Create cashier / operator accounts in the Configure &gt; Shift Operator Profile Center.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredEmployeeStats.map((item) => {
            const isFocused = selectedEmployeeFilter === item.employee.id;
            const isInactive = item.employee.activated === false;

            return (
              <div
                key={item.employee.id}
                className={`bg-white border rounded-3xl p-5 space-y-4 transition-all duration-200 relative ${
                  isFocused
                    ? 'border-[#00B87A] ring-2 ring-[#00B87A]/10 shadow-md'
                    : 'border-neutral-200 hover:border-neutral-300 hover:shadow-sm'
                } ${isInactive ? 'bg-neutral-50/50 opacity-75' : ''}`}
              >
                {/* Employee Info Bar */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-neutral-100 flex items-center justify-center font-black text-neutral-600 border border-neutral-200 relative uppercase select-none font-mono">
                      {item.employee.name.slice(0, 2)}
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isInactive ? 'bg-neutral-300' : 'bg-[#00B87A]'}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5">
                        {item.employee.name}
                        {isFocused && (
                          <span className="text-[9px] bg-[#00B87A]/10 text-[#00B87A] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                            dashboard filtered
                          </span>
                        )}
                      </h4>
                      <p className="text-[10px] text-neutral-450 font-mono mt-0.5">
                        {item.employee.email || 'Local operator profile'} • <span className="font-bold text-neutral-600">PIN: {item.employee.pin || '••••'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {onEditEmployee && (
                        <button
                          type="button"
                          onClick={() => onEditEmployee(item.employee)}
                          className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition cursor-pointer"
                          title="Edit Profile"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md font-mono border ${
                        isInactive 
                          ? 'bg-neutral-100 text-neutral-500 border-neutral-200' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {isInactive ? 'Deactivated' : 'Active Duty'}
                      </span>
                    </div>
                    <span className="text-[9px] text-neutral-400 font-mono font-bold">
                      {item.totalTxsAllTime} total slips
                    </span>
                  </div>
                </div>

                {/* Assigned POS profile mapping info */}
                {item.mappedTerminal ? (
                  <div className="bg-emerald-50/20 border border-emerald-100 p-3 rounded-2xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-mono text-[9px] font-black text-[#00B87A] uppercase tracking-wider">
                      <span className="flex items-center gap-1"><CreditCard className="w-3.5 h-3.5" /> Assigned POS Terminal Profile</span>
                      <span>{item.mappedTerminal.provider}</span>
                    </div>
                    <div className="flex justify-between items-center text-neutral-800">
                      <span className="font-extrabold">{item.mappedTerminal.name}</span>
                      <span className="font-mono text-neutral-500 text-[11px]">Acct: {item.mappedTerminal.posAccountNo}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                      <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                      <span>Operating Area: <strong className="text-neutral-700">{item.mappedTerminal.areaOfWorking}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-200 p-3 rounded-2xl flex items-center justify-between bg-neutral-50/40 text-[10px] text-neutral-450 font-bold font-mono">
                    <span>⚠️ NO CORRESPONDING POS LINKED</span>
                    <span className="text-[9px] text-neutral-400 font-sans font-medium">Set Cashier Name in POS profile</span>
                  </div>
                )}

                {/* Contribution Visual Progress Bar */}
                {!isInactive && item.volume > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono font-extrabold text-neutral-450 uppercase tracking-widest">
                      <span>Volume Contribution Share</span>
                      <span className="text-neutral-700 font-black">{item.contributionPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#00B87A] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${item.contributionPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Metrics Matrix */}
                <div className="grid grid-cols-3 gap-2 bg-neutral-50 p-3 rounded-2xl border border-neutral-200/55 text-center">
                  <div>
                    <span className="text-[8.5px] uppercase font-mono font-extrabold text-neutral-400 block tracking-wider">
                      Volume ({activeTimeframe})
                    </span>
                    <span className="text-xs font-bold font-mono text-neutral-800 block mt-0.5">
                      {formatNaira(item.volume)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase font-mono font-extrabold text-neutral-400 block tracking-wider">
                      Net Commission
                    </span>
                    <span className={`text-xs font-bold font-mono block mt-0.5 ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {formatNaira(item.profit)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[8.5px] uppercase font-mono font-extrabold text-neutral-400 block tracking-wider">
                      Unpaid Deferred
                    </span>
                    <span className={`text-xs font-bold font-mono block mt-0.5 ${item.unpaidFees > 0 ? 'text-amber-600 font-black' : 'text-neutral-400'}`}>
                      {formatNaira(item.unpaidFees)}
                    </span>
                  </div>
                </div>

                {/* Cashier Loans & Keep Status */}
                {(() => {
                  const debt = cashierDebts.find(d => d.employeeId === item.employee.id);
                  if (!debt || (debt.outstandingLoan === 0 && debt.outstandingKept === 0)) return null;
                  return (
                    <div className="bg-blue-50/75 border border-blue-150 p-3 rounded-2xl flex items-center justify-between text-xs font-semibold text-blue-800">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-blue-600" />
                        <span>Active Cashier Ledger:</span>
                      </div>
                      <div className="flex gap-1.5 font-mono text-[10px]">
                        {debt.outstandingLoan > 0 && (
                          <span className="bg-blue-100 text-blue-800 px-2.5 py-1 rounded-lg font-black border border-blue-200 shadow-xs flex items-center gap-1">
                            <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            Loans: {formatNaira(debt.outstandingLoan)}
                          </span>
                        )}
                        {debt.outstandingKept > 0 && (
                          <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-lg font-black border border-indigo-200 shadow-xs flex items-center gap-1">
                            <ArrowDownLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            Kept: {formatNaira(debt.outstandingKept)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Recent Receipts Processed */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-mono font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1">
                      <Activity className="w-3 h-3 text-neutral-400" />
                      Live Operator logs (Latest 3)
                    </span>
                  </div>

                  {item.recentTxs.length === 0 ? (
                    <div className="text-center py-4 bg-neutral-50/40 rounded-xl border border-dashed border-neutral-200">
                      <p className="text-[10px] text-neutral-400 font-medium font-mono">No active operations reported by this cashier yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {item.recentTxs.map((tx) => {
                        const txTime = new Date(tx.timestamp).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                        const isFailed = (tx.status || 'Success') === 'Failed';
                        const isUnpaid = tx.chargesStatus === 'Unpaid';

                        const providerTxId = getProviderTransactionNumber(tx);
                        const providerBadgeStyle = 
                          tx.provider === 'Moniepoint'
                            ? 'text-blue-600 bg-blue-50/60 border-blue-100'
                            : tx.provider === 'OPay'
                            ? 'text-emerald-600 bg-emerald-50/60 border-emerald-100'
                            : 'text-orange-600 bg-orange-50/60 border-orange-100';

                        return (
                          <div
                            key={tx.id}
                            className={`p-2.5 bg-neutral-50/70 border border-neutral-200/50 rounded-xl flex justify-between items-start text-[11px] hover:border-neutral-350 transition ${
                              isFailed ? 'opacity-50 line-through' : ''
                            }`}
                          >
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  tx.type === 'Deposit' ? 'bg-emerald-500' : tx.type === 'Withdrawal' ? 'bg-amber-500' : 'bg-blue-500'
                                }`} />
                                <span className="font-extrabold text-neutral-700 uppercase shrink-0">
                                  {tx.type === 'Withdrawal' ? 'WDR' : tx.type === 'Deposit' ? 'RCV' : tx.type.slice(0, 3)}
                                </span>
                                <span className="font-mono text-neutral-800 font-black truncate">
                                  {formatNaira(tx.amount)}
                                </span>
                                <span className={`inline-flex items-center px-1 rounded text-[8.5px] font-black border uppercase tracking-wider ${providerBadgeStyle}`}>
                                  {tx.provider}
                                </span>
                              </div>
                              <div className="text-[9.5px] font-mono text-neutral-500 font-extrabold mt-1 tracking-tight select-all">
                                Ref: {providerTxId}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                              <span className="text-[9.5px] font-mono text-neutral-400 font-bold">
                                {txTime}
                              </span>
                              {isUnpaid && !isFailed && (
                                <span className="text-[8px] bg-amber-100 text-amber-800 border border-amber-200 font-mono font-black uppercase px-1.5 py-0.2 rounded-md">
                                  Skipped Fee
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => onViewReceipt && onViewReceipt(tx)}
                                className="p-1 hover:bg-neutral-150 rounded text-[#00B87A] transition cursor-pointer"
                                title="View transaction receipt"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dashboard Interlock Button */}
                <div className="pt-2 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSetEmployeeFilter(isFocused ? 'ALL' : item.employee.id)}
                      className={`w-full py-2 px-3 border rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 font-mono uppercase ${
                        isFocused
                          ? 'bg-neutral-900 border-neutral-900 text-white hover:bg-neutral-850'
                          : 'bg-white border-[#00B87A]/30 text-[#00B87A] hover:bg-[#00B87A]/5 hover:border-[#00B87A]/70'
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      {isFocused ? 'Remove Dashboard Filter' : 'Focus Dashboard Feed'}
                    </button>
                    {onSwitchToCashier && (
                      <button
                        type="button"
                        onClick={() => onSwitchToCashier(item.employee.id)}
                        className="py-2 px-3 border border-[#00B87A] bg-[#00B87A] text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 font-mono uppercase hover:bg-[#009b68] hover:border-[#009b68]"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Switch To View
                      </button>
                    )}
                  </div>
                  {onEditEmployee && (
                    <button
                      type="button"
                      onClick={() => onEditEmployee(item.employee)}
                      className="w-full py-2 border border-indigo-200 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 font-mono uppercase hover:bg-indigo-100"
                    >
                      Edit Profile
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* CASHIER LOAN, DEBT & CASH KEEPING OVERSIGHT MODULE */}
      <div className="border border-blue-200/60 bg-gradient-to-br from-blue-50/20 via-white to-indigo-50/10 rounded-3xl p-5 space-y-5 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neutral-100">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[9px] bg-blue-100 border border-blue-200 text-blue-700 font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full">
              <TrendingDown className="w-3.5 h-3.5 animate-pulse text-blue-600" />
              Cashier Loan & Debt Tracking Monitor
            </span>
            <h4 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              Outstanding Cashier Debt & Kept Cash Directory
            </h4>
            <p className="text-xs text-neutral-500 font-medium">
              View live trending loans and money-keeping transactions active on each cashier's account. This prevents ledger mismatch and helps reconcile cashier balances.
            </p>
          </div>

          {/* Quick Stats Summary */}
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
            <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-2xl flex items-center gap-2.5">
              <div className="p-2 bg-blue-100/80 rounded-xl text-blue-700">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider block font-mono">Trending Loans Given</span>
                <span className="text-sm font-black font-mono text-blue-800">{formatNaira(totalOutstandingLoans)}</span>
              </div>
            </div>
            <div className="bg-indigo-50/60 border border-indigo-100 p-3 rounded-2xl flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100/80 rounded-xl text-indigo-700">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider block font-mono">Customer Kept Money</span>
                <span className="text-sm font-black font-mono text-indigo-800">{formatNaira(totalOutstandingKept)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* PENDING APPROVAL INBOX */}
        {pendingApprovals.length > 0 && (
          <div className="bg-amber-50/45 border border-amber-200/90 rounded-3xl p-4.5 space-y-3.5 shadow-sm">
            <div className="flex justify-between items-center pb-2.5 border-b border-amber-200/50">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="text-xs font-black text-amber-950 uppercase tracking-wide flex items-center gap-1.5 font-mono">
                  🛡️ Manager Approval Desk Required ({pendingApprovals.length})
                </span>
              </div>
              <span className="text-[9px] text-amber-700 font-mono font-extrabold bg-amber-100/70 px-2.5 py-0.5 rounded-full border border-amber-200">
                Action Required
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingApprovals.map((tx) => {
                const isRepay = tx.type === 'loan_repaid';
                return (
                  <div key={tx.id} className="bg-white border border-amber-200/80 p-3 rounded-2xl flex flex-col justify-between space-y-3.5 hover:border-amber-400 transition-all duration-200 shadow-xs">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className={`font-mono font-extrabold text-[8.5px] uppercase tracking-wide px-2 py-0.5 rounded border ${
                          isRepay ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : 'bg-purple-50 text-purple-800 border-purple-100'
                        }`}>
                          {isRepay ? 'Repayment Settlement' : 'Returned Safe Cash'}
                        </span>
                        <span className="text-neutral-400 font-bold font-mono text-[9px]">
                          {new Date(tx.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      
                      <div className="flex justify-between items-baseline pt-0.5">
                        <span className="text-xs font-extrabold text-neutral-800">
                          {tx.name}
                        </span>
                        <span className="font-mono font-black text-xs text-amber-600">
                          {formatNaira(tx.amount)}
                        </span>
                      </div>

                      <div className="text-[10px] text-neutral-500 space-y-1">
                        <p className="font-medium">
                          Submitted by: <strong className="text-neutral-700">👤 {tx.employeeName}</strong>
                        </p>
                        {tx.notes && (
                          <p className="text-[9.5px] text-neutral-400 italic bg-neutral-50 px-2.5 py-1 rounded-lg border border-neutral-150/60 leading-normal">
                            " {tx.notes} "
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                      <button
                        type="button"
                        onClick={() => handleRejectTransaction(tx)}
                        className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1 rounded-xl cursor-pointer transition-all active:scale-95 font-mono"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveTransaction(tx)}
                        className="bg-[#00B87A] hover:bg-[#009b68] border border-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider px-4 py-1 rounded-xl cursor-pointer shadow-xs transition-all active:scale-95 font-mono"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SEARCH AND DIRECT FILTER */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-neutral-50 p-3 rounded-2xl border border-neutral-150">
          <span className="text-xs font-bold text-neutral-600 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-neutral-400" />
            Active Ledger: <strong className="text-blue-700 font-black">{filteredOversightDebts.length} unresolved transactions</strong>
          </span>

          <div className="relative w-full sm:w-72">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search by customer, cashier, or notes..."
              value={debtSearchQuery}
              onChange={(e) => setDebtSearchQuery(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-xl pl-9 pr-4 py-2 text-xs text-neutral-800 font-medium placeholder:text-neutral-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* LEDGER GRID */}
        {filteredOversightDebts.length === 0 ? (
          <div className="text-center py-10 bg-neutral-50/40 border border-dashed border-neutral-200 rounded-3xl">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-neutral-700">No active cashier loans or debts found</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">All customer loan files and kept cash folders are settled on cashier logs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOversightDebts.map((tx) => {
              const outstanding = tx.amount - (tx.repaidAmount || 0);
              const isLoan = tx.type === 'loan_given';
              const dateStr = new Date(tx.timestamp).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const timeStr = new Date(tx.timestamp).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div 
                  key={tx.id} 
                  className={`bg-white border p-4 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 ${
                    isLoan ? 'border-blue-100/80 bg-blue-50/5' : 'border-indigo-100/80 bg-indigo-50/5'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border tracking-wide font-mono flex items-center gap-1 ${
                        isLoan 
                          ? 'bg-blue-50 text-blue-800 border-blue-200/60' 
                          : 'bg-indigo-50 text-indigo-800 border-indigo-200/60'
                      }`}>
                        {isLoan ? (
                          <>
                            <ArrowUpRight className="w-3 h-3 text-blue-600 shrink-0" />
                            Client Loan
                          </>
                        ) : (
                          <>
                            <ArrowDownLeft className="w-3 h-3 text-indigo-600 shrink-0" />
                            Kept Cash
                          </>
                        )}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-bold font-mono">
                        {dateStr} • {timeStr}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest font-mono">Outstanding</span>
                        <span className={`text-base font-black font-mono tracking-tight ${isLoan ? 'text-blue-700' : 'text-indigo-700'}`}>
                          {formatNaira(outstanding)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-500">
                        <span>Original Sum:</span>
                        <span className="font-bold font-mono text-neutral-700">{formatNaira(tx.amount)}</span>
                      </div>
                      {tx.repaidAmount && tx.repaidAmount > 0 ? (
                        <div className="flex items-center justify-between text-[11px] text-neutral-500">
                          <span>{isLoan ? 'Amount Repaid' : 'Amount Returned'}:</span>
                          <span className="font-bold font-mono text-emerald-600">+{formatNaira(tx.repaidAmount)}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="border-t border-dashed border-neutral-100 pt-2.5 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-450 font-extrabold">Client / Source:</span>
                        <span className="font-black text-neutral-700 bg-neutral-100/80 px-2 py-0.5 rounded-md truncate max-w-[140px] block" title={tx.name}>
                          👤 {tx.name}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-450 font-extrabold">Handling Cashier:</span>
                        <span className="font-black text-neutral-700 bg-neutral-100/80 px-2 py-0.5 rounded-md truncate max-w-[140px] block" title={tx.employeeName}>
                          💼 {tx.employeeName || 'System'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {tx.notes && (
                    <div className="p-2 bg-neutral-50/80 border border-neutral-100 rounded-xl text-[11px] text-neutral-500 italic font-medium leading-relaxed">
                      📝 {tx.notes}
                    </div>
                  )}

                  {/* Document Proof Snapshot Indicator if available */}
                  {(tx.photoFront || tx.photoBack || tx.photo) && (
                    <div className="flex items-center gap-1 text-[9.5px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      📸 Instant Verification Photo Locked
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENT FEED STREAMING FROM ALL STAFF COMBINED */}
      <div className="p-5 bg-[#00B87A]/5 border border-[#00B87A]/15 rounded-3xl space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[10px] bg-[#00B87A]/10 border border-[#00B87A]/25 text-[#00B87A] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[#00B87A] animate-pulse" />
            Unified Real-Time Receipt Stream
          </span>
          <span className="text-[10px] font-mono text-neutral-400 font-bold">
            All Employees Combined
          </span>
        </div>

        {unifiedLiveFeed.length === 0 ? (
          <div className="text-center py-6 bg-white border border-neutral-200/60 rounded-2xl">
            <p className="text-xs text-neutral-400 font-medium font-mono">No live transaction logs streaming from employees.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {unifiedLiveFeed.map((tx) => {
              const txTime = new Date(tx.timestamp).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={tx.id}
                  className="bg-white border border-neutral-200/80 hover:border-emerald-300 p-3 rounded-2xl transition flex flex-col justify-between space-y-2 relative"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[8.5px] font-black uppercase px-1.5 py-0.5 rounded-md font-mono border ${
                        tx.type === 'Deposit'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                          : tx.type === 'Withdrawal'
                          ? 'bg-amber-50 text-amber-800 border-amber-100'
                          : 'bg-blue-50 text-blue-800 border-blue-100'
                      }`}>
                        {tx.type === 'Withdrawal' ? 'Withdraw' : tx.type === 'Deposit' ? 'Money Receive' : tx.type}
                      </span>
                      <span className="text-[9px] font-mono text-neutral-400 font-bold">
                        {txTime}
                      </span>
                    </div>

                    <div className="text-xs font-black font-mono text-neutral-850">
                      {formatNaira(tx.amount)}
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 pt-1.5 flex justify-between items-center">
                    <div className="min-w-0">
                      <span className="text-[9.5px] text-neutral-500 font-extrabold truncate block font-sans">
                        👤 {tx.employeeName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewReceipt && onViewReceipt(tx)}
                      className="p-1 hover:bg-neutral-100 rounded text-[#00B87A] cursor-pointer"
                      title="Quick Receipt Info"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
