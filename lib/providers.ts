import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { getHi3DError } from '@/lib/hi3d-contract';
import { getMockHi3DDurationMs, normalizeHi3DErrorMessage, queryTask as queryHi3DTask, submitTask as submitHi3DTask } from '@/lib/hi3d-client';
import { assertTrustedResultUrl } from '@/lib/hi3d-security';
import { readStorageObject } from '@/lib/storage';
import type { FileAsset, GenerationJob, GenerationMode, OutputFormat, ProviderId, ProviderPricingSnapshot, QualityPreset } from '@/lib/types';
import { sleep } from '@/lib/utils';

export type ProviderTaskState = 'submitted' | 'processing' | 'succeeded' | 'failed';

export interface ProviderTaskResult {
  modelUrl: string;
  coverUrl?: string;
}

export interface ProviderTaskQuery {
  state: ProviderTaskState;
  result?: ProviderTaskResult;
  errorCode?: string;
  errorMessage?: string;
  raw: Record<string, unknown>;
}

export interface ProviderSubmitResponse {
  taskId: string;
  raw: Record<string, unknown>;
}

export interface ProviderCatalogOption {
  id: string;
  label: string;
  credits: number;
}

export interface ProviderCatalogEntry {
  id: ProviderId;
  label: string;
  description: string;
  modes: GenerationMode[];
  outputFormats: OutputFormat[];
  qualities: ProviderCatalogOption[];
  defaults: {
    mode: GenerationMode;
    quality: QualityPreset;
    outputFormat: OutputFormat;
    pbr: boolean;
  };
}

const outputFormatMimeTypes: Record<OutputFormat, string> = {
  glb: 'model/gltf-binary',
  obj: 'model/obj',
  stl: 'model/stl',
  fbx: 'application/octet-stream',
  usdz: 'model/vnd.usdz+zip',
};

export interface ProviderAdapter {
  id: ProviderId;
  submit(job: GenerationJob, assets: FileAsset[]): Promise<ProviderSubmitResponse>;
  query(job: GenerationJob): Promise<ProviderTaskQuery>;
  assertResultUrl?(url: string): void;
}

const providerCatalog: Record<ProviderId, ProviderCatalogEntry> = {
  hi3d: {
    id: 'hi3d',
    label: 'Hi3D',
    description: 'Existing provider with direct image upload and signed callbacks.',
    modes: ['single_image', 'multi_view'],
    outputFormats: ['glb'],
    qualities: [
      { id: 'fast', label: 'Fast', credits: 1 },
      { id: 'high', label: 'High', credits: 2 },
    ],
    defaults: { mode: 'single_image', quality: 'high', outputFormat: 'glb', pbr: true },
  },
  printpal: {
    id: 'printpal',
    label: 'PrintPal',
    description: 'Second provider adapter for image-to-3D generation.',
    modes: ['single_image'],
    outputFormats: ['glb', 'fbx', 'obj', 'stl'],
    qualities: [
      { id: 'fast', label: 'Draft', credits: 2 },
      { id: 'high', label: 'Production', credits: 3 },
    ],
    defaults: { mode: 'single_image', quality: 'fast', outputFormat: 'glb', pbr: true },
  },
};

export function listProviderCatalog() {
  return Object.values(providerCatalog);
}

export function getProviderCatalogEntry(providerId: ProviderId) {
  const provider = providerCatalog[providerId];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return provider;
}

export function getProviderQualityOption(providerId: ProviderId, quality: QualityPreset) {
  const provider = getProviderCatalogEntry(providerId);
  const option = provider.qualities.find((entry) => entry.id === quality);
  if (!option) {
    throw new Error(`Unsupported quality for ${providerId}: ${quality}`);
  }
  return option;
}

export function createPricingSnapshot(input: {
  providerId: ProviderId;
  mode: GenerationMode;
  quality: QualityPreset;
  outputFormat: OutputFormat;
}): ProviderPricingSnapshot {
  const option = getProviderQualityOption(input.providerId, input.quality);
  return {
    providerId: input.providerId,
    credits: option.credits,
    quality: input.quality,
    mode: input.mode,
    outputFormat: input.outputFormat,
    providerRateLabel: option.label,
  };
}

