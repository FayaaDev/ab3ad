import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFileAsset } from '@/lib/store';
import { readStorageObject } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  const { assetId } = await params;
  const asset = await getFileAsset(assetId);

  if (!asset) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }
  if (asset.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const buffer = await readStorageObject(asset.storageKey);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': asset.mimeType,
      'content-disposition': `inline; filename="${path.basename(asset.originalFilename)}"`,
    },
  });
}
