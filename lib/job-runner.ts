import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { getHi3DResult } from '@/lib/hi3d-contract';
import { getMockHi3DDurationMs } from '@/lib/hi3d-client';
import { getAppCloudflareContext } from '@/lib/cloudflare';
import { getPool } from '@/lib/db';
import { getOutputFormatExtension, getOutputFormatMimeType, getProviderAdapter, normalizeProviderErrorMessage } from '@/lib/providers';
import {
  addJobEvent,
  createGenerationJob,
  createFileAsset,
  deleteGenerationJob,
  findGenerationJobByTaskId,
  getFileAsset,
  getGenerationJob,
  getJobWithAssets,
  refundGenerationCredits,
  reserveGenerationCredits,
  settleGenerationCredits,
  updateGenerationJob,
} from '@/lib/store';
import { enqueueJobProcessing, getQueueMode } from '@/lib/queue';
import { generatePreviewGlb, getPreviewFilename, getPreviewStorageKey, summarizePreview } from '@/lib/preview-glb';
import { fetchToStorage, saveStorageObject } from '@/lib/storage';
import type { FileAsset, GenerationJob } from '@/lib/types';
import { isActiveGenerationStatus, nowIso } from '@/lib/utils';

const realPollSchedule = [10_000, 20_000, 30_000, 60_000, 120_000, 120_000, 120_000, 120_000];

function getMockPollSchedule() {
  const intervalMs = Math.max(250, Math.ceil(getMockHi3DDurationMs() / 6 / 250) * 250);
  return Array.from({ length: 8 }, () => intervalMs);
}

export function getNextPollDelay(pollAttempts = 0) {
  const schedule = process.env.HI3D_MODE === 'mock' ? getMockPollSchedule() : realPollSchedule;
  return schedule[Math.min(pollAttempts, schedule.length - 1)];
}

function getMaxPollAttempts() {
  const schedule = process.env.HI3D_MODE === 'mock' ? getMockPollSchedule() : realPollSchedule;
  return Number(process.env.PROVIDER_MAX_POLL_ATTEMPTS ?? process.env.HI3D_MAX_POLL_ATTEMPTS ?? String(schedule.length + 2)) || schedule.length + 2;
}

function getQueryRefreshMinAgeMs() {
  return Number(process.env.PROVIDER_QUERY_REFRESH_MIN_AGE_MS ?? process.env.HI3D_QUERY_REFRESH_MIN_AGE_MS ?? '15000') || 15_000;
}

export function shouldRefreshActiveJob(job: { status: string; updatedAt: string; providerTaskId?: string; resultAssetId?: string }) {
  if (job.resultAssetId || !isActiveGenerationStatus(job.status)) {
    return false;
  }
  if (job.status !== 'queued' && !job.providerTaskId) {
    return false;
  }

  const updatedAtMs = Date.parse(job.updatedAt);
  return Number.isNaN(updatedAtMs) || Date.now() - updatedAtMs >= getQueryRefreshMinAgeMs();
}

async function addRefreshFailureEvent(jobId: string, error: unknown) {
  const errorMessage = normalizeProviderErrorMessage(error);
  await addJobEvent({ jobId, eventType: 'provider_refresh_failed', payload: { errorMessage } });
}

async function withJobLock<T>(jobId: string, work: () => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [jobId]);
    const result = await work();
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function getProviderStatus(queryState: 'submitted' | 'processing' | 'succeeded' | 'failed'): GenerationJob['status'] {
  switch (queryState) {
    case 'submitted':
      return 'submitted';
    case 'processing':
      return 'processing';
    case 'succeeded':
      return 'downloading_result';
    case 'failed':
      return 'failed';
  }
}

async function refundReservedJob(job: GenerationJob, reason: string) {
  if (job.settlementState !== 'reserved' || !job.pricingSnapshot) {
    return;
  }
  await refundGenerationCredits({
    userId: job.userId,
    jobId: job.id,
    credits: job.pricingSnapshot.credits,
    reason,
    pricingSnapshot: job.pricingSnapshot,
  });
  await addJobEvent({ jobId: job.id, eventType: 'generation_refunded', payload: { reason, credits: job.pricingSnapshot.credits } });
}

