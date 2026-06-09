import path from 'node:path';
import { v4 as uuid } from 'uuid';
import {
  addBillingEvent,
  addJobEvent,
  createFileAsset,
  findGenerationJobByTaskId,
  getFileAsset,
  getJobWithAssets,
  updateGenerationJob,
} from '@/lib/store';
import { queryTask, submitTask } from '@/lib/hi3d-client';
import { fetchToStorage, saveStorageObject } from '@/lib/storage';
import { mapHi3DStatus, nowIso, sleep } from '@/lib/utils';

const pollSchedule = process.env.HI3D_MODE === 'mock' ? [250, 500, 1_000, 2_000, 5_000] : [10_000, 20_000, 30_000, 60_000, 120_000, 120_000];

export async function processJob(jobId: string) {
  const { job, assets } = await getJobWithAssets(jobId);
  if (!job) {
    return;
  }

  if (job.status === 'completed' || job.resultAssetId) {
    return;
  }

  if (job.status === 'queued') {
    await addJobEvent({ jobId, eventType: 'submit_started', payload: {} });
    const submission = await submitTask(job, assets);
    await updateGenerationJob(jobId, {
      status: 'submitted_to_hi3d',
      hi3dTaskId: submission.taskId,
      errorCode: undefined,
      errorMessage: undefined,
    });
    await addJobEvent({ jobId, eventType: 'submitted_to_hi3d', payload: submission.raw });
  }

  for (const delay of pollSchedule) {
    const latest = await getJobWithAssets(jobId);
    if (!latest.job?.hi3dTaskId) {
      return;
    }
    if (latest.job.status === 'completed' || latest.job.resultAssetId) {
      return;
    }

    const query = await queryTask(latest.job.hi3dTaskId);
    await updateGenerationJob(jobId, {
      status: mapHi3DStatus(query.status),
      errorCode: query.errorCode,
      errorMessage: query.errorMessage,
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

    await sleep(delay);
  }
}

async function downloadResult(jobId: string, modelUrl: string, coverUrl?: string) {
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
      coverAssetId,
      completedAt: nowIso(),
      errorCode: undefined,
      errorMessage: undefined,
    });
    await addBillingEvent({ jobId, userId: latest.job.userId, eventType: 'generation_completed', creditDelta: -1 });
    await addJobEvent({ jobId, eventType: 'job_completed', payload: { resultAssetId: modelAsset.id, coverAssetId } });
  } catch (error) {
    await updateGenerationJob(jobId, {
      status: 'result_download_failed',
      errorCode: 'result_download_failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown download error',
    });
    await addJobEvent({ jobId, eventType: 'download_failed', payload: { message: error instanceof Error ? error.message : 'Unknown error' } });
  }
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
    errorCode: payload.error_code ? String(payload.error_code) : undefined,
    errorMessage: payload.error_message ? String(payload.error_message) : undefined,
  });
  await addJobEvent({ jobId: job.id, eventType: `callback_${status}`, payload });

  if (status === 'success') {
    const modelUrl = payload.model_url ? String(payload.model_url) : '';
    if (!modelUrl) {
      throw new Error('Callback missing model_url');
    }
    await downloadResult(job.id, modelUrl, payload.cover_url ? String(payload.cover_url) : undefined);
  }
}

export async function getDownloadAssetForJob(jobId: string) {
  const { job } = await getJobWithAssets(jobId);
  if (!job?.resultAssetId) {
    return null;
  }
  return getFileAsset(job.resultAssetId);
}
