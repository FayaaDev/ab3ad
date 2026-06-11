import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { scheduleActiveJobRefresh } from '@/lib/job-runner';
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

    await scheduleActiveJobRefresh(job);

    const currentJob = (await getGenerationJob(job.id)) ?? job;

    const resultAsset = currentJob.resultAssetId ? await getFileAsset(currentJob.resultAssetId) : null;
    const previewAsset = currentJob.previewAssetId ? await getFileAsset(currentJob.previewAssetId) : null;
    const coverAsset = currentJob.coverAssetId ? await getFileAsset(currentJob.coverAssetId) : null;
    const events = await listJobEvents(currentJob.id);

    return NextResponse.json({
      job: currentJob,
      resultUrl: resultAsset ? `/api/generations/${currentJob.id}/download` : null,
      previewUrl: previewAsset ? `/api/assets/${previewAsset.id}` : null,
      coverUrl: coverAsset ? `/api/assets/${coverAsset.id}` : null,
      events,
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load job.' }, { status });
  }
}
