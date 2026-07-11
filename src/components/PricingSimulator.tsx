import React, { useState, useEffect } from 'react';
import { AppSettings, ProviderType, TransactionType } from '../types';
import { getCalculatedFinancials, formatNaira } from '../utils';
import { Calculator, Info, Zap, AlertCircle } from 'lucide-react';

interface PricingSimulatorProps {
  settings: AppSettings | undefined;
}

export function PricingSimulator({ settings }: PricingSimulatorProps) {
  const [amount, setAmount] = useState<string>('10000');
  const [provider, setProvider] = useState<ProviderType>('Moniepoint');
  const [type, setType] = useState<TransactionType>('Withdrawal');
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    const amt = parseFloat(amount) || 0;
    const res = getCalculatedFinancials(amt, type, provider, settings);
    setResults(res);
  }, [amount, provider, type, settings]);

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-3">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
          <Calculator className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-black text-neutral-800 uppercase tracking-tight">Financial Simulator</h2>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Real-time Rule Verification</p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 font-mono">Transaction Amount (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
              placeholder="Enter amount..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 font-mono">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderType)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="Moniepoint">Moniepoint</option>
                <option value="OPay">OPay</option>
                <option value="PalmPay">PalmPay</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-1.5 font-mono">Tx Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TransactionType)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="Withdrawal">Withdraw</option>
                <option value="Transfer">Transfer</option>
                <option value="Deposit">Money Receive</option>
              </select>
            </div>
          </div>

          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex gap-3">
            <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
              This simulator uses the **currently active** rules in your Firestore configuration. 
              Use this to verify that your pricing rules are behaving as expected before deployment.
            </p>
          </div>
        </div>

        {/* Results */}
        <div className="bg-neutral-900 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            {!results?.isConfigured ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <p className="text-sm font-black text-red-400 uppercase tracking-tight">Calculation Restricted</p>
                <p className="text-xs text-neutral-400 max-w-[200px]">{results?.error || "Rule missing"}</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                  <div>
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1 font-mono">Net Agent Profit</span>
                    <span className={`text-2xl font-black font-mono ${results.netProfit >= 0 ? 'text-[#00B87A]' : 'text-red-500'}`}>
                      {formatNaira(results.netProfit)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block mb-1 font-mono">Efficiency</span>
                    <span className="text-sm font-bold text-white">
                      {((results.netProfit / (parseFloat(amount) || 1)) * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[9px] text-neutral-400 uppercase font-mono block mb-1">Customer Charge</span>
                    <span className="text-sm font-black text-emerald-400">+{formatNaira(results.customerCharge)}</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[9px] text-neutral-400 uppercase font-mono block mb-1">Provider Cost</span>
                    <span className="text-sm font-black text-red-400">-{formatNaira(results.providerCharge)}</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[9px] text-neutral-400 uppercase font-mono block mb-1">CBN EMTL Levy</span>
                    <span className="text-sm font-black text-red-400">-{formatNaira(results.cbnCharge)}</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[9px] text-neutral-400 uppercase font-mono block mb-1">VAT on Cost</span>
                    <span className="text-sm font-black text-neutral-400">-{formatNaira(results.vatAmount)}</span>
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-2">
                   <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                   <span className="text-[10px] font-bold text-neutral-500 uppercase font-mono">Verified by Firestore Engine</span>
                </div>
              </>
            )}
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
            <Calculator className="w-40 h-40" />
          </div>
        </div>
      </div>
    </div>
  );
}
