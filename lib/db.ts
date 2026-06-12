import { Pool } from 'pg';
import { getHyperdriveConnectionString } from '@/lib/cloudflare';
import { getRequiredEnv, getRuntimeEnvValue } from '@/lib/env';

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function requireDatabaseUrl() {
  // Let local `.env.local` override Wrangler's Hyperdrive local connection string.
  return process.env.DATABASE_URL || getHyperdriveConnectionString() || getRequiredEnv('DATABASE_URL', 'Missing DATABASE_URL. Configure PostgreSQL before using the app.');
}

function getDatabaseSchema() {
  const schema = getRuntimeEnvValue('DATABASE_SCHEMA');
  if (!schema) {
    return null;
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schema)) {
    throw new Error('DATABASE_SCHEMA must be a valid PostgreSQL identifier.');
  }
  return schema;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function createPool() {
  const connectionString = requireDatabaseUrl();
  const schema = getDatabaseSchema();
  return new Pool({
    connectionString,
    ssl: getRuntimeEnvValue('DATABASE_SSL') === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(getRuntimeEnvValue('DATABASE_POOL_MAX') || '10') || 10,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
    maxUses: 1,
    options: schema ? `-c search_path=${schema},public` : undefined,
  });
}

export function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

export async function closePoolForTests() {
  if (pool) {
    await pool.end();
    pool = null;
    schemaReady = null;
  }
}

export async function ensureDatabaseSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const activePool = getPool();
      const schema = getDatabaseSchema();
      if (schema) {
        const quotedSchema = quoteIdentifier(schema);
        await activePool.query(`create schema if not exists ${quotedSchema}`);
        await activePool.query(`set search_path to ${quotedSchema}, public`);
      }
      await activePool.query(`
        create table if not exists users (
          id text primary key,
          email text not null,
          name text not null,
          password_hash text,
          is_admin boolean not null default false,
          created_at timestamptz not null default now()
        );
        alter table users add column if not exists password_hash text;
        alter table users add column if not exists is_admin boolean not null default false;
        create unique index if not exists users_email_idx on users(lower(email));

        create table if not exists file_assets (
          id text primary key,
          user_id text not null references users(id) on delete cascade,
          storage_key text not null,
          original_filename text not null,
          mime_type text not null,
          size_bytes integer not null,
          sha256 text not null,
          role text not null,
          created_at timestamptz not null default now()
        );
        create index if not exists file_assets_user_id_idx on file_assets(user_id);

        create table if not exists generation_jobs (
          id text primary key,
          user_id text not null references users(id) on delete cascade,
          asset_ids text[] not null,
          mode text not null,
          status text not null,
          provider_id text,
          provider_task_id text,
          provider_options jsonb not null default '{}'::jsonb,
          pricing_snapshot jsonb,
          settlement_state text not null default 'unreserved',
          model text not null,
          resolution text not null,
          face_count text not null,
          pbr boolean not null,
          output_format text not null,
          hi3d_task_id text,
          result_asset_id text references file_assets(id) on delete set null,
          preview_asset_id text references file_assets(id) on delete set null,
          cover_asset_id text references file_assets(id) on delete set null,
          error_code text,
          error_message text,
          poll_attempts integer not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          completed_at timestamptz
        );
        alter table generation_jobs add column if not exists provider_id text;
        alter table generation_jobs add column if not exists provider_task_id text;
        alter table generation_jobs add column if not exists provider_options jsonb not null default '{}'::jsonb;
        alter table generation_jobs add column if not exists pricing_snapshot jsonb;
        alter table generation_jobs add column if not exists settlement_state text not null default 'unreserved';
        alter table generation_jobs add column if not exists preview_asset_id text references file_assets(id) on delete set null;
        alter table generation_jobs add column if not exists poll_attempts integer not null default 0;
        update generation_jobs
        set provider_id = coalesce(provider_id, 'hi3d'),
            provider_task_id = coalesce(provider_task_id, hi3d_task_id),
            provider_options = case
              when provider_options = '{}'::jsonb then jsonb_build_object('model', model, 'resolution', resolution, 'faceCount', face_count, 'pbr', pbr)
              else provider_options
            end,
            settlement_state = case when settlement_state = 'unreserved' then 'settled' else settlement_state end
        where provider_id is null or provider_task_id is null or provider_options = '{}'::jsonb;
        create index if not exists generation_jobs_user_id_idx on generation_jobs(user_id);
        create index if not exists generation_jobs_provider_task_id_idx on generation_jobs(provider_task_id);
        create index if not exists generation_jobs_hi3d_task_id_idx on generation_jobs(hi3d_task_id);
        create index if not exists generation_jobs_created_at_idx on generation_jobs(created_at desc);

        create table if not exists job_events (
          id text primary key,
          job_id text not null references generation_jobs(id) on delete cascade,
          event_type text not null,
          payload jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        );
        create index if not exists job_events_job_id_idx on job_events(job_id, created_at);

        create table if not exists billing_events (
          id text primary key,
          user_id text not null references users(id) on delete cascade,
          job_id text references generation_jobs(id) on delete cascade,
          event_type text not null,
          credit_delta integer not null,
          metadata jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default now()
        );
        alter table billing_events alter column job_id drop not null;
        alter table billing_events add column if not exists metadata jsonb not null default '{}'::jsonb;
        create index if not exists billing_events_user_id_idx on billing_events(user_id, created_at desc);
        create index if not exists billing_events_job_id_idx on billing_events(job_id) where job_id is not null;
        create unique index if not exists billing_events_generation_reserved_once_idx
          on billing_events(job_id, event_type)
          where job_id is not null and event_type = 'generation_reserved';
        create unique index if not exists billing_events_generation_settled_once_idx
          on billing_events(job_id, event_type)
          where job_id is not null and event_type = 'generation_settled';
        create unique index if not exists billing_events_generation_refunded_once_idx
          on billing_events(job_id, event_type)
          where job_id is not null and event_type = 'generation_refunded';
      `);
    })();
  }

  await schemaReady;
}
