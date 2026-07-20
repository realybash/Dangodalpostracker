import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  console.log("Fetching...");
  const snap = await getDocs(collection(db, 'transactions'));
  console.log("Docs:", snap.docs.length);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp, "businessDate:", data.businessDate, "profit:", data.profit);
  });
  process.exit(0);
}
check().catch(console.error);
