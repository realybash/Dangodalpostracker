import React from 'react';
import { formatNaira } from '../utils';
import { TrendingUp, Calendar, DollarSign, Activity } from 'lucide-react';
import { motion } from 'motion/react';

interface RealizedGainHistoryProps {
  stats: {
    daily: any;
    weekly: any;
    monthly: any;
    yearly: any;
  };
}

export function RealizedGainHistory({ stats }: RealizedGainHistoryProps) {
  const timeframes = [
    { label: 'Daily', data: stats.daily, icon: Activity },
    { label: 'Weekly', data: stats.weekly, icon: Calendar },
    { label: 'Monthly', data: stats.monthly, icon: TrendingUp },
    { label: 'Yearly', data: stats.yearly, icon: DollarSign },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-sm space-y-6"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-emerald-600" />
        </div>
        <h3 className="text-sm font-extrabold text-neutral-850 uppercase tracking-widest font-mono">
          Realized Gain History
        </h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {timeframes.map((tf) => (
          <div key={tf.label} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex items-center gap-4 hover:border-emerald-200 transition-colors">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <tf.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 font-mono">{tf.label}</p>
              <p className="text-lg font-black text-emerald-900 font-mono tracking-tight">{formatNaira(tf.data.profit)}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
