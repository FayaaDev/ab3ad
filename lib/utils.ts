import crypto from 'node:crypto';
import path from 'node:path';

export function nowIso() {
  return new Date().toISOString();
}

export function sanitizeFilename(name: string) {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'upload';
  return `${base}${ext}`;
}

export async function sha256(input: Buffer) {
  return crypto.createHash('sha256').update(input).digest('hex');
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

export async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function appUrl() {
  return process.env.APP_URL ?? 'http://localhost:3000';
}
