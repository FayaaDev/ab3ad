import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { v4 as uuid } from 'uuid';
import { closePoolForTests, getPool } from '../lib/db';
import {
  createFileAsset,
  createGenerationJob,
  createUserAccount,
  getWalletBalance,
  listWalletEvents,
  recordWalletEvent,
} from '../lib/store';
import { assertCanStartGeneration } from '../lib/wallet';

Object.assign(process.env, { NODE_ENV: 'test' });

const createdUserIds: string[] = [];

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

async function createTestJob(userId: string, status: 'queued' | 'completed' | 'failed' = 'queued') {
  const asset = await createTestAsset(userId);
  return createGenerationJob({
    userId,
    assetIds: [asset.id],
    mode: 'single_image',
    status,
    model: 'hitem3dv2.1',
    resolution: '1536pro',
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

test('wallet ledger supports nullable deposits and derives balance from credit deltas', async () => {
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

test('admin adjustments can deduct credits without forcing a job id', async () => {
  const user = await createTestUser('admin-adjust');

  await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 5 });
  const adjustment = await recordWalletEvent({ userId: user.id, eventType: 'admin_credit_grant', creditDelta: -2 });

  assert.equal(adjustment.jobId, undefined);
  assert.equal(await getWalletBalance(user.id), 3);
});

test('uploads and asset persistence remain allowed with zero balance while generation start is blocked', async () => {
  const user = await createTestUser('zero');
  const asset = await createTestAsset(user.id);

  assert.equal(await getWalletBalance(user.id), 0);
  assert.equal(asset.userId, user.id);
  await assert.rejects(() => assertCanStartGeneration(user.id), /Insufficient credits/);
});

test('generation eligibility opens after deposit and successful jobs debit exactly one credit', async () => {
  const user = await createTestUser('generation');
  await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 1 });

  assert.equal(await assertCanStartGeneration(user.id), 1);

  const job = await createTestJob(user.id, 'completed');
  await recordWalletEvent({ userId: user.id, jobId: job.id, eventType: 'generation_completed', creditDelta: -1 });

  assert.equal(await getWalletBalance(user.id), 0);
  await assert.rejects(
    () => recordWalletEvent({ userId: user.id, jobId: job.id, eventType: 'generation_completed', creditDelta: -1 }),
    /duplicate key|unique/i,
  );
});

test('failed jobs do not debit the wallet ledger', async () => {
  const user = await createTestUser('failed');
  await recordWalletEvent({ userId: user.id, eventType: 'wallet_deposit', creditDelta: 3 });
  await createTestJob(user.id, 'failed');

  assert.equal(await getWalletBalance(user.id), 3);
  assert.equal((await listWalletEvents(user.id)).filter((event) => event.eventType === 'generation_completed').length, 0);
});
