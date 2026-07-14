import { Transaction, User, TransactionType, ProviderType, AppSettings, UserRole, ProviderChargeConfig, RegulatoryConfig, ChargeRule, PricingProfile, ChargeRange, PricingRule } from './types';

// REMOVED HARDCODED DEFAULTS (Strictly enforced Firestore-only rules)

// REALISTIC NIGERIAN POS TERMINAL DEFAULTS (2024/2025)
export const REALISTIC_PROVIDER_CONFIGS: ProviderChargeConfig[] = [
  {
    id: 'Moniepoint',
    name: 'Moniepoint',
    withdrawal: { type: 'percent', value: 0.5, threshold: 20000, aboveThresholdValue: 100, aboveThresholdType: 'flat' },
    transfer: { type: 'flat', value: 20 },
    deposit: { type: 'flat', value: 20 },
    airtime: { type: 'percent', value: 2 },
    bills: { type: 'flat', value: 0 }
  },
  {
    id: 'OPay',
    name: 'OPay',
    withdrawal: { type: 'percent', value: 0.5, threshold: 20000, aboveThresholdValue: 100, aboveThresholdType: 'flat' },
    transfer: { type: 'flat', value: 20 }, // Avg between 10-30
    deposit: { type: 'flat', value: 10 },
    airtime: { type: 'percent', value: 3.2 }, // Average 3.2-5.5
    bills: { type: 'percent', value: 2.2 }
  },
  {
    id: 'PalmPay',
    name: 'PalmPay',
    withdrawal: { type: 'percent', value: 0.5, threshold: 20000, aboveThresholdValue: 100, aboveThresholdType: 'flat' },
    transfer: { type: 'flat', value: 10 },
    deposit: { type: 'flat', value: 10 },
    airtime: { type: 'percent', value: 2 },
    bills: { type: 'percent', value: 2 }
  }
];

export const REALISTIC_REGULATORY_CONFIG: RegulatoryConfig = {
  emtlThreshold: 10000,
  emtlCharge: 50,
  vatRate: 7.5
};

export const REALISTIC_PRICING_PROFILE: PricingProfile = {
  id: 'standard_retail',
  name: 'Standard Retail (Nigeria)',
  isDefault: true,
  ranges: {
    Withdrawal: [
      { id: 'w1', minAmount: 1, maxAmount: 5000, customerCharge: 100, customerChargeType: 'flat', providerCharge: 0.5, providerChargeType: 'percent', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 'w2', minAmount: 5001, maxAmount: 10000, customerCharge: 200, customerChargeType: 'flat', providerCharge: 0.5, providerChargeType: 'percent', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 'w3', minAmount: 10001, maxAmount: 15000, customerCharge: 300, customerChargeType: 'flat', providerCharge: 0.5, providerChargeType: 'percent', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 'w4', minAmount: 15001, maxAmount: 20000, customerCharge: 400, customerChargeType: 'flat', providerCharge: 0.5, providerChargeType: 'percent', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 'w5', minAmount: 20001, maxAmount: 10000000, customerCharge: 2, customerChargeType: 'percent', providerCharge: 100, providerChargeType: 'flat', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 }
    ],
    Transfer: [
      { id: 't1', minAmount: 1, maxAmount: 5000, customerCharge: 100, customerChargeType: 'flat', providerCharge: 20, providerChargeType: 'flat', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 't2', minAmount: 5001, maxAmount: 10000, customerCharge: 200, customerChargeType: 'flat', providerCharge: 20, providerChargeType: 'flat', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 't3', minAmount: 10001, maxAmount: 10000000, customerCharge: 300, customerChargeType: 'flat', providerCharge: 20, providerChargeType: 'flat', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 }
    ],
    Deposit: [
      { id: 'd1', minAmount: 1, maxAmount: 5000, customerCharge: 100, customerChargeType: 'flat', providerCharge: 20, providerChargeType: 'flat', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 'd2', minAmount: 5001, maxAmount: 10000, customerCharge: 200, customerChargeType: 'flat', providerCharge: 20, providerChargeType: 'flat', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 },
      { id: 'd3', minAmount: 10001, maxAmount: 10000000, customerCharge: 300, customerChargeType: 'flat', providerCharge: 20, providerChargeType: 'flat', settlementCharge: 0, vat: 0, commission: 0, cashback: 0 }
    ]
  }
};

