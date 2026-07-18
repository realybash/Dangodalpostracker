/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Transaction, ProviderType } from '../types';
import { formatNaira } from '../utils';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { TrendingUp, RefreshCw, Calendar, Sparkles } from 'lucide-react';

interface TrendChartProps {
  transactions: Transaction[];
  terminalFeeRate: number;
  chartStyle?: 'line' | 'bar' | 'area';
}

export function TrendChart({ transactions, terminalFeeRate, chartStyle = 'line' }: TrendChartProps) {
  const [daysCount, setDaysCount] = useState<7 | 15>(7);

  // Dynamic daily aggregation
  const trendData = useMemo(() => {
    const dates: { label: string; key: string }[] = [];
    const now = new Date();
    
    // Generate buckets for the last X days (in chronological order for line charts)
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dateVal = String(d.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${dateVal}`;
      
      dates.push({ label, key });
    }

    const trendMap = new Map<string, Record<ProviderType, number>>();
    dates.forEach(d => {
      trendMap.set(d.key, { OPay: 0, Moniepoint: 0, PalmPay: 0 });
    });

    // Group profits based on active transaction timestamps
    transactions.forEach(tx => {
      // Robust date parsing (Firestore Timestamp or ISO String)
      const txDate = tx.timestamp && (tx.timestamp as any).toDate 
        ? (tx.timestamp as any).toDate() 
        : new Date(tx.timestamp);
        
      const year = txDate.getFullYear();
      const month = String(txDate.getMonth() + 1).padStart(2, '0');
      const dateVal = String(txDate.getDate()).padStart(2, '0');
      const key = `${year}-${month}-${dateVal}`;

      if (trendMap.has(key)) {
        const bucket = trendMap.get(key)!;
        bucket[tx.provider] += tx.profit;
      }
    });

    return dates.map(d => {
      const bucket = trendMap.get(d.key)!;
      return {
        date: d.label,
        OPay: Number(bucket.OPay.toFixed(2)),
        Moniepoint: Number(bucket.Moniepoint.toFixed(2)),
        PalmPay: Number(bucket.PalmPay.toFixed(2)),
        Total: Number((bucket.OPay + bucket.Moniepoint + bucket.PalmPay).toFixed(2))
      };
    });
  }, [transactions, daysCount]);

  // Insights computation for highlights section
  const insights = useMemo(() => {
    let maxDayProfit = 0;
    let maxDayLabel = 'N/A';
    let totalPeriodProfit = 0;
    
    let opaySum = 0;
    let moniepointSum = 0;
    let palmpaySum = 0;

    trendData.forEach(d => {
      const dayTotal = d.OPay + d.Moniepoint + d.PalmPay;
      totalPeriodProfit += dayTotal;
      opaySum += d.OPay;
      moniepointSum += d.Moniepoint;
      palmpaySum += d.PalmPay;

      if (dayTotal > maxDayProfit) {
        maxDayProfit = dayTotal;
        maxDayLabel = d.date;
      }
    });

    // Find dominate provider name
    let topProviderName = 'Moniepoint';
    let topProviderShare = moniepointSum;

    if (opaySum > topProviderShare) {
      topProviderName = 'OPay';
      topProviderShare = opaySum;
    }
    if (palmpaySum > topProviderShare) {
      topProviderName = 'PalmPay';
      topProviderShare = palmpaySum;
    }

    return {
      maxDayProfit,
      maxDayLabel,
      totalPeriodProfit,
      topProviderName,
      topProviderShare
    };
  }, [trendData]);

  // Sleek Dark Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-neutral-900 text-white p-3.5 rounded-2xl shadow-xl font-mono text-xs space-y-2 select-none border border-neutral-850">
          <p className="text-neutral-300 font-bold border-b border-neutral-800 pb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" /> {label} Index
          </p>
          <div className="space-y-1">
            {payload.map((entry: any) => (
              <div key={entry.name} className="flex justify-between items-center gap-5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-neutral-400">{entry.name}:</span>
                </span>
                <span className="font-bold text-right" style={{ color: entry.color }}>
                  {formatNaira(entry.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl p-5 space-y-5 shadow-sm">
      
      {/* Chart toolbar header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-1.5 mt-1">
            <AreaChart className="w-4.5 h-4.5 text-[#00B87A]" /> Channel Commision Daily Trends
          </h3>
          <p className="text-xs text-neutral-500 mt-1 font-medium">
            Timeline analytics contrasting positive yields in chronological order.
          </p>
        </div>

        {/* Dynamic Selectors */}
        <div className="flex items-center bg-neutral-100 rounded-xl p-1 border border-neutral-200">
          <button
            type="button"
            onClick={() => setDaysCount(7)}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
              daysCount === 7 
                ? 'bg-[#00B87A] text-white shadow-sm' 
                : 'text-neutral-500 hover:text-[#00B87A]'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setDaysCount(15)}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition cursor-pointer ${
              daysCount === 15 
                ? 'bg-[#00B87A] text-white shadow-sm' 
                : 'text-neutral-500 hover:text-[#00B87A]'
            }`}
          >
            15 Days
          </button>
        </div>
      </div>

      {/* Grid of highlights & quick summaries */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl space-y-1 shadow-sm">
          <span className="text-[9px] text-neutral-450 font-mono uppercase tracking-widest block font-bold">Period Combined Yield</span>
          <div className="text-lg font-black font-mono text-[#00B87A]">
            {formatNaira(insights.totalPeriodProfit)}
          </div>
          <span className="text-[10px] text-neutral-500 font-medium block">Aggregated profit return</span>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl space-y-1 shadow-sm">
          <span className="text-[9px] text-neutral-450 font-mono uppercase tracking-widest block font-bold">Top Performing Operator</span>
          <div className="text-lg font-black font-mono text-neutral-800 flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${
              insights.topProviderName === 'OPay' 
                ? 'bg-[#00B87A]' 
                : insights.topProviderName === 'Moniepoint' 
                ? 'bg-blue-500' 
                : insights.topProviderName === 'PalmPay'
                ? 'bg-orange-500'
                : 'bg-neutral-400'
            }`} />
            {insights.topProviderName}
          </div>
          <span className="text-[10px] text-emerald-600 font-bold block">
            ₦{insights.topProviderShare.toFixed(2)} contribution
          </span>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 p-4 rounded-2xl space-y-1 shadow-sm">
          <span className="text-[9px] text-neutral-450 font-mono uppercase tracking-widest block font-bold">Timeline Record Spike</span>
          <div className="text-lg font-black font-mono text-neutral-800">
            {insights.maxDayLabel}
          </div>
          <span className="text-[10px] text-amber-600 font-bold block">
            Peak Day Profit: {formatNaira(insights.maxDayProfit)}
          </span>
        </div>
      </div>

      {/* Dynamic Recharts Visualization based on chartStyle settings */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartStyle === 'area' ? (
            <AreaChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₦${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', color: '#4b5563', paddingTop: '10px' }}
              />
              <Area type="monotone" dataKey="OPay" name="OPay Channel" stroke="#00B87A" fill="#00B87A" fillOpacity={0.15} />
              <Area type="monotone" dataKey="Moniepoint" name="Moniepoint Blue" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
              <Area type="monotone" dataKey="PalmPay" name="PalmPay Channels" stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
              <Area type="monotone" dataKey="Total" name="Combined Net Profit" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.05} strokeDasharray="4 4" />
            </AreaChart>
          ) : chartStyle === 'bar' ? (
            <BarChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₦${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', color: '#4b5563', paddingTop: '10px' }}
              />
              <Bar dataKey="OPay" name="OPay Channel" fill="#00B87A" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Moniepoint" name="Moniepoint Blue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="PalmPay" name="PalmPay Channels" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart
              data={trendData}
              margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis 
                dataKey="date" 
                stroke="#9ca3af" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={10} 
                fontFamily="monospace"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `₦${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', color: '#4b5563', paddingTop: '10px' }}
              />
              <Line type="monotone" dataKey="OPay" name="OPay Channel" stroke="#00B87A" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Moniepoint" name="Moniepoint Blue" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="PalmPay" name="PalmPay Channels" stroke="#f97316" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Total" name="Combined Net Profit" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

    </div>
  );
}
