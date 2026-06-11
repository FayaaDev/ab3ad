import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertRequiredScriptEnv, getScriptEnvPresence, loadLocalEnv } from '../scripts/load-env';

const envKeys = ['DATABASE_URL', 'REDIS_URL'] as const;

function snapshotEnv() {
  return Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of envKeys) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

test('loadLocalEnv fills empty shell variables from env files', async () => {
  const env = snapshotEnv();
  const cwd = process.cwd();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-load-env-'));

  try {
    await fs.writeFile(path.join(tempDir, '.env'), 'DATABASE_URL=postgres://from-dot-env\nREDIS_URL=redis://from-dot-env\n');
    process.chdir(tempDir);
    process.env.DATABASE_URL = '';
    process.env.REDIS_URL = '';

    loadLocalEnv();

    assert.equal(process.env.DATABASE_URL, 'postgres://from-dot-env');
    assert.equal(process.env.REDIS_URL, 'redis://from-dot-env');
  } finally {
    process.chdir(cwd);
    restoreEnv(env);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('loadLocalEnv keeps non-empty shell variables', async () => {
  const env = snapshotEnv();
  const cwd = process.cwd();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-load-env-'));

  try {
    await fs.writeFile(path.join(tempDir, '.env'), 'DATABASE_URL=postgres://from-dot-env\n');
    process.chdir(tempDir);
    process.env.DATABASE_URL = 'postgres://from-shell';
    delete process.env.REDIS_URL;

    loadLocalEnv();

    assert.equal(process.env.DATABASE_URL, 'postgres://from-shell');
  } finally {
    process.chdir(cwd);
    restoreEnv(env);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('loadLocalEnv strips surrounding quotes from env values', async () => {
  const env = snapshotEnv();
  const cwd = process.cwd();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-load-env-'));

  try {
    await fs.writeFile(path.join(tempDir, '.env.local'), 'ADMIN_SEED_PASSWORD="quoted-secret"\n');
    process.chdir(tempDir);
    delete process.env.ADMIN_SEED_PASSWORD;

    loadLocalEnv();

    assert.equal(process.env.ADMIN_SEED_PASSWORD, 'quoted-secret');
  } finally {
    process.chdir(cwd);
    restoreEnv(env);
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test('assertRequiredScriptEnv throws a clear error for empty required values', () => {
  const env = snapshotEnv();

  try {
    process.env.DATABASE_URL = '';
    delete process.env.REDIS_URL;

    assert.throws(
      () => assertRequiredScriptEnv('npm run worker', envKeys),
      /npm run worker requires non-empty DATABASE_URL, REDIS_URL\. Check exported env vars and \.env\/\.env\.local\./,
    );
  } finally {
    restoreEnv(env);
  }
});

test('getScriptEnvPresence reports presence without exposing values', () => {
  const env = snapshotEnv();

  try {
    process.env.DATABASE_URL = 'postgres://secret-value';
    process.env.REDIS_URL = '';

    assert.deepEqual(getScriptEnvPresence(envKeys), {
      DATABASE_URL: true,
      REDIS_URL: false,
    });
  } finally {
    restoreEnv(env);
  }
});
