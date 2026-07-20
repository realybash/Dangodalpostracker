import { getAllCachedUsers } from './src/lib/offlineDb';

async function run() {
  const users = await getAllCachedUsers();
  console.log(JSON.stringify(users.map(u => ({ name: u.name, phone: u.phone, email: u.email })), null, 2));
  process.exit(0);
}

run();
