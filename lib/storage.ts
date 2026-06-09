import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getR2BucketBinding } from '@/lib/cloudflare';
import { assertTrustedResultUrl } from '@/lib/hi3d-security';

type StorageDriver = 'local' | 'r2';

const storageRoot = path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? './data/storage');
let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function getStorageDriver(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? 'r2';

  if (driver === 'local' || driver === 'r2') {
    return driver;
  }
  throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
}

function normalizeStorageKey(storageKey: string) {
  const normalized = storageKey.split(path.sep).join('/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').includes('..')) {
    throw new Error('Invalid storage key.');
  }
  return normalized;
}

function requireBucketName() {
  const bucketName = process.env.R2_BUCKET;
  if (!bucketName) {
    throw new Error('Missing R2_BUCKET. Configure Cloudflare R2 before using object storage.');
  }
  return bucketName;
}

function getObjectStorageConfig() {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT ?? (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

  if (!endpoint) {
    throw new Error('Missing R2_ACCOUNT_ID or R2_ENDPOINT.');
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 access key credentials.');
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: process.env.R2_REGION ?? 'auto',
    forcePathStyle: process.env.R2_FORCE_PATH_STYLE === 'true',
  };
}

function getStorageClient() {
  if (!client) {
    const config = getObjectStorageConfig();
    client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return client;
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    return Buffer.alloc(0);
  }
  if (body instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof body === 'object' && body !== null && 'transformToByteArray' in body && typeof (body as { transformToByteArray?: unknown }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(bytes);
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  throw new Error('Unsupported object storage response body.');
}

async function ensureBucket() {
  const boundBucket = getR2BucketBinding();
  if (boundBucket) {
    await boundBucket.list({ limit: 1 });
    return;
  }

  if (!bucketReady) {
    bucketReady = (async () => {
      const Bucket = requireBucketName();
      await getStorageClient().send(new HeadBucketCommand({ Bucket }));
    })();
  }

  await bucketReady;
}

async function fetchWithTimeout(sourceUrl: string, timeoutMs = Number(process.env.STORAGE_FETCH_TIMEOUT_MS ?? '30000') || 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(sourceUrl, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Result download timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkStorageReadiness() {
  if (getStorageDriver() === 'local') {
    await fs.mkdir(storageRoot, { recursive: true });
    return { driver: 'local', target: storageRoot };
  }

  await ensureBucket();
  return { driver: getStorageDriver(), target: requireBucketName(), binding: Boolean(getR2BucketBinding()) };
}

export function absoluteStoragePath(storageKey: string) {
  const key = normalizeStorageKey(storageKey);
  if (getStorageDriver() === 'local') {
    return path.join(storageRoot, key);
  }
  return `${requireBucketName()}/${key}`;
}

export async function saveStorageObject(storageKey: string, data: Buffer, contentType = 'application/octet-stream') {
  const key = normalizeStorageKey(storageKey);
  if (getStorageDriver() === 'local') {
    const filePath = absoluteStoragePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
    return filePath;
  }

  const boundBucket = getR2BucketBinding();
  if (boundBucket) {
    await boundBucket.put(key, data, { httpMetadata: { contentType } });
    return absoluteStoragePath(key);
  }

  await ensureBucket();
  const Bucket = requireBucketName();
  await getStorageClient().send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
  return absoluteStoragePath(key);
}

export async function readStorageObject(storageKey: string) {
  const key = normalizeStorageKey(storageKey);
  if (getStorageDriver() === 'local') {
    return fs.readFile(absoluteStoragePath(key));
  }

  const boundBucket = getR2BucketBinding();
  if (boundBucket) {
    const object = await boundBucket.get(key);
    if (!object) {
      throw new Error('Object not found.');
    }
    return Buffer.from(await object.arrayBuffer());
  }

  const Bucket = requireBucketName();
  const response = await getStorageClient().send(
    new GetObjectCommand({
      Bucket,
      Key: key,
    }),
  );
  return bodyToBuffer(response.Body);
}

export async function fetchToStorage(storageKey: string, sourceUrl: string, contentType = 'application/octet-stream') {
  assertTrustedResultUrl(sourceUrl);
  const response = await fetchWithTimeout(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download result: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await saveStorageObject(storageKey, buffer, response.headers.get('content-type') ?? contentType);
  return buffer;
}
