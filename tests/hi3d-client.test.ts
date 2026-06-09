import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getHi3DResult, getHi3DStatus, getHi3DTaskId } from '../lib/hi3d-contract';
import { HI3D_LOW_BALANCE_MESSAGE, normalizeHi3DErrorMessage, queryTask, resetHi3DClientState, submitTask } from '../lib/hi3d-client';
import type { FileAsset, GenerationJob } from '../lib/types';

const originalFetch = global.fetch;
const defaultStorageRoot = path.resolve(process.cwd(), 'data/storage');
const baseJob: GenerationJob = {
  id: 'job-1',
  userId: 'user-1',
  assetIds: ['asset-1'],
  mode: 'single_image',
  status: 'queued',
  model: 'scene-portraitv2.1',
  resolution: '1536pro',
  faceCount: '800000',
  pbr: true,
  outputFormat: 'glb',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function restoreEnv(previousEnv: NodeJS.ProcessEnv) {
  for (const key of Object.keys(process.env)) {
    if (!(key in previousEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setHi3DEnv(storageRoot: string) {
  process.env.HI3D_MODE = 'real';
  process.env.HI3D_BASE_URL = 'https://api.hitem3d.ai';
  process.env.HI3D_CLIENT_ID = 'client-id';
  process.env.HI3D_CLIENT_SECRET = 'client-secret';
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_ROOT = storageRoot;
}

async function createStoredAsset(storageRoot: string): Promise<FileAsset> {
  const storageKey = `uploads/user-1/${Date.now()}-source.png`;
  const filePath = path.join(storageRoot, storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, Buffer.from('png-data'));

  return {
    id: 'asset-1',
    userId: 'user-1',
    storageKey,
    originalFilename: 'source.png',
    mimeType: 'image/png',
    sizeBytes: 8,
    sha256: 'sha',
    role: 'single',
    createdAt: new Date().toISOString(),
  };
}

test('submitTask uses the documented auth and submit contract', async () => {
  const previousEnv = { ...process.env };
  const storageRoot = defaultStorageRoot;
  let assetPath = '';
  try {
    setHi3DEnv(storageRoot);
    resetHi3DClientState();
    const asset = await createStoredAsset(storageRoot);
    assetPath = path.join(defaultStorageRoot, asset.storageKey);
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];

    global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push({ url, init });

      if (url.endsWith('/open-api/v1/auth/token')) {
        return new Response(JSON.stringify({ code: 200, data: { accessToken: 'token-1' }, msg: 'success' }), { status: 200 });
      }

      assert.equal(url, 'https://api.hitem3d.ai/open-api/v1/submit-task');
      assert.equal(init?.headers instanceof Headers ? init.headers.get('Authorization') : (init?.headers as Record<string, string>).Authorization, 'Bearer token-1');
      const form = init?.body as FormData;
      assert.equal(form.get('face'), '800000');
      assert.equal(form.get('face_count'), null);
      assert.equal(form.get('model'), 'scene-portraitv2.1');
      assert.equal(form.get('resolution'), '1536pro');

      return new Response(JSON.stringify({ code: 200, data: { task_id: 'task-1' }, msg: 'success' }), { status: 200 });
    };

    const result = await submitTask(baseJob, [asset]);
    assert.equal(result.taskId, 'task-1');
    assert.deepEqual(calls.map((call) => call.url), [
      'https://api.hitem3d.ai/open-api/v1/auth/token',
      'https://api.hitem3d.ai/open-api/v1/submit-task',
    ]);
  } finally {
    restoreEnv(previousEnv);
    global.fetch = originalFetch;
    resetHi3DClientState();
    if (assetPath) {
      await fs.rm(assetPath, { force: true });
    }
  }
});

test('queryTask parses nested Image-to-3D status and result fields', async () => {
  const previousEnv = { ...process.env };
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-hi3d-'));
  try {
    setHi3DEnv(storageRoot);
    resetHi3DClientState();
    const calls: string[] = [];

    global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      calls.push(url);

      if (url.endsWith('/open-api/v1/auth/token')) {
        return new Response(JSON.stringify({ code: 200, data: { accessToken: 'token-2' }, msg: 'success' }), { status: 200 });
      }

      assert.equal(url, 'https://api.hitem3d.ai/open-api/v1/query-task?task_id=task-2');
      assert.equal(init?.headers instanceof Headers ? init.headers.get('Authorization') : (init?.headers as Record<string, string>).Authorization, 'Bearer token-2');
      return new Response(
        JSON.stringify({
          code: 200,
          data: {
            task_id: 'task-2',
            state: 'success',
            url: 'https://cdn.hitem3d.ai/result.glb',
            cover_url: 'https://cdn.hitem3d.ai/cover.webp',
          },
          msg: 'success',
        }),
        { status: 200 },
      );
    };

    const result = await queryTask('task-2');
    assert.equal(result.status, 'success');
    assert.deepEqual(result.result, {
      modelUrl: 'https://cdn.hitem3d.ai/result.glb',
      coverUrl: 'https://cdn.hitem3d.ai/cover.webp',
    });
    assert.equal(result.errorCode, undefined);
    assert.equal(result.errorMessage, undefined);
    assert.deepEqual(calls, [
      'https://api.hitem3d.ai/open-api/v1/auth/token',
      'https://api.hitem3d.ai/open-api/v1/query-task?task_id=task-2',
    ]);
  } finally {
    restoreEnv(previousEnv);
    global.fetch = originalFetch;
    resetHi3DClientState();
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
});

test('queryTask surfaces API envelope errors from HTTP 200 responses', async () => {
  const previousEnv = { ...process.env };
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-hi3d-'));
  try {
    setHi3DEnv(storageRoot);
    resetHi3DClientState();

    global.fetch = async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith('/open-api/v1/auth/token')) {
        return new Response(JSON.stringify({ code: 200, data: { accessToken: 'token-3' }, msg: 'success' }), { status: 200 });
      }

      return new Response(JSON.stringify({ code: 50010001, data: {}, msg: 'generate failed' }), { status: 200 });
    };

    await assert.rejects(() => queryTask('task-3'), /generate failed \(50010001\)/);
  } finally {
    restoreEnv(previousEnv);
    global.fetch = originalFetch;
    resetHi3DClientState();
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
});

test('submitTask maps low-balance API errors to the credit message', async () => {
  const previousEnv = { ...process.env };
  const storageRoot = defaultStorageRoot;
  let assetPath = '';
  try {
    setHi3DEnv(storageRoot);
    resetHi3DClientState();
    const asset = await createStoredAsset(storageRoot);
    assetPath = path.join(defaultStorageRoot, asset.storageKey);

    global.fetch = async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.endsWith('/open-api/v1/auth/token')) {
        return new Response(JSON.stringify({ code: 200, data: { accessToken: 'token-4' }, msg: 'success' }), { status: 200 });
      }

      return new Response(JSON.stringify({ code: 30010000, data: {}, msg: 'balance is not enough' }), { status: 200 });
    };

    await assert.rejects(() => submitTask(baseJob, [asset]), new RegExp(HI3D_LOW_BALANCE_MESSAGE));
  } finally {
    restoreEnv(previousEnv);
    global.fetch = originalFetch;
    resetHi3DClientState();
    if (assetPath) {
      await fs.rm(assetPath, { force: true });
    }
  }
});

test('normalizeHi3DErrorMessage detects low-balance variants', () => {
  assert.equal(normalizeHi3DErrorMessage('balance is not enough (30010000)'), HI3D_LOW_BALANCE_MESSAGE);
  assert.equal(normalizeHi3DErrorMessage('another error'), 'another error');
});

test('Hi3D contract helpers read documented callback payloads', () => {
  const payload = {
    code: 200,
    data: {
      task_id: 'task-4',
      state: 'success',
      url: 'https://cdn.hitem3d.ai/result.glb',
      cover_url: 'https://cdn.hitem3d.ai/cover.webp',
    },
    msg: 'success',
  } satisfies Record<string, unknown>;

  assert.equal(getHi3DTaskId(payload), 'task-4');
  assert.equal(getHi3DStatus(payload), 'success');
  assert.deepEqual(getHi3DResult(payload), {
    modelUrl: 'https://cdn.hitem3d.ai/result.glb',
    coverUrl: 'https://cdn.hitem3d.ai/cover.webp',
  });
});
