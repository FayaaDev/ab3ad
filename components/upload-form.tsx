'use client';

import { useEffect, useMemo, useState } from 'react';
import Uppy from '@uppy/core';
import { DragDrop } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import { ArrowLeft, Loader2 } from 'lucide-react';
import '@uppy/core/dist/style.min.css';
import '@uppy/drag-drop/dist/style.min.css';

import { InlineGenerationProgress } from '@/components/inline-generation-progress';
import { Button } from '@/components/ui/button';
import { interpolate, messages } from '@/lib/messages';
import { cn } from '@/lib/utils';

type UploadedAsset = {
  id: string;
  role: string;
};

type SelectedFile = {
  id: string;
  name: string;
  size: number;
};

type ProviderCatalogEntry = {
  id: string;
  label: string;
  defaults: {
    mode: string;
    pbr: boolean;
  };
};

type TerminalNotice = 'completed' | 'other' | null;

const ACTIVE_JOB_STORAGE_KEY = 'ab3ad:active-job-id';
const completedProfileMessage = 'اكتمل النموذج. يمكنك تنزيله من ملفك الشخصي.';
const terminalProfileMessage = 'انتهت المهمة. يمكنك مراجعة التفاصيل من ملفك الشخصي.';
const modelLabel = 'النموذج';

function getProviderDisplayLabel(providerId: string) {
  if (providerId === 'hi3d') {
    return 'محرك الفا';
  }
  if (providerId === 'printpal') {
    return 'محرك بيتا';
  }
  return providerId;
}

