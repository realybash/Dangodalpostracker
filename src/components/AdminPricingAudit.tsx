import React from 'react';
import { AppSettings, ProviderType, TransactionType } from '../types';
import { getCalculatedFinancials, formatNaira } from '../utils';
import { AlertTriangle, CheckCircle2, ShieldAlert, Zap, Search, Globe, Filter } from 'lucide-react';

interface AdminPricingAuditProps {
  settings: AppSettings | undefined;
}

export function AdminPricingAudit({ settings }: AdminPricingAuditProps) {
  const providers: ProviderType[] = ['Moniepoint', 'OPay', 'PalmPay'];
  const types: TransactionType[] = ['Withdrawal', 'Transfer', 'Deposit'];
  
  // Test amounts to cover typical range tiers in Nigeria
  const testAmounts = [1000, 5000, 15000, 25000, 60000];

  const auditResults: any[] = [];

  providers.forEach(p => {
    types.forEach(t => {
      testAmounts.forEach(amt => {
        const financials = getCalculatedFinancials(amt, t, p, settings);
        auditResults.push({
          provider: p,
          type: t,
          amount: amt,
          ...financials
        });
      });
    });
  });

  const missingRules = auditResults.filter(r => !r.isConfigured);
  const activeRules = auditResults.filter(r => r.isConfigured);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Audit Header */}
      <div className="bg-neutral-900 text-white p-8 rounded-3xl shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500 text-neutral-900 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Pricing Engine Audit</h1>
          </div>
          <p className="text-neutral-400 text-sm max-w-2xl leading-relaxed">
            Strict Firestore validation enabled. The calculation engine is currently auditing every 
            provider charge rule and regulatory configuration. Hardcoded fallbacks have been 
            permanently disabled.
          </p>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Search className="w-32 h-32" />
        </div>
      </div>

      {/* Critical Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Regulatory Status</span>
          {!settings?.regulatoryConfig ? (
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-bold">Missing Config</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                <span>VAT Rate:</span>
                <span className="text-[#00B87A]">{settings.regulatoryConfig.vatRate}%</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-neutral-800">
                <span>EMTL Fee:</span>
                <span className="text-[#00B87A]">{formatNaira(settings.regulatoryConfig.emtlCharge)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Active Pricing Rules</span>
          <div className="flex items-center gap-2 text-[#00B87A]">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xl font-black font-mono">{activeRules.length}</span>
            <span className="text-xs font-bold text-neutral-500">Verified Path(s)</span>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-sm border-l-4 border-l-red-500">
          <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Missing Rules</span>
          <div className={`flex items-center gap-2 ${missingRules.length > 0 ? 'text-red-600' : 'text-neutral-400'}`}>
            <AlertTriangle className="w-5 h-5" />
            <span className="text-xl font-black font-mono">{missingRules.length}</span>
            <span className="text-xs font-bold">Unconfigured Path(s)</span>
          </div>
        </div>
      </div>

      {/* Missing Rules Table */}
      {missingRules.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-red-100 bg-red-100/30 flex items-center justify-between">
            <h2 className="text-sm font-black text-red-800 flex items-center gap-2 uppercase tracking-tight">
              <Zap className="w-4 h-4 fill-red-500 text-red-500" />
              Critical: Missing Pricing Rules
            </h2>
            <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse">ACTION REQUIRED</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black text-red-400 uppercase tracking-widest border-b border-red-100 font-mono">
                  <th className="px-6 py-4">Provider</th>
                  <th className="px-6 py-4">Tx Type</th>
                  <th className="px-6 py-4">Amount Range</th>
                  <th className="px-6 py-4">Failure Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {missingRules.map((rule, idx) => (
                  <tr key={idx} className="hover:bg-red-100/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-red-900">{rule.provider}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-lg">
                        {rule.type === 'Withdrawal' ? 'Withdraw' : rule.type === 'Deposit' ? 'Money Receive' : rule.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-bold text-red-900">{formatNaira(rule.amount)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[11px] font-medium text-red-600 max-w-xs">{rule.error}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verified Rules Matrix */}
      <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
          <h2 className="text-sm font-black text-neutral-800 flex items-center gap-2 uppercase tracking-tight font-mono">
            <Globe className="w-4 h-4 text-emerald-500" />
            Verified Charge Rule Matrix (Firestore)
          </h2>
          <div className="flex gap-2">
             <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Live Engine
             </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 font-mono">
                <th className="px-6 py-4">Provider</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Cust. Charge</th>
                <th className="px-6 py-4 text-right">Prov. Cost</th>
                <th className="px-6 py-4 text-right">CBN EMTL</th>
                <th className="px-6 py-4 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {activeRules.map((rule, idx) => (
                <tr key={idx} className="hover:bg-neutral-50 transition-colors text-xs font-medium">
                  <td className="px-6 py-4">
                    <span className={`font-black ${
                      rule.provider === 'OPay' ? 'text-emerald-600' : 
                      rule.provider === 'Moniepoint' ? 'text-blue-600' : 
                      'text-orange-600'
                    }`}>{rule.provider}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded uppercase">
                      {rule.type === 'Withdrawal' ? 'Withdraw' : rule.type === 'Deposit' ? 'Money Receive' : rule.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-neutral-800">
                    {formatNaira(rule.amount)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-[#00B87A] font-black">
                    +{formatNaira(rule.customerCharge)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-red-500">
                    -{formatNaira(rule.providerCharge)}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-red-500">
                    -{formatNaira(rule.cbnCharge)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-mono font-black px-2 py-1 rounded-lg ${
                      rule.netProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {formatNaira(rule.netProfit)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
