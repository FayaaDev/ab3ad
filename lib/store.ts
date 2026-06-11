import { v4 as uuid } from 'uuid';
import { ensureDatabaseSchema, getPool } from '@/lib/db';
import type { BillingEvent, Database, FileAsset, GenerationJob, JobEvent, User, WalletEventType, WalletSummary } from '@/lib/types';
import { nowIso } from '@/lib/utils';

type RowRecord = Record<string, unknown>;

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.map((item) => String(item));
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
  return {
    id: String(row.id),
    userId: String(row.user_id),
    assetIds: asStringArray(row.asset_ids),
    mode: row.mode as GenerationJob['mode'],
    status: row.status as GenerationJob['status'],
    model: String(row.model),
    resolution: String(row.resolution),
    faceCount: String(row.face_count),
    pbr: Boolean(row.pbr),
    outputFormat: row.output_format as GenerationJob['outputFormat'],
    hi3dTaskId: row.hi3d_task_id ? String(row.hi3d_task_id) : undefined,
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

export async function createGenerationJob(job: Omit<GenerationJob, 'id' | 'createdAt' | 'updatedAt'>) {
  await ensureDatabaseSchema();
  const created: GenerationJob = {
    ...job,
    id: uuid(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const result = await getPool().query(
    `
      insert into generation_jobs (
        id, user_id, asset_ids, mode, status, model, resolution, face_count, pbr, output_format,
        hi3d_task_id, result_asset_id, preview_asset_id, cover_asset_id, error_code, error_message, poll_attempts, created_at, updated_at, completed_at
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
      )
      returning *
    `,
    [
      created.id,
      created.userId,
      created.assetIds,
      created.mode,
      created.status,
      created.model,
      created.resolution,
      created.faceCount,
      created.pbr,
      created.outputFormat,
      created.hi3dTaskId ?? null,
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
  const fields: Array<[keyof GenerationJob, string]> = [
    ['assetIds', 'asset_ids'],
    ['mode', 'mode'],
    ['status', 'status'],
    ['model', 'model'],
    ['resolution', 'resolution'],
    ['faceCount', 'face_count'],
    ['pbr', 'pbr'],
    ['outputFormat', 'output_format'],
    ['hi3dTaskId', 'hi3d_task_id'],
    ['resultAssetId', 'result_asset_id'],
    ['previewAssetId', 'preview_asset_id'],
    ['coverAssetId', 'cover_asset_id'],
    ['errorCode', 'error_code'],
    ['errorMessage', 'error_message'],
    ['pollAttempts', 'poll_attempts'],
    ['completedAt', 'completed_at'],
  ];

  for (const [key, column] of fields) {
    if (key in patch) {
      values.push(patch[key] ?? null);
      updates.push(`${column} = $${values.length}`);
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

export async function getGenerationJob(jobId: string) {
  return queryOne('select * from generation_jobs where id = $1 limit 1', [jobId], mapGenerationJob);
}

export async function findGenerationJobByTaskId(taskId: string) {
  return queryOne('select * from generation_jobs where hi3d_task_id = $1 order by created_at desc limit 1', [taskId], mapGenerationJob);
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
  const created: BillingEvent = {
    ...event,
    id: uuid(),
    createdAt: nowIso(),
  };
  const result = await getPool().query(
    'insert into billing_events (id, user_id, job_id, event_type, credit_delta, created_at) values ($1, $2, $3, $4, $5, $6) returning *',
    [created.id, created.userId, created.jobId ?? null, created.eventType, created.creditDelta, created.createdAt],
  );
  return mapBillingEvent(result.rows[0] as RowRecord);
}

export async function recordWalletEvent(event: { userId: string; eventType: WalletEventType; creditDelta: number; jobId?: string }) {
  if (!Number.isInteger(event.creditDelta) || event.creditDelta === 0) {
    throw new Error('Wallet credit delta must be a non-zero integer.');
  }
  if (event.creditDelta > 0 && event.jobId) {
    throw new Error('Positive wallet deposits must not be attached to a generation job.');
  }
  if (event.eventType === 'generation_completed' && (!event.jobId || event.creditDelta !== -1)) {
    throw new Error('Successful generation debits must include a job id and charge exactly one credit.');
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
