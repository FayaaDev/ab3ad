import { getCloudflareEnv } from '@/lib/cloudflare';

const localDefaults = {
  AUTH_SECRET: 'dev-only-auth-secret',
  DATABASE_URL: 'postgres://ab3ad:ab3ad@127.0.0.1:5432/ab3ad',
  REDIS_URL: 'redis://127.0.0.1:6379',
} as const;

function canUseLocalDefaults() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

export function getRuntimeEnvValue(name: string) {
  return process.env[name] || String(getCloudflareEnv()?.[name as keyof CloudflareEnv] ?? '');
}

export function getRequiredEnv(name: keyof typeof localDefaults | string, errorMessage: string) {
  const value = getRuntimeEnvValue(name);
  if (value) {
    return value;
  }

  if (canUseLocalDefaults() && name in localDefaults) {
    return localDefaults[name as keyof typeof localDefaults];
  }

  throw new Error(errorMessage);
}
