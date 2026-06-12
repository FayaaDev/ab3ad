import { NextResponse } from 'next/server';
import { getPreviewFilename } from '@/lib/preview-glb';
import { readSampleAsset } from '@/lib/sample-asset-storage';

const ORIGINAL_SAMPLE_ASSETS = [
  'abady.glb',
  'Abdo-Ab3ad3d.glb',
  'daeed.glb',
  'dabbrini.glb',
  'Gassibi.glb',
  'Mageed.glb',
  'MajidAbdullah.glb',
  'Sager-Ab3ad3d.glb',
  'SalimHilal.glb',
  'Talal-Ab3ad3d.glb',
];
const ALLOWED_ASSETS = new Set([...ORIGINAL_SAMPLE_ASSETS, ...ORIGINAL_SAMPLE_ASSETS.map((name) => getPreviewFilename(name))]);

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
