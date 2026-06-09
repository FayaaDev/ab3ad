import { cookies } from 'next/headers';
import { createSessionToken, hashPassword, normalizeEmail, shouldTreatAsAdmin, verifyPassword, verifySessionToken } from '@/lib/auth-utils';
import { createUserAccount, getUser, getUserByEmail } from '@/lib/store';
import type { User } from '@/lib/types';
import { v4 as uuid } from 'uuid';

export const sessionCookieName = 'ab3ad_session';

export class AuthError extends Error {
  status = 401;
}

export class AdminAuthError extends Error {
  status = 403;
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(sessionCookieName)?.value;
  if (!session) {
    return null;
  }

  const parsed = verifySessionToken(session);
  if (!parsed) {
    return null;
  }

  const user = await getUser(parsed.userId);
  return user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('Authentication required.');
  }
  return user;
}

export async function requireAdminUser() {
  const user = await requireCurrentUser();
  if (!shouldTreatAsAdmin(user)) {
    throw new AdminAuthError('Admin access required.');
  }
  return user;
}

export function buildSessionCookieValue(userId: string) {
  return createSessionToken(userId);
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: (Number(process.env.AUTH_SESSION_DAYS ?? '30') || 30) * 24 * 60 * 60,
  };
}

export async function registerWithPassword(input: { email: string; name: string; password: string }) {
  const email = normalizeEmail(input.email);
  const existing = await getUserByEmail(email);
  if (existing) {
    throw new Error('An account already exists for that email.');
  }

  return createUserAccount({
    id: uuid(),
    email,
    name: input.name.trim() || email,
    passwordHash: hashPassword(input.password),
    isAdmin: shouldTreatAsAdmin({ id: '', email }),
  });
}

export async function loginWithPassword(input: { email: string; password: string }) {
  const user = await getUserByEmail(normalizeEmail(input.email));
  if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
    throw new AuthError('Invalid email or password.');
  }
  return user;
}
