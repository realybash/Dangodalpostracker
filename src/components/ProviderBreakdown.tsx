/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Transaction, ProviderType, AppSettings } from '../types';
import { formatNaira, calculateTerminalFee, calculateCBNCharge, getCalculatedFinancials } from '../utils';
import { TrendingUp, RefreshCw, BarChart2, Award } from 'lucide-react';

interface ProviderBreakdownProps {
  transactions: Transaction[];
  terminalFeeRate: number;
  settings?: AppSettings;
}

export function ProviderBreakdown({ transactions, terminalFeeRate, settings }: ProviderBreakdownProps) {
  
  // Compute provider distribution matrices
  const providerStats = useMemo(() => {
    const stats: Record<string, {
      profit: number;
      volume: number;
      count: number;
      customerFees: number;
      terminalCosts: number;
    }> = {
      OPay: { profit: 0, volume: 0, count: 0, customerFees: 0, terminalCosts: 0 },
      Moniepoint: { profit: 0, volume: 0, count: 0, customerFees: 0, terminalCosts: 0 },
      PalmPay: { profit: 0, volume: 0, count: 0, customerFees: 0, terminalCosts: 0 }
    };

    transactions.forEach((tx) => {
      const p = tx.provider;
      if (!stats[p]) {
        stats[p] = { profit: 0, volume: 0, count: 0, customerFees: 0, terminalCosts: 0 };
      }
      
      // Use stored values if available, otherwise use unified calculator
      const financials = getCalculatedFinancials(tx.amount, tx.type as any, p as any, settings, tx.destinationBank);
      
      const termCost = tx.providerCharge !== undefined ? tx.providerCharge : 
                       (tx.terminalFee !== undefined ? tx.terminalFee : financials.providerCharge);
      
      const cbnCharge = tx.cbnCharge !== undefined ? tx.cbnCharge : financials.cbnCharge;
      
      const prf = tx.netProfit !== undefined ? tx.netProfit : 
                  (tx.profit !== undefined ? tx.profit : (tx.customerFee - termCost - cbnCharge));
      
      stats[p].volume += tx.amount;
      stats[p].customerFees += tx.customerFee;
      stats[p].terminalCosts += termCost + cbnCharge;
      stats[p].profit += prf;
      stats[p].count += 1;
    });

    return stats;
  }, [transactions, terminalFeeRate]);

  // Aggregate totals to compute percentage weights
  const totalProfitAcrossProviders = useMemo(() => {
    return Object.keys(providerStats).reduce((acc, key) => {
      const stat = providerStats[key];
      return acc + Math.max(stat.profit, 0);
    }, 0);
  }, [providerStats]);

  // Rank providers by profit
  const rankedProviders = useMemo(() => {
    return Object.keys(providerStats).sort((a, b) => providerStats[b].profit - providerStats[a].profit);
  }, [providerStats]);

  // Determine top performing channel
  const topChannel = useMemo(() => {
    const topName = rankedProviders[0] || 'None';
    const maxProfit = providerStats[topName]?.profit || 0;
    return { name: topName, profit: maxProfit };
  }, [providerStats, rankedProviders]);

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-5 space-y-5 shadow-sm">
      
      {/* Header bar */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#00B87A]" /> Terminal Gateway Distribution
          </h3>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Comparative profit share ratios across host manager networks.
          </p>
        </div>
      </div>

      {/* Progress Weight visual bar diagram */}
      <div className="space-y-3.5 bg-neutral-50 p-4 rounded-2xl border border-neutral-200">
        <div className="flex justify-between text-xs text-neutral-600 font-medium">
          <span>Operational Channel Weight</span>
          {totalProfitAcrossProviders > 0 ? (
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> {topChannel.name} Dominates ({topChannel.profit > 0 ? ((topChannel.profit / totalProfitAcrossProviders) * 100).toFixed(1) : 0}%)
            </span>
          ) : (
            <span>No processed inflows logged yet</span>
          )}
        </div>
        
        {/* Dynamic percentage colored segments bar row */}
        <div className="h-4 bg-neutral-200 rounded-full overflow-hidden flex">
          {rankedProviders.map((pvd) => {
            const stat = providerStats[pvd];
            const pct = totalProfitAcrossProviders > 0 ? (Math.max(stat.profit, 0) / totalProfitAcrossProviders) * 100 : 0;
            if (pct <= 0) return null;
            
            const segmentColor = 
              pvd === 'Moniepoint' 
                ? 'bg-blue-500' 
                : pvd === 'OPay' 
                ? 'bg-[#00B87A]' 
                : pvd === 'PalmPay'
                ? 'bg-orange-500'
                : 'bg-neutral-400';

            return (
              <div
                key={pvd}
                style={{ width: `${pct}%` }}
                className={`${segmentColor} h-full transition-all duration-355 relative group`}
                title={`${pvd}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rankedProviders.map((pvd, index) => {
          const stat = providerStats[pvd];
          const colorClass = 
            pvd === 'Moniepoint' ? 'bg-blue-500' : 
            pvd === 'OPay' ? 'bg-[#00B87A]' : 
            pvd === 'PalmPay' ? 'bg-orange-500' : 'bg-neutral-400';
          
          return (
            <div key={pvd} className="bg-neutral-50 hover:bg-white border border-neutral-200 p-4 rounded-2xl space-y-3 relative overflow-hidden transition-colors">
              <div className={`absolute top-0 right-0 w-1.5 h-full ${colorClass}`} />
              <div className="flex justify-between items-center">
                <h4 className={`text-xs font-black uppercase tracking-wider ${colorClass.replace('bg-', 'text-')}`}>
                  {index + 1}. {pvd}
                </h4>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${colorClass.replace('bg-', 'bg-opacity-10 text-')}`}>
                  {stat.count} receipts
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] text-neutral-400 uppercase font-mono tracking-widest block">Net Commission Gain</span>
                <div className="text-base font-extrabold font-mono text-neutral-800">{formatNaira(stat.profit)}</div>
              </div>
              <div className="pt-2 border-t border-neutral-200/60 text-[10px] text-neutral-500 space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>Processed Val:</span>
                  <span className="font-semibold text-neutral-700">{formatNaira(stat.volume)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Costs & EMTL:</span>
                  <span className="text-red-500 font-semibold">-{formatNaira(stat.terminalCosts)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