async function scheduleNextPoll(jobId: string, pollAttempts: number) {
  if (pollAttempts >= getMaxPollAttempts()) {
    const job = await updateGenerationJob(jobId, {
      status: 'failed',
      errorCode: 'provider_poll_timeout',
      errorMessage: 'The provider did not finish before the polling timeout window ended.',
      pollAttempts,
    });
    await refundReservedJob(job, 'provider_poll_timeout');
    await addJobEvent({ jobId, eventType: 'job_failed', payload: { errorCode: 'provider_poll_timeout', errorMessage: 'Polling timeout reached.' } });
    return;
  }

  const delayMs = getNextPollDelay(pollAttempts);
  await addJobEvent({ jobId, eventType: 'poll_rescheduled', payload: { delayMs, pollAttempts } });
  if (getQueueMode() === 'inline') {
    return;
  }
  await enqueueJobProcessing(jobId, { delayMs, dedupeKey: `poll:${jobId}:${pollAttempts}` });
}

async function queryAndHandleJob(jobId: string) {
  const latest = await getJobWithAssets(jobId);
  if (!latest.job?.providerTaskId || latest.job.status === 'completed' || latest.job.resultAssetId) {
    return;
  }

  const provider = getProviderAdapter(latest.job.providerId);
  const query = await provider.query(latest.job);
  const nextPollAttempts = (latest.job.pollAttempts ?? 0) + 1;
  const updatedJob = await updateGenerationJob(jobId, {
    status: getProviderStatus(query.state),
    errorCode: query.errorCode,
    errorMessage: query.errorMessage,
    pollAttempts: nextPollAttempts,
  });
  await addJobEvent({ jobId, eventType: `provider_${query.state}`, payload: query.raw });

  if (query.state === 'succeeded' && query.result) {
    await downloadResult(updatedJob, query.result.modelUrl, query.result.coverUrl);
    return;
  }

  if (query.state === 'failed') {
    await refundReservedJob(updatedJob, query.errorCode ?? 'provider_failed');
    await addJobEvent({ jobId, eventType: 'job_failed', payload: { errorCode: query.errorCode, errorMessage: query.errorMessage } });
    return;
  }

  await scheduleNextPoll(jobId, nextPollAttempts);
}

export async function processJob(jobId: string) {
  const { job, assets } = await getJobWithAssets(jobId);
  if (!job || job.status === 'completed' || job.resultAssetId) {
    return;
  }

  const provider = getProviderAdapter(job.providerId);

  try {
    if (job.status === 'queued') {
      await updateGenerationJob(jobId, { status: 'submitting', errorCode: undefined, errorMessage: undefined });
      await addJobEvent({ jobId, eventType: 'submit_started', payload: { providerId: job.providerId } });
      const submission = await provider.submit(job, assets);
      await updateGenerationJob(jobId, {
        status: 'submitted',
        providerTaskId: submission.taskId,
        errorCode: undefined,
        errorMessage: undefined,
        pollAttempts: 0,
      });
      await addJobEvent({ jobId, eventType: 'provider_submitted', payload: submission.raw });
    }

    await queryAndHandleJob(jobId);
  } catch (error) {
    const errorMessage = normalizeProviderErrorMessage(error);
    const failedJob = await updateGenerationJob(jobId, {
      status: 'failed',
      errorCode: 'provider_request_failed',
      errorMessage,
    });
    await refundReservedJob(failedJob, 'provider_request_failed');
    await addJobEvent({ jobId, eventType: 'job_failed', payload: { errorCode: 'provider_request_failed', errorMessage } });
    throw error;
  }
}

export async function refreshActiveJob(jobId: string) {
  const { job } = await getJobWithAssets(jobId);
  if (!job || job.status === 'completed' || job.resultAssetId || !isActiveGenerationStatus(job.status)) {
    return;
  }

  try {
    if (job.status === 'queued') {
      await processJob(jobId);
      return;
    }

    if (!job.providerTaskId) {
      return;
    }

    await queryAndHandleJob(jobId);
  } catch (error) {
    await addRefreshFailureEvent(jobId, error).catch(() => undefined);
  }
}

export async function scheduleActiveJobRefresh(job: { id: string; status: string; updatedAt: string; providerTaskId?: string; resultAssetId?: string }) {
  if (!shouldRefreshActiveJob(job)) {
    return false;
  }

  const work = refreshActiveJob(job.id);
  const ctx = getAppCloudflareContext()?.ctx;
  if (ctx) {
    ctx.waitUntil(work);
    return true;
  }

  await work;
  return true;
}

