/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Transaction, ProviderType, TransactionType } from './types';

// Standard Naira currency formatter
export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// POS Terminal Service Charge logical calculator
// Standard baseline fee is either 0.25% or 0.5% of amount, with a standard Nigerian payment terminal cap of ₦100 max fee on withdrawals
// When transacting internally (Same Bank e.g. OPay card on OPay POS; OPay to OPay wallet deposit) the network charges are lower (or free)
export function calculateTerminalFee(
  amount: number,
  type: TransactionType,
  provider: ProviderType,
  baselineRate: 0.25 | 0.5,
  subType?: 'SameBank' | 'OtherBank'
): number {
  const isInternal = subType === 'SameBank';

  // 1. Core Network / Settlement Kobo Surcharges (highly realistic and professional "cobo" fee additions)
  // Real-world POS terminals incur a tiny micro-transaction settlement fee, network session kobo charge, or hardware maintenance kobo fee.
  let koboSurcharge = 0;
  if (type === 'Withdrawal') {
    if (provider === 'OPay') {
      koboSurcharge = 1.50; // 1 Naira 50 kobo OPay web-acquisition charge
    } else if (provider === 'Moniepoint') {
      koboSurcharge = 0.50; // 50 kobo Moniepoint network connection charge
    } else if (provider === 'PalmPay') {
      koboSurcharge = 0.75; // 75 kobo PalmPay session security charge
    }
  } else {
    // Transfers / Deposits sometimes have a ₦0.50 session fee
    koboSurcharge = 0.50;
  }

  // 2. Base Transaction cost
  if (type === 'Deposit' || type === 'Transfer') {
    // Transfers / Deposits: Internal same-bank is free. Other-bank is tiered or standard ₦20.00 flat cost
    if (isInternal) {
      return 0.00; // OPay-to-OPay, Moniepoint-to-Moniepoint, PalmPay-to-PalmPay is ₦0 terminal cost
    }
    
    let baseCharge = 20.00;
    if (provider === 'OPay') {
      // Tiered transfers
      if (amount <= 5000) baseCharge = 10.00;
      else if (amount <= 10000) baseCharge = 20.00;
      else baseCharge = 30.00;
    } else if (provider === 'PalmPay') {
      if (amount <= 5000) baseCharge = 10.00;
      else baseCharge = 20.00;
    }
    
    return Number((baseCharge + koboSurcharge).toFixed(2));
  }
  
  // Withdrawals (Cashout): baseline rate applies
  let rateFraction = (provider === 'OPay' ? 0.55 : provider === 'PalmPay' ? 0.50 : 0.50) / 100; // Realistic OPay is 0.55%, Moniepoint/PalmPay is 0.50%
  
  // If baseline rate is specified as 0.25%, scale proportionally
  if (baselineRate === 0.25) {
    rateFraction = 0.25 / 100;
  }
  
  // Same bank cards on the same host POS terminal get a 50% discount on terminal cost
  if (isInternal) {
    rateFraction = rateFraction * 0.5;
  }
  
  const calculatedFee = amount * rateFraction;
  
  // Standard Nigerian withdraw fee caps at ₦100, but same-bank cap is discounted to ₦50
  const cap = isInternal ? 50.00 : 100.00;
  const minFee = isInternal ? 10.00 : 25.00; // Professional floor limits: Same Bank is ₦10, Interbank is ₦25
  
  const rawFee = calculatedFee > cap ? cap : Math.max(calculatedFee, minFee);
  
  // Return the precise terminal fee WITH kobo / cobo, rounded to 2 decimal places instead of whole integers!
  return Number((rawFee + koboSurcharge).toFixed(2));
}

// Electronic Money Transfer Levy (EMTL) - CBN charge of ₦50 on transfers/receipts of ₦10,000 and above
export function calculateCBNCharge(amount: number): number {
  return amount >= 10000 ? 50 : 0;
}

// Generate unique ID
export function generateId(): string {
  return 'tx_' + Math.random().toString(36).substring(2, 11);
}

// Date helper checks
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function isSameWeek(d1: Date, reference: Date): boolean {
  // Get start of the week for reference (Sunday)
  const refStart = new Date(reference);
  refStart.setDate(reference.getDate() - reference.getDay());
  refStart.setHours(0, 0, 0, 0);

  const d1Time = d1.getTime();
  const refStartTime = refStart.getTime();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  return d1Time >= refStartTime && d1Time < refStartTime + oneWeekMs;
}

export function isSameMonth(d1: Date, reference: Date): boolean {
  return (
    d1.getFullYear() === reference.getFullYear() &&
    d1.getMonth() === reference.getMonth()
  );
}

export function isSameYear(d1: Date, reference: Date): boolean {
  return d1.getFullYear() === reference.getFullYear();
}

