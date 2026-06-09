import fs from 'node:fs/promises';
import path from 'node:path';

const storageRoot = path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? './data/storage');

export function absoluteStoragePath(storageKey: string) {
  return path.join(storageRoot, storageKey);
}

export async function saveStorageObject(storageKey: string, data: Buffer) {
  const filePath = absoluteStoragePath(storageKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, data);
  return filePath;
}

export async function readStorageObject(storageKey: string) {
  return fs.readFile(absoluteStoragePath(storageKey));
}

export async function fetchToStorage(storageKey: string, sourceUrl: string) {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download result: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await saveStorageObject(storageKey, buffer);
  return buffer;
}
