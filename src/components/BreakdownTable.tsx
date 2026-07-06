import React from 'react';
import { formatNaira } from '../utils';

interface BreakdownData {
  count: number;
  profit: number;
  breakdowns: {
    Deposit: { count: number; profit: number };
    Withdrawal: { count: number; profit: number };
    Transfer: { count: number; profit: number };
  };
}

interface BreakdownTableProps {
  daily: BreakdownData;
  weekly: BreakdownData;
  monthly: BreakdownData;
  yearly: BreakdownData;
  allTime: BreakdownData;
  totalAllTimeCount: number;
}

export function BreakdownTable({ daily, weekly, monthly, yearly, allTime, totalAllTimeCount }: BreakdownTableProps) {
  const periods = [
    { label: 'Daily', data: daily },
    { label: 'Weekly', data: weekly },
    { label: 'Monthly', data: monthly },
    { label: 'Yearly', data: yearly },
    { label: 'All-Time', data: allTime },
  ];

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl shadow-sm overflow-hidden mt-6">
      <div className="p-4 border-b border-neutral-200 bg-neutral-50/50 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold font-mono text-neutral-800 uppercase tracking-widest flex items-center gap-2">
            <span>📊</span> Comprehensive Profit & Count Breakdown
          </h3>
          <p className="text-xs text-neutral-500 mt-1">Detailed spread of transaction types across all periods</p>
        </div>
        <div className="text-[11px] font-mono font-bold text-neutral-600 bg-white shadow-sm border border-neutral-200 px-3 py-1.5 rounded-lg">
          Total All-Time: {totalAllTimeCount} Txns
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-neutral-100 text-neutral-600 text-[10px] uppercase font-mono tracking-wider">
              <th className="p-4 font-bold border-b border-neutral-200">Transaction Type</th>
              {periods.map(p => (
                <th key={p.label} className="p-4 font-bold border-b border-neutral-200 text-right">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-sm">
            {/* DEPOSIT ROW */}
            <tr className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
              <td className="p-4 font-medium text-neutral-700">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm"></div>
                  Deposit
                </div>
              </td>
              {periods.map(p => (
                <td key={`dep-${p.label}`} className="p-4 text-right">
                  <div className="font-bold text-neutral-800">{formatNaira(p.data.breakdowns.Deposit.profit)}</div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{p.data.breakdowns.Deposit.count} txns</div>
                </td>
              ))}
            </tr>
            {/* WITHDRAWAL ROW */}
            <tr className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
              <td className="p-4 font-medium text-neutral-700">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm"></div>
                  Withdrawal
                </div>
              </td>
              {periods.map(p => (
                <td key={`wit-${p.label}`} className="p-4 text-right">
                  <div className="font-bold text-neutral-800">{formatNaira(p.data.breakdowns.Withdrawal.profit)}</div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{p.data.breakdowns.Withdrawal.count} txns</div>
                </td>
              ))}
            </tr>
            {/* TRANSFER ROW */}
            <tr className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
              <td className="p-4 font-medium text-neutral-700">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm"></div>
                  Transfer
                </div>
              </td>
              {periods.map(p => (
                <td key={`tra-${p.label}`} className="p-4 text-right">
                  <div className="font-bold text-neutral-800">{formatNaira(p.data.breakdowns.Transfer.profit)}</div>
                  <div className="text-[11px] text-neutral-500 font-mono mt-0.5">{p.data.breakdowns.Transfer.count} txns</div>
                </td>
              ))}
            </tr>
            {/* TOTALS ROW */}
            <tr className="bg-[#00B87A]/5 border-t-2 border-[#00B87A]/20">
              <td className="p-4 font-black text-[#00B87A] uppercase text-xs tracking-wider">
                Total Realized
              </td>
              {periods.map(p => (
                <td key={`tot-${p.label}`} className="p-4 text-right">
                  <div className="font-black text-[#00B87A] text-base">{formatNaira(p.data.profit)}</div>
                  <div className="text-xs text-[#00B87A]/80 font-mono font-bold mt-0.5">{p.data.count} Total Txns</div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
