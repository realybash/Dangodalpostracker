/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useReducer, useEffect, useState, useMemo, useRef } from 'react';
import { AppState, AppAction, User, Transaction, UserRole, TransactionType, AppSettings, Expense, PosTerminal, ProviderType } from './types';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, doc, query, where, onSnapshot, setDoc, getDoc, deleteDoc, writeBatch, getDocFromServer, getDocs } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  getSeedTransactions, 
  computeTxMetrics, 
  formatNaira, 
  isSameDay, 
  isSameWeek, 
  isSameMonth, 
  isSameYear, 
  calculateTerminalFee,
  getProviderTransactionNumber
} from './utils';
import { MetricCards } from './components/MetricCards';
import { ManagerAggregatedStats } from './components/ManagerAggregatedStats';
import { RealizedGainHistory } from './components/RealizedGainHistory';
import { TransactionForm } from './components/TransactionForm';
import { AudioRecorder } from './components/AudioRecorder';
import { CalendarFilter } from './components/CalendarFilter';
import { TransactionList } from './components/TransactionList';
import { BreakdownTable } from './components/BreakdownTable';
import { ProviderBreakdown } from './components/ProviderBreakdown';
import { TrendChart } from './components/TrendChart';
import { ProfileModal, renderUserAvatar } from './components/ProfileModal';
import { AnimatedNumber } from './components/AnimatedNumber';
import { SettingsModal } from './components/SettingsModal';
import { ShiftControlModal } from './components/ShiftControlModal';
import { BorrowKeepSection } from './components/BorrowKeepSection';
import { UnpaidChargesLedger } from './components/UnpaidChargesLedger';
import { EmployeeOversightBoard } from './components/EmployeeOversightBoard';
import { EditEmployeeModal } from './components/EditEmployeeModal';
import { CashierReconciliationCalculator } from './components/CashierReconciliationCalculator';
import { LoginScreen } from './components/LoginScreen';
import { 
  User as UserIcon,
  UserCheck, 
  Users, 
  ChevronDown,
  ChevronUp,
  ShieldCheck, 
  TrendingUp, 
  Settings, 
  Percent,
  Plus,
  HelpCircle,
  FileSpreadsheet,
  Menu,
  X,
  Smartphone,
  Eye,
  EyeOff,
  Bell,
  Headphones,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Sparkles,
  Search,
  Target,
  Calculator,
  History,
  Lock,
  Unlock,
  Key,
  ShieldAlert, AlertTriangle,
  LogOut,
  Calendar,
  FileText,
  Copy,
  Check,
  Pencil,
  Edit3,
  Receipt,
  TrendingDown,
  Tag,
  CreditCard,
  Wifi,
  Globe,
  RefreshCw,
  CheckCircle,
  XCircle,
  MapPin,
  Building,
  Cloud,
  CloudOff,
  WifiOff
} from 'lucide-react';

const LOCAL_STORAGE_KEY = 'POSTrack_State_Store_v5';

// Initial Users Seeding
const EMPLOYEES: User[] = [];

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  voiceEnabled: false,
  businessName: 'My Agency',
  receiptAddress: 'Your Address Here',
  receiptPhone: 'Your Phone Number',
  receiptFooter: 'Thank you for your business!',
  listDensity: 'comfortable',
  pageSize: 10,
  defaultProvider: 'OPay',
  defaultType: 'Withdrawal',
  chartStyle: 'line',
  darkMode: false,
  language: 'en'
};

const DEFAULT_STATE: AppState = {
  currentUser: {
    id: '',
    name: 'Please Login',
    role: 'Employee',
    pin: '',
    phone: '',
    ownerId: ''
  },
  availableEmployees: EMPLOYEES,
  transactions: [],
  selectedEmployeeFilter: 'ALL',
  activeTimeframe: 'Daily',
  terminalFeeRate: 0.5,
  dailyTarget: 3000,
  expenses: [],
  posTerminals: [],
  settings: DEFAULT_SETTINGS
};

// Reducer implementation guaranteeing reactive immediate computation
function appReducer(state: AppState, action: AppAction): AppState {
  let nextState: AppState;

  switch (action.type) {
    case 'SWITCH_USER': {
      const nextUser = action.payload;
      // Safety rule constraints: Employees must strictly only filter to themselves!
      const nextFilter = nextUser.role === 'Manager' ? 'ALL' : nextUser.id;
      nextState = {
        ...state,
        currentUser: nextUser,
        selectedEmployeeFilter: nextFilter
      };
      break;
    }
    case 'SET_EMPLOYEE_FILTER': {
      // Employees are blocked from switching filters
      if (state.currentUser.role === 'Employee') {
        nextState = state;
      } else {
        nextState = {
          ...state,
          selectedEmployeeFilter: action.payload
        };
      }
      break;
    }
    case 'SET_TIMEFRAME': {
      nextState = {
        ...state,
        activeTimeframe: action.payload
      };
      break;
    }
    case 'SET_TERMINAL_RATE': {
      nextState = {
        ...state,
        terminalFeeRate: action.payload
      };
      break;
    }
    case 'SET_DAILY_TARGET': {
      nextState = {
        ...state,
        dailyTarget: action.payload
      };
      break;
    }
    case 'ADD_TRANSACTION': {
      // Prepend so operations show right at the top
      nextState = {
        ...state,
        transactions: [action.payload, ...state.transactions]
      };
      break;
    }
    case 'UPDATE_TRANSACTION': {
      nextState = {
        ...state,
        transactions: state.transactions.map(t => t.id === action.payload.id ? action.payload : t)
      };
      break;
    }
    case 'DELETE_TRANSACTION': {
      nextState = {
        ...state,
        transactions: state.transactions.filter(t => t.id !== action.payload)
      };
      break;
    }
    case 'BULK_DELETE_TRANSACTIONS': {
      nextState = {
        ...state,
        transactions: state.transactions.filter(t => !action.payload.includes(t.id))
      };
      break;
    }
    case 'BULK_UPDATE_TRANSACTIONS': {
      nextState = {
        ...state,
        transactions: state.transactions.map((t) => {
          const match = action.payload.find((u) => u.id === t.id);
          return match ? match : t;
        })
      };
      break;
    }
    case 'ADD_EXPENSE': {
      nextState = {
        ...state,
        expenses: [action.payload, ...state.expenses]
      };
      break;
    }
    case 'DELETE_EXPENSE': {
      nextState = {
        ...state,
        expenses: state.expenses.filter(e => e.id !== action.payload)
      };
      break;
    }
    case 'RESET_DATA': {
      nextState = {
        ...state,
        transactions: getSeedTransactions(state.terminalFeeRate),
        expenses: []
      };
      break;
    }
    case 'SET_TRANSACTIONS': {
      nextState = {
        ...state,
        transactions: action.payload
      };
      break;
    }
    case 'SET_EXPENSES': {
      nextState = {
        ...state,
        expenses: action.payload
      };
      break;
    }
    case 'SET_REGISTERED_USERS': {
      nextState = {
        ...state,
        availableEmployees: action.payload.filter(u => u.role === 'Employee' && u.ownerId === state.currentUser.id)
      };
      break;
    }
    case 'SET_POS_TERMINALS': {
      nextState = {
        ...state,
        posTerminals: action.payload
      };
      break;
    }
    case 'ADD_POS_TERMINAL': {
      nextState = {
        ...state,
        posTerminals: [action.payload, ...state.posTerminals]
      };
      break;
    }
    case 'UPDATE_POS_TERMINAL': {
      nextState = {
        ...state,
        posTerminals: state.posTerminals.map(p => p.id === action.payload.id ? action.payload : p)
      };
      break;
    }
    case 'DELETE_POS_TERMINAL': {
      nextState = {
        ...state,
        posTerminals: state.posTerminals.filter(p => p.id !== action.payload)
      };
      break;
    }
    case 'UPDATE_SETTINGS': {
      nextState = {
        ...state,
        settings: {
          ...state.settings!,
          ...action.payload
        }
      };
      break;
    }
    case 'SET_IMPERSONATED_USER': {
      nextState = {
        ...state,
        impersonatedUserId: action.payload
      };
      break;
    }
    default:
      return state;
  }

  return nextState;
}

// Helper to initialize state from local storage securely
function initAppState(): AppState {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Aggressively check for demo users and clear if found
      const demoIds = ['mgr_1', 'emp_1', 'emp_2', 'emp_3'];
      const hasDemoUsers = (parsed.availableEmployees || []).some((u: any) => demoIds.includes(u.id)) || 
                           (parsed.currentUser && demoIds.includes(parsed.currentUser.id));
      
      if (hasDemoUsers) {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return DEFAULT_STATE;
      }

      return {
        ...DEFAULT_STATE,
        ...parsed,
        availableEmployees: Array.isArray(parsed.availableEmployees) ? parsed.availableEmployees : [],
        currentUser: parsed.currentUser || DEFAULT_STATE.currentUser,
        // Make sure date values parsed as string can be computed elegantly
        transactions: (Array.isArray(parsed.transactions) ? parsed.transactions : []).map((t: any) => ({
          ...t,
          amount: parseFloat(t?.amount || 0),
          customerFee: parseFloat(t?.customerFee || 0),
          terminalFee: parseFloat(t?.terminalFee || 0),
          profit: parseFloat(t?.profit || 0)
        })),
        posTerminals: Array.isArray(parsed.posTerminals) ? parsed.posTerminals : [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {})
        }
      };
    }
  } catch (err) {
    console.warn('LocalStorage state recovery skipped', err);
  }
  return DEFAULT_STATE;
}

