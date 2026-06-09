import test from 'node:test';
import assert from 'node:assert/strict';
import { mapHi3DStatus } from '../lib/utils';
import { qualityToResolution, validateAssetsForMode } from '../lib/validation';
import type { FileAsset } from '../lib/types';

const baseAsset: FileAsset = {
  id: 'asset-1',
  userId: 'demo-user',
  storageKey: 'uploads/demo-user/example.png',
  originalFilename: 'example.png',
  mimeType: 'image/png',
  sizeBytes: 1,
  sha256: 'abc',
  role: 'single',
  createdAt: new Date().toISOString(),
};

test('quality presets map to Hi3D resolutions', () => {
  assert.equal(qualityToResolution('fast'), '1536fast');
  assert.equal(qualityToResolution('high'), '1536pro');
});

test('single-image mode requires exactly one asset', () => {
  assert.doesNotThrow(() => validateAssetsForMode('single_image', [baseAsset]));
  assert.throws(() => validateAssetsForMode('single_image', [baseAsset, { ...baseAsset, id: 'asset-2' }]));
});

test('multi-view mode requires front image and unique roles', () => {
  const front = { ...baseAsset, id: 'front', role: 'front' as const };
  const back = { ...baseAsset, id: 'back', role: 'back' as const };
  assert.doesNotThrow(() => validateAssetsForMode('multi_view', [front, back]));
  assert.throws(() => validateAssetsForMode('multi_view', [back]));
  assert.throws(() => validateAssetsForMode('multi_view', [front, { ...front, id: 'front-2' }]));
});

test('Hi3D statuses map to internal states', () => {
  assert.equal(mapHi3DStatus('created'), 'hi3d_created');
  assert.equal(mapHi3DStatus('queueing'), 'hi3d_queueing');
  assert.equal(mapHi3DStatus('processing'), 'hi3d_processing');
  assert.equal(mapHi3DStatus('success'), 'downloading_result');
  assert.equal(mapHi3DStatus('failed'), 'failed');
});
