import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';
import { getAuthPassword } from './src/utils';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const pins = ['1111', '1234', '0000', '2030', '1010', '2020', '3030', '4040', '2031'];

async function run() {
  const email = '8141106560@opay-pos.com';
  for (const pin of pins) {
    const password = getAuthPassword(pin);
    console.log(`Trying PIN: ${pin}, Password: ${password}...`);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log(`SUCCESS! Authenticated successfully with PIN: ${pin}`);
      process.exit(0);
    } catch (err: any) {
      console.log(`Failed with code: ${err.code}`);
    }
  }
  console.log('None of the PINs worked.');
  process.exit(1);
}

run();
