import path from 'node:path';
import { NextResponse } from 'next/server';
import { getFileAsset } from '@/lib/store';
import { readStorageObject } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const asset = await getFileAsset(assetId);

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  const buffer = await readStorageObject(asset.storageKey);
  return new NextResponse(buffer, {
    headers: {
      'content-type': asset.mimeType,
      'content-disposition': `inline; filename="${path.basename(asset.originalFilename)}"`,
    },
  });
}
