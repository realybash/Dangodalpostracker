import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp({
  projectId: firebaseConfig.projectId
});

const db = getFirestore(app);

// Set the specific database ID if configured
if (firebaseConfig.firestoreDatabaseId) {
  db.settings({
    databaseId: firebaseConfig.firestoreDatabaseId
  });
}

async function run() {
  try {
    console.log('Querying transactions via Admin SDK...');
    const transactionsRef = db.collection('transactions');
    
    // We want to fetch transactions and check fields
    const snap = await transactionsRef.where('ownerId', '==', 'JcC1krC85wXQidNcL8no2NEJc4v1').limit(100).get();
    console.log(`Total transactions found for owner JcC1krC85wXQidNcL8no2NEJc4v1: ${snap.size}`);
    
    if (snap.size === 0) {
      console.log('No transactions found. Let us try querying ALL transactions...');
      const allSnap = await transactionsRef.limit(50).get();
      console.log(`Total transactions in DB (limit 50): ${allSnap.size}`);
      allSnap.forEach(doc => {
        console.log(doc.id, '=>', JSON.stringify(doc.data()));
      });
    } else {
      const records: any[] = [];
      snap.forEach((doc) => {
        records.push({
          id: doc.id,
          data: doc.data()
        });
      });
      console.log(JSON.stringify(records, null, 2));
    }
  } catch (err) {
    console.error('Error in Admin query:', err);
  } finally {
    process.exit(0);
  }
}

run();
