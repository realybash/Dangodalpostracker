/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction } from '../types';
import { formatNaira } from '../utils';
import { 
  X, 
  User as UserIcon, 
  UserCheck, 
  Users, 
  Lock, 
  Unlock, 
  Key, 
  Pencil, 
  Trash2, 
  Plus, 
  Phone, 
  Check, 
  ShieldAlert,
  Coins,
  TrendingUp,
  Activity,
  AlertCircle,
  ArrowRight,
  LogOut,
  Camera,
  KeyRound,
  Copy
} from 'lucide-react';
import { playStatusSound } from './TransactionForm';

export function renderUserAvatar(
  avatar: string | undefined,
  name: string,
  sizeClass = "w-14 h-14",
  roundedClass = "rounded-2xl",
  textClass = "text-xl font-black"
) {
  if (avatar && avatar.startsWith('preset:')) {
    const parts = avatar.split(':');
    const emoji = parts[1] || '👤';
    const bg = parts[2] || 'from-[#00B87A] to-emerald-400';
    
    return (
      <div className={`${sizeClass} ${roundedClass} bg-gradient-to-tr ${bg} text-white flex items-center justify-center shadow-md select-none`}>
        <span style={{ fontSize: '1.4em', lineHeight: 1 }}>{emoji}</span>
      </div>
    );
  }

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`${sizeClass} ${roundedClass} object-cover border border-neutral-200 shadow-md`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`${sizeClass} ${roundedClass} bg-gradient-to-tr from-[#00B87A] to-emerald-400 text-white flex items-center justify-center ${textClass} shadow-md`}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

interface ProfileModalProps {
  currentUser: User;
  registeredUsers: User[];
  transactions: Transaction[];
  onRegisterUser: (user: User) => void;
  onUpdateUserPin: (userId: string, newPin: string) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  onSwitchUser: (user: User) => void;
  onClose: () => void;
  onLogout?: () => void;
}

