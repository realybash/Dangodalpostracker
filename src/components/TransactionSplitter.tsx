/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, SubTransfer, User, AppSettings } from '../types';
import { formatNaira, generateId } from '../utils';
import { 
  ArrowRightLeft, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  AlertTriangle, 
  Info, 
  Banknote,
  Smartphone,
  Landmark,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface TransactionSplitterProps {
  parentTransaction: Transaction;
  onSave: (children: Transaction[], updatedParent: Transaction) => void;
  onClose: () => void;
  currentUser: User;
  settings?: AppSettings;
}

export const TransactionSplitter: React.FC<TransactionSplitterProps> = ({
  parentTransaction,
  onSave,
  onClose,
  currentUser,
  settings
}) => {
  const [children, setChildren] = useState<SubTransfer[]>(
    parentTransaction.subTransfers || [{ recipientName: '', accountNumber: '', amount: 0 }]
  );

  // Calculate available funds from the parent withdrawal
  // We use the 'cashHandout' equivalent logic: amount - customerFee
  const availableFunds = useMemo(() => {
    return parentTransaction.amount - (parentTransaction.customerFee || 0);
  }, [parentTransaction]);

  const totalDistributed = useMemo(() => {
    return children.reduce((sum, child) => sum + child.amount, 0);
  }, [children]);

  const remainingBalance = availableFunds - totalDistributed;

  const handleAddChild = () => {
    setChildren([...children, { recipientName: '', accountNumber: '', amount: 0 }]);
  };

  const handleRemoveChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleUpdateChild = (index: number, updates: Partial<SubTransfer>) => {
    const next = [...children];
    next[index] = { ...next[index], ...updates };
    setChildren(next);
  };

  const handleAutoFill = (index: number) => {
    if (remainingBalance <= 0) return;
    const next = [...children];
    next[index].amount = (next[index].amount || 0) + remainingBalance;
    setChildren(next);
  };

  const handleFinalize = () => {
    if (remainingBalance < 0) {
      alert(`Distribution Error: You have over-allocated funds by ${formatNaira(Math.abs(remainingBalance))}.`);
      return;
    }

    const validChildren = children.filter(c => c.amount > 0 && c.recipientName && c.accountNumber);
    if (validChildren.length === 0) {
      alert("Please add at least one valid transfer recipient.");
      return;
    }

    // 1. Prepare Child Transactions
    const childTransactions: Transaction[] = validChildren.map((c) => ({
      id: generateId(),
      employeeId: currentUser.id,
      employeeName: currentUser.name,
      type: 'Transfer',
      provider: parentTransaction.provider, // Usually same provider if within the same workflow
      amount: c.amount,
      customerFee: 0, // Fee is already covered by the parent withdrawal usually
      terminalFee: 0,
      profit: 0,
      timestamp: new Date().toISOString(),
      notes: `Split transfer from parent: ${parentTransaction.id}`,
      customerPhone: parentTransaction.customerPhone,
      status: 'Success',
      ownerId: parentTransaction.ownerId,
      parentTransactionId: parentTransaction.id,
      destinationBank: 'Bank Transfer',
      customerName: c.recipientName,
      referenceNumber: c.accountNumber,
    }));

    // 2. Update Parent Transaction
    const updatedParent: Transaction = {
      ...parentTransaction,
      isSplitParent: true,
      subTransfers: children,
      remainingBalance: remainingBalance,
      mode: 'SplitWithdrawal'
    };

    onSave(childTransactions, updatedParent);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-emerald-600 p-6 text-white shrink-0 relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowRightLeft className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">Transaction Splitter</h2>
                <p className="text-xs font-bold text-emerald-100 uppercase tracking-widest font-mono">Professional Auditing Tool</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-emerald-700/40 rounded-2xl p-4 flex items-center justify-between border border-white/10">
            <div className="space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-200 font-mono">Source Withdrawal</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black font-mono">{formatNaira(availableFunds)}</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-bold">Net Funds</span>
              </div>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-black uppercase tracking-widest text-emerald-200 font-mono">Status</span>
              <div className={`text-xs font-black px-3 py-1 rounded-full ${remainingBalance === 0 ? 'bg-emerald-400/30 text-emerald-100' : 'bg-orange-400/30 text-orange-100'}`}>
                {remainingBalance === 0 ? 'Fully Distributed' : `${formatNaira(remainingBalance)} Unassigned`}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-widest text-neutral-400 font-mono flex items-center gap-2">
                <Info className="w-3.5 h-3.5" /> Distribution Breakdown
              </label>
              <button 
                onClick={handleAddChild}
                className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Recipient
              </button>
            </div>

            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {children.map((child, index) => (
                  <motion.div 
                    key={index}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 space-y-3 relative group hover:border-emerald-300 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest font-mono">Child Transfer #{index + 1}</span>
                      <div className="flex items-center gap-2">
                        {remainingBalance > 0 && child.amount === 0 && (
                          <button 
                            onClick={() => handleAutoFill(index)}
                            className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded cursor-pointer hover:bg-emerald-200"
                          >
                            Assign Remaining
                          </button>
                        )}
                        {children.length > 1 && (
                          <button 
                            onClick={() => handleRemoveChild(index)}
                            className="text-neutral-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-12 sm:col-span-6 space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-tighter">
                          <Landmark className="w-3 h-3" /> Beneficiary Name
                        </div>
                        <input 
                          type="text"
                          placeholder="John Doe"
                          value={child.recipientName}
                          onChange={(e) => handleUpdateChild(index, { recipientName: e.target.value })}
                          className="w-full text-sm p-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-bold"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-tighter">
                          <Smartphone className="w-3 h-3" /> Acct Number
                        </div>
                        <input 
                          type="text"
                          placeholder="0123456789"
                          maxLength={10}
                          value={child.accountNumber}
                          onChange={(e) => handleUpdateChild(index, { accountNumber: e.target.value.replace(/\D/g, '') })}
                          className="w-full text-sm p-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-neutral-500 uppercase tracking-tighter">
                          <Banknote className="w-3 h-3" /> Amount (₦)
                        </div>
                        <input 
                          type="number"
                          placeholder="0"
                          value={child.amount || ''}
                          onChange={(e) => handleUpdateChild(index, { amount: parseFloat(e.target.value) || 0 })}
                          className="w-full text-sm p-3 bg-emerald-50 border border-emerald-100 rounded-xl focus:outline-none focus:border-emerald-500 font-black text-emerald-800"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Footer Summary */}
        <div className="p-6 bg-neutral-50 border-t border-neutral-200 shrink-0">
          <div className="flex items-center justify-between mb-4 bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Final Handover</span>
              <div className={`text-xl font-black font-mono ${remainingBalance < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {formatNaira(remainingBalance)}
              </div>
            </div>
            <div className="text-right space-y-1">
              <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest font-mono">Audit Confidence</span>
              <div className="flex items-center gap-1 text-emerald-600 justify-end">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-black">Linked Audit</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 h-14 rounded-2xl border-2 border-neutral-200 text-neutral-600 font-black hover:bg-neutral-100 transition-colors cursor-pointer active:scale-95 duration-100"
            >
              Discard Changes
            </button>
            <button 
              onClick={handleFinalize}
              disabled={remainingBalance < 0}
              className={`flex-2 h-14 rounded-2xl font-black text-white shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all active:scale-95 duration-100 ${remainingBalance < 0 ? 'bg-neutral-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'}`}
            >
              <Check className="w-5 h-5 stroke-[3]" /> Generate Linked Transfers
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
