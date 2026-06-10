import fs from 'node:fs/promises';
import path from 'node:path';

import { getOriginalFilenameForPreview, isPreviewFilename } from '@/lib/preview-glb';
import { readStorageObject } from '@/lib/storage';

const bundledSampleAssetsRoot = path.resolve(process.cwd(), 'assets');

function isLocalSampleStorage() {
  return process.env.STORAGE_DRIVER === 'local';
}

async function readBundledOriginalSample(name: string) {
  return fs.readFile(path.join(bundledSampleAssetsRoot, name));
}

export async function readSampleAsset(name: string) {
  if (isLocalSampleStorage() && !isPreviewFilename(name)) {
    return { buffer: await readBundledOriginalSample(name), fallback: false };
  }

  try {
    return { buffer: await readStorageObject(`samples/${name}`), fallback: false };
  } catch (error) {
    if (!isPreviewFilename(name) || process.env.SAMPLE_PREVIEW_FALLBACK_ORIGINAL === 'false') {
      throw error;
    }

    const originalName = getOriginalFilenameForPreview(name);
    if (isLocalSampleStorage()) {
      return { buffer: await readBundledOriginalSample(originalName), fallback: true };
    }

    return { buffer: await readStorageObject(`samples/${originalName}`), fallback: true };
  }
}
