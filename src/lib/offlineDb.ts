import { openDB } from 'idb';

const DB_NAME = 'POSTrackOfflineDB';
const DB_VERSION = 5; // Incremented for new stores (expenses, terminals)

export const hashPin = async (pin: string) => {
  const msgUint8 = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      console.log(`[DB] Upgrading from ${oldVersion} to ${DB_VERSION}`);
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('pendingTransactions')) {
          db.createObjectStore('pendingTransactions', { keyPath: 'id' });
        }
      }
      if (oldVersion < 4) {
        // Recreate users store with 'id' keyPath
        if (db.objectStoreNames.contains('users')) {
          db.deleteObjectStore('users');
        }
        db.createObjectStore('users', { keyPath: 'id' });
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
      }
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('expenses')) {
          db.createObjectStore('expenses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('pos_terminals')) {
          db.createObjectStore('pos_terminals', { keyPath: 'id' });
        }
      }
    },
  });
};

export const savePendingTransaction = async (tx: any) => {
  const db = await initDB();
  await db.put('pendingTransactions', tx);
};

export const getPendingTransactions = async () => {
  const db = await initDB();
  return await db.getAll('pendingTransactions');
};

export const deletePendingTransaction = async (id: string) => {
  const db = await initDB();
  await db.delete('pendingTransactions', id);
};

export const saveCachedUser = async (user: any) => {
  try {
    const db = await initDB();
    const hashedPin = user.pin ? await hashPin(user.pin) : '';
    await db.put('users', { ...user, pin: hashedPin });
    console.log('[DB] User cached successfully:', user.id || user.uid);
  } catch (err) {
    console.error('[DB] Failed to cache user:', err);
    throw err;
  }
};

export const saveCachedUsersBatch = async (users: any[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction('users', 'readwrite');
    for (const user of users) {
      if (!user.id && user.uid) user.id = user.uid; // Ensure id exists
      if (!user.id) continue;
      
      const hashedPin = user.pin ? await hashPin(user.pin) : '';
      await tx.store.put({ ...user, pin: hashedPin });
    }
    await tx.done;
    console.log(`[DB] Cached ${users.length} users successfully.`);
  } catch (err) {
    console.error('[DB] Failed to cache users batch:', err);
    throw err;
  }
};

export const getAllCachedUsers = async () => {
  try {
    const db = await initDB();
    return await db.getAll('users');
  } catch (err) {
    console.error('[DB] Failed to get all cached users:', err);
    return [];
  }
};

export const getCachedUser = async (id: string) => {
  const db = await initDB();
  return await db.get('users', id);
};

export const saveCachedSettings = async (settings: any) => {
  const db = await initDB();
  await db.put('settings', settings);
};

export const getCachedSettings = async (id: string) => {
  const db = await initDB();
  return await db.get('settings', id);
};

export const saveCachedTransactions = async (txs: any[]) => {
  const db = await initDB();
  const tx = db.transaction('transactions', 'readwrite');
  await Promise.all(txs.map(t => tx.store.put(t)));
  await tx.done;
};

export const getCachedTransactions = async () => {
  const db = await initDB();
  return await db.getAll('transactions');
};

export const saveCachedExpenses = async (expenses: any[]) => {
  const db = await initDB();
  const tx = db.transaction('expenses', 'readwrite');
  await Promise.all(expenses.map(e => tx.store.put(e)));
  await tx.done;
};

export const getCachedExpenses = async () => {
  const db = await initDB();
  return await db.getAll('expenses');
};

export const saveCachedPosTerminals = async (terminals: any[]) => {
  const db = await initDB();
  const tx = db.transaction('pos_terminals', 'readwrite');
  await Promise.all(terminals.map(t => tx.store.put(t)));
  await tx.done;
};

export const getCachedPosTerminals = async () => {
  const db = await initDB();
  return await db.getAll('pos_terminals');
};
