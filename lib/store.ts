import { v4 as uuid } from 'uuid';
import { ensureDatabaseSchema, getPool } from '@/lib/db';
import type {
  BillingEvent,
  Database,
  FileAsset,
  GenerationJob,
  JobEvent,
  ProviderPricingSnapshot,
  User,
  WalletEventType,
  WalletSummary,
  WalletSettlementState,
} from '@/lib/types';
import { normalizeJobStatus, nowIso } from '@/lib/utils';

type RowRecord = Record<string, unknown>;

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: unknown[] }>;
};

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.map((item) => String(item));
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function mapUser(row: RowRecord): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    passwordHash: row.password_hash ? String(row.password_hash) : undefined,
    isAdmin: Boolean(row.is_admin),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapFileAsset(row: RowRecord): FileAsset {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    storageKey: String(row.storage_key),
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes),
    sha256: String(row.sha256),
    role: row.role as FileAsset['role'],
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapGenerationJob(row: RowRecord): GenerationJob {
  const providerOptions = asRecord(row.provider_options);
  const pricingSnapshot = row.pricing_snapshot ? (row.pricing_snapshot as ProviderPricingSnapshot) : undefined;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    assetIds: asStringArray(row.asset_ids),
    mode: row.mode as GenerationJob['mode'],
    status: normalizeJobStatus(String(row.status)) as GenerationJob['status'],
    providerId: (row.provider_id ? String(row.provider_id) : 'hi3d') as GenerationJob['providerId'],
    providerTaskId: row.provider_task_id ? String(row.provider_task_id) : row.hi3d_task_id ? String(row.hi3d_task_id) : undefined,
    providerOptions,
    pricingSnapshot,
    settlementState: (row.settlement_state ? String(row.settlement_state) : pricingSnapshot ? 'settled' : 'unreserved') as WalletSettlementState,
    model: String(row.model),
    resolution: String(row.resolution),
    faceCount: String(row.face_count),
    pbr: Boolean(row.pbr),
    outputFormat: row.output_format as GenerationJob['outputFormat'],
    resultAssetId: row.result_asset_id ? String(row.result_asset_id) : undefined,
    previewAssetId: row.preview_asset_id ? String(row.preview_asset_id) : undefined,
    coverAssetId: row.cover_asset_id ? String(row.cover_asset_id) : undefined,
    errorCode: row.error_code ? String(row.error_code) : undefined,
    errorMessage: row.error_message ? String(row.error_message) : undefined,
    pollAttempts: row.poll_attempts ? Number(row.poll_attempts) : 0,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    completedAt: row.completed_at ? new Date(String(row.completed_at)).toISOString() : undefined,
  };
}

