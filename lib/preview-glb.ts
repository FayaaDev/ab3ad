import path from 'node:path';

export const PREVIEW_GLB_VERSION = 'preview-v1';
export const PREVIEW_GLB_EXTENSION = `.${PREVIEW_GLB_VERSION}.glb`;

export type PreviewGlbOptions = {
  simplifyRatio?: number;
  simplifyError?: number;
  textureSize?: number;
  textureQuality?: number;
};

export type PreviewGlbSummary = {
  sourceBytes: number;
  previewBytes: number;
  reductionRatio: number;
};

const DEFAULT_OPTIONS: Required<PreviewGlbOptions> = {
  simplifyRatio: Number(process.env.PREVIEW_GLB_SIMPLIFY_RATIO ?? '0.35') || 0.35,
  simplifyError: Number(process.env.PREVIEW_GLB_SIMPLIFY_ERROR ?? '0.001') || 0.001,
  textureSize: Number(process.env.PREVIEW_GLB_TEXTURE_SIZE ?? '1024') || 1024,
  textureQuality: Number(process.env.PREVIEW_GLB_TEXTURE_QUALITY ?? '72') || 72,
};

function withoutGlbExtension(name: string) {
  return name.replace(/\.glb$/i, '');
}

export function getPreviewFilename(filename: string) {
  return `${withoutGlbExtension(path.basename(filename))}${PREVIEW_GLB_EXTENSION}`;
}

export function isPreviewFilename(filename: string) {
  return path.basename(filename).endsWith(PREVIEW_GLB_EXTENSION);
}

export function getOriginalFilenameForPreview(filename: string) {
  const basename = path.basename(filename);
  if (!isPreviewFilename(basename)) {
    return basename;
  }
  return `${basename.slice(0, -PREVIEW_GLB_EXTENSION.length)}.glb`;
}

export function getPreviewStorageKey(storageKey: string) {
  const normalized = storageKey.split(path.sep).join('/');
  const dirname = path.posix.dirname(normalized);
  const previewName = getPreviewFilename(path.posix.basename(normalized));
  return dirname === '.' ? previewName : path.posix.join(dirname, previewName);
}

export function getSamplePreviewRoute(src: string) {
  return src.replace(/\/api\/assets\/samples\/([^/?#]+\.glb)([?#].*)?$/i, (_match, filename: string, suffix = '') => {
    return `/api/assets/samples/${getPreviewFilename(filename)}${suffix}`;
  });
}

export function summarizePreview(sourceBytes: number, previewBytes: number): PreviewGlbSummary {
  return {
    sourceBytes,
    previewBytes,
    reductionRatio: sourceBytes > 0 ? previewBytes / sourceBytes : 1,
  };
}

async function createPreviewIO() {
  const [{ NodeIO }, { ALL_EXTENSIONS }, draco3d, meshoptimizer] = await Promise.all([
    import('@gltf-transform/core'),
    import('@gltf-transform/extensions'),
    import('draco3dgltf'),
    import('meshoptimizer'),
  ]);
  const { MeshoptDecoder, MeshoptEncoder } = meshoptimizer;
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);

  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

export async function generatePreviewGlb(source: Buffer | Uint8Array, options: PreviewGlbOptions = {}) {
  const [{ dedup, draco, prune, resample, simplify, textureCompress, weld }, meshoptimizer] = await Promise.all([
    import('@gltf-transform/functions'),
    import('meshoptimizer'),
  ]);
  const { MeshoptSimplifier } = meshoptimizer;
  await MeshoptSimplifier.ready;

  const pipelineOptions = { ...DEFAULT_OPTIONS, ...options };
  const io = await createPreviewIO();
  const document = await io.readBinary(source instanceof Uint8Array ? source : new Uint8Array(source));

  await document.transform(
    resample(),
    dedup(),
    prune({ keepAttributes: false, keepSolidTextures: false }),
    weld({}),
    simplify({
      simplifier: MeshoptSimplifier,
      ratio: pipelineOptions.simplifyRatio,
      error: pipelineOptions.simplifyError,
    }),
    textureCompress({
      targetFormat: 'webp',
      resize: [pipelineOptions.textureSize, pipelineOptions.textureSize],
      quality: pipelineOptions.textureQuality,
      effort: 70,
      slots: /^(?!normalTexture).*$/,
    }),
    draco({ method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5 }),
    prune({ keepAttributes: false, keepSolidTextures: false }),
  );

  return Buffer.from(await io.writeBinary(document));
}
