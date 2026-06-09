import { Worker } from 'bullmq';
import { processJob } from '@/lib/job-runner';
import { generationQueueName, getQueueConnection } from '@/lib/queue';

export function startJobWorker() {
  const worker = new Worker(
    generationQueueName,
    async (job) => {
      const jobId = String(job.data?.jobId ?? '');
      if (!jobId) {
        throw new Error('Queue job is missing jobId.');
      }
      await processJob(jobId);
    },
    {
      connection: getQueueConnection(),
      concurrency: Number(process.env.JOB_WORKER_CONCURRENCY ?? '4') || 4,
    },
  );

  worker.on('failed', (job, error) => {
    console.error('Generation worker job failed', { queueJobId: job?.id, jobId: job?.data?.jobId, error });
  });

  worker.on('error', (error) => {
    console.error('Generation worker error', error);
  });

  return worker;
}
