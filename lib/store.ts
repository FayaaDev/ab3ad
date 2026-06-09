import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import type { BillingEvent, Database, FileAsset, GenerationJob, JobEvent, User } from '@/lib/types';
import { nowIso } from '@/lib/utils';

const dbPath = path.join(process.cwd(), 'data', 'db.json');

async function readDb(): Promise<Database> {
  const raw = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(raw) as Database;
}

async function writeDb(db: Database) {
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
}

async function updateDb<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const db = await readDb();
  const result = await fn(db);
  await writeDb(db);
  return result;
}

export async function ensureUser(userId: string) {
  return updateDb((db) => {
    let user = db.users.find((item) => item.id === userId);
    if (!user) {
      user = {
        id: userId,
        email: `${userId}@ab3ad.local`,
        name: userId,
        createdAt: nowIso(),
      };
      db.users.push(user);
    }
    return user;
  });
}

export async function getUser(userId: string) {
  const db = await readDb();
  return db.users.find((item) => item.id === userId) ?? null;
}

export async function createFileAsset(asset: Omit<FileAsset, 'id' | 'createdAt'>) {
  return updateDb((db) => {
    const created: FileAsset = {
      ...asset,
      id: uuid(),
      createdAt: nowIso(),
    };
    db.fileAssets.push(created);
    return created;
  });
}

export async function getFileAssets(ids: string[]) {
  const db = await readDb();
  return db.fileAssets.filter((item) => ids.includes(item.id));
}

export async function getFileAsset(id: string) {
  const db = await readDb();
  return db.fileAssets.find((item) => item.id === id) ?? null;
}

export async function createGenerationJob(job: Omit<GenerationJob, 'id' | 'createdAt' | 'updatedAt'>) {
  return updateDb((db) => {
    const created: GenerationJob = {
      ...job,
      id: uuid(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.generationJobs.push(created);
    return created;
  });
}

export async function updateGenerationJob(jobId: string, patch: Partial<GenerationJob>) {
  return updateDb((db) => {
    const job = db.generationJobs.find((item) => item.id === jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    Object.assign(job, patch, { updatedAt: nowIso() });
    return job;
  });
}

export async function getGenerationJob(jobId: string) {
  const db = await readDb();
  return db.generationJobs.find((item) => item.id === jobId) ?? null;
}

export async function listGenerationJobs(limit = 50) {
  const db = await readDb();
  return [...db.generationJobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export async function addJobEvent(event: Omit<JobEvent, 'id' | 'createdAt'>) {
  return updateDb((db) => {
    const created: JobEvent = {
      ...event,
      id: uuid(),
      createdAt: nowIso(),
    };
    db.jobEvents.push(created);
    return created;
  });
}

export async function listJobEvents(jobId: string) {
  const db = await readDb();
  return db.jobEvents.filter((item) => item.jobId === jobId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addBillingEvent(event: Omit<BillingEvent, 'id' | 'createdAt'>) {
  return updateDb((db) => {
    const created: BillingEvent = {
      ...event,
      id: uuid(),
      createdAt: nowIso(),
    };
    db.billingEvents.push(created);
    return created;
  });
}

export async function getJobWithAssets(jobId: string) {
  const db = await readDb();
  const job = db.generationJobs.find((item) => item.id === jobId) ?? null;
  const assets = job ? db.fileAssets.filter((item) => job.assetIds.includes(item.id)) : [];
  return { job, assets };
}

export async function getAllData() {
  return readDb();
}
