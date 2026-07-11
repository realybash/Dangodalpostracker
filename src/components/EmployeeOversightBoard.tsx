/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { User, Transaction, PosTerminal, AppSettings } from '../types';
import { formatNaira, getProviderTransactionNumber } from '../utils';
import { PosReconciliationTool } from './PosReconciliationTool';
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
  AlertCircle
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
  onEditEmployee
}: EmployeeOversightBoardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all');

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
      const profit = grossFees - terminalFees - cbnCharges;

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
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md font-mono border ${
                      isInactive 
                        ? 'bg-neutral-100 text-neutral-500 border-neutral-200' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {isInactive ? 'Deactivated' : 'Active Duty'}
                    </span>
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
