import type { ConnectionOptions } from 'bullmq';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { getRequiredEnv } from '@/lib/env';

export const generationQueueName = process.env.JOB_QUEUE_NAME ?? 'ab3ad-generation-jobs';

let queue: Queue | null = null;

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

export async function enqueueJobProcessing(jobId: string, options?: { delayMs?: number; dedupeKey?: string }) {
  const queue = getGenerationQueue();
  const queueJobId = options?.dedupeKey ?? `process:${jobId}`;
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
  const redis = new IORedis(getRedisUrl(), {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
    const counts = await getGenerationQueue().getJobCounts('waiting', 'active', 'delayed', 'failed');
    return counts;
  } finally {
    redis.disconnect();
  }
}
