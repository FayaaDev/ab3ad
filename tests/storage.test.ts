import test from 'node:test';
import assert from 'node:assert/strict';
import { absoluteStoragePath, readStorageObject } from '../lib/storage';

const storageEnvKeys = ['STORAGE_DRIVER', 'R2_BUCKET', 'R2_ACCOUNT_ID', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_ENDPOINT'] as const;

function snapshotStorageEnv() {
  return Object.fromEntries(storageEnvKeys.map((key) => [key, process.env[key]]));
}

function restoreStorageEnv(snapshot: Record<string, string | undefined>) {
  for (const key of storageEnvKeys) {
    if (snapshot[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = snapshot[key];
    }
  }
}

test('local storage paths reject traversal keys', () => {
  const env = snapshotStorageEnv();
  try {
    process.env.STORAGE_DRIVER = 'local';
    assert.match(absoluteStoragePath('uploads/demo-user/example.png'), /data\/storage\/uploads\/demo-user\/example\.png$/);
    assert.throws(() => absoluteStoragePath('../secret.png'), /Invalid storage key/);
  } finally {
    restoreStorageEnv(env);
  }
});

test('r2 storage requires bucket configuration', async () => {
  const env = snapshotStorageEnv();
  try {
    process.env.STORAGE_DRIVER = 'r2';
    delete process.env.R2_BUCKET;
    delete process.env.S3_BUCKET;

    await assert.rejects(() => readStorageObject('uploads/demo-user/example.png'), /Missing R2_BUCKET or S3_BUCKET/);
  } finally {
    restoreStorageEnv(env);
  }
});