export async function retryFailedJob(jobId: string) {
  const job = await getGenerationJob(jobId);
  if (!job) {
    throw new Error('Job not found.');
  }
  if (!['failed', 'result_download_failed'].includes(job.status)) {
    throw new Error('Only failed jobs can be retried.');
  }

  if (job.providerTaskId && !job.resultAssetId) {
    try {
      const provider = getProviderAdapter(job.providerId);
      const query = await provider.query(job);
      const nextPollAttempts = (job.pollAttempts ?? 0) + 1;
      const updatedJob = await updateGenerationJob(jobId, {
        status: getProviderStatus(query.state),
        errorCode: query.errorCode,
        errorMessage: query.errorMessage,
        pollAttempts: nextPollAttempts,
      });
      await addJobEvent({ jobId, eventType: `provider_${query.state}`, payload: query.raw });

      if (query.state === 'succeeded' && query.result) {
        await addJobEvent({ jobId, eventType: 'job_retried', payload: { mode: 'recover_result' } });
        await downloadResult(updatedJob, query.result.modelUrl, query.result.coverUrl, false);
        return (await getGenerationJob(jobId)) ?? updatedJob;
      }

      if (query.state !== 'failed') {
        await addJobEvent({ jobId, eventType: 'job_retried', payload: { mode: 'resume_polling' } });
        await scheduleNextPoll(jobId, nextPollAttempts);
        return updatedJob;
      }
    } catch (error) {
      await addRefreshFailureEvent(jobId, error).catch(() => undefined);
    }
  }

  const retryJob = await createGenerationJob({
    userId: job.userId,
    assetIds: job.assetIds,
    mode: job.mode,
    status: 'queued',
    providerId: job.providerId,
    providerOptions: job.providerOptions,
    pricingSnapshot: job.pricingSnapshot,
    settlementState: 'unreserved',
    model: job.model,
    resolution: job.resolution,
    faceCount: job.faceCount,
    pbr: job.pbr,
    outputFormat: job.outputFormat,
  });

  try {
    if (retryJob.pricingSnapshot) {
      await reserveGenerationCredits({
        userId: retryJob.userId,
        jobId: retryJob.id,
        credits: retryJob.pricingSnapshot.credits,
        pricingSnapshot: retryJob.pricingSnapshot,
      });
    }
  } catch (error) {
    await deleteGenerationJob(retryJob.id).catch(() => undefined);
    throw error;
  }

  await addJobEvent({ jobId: retryJob.id, eventType: 'job_retried', payload: { retriedFrom: job.id } });
  await enqueueJobProcessing(retryJob.id);
  return retryJob;
}

function shouldGeneratePreviewGlb() {
  if (process.env.PREVIEW_GLB_GENERATION === 'enabled') {
    return true;
  }
  if (process.env.PREVIEW_GLB_GENERATION === 'disabled') {
    return false;
  }
  return !getAppCloudflareContext();
}

async function createPreviewAssetForResult(jobId: string, userId: string, modelAsset: FileAsset, modelBuffer: Buffer) {
  if (!shouldGeneratePreviewGlb()) {
    await addJobEvent({ jobId, eventType: 'preview_skipped', payload: { reason: process.env.PREVIEW_GLB_GENERATION === 'disabled' ? 'disabled' : 'cloudflare_worker' } });
    return null;
  }

  try {
    const previewBuffer = await generatePreviewGlb(modelBuffer);
    const previewStorageKey = getPreviewStorageKey(modelAsset.storageKey);
    await saveStorageObject(previewStorageKey, previewBuffer, 'model/gltf-binary');

    const previewAsset = await createFileAsset({
      userId,
      storageKey: previewStorageKey,
      originalFilename: getPreviewFilename(modelAsset.originalFilename),
      mimeType: 'model/gltf-binary',
      sizeBytes: previewBuffer.byteLength,
      sha256: `preview-${modelAsset.sha256}`,
      role: modelAsset.role,
    });

    await addJobEvent({
      jobId,
      eventType: 'preview_generated',
      payload: {
        previewAssetId: previewAsset.id,
        storageKey: previewStorageKey,
        ...summarizePreview(modelBuffer.byteLength, previewBuffer.byteLength),
      },
    });
    return previewAsset;
  } catch (error) {
    await addJobEvent({
      jobId,
      eventType: 'preview_generation_failed',
      payload: { message: error instanceof Error ? error.message : 'Unknown preview generation error' },
    });
    return null;
  }
}

