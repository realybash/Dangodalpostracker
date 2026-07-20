import React, { useState, useEffect } from 'react';
import {  BorrowKeepTransaction } from '../types';
import {  db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import {  collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { copyToClipboard,    formatNaira, isSameDay, isSameWeek, isSameMonth, isSameYear } from '../utils';
import {  AudioRecorder } from './AudioRecorder';
import {  
  UserPlus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Wallet, 
  Repeat, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Link2, 
  Plus, 
  Trash2, 
  Filter, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  X,
  Sparkles,
  Share2,
  Printer,
  Copy,
  ShieldAlert,
  Calendar,
  User,
  Info,
  Camera,
  RefreshCw
} from 'lucide-react';

export function BorrowKeepSection({ state, syncOwnerId }: { state: any; syncOwnerId: string | null }) {
  const isCloudMode = !!syncOwnerId;
  const [transactions, setTransactions] = useState<BorrowKeepTransaction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<BorrowKeepTransaction['type']>('loan_given');
  const [notes, setNotes] = useState('');
  const [audioNote, setAudioNote] = useState('');
  const [linkedTransactionId, setLinkedTransactionId] = useState('');

  // Camera Integration for Kept Money Dispute Prevention (Front & Back Views)
  const [cameraActive, setCameraActive] = useState(false);
  const [photoFront, setPhotoFront] = useState<string | null>(null);
  const [photoBack, setPhotoBack] = useState<string | null>(null);
  const [activeTargetSlot, setActiveTargetSlot] = useState<'front' | 'back' | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraSize, setCameraSize] = useState<'standard' | 'large'>('standard');
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const startCamera = async (slot: 'front' | 'back') => {
    try {
      // First stop any running camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      setActiveTargetSlot(slot);
      // Auto-set preferred camera orientation based on target slot
      const preferredFacing = slot === 'front' ? 'user' : 'environment';
      setFacingMode(preferredFacing);

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: preferredFacing, width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access failed:", err);
      // Fallback: try default camera constraints if ideal fails
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraActive(true);
      } catch (fallbackErr) {
        console.error("Fallback camera also failed:", fallbackErr);
        alert("Could not access your device camera. Please make sure camera permissions are enabled in your browser.");
      }
    }
  };

  const toggleFacingMode = async () => {
    if (!cameraActive || !activeTargetSlot) return;
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: newMode, width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Failed to switch camera mode:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setActiveTargetSlot(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && activeTargetSlot) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Only mirror the picture if taking a front/selfie view
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        
        // Convert to quality JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (activeTargetSlot === 'front') {
          setPhotoFront(dataUrl);
        } else {
          setPhotoBack(dataUrl);
        }
        stopCamera();
      }
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'outstanding' | 'all_log'>('outstanding');
  const [typeFilter, setTypeFilter] = useState<'all' | 'loans' | 'kept'>('all');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const [isStatsExpanded, setIsStatsExpanded] = useState(true);

  // Dispute solver states
  const [selectedDisputeCustomer, setSelectedDisputeCustomer] = useState<string | null>(null);
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [isDisputeCopied, setIsDisputeCopied] = useState(false);

  useEffect(() => {
    console.log("BorrowKeepSection: effect running, currentUser:", state.currentUser, "isCloudMode:", isCloudMode);
    if (!state.currentUser || !state.currentUser.ownerId) {
        console.log("BorrowKeepSection: no currentUser or ownerId");
        return;
    }

    if (isCloudMode && syncOwnerId) {
      console.log("BorrowKeepSection: cloud mode active, ownerId:", syncOwnerId);
      const q = query(collection(db, 'borrowKeep'), where('ownerId', '==', syncOwnerId));
      console.log("BorrowKeepSection: firestore query created");
      const unsubscribe = onSnapshot(q, (snapshot) => {
        console.log("BorrowKeepSection: firestore snapshot received");
        const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as BorrowKeepTransaction));
        setTransactions(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'borrowKeep');
      });
      return () => unsubscribe();
    } else {
      console.log("BorrowKeepSection: local mode active, recovery from localStorage");
      const saved = localStorage.getItem('OPay_BorrowKeep_Transactions');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as BorrowKeepTransaction[];
          setTransactions(parsed);
        } catch (err) {
          console.warn("BorrowKeepSection: local state recovery failed", err);
          setTransactions([]);
        }
      } else {
        setTransactions([]);
      }
    }
  }, [state.currentUser?.ownerId, isCloudMode]);

  // FIFO & explicit ID matching algorithm to map repayments to active loans/kept money
  const compileCustomerLedger = () => {
    const customers: Record<string, {
      name: string;
      loans: { 
        tx: BorrowKeepTransaction; 
        remaining: number; 
        repayments: BorrowKeepTransaction[];
      }[];
      kept: { 
        tx: BorrowKeepTransaction; 
        remaining: number; 
        returns: BorrowKeepTransaction[];
      }[];
      unlinkedRepayments: BorrowKeepTransaction[];
      unlinkedReturns: BorrowKeepTransaction[];
    }> = {};

    // First, group by customer name (case-insensitive)
    transactions.forEach(t => {
      if (!t.name) return;
      const key = t.name.trim().toLowerCase();
      if (!customers[key]) {
        customers[key] = {
          name: t.name.trim(),
          loans: [],
          kept: [],
          unlinkedRepayments: [],
          unlinkedReturns: []
        };
      }
    });

    // Populate baseline loans & kept items
    transactions.forEach(t => {
      if (!t.name) return;
      const key = t.name.trim().toLowerCase();
      if (t.type === 'loan_given') {
        customers[key].loans.push({ tx: t, remaining: t.amount, repayments: [] });
      } else if (t.type === 'money_kept') {
        customers[key].kept.push({ tx: t, remaining: t.amount, returns: [] });
      }
    });

    // Sort entries chronologically (oldest first) so FIFO matching makes sense
    Object.values(customers).forEach(cust => {
      cust.loans.sort((a, b) => new Date(a.tx.timestamp).getTime() - new Date(b.tx.timestamp).getTime());
      cust.kept.sort((a, b) => new Date(a.tx.timestamp).getTime() - new Date(b.tx.timestamp).getTime());
    });

    // Match repayments and returns
    transactions.forEach(t => {
      if (!t.name) return;
      const key = t.name.trim().toLowerCase();
      const cust = customers[key];
      if (!cust) return;

      // Skip unapproved repayments/returns so they do not reduce active debts or loans
      if (t.approvalStatus === 'pending' || t.approvalStatus === 'rejected') {
        return;
      }

      if (t.type === 'loan_repaid') {
        if (t.linkedTransactionId) {
          const match = cust.loans.find(l => l.tx.id === t.linkedTransactionId);
          if (match) {
            match.repayments.push(t);
            match.remaining = Math.max(0, match.remaining - t.amount);
            return;
          }
        }
        cust.unlinkedRepayments.push(t);
      } else if (t.type === 'money_returned') {
        if (t.linkedTransactionId) {
          const match = cust.kept.find(k => k.tx.id === t.linkedTransactionId);
          if (match) {
            match.returns.push(t);
            match.remaining = Math.max(0, match.remaining - t.amount);
            return;
          }
        }
        cust.unlinkedReturns.push(t);
      }
    });

    // Apply remaining unlinked repayments & returns chronologically
    Object.values(customers).forEach(cust => {
      cust.unlinkedRepayments.forEach(repay => {
        const activeLoan = cust.loans.find(l => l.remaining > 0);
        if (activeLoan) {
          activeLoan.repayments.push(repay);
          activeLoan.remaining = Math.max(0, activeLoan.remaining - repay.amount);
        }
      });

      cust.unlinkedReturns.forEach(ret => {
        const activeKept = cust.kept.find(k => k.remaining > 0);
        if (activeKept) {
          activeKept.returns.push(ret);
          activeKept.remaining = Math.max(0, activeKept.remaining - ret.amount);
        }
      });
    });

    return customers;
  };

  const ledger = compileCustomerLedger();

  // Handle saving new records
  const handleAdd = async () => {
    if (!state.currentUser) {
        console.error("BorrowKeepSection: currentUser is null");
        return;
    }
    if (name && amount) {
      const parsedAmount = parseFloat(amount);
      const transactionId = isCloudMode 
        ? doc(collection(db, 'borrowKeep')).id 
        : 'bk_' + Math.floor(100000 + Math.random() * 900000);

      const isRepaymentOrReturn = type === 'loan_repaid' || type === 'money_returned';
      const requiresApproval = isRepaymentOrReturn && state.currentUser.role === 'Employee';

      const record: BorrowKeepTransaction = {
        id: transactionId,
        name: name.trim(),
        amount: parsedAmount,
        type,
        timestamp: new Date().toISOString(),
        ownerId: syncOwnerId || 'local_owner',
        employeeId: state.currentUser.id,
        employeeName: state.currentUser.name,
        notes: notes.trim() || undefined,
        audioNote: audioNote || undefined,
        linkedTransactionId: linkedTransactionId || undefined,
        photoFront: (type === 'money_kept' || type === 'money_returned') ? (photoFront || undefined) : undefined,
        photoBack: (type === 'money_kept' || type === 'money_returned') ? (photoBack || undefined) : undefined,
        photo: (type === 'money_kept' || type === 'money_returned') ? (photoFront || photoBack || undefined) : undefined,
        approvalStatus: requiresApproval ? 'pending' : 'approved'
      };

      if (isCloudMode) {
        try {
          console.log("BorrowKeepSection: Saving to Firestore:", record);
          await setDoc(doc(db, 'borrowKeep', transactionId), record);
          
          // If we linked this repayment/return, also update the original document's running values (ONLY IF approved immediately)
          if (linkedTransactionId && !requiresApproval) {
            const originalDoc = transactions.find(t => t.id === linkedTransactionId);
            if (originalDoc) {
              const prevRepaid = originalDoc.repaidAmount || 0;
              const nextRepaid = prevRepaid + parsedAmount;
              const isSettled = nextRepaid >= originalDoc.amount;
              await setDoc(doc(db, 'borrowKeep', linkedTransactionId), {
                ...originalDoc,
                repaidAmount: nextRepaid,
                status: isSettled ? 'settled' : 'partial'
              }, { merge: true });
            }
          }
          
          if (requiresApproval) {
            alert(`📢 Record submitted successfully! Since you are a Cashier, this settlement is marked as "Pending" and has been sent to your Manager for approval. Active balance totals will update once approved.`);
          }
          resetForm();
        } catch (error) {
          console.error("Error saving document to Firestore in BorrowKeepSection:", error);
        }
      } else {
        try {
          console.log("BorrowKeepSection: Saving to LocalStorage:", record);
          const saved = localStorage.getItem('OPay_BorrowKeep_Transactions');
          const list = saved ? JSON.parse(saved) as BorrowKeepTransaction[] : [];
          
          // If linked, update original transaction in the local array (ONLY IF approved immediately)
          let updatedList = [...list];
          if (linkedTransactionId && !requiresApproval) {
            updatedList = updatedList.map(item => {
              if (item.id === linkedTransactionId) {
                const prevRepaid = item.repaidAmount || 0;
                const nextRepaid = prevRepaid + parsedAmount;
                const isSettled = nextRepaid >= item.amount;
                return {
                  ...item,
                  repaidAmount: nextRepaid,
                  status: isSettled ? 'settled' : 'partial' as const
                };
              }
              return item;
            });
          }
          
          const nextList = [record, ...updatedList];
          localStorage.setItem('OPay_BorrowKeep_Transactions', JSON.stringify(nextList));
          setTransactions(nextList);
          if (requiresApproval) {
            alert(`📢 Record submitted successfully! Since you are a Cashier, this settlement is marked as "Pending" and has been sent to your Manager for approval. Active balance totals will update once approved.`);
          }
          resetForm();
        } catch (err) {
          console.error("Error saving record locally:", err);
        }
      }
    } else {
        console.warn("BorrowKeepSection: Name or amount missing");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    
    if (isCloudMode) {
      try {
        await deleteDoc(doc(db, 'borrowKeep', id));
        console.log("Firestore document deleted successfully:", id);
      } catch (err) {
        console.error("Error deleting Firestore document:", err);
      }
    } else {
      const saved = localStorage.getItem('OPay_BorrowKeep_Transactions');
      if (saved) {
        const list = JSON.parse(saved) as BorrowKeepTransaction[];
        const nextList = list.filter(t => t.id !== id);
        localStorage.setItem('OPay_BorrowKeep_Transactions', JSON.stringify(nextList));
        setTransactions(nextList);
        console.log("Local document deleted successfully:", id);
      }
    }
  };

  const resetForm = () => {
    setName('');
    setAmount('');
    setNotes('');
    setAudioNote('');
    setLinkedTransactionId('');
    setIsOpen(false);
    setPhotoFront(null);
    setPhotoBack(null);
    stopCamera();
  };

  // Helper to prefill form for a linked repayment/return
  const triggerRepayShortcut = (targetTx: BorrowKeepTransaction, remaining: number) => {
    setName(targetTx.name);
    setAmount(remaining.toString());
    setType(targetTx.type === 'loan_given' ? 'loan_repaid' : 'money_returned');
    setLinkedTransactionId(targetTx.id);
    setNotes(`Repayment towards original transaction on ${new Date(targetTx.timestamp).toLocaleDateString()}`);
    setIsOpen(true);
    // Scroll to form smoothly
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  // Calculations for current active states (all-time outstanding)
  let totalActiveLoansOwedToUs = 0;
  let totalActiveKeptOwedToCust = 0;
  const activeBalancesList: { name: string; type: 'loan' | 'kept'; originalAmount: number; remainingAmount: number; tx: BorrowKeepTransaction }[] = [];

  Object.values(ledger).forEach(cust => {
    cust.loans.forEach(l => {
      if (l.remaining > 0) {
        totalActiveLoansOwedToUs += l.remaining;
        activeBalancesList.push({
          name: cust.name,
          type: 'loan',
          originalAmount: l.tx.amount,
          remainingAmount: l.remaining,
          tx: l.tx
        });
      }
    });

    cust.kept.forEach(k => {
      if (k.remaining > 0) {
        totalActiveKeptOwedToCust += k.remaining;
        activeBalancesList.push({
          name: cust.name,
          type: 'kept',
          originalAmount: k.tx.amount,
          remainingAmount: k.remaining,
          tx: k.tx
        });
      }
    });
  });

  // Active time-frame filtered items
  const filteredTimeline = transactions.filter(e => {
    const d = new Date(e.timestamp);
    const now = new Date();
    
    // Name Search filter
    if (searchQuery.trim() !== '') {
      if (!e.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    if (state.activeTimeframe === 'Daily') return isSameDay(d, now);
    if (state.activeTimeframe === 'Weekly') return isSameWeek(d, now);
    if (state.activeTimeframe === 'Monthly') return isSameMonth(d, now);
    return isSameYear(d, now);
  });

  // Calculate stats strictly for the selected timeframe
  const periodLoansGiven = filteredTimeline.filter(t => t.type === 'loan_given').reduce((sum, t) => sum + t.amount, 0);
  const periodLoansRepaid = filteredTimeline.filter(t => t.type === 'loan_repaid' && t.approvalStatus !== 'pending').reduce((sum, t) => sum + t.amount, 0);
  const periodLoansRepaidPending = filteredTimeline.filter(t => t.type === 'loan_repaid' && t.approvalStatus === 'pending').reduce((sum, t) => sum + t.amount, 0);
  const periodMoneyKept = filteredTimeline.filter(t => t.type === 'money_kept').reduce((sum, t) => sum + t.amount, 0);
  const periodMoneyReturned = filteredTimeline.filter(t => t.type === 'money_returned' && t.approvalStatus !== 'pending').reduce((sum, t) => sum + t.amount, 0);
  const periodMoneyReturnedPending = filteredTimeline.filter(t => t.type === 'money_returned' && t.approvalStatus === 'pending').reduce((sum, t) => sum + t.amount, 0);

  // Perform name search pre-filtering for summary metrics
  const searchFilteredTransactions = React.useMemo(() => {
    if (searchQuery.trim() === '') return transactions;
    return transactions.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [transactions, searchQuery]);

  const nowRef = new Date();

  // Daily totals
  const dailyLoansGiven = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_given' && isSameDay(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const dailyLoansRepaid = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus !== 'pending' && isSameDay(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const dailyLoansRepaidPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus === 'pending' && isSameDay(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const dailyMoneyKept = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_kept' && isSameDay(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const dailyMoneyReturned = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus !== 'pending' && isSameDay(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const dailyMoneyReturnedPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus === 'pending' && isSameDay(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);

  // Weekly totals
  const weeklyLoansGiven = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_given' && isSameWeek(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const weeklyLoansRepaid = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus !== 'pending' && isSameWeek(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const weeklyLoansRepaidPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus === 'pending' && isSameWeek(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const weeklyMoneyKept = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_kept' && isSameWeek(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const weeklyMoneyReturned = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus !== 'pending' && isSameWeek(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const weeklyMoneyReturnedPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus === 'pending' && isSameWeek(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);

  // Monthly totals
  const monthlyLoansGiven = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_given' && isSameMonth(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const monthlyLoansRepaid = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus !== 'pending' && isSameMonth(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const monthlyLoansRepaidPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus === 'pending' && isSameMonth(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const monthlyMoneyKept = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_kept' && isSameMonth(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const monthlyMoneyReturned = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus !== 'pending' && isSameMonth(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const monthlyMoneyReturnedPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus === 'pending' && isSameMonth(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);

  // Yearly totals
  const yearlyLoansGiven = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_given' && isSameYear(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const yearlyLoansRepaid = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus !== 'pending' && isSameYear(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const yearlyLoansRepaidPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'loan_repaid' && t.approvalStatus === 'pending' && isSameYear(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const yearlyMoneyKept = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_kept' && isSameYear(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const yearlyMoneyReturned = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus !== 'pending' && isSameYear(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);
  const yearlyMoneyReturnedPending = React.useMemo(() => searchFilteredTransactions.filter(t => t.type === 'money_returned' && t.approvalStatus === 'pending' && isSameYear(new Date(t.timestamp), nowRef)).reduce((sum, t) => sum + t.amount, 0), [searchFilteredTransactions]);

  const typeConfig = {
    loan_given: { label: 'Loan Given', color: 'text-red-600 bg-red-50 border-red-100', icon: ArrowUpRight },
    loan_repaid: { label: 'Loan Repayment', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: ArrowDownLeft },
    money_kept: { label: 'Money Kept', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: Wallet },
    money_returned: { label: 'Money Returned', color: 'text-purple-600 bg-purple-50 border-purple-100', icon: Repeat },
  };

  // Find target outstanding loans/kept entries for linking dropdown based on selected name/type
  const getOutstandingDropdownOptions = () => {
    const targetType: BorrowKeepTransaction['type'] = type === 'loan_repaid' ? 'loan_given' : 'money_kept';
    const list: BorrowKeepTransaction[] = [];

    Object.values(ledger).forEach(cust => {
      const records = targetType === 'loan_given' ? cust.loans : cust.kept;
      records.forEach(item => {
        if (item.remaining > 0) {
          list.push(item.tx);
        }
      });
    });

    // If name is already typed, prioritize matching names
    if (name.trim() !== '') {
      return list.filter(item => item.name.toLowerCase().includes(name.toLowerCase()));
    }
    return list;
  };

  const dropDownOptions = getOutstandingDropdownOptions();

  // List of all customer names in the entire system (case-insensitive deduplication)
  const allCustomerNames = React.useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.name.trim()).filter(Boolean)));
  }, [transactions]);

  // Selected customer's specific transaction history (sorted chronologically oldest first)
  const customerTransactions = React.useMemo(() => {
    if (!selectedDisputeCustomer) return [];
    const key = selectedDisputeCustomer.trim().toLowerCase();
    return transactions
      .filter(t => t.name.trim().toLowerCase() === key)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [transactions, selectedDisputeCustomer]);

  // Kept money specific ledger with dynamic running balance calculations
  const keptTransactionsWithRunningBalance = React.useMemo(() => {
    let running = 0;
    return customerTransactions
      .filter(t => t.type === 'money_kept' || t.type === 'money_returned')
      .map(t => {
        if (t.type === 'money_kept') {
          running += t.amount;
        } else {
          running -= t.amount;
        }
        return {
          ...t,
          runningBalance: running
        };
      });
  }, [customerTransactions]);

  // Total amount deposited and total withdrawn for display
  const keptSummary = React.useMemo(() => {
    let totalDeposited = 0;
    let totalWithdrawn = 0;
    customerTransactions.forEach(t => {
      if (t.type === 'money_kept') totalDeposited += t.amount;
      if (t.type === 'money_returned') totalWithdrawn += t.amount;
    });
    return {
      totalDeposited,
      totalWithdrawn,
      balance: totalDeposited - totalWithdrawn
    };
  }, [customerTransactions]);

  const handleCopyToClipboard = (text: string) => {
    copyToClipboard(text).then(() => {
      setIsDisputeCopied(true);
      setTimeout(() => setIsDisputeCopied(false), 2500);
    });
  };

  const getWhatsAppStatementText = () => {
    if (!selectedDisputeCustomer) return '';
    const nameFormatted = allCustomerNames.find(c => c.toLowerCase() === selectedDisputeCustomer) || selectedDisputeCustomer;
    
    let text = `📜 *DAN GODAL POSTrack Certified Statement* 📜\n`;
    text += `*Safe Cash Kept Ledger for Customer: ${nameFormatted}*\n`;
    text += `===================================\n`;
    text += `*Date of Statement:* ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}\n`;
    text += `*Current Safe Balance:* ₦${keptSummary.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n`;
    text += `===================================\n\n`;
    text += `*🕒 DEPOSIT & COLLECTION DETAILS:*\n\n`;

    keptTransactionsWithRunningBalance.forEach((t, index) => {
      const isDeposit = t.type === 'money_kept';
      const actionSymbol = isDeposit ? '📥 DEPOSIT' : '📤 COLLECTION / WITHDRAWAL';
      const changeSign = isDeposit ? '+' : '-';
      const running = t.runningBalance;

      const txDate = new Date(t.timestamp).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const txTime = new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      text += `${index + 1}. *${txDate} at ${txTime}*\n`;
      text += `   *Action:* ${actionSymbol}\n`;
      text += `   *Amount:* ${changeSign}₦${t.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n`;
      if (t.notes) {
        text += `   *Memo/Notes:* "${t.notes}"\n`;
      }
      text += `   *Employee Staff:* ${t.employeeName || 'Operator'}\n`;
      text += `   *Balance after this action:* ₦${running.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n`;
      text += `   ---------------------------------\n\n`;
    });

    text += `*Current Remaining Balance:* ₦${keptSummary.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}\n\n`;
    text += `_Verified securely on Dan Godal Postracker. No more arguments, clean transactions! 🤝_`;
    return text;
  };

  return (
    <div id="borrow-keep-section" className="bg-white border border-neutral-200 p-5 rounded-3xl shadow-sm space-y-5 mt-6">
      
      {/* 1. Header with Nice Branding & Action Button */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5 text-indigo-500" /> Loans & Kept Ledger
            </span>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Connected
            </span>
          </div>
          <h3 className="text-sm font-bold text-neutral-800 mt-1">Employee Ledger & Credit Control</h3>
          <p className="text-[11px] text-neutral-400">Match customer repayments to active loans without any confusion.</p>
        </div>
        
        <button 
          onClick={() => {
            if (isOpen) resetForm();
            else setIsOpen(true);
          }} 
          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all duration-200 flex items-center gap-1 ${
            isOpen 
              ? 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200' 
              : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
          }`}
        >
          {isOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {isOpen ? 'Close' : 'New Record'}
        </button>
      </div>

      {/* 2. Outstanding Balance KPI Highlights (All-Time State) */}
      <div id="outstanding-kpis" className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-gradient-to-r from-neutral-50 to-neutral-100 rounded-2xl border border-neutral-200/60">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100/80 rounded-xl text-red-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 tracking-wider">Total Outstanding Loans (We Gave)</span>
            <div className="text-base font-bold text-red-600">{formatNaira(totalActiveLoansOwedToUs)}</div>
            <p className="text-[9px] text-neutral-400 mt-0.5">Cash awaiting recovery from customers</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-neutral-200 pt-3 sm:pt-0 sm:pl-4">
          <div className="p-3 bg-purple-100/80 rounded-xl text-purple-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono font-bold text-neutral-400 tracking-wider">Total Customer Money Kept (We Hold)</span>
            <div className="text-base font-bold text-purple-600">{formatNaira(totalActiveKeptOwedToCust)}</div>
            <p className="text-[9px] text-neutral-400 mt-0.5">Cash awaiting returns to customers</p>
          </div>
        </div>
      </div>

      {/* 2.5. Beautiful Daily, Weekly, Monthly, Yearly Activity Dashboard */}
      <div id="multi-timeframe-dashboard" className="bg-neutral-50/50 border border-neutral-200/70 rounded-2xl p-4 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-neutral-800 tracking-tight uppercase font-sans">Ledger Activity Dashboard</h4>
              <p className="text-[10px] text-neutral-400">Activity breakdown for Daily, Weekly, Monthly, and Yearly timeframes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {searchQuery && (
              <span className="hidden sm:inline bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold px-2 py-0.5 rounded-full">
                Filtered by: "{searchQuery}"
              </span>
            )}
            <button 
              type="button"
              onClick={() => setIsStatsExpanded(!isStatsExpanded)}
              className="text-xs text-neutral-500 hover:text-indigo-600 font-semibold px-2.5 py-1 rounded-lg hover:bg-neutral-100/80 flex items-center gap-1 transition"
            >
              {isStatsExpanded ? (
                <>
                  <span>Collapse</span>
                  <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  <span>Expand All ({formatNaira(dailyLoansGiven + weeklyLoansGiven + monthlyLoansGiven + yearlyLoansGiven)})</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {isStatsExpanded && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in">
            {/* Card 1: Loans Given */}
            <div className="bg-white border border-rose-100/80 rounded-xl p-3 shadow-xs hover:border-rose-200 transition-all">
              <div className="flex items-center gap-1.5 mb-2 border-b border-rose-50 pb-1.5">
                <div className="p-1 bg-rose-50 rounded-md text-red-600">
                  <ArrowUpRight className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-rose-950">Loans Given</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Daily</span>
                  <span className="font-mono font-bold text-red-600">{formatNaira(dailyLoansGiven)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Weekly</span>
                  <span className="font-mono font-bold text-red-600">{formatNaira(weeklyLoansGiven)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Monthly</span>
                  <span className="font-mono font-bold text-red-600">{formatNaira(monthlyLoansGiven)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400 font-medium">Yearly</span>
                  <span className="font-mono font-bold text-red-600">{formatNaira(yearlyLoansGiven)}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Loan Repaid */}
            <div className="bg-white border border-emerald-100/80 rounded-xl p-3 shadow-xs hover:border-emerald-200 transition-all">
              <div className="flex items-center gap-1.5 mb-2 border-b border-emerald-50 pb-1.5">
                <div className="p-1 bg-emerald-50 rounded-md text-emerald-600">
                  <ArrowDownLeft className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-emerald-950">Repayments</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-start py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Daily</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-600 block">{formatNaira(dailyLoansRepaid)}</span>
                    {dailyLoansRepaidPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(dailyLoansRepaidPending)} pending)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Weekly</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-600 block">{formatNaira(weeklyLoansRepaid)}</span>
                    {weeklyLoansRepaidPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(weeklyLoansRepaidPending)} pending)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Monthly</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-600 block">{formatNaira(monthlyLoansRepaid)}</span>
                    {monthlyLoansRepaidPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(monthlyLoansRepaidPending)} pending)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start py-0.5">
                  <span className="text-neutral-400 font-medium">Yearly</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-600 block">{formatNaira(yearlyLoansRepaid)}</span>
                    {yearlyLoansRepaidPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(yearlyLoansRepaidPending)} pending)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Kept Deposits */}
            <div className="bg-white border border-blue-100/80 rounded-xl p-3 shadow-xs hover:border-blue-200 transition-all">
              <div className="flex items-center gap-1.5 mb-2 border-b border-blue-50 pb-1.5">
                <div className="p-1 bg-blue-50 rounded-md text-blue-600">
                  <Wallet className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-blue-950">Deposits Kept</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-center py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Daily</span>
                  <span className="font-mono font-bold text-blue-600">{formatNaira(dailyMoneyKept)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Weekly</span>
                  <span className="font-mono font-bold text-blue-600">{formatNaira(weeklyMoneyKept)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Monthly</span>
                  <span className="font-mono font-bold text-blue-600">{formatNaira(monthlyMoneyKept)}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-neutral-400 font-medium">Yearly</span>
                  <span className="font-mono font-bold text-blue-600">{formatNaira(yearlyMoneyKept)}</span>
                </div>
              </div>
            </div>

            {/* Card 4: Returned Deposits */}
            <div className="bg-white border border-purple-100/80 rounded-xl p-3 shadow-xs hover:border-purple-200 transition-all">
              <div className="flex items-center gap-1.5 mb-2 border-b border-purple-50 pb-1.5">
                <div className="p-1 bg-purple-50 rounded-md text-purple-600">
                  <Repeat className="w-3 h-3" />
                </div>
                <span className="text-xs font-bold text-purple-950">Returned</span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between items-start py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Daily</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-purple-600 block">{formatNaira(dailyMoneyReturned)}</span>
                    {dailyMoneyReturnedPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(dailyMoneyReturnedPending)} pending)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Weekly</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-purple-600 block">{formatNaira(weeklyMoneyReturned)}</span>
                    {weeklyMoneyReturnedPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(weeklyMoneyReturnedPending)} pending)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start py-0.5 border-b border-neutral-100/40">
                  <span className="text-neutral-400 font-medium">Monthly</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-purple-600 block">{formatNaira(monthlyMoneyReturned)}</span>
                    {monthlyMoneyReturnedPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(monthlyMoneyReturnedPending)} pending)</span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-start py-0.5">
                  <span className="text-neutral-400 font-medium">Yearly</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-purple-600 block">{formatNaira(yearlyMoneyReturned)}</span>
                    {yearlyMoneyReturnedPending > 0 && (
                      <span className="text-[9px] text-amber-600 block font-sans">({formatNaira(yearlyMoneyReturnedPending)} pending)</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. New Record Input Form Container */}
      {isOpen && (
        <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-4 animate-fade-in">
          <div className="flex justify-between items-center border-b border-neutral-200/60 pb-2">
            <h4 className="text-xs font-bold text-neutral-700 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-indigo-500" /> Create Ledger Entry
            </h4>
            {linkedTransactionId && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Link2 className="w-3 h-3" /> Linked to Active Record
              </span>
            )}
          </div>

          {/* Type Selector with clear semantic badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(Object.keys(typeConfig) as BorrowKeepTransaction['type'][]).map(t => {
              const active = type === t;
              return (
                <button
                  type="button"
                  key={t}
                  onClick={() => {
                    setType(t);
                    setLinkedTransactionId(''); // Reset link when type changes
                  }}
                  className={`text-[11px] p-2.5 rounded-xl border font-bold flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                    active 
                      ? 'bg-neutral-800 text-white border-neutral-800 shadow-sm' 
                      : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <span className={`text-[10px] font-bold ${active ? 'text-white' : ''}`}>
                    {typeConfig[t].label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono font-bold text-neutral-400 uppercase mb-1">Customer / Person Name</label>
              <input
                type="text"
                placeholder="Enter customer's name..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Auto-reset link if they completely wipe the name
                  if (e.target.value === '') setLinkedTransactionId('');
                }}
                className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-neutral-400 uppercase mb-1">Amount (₦)</label>
              <input
                type="number"
                placeholder="Enter amount..."
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                required
              />
            </div>
          </div>

          <div className="mt-2">
            <AudioRecorder onSave={setAudioNote} initialAudio={audioNote} />
          </div>

          {/* Linking Picker Interface (Only shown for Repayments and Returns) */}
          {(type === 'loan_repaid' || type === 'money_returned') && dropDownOptions.length > 0 && (
            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-indigo-900 block flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" /> Select Unpaid Record to Link & Settle:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dropDownOptions.map(option => {
                  const custKey = option.name.trim().toLowerCase();
                  const ledgerGroup = ledger[custKey];
                  let remaining = option.amount;
                  if (ledgerGroup) {
                    const match = option.type === 'loan_given' 
                      ? ledgerGroup.loans.find(l => l.tx.id === option.id)
                      : ledgerGroup.kept.find(k => k.tx.id === option.id);
                    if (match) remaining = match.remaining;
                  }

                  const isSelected = linkedTransactionId === option.id;

                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => {
                        setLinkedTransactionId(option.id);
                        setName(option.name);
                        setAmount(remaining.toString());
                        setNotes(`Repayment for original transaction on ${new Date(option.timestamp).toLocaleDateString()}`);
                      }}
                      className={`text-left p-2 rounded-lg text-xs border transition-all flex justify-between items-center ${
                        isSelected 
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold' 
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-indigo-400'
                      }`}
                    >
                      <div>
                        <div className="font-bold truncate max-w-[120px]">{option.name}</div>
                        <div className="text-[9px] opacity-80">{new Date(option.timestamp).toLocaleDateString()}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatNaira(remaining)}</div>
                        <div className="text-[9px] opacity-80">Remaining of {formatNaira(option.amount)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {linkedTransactionId && (
                <button 
                  type="button"
                  onClick={() => {
                    setLinkedTransactionId('');
                    setName('');
                    setAmount('');
                    setNotes('');
                  }}
                  className="text-[10px] text-red-500 font-bold mt-1 block"
                >
                  Clear Link Selection
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-mono font-bold text-neutral-400 uppercase mb-1">Memo / Notes (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Repaid via bank transfer, promised by Friday..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* CAMERA INTEGRATION FOR MONEY_KEPT & MONEY_RETURNED */}
          {(type === 'money_kept' || type === 'money_returned') && (
            <div className="border border-neutral-200 rounded-2xl p-4 bg-white space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 pb-3">
                <div>
                  <label className="text-[10px] font-mono font-black text-neutral-500 uppercase block tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                    Employee Verification Proof (Front & Back Snapshots)
                  </label>
                  <span className="text-[9px] text-neutral-400 block mt-0.5">
                    Capture both the customer's face (front view) and the physical cash count/receipt (back view) to completely eliminate disputes.
                  </span>
                </div>
                
                {/* Viewfinder Size Switcher */}
                <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200 self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setCameraSize('standard')}
                    className={`text-[9px] font-black px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      cameraSize === 'standard' 
                        ? 'bg-white text-neutral-800 shadow-3xs' 
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setCameraSize('large')}
                    className={`text-[9px] font-black px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      cameraSize === 'large' 
                        ? 'bg-white text-neutral-800 shadow-3xs' 
                        : 'text-neutral-500 hover:text-neutral-800'
                    }`}
                  >
                    Large HD
                  </button>
                </div>
              </div>

              {/* Two Slots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* SLOT A: FRONT VIEW (CUSTOMER SNAPSHOT) */}
                <div className="border border-neutral-150 rounded-xl bg-neutral-50 p-3 flex flex-col space-y-2.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="text-[10px] font-black text-neutral-700 uppercase font-mono tracking-wide">1. Customer Front View</span>
                    </div>
                    {photoFront && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-mono">
                        <Check className="w-2.5 h-2.5" /> SECURED
                      </span>
                    )}
                  </div>

                  {/* Slot A Area */}
                  <div className="relative flex-1 min-h-[160px] bg-neutral-900 rounded-lg overflow-hidden flex flex-col items-center justify-center border border-neutral-200">
                    
                    {/* Viewfinder Mode for A */}
                    {cameraActive && activeTargetSlot === 'front' ? (
                      <div className="w-full h-full relative flex flex-col items-center justify-center">
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-[160px] object-cover transform -scale-x-100 bg-black" 
                        />
                        
                        {/* Camera Info Overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 flex justify-between items-center text-[8px] text-white font-mono z-10">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                            FRONT LENS ({facingMode})
                          </span>
                          <button
                            type="button"
                            onClick={toggleFacingMode}
                            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 text-[8px] cursor-pointer"
                          >
                            <RefreshCw className="w-2.5 h-2.5" /> Toggle Lens
                          </button>
                        </div>

                        {/* Control buttons inside the viewport */}
                        <div className="absolute top-2 inset-x-2 flex justify-between pointer-events-none z-10">
                          <div className="bg-black/60 text-white text-[8px] font-mono px-2 py-0.5 rounded">
                            {cameraSize === 'standard' ? '640x480' : '1280x720'}
                          </div>
                          <div className="flex gap-1.5 pointer-events-auto">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <Camera className="w-3 h-3" /> Snap
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="bg-neutral-900/80 hover:bg-neutral-900 text-white text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : photoFront ? (
                      /* Captured Preview Mode for A */
                      <div className="relative w-full h-full min-h-[160px] group">
                        <img 
                          src={photoFront} 
                          alt="Customer Front Proof" 
                          className="w-full h-[160px] object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                          <button
                            type="button"
                            onClick={() => startCamera('front')}
                            className="bg-neutral-900/80 hover:bg-neutral-950 text-white p-1 rounded-md shadow-sm cursor-pointer"
                            title="Retake Snapshot"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoFront(null)}
                            className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-md shadow-sm cursor-pointer"
                            title="Delete Photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[8px] font-mono px-2 py-0.5 rounded z-10">
                          📷 FRONT SNAPSHOT
                        </div>
                      </div>
                    ) : (
                      /* Empty Slot Placeholder for A */
                      <div className="flex flex-col items-center justify-center text-center p-4 py-6 space-y-2">
                        <div className="p-2.5 bg-indigo-500/15 text-indigo-400 rounded-full border border-indigo-500/10">
                          <User className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] text-neutral-300 font-bold">No Customer Face Photo</p>
                        <p className="text-[8px] text-neutral-400 max-w-[150px] leading-normal">
                          Take a quick snapshot of the client's face.
                        </p>
                        <button
                          type="button"
                          onClick={() => startCamera('front')}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-sm active:scale-95"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Start Front Camera</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* SLOT B: BACK VIEW (CASH COUNT / RECEIPT SNAPSHOT) */}
                <div className="border border-neutral-150 rounded-xl bg-neutral-50 p-3 flex flex-col space-y-2.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <span className="text-[10px] font-black text-neutral-700 uppercase font-mono tracking-wide">2. Cash / Item Back View</span>
                    </div>
                    {photoBack && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 font-mono">
                        <Check className="w-2.5 h-2.5" /> SECURED
                      </span>
                    )}
                  </div>

                  {/* Slot B Area */}
                  <div className="relative flex-1 min-h-[160px] bg-neutral-900 rounded-lg overflow-hidden flex flex-col items-center justify-center border border-neutral-200">
                    
                    {/* Viewfinder Mode for B */}
                    {cameraActive && activeTargetSlot === 'back' ? (
                      <div className="w-full h-full relative flex flex-col items-center justify-center">
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-[160px] object-cover bg-black" 
                        />
                        
                        {/* Camera Info Overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-2 flex justify-between items-center text-[8px] text-white font-mono z-10">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></span>
                            REAR LENS ({facingMode})
                          </span>
                          <button
                            type="button"
                            onClick={toggleFacingMode}
                            className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-1.5 py-0.5 rounded flex items-center gap-0.5 text-[8px] cursor-pointer"
                          >
                            <RefreshCw className="w-2.5 h-2.5" /> Toggle Lens
                          </button>
                        </div>

                        {/* Control buttons inside the viewport */}
                        <div className="absolute top-2 inset-x-2 flex justify-between pointer-events-none z-10">
                          <div className="bg-black/60 text-white text-[8px] font-mono px-2 py-0.5 rounded">
                            {cameraSize === 'standard' ? '640x480' : '1280x720'}
                          </div>
                          <div className="flex gap-1.5 pointer-events-auto">
                            <button
                              type="button"
                              onClick={capturePhoto}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-extrabold px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm cursor-pointer"
                            >
                              <Camera className="w-3 h-3" /> Snap
                            </button>
                            <button
                              type="button"
                              onClick={stopCamera}
                              className="bg-neutral-900/80 hover:bg-neutral-900 text-white text-[9px] font-bold px-2 py-1 rounded-md flex items-center gap-1 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : photoBack ? (
                      /* Captured Preview Mode for B */
                      <div className="relative w-full h-full min-h-[160px] group">
                        <img 
                          src={photoBack} 
                          alt="Cash Back Proof" 
                          className="w-full h-[160px] object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-2 right-2 flex gap-1.5 z-10">
                          <button
                            type="button"
                            onClick={() => startCamera('back')}
                            className="bg-neutral-900/80 hover:bg-neutral-950 text-white p-1 rounded-md shadow-sm cursor-pointer"
                            title="Retake Snapshot"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotoBack(null)}
                            className="bg-red-600 hover:bg-red-700 text-white p-1 rounded-md shadow-sm cursor-pointer"
                            title="Delete Photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-[8px] font-mono px-2 py-0.5 rounded z-10">
                          📷 REAR/CASH SNAPSHOT
                        </div>
                      </div>
                    ) : (
                      /* Empty Slot Placeholder for B */
                      <div className="flex flex-col items-center justify-center text-center p-4 py-6 space-y-2">
                        <div className="p-2.5 bg-amber-500/15 text-amber-500 rounded-full border border-amber-500/10">
                          <Wallet className="w-5 h-5 text-amber-500" />
                        </div>
                        <p className="text-[10px] text-neutral-300 font-bold">No Cash count / Receipt Photo</p>
                        <p className="text-[8px] text-neutral-400 max-w-[150px] leading-normal">
                          Take a physical snapshot of the cash count or log paper.
                        </p>
                        <button
                          type="button"
                          onClick={() => startCamera('back')}
                          className="bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black px-2.5 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-sm active:scale-95"
                        >
                          <Camera className="w-3 h-3" />
                          <span>Start Back Camera</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button 
              type="button" 
              onClick={resetForm} 
              className="text-xs py-2.5 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-all"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleAdd} 
              className="text-xs py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-sm"
            >
              Save Record & Link
            </button>
          </div>
        </div>
      )}

      {/* 4. Tab Navigation & Search Inputs */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 border-b border-neutral-200 pb-2">
        <div className="flex bg-neutral-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setActiveTab('outstanding')}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'outstanding' 
                ? 'bg-white text-neutral-800 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Outstanding Balances ({activeBalancesList.length})
          </button>
          <button
            onClick={() => setActiveTab('all_log')}
            className={`text-xs px-3.5 py-1.5 rounded-lg font-bold transition-all ${
              activeTab === 'all_log' 
                ? 'bg-white text-neutral-800 shadow-sm' 
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Ledger Timeline ({filteredTimeline.length})
          </button>
        </div>

        {/* Dynamic Name Search Input */}
        <div className="relative flex-1 max-w-xs self-stretch sm:self-auto">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search customer name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-neutral-200 bg-neutral-50 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* 5. TAB CONTENT: OUTSTANDING BALANCES VIEW */}
      {activeTab === 'outstanding' && (
        <div className="space-y-4">
          
          {/* Dispute Solver Dashboard Box */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-950 space-y-4 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 opacity-[0.07] pointer-events-none">
              <ShieldAlert className="w-56 h-56 transform translate-x-12 translate-y-12" />
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                <Sparkles className="w-5 h-5 text-indigo-200" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-widest text-indigo-300 font-mono">🤝 Customer Dispute & Argument Solver</h4>
                <p className="text-xs text-neutral-200 font-medium mt-1 leading-relaxed">
                  Do customers argue about how much money they kept with you or when they collected it? Select a customer below to generate a <strong>Certified Statement of Account</strong> with dynamic running balances and dates. You can copy the proof directly to send on WhatsApp!
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-1.5 items-stretch sm:items-center">
              <div className="flex-1">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDisputeCustomer(e.target.value.toLowerCase());
                      setIsDisputeModalOpen(true);
                      e.target.value = ''; // Reset select after action
                    }
                  }}
                  className="w-full text-xs p-3 rounded-xl border border-indigo-700/80 bg-indigo-950/60 text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 font-bold"
                >
                  <option value="" className="text-indigo-300">-- Click to Select Customer to Settle Dispute --</option>
                  {allCustomerNames.map(cName => (
                    <option key={cName} value={cName} className="text-neutral-800 font-bold">
                      {cName}
                    </option>
                  ))}
                </select>
              </div>
              {allCustomerNames.length === 0 && (
                <div className="text-[10px] text-indigo-200 italic">No customers in ledger yet</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(ledger)
              .filter(cust => {
                if (searchQuery.trim() !== '') {
                  return cust.name.toLowerCase().includes(searchQuery.toLowerCase());
                }
                return true;
              })
              .map(cust => {
                // Calculate if they have any active outstanding
                const unpaidLoans = cust.loans.filter(l => l.remaining > 0);
                const unpaidKept = cust.kept.filter(k => k.remaining > 0);
                
                // If they have no active open items and search query is blank, skip rendering in Outstanding
                if (unpaidLoans.length === 0 && unpaidKept.length === 0) return null;

                const netLoans = unpaidLoans.reduce((sum, l) => sum + l.remaining, 0);
                const netKept = unpaidKept.reduce((sum, k) => sum + k.remaining, 0);

                return (
                  <div key={cust.name} className="border border-neutral-200 rounded-2xl p-4 bg-white shadow-sm space-y-3">
                    
                    {/* Customer Info and overall Net Summary */}
                    <div className="flex justify-between items-start border-b border-neutral-100 pb-2.5">
                      <div>
                        <h4 className="font-bold text-sm text-neutral-800">{cust.name}</h4>
                        <span className="text-[9px] font-mono font-bold text-neutral-400 tracking-wider">ACTIVE CLIENT PORTFOLIO</span>
                        <div className="mt-1.5">
                          <button
                            onClick={() => {
                              setSelectedDisputeCustomer(cust.name.toLowerCase());
                              setIsDisputeModalOpen(true);
                            }}
                            className="text-[10px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 transition shadow-3xs cursor-pointer"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Prove Collections / Statement</span>
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        {netLoans > 0 && (
                          <div className="text-xs text-red-600 font-bold">Owes Us: {formatNaira(netLoans)}</div>
                        )}
                        {netKept > 0 && (
                          <div className="text-xs text-purple-600 font-bold">We Hold: {formatNaira(netKept)}</div>
                        )}
                      </div>
                    </div>

                    {/* Customer's Outstanding Loans */}
                    {unpaidLoans.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono font-bold text-red-500 uppercase tracking-wider block">Owed Loans</span>
                        {unpaidLoans.map(l => {
                          const percentRepaid = Math.round(((l.tx.amount - l.remaining) / l.tx.amount) * 100);
                          return (
                            <div key={l.tx.id} className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <div className="font-medium text-neutral-700">
                                  ₦{l.tx.amount.toLocaleString()} on {new Date(l.tx.timestamp).toLocaleDateString()}
                                </div>
                                <div className="text-red-700 font-bold">
                                  {formatNaira(l.remaining)} Left
                                </div>
                              </div>
                              
                              {/* Progress bar to show visually what has been repaid */}
                              <div className="space-y-1">
                                <div className="w-full bg-red-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${percentRepaid}%` }}></div>
                                </div>
                                <div className="flex justify-between text-[9px] text-neutral-400 font-medium">
                                  <span>{percentRepaid}% Repaid</span>
                                  <span>{formatNaira(l.tx.amount - l.remaining)} Repaid</span>
                                </div>
                              </div>

                              {l.tx.notes && (
                                <p className="text-[10px] text-neutral-500 italic bg-white px-2 py-1 rounded-md border border-neutral-100">
                                  " {l.tx.notes} "
                                </p>
                              )}
                              {l.tx.audioNote && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audio = new Audio(l.tx.audioNote);
                                    audio.play();
                                  }}
                                  className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md mt-1 cursor-pointer"
                                >
                                  🔊 Play Voice Note
                                </button>
                              )}

                              <div className="flex justify-between items-center pt-1 border-t border-red-100/60">
                                <span className="text-[9px] text-neutral-400 font-mono">Logged: {l.tx.employeeName}</span>
                                <button
                                  onClick={() => triggerRepayShortcut(l.tx, l.remaining)}
                                  className="text-[10px] font-bold text-red-600 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                                >
                                  <ArrowDownLeft className="w-3 h-3" /> Record Repayment
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Customer's Outstanding Kept Money */}
                    {unpaidKept.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[9px] font-mono font-bold text-purple-500 uppercase tracking-wider block">Customer Cash Kept</span>
                        {unpaidKept.map(k => {
                          const percentReturned = Math.round(((k.tx.amount - k.remaining) / k.tx.amount) * 100);
                          return (
                            <div key={k.tx.id} className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <div className="font-medium text-neutral-700">
                                  ₦{k.tx.amount.toLocaleString()} on {new Date(k.tx.timestamp).toLocaleDateString()}
                                </div>
                                <div className="text-purple-700 font-bold">
                                  {formatNaira(k.remaining)} Left
                                </div>
                              </div>

                              {/* Progress bar to show visually what has been returned */}
                              <div className="space-y-1">
                                <div className="w-full bg-purple-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${percentReturned}%` }}></div>
                                </div>
                                <div className="flex justify-between text-[9px] text-neutral-400 font-medium">
                                  <span>{percentReturned}% Returned</span>
                                  <span>{formatNaira(k.tx.amount - k.remaining)} Returned</span>
                                </div>
                              </div>

                              {k.tx.notes && (
                                <p className="text-[10px] text-neutral-500 italic bg-white px-2 py-1 rounded-md border border-neutral-100">
                                  " {k.tx.notes} "
                                </p>
                              )}
                              {k.tx.audioNote && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audio = new Audio(k.tx.audioNote);
                                    audio.play();
                                  }}
                                  className="flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md mt-1 cursor-pointer"
                                >
                                  🔊 Play Voice Note
                                </button>
                              )}

                              <div className="flex justify-between items-center pt-1 border-t border-purple-100/60">
                                <span className="text-[9px] text-neutral-400 font-mono">Logged: {k.tx.employeeName}</span>
                                <button
                                  onClick={() => triggerRepayShortcut(k.tx, k.remaining)}
                                  className="text-[10px] font-bold text-purple-600 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                                >
                                  <Repeat className="w-3 h-3" /> Return Money
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}

            {activeBalancesList.length === 0 && (
              <div className="col-span-full py-8 text-center bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <h5 className="text-xs font-bold text-neutral-700">All Balances Settled</h5>
                <p className="text-[10px] text-neutral-400 max-w-xs mx-auto mt-0.5">There are no outstanding customer loans or unreturned kept deposits at this moment.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. TAB CONTENT: FULL LEDGER TIMELINE (CHRONOLOGICAL LOG) */}
      {activeTab === 'all_log' && (
        <div className="space-y-3">
          
          {/* Active timeframe stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-bold text-center border-b border-neutral-100 pb-3">
            <div className="bg-red-50 text-red-700 p-2.5 rounded-xl border border-red-100">
                <span className="block opacity-75">Loan Given ({state.activeTimeframe})</span>
                <span className="text-sm font-black mt-0.5 block">{formatNaira(periodLoansGiven)}</span>
            </div>
            <div className="bg-emerald-50 text-emerald-700 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between items-center min-h-[58px]">
                <span className="block opacity-75">Repaid ({state.activeTimeframe})</span>
                <span className="text-sm font-black mt-0.5 block">{formatNaira(periodLoansRepaid)}</span>
                {periodLoansRepaidPending > 0 && (
                  <span className="text-[8px] text-amber-600 block">({formatNaira(periodLoansRepaidPending)} pending)</span>
                )}
            </div>
            <div className="bg-blue-50 text-blue-700 p-2.5 rounded-xl border border-blue-100">
                <span className="block opacity-75">Kept ({state.activeTimeframe})</span>
                <span className="text-sm font-black mt-0.5 block">{formatNaira(periodMoneyKept)}</span>
            </div>
            <div className="bg-purple-50 text-purple-700 p-2.5 rounded-xl border border-purple-100 flex flex-col justify-between items-center min-h-[58px]">
                <span className="block opacity-75">Returned ({state.activeTimeframe})</span>
                <span className="text-sm font-black mt-0.5 block">{formatNaira(periodMoneyReturned)}</span>
                {periodMoneyReturnedPending > 0 && (
                  <span className="text-[8px] text-amber-600 block">({formatNaira(periodMoneyReturnedPending)} pending)</span>
                )}
            </div>
          </div>

          {/* Quick type filter row inside All Log tab */}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={() => setTypeFilter('all')}
              className={`text-[10px] px-2.5 py-1 rounded-full font-bold border transition-all ${
                typeFilter === 'all' 
                  ? 'bg-neutral-800 text-white border-neutral-800' 
                  : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              All Entries
            </button>
            <button
              onClick={() => setTypeFilter('loans')}
              className={`text-[10px] px-2.5 py-1 rounded-full font-bold border transition-all ${
                typeFilter === 'loans' 
                  ? 'bg-neutral-800 text-white border-neutral-800' 
                  : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Loans Only
            </button>
            <button
              onClick={() => setTypeFilter('kept')}
              className={`text-[10px] px-2.5 py-1 rounded-full font-bold border transition-all ${
                typeFilter === 'kept' 
                  ? 'bg-neutral-800 text-white border-neutral-800' 
                  : 'bg-white text-neutral-500 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              Kept Money Only
            </button>
          </div>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
            {filteredTimeline
              .filter(t => {
                if (typeFilter === 'loans') return t.type === 'loan_given' || t.type === 'loan_repaid';
                if (typeFilter === 'kept') return t.type === 'money_kept' || t.type === 'money_returned';
                return true;
              })
              .map(t => {
                const config = typeConfig[t.type];
                const Icon = config.icon;
                const dateObj = new Date(t.timestamp);
                const isExpanded = expandedTxId === t.id;

                // Find if there is a linked original transaction for repayments/returns
                let linkedTx: BorrowKeepTransaction | undefined = undefined;
                if (t.linkedTransactionId) {
                  linkedTx = transactions.find(orig => orig.id === t.linkedTransactionId);
                }

                // For loans/kept, dynamically sum up active matching repayments
                const custKey = t.name.toLowerCase();
                let remaining = t.amount;
                let repaymentsCount = 0;
                
                if (t.type === 'loan_given' && ledger[custKey]) {
                  const m = ledger[custKey].loans.find(l => l.tx.id === t.id);
                  if (m) {
                    remaining = m.remaining;
                    repaymentsCount = m.repayments.length;
                  }
                } else if (t.type === 'money_kept' && ledger[custKey]) {
                  const m = ledger[custKey].kept.find(k => k.tx.id === t.id);
                  if (m) {
                    remaining = m.remaining;
                    repaymentsCount = m.returns.length;
                  }
                }

                return (
                  <div 
                    key={t.id} 
                    className={`border border-neutral-100 rounded-xl p-3 bg-neutral-50/80 transition-all ${
                      isExpanded ? 'ring-1 ring-indigo-500/30 bg-white shadow-sm' : 'hover:bg-neutral-100/40'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-lg border ${config.color} shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-neutral-800">{t.name}</span>
                            <span className="text-[9px] text-neutral-400 font-mono">
                              {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="text-[10px] text-neutral-500 flex items-center gap-1 mt-0.5">
                            <span className="font-semibold">{config.label}</span>
                            <span>•</span>
                            <span>By {t.employeeName || 'System'}</span>
                          </div>
                          
                          {/* Display connection details if linked */}
                          {linkedTx && (
                            <div className="mt-1 text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100/50 inline-flex items-center gap-1">
                              <Link2 className="w-2.5 h-2.5" />
                              <span>Linked to original {linkedTx.type === 'loan_given' ? 'Loan' : 'Deposit'} of {formatNaira(linkedTx.amount)}</span>
                            </div>
                          )}

                          {/* Displays if loan is settled or partial */}
                          {t.type === 'loan_given' && (
                            <div className="mt-1 flex items-center gap-1.5">
                              {remaining === 0 ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  ✓ FULLY REPAID
                                </span>
                              ) : remaining < t.amount ? (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  🔄 PARTIAL ({formatNaira(remaining)} outstanding)
                                </span>
                              ) : (
                                <span className="bg-red-100 text-red-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  ⏳ UNPAID
                                </span>
                              )}
                            </div>
                          )}

                          {t.type === 'money_kept' && (
                            <div className="mt-1 flex items-center gap-1.5">
                              {remaining === 0 ? (
                                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  ✓ FULLY RETURNED
                                </span>
                              ) : remaining < t.amount ? (
                                <span className="bg-purple-100 text-purple-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  🔄 PARTIAL ({formatNaira(remaining)} held)
                                </span>
                              ) : (
                                <span className="bg-blue-100 text-blue-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  ⏳ HELD IN SAFE
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <span className={`font-mono font-extrabold text-xs ${
                          t.type === 'loan_given' || t.type === 'money_returned' ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {t.type === 'loan_given' || t.type === 'money_returned' ? '-' : '+'}{formatNaira(t.amount)}
                        </span>
                        
                        {/* Approval Status Badges */}
                        {t.approvalStatus === 'pending' && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-black px-1.5 py-0.5 rounded-full inline-block animate-pulse">
                            ⏳ PENDING APPROVAL
                          </span>
                        )}
                        {t.approvalStatus === 'approved' && (t.type === 'loan_repaid' || t.type === 'money_returned') && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-black px-1.5 py-0.5 rounded-full inline-block">
                            ✓ APPROVED
                          </span>
                        )}
                        {t.approvalStatus === 'rejected' && (
                          <span className="bg-red-50 text-red-700 border border-red-200 text-[8px] font-black px-1.5 py-0.5 rounded-full inline-block">
                            ❌ REJECTED
                          </span>
                        )}
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => setExpandedTxId(isExpanded ? null : t.id)}
                            className="text-[10px] text-neutral-400 hover:text-neutral-600 font-bold px-1.5 py-0.5 rounded hover:bg-neutral-200/50"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                          
                          {/* Manager or entry owner deletion capability */}
                          {(state.currentUser.role === 'Manager' || state.currentUser.id === t.employeeId) && (
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="text-red-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details view */}
                    {isExpanded && (
                      <div className="mt-2.5 pt-2.5 border-t border-neutral-200/60 text-[11px] text-neutral-600 space-y-2 bg-white/50 p-2 rounded-lg">
                        <div className="flex justify-between items-center pb-2 border-b border-neutral-100">
                          <span className="font-extrabold text-[9px] text-neutral-400 uppercase tracking-wider">Quick Dispute Tool:</span>
                          <button
                            onClick={() => {
                              setSelectedDisputeCustomer(t.name.toLowerCase());
                              setIsDisputeModalOpen(true);
                            }}
                            className="text-[9px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition shadow-3xs"
                          >
                            <FileText className="w-2.5 h-2.5" />
                            <span>Verify Customer Statement</span>
                          </button>
                        </div>
                        {t.notes && (
                          <div>
                            <span className="font-bold text-neutral-400 uppercase text-[9px] block">Memo Notes:</span>
                            <p className="italic text-neutral-700">"{t.notes}"</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-neutral-400 block font-semibold">Ledger Key ID:</span>
                            <span className="font-mono text-neutral-500 break-all">{t.id}</span>
                          </div>
                          <div>
                            <span className="text-neutral-400 block font-semibold">Registered Employee:</span>
                            <span>{t.employeeName || 'N/A'} (ID: {t.employeeId?.substring(0, 6)}...)</span>
                          </div>
                        </div>

                        {/* Display Handover Proof Snapshots if any exist */}
                        {(t.photoFront || t.photoBack || t.photo) && (
                          <div className="pt-3 border-t border-neutral-150 animate-fade-in space-y-2">
                            <span className="font-extrabold text-indigo-950 uppercase text-[8px] block tracking-wider flex items-center gap-1">
                              <Camera className="w-3 h-3 text-indigo-500" />
                              <span>📸 Employee Handover Proof Snapshots</span>
                            </span>
                            <div className="grid grid-cols-2 gap-3 mt-1.5">
                              {/* Front photo */}
                              {(t.photoFront || (!t.photoBack && t.photo)) && (
                                <div className="space-y-1">
                                  <span className="text-[7px] font-black uppercase tracking-wider text-neutral-400 block font-mono">👤 Front View (Customer)</span>
                                  <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 shadow-3xs group">
                                    <img 
                                      src={t.photoFront || t.photo} 
                                      alt="Front view proof" 
                                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                </div>
                              )}
                              {/* Back photo */}
                              {t.photoBack && (
                                <div className="space-y-1">
                                  <span className="text-[7px] font-black uppercase tracking-wider text-neutral-400 block font-mono">💵 Back View (Cash / Receipt)</span>
                                  <div className="relative w-full aspect-video bg-neutral-900 rounded-xl overflow-hidden border border-neutral-200 shadow-3xs group">
                                    <img 
                                      src={t.photoBack} 
                                      alt="Back view proof" 
                                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Display sub-repayments if this is a loan parent */}
                        {repaymentsCount > 0 && (
                          <div className="pt-1.5 border-t border-neutral-100">
                            <span className="font-bold text-neutral-400 uppercase text-[8px] block mb-1">
                              LINKED TRANSACTION LOGS ({repaymentsCount})
                            </span>
                            <div className="space-y-1">
                              {transactions
                                .filter(sub => sub.linkedTransactionId === t.id)
                                .map(sub => (
                                  <div key={sub.id} className="flex justify-between text-[10px] bg-white p-1.5 rounded border border-neutral-100">
                                    <span className="text-emerald-700 font-medium">
                                      {sub.type === 'loan_repaid' ? 'Repayment' : 'Return'} received
                                    </span>
                                    <span className="font-mono font-bold text-emerald-600">
                                      +{formatNaira(sub.amount)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            {filteredTimeline.length === 0 && (
              <p className="text-xs text-neutral-400 text-center py-6 bg-neutral-50 rounded-xl border border-neutral-100">
                No ledger logs found in the selected {state.activeTimeframe.toLowerCase()} filter.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 7. DISPUTE SOLVER & CERTIFIED STATEMENT MODAL */}
      {isDisputeModalOpen && selectedDisputeCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-fade-in text-neutral-800">
            
            {/* Modal Header */}
            <div className="bg-neutral-900 text-white p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500 text-white">
                  <ShieldAlert className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight font-mono">POSTrack Dispute Settle Portal</h3>
                  <p className="text-[10px] text-neutral-400">Certified Account Statement & Audit Trail</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsDisputeModalOpen(false);
                  setSelectedDisputeCustomer(null);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              
              {/* Receipt Header Banner */}
              <div className="border border-dashed border-neutral-200 rounded-xl p-4 bg-neutral-50/50 space-y-3 relative overflow-hidden">
                <div className="absolute right-4 top-4 border-2 border-emerald-500/20 text-emerald-500/20 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transform rotate-12 pointer-events-none font-mono">
                  POSTrack Certified
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] text-neutral-400 font-mono font-bold block uppercase">Client / Account Owner</span>
                    <span className="font-bold text-sm text-indigo-950">
                      {allCustomerNames.find(c => c.toLowerCase() === selectedDisputeCustomer) || selectedDisputeCustomer}
                    </span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">Custom ID: {selectedDisputeCustomer.substring(0, 8)}_SECURE</span>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[9px] text-neutral-400 font-mono font-bold block uppercase">Generated Time</span>
                    <span className="font-bold text-neutral-700">{new Date().toLocaleDateString()}</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              {/* KPI Highlights - In, Out, Balance */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-center">
                  <span className="text-[8px] text-neutral-400 uppercase font-mono font-bold tracking-wider">Deposited</span>
                  <div className="text-xs sm:text-sm font-black text-blue-700 mt-1">{formatNaira(keptSummary.totalDeposited)}</div>
                </div>
                <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-center">
                  <span className="text-[8px] text-neutral-400 uppercase font-mono font-bold tracking-wider">Collected</span>
                  <div className="text-xs sm:text-sm font-black text-amber-700 mt-1">{formatNaira(keptSummary.totalWithdrawn)}</div>
                </div>
                <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-center">
                  <span className="text-[8px] text-neutral-400 uppercase font-mono font-bold tracking-wider">Safe Balance</span>
                  <div className="text-xs sm:text-sm font-black text-purple-700 mt-1">{formatNaira(keptSummary.balance)}</div>
                </div>
              </div>

              {/* Audit Advice banner */}
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                <Info className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed font-medium">
                  <strong>How to solve dispute:</strong> Show this table below to your customer. Point to the dates and staff members who handled each withdrawal. They will easily recall when they took the money.
                </p>
              </div>

              {/* Ledger Statement Timeline Table */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] uppercase font-mono font-bold text-neutral-400 tracking-wider">Statement of Safe Account Logs</h4>
                
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead className="bg-neutral-50 text-neutral-500 uppercase font-mono text-[9px] border-b border-neutral-200">
                      <tr>
                        <th className="p-3">Date & Time</th>
                        <th className="p-3">Activity Type</th>
                        <th className="p-3">In / Out</th>
                        <th className="p-3 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-150">
                      {keptTransactionsWithRunningBalance.map((t, index) => {
                        const isDeposit = t.type === 'money_kept';
                        const dateObj = new Date(t.timestamp);
                        return (
                          <tr key={t.id} className="hover:bg-neutral-50/50 transition">
                            <td className="p-3 text-neutral-500 font-mono text-[10px]">
                              <div>{dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              <div className="opacity-70 mt-0.5">{dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className={isDeposit ? 'text-blue-600' : 'text-amber-600'}>
                                  {isDeposit ? '📥 Deposit' : '📤 Withdrawal'}
                                </span>
                              </div>
                              {t.notes && (
                                <div className="text-[10px] text-neutral-600 italic bg-neutral-50 p-1 rounded border border-neutral-100/60 mt-1 max-w-[180px]">
                                  "{t.notes}"
                                </div>
                              )}
                              <div className="text-[9px] text-neutral-400 mt-0.5">Staff: {t.employeeName || 'Staff'}</div>
                              {(t.photoFront || t.photoBack || t.photo) && (
                                <div className="mt-1.5 relative group inline-block">
                                  <span className="text-[9px] bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5 w-fit cursor-pointer transition">
                                    <Camera className="w-2.5 h-2.5" /> 
                                    <span>
                                      {t.photoFront && t.photoBack ? 'Dual Photo Proof' : 'Photo Proof'}
                                    </span>
                                  </span>
                                  {/* Hover floating images preview */}
                                  <div className="absolute left-0 bottom-full mb-1.5 z-50 hidden group-hover:flex flex-col gap-2 bg-neutral-900 p-2.5 rounded-xl border border-neutral-700 shadow-2xl w-[260px] animate-fade-in">
                                    <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
                                      <span className="text-[8px] font-mono text-white font-black tracking-wider">SECURED HANDOVER PROOF</span>
                                      <span className="text-[7px] text-indigo-400 font-bold">CASHLOGS SECURE™</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {/* Front View */}
                                      {(t.photoFront || (!t.photoBack && t.photo)) && (
                                        <div className="space-y-1">
                                          <div className="text-[7px] text-neutral-300 font-mono font-bold uppercase">👤 Customer</div>
                                          <div className="aspect-video bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700">
                                            <img 
                                              src={t.photoFront || t.photo} 
                                              alt="Front view proof" 
                                              className="w-full h-full object-cover" 
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                        </div>
                                      )}
                                      {/* Back View */}
                                      {t.photoBack && (
                                        <div className="space-y-1">
                                          <div className="text-[7px] text-neutral-300 font-mono font-bold uppercase">💵 Cash/Receipt</div>
                                          <div className="aspect-video bg-neutral-800 rounded-lg overflow-hidden border border-neutral-700">
                                            <img 
                                              src={t.photoBack} 
                                              alt="Back view proof" 
                                              className="w-full h-full object-cover" 
                                              referrerPolicy="no-referrer"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className={`p-3 font-mono font-bold ${isDeposit ? 'text-blue-600' : 'text-red-500'}`}>
                              {isDeposit ? '+' : '-'}{formatNaira(t.amount)}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-neutral-900">
                              {formatNaira(t.runningBalance)}
                            </td>
                          </tr>
                        );
                      })}

                      {keptTransactionsWithRunningBalance.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-neutral-400 italic">
                            No safe deposits or withdrawals found for this client.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Share & Export Controls */}
              <div className="bg-indigo-50/50 border border-indigo-100/80 p-4 rounded-xl space-y-3">
                <span className="text-[9px] text-indigo-950 font-mono font-bold block uppercase tracking-wider">⚡ Dispatch Settle Evidence</span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => handleCopyToClipboard(getWhatsAppStatementText())}
                    className={`text-xs p-3 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                      isDisputeCopied 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {isDisputeCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied Statement for WhatsApp!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span>Copy WhatsApp Statement</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      const text = getWhatsAppStatementText();
                      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      const customerCleanName = selectedDisputeCustomer.replace(/[^a-z0-9]/gi, '_');
                      a.download = `POSTrack_${customerCleanName}_Statement.txt`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs p-3 bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-xl font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Download Audit File (.txt)</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-neutral-50 p-4 border-t border-neutral-150 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setIsDisputeModalOpen(false);
                  setSelectedDisputeCustomer(null);
                }}
                className="text-xs px-4 py-2 bg-neutral-800 text-white hover:bg-neutral-900 rounded-xl font-bold transition cursor-pointer"
              >
                Close Portal
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

