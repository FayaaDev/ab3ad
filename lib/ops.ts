import { ensureDatabaseSchema, getPool } from '@/lib/db';
import { checkQueueReadiness } from '@/lib/queue';
import { checkStorageReadiness } from '@/lib/storage';

function checkHi3DConfig() {
  const mode = process.env.HI3D_MODE ?? 'mock';
  if (mode === 'mock') {
    return { mode };
  }

  const required = ['HI3D_BASE_URL', 'HI3D_CLIENT_ID', 'HI3D_CLIENT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing Hi3D configuration: ${missing.join(', ')}`);
  }

  return {
    mode,
    callbackUrl: process.env.HI3D_CALLBACK_URL ?? null,
    callbackSigned: Boolean(process.env.HI3D_CALLBACK_SECRET),
  };
}

export async function checkReadiness() {
  await ensureDatabaseSchema();
  await getPool().query('select 1');

  const [queue, storage] = await Promise.all([checkQueueReadiness(), checkStorageReadiness()]);

  return {
    ok: true,
    database: 'ok',
    queue,
    storage,
    hi3d: checkHi3DConfig(),
  };
}
