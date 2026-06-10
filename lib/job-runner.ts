import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { getHi3DError, getHi3DResult } from '@/lib/hi3d-contract';
import { getPool } from '@/lib/db';
import {
  addJobEvent,
  createFileAsset,
  findGenerationJobByTaskId,
  getFileAsset,
  getJobWithAssets,
  recordWalletEvent,
  updateGenerationJob,
} from '@/lib/store';
import { normalizeHi3DErrorMessage, queryTask, submitTask } from '@/lib/hi3d-client';
import { enqueueJobProcessing } from '@/lib/queue';
import { generatePreviewGlb, getPreviewFilename, getPreviewStorageKey, summarizePreview } from '@/lib/preview-glb';
import { fetchToStorage, saveStorageObject } from '@/lib/storage';
import type { FileAsset } from '@/lib/types';
import { mapHi3DStatus, nowIso } from '@/lib/utils';

const realPollSchedule = [10_000, 20_000, 30_000, 60_000, 120_000, 120_000, 120_000, 120_000];
const mockPollSchedule = [250, 500, 1_000, 2_000, 5_000];

export function getNextPollDelay(pollAttempts = 0) {
  const schedule = process.env.HI3D_MODE === 'mock' ? mockPollSchedule : realPollSchedule;
  return schedule[Math.min(pollAttempts, schedule.length - 1)];
}