async function downloadResult(job: GenerationJob, modelUrl: string, coverUrl?: string, settleWallet = true) {
  await withJobLock(job.id, async () => {
    const latest = await getJobWithAssets(job.id);
    if (!latest.job) {
      throw new Error('Job not found during result download');
    }
    if (latest.job.status === 'completed' || latest.job.resultAssetId) {
      return;
    }

    const provider = getProviderAdapter(latest.job.providerId);
    provider.assertResultUrl?.(modelUrl);
    if (coverUrl) {
      provider.assertResultUrl?.(coverUrl);
    }

    await updateGenerationJob(job.id, { status: 'downloading_result' });
    await addJobEvent({ jobId: job.id, eventType: 'download_started', payload: { modelUrl, coverUrl, providerId: latest.job.providerId } });

    try {
      const outputExtension = getOutputFormatExtension(latest.job.outputFormat);
      const outputMimeType = getOutputFormatMimeType(latest.job.outputFormat);
      const modelStorageKey = path.join('results', latest.job.userId, `${job.id}-${uuid()}${outputExtension}`);
      let modelBuffer: Buffer;
      if (modelUrl.startsWith('data:')) {
        const [, data] = modelUrl.split(',', 2);
        modelBuffer = Buffer.from(data, 'base64');
        await saveStorageObject(modelStorageKey, modelBuffer, outputMimeType);
      } else {
        modelBuffer = await fetchToStorage(modelStorageKey, modelUrl, outputMimeType);
      }

      const modelAsset = await createFileAsset({
        userId: latest.job.userId,
        storageKey: modelStorageKey,
        originalFilename: `${job.id}${outputExtension}`,
        mimeType: outputMimeType,
        sizeBytes: modelBuffer.byteLength,
        sha256: `generated-${job.id}`,
        role: 'single',
      });

      const previewAsset = latest.job.outputFormat === 'glb'
        ? await createPreviewAssetForResult(job.id, latest.job.userId, modelAsset, modelBuffer)
        : null;

      let coverAssetId: string | undefined;
      if (coverUrl) {
        const coverStorageKey = path.join('results', latest.job.userId, `${job.id}-${uuid()}.png`);
        const coverBuffer = await fetchToStorage(coverStorageKey, coverUrl, 'image/png');
        const coverAsset = await createFileAsset({
          userId: latest.job.userId,
          storageKey: coverStorageKey,
          originalFilename: `${job.id}.png`,
          mimeType: 'image/png',
          sizeBytes: coverBuffer.byteLength,
          sha256: `cover-${job.id}`,
          role: 'single',
        });
        coverAssetId = coverAsset.id;
      }

      await updateGenerationJob(job.id, {
        status: 'completed',
        resultAssetId: modelAsset.id,
        previewAssetId: previewAsset?.id,
        coverAssetId,
        completedAt: nowIso(),
        errorCode: undefined,
        errorMessage: undefined,
      });
      if (settleWallet && latest.job.settlementState === 'reserved') {
        await settleGenerationCredits({ jobId: job.id, userId: latest.job.userId, pricingSnapshot: latest.job.pricingSnapshot });
      }
      await addJobEvent({ jobId: job.id, eventType: 'job_completed', payload: { resultAssetId: modelAsset.id, previewAssetId: previewAsset?.id, coverAssetId } });
    } catch (error) {
      await updateGenerationJob(job.id, {
        status: 'result_download_failed',
        errorCode: 'result_download_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown download error',
      });
      await addJobEvent({ jobId: job.id, eventType: 'download_failed', payload: { message: error instanceof Error ? error.message : 'Unknown error' } });
      throw error;
    }
  });
}

export async function handleHi3DCallback(taskId: string, status: 'created' | 'queueing' | 'processing' | 'success' | 'failed', payload: Record<string, unknown>) {
  const job = await findGenerationJobByTaskId(taskId, 'hi3d');
  if (!job) {
    throw new Error('Unknown task id');
  }

  if (job.status === 'completed' || job.resultAssetId) {
    return;
  }

  const nextStatus = status === 'success' ? 'downloading_result' : status === 'failed' ? 'failed' : status === 'created' ? 'submitted' : 'processing';
  const updatedJob = await updateGenerationJob(job.id, {
    status: nextStatus,
    errorCode: payload.error_code ? String(payload.error_code) : undefined,
    errorMessage: payload.error_message ? String(payload.error_message) : undefined,
  });
  await addJobEvent({ jobId: job.id, eventType: `callback_${status}`, payload });

  if (status === 'failed') {
    await refundReservedJob(updatedJob, 'provider_callback_failed');
    return;
  }

  if (status === 'success') {
    if (process.env.JOB_QUEUE_MODE !== 'inline') {
      await enqueueJobProcessing(job.id, { dedupeKey: `callback:${job.id}:success` });
      return;
    }

    const { modelUrl, coverUrl } = getHi3DResult(payload);
    if (!modelUrl) {
      throw new Error('Callback missing result URL');
    }
    await downloadResult(updatedJob, modelUrl, coverUrl);
  }
}

export async function getDownloadAssetForJob(jobId: string) {
  const { job } = await getJobWithAssets(jobId);
  if (!job?.resultAssetId) {
    return null;
  }
  return getFileAsset(job.resultAssetId);
}
