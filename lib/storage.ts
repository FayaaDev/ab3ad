import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';

type StorageDriver = 'local' | 'r2' | 's3';

const storageRoot = path.resolve(process.cwd(), process.env.STORAGE_ROOT ?? './data/storage');
let client: S3Client | null = null;
let bucketReady: Promise<void> | null = null;

function getStorageDriver(): StorageDriver {
  let driver = process.env.STORAGE_DRIVER;
  if (!driver && (process.env.R2_BUCKET || process.env.R2_ACCOUNT_ID || process.env.R2_ENDPOINT)) {
    driver = 'r2';
  }
  if (!driver && (process.env.S3_BUCKET || process.env.S3_ENDPOINT)) {
    driver = 's3';
  }
  driver ??= 'local';

  if (driver === 'local' || driver === 'r2' || driver === 's3') {
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
  const bucketName = process.env.R2_BUCKET ?? process.env.S3_BUCKET;
  if (!bucketName) {
    throw new Error('Missing R2_BUCKET or S3_BUCKET. Configure object storage before using the app.');
  }
  return bucketName;
}

function getObjectStorageConfig() {
  const driver = getStorageDriver();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? process.env.S3_SECRET_ACCESS_KEY;
  const endpoint =
    process.env.R2_ENDPOINT ??
    process.env.S3_ENDPOINT ??
    (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined);

  if (!endpoint) {
    throw new Error(driver === 'r2' ? 'Missing R2_ACCOUNT_ID or R2_ENDPOINT.' : 'Missing S3_ENDPOINT.');
  }
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing object storage access key credentials.');
  }

  return {
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: driver === 'r2' ? (process.env.R2_REGION ?? 'auto') : (process.env.S3_REGION ?? 'auto'),
    forcePathStyle: driver === 'r2' ? process.env.R2_FORCE_PATH_STYLE === 'true' : process.env.S3_FORCE_PATH_STYLE === 'true',
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
  if (!bucketReady) {
    bucketReady = (async () => {
      const Bucket = requireBucketName();
      const s3 = getStorageClient();
      try {
        await s3.send(new HeadBucketCommand({ Bucket }));
      } catch (error) {
        if (process.env.S3_AUTO_CREATE_BUCKET !== 'true') {
          throw error;
        }
        await s3.send(new CreateBucketCommand({ Bucket }));
      }
    })();
  }

  await bucketReady;
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
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download result: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await saveStorageObject(storageKey, buffer, response.headers.get('content-type') ?? contentType);
  return buffer;
}
