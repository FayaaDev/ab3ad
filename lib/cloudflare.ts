import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Hyperdrive, R2Bucket } from '@cloudflare/workers-types/experimental';

type AppCloudflareEnv = CloudflareEnv & {
  APP_STORAGE?: R2Bucket;
  HYPERDRIVE?: Hyperdrive;
};

export function getAppCloudflareContext() {
  try {
    const context = getCloudflareContext();
    return { ...context, env: context.env as AppCloudflareEnv };
  } catch {
    return null;
  }
}

export function getCloudflareEnv(): AppCloudflareEnv | null {
  return getAppCloudflareContext()?.env ?? null;
}

export function getR2BucketBinding() {
  return getCloudflareEnv()?.APP_STORAGE ?? null;
}

export function getHyperdriveConnectionString() {
  return getCloudflareEnv()?.HYPERDRIVE?.connectionString;
}
