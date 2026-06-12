import assert from 'node:assert/strict';
import test from 'node:test';

import { closePoolForTests, getPool } from '../lib/db';

const envKeys = ['NODE_ENV', 'DATABASE_URL'] as const;
const cloudflareContextSymbol = Symbol.for('__cloudflare-context__');

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

function setCloudflareContext(connectionString?: string) {
  if (!connectionString) {
    delete (globalThis as Record<PropertyKey, unknown>)[cloudflareContextSymbol];
    return;
  }

  (globalThis as Record<PropertyKey, unknown>)[cloudflareContextSymbol] = {
    env: {
      HYPERDRIVE: { connectionString },
    },
  };
}

test('getPool prefers Hyperdrive over DATABASE_URL in production', async () => {
  const env = snapshotEnv();
  try {
    await closePoolForTests();
    Object.assign(process.env, {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://direct-runtime',
    });
    setCloudflareContext('postgres://hyperdrive-runtime');

    const pool = getPool() as unknown as { options: { connectionString?: string } };
    assert.equal(pool.options.connectionString, 'postgres://hyperdrive-runtime');
  } finally {
    await closePoolForTests();
    setCloudflareContext();
    restoreEnv(env);
  }
});

test('getPool keeps local DATABASE_URL override outside production', async () => {
  const env = snapshotEnv();
  try {
    await closePoolForTests();
    Object.assign(process.env, {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://direct-runtime',
    });
    setCloudflareContext('postgres://hyperdrive-runtime');

    const pool = getPool() as unknown as { options: { connectionString?: string } };
    assert.equal(pool.options.connectionString, 'postgres://direct-runtime');
  } finally {
    await closePoolForTests();
    setCloudflareContext();
    restoreEnv(env);
  }
});
