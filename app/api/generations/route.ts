import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { addJobEvent, createGenerationJob, getFileAssets } from '@/lib/store';
import { enqueueJobProcessing } from '@/lib/queue';
import { generationSchema, qualityToResolution, validateAssetsForMode } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const payload = generationSchema.parse(await request.json());
    const assets = await getFileAssets(payload.assetIds);

    if (assets.length !== payload.assetIds.length) {
      return NextResponse.json({ error: 'One or more assets were not found.' }, { status: 404 });
    }
    if (assets.some((asset) => asset.userId !== user.id)) {
      return NextResponse.json({ error: 'Asset ownership mismatch.' }, { status: 403 });
    }

    validateAssetsForMode(payload.mode, assets);

    const job = await createGenerationJob({
      userId: user.id,
      assetIds: payload.assetIds,
      mode: payload.mode,
      status: 'queued',
      model: payload.model,
      resolution: qualityToResolution(payload.quality),
      faceCount: payload.mode === 'single_image' ? 'standard' : 'high',
      pbr: payload.pbr,
      outputFormat: payload.outputFormat,
    });

    await addJobEvent({ jobId: job.id, eventType: 'job_queued', payload });
    await enqueueJobProcessing(job.id);

    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create generation job.' }, { status });
  }
}