export default function App() {
  const [state, dispatch] = useReducer(appReducer, undefined, initAppState);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Sync state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
        transactions: state.transactions,
        terminalFeeRate: state.terminalFeeRate,
        dailyTarget: state.dailyTarget,
        selectedEmployeeFilter: state.selectedEmployeeFilter,
        activeTimeframe: state.activeTimeframe,
        currentUser: state.currentUser,
        settings: state.settings,
        impersonatedUserId: state.impersonatedUserId
      }));
    } catch (err) {
      console.warn('LocalStorage save failed', err);
    }
  }, [state]);

  // Synchronize dark theme state with the DOM
  useEffect(() => {
    const isDark = state.settings?.darkMode ?? false;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings?.darkMode]);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [preselectedFormType, setPreselectedFormType] = useState<TransactionType>('Withdrawal');
  const [helpBannerOpen, setHelpBannerOpen] = useState(true);
  const [hideBalances, setHideBalances] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState(new Date());
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isReconCalcOpen, setIsReconCalcOpen] = useState(false);
  const [editingEmployeeFromDashboard, setEditingEmployeeFromDashboard] = useState<User | null>(null);
  const [appNotification, setAppNotification] = useState<{message: string, type: 'success' | 'info' | 'error'} | null>(null);

  const showAppNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setAppNotification({ message, type });
    setTimeout(() => setAppNotification(null), 5000);
  };

  const unpaidCount = useMemo(() => {
    return state.transactions.filter(
      (tx) => (tx.chargesStatus === 'Unpaid' || tx.chargesStatus === 'PartiallyPaid') && (tx.status || 'Success') !== 'Failed'
    ).length;
  }, [state.transactions]);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);

   // Manager Auth states
  const [cloudUser, setCloudUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true);

  const syncOwnerId = useMemo(() => {
    if (cloudUser) {
      return cloudUser.uid;
    }
    if (state.currentUser && state.currentUser.id && state.currentUser.id !== '') {
      return state.currentUser.role === 'Manager' ? state.currentUser.id : state.currentUser.ownerId;
    }
    return null;
  }, [cloudUser, state.currentUser]);

  // Compute number of items currently pending cloud sync
  const pendingSyncCount = useMemo(() => {
    if (!syncOwnerId || syncOwnerId === 'mgr_1' || syncOwnerId === '') return 0;
    
    const unsyncedTxs = state.transactions.filter(
      t => !t.ownerId || t.ownerId === 'local_owner' || t.ownerId === 'mgr_1'
    ).length;
    
    const unsyncedExpenses = state.expenses.filter(
      e => !e.ownerId || e.ownerId === 'local_owner' || e.ownerId === 'mgr_1'
    ).length;
    
    const unsyncedTerminals = state.posTerminals.filter(
      pt => !pt.ownerId || pt.ownerId === 'local_owner' || pt.ownerId === 'mgr_1'
    ).length;

    return unsyncedTxs + unsyncedExpenses + unsyncedTerminals;
  }, [syncOwnerId, state.transactions, state.expenses, state.posTerminals]);

  const [cloudLoading, setCloudLoading] = useState(true);

  // Sync network connectivity status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Authentication form modal states
  const [isCloudSyncFormOpen, setIsCloudSyncFormOpen] = useState(false);
  const [cloudFormTab, setCloudFormTab] = useState<'signin' | 'signup' | 'forgot' | 'employee_signin'>('signin');
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudBusinessName, setCloudBusinessName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [cloudFormError, setCloudFormError] = useState('');
  const [cloudFormSuccessMessage, setCloudFormSuccessMessage] = useState('');
  const [cloudFormLoading, setCloudFormLoading] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmt, setNewExpenseAmt] = useState('');
  const [newExpenseNotes, setNewExpenseNotes] = useState('');
  const [newExpenseAudio, setNewExpenseAudio] = useState('');
  const [isAddingTerminal, setIsAddingTerminal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState('');
  const [newTerminalProvider, setNewTerminalProvider] = useState<ProviderType>('OPay');
  const [newTerminalAccountNo, setNewTerminalAccountNo] = useState('');
  const [newTerminalCashierName, setNewTerminalCashierName] = useState('');
  const [newTerminalArea, setNewTerminalArea] = useState('');
  const [newTerminalSN, setNewTerminalSN] = useState('');
  const [newTerminalSim, setNewTerminalSim] = useState('');
  const [newTerminalNetwork, setNewTerminalNetwork] = useState<string>('MTN');
  const [newTerminalBattery, setNewTerminalBattery] = useState<number>(100);
  const [newTerminalSignal, setNewTerminalSignal] = useState<number>(5);
  const [newTerminalRate, setNewTerminalRate] = useState<0.25 | 0.5>(0.5);
  const [dashboardTab, setDashboardTab] = useState<'pos' | 'expenses' | 'unpaid' | 'terminals' | 'reports' | 'settings'>('pos');
  const ownerTxsRef = useRef<Transaction[]>([]);
  const cashierTxsRef = useRef<Transaction[]>([]);

  // Compute individual stats for each linked terminal
  const terminalStats = useMemo(() => {
    const list = state.posTerminals || [];
    const txs = state.transactions || [];
    
    return list.map(terminal => {
      // Find all successful transactions matching this terminal's ID
      const matchingTxs = txs.filter(t => t.terminalId === terminal.id && t.status === 'Success');
      
      const volume = matchingTxs.reduce((sum, t) => sum + t.amount, 0);
      const profit = matchingTxs.reduce((sum, t) => sum + t.profit, 0);
      const count = matchingTxs.length;
      
      return {
        ...terminal,
        volume,
        profit,
        count
      };
    });
  }, [state.posTerminals, state.transactions]);

  // Find the most active registered terminal based on transaction volume
  const mostActiveTerminal = useMemo(() => {
    if (!terminalStats || terminalStats.length === 0) return null;
    const activeOnly = terminalStats.filter(t => t.volume > 0);
    if (activeOnly.length === 0) return null;
    return activeOnly.reduce((max, curr) => curr.volume > max.volume ? curr : max, activeOnly[0]);
  }, [terminalStats]);

  // Find terminal for current user
  const myTerminal = useMemo(() => {
    const targetUserId = state.impersonatedUserId || state.currentUser.id;
    return state.posTerminals?.find(t => t.employeeId === targetUserId);
  }, [state.posTerminals, state.currentUser.id, state.impersonatedUserId]);

  // Compute stats for "Default/No Specific Terminal" transactions
  const defaultTerminalStats = useMemo(() => {
    const txs = state.transactions || [];
    // Successful transactions that do not have a terminalId
    const matchingTxs = txs.filter(t => !t.terminalId && t.status === 'Success');
    
    const volume = matchingTxs.reduce((sum, t) => sum + t.amount, 0);
    const profit = matchingTxs.reduce((sum, t) => sum + t.profit, 0);
    const count = matchingTxs.length;
    
    return {
      volume,
      profit,
      count
    };
  }, [state.transactions]);

  // Compute today's statistics for active shift operator
  const currentShiftStats = useMemo(() => {
    const todayStr = new Date().toDateString();
    const targetUserId = state.impersonatedUserId || state.currentUser.id;
    const myTxs = (state.transactions || []).filter(t => t.employeeId === targetUserId && t.status === 'Success');
    const todayTxs = myTxs.filter(t => new Date(t.timestamp).toDateString() === todayStr);
    return {
      count: todayTxs.length,
      volume: todayTxs.reduce((sum, t) => sum + t.amount, 0),
      profit: todayTxs.reduce((sum, t) => sum + t.profit, 0)
    };
  }, [state.transactions, state.currentUser.id, state.impersonatedUserId]);

  // Initialize Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCloudUser(user);
      setCloudLoading(false);
      
      if (user) {
        const managerId = user.uid;
        const managerDocRef = doc(db, 'users', managerId);
        
        const updatePoolAndDispatch = (mUser: User) => {
          setRegisteredUsers((prev) => {
            if (!prev.some(u => u.id === mUser.id)) {
              const next = [...prev, mUser];
              localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(next));
              return next;
            }
            return prev;
          });
          dispatch({ type: 'SWITCH_USER', payload: mUser });
        };

        try {
          const snap = await getDoc(managerDocRef);
          let managerUser: User;
          
          if (snap.exists()) {
            managerUser = snap.data() as User;
          } else {
            managerUser = {
              id: managerId,
              name: user.displayName || 'Terminal Manager',
              role: 'Manager',
              email: user.email || '',
              phone: user.phoneNumber || '',
              ownerId: managerId,
              activated: true,
              referralCode: `MGR-${managerId.substring(0, 5).toUpperCase()}`
            };
            await setDoc(managerDocRef, managerUser);
          }
          
          updatePoolAndDispatch(managerUser);
        } catch (err) {
          console.warn('Failed to sync cloud manager profile:', err);
          const fallbackManager: User = {
            id: managerId,
            name: user.displayName || 'Terminal Manager',
            role: 'Manager',
            email: user.email || '',
            phone: '',
            ownerId: managerId,
            activated: true,
            referralCode: `MGR-${managerId.substring(0, 5).toUpperCase()}`
          };
          updatePoolAndDispatch(fallbackManager);
        }
      } else {
        // If they sign out of Cloud Sync, switch to the default local manager
        if (state.currentUser.role === 'Manager' && state.currentUser.id !== 'mgr_1') {
          const localManager = {
            id: 'mgr_1',
            name: 'Terminal Manager',
            role: 'Manager',
            pin: '2026',
            phone: '08123456789',
            ownerId: 'mgr_1',
            activated: true
          };
          dispatch({ type: 'SWITCH_USER', payload: localManager });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleCloudSignIn = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const handleCloudSignUp = async (email: string, pass: string, name: string, referralCode?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    if (userCredential.user) {
      await updateProfile(userCredential.user, {
        displayName: name
      });
      // Force tag refresh
      setCloudUser({ ...userCredential.user, displayName: name, referralCode: referralCode || null });
    }
  };

  const handleCloudFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloudFormError('');
    setCloudFormSuccessMessage('');
    const emailStr = cloudEmail.trim();
    if (!emailStr) {
      setCloudFormError('Please enter a valid email address.');
      return;
    }
    if (!emailStr.includes('@') || !emailStr.includes('.')) {
      setCloudFormError('Please enter a valid email address.');
      return;
    }

    if (cloudFormTab !== 'forgot' && (!cloudPassword || cloudPassword.length < 6)) {
      setCloudFormError('Password must be at least 6 characters.');
      return;
    }
    if (cloudFormTab === 'signup' && !cloudBusinessName.trim()) {
      setCloudFormError('Please enter your business or manager name.');
      return;
    }

    setCloudFormLoading(true);
    try {
      if (cloudFormTab === 'employee_signin') {
        const foundEmployee = registeredUsers.find(
          (u) => u.email?.trim().toLowerCase() === emailStr.toLowerCase()
        );
        if (!foundEmployee) {
          throw new Error('No registered employee account matches this email.');
        }
        if (foundEmployee.password !== cloudPassword) {
          throw new Error('Incorrect credentials. Access denied.');
        }
        if (foundEmployee.activated === false) {
          throw new Error('Your account is inactive. Please ask your manager to activate it.');
        }

        // Successfully authenticated!
        dispatch({ type: 'SWITCH_USER', payload: foundEmployee });
        setCloudFormSuccessMessage(`Welcome back, Employee ${foundEmployee.name}! Session started.`);
        // Clear active form details and close popup
        setTimeout(() => {
          setIsCloudSyncFormOpen(false);
          setCloudEmail('');
          setCloudPassword('');
          setCloudFormSuccessMessage('');
        }, 1500);
      } else if (cloudFormTab === 'signin') {
        await handleCloudSignIn(emailStr, cloudPassword);
        setIsCloudSyncFormOpen(false);
        setCloudEmail('');
        setCloudPassword('');
        setCloudBusinessName('');
      } else if (cloudFormTab === 'signup') {
        await handleCloudSignUp(emailStr, cloudPassword, cloudBusinessName.trim(), referralCode.trim());
        setIsCloudSyncFormOpen(false);
        setCloudEmail('');
        setCloudPassword('');
        setCloudBusinessName('');
        setReferralCode('');
      } else if (cloudFormTab === 'forgot') {
        await sendPasswordResetEmail(auth, emailStr);
        setCloudFormSuccessMessage('Password reset email sent! Check your inbox to choose a new password.');
        setCloudPassword('');
      }
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential') || msg.includes('invalid-email')) {
        setCloudFormError('Invalid credentials. Check email and password.');
      } else if (msg.includes('email-already-in-use')) {
        setCloudFormError('This email is already registered. Please sign in instead.');
      } else {
        setCloudFormError(msg.replace('Firebase: ', ''));
      }
    } finally {
      setCloudFormLoading(false);
    }
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test_connection', 'ping'));
      } catch (e) {
        console.warn('Initial server connection failed (expected if offline)');
      }
    };
    testConnection();
  }, []);

  // Real-time Firestore sync subscriptions when syncOwnerId is active
  useEffect(() => {
    if (!syncOwnerId) {
      return;
    }

    // Subscribe to Manager-owned employees
    const usersQuery = query(collection(db, 'users'), where('ownerId', '==', syncOwnerId));
    const unsubscribeUsers = onSnapshot(usersQuery, async (snapshot) => {
      const usersList: User[] = [];
      snapshot.forEach((docSnap) => {
        usersList.push(docSnap.data() as User);
      });

      setRegisteredUsers(usersList);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    // Subscribe to transactions
    const updateCombinedTxs = () => {
      const combined = [...ownerTxsRef.current, ...cashierTxsRef.current];
      const unique = Array.from(new Map(combined.map(tx => [tx.id, tx])).values());
      unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      dispatch({ type: 'SET_TRANSACTIONS', payload: unique });
    };

    const unsubscribeOwner = onSnapshot(query(collection(db, 'transactions'), where('ownerId', '==', syncOwnerId)), (snap) => {
      ownerTxsRef.current = snap.docs.map(d => d.data() as Transaction);
      updateCombinedTxs();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions_owner'));

    const unsubscribeCashier = onSnapshot(query(collection(db, 'transactions'), where('cashierId', '==', syncOwnerId)), (snap) => {
      cashierTxsRef.current = snap.docs.map(d => d.data() as Transaction);
      updateCombinedTxs();
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions_cashier'));


    // Subscribe to Manager-owned expenses
    const expensesQuery = query(collection(db, 'expenses'), where('ownerId', '==', syncOwnerId));
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const expList: Expense[] = [];
      snapshot.forEach((docSnap) => {
        expList.push(docSnap.data() as Expense);
      });
      expList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      dispatch({ type: 'SET_EXPENSES', payload: expList });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'expenses');
    });

    // Subscribe to Manager-owned POS Terminals
    const terminalsQuery = query(collection(db, 'pos_terminals'), where('ownerId', '==', syncOwnerId));
    const unsubscribeTerminals = onSnapshot(terminalsQuery, (snapshot) => {
      const termList: PosTerminal[] = [];
      snapshot.forEach((docSnap) => {
        termList.push(docSnap.data() as PosTerminal);
      });
      termList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      dispatch({ type: 'SET_POS_TERMINALS', payload: termList });
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'pos_terminals');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeOwner();
      unsubscribeCashier();
      unsubscribeExpenses();
      unsubscribeTerminals();
    };
  }, [syncOwnerId, state.terminalFeeRate]);

  // Firestore mutation wrappers
  const handleAddPosTerminal = async (term: PosTerminal) => {
    if (syncOwnerId) {
      try {
        const termWithOwner = { ...term, ownerId: syncOwnerId };
        await setDoc(doc(db, 'pos_terminals', term.id), termWithOwner);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `pos_terminals/${term.id}`);
      }
    } else {
      dispatch({ type: 'ADD_POS_TERMINAL', payload: term });
    }
  };

  const handleUpdatePosTerminal = async (term: PosTerminal) => {
    if (syncOwnerId) {
      try {
        const termWithOwner = { ...term, ownerId: syncOwnerId };
        await setDoc(doc(db, 'pos_terminals', term.id), termWithOwner);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `pos_terminals/${term.id}`);
      }
    } else {
      dispatch({ type: 'UPDATE_POS_TERMINAL', payload: term });
    }
  };

  const handleCheckTerminalNetwork = async (term: PosTerminal) => {
    const statuses: ('Active' | 'Inactive')[] = ['Active', 'Inactive'];
    const browsings: ('Enabled' | 'Disabled')[] = ['Enabled', 'Disabled'];
    const internet: ('Granted' | 'Denied')[] = ['Granted', 'Denied'];

    const updatedTerm = {
      ...term,
      networkStatus: statuses[Math.floor(Math.random() * statuses.length)],
      browsingStatus: browsings[Math.floor(Math.random() * browsings.length)],
      internetAccess: internet[Math.floor(Math.random() * internet.length)],
      signalStrength: Math.floor(Math.random() * 5) + 1,
      batteryLevel: Math.floor(Math.random() * 100),
    };
    await handleUpdatePosTerminal(updatedTerm);
  };

  const handleDeletePosTerminal = async (id: string) => {
    if (syncOwnerId) {
      try {
        await deleteDoc(doc(db, 'pos_terminals', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `pos_terminals/${id}`);
      }
    } else {
      dispatch({ type: 'DELETE_POS_TERMINAL', payload: id });
    }
  };

  const handleAddTransaction = async (tx: Transaction) => {
    if (syncOwnerId) {
      try {
        const cashierId = tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined;
        const txWithOwner = { ...tx, ownerId: syncOwnerId, cashierId };
        await setDoc(doc(db, 'transactions', tx.id), txWithOwner);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `transactions/${tx.id}`);
      }
    } else {
      dispatch({ type: 'ADD_TRANSACTION', payload: tx });
    }
  };

  const handleUpdateTransaction = async (tx: Transaction) => {
    if (syncOwnerId) {
      try {
        const cashierId = tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined;
        const txWithOwner = { ...tx, ownerId: syncOwnerId, cashierId };
        await setDoc(doc(db, 'transactions', tx.id), txWithOwner);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `transactions/${tx.id}`);
      }
    } else {
      dispatch({ type: 'UPDATE_TRANSACTION', payload: tx });
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (syncOwnerId) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
      }
    } else {
      dispatch({ type: 'DELETE_TRANSACTION', payload: id });
    }
  };

  const handleBulkDeleteTransactions = async (ids: string[]) => {
    if (syncOwnerId) {
      try {
        const batch = writeBatch(db);
        ids.forEach((id) => {
          batch.delete(doc(db, 'transactions', id));
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'transactions_bulk_delete');
      }
    } else {
      dispatch({ type: 'BULK_DELETE_TRANSACTIONS', payload: ids });
    }
  };

  const handleBulkUpdateTransactions = async (updatedTxs: Transaction[]) => {
    if (syncOwnerId) {
      try {
        const batch = writeBatch(db);
        updatedTxs.forEach((tx) => {
          const cashierId = tx.terminalId ? state.posTerminals.find(t => t.id === tx.terminalId)?.employeeId : undefined;
          const txWithOwner = { ...tx, ownerId: syncOwnerId, cashierId };
          batch.set(doc(db, 'transactions', tx.id), txWithOwner, { merge: true });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'transactions_bulk_update');
      }
    } else {
      dispatch({ type: 'BULK_UPDATE_TRANSACTIONS', payload: updatedTxs });
    }
  };

  const handleCustomResetData = async () => {
    if (syncOwnerId) {
      try {
        const batch = writeBatch(db);
        const currentTxs = state.transactions;
        currentTxs.forEach((tx) => {
          batch.delete(doc(db, 'transactions', tx.id));
        });

        const seedTxs = getSeedTransactions(state.terminalFeeRate);
        seedTxs.forEach((tx) => {
          const txWithOwner = { ...tx, ownerId: syncOwnerId };
          batch.set(doc(db, 'transactions', tx.id), txWithOwner);
        });

        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'transactions_batch_reset');
      }
    } else {
      dispatch({ type: 'RESET_DATA' });
    }
  };

  const handleAddExpense = async (expense: Expense) => {
    if (syncOwnerId) {
      try {
        const expenseWithOwner = { ...expense, ownerId: syncOwnerId };
        await setDoc(doc(db, 'expenses', expense.id), expenseWithOwner);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `expenses/${expense.id}`);
      }
    } else {
      dispatch({ type: 'ADD_EXPENSE', payload: expense });
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (syncOwnerId) {
      try {
        await deleteDoc(doc(db, 'expenses', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
      }
    } else {
      dispatch({ type: 'DELETE_EXPENSE', payload: id });
    }
  };

  const [isLocked, setIsLocked] = useState(() => {
    try {
      const locked = localStorage.getItem('OPay_Terminal_Locked');
      return locked !== 'false';
    } catch (e) {
      return true;
    }
  });

  const handleLoginSuccess = (user: User) => {
    setRegisteredUsers((prev) => {
      if (!prev.some(u => u.id === user.id)) {
        const next = [...prev, user];
        localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      }
      return prev;
    });

    dispatch({ type: 'SWITCH_USER', payload: user });
    setIsLocked(false);
    localStorage.setItem('OPay_Terminal_Locked', 'false');
  };

  const handleLockTerminal = () => {
    setIsLocked(true);
    localStorage.setItem('OPay_Terminal_Locked', 'true');
  };

  const handleCloudSignOut = async () => {
    if (state.impersonatedUserId) {
      dispatch({ type: 'SET_IMPERSONATED_USER', payload: undefined } as any);
      return;
    }

    // If it's an employee signing out, switch back to their manager
    if (state.currentUser.role === 'Employee') {
        const manager = registeredUsers.find(u => u.id === state.currentUser.ownerId);
        if (manager) {
            dispatch({ type: 'SWITCH_USER', payload: manager });
            // Do NOT lock, they return to manager's dashboard
            return;
        }
    }

    try {
      await signOut(auth);
      // Lock for cashiers on sign out
      setIsLocked(true);
      localStorage.setItem('OPay_Terminal_Locked', 'true');
    } catch (err) {
      console.error('Sign-Out Failed:', err);
    }
  };
  const personaSectionRef = useRef<HTMLDivElement>(null);
  const targetSectionRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD/CTRL + K or / key to focus search (if not in an input/textarea)
      if (
        (e.key === 'k' && (e.metaKey || e.ctrlKey)) ||
        (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'SELECT')
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Unified registered users pool
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(() => {
    // Check if we need to perform a one-time clear of all previous accounts (both demo and realistic)
    const wasCleared = localStorage.getItem('OPay_Accounts_Cleared_v2');
    if (!wasCleared) {
      localStorage.removeItem('OPay_Registered_Users_v4');
      localStorage.removeItem('POSTrack_State_Store_v5');
      localStorage.removeItem('OPay_Terminal_Locked');
      localStorage.setItem('OPay_Accounts_Cleared_v2', 'true');
    }

    const saved = localStorage.getItem('OPay_Registered_Users_v4');
    if (saved) {
      try {
        let parsed = JSON.parse(saved) as User[];
        if (parsed && Array.isArray(parsed)) {
          return parsed.map(p => ({
            ...p,
            pin: p.pin || '1111',
            phone: p.phone || `080${Math.floor(10000000 + Math.random() * 90000000)}`
          }));
        }
      } catch (err) {
        console.warn('Recovering registered users failed', err);
      }
    }
    // Only return empty if nothing was in localStorage, otherwise we might be overwriting valid but unparseable data
    return [];
  });

  // Load registered users from Firestore on startup to handle new devices or cleared cache
  const [isUsersLoaded, setIsUsersLoaded] = useState(false);
  useEffect(() => {
    const fetchUsersOnStartup = async () => {
      try {
        const usersRef = collection(db, 'users');
        const snap = await getDocs(usersRef);
        if (!snap.empty) {
          const cloudUsersList = snap.docs.map(docSnap => docSnap.data() as User);
          
          setRegisteredUsers((prev) => {
            // Merge local and cloud users, preferring cloud data for duplicates by id
            const mergedMap = new Map<string, User>();
            prev.forEach(u => mergedMap.set(u.id, u));
            cloudUsersList.forEach(u => mergedMap.set(u.id, u));
            
            const merged = Array.from(mergedMap.values());
            localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(merged));
            return merged;
          });
          console.log('Successfully synchronized registered users pool from cloud Firestore on startup');
        }
      } catch (err) {
        console.warn('Silent startup cloud users fetch failed:', err);
      } finally {
        setIsUsersLoaded(true);
      }
    };
    
    fetchUsersOnStartup();
  }, []);

  const handleRegisterUser = async (newUser: User) => {
    // Always persist locally first so user registrations never block on connection issues
    setRegisteredUsers((prev) => {
      const next = prev.some(u => u.id === newUser.id) ? prev : [...prev, newUser];
      localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(next));
      return next;
    });

    // Attempt to save to Firestore for global access
    try {
      const userDocRef = doc(db, 'users', newUser.id);
      await setDoc(userDocRef, newUser);
    } catch (err) {
      console.warn('Global Firestore sync failed during registration', err);
    }

    if (syncOwnerId) {
      try {
        const userWithOwner = { ...newUser, ownerId: syncOwnerId };
        await setDoc(doc(db, 'users', newUser.id), userWithOwner);
      } catch (err) {
        console.warn('Firestore sync with owner ID failed during registration:', err);
      }
    }

    showAppNotification(`New account for ${newUser.name} created successfully.`, 'success');
  };

  const handleUpdateUserPin = async (userId: string, newPin: string) => {
    if (syncOwnerId) {
      try {
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, { pin: newPin }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      }
    } else {
      setRegisteredUsers((prev) => {
        const next = prev.map((u) => u.id === userId ? { ...u, pin: newPin } : u);
        localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      });
    }
    showAppNotification(`Operator PIN successfully reset.`, 'success');
  };

  const handleUpdateUser = async (updatedUser: User) => {
    if (syncOwnerId) {
      try {
        const userWithOwner = { ...updatedUser, ownerId: syncOwnerId };
        await setDoc(doc(db, 'users', updatedUser.id), userWithOwner, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${updatedUser.id}`);
      }
    } else {
      setRegisteredUsers((prev) => {
        const next = prev.map((u) => u.id === updatedUser.id ? updatedUser : u);
        localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      });
    }
    // Update active currentUser if modifying themselves
    if (updatedUser.id === state.currentUser.id) {
      dispatch({ type: 'SWITCH_USER', payload: updatedUser });
    }
    showAppNotification(`Information for ${updatedUser.name} has been updated.`, 'success');
  };

  const handleDeleteUser = async (userId: string) => {
    if (syncOwnerId) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${userId}`);
      }
    } else {
      setRegisteredUsers((prev) => {
        const next = prev.filter((u) => u.id !== userId);
        localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(next));
        return next;
      });
    }
  };

  const handleDeleteAllUsers = async () => {
    if (syncOwnerId) {
      try {
        const batch = writeBatch(db);
        registeredUsers.forEach((u) => {
          batch.delete(doc(db, 'users', u.id));
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users_deleteAll`);
      }
    } else {
      setRegisteredUsers([]);
      localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify([]));
    }
  };

  // Synchronize state.currentUser dynamically if detailed properties are modified on Firestore/local sessions
  useEffect(() => {
    const matched = registeredUsers.find(u => u.id === state.currentUser.id);
    if (matched) {
      if (
        matched.name !== state.currentUser.name ||
        matched.pin !== state.currentUser.pin ||
        matched.phone !== state.currentUser.phone ||
        matched.role !== state.currentUser.role ||
        matched.ownerId !== state.currentUser.ownerId
      ) {
        dispatch({ type: 'SWITCH_USER', payload: matched });
      }
    }
  }, [registeredUsers, state.currentUser.id]);

  // Keep local storage in sync with registeredUsers for offline startup access
  useEffect(() => {
    try {
      localStorage.setItem('OPay_Registered_Users_v4', JSON.stringify(registeredUsers));
    } catch (err) {
      console.warn('LocalStorage save failed for registeredUsers:', err);
    }
  }, [registeredUsers]);

  // Background migration/synchronization from local storage to cloud Firestore
  useEffect(() => {
    const syncLocalDataToCloud = async (ownerId: string) => {
      if (!ownerId || ownerId === 'mgr_1' || ownerId === '') return;
      
      console.log('Starting background local-to-cloud sync for:', ownerId);
      
      // 1. Sync registered users/cashiers
      const localUsersSaved = localStorage.getItem('OPay_Registered_Users_v4');
      if (localUsersSaved) {
        try {
          const localUsers = JSON.parse(localUsersSaved) as User[];
          if (Array.isArray(localUsers) && localUsers.length > 0) {
            for (const u of localUsers) {
              if (u.id === 'mgr_1') continue; // Don't upload local manager
              
              // Only sync if the user's ownerId is empty or local
              const uOwner = u.ownerId;
              if (!uOwner || uOwner === 'mgr_1' || uOwner === 'local_owner') {
                const updatedUser = { ...u, ownerId };
                await setDoc(doc(db, 'users', u.id), updatedUser, { merge: true });
                console.log(`Cloud Synced cashier profile: ${u.name}`);
              }
            }
          }
        } catch (err) {
          console.warn('Local users sync failed:', err);
        }
      }

      // 2. Sync transactions
      if (state.transactions && state.transactions.length > 0) {
        try {
          const localTxs = state.transactions.filter(
            t => !t.ownerId || t.ownerId === 'local_owner' || t.ownerId === 'mgr_1'
          );
          if (localTxs.length > 0) {
            console.log(`Cloud Synced ${localTxs.length} local transactions...`);
            for (const tx of localTxs) {
              const txWithOwner = { ...tx, ownerId };
              await setDoc(doc(db, 'transactions', tx.id), txWithOwner, { merge: true });
            }
          }
        } catch (err) {
          console.warn('Local transactions sync failed:', err);
        }
      }

      // 3. Sync expenses
      if (state.expenses && state.expenses.length > 0) {
        try {
          const localExpenses = state.expenses.filter(
            e => !e.ownerId || e.ownerId === 'local_owner' || e.ownerId === 'mgr_1'
          );
          if (localExpenses.length > 0) {
            console.log(`Cloud Synced ${localExpenses.length} local expenses...`);
            for (const exp of localExpenses) {
              const expWithOwner = { ...exp, ownerId };
              await setDoc(doc(db, 'expenses', exp.id), expWithOwner, { merge: true });
            }
          }
        } catch (err) {
          console.warn('Local expenses sync failed:', err);
        }
      }

      // 4. Sync POS terminals
      if (state.posTerminals && state.posTerminals.length > 0) {
        try {
          const localTerminals = state.posTerminals.filter(
            pt => !pt.ownerId || pt.ownerId === 'local_owner' || pt.ownerId === 'mgr_1'
          );
          if (localTerminals.length > 0) {
            console.log(`Cloud Synced ${localTerminals.length} local terminals...`);
            for (const pt of localTerminals) {
              const ptWithOwner = { ...pt, ownerId };
              await setDoc(doc(db, 'pos_terminals', pt.id), ptWithOwner, { merge: true });
            }
          }
        } catch (err) {
          console.warn('Local terminals sync failed:', err);
        }
      }
    };

    if (syncOwnerId && syncOwnerId !== 'mgr_1' && syncOwnerId !== '') {
      syncLocalDataToCloud(syncOwnerId);
    }
  }, [syncOwnerId, state.transactions, state.expenses, state.posTerminals]);

  const allUsersPool = useMemo(() => {
    return registeredUsers;
  }, [registeredUsers]);

  const availableEmployees = useMemo(() => {
    return registeredUsers.filter(u => u.role === 'Employee' && u.ownerId === state.currentUser.id);
  }, [registeredUsers, state.currentUser.id]);

  // Compute metrics dynamically from visible transactions based on active permissions
  // Security Layer rule: Employees see ONLY their own txns. Managers see filtered employee or ALL.
  const authorizedTransactions = useMemo(() => {
    const txs = state.transactions;
    if (state.currentUser.role === 'Employee') {
      return txs.filter(t => t.employeeId === state.currentUser.id);
    }
    
    // Prioritize impersonation, then filter
    const targetUserId = state.impersonatedUserId || (state.selectedEmployeeFilter === 'ALL' ? undefined : state.selectedEmployeeFilter);
    
    if (!targetUserId) {
      return txs;
    }
    return txs.filter(t => t.employeeId === targetUserId);
  }, [state.transactions, state.currentUser, state.selectedEmployeeFilter, state.impersonatedUserId]);

  // Determine active user (impersonated or real)
  const activeUser = useMemo(() => {
    if (state.impersonatedUserId) {
        return registeredUsers.find(u => u.id === state.impersonatedUserId) || state.currentUser;
    }
    return state.currentUser;
  }, [state.impersonatedUserId, state.currentUser, registeredUsers]);

  // Safely auto-fallback non-manager accounts back to POS tab
  useEffect(() => {
    if (activeUser.role !== 'Manager' && (dashboardTab === 'reports' || dashboardTab === 'settings')) {
      setDashboardTab('pos');
    }
  }, [activeUser.role, dashboardTab]);

  // Manager: Compute aggregate metrics for ALL transactions
  const managerDailyStats = useMemo(() => {
    if (state.currentUser.role !== 'Manager') return null;
    const allTxs = state.transactions;
    return computeTxMetrics(allTxs, 'Daily', state.terminalFeeRate);
  }, [state.transactions, state.terminalFeeRate, state.currentUser.role]);

  // Compute matched transactions based on global search query
  const matchedTransactions = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const q = searchQuery.toLowerCase().trim();
    return authorizedTransactions.filter((tx) => {
      const idMatch = tx.id.toLowerCase().includes(q);
      const nameMatch = tx.employeeName.toLowerCase().includes(q);
      const amountMatch = tx.amount.toString().includes(q) || formatNaira(tx.amount).toLowerCase().includes(q);
      const notesMatch = tx.notes ? tx.notes.toLowerCase().includes(q) : false;
      const typeMatch = tx.type.toLowerCase().includes(q);
      const providerMatch = tx.provider.toLowerCase().includes(q);
      return idMatch || nameMatch || amountMatch || notesMatch || typeMatch || providerMatch;
    });
  }, [authorizedTransactions, searchQuery]);

  // Compute Active Selection Metrics
  const activeMetrics = useMemo(() => {
    return computeTxMetrics(authorizedTransactions, state.activeTimeframe, state.terminalFeeRate);
  }, [authorizedTransactions, state.activeTimeframe, state.terminalFeeRate]);

  // Compute Timeframe Blocks metrics for Overview Matrix items
  const summaryOverviews = useMemo(() => {
    const dailyVec = computeTxMetrics(authorizedTransactions, 'Daily', state.terminalFeeRate);
    const weeklyVec = computeTxMetrics(authorizedTransactions, 'Weekly', state.terminalFeeRate);
    const monthlyVec = computeTxMetrics(authorizedTransactions, 'Monthly', state.terminalFeeRate);
    const yearlyVec = computeTxMetrics(authorizedTransactions, 'Yearly', state.terminalFeeRate);
    const allTimeVec = computeTxMetrics(authorizedTransactions, 'All-Time', state.terminalFeeRate);

    return {
      daily: dailyVec,
      weekly: weeklyVec,
      monthly: monthlyVec,
      yearly: yearlyVec,
      allTime: allTimeVec
    };
  }, [authorizedTransactions, state.terminalFeeRate]);

  // Handle immediate test simulation injections
  const triggerSimulation = () => {
    const isWithdrawal = Math.random() > 0.4;
    const type = isWithdrawal ? 'Withdrawal' : 'Deposit';
    const provider = Math.random() > 0.6 ? 'OPay' : Math.random() > 0.3 ? 'Moniepoint' : 'PalmPay';
    const amount = [5000, 10000, 15000, 20000, 30000, 50000, 80000][Math.floor(Math.random() * 7)];
    const subType = Math.random() > 0.4 ? 'OtherBank' : 'SameBank';
    
    // Choose worker operator
    const employeeId = state.currentUser.id;
    const employeeName = state.currentUser.name;

    // Nigeria Agent fee practices standard calculation
    const customerFee = isWithdrawal ? Math.round(amount * 0.01) : 150; 
    const terminalFee = calculateTerminalFee(amount, type, provider, state.terminalFeeRate, subType);
    const profit = customerFee - terminalFee;

    const newSimTx: Transaction = {
      id: 'tx_sim_' + Math.floor(1000 + Math.random() * 9000),
      employeeId,
      employeeName,
      type,
      provider,
      subType,
      amount,
      customerFee,
      terminalFee,
      profit,
      timestamp: new Date().toISOString(),
      notes: 'Automated live micro-simulation entry'
    };

    handleAddTransaction(newSimTx);
  };

  // Helper function to render currency or support privacy mode
  const displayNaira = (val: number) => {
    if (hideBalances) {
      return '₦ •••••••';
    }
    return formatNaira(val);
  };

  // Actions for circular menu
  const openWithPreset = (type: TransactionType) => {
    setIsAddModalOpen(true);
    setPreselectedFormType(type);
  };

  const handleExportCSV = () => {
    if (authorizedTransactions.length === 0) {
      alert('No record transactions found to export.');
      return;
    }

    const headers = ['TXID', 'Timestamp', 'Staff Operator', 'Type', 'POS Provider', 'Amount(NGN)', 'Customer FeeCharged', 'Terminal Cost', 'Profit(NGN)', 'Notes'];
    
    const rows = authorizedTransactions.map(tx => [
      tx.id,
      new Date(tx.timestamp).toLocaleString(),
      tx.employeeName,
      tx.type,
      tx.provider,
      tx.amount.toString(),
      tx.customerFee.toString(),
      tx.terminalFee.toString(),
      tx.profit.toString(),
      tx.notes || ''
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `OPayStyle_AuditExport_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref === historySectionRef) {
      setDashboardTab('pos');
    }
    setTimeout(() => {
      if (ref && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
  };

  const renderSyncStatusBadge = () => {
    let status: 'offline' | 'synced' | 'syncing' | 'pending-offline' = 'offline';
    
    if (syncOwnerId && syncOwnerId !== 'mgr_1') {
      if (!isOnline) {
        status = 'pending-offline';
      } else if (pendingSyncCount > 0) {
        status = 'syncing';
      } else {
        status = 'synced';
      }
    }

    const badgeConfig = {
      'offline': {
        bg: 'bg-neutral-100 border-neutral-200 text-neutral-600',
        dotColor: 'bg-neutral-400',
        label: 'Offline Mode (Local Only)',
        icon: <CloudOff className="w-3.5 h-3.5 text-neutral-500" />,
        tooltip: 'Running in offline mode. Your data is saved locally on this device. Setup Cloud Sync in the Settings/Cloud menu to back up and sync across devices.'
      },
      'synced': {
        bg: 'bg-emerald-50 border-emerald-100 text-emerald-700',
        dotColor: 'bg-[#00B87A]',
        label: 'Cloud Synced',
        icon: <Cloud className="w-3.5 h-3.5 text-[#00B87A]" />,
        tooltip: 'All local modifications are successfully saved in the cloud. Your recent data is highly secure.'
      },
      'syncing': {
        bg: 'bg-indigo-50 border-indigo-150 text-indigo-700',
        dotColor: 'bg-indigo-500',
        label: `Syncing (${pendingSyncCount} left)...`,
        icon: <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" />,
        tooltip: 'Currently uploading new records to the cloud database. Please keep the app open to complete synchronization.'
      },
      'pending-offline': {
        bg: 'bg-amber-50 border-amber-150 text-amber-700',
        dotColor: 'bg-amber-500',
        label: 'Offline (Sync Pending)',
        icon: <WifiOff className="w-3.5 h-3.5 text-amber-500" />,
        tooltip: 'You are registered for Cloud Sync, but this device is currently offline. New changes are stored locally and will sync automatically when you reconnect.'
      }
    };

    const current = badgeConfig[status];

    return (
      <div 
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 text-[10px] font-semibold rounded-md border ${current.bg} w-fit transition duration-150 select-none cursor-help shadow-2xs`}
        title={current.tooltip}
      >
        <span className="flex items-center gap-1">
          {current.icon}
          <span>{current.label}</span>
        </span>
        <span className="relative flex h-1.5 w-1.5">
          {status === 'syncing' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          )}
          {status === 'synced' && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00B87A]/50 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${current.dotColor}`}></span>
        </span>
      </div>
    );
  };

  if (isLocked || !activeUser || !activeUser.id) {
    return (
      <LoginScreen
        registeredUsers={registeredUsers}
        onLogin={handleLoginSuccess}
        onRegister={handleRegisterUser}
        onDeleteAllAccounts={handleDeleteAllUsers}
        isUsersLoaded={isUsersLoaded}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-850 flex flex-col font-sans relative pb-20 antialiased selection:bg-emerald-200">
      {state.impersonatedUserId && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-500 text-white px-4 py-3 shadow-md z-50 sticky top-0 backdrop-blur-md border-b border-amber-400/20 select-none">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl shrink-0 animate-pulse">
                <Eye className="w-5 h-5 text-white stroke-[2.5]" />
              </div>
              <div className="text-center sm:text-left">
                <div className="text-xs font-black uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5 opacity-90">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  Superuser Oversight Mode Active
                </div>
                <p className="text-[11px] font-medium text-amber-50 mt-0.5">
                  Currently viewing <strong className="font-extrabold text-white underline decoration-wavy decoration-white/40">{activeUser.name}</strong>'s cashier session. No password or PIN required.
                </p>
              </div>
            </div>
            
            <button 
              onClick={() => dispatch({ type: 'SET_IMPERSONATED_USER', payload: undefined })}
              className="bg-white text-orange-600 px-4 py-1.5 rounded-xl text-xs font-black hover:bg-neutral-50 active:scale-95 transition cursor-pointer flex items-center gap-1.5 shadow-sm font-mono tracking-tight shrink-0 uppercase border border-white/50"
            >
              <span>← Exit View</span>
            </button>
          </div>
        </div>
      )}

      {unpaidCount > 0 && (
        <div className="bg-amber-500 text-white p-3 flex items-center justify-between shadow-lg z-40 sticky top-0">
          <div className="text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>You have {unpaidCount} pending unpaid charge{unpaidCount !== 1 ? 's' : ''}.</span>
          </div>
          <button 
            onClick={() => setDashboardTab('unpaid')}
            className="bg-white text-amber-600 px-3 py-1 rounded-lg text-xs font-black hover:bg-amber-50 transition cursor-pointer"
          >
            View Debts &rarr;
          </button>
        </div>
      )}
      
      {/* Top Banner Ticker with OPay styling style */}
      <div className="bg-[#00B87A] text-white text-center text-[11px] font-semibold py-1.5 px-4 select-none relative z-10 font-mono tracking-tight flex items-center justify-center gap-1.5 shadow-sm">
        <Smartphone className="w-3.5 h-3.5 inline animate-pulse" /> Security Reminder: OPay agents will never ask for your password, PIN or OTP. Drive cash out safely!
      </div>

      {/* Primary OPay Brand Header Bar */}
      <header className="border-b border-neutral-200 bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          
          {/* Logo brand & Name */}
          <div className="flex items-center gap-3 justify-between sm:justify-start w-full sm:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00B87A] flex items-center justify-center text-white font-black text-xl tracking-wider shadow-md shadow-emerald-500/20">
                O
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base font-extrabold text-[#00B87A] tracking-tight">Dan Godal Postracker</span>
                  <span className="bg-[#00B87A]/10 text-[#00B87A] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {activeUser.role === 'Manager' ? 'Manager App' : 'Cashier App'}
                  </span>
                </div>
                {renderSyncStatusBadge()}
              </div>
            </div>
          </div>

          {/* Centered Active Operator Session Badge */}
          <div className="flex items-center justify-center py-0.5 sm:py-0">
            {activeUser.role === 'Manager' ? (
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(true)}
                className="flex items-center gap-2 text-xs pl-2 pr-3 py-1.5 rounded-full border border-emerald-200 bg-emerald-50/70 hover:bg-[#00B87A]/10 text-[#00B87A] cursor-pointer transition duration-150 active:scale-95 font-extrabold shadow-sm select-none"
                title="Active Operator Shift & Control Center"
              >
                {renderUserAvatar(activeUser.avatar, activeUser.name, "w-5 h-5 shrink-0", "rounded-full", "text-[8px] font-black")}
                <span className="truncate font-sans tracking-tight flex items-center gap-1">
                  <span className="text-neutral-500 font-normal">Manager:</span>
                  <span className="font-black text-neutral-800">{activeUser.name}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>
            ) : (
              <div
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2 text-xs pl-2 pr-4 py-1.5 rounded-full border border-emerald-150 bg-emerald-50/40 text-neutral-600 hover:bg-neutral-100 cursor-pointer font-extrabold shadow-sm select-none transition duration-150 active:scale-95"
                title="Active Cashier Session - View Profile"
              >
                {renderUserAvatar(activeUser.avatar, activeUser.name, "w-5 h-5 shrink-0", "rounded-full", "text-[8px] font-black")}
                <span className="truncate font-sans tracking-tight text-neutral-500 flex items-center gap-1">
                  <span className="font-normal">Cashier:</span>
                  <span className="font-black text-neutral-800">{activeUser.name}</span>
                  {myTerminal && (
                    <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                      {myTerminal.areaOfWorking}
                    </span>
                  )}
                  {!myTerminal && activeUser.areaOfWorking && (
                    <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                      {activeUser.areaOfWorking}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Quick Mock Operations on Header */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {/* Manager Account Session Status Button / Cashier Profile Button */}
            {state.currentUser.role === 'Manager' && (
                <div className="flex items-center gap-2">
                  {state.impersonatedUserId ? (
                      <button
                          onClick={handleCloudSignOut}
                          className="flex items-center gap-1.5 text-[10px] bg-amber-500 hover:bg-amber-600 text-white rounded-lg px-3 py-1.5 font-bold shadow-sm transition"
                      >
                          <span>← Exit {state.availableEmployees.find(e => e.id === state.impersonatedUserId)?.name || 'Cashier'} View</span>
                      </button>
                  ) : (
                      <select
                          value={state.impersonatedUserId || 'ALL'}
                          onChange={(e) => dispatch({ type: 'SET_IMPERSONATED_USER', payload: e.target.value === 'ALL' ? undefined : e.target.value } as any)}
                          className="text-[10px] border border-emerald-200 bg-emerald-50 text-emerald-800 rounded-lg p-1.5 font-bold cursor-pointer focus:outline-none"
                      >
                          <option value="ALL">Manager Dashboard</option>
                          {state.availableEmployees.map(emp => (
                              <option key={emp.id} value={emp.id}>View: {emp.name}</option>
                          ))}
                      </select>
                  )}
                  <div className="flex flex-col items-end gap-0.5 text-xs text-[#00B87A] bg-[#00B87A]/10 px-2.5 py-1.5 rounded-2xl border border-[#00B87A]/20">
                     <div className="flex items-center gap-1.5">
                       <span className="w-2 h-2 rounded-full bg-[#00B87A] animate-pulse" />
                       <span className="font-bold text-[11px] hidden sm:inline">Active: {cloudUser?.displayName || cloudUser?.email || 'Local Manager'}</span>
                     </div>
                     {mostActiveTerminal && (
                       <span className="text-[9px] font-mono font-bold text-neutral-600">
                         {mostActiveTerminal.cashierName} • {mostActiveTerminal.areaOfWorking}
                       </span>
                     )}
                  </div>
                </div>
            )}
            
            {/* Cloud Sync Button (Shows when not logged in) */}
            {state.currentUser.role === 'Manager' && !cloudUser && (
                <button 
                  onClick={() => setIsCloudSyncFormOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition-colors border border-indigo-200"
                >
                  <Building className="w-3.5 h-3.5" />
                  Cloud Setup
                </button>
            )}

            {/* Sign Out / Lock / Exit View Button */}
            <button
              onClick={
                state.impersonatedUserId 
                  ? () => dispatch({ type: 'SET_IMPERSONATED_USER', payload: undefined }) 
                  : (cloudUser ? handleCloudSignOut : handleLockTerminal)
              }
              className="px-2.5 py-1.5 text-[11px] font-bold bg-neutral-100 hover:bg-red-50 border border-neutral-200 hover:border-red-250 text-neutral-600 hover:text-red-150 rounded-xl transition cursor-pointer flex items-center gap-1 shadow-xs"
              title={
                state.impersonatedUserId 
                  ? "Sign Out of Cashier View & Return to Manager Dashboard" 
                  : (cloudUser ? "Sign Out of Cloud Session" : "Lock POS Terminal")
              }
            >
              <LogOut className="w-3.5 h-3.5 text-red-500" />
              <span>
                {state.impersonatedUserId 
                  ? "Sign Out & Return" 
                  : (cloudUser ? "Sign Out" : "Lock Terminal")}
              </span>
            </button>

            <button 
              onClick={() => alert("Alert Notification: Gateway connection is extremely stable. High velocity is active.")}
              className="p-2 transition rounded-full hover:bg-neutral-100 text-neutral-600 relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Layout Container */}
      <main className="max-w-4xl mx-auto px-4 py-5 flex-grow space-y-6 w-full">

        {/* ACTIVE OPERATOR SESSION & SECURITY CONTROL HUB */}
        {activeUser.role === 'Manager' && (
          <div className="bg-white border border-neutral-200 rounded-[32px] p-6 shadow-xs relative overflow-hidden transition-all duration-150">
            {/* Accent colored top strip */}
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-emerald-500 via-[#00B87A] to-indigo-600" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              {/* Operator info section */}
              <div className="flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00B87A] to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/15">
                    {activeUser.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white shadow-xs">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </span>
                </div>
                
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      activeUser.role === 'Manager'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                      👑 Superuser
                    </span>
                    <span className="text-[10px] text-neutral-400 font-bold font-mono uppercase tracking-widest">Active Session</span>
                  </div>
                  <h2 className="text-lg font-black text-neutral-850 tracking-tight mt-0.5">
                    {activeUser.name}
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-semibold mt-0.5">
                    Secure Access ID: <span className="font-mono font-bold text-neutral-700">{activeUser.phone || 'No Phone Number'}</span>
                  </p>
                </div>
              </div>

              {/* Live Metrics for the operator's active session */}
              <div className="grid grid-cols-3 gap-2.5 flex-1 max-w-lg">
                <div className="bg-neutral-50/80 border border-neutral-150 p-2.5 rounded-2xl">
                  <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider leading-none">
                    Shift Slips
                  </span>
                  <span className="text-xs font-black font-mono text-neutral-800 block mt-1">
                    {currentShiftStats.count} receipts
                  </span>
                </div>
                <div className="bg-neutral-50/80 border border-neutral-150 p-2.5 rounded-2xl">
                  <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider leading-none">Handled Vol</span>
                  <span className="text-xs font-black font-mono text-[#00B87A] block mt-1 truncate" title={formatNaira(currentShiftStats.volume)}>
                    {formatNaira(currentShiftStats.volume)}
                  </span>
                </div>
                <div className="bg-neutral-50/80 border border-neutral-150 p-2.5 rounded-2xl relative">
                  <span className="text-[9px] text-neutral-400 block font-bold uppercase tracking-wider leading-none">Net Profit</span>
                  <span className="text-xs font-black font-mono text-indigo-650 block mt-1 truncate" title={formatNaira(currentShiftStats.profit)}>
                    {formatNaira(currentShiftStats.profit)}
                  </span>
                  {state.transactions.filter(t => t.chargesStatus === 'Unpaid').length > 0 && (
                    <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-black animate-pulse">
                      {state.transactions.filter(t => t.chargesStatus === 'Unpaid').length}
                    </div>
                  )}
                  <div className="mt-1 text-[9px] text-neutral-400 font-mono">
                    Projected: {formatNaira(currentShiftStats.profit * (8 / Math.max(1, new Date().getHours() - 8)))}
                  </div>
                </div>
              </div>

              {/* Elegant Security Session Control buttons (Exclusive options based on Role) */}
              <div className="flex sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto border-t md:border-t-0 md:border-l border-neutral-150 pt-4 md:pt-0 md:pl-5">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-neutral-100 hover:bg-neutral-150 text-neutral-700 hover:text-neutral-800 rounded-xl text-[11px] font-black transition cursor-pointer select-none active:scale-[0.98] border border-neutral-200/40 uppercase tracking-wider"
                  title="Handover shift or switch to another registered employee"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Switch Shift</span>
                </button>
                
                <button
                  type="button"
                  onClick={handleLockTerminal}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-700 rounded-xl text-[11px] font-black transition cursor-pointer select-none active:scale-[0.98] shadow-xs uppercase tracking-wider font-mono"
                  title="Log out of active session and lock OPay POS terminal"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500 stroke-[2.5]" />
                  <span>Log Out Terminal</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeUser.role === 'Employee' && (
          <div className="bg-gradient-to-br from-emerald-950 via-neutral-900 to-neutral-950 text-white border border-neutral-800 rounded-[32px] p-6 shadow-xl relative overflow-hidden transition-all duration-150">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            {/* Top decorative strip */}
            <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[#00B87A] via-emerald-400 to-[#00B87A]" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              {/* Operator info and prominently displayed Operating Area */}
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-400 to-[#00B87A] text-white flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/20">
                      {activeUser.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-neutral-900 shadow-xs border border-neutral-800">
                      <span className="h-2 w-2 rounded-full bg-[#00B87A] animate-pulse" />
                    </span>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                        ⚡ Cashier Station
                      </span>
                      <span className="text-[10px] text-neutral-400 font-bold font-mono uppercase tracking-widest flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A] animate-ping" /> SECURE SESSION
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-white tracking-tight mt-1">
                      {activeUser.name}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5 font-medium">
                      Operator ID: <span className="font-mono font-bold text-emerald-400">{activeUser.phone || 'N/A'}</span>
                    </p>
                  </div>
                </div>

                {/* AREA OF OPERATION DISPLAY CARD - EXTREMELY PROMINENT */}
                <div className="bg-neutral-900/90 border border-neutral-800/80 p-4.5 rounded-2xl flex items-center gap-4.5 shadow-inner">
                  <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-[#00B87A] text-white rounded-2xl shrink-0 shadow-lg shadow-emerald-500/10">
                    <MapPin className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-mono font-black tracking-widest text-emerald-400 uppercase block">
                      REGISTERED BUSINESS STATION & OUTLET
                    </span>
                    <h3 className="text-lg font-black text-white tracking-tight mt-0.5 truncate uppercase">
                      {myTerminal?.areaOfWorking || activeUser.areaOfWorking || 'MAIN OFFICE HEADQUARTERS'}
                    </h3>
                    <p className="text-[10.5px] text-neutral-400 font-medium leading-normal mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <Building className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span>Operating Branch for <strong>{state.settings?.businessName || 'the registered enterprise'}</strong></span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Live shift performance metrics */}
              <div className="flex flex-col gap-3.5 w-full md:w-80 shrink-0">
                <span className="text-[10px] font-mono font-black tracking-widest text-neutral-400 uppercase block">
                  TODAY'S WORKSTATION STATS
                </span>
                
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl text-center">
                    <span className="text-[8.5px] text-neutral-400 block font-bold uppercase tracking-wider">
                      Shift slips
                    </span>
                    <span className="text-sm font-black font-mono text-white block mt-1.5">
                      {currentShiftStats.count}
                    </span>
                  </div>
                  <div className="bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl text-center">
                    <span className="text-[8.5px] text-neutral-400 block font-bold uppercase tracking-wider">
                      Vol. handled
                    </span>
                    <span className="text-sm font-black font-mono text-emerald-400 block mt-1.5 truncate" title={formatNaira(currentShiftStats.volume)}>
                      {currentShiftStats.volume > 0 ? formatNaira(currentShiftStats.volume).replace('₦', '') : '0'}
                    </span>
                  </div>
                  <div className="bg-neutral-900/60 border border-neutral-800 p-3 rounded-2xl text-center relative">
                    <span className="text-[8.5px] text-neutral-400 block font-bold uppercase tracking-wider">
                      Agent profit
                    </span>
                    <span className="text-sm font-black font-mono text-indigo-400 block mt-1.5 truncate" title={formatNaira(currentShiftStats.profit)}>
                      {currentShiftStats.profit > 0 ? formatNaira(currentShiftStats.profit).replace('₦', '') : '0'}
                    </span>
                    {state.transactions.filter(t => t.chargesStatus === 'Unpaid').length > 0 && (
                      <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-black animate-pulse">
                        {state.transactions.filter(t => t.chargesStatus === 'Unpaid').length}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions & Terminal details details block */}
                <div className="flex items-center justify-between text-[10.5px] text-neutral-400 bg-neutral-900/40 border border-neutral-800/50 px-3 py-2 rounded-xl">
                  {myTerminal ? (
                    <div className="flex items-center gap-1.5 font-mono">
                      <Smartphone className="w-3.5 h-3.5 text-[#00B87A]" />
                      <span className="truncate max-w-[150px]" title={myTerminal.name}>
                        {myTerminal.provider} ({myTerminal.serialNumber?.slice(-6) || 'Active'})
                      </span>
                    </div>
                  ) : (
                    <span className="text-neutral-500 font-mono">No Terminal Linked</span>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="text-[9.5px] font-black uppercase text-[#00B87A] hover:text-emerald-400 hover:underline transition cursor-pointer"
                  >
                    Manage Station &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL INSTANT SEARCH HUB */}
        <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-emerald-50 text-[#00B87A] rounded-2xl shrink-0">
                <Search className="w-5 h-5 animate-pulse" />
              </span>
              <div>
                <h3 className="text-sm font-black text-neutral-800 flex items-center gap-2">
                  Global Instant Search Hub
                  <span className="bg-[#00B87A]/10 text-[#00B87A] text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded-full select-none">
                    ShortCut: press / key
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-500 font-semibold leading-none mt-0.5">
                  Bypass standard ledger scrolling to quickly search, audit, or verify transactions.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-4.5 h-4.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by ID (e.g. tx_sim...), Amount (e.g. 5000), or Operator / Employee Name..."
              className="w-full bg-neutral-50 border border-neutral-200 focus:border-[#00B87A] focus:outline-none focus:ring-1 focus:ring-[#00B87A] rounded-2xl pl-12 pr-10 py-3 text-xs text-neutral-800 font-extrabold placeholder:text-neutral-450 placeholder:font-medium transition shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-450 hover:text-neutral-700 bg-neutral-200/50 hover:bg-neutral-200 rounded-full p-1.5 cursor-pointer transition flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick results drawer if searching */}
          {searchQuery && (
            <div className="bg-neutral-50 border border-neutral-200/80 rounded-2xl p-4 mt-2 max-h-96 overflow-y-auto space-y-3 shadow-inner">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-[11px] pb-2 border-b border-neutral-250 text-neutral-500 font-bold font-mono">
                <span className="flex items-center gap-1.5 select-none text-neutral-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A]" /> 
                  Matched <strong className="text-neutral-850 font-black">{matchedTransactions.length}</strong> of {authorizedTransactions.length} total active journals
                </span>
                {matchedTransactions.length > 0 && (
                  <div className="flex gap-3 text-[10px]">
                    <span>
                      Sum: <strong className="text-neutral-850 font-extrabold">{displayNaira(matchedTransactions.reduce((acc, t) => acc + t.amount, 0))}</strong>
                    </span>
                    <span className="text-emerald-650">
                      Profit: <strong className="font-extrabold">{displayNaira(matchedTransactions.reduce((acc, t) => acc + t.profit, 0))}</strong>
                    </span>
                  </div>
                )}
              </div>

              {matchedTransactions.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-400 font-bold">
                  No matching transaction record found.
                </div>
              ) : (
                <div className="space-y-2">
                  {matchedTransactions.map((tx) => {
                    const isDebit = tx.type === 'Withdrawal';
                    const providerColor = 
                      tx.provider === 'Moniepoint' 
                        ? 'text-blue-600 bg-blue-50 border-blue-100' 
                        : tx.provider === 'OPay' 
                        ? 'text-[#00B87A] bg-emerald-50 border-emerald-100' 
                        : tx.provider === 'PalmPay'
                        ? 'text-orange-600 bg-orange-50 border-orange-100'
                        : 'text-neutral-600 bg-neutral-50 border-neutral-200';

                    return (
                      <div
                        key={tx.id}
                        className="bg-white border border-neutral-150 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:border-[#00B87A] hover:shadow-sm hover:scale-[1.002] transition duration-150 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Transaction Type Badge */}
                          <div className={`p-2.5 rounded-xl shrink-0 ${
                            tx.type === 'Withdrawal' 
                              ? 'bg-orange-50 text-orange-650' 
                              : tx.type === 'Deposit' 
                                ? 'bg-blue-50 text-blue-600' 
                                : 'bg-emerald-50 text-[#00B87A]'
                          }`}>
                            {tx.type === 'Withdrawal' ? (
                              <ArrowDownToLine className="w-4 h-4" />
                            ) : tx.type === 'Deposit' ? (
                              <ArrowUpFromLine className="w-4 h-4" />
                            ) : (
                              <ArrowRightLeft className="w-4 h-4" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-black text-neutral-850 font-mono">
                                {displayNaira(tx.amount)}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase font-black border ${providerColor}`}>
                                {tx.provider}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase font-black border flex items-center gap-1 ${
                                (tx.status || 'Success') === 'Success'
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-150'
                                  : (tx.status || 'Success') === 'Pending'
                                  ? 'text-amber-700 bg-amber-50 border-amber-150'
                                  : 'text-red-700 bg-red-50 border-red-150'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${
                                  (tx.status || 'Success') === 'Success' ? 'bg-emerald-500' : (tx.status || 'Success') === 'Pending' ? 'bg-amber-500' : 'bg-red-500'
                                }`} />
                                {tx.status || 'Success'}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-bold">
                                by <span className="text-[#00B87A] font-extrabold">{tx.employeeName}</span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[9px] font-mono text-neutral-400 mt-1 flex-wrap">
                              <span className="font-extrabold text-neutral-600">{tx.id}</span>
                              <span>•</span>
                              <span>{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}{new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                              {tx.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic truncate max-w-[120px] text-neutral-500" title={tx.notes}>{tx.notes}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action controls */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setEditingTransaction(tx)}
                            className="px-3 py-2 bg-neutral-100 hover:bg-[#00B87A]/10 text-neutral-600 hover:text-[#00B87A] text-[10px] font-black rounded-xl cursor-pointer transition active:scale-95 flex items-center gap-1 border border-neutral-200/60 hover:border-[#00B87A]/30 shadow-xs"
                            title="Edit transaction parameters (amount or charges)"
                          >
                            <Pencil className="w-3 h-3 text-[#00B87A]" />
                            <span>Edit</span>
                          </button>
                          
                          {/* Interactive E-Receipt Slip trigger */}
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptTx(tx)}
                            className="px-3.5 py-2 hover:bg-[#00B87A] bg-[#00B87A]/10 hover:text-white text-[#00B87A] text-[10px] font-black rounded-xl cursor-pointer transition active:scale-95 uppercase tracking-wider font-mono flex items-center gap-1 shadow-sm hover:shadow-md border border-[#00B87A]/10"
                            title="View digital invoice receipt"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 1. SIGNATURE OPAY DEEP GREEN WALLET BALANCE CARD */}
        <div className="bg-gradient-to-br from-[#00b87a] via-[#10b981] to-[#047857] text-white p-6 rounded-3xl shadow-xl space-y-6 relative overflow-hidden">
          {/* Ambient background decoration circle standard in stylish fintech apps */}
          <div className="absolute -bottom-8 -right-8 w-44 h-44 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-100 font-mono tracking-wider font-semibold uppercase">
                  Realized Gain ({state.activeTimeframe})
                </span>
                <button
                  type="button"
                  onClick={() => setHideBalances(!hideBalances)}
                  className="p-1 hover:bg-white/10 rounded transition text-emerald-100 hover:text-white cursor-pointer"
                  title={hideBalances ? "Show Account Balances" : "Privacy Lock Balances"}
                >
                  {hideBalances ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-baseline gap-4">
                <h1 className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight select-none">
                  {activeMetrics && <AnimatedNumber value={activeMetrics.profit} format={displayNaira} />}
                </h1>
              </div>
            </div>
            
            {/* OPay premium crown badge */}
            <div className="bg-white/15 px-3 py-1.5 rounded-2xl border border-white/10 text-right">
              <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-200">Baseline POS</span>
              <span className="text-xs font-bold text-white block font-mono">{state.terminalFeeRate === 0.25 ? '0.25% Saver' : '0.50% Standard'}</span>
            </div>
          </div>

          {/* Quick Metrics Sub-ledger */}
          <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-xs">
            <div>
              <span className="text-[#a7f3d0] text-[10px] block font-mono">Processed Flow</span>
              <span className="font-bold text-sm block font-mono mt-0.5">{displayNaira(activeMetrics.volume)}</span>
            </div>
            <div>
              <span className="text-[#a7f3d0] text-[10px] block font-mono">Total POS Cost</span>
              <span className="font-bold text-sm block font-mono mt-0.5 text-orange-200">-{displayNaira(activeMetrics.terminalFees)}</span>
            </div>
            <div>
              <span className="text-[#a7f3d0] text-[10px] block font-mono">Txns Rate</span>
              <span className="font-bold text-sm block font-mono mt-0.5">{activeMetrics.count} Receipts</span>
            </div>
          </div>

          {/* Core Green Card Quick Cash Actions (Triggers Forms immediately) */}
          <div className="grid grid-cols-3 gap-3 bg-white/10 p-2.5 rounded-2xl backdrop-blur-md">
            <button
              onClick={() => openWithPreset('Deposit')}
              className="bg-white hover:bg-neutral-50 text-[#00b87a] font-bold py-2.5 px-1 rounded-xl text-[12px] flex flex-col sm:flex-row items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <ArrowUpFromLine className="w-4 h-4 text-[#00b87a]" />
              <span>Wallet Deposit</span>
            </button>
            <button
              onClick={() => openWithPreset('Transfer')}
              className="bg-white hover:bg-neutral-50 text-[#00b87a] font-bold py-2.5 px-1 rounded-xl text-[12px] flex flex-col sm:flex-row items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <ArrowRightLeft className="w-4 h-4 text-[#00b87a]" />
              <span>Bank Transfer</span>
            </button>
            <button
              onClick={() => openWithPreset('Withdrawal')}
              className="bg-white hover:bg-neutral-50 text-[#00b87a] font-bold py-2.5 px-1 rounded-xl text-[12px] flex flex-col sm:flex-row items-center justify-center gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4 text-[#00b87a]" />
              <span>Cash Out POS</span>
            </button>
          </div>

        </div>

        {/* 2. OPAY DYNAMIC SCROLLING OR WARNING BANNER STRIP */}
        <div className="bg-neutral-200/50 border border-neutral-300/40 p-3 rounded-2xl flex items-center justify-between text-neutral-700 text-xs gap-3">
          <div className="flex items-center gap-2 truncate">
            <span className="bg-amber-500 text-neutral-950 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider block shrink-0">
              Security Notice
            </span>
            <span className="truncate font-medium text-[11px] text-neutral-600">
              Only release banknotes to withdrawal customers AFTER a "SUCCESSFUL" message. Beware of fake digital alerts!
            </span>
          </div>
          <button 
            type="button"
            onClick={() => alert("Security verification guide: 1. Confirm transaction slips. 2. Verify alert directly inside this app. 3. Ensure baseline rates align.")}
            className="text-xs text-[#00B87A] font-bold hover:underline shrink-0 pl-1"
          >
            Guide
          </button>
        </div>



        {/* SUB-DASHBOARD NAVIGATION TABS */}
        <div className={`bg-white border border-neutral-200 p-1.5 rounded-3xl shadow-sm grid gap-1 select-none ${
          activeUser.role === 'Manager'
            ? 'grid-cols-3 sm:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-4'
        }`}>
          <button
            type="button"
            onClick={() => setDashboardTab('pos')}
            className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
              dashboardTab === 'pos'
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-md font-black'
                : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            <Smartphone className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black tracking-tight leading-none">Main POS</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardTab('expenses')}
            className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
              dashboardTab === 'expenses'
                ? 'bg-rose-500 text-white border-rose-500 shadow-md font-black'
                : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            <TrendingDown className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black tracking-tight leading-none">Expenses</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardTab('unpaid')}
            className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
              dashboardTab === 'unpaid'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md font-black'
                : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            <History className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black tracking-tight leading-none">Debts</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardTab('terminals')}
            className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
              dashboardTab === 'terminals'
                ? 'bg-[#00B87A] text-white border-[#00B87A] shadow-md font-black'
                : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
            }`}
          >
            <CreditCard className="w-5 h-5 shrink-0" />
            <span className="text-[10px] font-black tracking-tight leading-none">POS Terminals</span>
          </button>

          {activeUser.role === 'Manager' && (
            <button
              type="button"
              onClick={() => setDashboardTab('reports')}
              className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
                dashboardTab === 'reports'
                  ? 'bg-indigo-500 text-white border-indigo-500 shadow-md font-black'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              <TrendingUp className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black tracking-tight leading-none">Reports</span>
            </button>
          )}

          {activeUser.role === 'Manager' && (
            <button
              type="button"
              onClick={() => setDashboardTab('settings')}
              className={`py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border text-center active:scale-95 duration-100 ${
                dashboardTab === 'settings'
                  ? 'bg-neutral-700 text-white border-neutral-700 shadow-md font-black'
                  : 'bg-transparent border-transparent text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800'
              }`}
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-black tracking-tight leading-none">Configure</span>
            </button>
          )}
        </div>

        {/* 3. OPAY TRADITIONAL CIRCULAR SHORTCUTS MENU GRID */}
        {dashboardTab === 'pos' && (
        <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-sm space-y-4">
          <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-neutral-400 block pb-1 border-b border-neutral-100">
            Core Services Grid
          </span>
          <div className="grid grid-cols-4 gap-y-5 gap-x-2 text-center">
            
            {/* To Bank (Transfer) */}
            <button 
              onClick={() => openWithPreset('Transfer')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 transition-colors flex items-center justify-center text-emerald-600 shadow-sm active:scale-90 duration-100">
                <ArrowRightLeft className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">To Bank</span>
            </button>

            {/* POS Cashout */}
            <button 
              onClick={() => openWithPreset('Withdrawal')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-orange-200 transition-colors flex items-center justify-center text-orange-600 shadow-sm active:scale-90 duration-100">
                <ArrowDownToLine className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">POS Cashout</span>
            </button>

            {/* Wallet Deposit */}
            <button 
              onClick={() => openWithPreset('Deposit')}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 group-hover:bg-blue-200 transition-colors flex items-center justify-center text-blue-600 shadow-sm active:scale-90 duration-100">
                <ArrowUpFromLine className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Wallet Cash</span>
            </button>

            {/* Simulate Random TX */}
            <button 
              onClick={triggerSimulation}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none animate-bounce-slow"
              title="Inject random ledger sample"
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 group-hover:bg-purple-200 transition-colors flex items-center justify-center text-purple-600 shadow-sm active:scale-90 duration-100">
                <RefreshCw className="w-5 h-5 stroke-[2.2] text-purple-600 animate-spin-slow" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Simulate TX</span>
            </button>

            {/* Configure Target Goal */}
            <button 
              onClick={() => scrollToRef(targetSectionRef)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 group-hover:bg-rose-200 transition-colors flex items-center justify-center text-rose-600 shadow-sm active:scale-90 duration-100">
                <Target className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Edit Goal</span>
            </button>

            {/* Cashier Reconciliation */}
            <button 
              onClick={() => setIsReconCalcOpen(true)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-indigo-100 group-hover:bg-indigo-200 transition-colors flex items-center justify-center text-indigo-600 shadow-sm active:scale-90 duration-100">
                <Calculator className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Calc Profit</span>
            </button>

            {/* Download CSV Logs */}
            <button 
              onClick={handleExportCSV}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 group-hover:bg-amber-200 transition-colors flex items-center justify-center text-amber-600 shadow-sm active:scale-90 duration-100">
                <FileSpreadsheet className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight font-sans">Export CSV</span>
            </button>



            {/* Reset Sandbox */}
            <button 
              onClick={() => {
                if (confirm('Clear custom employee logs and restore baseline diagnostic records?')) {
                  dispatch({ type: 'RESET_DATA' });
                }
              }}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 group-hover:bg-red-200 transition-colors flex items-center justify-center text-red-600 shadow-sm active:scale-90 duration-100">
                <RotateCcw className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Reset Data</span>
            </button>

            {/* View Ledger (Split History trigger Button) */}
            <button 
              type="button"
              onClick={() => scrollToRef(historySectionRef)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
              title="View separated Moniepoint, OPay, PalmPay, and other receipts"
            >
              <div className="w-12 h-12 rounded-full bg-teal-100 group-hover:bg-teal-200 transition-all flex items-center justify-center text-teal-600 shadow-sm active:scale-90 duration-100">
                <History className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Ledger Split</span>
            </button>

            {/* Shift Profile Section */}
            <button 
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
              title="Manage Employees registry, passcode PINs and switch active shift"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 group-hover:bg-emerald-200 text-[#00B87A] transition-all flex items-center justify-center shadow-sm active:scale-90 duration-100">
                <UserCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 leading-tight">Shift Profile</span>
            </button>
          </div>
        </div>
        )}

        {/* Active Transaction Counters & Performance */}
        <div className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-xs space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
            <div>
              <h4 className="text-sm font-extrabold text-neutral-800 tracking-tight flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-[#00B87A]/10 text-[#00B87A] text-xs">📈</span>
                <span>Active Transaction Counters & Performance</span>
              </h4>
              <p className="text-[11px] text-neutral-500 font-medium">
                Live performance metrics for operators showing transaction counts and volumes across time ranges.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 self-start sm:self-center px-2.5 py-1 rounded-full bg-emerald-50 text-[10px] font-mono font-black uppercase tracking-wider text-[#00B87A] border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A] animate-ping" />
              Live Ledger Synced
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Today's Activity",
                badge: 'Daily',
                count: summaryOverviews.daily.count,
                volume: summaryOverviews.daily.volume,
                bgColor: 'bg-emerald-50/40 border-emerald-100/80',
                textColor: 'text-emerald-700',
                countColor: 'bg-emerald-105 text-emerald-800',
                icon: '⚡'
              },
              {
                label: 'Weekly Summary',
                badge: 'Weekly',
                count: summaryOverviews.weekly.count,
                volume: summaryOverviews.weekly.volume,
                bgColor: 'bg-blue-50/40 border-blue-100/80',
                textColor: 'text-blue-700',
                countColor: 'bg-blue-100 text-blue-800',
                icon: '📅'
              },
              {
                label: 'Monthly Statement',
                badge: 'Monthly',
                count: summaryOverviews.monthly.count,
                volume: summaryOverviews.monthly.volume,
                bgColor: 'bg-indigo-50/40 border-indigo-100/80',
                textColor: 'text-indigo-700',
                countColor: 'bg-indigo-100 text-indigo-800',
                icon: '📊'
              },
              {
                label: 'Annual Statement',
                badge: 'Yearly',
                count: summaryOverviews.yearly.count,
                volume: summaryOverviews.yearly.volume,
                bgColor: 'bg-purple-50/40 border-purple-100/80',
                textColor: 'text-purple-700',
                countColor: 'bg-purple-100 text-purple-800',
                icon: '🌟'
              }
            ].map((period, i) => (
              <div 
                key={i} 
                className={`p-3.5 rounded-2xl border ${period.bgColor} transition-all hover:shadow-xs hover:scale-[1.01] duration-150 flex flex-col justify-between space-y-2`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider font-mono">
                    {period.label}
                  </span>
                  <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full ${period.countColor} flex items-center gap-1`}>
                    <span>{period.icon}</span>
                    <span>{period.count} tx{period.count === 1 ? '' : 's'}</span>
                  </span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-neutral-500 block font-medium">Accumulated Volume</span>
                  <span className={`text-base font-black font-mono block tracking-tight ${period.textColor}`}>
                    {displayNaira(period.volume)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7. SECURED BASELINE TERMINAL OPERATOR COMMISSIONS */}
        {dashboardTab === 'settings' && (
        <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-[#00B87A]" /> Cashout Base Operating Cost Rate
            </span>
            <p className="text-[11px] text-neutral-500 font-medium">Configure terminal operator charge settings (0.25% Saver vs 0.50% Master rate).</p>
          </div>
 
          <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TERMINAL_RATE', payload: 0.25 })}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                state.terminalFeeRate === 0.25 
                  ? 'bg-[#00B87A] text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              0.25% Saver
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_TERMINAL_RATE', payload: 0.5 })}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                state.terminalFeeRate === 0.5 
                  ? 'bg-[#00B87A] text-white shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              0.50% Standard
            </button>
          </div>
        </div>
        )}

        {/* 7.6. EXPENSE TRACKING */}
        {dashboardTab === 'expenses' && (
        <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-[#00B87A]" /> {state.activeTimeframe} Expenses
            </span>
            <button
              onClick={() => setIsAddingExpense(!isAddingExpense)}
              className="text-xs text-[#00B87A] font-bold"
            >
              {isAddingExpense ? 'Cancel' : '+ Add Expense'}
            </button>
          </div>
          <CalendarFilter 
            activeTimeframe={state.activeTimeframe} 
            selectedDate={filterDate}
            onTimeframeChange={(tf) => dispatch({ type: 'SET_TIMEFRAME', payload: tf })}
            onDateChange={setFilterDate}
          />
          {(() => {
            const now = filterDate;
            
            // Calculate totals across all 4 timeframes
            const dailyExpenses = state.expenses.filter(e => isSameDay(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);
            const weeklyExpenses = state.expenses.filter(e => isSameWeek(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);
            const monthlyExpenses = state.expenses.filter(e => isSameMonth(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);
            const yearlyExpenses = state.expenses.filter(e => isSameYear(new Date(e.timestamp), filterDate)).reduce((sum, e) => sum + e.amount, 0);

            // Filter the active list based on selected timeframe
            const filteredExpenses = state.expenses.filter(e => {
              const d = new Date(e.timestamp);
              if (state.activeTimeframe === 'Daily') return isSameDay(d, now);
              if (state.activeTimeframe === 'Weekly') return isSameWeek(d, now);
              if (state.activeTimeframe === 'Monthly') return isSameMonth(d, now);
              return isSameYear(d, now);
            });

            const timeframes = [
              { name: 'Daily' as const, amount: dailyExpenses },
              { name: 'Weekly' as const, amount: weeklyExpenses },
              { name: 'Monthly' as const, amount: monthlyExpenses },
              { name: 'Yearly' as const, amount: yearlyExpenses }
            ];

            return (
              <div className="space-y-4">
                {/* 4-Column Timeframe KPIs Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {timeframes.map(tf => {
                    const isActive = state.activeTimeframe === tf.name;
                    return (
                      <button
                        key={tf.name}
                        type="button"
                        onClick={() => dispatch({ type: 'SET_TIMEFRAME', payload: tf.name })}
                        className={`text-left p-3.5 rounded-2xl border transition-all relative cursor-pointer focus:outline-none ${
                          isActive
                            ? 'bg-gradient-to-br from-rose-50 to-white border-rose-200 shadow-sm ring-1 ring-rose-200/50'
                            : 'bg-neutral-50/50 border-neutral-200/60 hover:bg-neutral-50 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1.5">
                          <span className={`text-[9px] font-extrabold tracking-wider uppercase ${isActive ? 'text-rose-700' : 'text-neutral-400'}`}>
                            {tf.name}
                          </span>
                          {isActive && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <span className={`text-base font-mono font-black block tracking-tight ${isActive ? 'text-rose-900' : 'text-neutral-800'}`}>
                            {formatNaira(tf.amount)}
                          </span>
                          <span className="text-[9px] text-neutral-400 block font-medium">Expenses Outflow</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Info Bar showing which view is active */}
                <div className="flex items-center justify-between bg-neutral-50/80 border border-neutral-200/60 px-3.5 py-2.5 rounded-xl text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Receipt className="w-3.5 h-3.5 text-neutral-400" />
                    Currently active: <strong className="text-neutral-700">{state.activeTimeframe} Expenses Log</strong>
                  </span>
                  <span className="text-[10px] text-neutral-400 bg-neutral-200/60 px-2 py-0.5 rounded-full font-bold">
                    {filteredExpenses.length} Records
                  </span>
                </div>

                {/* Add Expense Form Box */}
                {isAddingExpense && (
                  <div className="space-y-3 p-4 bg-gradient-to-b from-neutral-50 to-neutral-100/50 rounded-2xl border border-neutral-200 shadow-inner animate-fade-in">
                    <div className="flex items-center gap-1.5 border-b border-neutral-200/60 pb-2 mb-2">
                      <div className="p-1 rounded-md bg-emerald-50 text-[#00B87A]">
                        <Tag className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-extrabold text-neutral-800 tracking-tight uppercase">Record New Expense Outlet</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Description / Purpose</label>
                        <input
                          type="text"
                          placeholder="e.g. Petrol for Generator, POS rolls..."
                          value={newExpenseDesc}
                          onChange={(e) => setNewExpenseDesc(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#00B87A] focus:border-[#00B87A] placeholder-neutral-300 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Amount (₦)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 font-mono">₦</span>
                          <input
                            type="number"
                            placeholder="0.00"
                            value={newExpenseAmt}
                            onChange={(e) => setNewExpenseAmt(e.target.value)}
                            className="w-full text-xs pl-6 pr-2.5 py-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#00B87A] focus:border-[#00B87A] placeholder-neutral-300 font-bold font-mono"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider block">Memo / Notes</label>
                        <input
                          type="text"
                          placeholder="e.g. Extra details..."
                          value={newExpenseNotes}
                          onChange={(e) => setNewExpenseNotes(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#00B87A] focus:border-[#00B87A] placeholder-neutral-300 font-medium"
                        />
                    </div>
                    <div className="mt-2">
                        <AudioRecorder onSave={setNewExpenseAudio} initialAudio={newExpenseAudio} />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNewExpenseDesc('');
                          setNewExpenseAmt('');
                          setIsAddingExpense(false);
                        }}
                        className="px-3.5 py-2 text-xs text-neutral-500 hover:bg-neutral-200/50 rounded-xl font-bold transition cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (newExpenseDesc && newExpenseAmt) {
                            const expense = {
                              id: Date.now().toString(),
                              amount: parseFloat(newExpenseAmt),
                              description: newExpenseDesc,
                              timestamp: new Date().toISOString(),
                              ownerId: state.currentUser.ownerId,
                              employeeId: state.currentUser.id,
                              employeeName: state.currentUser.name,
                              notes: newExpenseNotes || undefined,
                              audioNote: newExpenseAudio || undefined
                            };
                            handleAddExpense(expense);
                            setNewExpenseDesc('');
                            setNewExpenseAmt('');
                            setNewExpenseNotes('');
                            setNewExpenseAudio('');
                            setIsAddingExpense(false);
                          }
                        }}
                        className="px-5 py-2 bg-[#00B87A] hover:bg-[#00a36c] text-white rounded-xl font-bold text-xs transition shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        Save Record
                      </button>
                    </div>
                  </div>
                )}

                {/* Expenses Log Entries List */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {filteredExpenses.map(e => {
                    const formattedDate = new Date(e.timestamp).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div key={e.id} className="group flex justify-between items-center text-xs p-3 bg-neutral-50 hover:bg-neutral-100/60 border border-neutral-150 rounded-xl transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold shadow-xs">
                            <TrendingDown className="w-4 h-4" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="font-bold text-neutral-800 block">{e.description}</span>
                            <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-medium">
                              <span className="font-mono">{formattedDate}</span>
                              {e.employeeName && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-neutral-200" />
                                  <span className="bg-neutral-200/50 text-neutral-500 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                                    by {e.employeeName}
                                  </span>
                                </>
                              )}
                            </div>
                            {e.notes && <span className="text-[10px] text-neutral-500 font-medium italic block mt-0.5">"{e.notes}"</span>}
                            {e.audioNote && (
                              <button
                                type="button"
                                onClick={() => {
                                  const audio = new Audio(e.audioNote);
                                  audio.play();
                                }}
                                className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md mt-1 cursor-pointer"
                              >
                                🔊 Play Voice Note
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-bold font-mono text-rose-600 text-sm">-{formatNaira(e.amount)}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(e.id)}
                            className="p-1.5 text-neutral-300 hover:text-red-500 rounded-lg hover:bg-neutral-200/50 transition cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Delete this expense record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredExpenses.length === 0 && (
                    <div className="text-center py-8 bg-neutral-50/30 border border-dashed border-neutral-200 rounded-2xl">
                      <Receipt className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-neutral-500">No {state.activeTimeframe.toLowerCase()} expenses logged</p>
                      <p className="text-[10px] text-neutral-400 mt-1">Tap "+ Add Expense" at the top right to log operating costs.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        )}

        {dashboardTab === 'terminals' && (
          <div className="space-y-6">
            
            {/* Header section with register terminal trigger */}
            <div className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-extrabold text-neutral-800 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-[#00B87A]" /> Registered POS Terminals
                </h2>
                <p className="text-xs text-neutral-550 mt-1 font-medium">Add POS terminals, map cashier operations, trace account numbers, and monitor differentiated cashier profits and volume flow.</p>
              </div>
                <button
                  type="button"
                  onClick={() => setIsAddingTerminal(!isAddingTerminal)}
                  className="bg-[#00B87A] hover:bg-[#00A068] text-white px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer select-none"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register POS Terminal</span>
                </button>
            </div>

            {/* MOST ACTIVE TERMINAL PERFORMANCE SUMMARY BAR */}
            {mostActiveTerminal ? (
              <div className="bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-white border border-emerald-100 p-5 rounded-3xl shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#00B87A] text-white flex items-center justify-center shadow-md shadow-emerald-500/10 shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-600/10 text-emerald-700 font-mono font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1">
                      🔥 Most Active Terminal
                    </span>
                    <h3 className="text-base font-extrabold text-neutral-800 tracking-tight flex items-center gap-2">
                      {mostActiveTerminal.name}
                      <span className="text-xs font-bold text-neutral-450">({mostActiveTerminal.provider})</span>
                    </h3>
                    <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                      Operator: <strong className="text-neutral-700">{mostActiveTerminal.cashierName || 'N/A'}</strong> &bull; Operating Location: <strong className="text-neutral-700">{mostActiveTerminal.areaOfWorking || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 md:gap-7 items-center w-full md:w-auto border-t md:border-t-0 border-neutral-100 pt-3 md:pt-0">
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Performance Volume</span>
                    <span className="block text-sm font-black font-mono text-[#00B87A]">{formatNaira(mostActiveTerminal.volume)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Operator Profit</span>
                    <span className="block text-sm font-black font-mono text-emerald-700">{formatNaira(mostActiveTerminal.profit)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="block text-[9px] font-bold text-neutral-400 uppercase tracking-wider font-mono">Slips Flow</span>
                    <span className="block text-[11px] font-black font-mono bg-neutral-100/65 border border-neutral-200 text-neutral-700 px-2 py-0.5 rounded-lg shadow-2xs">
                      {mostActiveTerminal.count} Receipts
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-50/50 border border-neutral-200/50 p-5 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-xs font-medium text-neutral-500 font-sans">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center shrink-0 border border-neutral-200">
                    <Sparkles className="w-4 h-4 text-neutral-400" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-neutral-800 tracking-tight text-sm">POS Performance Telemetry</h4>
                    <p className="text-[11px] text-neutral-450 font-medium mt-0.5">Awaiting active transactions on registered POS devices to select top operator metrics.</p>
                  </div>
                </div>
                <div className="text-[10px] bg-white border border-neutral-200 px-3 py-1 rounded-xl text-neutral-450 font-mono font-bold">
                  🟢 Real-time monitoring active
                </div>
              </div>
            )}

            {/* ADD POS TERMINAL FORM BLOCK */}
            {isAddingTerminal && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTerminalName.trim()) {
                    alert('Name of the POS is required.');
                    return;
                  }
                  if (!newTerminalAccountNo.trim()) {
                    alert('POS Account number is required.');
                    return;
                  }
                  if (!newTerminalCashierName.trim()) {
                    alert('Name of the cashier is required.');
                    return;
                  }
                  if (!newTerminalArea.trim()) {
                    alert('Area of working is required.');
                    return;
                  }
                  const term: PosTerminal = {
                    id: 'term_' + Math.random().toString(36).substring(2, 9),
                    name: newTerminalName.trim(),
                    provider: newTerminalProvider,
                    posAccountNo: newTerminalAccountNo.trim(),
                    cashierName: newTerminalCashierName.trim(),
                    areaOfWorking: newTerminalArea.trim(),
                    terminalFeeRate: newTerminalRate,
                    serialNumber: newTerminalSN.trim(),
                    ownerId: state.impersonatedUserId || (syncOwnerId || 'local_owner'),
                    addedBy: state.currentUser.name,
                    status: 'Active',
                    timestamp: new Date().toISOString(),
                    simCardNumber: newTerminalSim.trim(),
                    networkProvider: newTerminalNetwork as any,
                    batteryLevel: newTerminalBattery,
                    signalStrength: newTerminalSignal
                  };
                  handleAddPosTerminal(term);
                  setNewTerminalName('');
                  setNewTerminalAccountNo('');
                  setNewTerminalCashierName('');
                  setNewTerminalArea('');
                  setNewTerminalSN('');
                  setNewTerminalSim('');
                  setNewTerminalNetwork('MTN');
                  setNewTerminalBattery(100);
                  setNewTerminalSignal(5);
                  setIsAddingTerminal(false);
                }}
                className="bg-white border border-neutral-200 p-6 rounded-3xl shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200"
              >
                <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  📝 POS Hardware & Operator Register Profile
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Name of the POS *
                    </label>
                    <input
                      type="text"
                      value={newTerminalName}
                      onChange={(e) => setNewTerminalName(e.target.value)}
                      placeholder="e.g. OPay Main Counter"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      POS Account No *
                    </label>
                    <input
                      type="text"
                      value={newTerminalAccountNo}
                      onChange={(e) => setNewTerminalAccountNo(e.target.value)}
                      placeholder="e.g. 8112345678"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Name of the Cashier *
                    </label>
                    <input
                      type="text"
                      value={newTerminalCashierName}
                      onChange={(e) => setNewTerminalCashierName(e.target.value)}
                      placeholder="e.g. Chinedu Okafor"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Area of working with POS *
                    </label>
                    <input
                      type="text"
                      value={newTerminalArea}
                      onChange={(e) => setNewTerminalArea(e.target.value)}
                      placeholder="e.g. Main Hall, Gate, Outer Stand"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Serial Number
                    </label>
                    <input
                      type="text"
                      value={newTerminalSN}
                      onChange={(e) => setNewTerminalSN(e.target.value)}
                      placeholder="e.g. SN-123456"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      POS Hardware Brand *
                    </label>
                    <select
                      value={newTerminalProvider}
                      onChange={(e) => setNewTerminalProvider(e.target.value as ProviderType)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                    >
                      <option value="OPay">OPay</option>
                      <option value="Moniepoint">Moniepoint</option>
                      <option value="PalmPay">PalmPay</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      SIM Card Number
                    </label>
                    <input
                      type="text"
                      value={newTerminalSim}
                      onChange={(e) => setNewTerminalSim(e.target.value)}
                      placeholder="e.g. 08012345678"
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Network Provider
                    </label>
                    <select
                      value={newTerminalNetwork}
                      onChange={(e) => setNewTerminalNetwork(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                    >
                      <option value="MTN">MTN</option>
                      <option value="Airtel">Airtel</option>
                      <option value="Glo">Glo</option>
                      <option value="9mobile">9mobile</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      POS Hardware Brand *
                    </label>
                    <select
                      value={newTerminalProvider}
                      onChange={(e) => setNewTerminalProvider(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none focus:border-[#00B87A]"
                    >
                      <option value="OPay">OPay Terminal</option>
                      <option value="Moniepoint">Moniepoint Terminal</option>
                      <option value="PalmPay">PalmPay Terminal</option>
                      <option value="Others">Others / Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1.5 font-mono">
                      Baseline Terminal Fee Rate Package *
                    </label>
                    <select
                      value={newTerminalRate}
                      onChange={(e) => setNewTerminalRate(parseFloat(e.target.value) as any)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 text-xs text-neutral-800 font-bold focus:outline-none"
                    >
                      <option value={0.5}>0.50% (Standard Business Rate)</option>
                      <option value={0.25}>0.25% (Saver Corporate Rate)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingTerminal(false)}
                    className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 rounded-xl text-xs font-bold text-neutral-600 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#00B87A] hover:bg-[#00A068] text-white rounded-xl text-xs font-bold transition shadow-sm"
                  >
                    Confirm & Register
                  </button>
                </div>
              </form>
            )}

            {/* Registered POS Terminals Cards List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* Live Terminal Cards Loop */}
              {terminalStats.map((term) => {
                const brandColors = {
                  Moniepoint: 'bg-blue-50/55 border-blue-100 text-blue-700',
                  OPay: 'bg-emerald-50/55 border-emerald-100 text-emerald-700',
                  PalmPay: 'bg-orange-50/55 border-orange-100 text-orange-700',
                  Others: 'bg-neutral-50/55 border-neutral-100 text-neutral-700'
                };
                const tagColors = {
                  Moniepoint: 'bg-blue-600',
                  OPay: 'bg-[#00B87A]',
                  PalmPay: 'bg-orange-500',
                  Others: 'bg-neutral-500'
                };
                
                const currentBrand = (term.provider in brandColors) ? term.provider as keyof typeof brandColors : 'Others';
                
                return (
                  <div
                    key={term.id}
                    className="bg-white border border-neutral-200 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all duration-150 flex flex-col justify-between space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${tagColors[currentBrand]} flex items-center justify-center text-[10px] text-white font-bold`}>
                          {term.provider[0]}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-neutral-800 tracking-tight">{term.name}</h4>
                          <span className="text-[10px] text-neutral-400 font-mono">Acct: {term.posAccountNo || 'N/A'}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-md font-mono font-bold ${brandColors[currentBrand]}`}>
                        {term.provider} ({term.terminalFeeRate === 0.25 ? '0.25%' : '0.5%'})
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs bg-neutral-50/70 p-3 rounded-2xl border border-neutral-100">
                      <div className="flex justify-between">
                        <span className="text-neutral-400 font-medium">Cashier:</span>
                        <span className="font-bold text-neutral-700">{term.cashierName || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-neutral-400 font-medium">Area of Working:</span>
                        <span className="font-bold text-neutral-700">{term.areaOfWorking || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-neutral-100 flex-wrap">
                        <div className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 ${term.networkStatus === 'Active' ? 'bg-emerald-100 text-emerald-800' : term.networkStatus === 'Inactive' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-600'}`}>
                            <Wifi className="w-3 h-3" />
                            <span className="text-[9px] font-bold">{term.networkStatus || 'Unknown'}</span>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 ${term.browsingStatus === 'Enabled' ? 'bg-emerald-100 text-emerald-800' : term.browsingStatus === 'Disabled' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-600'}`}>
                            <Globe className="w-3 h-3" />
                            <span className="text-[9px] font-bold">{term.browsingStatus || 'Unknown'}</span>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded-full flex items-center gap-1 ${term.internetAccess === 'Granted' ? 'bg-emerald-100 text-emerald-800' : term.internetAccess === 'Denied' ? 'bg-red-100 text-red-800' : 'bg-neutral-100 text-neutral-600'}`}>
                            <CheckCircle className="w-3 h-3" />
                            <span className="text-[9px] font-bold">{term.internetAccess || 'Unknown'}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCheckTerminalNetwork(term)}
                        className="mt-2 w-full flex items-center justify-center gap-1.5 text-[10px] font-bold bg-white border border-neutral-200 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Check Network
                      </button>
                    </div>

                    <div className="border-t border-neutral-100 pt-3.5 space-y-2.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-450 font-medium font-sans">Total Volume Flow</span>
                        <span className="font-extrabold font-mono text-neutral-800">{formatNaira(term.volume)}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-450 font-medium font-sans">Differentiated Net Profit</span>
                        <span className="font-extrabold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{formatNaira(term.profit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-neutral-450 font-mono">Transactions Count</span>
                        <span className="font-bold text-neutral-700 font-mono">{term.count} Receipts</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-neutral-100 pt-3">
                      <span className="text-[9px] text-neutral-400 font-semibold font-sans">Added by: {term.addedBy}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Are you sure you want to remove ${term.name}?`)) {
                            handleDeletePosTerminal(term.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 text-[11px] font-bold transition flex items-center gap-0.5 cursor-pointer select-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove POS
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Default unlinked transactions card (for backward compatibility / fallback) */}
              {(defaultTerminalStats.count > 0 || state.posTerminals?.length === 0) && (
                <div className="bg-neutral-50/50 border border-neutral-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-extrabold text-sm text-neutral-800 tracking-tight">Direct POS / Legacy Terminal</h4>
                      <span className="text-[10px] text-neutral-400 font-sans">Non-terminal transactions</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-md font-mono font-bold bg-neutral-200 text-neutral-700">
                      Standard Rates
                    </span>
                  </div>

                  <div className="border-t border-neutral-100 pt-3.5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-450 font-medium font-sans">Total Volume Flow</span>
                      <span className="font-extrabold font-mono text-neutral-800">{formatNaira(defaultTerminalStats.volume)}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-450 font-medium font-sans">Differentiated Net Profit</span>
                      <span className="font-extrabold font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">{formatNaira(defaultTerminalStats.profit)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-neutral-450 font-mono">Transactions Count</span>
                      <span className="font-bold text-neutral-700 font-mono">{defaultTerminalStats.count} Receipts</span>
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 pt-3 flex justify-between items-center">
                    <span className="text-[9px] text-neutral-400 font-semibold">Native Default Tracker</span>
                    <span className="text-[10px] text-neutral-400 italic font-medium">Fallback active</span>
                  </div>
                </div>
              )}
            </div>

            {/* Empty state when no custom terminals registered */}
            {(!state.posTerminals || state.posTerminals.length === 0) && (
              <div className="text-center py-12 bg-white border border-neutral-200 rounded-3xl p-6 shadow-xs max-w-lg mx-auto">
                <CreditCard className="w-12 h-12 text-[#00B87A]/20 mx-auto mb-3" />
                <h4 className="text-base font-extrabold text-neutral-800 tracking-tight">No POS Terminals Registered</h4>
                <p className="text-xs text-neutral-550 mt-1.5 leading-relaxed">
                  Register OPay, Moniepoint, or PalmPay hardware devices with their associated account number, cashier operator, and working area. Differentiated tracking will map profits and statistics separately per registered device.
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddingTerminal(true)}
                  className="mt-4 bg-[#00B87A] hover:bg-[#00A068] text-white px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-sm inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Register Cashier POS Terminal
                </button>
              </div>
            )}

            {/* AGGREGATED PROFIT AND TRANSACTION SUMS BLOCK - "ADD ALL TRANSACTIONS AND ALL PROFITS" */}
            <div className="bg-gradient-to-br from-[#00B87A] to-[#00A068] text-white rounded-3xl p-6 sm:p-8 shadow-xl mt-6">
              <div className="flex justify-between items-center border-b border-white/20 pb-4 mb-4">
                <div>
                  <h3 className="text-base font-extrabold tracking-tight">Combined POS Cash Ledger</h3>
                  <p className="text-[11px] text-emerald-100 font-medium">Aggregating all active terminals + direct channel transactions</p>
                </div>
                <div className="p-2 bg-white/10 rounded-2xl border border-white/5">
                  <CreditCard className="w-5 h-5 text-emerald-100" />
                </div>
              </div>

              {/* Differentiated listing inside combined dashboard */}
              <div className="space-y-3 pt-1">
                {terminalStats.map((term) => (
                  <div key={term.id} className="flex justify-between items-center text-xs border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="font-bold">{term.name} ({term.provider})</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span className="text-emerald-100">Flow: {formatNaira(term.volume)}</span>
                      <span className="font-black bg-white/15 px-2 py-0.5 rounded-lg">Profit: +{formatNaira(term.profit)}</span>
                    </div>
                  </div>
                ))}

                {defaultTerminalStats.count > 0 && (
                  <div className="flex justify-between items-center text-xs border-b border-white/10 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-300" />
                      <span className="font-bold">Direct POS / Legacy Terminal</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span className="text-emerald-100">Flow: {formatNaira(defaultTerminalStats.volume)}</span>
                      <span className="font-black bg-white/15 px-2 py-0.5 rounded-lg">Profit: +{formatNaira(defaultTerminalStats.profit)}</span>
                    </div>
                  </div>
                )}
                
                {/* GRAND TOTALS BLOCK - "ADD ALL TRANSACTIONS AND ALL PROFITS" */}
                {(() => {
                  const successTxs = state.transactions.filter(t => t.status === 'Success');
                  const grandTotalVolume = successTxs.reduce((sum, t) => sum + t.amount, 0);
                  const grandTotalProfit = successTxs.reduce((sum, t) => sum + t.profit, 0);
                  const grandTotalTransactions = successTxs.length;

                  return (
                    <div className="grid grid-cols-1 gap-4 pt-4 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white/10 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                          <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">GRAND TOTAL VOLUME</span>
                          <span className="text-lg font-extrabold font-mono text-white leading-none block">{formatNaira(grandTotalVolume)}</span>
                        </div>
                        <div className="bg-white/10 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                          <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">GRAND TOTAL PROFITS</span>
                          <span className="text-lg font-extrabold font-mono text-yellow-300 leading-none block">{formatNaira(grandTotalProfit)}</span>
                        </div>
                        <div className="bg-white/10 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                          <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">GRAND RECEIPT COUNT</span>
                          <span className="text-lg font-extrabold font-mono text-white leading-none block">{grandTotalTransactions} Receipts</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(['OPay', 'Moniepoint', 'PalmPay'] as const).map(provider => {
                          const providerTxs = state.transactions.filter(t => t.provider === provider && t.status === 'Success');
                          const totalVolume = providerTxs.reduce((sum, t) => sum + t.amount, 0);
                          const totalProfit = providerTxs.reduce((sum, t) => sum + t.profit, 0);
                          return (
                            <div key={provider} className="bg-white/5 p-3.5 rounded-2xl border border-white/5 space-y-0.5">
                              <span className="text-[10px] block uppercase font-mono tracking-wider text-emerald-100">{provider} TOTAL</span>
                              <span className="text-sm font-bold text-white block">Vol: {formatNaira(totalVolume)}</span>
                              <span className="text-xs font-mono text-yellow-300 block">Profit: {formatNaira(totalProfit)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>

          </div>
        )}

        {dashboardTab === 'unpaid' && (
        <>
          <UnpaidChargesLedger
            transactions={authorizedTransactions}
            onUpdateTransaction={handleUpdateTransaction}
            onAddTransaction={handleAddTransaction}
            currentUser={state.currentUser}
          />
          <BorrowKeepSection state={state} syncOwnerId={syncOwnerId} />
        </>
        )}

        {dashboardTab === 'reports' && (state.currentUser.role === 'Manager' || state.impersonatedUserId) && (
          <EmployeeOversightBoard
            currentUser={activeUser}
            registeredUsers={registeredUsers}
            transactions={state.transactions}
            posTerminals={state.posTerminals}
            activeTimeframe={state.activeTimeframe}
            selectedEmployeeFilter={state.selectedEmployeeFilter}
            onSetEmployeeFilter={(id) => dispatch({ type: 'SET_EMPLOYEE_FILTER', payload: id })}
            onEditTransaction={(tx) => setEditingTransaction(tx)}
            onViewReceipt={(tx) => setSelectedReceiptTx(tx)}
            onAddTransaction={handleAddTransaction}
            onSwitchToCashier={(userId) => dispatch({ type: 'SET_IMPERSONATED_USER', payload: userId })}
            onEditEmployee={(user) => setEditingEmployeeFromDashboard(user)}
          />
        )}

        {/* CONFIGURE & SETTINGS CONTROLS */}
        {dashboardTab === 'settings' && state.currentUser.role === 'Manager' && (
        <>
          {state.currentUser.role === 'Manager' && (
            <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#00B87A]" /> Manager: View Transactions For
                </span>
                <p className="text-[11px] text-neutral-500 font-medium">Filter the dashboard to view transactions from a specific operator or all operators.</p>
              </div>
              
              <select
                value={state.selectedEmployeeFilter}
                onChange={(e) => dispatch({ type: 'SET_EMPLOYEE_FILTER', payload: e.target.value })}
                className="px-3.5 py-2 bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs font-bold rounded-xl focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A]"
              >
                <option value="ALL">All Operators & Managers</option>
                {registeredUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Shift Control Card */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#00B87A]" /> Shift & Employee Access
              </span>
              <p className="text-[11px] text-neutral-500 font-medium">Switch the active shift operator, change terminal PIN keys, or register new employees.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-5 py-2 bg-[#00B87A] hover:bg-[#00a36c] text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer transition active:scale-95 flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 stroke-[2.2]" />
              Manage Shift Profile
            </button>
          </div>

          {/* Revert Sandbox Seed Records */}
          <div className="bg-white border border-neutral-200 p-4 rounded-3xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-red-500" /> Revert Sandbox Seed Records
              </span>
              <p className="text-[11px] text-neutral-500 font-medium">Reset custom employee logs and restore baseline diagnostic transaction receipts.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm('Clear custom employee logs and restore baseline diagnostic records?')) {
                  dispatch({ type: 'RESET_DATA' });
                }
              }}
              className="px-5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-250 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition active:scale-95"
            >
              Reset Terminal Data
            </button>
          </div>
        </>
        )}

        {/* 8. TIMEFRAME HIGHLIGHT PILLED TABS */}
        {dashboardTab === 'pos' && (
        <>
          <div className="flex bg-white border border-neutral-200 p-1.5 rounded-2xl shadow-sm">
            {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map((period) => {
              const isActive = state.activeTimeframe === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => dispatch({ type: 'SET_TIMEFRAME', payload: period })}
                  className={`flex-1 text-center py-2 rounded-xl text-xs font-extrabold font-mono transition duration-155 cursor-pointer ${
                    isActive 
                      ? 'bg-[#00B87A] text-white shadow-md' 
                      : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50'
                  }`}
                >
                  {period === 'Daily' && '☀️ '}
                  {period === 'Weekly' && '📅 '}
                  {period === 'Monthly' && '🗓️ '}
                  {period === 'Yearly' && '📊 '}
                  {period}
                </button>
              );
            })}
          </div>

          {/* 9. OPAY SECTOR MATRIX METRICS */}
          {activeUser.role === 'Manager' && managerDailyStats && (
            <>
              <ManagerAggregatedStats 
                transactions={state.transactions}
                registeredUsers={registeredUsers}
              />
              <RealizedGainHistory stats={summaryOverviews} />
            </>
          )}
          <MetricCards
            profit={activeMetrics.profit}
            volume={activeMetrics.volume}
            totalExpenses={(activeMetrics.terminalFees + (activeMetrics.cbnCharges || 0)) + state.expenses.filter(e => {
              const d = new Date(e.timestamp);
              const now = new Date();
              if (state.activeTimeframe === 'Daily') return isSameDay(d, now);
              if (state.activeTimeframe === 'Weekly') return isSameWeek(d, now);
              if (state.activeTimeframe === 'Monthly') return isSameMonth(d, now);
              return isSameYear(d, now);
            }).reduce((acc, e) => acc + e.amount, 0)}
            count={activeMetrics.count}
            averageTxSize={activeMetrics.averageTxSize}
            timeframe={state.activeTimeframe}
            dailyTarget={state.dailyTarget}
            onSetDailyTarget={(val) => dispatch({ type: 'SET_DAILY_TARGET', payload: val })}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            isManager={activeUser.role === 'Manager'}
            language={state.settings?.language || 'en'}
          />
        </>
        )}

        {/* REPORTS & ANALYTICS DATA VISUALIZATIONS */}
        {dashboardTab === 'reports' && (
        <>
          {/* 10. RECALCULATED MATRIX OVERVIEWS - TIGHT 4-GRID COLUMN FOR COMPARISONS */}
          <BreakdownTable 
            daily={summaryOverviews.daily}
            weekly={summaryOverviews.weekly}
            monthly={summaryOverviews.monthly}
            yearly={summaryOverviews.yearly}
            allTime={summaryOverviews.allTime}
            totalAllTimeCount={authorizedTransactions.length}
          />

          {/* 11. OPAY PROVIDER BREAKDOWN CHART */}
          <ProviderBreakdown 
            transactions={authorizedTransactions} 
            terminalFeeRate={state.terminalFeeRate}
          />

          {/* 12. DYNAMIC TREND ANALYTICS */}
          <TrendChart 
            transactions={authorizedTransactions}
            terminalFeeRate={state.terminalFeeRate}
            chartStyle={state.settings?.chartStyle}
          />
        </>
        )}

        {/* 13. CORE REGISTRATIONS TRANSACTION JOURNAL */}
        {dashboardTab === 'pos' && (
        <div ref={historySectionRef}>
          <TransactionList
            currentUser={state.currentUser}
            transactions={authorizedTransactions}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={setEditingTransaction}
            onViewReceipt={setSelectedReceiptTx}
            onUpdateTransaction={handleUpdateTransaction}
            onBulkDeleteTransactions={handleBulkDeleteTransactions}
            onBulkUpdateTransactions={handleBulkUpdateTransactions}
            settings={state.settings}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
          />
        </div>
        )}

      </main>

      {/* 15. PERSISTENT FLOATING BOTTOM NAV BAR - EXTREMELY HIGH FIDELITY TO OPAY FOR MOBILE & DESKTOP DOCK */}
      <footer className="fixed bottom-0 left-0 right-0 z-45 bg-white border-t border-neutral-200 py-2 shadow-lg">
        <div className="max-w-md mx-auto px-4 flex items-center justify-between text-center select-none text-[10px] text-neutral-400 font-bold">
          
          <button 
            type="button"
            onClick={() => alert("Already viewing OPay Manager Home screen")}
            className="flex-1 flex flex-col items-center gap-1 text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
          >
            <Smartphone className="w-5 h-5 text-[#00B87A]" />
            <span>Home</span>
          </button>
          
          <button 
            type="button"
            onClick={() => openWithPreset('Withdrawal')}
            className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
          >
            <ArrowDownToLine className="w-5 h-5" />
            <span>Cashout</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setPreselectedFormType('Withdrawal');
            }}
            className="relative -top-6 bg-gradient-to-tr from-[#00b87a] to-emerald-400 text-white rounded-full p-3.5 shadow-xl transition-transform active:scale-95 cursor-pointer border-4 border-neutral-100 shrink-0"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          <button 
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
            title="View and Edit My Profile"
          >
            <UserIcon className="w-5 h-5" />
            <span>Profile</span>
          </button>
          
          <button 
            type="button"
            onClick={() => scrollToRef(historySectionRef)}
            className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Journals</span>
          </button>

          {activeUser.role === 'Manager' && (
            <button 
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex-1 flex flex-col items-center gap-1 hover:text-[#00B87A] transition-transform duration-75 active:scale-95 cursor-pointer"
              title="Branding, Fee and Terminal Settings"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          )}



        </div>
      </footer>

      {/* 16. DETAILED TRANSACTION DIALOG FORM modal */}
      {isAddModalOpen && (
        <TransactionForm
          currentUser={state.currentUser}
          availableEmployees={availableEmployees}
          terminalFeeRate={state.terminalFeeRate}
          initialType={preselectedFormType}
          onSave={(tx) => {
            if (Array.isArray(tx)) {
              tx.forEach(t => handleAddTransaction(t));
            } else {
              handleAddTransaction(tx);
            }
            setIsAddModalOpen(false);
          }}
          onClose={() => setIsAddModalOpen(false)}
          settings={state.settings}
          posTerminals={state.posTerminals}
        />
      )}

      {editingTransaction && (
        <TransactionForm
          currentUser={state.currentUser}
          availableEmployees={availableEmployees}
          terminalFeeRate={state.terminalFeeRate}
          initialTransaction={editingTransaction}
          onSave={(tx) => {
            if (Array.isArray(tx)) {
              tx.forEach(t => handleUpdateTransaction(t));
            } else {
              handleUpdateTransaction(tx as Transaction);
            }
            setEditingTransaction(null);
          }}
          onClose={() => setEditingTransaction(null)}
          settings={state.settings}
          posTerminals={state.posTerminals}
        />
      )}

      {isProfileModalOpen && (
        <ProfileModal
          currentUser={activeUser}
          registeredUsers={registeredUsers}
          transactions={state.transactions}
          onRegisterUser={handleRegisterUser}
          onUpdateUserPin={handleUpdateUserPin}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onSwitchUser={(user) => {
            dispatch({ type: 'SWITCH_USER', payload: user });
          }}
          onClose={() => setIsProfileModalOpen(false)}
          onLogout={handleLockTerminal}
        />
      )}

      {isShiftModalOpen && state.currentUser.role === 'Manager' && (
        <ShiftControlModal
          isOpen={isShiftModalOpen}
          onClose={() => setIsShiftModalOpen(false)}
          currentUser={state.currentUser}
          registeredUsers={registeredUsers}
          currentShiftStats={currentShiftStats}
          onSwitchUser={(user) => {
            dispatch({ type: 'SWITCH_USER', payload: user });
          }}
          onOpenStaffDirectory={() => {
            setIsProfileModalOpen(true);
          }}
          onLogout={handleLockTerminal}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          settings={state.settings!}
          terminalFeeRate={state.terminalFeeRate}
          dailyTarget={state.dailyTarget}
          onUpdateSettings={(newSettings) => {
            dispatch({ type: 'UPDATE_SETTINGS', payload: newSettings });
          }}
          onUpdateTerminalRate={(rate) => {
            dispatch({ type: 'SET_TERMINAL_RATE', payload: rate });
          }}
          onUpdateDailyTarget={(target) => {
            dispatch({ type: 'SET_DAILY_TARGET', payload: target });
          }}
          onResetDatabase={() => {
            dispatch({ type: 'RESET_DATA' });
          }}
          onClearLocalCache={() => {
            localStorage.clear();
          }}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}

      {editingEmployeeFromDashboard && (
        <EditEmployeeModal
          employee={editingEmployeeFromDashboard}
          onUpdateUser={(updated) => {
            handleUpdateUser(updated);
            setEditingEmployeeFromDashboard(null);
          }}
          onClose={() => setEditingEmployeeFromDashboard(null)}
        />
      )}

      {/* 17. HIGH-FIDELITY DIGITAL E-RECEIPT MODAL (Tailored for OPay, Moniepoint, PalmPay) */}
      {selectedReceiptTx && (() => {
        const provider = selectedReceiptTx.provider;
        const providerTxId = getProviderTransactionNumber(selectedReceiptTx);
        
        // Compute provider-specific sequential serial number
        const providerTxs = state.transactions.filter(t => t.provider === provider);
        const providerIndex = providerTxs.indexOf(selectedReceiptTx);
        const providerSerialNumber = providerTxs.length - providerIndex;

        // Custom theme configurations for dynamic provider branding
        let bgHeader = 'bg-[#00B87A]'; // OPay Green
        let textHeader = 'text-white';
        let circleBg = 'bg-white';
        let circleText = 'text-[#00B87A]';
        let brandChar = 'O';
        let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-100';
        let indicatorColor = 'bg-emerald-500 animate-pulse';
        let slipTitle = 'OPay E-Receipt Slip';
        let transactionLabel = 'Session ID (OPay)';
        let accentText = 'text-[#00B87A]';
        let buttonBg = 'bg-[#00B87A] hover:bg-[#00a36c]';
        let containerBorder = 'border-emerald-100';

        if (provider === 'Moniepoint') {
          bgHeader = 'bg-[#0F3B8C]'; // Moniepoint Navy Blue
          circleText = 'text-[#0F3B8C]';
          brandChar = 'M';
          badgeColor = 'bg-blue-50 text-blue-700 border-blue-100';
          indicatorColor = 'bg-blue-600 animate-pulse';
          slipTitle = 'Moniepoint E-Receipt';
          transactionLabel = 'Control Reference No';
          accentText = 'text-blue-600';
          buttonBg = 'bg-[#0F3B8C] hover:bg-[#0d3175]';
          containerBorder = 'border-blue-150';
        } else if (provider === 'PalmPay') {
          bgHeader = 'bg-purple-900'; // PalmPay Deep Purple
          circleText = 'text-purple-900';
          brandChar = 'P';
          badgeColor = 'bg-orange-50 text-orange-750 border-orange-100';
          indicatorColor = 'bg-orange-500 animate-pulse';
          slipTitle = 'PalmPay Certified Slip';
          transactionLabel = 'PalmPay Bill Ref';
          accentText = 'text-orange-600';
          buttonBg = 'bg-orange-600 hover:bg-orange-700';
          containerBorder = 'border-purple-150';
        }

        return (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh]">
              {/* Header branding band with Provider standard color */}
              <div className={`${bgHeader} text-white px-5 py-4 flex justify-between items-center shrink-0 transition-colors duration-300`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full bg-white ${circleText} flex items-center justify-center font-black text-sm select-none`}>
                    {brandChar}
                  </div>
                  <span className="font-extrabold text-sm tracking-tight">{slipTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptTx(null)}
                  className="p-1 hover:bg-white/10 rounded-full transition text-white/90 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt Thermal Scroll Structure */}
              <div className="overflow-y-auto p-6 space-y-6 flex-grow bg-neutral-50/50">
                
                {/* Receipt Head */}
                <div className="text-center space-y-1">
                  <h3 className="text-lg font-black text-neutral-800 tracking-tight">
                    {state.settings?.businessName || `${provider} Agent Outlet`}
                  </h3>
                  {state.settings?.receiptAddress && (
                    <p className="text-[9px] text-neutral-500 font-medium leading-tight">
                      {state.settings.receiptAddress}
                    </p>
                  )}
                  {state.settings?.receiptPhone && (
                    <p className="text-[9px] text-neutral-400 font-mono">
                      Tel: {state.settings.receiptPhone}
                    </p>
                  )}
                  <p className="text-[10px] font-mono font-medium text-neutral-400 mt-1">OFFICIAL TRANSACTION RECORD</p>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 ${badgeColor} border rounded-full text-[10px] font-extrabold font-mono uppercase mt-2 select-none`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${indicatorColor}`} /> Successful
                  </div>
                </div>

                {/* Bounded Receipt Specs */}
                <div className="bg-white border border-neutral-200/70 p-4 rounded-2xl shadow-sm font-mono text-xs space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">{transactionLabel}</span>
                    <div className="flex items-center gap-1.5 text-right">
                      <span className="font-black text-neutral-800 select-all">{providerTxId}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(providerTxId);
                          setCopiedTxId(providerTxId);
                          setTimeout(() => setCopiedTxId(null), 2000);
                        }}
                        className="p-1 hover:bg-neutral-100 rounded text-neutral-400 hover:text-neutral-600 transition flex items-center justify-center"
                        title="Copy transaction ID"
                      >
                        {copiedTxId === providerTxId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Receipt No.</span>
                    <span className="text-neutral-800 font-extrabold text-right">
                      {provider === 'OPay' ? 'OP' : provider === 'Moniepoint' ? 'MP' : 'PP'}-{providerSerialNumber}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Timestamp</span>
                    <span className="text-neutral-800 font-extrabold text-right">
                      {new Date(selectedReceiptTx.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Operator Shift</span>
                    <span className="text-neutral-800 font-extrabold text-right">{selectedReceiptTx.employeeName}</span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Category</span>
                    <span className={`font-black text-right ${
                      selectedReceiptTx.type === 'Withdrawal' 
                        ? 'text-orange-600' 
                        : selectedReceiptTx.type === 'Deposit' 
                          ? 'text-blue-600' 
                          : 'text-[#00B87A]'
                    }`}>
                      {selectedReceiptTx.type}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                    <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">POS Gateway</span>
                    <span className="text-neutral-800 font-extrabold text-right uppercase">{selectedReceiptTx.provider}</span>
                  </div>

                  {selectedReceiptTx.subType && (
                    <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between">
                      <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Sub-Channel</span>
                      <span className="text-neutral-800 font-extrabold text-right">
                        {selectedReceiptTx.subType === 'SameBank' ? `${provider} Native` : 'Other Banks'}
                      </span>
                    </div>
                  )}

                  <div className="border-t border-neutral-200 pt-3 flex justify-between items-center text-sm">
                    <span className="text-neutral-500 font-sans font-bold">Transaction Amount</span>
                    <span className="font-extrabold text-neutral-900 font-mono text-base">
                      {formatNaira(selectedReceiptTx.amount)}
                    </span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400 uppercase font-bold tracking-wider">Cut Charged</span>
                    <span className={`font-extrabold ${accentText}`}>{formatNaira(selectedReceiptTx.customerFee)}</span>
                  </div>

                  <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between items-center text-[11px]">
                    <span className="text-neutral-400 uppercase font-bold tracking-wider">Terminal Base Cost</span>
                    <span className="font-extrabold text-red-500">-{formatNaira(selectedReceiptTx.terminalFee)}</span>
                  </div>

                  {selectedReceiptTx.cbnCharge && selectedReceiptTx.cbnCharge > 0 ? (
                    <div className="border-t border-dashed border-neutral-200 pt-2.5 flex justify-between items-center text-[11px]">
                      <span className="text-neutral-400 uppercase font-bold tracking-wider">CBN EMTL Levy</span>
                      <span className="font-extrabold text-red-500">-{formatNaira(selectedReceiptTx.cbnCharge)}</span>
                    </div>
                  ) : null}

                  <div className="border-t border-neutral-200 pt-3 flex justify-between items-center text-sm bg-neutral-50 -mx-4 -mb-4 p-4 rounded-b-2xl">
                    <span className="text-neutral-800 font-sans font-black">Net Earnings Gain</span>
                    <span className={`font-black ${accentText} font-mono text-sm sm:text-base`}>
                      {formatNaira(selectedReceiptTx.profit)}
                    </span>
                  </div>
                </div>

                {/* Notes block if present */}
                {selectedReceiptTx.notes && (
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1">
                    <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-amber-700">Audit Notes</span>
                    <p className="text-xs text-neutral-700 font-semibold leading-relaxed italic">
                      "{selectedReceiptTx.notes}"
                    </p>
                  </div>
                )}

                {/* Custom Branded Footer Note */}
                {state.settings?.receiptFooter && (
                  <p className={`text-[9.5px] ${accentText} font-bold leading-normal text-center bg-neutral-50 p-2.5 rounded-xl border border-dashed border-neutral-200`}>
                    {state.settings.receiptFooter}
                  </p>
                )}

                {/* Safety notice disclaimer */}
                <p className="text-[9px] text-neutral-400 font-mono font-bold leading-normal text-center bg-neutral-100 p-2.5 rounded-xl border border-neutral-200/50">
                  This transaction record is locked securely. To correct discrepancies, consult with shift managers.
                </p>

              </div>

              {/* Footer Buttons Actions */}
              <div className="bg-neutral-100 border-t border-neutral-200 p-4 px-5 flex gap-3 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    alert(`Executing thermal print simulation: ${provider} receipt slip has been dispatched to Bluetooth hardware device.`);
                  }}
                  className={`flex-1 py-3 ${buttonBg} text-white rounded-2xl text-xs font-black transition cursor-pointer active:scale-95 text-center shadow-md`}
                >
                  Print Slip
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptTx(null)}
                  className="flex-1 py-3 bg-white hover:bg-neutral-50 border border-neutral-250 text-neutral-600 rounded-2xl text-xs font-bold transition cursor-pointer active:scale-95 text-center"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 18. MANAGER SIGN IN & AUTHENTICATION MODAL */}
      {isCloudSyncFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden shadow-2xl border border-neutral-200 flex flex-col max-h-[90vh] animate-fade-in">
            
            {/* Header */}
            <div className="bg-[#00B87A] text-white px-5 py-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white text-[#00B87A] flex items-center justify-center font-black text-sm select-none">
                  O
                </div>
                <span className="font-extrabold text-sm tracking-tight">Manager Authentication</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCloudSyncFormOpen(false);
                  setCloudFormError('');
                  setCloudFormSuccessMessage('');
                }}
                className="p-1 hover:bg-white/10 rounded-full transition text-white/90 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Forms body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-grow selection:bg-emerald-200">
              
              {/* Tab Selector */}
              <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                <button
                  type="button"
                  onClick={() => {
                    setCloudFormTab('signin');
                    setCloudFormError('');
                    setCloudFormSuccessMessage('');
                  }}
                  className={`flex-grow flex-1 text-center py-2 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                    cloudFormTab === 'signin'
                      ? 'bg-white text-[#00B87A] shadow-sm font-black'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCloudFormTab('employee_signin');
                    setCloudFormError('');
                    setCloudFormSuccessMessage('');
                  }}
                  className={`flex-grow flex-1 text-center py-2 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                    cloudFormTab === 'employee_signin'
                      ? 'bg-white text-[#00B87A] shadow-sm font-black'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCloudFormTab('signup');
                    setCloudFormError('');
                    setCloudFormSuccessMessage('');
                  }}
                  className={`flex-grow flex-1 text-center py-2 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                    cloudFormTab === 'signup'
                      ? 'bg-white text-[#00B87A] shadow-sm font-black'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCloudFormTab('forgot');
                    setCloudFormError('');
                    setCloudFormSuccessMessage('');
                  }}
                  className={`flex-grow flex-1 text-center py-2 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                    cloudFormTab === 'forgot'
                      ? 'bg-white text-[#00B87A] shadow-sm font-black'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  Forgot
                </button>
              </div>

              <div className="text-xs text-neutral-500 text-center px-1 leading-relaxed">
                {cloudFormTab === 'signin' && 'Sign in to access your synchronized OPay manager profile and employee logs.'}
                {cloudFormTab === 'employee_signin' && 'Employees: Please enter your personal secure email and passcode assigned by your manager.'}
                {cloudFormTab === 'signup' && 'Create a manager profile to securely persist and safeguard your transactions.'}
                {cloudFormTab === 'forgot' && 'Enter your registered email below to receive a secure password reset link.'}
              </div>

              {/* Status or error/success bar */}
              {cloudFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-[11px] text-red-650 font-semibold leading-relaxed flex items-center gap-2 animate-fade-in">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>{cloudFormError}</span>
                </div>
              )}
              {cloudFormSuccessMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-[#00B87A] font-semibold leading-relaxed flex items-center gap-2 animate-fade-in">
                  <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[#00B87A] animate-pulse" />
                  <span>{cloudFormSuccessMessage}</span>
                </div>
              )}

              {/* Form elements */}
              <form onSubmit={handleCloudFormSubmit} className="space-y-3.5">
                {cloudFormTab === 'signup' && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                        Business or Manager Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. OPay Cash Office"
                        value={cloudBusinessName}
                        onChange={(e) => setCloudBusinessName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-[#00B87A] focus:bg-white focus:outline-none transition duration-150"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                        Referral Code (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter manager referral code"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-[#00B87A] focus:bg-white focus:outline-none transition duration-150"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    {cloudFormTab === 'employee_signin' ? 'Employee Email Address' : 'Email Address'}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder={cloudFormTab === 'employee_signin' ? 'e.g. Joy.Okafor@opayweb.com' : 'manager@opayweb.com'}
                    value={cloudEmail}
                    onChange={(e) => setCloudEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-[#00B87A] focus:bg-white focus:outline-none transition duration-150"
                  />
                </div>

                {cloudFormTab !== 'forgot' && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 6 characters"
                      value={cloudPassword}
                      onChange={(e) => setCloudPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs font-bold text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-[#00B87A] focus:bg-white focus:outline-none transition duration-150"
                    />
                  </div>
                )}

                {cloudFormTab === 'signin' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setCloudFormTab('forgot');
                        setCloudFormError('');
                        setCloudFormSuccessMessage('');
                      }}
                      className="text-[11px] text-[#00B87A] hover:underline font-bold transition cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={cloudFormLoading}
                    className="w-full py-3 bg-[#00B87A] hover:bg-[#00a36c] disabled:bg-neutral-300 text-white font-black rounded-2xl text-xs tracking-wide transition duration-150 active:scale-[0.98] cursor-pointer shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5"
                  >
                    {cloudFormLoading ? 'Verifying...' : 
                      cloudFormTab === 'signin' ? 'Sign In' : 
                      cloudFormTab === 'employee_signin' ? 'Sign In as Employee' :
                      cloudFormTab === 'signup' ? 'Create Account' : 'Send Reset Link'
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isReconCalcOpen && (
        <CashierReconciliationCalculator 
          onClose={() => setIsReconCalcOpen(false)}
          onSave={(data) => {
            showAppNotification('Profit Calculation saved successfully.', 'success');
          }}
        />
      )}

      {appNotification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] animate-fade-in flex items-center justify-center pointer-events-none">
          <div className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            appNotification.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            appNotification.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-700' :
            'bg-[#00B87A]/10 border-[#00B87A]/30 text-[#00B87A]'
          }`}>
            <p className="text-sm font-bold tracking-tight">{appNotification.message}</p>
          </div>
        </div>
      )}

    </div>
  );
}
