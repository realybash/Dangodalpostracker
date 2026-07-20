/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, TransactionType, ProviderType, User, AppSettings, SubTransfer, PosTerminal } from '../types';
import { calculateTerminalFee, calculateCBNCharge, generateId, formatNaira, getRecommendedAgentFee, getCalculatedFinancials, getDefaultPricingProfiles, getBusinessDate } from '../utils';
import { AudioRecorder } from './AudioRecorder';
import { X, Sparkles, Check, Info, Mic, MicOff, Plus, PlusCircle, Trash2, Lock, Unlock, ShieldCheck, AlertTriangle, CreditCard, Smartphone, ArrowRightLeft, Wallet, Landmark, PieChart, Search, Globe, Wifi, Banknote, Building2, UserCircle, Download, ArrowUpRight, Cpu, Zap, Receipt } from 'lucide-react';

// @ts-ignore
import moniepointPosImg from '../assets/images/moniepoint_pos_1784102666214.jpg';
// @ts-ignore
import opayPosImg from '../assets/images/opay_pos_1784102682058.jpg';
// @ts-ignore
import palmpayPosImg from '../assets/images/palmpay_pos_1784102696111.jpg';

// Synthesize premium, zero-dependency audible alert triggers using browser's native Web Audio API
export const playStatusSound = (status: 'Success' | 'Pending' | 'Failed') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (status === 'Success') {
      // Modern dual-tone high-fidelity financial success chime (C5 -> G5)
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, now + 0.1); // G5
      gain2.gain.setValueAtTime(0.12, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.35);
    } else if (status === 'Pending') {
      // Pleasant subtle mid-tone dual soft clicking/tap trigger for pending state
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now); // A4
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (status === 'Failed') {
      // Low-frequency cautionary buzz/warning tone (descending sawtooth frequency + triangle)
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(140, now);
      osc1.frequency.linearRampToValueAtTime(80, now + 0.35); // Descending pitch
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.37);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.37);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(133, now); // Slightly dissonant frequency
      gain2.gain.setValueAtTime(0.1, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.3);
    }
  } catch (e) {
    console.warn("Web Audio API warning: context was blocked or not supported", e);
  }
};

