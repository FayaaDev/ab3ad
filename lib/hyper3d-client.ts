import path from 'node:path';
import type { FileAsset, GenerationJob } from '@/lib/types';
import { readStorageObject } from '@/lib/storage';
import { sleep } from '@/lib/utils';
import { v4 as uuid } from 'uuid';

const mockTasks = new Map<string, { createdAt: number; outputFormat: string }>();
const defaultBaseUrl = 'https://api.hyper3d.com/api/v2';
const defaultFetchTimeoutMs = 30_000;

type Hyper3DJson = Record<string, unknown>;
type Hyper3DTaskState = 'submitted' | 'processing' | 'succeeded' | 'failed';

type Hyper3DStatusResponse = {
  jobs: Array<{ uuid?: string; status?: string }>;
};

function isMockMode() {
  return (process.env.HYPER3D_MODE ?? 'mock') === 'mock';
}

function getFetchTimeoutMs() {
  return Number(process.env.HYPER3D_FETCH_TIMEOUT_MS ?? String(defaultFetchTimeoutMs)) || defaultFetchTimeoutMs;
}

function getBaseUrl() {
  return (process.env.HYPER3D_BASE_URL ?? defaultBaseUrl).replace(/\/$/, '');
}

function getApiKey() {
  const apiKey = process.env.HYPER3D_API_KEY;
  if (!apiKey) {
    throw new Error('Missing HYPER3D_API_KEY.');
  }
  return apiKey;
}

function getHeaders(extra: HeadersInit = {}) {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    ...extra,
  };
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
      throw new Error(`Hyper3D request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function assertSuccessfulResponse(payload: Hyper3DJson, fallbackMessage: string) {
  const error = payload.error;
  if (error === undefined || error === null || error === '') {
    return;
  }

  const message = typeof payload.message === 'string' && payload.message ? payload.message : fallbackMessage;
  throw new Error(`${String(error)}${message ? ` · ${message}` : ''}`);
}

function orderAssetsForUpload(assets: FileAsset[]) {
  const priority = new Map<FileAsset['role'], number>([
    ['single', 0],
    ['front', 0],
    ['right', 1],
    ['back', 2],
    ['left', 3],
  ]);

  return [...assets].sort((left, right) => {
    const leftRank = priority.get(left.role) ?? 99;
    const rightRank = priority.get(right.role) ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.originalFilename.localeCompare(right.originalFilename);
  });
}

function normalizeStatus(status: string): Hyper3DTaskState {
  const normalized = status.toLowerCase();
  if (normalized === 'done') {
    return 'succeeded' as const;
  }
  if (normalized === 'failed') {
    return 'failed' as const;
  }
  if (normalized === 'generating') {
    return 'processing' as const;
  }
  if (normalized === 'waiting') {
    return 'submitted' as const;
  }
  throw new Error(`Unknown Hyper3D status: ${status}`);
}

function getOutputFormat(job: GenerationJob) {
  return typeof job.providerOptions.outputFormat === 'string' ? job.providerOptions.outputFormat : job.outputFormat;
}

function getResultFile(list: Array<Record<string, unknown>>, outputFormat: string) {
  const items = list.filter((item) => typeof item.url === 'string' && typeof item.name === 'string');
  const preview = items.find((item) => String(item.name).toLowerCase() === 'preview.webp');
  const preferred = items.find((item) => String(item.name).toLowerCase().endsWith(`.${outputFormat.toLowerCase()}`));
  const fallback = items.find((item) => String(item.name).toLowerCase() !== 'preview.webp');

  return {
    model: preferred ?? fallback,
    preview,
  };
}

export async function submitHyper3DTask(job: GenerationJob, assets: FileAsset[]) {
  if (isMockMode()) {
    await sleep(200);
    const taskId = `hyper3d-mock-${uuid()}`;
    mockTasks.set(taskId, { createdAt: Date.now(), outputFormat: getOutputFormat(job) });
    return {
      taskId,
      providerOptionsPatch: {
        subscriptionKey: `hyper3d-sub-${taskId}`,
        outputFormat: getOutputFormat(job),
      },
      raw: { mock: true, provider: 'hyper3d', assetCount: assets.length, outputFormat: getOutputFormat(job) },
    };
  }

  const form = new FormData();
  const providerOptions = job.providerOptions;
  form.set('tier', typeof providerOptions.tier === 'string' ? providerOptions.tier : 'Gen-2.5-High');
  form.set('mesh_mode', typeof providerOptions.meshMode === 'string' ? providerOptions.meshMode : 'Raw');
  form.set('material', typeof providerOptions.material === 'string' ? providerOptions.material : job.pbr ? 'PBR' : 'Shaded');
  form.set('geometry_file_format', getOutputFormat(job));

  for (const asset of orderAssetsForUpload(assets)) {
    const buffer = await readStorageObject(asset.storageKey);
    const blob = new Blob([new Uint8Array(buffer)], { type: asset.mimeType });
    form.append('images', blob, path.basename(asset.originalFilename));
  }

  const response = await fetchWithTimeout(`${getBaseUrl()}/rodin`, {
    method: 'POST',
    headers: getHeaders(),
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Hyper3D submit failed with ${response.status}${await readErrorBody(response)}`);
  }

  const payload = (await response.json()) as Hyper3DJson;
  assertSuccessfulResponse(payload, 'Hyper3D submit failed.');

  const taskId = typeof payload.uuid === 'string' ? payload.uuid : undefined;
  const jobs = typeof payload.jobs === 'object' && payload.jobs !== null ? (payload.jobs as Record<string, unknown>) : {};
  const subscriptionKey = typeof jobs.subscription_key === 'string' ? jobs.subscription_key : undefined;
  if (!taskId || !subscriptionKey) {
    throw new Error('Hyper3D submit response missing uuid or jobs.subscription_key.');
  }

  return {
    taskId,
    providerOptionsPatch: {
      ...job.providerOptions,
      subscriptionKey,
      outputFormat: getOutputFormat(job),
    },
    raw: payload,
  };
}