export function UploadForm() {
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [terminalNotice, setTerminalNotice] = useState<TerminalNotice>(null);
  const [error, setError] = useState<string | null>(null);
  const [providerCatalog, setProviderCatalog] = useState<ProviderCatalogEntry[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [providerId, setProviderId] = useState('hi3d');
  const uploadMessages = messages.uploadForm;

  const selectedProvider = useMemo(
    () => providerCatalog.find((provider) => provider.id === providerId) ?? providerCatalog[0] ?? null,
    [providerCatalog, providerId],
  );

  function resetUploadState() {
    setActiveJobId(null);
    setUploadedAssets([]);
    setSelectedFiles([]);
    window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    uppy.cancelAll();
  }

  const uppy = useMemo(() => {
    const instance = new Uppy({
      restrictions: {
        maxFileSize: 20 * 1024 * 1024,
        allowedFileTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxNumberOfFiles: 1,
      },
      autoProceed: false,
    });

    instance.use(XHRUpload, {
      endpoint: '/api/uploads',
      fieldName: 'files',
      formData: true,
      bundle: true,
    });

    const syncSelectedFiles = () => {
      setSelectedFiles(
        instance.getFiles().map((file) => ({
          id: file.id,
          name: file.name ?? uploadMessages.unnamedFile,
          size: file.size ?? 0,
        })),
      );
    };

    instance.on('file-added', () => {
      setError(null);
      setTerminalNotice(null);
      setActiveJobId(null);
      setUploadedAssets([]);
      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      syncSelectedFiles();
    });
    instance.on('file-removed', () => {
      setTerminalNotice(null);
      setActiveJobId(null);
      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      syncSelectedFiles();
    });
    instance.on('cancel-all', () => {
      setTerminalNotice(null);
      setActiveJobId(null);
      setUploadedAssets([]);
      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      syncSelectedFiles();
    });
    instance.on('upload-success', async (_, response) => {
      const body = response.body as { assets?: UploadedAsset[] };
      if (body.assets) {
        setUploadedAssets(body.assets);
      }
    });

    instance.on('upload-error', (file, uploadError) => {
      const fileName = file?.name ?? uploadMessages.genericFile;
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
      setError(message || interpolate(uploadMessages.errors.uploadFileFailed, { fileName }));
    });

    return instance;
  }, [uploadMessages.genericFile, uploadMessages.unnamedFile, uploadMessages.errors.uploadFileFailed]);

  useEffect(() => {
    return () => {
      uppy.destroy();
    };
  }, [uppy]);

  useEffect(() => {
    if (terminalNotice) {
      window.dispatchEvent(new Event('wallet:refresh'));
    }
  }, [terminalNotice]);

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      try {
        const response = await fetch('/api/providers');
        const body = (await response.json()) as { providers?: ProviderCatalogEntry[]; error?: string };
        if (!response.ok || !body.providers?.length) {
          throw new Error(body.error || uploadMessages.errors.loadProvidersFailed);
        }

        if (!cancelled) {
          setProviderCatalog(body.providers);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : uploadMessages.errors.loadProvidersFailed);
        }
      } finally {
        if (!cancelled) {
          setProvidersLoaded(true);
        }
      }
    }

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, [uploadMessages.errors.loadProvidersFailed]);

  useEffect(() => {
    const storedJobId = window.localStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
    if (!storedJobId) {
      return;
    }

    let cancelled = false;

    async function loadStoredJob() {
      const response = await fetch(`/api/generations/${storedJobId}`);
      const body = (await response.json()) as { job?: { status: string }; error?: string };

      if (response.status === 401) {
        window.location.href = '/login?next=/';
        return;
      }

      if (!response.ok || !body.job) {
        window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        return;
      }

      if (!cancelled) {
        if (['completed', 'failed', 'result_download_failed', 'cancelled', 'expired'].includes(body.job.status)) {
          resetUploadState();
          setTerminalNotice(body.job.status === 'completed' ? 'completed' : 'other');
          return;
        }

        setActiveJobId(storedJobId);
      }
    }

    void loadStoredJob();

    return () => {
      cancelled = true;
    };
  }, []);

  async function uploadThenGenerate() {
    setError(null);
    setTerminalNotice(null);
    setIsSubmitting(true);

    try {
      const files = uppy.getFiles();
      if (!files.length) {
        throw new Error(uploadMessages.errors.addImage);
      }
      if (!selectedProvider) {
        throw new Error(uploadMessages.errors.loadProvidersFailed);
      }

      window.localStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      setActiveJobId(null);

      uppy.setMeta({ mode: selectedProvider.defaults.mode, view_role: 'single' });
      const result = await uppy.upload();
      if (!result) {
        throw new Error(uploadMessages.errors.missingUploadResult);
      }
      if ((result.failed?.length ?? 0) > 0) {
        const firstFailure = result.failed?.[0];
        const failureError = firstFailure?.error as { message?: string } | string | undefined;
        const message = typeof failureError === 'object' && failureError ? String(failureError.message ?? uploadMessages.errors.uploadFailed) : String(failureError ?? uploadMessages.errors.uploadFailed);
        throw new Error(message);
      }

      const assetIds = ((result.successful?.[0]?.response?.body as { assetIds?: string[] } | undefined)?.assetIds ?? uploadedAssets.map((asset) => asset.id));
      if (!assetIds.length) {
        throw new Error(uploadMessages.errors.missingAssetIds);
      }

      const generationResponse = await fetch('/api/generations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          providerId: selectedProvider.id,
          assetIds,
          mode: selectedProvider.defaults.mode,
          model: 'hitem3dv2.1',
          quality: 'high',
          outputFormat: 'glb',
          pbr: selectedProvider.defaults.pbr,
        }),
      });

      const generationBody = (await generationResponse.json()) as { jobId?: string; error?: string };
      if (generationResponse.status === 401) {
        window.location.href = '/login?next=/';
        return;
      }
      if (!generationResponse.ok || !generationBody.jobId) {
        if (generationResponse.status === 402) {
          throw new Error(uploadMessages.errors.insufficientBalance);
        }
        throw new Error(generationBody.error || uploadMessages.errors.generationRequestFailed);
      }

      setActiveJobId(generationBody.jobId);
      window.localStorage.setItem(ACTIVE_JOB_STORAGE_KEY, generationBody.jobId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : uploadMessages.errors.generationStartFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  const providersReady = providersLoaded && Boolean(selectedProvider);

  return (
    <div className="space-y-5 rounded-[2rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-1">
          <label className="space-y-2">
            <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{modelLabel}</span>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-1">
              <select
                className="w-full appearance-none rounded-[1.2rem] border border-white/10 bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                disabled={!providerCatalog.length || isSubmitting || Boolean(activeJobId)}
                onChange={(event) => setProviderId(event.target.value)}
                value={selectedProvider?.id ?? providerId}
              >
                {providerCatalog.map((provider) => (
                  <option className="bg-[#0b0d12]" key={provider.id} value={provider.id}>
                    {getProviderDisplayLabel(provider.id)}
                  </option>
                ))}
              </select>
            </div>
          </label>

        </div>

        {!selectedProvider && providersLoaded ? (
          <p className="rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{uploadMessages.errors.noProviders}</p>
        ) : null}

        <div className={cn('native-uploader overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-black/20 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)]', isSubmitting && 'ring-2 ring-[color:var(--ring)]')}>
          <DragDrop
            uppy={uppy}
            height="260px"
            locale={{
              strings: {
                dropHereOr: uploadMessages.dropHereOr,
                browse: uploadMessages.browse,
              },
            }}
            note={uploadMessages.dropzoneNote}
          />
        </div>

        {selectedFiles.length ? (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-[color:var(--foreground)]">
            <p className="mb-2 text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{uploadMessages.selectedFiles}</p>
            <ul className="space-y-1">
              {selectedFiles.map((file) => (
                <li className="flex items-center justify-between gap-3" key={file.id}>
                  <span className="truncate">{file.name}</span>
                  <span className="text-xs text-[color:var(--muted)]">{Math.max(1, Math.round(file.size / 1024))} KB</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {uploadedAssets.length ? (
          <p className="rounded-[1.25rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {uploadedAssets.length === 1 ? uploadMessages.uploadSuccessSingular : interpolate(uploadMessages.uploadSuccessPlural, { count: uploadedAssets.length })}
          </p>
        ) : null}

        {terminalNotice ? (
          <p className="rounded-[1.25rem] border border-[rgba(193,168,106,0.26)] bg-[rgba(193,168,106,0.12)] px-4 py-3 text-sm text-[color:var(--foreground)]">
            {terminalNotice === 'completed' ? completedProfileMessage : terminalProfileMessage}{' '}
            <a className="text-[color:var(--accent)] underline underline-offset-4" href="/profile">
              {messages.siteHeader.profile}
            </a>
          </p>
        ) : null}

        {error ? <p className="rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!providersReady || isSubmitting || Boolean(activeJobId)} onClick={uploadThenGenerate} size="lg" type="button">
            {isSubmitting ? uploadMessages.submitting : activeJobId ? uploadMessages.generating : uploadMessages.submit}
            {providersLoaded ? <ArrowLeft className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
          </Button>
          <p className="text-xs text-[color:var(--muted)]">{uploadMessages.singleLimit}</p>
        </div>

        {activeJobId ? (
          <InlineGenerationProgress
            jobId={activeJobId}
            onTerminalStateChange={({ isTerminal, status }) => {
              if (!isTerminal || !status) {
                return;
              }

              resetUploadState();
              setTerminalNotice(status === 'completed' ? 'completed' : 'other');
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
