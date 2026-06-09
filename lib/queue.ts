import type { ConnectionOptions } from 'bullmq';
import { Queue } from 'bullmq';

export const generationQueueName = process.env.JOB_QUEUE_NAME ?? 'ab3ad-generation-jobs';

let queue: Queue | null = null;

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('Missing REDIS_URL. Configure Redis before using the job queue.');
  }
  return redisUrl;
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

export async function enqueueJobProcessing(jobId: string) {
  const queue = getGenerationQueue();
  const queueJobId = `process:${jobId}`;
  const existing = await queue.getJob(queueJobId);
  if (existing) {
    return existing;
  }

  return queue.add(
    'process-generation-job',
    { jobId },
    {
      jobId: queueJobId,
    },
  );
}
