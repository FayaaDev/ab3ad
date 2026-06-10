---
name: sample-preview-model
description: Homepage sample showcase models, preview GLB samples, modelMarquee, assets/*.glb, data/storage/samples/*.preview-v1.glb. Use when adding or updating showcased sample models so the existing sample preview pipeline, allowlists, verification, and deploy steps are followed exactly.
---

# Sample Preview Model

Use this skill only for homepage and sample showcase models, not for user-generated job previews.

## Goal

Add or update showcased sample models using the existing preview GLB pipeline so:

- the homepage renders the lightweight `*.preview-v1.glb` asset
- the app sample route can serve that preview under `/api/assets/samples/*`
- production does not silently fall back to the original full GLB

## Required workflow

1. Add the full source `.glb` to `assets/`.
2. Generate the preview GLB with `npm run previews:generate`.
3. Confirm the generated preview exists in `data/storage/samples/` with the versioned filename from `lib/preview-glb.ts`.
4. Update the homepage sample entry in `locales/ar.json` if the showcased model list changed.
5. Update the sample allowlist in `app/api/assets/samples/[name]/route.ts` so the sample route can serve both the original and preview filenames.
6. Keep homepage/sample previews routed through `/api/assets/samples/*.preview-v1.glb` rather than pointing directly at an external sample host. This preserves server-side fallback behavior while preview files are being rolled out.
7. If production is part of the task, upload the generated preview file to the production R2 `samples/` prefix before considering the work complete.

## Files to check

- `assets/`
- `data/storage/samples/`
- `scripts/generate-preview-glbs.ts`
- `lib/preview-glb.ts`
- `lib/sample-assets.ts`
- `app/api/assets/samples/[name]/route.ts`
- `locales/ar.json`
- `docs/preview-glb-pipeline.md`

## Verification

Run the normal quality gates when code changes:

```bash
npm run lint
npm test
npm run build
```

For sample preview model work, also verify:

1. The homepage requests `/api/assets/samples/<name>.preview-v1.glb`.
2. The sample route does not return `X-Preview-Fallback: original` once the preview file is present in production storage.
3. The preview model renders in `model-viewer` without falling back to the original full-size GLB.

## Do not do this

- Do not add a showcased sample model without generating its preview asset.
- Do not treat a production fallback response as success.
- Do not mix homepage/sample showcase work with user job result download behavior. User downloads must remain the original full-size GLB.
