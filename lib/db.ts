import { Pool } from 'pg';
import { getRequiredEnv } from '@/lib/env';

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function requireDatabaseUrl() {
  return getRequiredEnv('DATABASE_URL', 'Missing DATABASE_URL. Configure PostgreSQL before using the app.');
}

function createPool() {
  const connectionString = requireDatabaseUrl();
  return new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DATABASE_POOL_MAX ?? '10') || 10,
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
          model text not null,
          resolution text not null,
          face_count text not null,
          pbr boolean not null,
          output_format text not null,
          hi3d_task_id text,
          result_asset_id text references file_assets(id) on delete set null,
          cover_asset_id text references file_assets(id) on delete set null,
          error_code text,
          error_message text,
          poll_attempts integer not null default 0,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          completed_at timestamptz
        );
        alter table generation_jobs add column if not exists poll_attempts integer not null default 0;
        create index if not exists generation_jobs_user_id_idx on generation_jobs(user_id);
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
          created_at timestamptz not null default now()
        );
        alter table billing_events alter column job_id drop not null;
        create index if not exists billing_events_user_id_idx on billing_events(user_id, created_at desc);
        create index if not exists billing_events_job_id_idx on billing_events(job_id) where job_id is not null;
        create unique index if not exists billing_events_generation_completed_once_idx
          on billing_events(job_id, event_type)
          where job_id is not null and event_type = 'generation_completed';
      `);
    })();
  }

  await schemaReady;
}
