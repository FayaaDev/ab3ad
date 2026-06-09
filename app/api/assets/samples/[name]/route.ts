import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

const ASSET_DIRECTORY = path.join(process.cwd(), 'assets');
const ALLOWED_ASSETS = new Set([
  'Abdo-Hitem3d.glb',
  'Alisa.glb',
  'dabbrini.glb',
  'Sager-Hitem3d.glb',
  'Talal-Hitem3d.glb',
]);

export async function GET(_: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;

  if (!ALLOWED_ASSETS.has(name)) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  const assetPath = path.join(ASSET_DIRECTORY, name);

  try {
    await access(assetPath);
  } catch {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  const stream = createReadStream(assetPath);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'model/gltf-binary',
      'Cache-Control': 'public, max-age=3600',
      'Content-Disposition': `inline; filename="${name}"`,
    },
  });
}