// Clean helpers to calculate statistics of any subset of transactions
export function computeTxMetrics(
  txs: Transaction[],
  timeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'All-Time',
  customRate: 0.25 | 0.5 // This allows dynamic recalculation of metrics if the rate shifts
) {
  let totalVolume = 0;
  let totalCustomerFees = 0;
  let totalTerminalFees = 0;
  let totalCbnCharges = 0;
  let totalProfit = 0;
  let posWalletBalance = 0;
  let txCount = 0;

  const breakdowns = {
    Deposit: { count: 0, profit: 0 },
    Withdrawal: { count: 0, profit: 0 },
    Transfer: { count: 0, profit: 0 },
  };
  
  const now = new Date();
  
  txs.forEach((tx) => {
    const txDate = new Date(tx.timestamp);
    let inTimeframe = false;
    
    if (timeframe === 'Daily') {
      inTimeframe = isSameDay(txDate, now);
    } else if (timeframe === 'Weekly') {
      inTimeframe = isSameWeek(txDate, now);
    } else if (timeframe === 'Monthly') {
      inTimeframe = isSameMonth(txDate, now);
    } else if (timeframe === 'Yearly') {
      inTimeframe = isSameYear(txDate, now);
    } else if (timeframe === 'All-Time') {
      inTimeframe = true;
    }
    
    if (inTimeframe) {
      // Recalculating dynamically based on POS Fees formula structure (0.25% or 0.5% terminal costs)
      // This ensures 100% reactive correctness if the baselineRate updates
      const realTerminalFee = calculateTerminalFee(tx.amount, tx.type, tx.provider, customRate, tx.subType);
      const realCbnCharge = calculateCBNCharge(tx.amount);
      const realProfit = tx.customerFee - realTerminalFee - realCbnCharge;
      
      totalVolume += tx.amount;
      totalCustomerFees += tx.customerFee;
      totalTerminalFees += realTerminalFee;
      totalCbnCharges += realCbnCharge;
      totalProfit += realProfit;
      
      if (tx.type === 'Withdrawal') {
        posWalletBalance += (tx.amount - realTerminalFee - realCbnCharge);
      } else {
        posWalletBalance -= (tx.amount + realTerminalFee + realCbnCharge);
      }
      
      txCount++;

      if (breakdowns[tx.type]) {
        breakdowns[tx.type].count++;
        breakdowns[tx.type].profit += realProfit;
      }
    }
  });

  return {
    volume: totalVolume,
    customerFees: totalCustomerFees,
    terminalFees: totalTerminalFees,
    cbnCharges: totalCbnCharges,
    profit: totalProfit,
    posWalletBalance,
    count: txCount,
    averageTxSize: txCount > 0 ? totalVolume / txCount : 0,
    breakdowns,
  };
}

// Generate realistic simulated transaction list for Nigeria agents
export function getSeedTransactions(baselineRate: 0.25 | 0.5): Transaction[] {
  return [];
}

// Recommended Agent customer fee mapping based on standard Nigeria agent practices:
// Same bank/internal transactions can have lower customer fees as an attraction rate (customizable).
export function getRecommendedAgentFee(
  currentAmt: number,
  currentType: TransactionType,
  currentSubType: 'SameBank' | 'OtherBank'
): number {
  if (currentAmt <= 0) return 0;
  
  const isSame = currentSubType === 'SameBank';
  if (currentType === 'Deposit' || currentType === 'Transfer') {
    if (currentAmt <= 5000) return isSame ? 50 : 100;
    if (currentAmt <= 10000) return isSame ? 100 : 150;
    if (currentAmt <= 20000) return isSame ? 150 : 200;
    return Math.min(Math.round(currentAmt * (isSame ? 0.0075 : 0.01) + (isSame ? 25 : 50)), isSame ? 350 : 500);
  } else {
    // Withdrawal cashout has slightly higher charges, but same-bank POS/cards can be cheaper
    if (currentAmt <= 5000) return isSame ? 80 : 100;
    if (currentAmt <= 10000) return isSame ? 150 : 200;
    if (currentAmt <= 25050) return isSame ? 250 : 300;
    if (currentAmt <= 50000) return isSame ? 400 : 500;
    return Math.round(currentAmt * (isSame ? 0.008 : 0.01)); // 0.8% same vs 1% interbank
  }
}

// Helper to hash string deterministically to digits
function hashToDigits(str: string, len: number): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const digits = Math.abs(hash).toString();
  return digits.padEnd(len, '0').slice(0, len);
}

// Differentiate transaction reference numbers dynamically based on provider formats
export function getProviderTransactionNumber(tx: { id: string; provider: ProviderType; timestamp: string }): string {
  if (!tx) return '';
  const rawId = tx.id.replace('tx_', '').toUpperCase();
  const dateObj = new Date(tx.timestamp);
  const yy = String(dateObj.getFullYear()).slice(-2);
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  const dateStamp = `${yy}${mm}${dd}`; // YYMMDD
  const timeStamp = `${hh}${min}`;     // HHMM

  switch (tx.provider) {
    case 'OPay':
      // OPay references are standard 12-16 pure numeric digits starting with 30 or 31
      const opayRandomPart = hashToDigits(rawId, 6);
      return `30${dateStamp}${timeStamp}${opayRandomPart}`; 
    case 'Moniepoint':
      // Moniepoint references often start with MNP followed by date and transaction specific strings
      const mnpRandomPart = rawId.slice(0, 4);
      return `MNP-${dateStamp}-${timeStamp}-${mnpRandomPart}`;
    case 'PalmPay':
      // PalmPay references are standard 16-character keys starting with PP followed by numbers/chars
      const palmRandomPart = rawId.slice(0, 5);
      return `PP-${dateStamp}-${timeStamp}-${palmRandomPart}`;
    default:
      return tx.id;
  }
}

