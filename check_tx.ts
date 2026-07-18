import { db } from './src/lib/firebase';
import { collection, query, limit, getDocs } from 'firebase/firestore';

async function check() {
  const q = query(collection(db, 'transactions'), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log('No transactions found');
    return;
  }
  const data = snap.docs[0].data();
  console.log('Timestamp value:', data.timestamp);
  console.log('Timestamp type:', typeof data.timestamp);
  if (data.timestamp && typeof data.timestamp === 'object') {
     console.log('Is Timestamp?', data.timestamp.constructor.name);
  }
  process.exit(0);
}

check();
