'use client';

import { useEffect, useMemo, useState } from 'react';
import Uppy from '@uppy/core';
import { DragDrop } from '@uppy/react';
import XHRUpload from '@uppy/xhr-upload';
import { ArrowLeft } from 'lucide-react';
import '@uppy/core/dist/style.min.css';
import '@uppy/drag-drop/dist/style.min.css';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Mode = 'single_image' | 'multi_view';
type Quality = 'fast' | 'high';

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
  const [mode, setMode] = useState<Mode>('single_image');
  const [quality, setQuality] = useState<Quality>('fast');
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
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
      bundle: true,
    });

    const syncSelectedFiles = () => {
      setSelectedFiles(
        instance.getFiles().map((file) => ({
          id: file.id,
          name: file.name ?? 'ملف بدون اسم',
          size: file.size ?? 0,
        })),
      );
    };

    instance.on('file-added', () => {
      setError(null);
      setUploadedAssets([]);
      syncSelectedFiles();
    });
    instance.on('file-removed', syncSelectedFiles);
    instance.on('cancel-all', () => {
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
      const fileName = file?.name ?? 'الملف';
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
      setError(message || `فشل رفع الملف ${fileName}`);
    });

    return instance;
  }, [mode]);

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
        throw new Error('أضف صورة واحدة على الأقل.');
      }

      uppy.setMeta({ mode, view_role: mode === 'single_image' ? 'single' : 'front' });
      const result = await uppy.upload();
      if (!result) {
        throw new Error('لم تُرجع عملية الرفع نتيجة.');
      }
      if ((result.failed?.length ?? 0) > 0) {
        const firstFailure = result.failed?.[0];
        const failureError = firstFailure?.error as { message?: string } | string | undefined;
        const message = typeof failureError === 'object' && failureError ? String(failureError.message ?? 'فشل الرفع.') : String(failureError ?? 'فشل الرفع.');
        throw new Error(message);
      }

      const assetIds = ((result.successful?.[0]?.response?.body as { assetIds?: string[] } | undefined)?.assetIds ?? uploadedAssets.map((asset) => asset.id));
      if (!assetIds.length) {
        throw new Error('اكتمل الرفع، لكن لم يتم إرجاع معرّفات الملفات.');
      }

      const generationResponse = await fetch('/api/generations', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
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
      if (generationResponse.status === 401) {
        window.location.href = '/login?next=/';
        return;
      }
      if (!generationResponse.ok || !generationBody.jobId) {
        throw new Error(generationBody.error || 'فشل طلب التوليد.');
      }

      window.location.href = `/jobs/${generationBody.jobId}`;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'تعذر بدء التوليد.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-5 rounded-[2rem] border border-[color:var(--line)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-[11px] tracking-[0.18em] text-[color:var(--accent)]">استوديو الإرسال</p>
          <p className="text-xs tracking-[0.08em] text-[color:var(--muted)]">وضع المحاكاة مفعّل افتراضيًا أثناء التطوير المحلي</p>
        </div>

        <div className={cn('native-uploader overflow-hidden rounded-[1.75rem] border border-[color:var(--line)] bg-black/20 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)]', isSubmitting && 'ring-2 ring-[color:var(--ring)]')}>
          <DragDrop
            uppy={uppy}
            height="260px"
            locale={{
              strings: {
                dropHereOr: 'أسقط الصور هنا أو %{browse}',
                browse: 'تصفح الملفات',
              },
            }}
            note="PNG وJPG وWEBP · حتى 20 ميجابايت لكل ملف"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">الوضع</span>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-1">
              <select
                className="w-full appearance-none rounded-[1.2rem] border border-white/10 bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                value={mode}
                onChange={(event) => setMode(event.target.value as Mode)}
              >
                <option className="bg-[#0b0d12]" value="single_image">
                  صورة واحدة إلى نموذج ثلاثي الأبعاد
                </option>
                <option className="bg-[#0b0d12]" value="multi_view">
                  عدة زوايا إلى نموذج ثلاثي الأبعاد
                </option>
              </select>
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-[11px] tracking-[0.14em] text-[color:var(--muted)]">الجودة</span>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-1">
              <select
                className="w-full appearance-none rounded-[1.2rem] border border-white/10 bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                value={quality}
                onChange={(event) => setQuality(event.target.value as Quality)}
              >
                <option className="bg-[#0b0d12]" value="fast">
                  سريع
                </option>
                <option className="bg-[#0b0d12]" value="high">
                  عالية
                </option>
              </select>
            </div>
          </label>
        </div>

        {mode === 'multi_view' ? (
          <p className="rounded-[1.25rem] border border-[rgba(193,168,106,0.24)] bg-[rgba(193,168,106,0.08)] px-4 py-3 text-sm leading-6 text-[color:var(--muted-strong)]">
            في النسخة الحالية يتم رفع المجموعة دفعة واحدة. ما زلنا بحاجة إلى إضافة تسميات صريحة للأمام والخلف واليمين واليسار قبل الاستخدام الإنتاجي.
          </p>
        ) : null}

        {selectedFiles.length ? (
          <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm text-[color:var(--foreground)]">
            <p className="mb-2 text-[11px] tracking-[0.14em] text-[color:var(--muted)]">الملفات المحددة</p>
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

        {uploadedAssets.length ? <p className="rounded-[1.25rem] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">تم رفع {uploadedAssets.length} ملف{uploadedAssets.length > 1 ? 'ات' : ''} بنجاح.</p> : null}

        {error ? <p className="rounded-[1.25rem] border border-[rgba(245,168,161,0.22)] bg-[rgba(245,168,161,0.08)] px-4 py-3 text-sm text-[color:var(--danger)]">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={isSubmitting} onClick={uploadThenGenerate} size="lg" type="button">
            {isSubmitting ? 'جارٍ الرفع…' : 'ولّد النموذج ثلاثي الأبعاد'}
            <ArrowLeft className="size-4" />
          </Button>
          <p className="text-xs text-[color:var(--muted)]">
            {mode === 'single_image' ? 'بحد أقصى صورة واحدة' : 'حتى 4 صور'}
          </p>
        </div>
      </div>
    </div>
  );
}
