import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { getHi3DEnvelopeData, getHi3DError, getHi3DResult, getHi3DStatus } from '@/lib/hi3d-contract';
import { normalizeHi3DFaceCount } from '@/lib/validation';
import type { FileAsset, GenerationJob, Hi3DQueryResponse, Hi3DTaskResponse } from '@/lib/types';
import { readStorageObject } from '@/lib/storage';
import { sleep } from '@/lib/utils';

let cachedToken: { value: string; expiresAt: number } | null = null;
const mockTasks = new Map<string, { createdAt: number }>();
const defaultMockDurationMs = 1_500;

export const HI3D_LOW_BALANCE_MESSAGE = 'please Credit your account to be able to upload images';

export function resetHi3DClientState() {
  cachedToken = null;
  mockTasks.clear();
}

function isMockMode() {
  return (process.env.HI3D_MODE ?? 'mock') === 'mock';
}

export function getMockHi3DDurationMs() {
  const configuredDuration = Number(process.env.HI3D_MOCK_DURATION_MS ?? String(defaultMockDurationMs));
  return configuredDuration > 0 ? configuredDuration : defaultMockDurationMs;
}

function getFetchTimeoutMs() {
  return Number(process.env.HI3D_FETCH_TIMEOUT_MS ?? '30000') || 30000;
}

async function readErrorBody(response: Response) {
  const text = await response.text();
  return text ? ` · ${text.slice(0, 400)}` : '';
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = getFetchTimeoutMs()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Hi3D request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function appendConfiguredSubmitFields(form: FormData) {
  if (process.env.HI3D_CALLBACK_URL) {
    form.set(process.env.HI3D_CALLBACK_URL_FIELD ?? 'callback_url', process.env.HI3D_CALLBACK_URL);
  }

  if (process.env.HI3D_CALLBACK_SECRET) {
    form.set(process.env.HI3D_CALLBACK_SECRET_FIELD ?? 'callback_secret', process.env.HI3D_CALLBACK_SECRET);
  }

  const extraFields = process.env.HI3D_SUBMIT_EXTRA_FIELDS;
  if (!extraFields) {
    return;
  }

  const parsed = JSON.parse(extraFields) as Record<string, string | number | boolean>;
  for (const [key, value] of Object.entries(parsed)) {
    form.set(key, String(value));
  }
}

export function normalizeHi3DErrorMessage(message: string) {
  if (/balance is not enough/i.test(message) || /\(30010000\)/.test(message)) {
    return HI3D_LOW_BALANCE_MESSAGE;
  }

  return message;
}

function assertSuccessfulEnvelope(payload: Record<string, unknown>, fallbackMessage: string) {
  const code = payload.code;
  if (code === undefined || code === null || String(code) === '200') {
    return;
  }

  const message = typeof payload.msg === 'string' ? payload.msg : typeof payload.message === 'string' ? payload.message : fallbackMessage;
  throw new Error(normalizeHi3DErrorMessage(`${message} (${String(code)})`));
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
  const response = await fetchWithTimeout(`${baseUrl}/open-api/v1/auth/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Hi3D token request failed with ${response.status}${await readErrorBody(response)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  assertSuccessfulEnvelope(payload, 'Hi3D token request failed.');
  const data = getHi3DEnvelopeData(payload);
  const accessToken = typeof data.accessToken === 'string' ? data.accessToken : undefined;
  if (!accessToken) {
    throw new Error('Hi3D token response missing data.accessToken.');
  }

  cachedToken = {
    value: accessToken,
    expiresAt: Date.now() + 3600 * 1000,
  };

  return accessToken;
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
  form.set('face', normalizeHi3DFaceCount(job.faceCount));
  appendConfiguredSubmitFields(form);

  for (const asset of assets) {
    const buffer = await readStorageObject(asset.storageKey);
    const blob = new Blob([new Uint8Array(buffer)], { type: asset.mimeType });
    const filename = path.basename(asset.originalFilename);
    if (job.mode === 'single_image') {
      form.append('images', blob, filename);
    } else {
      form.append('multi_images', blob, filename);
    }
  }

  const response = await fetchWithTimeout(`${baseUrl}/open-api/v1/submit-task`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Hi3D submit failed with ${response.status}${await readErrorBody(response)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  assertSuccessfulEnvelope(payload, 'Hi3D submit failed.');
  const data = getHi3DEnvelopeData(payload);
  const taskId = typeof data.task_id === 'string' ? data.task_id : undefined;
  if (!taskId) {
    throw new Error('Hi3D submit response missing task_id.');
  }

  return { taskId, raw: payload };
}

export async function queryTask(taskId: string): Promise<Hi3DQueryResponse> {
  if (isMockMode()) {
    const task = mockTasks.get(taskId);
    const age = Date.now() - (task?.createdAt ?? Date.now());
    const mockDurationMs = getMockHi3DDurationMs();
    const createdThresholdMs = Math.round(mockDurationMs * 0.2);
    const queueingThresholdMs = Math.round(mockDurationMs * 0.45);

    if (age < createdThresholdMs) {
      return { status: 'created', raw: { mock: true } };
    }
    if (age < queueingThresholdMs) {
      return { status: 'queueing', raw: { mock: true } };
    }
    if (age < mockDurationMs) {
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
  const response = await fetchWithTimeout(`${baseUrl}/open-api/v1/query-task?task_id=${encodeURIComponent(taskId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Hi3D query failed with ${response.status}${await readErrorBody(response)}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  assertSuccessfulEnvelope(payload, 'Hi3D query failed.');
  const status = getHi3DStatus(payload);
  if (!status) {
    throw new Error(`Unknown Hi3D task status: ${String(getHi3DEnvelopeData(payload).state ?? '')}`);
  }

  const { errorCode, errorMessage } = getHi3DError(payload);
  const result = getHi3DResult(payload);

  return {
    status,
    raw: payload,
    errorCode,
    errorMessage,
    result: result.modelUrl
      ? {
          modelUrl: result.modelUrl,
          coverUrl: result.coverUrl,
        }
      : undefined,
  };
}
