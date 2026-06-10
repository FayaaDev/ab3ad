import { messages } from '@/lib/messages';

const SAMPLE_ROUTE_PREFIX = '/api/assets/samples/';

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '');
}

export function resolveSampleAssetUrl(src: string) {
  if (!src.startsWith(SAMPLE_ROUTE_PREFIX)) {
    return src;
  }

  const baseUrl = process.env.SAMPLE_ASSET_BASE_URL ?? process.env.NEXT_PUBLIC_SAMPLE_ASSET_BASE_URL;
  if (!baseUrl) {
    return src;
  }

  return `${trimTrailingSlashes(baseUrl)}/${src.slice(SAMPLE_ROUTE_PREFIX.length)}`;
}

export function getModelMarqueeModels() {
  return messages.modelMarquee.models.map((model) => ({
    ...model,
    src: resolveSampleAssetUrl(model.src),
  }));
}
