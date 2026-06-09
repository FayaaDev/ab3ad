import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { assertTrustedResultUrl, verifyHi3DCallbackSignature } from '../lib/hi3d-security';

test('callback verification accepts configured HMAC signature', () => {
  process.env.HI3D_MODE = 'real';
  process.env.HI3D_CALLBACK_SECRET = 'callback-secret';
  process.env.HI3D_ALLOW_UNSIGNED_CALLBACKS = 'false';

  const body = JSON.stringify({ task_id: 'task-1', status: 'success' });
  const signature = crypto.createHmac('sha256', 'callback-secret').update(body).digest('hex');
  const headers = new Headers({ 'x-hi3d-signature': `sha256=${signature}` });

  assert.equal(verifyHi3DCallbackSignature(body, headers), true);
  assert.equal(verifyHi3DCallbackSignature(body, new Headers()), false);
});

test('trusted result URL enforcement rejects unlisted hosts', () => {
  process.env.HI3D_ALLOWED_RESULT_HOSTS = 'cdn.hi3d.ai';
  assert.doesNotThrow(() => assertTrustedResultUrl('https://cdn.hi3d.ai/output.glb'));
  assert.throws(() => assertTrustedResultUrl('https://evil.example/output.glb'), /Untrusted result URL host/);
});
