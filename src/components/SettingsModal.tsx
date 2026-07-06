/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppSettings, ProviderType, TransactionType } from '../types';
import { playStatusSound } from './TransactionForm';
import { 
  X, 
  Settings, 
  Volume2, 
  VolumeX, 
  FileText, 
  Check, 
  Trash2, 
  RefreshCw, 
  Smartphone, 
  Store, 
  Percent, 
  Activity, 
  Sparkles,
  LayoutGrid,
  Lock,
  Eye,
  Megaphone,
  Palette,
  Sun,
  Moon
} from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  terminalFeeRate: 0.25 | 0.5;
  dailyTarget: number;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onUpdateTerminalRate: (rate: 0.25 | 0.5) => void;
  onUpdateDailyTarget: (target: number) => void;
  onResetDatabase: () => void;
  onClearLocalCache: () => void;
  onClose: () => void;
}

export function SettingsModal({
  settings,
  terminalFeeRate,
  dailyTarget,
  onUpdateSettings,
  onUpdateTerminalRate,
  onUpdateDailyTarget,
  onResetDatabase,
  onClearLocalCache,
  onClose
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'terminal' | 'receipt' | 'preferences' | 'system'>('terminal');

  // Internal states to prevent lagging inputs
  const [editBusinessName, setEditBusinessName] = useState(settings.businessName);
  const [editReceiptAddress, setEditReceiptAddress] = useState(settings.receiptAddress);
  const [editReceiptPhone, setEditReceiptPhone] = useState(settings.receiptPhone);
  const [editReceiptFooter, setEditReceiptFooter] = useState(settings.receiptFooter);
  const [editDailyTarget, setEditDailyTarget] = useState(dailyTarget);
  const [editTerminalRate, setEditTerminalRate] = useState<0.25 | 0.5>(terminalFeeRate);

  // Success indicators
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Voice synthesis tester
  const handleTestSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const textToSpeak = `Hello Agent. This is a voice broadcast test for your OPay Manager ${editBusinessName || 'Terminal'}. All systems are operating at maximum velocity!`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Speech synthesis is not supported in this browser version.");
    }
  };

  // Sound tester
  const handleTestChime = () => {
    playStatusSound('Success');
  };

  const handleApplyChanges = () => {
    onUpdateSettings({
      businessName: editBusinessName.trim() || 'OPay Manager POS',
      receiptAddress: editReceiptAddress.trim() || 'No. 12 Broad Street, Lagos',
      receiptPhone: editReceiptPhone.trim() || '0700-OPAY-HELP',
      receiptFooter: editReceiptFooter.trim() || 'Thank you for banking with OPay!'
    });

    onUpdateTerminalRate(editTerminalRate);
    onUpdateDailyTarget(Math.max(0, editDailyTarget));

    // Play chime contextually
    if (settings.soundEnabled) {
      playStatusSound('Success');
    }

    setSaveSuccessMsg('System configurations successfully saved and updated!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl border border-neutral-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header Ribbon */}
        <div className="bg-[#00B87A] text-white p-5 flex justify-between items-center select-none shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-white/10 rounded-2xl">
              <Settings className="w-5 h-5 text-white animate-spin-slow" />
            </span>
            <div>
              <h3 className="font-extrabold text-[#ffffff] text-base tracking-tight leading-none">POS System settings</h3>
              <p className="text-[10px] text-emerald-100 font-mono mt-1.5 uppercase tracking-wider font-bold">Terminal ID Master Control Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateSettings({ language: settings.language === 'en' ? 'ha' : 'en' })}
              className="px-3 py-1.5 text-xs font-black bg-white text-[#00B87A] rounded-lg hover:bg-emerald-50 transition-all cursor-pointer"
            >
              {settings.language === 'en' ? 'Switch to Hausa' : 'Switch to English'}
            </button>
            <button
              onClick={onClose}
              type="button"
              className="p-1 px-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
              title="Close parameters settings panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Save confirmation header toast notification info */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-100 p-3 text-center text-xs font-black text-emerald-800 animate-slide-down flex items-center justify-center gap-2">
            <Check className="w-4 h-4 stroke-[3]" /> {saveSuccessMsg}
          </div>
        )}

        <div className="flex flex-col md:flex-row flex-grow overflow-hidden">
          
          {/* Settings Tabs Sidebar */}
          <div className="w-full md:w-20 bg-neutral-50 border-r border-neutral-200 p-3 flex flex-row justify-center md:flex-col gap-3 shrink-0 select-none items-center">
            <button
              onClick={() => setActiveTab('terminal')}
              type="button"
              className={`w-10 h-10 rounded-full transition-all flex items-center justify-center border shadow-sm relative group cursor-pointer active:scale-90 ${
                activeTab === 'terminal'
                  ? 'bg-white border-neutral-300 text-[#00B87A] scale-105 ring-2 ring-[#00B87A]/20'
                  : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
              }`}
              title="Fees & Targets"
            >
              <Percent className="w-4 h-4" />
              <span className="absolute left-14 bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-10 hidden md:block">
                Fees & Targets
              </span>
            </button>
            <button
              onClick={() => setActiveTab('receipt')}
              type="button"
              className={`w-10 h-10 rounded-full transition-all flex items-center justify-center border shadow-sm relative group cursor-pointer active:scale-90 ${
                activeTab === 'receipt'
                  ? 'bg-white border-neutral-300 text-[#00B87A] scale-105 ring-2 ring-[#00B87A]/20'
                  : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
              }`}
              title="Receipt Customizer"
            >
              <FileText className="w-4 h-4" />
              <span className="absolute left-14 bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-10 hidden md:block">
                Receipt Customizer
              </span>
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              type="button"
              className={`w-10 h-10 rounded-full transition-all flex items-center justify-center border shadow-sm relative group cursor-pointer active:scale-90 ${
                activeTab === 'preferences'
                  ? 'bg-white border-neutral-300 text-[#00B87A] scale-105 ring-2 ring-[#00B87A]/20'
                  : 'bg-transparent border-transparent text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
              }`}
              title="Voice & Layout FX"
            >
              <Volume2 className="w-4 h-4" />
              <span className="absolute left-14 bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-10 hidden md:block">
                Voice, Theme & Layout FX
              </span>
            </button>
            <button
              onClick={() => setActiveTab('system')}
              type="button"
              className={`w-10 h-10 rounded-full transition-all flex items-center justify-center border shadow-sm relative group cursor-pointer active:scale-90 ${
                activeTab === 'system'
                  ? 'bg-red-50 border-red-200 text-rose-600 scale-105 ring-2 ring-rose-500/10'
                  : 'bg-transparent border-transparent text-neutral-400 hover:text-rose-600 hover:bg-neutral-100'
              }`}
              title="Maintenance Reset"
            >
              <Trash2 className="w-4 h-4" />
              <span className="absolute left-14 bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-10 hidden md:block">
                Maintenance Reset
              </span>
            </button>
          </div>

          {/* Active Settings Tab View Area */}
          <div className="flex-grow p-5 md:p-6 overflow-y-auto space-y-5">
            
            {/* TERMINAL & DAILY TARGETS */}
            {activeTab === 'terminal' && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-neutral-150 pb-2">
                  <h4 className="text-sm font-black text-neutral-800 uppercase font-mono flex items-center gap-1">
                    <Activity className="w-4 h-4 text-emerald-500" /> Terminal Baseline Charge
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-normal font-medium">
                    Select default discount packages for withdrawals. This baseline commission affects calculation values of net profits.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Select Baseline Commission Tier</label>
                  <div className="grid grid-cols-2 gap-3.5">
                    {[
                      { rate: 0.25, title: 'OPay Promo Tier', desc: '0.25% Cash out POS Cost, max ₦100 cap' },
                      { rate: 0.5, title: 'OPay Standard Tier', desc: '0.50% Cash out POS Cost, max ₦100 cap' }
                    ].map((tier) => (
                      <button
                        key={tier.rate}
                        type="button"
                        onClick={() => setEditTerminalRate(tier.rate as 0.25 | 0.5)}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          editTerminalRate === tier.rate
                            ? 'bg-[#00B87A]/10 border-[#00B87A] text-[#00B87A] ring-1 ring-[#00B87A]'
                            : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                        }`}
                      >
                        <div className="font-extrabold text-xs">{tier.title}</div>
                        <div className="text-[10px] text-neutral-500 font-medium mt-1">{tier.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Daily Shift Goal Target (₦)</label>
                    <span className="text-[10px] font-mono font-black text-[#00B87A]">Default benchmark benchmarks</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-mono font-bold">₦</span>
                      <input
                        type="number"
                        value={editDailyTarget}
                        onChange={(e) => setEditDailyTarget(parseInt(e.target.value) || 0)}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-6 pr-3.5 py-2.5 text-neutral-800 font-mono font-black text-xs focus:outline-none focus:bg-white focus:border-[#00B87A]"
                        placeholder="e.g. 5000"
                        min="0"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      {[2000, 3000, 5000, 10000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditDailyTarget(preset)}
                          className="px-2.5 py-2 hover:bg-neutral-100 border border-neutral-200 text-[10px] font-mono font-bold text-neutral-600 rounded-lg cursor-pointer transition active:scale-95"
                        >
                          ₦{preset / 1000}k
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-[9.5px] text-neutral-400 italic">
                    Adjusts progress trackers seen on dashboards, motivating operators toward target volume profit thresholds!
                  </p>
                </div>

              </div>
            )}

            {/* RECEIPT CONFIGURATIONS */}
            {activeTab === 'receipt' && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-neutral-150 pb-2">
                  <h4 className="text-sm font-black text-neutral-800 uppercase font-mono flex items-center gap-1">
                    <Store className="w-4 h-4 text-emerald-500" /> Thermal Receipt Branding
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-normal font-medium">
                    Personalize outputs rendered dynamically under high-fidelity digital receipts and slips.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Business Name / Header</label>
                    <input
                      type="text"
                      value={editBusinessName}
                      onChange={(e) => setEditBusinessName(e.target.value)}
                      placeholder="e.g. OPay Manager Ventures"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-850 font-bold text-xs focus:outline-none focus:bg-white focus:border-[#00B87A]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Branding Contact Phone</label>
                    <input
                      type="text"
                      value={editReceiptPhone}
                      onChange={(e) => setEditReceiptPhone(e.target.value)}
                      placeholder="e.g. 08123456789"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-850 font-bold text-xs focus:outline-none focus:bg-white focus:border-[#00B87A]"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Business Office Address</label>
                    <input
                      type="text"
                      value={editReceiptAddress}
                      onChange={(e) => setEditReceiptAddress(e.target.value)}
                      placeholder="e.g. Plot 15, Murtala Muhammed Way, Kano State"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-850 font-bold text-xs focus:outline-none focus:bg-white focus:border-[#00B87A]"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Footer Warm Greet / Clause Remark</label>
                    <textarea
                      rows={2}
                      value={editReceiptFooter}
                      onChange={(e) => setEditReceiptFooter(e.target.value)}
                      placeholder="e.g. Thank you for patronage! No cash refund on deposit once ticket is printed."
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:bg-white focus:border-[#00B87A] resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PREFERENCES: VOICE, SOUND FX, LAYOUTS */}
            {activeTab === 'preferences' && (
              <div className="space-y-4 animate-fade-in">
                <div className="border-b border-neutral-150 pb-2">
                  <h4 className="text-sm font-black text-neutral-800 uppercase font-mono flex items-center gap-1">
                    <Megaphone className="w-4 h-4 text-[#00B87A]" /> Voice Cues & Layout Preferences
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-normal font-medium">
                    Configure sounds, speech broadcasts, landing layouts and pagination size preferences.
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    
                    {/* Sound FX Card with Small Icon Buttons */}
                    <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-extrabold text-neutral-750">Audible Status Chimes</p>
                        <p className="text-[10px] text-neutral-500 font-medium">Trigger acoustic tones.</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                            settings.soundEnabled 
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
                              : 'bg-white text-neutral-400 border-neutral-200 hover:bg-neutral-50'
                          }`}
                          title={settings.soundEnabled ? "Disable Sounds" : "Enable Sounds"}
                        >
                          {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={handleTestChime}
                          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200 flex items-center justify-center cursor-pointer transition active:scale-90"
                          title="Test Chime Sound"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Speech Voice Card with Small Icon Buttons */}
                    <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-extrabold text-neutral-750">Speech Synthesis Prompts</p>
                        <p className="text-[10px] text-neutral-500 font-medium">Speak action feedback aloud.</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ voiceEnabled: !settings.voiceEnabled })}
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                            settings.voiceEnabled 
                              ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
                              : 'bg-white text-neutral-400 border-neutral-200 hover:bg-neutral-50'
                          }`}
                          title={settings.voiceEnabled ? "Disable Voice Guidance" : "Enable Voice Guidance"}
                        >
                          <Megaphone className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={handleTestSpeech}
                          className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border border-neutral-200 flex items-center justify-center cursor-pointer transition active:scale-90"
                          title="Test Speech Synthesis"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        </button>
                      </div>
                    </div>

                    {/* Dark Theme Card with Small Icon Toggle */}
                    <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 flex items-center justify-between gap-3 sm:col-span-2">
                      <div className="space-y-0.5">
                        <p className="text-xs font-extrabold text-neutral-750">Night-time Agent Operations</p>
                        <p className="text-[10px] text-neutral-500 font-medium font-sans">Toggle global dark palette layout for eye-safe night duties.</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateSettings({ darkMode: !settings.darkMode })}
                          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                            settings.darkMode 
                              ? 'bg-[#00B87A] text-white border-[#00B87A] shadow-sm shadow-[#00B87A]/20' 
                              : 'bg-white text-neutral-500 border-neutral-250 hover:bg-neutral-50'
                          }`}
                          title={settings.darkMode ? "Disable Dark Palette" : "Enable Dark Palette"}
                        >
                          {settings.darkMode ? <Moon className="w-5 h-5 fill-white" /> : <Sun className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-neutral-100 pt-3.5">
                    
                    {/* Rows Density Selector */}
                    <div className="space-y-1.5 text-xs">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Rows Packing Density</label>
                      <select
                        value={settings.listDensity}
                        onChange={(e) => onUpdateSettings({ listDensity: e.target.value as 'compact' | 'comfortable' })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-neutral-805 font-bold"
                      >
                        <option value="compact">⚡ Compact Pack Mode</option>
                        <option value="comfortable">Comfortable Modern Padding</option>
                      </select>
                      <span className="text-[9px] text-neutral-400 block font-normal">Controls row space density inside transaction tables.</span>
                    </div>

                    {/* Pagination page Size Selection */}
                    <div className="space-y-1.5 text-xs">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Pagination Slice Size</label>
                      <select
                        value={settings.pageSize}
                        onChange={(e) => onUpdateSettings({ pageSize: parseInt(e.target.value) || 10 })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-neutral-805 font-bold font-mono"
                      >
                        <option value={5}>5 Rows Per Frame</option>
                        <option value={10}>10 Rows Per Frame</option>
                        <option value={20}>20 Rows Per Frame</option>
                        <option value={50}>50 Rows Per Frame</option>
                      </select>
                      <span className="text-[9px] text-neutral-400 block font-normal">Divides logs into custom chunks to minimize scrolling.</span>
                    </div>

                    {/* Default Type */}
                    <div className="space-y-1.5 text-xs">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Default Category Start</label>
                      <select
                        value={settings.defaultType}
                        onChange={(e) => onUpdateSettings({ defaultType: e.target.value as TransactionType })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-neutral-805 font-bold"
                      >
                        <option value="Withdrawal">Cash out POS</option>
                        <option value="Deposit">Deposit (Cash-in)</option>
                        <option value="Transfer">Bank Transfer</option>
                      </select>
                    </div>

                    {/* Default POS Provider */}
                    <div className="space-y-1.5 text-xs">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Default Network Partner</label>
                      <select
                        value={settings.defaultProvider}
                        onChange={(e) => onUpdateSettings({ defaultProvider: e.target.value as ProviderType })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-neutral-805 font-bold"
                      >
                        <option value="OPay">OPay Terminal Partner</option>
                        <option value="Moniepoint">Moniepoint Terminal Partner</option>
                        <option value="PalmPay">PalmPay Terminal Partner</option>
                      </select>
                    </div>

                    {/* Visual Chart Type preference */}
                    <div className="space-y-1.5 text-xs">
                      <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block font-mono">Default Trend Visualization</label>
                      <select
                        value={settings.chartStyle}
                        onChange={(e) => onUpdateSettings({ chartStyle: e.target.value as 'line' | 'bar' | 'area' })}
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-neutral-805 font-bold"
                      >
                        <option value="line">📈 Dynamic Vector Line Chart</option>
                        <option value="area">🎨 Layered Spline Area Chart</option>
                        <option value="bar">📊 Segmented Tall Bar Histogram</option>
                      </select>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* MAINTENANCE & DB OPTIONS */}
            {activeTab === 'system' && (
              <div className="space-y-4 animate-fade-in text-xs">
                <div className="border-b border-red-100/55 pb-2">
                  <h4 className="text-sm font-black text-rose-600 uppercase font-mono flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-500" /> Caution Room: Advanced Operations
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-1 leading-normal font-medium">
                    Performing system operations can cause loss of transactional histories. Backup or download CSV first.
                  </p>
                </div>

                <div className="p-4 bg-red-50/50 border border-red-150 rounded-2xl space-y-4 mt-2">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-red-150/40 pb-3.5">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-neutral-805 block">Clean Seed Database</span>
                      <span className="text-[10px] text-neutral-500 leading-normal block">
                        Seed default transaction logs inside your local offline index. (This voids current live transactions).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Are you sure you want to restore baseline simulated index records? Current ledger transactions will be replaced.")) {
                          onResetDatabase();
                          playStatusSound('Success');
                          onClose();
                        }
                      }}
                      className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-extrabold rounded-xl text-center cursor-pointer select-none transition"
                    >
                      Restore Seeds
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pt-1">
                    <div className="space-y-0.5">
                      <span className="font-extrabold text-rose-700 block">Purge Local Storage State</span>
                      <span className="text-[10px] text-neutral-500 leading-normal block">
                        Deletes every record, employee logs, credential parameters, and default settings. Your app is set back to factory vanilla.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("🚨 CRITICAL WARNING!\n\nThis wipes all POS transaction entries, cash logs, employee switches, and settings. This action is 100% irreversible. Proceed?")) {
                          onClearLocalCache();
                          onClose();
                          window.location.reload();
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-center cursor-pointer select-none transition flex items-center gap-1.5 shadow-sm shadow-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" />
                      Wipe Cache
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer controls */}
        <div className="bg-neutral-50 p-4 border-t border-neutral-200 flex justify-between items-center select-none shrink-0 gap-3">
          <span className="text-[10px] text-[#00B87A] font-medium font-mono hidden sm:inline">Settings fully integrated across components</span>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleApplyChanges}
              type="button"
              className="flex-grow sm:flex-grow-0 py-2.5 px-6 bg-[#00B87A] hover:bg-emerald-600 text-white font-black text-xs rounded-xl cursor-pointer transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              Save Configurations
            </button>
            <button
              onClick={onClose}
              type="button"
              className="py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-250 text-neutral-600 font-bold text-xs rounded-xl cursor-pointer transition"
            >
              Close Panel
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
