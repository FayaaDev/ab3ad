import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { addJobEvent, createGenerationJob, getGenerationJob } from '@/lib/store';
import { enqueueJobProcessing } from '@/lib/queue';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser();
  const { jobId } = await params;
  const job = await getGenerationJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }
  if (job.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  if (!['failed', 'result_download_failed'].includes(job.status)) {
    return NextResponse.json({ error: 'Only failed jobs can be retried.' }, { status: 400 });
  }

  const retryJob = await createGenerationJob({
    userId: job.userId,
    assetIds: job.assetIds,
    mode: job.mode,
    status: 'queued',
    model: job.model,
    resolution: job.resolution,
    faceCount: job.faceCount,
    pbr: job.pbr,
    outputFormat: job.outputFormat,
  });

  await addJobEvent({ jobId: retryJob.id, eventType: 'job_retried', payload: { retriedFrom: job.id } });
  await enqueueJobProcessing(retryJob.id);

  return NextResponse.json({ jobId: retryJob.id, status: retryJob.status });
}
