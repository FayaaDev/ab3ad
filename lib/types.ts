export const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const MAX_UPLOAD_BYTES = (Number(process.env.MAX_UPLOAD_MB ?? '20') || 20) * 1024 * 1024;
export const MULTI_VIEW_ROLES = ['front', 'back', 'left', 'right'] as const;
export type ViewRole = 'single' | (typeof MULTI_VIEW_ROLES)[number];
export type GenerationMode = 'single_image' | 'multi_view';
export type OutputFormat = 'glb' | 'obj' | 'stl' | 'fbx' | 'usdz';
export type QualityPreset = 'fast' | 'high';

export type JobStatus =
  | 'draft'
  | 'uploaded'
  | 'queued'
  | 'submitted_to_hi3d'
  | 'hi3d_created'
  | 'hi3d_queueing'
  | 'hi3d_processing'
  | 'downloading_result'
  | 'result_download_failed'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface FileAsset {
  id: string;
  userId: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  role: ViewRole;
  createdAt: string;
}

export interface GenerationJob {
  id: string;
  userId: string;
  assetIds: string[];
  mode: GenerationMode;
  status: JobStatus;
  model: string;
  resolution: string;
  faceCount: string;
  pbr: boolean;
  outputFormat: OutputFormat;
  hi3dTaskId?: string;
  resultAssetId?: string;
  previewAssetId?: string;
  coverAssetId?: string;
  errorCode?: string;
  errorMessage?: string;
  pollAttempts?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface JobEvent {
  id: string;
  jobId: string;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export const WALLET_EVENT_TYPES = ['wallet_deposit', 'admin_credit_grant', 'generation_completed'] as const;
export type WalletEventType = (typeof WALLET_EVENT_TYPES)[number];

export interface BillingEvent {
  id: string;
  userId: string;
  jobId?: string;
  eventType: WalletEventType;
  creditDelta: number;
  createdAt: string;
}

export interface WalletSummary {
  userId: string;
  email: string;
  name: string;
  balance: number;
  recentEvents: BillingEvent[];
}

export interface Database {
  users: User[];
  fileAssets: FileAsset[];
  generationJobs: GenerationJob[];
  jobEvents: JobEvent[];
  billingEvents: BillingEvent[];
}

export interface Hi3DTaskResult {
  modelUrl: string;
  coverUrl?: string;
}

export interface Hi3DTaskResponse {
  taskId: string;
  raw: Record<string, unknown>;
}

export interface Hi3DQueryResponse {
  status: 'created' | 'queueing' | 'processing' | 'success' | 'failed';
  result?: Hi3DTaskResult;
  errorCode?: string;
  errorMessage?: string;
  raw: Record<string, unknown>;
}
