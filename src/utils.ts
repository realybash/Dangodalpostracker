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
export function calculateCBNCharge(amount: number, type?: string): number {
  const amt = Number(amount || 0);
  
  // 2026 OFFICIAL REGULATION: ₦50 Electronic Money Transfer Levy (EMTL)
  // Automatically applied to all POS transactions (Withdrawal/Transfer/Deposit) of ₦10,000 and above.
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

  if (type === 'Withdrawal' || type === 'Cash Out') {
    // Moniepoint & OPay: 0.5% capped at ₦100 for amounts > 20k
    if (provider === 'Moniepoint' || provider === 'OPay') {
      if (amt <= 20000) {
        return amt * 0.005;
      }
      return 100;
    }
    // PalmPay: 0.5% (no specified cap in user requirements)
    if (provider === 'PalmPay') {
      return amt * 0.005;
    }
    
    // Default fallback
    if (amt <= 20000) {
      const rate = (terminalFeeRate || 0.5) / 100;
      return amt * rate;
    }
    return 100;
  } else if (type === 'Transfer') {
    // Outbound Bank Transfer
    if (provider === 'OPay') return 20; // 10-30 range, using 20
    if (provider === 'PalmPay') return 10;
    if (provider === 'Moniepoint') return 20;
    return 20; 
  } else if (type === 'Cash Out (Transfer)') {
    return 0;
  } else if (type === 'Airtime') {
    if (provider === 'OPay') return amt * 0.032; // 3.2%
    if (provider === 'PalmPay') return amt * 0.02; // 2%
    if (provider === 'Moniepoint') return amt * 0.02; // 2%
    return 0;
  } else if (type === 'Bills') {
    if (provider === 'OPay') return amt * 0.022; // 2.2%
    if (provider === 'PalmPay') return amt * 0.02; // 2%
    if (provider === 'Moniepoint') return 0; // 0
    return 0;
  } else {
    // Wallet Deposit / Cash In / Deposit
    if (provider === 'OPay') return 10;
    if (provider === 'PalmPay') return 10;
    if (provider === 'Moniepoint') return 20;
    return 20;
  }
}

