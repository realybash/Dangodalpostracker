import { Transaction, User } from './types';

// Existing phone/name normalization functions
export function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  return phone.replace(/\D/g, '');
}

export function formatPhone(phone: string): string {
  const cleaned = normalizePhone(phone);
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return cleaned;
  }
  if (cleaned.length === 10 && !cleaned.startsWith('0')) {
    return '0' + cleaned;
  }
  return cleaned;
}

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '');
}

// Nigerian Naira currency formatting helper
export function formatNaira(amount: number | undefined | null): string {
  const val = Number(amount || 0);
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${isNegative ? '-' : ''}₦${formatted}`;
}

// Unique and random ID generator helper
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11).toUpperCase();
}

// Date-matching helpers
export function isSameDay(d1: Date | string | number, d2: Date | string | number): boolean {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isSameWeek(d1: Date | string | number, d2: Date | string | number): boolean {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  
  const getStartOfWeek = (d: Date) => {
    const temp = new Date(d);
    const day = temp.getDay();
    const diff = temp.getDate() - day;
    return new Date(temp.setDate(diff));
  };
  
  const s1 = getStartOfWeek(date1);
  const s2 = getStartOfWeek(date2);
  return isSameDay(s1, s2);
}

export function isSameMonth(d1: Date | string | number, d2: Date | string | number): boolean {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth();
}

export function isSameYear(d1: Date | string | number, d2: Date | string | number): boolean {
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return date1.getFullYear() === date2.getFullYear();
}

// CBN EMTL Charge calculation helper (₦50 on transactions of 10,000+)
export function calculateCBNCharge(amount: number): number {
  const amt = Number(amount || 0);
  return amt >= 10000 ? 50 : 0;
}

// Terminal fee calculation helper (with withdrawal percentage and transfer flat rates)
export function calculateTerminalFee(
  amount: number,
  type: string,
  provider: string,
  terminalFeeRate: number, // percentage rate (0.25 or 0.5)
  subType?: string
): number {
  const amt = Number(amount || 0);
  if (amt <= 0) return 0;

  if (type === 'Withdrawal') {
    // Percentage fee (terminalFeeRate is in percent, so divide by 100)
    const rate = (terminalFeeRate || 0.5) / 100;
    const computed = amt * rate;
    // OPay / Moniepoint standard cap for withdrawal is ₦100
    return Math.min(computed, 100);
  } else {
    // Deposit or Transfer
    if (subType === 'SameBank') {
      return 10; // Standard same-bank deposits on POS agent terminals carry a flat 10 Naira fee
    }
    // Interbank flat transfer fee (standard is 10 Naira)
    return 10;
  }
}

// Recommended Agent fee suggestion helper based on standard Nigerian agency tier practices
export function getRecommendedAgentFee(amount: number, type: string, subType?: string): number {
  const amt = Number(amount || 0);
  if (amt <= 0) return 0;

  if (type === 'Withdrawal') {
    if (amt <= 5000) return 100;
    if (amt <= 10000) return 200;
    if (amt <= 20000) return 300;
    if (amt <= 50000) return 500;
    return Math.round(amt * 0.01);
  } else {
    if (subType === 'SameBank') {
      if (amt <= 5000) return 100;
      if (amt <= 10000) return 150;
      return 200;
    } else {
      if (amt <= 5000) return 150;
      if (amt <= 10000) return 200;
      if (amt <= 20000) return 250;
      return 300;
    }
  }
}

// Deterministic POS reference number format helper
export function getProviderTransactionNumber(tx: { id: string; provider: string; timestamp?: string }): string {
  if (!tx) return '';
  const prefix = tx.provider === 'OPay' ? 'OPY' : tx.provider === 'Moniepoint' ? 'MNP' : 'PLM';
  const d = tx.timestamp ? new Date(tx.timestamp) : new Date();
  const dateStr = d.getFullYear().toString().slice(-2) + 
                  String(d.getMonth() + 1).padStart(2, '0') + 
                  String(d.getDate()).padStart(2, '0');
  
  let hashStr = '';
  for (let i = 0; i < tx.id.length; i++) {
    hashStr += tx.id.charCodeAt(i).toString();
  }
  const numericId = hashStr.slice(0, 6).padEnd(6, '0');
  return `${prefix}${dateStr}${numericId}`;
}

export function getAuthPassword(pin: string): string {
  // Pad the 4-digit PIN to satisfy Firebase Auth's 6+ character password requirement
  return `opay_${pin}_secure`;
}

/**
 * Standardizes user object from Firestore data
 */
export function mapFirestoreUser(data: any, docId?: string): User {
  const uid = data.uid || data.id || docId || 'unknown';
  const rawName = data.fullName || data.name || data.displayName || 'Unknown User';
  const rawPhone = data.phoneNumber || data.phone || '';
  
  return {
    ...data,
    id: uid,
    uid: uid,
    name: rawName.trim(),
    fullName: rawName.trim(),
    phone: rawPhone.trim(),
    phoneNumber: rawPhone.trim(),
    role: data.role || 'Employee',
    pin: data.pin || '1111',
    ownerId: data.ownerId || (data.role === 'Manager' ? uid : 'mgr_1')
  } as User;
}

/**
 * Standardizes phone numbers for comparison (last 10 digits only)
 */
export const cleanPhoneForCompare = (p: string) => {
  if (!p) return '';
  const cleaned = p.replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
};

// Aggregated metrics calculator for transactions across different timeframes
export function computeTxMetrics(
  transactions: Transaction[],
  timeframe: string,
  terminalFeeRate: number = 0.5
) {
  const now = new Date();
  
  const filtered = transactions.filter((tx) => {
    if (tx.status === 'Failed') return false;

    const txDate = new Date(tx.timestamp);
    if (timeframe === 'Daily') {
      return isSameDay(txDate, now);
    } else if (timeframe === 'Weekly') {
      return isSameWeek(txDate, now);
    } else if (timeframe === 'Monthly') {
      return isSameMonth(txDate, now);
    } else if (timeframe === 'Yearly') {
      return isSameYear(txDate, now);
    }
    return true;
  });

  let volume = 0;
  let terminalFees = 0;
  let cbnCharges = 0;
  let profit = 0;
  
  const breakdowns = {
    Deposit: { count: 0, profit: 0 },
    Withdrawal: { count: 0, profit: 0 },
    Transfer: { count: 0, profit: 0 }
  };

  filtered.forEach((tx) => {
    volume += tx.amount || 0;
    terminalFees += tx.terminalFee || 0;
    cbnCharges += tx.cbnCharge || 0;
    profit += tx.profit || 0;

    const tType = tx.type;
    if (breakdowns[tType]) {
      breakdowns[tType].count += 1;
      breakdowns[tType].profit += tx.profit || 0;
    }
  });

  const count = filtered.length;
  const averageTxSize = count > 0 ? volume / count : 0;

  return {
    count,
    volume,
    terminalFees,
    cbnCharges,
    profit,
    averageTxSize,
    breakdowns
  };
}

// Seed transactions generator
export function getSeedTransactions(terminalFeeRate: number = 0.5): Transaction[] {
  const now = new Date();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(now.getDate() - 3);

  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(now.getDate() - 5);

  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(now.getDate() - 10);

  const createTx = (
    id: string,
    type: 'Deposit' | 'Withdrawal' | 'Transfer',
    provider: 'OPay' | 'Moniepoint' | 'PalmPay',
    amount: number,
    customerFee: number,
    date: Date,
    subType: 'SameBank' | 'OtherBank' = 'OtherBank',
    notes: string = ''
  ): Transaction => {
    const termFee = calculateTerminalFee(amount, type, provider, terminalFeeRate, subType);
    const cbnCharge = calculateCBNCharge(amount);
    return {
      id,
      employeeId: 'EMP-001',
      employeeName: 'Babatunde',
      type,
      provider,
      subType,
      amount,
      customerFee,
      terminalFee: termFee,
      cbnCharge,
      profit: customerFee - termFee - cbnCharge,
      timestamp: date.toISOString(),
      status: 'Success',
      notes,
      feeMethod: 'Cash',
      chargesStatus: 'Paid'
    };
  };

  return [
    createTx('TX-1001', 'Withdrawal', 'OPay', 15000, 150, now, 'OtherBank', 'Withdrawal for customer'),
    createTx('TX-1002', 'Deposit', 'Moniepoint', 5000, 100, now, 'SameBank', 'Deposited to savings'),
    createTx('TX-1003', 'Transfer', 'PalmPay', 25000, 250, yesterday, 'OtherBank', 'Urgent family transfer'),
    createTx('TX-1004', 'Withdrawal', 'OPay', 8000, 100, threeDaysAgo, 'SameBank', 'Withdrawal from card'),
    createTx('TX-1005', 'Deposit', 'Moniepoint', 12000, 150, fiveDaysAgo, 'OtherBank', 'Business payout'),
    createTx('TX-1006', 'Transfer', 'OPay', 30000, 300, tenDaysAgo, 'OtherBank', 'Rent deposit')
  ];
}
