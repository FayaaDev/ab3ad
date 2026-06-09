# Agent Instructions

## Project
- `ab3ad` is a Next.js MVP for generating 3D models from uploaded images.
- Frontend: upload page, job status page, admin page.
- Backend: App Router API routes under `app/api/**`.
- Persistence uses the production-style stack:
  - PostgreSQL for users/assets/jobs/events/billing
  - Redis + BullMQ for background job execution
  - S3-compatible object storage for uploads and results
- Hi3D integration lives in `lib/hi3d-client.ts`.
- Job orchestration lives in `lib/job-runner.ts`.
- Validation lives in `lib/validation.ts`.
- Local/dev default is `HI3D_MODE=mock`.

## Beads
- Use `bd` for task tracking; do not use markdown TODOs.
- Start with `bd prime`.
- Common commands:
```bash
bd ready
bd show <id>
bd update <id> --claim
bd close <id>
```
- Use `bd remember "note"` for persistent knowledge.

## Working Rules
- Prefer `rg`, `find`, and `read` for inspection.
- Use non-interactive shell flags: `cp -f`, `mv -f`, `rm -f`, `rm -rf`.
- Keep secrets server-side only; never expose Hi3D credentials to the browser.
- Do not rely on temporary Hi3D result URLs; results must be downloaded into local/object storage.
- Preserve ownership checks on job and file endpoints.

## Key Files
- `app/page.tsx` — upload UI
- `app/jobs/[jobId]/page.tsx` — job progress UI
- `app/admin/page.tsx` — admin jobs table
- `app/api/uploads/route.ts` — file uploads
- `app/api/generations/**` — create/status/download/retry
- `app/api/hi3d/callback/route.ts` — Hi3D callback
- `lib/store.ts` — PostgreSQL persistence helpers
- `lib/storage.ts` — S3/R2 storage helpers
- `tests/validation.test.ts` — core tests
- `plan.md` — product and architecture plan

## Quality Gates
- Install deps: `npm install`
- Lint/types: `npm run lint`
- Tests: `npm test`
- Production build: `npm run build`
- Local run: `npm run dev`

## Known Follow-ups
- Add signed upload URLs if direct-to-bucket uploads are needed later.
- Add real authentication.
- Add explicit multi-view role labeling in the UI.

## Session Close
- If code changed: run lint, tests, and build.
- Close completed beads issues.
- If a git remote exists, `git pull --rebase && git push` before ending.
