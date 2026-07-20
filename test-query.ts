import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    console.log('Querying transactions WITHOUT filters...');
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, limit(5));
    const snap = await getDocs(q);
    console.log(`Total transactions found (limit 5): ${snap.size}`);
    snap.forEach(doc => {
      console.log(doc.id, '=>', JSON.stringify(doc.data()));
    });
  } catch (err) {
    console.error('Error querying:', err);
  } finally {
    process.exit(0);
  }
}
run();
