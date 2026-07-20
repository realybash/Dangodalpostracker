import { db } from './src/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

async function check() {
  const q = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(50));
  const snap = await getDocs(q);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp, "businessDate:", data.businessDate, "profit:", data.profit);
  });
  process.exit(0);
}
check().catch(console.error);
