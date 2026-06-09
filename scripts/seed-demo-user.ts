import { ensureUser } from '../lib/store';

await ensureUser(process.env.DEMO_USER_ID ?? 'demo-user');
console.log('Seeded demo user.');
