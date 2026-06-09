import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { kickoffJobProcessing } from '@/lib/job-runner';
import { getFileAsset, getGenerationJob, listJobEvents } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser();
  const { jobId } = await params;
  const job = await getGenerationJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
  }
  if (job.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  if (['queued', 'submitted_to_hi3d', 'hi3d_created', 'hi3d_queueing', 'hi3d_processing'].includes(job.status)) {
    kickoffJobProcessing(job.id);
  }

  const resultAsset = job.resultAssetId ? await getFileAsset(job.resultAssetId) : null;
  const coverAsset = job.coverAssetId ? await getFileAsset(job.coverAssetId) : null;
  const events = await listJobEvents(job.id);

  return NextResponse.json({
    job,
    resultUrl: resultAsset ? `/api/generations/${job.id}/download` : null,
    coverUrl: coverAsset ? `/api/assets/${coverAsset.id}` : null,
    events,
  });
}