export function applyChargeRule(amount: number, rule: ChargeRule): number {
  if (!rule) return 0;
  let charge = 0;

  // HOTFIX for old configs: if it's a 0.5% rule with no threshold (or just standard POS withdrawal)
  // Enforce the 20000 threshold -> 100 flat rule
  if (rule.type === 'percent' && rule.value === 0.5 && !rule.threshold) {
    if (amount >= 20000) {
      return 100;
    }
  }

  if (rule.threshold && amount >= rule.threshold && rule.aboveThresholdValue !== undefined) {
    if (rule.aboveThresholdType === 'percent') {
      charge = amount * (rule.aboveThresholdValue / 100);
    } else {
      charge = rule.aboveThresholdValue;
    }
  } else {
    if (rule.type === 'percent') {
      charge = amount * (rule.value / 100);
    } else {
      charge = rule.value;
    }
  }

  if (rule.cap !== undefined) charge = Math.min(charge, rule.cap);
  if (rule.min !== undefined) charge = Math.max(charge, rule.min);

  return charge;
}

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
export function calculateCBNCharge(amount: number, type: string, config?: RegulatoryConfig): number {
  const amt = Number(amount || 0);
  if (!config) return 0; // Return 0 but should be checked for presence elsewhere
  
  // OFFICIAL REGULATION: Electronic Money Transfer Levy (EMTL)
  // Usually applies to transfers/deposits
  if (type === 'Transfer' || type === 'Deposit') {
    return amt >= config.emtlThreshold ? config.emtlCharge : 0;
  }
  return 0;
}

// Terminal fee calculation helper (with withdrawal percentage and transfer flat rates)
export function calculateTerminalFee(
  amount: number,
  type: string,
  providerName: string,
  providerConfigs?: ProviderChargeConfig[],
  _terminalFeeRate?: number,
  _subType?: string
): number | null {
  const amt = Number(amount || 0);
  if (amt <= 0) return 0;

  if (!Array.isArray(providerConfigs)) return null;
  const config = providerConfigs.find(c => c.id === providerName || c.name === providerName);

  if (!config) return null;

  switch (type) {
    case 'Withdrawal':
    case 'Cash Out':
      return applyChargeRule(amt, config.withdrawal);
    case 'Transfer':
      return applyChargeRule(amt, config.transfer);
    case 'Deposit':
    case 'Cash In':
    case 'Cash Out (Transfer)':
      return applyChargeRule(amt, config.deposit);
    case 'Airtime':
    case 'Data':
      return applyChargeRule(amt, config.airtime);
    case 'Bills':
      return applyChargeRule(amt, config.bills);
    default:
      return 0;
  }
}

