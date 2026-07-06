import React, { useState } from 'react';
import { User } from '../types';
import { X, Pencil, Check } from 'lucide-react';
import { playStatusSound } from './TransactionForm';

interface EditEmployeeModalProps {
  employee: User;
  onUpdateUser: (user: User) => void;
  onClose: () => void;
}

export function EditEmployeeModal({ employee, onUpdateUser, onClose }: EditEmployeeModalProps) {
  const [name, setName] = useState(employee.name);
  const [phone, setPhone] = useState(employee.phone || '');
  const [pin, setPin] = useState(employee.pin || '1111');
  const [activated, setActivated] = useState(employee.activated !== false);
  const [error, setError] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (pin.length !== 4 || isNaN(Number(pin))) {
      setError('PIN must be exactly 4 digits.');
      return;
    }

    const updated: User = {
      ...employee,
      name: name.trim(),
      phone: phone.trim() || undefined,
      pin,
      activated
    };

    onUpdateUser(updated);
    playStatusSound('Success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-neutral-200 animate-fade-in text-neutral-800">
        <div className="bg-indigo-600 text-white px-5 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-indigo-200" />
            <h3 className="font-extrabold text-sm tracking-tight">Edit Cashier Profile</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && <div className="p-2.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold">{error}</div>}

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-sm focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">Phone Contact</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-bold text-sm focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono">4-Digit PIN Passcode</label>
            <input
              type="text"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-neutral-850 font-extrabold text-sm focus:outline-none focus:border-indigo-500 font-mono tracking-widest"
              required
            />
          </div>

          <div className="flex items-center gap-2 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
            <input
              type="checkbox"
              id="editActivated"
              checked={activated}
              onChange={(e) => setActivated(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
            />
            <label htmlFor="editActivated" className="text-xs font-bold text-neutral-600 cursor-pointer select-none">
              Account Activated
            </label>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-sm transition cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            Save Changes
          </button>
        </form>
      </div>
    </div>
  );
}