function mapJobEvent(row: RowRecord): JobEvent {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    eventType: String(row.event_type),
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

function mapBillingEvent(row: RowRecord): BillingEvent {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    jobId: row.job_id ? String(row.job_id) : undefined,
    eventType: row.event_type as WalletEventType,
    creditDelta: Number(row.credit_delta),
    metadata: asRecord(row.metadata),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

async function query<T>(sql: string, values: unknown[], mapper: (row: RowRecord) => T) {
  await ensureDatabaseSchema();
  const result = await getPool().query(sql, values);
  return result.rows.map((row) => mapper(row as RowRecord));
}

async function queryOne<T>(sql: string, values: unknown[], mapper: (row: RowRecord) => T) {
  const rows = await query(sql, values, mapper);
  return rows[0] ?? null;
}

async function addBillingEventWithClient(client: Queryable, event: Omit<BillingEvent, 'id' | 'createdAt'>) {
  const created: BillingEvent = {
    ...event,
    id: uuid(),
    createdAt: nowIso(),
  };
  const result = await client.query(
    'insert into billing_events (id, user_id, job_id, event_type, credit_delta, metadata, created_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7) returning *',
    [created.id, created.userId, created.jobId ?? null, created.eventType, created.creditDelta, JSON.stringify(created.metadata ?? {}), created.createdAt],
  );
  return mapBillingEvent(result.rows[0] as RowRecord);
}

export async function createUserAccount(user: { id: string; email: string; name: string; passwordHash: string; isAdmin?: boolean }) {
  await ensureDatabaseSchema();
  const createdAt = nowIso();
  const result = await getPool().query(
    `
      insert into users (id, email, name, password_hash, is_admin, created_at)
      values ($1, $2, $3, $4, $5, $6)
      returning *
    `,
    [user.id, user.email, user.name, user.passwordHash, user.isAdmin ?? false, createdAt],
  );
  return mapUser(result.rows[0] as RowRecord);
}

export async function setUserByEmail(input: { email: string; name: string; passwordHash: string; isAdmin?: boolean }) {
  await ensureDatabaseSchema();
  const result = await getPool().query(
    `
      update users
      set name = $1, password_hash = $2, is_admin = $3
      where lower(email) = lower($4)
      returning *
    `,
    [input.name, input.passwordHash, input.isAdmin ?? false, input.email],
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapUser(result.rows[0] as RowRecord);
}

export async function getUser(userId: string) {
  return queryOne('select * from users where id = $1 limit 1', [userId], mapUser);
}

export async function getUserByEmail(email: string) {
  return queryOne('select * from users where lower(email) = lower($1) limit 1', [email], mapUser);
}

export async function listUsers(limit = 100) {
  return query('select * from users order by created_at desc limit $1', [limit], mapUser);
}

export async function createFileAsset(asset: Omit<FileAsset, 'id' | 'createdAt'>) {
  await ensureDatabaseSchema();
  const created: FileAsset = {
    ...asset,
    id: uuid(),
    createdAt: nowIso(),
  };
  const result = await getPool().query(
    `
      insert into file_assets (
        id, user_id, storage_key, original_filename, mime_type, size_bytes, sha256, role, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *
    `,
    [
      created.id,
      created.userId,
      created.storageKey,
      created.originalFilename,
      created.mimeType,
      created.sizeBytes,
      created.sha256,
      created.role,
      created.createdAt,
    ],
  );
  return mapFileAsset(result.rows[0] as RowRecord);
}

export async function getFileAssets(ids: string[]) {
  if (!ids.length) {
    return [];
  }
  return query('select * from file_assets where id = any($1::text[])', [ids], mapFileAsset);
}

export async function getFileAsset(id: string) {
  return queryOne('select * from file_assets where id = $1 limit 1', [id], mapFileAsset);
}

export async function createGenerationJob(job: Omit<GenerationJob, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) {
  await ensureDatabaseSchema();
  const created: GenerationJob = {
    ...job,
    id: job.id ?? uuid(),
    providerOptions: job.providerOptions ?? {},
    settlementState: job.settlementState ?? 'unreserved',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const result = await getPool().query(
    `
      insert into generation_jobs (
        id, user_id, asset_ids, mode, status, provider_id, provider_task_id, provider_options, pricing_snapshot, settlement_state,
        model, resolution, face_count, pbr, output_format,
        hi3d_task_id, result_asset_id, preview_asset_id, cover_asset_id, error_code, error_message, poll_attempts, created_at, updated_at, completed_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      )
      returning *
    `,
    [
      created.id,
      created.userId,
      created.assetIds,
      created.mode,
      created.status,
      created.providerId,
      created.providerTaskId ?? null,
      JSON.stringify(created.providerOptions ?? {}),
      created.pricingSnapshot ? JSON.stringify(created.pricingSnapshot) : null,
      created.settlementState,
      created.model,
      created.resolution,
      created.faceCount,
      created.pbr,
      created.outputFormat,
      created.providerId === 'hi3d' ? created.providerTaskId ?? null : null,
      created.resultAssetId ?? null,
      created.previewAssetId ?? null,
      created.coverAssetId ?? null,
      created.errorCode ?? null,
      created.errorMessage ?? null,
      created.pollAttempts ?? 0,
      created.createdAt,
      created.updatedAt,
      created.completedAt ?? null,
    ],
  );
  return mapGenerationJob(result.rows[0] as RowRecord);
}

export async function updateGenerationJob(jobId: string, patch: Partial<GenerationJob>) {
  await ensureDatabaseSchema();
  const updates: string[] = [];
  const values: unknown[] = [];
  const fields: Array<[keyof GenerationJob, string, boolean?]> = [
    ['assetIds', 'asset_ids'],
    ['mode', 'mode'],
    ['status', 'status'],
    ['providerId', 'provider_id'],
    ['providerTaskId', 'provider_task_id'],
    ['providerOptions', 'provider_options', true],
    ['pricingSnapshot', 'pricing_snapshot', true],
    ['settlementState', 'settlement_state'],
    ['model', 'model'],
    ['resolution', 'resolution'],
    ['faceCount', 'face_count'],
    ['pbr', 'pbr'],
    ['outputFormat', 'output_format'],
    ['resultAssetId', 'result_asset_id'],
    ['previewAssetId', 'preview_asset_id'],
    ['coverAssetId', 'cover_asset_id'],
    ['errorCode', 'error_code'],
    ['errorMessage', 'error_message'],
    ['pollAttempts', 'poll_attempts'],
    ['completedAt', 'completed_at'],
  ];

  for (const [key, column, isJson] of fields) {
    if (key in patch) {
      const value = patch[key];
      values.push(isJson && value !== undefined && value !== null ? JSON.stringify(value) : value ?? null);
      updates.push(`${column} = $${values.length}${isJson ? '::jsonb' : ''}`);
      if (key === 'providerTaskId') {
        values.push(patch.providerId === 'hi3d' || patch.providerId === undefined ? value ?? null : null);
        updates.push(`hi3d_task_id = $${values.length}`);
      }
    }
  }

  values.push(nowIso());
  updates.push(`updated_at = $${values.length}`);
  values.push(jobId);

  const result = await getPool().query(`update generation_jobs set ${updates.join(', ')} where id = $${values.length} returning *`, values);
  if (!result.rows[0]) {
    throw new Error(`Job not found: ${jobId}`);
  }
  return mapGenerationJob(result.rows[0] as RowRecord);
}

export async function deleteGenerationJob(jobId: string) {
  await ensureDatabaseSchema();
  await getPool().query('delete from generation_jobs where id = $1', [jobId]);
}

export async function getGenerationJob(jobId: string) {
  return queryOne('select * from generation_jobs where id = $1 limit 1', [jobId], mapGenerationJob);
}

export async function findGenerationJobByTaskId(taskId: string, providerId?: string) {
  return queryOne(
    providerId
      ? 'select * from generation_jobs where provider_id = $1 and provider_task_id = $2 order by created_at desc limit 1'
      : 'select * from generation_jobs where provider_task_id = $1 order by created_at desc limit 1',
    providerId ? [providerId, taskId] : [taskId],
    mapGenerationJob,
  );
}

export async function listGenerationJobs(limit = 50) {
  return query('select * from generation_jobs order by created_at desc limit $1', [limit], mapGenerationJob);
}

export async function listGenerationJobsForUser(userId: string, limit = 25) {
  return query('select * from generation_jobs where user_id = $1 order by created_at desc limit $2', [userId, limit], mapGenerationJob);
}

export async function addJobEvent(event: Omit<JobEvent, 'id' | 'createdAt'>) {
  await ensureDatabaseSchema();
  const created: JobEvent = {
    ...event,
    id: uuid(),
    createdAt: nowIso(),
  };
  const result = await getPool().query(
    'insert into job_events (id, job_id, event_type, payload, created_at) values ($1, $2, $3, $4::jsonb, $5) returning *',
    [created.id, created.jobId, created.eventType, JSON.stringify(created.payload ?? {}), created.createdAt],
  );
  return mapJobEvent(result.rows[0] as RowRecord);
}

export async function listJobEvents(jobId: string) {
  return query('select * from job_events where job_id = $1 order by created_at asc', [jobId], mapJobEvent);
}

export async function addBillingEvent(event: Omit<BillingEvent, 'id' | 'createdAt'>) {
  await ensureDatabaseSchema();
  return addBillingEventWithClient(getPool(), event);
}

export async function recordWalletEvent(event: { userId: string; eventType: WalletEventType; creditDelta: number; jobId?: string; metadata?: Record<string, unknown> }) {
  if (!Number.isInteger(event.creditDelta)) {
    throw new Error('Wallet credit delta must be an integer.');
  }
  if (event.creditDelta === 0 && event.eventType !== 'generation_settled') {
    throw new Error('Only settlement markers may have a zero credit delta.');
  }
  if (event.creditDelta > 0 && event.eventType !== 'wallet_deposit' && event.eventType !== 'admin_credit_grant' && event.eventType !== 'generation_refunded') {
    throw new Error('Positive wallet credits must be deposits, grants, or refunds.');
  }
  if ((event.eventType === 'generation_reserved' || event.eventType === 'generation_settled' || event.eventType === 'generation_refunded') && !event.jobId) {
    throw new Error(`${event.eventType} must include a job id.`);
  }

  return addBillingEvent(event);
}

export async function getWalletBalance(userId: string) {
  await ensureDatabaseSchema();
  const result = await getPool().query('select coalesce(sum(credit_delta), 0)::integer as balance from billing_events where user_id = $1', [userId]);
  return Number(result.rows[0]?.balance ?? 0);
}

export async function listWalletEvents(userId: string, limit = 25) {
  return query('select * from billing_events where user_id = $1 order by created_at desc limit $2', [userId, limit], mapBillingEvent);
}

export async function listRecentBillingEvents(limit = 100) {
  return query('select * from billing_events order by created_at desc limit $1', [limit], mapBillingEvent);
}

export async function listWalletSummaries(limit = 100): Promise<WalletSummary[]> {
  await ensureDatabaseSchema();
  const users = await listUsers(limit);
  const balances = await getPool().query(
    `
      select user_id, coalesce(sum(credit_delta), 0)::integer as balance
      from billing_events
      where user_id = any($1::text[])
      group by user_id
    `,
    [users.map((user) => user.id)],
  );
  const balanceByUser = new Map((balances.rows as RowRecord[]).map((row) => [String(row.user_id), Number(row.balance)]));
  const recentEvents = await Promise.all(users.map((user) => listWalletEvents(user.id, 25)));

  return users.map((user, index) => ({
    userId: user.id,
    email: user.email,
    name: user.name,
    balance: balanceByUser.get(user.id) ?? 0,
    recentEvents: recentEvents[index] ?? [],
  }));
}

export async function reserveGenerationCredits(input: { userId: string; jobId: string; credits: number; pricingSnapshot: ProviderPricingSnapshot }) {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new Error('Generation reservations must reserve a positive integer number of credits.');
  }

  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [input.userId]);

    const balanceResult = await client.query('select coalesce(sum(credit_delta), 0)::integer as balance from billing_events where user_id = $1', [input.userId]);
    const balance = Number((balanceResult.rows[0] as RowRecord | undefined)?.balance ?? 0);
    if (balance < input.credits) {
      throw new Error('Insufficient credits. Add more credits before starting this generation.');
    }

    const event = await addBillingEventWithClient(client, {
      userId: input.userId,
      jobId: input.jobId,
      eventType: 'generation_reserved',
      creditDelta: -input.credits,
      metadata: { pricingSnapshot: input.pricingSnapshot },
    });

    await client.query('update generation_jobs set settlement_state = $1, pricing_snapshot = $2::jsonb, updated_at = $3 where id = $4', [
      'reserved',
      JSON.stringify(input.pricingSnapshot),
      nowIso(),
      input.jobId,
    ]);

    await client.query('commit');
    return event;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function settleGenerationCredits(input: { userId: string; jobId: string; pricingSnapshot?: ProviderPricingSnapshot }) {
  const event = await recordWalletEvent({
    userId: input.userId,
    jobId: input.jobId,
    eventType: 'generation_settled',
    creditDelta: 0,
    metadata: input.pricingSnapshot ? { pricingSnapshot: input.pricingSnapshot } : undefined,
  });
  await updateGenerationJob(input.jobId, { settlementState: 'settled' });
  return event;
}

export async function refundGenerationCredits(input: { userId: string; jobId: string; credits: number; reason: string; pricingSnapshot?: ProviderPricingSnapshot }) {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new Error('Generation refunds must credit a positive integer number of credits.');
  }
  const event = await recordWalletEvent({
    userId: input.userId,
    jobId: input.jobId,
    eventType: 'generation_refunded',
    creditDelta: input.credits,
    metadata: { reason: input.reason, pricingSnapshot: input.pricingSnapshot },
  });
  await updateGenerationJob(input.jobId, { settlementState: 'refunded' });
  return event;
}

export async function getJobWithAssets(jobId: string) {
  const job = await getGenerationJob(jobId);
  const assets = job ? await getFileAssets(job.assetIds) : [];
  return { job, assets };
}

export async function getAllData(): Promise<Database> {
  await ensureDatabaseSchema();
  const [users, fileAssets, generationJobs, jobEvents, billingEvents] = await Promise.all([
    query('select * from users order by created_at asc', [], mapUser),
    query('select * from file_assets order by created_at asc', [], mapFileAsset),
    query('select * from generation_jobs order by created_at asc', [], mapGenerationJob),
    query('select * from job_events order by created_at asc', [], mapJobEvent),
    query('select * from billing_events order by created_at asc', [], mapBillingEvent),
  ]);

  return {
    users,
    fileAssets,
    generationJobs,
    jobEvents,
    billingEvents,
  };
}