export async function queryHyper3DTask(job: GenerationJob) {
  if (!job.providerTaskId) {
    throw new Error('Provider task id is missing.');
  }

  if (isMockMode()) {
    const task = mockTasks.get(job.providerTaskId);
    const age = Date.now() - (task?.createdAt ?? Date.now());
    const durationMs = Math.max(800, Number(process.env.HI3D_MOCK_DURATION_MS ?? '1500') || 1500);
    if (age < durationMs * 0.3) {
      return { state: 'submitted' as const, raw: { mock: true, provider: 'hyper3d' } };
    }
    if (age < durationMs) {
      return { state: 'processing' as const, raw: { mock: true, provider: 'hyper3d' } };
    }
    return {
      state: 'succeeded' as const,
      raw: { mock: true, provider: 'hyper3d' },
      result: {
        modelUrl: 'data:application/octet-stream;base64,aHlwZXIzZC1tb2NrLW1vZGVs',
        coverUrl: 'https://dummyimage.com/512x512/111827/f9fafb.png&text=hyper3d+3D',
      },
    };
  }

  const subscriptionKey = typeof job.providerOptions.subscriptionKey === 'string' ? job.providerOptions.subscriptionKey : undefined;
  if (!subscriptionKey) {
    throw new Error('Hyper3D provider options missing subscriptionKey.');
  }

  const statusResponse = await fetchWithTimeout(`${getBaseUrl()}/status`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json', accept: 'application/json' }),
    body: JSON.stringify({ subscription_key: subscriptionKey }),
  });

  if (!statusResponse.ok) {
    throw new Error(`Hyper3D status query failed with ${statusResponse.status}${await readErrorBody(statusResponse)}`);
  }

  const statusPayload = (await statusResponse.json()) as Hyper3DJson;
  assertSuccessfulResponse(statusPayload, 'Hyper3D status query failed.');
  const jobs = Array.isArray(statusPayload.jobs) ? (statusPayload.jobs as Hyper3DStatusResponse['jobs']) : [];
  if (!jobs.length) {
    throw new Error('Hyper3D status response missing jobs.');
  }

  const states = jobs.map((item) => {
    if (typeof item.status !== 'string') {
      throw new Error('Hyper3D status response missing job status.');
    }
    return normalizeStatus(item.status);
  });

  const state: Hyper3DTaskState = states.every((entry) => entry === 'succeeded')
    ? 'succeeded'
    : states.some((entry) => entry === 'failed')
      ? 'failed'
      : states.some((entry) => entry === 'processing')
        ? 'processing'
        : 'submitted';

  if (state !== 'succeeded') {
    return { state, raw: statusPayload };
  }

  const downloadResponse = await fetchWithTimeout(`${getBaseUrl()}/download`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json', accept: 'application/json' }),
    body: JSON.stringify({ task_uuid: job.providerTaskId }),
  });

  if (!downloadResponse.ok) {
    throw new Error(`Hyper3D download query failed with ${downloadResponse.status}${await readErrorBody(downloadResponse)}`);
  }

  const downloadPayload = (await downloadResponse.json()) as Hyper3DJson;
  assertSuccessfulResponse(downloadPayload, 'Hyper3D download query failed.');
  const list = Array.isArray(downloadPayload.list) ? (downloadPayload.list as Array<Record<string, unknown>>) : [];
  const files = getResultFile(list, getOutputFormat(job));
  if (!files.model || typeof files.model.url !== 'string') {
    throw new Error(`Hyper3D download response missing .${getOutputFormat(job)} result URL.`);
  }

  return {
    state,
    raw: { status: statusPayload, download: downloadPayload },
    result: {
      modelUrl: files.model.url,
      coverUrl: typeof files.preview?.url === 'string' ? files.preview.url : undefined,
    },
  };
}

export async function queryHyper3DBalance() {
  if (isMockMode()) {
    return { totalBalance: 20, raw: { mock: true, balance: 20 } };
  }

  const response = await fetchWithTimeout(`${getBaseUrl()}/check_balance`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Hyper3D balance query failed with ${response.status}${await readErrorBody(response)}`);
  }

  const payload = (await response.json()) as Hyper3DJson;
  assertSuccessfulResponse(payload, 'Hyper3D balance query failed.');
  const totalBalance = Number(payload.balance);
  if (!Number.isFinite(totalBalance)) {
    throw new Error('Hyper3D balance response missing balance.');
  }

  return { totalBalance, raw: payload };
}
