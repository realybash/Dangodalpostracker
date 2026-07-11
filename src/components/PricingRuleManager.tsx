import React, { useState, useEffect } from 'react';
import { 
  PricingRule, 
  ProviderType, 
  TransactionType, 
  RuleStatus, 
  AppSettings, 
  User 
} from '../types';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  formatNaira, 
  generateId, 
  checkRuleOverlap,
  REALISTIC_PRICING_PROFILE,
  REALISTIC_PROVIDER_CONFIGS,
  REALISTIC_REGULATORY_CONFIG
} from '../utils';
import { 
  Plus, 
  Edit3, 
  Copy, 
  Power, 
  PowerOff, 
  Trash2, 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  History, 
  ChevronRight,
  Filter,
  Search,
  X,
  Save,
  ArrowRight,
  ShieldAlert,
  Zap
} from 'lucide-react';
import { PricingSimulator } from './PricingSimulator';

interface PricingRuleManagerProps {
  currentUser: User | null;
  settings: AppSettings | undefined;
}

export function PricingRuleManager({ currentUser, settings }: PricingRuleManagerProps) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [filterProvider, setFilterProvider] = useState<ProviderType | 'All'>('All');
  const [filterType, setFilterType] = useState<TransactionType | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<PricingRule>>({
    provider: 'Moniepoint',
    type: 'Withdrawal',
    minAmount: 0,
    maxAmount: 1000000,
    customerCharge: 100,
    customerChargeType: 'flat',
    providerCharge: 0.5,
    providerChargeType: 'percent',
    regulatoryCharge: 50,
    vatRate: 7.5,
    status: 'active',
    version: 1,
    effectiveDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!currentUser) return;

    const ownerId = currentUser.role === 'Manager' ? currentUser.uid : currentUser.ownerId;
    const q = query(collection(db, 'pricing_rules'), where('ownerId', '==', ownerId));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRules = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PricingRule[];
      
      setRules(fetchedRules.sort((a, b) => a.minAmount - b.minAmount));
      setLoading(loading && false);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentUser) return;
    const ownerId = currentUser.role === 'Manager' ? currentUser.uid : currentUser.ownerId;

    // Validation
    const overlap = checkRuleOverlap(formData, rules);
    if (overlap) {
      setError(`Overlapping range detected! This amount range conflicts with an existing rule for ${overlap.provider} ${overlap.type} (₦${overlap.minAmount} - ₦${overlap.maxAmount})`);
      return;
    }

    try {
      const dataToSave = {
        ...formData,
        ownerId,
        updatedBy: currentUser.uid,
        updatedAt: new Date().toISOString()
      };

      if (editingRule) {
        // Increment version if financials changed
        if (
          formData.customerCharge !== editingRule.customerCharge ||
          formData.providerCharge !== editingRule.providerCharge ||
          formData.minAmount !== editingRule.minAmount ||
          formData.maxAmount !== editingRule.maxAmount
        ) {
          dataToSave.version = (editingRule.version || 1) + 1;
        }
        
        await updateDoc(doc(db, 'pricing_rules', editingRule.id), dataToSave);
      } else {
        await addDoc(collection(db, 'pricing_rules'), {
          ...dataToSave,
          id: generateId(),
          createdBy: currentUser.uid,
          version: 1
        });
      }

      setIsAdding(false);
      setEditingRule(null);
      resetForm();
    } catch (err) {
      setError('Failed to save pricing rule. Please check your connection.');
    }
  };

  const resetForm = () => {
    setFormData({
      provider: 'Moniepoint',
      type: 'Withdrawal',
      minAmount: 0,
      maxAmount: 1000000,
      customerCharge: 100,
      customerChargeType: 'flat',
      providerCharge: 0.5,
      providerChargeType: 'percent',
      regulatoryCharge: 50,
      vatRate: 7.5,
      status: 'active',
      version: 1,
      effectiveDate: new Date().toISOString().split('T')[0]
    });
  };

  const handleDuplicate = (rule: PricingRule) => {
    setFormData({
      ...rule,
      id: undefined,
      version: 1,
      updatedAt: undefined,
      status: 'inactive' // Start as inactive when duplicated
    });
    setIsAdding(true);
    setEditingRule(null);
  };

  const handleToggleStatus = async (rule: PricingRule) => {
    try {
      const newStatus = rule.status === 'active' ? 'inactive' : 'active';
      await updateDoc(doc(db, 'pricing_rules', rule.id), {
        status: newStatus,
        updatedBy: currentUser?.uid,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      setError('Failed to update status.');
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(rules, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `pricing_rules_export_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleSeedRealisticRules = async () => {
    if (!currentUser) return;
    if (!window.confirm('This will seed realistic 2026 Nigerian POS charges for Moniepoint, OPay, and PalmPay into your account. Continue?')) return;

    setLoading(true);
    const ownerId = currentUser.role === 'Manager' ? currentUser.uid : currentUser.ownerId;
    const batch: PricingRule[] = [];

    // Convert REALISTIC_PRICING_PROFILE ranges into granular PricingRule objects
    const providers: ProviderType[] = ['Moniepoint', 'OPay', 'PalmPay'];
    
    providers.forEach(p => {
      Object.entries(REALISTIC_PRICING_PROFILE.ranges).forEach(([type, ranges]) => {
        ranges.forEach(r => {
          batch.push({
            id: generateId(),
            provider: p,
            type: type as TransactionType,
            minAmount: r.minAmount,
            maxAmount: r.maxAmount,
            customerCharge: r.customerCharge,
            customerChargeType: r.customerChargeType,
            providerCharge: r.providerCharge,
            providerChargeType: r.providerChargeType,
            regulatoryCharge: 50,
            vatRate: 0,
            status: 'active',
            version: 1,
            effectiveDate: new Date().toISOString().split('T')[0],
            createdBy: currentUser.uid,
            updatedBy: currentUser.uid,
            updatedAt: new Date().toISOString()
          });
        });
      });
    });

    try {
      const writeBatchOp = (await import('firebase/firestore')).writeBatch(db);
      batch.forEach(rule => {
        const docRef = doc(collection(db, 'pricing_rules'));
        writeBatchOp.set(docRef, { ...rule, ownerId });
      });
      await writeBatchOp.commit();
      alert('Realistic POS rules seeded successfully!');
    } catch (err) {
      setError('Failed to seed rules.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedRules = JSON.parse(event.target?.result as string);
        if (!Array.isArray(importedRules)) throw new Error('Invalid format');
        
        const ownerId = currentUser.role === 'Manager' ? currentUser.uid : currentUser.ownerId;
        
        for (const rule of importedRules) {
          // Remove ID to create new documents
          const { id, ...data } = rule;
          await addDoc(collection(db, 'pricing_rules'), {
            ...data,
            ownerId,
            createdBy: currentUser.uid,
            updatedBy: currentUser.uid,
            updatedAt: new Date().toISOString()
          });
        }
        alert('Import successful!');
      } catch (err) {
        alert('Failed to import rules. Ensure the file is a valid JSON export.');
      }
    };
    reader.readAsText(file);
  };

  const filteredRules = rules.filter(r => {
    const matchesProvider = filterProvider === 'All' || r.provider === filterProvider;
    const matchesType = filterType === 'All' || r.type === filterType;
    const matchesSearch = r.provider.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProvider && matchesType && matchesSearch && r.status !== 'archived';
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="bg-neutral-900 text-white p-8 rounded-3xl shadow-xl border border-neutral-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00B87A] text-white rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Pricing Rule Management</h1>
            </div>
            <p className="text-neutral-400 text-sm max-w-xl leading-relaxed">
              Create, version, and validate your business pricing matrix. Changes here instantly 
              affect the transaction calculation engine across all cashier terminals.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleSeedRealisticRules}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-900/40 hover:bg-amber-800 text-amber-200 rounded-xl text-xs font-bold border border-amber-800/50 transition"
              title="Seed realistic 2026 Nigerian POS charges (Moniepoint, OPay, PalmPay)"
            >
              <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
              Seed Realistic Rates
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold border border-neutral-700 transition"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-bold border border-neutral-700 transition cursor-pointer">
              <Upload className="w-4 h-4" />
              Import
              <input type="file" className="hidden" accept=".json" onChange={handleImport} />
            </label>
            <button
              onClick={() => { setIsAdding(true); setEditingRule(null); resetForm(); }}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#00B87A] hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-900/20 transition"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              New Pricing Rule
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <History className="w-48 h-48" />
        </div>
      </div>

      {/* Simulator Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-2">
          <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
          <h2 className="text-xs font-black text-neutral-400 uppercase tracking-widest font-mono">Live Rule Validation</h2>
        </div>
        <PricingSimulator settings={settings} />
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-3xl p-6 shadow-sm space-y-6">
            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-3 font-mono">Filter by Provider</label>
              <div className="flex flex-col gap-2">
                {['All', 'Moniepoint', 'OPay', 'PalmPay'].map(p => (
                  <button
                    key={p}
                    onClick={() => setFilterProvider(p as any)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                      filterProvider === p 
                        ? 'bg-neutral-900 text-white shadow-lg' 
                        : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{p}</span>
                    {filterProvider === p && <ChevronRight className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-3 font-mono">Filter by Type</label>
              <div className="flex flex-col gap-2">
                {['All', 'Withdrawal', 'Transfer', 'Deposit'].map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t as any)}
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                      filterType === t 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{t === 'Deposit' ? 'Money Receive' : t}</span>
                    {filterType === t && <ChevronRight className="w-3 h-3" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rules Table */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search rules by provider or transaction type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-neutral-200 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold focus:ring-2 focus:ring-[#00B87A] outline-none transition shadow-sm"
            />
          </div>

          <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 font-mono">
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Provider / Type</th>
                    <th className="px-6 py-4">Amount Range</th>
                    <th className="px-6 py-4">Charge Model</th>
                    <th className="px-6 py-4">Version</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3 text-neutral-400">
                          <Search className="w-8 h-8 opacity-20" />
                          <p className="text-sm font-bold">No matching pricing rules found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-neutral-50 transition-colors group">
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleStatus(rule)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight transition ${
                              rule.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                                : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                            }`}
                          >
                            {rule.status === 'active' ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                            {rule.status}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-neutral-800">{rule.provider}</span>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase font-mono">{rule.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-700">
                            <span>{formatNaira(rule.minAmount)}</span>
                            <ArrowRight className="w-3 h-3 text-neutral-300" />
                            <span>{formatNaira(rule.maxAmount)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <div className="text-[10px] font-bold text-neutral-500">
                              Cust: <span className="text-emerald-600 font-mono">
                                {rule.customerChargeType === 'percent' ? `${rule.customerCharge}%` : formatNaira(rule.customerCharge)}
                              </span>
                            </div>
                            <div className="text-[10px] font-bold text-neutral-400">
                              Prov: <span className="text-red-500 font-mono">
                                {rule.providerChargeType === 'percent' ? `${rule.providerCharge}%` : formatNaira(rule.providerCharge)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-lg w-fit font-mono">
                            v{rule.version || 1}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditingRule(rule); setFormData(rule); setIsAdding(true); }}
                              className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition"
                              title="Edit Rule"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDuplicate(rule)}
                              className="p-2 hover:bg-neutral-100 text-neutral-600 rounded-lg transition"
                              title="Duplicate Rule"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Rule Form Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden border border-neutral-200 animate-in zoom-in-95 duration-300">
            <form onSubmit={handleSave}>
              <div className="p-6 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-neutral-800 uppercase tracking-tight">
                      {editingRule ? `Editing Rule v${editingRule.version}` : 'Create New Pricing Rule'}
                    </h2>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Configuring Charge Logic</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setEditingRule(null); setError(null); }}
                  className="p-2 hover:bg-neutral-100 rounded-xl text-neutral-400 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {error && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex gap-3 items-start animate-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-red-800 leading-relaxed">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Provider</label>
                    <select
                      value={formData.provider}
                      onChange={(e) => setFormData({ ...formData, provider: e.target.value as any })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    >
                      <option value="Moniepoint">Moniepoint</option>
                      <option value="OPay">OPay</option>
                      <option value="PalmPay">PalmPay</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Transaction Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    >
                      <option value="Withdrawal">Withdraw</option>
                      <option value="Transfer">Transfer</option>
                      <option value="Deposit">Money Receive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Min Amount (₦)</label>
                    <input
                      type="number"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: parseFloat(e.target.value) })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Max Amount (₦)</label>
                    <input
                      type="number"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: parseFloat(e.target.value) })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold font-mono focus:ring-2 focus:ring-indigo-500 outline-none transition"
                      required
                    />
                  </div>
                </div>

                <div className="p-6 bg-emerald-50/50 rounded-[24px] border border-emerald-100 space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                     <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                     <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest font-mono">Financials Configuration</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block font-mono">Customer Charge</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.customerCharge}
                          onChange={(e) => setFormData({ ...formData, customerCharge: parseFloat(e.target.value) })}
                          className="flex-1 bg-white border border-emerald-100 rounded-xl px-4 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <select
                          value={formData.customerChargeType}
                          onChange={(e) => setFormData({ ...formData, customerChargeType: e.target.value as any })}
                          className="bg-white border border-emerald-100 rounded-xl px-2 py-2 text-xs font-bold outline-none"
                        >
                          <option value="flat">₦</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block font-mono">Provider Charge</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.providerCharge}
                          onChange={(e) => setFormData({ ...formData, providerCharge: parseFloat(e.target.value) })}
                          className="flex-1 bg-white border border-emerald-100 rounded-xl px-4 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <select
                          value={formData.providerChargeType}
                          onChange={(e) => setFormData({ ...formData, providerChargeType: e.target.value as any })}
                          className="bg-white border border-emerald-100 rounded-xl px-2 py-2 text-xs font-bold outline-none"
                        >
                          <option value="flat">₦</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Regulatory (EMTL) ₦</label>
                      <input
                        type="number"
                        value={formData.regulatoryCharge}
                        onChange={(e) => setFormData({ ...formData, regulatoryCharge: parseFloat(e.target.value) })}
                        className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">VAT Rate (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.vatRate}
                        onChange={(e) => setFormData({ ...formData, vatRate: parseFloat(e.target.value) })}
                        className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-2.5 text-sm font-bold font-mono outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 border-t border-neutral-100 pt-6">
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Effective Date</label>
                    <input
                      type="date"
                      value={formData.effectiveDate?.split('T')[0]}
                      onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2 font-mono">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setEditingRule(null); setError(null); }}
                  className="px-6 py-3 text-xs font-black text-neutral-500 uppercase tracking-widest hover:text-neutral-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-8 py-3 rounded-2xl text-xs font-black shadow-xl shadow-neutral-900/20 transition flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {editingRule ? 'Update Rule' : 'Save Pricing Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
