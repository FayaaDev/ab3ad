import assert from 'node:assert/strict';
import test from 'node:test';

import { getModelMarqueeModels, resolveSampleAssetUrl } from '../lib/sample-assets';

function restoreEnv(key: 'SAMPLE_ASSET_BASE_URL' | 'NEXT_PUBLIC_SAMPLE_ASSET_BASE_URL', value: string | undefined) {
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

    assert.equal(resolveSampleAssetUrl('/api/assets/samples/Alisa.glb'), '/api/assets/samples/Alisa.glb');
  } finally {
    restoreEnv('SAMPLE_ASSET_BASE_URL', previousBaseUrl);
    restoreEnv('NEXT_PUBLIC_SAMPLE_ASSET_BASE_URL', previousPublicBaseUrl);
  }
});

test('sample asset URLs can be rewritten to a public asset host', () => {
  const previousBaseUrl = process.env.SAMPLE_ASSET_BASE_URL;

  try {
    process.env.SAMPLE_ASSET_BASE_URL = 'https://assets.example.com/samples/';

    assert.equal(resolveSampleAssetUrl('/api/assets/samples/Alisa.glb'), 'https://assets.example.com/samples/Alisa.glb');
    assert.equal(getModelMarqueeModels()[0]?.src.startsWith('https://assets.example.com/samples/'), true);
  } finally {
    restoreEnv('SAMPLE_ASSET_BASE_URL', previousBaseUrl);
  }
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
