import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { v4 as uuid } from 'uuid';
import { closePoolForTests, getPool } from '../lib/db';
import { processJob } from '../lib/job-runner';
import {
  createPricingSnapshot,
  getOutputFormatExtension,
  getOutputFormatMimeType,
  getProviderAdapter,
  listProviderCatalog,
  validateProviderSelection,
} from '../lib/providers';
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
  reserveGenerationCredits,
} from '../lib/store';
import { buildProviderOptions } from '../lib/validation';

const createdUserIds: string[] = [];
const originalFetch = global.fetch;

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

async function createTestUser(prefix = 'provider') {
  const id = uuid();
  createdUserIds.push(id);
  return createUserAccount({
    id,
    email: `${prefix}-${id}@example.test`,
    name: `Provider Test ${id.slice(0, 6)}`,
    passwordHash: 'test-hash',
  });
}

after(async () => {
  if (createdUserIds.length) {
    await getPool().query('delete from users where id = any($1::text[])', [createdUserIds]);
  }
  global.fetch = originalFetch;
  await closePoolForTests();
});

test('provider catalog exposes Hi3D and PrintPal with safe pricing metadata', () => {
  const providers = listProviderCatalog();
  assert.deepEqual(
    providers.map((provider) => provider.id),
    ['hi3d', 'printpal'],
  );
  assert.equal(providers[0]?.qualities.some((entry) => typeof entry.credits === 'number'), true);
});

test('provider validation enforces provider-specific modes and formats', () => {
  assert.doesNotThrow(() => validateProviderSelection({ providerId: 'hi3d', mode: 'single_image', quality: 'fast', outputFormat: 'glb' }));
  assert.throws(() => validateProviderSelection({ providerId: 'hi3d', mode: 'single_image', quality: 'fast', outputFormat: 'obj' }), /does not support OBJ output/i);
  assert.throws(() => validateProviderSelection({ providerId: 'printpal', mode: 'multi_view', quality: 'fast', outputFormat: 'glb' }), /does not support multi view mode/i);
});

test('provider helpers derive pricing, options, and output metadata', () => {
  const snapshot = createPricingSnapshot({ providerId: 'printpal', mode: 'single_image', quality: 'high', outputFormat: 'obj' });
  assert.equal(snapshot.credits, 3);
  assert.equal(snapshot.providerRateLabel, 'Production');

  assert.deepEqual(buildProviderOptions({ providerId: 'printpal', mode: 'single_image', model: 'ignored', quality: 'high', pbr: false }), {
    quality: 'high',
    pbr: false,
  });

  assert.equal(getOutputFormatExtension('obj'), '.obj');
  assert.equal(getOutputFormatMimeType('obj'), 'model/obj');
});

test('printpal adapter mock path completes through the shared job runner and settles reserved credits', async () => {
  const previousEnv = { ...process.env };
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ab3ad-printpal-'));

  try {
    Object.assign(process.env, {
      NODE_ENV: 'test',
      PRINTPAL_MODE: 'mock',
      HI3D_MODE: 'mock',
      HI3D_MOCK_DURATION_MS: '1',
      PREVIEW_GLB_GENERATION: 'disabled',
      STORAGE_DRIVER: 'local',
      STORAGE_ROOT: storageRoot,
      JOB_QUEUE_MODE: 'inline',
    });

    global.fetch = async () =>
      new Response(Buffer.from('cover-image'), {
        status: 200,
        headers: { 'content-type': 'image/png' },
      });

    const user = await createTestUser('printpal');
    await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 5 });

    const asset = await createFileAsset({
      userId: user.id,
      storageKey: `uploads/${user.id}/${uuid()}.png`,
      originalFilename: 'source.png',
      mimeType: 'image/png',
      sizeBytes: 128,
      sha256: uuid(),
      role: 'single',
    });
    await fs.mkdir(path.dirname(path.join(storageRoot, asset.storageKey)), { recursive: true });
    await fs.writeFile(path.join(storageRoot, asset.storageKey), Buffer.from('source-image'));

    const pricingSnapshot = createPricingSnapshot({ providerId: 'printpal', mode: 'single_image', quality: 'fast', outputFormat: 'obj' });
    const job = await createGenerationJob({
      userId: user.id,
      assetIds: [asset.id],
      mode: 'single_image',
      status: 'queued',
      providerId: 'printpal',
      providerOptions: buildProviderOptions({ providerId: 'printpal', mode: 'single_image', model: 'unused', quality: 'fast', pbr: true }),
      pricingSnapshot,
      settlementState: 'unreserved',
      model: 'unused',
      resolution: '1536fast',
      faceCount: '800000',
      pbr: true,
      outputFormat: 'obj',
    });

    await reserveGenerationCredits({ userId: user.id, jobId: job.id, credits: pricingSnapshot.credits, pricingSnapshot });
    await processJob(job.id);
    await new Promise((resolve) => setTimeout(resolve, 850));
    await processJob(job.id);

    const storedJob = await getGenerationJob(job.id);
    assert.equal(storedJob?.status, 'completed');
    assert.equal(storedJob?.settlementState, 'settled');
    assert.equal(await getWalletBalance(user.id), 3);

    const resultAsset = await getFileAsset(storedJob!.resultAssetId!);
    assert.equal(resultAsset?.originalFilename.endsWith('.obj'), true);
    assert.equal(resultAsset?.mimeType, 'model/obj');
    assert.equal((await readStorageObject(resultAsset!.storageKey)).byteLength > 0, true);

    const walletEvents = await listWalletEvents(user.id);
    assert.deepEqual(
      walletEvents.map((event) => event.eventType),
      ['generation_settled', 'generation_reserved', 'wallet_deposit'],
    );
  } finally {
    restoreEnv(previousEnv);
    global.fetch = originalFetch;
    await fs.rm(storageRoot, { recursive: true, force: true });
  }
});

test('provider adapter lookup returns PrintPal adapter', async () => {
  const adapter = getProviderAdapter('printpal');
  assert.equal(adapter.id, 'printpal');
});
