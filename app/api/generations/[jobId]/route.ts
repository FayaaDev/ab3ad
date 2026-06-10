import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { enqueueJobProcessing, getQueueMode } from '@/lib/queue';
import { getFileAsset, getGenerationJob, listJobEvents } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
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

  if (getQueueMode() !== 'inline' && ['queued', 'submitted_to_hi3d', 'hi3d_created', 'hi3d_queueing', 'hi3d_processing'].includes(job.status)) {
    await enqueueJobProcessing(job.id);
  }

  const resultAsset = job.resultAssetId ? await getFileAsset(job.resultAssetId) : null;
  const previewAsset = job.previewAssetId ? await getFileAsset(job.previewAssetId) : null;
  const coverAsset = job.coverAssetId ? await getFileAsset(job.coverAssetId) : null;
  const events = await listJobEvents(job.id);

    return NextResponse.json({
      job,
      resultUrl: resultAsset ? `/api/generations/${job.id}/download` : null,
      previewUrl: previewAsset ? `/api/assets/${previewAsset.id}` : null,
      coverUrl: coverAsset ? `/api/assets/${coverAsset.id}` : null,
      events,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load job.' }, { status });
  }
}
