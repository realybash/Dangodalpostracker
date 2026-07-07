import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserRole } from '../types';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizePhone, normalizeName } from '../utils';
import { 
  Lock, 
  UserCheck, 
  ShieldAlert, 
  ArrowRight, 
  ShieldCheck, 
  Smartphone, 
  CheckCircle2, 
  UserPlus, 
  Phone, 
  User as UserIcon, 
  Sparkles, 
  ChevronRight,
  Eye,
  EyeOff,
  UserCircle,
  Briefcase,
  HelpCircle,
  KeyRound,
  MapPin
} from 'lucide-react';

interface LoginScreenProps {
  registeredUsers: User[];
  onLogin: (user: User) => void;
  onRegister: (user: User) => Promise<void>;
  onDeleteAllAccounts?: () => void;
  isUsersLoaded: boolean;
}

export function LoginScreen({ registeredUsers, onLogin, onRegister, onDeleteAllAccounts, isUsersLoaded }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [loginTab, setLoginTab] = useState<'staff' | 'manager'>(() => {
    try {
      const savedTab = localStorage.getItem('OPay_Last_Login_Tab');
      return (savedTab === 'staff' || savedTab === 'manager') ? savedTab : 'staff';
    } catch (e) {
      return 'staff';
    }
  });
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration form states
  const [regName, setRegName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('Manager');
  const [regPin, setRegPin] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regReferralCode, setRegReferralCode] = useState('');
  const [regArea, setRegArea] = useState('');
  const [showRegPin, setShowRegPin] = useState(false);
  
  // Login form states
  const [loginPhone, setLoginPhone] = useState(() => {
    try {
      return localStorage.getItem('OPay_Last_Staff_Phone') || '';
    } catch (e) {
      return '';
    }
  });
  const [managerPhone, setManagerPhone] = useState(() => {
    try {
      return localStorage.getItem('OPay_Last_Manager_Phone') || '';
    } catch (e) {
      return '';
    }
  });
  const [pin, setPin] = useState(() => {
    try {
      const remember = localStorage.getItem('OPay_Remember_Me') !== 'false';
      if (!remember) return '';
      const savedTab = localStorage.getItem('OPay_Last_Login_Tab');
      if (savedTab === 'staff') {
        return localStorage.getItem('OPay_Last_Staff_Pin') || '';
      } else if (savedTab === 'manager') {
        return localStorage.getItem('OPay_Last_Manager_Pin') || '';
      }
      return '';
    } catch (e) {
      return '';
    }
  });
  const [showPin, setShowPin] = useState(false);
  const [showDemoHelp, setShowDemoHelp] = useState(false);
  const [showForgotPasscode, setShowForgotPasscode] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem('OPay_Remember_Me') !== 'false';
    } catch (e) {
      return true;
    }
  });
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const staffUsers = registeredUsers.filter(u => u.role === 'Employee');
  const managerUsers = registeredUsers.filter(u => u.role === 'Manager');
  
  console.log('LoginScreen registeredUsers:', registeredUsers);
  console.log('LoginScreen managerUsers:', managerUsers);

  const avatarBgColors = [
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-purple-50 text-purple-700 border-purple-200',
    'bg-amber-50 text-amber-700 border-amber-200',
    'bg-rose-50 text-rose-700 border-rose-200'
  ];

  const getInitials = (name: string) => {
    return name.trim().split(/\s+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() || '👤';
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!loginPhone.trim()) {
      setError('Please enter your registered Phone Number or Full Name.');
      return;
    }

    if (!pin || pin.length !== 4) {
      setError('Please enter your 4-digit PIN.');
      return;
    }
    
    const cleanPhoneForCompare = (p: string) => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 10 ? digits.slice(-10) : digits;
    };
    
    const inputPhoneDigits = cleanPhoneForCompare(loginPhone);

    let user = staffUsers.find(u => {
      const dbPhoneDigits = cleanPhoneForCompare(u.phone || '');
      const dbName = u.name.trim().toLowerCase().replace(/\s+/g, '');
      const inputName = loginPhone.trim().toLowerCase().replace(/\s+/g, '');
      
      const phoneMatches = dbPhoneDigits && inputPhoneDigits && dbPhoneDigits === inputPhoneDigits;
      const nameMatches = dbName === inputName || u.name.toLowerCase() === loginPhone.trim().toLowerCase();
      
      return phoneMatches || nameMatches;
    });

    if (!user) {
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(query(usersRef, where('role', '==', 'Employee')));
        const allEmployees = snap.docs.map(doc => doc.data() as User);

        const matches = allEmployees.filter(u => {
          const dbPhoneDigits = cleanPhoneForCompare(u.phone || '');
          const dbName = u.name.trim().toLowerCase().replace(/\s+/g, '');
          const inputName = loginPhone.trim().toLowerCase().replace(/\s+/g, '');
          
          const phoneMatches = dbPhoneDigits && inputPhoneDigits && dbPhoneDigits === inputPhoneDigits;
          const nameMatches = dbName === inputName || u.name.toLowerCase() === loginPhone.trim().toLowerCase();
          
          return phoneMatches || nameMatches;
        });

        if (matches.length > 0) {
          // Prioritize matching PIN if multiple exist
          const correctPinMatch = matches.find(u => u.pin === pin);
          user = correctPinMatch || matches[0];
        }
      } catch (err) {
        console.warn('Global Firestore lookup failed', err);
      }
    }

    if (!user) {
      setError('Account not found. Please double check the phone number or name, or contact your manager.');
      return;
    }
    
    if (user.pin && user.pin !== pin) {
      setError('Incorrect 4-digit passcode PIN. Please try again.');
      return;
    }
    
    setSuccess(`Welcome back, ${user.name}! Logging in...`);
    try {
      localStorage.setItem('OPay_Remember_Me', rememberMe ? 'true' : 'false');
      if (rememberMe) {
        localStorage.setItem('OPay_Last_Login_Tab', 'staff');
        localStorage.setItem('OPay_Last_Staff_Phone', loginPhone);
        localStorage.setItem('OPay_Last_Staff_Pin', pin);
      } else {
        localStorage.removeItem('OPay_Last_Staff_Phone');
        localStorage.removeItem('OPay_Last_Staff_Pin');
      }
    } catch (e) {
      console.warn('Failed to save login credentials', e);
    }
    setTimeout(() => {
      onLogin(user);
    }, 800);
  };

  const handleManagerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!managerPhone.trim()) {
      setError('Please enter your registered Manager Phone Number or Full Name.');
      return;
    }

    if (!pin || pin.length !== 4) {
      setError('Please enter your 4-digit PIN.');
      return;
    }

    const cleanPhoneForCompare = (p: string) => {
      const digits = p.replace(/\D/g, '');
      return digits.length >= 10 ? digits.slice(-10) : digits;
    };
    
    const inputPhoneDigits = cleanPhoneForCompare(managerPhone);

    let matchedManager = managerUsers.find(m => {
      const dbPhoneDigits = cleanPhoneForCompare(m.phone || '');
      const dbName = m.name.trim().toLowerCase().replace(/\s+/g, '');
      const inputName = managerPhone.trim().toLowerCase().replace(/\s+/g, '');
      
      const phoneMatches = dbPhoneDigits && inputPhoneDigits && dbPhoneDigits === inputPhoneDigits;
      const nameMatches = dbName === inputName || m.name.toLowerCase() === managerPhone.trim().toLowerCase();
      
      console.log(`DEBUG: Matching locally: ${m.name}, DBPhone: ${dbPhoneDigits}, InputPhone: ${inputPhoneDigits}, Name: ${dbName}, InputName: ${inputName}`);
      
      return phoneMatches || nameMatches;
    });

    if (!matchedManager) {
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(query(usersRef, where('role', '==', 'Manager')));
        const allManagers = snap.docs.map(doc => doc.data() as User);
        
        console.log('DEBUG: Manager lookup failed locally. Cloud managers found:', allManagers.length);
        
        const matches = allManagers.filter(m => {
          const dbPhoneDigits = cleanPhoneForCompare(m.phone || '');
          const dbName = m.name.trim().toLowerCase().replace(/\s+/g, '');
          const inputName = managerPhone.trim().toLowerCase().replace(/\s+/g, '');
          
          const phoneMatches = dbPhoneDigits && inputPhoneDigits && dbPhoneDigits === inputPhoneDigits;
          const nameMatches = dbName === inputName || m.name.toLowerCase() === managerPhone.trim().toLowerCase();
          
          console.log(`DEBUG: Matching in cloud: ${m.name}, DBPhone: ${dbPhoneDigits}, InputPhone: ${inputPhoneDigits}, Name: ${dbName}, InputName: ${inputName}`);
          
          if (phoneMatches || nameMatches) {
            console.log('DEBUG: Manager match found in cloud!');
          }
          
          return phoneMatches || nameMatches;
        });
        
        if (matches.length > 0) {
          const correctPinMatch = matches.find(m => m.pin === pin);
          matchedManager = correctPinMatch || matches[0];
        }
      } catch (err) {
        console.error('Global Firestore manager login lookup failed', err);
      }
    }
    
    if (!matchedManager) {
      setError('Manager account not found. Please double check the phone number or name.');
      return;
    }

    if (matchedManager.pin && matchedManager.pin !== pin) {
      setError('Incorrect Manager Passcode PIN. Please verify your passcode.');
      return;
    }
    
    setSuccess(`Access Granted! Welcome back, Manager ${matchedManager.name}.`);
    try {
      localStorage.setItem('OPay_Remember_Me', rememberMe ? 'true' : 'false');
      if (rememberMe) {
        localStorage.setItem('OPay_Last_Login_Tab', 'manager');
        localStorage.setItem('OPay_Last_Manager_Phone', managerPhone);
        localStorage.setItem('OPay_Last_Manager_Pin', pin);
      } else {
        localStorage.removeItem('OPay_Last_Manager_Phone');
        localStorage.removeItem('OPay_Last_Manager_Pin');
      }
    } catch (e) {
      console.warn('Failed to save login credentials', e);
    }
    setTimeout(() => {
      onLogin(matchedManager);
    }, 800);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) return;
    setError('');
    setSuccess('');

    if (!regName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    if (!regPin || regPin.length !== 4 || !/^\d+$/.test(regPin)) {
      setError('Please choose a secure 4-digit numeric passcode PIN.');
      return;
    }

    if (regPhone && !/^\+?\d{8,15}$/.test(regPhone.replace(/\s+/g, ''))) {
      setError('Please enter a valid phone number (8-15 digits).');
      return;
    }

    // Check duplicate names to avoid confusion
    const exists = registeredUsers.some(u => u.name.toLowerCase() === regName.trim().toLowerCase() && u.role === regRole);
    if (exists) {
      setError(`An account named "${regName}" already exists as a ${regRole}.`);
      return;
    }

    // Check PIN collision for safety
    const pinExists = registeredUsers.some(u => u.pin === regPin);
    if (pinExists && regRole === 'Manager') {
      setError('This PIN is already associated with another account. Please choose a different 4-digit PIN.');
      return;
    }

    let manager: User | undefined;
    if (regRole === 'Employee') {
      const referralCode = regReferralCode.trim().toUpperCase();
      console.log('DEBUG: Looking for manager with referral code (normalized):', referralCode);
      
      manager = registeredUsers.find(u => {
        const dbReferralCode = u.referralCode ? u.referralCode.toUpperCase() : '';
        console.log(`DEBUG: Checking local user: ${u.name}, referralCode: ${dbReferralCode}`);
        return dbReferralCode === referralCode;
      });
      
      if (!manager) {
        try {
          const usersRef = collection(db, 'users');
          console.log('DEBUG: Referral code lookup in cloud for:', referralCode);
          const snap = await getDocs(query(usersRef, where('referralCode', '==', referralCode)));
          if (!snap.empty) {
            manager = snap.docs[0].data() as User;
            console.log('DEBUG: Referral code match found in cloud!');
          } else {
            console.log('DEBUG: Referral code NOT found in cloud.');
          }
        } catch (err) {
          console.error('Global Firestore referral code lookup failed', err);
        }
      }

      if (!manager) {
        setError('Invalid referral code. Please check and try again.');
        return;
      }
    }

    // Build unique ID
    const randomId = Math.random().toString(36).substr(2, 9);
    const userId = regRole === 'Manager' ? `mgr_${randomId}` : `emp_${randomId}`;

    const newUser: User = {
      id: userId,
      name: regName.trim(),
      role: regRole,
      pin: regPin,
      phone: regPhone.trim() ? normalizePhone(regPhone) : `080${Math.floor(10000000 + Math.random() * 90000000)}`,
      ownerId: regRole === 'Manager' ? userId : (manager?.id || managerUsers[0]?.id || 'mgr_1'),
      activated: true,
      email: regEmail.trim() || undefined,
      password: regPassword || undefined,
      referralCode: regRole === 'Manager' ? `MGR-${randomId.toUpperCase()}` : undefined,
      referredBy: regRole === 'Employee' ? regReferralCode.trim() : undefined,
      areaOfWorking: regRole === 'Employee' ? regArea.trim() : undefined
    };

    setIsRegistering(true);
    try {
      await onRegister(newUser);
      setSuccess(`Hooray! ${regRole} account created successfully for ${regName}!`);
      
      // Smooth reset and auto-select in Login screen
      setTimeout(() => {
        setAuthMode('login');
        if (regRole === 'Employee') {
          setLoginTab('staff');
          setLoginPhone(newUser.phone || newUser.name);
          setPin(newUser.pin || '');
          try {
            localStorage.setItem('OPay_Last_Login_Tab', 'staff');
            localStorage.setItem('OPay_Last_Staff_Phone', newUser.phone || newUser.name);
            localStorage.setItem('OPay_Last_Staff_Pin', newUser.pin || '');
          } catch (e) {}
        } else {
          setLoginTab('manager');
          setManagerPhone(newUser.phone || newUser.name);
          setPin(newUser.pin || '');
          try {
            localStorage.setItem('OPay_Last_Login_Tab', 'manager');
            localStorage.setItem('OPay_Last_Manager_Phone', newUser.phone || newUser.name);
            localStorage.setItem('OPay_Last_Manager_Pin', newUser.pin || '');
          } catch (e) {}
        }
        // Reset registration form
        setRegName('');
        setRegPin('');
        setRegPhone('');
        setRegEmail('');
        setRegPassword('');
        setError('');
        setSuccess('');
        setIsRegistering(false);
      }, 1800);
    } catch (err) {
      console.error('Registration failed:', err);
      setError('Registration failed. Please verify your connection and try again.');
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-emerald-50/40 via-neutral-50 to-indigo-50/40 flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-[#00B87A]/20 relative overflow-hidden">
      
      <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/3 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] overflow-hidden border border-white/60 z-10 transition-all">
        
        {/* Header Banner - OPay Styled Theme */}
        <div className="bg-gradient-to-br from-[#00B87A] via-[#00a36c] to-emerald-900 p-8 sm:p-12 text-center text-white relative">
          <div className="absolute top-6 right-6 bg-white/15 px-3 py-1 rounded-full text-[10px] font-mono tracking-widest uppercase font-black flex items-center gap-1.5 backdrop-blur-md border border-white/10">
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
            System Live
          </div>

          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 12 }}
            className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-white/20 backdrop-blur-xl shadow-2xl"
          >
            <Smartphone className="w-10 h-10 text-white drop-shadow-lg" />
          </motion.div>
          <h2 className="text-3xl font-black tracking-tight font-sans uppercase">Dan Godal</h2>
          <p className="text-emerald-100/80 text-[11px] font-bold mt-2 max-w-xs mx-auto uppercase tracking-[0.2em] leading-relaxed">
            Premium POS Audit Terminal
          </p>
        </div>

        {/* Mode Selector Tab (Login vs Register) */}
        <div className="flex border-b border-neutral-100 bg-neutral-50/50 p-2">
          <button
            onClick={() => {
              setAuthMode('login');
              setError('');
              setSuccess('');
            }}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2 ${
              authMode === 'login'
                ? 'bg-white text-neutral-850 shadow-sm border border-neutral-100 font-extrabold'
                : 'text-neutral-400 hover:text-neutral-700 font-bold'
            }`}
          >
            <KeyRound className="w-4 h-4 text-[#00B87A]" />
            <span>Secure Login</span>
          </button>
          <button
            onClick={() => {
              setAuthMode('register');
              setError('');
              setSuccess('');
            }}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black tracking-wider uppercase transition-all duration-150 flex items-center justify-center gap-2 relative ${
              authMode === 'register'
                ? 'bg-white text-neutral-850 shadow-sm border border-neutral-100 font-extrabold'
                : 'text-neutral-400 hover:text-neutral-700 font-bold'
            }`}
          >
            <UserPlus className="w-4 h-4 text-emerald-600" />
            <span>Register Account</span>
            <span className="absolute -top-1 right-2 bg-rose-500 text-white text-[8px] font-black font-mono px-1.5 py-0.5 rounded-full animate-bounce">
              NEW
            </span>
          </button>
        </div>

        {/* Screen Content */}
        <div className="p-6 sm:p-8">
          
          {/* Notifications */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5 p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-2xl flex items-start gap-2.5 text-xs font-bold"
              >
                <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-500 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-5 p-3.5 bg-emerald-50 border border-emerald-100 text-[#00B87A] rounded-2xl flex items-start gap-2.5 text-xs font-bold"
              >
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-500 mt-0.5" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {authMode === 'login' ? (
            <div>
              {/* Login Sub-Tabs: Employee vs Manager */}
              <div className="grid grid-cols-2 gap-2 bg-neutral-100 p-1 rounded-xl mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('staff');
                    setError('');
                    setPin('');
                  }}
                  className={`py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    loginTab === 'staff'
                      ? 'bg-[#00B87A] text-white shadow'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  👤 Cashier / Staff
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab('manager');
                    setError('');
                    setPin('');
                  }}
                  className={`py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                    loginTab === 'manager'
                      ? 'bg-neutral-800 text-white shadow'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  👑 Manager Portal
                </button>
              </div>

              {loginTab === 'staff' ? (
                /* STAFF LOGIN FORM */
                <form onSubmit={handleStaffLogin} className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      Cashier Phone Number or Full Name
                    </label>
                    <div className="relative">
                      <Smartphone className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={loginPhone}
                        onChange={(e) => {
                          setLoginPhone(e.target.value);
                          setError('');
                        }}
                        placeholder="e.g. 08123456781 or Cashier Name"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-4 py-3.5 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                          Passcode (4-digit PIN)
                        </label>
                        <span className="text-[10px] text-neutral-400 font-medium font-mono">Quick check-in</span>
                      </div>
                      <div className="relative">
                        <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type={showPin ? "text" : "password"}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter 4-digit PIN"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-12 py-3.5 text-base font-mono font-black text-neutral-850 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-sm text-center"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                        >
                          {showPin ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Tactile Virtual PIN Pad for Cashier login */}
                    <div className="bg-neutral-50/60 border border-neutral-100 p-4 rounded-3xl">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Tactile POS Keypad</div>
                        <button 
                          type="button" 
                          onClick={() => setShowForgotPasscode(true)}
                          className="text-[10px] text-[#00B87A] font-bold underline hover:text-[#00a36c] cursor-pointer uppercase tracking-wider font-mono"
                        >
                          Forgot Passcode?
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => {
                              if (pin.length < 4) {
                                setPin(prev => prev + num);
                                setError('');
                              }
                            }}
                            className="w-14 h-14 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-lg font-black font-mono shadow-sm active:scale-90 active:bg-neutral-100 transition-all flex items-center justify-center mx-auto cursor-pointer"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setPin('');
                            setError('');
                          }}
                          className="w-14 h-14 rounded-2xl border border-neutral-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black font-sans shadow-sm active:scale-90 transition-all flex items-center justify-center mx-auto cursor-pointer uppercase"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (pin.length < 4) {
                              setPin(prev => prev + '0');
                              setError('');
                            }
                          }}
                          className="w-14 h-14 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-lg font-black font-mono shadow-sm active:scale-90 active:bg-neutral-100 transition-all flex items-center justify-center mx-auto cursor-pointer"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPin(prev => prev.slice(0, -1));
                            setError('');
                          }}
                          className="w-14 h-14 rounded-2xl border border-neutral-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-lg font-bold shadow-sm active:scale-90 transition-all flex items-center justify-center mx-auto cursor-pointer"
                        >
                          ⌫
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-1 mt-3">
                    <input
                      type="checkbox"
                      id="rememberMeStaff"
                      checked={rememberMe}
                      onChange={(e) => {
                        setRememberMe(e.target.checked);
                        try {
                          localStorage.setItem('OPay_Remember_Me', e.target.checked ? 'true' : 'false');
                        } catch (err) {}
                      }}
                      className="w-4 h-4 text-[#00B87A] border-neutral-300 rounded focus:ring-[#00B87A] accent-[#00B87A] cursor-pointer"
                    />
                    <label htmlFor="rememberMeStaff" className="text-xs text-neutral-500 font-semibold cursor-pointer select-none">
                      Remember login details on this device
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!isUsersLoaded}
                    className={`w-full bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition active:scale-[0.98] shadow-md shadow-[#00B87A]/20 mt-4 cursor-pointer ${!isUsersLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span>{isUsersLoaded ? 'Log in to POS Terminal' : 'Loading Account Data...'}</span>
                    {isUsersLoaded && <ArrowRight className="w-4 h-4 stroke-[3]" />}
                  </button>
                </form>
              ) : (
                /* MANAGER LOGIN FORM */
                <form onSubmit={handleManagerLogin} className="space-y-5">
                  <div className="p-4 bg-indigo-50 border border-indigo-100/65 rounded-2xl flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Manager Control Center</h4>
                      <p className="text-[11px] text-indigo-700 mt-1 font-medium leading-relaxed">
                        Managers can change commission rates, monitor all terminals, approve staff shifts, and export raw audits.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2">
                      Manager Phone Number or Full Name
                    </label>
                    <div className="relative">
                      <Smartphone className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        value={managerPhone}
                        onChange={(e) => {
                          setManagerPhone(e.target.value);
                          setError('');
                        }}
                        placeholder="e.g. 08123456789 or Dan Godal"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-4 py-3.5 text-xs font-bold text-neutral-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                          Manager Passcode (PIN)
                        </label>
                        {managerUsers.length === 0 && (
                          <span className="text-[10px] text-rose-600 font-bold">Please Register a Manager First</span>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type={showPin ? "text" : "password"}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={4}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Enter Manager 4-Digit PIN"
                          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-12 py-3.5 text-base font-mono font-black text-neutral-850 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-sm text-center"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                        >
                          {showPin ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                      {managerUsers.length > 0 ? (
                        <p className="text-[10px] text-neutral-400 mt-2 font-medium">
                          Hint: Use your registered 4-digit passcode PIN .
                        </p>
                      ) : (
                        <p className="text-xs text-rose-600 font-bold mt-2 leading-relaxed">
                          No manager account exists yet. Click the <strong className="underline cursor-pointer" onClick={() => { setAuthMode('register'); setRegRole('Manager'); }}>Register Account</strong> tab above to configure your manager profile!
                        </p>
                      )}
                    </div>

                    {managerUsers.length > 0 && (
                      /* Tactile Virtual PIN Pad for Manager login */
                      <div className="bg-neutral-50/60 border border-neutral-100 p-4 rounded-3xl">
                        <div className="flex justify-between items-center mb-3">
                          <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Tactile Manager Keypad</div>
                          <button 
                            type="button" 
                            onClick={() => setShowForgotPasscode(true)}
                            className="text-[10px] text-indigo-600 font-bold underline hover:text-indigo-800 cursor-pointer uppercase tracking-wider font-mono"
                          >
                            Forgot Passcode?
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 max-w-[260px] mx-auto">
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => {
                                if (pin.length < 4) {
                                  setPin(prev => prev + num);
                                  setError('');
                                }
                              }}
                              className="w-14 h-14 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-lg font-black font-mono shadow-sm active:scale-90 active:bg-neutral-100 transition-all flex items-center justify-center mx-auto cursor-pointer"
                            >
                              {num}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setPin('');
                              setError('');
                            }}
                            className="w-14 h-14 rounded-2xl border border-neutral-200 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[10px] font-black font-sans shadow-sm active:scale-90 transition-all flex items-center justify-center mx-auto cursor-pointer uppercase"
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (pin.length < 4) {
                                setPin(prev => prev + '0');
                                setError('');
                              }
                            }}
                            className="w-14 h-14 rounded-2xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 text-lg font-black font-mono shadow-sm active:scale-90 active:bg-neutral-100 transition-all flex items-center justify-center mx-auto cursor-pointer"
                          >
                            0
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPin(prev => prev.slice(0, -1));
                              setError('');
                            }}
                            className="w-14 h-14 rounded-2xl border border-neutral-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-lg font-bold shadow-sm active:scale-90 transition-all flex items-center justify-center mx-auto cursor-pointer"
                          >
                            ⌫
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 px-1 mt-3">
                    <input
                      type="checkbox"
                      id="rememberMeManager"
                      checked={rememberMe}
                      onChange={(e) => {
                        setRememberMe(e.target.checked);
                        try {
                          localStorage.setItem('OPay_Remember_Me', e.target.checked ? 'true' : 'false');
                        } catch (err) {}
                      }}
                      className="w-4 h-4 text-indigo-600 border-neutral-300 rounded focus:ring-indigo-600 accent-indigo-600 cursor-pointer"
                    />
                    <label htmlFor="rememberMeManager" className="text-xs text-neutral-500 font-semibold cursor-pointer select-none">
                      Remember login details on this device
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!isUsersLoaded}
                    className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition active:scale-[0.98] shadow-md shadow-indigo-600/20 mt-4 cursor-pointer ${!isUsersLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span>{isUsersLoaded ? 'Enter Manager Dashboard' : 'Loading Account Data...'}</span>
                    {isUsersLoaded && <ArrowRight className="w-4 h-4 stroke-[3]" />}
                  </button>
                </form>
              )}

              {/* High-Security System Seal */}
              <div className="mt-8 pt-5 border-t border-neutral-200/60 text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-50 rounded-full border border-neutral-200/50 text-[10px] text-neutral-400 font-mono tracking-wide font-semibold select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  SECURED AES-256 POS CLIENT
                </div>
              </div>
            </div>
          ) : (
            /* ACCOUNT REGISTRATION FORM */
            <form onSubmit={handleRegister} className="space-y-5 animate-fade-in">
              <div className="text-center mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-[#00B87A] px-3 py-1 rounded-full border border-emerald-100">
                  <Sparkles className="w-3 h-3 inline mr-1" /> Custom Account Registration
                </span>
                <p className="text-[11px] text-neutral-400 font-semibold mt-2">
                  Create a secure operator profile to begin auditing and tracking POS slips.
                </p>
              </div>

              {/* Role Picker Cards */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                  Choose Operator Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Manager Option */}
                  <div
                    onClick={() => setRegRole('Manager')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      regRole === 'Manager'
                        ? 'border-indigo-500 bg-indigo-50/20 shadow-sm'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-indigo-950 font-mono flex items-center gap-1.5">
                        👑 Manager 
                        <span className="text-[8px] bg-indigo-600 text-white font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90 origin-left">FREE</span>
                      </span>
                      <input
                        type="radio"
                        checked={regRole === 'Manager'}
                        onChange={() => {}}
                        className="accent-indigo-600"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-400 font-semibold mt-2 leading-tight">
                      Full control. Manage cashiers, sound, target levels & terminals.
                    </span>
                  </div>

                  {/* Employee Option */}
                  <div
                    onClick={() => setRegRole('Employee')}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      regRole === 'Employee'
                        ? 'border-[#00B87A] bg-emerald-50/20'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-emerald-950 font-mono">👤 Cashier / Staff</span>
                      <input
                        type="radio"
                        checked={regRole === 'Employee'}
                        onChange={() => {}}
                        className="accent-[#00B87A]"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-400 font-semibold mt-2 leading-tight">
                      Log slips. Focuses entirely on inputting withdrawals & transfers.
                    </span>
                  </div>
                </div>

                {regRole === 'Manager' && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-3 rounded-xl flex items-start gap-2.5 animate-pulse">
                    <span className="text-base">⭐</span>
                    <div className="text-left">
                      <p className="text-[11px] font-black text-indigo-950 uppercase tracking-wide">Free Lifetime Manager Account Activated</p>
                      <p className="text-[9px] text-indigo-700/80 font-semibold leading-relaxed mt-0.5">
                        Track unlimited POS workers, manage active sessions, view comprehensive transaction statistics, and enforce direct terminal control with zero activation fees or monthly charges!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Cashier Name"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                  Phone Number (10 - 11 digits)
                </label>
                <div className="relative">
                  <Phone className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value.replace(/[^\d+]/g, ''))}
                    placeholder="e.g. 08123456789"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] placeholder:text-neutral-400"
                  />
                </div>
              </div>

              {/* Referral Code (only for Employees) */}
              {regRole === 'Employee' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                      Referral Code (Required)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        required
                        value={regReferralCode}
                        onChange={(e) => setRegReferralCode(e.target.value)}
                        placeholder="e.g. MGR-123456789"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] placeholder:text-neutral-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">
                      Work Area/Location
                    </label>
                    <div className="relative">
                      <MapPin className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        required
                        value={regArea}
                        onChange={(e) => setRegArea(e.target.value)}
                        placeholder="e.g. Shop A12"
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-4 py-3.5 text-sm font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] placeholder:text-neutral-400"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Passcode PIN */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    Create 4-Digit Passcode (PIN)
                  </label>
                  <span className="text-[9px] text-rose-500 font-bold uppercase tracking-wider font-mono">Numbers Only</span>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type={showRegPin ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    required
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter unique 4-digit PIN"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-12 pr-12 py-3.5 text-base font-mono font-black text-neutral-850 focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] tracking-widest placeholder:tracking-normal placeholder:font-sans placeholder:font-normal placeholder:text-sm text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPin(!showRegPin)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition"
                  >
                    {showRegPin ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-400 mt-1.5 leading-normal">
                  Write down your PIN! You will use this passcode to instantly log in and secure the terminal.
                </p>
              </div>

              {/* Cloud Sync Extra Fields (Optional) */}
              <div className="border-t border-neutral-100 pt-4 mt-2">
                <div className="flex items-center gap-1.5 mb-3 text-neutral-400">
                  <Briefcase className="w-4 h-4" />
                  <span className="text-[9px] font-bold tracking-widest uppercase">Optional Email Recovery</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Email (Optional)"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A]"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Password (Optional)"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-bold text-neutral-800 focus:outline-none focus:border-[#00B87A]"
                    />
                  </div>
                </div>
              </div>

               <button
                type="submit"
                disabled={isRegistering}
                className={`w-full text-white rounded-2xl py-4 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 transition active:scale-[0.98] shadow-md mt-6 cursor-pointer ${
                  isRegistering 
                    ? 'bg-neutral-400 cursor-not-allowed shadow-none' 
                    : regRole === 'Manager'
                      ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                      : 'bg-[#00B87A] hover:bg-[#00a36c] shadow-[#00B87A]/20'
                }`}
              >
                <span>{isRegistering ? 'Registering...' : `Register ${regRole}`}</span>
                {isRegistering ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ChevronRight className="w-4.5 h-4.5 stroke-[3]" />
                )}
              </button>
            </form>
          )}

        </div>

        {/* Footer info banner */}
        <div className="bg-neutral-50 p-5 text-center border-t border-neutral-100 flex flex-col items-center justify-center gap-3">
          <p className="text-[10px] font-bold text-neutral-400 flex items-center justify-center gap-1.5 uppercase tracking-widest font-mono">
            <CheckCircle2 className="w-4 h-4 text-[#00B87A]" /> Secure CBN Licensed Agency Terminal
          </p>
          <p className="text-[9px] text-neutral-400 max-w-xs leading-relaxed font-semibold">
            All cashier sessions are monitored and logged. Keep your terminal safe. For support, call 0700-OPAY-HELP.
          </p>
        </div>

      </div>

      {showForgotPasscode && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-200 text-neutral-800 p-6 relative text-center">
            <button 
              onClick={() => setShowForgotPasscode(false)} 
              className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-full transition"
            >
              <div className="w-5 h-5 flex items-center justify-center text-lg leading-none">&times;</div>
            </button>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8" />
            </div>
            <h3 className="font-black text-lg mb-2 tracking-tight">Forgot Passcode?</h3>
            {loginTab === 'staff' ? (
              <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                If you are a Cashier, please contact your Manager. They can securely reset your 4-digit PIN from their Manager Dashboard under the <strong>Profile Center</strong>.
              </p>
            ) : (
              <p className="text-sm text-neutral-600 mb-6 leading-relaxed">
                If you forgot your Manager PIN, please contact OPay Business Support or proceed with registering a secure new manager profile.
              </p>
            )}
            <button
              onClick={() => setShowForgotPasscode(false)}
              className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-bold rounded-xl text-sm transition cursor-pointer uppercase tracking-wider"
            >
              Okay, Got It
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
