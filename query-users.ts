import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    console.log(`Total users found: ${querySnapshot.size}`);
    querySnapshot.forEach((doc) => {
      console.log(doc.id, '=>', JSON.stringify(doc.data(), null, 2));
    });
  } catch (err) {
    console.error('Error querying users:', err);
  }
}

run();
