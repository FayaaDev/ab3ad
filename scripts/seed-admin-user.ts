import { loadLocalEnv } from './load-env';
import { hashPassword } from '../lib/auth-utils';
import { createUserAccount, getUserByEmail } from '../lib/store';
import { v4 as uuid } from 'uuid';

loadLocalEnv();

const email = process.env.ADMIN_SEED_EMAIL;
const password = process.env.ADMIN_SEED_PASSWORD;
const name = process.env.ADMIN_SEED_NAME ?? 'Admin';

if (!email || !password) {
  throw new Error('Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD before running npm run seed-admin.');
}

const existing = await getUserByEmail(email);
if (existing) {
  console.log(`User already exists: ${existing.email}`);
  process.exit(0);
}

const user = await createUserAccount({
  id: uuid(),
  email,
  name,
  passwordHash: hashPassword(password),
  isAdmin: true,
});

console.log(`Seeded admin user ${user.email}`);
