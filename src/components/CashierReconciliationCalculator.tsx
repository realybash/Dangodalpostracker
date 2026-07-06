import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Plus, Minus, Trash2, Calculator, Save, 
  DollarSign, ArrowDown, TrendingUp, Check, 
  Copy, Share2, Sparkles, RefreshCw, Landmark, 
  ShoppingBag, Edit, AlertCircle, RefreshCcw, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playStatusSound } from './TransactionForm';

interface Entry {
  id: string;
  name: string;
  amount: number;
}

interface CashierReconciliationCalculatorProps {
  onClose: () => void;
  onSave?: (details: { additions: Entry[]; deductions: Entry[]; capital: number; profit: number }) => void;
}

export function CashierReconciliationCalculator({ onClose, onSave }: CashierReconciliationCalculatorProps) {
  // Preset list of registered users / active operator name
  const [operatorName, setOperatorName] = useState('General Operator');
  
  // Core state matching user expectations
  const [additions, setAdditions] = useState<Entry[]>([
    { id: '1', name: 'Counted Cash', amount: 800000 },
    { id: '2', name: 'Moniepoint POS', amount: 155000 },
    { id: '3', name: 'OPay Terminal', amount: 50000 }
  ]);

  const [deductions, setDeductions] = useState<Entry[]>([
    { id: '4', name: 'Malam Audu (Loan)', amount: 100000 },
    { id: '5', name: 'Kasimu Partners', amount: 90000 },
    { id: '6', name: 'Jamilu Deposit', amount: 10000 },
    { id: '7', name: 'Auwal Surcharge', amount: 5000 }
  ]);

  const [capital, setCapital] = useState<number>(1000000);
  
  // Interactive inputs
  const [newAddName, setNewAddName] = useState('');
  const [newAddAmount, setNewAddAmount] = useState('');

  const [newDedName, setNewDedName] = useState('');
  const [newDedAmount, setNewDedAmount] = useState('');

  // Editing state for inline list modifications
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingAmount, setEditingAmount] = useState('');

  // UI notifications / copy state
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Focus references for quick presets workflow
  const addAmountInputRef = useRef<HTMLInputElement>(null);
  const dedAmountInputRef = useRef<HTMLInputElement>(null);

  // Load operator name securely on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem('POSTrack_State_Store_v5');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed?.currentUser?.name) {
          setOperatorName(parsed.currentUser.name);
        }
      }
    } catch (err) {
      console.error('Error fetching cashier active session:', err);
    }
  }, []);

  // Quick Tags lists to speed up high velocity cashier logs
  const COUNTED_PRESETS = [
    { name: 'Cash', icon: '💵' },
    { name: 'OPay POS', icon: '📱' },
    { name: 'Moniepoint', icon: '🏦' },
    { name: 'PalmPay', icon: '🌴' },
    { name: 'Bank Transfer', icon: '💳' },
  ];

  const DEDUCTION_PRESETS = [
    { name: 'Malam Audu', icon: '👤' },
    { name: 'Kasimu', icon: '👥' },
    { name: 'Generator Fuel', icon: '⛽' },
    { name: 'Staff Lunch', icon: '🍖' },
    { name: 'Terminal Charge', icon: '🚚' },
  ];

  const CAPITAL_PRESETS = [
    { label: '₦100k', value: 100000 },
    { label: '₦200k', value: 200000 },
    { label: '₦500k', value: 500000 },
    { label: '₦1M', value: 1000000 },
    { label: '₦2M', value: 2000000 },
  ];

  // Core math
  const totalAdditions = additions.reduce((sum, item) => sum + item.amount, 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + item.amount, 0);
  const profit = totalAdditions - totalDeductions - capital;

  // Format utility avoiding ugly ₦-200,000 and displaying beautiful -₦200,000
  const formatNairaVal = (amount: number): string => {
    const isNegative = amount < 0;
    const absVal = Math.abs(amount);
    return `${isNegative ? '-' : ''}₦${absVal.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  // Additions form action
  const handleAddAdditionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = Number(newAddAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      playStatusSound('Failed');
      return;
    }
    const finalName = newAddName.trim() || `Cash Count #${additions.length + 1}`;
    setAdditions([...additions, { id: Date.now().toString(), name: finalName, amount: parsedAmt }]);
    setNewAddName('');
    setNewAddAmount('');
    playStatusSound('Success');
  };

  // Deductions form action
  const handleAddDeductionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = Number(newDedAmount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      playStatusSound('Failed');
      return;
    }
    const finalName = newDedName.trim() || `Deduction #${deductions.length + 1}`;
    setDeductions([...deductions, { id: Date.now().toString(), name: finalName, amount: parsedAmt }]);
    setNewDedName('');
    setNewDedAmount('');
    playStatusSound('Success');
  };

  // Remove elements
  const removeAddition = (id: string) => {
    setAdditions(additions.filter(a => a.id !== id));
    playStatusSound('Failed');
  };

  const removeDeduction = (id: string) => {
    setDeductions(deductions.filter(d => d.id !== id));
    playStatusSound('Failed');
  };

  // Preset click helpers
  const handleApplyCountedPreset = (presetName: string) => {
    setNewAddName(presetName);
    addAmountInputRef.current?.focus();
  };

  const handleApplyDeductionPreset = (presetName: string) => {
    setNewDedName(presetName);
    dedAmountInputRef.current?.focus();
  };

  // Inline edit state handlers
  const startInlineEdit = (item: Entry) => {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingAmount(item.amount.toString());
  };

  const saveInlineEdit = (isAddList: boolean) => {
    const parsedAmt = Number(editingAmount);
    if (!editingName.trim() || isNaN(parsedAmt) || parsedAmt <= 0) {
      playStatusSound('Failed');
      return;
    }

    if (isAddList) {
      setAdditions(prev => prev.map(item => item.id === editingId ? { ...item, name: editingName.trim(), amount: parsedAmt } : item));
    } else {
      setDeductions(prev => prev.map(item => item.id === editingId ? { ...item, name: editingName.trim(), amount: parsedAmt } : item));
    }
    setEditingId(null);
    playStatusSound('Success');
  };

  // Restart calculator
  const startFresh = () => {
    if (window.confirm('Are you sure you want to reset this calculator sheet? All counted fields and deductions will be cleared.')) {
      setAdditions([]);
      setDeductions([]);
      setCapital(0);
      playStatusSound('Failed');
    }
  };

  // Copy structured report for WhatsApp/SMS status messaging (extremely popular with Nigerian agency operators)
  const handleCopyWhatsAppReport = () => {
    const dateStr = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
    
    let text = `*📊 DAN GODAL AGENCY BALANCE SHEET*\n`;
    text += `==============================\n`;
    text += `*👤 Operator:* ${operatorName}\n`;
    text += `*📅 Date:* ${dateStr} | ${timeStr}\n`;
    text += `==============================\n\n`;
    
    text += `*💵 COUNTED BALANCES:*\n`;
    additions.forEach(item => {
      text += `• _${item.name}:_ *${formatNairaVal(item.amount)}*\n`;
    });
    text += `------------------------------\n`;
    text += `*Gross Counted:* *${formatNairaVal(totalAdditions)}*\n\n`;
    
    text += `*💸 DEDUCTIONS / OTHER FUNDS:*\n`;
    deductions.forEach(item => {
      text += `• _${item.name}:_ -*${formatNairaVal(item.amount)}*\n`;
    });
    text += `------------------------------\n`;
    text += `*Total Deductions:* -*${formatNairaVal(totalDeductions)}*\n\n`;
    
    text += `*💰 INITIAL CAPITAL:* *${formatNairaVal(capital)}*\n`;
    text += `==============================\n`;
    
    if (profit >= 0) {
      text += `*🎉 STATUS: RECONCILED & BALANCED* ✅\n`;
      text += `*📈 REALIZED PROFIT:* *${formatNairaVal(profit)}*\n`;
    } else {
      text += `*⚠️ STATUS: CASH SHORTFALL / DEFICIT* ❌\n`;
      text += `*📉 CASH DEFICIT:* *${formatNairaVal(profit)}*\n`;
    }
    text += `==============================\n`;
    text += `_Generated via Dan Godal Terminal Auditor_`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    playStatusSound('Success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      id="reconciliation-calculator-overlay"
      className="fixed inset-0 z-[150] bg-neutral-900/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', duration: 0.4 }}
        className="bg-neutral-50 rounded-3xl w-full max-w-4xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col my-auto"
        id="reconciliation-calculator-modal"
      >
        {/* MODAL HEADER - OPay Styled Branding */}
        <div className="bg-gradient-to-r from-[#00B87A] via-emerald-700 to-indigo-950 text-white px-6 py-4 flex justify-between items-center border-b border-emerald-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Calculator className="w-5 h-5 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight leading-tight uppercase font-sans">Cashier Terminal Auditor</h3>
                <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full font-mono">
                  Active
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 font-medium">Reconcile counted counter cash, external partner logs, and capital offsets</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/20 text-white/95 rounded-xl transition duration-100 cursor-pointer active:scale-95"
            title="Close modal"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* BODY CONTAINER */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(100vh-160px)] space-y-6">
          
          {/* INSTRUCTION TIP BANNER */}
          <div className="bg-emerald-50/55 border border-emerald-100/80 p-3.5 rounded-2xl flex items-start gap-3">
            <Info className="w-4 h-4 text-[#00B87A] shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 font-medium leading-relaxed">
              <span className="font-extrabold text-[#00B87A] uppercase mr-1">Cashier Instruction:</span>
              Input your counter cash bundles, active POS machine wallet totals, then add external debts or expenses below. Tapping any listed balance lets you edit it inline!
            </div>
          </div>

          {/* REAL-TIME LIVE SCORECARD DASHBOARD */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3.5 border border-neutral-150 rounded-2xl shadow-xs" id="live-auditing-scoreboard">
            {/* Card 1: Total Counted */}
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 flex flex-col justify-between transition hover:shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">Total Counted</span>
                <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3 text-emerald-600 stroke-[3]" />
                </div>
              </div>
              <div>
                <span className="text-base sm:text-lg font-black font-mono text-emerald-700 block tracking-tight">
                  {formatNairaVal(totalAdditions)}
                </span>
                <span className="text-[9px] font-medium text-emerald-600 block">Total Cash Added</span>
              </div>
            </div>

            {/* Card 2: Total Minusing */}
            <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-3 flex flex-col justify-between transition hover:shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">Total Minusing</span>
                <div className="w-5 h-5 rounded bg-rose-100 flex items-center justify-center shrink-0">
                  <Minus className="w-3 h-3 text-rose-600 stroke-[3]" />
                </div>
              </div>
              <div>
                <span className="text-base sm:text-lg font-black font-mono text-rose-700 block tracking-tight">
                  -{formatNairaVal(totalDeductions)}
                </span>
                <span className="text-[9px] font-medium text-rose-600 block">Expenses/Debts Deducted</span>
              </div>
            </div>

            {/* Card 3: Shift Capital */}
            <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 flex flex-col justify-between transition hover:shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800">Shift Capital</span>
                <div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                  <Landmark className="w-3 h-3 text-indigo-600" />
                </div>
              </div>
              <div>
                <span className="text-base sm:text-lg font-black font-mono text-indigo-700 block tracking-tight">
                  {formatNairaVal(capital)}
                </span>
                <span className="text-[9px] font-medium text-indigo-600 block">Initial Cash Offset</span>
              </div>
            </div>

            {/* Card 4: Net Balance Outcome */}
            <div className={`border rounded-xl p-3 flex flex-col justify-between shadow-xs transition ${
              profit >= 0 
                ? 'bg-emerald-600 border-emerald-600 text-white animate-pulse' 
                : 'bg-rose-600 border-rose-600 text-white animate-pulse'
            }`}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-90">Net Reconciled</span>
                <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                  profit >= 0 ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'
                }`}>
                  {profit >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                </div>
              </div>
              <div>
                <span className="text-base sm:text-lg font-black font-mono block tracking-tight">
                  {formatNairaVal(profit)}
                </span>
                <span className="text-[9px] font-bold block opacity-90">
                  {profit >= 0 ? '🎉 Balanced & Safe' : '⚠️ Shortage Deficit'}
                </span>
              </div>
            </div>
          </div>

          {/* TWO COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT SIDE: CONTROL PANEL AND DATA INPUTS (col-span-7) */}
            <div className="lg:col-span-7 space-y-5" id="calculator-inputs-section">

            {/* SECTION 1: ADDITIONS / ALL COUNTED MONEY */}
            <div className="bg-white border border-neutral-150 rounded-2xl p-4 shadow-sm" id="counted-money-card">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
                <div>
                  <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    All Counted Money (On-Hand + Terminals)
                  </h4>
                  <p className="text-[10px] font-semibold text-neutral-400 mt-0.5">
                    {additions.length} active balances logged
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-150 block">
                    {formatNairaVal(totalAdditions)}
                  </span>
                </div>
              </div>

              {/* Additions list */}
              <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto pr-1">
                {additions.length === 0 ? (
                  <div className="text-center py-4 text-xs text-neutral-400 font-medium italic border border-dashed border-neutral-200 rounded-xl">
                    No money bundles registered yet. Use form below to add.
                  </div>
                ) : (
                  additions.map((item) => (
                    <div 
                      key={item.id} 
                      className={`group flex justify-between items-center p-2.5 rounded-xl text-xs transition border ${
                        editingId === item.id 
                          ? 'border-emerald-400 bg-emerald-50/30 ring-1 ring-emerald-400' 
                          : 'border-neutral-100 bg-neutral-50 hover:border-emerald-200 hover:bg-emerald-50/10'
                      }`}
                    >
                      {editingId === item.id ? (
                        /* Inline Edit Mode */
                        <div className="flex gap-2 w-full items-center">
                          <input 
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs font-bold text-neutral-800 focus:outline-none focus:border-emerald-500 flex-grow"
                          />
                          <input 
                            type="number"
                            value={editingAmount}
                            onChange={(e) => setEditingAmount(e.target.value)}
                            className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-emerald-800 w-24 focus:outline-none focus:border-emerald-500"
                          />
                          <button 
                            onClick={() => saveInlineEdit(true)}
                            className="p-1 bg-[#00B87A] text-white rounded-lg hover:bg-emerald-600 cursor-pointer"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      ) : (
                        /* Default display mode */
                        <>
                          <div 
                            className="flex items-center gap-2 cursor-pointer flex-grow" 
                            onClick={() => startInlineEdit(item)}
                            title="Click to edit balance"
                          >
                            <span className="font-extrabold text-neutral-800 hover:text-[#00B87A] transition">{item.name}</span>
                            <Edit className="w-3 h-3 text-neutral-300 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {formatNairaVal(item.amount)}
                            </span>
                            <button 
                              onClick={() => removeAddition(item.id)} 
                              className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Quick Preset Tags for Additions */}
              <div className="mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1.5">
                  ⚡ Quick presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COUNTED_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyCountedPreset(preset.name)}
                      className="px-2.5 py-1 bg-neutral-100 hover:bg-emerald-50 border border-neutral-200 hover:border-emerald-300 text-neutral-600 hover:text-emerald-800 text-[11px] font-bold rounded-full transition active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddAdditionSubmit} className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text" 
                  placeholder="Label (e.g. OPay POS)" 
                  value={newAddName} 
                  onChange={(e) => setNewAddName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-250 rounded-xl px-3.5 py-2.5 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A] focus:bg-white transition"
                />
                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                  <input 
                    ref={addAmountInputRef}
                    type="number" 
                    placeholder="Amount (₦)" 
                    value={newAddAmount} 
                    onChange={(e) => setNewAddAmount(e.target.value)}
                    className="w-full sm:w-32 bg-neutral-50 border border-neutral-250 rounded-xl px-3.5 py-2.5 text-xs font-black font-mono text-emerald-850 focus:outline-none focus:border-[#00B87A] focus:bg-white transition"
                  />
                  <button 
                    type="submit" 
                    disabled={!newAddAmount || Number(newAddAmount) <= 0}
                    className="bg-[#00B87A] hover:bg-emerald-600 disabled:opacity-40 text-white px-4 rounded-xl transition cursor-pointer flex items-center justify-center font-bold text-xs gap-1.5 shrink-0"
                    title="Add counted balance"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" /> Add
                  </button>
                </div>
              </form>
            </div>

            {/* SECTION 2: DEDUCTIONS / OTHER PEOPLE'S FUNDS OR EXPENSES */}
            <div className="bg-white border border-neutral-150 rounded-2xl p-4 shadow-sm" id="deductions-money-card">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-100">
                <div>
                  <h4 className="text-xs font-black text-rose-800 uppercase tracking-widest flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Deduct (Others' Money / Expenses)
                  </h4>
                  <p className="text-[10px] font-semibold text-neutral-400 mt-0.5">
                    {deductions.length} active offsets logged
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs sm:text-sm font-black font-mono text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-150 block">
                    -{formatNairaVal(totalDeductions)}
                  </span>
                </div>
              </div>

              {/* Deductions list */}
              <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto pr-1">
                {deductions.length === 0 ? (
                  <div className="text-center py-4 text-xs text-neutral-400 font-medium italic border border-dashed border-neutral-200 rounded-xl">
                    No active deductions. Counter capital is clean of offsets.
                  </div>
                ) : (
                  deductions.map((item) => (
                    <div 
                      key={item.id} 
                      className={`group flex justify-between items-center p-2.5 rounded-xl text-xs transition border ${
                        editingId === item.id 
                          ? 'border-rose-400 bg-rose-50/30 ring-1 ring-rose-400' 
                          : 'border-neutral-100 bg-neutral-50 hover:border-rose-200 hover:bg-rose-50/10'
                      }`}
                    >
                      {editingId === item.id ? (
                        /* Inline Edit Mode */
                        <div className="flex gap-2 w-full items-center">
                          <input 
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs font-bold text-neutral-800 focus:outline-none focus:border-rose-500 flex-grow"
                          />
                          <input 
                            type="number"
                            value={editingAmount}
                            onChange={(e) => setEditingAmount(e.target.value)}
                            className="bg-white border border-neutral-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-rose-800 w-24 focus:outline-none focus:border-rose-500"
                          />
                          <button 
                            onClick={() => saveInlineEdit(false)}
                            className="p-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      ) : (
                        /* Default display mode */
                        <>
                          <div 
                            className="flex items-center gap-2 cursor-pointer flex-grow" 
                            onClick={() => startInlineEdit(item)}
                            title="Click to edit balance"
                          >
                            <span className="font-extrabold text-neutral-800 hover:text-rose-700 transition">{item.name}</span>
                            <Edit className="w-3 h-3 text-neutral-300 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                              {formatNairaVal(item.amount)}
                            </span>
                            <button 
                              onClick={() => removeDeduction(item.id)} 
                              className="text-neutral-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Quick Preset Tags for Deductions */}
              <div className="mb-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1.5">
                  ⚡ Quick presets:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {DEDUCTION_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyDeductionPreset(preset.name)}
                      className="px-2.5 py-1 bg-neutral-100 hover:bg-rose-50 border border-neutral-200 hover:border-rose-300 text-neutral-600 hover:text-rose-800 text-[11px] font-bold rounded-full transition active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddDeductionSubmit} className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text" 
                  placeholder="Label (e.g. Malam Audu)" 
                  value={newDedName} 
                  onChange={(e) => setNewDedName(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-250 rounded-xl px-3.5 py-2.5 text-xs font-bold text-neutral-800 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
                <div className="flex gap-2 w-full sm:w-auto shrink-0">
                  <input 
                    ref={dedAmountInputRef}
                    type="number" 
                    placeholder="Amount (₦)" 
                    value={newDedAmount} 
                    onChange={(e) => setNewDedAmount(e.target.value)}
                    className="w-full sm:w-32 bg-neutral-50 border border-neutral-250 rounded-xl px-3.5 py-2.5 text-xs font-black font-mono text-rose-850 focus:outline-none focus:border-rose-500 focus:bg-white transition"
                  />
                  <button 
                    type="submit" 
                    disabled={!newDedAmount || Number(newDedAmount) <= 0}
                    className="bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white px-4 rounded-xl transition cursor-pointer flex items-center justify-center font-bold text-xs gap-1.5 shrink-0"
                    title="Add deduction"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" /> Add
                  </button>
                </div>
              </form>
            </div>

            {/* SECTION 3: INITIAL CAPITAL TRACKER */}
            <div className="bg-white border border-neutral-150 rounded-2xl p-4 shadow-sm" id="capital-money-card">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-3">
                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Initial Shift Capital (Baseline Cash on Hand)
                </h4>
                <span className="text-[10px] font-sans font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
                  Required offset
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                <div className="relative md:col-span-5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-black font-mono text-indigo-500">₦</span>
                  <input 
                    type="number" 
                    value={capital || ''}
                    placeholder="0"
                    onChange={(e) => setCapital(Number(e.target.value))}
                    className="w-full bg-neutral-50 border border-neutral-250 rounded-xl pl-8 pr-4 py-3 text-base font-black font-mono text-indigo-950 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div className="md:col-span-7 flex flex-wrap gap-1.5">
                  {CAPITAL_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        setCapital(preset.value);
                        playStatusSound('Success');
                      }}
                      className={`px-3 py-2 text-xs font-bold font-mono rounded-xl transition cursor-pointer ${
                        capital === preset.value
                          ? 'bg-indigo-600 text-white shadow-sm border border-indigo-600'
                          : 'bg-neutral-100 hover:bg-indigo-50 text-neutral-600 hover:text-indigo-800 border border-neutral-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setCapital(0);
                      playStatusSound('Failed');
                    }}
                    className="px-3 py-2 text-xs font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer"
                    title="Reset Capital to zero"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* QUICK SHEET ACTIONS */}
            <div className="flex justify-between items-center bg-neutral-100/60 p-3.5 rounded-2xl border border-neutral-200">
              <span className="text-xs text-neutral-500 font-bold">Clear entire worksheet?</span>
              <button 
                onClick={startFresh}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-700 text-xs font-black rounded-xl tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Start Fresh
              </button>
            </div>

          </div>

          {/* RIGHT SIDE: INTERACTIVE RECEIPT (col-span-5) */}
          <div className="lg:col-span-5 flex flex-col h-full" id="calculator-receipt-section">
            <div className="bg-neutral-250 rounded-3xl p-2.5 border border-neutral-350 shadow-inner flex flex-col h-full bg-neutral-200">
              
              {/* THERMAL PAPER RECEIPT COMPONENT */}
              <div 
                className="bg-[#FAFAFA] text-neutral-800 border-x border-dashed border-neutral-400 rounded-2xl p-4 sm:p-5 flex flex-col h-full min-h-[460px] font-mono shadow-md relative overflow-hidden"
                style={{ backgroundImage: 'radial-gradient(circle, #fcfcfc 0%, #f7f7f7 100%)' }}
              >
                {/* PAPER TEAR JAGGED DECORATION */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-[linear-gradient(45deg,transparent_33.333%,#FAFAFA_33.333%,#FAFAFA_66.666%,transparent_66.666%),linear-gradient(-45deg,transparent_33.333%,#FAFAFA_33.333%,#FAFAFA_66.666%,transparent_66.666%)] bg-[size:10px_10px] bg-repeat-x z-20" />
                
                {/* BARCODE SLIP LOGO */}
                <div className="flex flex-col items-center justify-center opacity-85 py-1 mb-3">
                  <div className="w-full max-w-[160px] h-7 flex items-center gap-[1px] justify-center">
                    {[1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1].map((w, idx) => (
                      <div key={idx} className="bg-neutral-800 h-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                  <span className="text-[8px] font-mono tracking-[4px] text-neutral-450 mt-1 uppercase text-center w-full">
                    * RECON-SYS-2026 *
                  </span>
                </div>

                {/* SLIP LOGO HEADER */}
                <div className="text-center space-y-0.5 pb-3 border-b border-dashed border-neutral-350">
                  <h4 className="text-sm font-black text-neutral-900 tracking-tight">DAN GODAL ENTERPRISES</h4>
                  <p className="text-[10px] text-neutral-500 leading-tight">LAGOS CENTRAL AGENCY TERMINAL</p>
                  <p className="text-[9px] text-neutral-400">SUPPORT HOTLINE: 080-OPAY-RECON</p>
                </div>

                {/* METADATA BLOCK */}
                <div className="py-3 text-[10px] space-y-1 text-neutral-600 border-b border-dashed border-neutral-350">
                  <div className="flex justify-between">
                    <span>OPERATOR:</span>
                    <span className="font-bold text-neutral-800 uppercase">{operatorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE & TIME:</span>
                    <span className="font-bold text-neutral-800">
                      {new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short' })} | {new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>STATUS:</span>
                    <span className={`font-bold px-1.5 py-0.2 rounded ${profit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 animate-pulse'}`}>
                      {profit >= 0 ? 'BALANCED' : 'SHORTFALL'}
                    </span>
                  </div>
                </div>

                {/* WATERFALL BALANCES */}
                <div className="py-4 space-y-3.5 flex-1 overflow-y-auto text-[11px]">
                  
                  {/* GROSS COUNTED HEADER */}
                  <div className="flex justify-between items-center text-xs font-black text-neutral-900 border-b border-neutral-300 pb-1">
                    <span>GROSS COUNTED (A)</span>
                    <span className="text-emerald-700">{formatNairaVal(totalAdditions)}</span>
                  </div>

                  {/* CASCADING BALANCES DEDUCTIONS */}
                  <div className="space-y-2">
                    {deductions.length === 0 ? (
                      <div className="text-neutral-400 italic text-[10px] py-1 text-center">
                        (No deductions recorded)
                      </div>
                    ) : (
                      (() => {
                        let currentBalance = totalAdditions;
                        return deductions.map((item) => {
                          currentBalance -= item.amount;
                          return (
                            <div key={item.id} className="space-y-0.5 border-l-2 border-neutral-200 pl-2.5">
                              <div className="flex justify-between text-neutral-500 text-[10px]">
                                <span className="truncate max-w-[130px]">- {item.name}</span>
                                <span className="text-rose-600">-{formatNairaVal(item.amount)}</span>
                              </div>
                              <div className="flex justify-between text-neutral-600 font-bold text-[10px]">
                                <span className="opacity-60 text-[9px] font-sans">SUBTOTAL</span>
                                <span>{formatNairaVal(currentBalance)}</span>
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>

                  {/* CAPITAL SUBTRACTION STEP */}
                  <div className="pt-2 border-t border-dashed border-neutral-300">
                    <div className="flex justify-between items-center text-neutral-500 text-[10px]">
                      <span className="font-bold flex items-center gap-1">
                        <span className="text-indigo-600">●</span> SHIFT CAPITAL (B)
                      </span>
                      <span className="text-indigo-600 font-bold">-{formatNairaVal(capital)}</span>
                    </div>
                  </div>

                </div>

                {/* RECEIPT RESULTS BLOCK (FINTECH SLIP OUTCOME) */}
                <div className="mt-auto space-y-2.5">
                  <div className="border-t-2 border-dashed border-neutral-400 pt-3" />
                  
                  <div className={`p-4 rounded-2xl text-center ${
                    profit >= 0 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-950' 
                      : 'bg-rose-50 border border-rose-200 text-rose-950'
                  }`}>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest block opacity-75 mb-1 text-neutral-500">
                      SHIFT BALANCE SHEET (A - B)
                    </span>
                    
                    <div className="flex items-center justify-center gap-2">
                      {profit >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
                      )}
                      <span className={`text-2xl font-black font-mono tracking-tight ${
                        profit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        {formatNairaVal(profit)}
                      </span>
                    </div>
                    
                    <span className="text-[9px] font-bold block mt-1 uppercase tracking-wider">
                      {profit >= 0 
                        ? '🎉 Shift Balances Properly' 
                        : '⚠️ ALERT: CASH MISSING FROM TILL!'
                      }
                    </span>
                  </div>

                  {/* Copy report button inside receipt */}
                  <button
                    type="button"
                    onClick={handleCopyWhatsAppReport}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition duration-150 border cursor-pointer active:scale-95 ${
                      copied 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-300 shadow-xs'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Copied Report!
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" /> Share WhatsApp Report
                      </>
                    )}
                  </button>
                </div>

              </div>

            </div>
          </div>

          {/* End of TWO COLUMN GRID */}
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
          <div className="text-[11px] text-neutral-400 font-mono font-bold text-center sm:text-left">
            SECURE AUDITING LOGS • ALL RECONCILIATIONS REMAIN PRIVATE
          </div>
          
          <div className="flex justify-end gap-3 w-full sm:w-auto">
            <button 
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-3 bg-white border border-neutral-350 hover:bg-neutral-50 text-neutral-700 text-xs font-black rounded-xl tracking-wider uppercase transition cursor-pointer text-center"
            >
              Cancel Audit
            </button>
            
            <button 
              type="button"
              onClick={() => {
                if (onSave) onSave({ additions, deductions, capital, profit });
                setSavedSuccess(true);
                playStatusSound('Success');
                setTimeout(() => {
                  setSavedSuccess(false);
                  onClose();
                }, 1200);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-black rounded-xl tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-lg active:scale-95 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> Calculations Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-emerald-400" /> Save Audit
                </>
              )}
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
