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
      console.log('[TRANSACTION SYNC TRACE] [Sync Engine] Synchronizer is already running. Skipping concurrent run.');
    }
    if (!navigator.onLine) {
      console.log('[TRANSACTION SYNC TRACE] [Sync Engine] Device is offline. Cannot initiate cloud synchronization.');
    }
    return;
  }
  
  isSyncing = true;
  if (onSyncStateChange) {
    onSyncStateChange(true);
  }
  console.log('[TRANSACTION SYNC TRACE] [Sync Engine] Network connectivity detected. Initiating robust synchronization of all pending local mutations...');

  try {
    // 1. Synchronize Pending Deletions first to ensure proper database cascading state
    const pendingDeletes = await getPendingDeletions();
    if (pendingDeletes.length > 0) {
      console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] Found ${pendingDeletes.length} pending document deletions to synchronize...`);
      for (const del of pendingDeletes) {
        try {
          console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Delete] Attempting to delete document: ID: "${del.docId}" in Collection: "${del.collection}"`);
          const docRef = doc(db, del.collection, del.docId);
          await deleteDoc(docRef);
          console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [SUCCESS] Document deleted from Firestore: "${del.collection}/${del.docId}"`);
          await deletePendingDeletion(del.id);
        } catch (delErr) {
          console.error(`[TRANSACTION SYNC TRACE] [Sync Engine] [ERROR] Failed to synchronize deletion of ${del.collection}/${del.docId}:`, delErr);
        }
      }
    } else {
      console.log('[TRANSACTION SYNC TRACE] [Sync Engine] No pending deletions found in IndexedDB.');
    }

    // 2. Synchronize Pending Expenses
    const pendingExpenses = await getPendingExpenses();
    if (pendingExpenses.length > 0) {
      console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] Found ${pendingExpenses.length} pending expenses to synchronize...`);
      const BATCH_SIZE = 500;
      for (let i = 0; i < pendingExpenses.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = pendingExpenses.slice(i, i + BATCH_SIZE);
        
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Write] Preparing batch of ${currentBatch.length} expenses (Index: ${i} to ${i + currentBatch.length})...`);
        for (const exp of currentBatch) {
          const expRef = doc(db, 'expenses', exp.id);
          batch.set(expRef, exp, { merge: true });
        }
        
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Commit] Committing expense batch to Firestore...`);
        await batch.commit();
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [SUCCESS] Expense batch committed successfully to Firestore.`);
        
        for (const exp of currentBatch) {
          await deletePendingExpense(exp.id);
        }
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] Successfully synced and cleaned up batch of ${currentBatch.length} expenses.`);
      }
    } else {
      console.log('[TRANSACTION SYNC TRACE] [Sync Engine] No pending expenses found in IndexedDB.');
    }

    // 3. Synchronize Pending POS Terminals
    const pendingTerminals = await getPendingPosTerminals();
    if (pendingTerminals.length > 0) {
      console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] Found ${pendingTerminals.length} pending POS terminals to synchronize...`);
      const BATCH_SIZE = 500;
      for (let i = 0; i < pendingTerminals.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = pendingTerminals.slice(i, i + BATCH_SIZE);
        
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Write] Preparing batch of ${currentBatch.length} POS terminals (Index: ${i} to ${i + currentBatch.length})...`);
        for (const term of currentBatch) {
          const termRef = doc(db, 'pos_terminals', term.id);
          batch.set(termRef, term, { merge: true });
        }
        
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Commit] Committing POS terminal batch to Firestore...`);
        await batch.commit();
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [SUCCESS] POS terminal batch committed successfully to Firestore.`);
        
        for (const term of currentBatch) {
          await deletePendingPosTerminal(term.id);
        }
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] Successfully synced and cleaned up batch of ${currentBatch.length} POS terminals.`);
      }
    } else {
      console.log('[TRANSACTION SYNC TRACE] [Sync Engine] No pending POS terminals found in IndexedDB.');
    }

    // 4. Synchronize Pending Transactions (with defensive deduplication check)
    const pendingTxs = await getPendingTransactions();
    if (pendingTxs.length > 0) {
      console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] Found ${pendingTxs.length} pending transactions to synchronize in local IndexedDB queue.`);
      const BATCH_SIZE = 500;
      for (let i = 0; i < pendingTxs.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const currentBatch = pendingTxs.slice(i, i + BATCH_SIZE);
        
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Write] Preparing batch of ${currentBatch.length} transactions (Index: ${i} to ${i + currentBatch.length})...`);
        for (const tx of currentBatch) {
          console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Write] Enqueuing write for transaction: ID: "${tx.id}", Amount: $${tx.amount || tx.total || 0}, Status: "${tx.status || 'pending'}", Timestamp: "${tx.date || tx.createdAt || 'N/A'}"`);
          const txRef = doc(db, 'transactions', tx.id);
          batch.set(txRef, tx, { merge: true });
        }
        
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Firestore Commit] Committing batch of ${currentBatch.length} transactions to Firestore...`);
        const startCommitTime = Date.now();
        await batch.commit();
        const duration = Date.now() - startCommitTime;
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [SUCCESS] Firestore commit of transaction batch succeeded in ${duration}ms.`);
        
        // Clean up local store after successful batch commit
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [Local Clean] Cleaning up ${currentBatch.length} pending transaction records from local IndexedDB...`);
        for (const tx of currentBatch) {
          await deletePendingTransaction(tx.id);
        }
        console.log(`[TRANSACTION SYNC TRACE] [Sync Engine] [SUCCESS] Synced and cleaned up batch of ${currentBatch.length} transactions.`);
      }
    } else {
      console.log('[TRANSACTION SYNC TRACE] [Sync Engine] No pending transactions found in IndexedDB.');
    }

    console.log('[TRANSACTION SYNC TRACE] [Sync Engine] Offline synchronization cycle completed successfully.');
  } catch (err) {
    console.error(`[TRANSACTION SYNC TRACE] [Sync Engine] [ERROR] Synchronization cycle failed:`, err);
  } finally {
    isSyncing = false;
    if (onSyncStateChange) {
      onSyncStateChange(false);
    }
  }
};
