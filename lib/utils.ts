import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function nowIso() {
  return new Date().toISOString();
}

export function sanitizeFilename(name: string) {
  const lastDotIndex = name.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  const ext = hasExtension ? name.slice(lastDotIndex).toLowerCase() : '';
  const base = (hasExtension ? name.slice(0, lastDotIndex) : name)
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'upload';

  return `${base}${ext}`;
}

export async function sha256(input: Buffer) {
  const digest = await crypto.subtle.digest('SHA-256', Uint8Array.from(input));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export function mapHi3DStatus(status: 'created' | 'queueing' | 'processing' | 'success' | 'failed') {
  switch (status) {
    case 'created':
      return 'submitted';
    case 'queueing':
    case 'processing':
      return 'processing';
    case 'success':
      return 'downloading_result';
    case 'failed':
      return 'failed';
  }
}

export function normalizeJobStatus(status: string) {
  switch (status) {
    case 'submitted_to_hi3d':
      return 'submitted';
    case 'hi3d_created':
    case 'hi3d_queueing':
    case 'hi3d_processing':
      return 'processing';
    default:
      return status;
  }
}

export const activeGenerationStatuses = ['queued', 'submitting', 'submitted', 'processing', 'downloading_result'] as const;

export function isActiveGenerationStatus(status: string) {
  return activeGenerationStatuses.includes(normalizeJobStatus(status) as (typeof activeGenerationStatuses)[number]);
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3000';
}
