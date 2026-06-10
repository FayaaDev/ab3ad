import type { ConnectionOptions } from 'bullmq';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getAppCloudflareContext } from '@/lib/cloudflare';
import { getRequiredEnv, getRuntimeEnvValue } from '@/lib/env';

export const generationQueueName = process.env.JOB_QUEUE_NAME ?? 'ab3ad-generation-jobs';

let queue: Queue | null = null;

type QueueMode = 'redis' | 'inline';

export function getQueueMode(): QueueMode {
  const mode = getRuntimeEnvValue('JOB_QUEUE_MODE') || 'redis';
  if (mode === 'redis' || mode === 'inline') {
    return mode;
  }
  throw new Error(`Unsupported JOB_QUEUE_MODE: ${mode}`);
}

function getRedisUrl() {
  return getRequiredEnv('REDIS_URL', 'Missing REDIS_URL. Configure Redis before using the job queue.');
}

export function getQueueConnection(): ConnectionOptions {
  const url = new URL(getRedisUrl());
  return {
    host: url.hostname,
    port: Number(url.port || '6379'),
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname ? Number(url.pathname.replace(/^\//, '') || '0') : 0,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function getGenerationQueue() {
  if (getQueueMode() === 'inline') {
    throw new Error('BullMQ is disabled while JOB_QUEUE_MODE=inline.');
  }

  if (!queue) {
    queue = new Queue(generationQueueName, {
      connection: getQueueConnection(),
      defaultJobOptions: {
        attempts: 5,
        removeOnComplete: 100,
        removeOnFail: 500,
        backoff: {
          type: 'exponential',
          delay: 5_000,
        },
      },
    });
  }
  return queue;
}

function toQueueJobId(value: string) {
  return value.replace(/:/g, '__');
}

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function processJobInline(jobId: string, delayMs = 0) {
  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const [{ getJobWithAssets }, { getNextPollDelay, processJob }] = await Promise.all([import('@/lib/store'), import('@/lib/job-runner')]);
  await processJob(jobId);

  if (process.env.HI3D_MODE !== 'mock') {
    return;
  }

  for (let attempt = 1; attempt < 8; attempt += 1) {
    const { job } = await getJobWithAssets(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed' || job.status === 'result_download_failed') {
      return;
    }
    await sleep(getNextPollDelay(job.pollAttempts ?? attempt));
    await processJob(jobId);
  }
}

export async function enqueueJobProcessing(jobId: string, options?: { delayMs?: number; dedupeKey?: string }) {
  if (getQueueMode() === 'inline') {
    const work = processJobInline(jobId, options?.delayMs ?? 0);
    const ctx = getAppCloudflareContext()?.ctx;
    if (ctx) {
      ctx.waitUntil(work);
      return { id: toQueueJobId(options?.dedupeKey ?? `inline:${jobId}`), mode: 'inline' };
    }
    await work;
    return { id: toQueueJobId(options?.dedupeKey ?? `inline:${jobId}`), mode: 'inline' };
  }

  const queue = getGenerationQueue();
  const queueJobId = toQueueJobId(options?.dedupeKey ?? `process:${jobId}`);
  const existing = await queue.getJob(queueJobId);
  if (existing) {
    return existing;
  }

  return queue.add(
    'process-generation-job',
    { jobId },
    {
      jobId: queueJobId,
      delay: options?.delayMs ?? 0,
    },
  );
}

export async function checkQueueReadiness() {
  if (getQueueMode() === 'inline') {
    return { mode: 'inline', queueName: generationQueueName };
  }

  const redis = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
    const counts = await getGenerationQueue().getJobCounts('waiting', 'active', 'delayed', 'failed');
    return { mode: 'redis', ...counts };
  } finally {
    redis.disconnect();
  }
}
