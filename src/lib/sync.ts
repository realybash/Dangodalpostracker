import { getPendingTransactions, deletePendingTransaction } from './offlineDb';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

let isSyncing = false;

export const syncOfflineTransactions = async () => {
  if (isSyncing || !navigator.onLine) return;
  
  const pendingTxs = await getPendingTransactions();
  if (pendingTxs.length === 0) return;

  isSyncing = true;
  console.log(`[Sync] Attempting to sync ${pendingTxs.length} transactions...`);

  try {
    // Process in batches of 500 (Firestore limit)
    const BATCH_SIZE = 500;
    for (let i = 0; i < pendingTxs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const currentBatch = pendingTxs.slice(i, i + BATCH_SIZE);
      
      for (const tx of currentBatch) {
        const txRef = doc(db, 'transactions', tx.id);
        batch.set(txRef, tx);
      }
      
      await batch.commit();
      
      // Clean up local store after successful batch commit
      for (const tx of currentBatch) {
        await deletePendingTransaction(tx.id);
      }
      console.log(`[Sync] Successfully synced batch of ${currentBatch.length} transactions.`);
    }
  } catch (err) {
    console.error(`[Sync] Sync failed:`, err);
  } finally {
    isSyncing = false;
  }
};
