import crypto from 'node:crypto';
import { getRequiredEnv } from '@/lib/env';

const sessionDurationMs = (Number(process.env.AUTH_SESSION_DAYS ?? '30') || 30) * 24 * 60 * 60 * 1000;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAuthSecret() {
  return getRequiredEnv('AUTH_SECRET', 'Missing AUTH_SECRET. Configure authentication before using the app.');
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(':', 2);
  if (!salt || !hash) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

export function createSessionToken(userId: string, now = Date.now()) {
  const expiresAt = now + sessionDurationMs;
  const payload = `${userId}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string, now = Date.now()) {
  const [userId, expiresAtRaw, signature] = token.split('.', 3);
  if (!userId || !expiresAtRaw || !signature) {
    return null;
  }

  const payload = `${userId}.${expiresAtRaw}`;
  const expected = crypto.createHmac('sha256', getAuthSecret()).update(payload).digest('base64url');
  if (signature !== expected) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    return null;
  }

  return { userId, expiresAt };
}

export function shouldTreatAsAdmin(user: { id: string; email: string; isAdmin?: boolean }) {
  const adminIds = new Set((process.env.ADMIN_USER_IDS ?? '').split(',').map((value) => value.trim()).filter(Boolean));
  const adminEmails = new Set((process.env.ADMIN_EMAILS ?? '').split(',').map((value) => normalizeEmail(value)).filter(Boolean));
  return Boolean(user.isAdmin) || adminIds.has(user.id) || adminEmails.has(normalizeEmail(user.email));
}

export function assertPasswordPolicy(password: string) {
  if (password.length < 10) {
    throw new Error('Password must be at least 10 characters.');
  }
}
