import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { v4 as uuid } from 'uuid';
import { closePoolForTests, getPool } from '../lib/db';
import { retryFailedJob } from '../lib/job-runner';
import { createPricingSnapshot } from '../lib/providers';
import { readStorageObject } from '../lib/storage';
import {
  createFileAsset,
  createGenerationJob,
  createUserAccount,
  getFileAsset,
  getGenerationJob,
  getWalletBalance,
  listWalletEvents,
  recordWalletEvent,
  refundGenerationCredits,
  reserveGenerationCredits,
  settleGenerationCredits,
} from '../lib/store';
import { submitTask } from '../lib/hi3d-client';
import { assertCanStartGeneration } from '../lib/wallet';

Object.assign(process.env, { NODE_ENV: 'test' });

const createdUserIds: string[] = [];
const originalFetch = global.fetch;
const hi3dSnapshot = createPricingSnapshot({ providerId: 'hi3d', mode: 'single_image', quality: 'fast', outputFormat: 'glb' });

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

async function createTestUser(prefix = 'wallet') {
  const id = uuid();
  createdUserIds.push(id);
  return createUserAccount({
    id,
    email: `${prefix}-${id}@example.test`,
    name: `Wallet Test ${id.slice(0, 6)}`,
    passwordHash: 'test-hash',
  });
}

async function createTestAsset(userId: string) {
  return createFileAsset({
    userId,
    storageKey: `uploads/${userId}/${uuid()}.png`,
    originalFilename: 'source.png',
    mimeType: 'image/png',
    sizeBytes: 128,
    sha256: uuid(),
    role: 'single',
  });
}

async function createTestJob(userId: string, status: 'queued' | 'completed' | 'failed' | 'result_download_failed' = 'queued') {
  const asset = await createTestAsset(userId);
  return createGenerationJob({
    userId,
    assetIds: [asset.id],
    mode: 'single_image',
    status,
    providerId: 'hi3d',
    providerOptions: { model: 'hitem3dv2.1', quality: 'fast', resolution: '1536fast', faceCount: '800000', pbr: true },
    pricingSnapshot: hi3dSnapshot,
    settlementState: 'unreserved',
    model: 'hitem3dv2.1',
    resolution: '1536fast',
    faceCount: '800000',
    pbr: true,
    outputFormat: 'glb',
  });
}

after(async () => {
  if (createdUserIds.length) {
    await getPool().query('delete from users where id = any($1::text[])', [createdUserIds]);
  }
  await closePoolForTests();
});

test('wallet ledger supports deposits and derives balance from credit deltas', async () => {
  const user = await createTestUser('ledger');

  assert.equal(await getWalletBalance(user.id), 0);

  const deposit = await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 5 });
  const grant = await recordWalletEvent({ userId: user.id, eventType: 'admin_credit_grant', creditDelta: 2 });

  assert.equal(deposit.jobId, undefined);
  assert.equal(grant.jobId, undefined);
  assert.equal(await getWalletBalance(user.id), 7);

  const events = await listWalletEvents(user.id);
  assert.equal(events.length, 2);
  assert.deepEqual(new Set(events.map((event) => event.eventType)), new Set(['wallet_deposit', 'admin_credit_grant']));
});

test('generation reservations reduce available balance and settlement does not double charge', async () => {
  const user = await createTestUser('reserve');
  await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 3 });

  const job = await createTestJob(user.id);
  await reserveGenerationCredits({ userId: user.id, jobId: job.id, credits: hi3dSnapshot.credits, pricingSnapshot: hi3dSnapshot });

  assert.equal(await getWalletBalance(user.id), 2);
  await settleGenerationCredits({ userId: user.id, jobId: job.id, pricingSnapshot: hi3dSnapshot });
  assert.equal(await getWalletBalance(user.id), 2);

  await assert.rejects(
    () => settleGenerationCredits({ userId: user.id, jobId: job.id, pricingSnapshot: hi3dSnapshot }),
    /duplicate key|unique/i,
  );
});

test('concurrent spending guard blocks starts that exceed the remaining balance', async () => {
  const user = await createTestUser('guard');
  await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 1 });

  const firstJob = await createTestJob(user.id);
  await reserveGenerationCredits({ userId: user.id, jobId: firstJob.id, credits: hi3dSnapshot.credits, pricingSnapshot: hi3dSnapshot });

  assert.equal(await getWalletBalance(user.id), 0);
  await assert.rejects(() => assertCanStartGeneration(user.id, hi3dSnapshot.credits), /Insufficient credits/);

  const secondJob = await createTestJob(user.id);
  await assert.rejects(
    () => reserveGenerationCredits({ userId: user.id, jobId: secondJob.id, credits: hi3dSnapshot.credits, pricingSnapshot: hi3dSnapshot }),
    /Insufficient credits/i,
  );
});