function getHi3DProviderOptions(job: GenerationJob) {
  const options = job.providerOptions;
  return {
    model: typeof options.model === 'string' ? options.model : job.model,
    resolution: typeof options.resolution === 'string' ? options.resolution : job.resolution,
    faceCount: typeof options.faceCount === 'string' ? options.faceCount : job.faceCount,
    pbr: typeof options.pbr === 'boolean' ? options.pbr : job.pbr,
  };
}

const hi3dAdapter: ProviderAdapter = {
  id: 'hi3d',
  async submit(job, assets) {
    const options = getHi3DProviderOptions(job);
    return submitHi3DTask({ ...job, ...options }, assets);
  },
  async query(job) {
    if (!job.providerTaskId) {
      throw new Error('Provider task id is missing.');
    }
    const response = await queryHi3DTask(job.providerTaskId);
    return {
      state: response.status === 'success' ? 'succeeded' : response.status === 'failed' ? 'failed' : response.status === 'created' ? 'submitted' : 'processing',
      result: response.result,
      errorCode: response.errorCode,
      errorMessage: response.errorMessage,
      raw: response.raw,
    };
  },
  assertResultUrl(url) {
    if (url.startsWith('data:')) {
      return;
    }
    assertTrustedResultUrl(url);
  },
};

const printpalMockTasks = new Map<string, { createdAt: number; outputFormat: OutputFormat }>();

function isPrintPalMockMode() {
  return (process.env.PRINTPAL_MODE ?? 'mock') === 'mock';
}