export function ProfileModal({
  currentUser,
  registeredUsers,
  transactions,
  onRegisterUser,
  onUpdateUserPin,
  onUpdateUser,
  onDeleteUser,
  onSwitchUser,
  onClose,
  onLogout
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'my-profile' | 'switch-shift' | 'staff-directory'>('my-profile');
  
  // My Profile Edit State
  const [editName, setEditName] = useState(currentUser.name);
  const [editPhone, setEditPhone] = useState(currentUser.phone || '');
  const [editPin, setEditPin] = useState(currentUser.pin || '');
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar || '');
  const [isEditingMyProfile, setIsEditingMyProfile] = useState(false);
  const [myProfileError, setMyProfileError] = useState('');
  const [myProfileSuccess, setMyProfileSuccess] = useState('');

  // Sync state whenever currentUser changes
  useEffect(() => {
    setEditName(currentUser.name);
    setEditPhone(currentUser.phone || '');
    setEditPin(currentUser.pin || '');
    setEditAvatar(currentUser.avatar || '');
    setMyProfileError('');
    setMyProfileSuccess('');
  }, [currentUser]);

  // Switch Shift Pin Pad State
  const [switchingUser, setSwitchingUser] = useState<User | null>(null);
  const [pinPadInput, setPinPadInput] = useState('');
  const [pinPadError, setPinPadError] = useState('');

  // Manual Switch Shift State for Staff/Cashier
  const [manualTargetName, setManualTargetName] = useState('');
  const [manualPinInput, setManualPinInput] = useState('');
  const [manualError, setManualError] = useState('');

  // Staff Directory Management State
  const [isAddingNewStaff, setIsAddingNewStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'Manager' | 'Employee'>('Employee');
  const [staffError, setStaffError] = useState('');

  // Staff Edit State
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffPin, setEditStaffPin] = useState('');
  const [editStaffRole, setEditStaffRole] = useState<'Manager' | 'Employee'>('Employee');

  // Setup Employee Login Account state
  const [setupAccountStaff, setSetupAccountStaff] = useState<User | null>(null);
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupError, setSetupError] = useState('');

  // Active toggles for staff insertion/editing
  const [newStaffActivated, setNewStaffActivated] = useState(true);
  const [editStaffActivated, setEditStaffActivated] = useState(true);

  // Reset shift check whenever switchingUser changes
  useEffect(() => {
    setPinPadInput('');
    setPinPadError('');
  }, [switchingUser]);

  // Compute stats for current active shift user
  const shiftMetrics = useMemo(() => {
    const todayStr = new Date().toDateString();
    const myShiftTxs = transactions.filter(t => t.employeeId === currentUser.id);
    const todayShiftTxs = myShiftTxs.filter(t => new Date(t.timestamp).toDateString() === todayStr);

    const volume = todayShiftTxs.reduce((sum, t) => sum + t.amount, 0);
    const profit = todayShiftTxs.reduce((sum, t) => sum + t.profit, 0);
    const count = todayShiftTxs.length;

    return { volume, profit, count, totalAllTime: myShiftTxs.length };
  }, [transactions, currentUser]);

  const handleUpdateMyProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setMyProfileError('');
    setMyProfileSuccess('');

    if (!editName.trim()) {
      setMyProfileError('Operator Name is required.');
      return;
    }
    if (editPin.length !== 4 || isNaN(Number(editPin))) {
      setMyProfileError('Passcode PIN must be exactly 4 digits.');
      return;
    }

    const updated: User = {
      ...currentUser,
      name: editName.trim(),
      phone: editPhone.trim() || undefined,
      pin: editPin,
      avatar: editAvatar || undefined
    };

    onUpdateUser(updated);
    playStatusSound('Success');
    setMyProfileSuccess('Profile successfully updated!');
    setIsEditingMyProfile(false);
  };

  const handleManualSwitchShift = (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');

    if (!manualTargetName.trim()) {
      setManualError('Operator Name or Phone Number is required.');
      playStatusSound('Failed');
      return;
    }
    if (manualPinInput.length !== 4 || isNaN(Number(manualPinInput))) {
      setManualError('Passcode PIN must be exactly 4 digits.');
      playStatusSound('Failed');
      return;
    }

    // Attempt to locate matching user by Name or Phone, then verify PIN
    const found = registeredUsers.find(
      (u) =>
        (u.name.toLowerCase() === manualTargetName.trim().toLowerCase() ||
         (u.phone && u.phone === manualTargetName.trim())) &&
        u.pin === manualPinInput
    );

    if (!found) {
      setManualError('Authentication failed: Invalid Name/Phone or Passcode PIN.');
      playStatusSound('Failed');
      return;
    }

    if (found.activated === false) {
      setManualError('Account is not activated. Please contact your Manager!');
      playStatusSound('Failed');
      return;
    }

    // Success! Switch session
    playStatusSound('Success');
    onSwitchUser(found);
    setManualTargetName('');
    setManualPinInput('');
    onClose();
  };

  // Switch shift via Pinpad verification
  const handlePinPadClick = (val: string) => {
    if (pinPadInput.length >= 4) return;
    setPinPadInput(prev => prev + val);
    setPinPadError('');
  };

  const handlePinPadBackspace = () => {
    setPinPadInput(prev => prev.slice(0, -1));
    setPinPadError('');
  };

  const handlePinPadClear = () => {
    setPinPadInput('');
    setPinPadError('');
  };

  const handleVerifyAndSwitchShift = () => {
    if (!switchingUser) return;
    if (switchingUser.activated === false) {
      playStatusSound('Failed');
      setPinPadError('Account is not activated. Please contact your Manager!');
      setPinPadInput('');
      return;
    }
    const requiredPin = switchingUser.pin || '1111';
    
    if (pinPadInput === requiredPin) {
      playStatusSound('Success');
      onSwitchUser(switchingUser);
      setSwitchingUser(null);
      // Close modal on successful switch to keep the terminal interactive
      onClose();
    } else {
      playStatusSound('Failed');
      setPinPadError('Incorrect Passcode PIN. Access Denied!');
      setPinPadInput('');
    }
  };

  // Submit adding new staff
  const handleAddNewStaff = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');

    if (!newStaffName.trim()) {
      setStaffError('Name is required.');
      return;
    }
    if (newStaffPin.length !== 4 || isNaN(Number(newStaffPin))) {
      setStaffError('PIN must be exactly 4 numeric digits.');
      return;
    }

    // Check PIN uniqueness or name duplicates in employee registry
    const isPinDuplicate = registeredUsers.some(u => u.pin === newStaffPin);
    if (isPinDuplicate) {
      setStaffError('This PIN is already set for another operator.');
      return;
    }

    const newStaff: User = {
      id: `${newStaffRole === 'Manager' ? 'mgr' : 'emp'}_${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      pin: newStaffPin,
      phone: newStaffPhone.trim() || undefined,
      activated: newStaffActivated,
      ownerId: currentUser.role === 'Manager' ? currentUser.id : (currentUser.ownerId || 'mgr_1')
    };

    onRegisterUser(newStaff);
    playStatusSound('Success');
    
    // Reset inputs
    setNewStaffName('');
    setNewStaffPhone('');
    setNewStaffPin('');
    setNewStaffRole('Employee');
    setNewStaffActivated(true);
    setIsAddingNewStaff(false);
  };

  // Submit updating cached staff
  const handleSaveStaffEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    if (!editStaffName.trim()) return;
    if (editStaffPin.length !== 4 || isNaN(Number(editStaffPin))) {
      alert('PIN must be exactly 4 digits.');
      return;
    }

    const updated: User = {
      ...editingStaff,
      name: editStaffName.trim(),
      phone: editStaffPhone.trim() || undefined,
      pin: editStaffPin,
      role: editStaffRole,
      activated: editStaffActivated
    };

    onUpdateUser(updated);
    playStatusSound('Success');
    setEditingStaff(null);
  };

  const startEditStaff = (staff: User) => {
    setEditingStaff(staff);
    setEditStaffName(staff.name);
    setEditStaffPhone(staff.phone || '');
    setEditStaffPin(staff.pin || '1111');
    setEditStaffRole(staff.role || 'Employee');
    setEditStaffActivated(staff.activated !== false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh] animate-fade-in text-neutral-800">
        
        {/* Header Bar */}
        <div className="bg-[#00B87A] text-white px-5 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-tight">Shift Operator Profile Center</h3>
              <p className="text-[10px] text-emerald-100 font-mono tracking-tight">Manage logins, PIN pins & employees</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-full transition text-white/90 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection (Only shown for Manager) */}
        {currentUser.role === 'Manager' && (
          <div className="flex bg-neutral-100 p-1 mx-5 mt-4 rounded-xl border border-neutral-200 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('my-profile');
                setSwitchingUser(null);
              }}
              className={`flex-grow flex-1 text-center py-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'my-profile'
                  ? 'bg-white text-[#00B87A] shadow-sm font-black'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>My Profile</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setActiveTab('switch-shift');
                setSwitchingUser(null);
              }}
              className={`flex-grow flex-1 text-center py-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'switch-shift'
                  ? 'bg-white text-[#00B87A] shadow-sm font-black'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Switch Shift</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('staff-directory');
                setSwitchingUser(null);
              }}
              className={`flex-grow flex-1 text-center py-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                activeTab === 'staff-directory'
                  ? 'bg-white text-[#00B87A] shadow-sm font-black'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Staff Registry</span>
            </button>
          </div>
        )}

        {/* Body content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">

          {/* TAB 1: MY PROFILE */}
          {activeTab === 'my-profile' && (
            <div className="space-y-5 animate-fade-in">
              
              {/* Premium Operator Identity Card */}
              <div className="bg-gradient-to-br from-neutral-900 to-neutral-850 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
                {/* Decorative background grid and vector blur */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00B87A]/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl -ml-6 -mb-6 pointer-events-none" />
                
                <div className="flex items-center justify-between gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      {renderUserAvatar(currentUser.avatar, currentUser.name, "w-14 h-14", "rounded-2xl", "text-xl font-black")}
                      <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-neutral-900 shadow-sm">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-emerald-500/10 text-[#00B87A] text-[9px] font-mono font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                          {currentUser.role === 'Manager' ? '👑 MANAGER' : '👤 CASHIER OPERATOR'}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono font-bold uppercase tracking-widest">Active Session</span>
                      </div>
                      <h4 className="text-base font-black tracking-tight mt-1 text-white font-sans">{currentUser.name}</h4>
                      <p className="text-[11px] text-neutral-400 font-semibold mt-0.5 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Secure ID: <strong className="font-mono text-neutral-300 font-bold">{currentUser.phone || 'N/A'}</strong></span>
                      </p>
                      {currentUser.role === 'Manager' && currentUser.referralCode && (
                        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest font-mono">Referral Code</span>
                            <span className="text-sm font-black font-mono text-emerald-900 tracking-wider">{currentUser.referralCode}</span>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(currentUser.referralCode!);
                              playStatusSound('Success');
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg transition"
                            title="Copy Referral Code"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 bg-neutral-800/80 border border-neutral-700/50 p-2.5 rounded-2xl">
                    <span className="text-[8px] block text-neutral-400 font-mono uppercase tracking-wider font-extrabold mb-0.5">Terminal PIN</span>
                    <span className="text-xs font-mono font-black text-[#00B87A] tracking-widest">
                      {currentUser.pin || '••••'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Alerts */}
              {myProfileSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-800 font-bold flex items-center gap-2 animate-fade-in">
                  <Check className="w-4 h-4 text-emerald-500 stroke-[3] shrink-0" />
                  <span>{myProfileSuccess}</span>
                </div>
              )}
              {myProfileError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-[11px] text-red-750 font-bold flex items-center gap-2 animate-fade-in">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{myProfileError}</span>
                </div>
              )}

              {/* Beautiful Dashboard Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono font-black tracking-widest text-neutral-450">
                    Active Shift Metrics
                  </span>
                  <span className="text-[9px] bg-neutral-100 text-neutral-500 font-mono font-black px-2 py-0.5 rounded-full border border-neutral-200 uppercase tracking-widest">
                    Real-time
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 p-3 rounded-2xl transition duration-150 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 bg-neutral-100/50 rounded-bl-xl border-l border-b border-neutral-200 opacity-60">
                      <Activity className="w-3.5 h-3.5 text-neutral-400" />
                    </div>
                    <span className="text-[8px] text-neutral-450 uppercase font-mono font-extrabold block">My Slips</span>
                    <span className="text-xs font-black font-mono text-neutral-800 mt-2 block">
                      {shiftMetrics.count} <span className="text-[9px] font-bold text-neutral-400 uppercase">slips</span>
                    </span>
                  </div>

                  <div className="bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 p-3 rounded-2xl transition duration-150 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 bg-emerald-50/50 rounded-bl-xl border-l border-b border-emerald-100 opacity-60">
                      <Coins className="w-3.5 h-3.5 text-emerald-500" />
                    </div>
                    <span className="text-[8px] text-neutral-450 uppercase font-mono font-extrabold block">Volume</span>
                    <span className="text-xs font-black font-mono text-emerald-600 mt-2 block truncate" title={formatNaira(shiftMetrics.volume)}>
                      {formatNaira(shiftMetrics.volume)}
                    </span>
                  </div>

                  <div className="bg-neutral-50 hover:bg-neutral-100/50 border border-neutral-200 p-3 rounded-2xl transition duration-150 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-1 bg-indigo-50/50 rounded-bl-xl border-l border-b border-indigo-100 opacity-60">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <span className="text-[8px] text-neutral-450 uppercase font-mono font-extrabold block">Net Profit</span>
                    <span className="text-xs font-black font-mono text-indigo-650 mt-2 block truncate" title={formatNaira(shiftMetrics.profit)}>
                      {formatNaira(shiftMetrics.profit)}
                    </span>
                  </div>
                </div>

                {/* All-time activity ledger row */}
                <div className="bg-neutral-50 border border-neutral-200 p-3.5 rounded-2xl flex items-center justify-between text-xs text-neutral-600">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-150 flex items-center justify-center text-indigo-600 shrink-0">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[9px] text-neutral-450 uppercase font-mono font-black block">All-Time Performance</span>
                      <span className="font-semibold text-neutral-700 font-sans">Total logged tickets</span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-neutral-800 text-xs bg-neutral-200/50 border border-neutral-300/40 px-3 py-1 rounded-xl">
                    {shiftMetrics.totalAllTime} txs
                  </span>
                </div>
              </div>

              {/* Toggle Form to edit Profile details (Manager Only) */}
              {currentUser.role === 'Manager' && (
                <div className="border-t border-neutral-150 pt-4">
                  {!isEditingMyProfile ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingMyProfile(true)}
                      className="w-full py-3 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 font-extrabold rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-[0.99]"
                    >
                      <Pencil className="w-3.5 h-3.5 text-neutral-400 stroke-[2.5]" />
                      <span>Edit Profile Details & PIN</span>
                    </button>
                  ) : (
                    <form onSubmit={handleUpdateMyProfile} className="space-y-4 bg-neutral-50/50 border border-neutral-200 p-4 rounded-2xl animate-fade-in">
                      <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                        <h4 className="text-[10px] font-black uppercase text-neutral-500 tracking-wider font-mono">
                          Update Account Fields
                        </h4>
                        <span className="text-[9px] text-amber-600 font-bold font-mono">Requires current terminal auth</span>
                      </div>

                      {/* PROFILE PICTURE EDITING CORE SECTION */}
                      <div className="flex flex-col items-center justify-center py-4 bg-white border border-neutral-150 rounded-2xl p-4 gap-3">
                        <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest font-mono">Profile Picture / Avatar</span>
                        <div className="relative group">
                          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-emerald-50/80 group-hover:border-emerald-100 transition duration-150 relative shadow-md">
                            {renderUserAvatar(editAvatar, editName, "w-full h-full", "rounded-full", "text-2xl font-black")}
                          </div>
                          <label className="absolute bottom-0 right-0 w-7 h-7 bg-[#00B87A] hover:bg-emerald-600 border border-white rounded-full flex items-center justify-center cursor-pointer shadow-sm text-white transition active:scale-90">
                            <Camera className="w-3.5 h-3.5 text-white" />
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setEditAvatar(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                        
                        {/* Predefined Beautiful Avatars for Quick Tap */}
                        <div className="w-full space-y-2 mt-1">
                          <span className="text-[9px] text-neutral-450 uppercase font-mono font-bold text-center block">Or choose an avatar preset:</span>
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            {[
                              { icon: '🦊', bg: 'from-orange-400 to-amber-500' },
                              { icon: '🦁', bg: 'from-yellow-400 to-amber-600' },
                              { icon: '🐼', bg: 'from-neutral-400 to-neutral-600' },
                              { icon: '🦉', bg: 'from-blue-400 to-indigo-500' },
                              { icon: '🦄', bg: 'from-purple-400 to-pink-500' },
                              { icon: '🦸', bg: 'from-emerald-400 to-teal-600' }
                            ].map((avatarItem, idx) => {
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setEditAvatar(`preset:${avatarItem.icon}:${avatarItem.bg}`)}
                                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shadow-xs border border-neutral-200 transition active:scale-90 hover:scale-105 cursor-pointer hover:border-[#00B87A]"
                                  style={{
                                    background: `linear-gradient(135deg, ${
                                      avatarItem.bg.includes('orange') ? '#fb923c, #f59e0b' : 
                                      avatarItem.bg.includes('yellow') ? '#fbbf24, #d97706' : 
                                      avatarItem.bg.includes('neutral') ? '#9ca3af, #4b5563' : 
                                      avatarItem.bg.includes('blue') ? '#60a5fa, #6366f1' : 
                                      avatarItem.bg.includes('purple') ? '#c084fc, #ec4899' : 
                                      '#34d399, #0d9488'
                                    })`
                                  }}
                                >
                                  {avatarItem.icon}
                                </button>
                              );
                            })}
                          </div>
                          
                          {editAvatar && (
                            <button
                              type="button"
                              onClick={() => setEditAvatar('')}
                              className="text-[10px] text-rose-500 hover:text-rose-600 font-extrabold block mx-auto mt-1 hover:underline cursor-pointer transition uppercase tracking-wider font-mono"
                            >
                              Remove Avatar
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-[#888888] uppercase tracking-wider font-mono">My Display Name</label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 font-bold text-xs focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A]"
                            placeholder="Operator Name"
                            required
                          />
                        </div>
                        
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-[#888888] uppercase tracking-wider font-mono">Phone Number</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 font-bold text-xs focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] font-mono"
                            placeholder="e.g. 08123456789"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[#888888] uppercase tracking-wider font-mono">4-Digit Shift Passkey (PIN)</label>
                        <input
                          type="password"
                          maxLength={4}
                          value={editPin}
                          onChange={(e) => setEditPin(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2.5 text-neutral-800 font-extrabold text-xs focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] font-mono tracking-widest text-center"
                          placeholder="••••"
                          required
                        />
                      </div>

                      <div className="flex gap-2.5 pt-1.5 select-none">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 px-3.5 bg-[#00B87A] hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          Save Changes
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingMyProfile(false);
                            setEditName(currentUser.name);
                            setEditPhone(currentUser.phone || '');
                            setEditPin(currentUser.pin || '');
                          }}
                          className="py-2.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-250 text-neutral-600 font-bold rounded-xl text-xs transition cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Secure Log Out Terminal Session Action (Manager or Cashier) */}
              {onLogout && (
                <div className="border-t border-neutral-150 pt-5 mt-3 space-y-3">
                  <div className="bg-rose-50/40 border border-rose-100 p-3.5 rounded-2xl flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 block">Terminal Session Security</span>
                      <p className="text-[10px] text-rose-650 font-semibold leading-normal">
                        Logging out will securely lock this active OPay terminal session. The next operator must input their secure name and passcode PIN to begin transactions.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-black rounded-2xl text-xs tracking-widest uppercase transition duration-150 flex items-center justify-center gap-2.5 shadow-md shadow-rose-550/10 active:scale-[0.98] font-mono cursor-pointer"
                    title="Sign Out and Lock Terminal"
                  >
                    <LogOut className="w-4 h-4 text-white stroke-[3]" />
                    <span>Log Out & Lock Terminal</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SWITCH SHIFT (PIN PAD CHALLENGE) */}
          {activeTab === 'switch-shift' && (
            <div className="space-y-4">
              {currentUser.role !== 'Manager' ? (
                /* SECURE MANUAL HANDOVER FOR NON-MANAGERS - DIRECTORIES REMOVED FOR SECURITY */
                <form onSubmit={handleManualSwitchShift} className="space-y-4 animate-fade-in">
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

                  <div className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-neutral-450 uppercase tracking-widest font-mono">
                        Target Operator's Name or Phone
                      </label>
                      <input
                        type="text"
                        value={manualTargetName}
                        onChange={(e) => setManualTargetName(e.target.value)}
                        placeholder="e.g. Joy Okafor or 0901234..."
                        className="w-full bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-xl px-3.5 py-3 text-neutral-800 font-extrabold text-xs focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] transition"
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
                        value={manualPinInput}
                        onChange={(e) => setManualPinInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="w-full bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 rounded-xl px-3.5 py-3 text-neutral-800 font-black text-center text-base tracking-widest focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] transition font-mono"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#00B87A] hover:bg-emerald-600 active:scale-[0.98] text-white font-black rounded-2xl text-xs tracking-wider uppercase transition flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4 stroke-[2.5]" />
                    <span>Secure Shift Handover</span>
                  </button>
                </form>
              ) : !switchingUser ? (
                <div className="space-y-3">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-500 block pb-1 border-b border-neutral-100">
                    {currentUser.role === 'Manager' ? 'Select Shift (Manager Direct Bypass Active)' : 'Select Target Operator for Shift Swap'}
                  </span>
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {registeredUsers
                      .filter((u) => currentUser.role === 'Manager' || u.role !== 'Manager')
                      .map((u) => {
                      const isActive = u.id === currentUser.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isActive) return;
                            if (currentUser.role === 'Manager') {
                              onSwitchUser(u);
                              onClose();
                            } else {
                              setSwitchingUser(u);
                            }
                          }}
                          className={`p-3 rounded-2xl text-left border transition flex items-center justify-between group ${
                            isActive
                              ? 'bg-neutral-50 border-neutral-150 cursor-not-allowed opacity-75'
                              : 'bg-white hover:bg-neutral-50 hover:border-[#00B87A] border-neutral-200 cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0 pr-1">
                            <h5 className="text-xs font-black truncate text-neutral-700">{u.name}</h5>
                            <span className="text-[9px] font-mono block text-neutral-400 mt-0.5 uppercase tracking-wide">
                              {u.role} {isActive && '(Current)'}
                            </span>
                          </div>
                          {!isActive && (
                            <div className="w-5 h-5 rounded-full bg-neutral-100 group-hover:bg-[#00B87A]/10 text-neutral-400 group-hover:text-[#00B87A] flex items-center justify-center shrink-0">
                              {currentUser.role === 'Manager' ? (
                                <ArrowRight className="w-3 h-3 text-[#00B87A]" />
                              ) : (
                                <Key className="w-3 h-3" />
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in flex flex-col items-center">
                  
                  {/* Prompt User Details */}
                  <div className="text-center">
                    <span className="text-[9px] font-mono uppercase tracking-wider font-extrabold text-amber-600 bg-amber-50 px-2.5 py-1 border border-amber-100 rounded-full inline-block">
                      🔑 Lock & Switch Verification
                    </span>
                    <h4 className="text-sm font-black text-neutral-800 mt-2">
                      Enter passcode PIN to switch shift into:
                    </h4>
                    <p className="text-sm font-extrabold text-[#00B87A] mt-1">
                      {switchingUser.name} ({switchingUser.role})
                    </p>
                  </div>

                  {/* Pin Pad Visual Indicator */}
                  <div className="flex gap-4 items-center justify-center py-2">
                    {([0, 1, 2, 3] as const).map((idx) => {
                      const filled = pinPadInput.length > idx;
                      return (
                        <div
                          key={idx}
                          className={`w-4.5 h-4.5 rounded-full border-2 transition duration-75 ${
                            filled 
                              ? 'bg-[#00B87A] border-[#00B87A] scale-110 shadow-sm'
                              : 'bg-neutral-100 border-neutral-300'
                          }`}
                        />
                      );
                    })}
                  </div>

                  {/* Error display */}
                  {pinPadError && (
                    <div className="p-2.5 bg-red-50 border border-red-150 rounded-xl text-[10px] text-red-600 font-bold leading-none flex items-center gap-1.5 animate-bounce">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                      <span>{pinPadError}</span>
                    </div>
                  )}

                  {/* Pin Pad Core Layout Grid */}
                  <div className="w-full max-w-[240px] grid grid-cols-3 gap-2 pt-2.5 select-none">
                    {(['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const).map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePinPadClick(val)}
                        className="w-16 h-12 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-mono font-black text-base flex items-center justify-center transition cursor-pointer active:scale-90"
                      >
                        {val}
                      </button>
                    ))}
                    
                    {/* Clear Button */}
                    <button
                      type="button"
                      onClick={handlePinPadClear}
                      className="w-16 h-12 rounded-xl bg-zinc-50 hover:bg-red-50 text-red-500 font-mono font-bold text-xs uppercase flex items-center justify-center transition cursor-pointer active:scale-95 border border-neutral-150"
                    >
                      Clear
                    </button>

                    {/* Zero */}
                    <button
                      type="button"
                      onClick={() => handlePinPadClick('0')}
                      className="w-16 h-12 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-mono font-black text-base flex items-center justify-center transition cursor-pointer active:scale-90"
                    >
                      0
                    </button>

                    {/* Backspace Button */}
                    <button
                      type="button"
                      onClick={handlePinPadBackspace}
                      className="w-16 h-12 rounded-xl bg-zinc-50 hover:bg-neutral-150 text-neutral-750 font-mono font-bold text-xs uppercase flex items-center justify-center transition cursor-pointer active:scale-95 border border-neutral-150"
                    >
                      Del
                    </button>
                  </div>

                  <div className="flex gap-2 w-full max-w-[240px] pt-2">
                    <button
                      type="button"
                      onClick={handleVerifyAndSwitchShift}
                      disabled={pinPadInput.length !== 4}
                      className="flex-grow py-2.5 bg-[#00B87A] hover:bg-emerald-600 disabled:bg-neutral-200 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-sm disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Switch Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSwitchingUser(null);
                        setPinPadInput('');
                        setPinPadError('');
                      }}
                      className="px-3.5 py-2.5 bg-neutral-150 hover:bg-neutral-200 text-neutral-600 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 3: STAFF DIRECTORY (MANAGEMENT - ONLY MANAGER CAN REACH HERE) */}
          {activeTab === 'staff-directory' && currentUser.role === 'Manager' && (
            <div className="space-y-4">
              
              {/* Directory controller banner */}
              <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#00B87A] block">
                  Operators & Managers Registry ({registeredUsers.length} Users)
                </span>
                
                {!isAddingNewStaff && !editingStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewStaff(true);
                      setStaffError('');
                    }}
                    className="p-1 px-2.5 bg-[#00B87A]/10 hover:bg-[#00B87A] hover:text-white text-[#00B87A] rounded-lg transition duration-100 text-[10px] font-black tracking-normal flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Register Operator</span>
                  </button>
                )}
              </div>

              {/* Add Staff form */}
              {isAddingNewStaff && (
                <form onSubmit={handleAddNewStaff} className="space-y-3 bg-neutral-50 border border-[#00B87A]/20 p-4 rounded-2xl animate-fade-in">
                  <h4 className="text-xs font-black uppercase text-neutral-600 tracking-wider font-mono flex items-center gap-1.5">
                    <UserIcon className="w-4 h-4 text-[#00B87A]" /> Add New Operator / Manager
                  </h4>
                  {staffError && (
                    <div className="p-2.5 bg-red-50 border border-red-150 rounded-xl text-[10px] text-red-650 font-bold leading-normal">
                      {staffError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Full Name</label>
                      <input
                        type="text"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-[#00B87A]"
                        placeholder="e.g. Joy Okafor"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Phone contacts</label>
                      <input
                        type="text"
                        value={newStaffPhone}
                        onChange={(e) => setNewStaffPhone(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-[#00B87A] font-mono"
                        placeholder="e.g. 09012345678"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">4-Digit PIN Passcode</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={newStaffPin}
                        onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-extrabold text-xs focus:outline-none focus:border-[#00B87A] font-mono tracking-widest"
                        placeholder="e.g. 1234"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">System Role</label>
                      <select
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value as 'Manager' | 'Employee')}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-[#00B87A]"
                      >
                        <option value="Employee">Employee</option>
                        <option value="Manager">Manager (Admin Passcode)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white/40 p-2.5 rounded-xl border border-neutral-200">
                    <input
                      type="checkbox"
                      id="newStaffActivated"
                      checked={newStaffActivated}
                      onChange={(e) => setNewStaffActivated(e.target.checked)}
                      className="w-4 h-4 text-[#00B87A] border-neutral-300 rounded focus:ring-[#00B87A] cursor-pointer"
                    />
                    <label htmlFor="newStaffActivated" className="text-xs font-bold text-neutral-600 select-none cursor-pointer">
                      Activate Account Immediately (Allow switch shift and cloud sign in)
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1 select-none">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 px-3 bg-[#00B87A] hover:bg-[#00a36c] text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>{newStaffRole === 'Manager' ? 'Create Manager' : 'Create Employee'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewStaff(false);
                        setStaffError('');
                      }}
                      className="py-1.5 px-3 bg-white hover:bg-neutral-100 border border-neutral-250 text-neutral-600 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Edit Staff profile Form */}
              {editingStaff && (
                <form onSubmit={handleSaveStaffEdit} className="space-y-3 bg-indigo-50/50 border border-indigo-200 p-4 rounded-2xl animate-fade-in">
                  <h4 className="text-xs font-black uppercase text-indigo-700 tracking-wider font-mono flex items-center gap-1.5">
                    <Pencil className="w-4 h-4 text-indigo-600" /> Modify Operator Credentials
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Full Name</label>
                      <input
                        type="text"
                        value={editStaffName}
                        onChange={(e) => setEditStaffName(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-indigo-500"
                        required
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Phone Contact</label>
                      <input
                        type="text"
                        value={editStaffPhone}
                        onChange={(e) => setEditStaffPhone(e.target.value)}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">4-Digit PIN Passcode</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={editStaffPin}
                        onChange={(e) => setEditStaffPin(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-extrabold text-xs focus:outline-none focus:border-indigo-500 font-mono tracking-widest"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Operator Role</label>
                      <select
                        value={editStaffRole}
                        onChange={(e) => setEditStaffRole(e.target.value as 'Manager' | 'Employee')}
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Employee">Employee</option>
                        <option value="Manager">Manager (Admin Passcode)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-white/40 p-2.5 rounded-xl border border-neutral-250">
                    <input
                      type="checkbox"
                      id="editStaffActivated"
                      checked={editStaffActivated}
                      onChange={(e) => setEditStaffActivated(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-neutral-350 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="editStaffActivated" className="text-xs font-bold text-neutral-600 select-none cursor-pointer">
                      Account Activated (Allow switch shift and cloud sign in)
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1 select-none">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Update Operator
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingStaff(null)}
                      className="py-1.5 px-3 bg-white hover:bg-neutral-100 border border-neutral-250 text-neutral-600 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Setup Employee Credentials form */}
              {setupAccountStaff && (
                <div className="p-4 bg-emerald-50/50 border border-[#00B87A]/25 rounded-2xl animate-fade-in space-y-3.5">
                  <div className="flex justify-between items-center pb-1.5 border-b border-[#00B87A]/20">
                    <h4 className="text-xs font-black uppercase text-neutral-800 font-mono flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-[#00B87A] stroke-[2.5]" /> 
                      <span>Setup Employee Sign In Account</span>
                    </h4>
                    <span className="text-[10px] font-mono bg-[#00B87A] text-white px-2 py-0.5 rounded font-black">
                      {setupAccountStaff.name}
                    </span>
                  </div>

                  {setupError && (
                    <div className="p-2.5 bg-red-50 border border-red-150 rounded-xl text-[10px] text-red-650 font-bold leading-normal">
                      {setupError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono block">Employee Sign In Email</label>
                      <input
                        type="email"
                        value={setupEmail}
                        onChange={(e) => setSetupEmail(e.target.value)}
                        placeholder="e.g. Joy.Okafor@opayweb.com"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-[#00B87A]"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest font-mono block">Secret Passcode Password (Min. 6 characters)</label>
                      <input
                        type="password"
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2 text-neutral-850 font-bold text-xs focus:outline-none focus:border-[#00B87A]"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 select-none pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const emailTrim = setupEmail.trim().toLowerCase();
                        const passTrim = setupPassword;

                        if (!emailTrim || !emailTrim.includes('@')) {
                          setSetupError('Please enter a valid email address.');
                          return;
                        }
                        if (passTrim.length < 6) {
                          setSetupError('Password must be at least 6 characters.');
                          return;
                        }

                        // Check uniqueness except for this user themselves
                        const isEmailTaken = registeredUsers.some(
                          (u) => u.id !== setupAccountStaff.id && u.email?.toLowerCase() === emailTrim
                        );
                        if (isEmailTaken) {
                          setSetupError('This email is already linked to another employee account.');
                          return;
                        }

                        // Save details
                        const updated: User = {
                          ...setupAccountStaff,
                          email: emailTrim,
                          password: passTrim
                        };
                        onUpdateUser(updated);
                        playStatusSound('Success');
                        
                        // Close setup section
                        setSetupEmail('');
                        setSetupPassword('');
                        setSetupAccountStaff(null);
                        setSetupError('');
                      }}
                      className="flex-grow py-2 px-3 bg-[#00B87A] hover:bg-emerald-600 text-white font-extrabold rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      Save Account Credentials
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSetupAccountStaff(null);
                        setSetupEmail('');
                        setSetupPassword('');
                        setSetupError('');
                      }}
                      className="py-2 px-3 bg-white hover:bg-neutral-100 border border-neutral-250 text-neutral-600 font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Available Operators List Table */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {registeredUsers.length === 0 ? (
                   <div className="text-center py-6 border border-dashed border-neutral-200 rounded-2xl text-neutral-400 text-xs font-semibold leading-relaxed">
                     No registered operators or managers found in storage.
                   </div>
                 ) : (
                   registeredUsers.map((staff) => {
                     const isCurrent = staff.id === currentUser.id;
                     const isActivated = staff.activated !== false;
                     return (
                       <div
                         key={staff.id}
                         className={`p-3 bg-white border border-neutral-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-[#00B87A] transition ${
                           isCurrent ? 'ring-1 ring-[#00B87A]' : ''
                         }`}
                       >
                         <div className="flex items-start gap-3 min-w-0 flex-grow">{renderUserAvatar(staff.avatar, staff.name, "w-10 h-10 shrink-0", "rounded-xl", "text-sm font-black")}<div className="min-w-0 flex-grow">
                           <div className="flex items-center gap-1.5 flex-wrap">
                             <span className="font-extrabold text-neutral-850 truncate">{staff.name}</span>
                             {staff.role === 'Manager' ? (
                               <span className="bg-indigo-50 text-indigo-750 text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none shrink-0 font-mono border border-indigo-150">
                                 Manager
                               </span>
                             ) : (
                               <span className="bg-[#00B87A]/10 text-[#00B87A] text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none shrink-0 font-mono border border-[#00B87A]/10">
                                 Employee
                               </span>
                             )}
                             {isActivated ? (
                               <span className="bg-emerald-50 text-[#00B87A] text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none shrink-0 font-mono border border-emerald-100 flex items-center gap-1">
                                 <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A] shrink-0" /> Active
                               </span>
                             ) : (
                               <span className="bg-rose-50 text-rose-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none shrink-0 font-mono border border-rose-150 flex items-center gap-1">
                                 <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" /> Inactive
                               </span>
                             )}
                             {isCurrent && (
                               <span className="bg-neutral-100 text-neutral-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full select-none shrink-0 font-mono border border-neutral-200">
                                 Active Shift
                               </span>
                             )}
                           </div>
                           <p className="text-[10px] text-neutral-500 font-semibold font-mono mt-1.5 block">
                             Phone: {staff.phone || 'None'} | PIN Passcode: <strong className="text-neutral-750 font-black">{staff.pin || '1111'}</strong>
                           </p>

                           {/* Display sign-in account setup details */}
                           {isActivated ? (
                             <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-150 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                               {staff.email ? (
                                 <div className="text-[10px] text-neutral-505">
                                   <span className="font-bold text-neutral-650">Sign-in:</span> <span className="font-mono text-[9.5px] bg-[#00B87A]/10 text-[#00B87A] px-1.5 py-0.5 rounded border border-[#00B87A]/15 font-bold">{staff.email}</span>
                                 </div>
                               ) : (
                                 <div className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                   <span>⚠️ No sign-in credentials set.</span>
                                 </div>
                               )}
                               <button
                                 type="button"
                                 onClick={() => {
                                   setSetupAccountStaff(staff);
                                   setSetupEmail(staff.email || '');
                                   setSetupPassword(staff.password || '');
                                   setSetupError('');
                                 }}
                                 className="text-[9px] font-black uppercase text-[#00B87A] bg-[#00B87A]/5 hover:bg-[#00B87A]/15 px-2.5 py-1 border border-[#00B87A]/20 hover:border-[#00B87A]/45 rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1 self-start sm:self-center"
                               >
                                 🔑 {staff.email ? 'Change sign-in' : 'Add sign-in'}
                               </button>
                             </div>
                           ) : (
                             <div className="mt-2.5 pt-2 border-t border-dashed border-neutral-150 text-[10px] text-neutral-400 italic">
                               💡 Activating the employee is required to set up their cloud sign-in. Please click the green "Activate" button on the right to proceed.
                             </div>
                           )}
                         </div>

                         {/* Actions */}
                         <div className="flex items-center gap-1.5 select-none shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-neutral-100">
                           {/* Quick Action Toggle Activation Button */}
                           <button
                             type="button"
                             onClick={() => {
                               onUpdateUser({ ...staff, activated: !isActivated });
                               playStatusSound('Success');
                             }}
                             className={`p-1 px-1.5 text-[10px] font-bold border rounded-lg transition cursor-pointer select-none ${
                               isActivated
                                 ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-100'
                                 : 'bg-emerald-50 hover:bg-emerald-100 text-[#00B87A] border-emerald-100'
                             }`}
                             title={isActivated ? 'Deactivate Employee Login' : 'Activate Employee Login'}
                           >
                             {isActivated ? 'Deactivate' : 'Activate'}
                           </button>

                           <button
                             type="button"
                             onClick={() => startEditStaff(staff)}
                             className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 border border-neutral-200 hover:border-indigo-150 rounded-lg transition cursor-pointer"
                             title="Edit Operator settings"
                           >
                             <Pencil className="w-3.5 h-3.5" />
                           </button>
                           <button
                             type="button"
                             onClick={() => {
                               if (isCurrent) {
                                 alert("Cannot delete yourself during active shift. Switch shift user first!");
                                 return;
                               }
                               if (confirm(`Are you absolutely sure you want to delete Operator '${staff.name}'? This deletes their local credentials.`)) {
                                 onDeleteUser(staff.id);
                               }
                             }}
                             className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 border border-neutral-200 hover:border-red-150 rounded-lg transition cursor-pointer"
                             title="Delete Operator profile permanently"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                         </div>
                       </div>
                       </div>
                     );
                   })
                 )}
              </div>

            </div>
          )}

          {/* TAB 4: SWITCH ADAPTER ERROR MESSAGE (Fallback) */}
          {activeTab === 'staff-directory' && currentUser.role !== 'Manager' && (
            <div className="text-center py-6 px-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl flex flex-col items-center gap-2 font-medium">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
              <p className="text-xs font-bold leading-normal">
                Access Denied. Only business owners with 'Manager' credentials are authorized to view or edit the employee registry.
              </p>
            </div>
          )}

        </div>

        {/* Footer info banner */}
        <div className="bg-neutral-50 border-t border-neutral-200 p-3.5 px-5 text-center text-[10px] text-neutral-400 font-mono font-bold shrink-0">
          Business Owner Sync ID: <span className="text-neutral-500 select-all font-mono">{currentUser.role === 'Manager' ? 'MASTER_GATEWAY' : currentUser.id}</span>
        </div>

      </div>
    </div>
  );
}
