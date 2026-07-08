import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { formatNaira } from '../utils';
import { 
  X, 
  UserCheck, 
  Key, 
  ArrowRightLeft, 
  Phone, 
  TrendingUp, 
  Activity, 
  ShieldCheck,
  ChevronRight,
  Check,
  Lock,
  
  Unlock,
  ShieldAlert
} from 'lucide-react';

interface ShiftControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  registeredUsers: User[];
  currentShiftStats: {
    count: number;
    volume: number;
    profit: number;
  };
  onSwitchUser: (user: User) => void;
  onOpenStaffDirectory: () => void;
}

export function ShiftControlModal({
  isOpen,
  onClose,
  currentUser,
  registeredUsers,
  currentShiftStats,
  onSwitchUser,
  onOpenStaffDirectory,
}: ShiftControlModalProps) {
  const [pinConfirmUser, setPinConfirmUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Manual Handover form states for staff
  const [manualName, setManualName] = useState('');
  const [manualPin, setManualPin] = useState('');
  const [manualError, setManualError] = useState('');

  const handleManualSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');

    if (!manualName.trim()) {
      setManualError('Please enter target operator name or phone number.');
      return;
    }
    if (manualPin.length !== 4 || isNaN(Number(manualPin))) {
      setManualError('PIN passcode must be exactly 4 digits.');
      return;
    }

    const found = registeredUsers.find(
      (u) =>
        (u.name.toLowerCase() === manualName.trim().toLowerCase() ||
         (u.phone && u.phone === manualName.trim())) &&
        u.pin === manualPin
    );

    if (!found) {
      setManualError('Authentication failed: Invalid credentials or PIN.');
      return;
    }

    if (found.role === 'Manager') {
      setManualError('Permission Denied: Cashiers cannot handover directly to Manager accounts.');
      return;
    }

    if (found.activated === false) {
      setManualError('Account is not activated. Please contact your Manager!');
      return;
    }

    // Switch Operator Session
    onSwitchUser(found);
    setManualName('');
    setManualPin('');
    onClose();
  };

  // Reset internal states whenever the modal opens/closes or switching target changes
  useEffect(() => {
    if (isOpen) {
      setPinConfirmUser(null);
      setPinInput('');
      setPinError('');
      setManualName('');
      setManualPin('');
      setManualError('');
    }
  }, [isOpen]);

  useEffect(() => {
    setPinInput('');
    setPinError('');
  }, [pinConfirmUser]);

  if (!isOpen) return null;

  // Handle number button click on custom secure keypad
  const handleKeyClick = (num: string) => {
    if (pinInput.length < 4) {
      setPinInput(prev => prev + num);
      setPinError('');
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
    setPinError('');
  };

  const handleClear = () => {
    setPinInput('');
    setPinError('');
  };

  const handleVerifyAndSwap = () => {
    if (!pinConfirmUser) return;
    const requiredPin = pinConfirmUser.pin || '1111';
    
    if (pinInput === requiredPin) {
      if (pinConfirmUser.role === 'Manager') {
        setPinError(true);
        setPinInput('');
        return;
      }
      onSwitchUser(pinConfirmUser);
      setPinConfirmUser(null);
      setPinInput('');
      onClose();
    } else {
      setPinError('Incorrect Passcode PIN. Handover Access Denied.');
      setPinInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-900/70 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in">
      {/* Centered Modal Container */}
      <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-neutral-100 flex flex-col max-h-[92vh] animate-scale-up text-neutral-800">
        
        {/* Custom Header with Brand Green style */}
        <div className="bg-[#00B87A] text-white px-6 py-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shadow-inner">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight">Operator Shift & Session Control</h3>
              <p className="text-[10px] text-emerald-100 font-medium font-mono">OPay Terminal Operations Center</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition text-white/90 hover:text-white cursor-pointer active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto flex-grow space-y-5">
          
          {/* Active Profile Info */}
          <div className="bg-gradient-to-br from-emerald-50/50 via-teal-50/10 to-white border border-emerald-100 rounded-3xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#00B87A] text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/10">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-600/10 text-emerald-700 font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full mb-1 border border-emerald-600/5">
                👑 Active Operator
              </span>
              <h4 className="text-base font-extrabold text-neutral-800 tracking-tight truncate leading-tight">
                {currentUser.name}
              </h4>
              <p className="text-[11px] text-neutral-500 font-medium flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                <span>{currentUser.role === 'Manager' ? 'Terminal Superuser' : 'Cashier Operator'}</span>
              </p>
            </div>
          </div>

          {/* Today's Stats Bento Grid */}
          <div className="space-y-2">
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block font-mono">
              Active Shift Metrics
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-neutral-50/80 border border-neutral-100 rounded-2xl p-3.5">
                <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">Volume Flow</span>
                <span className="text-sm font-black font-mono text-[#00B87A] block mt-0.5">
                  {formatNaira(currentShiftStats.volume)}
                </span>
              </div>
              <div className="bg-neutral-50/80 border border-neutral-100 rounded-2xl p-3.5">
                <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider">Receipts Logged</span>
                <span className="text-sm font-black font-mono text-neutral-700 block mt-0.5">
                  {currentShiftStats.count} slips
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Action Panel: Switch list OR PIN verification */}
          <div className="border-t border-neutral-100 pt-4 space-y-3">
            
            {pinConfirmUser ? (
              /* banking-grade PIN verification screen */
              <div className="bg-amber-50/40 border border-amber-100 rounded-3xl p-4 space-y-4 animate-fade-in">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-600 text-xs">🔑</span>
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">
                      Verify Handover PIN
                    </span>
                  </div>
                  <button 
                    onClick={() => setPinConfirmUser(null)}
                    className="text-[10px] text-neutral-500 hover:text-neutral-800 underline font-black"
                  >
                    Cancel Switch
                  </button>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-[11px] text-neutral-500 font-medium">
                    Please ask <strong className="text-neutral-800">{pinConfirmUser.name}</strong> to enter their 4-digit security PIN:
                  </p>
                  
                  {/* Pin bubbles */}
                  <div className="flex gap-2 justify-center py-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <div 
                        key={idx} 
                        className={`w-10 h-10 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-sm transition-all duration-100 ${
                          pinInput.length > idx 
                            ? 'bg-amber-500/10 border-amber-500 text-amber-800 scale-105 shadow-inner' 
                            : 'bg-white border-neutral-200'
                        }`}
                      >
                        {pinInput.length > idx ? '●' : ''}
                      </div>
                    ))}
                  </div>

                  {pinError && (
                    <p className="text-[10px] text-red-500 font-black tracking-tight">{pinError}</p>
                  )}
                </div>

                {/* Tactile banking Circular keypad */}
                <div className="max-w-[240px] mx-auto grid grid-cols-3 gap-2.5 pt-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleKeyClick(num.toString())}
                      className="w-14 h-14 rounded-full bg-white hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200/80 shadow-xs flex items-center justify-center text-sm font-mono font-black transition duration-100 cursor-pointer active:scale-90"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClear}
                    className="w-14 h-14 rounded-full bg-neutral-100/85 hover:bg-neutral-200 text-[10px] font-black text-neutral-500 transition cursor-pointer active:scale-90"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeyClick('0')}
                    className="w-14 h-14 rounded-full bg-white hover:bg-neutral-100 active:bg-neutral-200 border border-neutral-200/80 shadow-xs flex items-center justify-center text-sm font-mono font-black transition duration-100 cursor-pointer active:scale-90"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    className="w-14 h-14 rounded-full bg-neutral-100/85 hover:bg-neutral-200 text-[10px] font-black text-neutral-500 transition cursor-pointer active:scale-90 flex items-center justify-center"
                    title="Backspace"
                  >
                    ⌫
                  </button>
                </div>

                <button
                  type="button"
                  disabled={pinInput.length !== 4}
                  onClick={handleVerifyAndSwap}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:hover:bg-amber-500 text-white font-black rounded-2xl text-xs tracking-wide transition duration-150 shadow-md shadow-amber-500/15 cursor-pointer flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Authenticate & Switch Operator</span>
                </button>
              </div>
            ) : currentUser.role !== 'Manager' ? (
              /* Secure Manual Handover screen for non-managers */
              <form onSubmit={handleManualSwitch} className="space-y-4 animate-fade-in">
                <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl flex flex-col items-center text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Lock className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <h4 className="text-xs font-black uppercase text-amber-800 tracking-wider font-mono">
                    Restricted Directory Access
                  </h4>
                  <p className="text-[11px] text-neutral-500 font-semibold max-w-sm leading-normal">
                    As a Cashier, you do not have permission to view other staff, cashier, or manager accounts in this terminal. Please enter the next operator's details below to handover your shift.
                  </p>
                </div>

                {manualError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-650 font-bold flex items-center gap-2 animate-pulse">
                    <ShieldAlert className="w-4 h-4 text-red-500" />
                    <span>{manualError}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest font-mono">
                      Target Operator's Name or Phone
                    </label>
                    <input
                      type="text"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="e.g. Joy Okafor or 0901234..."
                      className="w-full bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-neutral-800 font-extrabold text-xs focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] transition"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest font-mono">
                      Next Operator's 4-Digit Passcode (PIN)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={manualPin}
                      onChange={(e) => setManualPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      className="w-full bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-neutral-800 font-black text-center text-sm tracking-widest focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] transition font-mono"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#00B87A] hover:bg-emerald-600 active:scale-[0.98] text-white font-black rounded-2xl text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  <Unlock className="w-4 h-4 stroke-[2.5]" />
                  <span>Secure Shift Handover</span>
                </button>
              </form>
            ) : (
              /* Handover Selector screen */
              <div className="space-y-2.5">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block font-mono">
                  Fast Shift Handover
                </span>
                
                <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100/80 space-y-1.5 pr-0.5">
                  {registeredUsers.length === 0 ? (
                    <div className="text-[11px] text-neutral-400 py-6 text-center">
                      No other operators registered in database.
                    </div>
                  ) : (
                    registeredUsers.map((u) => {
                      const isCurrent = u.id === currentUser.id;
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (isCurrent || currentUser.role !== 'Manager') return;
                            // If current operator is Manager, switch instantly with no PIN required!
                            if (currentUser.role === 'Manager') {
                              onSwitchUser(u);
                              onClose();
                            }
                          }}
                          className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition border ${
                            isCurrent 
                              ? 'bg-[#00B87A]/5 border-[#00B87A]/25 text-[#00B87A] font-bold cursor-default' 
                              : 'hover:bg-neutral-50 active:bg-neutral-100 border-neutral-150/70 hover:border-neutral-200 text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 ${
                              u.role === 'Manager' ? 'bg-[#00B87A]' : 'bg-amber-500'
                            }`}>
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="truncate text-xs font-semibold">
                              <span className="block text-neutral-800 font-extrabold truncate">{u.name}</span>
                              <span className="block text-[9px] text-neutral-450 font-medium">
                                {u.role === 'Manager' ? 'Superuser' : 'Cashier Operator'}
                              </span>
                            </div>
                          </div>
                          {isCurrent ? (
                            <span className="text-[10px] bg-[#00B87A]/15 text-[#00B87A] font-black px-2.5 py-0.5 rounded-full shrink-0">
                              Active Operator
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400 hover:text-neutral-700 shrink-0 flex items-center gap-0.5 font-bold bg-neutral-100/80 px-2 py-0.5 rounded-lg border border-neutral-200/50">
                              {currentUser.role === 'Manager' ? 'Immediate Switch ⚡' : 'Enter PIN 🔑'}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick toggle to Switch Role/Mode for Manager Superuser */}
          {currentUser.id === 'mgr_1' && (
            <div className="border-t border-neutral-150/50 pt-4 flex items-center justify-between bg-neutral-50/50 p-3 rounded-2xl border border-neutral-150/50 gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block font-mono">
                  Superuser View Mode
                </span>
                <p className="text-[9px] text-neutral-400 leading-none mt-0.5">Toggle active view for development</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newRole = currentUser.role === 'Manager' ? 'Employee' : 'Manager';
                  const nextUser = { ...currentUser, role: newRole as any };
                  onSwitchUser(nextUser);
                  onClose();
                }}
                className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-full border font-black transition cursor-pointer active:scale-95 ${
                  currentUser.role === 'Manager'
                    ? 'bg-[#00B87A]/10 border-[#00B87A]/35 text-[#00B87A]'
                    : 'bg-amber-50 border-amber-250 text-amber-800'
                }`}
              >
                {currentUser.role === 'Manager' ? '👑 Manager View' : '👤 Cashier View'}
              </button>
            </div>
          )}



          {/* Bottom actions */}
          <div className="border-t border-neutral-100 pt-4 flex justify-between items-center text-[11px] font-bold">
            <button
              onClick={() => {
                onClose();
                onOpenStaffDirectory();
              }}
              className="text-[#00B87A] hover:text-[#009b67] font-black underline cursor-pointer flex items-center gap-1.5 active:scale-98 transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 shrink-0 text-[#00B87A]" />
              <span>Full Staff Registry & Directory</span>
            </button>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 font-extrabold cursor-pointer py-1 px-3 bg-neutral-100 hover:bg-neutral-150 rounded-xl transition"
            >
              Dismiss
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
