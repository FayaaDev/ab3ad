import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { getPreviewFilename, getSamplePreviewRoute } from '../lib/preview-glb';
import { readSampleAsset } from '../lib/sample-asset-storage';
import { getModelMarqueeModels, resolveSampleAssetUrl, resolveSamplePreviewAssetUrl } from '../lib/sample-assets';

function restoreEnv(
  key: 'SAMPLE_ASSET_BASE_URL' | 'NEXT_PUBLIC_SAMPLE_ASSET_BASE_URL' | 'STORAGE_DRIVER' | 'SAMPLE_PREVIEW_FALLBACK_ORIGINAL',
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

test('sample asset URLs fall back to the app route when no public base url is configured', () => {
  const previousBaseUrl = process.env.SAMPLE_ASSET_BASE_URL;
  const previousPublicBaseUrl = process.env.NEXT_PUBLIC_SAMPLE_ASSET_BASE_URL;

  try {
    delete process.env.SAMPLE_ASSET_BASE_URL;
    delete process.env.NEXT_PUBLIC_SAMPLE_ASSET_BASE_URL;

    assert.equal(resolveSampleAssetUrl('/api/assets/samples/abady.glb'), '/api/assets/samples/abady.glb');
  } finally {
    restoreEnv('SAMPLE_ASSET_BASE_URL', previousBaseUrl);
    restoreEnv('NEXT_PUBLIC_SAMPLE_ASSET_BASE_URL', previousPublicBaseUrl);
  }
});

test('sample asset URLs can be rewritten to a public asset host', () => {
  const previousBaseUrl = process.env.SAMPLE_ASSET_BASE_URL;

  try {
    process.env.SAMPLE_ASSET_BASE_URL = 'https://assets.example.com/samples/';

    assert.equal(resolveSampleAssetUrl('/api/assets/samples/abady.glb'), 'https://assets.example.com/samples/abady.glb');
    assert.equal(resolveSamplePreviewAssetUrl('/api/assets/samples/abady.glb'), '/api/assets/samples/abady.preview-v1.glb');
    assert.equal(getModelMarqueeModels()[0]?.src.startsWith('/api/assets/samples/'), true);
    assert.equal(getModelMarqueeModels()[0]?.src.endsWith('.preview-v1.glb'), true);
  } finally {
    restoreEnv('SAMPLE_ASSET_BASE_URL', previousBaseUrl);
  }
});

test('sample preview routes use versioned GLB names', () => {
  assert.equal(getPreviewFilename('abady.glb'), 'abady.preview-v1.glb');
  assert.equal(getSamplePreviewRoute('/api/assets/samples/abady.glb'), '/api/assets/samples/abady.preview-v1.glb');
});

test('showcased Mageed sample resolves to the preview route', () => {
  const mageedModel = getModelMarqueeModels().find((model) => model.src.includes('Mageed'));

  assert.ok(mageedModel);
  assert.equal(mageedModel.title, 'عبدالمجيد عبدالله');
  assert.equal(mageedModel.caption, 'أمير الطرب');
  assert.equal(mageedModel.src, '/api/assets/samples/Mageed.preview-v1.glb');
});

test('showcased abady sample resolves to the preview route', () => {
  const abadyModel = getModelMarqueeModels().find((model) => model.title === 'عبادي الجوهر');

  assert.ok(abadyModel);
  assert.equal(abadyModel.caption, 'أخطبوط العود');
  assert.equal(abadyModel.src, '/api/assets/samples/abady.preview-v1.glb');
});

test('non-sample asset URLs are left unchanged', () => {
  const previousBaseUrl = process.env.SAMPLE_ASSET_BASE_URL;

  try {
    process.env.SAMPLE_ASSET_BASE_URL = 'https://assets.example.com/samples';
    assert.equal(resolveSampleAssetUrl('https://cdn.example.com/model.glb'), 'https://cdn.example.com/model.glb');
  } finally {
    restoreEnv('SAMPLE_ASSET_BASE_URL', previousBaseUrl);
  }
});

test('local sample route serves bundled original sample assets', async () => {
  const previousStorageDriver = process.env.STORAGE_DRIVER;

  try {
    process.env.STORAGE_DRIVER = 'local';

    const { buffer, fallback } = await readSampleAsset('abady.glb');

    assert.equal(fallback, false);
    assert.ok(buffer.byteLength > 0);
  } finally {
    restoreEnv('STORAGE_DRIVER', previousStorageDriver);
  }
});

test('local sample route falls back from missing preview to bundled original asset', async () => {
  const previousStorageDriver = process.env.STORAGE_DRIVER;
  const previousPreviewFallback = process.env.SAMPLE_PREVIEW_FALLBACK_ORIGINAL;
  const previewPath = path.join(process.cwd(), 'data/storage/samples/abady.preview-v1.glb');
  const backupPath = `${previewPath}.bak`;

  try {
    process.env.STORAGE_DRIVER = 'local';
    delete process.env.SAMPLE_PREVIEW_FALLBACK_ORIGINAL;
    await fs.rename(previewPath, backupPath);

    const { buffer, fallback } = await readSampleAsset('abady.preview-v1.glb');

    assert.equal(fallback, true);
    assert.ok(buffer.byteLength > 0);
  } finally {
    await fs.rename(backupPath, previewPath).catch(() => undefined);
    restoreEnv('STORAGE_DRIVER', previousStorageDriver);
    restoreEnv('SAMPLE_PREVIEW_FALLBACK_ORIGINAL', previousPreviewFallback);
  }
});