// Recommended Agent fee suggestion helper based on standard Nigerian agency tier practices
export function getRecommendedAgentFee(amount: number, type: string, subType?: string): number {
  const amt = Number(amount || 0);
  if (amt <= 0) return 0;

  if (type === 'Withdrawal' || type === 'Cash Out (Transfer)' || type === 'Cash Out') {
    if (amt <= 5000) return 100;
    if (amt <= 10000) return 200;
    if (amt <= 15000) return 300;
    if (amt <= 20000) return 400;
    if (amt <= 25000) return 500;
    if (amt <= 30000) return 600;
    if (amt <= 35000) return 700;
    if (amt <= 40000) return 800;
    if (amt <= 45000) return 900;
    if (amt <= 50000) return 1000;
    return Math.ceil(amt * 0.02); // 2% for high amounts is standard in some areas
  } else {
    // Transfer/Deposit tiers
    if (amt <= 5000) return 100;
    if (amt <= 10000) return 200;
    return 300; // Flat 300 for 10k+ is common for small agents, or tiered
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
  return `opay_${pin}_secure`;
}

// Safely prepares data for Firestore by removing undefined values, removing passwords/PINs, and logging the clean data
export const prepareFirestoreData = (data: any, collectionName?: string) => {
  const copy = { ...data };
  
  // Explicitly delete sensitive authentication fields so they are never stored in Firestore
  delete (copy as any).password;
  delete (copy as any).pin;
  
  // Remove every undefined property before calling setDoc()
  const cleanData = Object.fromEntries(
    Object.entries(copy).filter(([_, value]) => value !== undefined)
  );
  
  console.log(`[Firestore Write] Cleaned object for "${collectionName || 'unknown'}":`, cleanData);
  return cleanData;
};

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
 * Super robust comparison for phone numbers
 */
export function isPhoneMatch(p1: string, p2: string): boolean {
  if (!p1 || !p2) return false;
  const digits1 = p1.replace(/\D/g, '');
  const digits2 = p2.replace(/\D/g, '');
  if (!digits1 || !digits2) return false;
  
  // If both have at least 10 digits, compare their last 10 digits
  const clean1 = digits1.length >= 10 ? digits1.slice(-10) : digits1;
  const clean2 = digits2.length >= 10 ? digits2.slice(-10) : digits2;
  
  if (clean1 === clean2) return true;
  
  // Suffix fallback (minimum 7 digits)
  const minLen = Math.min(digits1.length, digits2.length);
  if (minLen >= 7) {
    return digits1.endsWith(digits2) || digits2.endsWith(digits1);
  }
  
  return false;
}

/**
 * Returns a friendly label for transaction types to differentiate them in UI
 */
export function getFriendlyTypeLabel(type: string): string {
  if (type === 'Cash Out (Transfer)') return 'Money Receive';
  if (type === 'Withdrawal') return 'Withdraw';
  if (type === 'Deposit') return 'Money Receive';
  if (type === 'Transfer') return 'Bank Transfer';
  return type;
}

// Aggregated metrics calculator for transactions across different timeframes
export function computeTxMetrics(
  transactions: Transaction[],
  timeframe: string,
  _terminalFeeRate: number = 0.5
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
    if (tx.status === 'Success') {
      profit += tx.profit || 0;
    }
    
    totalCustomerCharges += tx.customerCharge || tx.customerFee || 0;
    totalProviderCharges += tx.providerCharge || tx.terminalFee || 0;
    totalVat += tx.vatAmount || 0;
    totalCashback += tx.cashback || 0;
    totalCommission += tx.commissionAmount || 0;

    const tType = tx.type;
    if (breakdowns[tType as keyof typeof breakdowns]) {
      const b = breakdowns[tType as keyof typeof breakdowns];
      b.count += 1;
      if (tx.status === 'Success') {
        b.profit += tx.profit || 0;
      }
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

// Seed transactions generator (Strictly for development)
export function getSeedTransactions(_terminalFeeRate: number = 0.5): Transaction[] {
  const now = new Date();
  
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  
  const createTx = (
    id: string,
    type: 'Deposit' | 'Withdrawal' | 'Transfer',
    provider: 'OPay' | 'Moniepoint' | 'PalmPay',
    amount: number,
    customerFee: number,
    date: Date,
    subType: 'SameBank' | 'OtherBank' = 'OtherBank'
  ): Transaction => {
    // Note: Seed transactions might have 0 charges if settings aren't loaded yet
    return {
      id,
      employeeId: 'EMP-001',
      employeeName: 'Babatunde',
      type,
      provider,
      subType,
      amount,
      customerFee,
      terminalFee: 0,
      cbnCharge: 0,
      profit: customerFee,
      timestamp: date.toISOString(),
      status: 'Success',
      feeMethod: 'Cash',
      chargesStatus: 'Paid'
    };
  };

  return [
    createTx('TX-1001', 'Withdrawal', 'OPay', 15000, 150, now),
    createTx('TX-1002', 'Deposit', 'Moniepoint', 5000, 100, now),
    createTx('TX-1003', 'Transfer', 'PalmPay', 25000, 250, yesterday)
  ];
}

export function getDefaultPricingProfiles(): PricingProfile[] {
  // We no longer provide hardcoded defaults for calculations, but we keep the structure for initialization UI if needed.
  return [];
}

export interface FinancialResults {
  isConfigured: boolean;
  error?: string;
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
}

export function checkRuleOverlap(newRule: Partial<PricingRule>, existingRules: PricingRule[]): PricingRule | null {
  const overlapping = existingRules.find(r => {
    // Only check rules for the same provider and type that are not the same rule
    if (r.id === newRule.id) return false;
    if (r.provider !== newRule.provider || r.type !== newRule.type) return false;
    if (r.status === 'archived') return false;

    const newMin = newRule.minAmount ?? 0;
    const newMax = newRule.maxAmount ?? Infinity;
    
    // Check if ranges overlap
    // (StartA <= EndB) and (EndA >= StartB)
    return (newMin <= r.maxAmount) && (newMax >= r.minAmount);
  });
  
  return overlapping || null;
}

export function getCalculatedFinancials(
  amount: number,
  type: TransactionType,
  provider: ProviderType,
  settings: AppSettings | undefined,
  destinationBank?: string
): FinancialResults {
  const amt = Number(amount || 0);
  
  const results: FinancialResults = {
    isConfigured: false,
    customerCharge: 0,
    providerCharge: 0,
    vatAmount: 0,
    cbnCharge: 0,
    cashback: 0,
    commissionAmount: 0,
    agentProfit: 0,
    netProfit: 0,
    settlementCharge: 0,
    merchantProfit: 0
  };

  if (!settings) {
    results.error = "Settings not loaded";
    return results;
  }

  // 1. DYNAMIC REGULATORY CHARGE
  if (!settings.regulatoryConfig) {
    results.error = "Regulatory configuration (CBN EMTL/VAT) missing";
    return results;
  }
  let cbnCharge = calculateCBNCharge(amt, type, settings.regulatoryConfig);
  
  // 2. DYNAMIC PROVIDER CHARGE
  let providerCharge: number | null = null;
  if (settings.providerConfigs && Array.isArray(settings.providerConfigs) && settings.providerConfigs.length > 0) {
    providerCharge = calculateTerminalFee(amt, type, provider, settings.providerConfigs);
  } else {
    // FALLBACK TO REALISTIC DEFAULTS
    providerCharge = calculateTerminalFee(amt, type, provider, REALISTIC_PROVIDER_CONFIGS);
  }
  
  if (providerCharge === null) {
    results.error = `Pricing rule for ${provider} (${type}) not configured`;
    return results;
  }

  // Handle Airtime and Data commission-based transactions directly
  if (type === 'Airtime' || type === 'Data') {
    results.isConfigured = true;
    results.customerCharge = 0; // Usually no surcharge
    results.providerCharge = -providerCharge; // Cost is less than amount (represented as negative charge in agent systems)
    results.vatAmount = 0;
    results.cbnCharge = 0;
    results.commissionAmount = providerCharge;
    results.agentProfit = providerCharge; // Surcharge (0) + commission (providerCharge)
    results.netProfit = providerCharge;
    results.merchantProfit = providerCharge;
    return results;
  }

  // 3. PRICING PROFILE (Customer Facing)
  let profile: PricingProfile | undefined;
  if (settings.pricingProfiles && Array.isArray(settings.pricingProfiles) && settings.pricingProfiles.length > 0) {
    const selectedProfileId = settings.selectedProfileId || provider;
    profile = settings.pricingProfiles.find(p => p.id === selectedProfileId);
    if (!profile) profile = settings.pricingProfiles[0];
  } else {
    // FALLBACK TO REALISTIC DEFAULTS
    profile = REALISTIC_PRICING_PROFILE;
  }
  
  if (!profile) {
    results.error = "No active pricing profile found";
    return results;
  }
  
  let effectiveRangeType = type as string;
  if (type === 'Cash Out (Transfer)' || type === 'Cash Out') effectiveRangeType = 'Withdrawal';
  if (type === 'Cash In') effectiveRangeType = 'Deposit';

  // @ts-ignore
  let ranges = profile.ranges?.[effectiveRangeType] || [];
  let matchedRange = ranges.find(r => amt >= r.minAmount && amt <= r.maxAmount);
  
  if (!matchedRange) {
    // FALLBACK to Realistic Profile if custom profile is missing this range
    // @ts-ignore
    ranges = REALISTIC_PRICING_PROFILE.ranges[effectiveRangeType] || [];
    matchedRange = ranges.find(r => amt >= r.minAmount && amt <= r.maxAmount);
  }

  if (!matchedRange) {
    results.error = `No pricing rule found for ${type} in amount range ${amt} in profile: ${profile.name}`;
    return results;
  }

  // Calculate results based on matched range
  let customerCharge = matchedRange.customerChargeType === 'percent'
    ? Math.round(amt * (matchedRange.customerCharge / 100))
    : matchedRange.customerCharge;
    
  let settlementCharge = matchedRange.settlementCharge || 0;
  let vatRate = matchedRange.vat !== undefined && matchedRange.vat !== 0 ? matchedRange.vat : settings.regulatoryConfig.vatRate;
  let vatAmount = Math.round((providerCharge * vatRate) / 100);
  let commRate = matchedRange.commission || 0;
  let commissionAmount = Math.round(amt * (commRate / 100));
  let cashback = matchedRange.cashback || 0;

  // 4. NET PROFIT CALCULATION
  // Net Profit is simply Customer Charge - Provider Cost + Cashback, ignoring VAT and other deductions
  let netProfit = customerCharge - providerCharge + cashback;

  
  if (provider === 'OPay' && type === 'Transfer' && destinationBank === 'OPay') {
    customerCharge = amt >= 10000 ? 50 : 0;
    providerCharge = 0;
    vatAmount = 0;
    cbnCharge = amt >= 10000 ? 50 : 0;
    netProfit = customerCharge - providerCharge + cashback;
  }

  if (provider === 'OPay' && type === 'Transfer' && destinationBank !== 'OPay') {
    providerCharge = 18.60;
    vatAmount = Math.round((providerCharge * vatRate) / 100);
    netProfit = customerCharge - providerCharge + cashback;
  }

  if (provider === 'OPay' && type === 'Deposit' && destinationBank === 'OPay') {
    providerCharge = amt >= 30000 ? 100 : Math.floor(amt * 0.0035);
    vatAmount = Math.round((providerCharge * vatRate) / 100);
    cbnCharge = 0;
    netProfit = customerCharge - providerCharge + cashback;
  }

  if (provider === 'OPay' && type === 'Deposit' && destinationBank !== 'OPay') {
    providerCharge = 0;
    vatAmount = 0;
    cbnCharge = 0;
    netProfit = customerCharge - providerCharge + cashback;
  }

  if (provider === 'Moniepoint' && type === 'Deposit') {
    providerCharge = 0;
    vatAmount = 0;
    cbnCharge = 0;
    netProfit = customerCharge - providerCharge + cashback;
  }

  if (provider === 'Moniepoint' && type === 'Transfer' && destinationBank === 'Moniepoint') {
    providerCharge = cbnCharge;
    vatAmount = 0;
    cbnCharge = 0; // Avoid double deduction since provider charge is set to the CBN levy
    netProfit = customerCharge - providerCharge + cashback;
  }

  if (provider === 'OPay' && type === 'Cash Out (Transfer)') {
    providerCharge = 0;
    cbnCharge = 0;
    vatAmount = 0;
    netProfit = customerCharge + cashback;
  }

  return {
    isConfigured: true,
    customerCharge,
    providerCharge,
    vatAmount,
    cbnCharge,
    cashback,
    commissionAmount,
    agentProfit: netProfit,
    netProfit: netProfit,
    settlementCharge,
    merchantProfit: netProfit
  };
}