async function fetchPrintPal(url: string, init: RequestInit) {
  const apiKey = process.env.PRINTPAL_API_KEY;
  if (!apiKey) {
    throw new Error('Missing PRINTPAL_API_KEY.');
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`PrintPal request failed with ${response.status}${message ? ` · ${message.slice(0, 400)}` : ''}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function getPrintPalCreateUrl() {
  const url = process.env.PRINTPAL_CREATE_URL;
  if (!url) {
    throw new Error('Missing PRINTPAL_CREATE_URL.');
  }
  return url;
}

function getPrintPalStatusUrl(taskId: string) {
  const template = process.env.PRINTPAL_STATUS_URL_TEMPLATE;
  if (!template) {
    throw new Error('Missing PRINTPAL_STATUS_URL_TEMPLATE.');
  }
  return template.replace('{taskId}', encodeURIComponent(taskId));
}

function getPrintPalTaskId(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  const taskId = data.task_id ?? data.id ?? payload.task_id ?? payload.id;
  if (typeof taskId !== 'string' || !taskId) {
    throw new Error('PrintPal response missing task id.');
  }
  return taskId;
}

function getPrintPalStatus(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  const rawStatus = data.status ?? payload.status ?? data.state ?? payload.state;
  if (typeof rawStatus !== 'string') {
    throw new Error('PrintPal response missing status.');
  }

  const status = rawStatus.toLowerCase();
  if (['queued', 'created', 'pending', 'submitted'].includes(status)) {
    return 'submitted' as const;
  }
  if (['running', 'processing', 'in_progress'].includes(status)) {
    return 'processing' as const;
  }
  if (['success', 'succeeded', 'completed'].includes(status)) {
    return 'succeeded' as const;
  }
  if (['failed', 'error'].includes(status)) {
    return 'failed' as const;
  }
  throw new Error(`Unknown PrintPal status: ${rawStatus}`);
}

function getPrintPalResult(payload: Record<string, unknown>) {
  const data = asRecord(payload.data);
  const result = asRecord(data.result);
  const modelUrl = result.model_url ?? result.url ?? data.model_url ?? data.url ?? payload.model_url ?? payload.url;
  const coverUrl = result.preview_url ?? result.thumbnail_url ?? data.preview_url ?? payload.preview_url;
  return {
    modelUrl: typeof modelUrl === 'string' ? modelUrl : undefined,
    coverUrl: typeof coverUrl === 'string' ? coverUrl : undefined,
  };
}

const printpalAdapter: ProviderAdapter = {
  id: 'printpal',
  async submit(job, assets) {
    if (isPrintPalMockMode()) {
      await sleep(200);
      const taskId = `printpal-mock-${uuid()}`;
      printpalMockTasks.set(taskId, { createdAt: Date.now(), outputFormat: job.outputFormat });
      return { taskId, raw: { mock: true, provider: 'printpal', assetCount: assets.length, outputFormat: job.outputFormat } };
    }

    const asset = assets[0];
    if (!asset) {
      throw new Error('PrintPal requires one uploaded asset.');
    }
    const imageBase64 = (await readStorageObject(asset.storageKey)).toString('base64');
    const options = job.providerOptions;
    const payload = {
      image_base64: imageBase64,
      filename: path.basename(asset.originalFilename),
      mode: job.mode,
      quality: options.quality ?? job.pricingSnapshot?.quality,
      output_format: job.outputFormat,
      pbr: options.pbr ?? job.pbr,
    };
    const response = await fetchPrintPal(getPrintPalCreateUrl(), { method: 'POST', body: JSON.stringify(payload) });
    return { taskId: getPrintPalTaskId(response), raw: response };
  },
  async query(job) {
    if (!job.providerTaskId) {
      throw new Error('Provider task id is missing.');
    }

    if (isPrintPalMockMode()) {
      const task = printpalMockTasks.get(job.providerTaskId);
      const age = Date.now() - (task?.createdAt ?? Date.now());
      const durationMs = Math.max(800, getMockHi3DDurationMs());
      if (age < durationMs * 0.3) {
        return { state: 'submitted', raw: { mock: true, provider: 'printpal' } };
      }
      if (age < durationMs) {
        return { state: 'processing', raw: { mock: true, provider: 'printpal' } };
      }
      return {
        state: 'succeeded',
        raw: { mock: true, provider: 'printpal' },
        result: {
          modelUrl: 'data:model/gltf-binary;base64,cHJpbnRwYWwtbW9jay1nbGItZGF0YQ==',
          coverUrl: 'https://dummyimage.com/512x512/111827/f9fafb.png&text=printpal+3D',
        },
      };
    }

    const response = await fetchPrintPal(getPrintPalStatusUrl(job.providerTaskId), { method: 'GET' });
    const { modelUrl, coverUrl } = getPrintPalResult(response);
    const error = getHi3DError(response);
    return {
      state: getPrintPalStatus(response),
      result: modelUrl ? { modelUrl, coverUrl } : undefined,
      errorCode: error.errorCode,
      errorMessage: error.errorMessage,
      raw: response,
    };
  },
};

const providerAdapters: Record<ProviderId, ProviderAdapter> = {
  hi3d: hi3dAdapter,
  printpal: printpalAdapter,
};

export function getProviderAdapter(providerId: ProviderId) {
  const adapter = providerAdapters[providerId];
  if (!adapter) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  return adapter;
}

export function getOutputFormatExtension(outputFormat: OutputFormat) {
  return `.${outputFormat}`;
}

export function getOutputFormatMimeType(outputFormat: OutputFormat) {
  return outputFormatMimeTypes[outputFormat];
}

export function validateProviderSelection(input: { providerId: ProviderId; mode: GenerationMode; quality: QualityPreset; outputFormat: OutputFormat }) {
  const provider = getProviderCatalogEntry(input.providerId);
  if (!provider.modes.includes(input.mode)) {
    throw new Error(`${provider.label} does not support ${input.mode.replace('_', ' ')} mode.`);
  }
  if (!provider.outputFormats.includes(input.outputFormat)) {
    throw new Error(`${provider.label} does not support ${input.outputFormat.toUpperCase()} output.`);
  }
  getProviderQualityOption(input.providerId, input.quality);
  return provider;
}

export function normalizeProviderErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return normalizeHi3DErrorMessage(error.message);
  }
  return 'Unknown provider error';
}
