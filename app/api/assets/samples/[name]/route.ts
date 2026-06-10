import { NextResponse } from 'next/server';
import { readStorageObject } from '@/lib/storage';

const ALLOWED_ASSETS = new Set([
  'Abdo-Ab3ad3d.glb',
  'Alisa.glb',
  'dabbrini.glb',
  'Sager-Ab3ad3d.glb',
  'Talal-Ab3ad3d.glb',
]);

export async function GET(_: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;

  if (!ALLOWED_ASSETS.has(name)) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  try {
    const buffer = await readStorageObject(`samples/${name}`);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Content-Disposition': `inline; filename="${name}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }
}
