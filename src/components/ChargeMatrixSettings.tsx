import React, { useState } from 'react';
import { ProviderChargeConfig, RegulatoryConfig, ChargeRule } from '../types';
import { formatNaira } from '../utils';
import { Settings2, Save, RotateCcw, AlertCircle, Info, ChevronRight, Calculator, ShieldCheck, RefreshCw } from 'lucide-react';

interface ChargeMatrixSettingsProps {
  providerConfigs: ProviderChargeConfig[];
  regulatoryConfig: RegulatoryConfig;
  onSave: (configs: ProviderChargeConfig[], regulatory: RegulatoryConfig) => void;
}

export const ChargeMatrixSettings: React.FC<ChargeMatrixSettingsProps> = ({
  providerConfigs,
  regulatoryConfig,
  onSave
}) => {
  const safeProviderConfigs = Array.isArray(providerConfigs) ? providerConfigs : [];
  const [localConfigs, setLocalConfigs] = useState<ProviderChargeConfig[]>(safeProviderConfigs);
  const [localRegulatory, setLocalRegulatory] = useState<RegulatoryConfig>(regulatoryConfig);
  const [activeProviderId, setActiveProviderId] = useState<string>(safeProviderConfigs[0]?.id || 'Moniepoint');
  const [hasChanges, setHasChanges] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const activeProvider = Array.isArray(localConfigs) ? localConfigs.find(p => p.id === activeProviderId) : undefined;

  const simulateApiSync = async () => {
    setIsSyncing(true);
    // Simulate API delay
    await new Promise(r => setTimeout(r, 1500));
    
    // Slight random adjustments to simulate real-time rate updates from providers
    const updated = localConfigs.map(p => ({
      ...p,
      lastUpdated: new Date().toLocaleTimeString(),
      withdrawal: {
        ...p.withdrawal,
        value: p.id === 'Moniepoint' ? 0.55 : p.withdrawal.value // Moniepoint slight adjust
      }
    }));
    
    setLocalConfigs(updated);
    setIsSyncing(false);
    setHasChanges(true);
  };

  const handleRuleChange = (
    ruleName: keyof Omit<ProviderChargeConfig, 'id' | 'name' | 'posCost' | 'lastUpdated'>,
    field: keyof ChargeRule,
    value: any
  ) => {
    if (!activeProvider) return;

    const updatedConfigs = localConfigs.map(p => {
      if (p.id === activeProviderId) {
        return {
          ...p,
          [ruleName]: {
            ...p[ruleName],
            [field]: value
          }
        };
      }
      return p;
    });

    setLocalConfigs(updatedConfigs);
    setHasChanges(true);
  };

  const handleRegulatoryChange = (field: keyof RegulatoryConfig, value: number) => {
    setLocalRegulatory({ ...localRegulatory, [field]: value });
    setHasChanges(true);
  };

  const saveChanges = () => {
    onSave(localConfigs, localRegulatory);
    setHasChanges(false);
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00B87A]/10 rounded-2xl flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-[#00B87A]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-neutral-800 font-mono uppercase tracking-tight">Dynamic Charge Rule Matrix</h3>
            <p className="text-[10px] text-neutral-500 font-medium">Configure terminal provider costs and regulatory levies</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={simulateApiSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 text-xs font-black rounded-xl hover:bg-blue-100 transition-all disabled:opacity-50 font-mono"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync API Rates'}
          </button>

          {hasChanges && (
            <button
              onClick={saveChanges}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#00B87A] text-white text-xs font-black rounded-xl shadow-lg shadow-[#00B87A]/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer font-mono"
            >
              <Save className="w-3.5 h-3.5" /> Commit Rules
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row min-h-[400px]">
        {/* Sidebar: Provider Selection */}
        <div className="w-full md:w-64 border-r border-neutral-100 bg-neutral-50/20 p-4 space-y-2">
          <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest px-2">Terminal Providers</span>
          {localConfigs.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProviderId(p.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeProviderId === p.id 
                ? 'bg-white border border-neutral-200 text-[#00B87A] shadow-sm' 
                : 'text-neutral-500 hover:bg-neutral-100/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${activeProviderId === p.id ? 'bg-[#00B87A]' : 'bg-neutral-300'}`} />
                {p.name}
              </div>
              <ChevronRight className={`w-4 h-4 opacity-50 ${activeProviderId === p.id ? 'block' : 'hidden'}`} />
            </button>
          ))}
          
          <div className="pt-6 px-2">
            <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Global Regulatory</span>
            <button
              onClick={() => setActiveProviderId('regulatory')}
              className={`w-full mt-2 flex items-center gap-2.5 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                activeProviderId === 'regulatory' 
                ? 'bg-white border border-neutral-200 text-amber-600 shadow-sm' 
                : 'text-neutral-500 hover:bg-neutral-100/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              CBN & VAT Config
            </button>
          </div>
        </div>

        {/* Main Panel: Rule Editor */}
        <div className="flex-1 p-6">
          {activeProviderId === 'regulatory' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                  <strong>Warning:</strong> Regulatory charges (EMTL and VAT) are mandated by Nigerian law. 
                  Adjusting these will affect the Net Agent Profit across all providers.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                    CBN EMTL Threshold
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">₦</span>
                    <input
                      type="number"
                      value={localRegulatory.emtlThreshold}
                      onChange={(e) => handleRegulatoryChange('emtlThreshold', Number(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 pl-8 text-sm font-bold font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[9px] text-neutral-400">Transactions above this amount incur EMTL</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                    EMTL Charge Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">₦</span>
                    <input
                      type="number"
                      value={localRegulatory.emtlCharge}
                      onChange={(e) => handleRegulatoryChange('emtlCharge', Number(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 pl-8 text-sm font-bold font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[9px] text-neutral-400">Standard Nigerian levy (default ₦50)</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1.5">
                    VAT Rate (%)
                  </label>
                  <div className="relative">
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-mono text-xs">%</span>
                    <input
                      type="number"
                      value={localRegulatory.vatRate}
                      step="0.1"
                      onChange={(e) => handleRegulatoryChange('vatRate', Number(e.target.value))}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl p-3 pr-8 text-sm font-bold font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <p className="text-[9px] text-neutral-400">Value Added Tax applied to provider costs</p>
                </div>
              </div>
            </div>
          ) : activeProvider ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="text-lg font-black text-neutral-800 font-mono tracking-tight">{activeProvider.name}</h4>
                  <div className="bg-[#00B87A]/10 text-[#00B87A] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">Active</div>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase block">Last Data Sync</span>
                  <span className="text-[10px] font-black text-neutral-600 font-mono">{activeProvider.lastUpdated || 'Automatic'}</span>
                </div>
              </div>

              {/* Transaction Type Rule Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Withdrawal Rule */}
                <RuleCard 
                  title="Cash Withdrawal" 
                  rule={activeProvider.withdrawal} 
                  onChange={(field, value) => handleRuleChange('withdrawal', field, value)} 
                />
                
                {/* Transfer Rule */}
                <RuleCard 
                  title="Bank Transfer" 
                  rule={activeProvider.transfer} 
                  onChange={(field, value) => handleRuleChange('transfer', field, value)} 
                />

                {/* Deposit Rule */}
                <RuleCard 
                  title="Money Receive" 
                  rule={activeProvider.deposit} 
                  onChange={(field, value) => handleRuleChange('deposit', field, value)} 
                />

                {/* Airtime Rule */}
                <RuleCard 
                  title="Airtime & Data" 
                  rule={activeProvider.airtime} 
                  onChange={(field, value) => handleRuleChange('airtime', field, value)} 
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

interface RuleCardProps {
  title: string;
  rule: ChargeRule;
  onChange: (field: keyof ChargeRule, value: any) => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ title, rule, onChange }) => {
  return (
    <div className="bg-neutral-50/50 border border-neutral-100 rounded-2xl p-5 space-y-4 hover:border-[#00B87A]/20 transition-all">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
        <h5 className="text-[11px] font-black text-neutral-700 uppercase tracking-widest flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-[#00B87A]" /> {title}
        </h5>
        <div className="flex bg-white border border-neutral-200 rounded-lg p-0.5 shadow-xs">
          <button 
            onClick={() => onChange('type', 'flat')}
            className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${rule.type === 'flat' ? 'bg-[#00B87A] text-white' : 'text-neutral-400'}`}
          >
            FLAT
          </button>
          <button 
            onClick={() => onChange('type', 'percent')}
            className={`px-2 py-1 text-[9px] font-black rounded-md transition-all ${rule.type === 'percent' ? 'bg-[#00B87A] text-white' : 'text-neutral-400'}`}
          >
            %
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Value</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              value={rule.value}
              onChange={(e) => onChange('value', Number(e.target.value))}
              className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-xs font-bold font-mono focus:outline-none focus:border-[#00B87A]"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 font-bold">{rule.type === 'percent' ? '%' : '₦'}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Cap (Max Charge)</label>
          <div className="relative">
            <input
              type="number"
              value={rule.cap || ''}
              placeholder="No Cap"
              onChange={(e) => onChange('cap', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-xs font-bold font-mono focus:outline-none focus:border-[#00B87A]"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-400 font-bold">₦</span>
          </div>
        </div>

        {/* Conditional Threshold Fields */}
        <div className="col-span-2 pt-2 border-t border-dashed border-neutral-200 space-y-4">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              checked={!!rule.threshold} 
              onChange={(e) => onChange('threshold', e.target.checked ? 20000 : undefined)}
              className="accent-[#00B87A] w-3.5 h-3.5"
            />
            <span className="text-[10px] font-bold text-neutral-500">Enable Threshold Scaling</span>
          </div>

          {rule.threshold !== undefined && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Threshold</label>
                <input
                  type="number"
                  value={rule.threshold}
                  onChange={(e) => onChange('threshold', Number(e.target.value))}
                  className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-xs font-bold font-mono focus:outline-none focus:border-[#00B87A]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Value Above Threshold</label>
                <input
                  type="number"
                  value={rule.aboveThresholdValue || ''}
                  onChange={(e) => onChange('aboveThresholdValue', Number(e.target.value))}
                  className="w-full bg-white border border-neutral-200 rounded-xl p-2 text-xs font-bold font-mono focus:outline-none focus:border-[#00B87A]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
