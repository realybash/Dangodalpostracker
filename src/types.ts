/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Manager' | 'Employee';

export interface User {
  id: string;
  uid?: string; // Firebase Auth UID alias
  name: string;
  fullName?: string; // Firestore field alias
  role: UserRole;
  pin?: string;
  phone?: string;
  phoneNumber?: string; // Firestore field alias
  ownerId?: string;
  activated?: boolean;
  email?: string;
  password?: string;
  avatar?: string; // base64 image or avatar url
  referralCode?: string; // Code for Managers
  referredBy?: string; // Referral code used by Employees
  areaOfWorking?: string; // Work area/location for employee
}

export interface SubTransfer {
  recipientName: string;
  accountNumber: string;
  amount: number;
}

export interface Expense {
  id: string;
  amount: number;
  description: string;
  timestamp: string; // ISO String
  ownerId?: string;
  employeeId?: string;
  employeeName?: string;
  notes?: string;
  audioNote?: string;
}

export interface BorrowKeepTransaction {
  id: string;
  name: string;
  amount: number;
  type: 'loan_given' | 'loan_repaid' | 'money_kept' | 'money_returned';
  timestamp: string; // ISO String
  ownerId?: string;
  employeeId?: string;
  employeeName?: string;
  linkedTransactionId?: string;
  repaidAmount?: number;
  status?: 'pending' | 'partial' | 'settled';
  notes?: string;
  audioNote?: string;
  photo?: string; // base64-encoded camera snapshot proof
  photoFront?: string; // base64-encoded front view snapshot proof (customer face)
  photoBack?: string; // base64-encoded back view snapshot proof (cash/receipt)
}

export type TransactionType = 'Deposit' | 'Withdrawal' | 'Transfer';
export type ProviderType = 'OPay' | 'Moniepoint' | 'PalmPay';

export interface Transaction {
  id: string;
  employeeId: string;
  employeeName: string;
  type: TransactionType;
  provider: ProviderType;
  subType?: 'SameBank' | 'OtherBank'; // Differentiates e.g., OPay-to-OPay vs OPay-to-OtherBank
  amount: number;
  customerFee: number;
  terminalFee: number; // Computed cost (amount * rate, subject to max caps if any)
  cbnCharge?: number; // ₦50 EMTL on transactions 10,000+
  profit: number; // customerFee - terminalFee - cbnCharge
  timestamp: string; // ISO String
  notes?: string;
  customerPhone?: string;
  status?: 'Success' | 'Pending' | 'Failed';
  ownerId?: string;
  feeMethod?: 'CardDebit' | 'Cash'; // Dedicated dynamic POS automatic fee deduction flow
  totalCustomerCharged?: number; // Real physical cost debited or collected
  // New fields for split withdrawals
  mode?: 'Standard' | 'SplitWithdrawal';
  subTransfers?: SubTransfer[];
  remainingBalance?: number;
  chargesStatus?: 'Paid' | 'Unpaid' | 'PartiallyPaid';
  customerName?: string;
  unpaidFeeAmount?: number;
  originalFeeAmount?: number;
  chargesPaidAmount?: number;
  chargePayments?: Array<{
    id: string;
    date: string;
    amount: number;
    collectorName: string;
    note?: string;
  }>;
  terminalId?: string; // ID of custom linked POS terminal
  terminalName?: string; // Name of custom linked POS terminal
  cashierId?: string; // ID of cashier who performed transaction
  audioNote?: string; // base64-encoded audio
}

export interface PosTerminal {
  id: string;
  name: string;
  provider: ProviderType | 'Others' | string;
  serialNumber?: string;
  terminalFeeRate?: number; // custom terminal fee rate if any
  ownerId: string;
  employeeId?: string; // cashier account linked to this POS terminal (optional)
  employeeName?: string; // cashier name linked
  posAccountNo: string; // Account number linked to POS
  cashierName: string; // Name of operating cashier
  areaOfWorking: string; // Area/location of work with POS
  addedBy: string; // cashier or manager who linked it
  status: 'Active' | 'Inactive' | 'Live';
  timestamp: string; // ISO String
  simCardNumber?: string;
  networkProvider?: 'MTN' | 'Airtel' | 'Glo' | '9mobile';
  batteryLevel?: number; // 0-100
  signalStrength?: number; // 1-5
  networkStatus?: 'Active' | 'Inactive';
  browsingStatus?: 'Enabled' | 'Disabled';
  internetAccess?: 'Granted' | 'Denied';
}

export interface AppSettings {
  soundEnabled: boolean;
  voiceEnabled: boolean;
  businessName: string;
  receiptAddress: string;
  receiptPhone: string;
  receiptFooter: string;
  listDensity: 'compact' | 'comfortable';
  pageSize: number;
  defaultProvider: 'OPay' | 'Moniepoint' | 'PalmPay';
  defaultType: 'Deposit' | 'Withdrawal' | 'Transfer';
  chartStyle: 'line' | 'bar' | 'area';
  darkMode: boolean;
  language: 'en' | 'ha';
}

export interface AppState {
  currentUser: User;
  availableEmployees: User[];
  transactions: Transaction[];
  expenses: Expense[];
  posTerminals: PosTerminal[]; // Array of custom linked POS terminals
  selectedEmployeeFilter: string; // 'ALL' or employeeId
  impersonatedUserId?: string; // ID of employee being viewed by manager
  activeTimeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  terminalFeeRate: number; // Baseline terminal operating fee package
  dailyTarget: number; // User-defined target
  settings?: AppSettings;
}

export type AppAction =
  | { type: 'SWITCH_USER'; payload: User }
  | { type: 'SET_EMPLOYEE_FILTER'; payload: string }
  | { type: 'SET_TIMEFRAME'; payload: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' }
  | { type: 'SET_TERMINAL_RATE'; payload: number }
  | { type: 'SET_DAILY_TARGET'; payload: number }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'RESET_DATA' }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'SET_EXPENSES'; payload: Expense[] }
  | { type: 'SET_REGISTERED_USERS'; payload: User[] }
  | { type: 'SET_POS_TERMINALS'; payload: PosTerminal[] }
  | { type: 'ADD_POS_TERMINAL'; payload: PosTerminal }
  | { type: 'UPDATE_POS_TERMINAL'; payload: PosTerminal }
  | { type: 'DELETE_POS_TERMINAL'; payload: string }
  | { type: 'SET_IMPERSONATED_USER'; payload: string | undefined }
  | { type: 'BULK_DELETE_TRANSACTIONS'; payload: string[] }
  | { type: 'BULK_UPDATE_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings> };
