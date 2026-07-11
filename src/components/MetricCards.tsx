/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { formatNaira } from '../utils';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar, 
  Activity, 
  Sparkles,
  ChevronRight,
  Plus,
  Coins,
  FileCheck
} from 'lucide-react';
import { t } from '../i18n';

interface MetricCardsProps {
  profit: number;
  volume: number;
  totalExpenses: number;
  count: number;
  averageTxSize: number;
  timeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  dailyTarget: number;
  onSetDailyTarget: (newTarget: number) => void;
  onOpenAddModal: () => void;
  isManager?: boolean;
  language: 'en' | 'ha';
}

export function MetricCards({
  profit,
  volume,
  totalExpenses,
  count,
  averageTxSize,
  timeframe,
  dailyTarget,
  onSetDailyTarget,
  onOpenAddModal,
  isManager = true,
  language
}: MetricCardsProps) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInputValue, setTargetInputValue] = useState(dailyTarget.toString());

  const handleSaveTarget = () => {
    const val = parseFloat(targetInputValue);
    if (!isNaN(val) && val >= 0) {
      onSetDailyTarget(val);
      setEditingTarget(false);
    }
  };

  const isDaily = timeframe === 'Daily';
  // Net profit is Gross Profit - Expenses
  const netProfit = profit - totalExpenses;
  const progressPercent = dailyTarget > 0 ? Math.min((netProfit / dailyTarget) * 100, 100) : 0;
  
  return (
    <div className="space-y-6">
      {/* Dynamic Segment Header Call-out */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white border border-neutral-200 p-5 rounded-3xl gap-4 shadow-sm">
        <div>
          <span className="text-xs font-mono text-[#00B87A] uppercase tracking-widest flex items-center gap-1.5 font-bold">
            <Sparkles className="w-3.5 h-3.5 animate-spin-slow" /> {isManager ? 'Real-time POS Ledger Metrics' : 'Employee Shift Overview'}
          </span>
          <h2 className="text-lg font-extrabold text-neutral-800 tracking-tight mt-1">
            {isManager ? `${timeframe} Analytics Overview` : 'My Sales & Shift Records'} ({count} Receipts)
          </h2>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            {isManager 
              ? 'Computed dynamically based on active employee shift records, POS baseline costs, and reported expenses.'
              : 'Keep track of your transaction receipts logged under your shift profile.'}
          </p>
        </div>
        <button
          onClick={onOpenAddModal}
          className="w-full sm:w-auto bg-[#00B87A] hover:bg-emerald-600 text-white font-extrabold px-5 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm shadow-md shadow-[#00B87A]/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4.5 h-4.5 stroke-[3]" />
          Record New Receipt
        </button>
      </div>

      {/* Grid of Financial Metrics */}
      {isManager ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          
          {/* Net Profit Core Block (Vibrant Light Emerald) */}
          <div className="relative overflow-hidden bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm transition-all hover:border-[#00B87A]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                {t('Net Profit', language)}
              </span>
              <span className="p-2 bg-emerald-50 text-emerald-600 rounded-full">
                <DollarSign className="w-4 h-4 stroke-[2.5]" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black font-mono text-emerald-600 tracking-tight">
                {formatNaira(netProfit)}
              </h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500 font-bold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Profit after expenses</span>
              </div>
            </div>
          </div>

          {/* Volume Metric Card */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm hover:border-neutral-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                Aggr. Volume
              </span>
              <span className="p-2 bg-blue-50 text-blue-600 rounded-full">
                <Activity className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black font-mono text-neutral-800 tracking-tight">
                {formatNaira(volume)}
              </h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-blue-500 font-bold">
                <span>Dynamic inflow flow</span>
              </div>
            </div>
          </div>

          {/* Operating POS Expenses Card */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm hover:border-neutral-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                Total Expenses
              </span>
              <span className="p-2 bg-orange-50 text-orange-600 rounded-full">
                <TrendingDown className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black font-mono text-orange-600 tracking-tight">
                {formatNaira(totalExpenses)}
              </h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-orange-500 font-bold">
                <span>Direct baseline cut</span>
              </div>
            </div>
          </div>

          {/* Transactions Done Card */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm hover:border-neutral-300 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                Avg Receipt Size
              </span>
              <span className="p-2 bg-purple-50 text-purple-600 rounded-full">
                <Coins className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-xl sm:text-2xl font-black font-mono text-neutral-800 tracking-tight">
                {formatNaira(averageTxSize)}
              </h3>
              <div className="flex items-center gap-1 mt-1 text-[10px] text-purple-500 font-bold">
                <span>{count} registered records</span>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shift Volume Card for Employee */}
          <div className="bg-white border-2 border-emerald-500 p-5 rounded-3xl shadow-sm relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-50 rounded-full pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                My Shift Transacted Volume
              </span>
              <span className="p-2.5 bg-[#00B87A] text-white rounded-2xl shadow-sm shadow-emerald-500/10">
                <Activity className="w-5 h-5 stroke-[2.5]" />
              </span>
            </div>
            <div className="mt-5 relative z-10">
              <h3 className="text-2xl md:text-3xl font-black font-mono text-[#00B87A] tracking-tight">
                {formatNaira(volume)}
              </h3>
              <div className="text-[11px] text-neutral-500 font-medium mt-1">
                Total aggregate successful and pending transfers processed on your account.
              </div>
            </div>
          </div>

          {/* Receipt Volume/Count Card */}
          <div className="bg-white border border-neutral-100 p-5 rounded-3xl shadow-sm hover:border-neutral-350 transition-all border-neutral-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                My Printed Receipts
              </span>
              <span className="p-2.5 bg-neutral-100 text-[#00B87A] rounded-2xl">
                <FileCheck className="w-5 h-5" />
              </span>
            </div>
            <div className="mt-5">
              <h3 className="text-2xl md:text-3xl font-black font-mono text-neutral-800 tracking-tight">
                {count} Slips
              </h3>
              <div className="text-[11px] text-neutral-500 font-medium mt-1">
                Your transaction count recorded securely under your employee profile.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Profit Target Ring Progress & Dashboard Sliders */}
      {isManager && (
        <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-0.5">
              <h4 className="text-sm font-extrabold text-neutral-800 flex items-center gap-1.5">
                <span>🎯 Daily Employee Goal Standard</span>
                {isDaily && (
                  <span className="bg-[#00B87A]/10 text-[#00B87A] text-[9px] px-2 py-0.5 rounded-full font-mono font-black">
                    Active Today
                  </span>
                )}
              </h4>
              <p className="text-xs text-neutral-500 font-medium">
                Define operational profit benchmarks for employee staff shifts: <span className="font-mono text-[#00B87A] font-bold">{formatNaira(dailyTarget)}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              {editingTarget ? (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-mono">₦</span>
                    <input
                      type="number"
                      value={targetInputValue}
                      onChange={(e) => setTargetInputValue(e.target.value)}
                      className="bg-neutral-50 border border-neutral-300 text-neutral-800 font-mono text-xs rounded-xl pl-6 pr-2 py-2 w-28 focus:outline-none focus:border-[#00B87A]"
                      placeholder="2000"
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveTarget}
                    className="bg-[#00B87A] hover:bg-emerald-600 text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetInputValue(dailyTarget.toString());
                      setEditingTarget(false);
                    }}
                    className="bg-neutral-100 hover:bg-neutral-250 text-neutral-600 px-3 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTarget(true)}
                  className="w-full sm:w-auto text-xs text-neutral-600 hover:text-neutral-800 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 px-3.5 py-2 rounded-xl font-bold transition cursor-pointer"
                >
                  Configure Target
                </button>
              )}
            </div>
          </div>

          {/* Progress Bar Container */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-neutral-500">Milestone Met: <strong className="text-neutral-700">{progressPercent.toFixed(1)}%</strong></span>
              <span className="text-[#00B87A] font-bold">{formatNaira(profit)} / {formatNaira(dailyTarget)}</span>
            </div>
            
            <div className="relative h-3 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
              <div 
                style={{ width: `${progressPercent}%` }}
                className="h-full bg-gradient-to-r from-[#00B87A] via-emerald-400 to-teal-400 rounded-full transition-all duration-300"
              />
            </div>

            <div className="flex justify-between items-center text-[10px]">
              <span className="text-neutral-400 font-mono">₦0.00 Minimum Base</span>
              {progressPercent >= 100 ? (
                <motion.span 
                  className="text-emerald-600 font-extrabold flex items-center gap-1.5"
                  animate={{
                    scale: [1, 1.04, 1],
                    opacity: [0.85, 1, 0.85],
                    textShadow: [
                      "0 0 0px rgba(16,185,129,0)",
                      "0 0 8px rgba(16,185,129,0.3)",
                      "0 0 0px rgba(16,185,129,0)"
                    ]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  🏆 POS Business Milestone Target Met! Fantastic Job! 🌟
                </motion.span>
              ) : (
                <span className="text-neutral-500 font-medium">Need <strong className="text-neutral-700">{formatNaira(Math.max(dailyTarget - profit, 0))}</strong> more to hit target</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
