import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp({
  projectId: firebaseConfig.projectId,
});
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function check() {
  console.log("Fetching...");
  const snap = await db.collection('transactions').orderBy('timestamp', 'desc').limit(50).get();
  console.log("Docs:", snap.docs.length);
  snap.docs.forEach(d => {
    const data = d.data();
    console.log(d.id, data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp, "businessDate:", data.businessDate, "profit:", data.profit);
  });
  process.exit(0);
}
check().catch(console.error);
