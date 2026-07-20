import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

async function run() {
  try {
    console.log('Signing in as manager BASHAR NUHU...');
    await signInWithEmailAndPassword(auth, '8141106560@opay-pos.com', 'opay_2030_secure');
    console.log('Auth sign-in successful! Fetching transactions...');

    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('ownerId', '==', 'JcC1krC85wXQidNcL8no2NEJc4v1'),
      limit(200)
    );
    
    const snap = await getDocs(q);
    console.log(`Total transactions found for owner JcC1krC85wXQidNcL8no2NEJc4v1: ${snap.size}`);
    
    const countByCashier: Record<string, number> = {};
    const countByEmployee: Record<string, number> = {};
    const countByStatus: Record<string, number> = {};
    const records: any[] = [];

    snap.forEach((doc) => {
      const data = doc.data();
      const id = doc.id;
      const cashierId = data.cashierId || 'MISSING';
      const employeeId = data.employeeId || 'MISSING';
      const status = data.status || 'MISSING';
      
      countByCashier[cashierId] = (countByCashier[cashierId] || 0) + 1;
      countByEmployee[employeeId] = (countByEmployee[employeeId] || 0) + 1;
      countByStatus[status] = (countByStatus[status] || 0) + 1;
      
      records.push({
        id,
        employeeId,
        cashierId,
        employeeName: data.employeeName || 'N/A',
        amount: data.amount,
        profit: data.profit,
        timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : data.timestamp) : 'N/A',
        status
      });
    });

    console.log('\n--- Transaction Counts by cashierId ---');
    console.log(JSON.stringify(countByCashier, null, 2));

    console.log('\n--- Transaction Counts by employeeId ---');
    console.log(JSON.stringify(countByEmployee, null, 2));

    console.log('\n--- Transaction Counts by Status ---');
    console.log(JSON.stringify(countByStatus, null, 2));

    console.log('\n--- First 30 Transaction Samples ---');
    console.log(JSON.stringify(records.slice(0, 30), null, 2));

  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    process.exit(0);
  }
}

run();
