import { headers } from 'next/headers';
import { ensureUser } from '@/lib/store';

export async function getCurrentUser() {
  const headerStore = await headers();
  const userId = headerStore.get('x-demo-user') ?? process.env.DEMO_USER_ID ?? 'demo-user';
  return ensureUser(userId);
}
