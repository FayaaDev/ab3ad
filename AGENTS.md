# Agent Instructions

## Project
- `ab3ad` is a Next.js app for generating 3D models from uploaded images through Hi3D.
- Frontend: upload page, job status page, login page, admin page.
- Backend: App Router API routes under `app/api/**`.
- Persistence uses the production-style stack:
  - PostgreSQL for users/assets/jobs/events/billing
  - Redis + BullMQ for background job execution
  - S3-compatible object storage for uploads and results
- Authentication is now email/password with signed HTTP-only session cookies.
- Admin access is restricted via authenticated admin users / allowlists.
- Hi3D integration lives in `lib/hi3d-client.ts`.
- Job orchestration lives in `lib/job-runner.ts`.
- Validation lives in `lib/validation.ts`.
- Health/readiness checks live in `lib/ops.ts`, `app/api/health/route.ts`, and `scripts/healthcheck.ts`.
- Local/dev default is `HI3D_MODE=mock`; production should use real Hi3D credentials plus callback signing.

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
- Do not reintroduce `x-demo-user` or other client-controlled identity shortcuts.
- Keep `/api/health` protected by admin auth or `HEALTHCHECK_TOKEN`.
- Keep Hi3D callback verification and trusted result-host checks intact when modifying production flows.

## Key Files
- `app/page.tsx` — upload UI / auth gate
- `app/login/page.tsx` — login/register page
- `app/jobs/[jobId]/page.tsx` — job progress UI
- `app/admin/page.tsx` — admin jobs table with failure diagnostics
- `app/api/auth/**` — auth/session endpoints
- `app/api/uploads/route.ts` — file uploads
- `app/api/generations/**` — create/status/download/retry
- `app/api/hi3d/callback/route.ts` — signed Hi3D callback handler
- `app/api/health/route.ts` — protected readiness endpoint
- `lib/auth.ts` / `lib/auth-utils.ts` — auth and session helpers
- `lib/hi3d-client.ts` — Hi3D submission/query client
- `lib/job-runner.ts` — polling fallback, callback completion, durable downloads
- `lib/store.ts` — PostgreSQL persistence helpers
- `lib/storage.ts` — local/S3/R2 storage helpers
- `lib/hi3d-security.ts` — callback/result URL hardening
- `tests/validation.test.ts` — validation tests
- `tests/auth-utils.test.ts` / `tests/hi3d-security.test.ts` — auth and Hi3D security tests
- `plan.md` — product and architecture plan

## Quality Gates
- Install deps: `npm install`
- Lint/types: `npm run lint`
- Tests: `npm test`
- Production build: `npm run build`
- Local run: `npm run dev`

## Known Follow-ups
- Add signed upload URLs if direct-to-bucket uploads are needed later.
- Add explicit multi-view role labeling in the UI.
- Add broader production smoke tests that exercise the full app + worker + infra stack live.
- If real Hi3D contract details differ, adjust callback field names / extra submit fields via env before changing code.

## Session Close
- If code changed: run lint, tests, and build.
- Close completed beads issues.
- If a git remote exists, `git pull --rebase && git push` before ending.
