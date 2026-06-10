import { NextResponse } from 'next/server';
import { getOriginalFilenameForPreview, getPreviewFilename, isPreviewFilename } from '@/lib/preview-glb';
import { readStorageObject } from '@/lib/storage';

const ORIGINAL_SAMPLE_ASSETS = ['Abdo-Ab3ad3d.glb', 'Alisa.glb', 'dabbrini.glb', 'Sager-Ab3ad3d.glb', 'Talal-Ab3ad3d.glb'];
const ALLOWED_ASSETS = new Set([...ORIGINAL_SAMPLE_ASSETS, ...ORIGINAL_SAMPLE_ASSETS.map((name) => getPreviewFilename(name))]);

async function readSampleAsset(name: string) {
  try {
    return { buffer: await readStorageObject(`samples/${name}`), fallback: false };
  } catch (error) {
    if (!isPreviewFilename(name) || process.env.SAMPLE_PREVIEW_FALLBACK_ORIGINAL === 'false') {
      throw error;
    }
    const originalName = getOriginalFilenameForPreview(name);
    return { buffer: await readStorageObject(`samples/${originalName}`), fallback: true };
  }
}

export async function GET(_: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;

  if (!ALLOWED_ASSETS.has(name)) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  try {
    const { buffer, fallback } = await readSampleAsset(name);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': fallback ? 'public, max-age=300, s-maxage=300' : 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Content-Disposition': `inline; filename="${name}"`,
        ...(fallback ? { 'X-Preview-Fallback': 'original' } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }
}
