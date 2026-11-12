import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { queryHyper3DTask, submitHyper3DTask } from '../lib/hyper3d-client';
import type { FileAsset, GenerationJob } from '../lib/types';

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function createJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: 'job-1',
    userId: 'user-1',
    assetIds: ['asset-1'],
    mode: 'single_image',
    status: 'queued',
    providerId: 'hyper3d',
    providerTaskId: undefined,
    providerOptions: { tier: 'Gen-2.5-High', meshMode: 'Raw', material: 'PBR' },
    settlementState: 'unreserved',
    model: 'unused',
    resolution: '1536pro',
    faceCount: '800000',
    pbr: true,
    outputFormat: 'glb',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createAsset(storageKey: string, role: FileAsset['role'] = 'single'): FileAsset {
  return {
    id: `asset-${role}`,
    userId: 'user-1',
    storageKey,
    originalFilename: `${role}.png`,
    mimeType: 'image/png',
    sizeBytes: 8,
    sha256: role,
    role,
    createdAt: new Date().toISOString(),
  };
}

afterEach(() => {
  restoreEnv();
  global.fetch = originalFetch;
});

test('hyper3d submit extracts task uuid and subscription key from the documented response', async () => {
  const storageRoot = path.join(process.cwd(), 'data/storage');

  try {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'local',
      HYPER3D_MODE: 'real',
      HYPER3D_API_KEY: 'test-key',
      HYPER3D_BASE_URL: 'https://api.hyper3d.com/api/v2',
    });

    const storageKey = 'uploads/user-1/source.png';
    await fs.mkdir(path.dirname(path.join(storageRoot, storageKey)), { recursive: true });
    await fs.writeFile(path.join(storageRoot, storageKey), Buffer.from('png-data'));

    global.fetch = async (input, init) => {
      assert.equal(String(input), 'https://api.hyper3d.com/api/v2/rodin');
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({
        error: null,
        message: 'Submitted.',
        uuid: 'task-123',
        jobs: { subscription_key: 'sub-123' },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const response = await submitHyper3DTask(createJob(), [createAsset(storageKey)]);
    assert.equal(response.taskId, 'task-123');
    assert.deepEqual(response.providerOptionsPatch, {
      tier: 'Gen-2.5-High',
      meshMode: 'Raw',
      material: 'PBR',
      subscriptionKey: 'sub-123',
      outputFormat: 'glb',
    });
  } finally {
    await fs.rm(path.join(storageRoot, 'uploads/user-1'), { recursive: true, force: true });
  }
});

test('hyper3d query combines status polling with result download selection', async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    HYPER3D_MODE: 'real',
    HYPER3D_API_KEY: 'test-key',
    HYPER3D_BASE_URL: 'https://api.hyper3d.com/api/v2',
  });

  const calls: string[] = [];
  global.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith('/status')) {
      return new Response(JSON.stringify({
        jobs: [{ uuid: 'job-a', status: 'Done' }],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (url.endsWith('/download')) {
      return new Response(JSON.stringify({
        list: [
          { name: 'preview.webp', url: 'https://cdn.hyper3d.ai/preview.webp' },
          { name: 'mesh.glb', url: 'https://cdn.hyper3d.ai/mesh.glb' },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const response = await queryHyper3DTask(createJob({
    providerTaskId: 'task-123',
    providerOptions: {
      tier: 'Gen-2.5-High',
      meshMode: 'Raw',
      material: 'PBR',
      subscriptionKey: 'sub-123',
    },
  }));

  assert.equal(response.state, 'succeeded');
  assert.deepEqual(response.result, {
    modelUrl: 'https://cdn.hyper3d.ai/mesh.glb',
    coverUrl: 'https://cdn.hyper3d.ai/preview.webp',
  });
  assert.deepEqual(calls, [
    'https://api.hyper3d.com/api/v2/status',
    'https://api.hyper3d.com/api/v2/download',
  ]);
});
