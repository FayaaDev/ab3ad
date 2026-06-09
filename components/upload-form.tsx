'use client';

import { useMemo, useState } from 'react';
import Uppy from '@uppy/core';
import { Dashboard } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import '@uppy/core/dist/style.min.css';
import '@uppy/dashboard/dist/style.min.css';

type Mode = 'single_image' | 'multi_view';
type Quality = 'fast' | 'high';

type UploadedAsset = {
  id: string;
  role: string;
};

export function UploadForm() {
  const [mode, setMode] = useState<Mode>('single_image');
  const [quality, setQuality] = useState<Quality>('fast');
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uppy = useMemo(() => {
    const instance = new Uppy({
      restrictions: {
        maxFileSize: 20 * 1024 * 1024,
        allowedFileTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
        maxNumberOfFiles: mode === 'single_image' ? 1 : 4,
      },
      autoProceed: false,
    });

    instance.use(XHRUpload, {
      endpoint: '/api/uploads',
      fieldName: 'files',
      formData: true,
      headers: {
        'x-demo-user': 'demo-user',
      },
      bundle: true,
    });

    instance.on('upload-success', async (_, response) => {
      const body = response.body as { assets?: UploadedAsset[] };
      if (body.assets) {
        setUploadedAssets(body.assets);
      }
    });

    instance.on('upload-error', (file, uploadError) => {
      const fileName = file?.name ?? 'file';
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
      setError(message || `Upload failed for ${fileName}`);
    });

    return instance;
  }, [mode]);

  async function uploadThenGenerate() {
    setError(null);
    setIsSubmitting(true);

    try {
      const files = uppy.getFiles();
      if (!files.length) {
        throw new Error('Please add at least one image.');
      }

      uppy.setMeta({ mode, view_role: mode === 'single_image' ? 'single' : 'front' });
      const result = await uppy.upload();
      if (!result) {
        throw new Error('Upload did not return a result.');
      }
      if ((result.failed?.length ?? 0) > 0) {
        const firstFailure = result.failed?.[0];
        const failureError = firstFailure?.error as { message?: string } | string | undefined;
        const message = typeof failureError === 'object' && failureError ? String(failureError.message ?? 'Upload failed.') : String(failureError ?? 'Upload failed.');
        throw new Error(message);
      }

      const assetIds = ((result.successful?.[0]?.response?.body as { assetIds?: string[] } | undefined)?.assetIds ?? uploadedAssets.map((asset) => asset.id));
      if (!assetIds.length) {
        throw new Error('Upload finished, but no asset IDs were returned.');
      }

      const generationResponse = await fetch('/api/generations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-demo-user': 'demo-user',
        },
        body: JSON.stringify({
          assetIds,
          mode,
          model: 'hitem3dv2.1',
          quality,
          outputFormat: 'glb',
          pbr: true,
        }),
      });

      const generationBody = (await generationResponse.json()) as { jobId?: string; error?: string };
      if (!generationResponse.ok || !generationBody.jobId) {
        throw new Error(generationBody.error || 'Generation request failed.');
      }

      window.location.href = `/jobs/${generationBody.jobId}`;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not start generation.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card stack-lg">
      <div className="controls-grid">
        <label>
          <span>Mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as Mode)}>
            <option value="single_image">Single image to 3D</option>
            <option value="multi_view">Multi-view to 3D</option>
          </select>
        </label>
        <label>
          <span>Quality</span>
          <select value={quality} onChange={(event) => setQuality(event.target.value as Quality)}>
            <option value="fast">Fast</option>
            <option value="high">High quality</option>
          </select>
        </label>
      </div>

      <Dashboard uppy={uppy} proudlyDisplayPoweredByUppy={false} height={360} note="PNG, JPG, WEBP · up to 20 MB each" />

      {mode === 'multi_view' ? <p className="helper">MVP note: the current UI uploads the selected batch together. Add front/back/left/right labeling before production use.</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <button className="primary-button" disabled={isSubmitting} onClick={uploadThenGenerate} type="button">
        {isSubmitting ? 'Uploading…' : 'Generate 3D model'}
      </button>
    </div>
  );
}
