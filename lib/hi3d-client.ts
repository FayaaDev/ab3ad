import path from 'node:path';
import { v4 as uuid } from 'uuid';
import type { FileAsset, GenerationJob, Hi3DQueryResponse, Hi3DTaskResponse } from '@/lib/types';
import { readStorageObject } from '@/lib/storage';
import { sleep } from '@/lib/utils';

let cachedToken: { value: string; expiresAt: number } | null = null;
const mockTasks = new Map<string, { createdAt: number }>();

function isMockMode() {
  return (process.env.HI3D_MODE ?? 'mock') === 'mock';
}

async function getAccessToken() {
  if (isMockMode()) {
    return 'mock-token';
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const clientId = process.env.HI3D_CLIENT_ID;
  const clientSecret = process.env.HI3D_CLIENT_SECRET;
  const baseUrl = process.env.HI3D_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    throw new Error('Missing Hi3D credentials or base URL.');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/open-api/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Hi3D token request failed with ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) {
    throw new Error('Hi3D token response missing access_token.');
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return data.access_token;
}

export async function submitTask(job: GenerationJob, assets: FileAsset[]): Promise<Hi3DTaskResponse> {
  if (isMockMode()) {
    await sleep(250);
    const taskId = `mock-${uuid()}`;
    mockTasks.set(taskId, { createdAt: Date.now() });
    return { taskId, raw: { mock: true, assetCount: assets.length, jobId: job.id } };
  }

  const token = await getAccessToken();
  const baseUrl = process.env.HI3D_BASE_URL!;
  const form = new FormData();
  form.set('request_type', '3');
  form.set('model', job.model);
  form.set('format', '2');
  form.set('resolution', job.resolution);
  form.set('pbr', job.pbr ? '1' : '0');
  form.set('face_count', job.faceCount);

  for (const [index, asset] of assets.entries()) {
    const buffer = await readStorageObject(asset.storageKey);
    const blob = new Blob([buffer], { type: asset.mimeType });
    const filename = path.basename(asset.originalFilename);
    if (job.mode === 'single_image') {
      form.append('images', blob, filename);
    } else {
      form.append('multi_images', blob, filename);
    }
  }

  const response = await fetch(`${baseUrl}/open-api/v1/submit-task`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Hi3D submit failed with ${response.status}`);
  }

  const data = (await response.json()) as { task_id?: string } & Record<string, unknown>;
  if (!data.task_id) {
    throw new Error('Hi3D submit response missing task_id.');
  }

  return { taskId: data.task_id, raw: data };
}

export async function queryTask(taskId: string): Promise<Hi3DQueryResponse> {
  if (isMockMode()) {
    const task = mockTasks.get(taskId);
    const age = Date.now() - (task?.createdAt ?? Date.now());
    if (age < 500) {
      return { status: 'created', raw: { mock: true } };
    }
    if (age < 1000) {
      return { status: 'queueing', raw: { mock: true } };
    }
    if (age < 1500) {
      return { status: 'processing', raw: { mock: true } };
    }
    return {
      status: 'success',
      raw: { mock: true },
      result: {
        modelUrl: 'data:application/octet-stream;base64,bW9jay1nbGItZGF0YQ==',
        coverUrl: 'https://dummyimage.com/512x512/111827/f9fafb.png&text=ab3ad+3D',
      },
    };
  }

  const token = await getAccessToken();
  const baseUrl = process.env.HI3D_BASE_URL!;
  const response = await fetch(`${baseUrl}/open-api/v1/query-task?task_id=${encodeURIComponent(taskId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Hi3D query failed with ${response.status}`);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const status = String(data.status ?? '').toLowerCase();
  if (!['created', 'queueing', 'processing', 'success', 'failed'].includes(status)) {
    throw new Error(`Unknown Hi3D task status: ${status}`);
  }

  return {
    status: status as Hi3DQueryResponse['status'],
    raw: data,
    errorCode: data.error_code ? String(data.error_code) : undefined,
    errorMessage: data.error_message ? String(data.error_message) : undefined,
    result: data.model_url
      ? {
          modelUrl: String(data.model_url),
          coverUrl: data.cover_url ? String(data.cover_url) : undefined,
        }
      : undefined,
  };
}