function getMaxPollAttempts() {
  const schedule = process.env.HI3D_MODE === 'mock' ? mockPollSchedule : realPollSchedule;
  return Number(process.env.HI3D_MAX_POLL_ATTEMPTS ?? String(schedule.length + 2)) || schedule.length + 2;
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

async function scheduleNextPoll(jobId: string, pollAttempts: number) {
  if (pollAttempts >= getMaxPollAttempts()) {
    await updateGenerationJob(jobId, {
      status: 'failed',
      errorCode: 'hi3d_poll_timeout',
      errorMessage: 'Hi3D did not finish before the polling timeout window ended.',
      pollAttempts,
    });
    await addJobEvent({ jobId, eventType: 'job_failed', payload: { errorCode: 'hi3d_poll_timeout', errorMessage: 'Polling timeout reached.' } });
    return;
  }

  const delayMs = getNextPollDelay(pollAttempts);
  await addJobEvent({ jobId, eventType: 'poll_rescheduled', payload: { delayMs, pollAttempts } });
  if (process.env.JOB_QUEUE_MODE === 'inline') {
    return;
  }
  await enqueueJobProcessing(jobId, { delayMs, dedupeKey: `poll:${jobId}:${pollAttempts}` });
}

export async function processJob(jobId: string) {
  const { job, assets } = await getJobWithAssets(jobId);
  if (!job) {
    return;
  }

  if (job.status === 'completed' || job.resultAssetId) {
    return;
  }

  try {
    if (job.status === 'queued') {
      await addJobEvent({ jobId, eventType: 'submit_started', payload: {} });
      const submission = await submitTask(job, assets);
      await updateGenerationJob(jobId, {
        status: 'submitted_to_hi3d',
        hi3dTaskId: submission.taskId,
        errorCode: undefined,
        errorMessage: undefined,
        pollAttempts: 0,
      });
      await addJobEvent({ jobId, eventType: 'submitted_to_hi3d', payload: submission.raw });
    }

    const latest = await getJobWithAssets(jobId);
    if (!latest.job?.hi3dTaskId) {
      return;
    }
    if (latest.job.status === 'completed' || latest.job.resultAssetId) {
      return;
    }

    const query = await queryTask(latest.job.hi3dTaskId);
    const nextPollAttempts = (latest.job.pollAttempts ?? 0) + 1;
    await updateGenerationJob(jobId, {
      status: mapHi3DStatus(query.status),
      errorCode: query.errorCode,
      errorMessage: query.errorMessage,
      pollAttempts: nextPollAttempts,
    });
    await addJobEvent({ jobId, eventType: `hi3d_${query.status}`, payload: query.raw });

    if (query.status === 'success' && query.result) {
      await downloadResult(jobId, query.result.modelUrl, query.result.coverUrl);
      return;
    }

    if (query.status === 'failed') {
      await addJobEvent({ jobId, eventType: 'job_failed', payload: { errorCode: query.errorCode, errorMessage: query.errorMessage } });
      return;
    }

    await scheduleNextPoll(jobId, nextPollAttempts);
  } catch (error) {
    const errorMessage = normalizeHi3DErrorMessage(error instanceof Error ? error.message : 'Unknown Hi3D error');
    await updateGenerationJob(jobId, {
      status: 'failed',
      errorCode: 'hi3d_request_failed',
      errorMessage,
    });
    await addJobEvent({ jobId, eventType: 'job_failed', payload: { errorCode: 'hi3d_request_failed', errorMessage } });
    throw error;
  }
}

async function createPreviewAssetForResult(jobId: string, userId: string, modelAsset: FileAsset, modelBuffer: Buffer) {
  if (process.env.PREVIEW_GLB_GENERATION === 'disabled') {
    await addJobEvent({ jobId, eventType: 'preview_skipped', payload: { reason: 'disabled' } });
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

async function downloadResult(jobId: string, modelUrl: string, coverUrl?: string) {
  await withJobLock(jobId, async () => {
    const latest = await getJobWithAssets(jobId);
    if (!latest.job) {
      throw new Error('Job not found during result download');
    }
    if (latest.job.status === 'completed' || latest.job.resultAssetId) {
      return;
    }

    await updateGenerationJob(jobId, { status: 'downloading_result' });
    await addJobEvent({ jobId, eventType: 'download_started', payload: { modelUrl, coverUrl } });

    try {
      const modelStorageKey = path.join('results', latest.job.userId, `${jobId}-${uuid()}.glb`);
      let modelBuffer: Buffer;
      if (modelUrl.startsWith('data:')) {
        const [, data] = modelUrl.split(',', 2);
        modelBuffer = Buffer.from(data, 'base64');
        await saveStorageObject(modelStorageKey, modelBuffer, 'model/gltf-binary');
      } else {
        modelBuffer = await fetchToStorage(modelStorageKey, modelUrl, 'model/gltf-binary');
      }

      const modelAsset = await createFileAsset({
        userId: latest.job.userId,
        storageKey: modelStorageKey,
        originalFilename: `${jobId}.glb`,
        mimeType: 'model/gltf-binary',
        sizeBytes: modelBuffer.byteLength,
        sha256: `generated-${jobId}`,
        role: 'single',
      });

      const previewAsset = await createPreviewAssetForResult(jobId, latest.job.userId, modelAsset, modelBuffer);

      let coverAssetId: string | undefined;
      if (coverUrl) {
        const coverStorageKey = path.join('results', latest.job.userId, `${jobId}-${uuid()}.png`);
        const coverBuffer = await fetchToStorage(coverStorageKey, coverUrl, 'image/png');
        const coverAsset = await createFileAsset({
          userId: latest.job.userId,
          storageKey: coverStorageKey,
          originalFilename: `${jobId}.png`,
          mimeType: 'image/png',
          sizeBytes: coverBuffer.byteLength,
          sha256: `cover-${jobId}`,
          role: 'single',
        });
        coverAssetId = coverAsset.id;
      }

      await updateGenerationJob(jobId, {
        status: 'completed',
        resultAssetId: modelAsset.id,
        previewAssetId: previewAsset?.id,
        coverAssetId,
        completedAt: nowIso(),
        errorCode: undefined,
        errorMessage: undefined,
      });
      await recordWalletEvent({ jobId, userId: latest.job.userId, eventType: 'generation_completed', creditDelta: -1 });
      await addJobEvent({ jobId, eventType: 'job_completed', payload: { resultAssetId: modelAsset.id, previewAssetId: previewAsset?.id, coverAssetId } });
    } catch (error) {
      await updateGenerationJob(jobId, {
        status: 'result_download_failed',
        errorCode: 'result_download_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown download error',
      });
      await addJobEvent({ jobId, eventType: 'download_failed', payload: { message: error instanceof Error ? error.message : 'Unknown error' } });
      throw error;
    }
  });
}

export async function handleHi3DCallback(taskId: string, status: 'created' | 'queueing' | 'processing' | 'success' | 'failed', payload: Record<string, unknown>) {
  const job = await findGenerationJobByTaskId(taskId);
  if (!job) {
    throw new Error('Unknown task id');
  }

  if (job.status === 'completed' || job.resultAssetId) {
    return;
  }

  await updateGenerationJob(job.id, {
    status: mapHi3DStatus(status),
    ...getHi3DError(payload),
  });
  await addJobEvent({ jobId: job.id, eventType: `callback_${status}`, payload });

  if (status === 'success') {
    const { modelUrl, coverUrl } = getHi3DResult(payload);
    if (!modelUrl) {
      throw new Error('Callback missing result URL');
    }
    await downloadResult(job.id, modelUrl, coverUrl);
  }
}

export async function getDownloadAssetForJob(jobId: string) {
  const { job } = await getJobWithAssets(jobId);
  if (!job?.resultAssetId) {
    return null;
  }
  return getFileAsset(job.resultAssetId);
}