// Recommended Agent fee suggestion helper based on standard Nigerian agency tier practices
export function getRecommendedAgentFee(amount: number, type: string, subType?: string): number {
  const amt = Number(amount || 0);
  if (amt <= 0) return 0;

  if (type === 'Withdrawal' || type === 'Cash Out (Transfer)' || type === 'Cash Out') {
    // Standard Nigerian Agent Tiers (Street Reality 2026)
    if (amt <= 5000) return 100;
    if (amt <= 10000) return 200;
    if (amt <= 15000) return 300;
    if (amt <= 20000) return 400;
    
    // Competitive standard: 2% of the total amount for amounts above 20k
    return Math.ceil(amt * 0.02);
  } else {
    // Cash In / Deposit / Transfer
    if (amt <= 5000) return 100;
    if (amt <= 10000) return 200;
    if (amt <= 20000) return 300;
    
    // Above 20k: ₦100 per every 10k block
    return Math.max(200, Math.ceil(amt / 10000) * 100);
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
export function cleanPhoneForCompare(p: string) {
  if (!p) return '';
  const cleaned = p.replace(/\D/g, '');
  return cleaned.length >= 10 ? cleaned.slice(-10) : cleaned;
}

/**
 * Returns a friendly label for transaction types to differentiate them in UI
 */
export function getFriendlyTypeLabel(type: string): string {
  if (type === 'Cash Out (Transfer)') return 'Cash Out (Transfer)';
  if (type === 'Withdrawal') return 'Cash Out (ATM)';
  if (type === 'Deposit') return 'Wallet Deposit';
  if (type === 'Transfer') return 'Bank Transfer';
  return type;
}

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
  let totalCustomerCharges = 0;
  let totalProviderCharges = 0;
  let totalVat = 0;
  let totalCashback = 0;
  let totalCommission = 0;
  
  const breakdowns = {
    Deposit: { count: 0, profit: 0, volume: 0 },
    Withdrawal: { count: 0, profit: 0, volume: 0 },
    Transfer: { count: 0, profit: 0, volume: 0 },
    Airtime: { count: 0, profit: 0, volume: 0 },
    Data: { count: 0, profit: 0, volume: 0 },
    Bills: { count: 0, profit: 0, volume: 0 }
  };

  filtered.forEach((tx) => {
    volume += tx.amount || 0;
    terminalFees += tx.terminalFee || 0;
    cbnCharges += tx.cbnCharge || 0;
    profit += tx.profit || 0;
    
    // New fields aggregation
    totalCustomerCharges += tx.customerCharge || tx.customerFee || 0;
    totalProviderCharges += tx.providerCharge || tx.terminalFee || 0;
    totalVat += tx.vatAmount || 0;
    totalCashback += tx.cashback || 0;
    totalCommission += tx.commissionAmount || 0;

    const tType = tx.type;
    if (breakdowns[tType as keyof typeof breakdowns]) {
      const b = breakdowns[tType as keyof typeof breakdowns];
      b.count += 1;
      b.profit += tx.profit || 0;
      b.volume += tx.amount || 0;
    }
  });

  const count = filtered.length;
  const averageTxSize = count > 0 ? volume / count : 0;
  const averageProfit = count > 0 ? profit / count : 0;

  return {
    count,
    volume,
    terminalFees,
    cbnCharges,
    profit,
    totalCustomerCharges,
    totalProviderCharges,
    totalVat,
    totalCashback,
    totalCommission,
    averageTxSize,
    averageProfit,
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
    const cbnCharge = calculateCBNCharge(amount, type);
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

import { TransactionType, ProviderType, AppSettings, PricingProfile, ChargeRange } from './types';

export function getDefaultPricingProfiles(): PricingProfile[] {
  const providers: { id: string; name: string }[] = [
    { id: 'Moniepoint', name: 'Moniepoint (Official 2026)' },
    { id: 'OPay', name: 'OPay (Official 2026)' },
    { id: 'PalmPay', name: 'PalmPay (Official 2026)' },
    { id: 'Nomba', name: 'Nomba (Official 2026)' }
  ];
  
  const defaultTypes: TransactionType[] = ['Withdrawal', 'Deposit', 'Transfer', 'Cash In', 'Cash Out', 'Airtime', 'Data', 'Bills', 'Cash Out (Transfer)'];
  
  return providers.map(p => {
    const ranges: { [txType: string]: ChargeRange[] } = {};
    
    defaultTypes.forEach(t => {
      // Shared ranges for realistic agent fees (what agent charges customer)
      const isCashOut = t === 'Withdrawal' || t === 'Cash Out' || t === 'Cash Out (Transfer)';
      const standardCustomerRanges: ChargeRange[] = isCashOut ? [
        { id: `${p.id}_${t}_c1`, minAmount: 0, maxAmount: 5000, customerCharge: 100, customerChargeType: 'flat', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 },
        { id: `${p.id}_${t}_c2`, minAmount: 5000.01, maxAmount: 10000, customerCharge: 200, customerChargeType: 'flat', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 },
        { id: `${p.id}_${t}_c3`, minAmount: 10000.01, maxAmount: 20000, customerCharge: 400, customerChargeType: 'flat', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 },
        { id: `${p.id}_${t}_c4`, minAmount: 20000.01, maxAmount: 50000, customerCharge: 1000, customerChargeType: 'flat', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 },
        { id: `${p.id}_${t}_c5`, minAmount: 50000.01, maxAmount: 99999999, customerCharge: 2, customerChargeType: 'percent', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 }
      ] : [
        { id: `${p.id}_${t}_c1`, minAmount: 0, maxAmount: 10000, customerCharge: 100, customerChargeType: 'flat', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 },
        { id: `${p.id}_${t}_c2`, minAmount: 10000.01, maxAmount: 20000, customerCharge: 200, customerChargeType: 'flat', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 },
        { id: `${p.id}_${t}_c3`, minAmount: 20000.01, maxAmount: 99999999, customerCharge: 1, customerChargeType: 'percent', providerCharge: 0, providerChargeType: 'flat', settlementCharge: 0, vat: 7.5, commission: 0, cashback: 0 }
      ];

      ranges[t] = standardCustomerRanges.map(r => {
        let provChargeVal = 0;
        let provChargeType: 'flat' | 'percent' = 'flat';

        if (t === 'Withdrawal' || t === 'Cash Out') {
          if (p.id === 'PalmPay') {
            provChargeVal = 0.5;
            provChargeType = 'percent';
          } else {
            // Moniepoint/OPay: 0.5% cap 100
            if (r.maxAmount <= 20000) {
              provChargeVal = 0.5;
              provChargeType = 'percent';
            } else {
              provChargeVal = 100;
              provChargeType = 'flat';
            }
          }
        } else if (t === 'Transfer') {
          if (p.id === 'OPay') provChargeVal = 20; // 10-30 range, using 20
          else if (p.id === 'PalmPay') provChargeVal = 10;
          else if (p.id === 'Moniepoint') provChargeVal = 20;
          else provChargeVal = 20;
          provChargeType = 'flat';
        } else if (t === 'Deposit' || t === 'Cash In') {
          if (p.id === 'OPay') provChargeVal = 10;
          else if (p.id === 'PalmPay') provChargeVal = 10;
          else if (p.id === 'Moniepoint') provChargeVal = 20;
          else provChargeVal = 20;
          provChargeType = 'flat';
        } else if (t === 'Airtime' || t === 'Data') {
          if (p.id === 'OPay') provChargeVal = 3.2; // 3.2-5.5%
          else if (p.id === 'PalmPay') provChargeVal = 2;
          else if (p.id === 'Moniepoint') provChargeVal = 2;
          else provChargeVal = 2;
          provChargeType = 'percent';
        } else if (t === 'Bills') {
          if (p.id === 'OPay') provChargeVal = 2.2;
          else if (p.id === 'PalmPay') provChargeVal = 2;
          else if (p.id === 'Moniepoint') provChargeVal = 0;
          else provChargeVal = 0;
          provChargeType = 'percent';
        } else if (t === 'Cash Out (Transfer)') {
          provChargeVal = 0;
          provChargeType = 'flat';
        }

        return {
          ...r,
          id: r.id.replace('_c', '_r'),
          providerCharge: provChargeVal,
          providerChargeType: provChargeType,
          vat: (t === 'Airtime' || t === 'Data' || t === 'Cash Out (Transfer)') ? 0 : 7.5
        };
      });
    });
    
    return {
      id: p.id,
      name: p.name,
      ranges
    };
  });
}

export function getCalculatedFinancials(
  amount: number,
  type: TransactionType,
  provider: ProviderType,
  settings: AppSettings | undefined
): {
  customerCharge: number;
  providerCharge: number;
  vatAmount: number;
  cbnCharge: number;
  cashback: number;
  commissionAmount: number;
  agentProfit: number;
  netProfit: number;
  settlementCharge: number;
  merchantProfit: number;
} {
  const amt = Number(amount || 0);
  const profiles = settings?.pricingProfiles || getDefaultPricingProfiles();
  const selectedProfileId = settings?.selectedProfileId || provider || 'Moniepoint';
  
  let profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) {
    profile = profiles.find(p => p.id === 'Moniepoint') || profiles[0];
  }
  
  const ranges = profile?.ranges?.[type] || [];
  const matchedRange = ranges.find(r => amt >= r.minAmount && amt <= r.maxAmount);
  
  if (matchedRange) {
    const custCharge = matchedRange.customerChargeType === 'percent'
      ? Math.round(amt * (matchedRange.customerCharge / 100))
      : matchedRange.customerCharge;
      
    const provCharge = matchedRange.providerChargeType === 'percent'
      ? Math.round(amt * (matchedRange.providerCharge / 100))
      : matchedRange.providerCharge;
      
    const settlement = matchedRange.settlementCharge || 0;
    const vatRate = matchedRange.vat || 0;
    const vatAmount = (provCharge * vatRate) / 100;
    const commRate = matchedRange.commission || 0;
    const commissionAmount = (amt * commRate) / 100;
    const cashback = matchedRange.cashback || 0;
    
    // Formula: Agent Profit = (Customer Charge - Provider Charge - VAT) + Cashback + Commission - EMTL
    const cbnCharge = calculateCBNCharge(amt, type);
    
    // THE CORE BUSINESS RULE: Profit is what remains AFTER deducting all 3rd party costs
    const agentProfit = (custCharge - provCharge - vatAmount) + cashback + commissionAmount - cbnCharge;
    const netProfit = agentProfit - settlement;
    const merchantProfit = netProfit;
    
    return {
      customerCharge: custCharge,
      providerCharge: provCharge,
      vatAmount: vatAmount,
      cbnCharge: cbnCharge,
      cashback: cashback,
      commissionAmount: commissionAmount,
      agentProfit: agentProfit,
      netProfit: netProfit,
      settlementCharge: settlement,
      merchantProfit: merchantProfit
    };
  }
  
  // Legacy fallback calculation
  const custCharge = getRecommendedAgentFee(amt, type);
  const baselineRate = 0.5;
  const provCharge = calculateTerminalFee(amt, type, provider, baselineRate);
  const cbnCharge = calculateCBNCharge(amt, type);
    
  // Ensure profit automatically minus terminal charges and CBN levy
  const agentProfit = custCharge - provCharge - cbnCharge;
  
  return {
    customerCharge: custCharge,
    providerCharge: provCharge,
    vatAmount: 0,
    cbnCharge: cbnCharge,
    cashback: 0,
    commissionAmount: 0,
    agentProfit: agentProfit,
    netProfit: agentProfit,
    settlementCharge: 0,
    merchantProfit: agentProfit
  };
}
