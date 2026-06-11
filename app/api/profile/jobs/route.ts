import { NextResponse } from 'next/server';

import { AuthError, requireCurrentUser } from '@/lib/auth';
import { scheduleActiveJobRefresh } from '@/lib/job-runner';
import { getFileAssets, listGenerationJobsForUser } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const jobs = await listGenerationJobsForUser(user.id, 12);
    await Promise.all(jobs.map((job) => scheduleActiveJobRefresh(job)));
    const currentJobs = await listGenerationJobsForUser(user.id, 12);

    const jobsWithAssets = await Promise.all(
      currentJobs.map(async (job) => {
        const assets = await getFileAssets(job.assetIds);
        const sourceAsset = assets[0] ?? null;

        return {
          id: job.id,
          status: job.status,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          completedAt: job.completedAt ?? null,
          errorMessage: job.errorMessage ?? null,
          jobName: sourceAsset?.originalFilename ?? job.id,
          sourceImageUrl: sourceAsset ? `/api/assets/${sourceAsset.id}` : null,
          resultUrl: job.resultAssetId ? `/api/generations/${job.id}/download` : null,
        };
      }),
    );

    return NextResponse.json({ jobs: jobsWithAssets });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load profile jobs.' }, { status });
  }
}
