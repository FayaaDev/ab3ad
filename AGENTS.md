# Agent Instructions

## Project
- `ab3ad` is a Next.js app for generating 3D models from uploaded images through Ab3ad3d.
- The app is intended to behave like a production-shaped pipeline even in local dev: authenticated users upload source images, the app persists assets/jobs in PostgreSQL, a Redis/BullMQ worker submits and polls Ab3ad3d, and generated results are downloaded into app-controlled storage before users can download them.
- Frontend: upload page, job status page, login page, admin page.
- Backend: App Router API routes under `app/api/**`.
- Persistence uses the production-style stack:
  - PostgreSQL for users/assets/jobs/events/billing
  - Redis + BullMQ for background job execution
  - Cloudflare R2 object storage for uploads and results
- Authentication is now email/password with signed HTTP-only session cookies.
- Admin access is restricted via authenticated admin users / allowlists.
- Ab3ad3d integration lives in `lib/hi3d-client.ts`.
- Job orchestration lives in `lib/job-runner.ts`.
- Validation lives in `lib/validation.ts`.
- Health/readiness checks live in `lib/ops.ts`, `app/api/health/route.ts`, and `scripts/healthcheck.ts`.
- Local/dev default is `HI3D_MODE=mock`; production should use real Ab3ad3d credentials plus callback signing.

## Overview
- User flow:
  1. User signs in with email/password.
  2. User uploads one image through `/api/uploads`.
  3. UI calls `/api/generations` to create a queued generation job.
  4. Background worker picks up the queued job, submits it to Ab3ad3d, polls/callbacks for completion, downloads the result into local/object storage, and marks the job completed.
  5. User downloads the generated `.glb` from the app, not from a transient Ab3ad3d URL.
- Security model:
  - Auth uses signed HTTP-only session cookies.
  - API routes must enforce asset/job ownership.
  - Admin views are restricted by authenticated admin user checks.
  - Ab3ad3d callbacks must remain signed/verified in production flows.
  - Result downloads must be host-restricted when using remote URLs.

## Structure
- `app/`
  - App Router pages and API routes.
  - `app/page.tsx` is the main authenticated upload entry.
  - `app/api/uploads/route.ts` handles file validation + persistence.
  - `app/api/generations/route.ts` creates queued jobs.
  - `app/api/generations/[jobId]/route.ts` returns job/event state for polling UI.
- `components/`
  - Upload form, inline progress UI, job status UI, and shared UI primitives.
- `lib/`
  - Core runtime logic: auth, DB, store helpers, queue, worker/job runner, storage, Ab3ad3d client/security, validation.
- `scripts/`
  - Worker entrypoint, local env loading, healthcheck, admin seed helpers.
- `tests/`
  - Focused unit/integration-style tests for auth, env handling, validation, storage, and Ab3ad3d security.
- `assets/`
  - Local sample assets used in the UI/demo experience.
- `data/`
  - Local persisted storage when using the local storage driver.

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
- Keep secrets server-side only; never expose Ab3ad3d credentials to the browser.
- Do not rely on temporary Ab3ad3d result URLs; results must be downloaded into local/object storage.
- Preserve ownership checks on job and file endpoints.
- Do not reintroduce `x-demo-user` or other client-controlled identity shortcuts.
- Keep `/api/health` protected by admin auth or `HEALTHCHECK_TOKEN`.
- Keep Ab3ad3d callback verification and trusted result-host checks intact when modifying production flows.

## Local Dev Notes
- Typical local startup sequence:
```bash
cp .env.example .env.local
npm install
docker compose up -d
npm run seed-admin
npm run worker
npm run dev
```
- The web app and the worker are separate processes. If uploads succeed but jobs remain at `queued`, check the worker before touching frontend code.
- Local queue and database defaults only help when env resolution succeeds. Worker/script env loading comes from `scripts/load-env.ts`.
- Empty exported env vars can break local scripts by masking `.env` values; `scripts/load-env.ts` now treats empty values as unset so `.env`/`.env.local` can supply them.

## Key Files
- `app/page.tsx` — upload UI / auth gate
- `app/login/page.tsx` — login/register page
- `app/jobs/[jobId]/page.tsx` — job progress UI
- `app/admin/page.tsx` — admin jobs table with failure diagnostics
- `app/api/auth/**` — auth/session endpoints
- `app/api/uploads/route.ts` — file uploads
- `app/api/generations/**` — create/status/download/retry
- `app/api/hi3d/callback/route.ts` — signed Ab3ad3d callback handler
- `app/api/health/route.ts` — protected readiness endpoint
- `lib/auth.ts` / `lib/auth-utils.ts` — auth and session helpers
- `lib/hi3d-client.ts` — Ab3ad3d submission/query client
- `lib/job-runner.ts` — polling fallback, callback completion, durable downloads
- `lib/store.ts` — PostgreSQL persistence helpers
- `lib/storage.ts` — local/R2 storage helpers
- `lib/hi3d-security.ts` — Ab3ad3d callback/result URL hardening
- `lib/queue.ts` / `lib/worker.ts` — BullMQ enqueue + worker process
- `scripts/load-env.ts` — local env loader for worker/healthcheck/seed scripts
- `tests/validation.test.ts` — validation tests
- `tests/auth-utils.test.ts` / `tests/hi3d-security.test.ts` — auth and Ab3ad3d security tests
- `tests/load-env.test.ts` — regression coverage for empty env vars vs `.env` loading

## Current Status
- Authenticated upload -> queued job -> worker processing -> generated `.glb` download is working locally.
- The recent local blocker was not Ab3ad3d mode; it was worker env resolution.
- Root cause: empty exported env vars could mask `.env` values for `DATABASE_URL` / `REDIS_URL`, leaving jobs stuck at `queued` because the worker failed before processing.
- Current fix: `scripts/load-env.ts` now loads `.env` values when the existing process env value is empty, and `tests/load-env.test.ts` covers the regression.
- When debugging similar issues:
  - If `/api/uploads` and `/api/generations` both return `200` but job status stays `queued` with `pollAttempts: 0`, inspect the worker first.
  - If the worker reaches `submit_started` / `submitted_to_hi3d`, then start checking Ab3ad3d config/mode.

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
- If real Ab3ad3d contract details differ, adjust callback field names / extra submit fields via env before changing code.
- Consider adding a worker startup self-check that reports whether required env keys are present without printing secret values.

## Session Close
- If code changed: run lint, tests, and build.
- Close completed beads issues.
- If a git remote exists, `git pull --rebase && git push` before ending.
