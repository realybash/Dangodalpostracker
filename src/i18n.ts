export const hausaTranslations: Record<string, string> = {
  'Dashboard': 'Dashboard',
  'Add Expense': 'Ƙara Kuɗin Kashewa',
  'Total Charges': 'Jimillar Kuɗin Sabis',
  'Exact Profit': 'Kuɗin Riba',
  'POS Wallet Balance': 'Ma\'aunin Wallet na POS',
  'Expenses': 'Kuɗin Kashewa',
  'Terminals': 'Na\'urorin POS',
  'Employees': 'Ma\'aikata',
  'Settings': 'Saituna',
  'Log Out': 'Fita',
  'Filter Selection': 'Zabin Tantancewa',
  'Daily': 'Kowace Rana',
  'Weekly': 'Kowane Mako',
  'Monthly': 'Kowane Wata',
  'Yearly': 'Kowace Shekara',
  'Search': 'Nema',
  'Add': 'Ƙara',
  'Cancel': 'Soke',
  'Save': 'Ajiye',
  'Transactions': 'Mu\'amala',
  'Amount': 'Adadin Kuɗi',
  'Date': 'Kwanan Wata',
  'Provider': 'Mai Samar da Sabis',
};

export const t = (key: string, lang: 'en' | 'ha') => {
  if (lang === 'en') return key;
  return hausaTranslations[key] || key;
};
