# Preview GLB pipeline

The app keeps full-quality `.glb` files as the download source of truth and writes a separate, versioned preview `.glb` for gallery/model-viewer delivery.

## Naming and storage

- Full sample asset: `samples/Alisa.glb`
- Preview sample asset: `samples/Alisa.preview-v1.glb`
- Full generated result: `results/<userId>/<jobId>-<uuid>.glb`
- Preview generated result: `results/<userId>/<jobId>-<uuid>.preview-v1.glb`

`preview-v1` is intentionally part of the filename because sample assets are cached immutably when the preview exists. Bump `PREVIEW_GLB_VERSION` in `lib/preview-glb.ts` when the compression recipe changes.

## Compression recipe

`generatePreviewGlb()` in `lib/preview-glb.ts` uses glTF Transform in Node.js:

1. `resample()` to remove redundant animation keyframes.
2. `dedup()` and `prune()` to remove duplicate/unreferenced data.
3. `weld()` before simplification.
4. `simplify()` with Meshoptimizer, default `PREVIEW_GLB_SIMPLIFY_RATIO=0.35` and `PREVIEW_GLB_SIMPLIFY_ERROR=0.001`.
5. `textureCompress()` to WebP, resizing to `PREVIEW_GLB_TEXTURE_SIZE=1024` with `PREVIEW_GLB_TEXTURE_QUALITY=72` when the runtime encoder supports it.
6. `draco()` geometry compression using KHR_draco_mesh_compression.
7. Final `prune()` cleanup.

Quality target: previews should be materially smaller than the source GLB and optimized for fast homepage/gallery loading, not full-quality download or printing. Full model downloads remain unchanged.

## Commands

Generate local sample previews from checked-in source models:

```bash
npm run previews:generate
```

Optional flags:

```bash
npm run previews:generate -- --source-dir assets --output-dir data/storage/samples --models Alisa.glb,dabbrini.glb
```

For object storage deployments, upload the generated `*.preview-v1.glb` files to the same `samples/` prefix as the original full GLBs.

## Runtime integration

When a Hi3D job completes, `lib/job-runner.ts` stores the original result first, then attempts preview generation from that stored full model buffer. If preview generation succeeds, a `file_assets` row is created and `generation_jobs.preview_asset_id` is set. The job status API exposes it as `previewUrl` while `resultUrl` continues to point to `/api/generations/<jobId>/download` for the full model.

Preview failures are non-fatal: the worker records a `preview_generation_failed` event and still completes the original result download, wallet debit, and full-model availability.

For local development with `STORAGE_DRIVER=local`, the sample asset route keeps serving preview requests from `data/storage/samples/` but reads original sample GLBs from the bundled `assets/` directory. Production continues to serve both originals and previews from the storage backend.
