import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { retryFailedJob } from '@/lib/job-runner';
import { getGenerationJob } from '@/lib/store';

export const runtime = 'nodejs';

export async function POST(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await requireCurrentUser();
    const { jobId } = await params;
    const job = await getGenerationJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    if (job.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const retryJob = await retryFailedJob(job.id);

    return NextResponse.json({
      jobId: retryJob.id,
      status: retryJob.status,
      resultUrl: retryJob.resultAssetId ? `/api/generations/${retryJob.id}/download` : null,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Retry failed.' }, { status });
  }
}
