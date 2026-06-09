import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionToken, hashPassword, verifyPassword, verifySessionToken } from '../lib/auth-utils';

test('password hashing verifies the original password only', () => {
  const hash = hashPassword('super-secure-password');
  assert.equal(verifyPassword('super-secure-password', hash), true);
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('session tokens are signed and expire', () => {
  process.env.AUTH_SECRET = 'test-secret';
  const token = createSessionToken('user-123', 1_000);

  assert.deepEqual(verifySessionToken(token, 1_500), { userId: 'user-123', expiresAt: 2_592_001_000 });
  assert.equal(verifySessionToken(token, 2_592_001_001), null);
  assert.equal(verifySessionToken(`${token}tampered`, 1_500), null);
});
