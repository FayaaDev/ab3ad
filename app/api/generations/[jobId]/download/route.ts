import path from 'node:path';
import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { getDownloadAssetForJob } from '@/lib/job-runner';
import { getGenerationJob } from '@/lib/store';
import { readStorageObject } from '@/lib/storage';

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

  const asset = await getDownloadAssetForJob(jobId);
  if (!asset) {
    return NextResponse.json({ error: 'Result not available.' }, { status: 404 });
  }

    const buffer = await readStorageObject(asset.storageKey);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': asset.mimeType || 'application/octet-stream',
        'content-disposition': `attachment; filename="${path.basename(asset.originalFilename)}"`,
      },
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Download failed.' }, { status });
  }
}
