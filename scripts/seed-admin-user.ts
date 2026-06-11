import { loadLocalEnv } from './load-env';
import { hashPassword } from '../lib/auth-utils';
import { createUserAccount, getUserByEmail, setUserByEmail } from '../lib/store';
import { v4 as uuid } from 'uuid';

loadLocalEnv();

const defaultAdminSeedPassword = 'replace-with-a-strong-password';

async function main() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;
  const name = process.env.ADMIN_SEED_NAME ?? 'Admin';

  if (!email || !password) {
    throw new Error('Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD before running npm run seed-admin.');
  }
  if (password === defaultAdminSeedPassword) {
    throw new Error('Replace the default ADMIN_SEED_PASSWORD placeholder before running npm run seed-admin.');
  }

  const passwordHash = hashPassword(password);
  const existing = await getUserByEmail(email);

  if (existing) {
    await setUserByEmail({
      email,
      name,
      passwordHash,
      isAdmin: true,
    });
    console.log(`Updated admin user password: ${email}`);
    process.exit(0);
  }

  const user = await createUserAccount({
    id: uuid(),
    email,
    name,
    passwordHash,
    isAdmin: true,
  });

  console.log(`Seeded admin user ${user.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
