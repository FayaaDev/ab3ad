import path from 'node:path';
import { z } from 'zod';
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, MULTI_VIEW_ROLES } from '@/lib/types';
import type { FileAsset, GenerationMode, ProviderId, QualityPreset } from '@/lib/types';

const allowedMimeTypeSet = new Set(ALLOWED_MIME_TYPES);
const singleExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export const generationSchema = z.object({
  providerId: z.enum(['hi3d', 'printpal']).default('hi3d'),
  assetIds: z.array(z.string().min(1)).min(1).max(4),
  mode: z.enum(['single_image', 'multi_view']),
  model: z.string().default('hitem3dv2.1'),
  quality: z.enum(['fast', 'high']).default('fast'),
  outputFormat: z.enum(['glb', 'obj', 'stl', 'fbx']).default('glb'),
  pbr: z.boolean().default(true),
});

export const walletTopUpSchema = z.object({
  amount: z.coerce.number().int().min(1).max(100),
});

export const adminCreditGrantSchema = z.object({
  userId: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  amount: z.coerce.number().int().min(-1000).max(1000).refine((value) => value !== 0, 'Adjustment amount must not be zero.'),
}).refine((value) => Boolean(value.userId || value.email), 'Provide a user id or email.');

export const DEFAULT_SINGLE_IMAGE_FACE_COUNT = '800000';

export function assertValidUpload(file: File, buffer: Buffer) {
  if (!file.size || file.size <= 0) {
    throw new Error('Empty file uploads are not allowed.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File too large. Max size is 20 MB.');
  }
  if (!allowedMimeTypeSet.has(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new Error('Unsupported file type.');
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!singleExtensions.has(ext)) {
    throw new Error('Unsupported file extension.');
  }
  if (!matchesMagicBytes(file.type, buffer)) {
    throw new Error('Uploaded file contents do not match the declared file type.');
  }
}

function matchesMagicBytes(mimeType: string, buffer: Buffer) {
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8;
  }
  if (mimeType === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

export function validateAssetsForMode(mode: GenerationMode, assets: FileAsset[]) {
  if (mode === 'single_image') {
    if (assets.length !== 1) {
      throw new Error('Single-image mode requires exactly one asset.');
    }
    return;
  }

  if (assets.length < 2 || assets.length > 4) {
    throw new Error('Multi-view mode requires 2 to 4 assets.');
  }

  const roles = assets.map((asset) => asset.role).filter((role): role is typeof MULTI_VIEW_ROLES[number] => role !== 'single');
  const unique = new Set(roles);
  if (roles.length !== unique.size) {
    throw new Error('Duplicate view roles are not allowed.');
  }
  if (!roles.includes('front')) {
    throw new Error('Multi-view mode requires a front image.');
  }
}

export function qualityToResolution(quality: QualityPreset) {
  return quality === 'fast' ? '1536fast' : '1536pro';
}

export function normalizeHi3DFaceCount(faceCount: string) {
  return faceCount === 'standard' ? DEFAULT_SINGLE_IMAGE_FACE_COUNT : faceCount;
}

export function buildProviderOptions(input: { providerId: ProviderId; mode: GenerationMode; model: string; quality: QualityPreset; pbr: boolean }) {
  if (input.providerId === 'hi3d') {
    return {
      model: input.model,
      quality: input.quality,
      resolution: qualityToResolution(input.quality),
      faceCount: input.mode === 'single_image' ? DEFAULT_SINGLE_IMAGE_FACE_COUNT : 'high',
      pbr: input.pbr,
    };
  }

  return {
    quality: input.quality,
    pbr: input.pbr,
  };
}
