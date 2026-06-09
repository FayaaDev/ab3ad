import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createFileAsset } from '@/lib/store';
import { saveStorageObject } from '@/lib/storage';
import { fileToBuffer, sanitizeFilename, sha256 } from '@/lib/utils';
import type { ViewRole } from '@/lib/types';
import { assertValidUpload } from '@/lib/validation';
import { v4 as uuid } from 'uuid';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const formData = await request.formData();
    const mode = String(formData.get('mode') ?? 'single_image');
    const incomingRole = String(formData.get('view_role') ?? (mode === 'multi_view' ? '' : 'single'));
    const files = formData.getAll('files').filter((item): item is File => item instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    const uploadedAssets = [];
    for (const file of files) {
      const buffer = await fileToBuffer(file);
      assertValidUpload(file, buffer);
      const safeName = sanitizeFilename(file.name);
      const storageKey = path.join('uploads', user.id, `${uuid()}-${safeName}`);
      await saveStorageObject(storageKey, buffer, file.type || 'application/octet-stream');
      const asset = await createFileAsset({
        userId: user.id,
        storageKey,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        sha256: await sha256(buffer),
        role: incomingRole as ViewRole,
      });
      uploadedAssets.push(asset);
    }

    return NextResponse.json({ assetIds: uploadedAssets.map((asset) => asset.id), assets: uploadedAssets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed.' }, { status: 400 });
  }
}