export const BANK_OPTIONS = [
  { id: 'Moniepoint', title: 'Moniepoint', abbrev: 'MPN', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-600 border-blue-600 text-white shadow-sm', logoBg: 'bg-blue-600 text-white' },
  { id: 'OPay', title: 'OPay', abbrev: 'OPY', color: 'border-emerald-100 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-[#00B87A] border-[#00B87A] text-white shadow-sm', logoBg: 'bg-[#00B87A] text-white' },
  { id: 'PalmPay', title: 'PalmPay', abbrev: 'PAL', color: 'border-orange-100 text-orange-800 bg-white hover:bg-orange-50', activeColor: 'bg-orange-500 border-orange-500 text-white shadow-sm', logoBg: 'bg-orange-500 text-white' },
  { id: 'Access Bank', title: 'Access Bank', abbrev: 'ACC', color: 'border-orange-100 text-orange-800 bg-white hover:bg-orange-50', activeColor: 'bg-orange-600 border-orange-600 text-white shadow-sm', logoBg: 'bg-orange-600 text-white' },
  { id: 'GTBank', title: 'GTBank', abbrev: 'GTB', color: 'border-amber-100 text-amber-800 bg-white hover:bg-amber-50', activeColor: 'bg-amber-600 border-amber-600 text-white shadow-sm', logoBg: 'bg-amber-600 text-white' },
  { id: 'Zenith Bank', title: 'Zenith Bank', abbrev: 'ZEN', color: 'border-red-100 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-600 border-red-600 text-white shadow-sm', logoBg: 'bg-red-600 text-white' },
  { id: 'UBA', title: 'UBA', abbrev: 'UBA', color: 'border-red-100 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-700 border-red-700 text-white shadow-sm', logoBg: 'bg-red-700 text-white' },
  { id: 'First Bank', title: 'First Bank', abbrev: 'FBN', color: 'border-yellow-100 text-yellow-800 bg-white hover:bg-yellow-50', activeColor: 'bg-amber-700 border-amber-700 text-white shadow-sm', logoBg: 'bg-amber-700 text-white' },
  { id: 'Union Bank', title: 'Union Bank', abbrev: 'UBN', color: 'border-sky-100 text-sky-800 bg-white hover:bg-sky-50', activeColor: 'bg-sky-500 border-sky-500 text-white shadow-sm', logoBg: 'bg-sky-500 text-white' },
  { id: 'Fidelity Bank', title: 'Fidelity Bank', abbrev: 'FID', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-800 border-blue-800 text-white shadow-sm', logoBg: 'bg-blue-800 text-white' },
  { id: 'Sterling Bank', title: 'Sterling Bank', abbrev: 'STB', color: 'border-red-100 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-500 border-red-500 text-white shadow-sm', logoBg: 'bg-red-500 text-white' },
  { id: 'Wema Bank', title: 'Wema Bank', abbrev: 'WEM', color: 'border-purple-100 text-purple-800 bg-white hover:bg-purple-50', activeColor: 'bg-purple-600 border-purple-600 text-white shadow-sm', logoBg: 'bg-purple-600 text-white' },
  { id: 'Stanbic IBTC', title: 'Stanbic IBTC', abbrev: 'SIB', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-700 border-blue-700 text-white shadow-sm', logoBg: 'bg-blue-700 text-white' },
  { id: 'EcoBank', title: 'EcoBank', abbrev: 'ECO', color: 'border-teal-100 text-teal-800 bg-white hover:bg-teal-50', activeColor: 'bg-teal-600 border-teal-600 text-white shadow-sm', logoBg: 'bg-teal-600 text-white' },
  { id: 'FCMB', title: 'FCMB', abbrev: 'FCM', color: 'border-fuchsia-100 text-fuchsia-800 bg-white hover:bg-fuchsia-50', activeColor: 'bg-fuchsia-700 border-fuchsia-700 text-white shadow-sm', logoBg: 'bg-fuchsia-700 text-white' },
  { id: 'Kuda Bank', title: 'Kuda Bank', abbrev: 'KUD', color: 'border-emerald-100 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-emerald-950 border-emerald-950 text-white shadow-sm', logoBg: 'bg-emerald-950 text-white' },
  { id: 'Keystone Bank', title: 'Keystone Bank', abbrev: 'KEY', color: 'border-blue-100 text-blue-800 bg-white hover:bg-blue-50', activeColor: 'bg-blue-900 border-blue-900 text-white shadow-sm', logoBg: 'bg-blue-900 text-white' },
  { id: 'Polaris Bank', title: 'Polaris Bank', abbrev: 'POL', color: 'border-indigo-100 text-indigo-800 bg-white hover:bg-indigo-50', activeColor: 'bg-indigo-900 border-indigo-900 text-white shadow-sm', logoBg: 'bg-indigo-900 text-white' },
  { id: 'Providus Bank', title: 'Providus Bank', abbrev: 'PRV', color: 'border-yellow-100 text-yellow-800 bg-white hover:bg-yellow-50', activeColor: 'bg-yellow-600 border-yellow-600 text-white shadow-sm', logoBg: 'bg-yellow-600 text-white' },
  { id: 'Jaiz Bank', title: 'Jaiz Bank', abbrev: 'JAI', color: 'border-green-100 text-green-800 bg-white hover:bg-green-50', activeColor: 'bg-green-700 border-green-700 text-white shadow-sm', logoBg: 'bg-green-700 text-white' },
  { id: 'Taj Bank', title: 'Taj Bank', abbrev: 'TAJ', color: 'border-emerald-100 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-emerald-800 border-emerald-800 text-white shadow-sm', logoBg: 'bg-emerald-800 text-white' },
  { id: 'Nomba', title: 'Nomba', abbrev: 'NOM', color: 'border-zinc-100 text-zinc-800 bg-white hover:bg-zinc-50', activeColor: 'bg-zinc-800 border-zinc-800 text-white shadow-sm', logoBg: 'bg-zinc-800 text-white' },
  { id: 'Others', title: 'Others', abbrev: 'OTH', color: 'border-neutral-100 text-neutral-800 bg-white hover:bg-neutral-50', activeColor: 'bg-neutral-700 border-neutral-700 text-white shadow-sm', logoBg: 'bg-neutral-700 text-white' }
];

export const DATA_PLANS: Record<string, { name: string; price: number }[]> = {
  MTN: [
    { name: '100MB (1-Day)', price: 100 },
    { name: '1.5GB (30-Day)', price: 1200 },
    { name: '2GB (30-Day)', price: 1500 },
    { name: '3GB (30-Day)', price: 2000 },
    { name: '5GB (30-Day)', price: 3000 },
    { name: '10GB (30-Day)', price: 5000 },
    { name: '20GB (30-Day)', price: 8000 }
  ],
  Airtel: [
    { name: '100MB (1-Day)', price: 100 },
    { name: '1.5GB (30-Day)', price: 1200 },
    { name: '2GB (30-Day)', price: 1500 },
    { name: '3GB (30-Day)', price: 2000 },
    { name: '5GB (30-Day)', price: 3000 },
    { name: '10GB (30-Day)', price: 5000 },
    { name: '20GB (30-Day)', price: 8000 }
  ],
  Glo: [
    { name: '150MB (1-Day)', price: 100 },
    { name: '1.9GB (30-Day)', price: 1000 },
    { name: '3.5GB (30-Day)', price: 1500 },
    { name: '5.2GB (30-Day)', price: 2000 },
    { name: '10.8GB (30-Day)', price: 3000 },
    { name: '15.6GB (30-Day)', price: 4000 },
    { name: '32.5GB (30-Day)', price: 8000 }
  ],
  '9mobile': [
    { name: '100MB (1-Day)', price: 100 },
    { name: '1.5GB (30-Day)', price: 1200 },
    { name: '2GB (30-Day)', price: 1500 },
    { name: '3GB (30-Day)', price: 2000 },
    { name: '5GB (30-Day)', price: 3000 },
    { name: '10GB (30-Day)', price: 5000 },
    { name: '20GB (30-Day)', price: 8000 }
  ]
};

interface TransactionFormProps {
  currentUser: User;
  availableEmployees: User[];
  terminalFeeRate: number;
  onSave: (newTx: Transaction | Transaction[]) => void;
  onClose: () => void;
  initialType?: TransactionType;
  initialMode?: 'Standard' | 'SplitSession';
  initialTransaction?: Transaction;
  settings?: AppSettings;
  posTerminals?: PosTerminal[];
}

export function TransactionForm({
  currentUser,
  availableEmployees,
  terminalFeeRate,
  onSave,
  onClose,
  initialType,
  initialMode = 'Standard',
  initialTransaction,
  settings,
  posTerminals
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(
    initialTransaction ? initialTransaction.type : (initialType || settings?.defaultType || 'Withdrawal')
  );
  const [provider, setProvider] = useState<ProviderType>(
    initialTransaction ? initialTransaction.provider : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'Card' | 'Transfer'>(
    initialTransaction ? (initialTransaction.paymentMethod || 'Card') : 'Card'
  );
  const [subType, setSubType] = useState<'SameBank' | 'OtherBank'>('OtherBank');
  const [destinationBank, setDestinationBank] = useState<ProviderType>('OPay');
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [amount, setAmount] = useState<number>(
    initialTransaction ? initialTransaction.amount : 0
  );
  const [customerFee, setCustomerFee] = useState<number>(
    initialTransaction ? initialTransaction.customerFee : 0
  );
  const [employeeId, setEmployeeId] = useState<string>(
    initialTransaction ? initialTransaction.employeeId : currentUser.id
  );
  const [notes, setNotes] = useState<string>(
    initialTransaction ? (initialTransaction.notes || '') : ''
  );
  const [selectedPlanName, setSelectedPlanName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>(
    initialTransaction ? (initialTransaction.customerPhone || '') : ''
  );
  const [audioNote, setAudioNote] = useState<string>(
    initialTransaction ? (initialTransaction.audioNote || '') : ''
  );
  const [customTimestamp, setCustomTimestamp] = useState<string>(
    initialTransaction ? initialTransaction.timestamp : new Date().toISOString()
  );

  const toLocalDatetimeString = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return '';
      const tzOffset = d.getTimezoneOffset() * 60000;
      const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      return localISOTime;
    } catch (e) {
      return '';
    }
  };

  const toISOStringFromLocal = (localValue: string) => {
    try {
      if (!localValue) return new Date().toISOString();
      const d = new Date(localValue);
      if (isNaN(d.getTime())) return new Date().toISOString();
      return d.toISOString();
    } catch (e) {
      return new Date().toISOString();
    }
  };
  const [status, setStatus] = useState<'Success' | 'Pending' | 'Failed'>(
    initialTransaction ? initialTransaction.status : 'Success'
  );
  const [feeMethod, setFeeMethod] = useState<'CardDebit' | 'Cash'>(
    initialTransaction?.feeMethod || 'Cash'
  );
  const [withdrawChargeMode, setWithdrawChargeMode] = useState<'CardAddOn' | 'SeparateCash' | 'DeductFromCash'>(() => {
    if (initialTransaction?.feeMethod === 'CardDebit') return 'CardAddOn';
    if (initialTransaction?.notes?.includes('(Deduct charges from Cash)')) return 'DeductFromCash';
    return 'SeparateCash';
  });

  const [withdrawScenario, setWithdrawScenario] = useState<'CashHandout' | 'CardSwipe'>('CashHandout');

  useEffect(() => {
    if (type === 'Withdrawal' || type === 'Transfer' || type === 'Deposit' || type === 'Airtime' || type === 'Data') {
      if (provider.toLowerCase() === destinationBank.toLowerCase()) {
        setSubType('SameBank');
      } else {
        setSubType('OtherBank');
      }
    } else {
      setSubType('OtherBank');
    }
  }, [provider, destinationBank, type]);

  useEffect(() => {
    if (type === 'Withdrawal') {
      if (withdrawChargeMode === 'CardAddOn') {
        setFeeMethod('CardDebit');
      } else {
        setFeeMethod('Cash');
      }
    }
  }, [withdrawChargeMode, type]);

  const [mode, setMode] = useState<'Standard' | 'SplitSession'>(
    initialTransaction?.mode === 'SplitSession' ? 'SplitSession' : initialMode
  );
  const [sourceType, setSourceType] = useState<TransactionType>(
    initialTransaction?.sourceType || 'Withdrawal'
  );
  const [distributionType, setDistributionType] = useState<TransactionType>(
    initialTransaction?.distributionType || 'Transfer'
  );
  const [distributionProvider, setDistributionProvider] = useState<ProviderType>(
    initialTransaction?.distributionProvider || settings?.defaultProvider || 'OPay'
  );
  const [subTransfers, setSubTransfers] = useState<SubTransfer[]>(
    initialTransaction?.subTransfers || (initialMode === 'SplitSession' ? [{ recipientName: '', accountNumber: '', amount: 0 }] : [])
  );
  const [remainingBalance, setRemainingBalance] = useState<number>(
    initialTransaction?.remainingBalance || 0
  );
  const [chargesStatus, setChargesStatus] = useState<'Paid' | 'Unpaid'>(
    initialTransaction ? (initialTransaction.chargesStatus || 'Paid') : 'Paid'
  );
  const [customerName, setCustomerName] = useState<string>(
    initialTransaction ? (initialTransaction.customerName || '') : ''
  );
  const [customerAccountNumber, setCustomerAccountNumber] = useState<string>(
    initialTransaction ? (initialTransaction.customerAccountNumber || '') : ''
  );
  const [isFeeWaived, setIsFeeWaived] = useState<boolean>(
    initialTransaction ? initialTransaction.customerFee === 0 : false
  );
  const [selectedTerminalId, setSelectedTerminalId] = useState<string>(
    initialTransaction ? (initialTransaction.terminalId || '') : ''
  );
  const [terminalError, setTerminalError] = useState<boolean>(false);
  const [isNetworkLocked, setIsNetworkLocked] = useState<boolean>(false);
  const [basket, setBasket] = useState<Transaction[]>([]);

  // Unified Web Speech API Integration
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [activeDictationField, setActiveDictationField] = useState<'notes' | 'customerName' | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeFieldRef = useRef<'notes' | 'customerName' | null>(null);

  useEffect(() => {
    activeFieldRef.current = activeDictationField;
  }, [activeDictationField]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const currentField = activeFieldRef.current;
          if (currentField === 'customerName') {
            setCustomerName((prev) => {
              const trimmed = prev.trim();
              const formatted = transcript.toUpperCase(); // names are usually uppercase in this app
              return trimmed ? `${trimmed} ${formatted}` : formatted;
            });
          } else {
            setNotes((prev) => {
              const trimmed = prev.trim();
              return trimmed ? `${trimmed} ${transcript}` : transcript;
            });
          }
        }
      };

      rec.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied.');
        } else {
          setSpeechError(`Error: ${event.error}`);
        }
        setIsListening(false);
        setActiveDictationField(null);
      };

      rec.onend = () => {
        setIsListening(false);
        setActiveDictationField(null);
      };

      recognitionRef.current = rec;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const toggleListening = (field: 'notes' | 'customerName') => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      if (activeDictationField === field) {
        return;
      }
    }

    try {
      setSpeechError(null);
      setActiveDictationField(field);
      recognitionRef.current.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setIsListening(false);
      setActiveDictationField(null);
    }
  };
  
  // Custom input triggers
  const [amountInput, setAmountInput] = useState(
    initialTransaction ? initialTransaction.amount.toString() : ''
  );
  const [feeInput, setFeeInput] = useState(
    initialTransaction 
      ? (initialTransaction.chargesStatus === 'Unpaid' 
          ? (initialTransaction.unpaidFeeAmount ?? initialTransaction.customerFee).toString() 
          : initialTransaction.customerFee.toString()) 
      : ''
  );

  // Derived values for Withdrawal Calculations (Memoized for efficiency)
  const withdrawalDetails = useMemo(() => {
    const rawAmt = amount;
    const fee = customerFee;
    
    let baseCash = rawAmt;
    let cardSwipe = rawAmt;
    let cashHandout = rawAmt;
    let separateCashFee = 0;
    
    if (type === 'Withdrawal' || type === 'Money Received' || (type === 'Transfer' && mode === 'SplitSession')) {
      if (type === 'Withdrawal') {
        if (withdrawScenario === 'CashHandout') {
          baseCash = rawAmt;
          if (withdrawChargeMode === 'CardAddOn') {
            cardSwipe = rawAmt + fee;
            cashHandout = rawAmt;
          } else if (withdrawChargeMode === 'SeparateCash') {
            cardSwipe = rawAmt;
            cashHandout = rawAmt;
            separateCashFee = fee;
          } else { // DeductFromCash
            cardSwipe = rawAmt;
            cashHandout = Math.max(0, rawAmt - fee);
          }
        } else { // CardSwipe
          cardSwipe = rawAmt;
          if (withdrawChargeMode === 'CardAddOn') {
            baseCash = Math.max(0, rawAmt - fee);
            cashHandout = baseCash;
          } else if (withdrawChargeMode === 'SeparateCash') {
            baseCash = rawAmt;
            cashHandout = rawAmt;
            separateCashFee = fee;
          } else { // DeductFromCash
            baseCash = rawAmt;
            cashHandout = Math.max(0, rawAmt - fee);
          }
        }
      } else {
        // For Money Received or Transfer Inflows in Split Mode
        // We assume 'SeparateCash' or 'DeductFromCash' logic applies to service fee
        cardSwipe = 0; // Not a card transaction
        if (withdrawChargeMode === 'SeparateCash') {
          cashHandout = rawAmt;
          separateCashFee = fee;
        } else {
          cashHandout = Math.max(0, rawAmt - fee);
        }
      }
    }
    
    return { baseCash, cardSwipe, cashHandout, separateCashFee };
  }, [amount, customerFee, type, withdrawScenario, withdrawChargeMode]);

  useEffect(() => {
    if (mode === 'SplitSession') {
      const totalSubAmount = subTransfers.reduce((sum, st) => sum + st.amount, 0);
      // Remaining balance is derived from the actual physical cash available after the withdrawal
      setRemainingBalance(withdrawalDetails.cashHandout - totalSubAmount);
    } else {
      setRemainingBalance(0);
    }
  }, [withdrawalDetails.cashHandout, subTransfers, mode]);

  // Sync destination bank to provider if network is locked (Prevents Cashier Fraud/Mismatch)
  useEffect(() => {
    if (isNetworkLocked) {
      setDestinationBank(provider);
    }
  }, [provider, isNetworkLocked]);

  // Helper to format numbers with commas
  const formatNumber = (val: string): string => {
    const parts = val.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Sync state values on input change
  useEffect(() => {
    const parsedAmount = parseFloat(amountInput.replace(/,/g, ''));
    if (!isNaN(parsedAmount)) {
      setAmount(parsedAmount);
    } else {
      setAmount(0);
    }
  }, [amountInput]);

  useEffect(() => {
    const parsedFee = parseFloat(feeInput.replace(/,/g, ''));
    if (!isNaN(parsedFee)) {
      setCustomerFee(parsedFee);
      if (parsedFee > 0 && isFeeWaived) {
        setIsFeeWaived(false);
      }
    } else {
      setCustomerFee(0);
    }
  }, [feeInput, isFeeWaived]);


  // Trigger quick recommendation update
  const applyRecommendedFee = () => {
    setIsFeeWaived(false);
    const effectiveType = ((type === 'Withdrawal' || type === 'Transfer') && paymentMethod === 'Transfer') ? 'Cash Out (Transfer)' : type;
    const financials = getCalculatedFinancials(amount, effectiveType, provider, settings, destinationBank);
    setFeeInput(financials.customerCharge.toString());
    setCustomerFee(financials.customerCharge);
  };

  // Automatic fee calculation removed as requested by user.
  useEffect(() => {
    // Fee remains as manually entered.
  }, []);


  const isFirstRender = useRef(true);

  // Ensure fee is synchronized if fee is waived, but do NOT automatically overwrite fee input when typing the amount to avoid unwanted automatic charges
  useEffect(() => {
    if (initialTransaction && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }

    if (isFeeWaived) {
      setFeeInput('0');
      setCustomerFee(0);
    }
  }, [isFeeWaived, initialTransaction]);

  const getTransactionObject = (finalStatus: 'Success' | 'Failed'): Transaction => {
    const activeTerminal = posTerminals?.find(t => t.id === selectedTerminalId);
    
    // Use derived values from the dynamic Withdrawal Calculator
    const { baseCash, cardSwipe, cashHandout } = withdrawalDetails;

    const actualAmount = type === 'Withdrawal' ? cardSwipe : amount;

    const effectiveType = (type === 'Withdrawal' && paymentMethod === 'Transfer') ? 'Cash Out (Transfer)' : type;
    const financials = getCalculatedFinancials(actualAmount, effectiveType, provider, settings, destinationBank);

    // Maintain legacy compatibility while populating new fields
    const actualCustomerFee = isFeeWaived ? 0 : (chargesStatus === 'Unpaid' ? 0 : customerFee);
    const unpaidFeeAmount = chargesStatus === 'Unpaid' ? customerFee : undefined;
    
    // Adjust profit based on manual fee overrides
    // We do NOT want waived transactions to reduce or deduct the agent's profit.
    const isUnpaid = chargesStatus === 'Unpaid';
    const actualProfit = isUnpaid 
      ? 0 
      : isFeeWaived
        ? 0 // Waived transactions yield exactly ₦0 profit (company absorbs cost, daily profit does NOT decrease)
        : customerFee - financials.providerCharge - (financials.cbnCharge || 0) + (financials.cashback || 0);

    // We keep the standard realistic provider charge and CBN charge even if profit is floored to 0
    const actualTerminalFee = financials.providerCharge;
    const actualCbnCharge = financials.cbnCharge;

    // Customer card debit / total charged amount
    const totalCustomerCharged = actualAmount;

    // Append notes details based on withdrawal charge mode
    let finalNotes = notes;
    if (type === 'Withdrawal') {
      const modeNote = 
        withdrawChargeMode === 'CardAddOn' ? '(Charges inside Card Debit)' :
        withdrawChargeMode === 'DeductFromCash' ? '(Deduct charges from Cash)' :
        '(Charges paid separately in Cash)';
      const scenarioNote = withdrawScenario === 'CardSwipe' ? '(Specified by Card Swipe Amount)' : '(Specified by Cash Handout Amount)';
      if (!finalNotes.includes(modeNote)) {
        finalNotes = finalNotes ? `${finalNotes} ${modeNote}` : modeNote;
      }
      if (!finalNotes.includes(scenarioNote)) {
        finalNotes = `${finalNotes} ${scenarioNote}`;
      }
    }

    return {
      id: initialTransaction ? initialTransaction.id : generateId(),
      employeeId: employeeId,
      employeeName: [currentUser, ...availableEmployees].find(emp => emp.id === employeeId)?.name || currentUser.name,
      type,
      provider,
      subType,
      amount: type === 'Withdrawal' ? baseCash : amount,
      customerFee: actualCustomerFee,
      terminalFee: actualTerminalFee, 
      cbnCharge: actualCbnCharge, 
      profit: actualProfit, 
      feeMethod: (type === 'Withdrawal' && paymentMethod === 'Transfer') ? 'Transfer' : ((type === 'Withdrawal' && withdrawChargeMode === 'CardAddOn') ? 'CardDebit' : 'Cash'),
      paymentMethod,
      destinationBank: (type === 'Transfer' || type === 'Deposit' || type === 'Airtime' || type === 'Data' || type === 'Withdrawal') ? destinationBank : undefined,
      totalCustomerCharged,
      timestamp: customTimestamp,
      businessDate: getBusinessDate(customTimestamp),
      notes: finalNotes.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      customerName: customerName.trim() || undefined,
      customerAccountNumber: customerAccountNumber.trim() || undefined,
      status: finalStatus,
      mode,
      sourceType,
      distributionType,
      distributionProvider,
      subTransfers,
      remainingBalance,
      chargesStatus,
      unpaidFeeAmount,
      originalFeeAmount: initialTransaction?.originalFeeAmount !== undefined ? initialTransaction.originalFeeAmount : (chargesStatus === 'Unpaid' ? customerFee : undefined),
      chargesPaidAmount: initialTransaction?.chargesPaidAmount !== undefined ? initialTransaction.chargesPaidAmount : (chargesStatus === 'Unpaid' ? 0 : undefined),
      chargePayments: initialTransaction?.chargePayments !== undefined ? initialTransaction.chargePayments : (chargesStatus === 'Unpaid' ? [] : undefined),
      terminalId: selectedTerminalId || undefined,
      terminalName: activeTerminal?.name || undefined,
      audioNote: audioNote || undefined,
      // Comprehensive Senior Fintech Fields
      customerCharge: actualCustomerFee,
      providerCharge: actualTerminalFee,
      agentProfit: actualProfit,
      netProfit: actualProfit,
      vatAmount: financials.vatAmount,
      cashback: financials.cashback,
      commissionAmount: financials.commissionAmount,
      settlementCharge: financials.settlementCharge,
      merchantProfit: actualProfit,
      balanceBefore: 0, // Should be populated by backend later
      balanceAfter: 0,
      referenceNumber: generateId(), // Placeholder
      rrn: generateId(),
      stan: generateId(),
      createdBy: currentUser.id,
      branchName: settings?.businessName || 'Default Branch'
    };
  };

  const executeFinalSave = (finalStatus: 'Success' | 'Failed') => {
    const savedTx = getTransactionObject(finalStatus);
    
    // Helper to expand a transaction if it's a split session
    const expandTx = (tx: Transaction): Transaction[] => {
      if (tx.mode === 'SplitSession' && tx.subTransfers && tx.subTransfers.length > 0) {
        const baseTime = new Date(tx.timestamp).getTime();
        
        const children: Transaction[] = tx.subTransfers
          .filter(st => st.amount > 0)
          .map((st, index) => {
            // Give children later timestamps than the parent (T + 1s, T + 2s, etc.)
            // In a newest-first (descending) list, this ensures the Children appear ABOVE the parent.
            const childTimestamp = new Date(baseTime + (index + 1) * 1000).toISOString();
            
            // Calculate realistic cost for this child from provider rules
            const childType = st.type || tx.distributionType || 'Transfer';
            const childProvider = st.provider || tx.distributionProvider || tx.provider;
            const childFinancials = getCalculatedFinancials(st.amount, childType, childProvider as ProviderType, settings);
            const segmentCost = childFinancials.providerCharge || 0;
            
            return {
              id: generateId(),
              employeeId: tx.employeeId,
              employeeName: tx.employeeName,
              type: childType,
              provider: childProvider,
              amount: st.amount,
              customerFee: 0,
              terminalFee: segmentCost,
              profit: -segmentCost, // Explicitly subtract cost from net daily profit
              timestamp: childTimestamp,
              businessDate: getBusinessDate(childTimestamp),
              notes: `Linked Distribution from session: ${tx.id}`,
              customerPhone: tx.customerPhone,
              status: tx.status,
              parentTransactionId: tx.id,
              destinationBank: childType === 'Transfer' ? 'Bank Transfer' : childType,
              customerName: st.recipientName,
              referenceNumber: st.accountNumber,
              createdBy: currentUser.id,
              branchName: tx.branchName,
              mode: 'SplitChild',
              // Add sequence for UI display
              splitSegmentIndex: index + 1
            };
          });
        
        const updatedParent = { ...tx, isSplitParent: true };
        // We return children first, parent last. 
        // Since handleAddTransaction prepends them one by one, the last one (Parent) ends up at index 0 (TOP).
        return [...children, updatedParent];
      }
      return [tx];
    };

    // Flatten both the current transaction and everything in the basket
    const allFinalTransactions: Transaction[] = [
      ...basket.flatMap(tx => expandTx(tx)),
      ...expandTx(savedTx)
    ];

    onSave(allFinalTransactions.length === 1 ? allFinalTransactions[0] : allFinalTransactions);

    if (!settings || settings.soundEnabled) {
      playStatusSound(finalStatus);
    }

    if (settings?.voiceEnabled && 'speechSynthesis' in window && finalStatus === 'Success') {
      try {
        window.speechSynthesis.cancel();
        const speechMsg = `Successful ${type} of ${type === 'Withdrawal' ? baseCash : amount} Naira recorded.`;
        const utterance = new SpeechSynthesisUtterance(speechMsg);
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Speech synthesis skipped', e);
      }
    }
  };

  const handleAddToBasket = () => {
    if (posTerminals && posTerminals.length > 0 && !selectedTerminalId) {
      setTerminalError(true);
      const el = document.getElementById('terminal-selection-container');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (amount <= 0) {
      alert('Transaction amount must be greater than zero');
      return;
    }

    if (customerFee < 0) {
      alert('Fee charged to customer cannot be negative');
      return;
    }

    const tx = getTransactionObject('Success');
    setBasket((prev) => [...prev, tx]);

    // Reset fields for the next entry
    setAmountInput('');
    setFeeInput('');
    setNotes('');
    setCustomerPhone('');
    setCustomerName('');
    setCustomerAccountNumber('');
    setIsFeeWaived(false);
    setSubTransfers([]);
    setMode('Standard');
    setChargesStatus('Paid');

    // Chime
    if (!settings || settings.soundEnabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } catch (e) {}
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (posTerminals && posTerminals.length > 0 && !selectedTerminalId) {
      setTerminalError(true);
      const el = document.getElementById('terminal-selection-container');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (amount <= 0) {
      alert('Transaction amount must be greater than zero');
      return;
    }

    if (customerFee < 0) {
      alert('Fee charged to customer cannot be negative');
      return;
    }

    if (mode === 'SplitSession') {
      const totalSent = subTransfers.reduce((sum, st) => sum + st.amount, 0);
      if (totalSent > withdrawalDetails.cashHandout) {
        alert(`Distribution error: Total sent (${formatNaira(totalSent)}) exceeds available cash from withdrawal (${formatNaira(withdrawalDetails.cashHandout)}).`);
        return;
      }
      
      const hasEmpty = subTransfers.some(st => !st.recipientName || !st.accountNumber || st.amount <= 0);
      if (hasEmpty) {
        alert('Please complete all recipient details and ensure amounts are valid.');
        return;
      }
    }

    // Direct offline submission fallback
    executeFinalSave(status);
  };

  const activeTerminal = posTerminals?.find(t => t.id === selectedTerminalId);
  const activeFeeRate = (activeTerminal?.terminalFeeRate !== undefined) ? (activeTerminal.terminalFeeRate as any) : terminalFeeRate;
  
  // Update type based on mode and sourceType
  useEffect(() => {
    if (mode === 'SplitSession') {
      if (type !== sourceType) {
        setType(sourceType);
      }
    }
  }, [mode, sourceType, type]);

  const { baseCash, cardSwipe, cashHandout, separateCashFee } = withdrawalDetails;

  const liveAmountForTerminalFee = type === 'Withdrawal' ? cardSwipe : amount;
  const effectiveTypeLive = (type === 'Withdrawal' && paymentMethod === 'Transfer') ? 'Cash Out (Transfer)' : type;
  
  // UNIFIED CALCULATION SERVICE CALL
  const liveFinancials = getCalculatedFinancials(liveAmountForTerminalFee, effectiveTypeLive, provider, settings, destinationBank);
  
  const isFormValid = liveFinancials.isConfigured && 
    (mode === 'SplitSession' 
      ? (subTransfers.length > 0 && subTransfers.every(st => st.recipientName && st.accountNumber && st.amount > 0) && remainingBalance >= 0)
      : true);
  
  const liveTerminalFee = liveFinancials.providerCharge;
  const liveCbnCharge = liveFinancials.cbnCharge;

  const fastAmounts = [5000, 10000, 15000, 20000, 50000];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Action Bar - Lovable and Professional */}
        <div className="flex items-center justify-between px-6 py-6 border-b-2 border-[#00B87A]/5 bg-gradient-to-r from-emerald-50/30 to-white">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-xl rotate-3 transition-transform hover:rotate-0 ${mode === 'SplitSession' ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-[#00B87A] border-2 border-emerald-50 shadow-emerald-50'}`}>
              {mode === 'SplitSession' ? <ArrowRightLeft className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-neutral-900 tracking-tighter leading-none">
                  {initialTransaction ? 'Edit Receipt 📝' : (mode === 'SplitSession' ? 'Multi-Task Payout ⚡' : 'New Sale Receipt 🧾')}
                </h3>
                {mode === 'SplitSession' && (
                  <span className="bg-emerald-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shadow-md">
                    SPLIT MODE
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-400 mt-1 font-bold uppercase tracking-widest flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Nigeria Market Rates • 2024
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-neutral-50 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 transition-all active:scale-90 border border-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Form Grid */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {mode === 'SplitSession' && (
            <div className="flex items-center gap-3 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 shadow-sm">
              <div className="w-6 h-6 rounded-full bg-[#00B87A] text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm">1</div>
              <div className="flex-1">
                <span className="block text-[11px] font-black uppercase tracking-widest text-[#00B87A] font-mono">
                  {sourceType === 'Withdrawal' ? 'Withdrawal Setup' : 'Cash Intake Setup'}
                </span>
                <span className="block text-[10px] text-emerald-600/80 font-semibold">
                  {sourceType === 'Withdrawal' 
                    ? 'Enter the total amount to be withdrawn from POS/Card.' 
                    : 'Enter the total cash amount received from customer.'}
                </span>
              </div>
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00B87A]"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-200"></div>
              </div>
            </div>
          )}
          {/* Active Ticket Basket */}
          {basket.length > 0 && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4.5 space-y-3.5 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between border-b border-neutral-250 pb-2.5">
                <span className="text-[11px] font-black text-neutral-850 font-mono flex items-center gap-2 tracking-wide">
                  <span className="flex items-center justify-center w-5 h-5 bg-[#00B87A] text-white rounded-full text-[10px] font-black animate-pulse">
                    {basket.length}
                  </span>
                  ACTIVE BATCH TICKET
                </span>
                <button
                  type="button"
                  onClick={() => setBasket([])}
                  className="text-[10px] font-bold text-red-500 hover:text-red-650 bg-red-50 hover:bg-red-100/65 px-2.5 py-1 rounded-lg transition"
                >
                  Clear Batch
                </button>
              </div>

              {/* Basket list scrollable area */}
              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {basket.map((tx, idx) => {
                  const borderColors = {
                    Moniepoint: 'border-l-blue-500',
                    OPay: 'border-l-[#00B87A]',
                    PalmPay: 'border-l-orange-500'
                  };
                  return (
                    <div
                      key={tx.id || idx}
                      className={`bg-white border border-neutral-150 rounded-xl p-2.5 pl-3 border-l-4 ${borderColors[tx.provider]} flex items-center justify-between gap-3.5 text-xs shadow-xs hover:shadow-sm transition`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded font-mono ${
                            tx.type === 'Withdrawal' ? 'bg-blue-50 text-blue-700' :
                            tx.type === 'Deposit' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-amber-50 text-amber-700'
                          }`}>
                            {tx.type === 'Withdrawal' && '📥 Withdraw'}
                            {tx.type === 'Deposit' && '📤 Money Receive'}
                            {tx.type === 'Transfer' && '💸 Transfer'}
                          </span>
                          <span className="text-[10px] font-bold text-neutral-400 font-mono">
                            {tx.provider}
                          </span>
                        </div>
                        <p className="text-[11px] font-extrabold text-neutral-700 truncate">
                          Amount: <span className="font-mono text-neutral-900">{formatNaira(tx.amount)}</span>
                          {tx.customerFee > 0 && (
                            <span className="text-neutral-450 font-normal ml-1.5">
                              (Fee: <span className="font-mono font-medium">{formatNaira(tx.customerFee)}</span>)
                            </span>
                          )}
                        </p>
                        {tx.notes && (
                          <p className="text-[9px] text-neutral-450 truncate font-sans">
                            📝 {tx.notes}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setBasket((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-neutral-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-neutral-50 transition cursor-pointer"
                        title="Remove from batch"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Consolidated summary card */}
              <div className="bg-white border border-neutral-200 p-3.5 rounded-xl space-y-2 shadow-xs text-xs font-medium">
                <div className="flex justify-between items-center text-neutral-500">
                  <span>Total POS Withdrawals (Inflow):</span>
                  <span className="font-mono font-bold text-neutral-800">{formatNaira(basket.reduce((sum, t) => t.type === 'Withdrawal' ? sum + t.amount : sum, 0))}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-500">
                  <span>Total Outgoing (Transfers/Money Receive):</span>
                  <span className="font-mono font-bold text-neutral-800">-{formatNaira(basket.reduce((sum, t) => (t.type === 'Transfer' || t.type === 'Deposit') ? sum + t.amount : sum, 0))}</span>
                </div>
                <div className="flex justify-between items-center text-neutral-500 pb-1.5 border-b border-neutral-100">
                  <span>Total Agent Fees (Revenue):</span>
                  <span className="font-mono font-bold text-neutral-800">+{formatNaira(basket.reduce((sum, t) => sum + t.customerFee, 0))}</span>
                </div>

                {/* Net Physical Cash Handout Balance */}
                {(() => {
                  const totWithdrawals = basket.reduce((sum, t) => t.type === 'Withdrawal' ? sum + t.amount : sum, 0);
                  const totOutgoings = basket.reduce((sum, t) => (t.type === 'Transfer' || t.type === 'Deposit') ? sum + t.amount : sum, 0);
                  const totFees = basket.reduce((sum, t) => sum + t.customerFee, 0);

                  const cashFlow = totWithdrawals - totOutgoings - totFees;

                  return (
                    <div className="flex justify-between items-center pt-1.5">
                      <span className="font-bold text-neutral-700">
                        {cashFlow >= 0 ? '👉 Cash Handout to Customer:' : '👈 Collect from Customer:'}
                      </span>
                      <span className={`text-sm font-black font-mono ${cashFlow >= 0 ? 'text-[#00B87A]' : 'text-amber-600'}`}>
                        {formatNaira(Math.abs(cashFlow))}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Complete save button for the batch */}
              <button
                type="button"
                onClick={() => {
                  onSave(basket);
                  setBasket([]);
                  onClose();
                  if (!settings || settings.soundEnabled) {
                    playStatusSound('Success');
                  }
                }}
                className="w-full bg-[#00B87A] hover:bg-emerald-600 text-white font-black py-3 rounded-xl cursor-pointer text-xs shadow-md shadow-[#00B87A]/15 transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Post All {basket.length} Transactions (Save Batch)
              </button>
            </div>
          )}
          
          {/* Operation Mode Selection (Standard or Split) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-450 font-mono">
                Transaction Mode
              </label>
              <span className="text-[9px] font-mono text-neutral-400 font-bold uppercase tracking-wider">
                Select Flow Option
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 p-1.5 bg-neutral-100/60 rounded-2xl border border-neutral-200/40">
              {(['Standard', 'SplitSession'] as const).map((m) => {
                const isSelected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-3 px-1 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer text-center flex items-center justify-center gap-2 select-none active:scale-[0.98] ${
                      isSelected 
                        ? 'bg-white text-neutral-850 shadow-md border border-neutral-200/50 font-black' 
                        : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50/50 border border-transparent font-bold'
                    }`}
                  >
                    {m === 'Standard' ? (
                      <>
                        <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? 'text-[#00B87A]' : 'text-neutral-450'}`} />
                        <span>Standard Transaction</span>
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className={`w-3.5 h-3.5 stroke-[2.5] ${isSelected ? 'text-indigo-600' : 'text-neutral-450'}`} />
                        <span>Split Transaction</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {mode === 'SplitSession' && (
              <div className="mt-6 space-y-6 animate-in fade-in zoom-in-95 duration-500">
                {/* Large Title Header for Split Mode */}
                <div className="flex flex-col items-center justify-center py-6 px-4 bg-gradient-to-br from-emerald-50 via-white to-blue-50 rounded-[2.5rem] border border-neutral-100 shadow-sm relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Sparkles className="w-32 h-32 text-emerald-900 rotate-12" />
                   </div>
                   <Zap className="w-10 h-10 text-emerald-600 mb-3 animate-pulse" />
                   <h2 className="text-xl font-black text-neutral-800 tracking-tight text-center uppercase">Unified Split Session</h2>
                   <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] text-center mt-1">Multi-Task Transaction Intelligence</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Inflow Selection - FULL WIDTH ON MOBILE */}
                  <div className="space-y-4 p-6 bg-white border border-neutral-100 rounded-[2rem] shadow-md relative overflow-hidden group hover:border-emerald-200 transition-all">
                    <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                      <Download className="w-40 h-40 text-emerald-900" />
                    </div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-emerald-700 font-mono flex items-center gap-3">
                      <div className="w-6 h-6 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-[10px] shadow-lg shadow-emerald-200">1</div>
                      Primary Inflow Task
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {(['Withdrawal', 'Transfer', 'Money Received'] as const).map((s) => {
                        const Icon = s === 'Withdrawal' ? CreditCard : s === 'Transfer' ? Landmark : Banknote;
                        const isSelected = sourceType === s;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setSourceType(s)}
                            className={`flex items-center gap-5 p-4 rounded-[1.5rem] border transition-all ${
                              isSelected 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl scale-[1.02] ring-4 ring-emerald-50' 
                                : 'bg-neutral-50/50 border-neutral-100 text-neutral-500 hover:bg-white hover:border-emerald-200 hover:shadow-md'
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-white/20 rotate-6' : 'bg-white shadow-sm'}`}>
                              <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-emerald-500'}`} />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-[11px] font-black uppercase tracking-tight leading-none mb-1">
                                {s === 'Withdrawal' ? 'POS/Card' : s === 'Money Received' ? 'Cash Intake' : 'Bank Transfer In'}
                              </span>
                              <span className={`text-[9px] font-bold ${isSelected ? 'text-emerald-100' : 'text-neutral-400'}`}>
                                {s === 'Withdrawal' ? 'Digital Card Payment' : s === 'Money Received' ? 'Paper Money Entry' : 'Digital Fund Arrival'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Outflow Selection */}
                  <div className="space-y-4 p-6 bg-white border border-neutral-100 rounded-[2rem] shadow-md relative overflow-hidden group hover:border-blue-200 transition-all">
                    <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
                      <ArrowUpRight className="w-40 h-40 text-blue-900" />
                    </div>
                    <label className="block text-[11px] font-black uppercase tracking-widest text-blue-700 font-mono flex items-center gap-3">
                      <div className="w-6 h-6 rounded-xl bg-blue-600 text-white flex items-center justify-center text-[10px] shadow-lg shadow-blue-200">2</div>
                      Distribution Tasks
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {(['Transfer', 'Airtime', 'Data'] as const).map((d) => {
                        const Icon = d === 'Transfer' ? Landmark : d === 'Airtime' ? Smartphone : Globe;
                        const isSelected = distributionType === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDistributionType(d)}
                            className={`flex items-center gap-5 p-4 rounded-[1.5rem] border transition-all ${
                              isSelected 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xl scale-[1.02] ring-4 ring-blue-50' 
                                : 'bg-neutral-50/50 border-neutral-100 text-neutral-500 hover:bg-white hover:border-blue-200 hover:shadow-md'
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isSelected ? 'bg-white/20 rotate-6' : 'bg-white shadow-sm'}`}>
                              <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-blue-500'}`} />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-[11px] font-black uppercase tracking-tight leading-none mb-1">
                                {d === 'Transfer' ? 'Bank Sent' : `Buy ${d}`}
                              </span>
                              <span className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-neutral-400'}`}>
                                {d === 'Transfer' ? 'Multiple Payouts' : `Top-up Digital ${d}`}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Hardware Selector - Ultra-Wide Icon Ribbon */}
                <div className="p-8 bg-amber-50/40 border border-amber-100 rounded-[2.5rem] space-y-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-black uppercase tracking-widest text-amber-700 font-mono flex items-center gap-3">
                      <div className="w-6 h-6 rounded-xl bg-amber-600 text-white flex items-center justify-center text-[10px] shadow-lg shadow-amber-200">3</div>
                      Payout Device Terminal
                    </label>
                    <div className="px-3 py-1 bg-white/80 rounded-full border border-amber-100 text-[8px] font-black text-amber-600 uppercase tracking-widest">
                      Hardware Select
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {(['OPay', 'Moniepoint', 'PalmPay'] as const).map((p) => {
                      const isSelected = distributionProvider === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDistributionProvider(p)}
                          className={`group relative py-8 px-4 rounded-[2rem] border transition-all flex flex-col items-center gap-3 shadow-sm ${
                            isSelected 
                              ? 'bg-amber-600 border-amber-600 text-white ring-8 ring-amber-50 shadow-xl' 
                              : 'bg-white border-neutral-100 text-neutral-400 hover:border-amber-300 hover:text-neutral-600 hover:shadow-md'
                          }`}
                        >
                          <div className={`w-16 h-16 rounded-[1.5rem] transition-all flex items-center justify-center ${isSelected ? 'bg-white/20 rotate-12' : 'bg-amber-50 group-hover:bg-amber-100'}`}>
                            <Cpu className={`w-8 h-8 ${isSelected ? 'text-white' : 'text-amber-600'}`} />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-widest leading-none">{p}</span>
                          {isSelected && (
                            <div className="absolute -top-2 -right-2 w-7 h-7 bg-white text-amber-600 rounded-full flex items-center justify-center border-4 border-amber-600 shadow-lg">
                              <Check className="w-4 h-4 stroke-[4]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Intelligent Professional Summary Ribbon */}
                <div className="bg-neutral-900 text-white p-6 rounded-[2rem] shadow-2xl flex items-center gap-6 border border-neutral-800 animate-in slide-in-from-bottom-4 duration-700">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 via-blue-500 to-amber-400 flex items-center justify-center shadow-lg shrink-0">
                    <Zap className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-1.5 font-mono">
                      Unified Workflow Intelligence
                    </p>
                    <p className="text-sm font-bold leading-snug tracking-tight">
                      Capturing <span className="text-emerald-400 px-1 bg-emerald-400/10 rounded">{sourceType}</span> via <span className="text-emerald-400">{provider}</span> 
                      <span className="text-neutral-600 px-3">➔</span> 
                      Distributing as <span className="text-blue-400 px-1 bg-blue-400/10 rounded">{distributionType}</span> through <span className="text-amber-400">{distributionProvider}</span>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active Category Display - Highly friendly and accessible for all operators */}
          <div className={`border rounded-3xl p-4.5 flex items-center justify-between gap-4 shadow-sm transition-all duration-300 ${
            type === 'Withdrawal' ? 'bg-blue-50/50 border-blue-100' :
            type === 'Deposit' || type === 'Money Received' ? 'bg-emerald-50/50 border-emerald-100' :
            type === 'Transfer' ? 'bg-indigo-50/50 border-indigo-100' :
            type === 'Airtime' ? 'bg-purple-50/50 border-purple-100' :
            'bg-violet-50/50 border-violet-100'
          }`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl text-white shadow-lg shadow-current/20 transition-all ${
                type === 'Withdrawal' ? 'bg-blue-600' :
                type === 'Deposit' || type === 'Money Received' ? 'bg-emerald-600' :
                type === 'Transfer' ? 'bg-indigo-600' :
                type === 'Airtime' ? 'bg-purple-600' :
                'bg-violet-600'
              }`}>
                {type === 'Withdrawal' && <Wallet className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Deposit' && <Wallet className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Transfer' && <Landmark className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Airtime' && <Smartphone className="w-5.5 h-5.5 stroke-[2]" />}
                {type === 'Data' && <Globe className="w-5.5 h-5.5 stroke-[2]" />}
              </div>
              <div className="space-y-0.5">
                <span className={`block text-[9.5px] font-black uppercase tracking-widest font-mono ${
                  type === 'Withdrawal' ? 'text-blue-600 font-bold' :
                  type === 'Deposit' || type === 'Money Received' ? 'text-emerald-600 font-bold' :
                  type === 'Transfer' ? 'text-indigo-600 font-bold' :
                  type === 'Airtime' ? 'text-purple-600 font-bold' :
                  'text-violet-600'
                }`}>
                  Active Operation Mode
                </span>
                <h4 className="text-sm sm:text-base font-black text-neutral-850 leading-tight">
                  {type === 'Withdrawal' && (mode === 'SplitSession' ? '📥 Unified POS Withdrawal' : '📥 Cash Withdrawal Mode')}
                  {type === 'Money Received' && '📥 Cash Paper Intake Mode'}
                  {type === 'Deposit' && '📤 Money Receive Mode'}
                  {type === 'Transfer' && (mode === 'SplitSession' ? '📥 Bank Transfer Inflow Mode' : '💸 Bank Transfer Mode')}
                  {type === 'Airtime' && '📱 Airtime Sale Mode'}
                  {type === 'Data' && '🌐 Data Bundle Sale Mode'}
                </h4>
              </div>
            </div>
            
            {/* Active Status Pill */}
            <span className={`text-[10px] font-black px-3 py-1.5 rounded-full font-mono uppercase tracking-wider flex items-center gap-1.5 shadow-xs border ${
              type === 'Withdrawal' ? 'bg-blue-100 text-blue-800 border-blue-200/40' :
              type === 'Deposit' || type === 'Money Received' ? 'bg-emerald-100 text-emerald-800 border-emerald-200/40' :
              type === 'Transfer' ? 'bg-indigo-100 text-indigo-800 border-indigo-200/40' :
              type === 'Airtime' ? 'bg-purple-100 text-purple-800 border-purple-200/40' :
              'bg-violet-100 text-violet-800 border-violet-200/40'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              Selected
            </span>
          </div>

          {/* Active POS Sync Banner or Hardware Warning */}
          {selectedTerminalId ? (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200 shadow-sm mb-2">
              <div className="p-2 bg-[#00B87A] text-white rounded-full">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[11px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  ACTIVE POS SYNC: {posTerminals?.find(t => t.id === selectedTerminalId)?.name}
                </h4>
                <p className="text-[10px] text-emerald-700/80 font-medium">
                  {posTerminals?.find(t => t.id === selectedTerminalId)?.provider} provider rate and settlement rules are locked for this transaction.
                </p>
              </div>
            </div>
          ) : null}
          
          {/* Linked POS Terminals Selection Card Grid */}
          {posTerminals && posTerminals.length > 0 && (
            <div 
              id="terminal-selection-container" 
              className={`p-5 rounded-[36px] space-y-3.5 transition-all duration-300 shadow-2xl border-4 ring-8 ${
                terminalError
                  ? 'border-red-500 bg-red-50/10 ring-red-500/10 animate-pulse'
                  : 'bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 border-amber-300/50 ring-amber-500/10 shadow-amber-900/10'
              }`}
            >
              {terminalError && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200 shadow-xs">
                  <div className="p-1.5 bg-red-500 text-white rounded-xl shrink-0">
                    <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-red-800 uppercase tracking-wider font-mono">
                      Selection Required
                    </h4>
                    <p className="text-[9.5px] text-red-700 font-semibold leading-relaxed">
                      Please select the exact physical POS terminal you used for this transaction to proceed.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className={`block text-[10.5px] font-black uppercase tracking-widest font-mono flex items-center gap-1.5 ${
                  terminalError ? 'text-red-700' : 'text-amber-950 font-black'
                }`}>
                  📟 Link Physical POS Device <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded animate-pulse ${terminalError ? 'bg-red-200 text-red-800' : 'bg-amber-950/20 text-amber-950'}`}>REQUIRED</span>
                </label>
                <span className={`text-[7.5px] font-black px-2 py-0.5 rounded-full font-mono uppercase tracking-widest leading-none ${
                  terminalError ? 'bg-red-100 text-red-800' : !selectedTerminalId ? 'bg-amber-950/20 text-amber-950 animate-pulse' : 'bg-emerald-600 text-white shadow-xs'
                }`}>
                  {terminalError ? 'Select Device Now' : !selectedTerminalId ? 'Awaiting Selection' : 'Locked & Synced'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(() => {
                  // Filter terminals based on selected provider if any, to prevent cashier from choosing the wrong machine brand!
                  const filteredTerminals = provider 
                    ? posTerminals.filter(t => t.provider.toLowerCase() === provider.toLowerCase())
                    : posTerminals;

                  if (filteredTerminals.length === 0) {
                    return (
                      <div className="col-span-full text-center p-3 bg-amber-50/40 border border-dashed border-amber-200 rounded-xl text-[10px] font-bold text-amber-700">
                        No registered physical terminals found for the selected brand ({provider}). Please select another brand or contact your administrator.
                      </div>
                    );
                  }

                  return filteredTerminals.map((term) => {
                    const isSelected = selectedTerminalId === term.id;
                    
                    const getBrandTheme = (pvd: string) => {
                      const lower = pvd.toLowerCase();
                      if (lower === 'moniepoint') return {
                        border: isSelected ? 'border-blue-600 ring-2 ring-blue-500/10 shadow-md scale-[1.01]' : 'border-neutral-200 hover:border-blue-300 hover:bg-blue-50/10',
                        bg: isSelected ? 'bg-blue-50/40' : 'bg-white',
                        badge: 'bg-blue-600 text-white',
                        dot: 'bg-blue-500',
                        textColor: 'text-blue-900',
                        glow: 'shadow-blue-50/30'
                      };
                      if (lower === 'opay') return {
                        border: isSelected ? 'border-[#00B87A] ring-2 ring-[#00B87A]/10 shadow-md scale-[1.01]' : 'border-neutral-200 hover:border-emerald-300 hover:bg-emerald-50/10',
                        bg: isSelected ? 'bg-emerald-50/30' : 'bg-white',
                        badge: 'bg-[#00B87A] text-white',
                        dot: 'bg-[#00B87A]',
                        textColor: 'text-emerald-900',
                        glow: 'shadow-emerald-50/30'
                      };
                      if (lower === 'palmpay') return {
                        border: isSelected ? 'border-orange-500 ring-2 ring-orange-500/10 shadow-md scale-[1.01]' : 'border-neutral-200 hover:border-orange-300 hover:bg-orange-50/10',
                        bg: isSelected ? 'bg-orange-50/30' : 'bg-white',
                        badge: 'bg-orange-500 text-white',
                        dot: 'bg-orange-500',
                        textColor: 'text-orange-900',
                        glow: 'shadow-orange-50/30'
                      };
                      return {
                        border: isSelected ? 'border-purple-600 ring-2 ring-purple-500/10 shadow-md scale-[1.01]' : 'border-neutral-200 hover:border-purple-300 hover:bg-purple-50/10',
                        bg: isSelected ? 'bg-purple-50/30' : 'bg-white',
                        badge: 'bg-purple-600 text-white',
                        dot: 'bg-purple-500',
                        textColor: 'text-purple-900',
                        glow: 'shadow-purple-50/30'
                      };
                    };
                    
                    const theme = getBrandTheme(term.provider);
                    
                    return (
                      <button
                        key={term.id}
                        type="button"
                        onClick={() => {
                          setSelectedTerminalId(term.id);
                          setProvider(term.provider as any);
                          setTerminalError(false);
                          // Synthesize a tactile chime on selection
                          try {
                            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const osc = audioCtx.createOscillator();
                            const gain = audioCtx.createGain();
                            osc.connect(gain);
                            gain.connect(audioCtx.destination);
                            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
                            gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
                            osc.start();
                            osc.stop(audioCtx.currentTime + 0.08);
                          } catch (e) {}
                        }}
                        className={`text-left p-2.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-2.5 select-none active:scale-[0.98] ${theme.border} ${theme.bg} ${theme.glow}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[7.5px] font-black px-1 py-0.5 rounded uppercase tracking-wider font-mono ${theme.badge}`}>
                                {term.provider}
                              </span>
                              <span className="text-[8px] font-mono font-bold text-neutral-400 uppercase tracking-widest truncate">
                                S/N: {term.serialNumber || 'N/A'}
                              </span>
                            </div>
                            <h4 className={`text-[11.5px] font-black tracking-tight mt-0.5 truncate ${theme.textColor}`}>
                              {term.name}
                            </h4>
                          </div>
                          
                          {/* Tactile radio indicator */}
                          <div className={`w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
                            isSelected ? 'bg-[#00B87A] border-[#00B87A] text-white' : 'border-neutral-200 text-transparent bg-neutral-50/50'
                          }`}>
                            <Check className="w-2.5 h-2.5 stroke-[4.5]" />
                          </div>
                        </div>
                        
                        <div className="border-t border-neutral-100 pt-1.5 flex items-center justify-between text-[8px] text-neutral-400 font-bold font-mono">
                          <span className="truncate max-w-[70%]">
                            ACCT: <span className="text-neutral-600">{term.posAccountNo || 'N/A'}</span>
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            <span className={`w-1 h-1 rounded-full ${isSelected ? 'animate-ping' : ''} ${theme.dot}`} />
                            {isSelected ? 'ACTIVE' : 'TAP TO LINK'}
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* POS Host Provider Gateways */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-3">
              <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-500 font-mono flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-neutral-500 animate-pulse" />
                <span>POS Terminal Hardware Channel</span>
              </label>
              <span className="text-[9px] font-black bg-neutral-100 text-neutral-600 px-2.5 py-1 rounded-full font-mono uppercase tracking-widest leading-none shrink-0 self-start sm:self-auto">
                Touch to match your physical device
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['Moniepoint', 'OPay', 'PalmPay', 'Kuda', 'Nomba', 'Others'] as const).filter(pvd => {
                const isBrandRegistered = posTerminals && posTerminals.some(
                  t => t.provider.toLowerCase() === pvd.toLowerCase()
                );
                return isBrandRegistered;
              }).map((pvd) => {
                const isSelected = provider === pvd;
                // Core branding styles with elegant depth and custom gradient highlights
                const brandColors: Record<string, string> = {
                  Moniepoint: 'border-blue-500 bg-gradient-to-b from-blue-50/40 to-white text-blue-700 ring-4 ring-blue-500/10 shadow-lg scale-[1.03]',
                  OPay: 'border-[#00B87A] bg-gradient-to-b from-emerald-50/40 to-white text-emerald-700 ring-4 ring-[#00B87A]/10 shadow-lg scale-[1.03]',
                  PalmPay: 'border-orange-500 bg-gradient-to-b from-orange-50/40 to-white text-orange-700 ring-4 ring-orange-500/10 shadow-lg scale-[1.03]',
                  Kuda: 'border-purple-500 bg-gradient-to-b from-purple-50/40 to-white text-purple-700 ring-4 ring-purple-500/10 shadow-lg scale-[1.03]',
                  Nomba: 'border-yellow-500 bg-gradient-to-b from-yellow-50/40 to-white text-yellow-700 ring-4 ring-yellow-500/10 shadow-lg scale-[1.03]',
                  Others: 'border-neutral-500 bg-gradient-to-b from-neutral-50/40 to-white text-neutral-700 ring-4 ring-neutral-500/10 shadow-lg scale-[1.03]'
                };
                
                const posImages: Record<string, any> = {
                  Moniepoint: moniepointPosImg,
                  OPay: opayPosImg,
                  PalmPay: palmpayPosImg
                };

                const subLabels: Record<string, { text: string; bg: string }> = {
                  Moniepoint: { text: '🔵 BLUE MACHINE', bg: 'bg-blue-50 text-blue-800 border-blue-100' },
                  OPay: { text: '🟢 GREEN MACHINE', bg: 'bg-emerald-50 text-emerald-800 border-emerald-100' },
                  PalmPay: { text: '🟠 ORANGE MACHINE', bg: 'bg-orange-50 text-orange-800 border-orange-100' },
                  Kuda: { text: '🟣 PURPLE MACHINE', bg: 'bg-purple-50 text-purple-800 border-purple-100' },
                  Nomba: { text: '🟡 YELLOW MACHINE', bg: 'bg-yellow-50 text-yellow-800 border-yellow-100' },
                  Others: { text: '⚪ OTHER MACHINE', bg: 'bg-neutral-50 text-neutral-800 border-neutral-100' }
                };

                return (
                  <button
                    key={pvd}
                    type="button"
                    onClick={() => {
                      setProvider(pvd);
                      // Reset selected terminal to force explicit visual confirmation of physical machine below
                      setSelectedTerminalId('');
                    }}
                    className={`group py-2.5 px-2 rounded-2xl text-[11px] sm:text-sm font-extrabold border transition-all duration-300 cursor-pointer flex flex-col items-center justify-center gap-2 select-none active:scale-95 ${
                      isSelected 
                        ? brandColors[pvd]
                        : 'bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-850 hover:border-neutral-300 shadow-sm'
                    }`}
                  >
                    {/* Visual realistic preview */}
                    <div className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white overflow-hidden border ${
                      isSelected 
                        ? pvd === 'Moniepoint' ? 'border-blue-300 shadow-md ring-2 ring-blue-100' : pvd === 'OPay' ? 'border-emerald-300 shadow-md ring-2 ring-emerald-100' : 'border-orange-300 shadow-md ring-2 ring-orange-100'
                        : 'border-neutral-100 shadow-xs'
                    } flex items-center justify-center p-1.5 group-hover:scale-105 transition-transform duration-200`}>
                      {posImages[pvd] ? (
                        <img 
                          src={posImages[pvd]} 
                          alt={`${pvd} Physical POS`} 
                          className="w-full h-full object-contain rounded-md"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-[9px] text-neutral-400 font-bold text-center">
                          {pvd}
                        </div>
                      )}
                      {isSelected && (
                        <div className={`absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-white shadow-md border border-white ${
                          pvd === 'Moniepoint' ? 'bg-blue-600' : pvd === 'OPay' ? 'bg-[#00B87A]' : 'bg-orange-500'
                        }`}>
                          <Check className="w-2.5 h-2.5 stroke-[4.5]" />
                        </div>
                      )}
                    </div>
                    <div className="text-center w-full min-w-0">
                      <span className="block text-[12px] sm:text-[13px] font-black tracking-tight leading-none text-neutral-850">{pvd}</span>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-md text-[7.5px] sm:text-[8px] font-black font-mono tracking-wider border ${subLabels[pvd].bg}`}>
                        {subLabels[pvd].text}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Visual Hardware Confirmation Card - Super accessible for non-educated operators */}
            {provider && (provider === 'Moniepoint' || provider === 'OPay' || provider === 'PalmPay') && (() => {
              const isSelectedBrandRegistered = posTerminals && posTerminals.some(
                t => t.provider.toLowerCase() === provider.toLowerCase()
              );

              if (!isSelectedBrandRegistered) {
                return (
                  <div className="mt-3 border border-amber-200/70 bg-amber-50/40 rounded-2xl p-4 flex items-start gap-3.5 animate-in fade-in slide-in-from-top-2 duration-300 shadow-xs">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 shadow-sm border border-amber-200/60">
                      <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 font-mono leading-none">
                          Manager Registration Needed
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-amber-900 leading-none">
                        🔒 Unregistered {provider} POS Hardware Channel
                      </h4>
                      <p className="text-[10px] font-semibold text-neutral-600 leading-relaxed">
                        No physical <strong className="text-neutral-800">{provider}</strong> terminal has been registered to your cashier account yet. Real-world machine assets and connection feeds are locked.
                      </p>
                      <div className="inline-block mt-0.5 px-2 py-1 rounded-lg text-[9px] font-bold leading-normal bg-white/90 border border-amber-100 text-amber-850 shadow-2xs">
                        👉 Please ask your manager to register this POS brand under <strong className="font-extrabold text-[#00B87A] underline">"Registered POS Terminals"</strong>.
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className={`mt-3 border rounded-2xl p-3 flex items-center gap-3.5 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm ${
                  provider === 'Moniepoint' ? 'bg-gradient-to-r from-blue-50/40 via-white to-blue-50/10 border-blue-200/60' :
                  provider === 'OPay' ? 'bg-gradient-to-r from-emerald-50/40 via-white to-emerald-50/10 border-emerald-200/60' :
                  'bg-gradient-to-r from-orange-50/40 via-white to-orange-50/10 border-orange-200/60'
                }`}>
                  <div className="relative w-14 h-14 bg-white rounded-xl border border-neutral-100 flex items-center justify-center p-1.5 shrink-0 shadow-md ring-2 ring-neutral-50/60">
                    <img 
                      src={provider === 'Moniepoint' ? moniepointPosImg : provider === 'OPay' ? opayPosImg : palmpayPosImg} 
                      alt={`${provider} Active Terminal`} 
                      className="w-full h-full object-contain rounded-lg transform hover:scale-105 transition-transform duration-350"
                      referrerPolicy="no-referrer"
                    />
                    <span className={`absolute -bottom-1 -right-1 text-[7px] px-1.5 py-0.5 rounded-full font-black text-white shadow-md border border-white tracking-widest ${
                      provider === 'Moniepoint' ? 'bg-blue-600' : provider === 'OPay' ? 'bg-[#00B87A]' : 'bg-orange-500'
                    }`}>
                      ONLINE
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full animate-pulse ${
                        provider === 'Moniepoint' ? 'bg-blue-500' : provider === 'OPay' ? 'bg-[#00B87A]' : 'bg-orange-500'
                      }`} />
                      <span className="text-[9.5px] font-black uppercase tracking-widest text-neutral-450 font-mono leading-none">
                        Active Device Channel
                      </span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-neutral-850 leading-none">
                      {provider === 'Moniepoint' && '🔵 Moniepoint Smart POS'}
                      {provider === 'OPay' && '🟢 OPay Smart POS'}
                      {provider === 'PalmPay' && '🟠 PalmPay Smart POS'}
                    </h4>
                    
                    {/* Giant visual cue for limited literacy operators */}
                    <div className={`inline-block px-3 py-1.5 rounded-xl text-[11px] sm:text-[11.5px] font-black leading-relaxed border ${
                      provider === 'Moniepoint' ? 'bg-blue-50/80 text-blue-900 border-blue-100' :
                      provider === 'OPay' ? 'bg-emerald-50/80 text-[#00B87A] border-emerald-100' :
                      'bg-orange-50/80 text-orange-900 border-orange-100'
                    }`}>
                      {provider === 'Moniepoint' && '👉 Pick the BLUE machine from the table. Insert customer card and press OK.'}
                      {provider === 'OPay' && '👉 Pick the GREEN machine from the table. Insert customer card and press OK.'}
                      {provider === 'PalmPay' && '👉 Pick the ORANGE machine from the table. Insert customer card and press OK.'}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono flex items-center gap-2">
              <span>What is the Customer Doing? 🚀</span>
              <div className="h-px flex-1 bg-neutral-100" />
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['Withdrawal', 'Deposit', 'Transfer', 'Airtime', 'Data'] as TransactionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-3.5 rounded-[20px] border-2 transition-all duration-300 flex flex-col items-center justify-center gap-2 active:scale-95 ${
                    type === t
                      ? 'bg-white border-[#00B87A] text-[#00B87A] shadow-xl shadow-emerald-50 ring-4 ring-emerald-50 scale-[1.02] font-black'
                      : 'bg-neutral-50/50 border-neutral-100 text-neutral-400 hover:border-neutral-200 hover:text-neutral-600 font-bold'
                  }`}
                >
                  <span className="text-xl">
                    {t === 'Withdrawal' ? '🏧' : t === 'Deposit' ? '📥' : t === 'Transfer' ? '💸' : t === 'Airtime' ? '📱' : '🌐'}
                  </span>
                  <span className="text-[10px] uppercase tracking-tighter leading-none">{t}</span>
                </button>
              ))}
            </div>
          </div>

            {type === 'Airtime' || type === 'Data' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                  {([
                    { id: 'MTN', title: 'MTN', color: 'border-amber-200 text-amber-800 bg-white hover:bg-amber-50', activeColor: 'bg-amber-500 border-amber-500 text-white shadow-md' },
                    { id: 'Airtel', title: 'Airtel', color: 'border-red-200 text-red-800 bg-white hover:bg-red-50', activeColor: 'bg-red-600 border-red-600 text-white shadow-md' },
                    { id: 'Glo', title: 'Glo', color: 'border-green-200 text-green-800 bg-white hover:bg-green-50', activeColor: 'bg-green-600 border-green-600 text-white shadow-md' },
                    { id: '9mobile', title: '9mobile', color: 'border-emerald-200 text-emerald-800 bg-white hover:bg-emerald-50', activeColor: 'bg-emerald-600 border-emerald-600 text-white shadow-md' }
                  ] as const).map((opt) => {
                    const isActive = destinationBank === opt.id;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDestinationBank(opt.id as any);
                          setSelectedPlanName('');
                        }}
                        className={`p-2 sm:p-3 rounded-xl border text-center transition-all duration-155 cursor-pointer flex flex-col items-center justify-center select-none active:scale-[0.98] min-h-[70px] ${
                          isActive 
                            ? `${opt.activeColor} scale-[1.02] font-bold ring-2 ring-offset-1 ring-amber-500` 
                            : `${opt.color}`
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                            isActive ? 'bg-white text-black' : 
                            opt.id === 'MTN' ? 'bg-amber-500 text-white' :
                            opt.id === 'Airtel' ? 'bg-red-600 text-white' :
                            opt.id === 'Glo' ? 'bg-green-600 text-white' : 'bg-emerald-600 text-white'
                          }`}>
                            {opt.id[0]}
                          </div>
                          <span className="text-[11px] sm:text-sm font-extrabold tracking-tight leading-tight">{opt.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {type === 'Data' && (
                  <div className="animate-in fade-in slide-in-from-top-3 duration-200 bg-neutral-50/50 border border-neutral-200/60 p-3.5 rounded-2xl">
                    <p className="text-[10px] font-mono font-black text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                      <Wifi className="w-3.5 h-3.5 text-violet-500" />
                      <span>Select Data Bundle Plan</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[145px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-neutral-300">
                      {(DATA_PLANS[destinationBank as string] || DATA_PLANS['MTN']).map((plan) => {
                        const isPlanActive = selectedPlanName === plan.name;
                        return (
                          <button
                            key={plan.name}
                            type="button"
                            onClick={() => {
                              setSelectedPlanName(plan.name);
                              setAmountInput(plan.price.toString());
                              setNotes(`${destinationBank} Data Bundle: ${plan.name}`);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer flex flex-col justify-between select-none active:scale-[0.98] min-h-[52px] ${
                              isPlanActive
                                ? 'bg-violet-50 border-violet-500 text-violet-900 ring-2 ring-offset-1 ring-violet-500 scale-[1.01] font-bold'
                                : 'bg-white border-neutral-200 hover:border-violet-300 text-neutral-700 hover:bg-neutral-50'
                            }`}
                          >
                            <span className="text-[10px] sm:text-[11px] font-extrabold leading-tight block truncate w-full">{plan.name}</span>
                            <span className={`text-[10px] font-mono font-black block mt-1 ${isPlanActive ? 'text-violet-600' : 'text-neutral-500'}`}>
                              ₦{plan.price.toLocaleString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-neutral-50 border border-neutral-200/60 rounded-2xl p-3 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Search query input block */}
                <div className="relative mb-3 flex items-center bg-white rounded-xl px-3 py-2 border border-neutral-200 shadow-sm focus-within:ring-2 focus-within:ring-[#00B87A] focus-within:border-transparent transition-all">
                  <Search className="w-4 h-4 text-neutral-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search Bank/ATM Card (e.g. GTB, Zenith, Access, Kuda...)"
                    value={bankSearchQuery}
                    onChange={(e) => setBankSearchQuery(e.target.value)}
                    className="w-full bg-transparent border-none text-xs font-bold text-neutral-700 placeholder-neutral-400 focus:outline-none"
                  />
                  {bankSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setBankSearchQuery('')}
                      className="text-[10px] bg-neutral-100 hover:bg-neutral-200 text-neutral-500 font-black px-2 py-0.5 rounded-lg cursor-pointer transition"
                    >
                      CLEAR
                    </button>
                  )}
                </div>

                {/* Search Results / All Banks Section */}
                <div>
                  <p className="text-[9.5px] font-mono font-black text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-1">
                    <span>{bankSearchQuery ? `🔍 Search Results (${BANK_OPTIONS.filter(b => b.title.toLowerCase().includes(bankSearchQuery.toLowerCase())).length})` : '🏦 Supported Banks'}</span>
                    {!bankSearchQuery && <span className="text-[8.5px] text-neutral-450 normal-case font-sans font-bold bg-neutral-150 px-1.5 py-0.5 rounded-md animate-pulse">(Scroll to find your bank)</span>}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[145px] overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent scroll-smooth">
                    {BANK_OPTIONS.filter(b => 
                      b.title.toLowerCase().includes(bankSearchQuery.toLowerCase()) || 
                      b.abbrev.toLowerCase().includes(bankSearchQuery.toLowerCase())
                    ).map((opt) => {
                      const isActive = destinationBank === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDestinationBank(opt.id)}
                          className={`p-1 sm:p-1.5 rounded-xl border text-center transition-all duration-150 cursor-pointer flex flex-col items-center justify-center select-none active:scale-[0.98] min-h-[48px] sm:min-h-[52px] ${
                            isActive
                              ? `${opt.activeColor} scale-[1.03] font-black ring-2 ring-offset-1 ring-[#00B87A]`
                              : `${opt.color} border-neutral-200/50`
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black mb-1 shadow-sm ${
                            isActive ? 'bg-white text-black' : opt.logoBg
                          }`}>
                            {opt.abbrev}
                          </div>
                          <span className="text-[9px] sm:text-[9.5px] font-bold tracking-tight leading-none truncate w-full px-0.5">{opt.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

          {/* Input Money Amount 💰 */}
          <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-700 border-4 border-blue-400/40 rounded-[36px] p-6 shadow-2xl shadow-blue-900/20 space-y-6 ring-8 ring-blue-500/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="amount-input" className="text-[11px] font-black uppercase tracking-widest text-sky-100 font-mono flex items-center gap-2 drop-shadow-sm">
                  <span>Type the Amount 💰</span>
                </label>
              </div>
              
              <div className="relative group">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-blue-600 font-mono group-focus-within:text-blue-700 transition-colors">₦</span>
                <input
                  id="amount-input"
                  type="text"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/,/g, '');
                    if (/^\d*\.?\d*$/.test(val)) {
                      setAmountInput(formatNumber(val));
                    }
                  }}
                  className="w-full bg-white border-2 border-blue-200/80 hover:border-blue-300 focus:border-blue-600 rounded-[24px] pl-12 pr-6 py-5 text-blue-950 font-mono text-3xl focus:outline-none font-black placeholder:text-blue-200 transition-all shadow-md shadow-blue-900/10"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Service Fee 💎 */}
            <div className="pt-6 border-t-2 border-dashed border-blue-400/40 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-[11px] font-black uppercase tracking-widest text-sky-100 font-mono flex items-center gap-2 drop-shadow-sm">
                  <span>Transaction Fee 💎</span>
                </label>
                
                <div className="flex bg-blue-950/30 p-1.5 rounded-[20px] shadow-inner gap-1 w-full max-w-sm ring-1 ring-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFeeWaived(false);
                      applyRecommendedFee();
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                      !isFeeWaived ? 'bg-white text-blue-600 shadow-[0_4px_12px_rgba(255,255,255,0.25)] ring-1 ring-blue-100' : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="text-sm sm:text-base">💳</span> Apply Charge
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFeeWaived(true);
                      setFeeInput('0');
                      setCustomerFee(0);
                    }}
                    className={`flex-1 py-2.5 px-3 rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                      isFeeWaived ? 'bg-white text-rose-600 shadow-[0_4px_12px_rgba(255,255,255,0.25)] ring-1 ring-rose-100' : 'text-blue-100 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="text-sm sm:text-base">🎉</span> Waive (₦0)
                  </button>
                </div>
              </div>

              {!isFeeWaived ? (
                <div className="relative group animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-blue-500 font-mono group-focus-within:text-blue-700 transition-colors">₦</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={feeInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/,/g, '');
                      if (/^\d*\.?\d*$/.test(val)) {
                        setFeeInput(formatNumber(val));
                      }
                    }}
                    className="w-full bg-white border-2 border-blue-200/80 hover:border-blue-300 focus:border-blue-600 rounded-[24px] pl-12 pr-6 py-4 text-blue-900 font-mono text-2xl focus:outline-none font-black placeholder:text-blue-200 transition-all shadow-md shadow-blue-900/10"
                    placeholder="0.00"
                  />
                </div>
              ) : (
                <div className="p-4 bg-white/10 border border-dashed border-blue-300/30 rounded-[20px] flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <span className="text-xl">🎉</span>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-black tracking-widest text-sky-100 font-mono">Charges Waived (₦0)</p>
                    <p className="text-[10px] text-sky-200 font-semibold leading-relaxed">This transaction fee is fully waived. The customer will not be charged any service commission fee.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fee Billing Method Selector Option - Custom OPay Settlement Guide */}
          {type === 'Withdrawal' ? (
            <div className="bg-gradient-to-b from-emerald-50/10 via-white to-white border-2 border-emerald-100 rounded-[32px] p-5 sm:p-6 space-y-5 shadow-lg shadow-emerald-50/20">
              
              {/* Scenario Toggle Block */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50 text-[#00B87A] text-xs shadow-2xs font-bold">💡</span>
                  <label className="block text-xs font-black uppercase tracking-wider text-neutral-600 font-sans">
                    Cashier Scenario (How is withdrawal specified?)
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    key="scenario-handout"
                    type="button"
                    onClick={() => setWithdrawScenario('CashHandout')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 leading-normal active:scale-[0.98] duration-150 ${
                      withdrawScenario === 'CashHandout'
                        ? 'bg-[#00B87A] border-[#00B87A] text-white shadow-md shadow-emerald-100 font-black'
                        : 'bg-white border-neutral-100 text-neutral-500 hover:text-neutral-800 hover:border-neutral-200'
                    }`}
                  >
                    <span className="text-sm font-extrabold">💵 Cash Handout</span>
                    <span className={`text-[10px] font-mono leading-none ${withdrawScenario === 'CashHandout' ? 'text-emerald-100 font-bold' : 'text-neutral-400 font-medium'}`}>
                      "Customer wants ₦{amount.toLocaleString()} Cash"
                    </span>
                  </button>
                  <button
                    key="scenario-swipe"
                    type="button"
                    onClick={() => setWithdrawScenario('CardSwipe')}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 leading-normal active:scale-[0.98] duration-150 ${
                      withdrawScenario === 'CardSwipe'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100 font-black'
                        : 'bg-white border-neutral-100 text-neutral-500 hover:text-neutral-800 hover:border-neutral-200'
                    }`}
                  >
                    <span className="text-sm font-extrabold">💳 Card Swipe</span>
                    <span className={`text-[10px] font-mono leading-none ${withdrawScenario === 'CardSwipe' ? 'text-blue-100 font-bold' : 'text-neutral-400 font-medium'}`}>
                      "Debit ₦{amount.toLocaleString()} from Card"
                    </span>
                  </button>
                </div>
              </div>

              {/* POS Charges Settlement Calculator Subtitle */}
              <div className="flex items-center gap-3 border-t border-b border-neutral-100 py-3 mt-1">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-[#00B87A] flex items-center justify-center text-white text-base shadow-sm shrink-0">
                  📟
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wide font-sans flex items-center gap-1.5 leading-none">
                    <span>{provider} POS Charges Settlement Calculator</span>
                  </h4>
                  <p className="text-[11px] text-neutral-500 font-semibold leading-normal">
                    Select how the customer is paying the charges (Add to Card vs Separate Cash).
                  </p>
                </div>
              </div>

              {/* Three Option Cards */}
              <div className="grid grid-cols-1 gap-3">
                
                {/* 1. Add Charges to Card Debit (YES) */}
                <button
                  type="button"
                  onClick={() => setWithdrawChargeMode('CardAddOn')}
                  className={`p-4 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 flex flex-col gap-3 active:scale-[0.99] ${
                    withdrawChargeMode === 'CardAddOn'
                      ? 'border-[#00B87A] bg-emerald-50/15 shadow-md ring-4 ring-emerald-500/5'
                      : 'border-neutral-100 bg-white hover:bg-neutral-50/50 hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs sm:text-[13px] font-black text-neutral-800 flex items-center gap-1.5 leading-none">
                      <span>💳</span> Card Add-on (Charges inside Card)
                    </span>
                    <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-850 font-mono tracking-wider shadow-2xs shrink-0 leading-none">
                      YES (Add charges)
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-600 font-semibold leading-relaxed space-y-2">
                    <p className="italic text-neutral-500">
                      Customer says: <strong className="text-neutral-800 font-extrabold">"Yes, add the charges to my card."</strong>
                    </p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <span className="bg-emerald-50 text-[#00B87A] border border-emerald-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        💳 Charge Terminal: {formatNaira(cardSwipe)}
                      </span>
                      <span className="bg-neutral-50 text-neutral-700 border border-neutral-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        💵 Hand out Cash: {formatNaira(cashHandout)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 2. Customer Pays Charges in Cash (NO) */}
                <button
                  type="button"
                  onClick={() => setWithdrawChargeMode('SeparateCash')}
                  className={`p-4 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 flex flex-col gap-3 active:scale-[0.99] ${
                    withdrawChargeMode === 'SeparateCash'
                      ? 'border-blue-500 bg-blue-50/15 shadow-md ring-4 ring-blue-500/5'
                      : 'border-neutral-100 bg-white hover:bg-neutral-50/50 hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs sm:text-[13px] font-black text-neutral-800 flex items-center gap-1.5 leading-none">
                      <span>💵</span> Separate Cash (Customer pays Cash)
                    </span>
                    <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-200 text-amber-850 font-mono tracking-wider shadow-2xs shrink-0 leading-none">
                      NO (Debit exactly base)
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-600 font-semibold leading-relaxed space-y-2">
                    <p className="italic text-neutral-500">
                      Customer says: <strong className="text-neutral-800 font-extrabold">"No, debit exactly {formatNaira(cardSwipe)}."</strong>
                    </p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <span className="bg-blue-50 text-blue-700 border border-blue-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        💳 Charge Terminal: {formatNaira(cardSwipe)}
                      </span>
                      <span className="bg-amber-50 text-amber-700 border border-amber-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        💵 Collect Cash Fee: {formatNaira(customerFee)}
                      </span>
                      <span className="bg-neutral-50 text-neutral-700 border border-neutral-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        💵 Hand out Cash: {formatNaira(cashHandout)}
                      </span>
                    </div>
                  </div>
                </button>

                {/* 3. Deduct Charges from Cash (Customer gets less cash) */}
                <button
                  type="button"
                  onClick={() => setWithdrawChargeMode('DeductFromCash')}
                  className={`p-4 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 flex flex-col gap-3 active:scale-[0.99] ${
                    withdrawChargeMode === 'DeductFromCash'
                      ? 'border-purple-500 bg-purple-50/15 shadow-md ring-4 ring-purple-500/5'
                      : 'border-neutral-100 bg-white hover:bg-neutral-50/50 hover:border-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs sm:text-[13px] font-black text-neutral-800 flex items-center gap-1.5 leading-none">
                      <span>✂️</span> Deduct from Cash (Give Less Cash)
                    </span>
                    <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg bg-purple-100 border border-purple-200 text-purple-850 font-mono tracking-wider shadow-2xs shrink-0 leading-none">
                      DEDUCT FROM CASH
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-600 font-semibold leading-relaxed space-y-2">
                    <p className="italic text-neutral-500">
                      Deduct the fee of {formatNaira(customerFee)} from the card amount and hand over the rest.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      <span className="bg-purple-50 text-purple-700 border border-purple-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        💳 Charge Terminal: {formatNaira(cardSwipe)}
                      </span>
                      <span className="bg-rose-50 text-rose-700 border border-rose-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        ✂️ Deduct Fee: {formatNaira(customerFee)}
                      </span>
                      <span className="bg-neutral-50 text-neutral-700 border border-neutral-150 px-2.5 py-1 rounded-lg font-mono text-[10px] font-black shadow-3xs">
                        💵 Hand out Cash: {formatNaira(cashHandout)}
                      </span>
                    </div>
                  </div>
                </button>

              </div>

              {/* LOSS PREVENTION ALERT FLAG */}
              {type === 'Withdrawal' && (
                <div className={`p-4 rounded-2xl border-l-4 flex gap-3.5 items-start animate-in fade-in slide-in-from-top-1 duration-250 shadow-xs ${
                  withdrawChargeMode === 'SeparateCash' 
                    ? 'bg-gradient-to-r from-amber-50/50 to-white border-amber-500 text-amber-900 shadow-sm shadow-amber-50/50'
                    : withdrawChargeMode === 'DeductFromCash'
                    ? 'bg-gradient-to-r from-purple-50/50 to-white border-purple-500 text-purple-900'
                    : 'bg-gradient-to-r from-emerald-50/50 to-white border-emerald-500 text-emerald-900'
                }`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                    withdrawChargeMode === 'SeparateCash' 
                      ? 'bg-amber-100 text-amber-600 animate-pulse'
                      : withdrawChargeMode === 'DeductFromCash'
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-emerald-100 text-emerald-600'
                  }`}>
                    {withdrawChargeMode === 'SeparateCash' ? '⚠️' : '💡'}
                  </div>
                  <div className="space-y-1 flex-1">
                    <h5 className="text-[10.5px] font-black uppercase tracking-wider font-sans leading-none">
                      {withdrawChargeMode === 'SeparateCash' ? 'Cashier Warning: Collect Cash Fee First!' : 'Cashier Instruction'}
                    </h5>
                    <p className="text-[11px] leading-relaxed font-sans font-semibold text-neutral-600">
                      {withdrawChargeMode === 'SeparateCash' ? (
                        <span>
                          The customer card will be debited <strong className="text-neutral-800 font-black">{formatNaira(cardSwipe)}</strong>. 
                          The terminal will settle only <strong className="text-neutral-800 font-black">{formatNaira(cardSwipe - liveTerminalFee - liveCbnCharge)}</strong> in your POS wallet.
                          <span className="block mt-1 text-rose-700 bg-rose-50 border border-rose-100 px-2.5 py-1.5 rounded-lg text-[10px] font-black leading-normal uppercase">
                            🚨 DO NOT GIVE THE CUSTOMER {formatNaira(cardSwipe)} CASH until they hand you {formatNaira(customerFee)} cash first!
                          </span>
                        </span>
                      ) : withdrawChargeMode === 'DeductFromCash' ? (
                        <span>
                          The customer card will be debited <strong className="text-neutral-800 font-black">{formatNaira(cardSwipe)}</strong>.
                          You must only count and give the customer exactly <strong className="text-purple-700 font-black">{formatNaira(cashHandout)} cash</strong>, because the fee is deducted from the cash!
                        </span>
                      ) : (
                        <span>
                          Excellent! The card will be debited <strong className="text-[#00B87A] font-black">{formatNaira(cardSwipe)}</strong> (includes the charge).
                          Hand over exactly <strong className="text-neutral-800 font-black">{formatNaira(cashHandout)} cash</strong> to the customer.
                          The rest stays as your business profit.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Dynamic Step-by-Step POS Reconciliation Guide */}
              <div className="bg-neutral-50/30 border border-neutral-200/60 rounded-2xl p-4 space-y-3 shadow-3xs">
                <div className="flex items-center justify-between border-b border-neutral-100 pb-2 text-[10px] text-neutral-400 font-black uppercase tracking-wider font-sans leading-none">
                  <span className="flex items-center gap-1.5">📋 Step-by-Step Action Guide</span>
                  <span>Amount</span>
                </div>
                <div className="space-y-2.5 font-sans text-[11px] font-semibold text-neutral-600">
                  {withdrawChargeMode === 'CardAddOn' ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-emerald-50 text-[#00B87A] text-[9px] font-black flex items-center justify-center border border-emerald-100 shrink-0">1</span>
                          <span>Input Amount on POS Terminal:</span>
                        </span>
                        <span className="text-emerald-600 font-mono font-black text-[12px]">
                          {formatNaira(cardSwipe)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-500">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">2</span>
                          <span>{provider} Terminal Fee ({activeFeeRate}%):</span>
                        </span>
                        <span className="font-mono text-[11px]">-{formatNaira(liveTerminalFee)}</span>
                      </div>
                      {liveCbnCharge > 0 && (
                        <div className="flex justify-between items-center text-neutral-500">
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">3</span>
                            <span>CBN EMTL Levy:</span>
                          </span>
                          <span className="font-mono text-[11px]">-{formatNaira(liveCbnCharge)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-blue-700 pt-2 border-t border-dashed border-neutral-200">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black flex items-center justify-center border border-blue-100 shrink-0">4</span>
                          <span className="font-bold">Settlement Received in POS Wallet:</span>
                        </span>
                        <span className="font-mono font-black text-[12px]">{formatNaira(cardSwipe - liveTerminalFee - liveCbnCharge)}</span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-600">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-600 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">5</span>
                          <span>Physical Cash given to Customer:</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-neutral-800">{formatNaira(cashHandout)}</span>
                      </div>
                      {(() => {
                        const profit = customerFee - liveTerminalFee - liveCbnCharge;
                        const isNeg = profit < 0;
                        const isLow = profit >= 0 && profit < 50;
                        return (
                          <div className={`flex justify-between items-center border-t border-neutral-200/80 pt-2 -mx-4 px-4 py-1.5 rounded-b-xl ${
                            isNeg 
                              ? 'bg-rose-50 text-rose-800' 
                              : isLow 
                                ? 'bg-amber-50 text-amber-800' 
                                : 'bg-emerald-50/50 text-emerald-800'
                          }`}>
                            <span className="font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5 leading-none">
                              <span>{isNeg ? '🚨' : isLow ? '⚠️' : '🎉'}</span> Reconciled Agent Profit:
                            </span>
                            <span className="font-mono font-extrabold text-[13px] leading-none">
                              {profit >= 0 ? '+' : ''}{formatNaira(profit)}
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  ) : withdrawChargeMode === 'SeparateCash' ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black flex items-center justify-center border border-blue-100 shrink-0">1</span>
                          <span>Input Amount on POS Terminal:</span>
                        </span>
                        <span className="text-blue-600 font-mono font-black text-[12px]">
                          {formatNaira(cardSwipe)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-500">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">2</span>
                          <span>{provider} Terminal Fee ({activeFeeRate}%):</span>
                        </span>
                        <span className="font-mono text-[11px]">-{formatNaira(liveTerminalFee)}</span>
                      </div>
                      {liveCbnCharge > 0 && (
                        <div className="flex justify-between items-center text-neutral-500">
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">3</span>
                            <span>CBN EMTL Levy:</span>
                          </span>
                          <span className="font-mono text-[11px]">-{formatNaira(liveCbnCharge)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-blue-700 pt-2 border-t border-dashed border-neutral-200">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black flex items-center justify-center border border-blue-100 shrink-0">4</span>
                          <span className="font-bold">Settlement Received in POS Wallet:</span>
                        </span>
                        <span className="font-mono font-black text-[12px]">{formatNaira(cardSwipe - liveTerminalFee - liveCbnCharge)}</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-600">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black flex items-center justify-center border border-emerald-100 shrink-0">5</span>
                          <span>Physical Fee Cash Collected:</span>
                        </span>
                        <span className="font-mono font-extrabold text-[11px]">+{formatNaira(customerFee)}</span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-600">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-600 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">6</span>
                          <span>Physical Cash given to Customer:</span>
                        </span>
                        <span className="font-mono text-[11px] font-bold text-neutral-800">{formatNaira(cashHandout)}</span>
                      </div>
                      {(() => {
                        const profit = customerFee - liveTerminalFee - liveCbnCharge;
                        const isNeg = profit < 0;
                        const isLow = profit >= 0 && profit < 50;
                        return (
                          <div className={`flex justify-between items-center border-t border-neutral-200/80 pt-2 -mx-4 px-4 py-1.5 rounded-b-xl ${
                            isNeg 
                              ? 'bg-rose-50 text-rose-800' 
                              : isLow 
                                ? 'bg-amber-50 text-amber-800' 
                                : 'bg-emerald-50/50 text-emerald-800'
                          }`}>
                            <span className="font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5 leading-none">
                              <span>{isNeg ? '🚨' : isLow ? '⚠️' : '🎉'}</span> Reconciled Agent Profit:
                            </span>
                            <span className="font-mono font-extrabold text-[13px] leading-none">
                              {profit >= 0 ? '+' : ''}{formatNaira(profit)}
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-50 text-neutral-700 text-[9px] font-black flex items-center justify-center border border-neutral-200 shrink-0">1</span>
                          <span>Input Amount on POS Terminal:</span>
                        </span>
                        <span className="text-neutral-800 font-mono font-black text-[12px]">
                          {formatNaira(cardSwipe)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-500">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">2</span>
                          <span>{provider} Terminal Fee ({activeFeeRate}%):</span>
                        </span>
                        <span className="font-mono text-[11px]">-{formatNaira(liveTerminalFee)}</span>
                      </div>
                      {liveCbnCharge > 0 && (
                        <div className="flex justify-between items-center text-neutral-500">
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-500 text-[9px] font-black flex items-center justify-center border border-neutral-150 shrink-0">3</span>
                            <span>CBN EMTL Levy:</span>
                          </span>
                          <span className="font-mono text-[11px]">-{formatNaira(liveCbnCharge)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-blue-700 pt-2 border-t border-dashed border-neutral-200">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black flex items-center justify-center border border-blue-100 shrink-0">4</span>
                          <span className="font-bold">Settlement Received in POS Wallet:</span>
                        </span>
                        <span className="font-mono font-black text-[12px]">{formatNaira(cardSwipe - liveTerminalFee - liveCbnCharge)}</span>
                      </div>
                      <div className="flex justify-between items-center text-purple-700">
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-purple-50 text-purple-600 text-[9px] font-black flex items-center justify-center border border-purple-100 shrink-0">5</span>
                          <span>Cash to hand over (Charges Deducted):</span>
                        </span>
                        <span className="font-mono font-extrabold text-[11px]">{formatNaira(cashHandout)}</span>
                      </div>
                      {(() => {
                        const profit = customerFee - liveTerminalFee - liveCbnCharge;
                        const isNeg = profit < 0;
                        const isLow = profit >= 0 && profit < 50;
                        return (
                          <div className={`flex justify-between items-center border-t border-neutral-200/80 pt-2 -mx-4 px-4 py-1.5 rounded-b-xl ${
                            isNeg 
                              ? 'bg-rose-50 text-rose-800' 
                              : isLow 
                                ? 'bg-amber-50 text-amber-800' 
                                : 'bg-emerald-50/50 text-emerald-800'
                          }`}>
                            <span className="font-black uppercase tracking-wider text-[10px] flex items-center gap-1.5 leading-none">
                              <span>{isNeg ? '🚨' : isLow ? '⚠️' : '🎉'}</span> Reconciled Agent Profit:
                            </span>
                            <span className="font-mono font-extrabold text-[13px] leading-none">
                              {profit >= 0 ? '+' : ''}{formatNaira(profit)}
                            </span>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-50/55 border border-neutral-200 rounded-2xl p-4 space-y-2.5 shadow-xs">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
                💳 Dynamic Fee Billing Method (Customer Amount Debit)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFeeMethod('Cash')}
                  className={`py-2 text-[11px] font-extrabold rounded-xl transition cursor-pointer border text-center uppercase font-mono flex items-center justify-center gap-1.5 ${
                    feeMethod === 'Cash'
                      ? 'bg-[#00B87A] text-white border-[#00B87A] font-black'
                      : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-600'
                  }`}
                >
                  <span> In-Cash (Standard)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeeMethod('CardDebit')}
                  className={`py-2 text-[11px] font-extrabold rounded-xl transition cursor-pointer border text-center uppercase font-mono flex items-center justify-center gap-1.5 ${
                    feeMethod === 'CardDebit'
                      ? 'bg-[#00B87A] text-white border-[#00B87A] font-black'
                      : 'bg-white hover:bg-neutral-100 border-neutral-200 text-neutral-600'
                  }`}
                >
                  <span> Deduct from Withdrawal (Split)</span>
                </button>
              </div>
              <p className="text-[10px] text-neutral-450 leading-relaxed font-sans">
                {feeMethod === 'Cash' ? (
                  <span>Customer debited <strong>{formatNaira(amount)}</strong>. Fee of <strong>{formatNaira(customerFee)}</strong> is collected separately in cash.</span>
                ) : (
                  <span>Customer debited <strong>{formatNaira(amount + customerFee)}</strong>. Total amount includes fee deducted from total withdrawal.</span>
                )}
              </p>
            </div>
          )}
          <div className="bg-neutral-50 border border-neutral-100 p-3 rounded-xl flex items-center justify-between">
            <span className="text-xs text-neutral-550 font-medium">Employee Shift Authority:</span>
            {currentUser.role === 'Manager' ? (
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="bg-white border border-neutral-250 text-[#00B87A] rounded-lg px-2.5 py-1 text-xs font-bold font-mono focus:outline-none focus:border-[#00B87A] focus:ring-1 focus:ring-[#00B87A] cursor-pointer"
              >
                <option value={currentUser.id}>{currentUser.name} (Manager)</option>
                {availableEmployees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} (Employee)
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-black text-[#00B87A] font-mono">{currentUser.name}</span>
            )}
          </div>

          <div className="h-2" />

          {mode === 'SplitSession' && (
            <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-5 space-y-5 animate-in slide-in-from-top-2 duration-300 shadow-sm mt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-2xl bg-[#00B87A] text-white flex items-center justify-center text-xs font-black shadow-lg shadow-emerald-100">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-[#00B87A] font-mono leading-none">
                        Split Task Distribution
                      </label>
                      <p className="text-[9px] text-emerald-600/80 font-bold">Configure payouts for this session.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-8">
                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 font-mono">
                    Distribution Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Transfer', 'Airtime', 'Data'] as const).map((d) => {
                      const isSelected = distributionType === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDistributionType(d)}
                          className={`py-2 px-1 rounded-xl text-[9px] font-black border transition-all cursor-pointer text-center ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                              : 'bg-white border-neutral-200 text-neutral-500'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[9px] font-black uppercase tracking-widest text-neutral-400 font-mono">
                    Distribution Machine
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['OPay', 'Moniepoint', 'PalmPay'] as const).map((p) => {
                      const isSelected = distributionProvider === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDistributionProvider(p)}
                          className={`py-2 px-1 rounded-xl text-[9px] font-black border transition-all cursor-pointer text-center ${
                            isSelected 
                              ? 'bg-amber-600 border-amber-600 text-white shadow-md' 
                              : 'bg-white border-neutral-100 text-neutral-500'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              
              <div className="space-y-4 pt-1">
                {subTransfers.map((st, index) => (
                  <div 
                    key={index} 
                    className="bg-white border border-neutral-200 p-4 rounded-xl space-y-3.5 shadow-xs relative hover:border-[#00B87A]/40 transition-all group"
                  >
                    {/* Header Row with Serial Number and Delete button */}
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                      <div className="flex items-center gap-2">
                         <div className="w-5 h-5 rounded-md bg-neutral-100 text-neutral-500 flex items-center justify-center text-[9px] font-bold font-mono">
                          {index + 1}
                        </div>
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest font-mono">
                          {distributionType} SEGMENT
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {remainingBalance > 0 && index === subTransfers.length - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newSub = [...subTransfers];
                              newSub[index].amount += remainingBalance;
                              setSubTransfers(newSub);
                            }}
                            className="text-[8px] font-black uppercase text-[#00B87A] bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 hover:bg-emerald-100 transition-all"
                          >
                            Fill Balance
                          </button>
                        )}
                        {subTransfers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newSub = [...subTransfers];
                              newSub.splice(index, 1);
                              setSubTransfers(newSub);
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-neutral-450 uppercase tracking-widest font-mono">Recipient Name</label>
                        <div className="relative">
                          <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                          <input
                            type="text"
                            value={st.recipientName}
                            onChange={(e) => {
                              const newSub = [...subTransfers];
                              newSub[index].recipientName = e.target.value;
                              setSubTransfers(newSub);
                            }}
                            placeholder="Beneficiary Name"
                            className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-neutral-450 uppercase tracking-widest font-mono">
                          {distributionType === 'Transfer' ? 'Account Number' : 'Phone Number'}
                        </label>
                        <div className="relative">
                          {distributionType === 'Transfer' ? (
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                          ) : (
                            <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                          )}
                          <input
                            type="text"
                            value={st.accountNumber}
                            onChange={(e) => {
                              const newSub = [...subTransfers];
                              newSub[index].accountNumber = e.target.value;
                              setSubTransfers(newSub);
                            }}
                            placeholder={distributionType === 'Transfer' ? "10-digit number" : "Phone number"}
                            className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-bold font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-black text-neutral-450 uppercase tracking-widest font-mono">Allocation Amount</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-neutral-500 font-mono">₦</span>
                        <input
                          type="number"
                          value={st.amount || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const newSub = [...subTransfers];
                            newSub[index].amount = val;
                            setSubTransfers(newSub);
                          }}
                          placeholder="0.00"
                          className="w-full pl-7 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-black font-mono text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setSubTransfers([...subTransfers, { recipientName: '', accountNumber: '', amount: 0 }])}
                  className="flex items-center gap-2.5 px-6 py-3.5 bg-neutral-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border-none hover:bg-neutral-800 transition-all cursor-pointer shadow-xl active:scale-95"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-400" /> 
                  Add Distribution Task
                </button>
                
                <div className="flex flex-col items-end">
                   <div className={`text-[10px] font-black font-mono flex items-center gap-1.5 ${remainingBalance < 0 ? 'text-red-600' : 'text-neutral-500'}`}>
                    {remainingBalance < 0 ? <AlertTriangle className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                    <span>{remainingBalance < 0 ? 'Shortfall:' : 'Cash to Cust:'}</span>
                    <span className="text-xs">{formatNaira(Math.abs(remainingBalance))}</span>
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-bold text-neutral-700 bg-white/60 border border-neutral-100 p-4 rounded-xl space-y-2 shadow-inner">
                  <div className="flex justify-between items-center text-neutral-500">
                    <span className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-wider">
                      <Download className="w-3 h-3 text-emerald-500" /> Gross Inflow:
                    </span>
                    <span className="font-mono font-bold text-neutral-800">{formatNaira(amount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-500">
                    <span className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-wider">
                      <ArrowUpRight className="w-3 h-3 text-blue-500" /> Outflow Sum:
                    </span>
                    <span className="font-mono font-bold text-red-500">-{formatNaira(subTransfers.reduce((sum, st) => sum + st.amount, 0))}</span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-500">
                    <span className="flex items-center gap-1.5 font-bold uppercase text-[9px] tracking-wider">
                      <ShieldCheck className="w-3 h-3 text-amber-500" /> Service Commission:
                    </span>
                    {isFeeWaived ? (
                      <span className="text-rose-600 font-extrabold uppercase font-mono tracking-wider text-[9px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 animate-pulse">Waived (₦0)</span>
                    ) : (
                      <span className="font-mono font-bold text-red-500">-{formatNaira(customerFee)}</span>
                    )}
                  </div>
                <div className="flex justify-between pt-2 border-t border-neutral-100 mt-1">
                  <span className="text-xs font-black uppercase text-neutral-600">Physical Cash Balance:</span>
                  <span className={`text-sm font-black font-mono ${remainingBalance < 0 ? 'text-red-600 animate-pulse' : 'text-[#00B87A]'}`}>
                    {formatNaira(remainingBalance)}
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Transaction Result 🌈 */}
          <div className="space-y-4">
            <label className="block text-[10px] font-black uppercase tracking-widest text-neutral-400 font-mono flex items-center gap-2">
              <span>Transaction Status 📊</span>
              <div className="h-px flex-1 bg-neutral-100" />
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['Success', 'Pending', 'Failed'] as const).map((s) => {
                const isActive = status === s;
                const activeColors = {
                  Success: 'bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-200 ring-4 ring-emerald-50',
                  Pending: 'bg-amber-500 border-amber-500 text-white shadow-xl shadow-amber-200 ring-4 ring-amber-50',
                  Failed: 'bg-red-500 border-red-500 text-white shadow-xl shadow-red-200 ring-4 ring-red-50'
                };
                
                const labels = {
                  Success: '✅ SUCCESS',
                  Pending: '⏳ PENDING',
                  Failed: '❌ DECLINE'
                };

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setStatus(s);
                      if (!settings || settings.soundEnabled) {
                        playStatusSound(s);
                      }
                    }}
                    className={`py-4 px-2 rounded-[24px] border-2 transition-all duration-300 text-[11px] font-black uppercase tracking-tighter flex flex-col items-center gap-1 active:scale-95 ${
                      isActive 
                        ? activeColors[s] + ' scale-[1.05]'
                        : 'bg-neutral-50 border-neutral-100 text-neutral-400 hover:border-neutral-200'
                    }`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unpaid / Paid Charges Toggle */}
          <div className="bg-gradient-to-br from-[#5D4037] via-[#4E342E] to-[#3E2723] border-4 border-[#8D6E63]/40 rounded-[36px] p-6 shadow-2xl shadow-stone-950/20 space-y-4 ring-8 ring-[#4E342E]/10 animate-in fade-in slide-in-from-top-3 duration-250">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black uppercase tracking-widest text-[#D7CCC8] font-mono flex items-center gap-2 drop-shadow-sm">
                <span>⏳ CHARGES PAYMENT STATUS</span>
              </label>
              <span className="bg-[#D7CCC8]/15 text-[#F5F5F5] text-[9px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#D7CCC8]/25">
                DEFER CHARGES OPTION
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setChargesStatus('Paid')}
                className={`py-3.5 px-3 rounded-[20px] text-[11px] sm:text-xs font-black border-2 transition-all duration-300 cursor-pointer text-center uppercase font-mono flex items-center justify-center gap-1.5 active:scale-95 ${
                  chargesStatus === 'Paid'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-400 text-white font-black shadow-lg shadow-emerald-950/40 ring-4 ring-emerald-500/25'
                    : 'bg-[#D7CCC8]/10 border-[#8D6E63]/60 text-[#D7CCC8] hover:bg-[#D7CCC8]/20 hover:text-white'
                }`}
              >
                <span>✓ PAID NOW</span>
              </button>
              <button
                type="button"
                onClick={() => setChargesStatus('Unpaid')}
                className={`py-3.5 px-3 rounded-[20px] text-[11px] sm:text-xs font-black border-2 transition-all duration-300 cursor-pointer text-center uppercase font-mono flex items-center justify-center gap-1.5 active:scale-95 ${
                  chargesStatus === 'Unpaid'
                    ? 'bg-gradient-to-r from-amber-500 to-[#FF9800] border-amber-400 text-stone-950 font-black shadow-lg shadow-amber-950/40 animate-pulse ring-4 ring-amber-500/25'
                    : 'bg-[#D7CCC8]/10 border-[#8D6E63]/60 text-[#D7CCC8] hover:bg-[#D7CCC8]/20 hover:text-white'
                }`}
              >
                <span>⏳ PAY LATER (UNPAID)</span>
              </button>
            </div>
          </div>

          {/* Customer Details - Beautiful and Professional */}
          <div className="bg-gradient-to-br from-emerald-600 via-teal-500 to-emerald-700 border-4 border-emerald-400/40 rounded-[36px] p-6 space-y-5 shadow-2xl shadow-emerald-900/20 ring-8 ring-emerald-500/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-950/30 text-emerald-100 flex items-center justify-center shadow-inner ring-1 ring-white/10">
                <UserCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-emerald-50 font-mono leading-none drop-shadow-sm">Customer Info</h3>
                <p className="text-[9px] text-emerald-100 font-bold uppercase mt-1 tracking-tighter opacity-90">Optional details for receipt</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <label htmlFor="customer-name" className="block text-[9px] font-black uppercase tracking-widest text-emerald-100 font-mono ml-1 drop-shadow-sm">
                  Account Name {chargesStatus === 'Unpaid' && <span className="text-amber-300 font-black animate-pulse">*</span>}
                </label>
                <div className="relative">
                  <input
                    id="customer-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={`w-full bg-white border-2 ${chargesStatus === 'Unpaid' && !customerName ? 'border-amber-400 shadow-md ring-4 ring-amber-300/30' : 'border-emerald-200/80'} rounded-2xl pl-4 pr-10 py-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-black transition-all shadow-md shadow-emerald-900/10`}
                    placeholder="e.g. ALIYA MUSA"
                    required={chargesStatus === 'Unpaid'}
                  />
                  {speechSupported ? (
                    <button
                      type="button"
                      onClick={() => toggleListening('customerName')}
                      className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors duration-200 cursor-pointer flex items-center justify-center ${
                        isListening && activeDictationField === 'customerName'
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'text-emerald-600 hover:text-white hover:bg-emerald-500/20'
                      }`}
                      title={isListening && activeDictationField === 'customerName' ? 'Stop voice recording' : 'Dictate name hands-free'}
                    >
                      {isListening && activeDictationField === 'customerName' ? (
                        <Mic className="w-3.5 h-3.5 animate-bounce" />
                      ) : (
                        <Mic className="w-3.5 h-3.5" />
                      )}
                    </button>
                  ) : (
                    <div
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-300/60"
                      title="Speech recognition not supported on this browser context"
                    >
                      <MicOff className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                {isListening && activeDictationField === 'customerName' && (
                  <span className="text-[9px] text-emerald-100 font-semibold font-mono flex items-center gap-1.5 mt-1 animate-pulse ml-1 drop-shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-200" /> Recording name... speak clearly
                  </span>
                )}
                {speechError && activeDictationField === 'customerName' && (
                  <span className="text-[9px] text-red-200 font-semibold font-mono flex items-center gap-1.5 mt-1 ml-1 drop-shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-450" /> {speechError}
                  </span>
                )}
              </div>
              
              <div className="space-y-1.5">
                <label htmlFor="account-number" className="block text-[9px] font-black uppercase tracking-widest text-emerald-100 font-mono ml-1 drop-shadow-sm">
                  Account Number
                </label>
                <input
                  id="account-number"
                  type="text"
                  value={customerAccountNumber}
                  onChange={(e) => setCustomerAccountNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-white border-2 border-emerald-200/80 rounded-2xl px-4 py-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-mono font-black transition-all shadow-md shadow-emerald-900/10"
                  placeholder="0123456789"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="phone-input" className="block text-[9px] font-black uppercase tracking-widest text-emerald-100 font-mono ml-1 drop-shadow-sm">
                Phone Number
              </label>
              <input
                id="phone-input"
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white border-2 border-emerald-200/80 rounded-2xl px-4 py-3 text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 font-mono font-black transition-all shadow-md shadow-emerald-900/10"
                placeholder="0801 234 5678"
              />
            </div>
          </div>

              {chargesStatus === 'Unpaid' && (
                <div className="text-[9px] text-amber-700 leading-relaxed font-semibold bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 flex items-start gap-2 animate-pulse">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <p>
                    Fee of <span className="text-amber-900 font-black">{formatNaira(customerFee)}</span> will be tracked as a debt under the name above.
                  </p>
                </div>
              )}

          {/* Optional Operation Notes */}
          <div>
            <label htmlFor="notes-input" className="block text-xs font-bold uppercase tracking-wider text-neutral-450 mb-2 font-mono">
              Notes
            </label>
            <div className="relative">
              <input
                id="notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl pl-3 pr-10 py-2.5 text-neutral-800 focus:outline-none focus:border-[#00B87A] text-xs font-medium"
                placeholder="e.g. Card transaction, or custom customer message..."
              />
              {speechSupported ? (
                <button
                  type="button"
                  onClick={() => toggleListening('notes')}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors duration-200 cursor-pointer flex items-center justify-center ${
                    isListening && activeDictationField === 'notes'
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'text-neutral-400 hover:text-[#00B87A] hover:bg-neutral-100'
                  }`}
                  title={isListening && activeDictationField === 'notes' ? 'Stop voice recording' : 'Dictate notes hands-free'}
                >
                  {isListening && activeDictationField === 'notes' ? (
                    <Mic className="w-3.5 h-3.5 animate-bounce" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <div
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-300"
                  title="Speech recognition not supported on this browser context"
                >
                  <MicOff className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            {isListening && activeDictationField === 'notes' && (
              <span className="text-[10px] text-[#00B87A] font-medium font-mono flex items-center gap-1.5 mt-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00B87A]" /> Recording audio... speak details clearly now
              </span>
            )}
            {speechError && activeDictationField === 'notes' && (
              <span className="text-[10px] text-red-500 font-medium font-mono flex items-center gap-1.5 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {speechError}
              </span>
            )}
            <div className="mt-2">
              <AudioRecorder onSave={setAudioNote} initialAudio={audioNote} />
            </div>
          </div>


          {/* Live Projected Commission Computation Section */}
          <div className="mt-4">
            {/* Live computes summary block */}
            <div className={`p-5 rounded-3xl border transition-all duration-300 ${
              !liveFinancials.isConfigured && amount > 0 
                ? 'bg-rose-50/50 border-rose-200 shadow-sm animate-pulse' 
                : 'bg-emerald-50/30 border-emerald-500/10 shadow-xs'
            }`}>
              
              {/* Card Header with Real-time indicators */}
              <div className="flex items-center justify-between gap-2.5 mb-4 pb-3 border-b border-neutral-200/40">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className={`text-[10px] font-black font-mono tracking-widest uppercase ${
                    liveFinancials.isConfigured || amount === 0 ? 'text-emerald-700' : 'text-red-650'
                  }`}>
                    {liveFinancials.isConfigured || amount === 0 ? 'LIVE PROJECTED COMMISSION COMPUTATION' : 'PRICING ERROR: NOT CONFIGURED'}
                  </span>
                </div>
                <span className="text-[8.5px] font-black font-mono text-neutral-500 bg-neutral-100/80 border border-neutral-200/40 px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
                  REAL-TIME CALCULATOR
                </span>
              </div>
              
              {/* Main Dynamic View Area */}
              {!liveFinancials.isConfigured && amount > 0 ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3.5">
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
                  <div className="space-y-1">
                    <h5 className="text-[11px] font-black text-red-800 uppercase tracking-wider font-mono">
                      Pricing Rule Missing
                    </h5>
                    <p className="text-[10.5px] font-bold text-red-700 leading-snug">
                      {liveFinancials.error || "No active pricing rule was found in Firestore for this combination of amount, type, and terminal provider."}
                    </p>
                    <p className="text-[9.5px] font-bold text-red-500 leading-normal">
                      👉 Please go to settings and configure a pricing range that covers {formatNaira(amount)} for {type} ({provider}).
                    </p>
                  </div>
                </div>
              ) : amount > 0 ? (
                <div className="space-y-4">
                  {/* Grid of the 4 Key Financial Metrics - Spacious & clear */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                    
                    {/* Metric 1: Terminal Cost */}
                    <div className="bg-red-50/50 border border-red-100/80 p-3 rounded-2xl transition-all hover:bg-red-50 hover:shadow-xs flex flex-col justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-red-700/80 font-bold uppercase tracking-wider">
                        <Cpu className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                        <span className="text-[8px] truncate">Machine Cost</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[14px] sm:text-[15px] font-black font-mono text-red-600 leading-none block truncate">
                          -{formatNaira(liveTerminalFee)}
                        </span>
                        <span className="text-[8.5px] text-neutral-400 font-bold block leading-tight">
                          Paid to {provider}
                        </span>
                      </div>
                    </div>

                    {/* Metric 2: CBN EMTL Levy */}
                    <div className="bg-amber-50/50 border border-amber-100/80 p-3 rounded-2xl transition-all hover:bg-amber-50 hover:shadow-xs flex flex-col justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-amber-700/80 font-bold uppercase tracking-wider">
                        <Landmark className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                        <span className="text-[8px] truncate">Govt Levy</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[14px] sm:text-[15px] font-black font-mono text-red-600 leading-none block truncate">
                          -{formatNaira(liveCbnCharge)}
                        </span>
                        <span className="text-[8.5px] text-neutral-400 font-bold block leading-tight">
                          CBN Stamp Duty
                        </span>
                      </div>
                    </div>

                    {/* Metric 3: Client Fee Collected */}
                    <div className="bg-indigo-50/50 border border-indigo-100/80 p-3 rounded-2xl transition-all hover:bg-indigo-50 hover:shadow-xs flex flex-col justify-between gap-1.5 min-w-0">
                      <div className="flex items-center gap-1.5 text-indigo-700/80 font-bold uppercase tracking-wider">
                        <Wallet className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                        <span className="text-[8px] truncate">Client Fee</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[14px] sm:text-[15px] font-black font-mono text-indigo-700 leading-none block truncate">
                          +{formatNaira(customerFee)}
                        </span>
                        <span className="text-[8.5px] text-neutral-400 font-bold block leading-tight">
                          We collected
                        </span>
                      </div>
                    </div>

                    {/* Metric 4: Net Profit (The Prize) */}
                    {(() => {
                      const liveNetProfit = customerFee - liveTerminalFee - liveCbnCharge;
                      const isNegative = liveNetProfit < 0;
                      const isBelowThreshold = liveNetProfit >= 0 && liveNetProfit < 50;

                      return (
                        <div className={`border p-3 rounded-2xl transition-all hover:shadow-md flex flex-col justify-between gap-1.5 min-w-0 ring-4 ring-current/5 ${
                          isNegative 
                            ? 'bg-rose-600 text-white border-rose-700 shadow-sm' 
                            : isBelowThreshold
                              ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                              : 'bg-[#00B87A] text-white border-emerald-600 shadow-sm'
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider opacity-90">
                            <Banknote className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                            <span className="text-[8px] truncate">Net Earnings</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[14px] sm:text-[15px] font-black font-mono leading-none block truncate">
                              {formatNaira(liveNetProfit)}
                            </span>
                            <span className="text-[8.5px] opacity-80 font-bold block leading-tight">
                              Our Take-home
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                  </div>

                  {/* Dynamic Profit Profile & Margin Safety Alert Banner */}
                  {(() => {
                    const activeProfile = settings?.pricingProfiles && Array.isArray(settings.pricingProfiles) && settings.pricingProfiles.length > 0
                      ? settings.pricingProfiles.find(p => p.id === (settings.selectedProfileId || provider)) || settings.pricingProfiles[0]
                      : { name: 'Realistic Default' };

                    const liveNetProfit = customerFee - liveTerminalFee - liveCbnCharge;
                    const isNegative = liveNetProfit < 0;
                    const isBelowThreshold = liveNetProfit >= 0 && liveNetProfit < 50;

                    if (isNegative) {
                      return (
                        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 shadow-xs">
                          <div className="p-1.5 bg-red-600 text-white rounded-xl shrink-0 mt-0.5 animate-pulse">
                            <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[10px] font-black text-red-800 uppercase tracking-wider font-mono">
                              CRITICAL: NEGATIVE PROFIT MARGIN 🚨
                            </h4>
                            <p className="text-[11px] text-red-700 font-bold leading-snug">
                              This transaction will result in a loss of <span className="text-red-900 font-black">{formatNaira(Math.abs(liveNetProfit))}</span>! 
                            </p>
                            <p className="text-[9.5px] text-red-600 font-semibold leading-relaxed">
                              Under active profile <span className="underline font-bold">"{activeProfile.name}"</span>, the machine cost and CBN levies exceed the client fee. Consider adjusting manual fee overrides or using another POS terminal.
                            </p>
                          </div>
                        </div>
                      );
                    } else if (isBelowThreshold) {
                      return (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-xs">
                          <div className="p-1.5 bg-amber-500 text-white rounded-xl shrink-0 mt-0.5">
                            <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-[10px] font-black text-amber-800 uppercase tracking-wider font-mono">
                              WARNING: LOW PROFIT MARGIN ⚠️
                            </h4>
                            <p className="text-[11px] text-amber-700 font-bold leading-snug">
                              Net profit of <span className="text-amber-950 font-black">{formatNaira(liveNetProfit)}</span> is below the recommended ₦50 minimum safety margin.
                            </p>
                            <p className="text-[9.5px] text-amber-650 font-semibold leading-relaxed">
                              Based on the active profile <span className="underline font-bold">"{activeProfile.name}"</span>. Low-profit tickets reduce overall daily station yield.
                            </p>
                          </div>
                        </div>
                      );
                    }
                    
                    return null;
                  })()}

                  {/* Easy summary statement for less-literated operators */}
                  <div className="p-3.5 rounded-2xl bg-white border border-neutral-200 shadow-xs flex items-start gap-3 text-[11px] font-bold text-neutral-600 leading-relaxed">
                    <div className="p-1.5 rounded-xl bg-emerald-50 text-[#00B87A] shrink-0 mt-0.5">
                      <Zap className="w-4 h-4 stroke-[2.5] animate-pulse" />
                    </div>
                    <p>
                      You collected <span className="font-extrabold text-neutral-950 font-mono">{formatNaira(customerFee)}</span> in fee. After paying <span className="font-extrabold text-neutral-900 font-mono">{formatNaira(liveTerminalFee + liveCbnCharge)}</span> for machine costs & levies, you gain <span className="font-black text-[#00B87A] font-mono text-xs underline underline-offset-2 decoration-dotted">{formatNaira(customerFee - liveTerminalFee - liveCbnCharge)}</span> as real pocket profit on this ticket!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-6 px-4 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-2xl bg-white text-center">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-2.5">
                    <Banknote className="w-5 h-5 text-neutral-400" />
                  </div>
                  <span className="text-[10px] font-black text-neutral-600 tracking-wider uppercase font-mono mb-1">
                    Waiting for Amount Inflow
                  </span>
                  <p className="text-[10px] text-neutral-450 font-bold max-w-xs leading-normal">
                    Enter the transaction amount above. The live engine will immediately compute fees, provider deductions, and your net profit segment here.
                  </p>
                </div>
              )}

            </div>
          </div>


          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-w-[80px] bg-neutral-100 hover:bg-neutral-150 border border-neutral-200 text-neutral-600 font-bold py-3 rounded-2xl cursor-pointer text-xs text-center transition"
            >
              Cancel
            </button>
            
            {!initialTransaction && (
              <button
                type="button"
                onClick={handleAddToBasket}
                disabled={!isFormValid}
                className={`flex-1 min-w-[130px] font-extrabold py-3 rounded-2xl cursor-pointer text-xs transition flex items-center justify-center gap-1.5 ${
                  isFormValid 
                    ? 'bg-neutral-50 hover:bg-neutral-100 border border-[#00B87A]/30 hover:border-[#00B87A] text-[#00B87A]' 
                    : 'bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed'
                }`}
                title={isFormValid ? "Add current transaction to batch ticket and start another" : (mode === 'SplitSession' ? "Complete all distributions before adding to batch" : "Pricing rule missing - cannot add to batch")}
              >
                <Plus className={`w-4 h-4 stroke-[2] ${isFormValid ? 'text-[#00B87A]' : 'text-neutral-300'}`} />
                Add to Batch
              </button>
            )}

            <button
              type="submit"
              disabled={!isFormValid}
              className={`flex-1 min-w-[140px] font-extrabold py-3 rounded-2xl cursor-pointer text-xs shadow-lg transition flex items-center justify-center gap-1.5 ${
                isFormValid 
                  ? 'bg-[#00B87A] hover:bg-emerald-600 text-white shadow-[#00B87A]/20' 
                  : 'bg-neutral-300 text-neutral-500 shadow-none cursor-not-allowed'
              }`}
            >
              {isFormValid ? <Check className="w-4 h-4 stroke-[3]" /> : <Lock className="w-4 h-4" />}
              {initialTransaction 
                ? 'Update Receipt' 
                : basket.length > 0 
                  ? 'Confirm & Save All' 
                  : (mode === 'SplitSession' ? 'Confirm & Process Distribution' : (liveFinancials.isConfigured ? 'Confirm Receipt' : 'Pricing Restricted'))}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
