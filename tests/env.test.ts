import assert from 'node:assert/strict';
import test from 'node:test';
import { getRequiredEnv } from '../lib/env';

const envKeys = ['NODE_ENV', 'AUTH_SECRET', 'DATABASE_URL', 'REDIS_URL'] as const;

function snapshotEnv() {
  return Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of envKeys) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      Object.assign(process.env, { [key]: snapshot[key] });
    }
  }
}

test('getRequiredEnv uses explicit values first', () => {
  const env = snapshotEnv();
  try {
    Object.assign(process.env, { NODE_ENV: 'development', DATABASE_URL: 'postgres://custom' });

    assert.equal(getRequiredEnv('DATABASE_URL', 'missing'), 'postgres://custom');
  } finally {
    restoreEnv(env);
  }
});

test('getRequiredEnv falls back to local defaults in development and test', () => {
  const env = snapshotEnv();
  try {
    delete process.env.DATABASE_URL;
    Object.assign(process.env, { NODE_ENV: 'development' });
    assert.equal(getRequiredEnv('DATABASE_URL', 'missing'), 'postgres://ab3ad:ab3ad@127.0.0.1:5432/ab3ad');

    Object.assign(process.env, { NODE_ENV: 'test' });
    delete process.env.REDIS_URL;
    assert.equal(getRequiredEnv('REDIS_URL', 'missing'), 'redis://127.0.0.1:6379');
  } finally {
    restoreEnv(env);
  }
});

test('getRequiredEnv still throws outside local dev/test', () => {
  const env = snapshotEnv();
  try {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.AUTH_SECRET;

    assert.throws(() => getRequiredEnv('AUTH_SECRET', 'missing auth'), /missing auth/);
  } finally {
    restoreEnv(env);
  }
});
