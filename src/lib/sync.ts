import { 
  getPendingTransactions, 
  deletePendingTransaction,
  getPendingExpenses,
  deletePendingExpense,
  getPendingPosTerminals,
  deletePendingPosTerminal,
  getPendingDeletions,
  deletePendingDeletion
} from './offlineDb';
import { collection, doc, writeBatch, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

let isSyncing = false;

export const syncOfflineTransactions = async (onSyncStateChange?: (syncing: boolean) => void) => {
  if (isSyncing || !navigator.onLine) {
    if (isSyncing) {
    }
    if (!navigator.onLine) {
    }
    return;
  }
  
  isSyncing = true;
  if (onSyncStateChange) {
    onSyncStateChange(true);
  }

  try {
    // 1. Synchronize Pending Deletions first to ensure proper database cascading state
    const pendingDeletes = await getPendingDeletions();
    if (pendingDeletes.length > 0) {
      for (const del of pendingDeletes) {
        try {
          const docRef = doc(db, del.collection, del.docId);
          await deleteDoc(docRef);
          await deletePendingDeletion(del.id);
        } catch (delErr) {
          console.error(`[Sync Engine] Failed to synchronize deletion of ${del.collection}/${del.docId}:`, delErr);
        }
      }
    }

    // 2. Synchronize Pending Expenses
    const pendingExpenses = await getPendingExpenses();
    if (pendingExpenses.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < pendingExpenses.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = pendingExpenses.slice(i, i + BATCH_SIZE);
        
        for (const exp of currentBatch) {
          const expRef = doc(db, 'expenses', exp.id);
          batch.set(expRef, exp, { merge: true });
        }
        
        await batch.commit();
        
        for (const exp of currentBatch) {
          await deletePendingExpense(exp.id);
        }
      }
    }

    // 3. Synchronize Pending POS Terminals
    const pendingTerminals = await getPendingPosTerminals();
    if (pendingTerminals.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < pendingTerminals.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = pendingTerminals.slice(i, i + BATCH_SIZE);
        
        for (const term of currentBatch) {
          const termRef = doc(db, 'pos_terminals', term.id);
          batch.set(termRef, term, { merge: true });
        }
        
        await batch.commit();
        
        for (const term of currentBatch) {
          await deletePendingPosTerminal(term.id);
        }
      }
    }

    // 4. Synchronize Pending Transactions (with defensive deduplication check)
    const pendingTxs = await getPendingTransactions();
    if (pendingTxs.length > 0) {
      const BATCH_SIZE = 500;
      for (let i = 0; i < pendingTxs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = pendingTxs.slice(i, i + BATCH_SIZE);
        
        for (const tx of currentBatch) {
          const txRef = doc(db, 'transactions', tx.id);
          batch.set(txRef, tx, { merge: true });
        }
        
        await batch.commit();
        
        // Clean up local store after successful batch commit
        for (const tx of currentBatch) {
          await deletePendingTransaction(tx.id);
        }
      }
    }
  } catch (err) {
    console.error(`[Sync Engine] Synchronization cycle failed:`, err);
  } finally {
    isSyncing = false;
    if (onSyncStateChange) {
      onSyncStateChange(false);
    }
  }
};
