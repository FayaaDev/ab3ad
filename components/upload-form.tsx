'use client';

import { useEffect, useMemo, useState } from 'react';
import Uppy from '@uppy/core';
import { DragDrop } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import { ArrowLeft } from 'lucide-react';
import '@uppy/core/dist/style.min.css';
import '@uppy/drag-drop/dist/style.min.css';

import { InlineGenerationProgress } from '@/components/inline-generation-progress';
import { Button } from '@/components/ui/button';
import { interpolate, messages } from '@/lib/messages';
import { cn } from '@/lib/utils';

const DEFAULT_MODE = 'single_image';
const DEFAULT_QUALITY = 'high';

type UploadedAsset = {
  id: string;
  role: string;
};

type SelectedFile = {
  id: string;
  name: string;
  size: number;
};

export function UploadForm() {
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isJobTerminal, setIsJobTerminal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadMessages = messages.uploadForm;

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
      setActiveJobId(null);
      setIsJobTerminal(false);
      setUploadedAssets([]);
      syncSelectedFiles();
    });
    instance.on('file-removed', () => {
      setActiveJobId(null);
      setIsJobTerminal(false);
      syncSelectedFiles();
    });
    instance.on('cancel-all', () => {
      setActiveJobId(null);
      setIsJobTerminal(false);
      setUploadedAssets([]);
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

  async function uploadThenGenerate() {
    setError(null);
    setIsSubmitting(true);

    try {
      const files = uppy.getFiles();
      if (!files.length) {
        throw new Error(uploadMessages.errors.addImage);
      }

      uppy.setMeta({ mode: DEFAULT_MODE, view_role: 'single' });
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
          assetIds,
          mode: DEFAULT_MODE,
          model: 'hitem3dv2.1',
          quality: DEFAULT_QUALITY,
          outputFormat: 'glb',
          pbr: true,
        }),
      });

      const generationBody = (await generationResponse.json()) as { jobId?: string; error?: string };
      if (generationResponse.status === 401) {
        window.location.href = '/login?next=/';
        return;
      }
      if (!generationResponse.ok || !generationBody.jobId) {
        throw new Error(generationBody.error || uploadMessages.errors.generationRequestFailed);
      }

      setActiveJobId(generationBody.jobId);
      setIsJobTerminal(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : uploadMessages.errors.generationStartFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 rounded-[2rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">{uploadMessages.title}</p>
          <p className="text-xs tracking-[0.08em] text-[color:var(--muted)]">{uploadMessages.mockModeNote}</p>
        </div>

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

        {/*
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{uploadMessages.mode}</span>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-1">
              <select className="w-full appearance-none rounded-[1.2rem] border border-white/10 bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none">
                <option className="bg-[#0b0d12]" value="single_image">
                  {uploadMessages.modeSingle}
                </option>
              </select>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">{uploadMessages.quality}</span>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-1">
              <select className="w-full appearance-none rounded-[1.2rem] border border-white/10 bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none">
                <option className="bg-[#0b0d12]" value="high">
                  {uploadMessages.qualityHigh}
                </option>
              </select>
            </div>
          </label>
        </div>
        */}

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

        {error ? <p className="rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={isSubmitting || Boolean(activeJobId && !isJobTerminal)} onClick={uploadThenGenerate} size="lg" type="button">
            {isSubmitting ? uploadMessages.submitting : activeJobId && !isJobTerminal ? uploadMessages.generating : uploadMessages.submit}
            <ArrowLeft className="size-4" />
          </Button>
          <p className="text-xs text-[color:var(--muted)]">{uploadMessages.singleLimit}</p>
        </div>

        {activeJobId ? <InlineGenerationProgress jobId={activeJobId} onTerminalStateChange={setIsJobTerminal} /> : null}
      </div>
    </div>
  );
}