test('result-download recovery keeps the original settled wallet state intact', async () => {
  const previousEnv = { ...process.env };
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-retry-'));

  try {
    process.env.HI3D_MODE = 'mock';
    process.env.HI3D_MOCK_DURATION_MS = '1';
    process.env.PREVIEW_GLB_GENERATION = 'disabled';
    process.env.STORAGE_DRIVER = 'local';
    process.env.STORAGE_ROOT = storageRoot;
    process.env.HI3D_ALLOWED_RESULT_HOSTS = 'dummyimage.com';
    process.env.JOB_QUEUE_MODE = 'inline';

    global.fetch = async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      assert.match(url, /^https:\/\/dummyimage\.com\//);
      return new Response(Buffer.from('cover-image'), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    };

    const user = await createTestUser('recover');
    await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 2 });

    const asset = await createTestAsset(user.id);
    await fs.mkdir(path.dirname(path.join(storageRoot, asset.storageKey)), { recursive: true });
    await fs.writeFile(path.join(storageRoot, asset.storageKey), Buffer.from('source-image'));

    const queuedJob = await createGenerationJob({
      userId: user.id,
      assetIds: [asset.id],
      mode: 'single_image',
      status: 'queued',
      providerId: 'hi3d',
      providerOptions: { model: 'hitem3dv2.1', quality: 'fast', resolution: '1536fast', faceCount: '800000', pbr: true },
      pricingSnapshot: hi3dSnapshot,
      settlementState: 'unreserved',
      model: 'hitem3dv2.1',
      resolution: '1536fast',
      faceCount: '800000',
      pbr: true,
      outputFormat: 'glb',
    });
    const task = await submitTask(queuedJob, [asset]);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const failedJob = await createGenerationJob({
      userId: user.id,
      assetIds: [asset.id],
      mode: 'single_image',
      status: 'result_download_failed',
      providerId: 'hi3d',
      providerTaskId: task.taskId,
      providerOptions: queuedJob.providerOptions,
      pricingSnapshot: hi3dSnapshot,
      settlementState: 'settled',
      model: queuedJob.model,
      resolution: queuedJob.resolution,
      faceCount: queuedJob.faceCount,
      pbr: queuedJob.pbr,
      outputFormat: queuedJob.outputFormat,
      errorCode: 'result_download_failed',
      errorMessage: 'Timed out downloading result',
    });

    const retriedJob = await retryFailedJob(failedJob.id);
    assert.equal(retriedJob.id, failedJob.id);
    assert.equal(retriedJob.status, 'completed');
    assert.ok(retriedJob.resultAssetId);

    const storedJob = await getGenerationJob(failedJob.id);
    assert.equal(storedJob?.status, 'completed');
    assert.ok(storedJob?.completedAt);

    const resultAsset = await getFileAsset(storedJob!.resultAssetId!);
    assert.ok(resultAsset);
    assert.equal((await readStorageObject(resultAsset!.storageKey)).toString('utf8'), 'mock-glb-data');

    assert.equal(await getWalletBalance(user.id), 2);
    assert.equal((await listWalletEvents(user.id)).filter((event) => event.eventType === 'generation_settled').length, 0);
  } finally {
    restoreEnv(previousEnv);
    global.fetch = originalFetch;
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
});

test('late recovery re-charges a refunded timed-out job before completing it', async () => {
  const previousEnv = { ...process.env };
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-late-recover-'));

  try {
    process.env.HI3D_MODE = 'mock';
    process.env.HI3D_MOCK_DURATION_MS = '1';
    process.env.PREVIEW_GLB_GENERATION = 'disabled';
    process.env.STORAGE_DRIVER = 'local';
    process.env.STORAGE_ROOT = storageRoot;
    process.env.HI3D_ALLOWED_RESULT_HOSTS = 'dummyimage.com';
    process.env.JOB_QUEUE_MODE = 'inline';

    global.fetch = async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      assert.match(url, /^https:\/\/dummyimage\.com\//);
      return new Response(Buffer.from('cover-image'), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });
    };

    const user = await createTestUser('late-recover');
    await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 1 });

    const asset = await createTestAsset(user.id);
    await fs.mkdir(path.dirname(path.join(storageRoot, asset.storageKey)), { recursive: true });
    await fs.writeFile(path.join(storageRoot, asset.storageKey), Buffer.from('source-image'));

    const queuedJob = await createGenerationJob({
      userId: user.id,
      assetIds: [asset.id],
      mode: 'single_image',
      status: 'queued',
      providerId: 'hi3d',
      providerOptions: { model: 'hitem3dv2.1', quality: 'fast', resolution: '1536fast', faceCount: '800000', pbr: true },
      pricingSnapshot: hi3dSnapshot,
      settlementState: 'unreserved',
      model: 'hitem3dv2.1',
      resolution: '1536fast',
      faceCount: '800000',
      pbr: true,
      outputFormat: 'glb',
    });
    await reserveGenerationCredits({ userId: user.id, jobId: queuedJob.id, credits: hi3dSnapshot.credits, pricingSnapshot: hi3dSnapshot });
    const task = await submitTask(queuedJob, [asset]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await refundGenerationCredits({ userId: user.id, jobId: queuedJob.id, credits: hi3dSnapshot.credits, reason: 'provider_poll_timeout', pricingSnapshot: hi3dSnapshot });

    const retriedJob = await retryFailedJob(queuedJob.id);
    assert.equal(retriedJob.id, queuedJob.id);
    assert.equal(retriedJob.status, 'completed');

    const storedJob = await getGenerationJob(queuedJob.id);
    assert.equal(storedJob?.providerTaskId, task.taskId);
    assert.equal(storedJob?.settlementState, 'settled');
    assert.ok(storedJob?.resultAssetId);

    assert.equal(await getWalletBalance(user.id), 0);

    const walletEvents = await listWalletEvents(user.id);
    assert.deepEqual(
      walletEvents.map((event) => event.eventType),
      ['wallet_deposit', 'generation_reserved', 'generation_refunded', 'generation_reserved', 'generation_settled'],
    );
  } finally {
    restoreEnv(previousEnv);
    global.fetch = originalFetch;
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
});
