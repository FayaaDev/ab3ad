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
      return 'hi3d_created';
    case 'queueing':
      return 'hi3d_queueing';
    case 'processing':
      return 'hi3d_processing';
    case 'success':
      return 'downloading_result';
    case 'failed':
      return 'failed';
  }
}

export const activeGenerationStatuses = ['queued', 'submitted_to_hi3d', 'hi3d_created', 'hi3d_queueing', 'hi3d_processing', 'downloading_result'] as const;

export function isActiveGenerationStatus(status: string) {
  return activeGenerationStatuses.includes(status as (typeof activeGenerationStatuses)[number]);
}

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3000';
}
