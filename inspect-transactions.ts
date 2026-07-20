import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    console.log('Querying 5 random transaction documents to inspect structure...');
    const transactionsRef = collection(db, 'transactions');
    const q = query(transactionsRef, limit(5));
    const snap = await getDocs(q);
    
    snap.forEach(docSnap => {
      const data = docSnap.data();
      console.log('--- Document ID:', docSnap.id, '---');
      console.log('ownerId:', data.ownerId);
      console.log('cashierId:', data.cashierId);
      console.log('employeeId:', data.employeeId);
      console.log('timestamp:', data.timestamp);
      console.log('---------------------------');
    });
  } catch (err) {
    console.error('Error querying:', err);
  } finally {
    process.exit(0);
  }
}
run();
