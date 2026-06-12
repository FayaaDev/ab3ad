import { NextResponse } from 'next/server';
import { AuthError, requireCurrentUser } from '@/lib/auth';
import { createPricingSnapshot, validateProviderSelection } from '@/lib/providers';
import { addJobEvent, createGenerationJob, deleteGenerationJob, getFileAssets, reserveGenerationCredits } from '@/lib/store';
import { enqueueJobProcessing } from '@/lib/queue';
import { buildProviderOptions, generationSchema, qualityToResolution, validateAssetsForMode, DEFAULT_SINGLE_IMAGE_FACE_COUNT } from '@/lib/validation';
import { assertCanStartGeneration, isInsufficientCreditsError } from '@/lib/wallet';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let jobId: string | null = null;

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
    validateProviderSelection(payload);

    const pricingSnapshot = createPricingSnapshot({
      providerId: payload.providerId,
      mode: payload.mode,
      quality: payload.quality,
      outputFormat: payload.outputFormat,
    });
    await assertCanStartGeneration(user.id, pricingSnapshot.credits);

    const providerOptions = buildProviderOptions({
      providerId: payload.providerId,
      mode: payload.mode,
      model: payload.model,
      quality: payload.quality,
      pbr: payload.pbr,
    });

    const job = await createGenerationJob({
      userId: user.id,
      assetIds: payload.assetIds,
      mode: payload.mode,
      status: 'queued',
      providerId: payload.providerId,
      providerOptions,
      pricingSnapshot,
      settlementState: 'unreserved',
      model: payload.model,
      resolution: qualityToResolution(payload.quality),
      faceCount: payload.mode === 'single_image' ? DEFAULT_SINGLE_IMAGE_FACE_COUNT : 'high',
      pbr: payload.pbr,
      outputFormat: payload.outputFormat,
    });
    jobId = job.id;

    await reserveGenerationCredits({ userId: user.id, jobId: job.id, credits: pricingSnapshot.credits, pricingSnapshot });
    await addJobEvent({ jobId: job.id, eventType: 'job_queued', payload: { ...payload, pricingSnapshot } });
    await enqueueJobProcessing(job.id);

    return NextResponse.json({ jobId: job.id, status: job.status, pricingSnapshot });
  } catch (error) {
    if (jobId) {
      await deleteGenerationJob(jobId).catch(() => undefined);
    }
    const status = error instanceof AuthError ? error.status : isInsufficientCreditsError(error) ? 402 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not create generation job.' }, { status });
  }
}
